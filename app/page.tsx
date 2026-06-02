import Link from "next/link";

import { BackgroundAurora } from "@/components/BackgroundAurora";
import { HowItWorks } from "@/components/HowItWorks";
import { LandingForm } from "@/components/LandingForm";

export default function Home() {
  return (
    <>
      <BackgroundAurora />

      <main className="relative flex min-h-screen flex-col items-center px-6 pb-24 pt-24 text-zinc-100 sm:pt-32">
        {/* Hero */}
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          {/* Eyebrow chip */}
          <Link
            href="https://github.com/Vicky2114-code/Github-Stars-Friends"
            target="_blank"
            rel="noreferrer"
            className="fade-in-up inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400 backdrop-blur-sm transition hover:border-zinc-700 hover:text-zinc-200"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            v0.1 · open source on GitHub
            <span aria-hidden>→</span>
          </Link>

          {/* Hero title with gradient text */}
          <h1
            className="fade-in-up mt-6 text-balance text-5xl font-bold tracking-tight sm:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            <span className="bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Every repo,
            </span>
            <br />
            <span className="bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              measured against AI.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="fade-in-up mt-6 max-w-xl text-balance text-lg leading-relaxed text-zinc-400"
            style={{ animationDelay: "160ms" }}
          >
            Paste any GitHub repo. Get growth charts, contributor health, and an{" "}
            <span className="text-amber-300">AI Discoverability score</span> —
            whether Gemini Flash actually recommends your project when asked.
          </p>

          {/* Form */}
          <div
            className="fade-in-up mt-10 w-full max-w-xl"
            style={{ animationDelay: "240ms" }}
          >
            <LandingForm />
          </div>

          {/* Tiny credibility line */}
          <p
            className="fade-in-up mt-6 text-xs text-zinc-600"
            style={{ animationDelay: "320ms" }}
          >
            Free · no signup · works on any public repo
          </p>
        </div>

        {/* How it works + sample preview */}
        <HowItWorks />

        {/* Footer */}
        <footer className="mt-24 flex flex-col items-center gap-2 text-xs text-zinc-600">
          <p>
            Made with <span className="text-zinc-400">repo-dive</span> · MIT
            licensed
          </p>
          <p className="font-mono text-[10px] text-zinc-700">
            built end-to-end with{" "}
            <Link
              href="https://github.com/garrytan/gstack"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-zinc-500"
            >
              gstack
            </Link>{" "}
            + claude code
          </p>
        </footer>
      </main>
    </>
  );
}
