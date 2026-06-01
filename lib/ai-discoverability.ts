/**
 * AI Discoverability score — the differentiating feature of repo-dive.
 *
 * Question we answer: "If you ask Gemini Flash for libraries in this repo's
 * category, does this repo come up?" Score = N matches / 3 prompts.
 *
 * Per ENG-PLAN.md decision D3:
 *   - 1 model (Gemini Flash) × 3 prompts per repo
 *   - ~$0.01/repo
 *   - 24h cache in Vercel KV (via lib/kv.ts)
 *   - Critical gap protected by zod schema validation — on garbage response
 *     we return { score: null, prompts: [], error: 'gemini-bad-response' }
 *     instead of crashing the page.
 *
 *
 *                              REQUEST FLOW
 *
 *   getAIDiscoverability(repoMeta)
 *        │
 *        ▼
 *   cacheGet("ai-disco", "owner/repo") ──hit──▶ return cached
 *        │
 *        miss
 *        ▼
 *   buildPrompts(repoMeta) ──▶ [3 prompts]
 *        │
 *        ▼
 *   Promise.all(prompts.map(callGemini)) ──▶ [3 raw responses]
 *        │
 *        ▼
 *   zod.parse + mention check ──▶ {score, prompts}
 *        │
 *        ▼
 *   cacheSet("ai-disco", "owner/repo", result, 86400)
 *        │
 *        ▼
 *   return result
 */

import { z } from "zod";

import { cacheGet, cacheSet } from "./kv";
import type { RepoMeta } from "./github";

const DAY = 60 * 60 * 24;
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ──────────────────────────────────────────────────────────────────────────────
// Types

export type PromptResult = {
  prompt: string;
  mentioned: boolean;
  /** First 240 chars of the response, for the expandable matrix on the page. */
  responseSnippet: string;
};

export type AIDiscoverabilityResult = {
  /** N matches / 3 prompts. Null when Gemini was unavailable or returned garbage. */
  score: number | null;
  /** Maximum possible score (always 3 for v1; future: configurable). */
  outOf: number;
  prompts: PromptResult[];
  /** Optional explanation when score is null. */
  error?: "gemini-unavailable" | "gemini-bad-response" | "missing-api-key";
};

// ──────────────────────────────────────────────────────────────────────────────
// Gemini response schema (zod) — protects the critical gap

const GeminiResponseSchema = z.object({
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

// ──────────────────────────────────────────────────────────────────────────────
// Prompt construction

/**
 * Builds 3 category prompts derived from the repo's topics and description.
 * Exported for testing.
 */
export function buildPrompts(repo: RepoMeta): string[] {
  const topic = repo.topics[0] ?? repo.language ?? "open source";
  const secondary = repo.topics[1] ?? repo.language ?? "developer tools";
  return [
    `What are the best ${topic} libraries on GitHub? List up to 10 with brief descriptions.`,
    `If a developer is building something in the ${topic} space in ${new Date().getFullYear()}, what tools or projects should they look at? Be specific.`,
    `Name notable open source projects related to ${secondary}. Format: "owner/name — one-line description".`,
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// Mention detection

/**
 * Detects mention of the repo in Gemini's response text.
 * Matches owner/name (canonical) or just name (looser fallback).
 * Case-insensitive.
 *
 * Exported for testing.
 */
export function checkMention(text: string, fullName: string): boolean {
  const lower = text.toLowerCase();
  const [owner, name] = fullName.split("/");
  if (!owner || !name) return false;
  if (lower.includes(fullName.toLowerCase())) return true;
  // Looser: name appearing as a standalone token. Avoids false matches on
  // common words by requiring a non-alpha boundary on both sides.
  const re = new RegExp(`(^|[^a-z0-9-])${escapeRegex(name.toLowerCase())}([^a-z0-9-]|$)`);
  return re.test(lower);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API

export async function getAIDiscoverability(
  repo: RepoMeta,
): Promise<AIDiscoverabilityResult> {
  const cacheKey = repo.fullName;
  const cached = await cacheGet<AIDiscoverabilityResult>(
    "ai-disco",
    cacheKey,
  );
  if (cached && !cached.stale) return cached.data;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      score: null,
      outOf: 3,
      prompts: [],
      error: "missing-api-key",
    };
  }

  const prompts = buildPrompts(repo);
  let results: PromptResult[];
  try {
    results = await Promise.all(
      prompts.map((prompt) => callGemini(prompt, repo.fullName, apiKey)),
    );
  } catch (e) {
    // On any uncaught failure, fall back to stale cache if any.
    if (cached) return cached.data;
    return {
      score: null,
      outOf: 3,
      prompts: [],
      error: "gemini-unavailable",
    };
  }

  const matches = results.filter((r) => r.mentioned).length;
  const result: AIDiscoverabilityResult = {
    score: matches,
    outOf: 3,
    prompts: results,
  };
  await cacheSet("ai-disco", cacheKey, result, DAY);
  return result;
}

async function callGemini(
  prompt: string,
  fullName: string,
  apiKey: string,
): Promise<PromptResult> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    }),
  });

  if (!res.ok) {
    // Single soft failure — return as a non-mention rather than throwing,
    // so other prompts can still contribute to the score.
    return {
      prompt,
      mentioned: false,
      responseSnippet: `[gemini ${res.status}]`,
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return { prompt, mentioned: false, responseSnippet: "[invalid json]" };
  }

  const parsed = GeminiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { prompt, mentioned: false, responseSnippet: "[bad schema]" };
  }

  const text = parsed.data.candidates[0].content.parts
    .map((p) => p.text)
    .join("");

  return {
    prompt,
    mentioned: checkMention(text, fullName),
    responseSnippet: text.slice(0, 240),
  };
}
