/**
 * The differentiator card.
 *
 * Pure server component — no interactivity beyond the native <details>
 * disclosure. Loud, confident, big-number hero with a credibility section
 * showing every prompt that was asked and what Gemini said.
 *
 * Server-component-only means no client JS bundle for this card.
 */

import type { AIDiscoverabilityResult } from "@/lib/ai-discoverability";

export function AIDiscoverabilityCard({
  result,
}: {
  result: AIDiscoverabilityResult;
}) {
  if (result.score === null) {
    return (
      <div>
        <p className="text-sm text-amber-400/80">
          AI score unavailable — {humanError(result.error)}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          The score reports how often this repo appears when Gemini Flash is
          asked for libraries in your repo&apos;s topic. Set GEMINI_API_KEY to
          enable it.
        </p>
      </div>
    );
  }

  const pct = (result.score / result.outOf) * 100;

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <p className="text-6xl font-bold tabular-nums leading-none">
          <span className={scoreColor(result.score, result.outOf)}>
            {result.score}
          </span>
          <span className="text-3xl text-zinc-600"> / {result.outOf}</span>
        </p>
        <p className="text-sm text-zinc-400">
          prompts to Gemini Flash mention this repo
        </p>
      </div>

      {/* Visual bar — communicates the score at a glance */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className={`h-full ${scoreBarColor(result.score, result.outOf)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-zinc-300 hover:text-white">
          See all {result.prompts.length} prompts
        </summary>
        <ul className="mt-3 space-y-3">
          {result.prompts.map((p, i) => (
            <li
              key={i}
              className="rounded border border-zinc-800 bg-zinc-950 p-3"
            >
              <p className="text-zinc-300">{p.prompt}</p>
              <p className="mt-1 text-xs">
                <span
                  className={
                    p.mentioned ? "text-emerald-400" : "text-zinc-500"
                  }
                >
                  {p.mentioned ? "✓ Mentioned" : "✗ Not mentioned"}
                </span>
              </p>
              <p className="mt-1 text-xs italic text-zinc-600 line-clamp-3">
                {p.responseSnippet}…
              </p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function scoreColor(score: number, outOf: number): string {
  const pct = score / outOf;
  if (pct >= 2 / 3) return "text-emerald-400";
  if (pct >= 1 / 3) return "text-amber-400";
  return "text-zinc-300";
}

function scoreBarColor(score: number, outOf: number): string {
  const pct = score / outOf;
  if (pct >= 2 / 3) return "bg-emerald-500";
  if (pct >= 1 / 3) return "bg-amber-500";
  return "bg-zinc-700";
}

function humanError(error: AIDiscoverabilityResult["error"]): string {
  switch (error) {
    case "missing-api-key":
      return "GEMINI_API_KEY not configured";
    case "gemini-unavailable":
      return "Gemini API is temporarily unreachable";
    case "gemini-bad-response":
      return "Gemini returned an unexpected response";
    default:
      return "unknown error";
  }
}
