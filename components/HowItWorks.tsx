/**
 * "How it works" section + animated sample preview card.
 *
 * Three steps: Paste → Analyze → Share. The middle column shows a static
 * SVG preview of what the AI Discoverability card looks like, with the
 * chart line drawing itself in on first paint (CSS `stroke-dashoffset`
 * animation; no JS).
 *
 * Pure server component — every animation is CSS-only.
 */

export function HowItWorks() {
  return (
    <section className="mt-24 w-full max-w-5xl px-6">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/80">
        How it works
      </p>
      <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
        Paste a repo. <span className="text-zinc-500">Get the deep dive.</span>
      </h2>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <Step
          number="01"
          title="Paste"
          body="Drop in any GitHub URL or owner/repo. No login. No setup."
          delayMs={0}
        />
        <Step
          number="02"
          title="Analyze"
          body="We pull stars, contributors, README, and ask Gemini Flash three times whether your repo would be recommended for its category."
          delayMs={120}
        />
        <Step
          number="03"
          title="Share"
          body="One shareable URL. Beautiful OG card for Twitter, LinkedIn, HN. Owner sees the report; everyone sees the score."
          delayMs={240}
        />
      </div>

      <SamplePreview />
    </section>
  );
}

function Step({
  number,
  title,
  body,
  delayMs,
}: {
  number: string;
  title: string;
  body: string;
  delayMs: number;
}) {
  return (
    <div
      className="fade-in-up rounded-xl border border-zinc-800 bg-zinc-950/40 p-6 backdrop-blur-sm"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <p className="font-mono text-xs text-amber-400/70">{number}</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function SamplePreview() {
  return (
    <div
      className="fade-in-up mt-16 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 backdrop-blur-sm"
      style={{ animationDelay: "400ms" }}
    >
      <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
        Sample output · repo-dive.app/<span className="text-zinc-300">vercel/next.js</span>
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* AI Discoverability mini-card */}
        <div className="rounded-xl border border-zinc-700 bg-gradient-to-b from-zinc-900/80 to-zinc-950/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            AI Discoverability
          </p>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-5xl font-bold tabular-nums leading-none text-emerald-400">
              3<span className="text-2xl text-zinc-600"> / 3</span>
            </p>
            <p className="text-xs text-zinc-400">
              prompts to Gemini Flash mention this repo
            </p>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
            <div className="h-full w-full bg-emerald-500" />
          </div>
        </div>

        {/* Mini star-history sparkline */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Star History
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            <span className="font-semibold text-zinc-200">139k</span> stars · sampled across 10 pages
          </p>
          <svg
            className="mt-3 h-20 w-full"
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="sample-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Filled area under the curve */}
            <path
              d="M 0,55 L 10,50 L 25,46 L 45,40 L 70,34 L 95,28 L 125,20 L 155,12 L 185,6 L 200,3 L 200,60 L 0,60 Z"
              fill="url(#sample-fill)"
            />
            {/* Stroked curve (animated draw-in) */}
            <path
              className="draw-chart"
              d="M 0,55 L 10,50 L 25,46 L 45,40 L 70,34 L 95,28 L 125,20 L 155,12 L 185,6 L 200,3"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">
        Real output · static preview · live data on the actual page
      </p>
    </div>
  );
}
