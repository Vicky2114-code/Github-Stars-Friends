/**
 * Top contributors visualization.
 *
 * Pure server component. Shows the top 10 contributors with avatars, names,
 * commit counts, and a simple bar chart by contribution share.
 *
 * The "health" framing communicates: is this a one-person project or a real
 * community? A single contributor dwarfing the rest is a bus-factor signal.
 */

import type { Contributor } from "@/lib/github";

export function ContributorHealth({
  contributors,
}: {
  contributors: Contributor[];
}) {
  if (contributors.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No contributors data available</p>
    );
  }

  const shown = contributors.slice(0, 10);
  const maxContribs = Math.max(...shown.map((c) => c.contributions));

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-400">
        Top <span className="text-zinc-200">{shown.length}</span> of{" "}
        <span className="text-zinc-200">{contributors.length}</span>{" "}
        contributors
        {contributors.length === 30 && (
          <span className="text-zinc-600"> (showing first 30)</span>
        )}
      </p>

      <ul className="space-y-2">
        {shown.map((c, i) => {
          const widthPct = (c.contributions / maxContribs) * 100;
          return (
            <li key={c.login} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-right font-mono text-xs text-zinc-600">
                {i + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.avatarUrl}
                alt={c.login}
                className="h-6 w-6 rounded-full"
                loading="lazy"
              />
              <a
                href={`https://github.com/${c.login}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-zinc-200 hover:text-white"
              >
                {c.login}
              </a>
              <div className="ml-auto flex flex-1 items-center gap-3 pl-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full bg-zinc-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums text-xs text-zinc-500">
                  {c.contributions.toLocaleString()}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
