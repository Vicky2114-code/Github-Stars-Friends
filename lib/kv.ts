/**
 * Thin KV wrapper around @vercel/kv with an in-memory Map fallback for local dev.
 *
 * Why: Vercel KV credentials are only present in production / when you `vercel env pull`.
 * Local dev without credentials should still work — losing the cache between dev-server
 * restarts is fine. Production hits the real KV via the @vercel/kv client.
 *
 * Cache layout:
 *   Keys are namespaced: "rd:v1:<namespace>:<key>"
 *   Values are JSON-stringified; we wrap them with `{ data, expiresAt }` so we can
 *   serve stale-while-degraded when the circuit breaker is open.
 */

import { kv as vercelKv } from "@vercel/kv";

const NAMESPACE_PREFIX = "rd:v1";

type Wrapped<T> = {
  data: T;
  expiresAt: number; // epoch ms
};

const useRealKv = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// Local fallback: a Map that lives for the lifetime of the dev server process.
const localCache = new Map<string, Wrapped<unknown>>();

function fullKey(namespace: string, key: string): string {
  return `${NAMESPACE_PREFIX}:${namespace}:${key}`;
}

export async function cacheGet<T>(
  namespace: string,
  key: string,
): Promise<{ data: T; stale: boolean } | null> {
  const k = fullKey(namespace, key);
  const wrapped = useRealKv
    ? ((await vercelKv.get(k)) as Wrapped<T> | null)
    : ((localCache.get(k) as Wrapped<T> | undefined) ?? null);
  if (!wrapped) return null;
  return { data: wrapped.data, stale: Date.now() > wrapped.expiresAt };
}

export async function cacheSet<T>(
  namespace: string,
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  const k = fullKey(namespace, key);
  const wrapped: Wrapped<T> = {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  if (useRealKv) {
    // Set with KV TTL slightly longer than logical TTL so we can serve stale.
    await vercelKv.set(k, wrapped, { ex: ttlSeconds * 2 });
  } else {
    localCache.set(k, wrapped);
  }
}

/**
 * Test-only: clear local cache between tests. No-op in production.
 */
export function __resetLocalCache(): void {
  localCache.clear();
}

export const __isUsingRealKv = useRealKv;
