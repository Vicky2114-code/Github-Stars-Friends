/**
 * Reconstruct a repo's star-growth timeline from GitHub's stargazers API.
 *
 * Per ENG-PLAN.md decision D2: sampling, not exhaustive fetching.
 *   - Small repos (≤ 1000 stars, i.e. ≤ 10 pages): fetch ALL pages.
 *   - Large repos: sample 10 pages — first + last + 8 evenly-spaced middle.
 *
 * Why sampling: a 50k-star repo is 500 paginated requests. Naive fetch-all
 * burns 10% of an hour's API bucket and renders in 60s+. Sampling gives
 * ~95% chart accuracy at constant cost (10 requests max).
 *
 *
 *                       SAMPLING DIAGRAM (large repo, 25 pages)
 *
 *   pages: [1] 2 3  4 [5] 6  7 [9] 10 11 [13] 14 15 [17] 18 19 [21] 22 23 [25]
 *           ^                ^         ^          ^          ^          ^
 *           first            ────  8 evenly-spaced middles  ────       last
 *
 *
 * Each sampled page contains up to 100 stars with `starred_at` timestamps.
 * For a star on page P at index I (0-based), the cumulative star count at
 * that moment was: (P - 1) * 100 + I + 1.
 *
 * We return DataPoint[] sorted by timestamp ascending. The chart linearly
 * interpolates between adjacent points (Recharts handles this natively).
 */

import { getStargazerPage } from "./github";

export type StarHistoryPoint = {
  /** ISO timestamp when the star was awarded. */
  date: string;
  /** Cumulative star count AT that moment. */
  stars: number;
};

export type StarHistoryResult = {
  points: StarHistoryPoint[];
  /** True when sampling was used (informational badge on chart). */
  sampled: boolean;
  /** How many pages were fetched (1..10). */
  pagesFetched: number;
};

const PER_PAGE = 100;
const MAX_SAMPLED_PAGES = 10;

/**
 * Compute the list of page numbers to fetch for a repo with `totalStars`.
 *
 * Exported for tests so we can assert the sampling math without hitting fetch.
 */
export function computeSampledPages(totalStars: number): number[] {
  if (totalStars <= 0) return [];

  const totalPages = Math.ceil(totalStars / PER_PAGE);

  // Small repo: fetch every page, no sampling needed.
  if (totalPages <= MAX_SAMPLED_PAGES) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Large repo: first + last + 8 evenly-spaced middles.
  // Use floats then dedupe to handle the "8 spaces, 10 pages total" math.
  const inner = MAX_SAMPLED_PAGES - 2; // 8 middle samples
  const span = totalPages - 1; // distance between page 1 and page totalPages
  const step = span / (inner + 1);

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let i = 1; i <= inner; i++) {
    pages.add(Math.round(1 + step * i));
  }
  return [...pages].sort((a, b) => a - b);
}

export async function getStarHistory(
  owner: string,
  repo: string,
  totalStars: number,
): Promise<StarHistoryResult> {
  if (totalStars === 0) {
    return { points: [], sampled: false, pagesFetched: 0 };
  }

  const pages = computeSampledPages(totalStars);
  const sampled = pages.length < Math.ceil(totalStars / PER_PAGE);

  // Fetch sampled pages in parallel (the rate-limit tracker handles bookkeeping).
  const fetched = await Promise.all(
    pages.map((page) => getStargazerPage(owner, repo, page, PER_PAGE)),
  );

  const points: StarHistoryPoint[] = [];
  pages.forEach((pageNum, pageIdx) => {
    const stars = fetched[pageIdx];
    stars.forEach((star, indexInPage) => {
      const cumulativeStars = (pageNum - 1) * PER_PAGE + indexInPage + 1;
      points.push({ date: star.starredAt, stars: cumulativeStars });
    });
  });

  // Sort by date ascending (sampling can produce out-of-order points if pages
  // overlap by coincidence; defensive sort keeps the chart well-formed).
  points.sort((a, b) => a.date.localeCompare(b.date));

  return { points, sampled, pagesFetched: pages.length };
}
