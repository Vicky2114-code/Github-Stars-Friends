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

import { GitHubNotFoundError } from "@/lib/github";
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
    throw e; // route-level error.tsx will catch
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
