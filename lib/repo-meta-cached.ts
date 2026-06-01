/**
 * Request-scoped memoization of getRepoMeta.
 *
 * Why: the [owner]/[repo] page has multiple async server-component "slots"
 * that each need repo metadata. Without dedup, every slot would call into
 * getRepoMeta separately. Even though Vercel KV caches across requests,
 * we still want zero overhead within a single render.
 *
 * React's `cache()` collapses identical calls within the same request.
 */

import { cache } from "react";

import { getRepoMeta } from "./github";

export const getRepoMetaCached = cache(async (owner: string, repo: string) => {
  return getRepoMeta(owner, repo);
});
