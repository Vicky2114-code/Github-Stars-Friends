/**
 * Tests for lib/star-history.ts — focus on the sampling math (pure function)
 * and the cumulative-star reconstruction logic.
 *
 * Sampling math is tested without mocking fetch (computeSampledPages is pure).
 * Integration test mocks getStargazerPage by mocking global fetch (same pattern
 * as github.test.ts).
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { computeSampledPages, getStarHistory } from "../../lib/star-history";
import { __resetLocalCache } from "../../lib/kv";
import { __resetRateLimit } from "../../lib/rate-limit";

// ──────────────────────────────────────────────────────────────────────────────
// Pure sampling math — no network

describe("computeSampledPages", () => {
  test("0 stars: empty", () => {
    expect(computeSampledPages(0)).toEqual([]);
  });

  test("under 100 stars: 1 page", () => {
    expect(computeSampledPages(50)).toEqual([1]);
  });

  test("exactly 100 stars: 1 page", () => {
    expect(computeSampledPages(100)).toEqual([1]);
  });

  test("101 stars: 2 pages", () => {
    expect(computeSampledPages(101)).toEqual([1, 2]);
  });

  test("1000 stars (10 pages): all 10 (no sampling needed)", () => {
    expect(computeSampledPages(1000)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  test("1100 stars (11 pages): sample 10 with first + last", () => {
    const pages = computeSampledPages(1100);
    expect(pages.length).toBeLessThanOrEqual(10);
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(11);
  });

  test("50000 stars (500 pages): sample 10 evenly", () => {
    const pages = computeSampledPages(50000);
    expect(pages.length).toBeLessThanOrEqual(10);
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(500);
    // Spread should be roughly even
    for (let i = 1; i < pages.length; i++) {
      const gap = pages[i] - pages[i - 1];
      expect(gap).toBeGreaterThan(0); // strictly increasing
    }
  });

  test("123456 stars: still capped at 10 pages", () => {
    expect(computeSampledPages(123456).length).toBeLessThanOrEqual(10);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Integration: getStarHistory hits getStargazerPage which hits fetch

const originalFetch = globalThis.fetch;

function makeStarPage(count: number, baseTime: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    starred_at: new Date(baseTime + i * 1000).toISOString(),
    user: { login: `user${i}` },
  }));
}

beforeEach(() => {
  __resetLocalCache();
  __resetRateLimit();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getStarHistory", () => {
  test("0 stars: no fetch, empty result", async () => {
    const fetchMock = mock(() => Promise.reject(new Error("should not call")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getStarHistory("foo", "bar", 0);

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(result.points).toEqual([]);
    expect(result.sampled).toBe(false);
    expect(result.pagesFetched).toBe(0);
  });

  test("small repo (50 stars): one page fetched, cumulative count 1..50", async () => {
    const t0 = Date.UTC(2024, 0, 1);
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(makeStarPage(50, t0)), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "4999",
            "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
          },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getStarHistory("foo", "bar", 50);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.sampled).toBe(false);
    expect(result.pagesFetched).toBe(1);
    expect(result.points).toHaveLength(50);
    expect(result.points[0].stars).toBe(1);
    expect(result.points[49].stars).toBe(50);
  });

  test("large repo (50k stars): 10 pages sampled, cumulative counts span 1..49900+", async () => {
    const t0 = Date.UTC(2020, 0, 1);
    const fetchMock = mock((_input: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(makeStarPage(100, t0)), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "4999",
            "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
          },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getStarHistory("foo", "bar", 50000);

    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(result.sampled).toBe(true);
    expect(result.pagesFetched).toBe(10);
    expect(result.points).toHaveLength(1000);
    // First sampled point should be cumulative 1 (page 1, index 0)
    expect(result.points[0].stars).toBe(1);
    // Last sampled point should be cumulative 50000 (page 500, index 99)
    const lastByStars = [...result.points].sort((a, b) => b.stars - a.stars)[0];
    expect(lastByStars.stars).toBe(50000);
  });

  test("points are sorted by date ascending", async () => {
    // Mock returns pages in reverse-time order to verify sorting.
    let callCount = 0;
    const fetchMock = mock(() => {
      callCount++;
      const base = Date.UTC(2024, 11 - callCount, 1); // pages further back in time as we fetch more
      return Promise.resolve(
        new Response(JSON.stringify(makeStarPage(100, base)), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "4999",
            "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
          },
        }),
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await getStarHistory("foo", "bar", 50000);

    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i].date >= result.points[i - 1].date).toBe(true);
    }
  });
});
