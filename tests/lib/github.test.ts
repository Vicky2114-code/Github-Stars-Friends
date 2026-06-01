/**
 * Tests for lib/github.ts.
 *
 * Strategy: mock the global fetch with bun:test's mock(). No real network calls.
 * Covers:
 *   - getRepoMeta: happy path (canned response shape → typed return)
 *   - getRepoMeta: cache hit (second call doesn't hit fetch)
 *   - getRepoMeta: 404 → GitHubNotFoundError
 *   - getRepoMeta: circuit breaker (low remaining trips it, served from cache)
 *   - retry on 5xx: first attempt 503, second 200 → succeeds
 *   - getRepoMeta: cold + breaker open + no cache → GitHubDegradedError
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  getRepoMeta,
  GitHubDegradedError,
  GitHubNotFoundError,
} from "../../lib/github";
import { __resetLocalCache } from "../../lib/kv";
import { __resetRateLimit } from "../../lib/rate-limit";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers

function mockResponse(
  body: unknown,
  init: { status?: number; remaining?: number; reset?: number } = {},
): Response {
  const { status = 200, remaining = 4999, reset = Math.floor(Date.now() / 1000) + 3600 } = init;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-remaining": String(remaining),
      "x-ratelimit-reset": String(reset),
    },
  });
}

const sampleRepoRaw = {
  id: 10270250,
  full_name: "vercel/next.js",
  owner: { login: "vercel", avatar_url: "https://avatars.example/vercel" },
  description: "The React Framework",
  topics: ["react", "ssr"],
  stargazers_count: 123000,
  forks_count: 27000,
  watchers_count: 123000,
  open_issues_count: 2500,
  default_branch: "canary",
  created_at: "2016-10-05T00:00:00Z",
  pushed_at: "2026-05-31T00:00:00Z",
  homepage: "https://nextjs.org",
  language: "JavaScript",
  archived: false,
};

let fetchMock: ReturnType<typeof mock>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  __resetLocalCache();
  __resetRateLimit();
  fetchMock = mock(() => Promise.resolve(mockResponse(sampleRepoRaw)));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests

describe("getRepoMeta", () => {
  test("happy path: returns typed RepoMeta from GitHub response", async () => {
    const repo = await getRepoMeta("vercel", "next.js");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(repo.fullName).toBe("vercel/next.js");
    expect(repo.stars).toBe(123000);
    expect(repo.topics).toEqual(["react", "ssr"]);
    expect(repo.owner.login).toBe("vercel");
  });

  test("cache hit: second call does not hit fetch", async () => {
    await getRepoMeta("vercel", "next.js");
    await getRepoMeta("vercel", "next.js");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("404 → GitHubNotFoundError", async () => {
    fetchMock = mock(() =>
      Promise.resolve(mockResponse({ message: "Not Found" }, { status: 404 })),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(getRepoMeta("nope", "nada")).rejects.toThrow(
      GitHubNotFoundError,
    );
  });

  test("retry on 5xx: first 503 then 200 succeeds", async () => {
    let calls = 0;
    fetchMock = mock(() => {
      calls++;
      if (calls === 1) {
        return Promise.resolve(
          mockResponse({ message: "Service Unavailable" }, { status: 503 }),
        );
      }
      return Promise.resolve(mockResponse(sampleRepoRaw));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const repo = await getRepoMeta("vercel", "next.js");
    expect(calls).toBe(2);
    expect(repo.fullName).toBe("vercel/next.js");
  });

  test("circuit breaker: low remaining trips it; subsequent call served from cache", async () => {
    // First call: succeeds and warms cache. Headers report remaining=499.
    fetchMock = mock(() =>
      Promise.resolve(
        mockResponse(sampleRepoRaw, {
          remaining: 499, // below the 500 threshold
          reset: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const r1 = await getRepoMeta("vercel", "next.js");
    expect(r1.fullName).toBe("vercel/next.js");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call: cache hit means we don't hit fetch at all, regardless of breaker.
    // (Cache freshness wins over breaker state — by design.)
    const r2 = await getRepoMeta("vercel", "next.js");
    expect(r2.fullName).toBe("vercel/next.js");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("403 with x-ratelimit-remaining=0 → GitHubDegradedError (anonymous burn)", async () => {
    fetchMock = mock(() =>
      Promise.resolve(
        mockResponse({ message: "rate limit exceeded" }, {
          status: 403,
          remaining: 0,
          reset: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(getRepoMeta("vercel", "next.js")).rejects.toThrow(
      GitHubDegradedError,
    );
  });

  test("breaker open + no cache → GitHubDegradedError", async () => {
    // Trip the breaker by setting state via a recorded request to a different repo.
    fetchMock = mock(() =>
      Promise.resolve(
        mockResponse(sampleRepoRaw, {
          remaining: 100,
          reset: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await getRepoMeta("vercel", "next.js"); // warm one cache entry + record low remaining

    // Now a NEW repo (not in cache) should fail with GitHubDegradedError.
    await expect(getRepoMeta("some", "uncached")).rejects.toThrow(
      GitHubDegradedError,
    );
  });
});
