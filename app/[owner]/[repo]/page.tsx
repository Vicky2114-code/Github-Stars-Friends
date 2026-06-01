/**
 * /<owner>/<repo> — the repo deep-dive page.
 *
 * Composition:
 *   - RepoHeaderSlot fetches first (above the fold, needed for metadata)
 *   - 4 cards stream in below via independent <Suspense> boundaries
 *
 * Error handling:
 *   - 404 from GitHub → notFound() → renders not-found.tsx
 *   - Other catastrophic errors → error.tsx
 *   - Per-card degraded states handled inside each slot
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";

import { GitHubDegradedError, GitHubNotFoundError } from "@/lib/github";
import { getRepoMetaCached } from "@/lib/repo-meta-cached";

import {
  AIDiscoverabilitySlot,
  ContributorSlot,
  ReadmeAnalysisSlot,
  RepoHeaderSlot,
  SlotSkeleton,
  StarHistorySlot,
} from "./slots";

type PageProps = {
  params: Promise<{ owner: string; repo: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { owner, repo } = await params;
  try {
    const meta = await getRepoMetaCached(owner, repo);
    return {
      title: `${meta.fullName} — repo-dive`,
      description:
        meta.description ??
        `Growth charts and AI Discoverability for ${meta.fullName}`,
    };
  } catch {
    return { title: `${owner}/${repo} — repo-dive` };
  }
}

export default async function RepoPage({ params }: PageProps) {
  const { owner, repo } = await params;

  // Resolve meta upfront so 404s short-circuit before we render anything.
  try {
    await getRepoMetaCached(owner, repo);
  } catch (e) {
    if (e instanceof GitHubNotFoundError) notFound();
    if (e instanceof GitHubDegradedError) {
      // We can't confirm whether the repo exists because GitHub is throttled
      // and we have nothing cached. This is semantically a 503 (service
      // unavailable), not a 500. Render a useful fallback inline.
      return <DegradedFallback owner={owner} repo={repo} />;
    }
    throw e; // anything else: route-level error.tsx will catch
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Suspense fallback={<SlotSkeleton title="Loading repo…" />}>
        <RepoHeaderSlot owner={owner} repo={repo} />
      </Suspense>

      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<SlotSkeleton title="AI Discoverability" />}>
          <AIDiscoverabilitySlot owner={owner} repo={repo} />
        </Suspense>
        <Suspense fallback={<SlotSkeleton title="README Quality" />}>
          <ReadmeAnalysisSlot owner={owner} repo={repo} />
        </Suspense>
        <Suspense fallback={<SlotSkeleton title="Star History" />}>
          <StarHistorySlot owner={owner} repo={repo} />
        </Suspense>
        <Suspense fallback={<SlotSkeleton title="Top Contributors" />}>
          <ContributorSlot owner={owner} repo={repo} />
        </Suspense>
      </div>

      <footer className="mt-12 border-t border-zinc-800 pt-6 text-center text-sm text-zinc-500">
        Made with <span className="text-zinc-300">repo-dive</span> · paste a repo URL to analyze yours
      </footer>
    </main>
  );
}

function DegradedFallback({ owner, repo }: { owner: string; repo: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-wider text-amber-400">
        Service degraded
      </p>
      <h1 className="mt-3 text-3xl font-bold">
        Can&apos;t reach GitHub right now
      </h1>
      <p className="mt-3 max-w-md text-zinc-400">
        We&apos;re currently rate-limited by GitHub and we don&apos;t have{" "}
        <span className="font-mono text-zinc-300">
          {owner}/{repo}
        </span>{" "}
        in cache yet. Try again in a few minutes, or set{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs">
          GITHUB_PAT
        </code>{" "}
        if you&apos;re running locally.
      </p>
    </main>
  );
}
