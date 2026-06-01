/**
 * Per-card async server components for the repo deep-dive page.
 *
 * Each slot is its own async function so it can be wrapped in a <Suspense>
 * boundary in page.tsx. Cards stream in independently as their data resolves.
 * If a single slot throws, only that card falls back (via the slot's own
 * try/catch — Next.js 16 doesn't suspense-isolate errors automatically).
 *
 * Visual: placeholder boxes that show real data. T7 swaps in the proper
 * components (RepoHeader, StarHistoryChart, etc.) without touching slots.
 *
 *
 *                       SLOT LAYOUT (page composes these)
 *
 *   ┌──────────────────────────────────────────┐
 *   │           <RepoHeaderSlot/>              │  meta only — top of page
 *   └──────────────────────────────────────────┘
 *   ┌─────────────────────┐  ┌────────────────┐
 *   │ <AIDiscoverability  │  │ <ReadmeAnalysis│  hero cards (the differentiator)
 *   │   Slot/>            │  │   Slot/>       │
 *   └─────────────────────┘  └────────────────┘
 *   ┌─────────────────────┐  ┌────────────────┐
 *   │ <StarHistorySlot/>  │  │ <Contributor   │  data cards
 *   │                     │  │   Slot/>       │
 *   └─────────────────────┘  └────────────────┘
 */

import { getContributors, GitHubDegradedError } from "@/lib/github";
import { getStarHistory } from "@/lib/star-history";
import { getAIDiscoverability } from "@/lib/ai-discoverability";
import { getReadmeAnalysis } from "@/lib/readme-analysis";
import { getRepoMetaCached } from "@/lib/repo-meta-cached";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers

function CardShell({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border p-6 ${
        accent
          ? "border-zinc-700 bg-zinc-900/60"
          : "border-zinc-800 bg-zinc-950/40"
      }`}
    >
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DegradedNote({ reason }: { reason: string }) {
  return (
    <p className="text-sm text-amber-400/80">
      Showing cached data — {reason}
    </p>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// RepoHeaderSlot — owner, name, description, topics, stats strip

export async function RepoHeaderSlot({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const meta = await getRepoMetaCached(owner, repo);
  return (
    <header className="mb-8 border-b border-zinc-800 pb-8">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.owner.avatarUrl}
          alt={meta.owner.login}
          className="h-12 w-12 rounded-full"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-zinc-400">{meta.owner.login}</span>
            <span className="text-zinc-600"> / </span>
            <span>{repo}</span>
          </h1>
          {meta.description && (
            <p className="mt-1 max-w-2xl text-zinc-400">{meta.description}</p>
          )}
        </div>
      </div>

      {meta.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meta.topics.slice(0, 8).map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-xs text-zinc-300"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Stars" value={meta.stars.toLocaleString()} />
        <Stat label="Forks" value={meta.forks.toLocaleString()} />
        <Stat label="Watchers" value={meta.watchers.toLocaleString()} />
        <Stat label="Open Issues" value={meta.openIssues.toLocaleString()} />
      </dl>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AIDiscoverabilitySlot — the differentiator card

export async function AIDiscoverabilitySlot({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  try {
    const meta = await getRepoMetaCached(owner, repo);
    const result = await getAIDiscoverability(meta);

    return (
      <CardShell title="AI Discoverability" accent>
        {result.score === null ? (
          <DegradedNote reason={result.error ?? "unknown error"} />
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <p className="text-5xl font-bold tabular-nums">
                {result.score}
                <span className="text-3xl text-zinc-500"> / {result.outOf}</span>
              </p>
              <p className="text-sm text-zinc-400">
                prompts to Gemini Flash mention this repo
              </p>
            </div>
            <details className="mt-4 text-sm text-zinc-400">
              <summary className="cursor-pointer text-zinc-300 hover:text-white">
                See the {result.prompts.length} prompts
              </summary>
              <ul className="mt-3 space-y-3">
                {result.prompts.map((p, i) => (
                  <li
                    key={i}
                    className="rounded border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <p className="text-zinc-300">{p.prompt}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Mentioned: {p.mentioned ? "✓ yes" : "✗ no"}
                    </p>
                    <p className="mt-1 text-xs italic text-zinc-600">
                      {p.responseSnippet}…
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </CardShell>
    );
  } catch (e) {
    return (
      <CardShell title="AI Discoverability" accent>
        <DegradedNote
          reason={
            e instanceof GitHubDegradedError
              ? "GitHub API throttled"
              : "card error"
          }
        />
      </CardShell>
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ReadmeAnalysisSlot

export async function ReadmeAnalysisSlot({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  try {
    const result = await getReadmeAnalysis(owner, repo);

    return (
      <CardShell title="README Quality">
        {result.score === null ? (
          <DegradedNote reason={result.error ?? "unknown error"} />
        ) : (
          <>
            <p className="text-5xl font-bold tabular-nums">
              {result.score}
              <span className="text-3xl text-zinc-500"> / 10</span>
            </p>
            {result.issues.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-zinc-300">
                {result.issues.map((issue, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-zinc-500">→</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardShell>
    );
  } catch {
    return (
      <CardShell title="README Quality">
        <DegradedNote reason="card error" />
      </CardShell>
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// StarHistorySlot — placeholder visual (T7 swaps Recharts in)

export async function StarHistorySlot({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  try {
    const meta = await getRepoMetaCached(owner, repo);
    const result = await getStarHistory(owner, repo, meta.stars);

    return (
      <CardShell title="Star History">
        <p className="text-sm text-zinc-400">
          {result.points.length} sampled points across{" "}
          {result.pagesFetched} page{result.pagesFetched === 1 ? "" : "s"}
          {result.sampled && " (sampling enabled — large repo)"}
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          First star: {result.points[0]?.date.slice(0, 10) ?? "—"}
          {" → "}
          Latest: {result.points.at(-1)?.date.slice(0, 10) ?? "—"}
        </p>
        <p className="mt-4 text-xs italic text-zinc-600">
          [Recharts area chart lands in T7]
        </p>
      </CardShell>
    );
  } catch (e) {
    return (
      <CardShell title="Star History">
        <DegradedNote
          reason={
            e instanceof GitHubDegradedError
              ? "GitHub API throttled"
              : "card error"
          }
        />
      </CardShell>
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ContributorSlot — placeholder visual

export async function ContributorSlot({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  try {
    const contributors = await getContributors(owner, repo);

    return (
      <CardShell title="Top Contributors">
        <p className="text-sm text-zinc-400">
          Showing {Math.min(contributors.length, 10)} of {contributors.length}
        </p>
        <ul className="mt-4 space-y-2">
          {contributors.slice(0, 10).map((c) => (
            <li key={c.login} className="flex items-center gap-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.avatarUrl}
                alt={c.login}
                className="h-6 w-6 rounded-full"
              />
              <span className="text-zinc-200">{c.login}</span>
              <span className="ml-auto tabular-nums text-zinc-500">
                {c.contributions.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </CardShell>
    );
  } catch (e) {
    return (
      <CardShell title="Top Contributors">
        <DegradedNote
          reason={
            e instanceof GitHubDegradedError
              ? "GitHub API throttled"
              : "card error"
          }
        />
      </CardShell>
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Skeleton fallback shared by all slots

export function SlotSkeleton({ title }: { title: string }) {
  return (
    <CardShell title={title}>
      <div className="h-16 animate-pulse rounded bg-zinc-900" />
    </CardShell>
  );
}
