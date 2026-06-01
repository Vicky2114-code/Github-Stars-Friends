/**
 * In-process rate-limit tracker for the single GitHub PAT.
 *
 * GitHub returns these headers on every response:
 *   x-ratelimit-limit      — usually 5000 for authenticated
 *   x-ratelimit-remaining  — what's left in the current window
 *   x-ratelimit-reset      — epoch seconds when the window resets
 *
 * We track the lowest "remaining" seen across all in-flight requests so the
 * circuit breaker has the most pessimistic view. When remaining drops below
 * THRESHOLD, the breaker opens and getGithub() will return cached/stale data
 * instead of making new requests until the reset time.
 *
 * Per-request memory only — Vercel serverless restarts wipe this, which is the
 * correct behavior (each cold lambda fetches fresh headers on its first call).
 *
 *                                  STATE MACHINE
 *
 *   CLOSED  ──[remaining < THRESHOLD]──▶  OPEN
 *                                            │
 *                                            └─[now > resetAt]─▶ CLOSED
 */

/**
 * Threshold is adaptive: we trip when remaining < 10% of the total limit,
 * floored at 5 (so the anonymous 60/hr bucket trips at 6, the authenticated
 * 5000/hr bucket trips at 500). A flat 500 threshold was wrong for
 * anonymous traffic — see the bug found during T6 verification.
 */
const ABSOLUTE_FLOOR = 5;
const PERCENT_THRESHOLD = 0.1;

type State = {
  remaining: number; // last-seen remaining count
  limit: number; // last-seen limit (defaults to 5000 = authenticated default)
  resetAt: number; // epoch ms when the bucket resets
};

const initial: State = {
  remaining: Number.POSITIVE_INFINITY,
  limit: 5000,
  resetAt: 0,
};
let state: State = { ...initial };

export function recordRateLimitHeaders(headers: Headers): void {
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const limit = Number(headers.get("x-ratelimit-limit"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(remaining) && remaining < state.remaining) {
    state = {
      remaining,
      limit: Number.isFinite(limit) && limit > 0 ? limit : state.limit,
      resetAt: reset * 1000,
    };
  }
}

function threshold(limit: number): number {
  return Math.max(ABSOLUTE_FLOOR, Math.floor(limit * PERCENT_THRESHOLD));
}

export function isCircuitOpen(): boolean {
  if (Date.now() > state.resetAt) {
    // Window expired — assume the bucket is healthy until proven otherwise.
    state = { ...initial };
    return false;
  }
  return state.remaining < threshold(state.limit);
}

export function getRateLimitState(): Readonly<State> {
  return { ...state };
}

/**
 * Test-only: reset the tracker between tests. No-op in production code paths.
 */
export function __resetRateLimit(): void {
  state = { ...initial };
}
