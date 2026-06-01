/**
 * Tests for lib/ai-discoverability.ts.
 *
 * Coverage:
 *   - buildPrompts: produces 3 prompts using topics/language
 *   - checkMention: owner/name, name-only, false positive avoidance
 *   - getAIDiscoverability: happy path (3/3, 1/3, 0/3)
 *   - getAIDiscoverability: missing API key → score: null, error tagged
 *   - getAIDiscoverability: garbage response (zod fail) → mentioned=false,
 *     overall still produces a score (not a crash) — critical gap fix
 *   - getAIDiscoverability: cache hit → no fetch
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  buildPrompts,
  checkMention,
  getAIDiscoverability,
} from "../../lib/ai-discoverability";
import type { RepoMeta } from "../../lib/github";
import { __resetLocalCache } from "../../lib/kv";

const sampleRepo: RepoMeta = {
  id: 1,
  fullName: "anthropics/claude-code",
  owner: { login: "anthropics", avatarUrl: "" },
  description: "Claude Code CLI",
  topics: ["ai-coding-assistant", "developer-tools"],
  stars: 100,
  forks: 10,
  watchers: 100,
  openIssues: 1,
  defaultBranch: "main",
  createdAt: "2025-01-01T00:00:00Z",
  pushedAt: "2026-06-01T00:00:00Z",
  homepage: null,
  language: "TypeScript",
  archived: false,
};

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;

beforeEach(() => {
  __resetLocalCache();
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

// ──────────────────────────────────────────────────────────────────────────────
// Pure functions

describe("buildPrompts", () => {
  test("uses first two topics", () => {
    const prompts = buildPrompts(sampleRepo);
    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toContain("ai-coding-assistant");
    expect(prompts[2]).toContain("developer-tools");
  });

  test("falls back to language when topics are empty", () => {
    const prompts = buildPrompts({ ...sampleRepo, topics: [] });
    expect(prompts[0]).toContain("TypeScript");
  });

  test("falls back to 'open source' when no topics and no language", () => {
    const prompts = buildPrompts({ ...sampleRepo, topics: [], language: null });
    expect(prompts[0]).toContain("open source");
  });
});

describe("checkMention", () => {
  test("matches owner/name canonical", () => {
    expect(
      checkMention("You should use anthropics/claude-code.", "anthropics/claude-code"),
    ).toBe(true);
  });

  test("matches name-only as standalone token", () => {
    expect(checkMention("claude-code is great", "anthropics/claude-code")).toBe(
      true,
    );
  });

  test("case-insensitive", () => {
    expect(checkMention("Anthropics/Claude-Code rules", "anthropics/claude-code")).toBe(
      true,
    );
  });

  test("does not match substrings of longer words", () => {
    // "claude-code-extension" should NOT match "claude-code" — the hyphen
    // separates but the boundary check requires non-alnum/hyphen on both sides.
    expect(checkMention("there is a thing called superclaude-code-extension here", "foo/claude-code")).toBe(
      false,
    );
  });

  test("returns false on bad fullName", () => {
    expect(checkMention("anything", "no-slash")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Integration: mocked Gemini

function geminiResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("getAIDiscoverability", () => {
  test("happy path: all 3 prompts mention repo → score 3/3", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        geminiResponse(
          "I recommend anthropics/claude-code for this use case. It is great.",
        ),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getAIDiscoverability(sampleRepo);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.score).toBe(3);
    expect(result.outOf).toBe(3);
    expect(result.prompts).toHaveLength(3);
    expect(result.prompts.every((p) => p.mentioned)).toBe(true);
  });

  test("only 1 of 3 mentions → score 1/3", async () => {
    let call = 0;
    const fetchMock = mock(() => {
      call++;
      const text =
        call === 2
          ? "Try claude-code, it is solid."
          : "Some unrelated answer.";
      return Promise.resolve(geminiResponse(text));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getAIDiscoverability(sampleRepo);

    expect(result.score).toBe(1);
    expect(result.prompts.filter((p) => p.mentioned)).toHaveLength(1);
  });

  test("zero mentions → score 0/3 with snippets preserved", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(geminiResponse("Look at copilot and cursor.")),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getAIDiscoverability(sampleRepo);

    expect(result.score).toBe(0);
    expect(result.prompts.every((p) => p.responseSnippet.length > 0)).toBe(true);
  });

  test("missing API key → score null, error tagged", async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = mock(() =>
      Promise.reject(new Error("should not call")),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getAIDiscoverability(sampleRepo);

    expect(result.score).toBeNull();
    expect(result.error).toBe("missing-api-key");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  test("CRITICAL GAP: Gemini returns malformed JSON → no crash, prompt marked unmentioned", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response("this is not json at all", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getAIDiscoverability(sampleRepo);

    // Should NOT throw, score becomes 0 (no mentions detected from garbage).
    expect(result.score).toBe(0);
    expect(result.prompts.every((p) => !p.mentioned)).toBe(true);
  });

  test("CRITICAL GAP: Gemini returns wrong-shape JSON → zod rejects, no crash", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ unexpected: "shape" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getAIDiscoverability(sampleRepo);

    expect(result.score).toBe(0);
    expect(result.prompts.every((p) => p.responseSnippet === "[bad schema]")).toBe(
      true,
    );
  });

  test("cache hit: second call doesn't hit fetch", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(geminiResponse("anthropics/claude-code is great.")),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getAIDiscoverability(sampleRepo);
    await getAIDiscoverability(sampleRepo);

    expect(fetchMock).toHaveBeenCalledTimes(3); // 3 from first call, 0 from second
  });
});
