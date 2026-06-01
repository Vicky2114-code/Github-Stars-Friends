import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-wider text-zinc-500">404</p>
      <h1 className="mt-3 text-3xl font-bold">Repo not found</h1>
      <p className="mt-3 max-w-md text-zinc-400">
        This repo either doesn&apos;t exist, has been deleted, or is private. Check
        the URL and try again, or paste a different repo on the homepage.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        ← Back to home
      </Link>
    </main>
  );
}
