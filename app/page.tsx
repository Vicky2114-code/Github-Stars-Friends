import { LandingForm } from "@/components/LandingForm";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-zinc-100 px-6 py-12">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">repo-dive</h1>
          <p className="text-lg text-zinc-400">
            Paste a GitHub repo. Get a deep-dive page with growth charts and an{" "}
            <span className="text-amber-400">AI Discoverability</span> score.
          </p>
        </div>

        <div className="flex justify-center">
          <LandingForm />
        </div>

        <div className="pt-8 text-sm text-zinc-500">
          <p>
            We ask Gemini Flash three times whether your repo would be
            recommended for its category. The answer is the score.
          </p>
        </div>
      </div>

      <footer className="mt-16 text-xs text-zinc-600">
        Made with repo-dive · open source
      </footer>
    </main>
  );
}
