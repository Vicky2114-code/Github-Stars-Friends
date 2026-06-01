"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Fires when an unhandled error escapes any of
 * the slots' own try/catches.
 *
 * Per Next.js App Router convention this file MUST be a Client Component.
 */

export default function RepoPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("repo-page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-wider text-zinc-500">Error</p>
      <h1 className="mt-3 text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-zinc-400">
        The page hit an unexpected error while loading this repo. The most
        common cause is GitHub or the AI API being temporarily unreachable.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Try again
      </button>
      {error.digest && (
        <p className="mt-6 text-xs text-zinc-600">ref: {error.digest}</p>
      )}
    </main>
  );
}
