/**
 * The single GitHub API client for repo-dive.
 *
 * Design (see ENG-PLAN.md decision D1):
 *   - One server-side PAT, set as env var GITHUB_PAT.
 *   - All requests routed through fetchGithub() so caching + circuit breaker
 *     + retry are applied uniformly.
 *   - Vercel KV cache, 24h TTL by default. Per-method overrides where useful.
 *   - On transient 5xx: one retry at 500ms backoff (failure-mode #3 in ENG-PLAN).
 *   - Circuit breaker (see lib/rate-limit.ts): opens when remaining < 500.
 *     When open, getters return cached/stale data; if no cache, they throw
 *     GitHubDegradedError so the page can render a "showing cached data" banner.
 *
 *                       REQUEST FLOW
 *
 *     getRepoMeta(owner, repo)
 *          │
 *          ▼
 *     cacheGet("repo", "owner/repo") ──hit──▶ return data
 *          │
 *          miss
 *          ▼
 *     isCircuitOpen() ──open──▶ throw GitHubDegradedError
 *          │
 *          closed
 *          ▼
 *     fetchGithub("/repos/owner/repo")
 *          │  (record headers, retry once on 5xx)
 *          ▼
 *     cacheSet("repo", "owner/repo", data, 86400)
 *          │
 *          ▼
 *     return data
 */

import { cacheGet, cacheSet } from "./kv";
import { isCircuitOpen, recordRateLimitHeaders } from "./rate-limit";

// ──────────────────────────────────────────────────────────────────────────────
// Types — minimal shapes we actually consume. Not full GitHub API surface.

export type RepoMeta = {
  id: number;
  fullName: string; // "vercel/next.js"
  owner: { login: string; avatarUrl: string };
  description: string | null;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  defaultBranch: string;
  createdAt: string; // ISO
  pushedAt: string; // ISO
  homepage: string | null;
  language: string | null;
  archived: boolean;
};

export type Contributor = {
  login: string;
  avatarUrl: string;
  contributions: number;
};

export type StargazerSample = {
  // Each star event: starred_at + the starring user (we only need the timestamp).
  starredAt: string; // ISO
};

export type ReadmeContent = {
  /** UTF-8 decoded markdown source. May be empty if the repo has no README. */
  content: string;
  /** Size in bytes per GitHub's response (proxy for completeness signals). */
  size: number;
};

// ──────────────────────────────────────────────────────────────────────────────
// Errors

export class GitHubNotFoundError extends Error {
  constructor(path: string) {
    super(`GitHub 404: ${path}`);
    this.name = "GitHubNotFoundError";
  }
}

export class GitHubDegradedError extends Error {
  constructor(reason: string) {
    super(`GitHub degraded: ${reason}`);
    this.name = "GitHubDegradedError";
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Low-level fetch wrapper

const BASE = "https://api.github.com";
const USER_AGENT = "repo-dive (https://github.com/yourname/repo-dive)";

type FetchOpts = {
  acceptHeader?: string;
};

async function fetchGithub(
  path: string,
  opts: FetchOpts = {},
): Promise<Response> {
  const pat = process.env.GITHUB_PAT;
  const headers: Record<string, string> = {
    Accept: opts.acceptHeader ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  if (pat) headers.Authorization = `Bearer ${pat}`;

  // One retry on transient 5xx after 500ms (failure mode #3 in ENG-PLAN).
  let res = await fetch(`${BASE}${path}`, { headers });
  if (res.status >= 500 && res.status < 600) {
    await new Promise((r) => setTimeout(r, 500));
    res = await fetch(`${BASE}${path}`, { headers });
  }

  recordRateLimitHeaders(res.headers);
  return res;
}

/**
 * Cached, circuit-breaker-aware wrapper. Returns the parsed JSON of `path` or
 * throws GitHubNotFoundError / GitHubDegradedError.
 */
async function getJson<T>(
  namespace: string,
  cacheKey: string,
  path: string,
  ttlSeconds: number,
  opts: FetchOpts = {},
): Promise<T> {
  const cached = await cacheGet<T>(namespace, cacheKey);
  if (cached && !cached.stale) return cached.data;

  if (isCircuitOpen()) {
    if (cached) return cached.data; // serve stale
    throw new GitHubDegradedError(
      `circuit breaker open and no cache for ${path}`,
    );
  }

  const res = await fetchGithub(path, opts);

  if (res.status === 404) throw new GitHubNotFoundError(path);
  if (!res.ok) {
    if (cached) return cached.data; // fall back to stale on unexpected failure
    throw new Error(`GitHub ${res.status} for ${path}`);
  }

  const data = (await res.json()) as T;
  await cacheSet(namespace, cacheKey, data, ttlSeconds);
  return data;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API — what page components and other lib/ modules call.

const DAY = 60 * 60 * 24;

export async function getRepoMeta(
  owner: string,
  repo: string,
): Promise<RepoMeta> {
  type RawRepo = {
    id: number;
    full_name: string;
    owner: { login: string; avatar_url: string };
    description: string | null;
    topics: string[];
    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
    open_issues_count: number;
    default_branch: string;
    created_at: string;
    pushed_at: string;
    homepage: string | null;
    language: string | null;
    archived: boolean;
  };
  const raw = await getJson<RawRepo>(
    "repo",
    `${owner}/${repo}`,
    `/repos/${owner}/${repo}`,
    DAY,
  );
  return {
    id: raw.id,
    fullName: raw.full_name,
    owner: { login: raw.owner.login, avatarUrl: raw.owner.avatar_url },
    description: raw.description,
    topics: raw.topics ?? [],
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    watchers: raw.watchers_count,
    openIssues: raw.open_issues_count,
    defaultBranch: raw.default_branch,
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at,
    homepage: raw.homepage,
    language: raw.language,
    archived: raw.archived,
  };
}

/**
 * Fetch one page of stargazers with timestamps. Called by lib/star-history.ts
 * which samples specific pages (first + last + 8 evenly-spaced middle).
 *
 * GitHub max perPage is 100.
 */
export async function getStargazerPage(
  owner: string,
  repo: string,
  page: number,
  perPage = 100,
): Promise<StargazerSample[]> {
  type RawStar = { starred_at: string; user: { login: string } | null };
  const raw = await getJson<RawStar[]>(
    "stargazers",
    `${owner}/${repo}/p${page}/n${perPage}`,
    `/repos/${owner}/${repo}/stargazers?per_page=${perPage}&page=${page}`,
    DAY,
    { acceptHeader: "application/vnd.github.star+json" },
  );
  return raw
    .filter((s) => Boolean(s.starred_at))
    .map((s) => ({ starredAt: s.starred_at }));
}

export async function getContributors(
  owner: string,
  repo: string,
): Promise<Contributor[]> {
  type RawContributor = {
    login: string;
    avatar_url: string;
    contributions: number;
  };
  const raw = await getJson<RawContributor[]>(
    "contributors",
    `${owner}/${repo}`,
    `/repos/${owner}/${repo}/contributors?per_page=30`,
    DAY,
  );
  return raw.map((c) => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    contributions: c.contributions,
  }));
}

export async function getReadme(
  owner: string,
  repo: string,
): Promise<ReadmeContent> {
  type RawReadme = { content: string; encoding: string; size: number };
  const raw = await getJson<RawReadme>(
    "readme",
    `${owner}/${repo}`,
    `/repos/${owner}/${repo}/readme`,
    DAY,
  );
  // GitHub returns base64-encoded by default.
  const decoded =
    raw.encoding === "base64"
      ? Buffer.from(raw.content, "base64").toString("utf-8")
      : raw.content;
  return { content: decoded, size: raw.size };
}
