/**
 * README quality card. Big score 0-10 + ranked issue list with action verbs.
 *
 * Pure server component. Renders an "all clear" state when score >= 8 with
 * fewer issues, vs. a "here's what to fix" state when score is lower.
 */

import type { ReadmeAnalysisResult } from "@/lib/readme-analysis";

export function ReadmeQualityCard({
  result,
}: {
  result: ReadmeAnalysisResult;
}) {
  if (result.score === null) {
    return (
      <div>
        <p className="text-sm text-amber-400/80">
          README analysis unavailable — {humanError(result.error)}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          We ask Gemini Flash to rate your README and suggest improvements.
          Set GEMINI_API_KEY to enable.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <p className="text-6xl font-bold tabular-nums leading-none">
          <span className={scoreColor(result.score)}>{result.score}</span>
          <span className="text-3xl text-zinc-600"> / 10</span>
        </p>
        <p className="text-sm text-zinc-400">
          {result.score >= 8
            ? "solid README — minor polish suggested"
            : result.score >= 5
              ? "decent README — clear wins below"
              : "needs work — start with the first item"}
        </p>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className={`h-full ${scoreBarColor(result.score)}`}
          style={{ width: `${result.score * 10}%` }}
        />
      </div>

      {result.issues.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm">
          {result.issues.map((issue, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2"
            >
              <span className="font-mono text-xs text-zinc-600">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-zinc-200">{issue}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 5) return "text-amber-400";
  return "text-rose-400";
}

function scoreBarColor(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-rose-500";
}

function humanError(error: ReadmeAnalysisResult["error"]): string {
  switch (error) {
    case "no-readme":
      return "this repo has no README at all";
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
