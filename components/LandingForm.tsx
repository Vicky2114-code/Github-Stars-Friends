"use client";

import { useActionState, useRef } from "react";

import { submitRepo, type SubmitState } from "@/app/actions";

const initialState: SubmitState = {};

const EXAMPLES = [
  "vercel/next.js",
  "anthropics/claude-code",
  "facebook/react",
  "tailwindlabs/tailwindcss",
];

export function LandingForm() {
  const [state, formAction, pending] = useActionState(submitRepo, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  function fillExample(value: string) {
    if (inputRef.current) {
      inputRef.current.value = value;
      inputRef.current.focus();
    }
  }

  return (
    <form action={formAction} className="w-full max-w-xl space-y-4">
      <label htmlFor="repo" className="sr-only">
        GitHub repo URL
      </label>

      {/* Input + button group with focus-within glow */}
      <div className="group relative">
        {/* Glow ring (sits behind, scales up on focus-within) */}
        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-400/40 to-emerald-500/0 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />

        <div className="relative flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 backdrop-blur-sm transition group-focus-within:border-amber-500/60 sm:flex-row sm:items-center sm:p-1.5">
          <input
            ref={inputRef}
            id="repo"
            name="repo"
            type="text"
            autoComplete="off"
            placeholder="vercel/next.js  or  https://github.com/..."
            autoFocus
            required
            className="flex-1 bg-transparent px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending}
            className="button-shimmer relative inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] hover:shadow-amber-500/40 active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Loading
              </>
            ) : (
              <>
                Dive in
                <span aria-hidden>→</span>
              </>
            )}
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-rose-400">
          {state.error}
        </p>
      )}

      {/* Example chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-600">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => fillExample(example)}
            className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 font-mono text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}
