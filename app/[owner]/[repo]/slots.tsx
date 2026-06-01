/**
 * Per-card async server components for the repo deep-dive page.
 *
 * Each slot is its own async function so it can be wrapped in a <Suspense>
 * boundary in page.tsx. Cards stream in independently as their data resolves.
 *
 * Slots do data fetching + error catching only. Visual rendering lives in
 * components/ — keeping presentation separate from data flow.
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

import { RepoHeader } from "@/components/RepoHeader";
import { StarHistoryChart } from "@/components/StarHistoryChart";
import { AIDiscoverabilityCard } from "@/components/AIDiscoverabilityCard";
import { ReadmeQualityCard } from "@/components/ReadmeQualityCard";
import { ContributorHealth } from "@/components/ContributorHealth";

// ──────────────────────────────────────────────────────────────────────────────
// Card shell — shared chrome around each card body

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
          ? "border-zinc-700 bg-gradient-to-b from-zinc-900/80 to-zinc-950/40"
          : "border-zinc-800 bg-zinc-950/40"
      }`}
    >
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
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

function degradedReason(e: unknown): string {
  if (e instanceof GitHubDegradedError) return "GitHub API throttled";
  return "card error";
}

// ──────────────────────────────────────────────────────────────────────────────
// Slots

export async function RepoHeaderSlot({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const meta = await getRepoMetaCached(owner, repo);
  return <RepoHeader meta={meta} />;
}

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
        <AIDiscoverabilityCard result={result} />
      </CardShell>
    );
  } catch (e) {
    return (
      <CardShell title="AI Discoverability" accent>
        <DegradedNote reason={degradedReason(e)} />
      </CardShell>
    );
  }
}

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
        <ReadmeQualityCard result={result} />
      </CardShell>
    );
  } catch (e) {
    return (
      <CardShell title="README Quality">
        <DegradedNote reason={degradedReason(e)} />
      </CardShell>
    );
  }
}

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
        <StarHistoryChart
          points={result.points}
          sampled={result.sampled}
          pagesFetched={result.pagesFetched}
        />
      </CardShell>
    );
  } catch (e) {
    return (
      <CardShell title="Star History">
        <DegradedNote reason={degradedReason(e)} />
      </CardShell>
    );
  }
}

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
        <ContributorHealth contributors={contributors} />
      </CardShell>
    );
  } catch (e) {
    return (
      <CardShell title="Top Contributors">
        <DegradedNote reason={degradedReason(e)} />
      </CardShell>
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Skeleton fallback shared by all slots while streaming

export function SlotSkeleton({ title }: { title: string }) {
  return (
    <CardShell title={title}>
      <div className="h-16 animate-pulse rounded bg-zinc-900" />
    </CardShell>
  );
}
