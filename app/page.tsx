export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-zinc-100 p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">repo-dive</h1>
        <p className="text-lg text-zinc-400">
          Paste a GitHub repo URL. Get a deep-dive page with growth charts and an AI
          Discoverability score.
        </p>
        <p className="text-sm text-zinc-500">
          v0.0.1 — T1 scaffold. Landing form lands in T9.
        </p>
      </div>
    </main>
  );
}
