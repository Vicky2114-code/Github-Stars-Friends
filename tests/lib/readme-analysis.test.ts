/**
 * Tests for lib/readme-analysis.ts.
 *
 * Covers:
 *   - happy path: valid JSON response → { score, issues }
 *   - gemini wraps JSON in code fences → still parses
 *   - garbage Gemini envelope → score: null, error tagged
 *   - inner JSON wrong shape → score: null, error tagged
 *   - missing API key → score: null, error tagged
 *   - missing README (404 from GitHub) → score: null, error 'no-readme'
 *   - cache hit on second call → no fetch
 *   - buildPrompt: contains readme + fullName
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  buildPrompt,
  getReadmeAnalysis,
} from "../../lib/readme-analysis";
import { __resetLocalCache } from "../../lib/kv";
import { __resetRateLimit } from "../../lib/rate-limit";

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;

beforeEach(() => {
  __resetLocalCache();
  __resetRateLimit();
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

// ──────────────────────────────────────────────────────────────────────────────
// Mock helpers — we need TWO different responses depending on which URL is hit:
//   - github.com/repos/.../readme  → returns README content
//   - generativelanguage.../models/... → returns Gemini analysis

function githubReadmeResponse(content: string, size = 1000): Response {
  return new Response(
    JSON.stringify({
      content: Buffer.from(content).toString("base64"),
      encoding: "base64",
      size,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-ratelimit-remaining": "4999",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      },
    },
  );
}

function geminiAnalysisResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function makeRouter(
  readmeBody: () => Response,
  geminiBody: () => Response,
): ReturnType<typeof mock> {
  return mock((input: unknown) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.includes("api.github.com")) {
      return Promise.resolve(readmeBody());
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      return Promise.resolve(geminiBody());
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Pure

describe("buildPrompt", () => {
  test("includes readme content and fullName", () => {
    const p = buildPrompt("# My Project\nA thing.", "foo/bar");
    expect(p).toContain("# My Project");
    expect(p).toContain("foo/bar");
    expect(p).toContain('"score"');
    expect(p).toContain('"issues"');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Integration

describe("getReadmeAnalysis", () => {
  test("happy path: valid JSON → { score, issues }", async () => {
    const fetchMock = makeRouter(
      () => githubReadmeResponse("# Foo\nSome content"),
      () =>
        geminiAnalysisResponse(
          '{"score": 7, "issues": ["add a quickstart", "add badges"]}',
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getReadmeAnalysis("foo", "bar");

    expect(result.score).toBe(7);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toContain("quickstart");
  });

  test("Gemini wraps JSON in code fences → still parses", async () => {
    const fetchMock = makeRouter(
      () => githubReadmeResponse("# Foo"),
      () =>
        geminiAnalysisResponse(
          '```json\n{"score": 4, "issues": ["needs install steps"]}\n```',
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getReadmeAnalysis("foo", "bar");

    expect(result.score).toBe(4);
    expect(result.issues).toEqual(["needs install steps"]);
  });

  test("CRITICAL GAP: garbage Gemini envelope → no crash, gemini-bad-response", async () => {
    const fetchMock = makeRouter(
      () => githubReadmeResponse("# Foo"),
      () =>
        new Response("not even json", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }) as unknown as Response,
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Wrap with router so the response is actually returned per URL
    const router = mock((input: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("api.github.com")) {
        return Promise.resolve(githubReadmeResponse("# Foo"));
      }
      return Promise.resolve(
        new Response("not even json", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      );
    });
    globalThis.fetch = router as unknown as typeof fetch;

    const result = await getReadmeAnalysis("foo", "bar");

    expect(result.score).toBeNull();
    // QA-B3: schema/parse failures now tag as gemini-bad-response
    // (informative) instead of gemini-unavailable (transient network).
    expect(result.error).toBe("gemini-bad-response");
  });

  test("inner JSON wrong shape (no score field) → gemini-bad-response", async () => {
    const router = mock((input: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("api.github.com")) {
        return Promise.resolve(githubReadmeResponse("# Foo"));
      }
      return Promise.resolve(geminiAnalysisResponse('{"wrong":"shape"}'));
    });
    globalThis.fetch = router as unknown as typeof fetch;

    const result = await getReadmeAnalysis("foo", "bar");

    expect(result.score).toBeNull();
    expect(result.error).toBe("gemini-bad-response");
  });

  // Regression: QA-B3 — truncated JSON output (long-README + low token cap)
  // Found by /qa on 2026-06-01 — garrytan/gstack consistently failed
  // README quality with "Gemini API temporarily unreachable". Real cause:
  // Gemini ran out of output tokens mid-JSON. Now we tag it as
  // gemini-bad-response (schema failure) and have bumped tokens to 1024
  // + added responseSchema for stricter Gemini compliance.
  test("regression: truncated JSON from Gemini → gemini-bad-response not gemini-unavailable", async () => {
    const router = mock((input: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("api.github.com")) {
        return Promise.resolve(githubReadmeResponse("# Foo"));
      }
      // Simulate Gemini hitting maxOutputTokens mid-string in the JSON
      return Promise.resolve(
        geminiAnalysisResponse('{"score": 6, "issues": ["add a quickstart e'),
      );
    });
    globalThis.fetch = router as unknown as typeof fetch;

    const result = await getReadmeAnalysis("foo", "bar");

    expect(result.score).toBeNull();
    expect(result.error).toBe("gemini-bad-response");
  });

  // Regression: QA-B3 — verify the request now sends responseSchema +
  // maxOutputTokens=1024 so Gemini is hard-constrained on long-README inputs.
  test("regression: request includes responseSchema and maxOutputTokens=1024", async () => {
    let geminiBody: unknown = null;
    const router = mock((input: unknown, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("api.github.com")) {
        return Promise.resolve(githubReadmeResponse("# Foo"));
      }
      if (init?.body) {
        geminiBody = JSON.parse(String(init.body));
      }
      return Promise.resolve(
        geminiAnalysisResponse('{"score": 7, "issues": ["polish"]}'),
      );
    });
    globalThis.fetch = router as unknown as typeof fetch;

    await getReadmeAnalysis("foo", "bar");

    const cfg = (geminiBody as { generationConfig?: Record<string, unknown> })
      ?.generationConfig;
    expect(cfg?.maxOutputTokens).toBe(1024);
    expect(cfg?.responseSchema).toBeDefined();
    const schema = cfg?.responseSchema as { required?: string[] };
    expect(schema.required).toEqual(["score", "issues"]);
  });

  test("missing API key → score: null, error tagged", async () => {
    delete process.env.GEMINI_API_KEY;
    const router = mock((input: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("api.github.com")) {
        return Promise.resolve(githubReadmeResponse("# Foo"));
      }
      return Promise.reject(new Error("should not call gemini"));
    });
    globalThis.fetch = router as unknown as typeof fetch;

    const result = await getReadmeAnalysis("foo", "bar");

    expect(result.score).toBeNull();
    expect(result.error).toBe("missing-api-key");
  });

  test("README missing (404) → score: null, error 'no-readme'", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "4999",
            "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
          },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getReadmeAnalysis("foo", "bar");

    expect(result.score).toBeNull();
    expect(result.error).toBe("no-readme");
  });

  test("cache hit: second call doesn't hit fetch", async () => {
    const fetchMock = makeRouter(
      () => githubReadmeResponse("# Foo"),
      () =>
        geminiAnalysisResponse(
          '{"score": 8, "issues": ["add license badge"]}',
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getReadmeAnalysis("foo", "bar");
    const callsAfterFirst = fetchMock.mock.calls.length;
    await getReadmeAnalysis("foo", "bar");
    const callsAfterSecond = fetchMock.mock.calls.length;

    expect(callsAfterSecond).toBe(callsAfterFirst);
  });
});
