"use client";

import { useActionState } from "react";

import { submitRepo, type SubmitState } from "@/app/actions";

const initialState: SubmitState = {};

export function LandingForm() {
  const [state, formAction, pending] = useActionState(submitRepo, initialState);

  return (
    <form action={formAction} className="w-full max-w-xl space-y-3">
      <label htmlFor="repo" className="sr-only">
        GitHub repo URL
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="repo"
          name="repo"
          type="text"
          autoComplete="off"
          placeholder="vercel/next.js or https://github.com/..."
          autoFocus
          required
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-500 px-6 py-3 font-medium text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? "Loading…" : "Dive in"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-rose-400">
          {state.error}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Try: <button
          type="button"
          className="underline hover:text-zinc-300"
          // Set value via DOM to avoid lifting state in this minimal form
          onClick={(e) => {
            const input = e.currentTarget.closest("form")?.querySelector<HTMLInputElement>("#repo");
            if (input) input.value = "vercel/next.js";
          }}
        >
          vercel/next.js
        </button>
        {" · "}
        <button
          type="button"
          className="underline hover:text-zinc-300"
          onClick={(e) => {
            const input = e.currentTarget.closest("form")?.querySelector<HTMLInputElement>("#repo");
            if (input) input.value = "anthropics/claude-code";
          }}
        >
          anthropics/claude-code
        </button>
      </p>
    </form>
  );
}
