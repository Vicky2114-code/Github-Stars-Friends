"use client";

/**
 * Share footer at the bottom of a repo deep-dive page.
 *
 * Three actions:
 *   - Share on X (Twitter intent URL)
 *   - Submit to Hacker News (their submit URL)
 *   - Copy link (clipboard API + transient "Copied!" state)
 *
 * Each outbound link carries ?ref=x | ?ref=hn so Plausible can attribute
 * referral traffic. The Copy action carries ?ref=copy.
 *
 * Client component because clipboard API + button state need JS. The
 * surrounding page can be fully static; only this slice is interactive.
 */

import { useState } from "react";

export function ShareFooter({ fullName }: { fullName: string }) {
  const [copied, setCopied] = useState(false);

  // Use a stable absolute URL where possible; fall back to relative on SSR.
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://repo-dive.app";
  const pageUrl = `${base}/${fullName}`;

  const xText = encodeURIComponent(
    `${fullName} on repo-dive — growth chart + AI Discoverability score`,
  );
  const xUrl = `https://x.com/intent/post?text=${xText}&url=${encodeURIComponent(`${pageUrl}?ref=x`)}`;
  const hnUrl = `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(`${pageUrl}?ref=hn`)}&t=${encodeURIComponent(
    `Show HN: ${fullName} on repo-dive`,
  )}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${pageUrl}?ref=copy`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / iframes — silently skip
    }
  }

  return (
    <footer className="mt-12 border-t border-zinc-800 pt-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <a
            href={xUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-200 hover:border-zinc-600 hover:text-white"
          >
            Share on X
          </a>
          <a
            href={hnUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-200 hover:border-zinc-600 hover:text-white"
          >
            Submit to HN
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-200 hover:border-zinc-600 hover:text-white"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        <p className="text-center text-xs text-zinc-500">
          Made with <span className="text-zinc-300">repo-dive</span> · paste a
          repo URL to analyze yours
        </p>
      </div>
    </footer>
  );
}
