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

const THRESHOLD = 500;

type State = {
  remaining: number; // last-seen remaining count
  resetAt: number; // epoch ms when the bucket resets
};

let state: State = { remaining: Number.POSITIVE_INFINITY, resetAt: 0 };

export function recordRateLimitHeaders(headers: Headers): void {
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(remaining) && remaining < state.remaining) {
    state = { remaining, resetAt: reset * 1000 };
  }
}

export function isCircuitOpen(): boolean {
  if (Date.now() > state.resetAt) {
    // Window expired — assume the bucket is healthy until proven otherwise.
    state = { remaining: Number.POSITIVE_INFINITY, resetAt: 0 };
    return false;
  }
  return state.remaining < THRESHOLD;
}

export function getRateLimitState(): Readonly<State> {
  return { ...state };
}

/**
 * Test-only: reset the tracker between tests. No-op in production code paths.
 */
export function __resetRateLimit(): void {
  state = { remaining: Number.POSITIVE_INFINITY, resetAt: 0 };
}
