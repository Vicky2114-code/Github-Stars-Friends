/**
 * README quality analysis.
 *
 * Asks Gemini Flash to score the repo's README on a 0-10 scale and surface
 * 3-5 concrete improvement suggestions. Cached 24h per repo.
 *
 * Why: many promising repos lose discovery because their README is sparse,
 * missing examples, or fails to communicate the value prop. This card on the
 * deep-dive page tells the owner exactly what would help.
 *
 * Schema enforced via zod (same critical-gap discipline as ai-discoverability):
 * on a garbage Gemini response we return { score: null, issues: [], error }
 * instead of crashing the page.
 *
 *
 *                          FLOW
 *
 *   getReadmeAnalysis(owner, repo)
 *       │
 *       ▼
 *   cacheGet("readme-analysis", "owner/repo") ──hit──▶ return cached
 *       │
 *       miss
 *       ▼
 *   getReadme(owner, repo) ──▶ markdown text + size
 *       │
 *       ▼
 *   Gemini(prompt + truncated readme) ──▶ JSON {score, issues}
 *       │
 *       ▼
 *   zod.parse ──▶ result
 *       │
 *       ▼
 *   cacheSet 86400s
 *       │
 *       ▼
 *   return result
 */

import { z } from "zod";

import { getReadme, GitHubNotFoundError } from "./github";
import { cacheGet, cacheSet } from "./kv";

const DAY = 60 * 60 * 24;
const README_TRUNCATE = 8000; // chars — Gemini Flash handles this comfortably
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ──────────────────────────────────────────────────────────────────────────────
// Types

export type ReadmeAnalysisResult = {
  /** Quality 0-10. Null when README is missing or Gemini failed. */
  score: number | null;
  /** Concrete improvement suggestions (3-5 items). */
  issues: string[];
  /** When score is null, why. */
  error?:
    | "no-readme"
    | "gemini-unavailable"
    | "gemini-bad-response"
    | "missing-api-key";
};

// Gemini response (model-text envelope)
const GeminiEnvelopeSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string() })),
        }),
      }),
    )
    .min(1),
});

// Inner JSON we asked Gemini to produce
const AnalysisSchema = z.object({
  score: z.number().min(0).max(10),
  issues: z.array(z.string()).max(8),
});

// ──────────────────────────────────────────────────────────────────────────────
// Public API

export async function getReadmeAnalysis(
  owner: string,
  repo: string,
): Promise<ReadmeAnalysisResult> {
  const cacheKey = `${owner}/${repo}`;
  const cached = await cacheGet<ReadmeAnalysisResult>(
    "readme-analysis",
    cacheKey,
  );
  if (cached && !cached.stale) return cached.data;

  // Fetch the README. 404 (no README) is a real signal — score: null + tag.
  let readme: { content: string; size: number };
  try {
    readme = await getReadme(owner, repo);
  } catch (e) {
    if (e instanceof GitHubNotFoundError) {
      return { score: null, issues: [], error: "no-readme" };
    }
    throw e;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { score: null, issues: [], error: "missing-api-key" };
  }

  const truncated =
    readme.content.length > README_TRUNCATE
      ? readme.content.slice(0, README_TRUNCATE)
      : readme.content;

  const prompt = buildPrompt(truncated, `${owner}/${repo}`);

  let parsed: { score: number; issues: string[] };
  try {
    parsed = await callGeminiForAnalysis(prompt, apiKey);
  } catch (e) {
    if (cached) return cached.data; // serve stale on transient failure
    // Distinguish schema/parse failures from genuine API unreachability so
    // the user-facing error message is informative.
    const msg = e instanceof Error ? e.message : "";
    const isSchemaFailure =
      msg === "json-parse" ||
      msg === "analysis-schema" ||
      msg === "envelope-schema";
    return {
      score: null,
      issues: [],
      error: isSchemaFailure ? "gemini-bad-response" : "gemini-unavailable",
    };
  }

  const result: ReadmeAnalysisResult = {
    score: parsed.score,
    issues: parsed.issues,
  };
  await cacheSet("readme-analysis", cacheKey, result, DAY);
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers (exported for testing)

export function buildPrompt(readme: string, fullName: string): string {
  return `You are evaluating the README of the GitHub repo "${fullName}".

Rate its quality from 0 to 10 where:
  0 = empty or one sentence
  5 = describes the project but missing examples or install instructions
  10 = clear value prop, install steps, runnable example, and link to docs

Then list 3-5 specific, actionable improvements as short phrases (e.g. "add a 60-second quickstart example", "add badges for build/version/license", "clarify what problem this solves in the first paragraph").

Respond with VALID JSON ONLY in exactly this shape:
{"score": <integer 0-10>, "issues": ["...", "..."]}

Do not include markdown code fences, explanations, or any other text outside the JSON.

README:
"""
${readme}
"""`;
}

async function callGeminiForAnalysis(
  prompt: string,
  apiKey: string,
): Promise<{ score: number; issues: string[] }> {
  // QA-B3: bumped maxOutputTokens 500 -> 1024 (long READMEs were truncating
  // the JSON output, throwing json-parse, surfacing as "gemini-unavailable"
  // on repos like garrytan/gstack with verbose READMEs). Also added an
  // explicit responseSchema so Gemini is hard-constrained to {score, issues}
  // instead of just being asked nicely via responseMimeType.
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            score: { type: "integer", minimum: 0, maximum: 10 },
            issues: {
              type: "array",
              items: { type: "string" },
              maxItems: 8,
            },
          },
          required: ["score", "issues"],
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`gemini ${res.status}`);

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    // Non-JSON response body — Gemini returned plain text or HTML
    throw new Error("envelope-schema");
  }
  const envelope = GeminiEnvelopeSchema.safeParse(raw);
  if (!envelope.success) throw new Error("envelope-schema");

  const text = envelope.data.candidates[0].content.parts
    .map((p) => p.text)
    .join("");

  // Gemini sometimes wraps JSON in code fences despite the prompt; strip them.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let inner: unknown;
  try {
    inner = JSON.parse(stripped);
  } catch {
    throw new Error("json-parse");
  }

  const parsed = AnalysisSchema.safeParse(inner);
  if (!parsed.success) throw new Error("analysis-schema");

  return parsed.data;
}
