/**
 * Above-the-fold repo header: owner avatar, name, description, topics, and
 * the stats strip (stars/forks/watchers/issues).
 *
 * Pure server component. Linked owner + repo names.
 */

import type { RepoMeta } from "@/lib/github";

export function RepoHeader({ meta }: { meta: RepoMeta }) {
  return (
    <header className="mb-10 border-b border-zinc-800 pb-10">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.owner.avatarUrl}
          alt={meta.owner.login}
          className="h-14 w-14 rounded-full ring-1 ring-zinc-800"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            <a
              href={`https://github.com/${meta.owner.login}`}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-zinc-200"
            >
              {meta.owner.login}
            </a>
            <span className="text-zinc-700"> / </span>
            <a
              href={`https://github.com/${meta.fullName}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-200"
            >
              {meta.fullName.split("/")[1]}
            </a>
          </h1>
          {meta.description && (
            <p className="mt-2 max-w-2xl text-zinc-400">{meta.description}</p>
          )}
          {meta.archived && (
            <p className="mt-2 inline-block rounded bg-rose-950 px-2 py-0.5 text-xs font-medium text-rose-300">
              Archived
            </p>
          )}
        </div>
      </div>

      {meta.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meta.topics.slice(0, 10).map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-xs text-zinc-300"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Stars" value={meta.stars} />
        <Stat label="Forks" value={meta.forks} />
        <Stat label="Watchers" value={meta.watchers} />
        <Stat label="Open Issues" value={meta.openIssues} />
      </dl>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
