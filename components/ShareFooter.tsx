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
 *
 * Hydration: origin is resolved AFTER mount via useEffect. The first
 * render — both on the server and on the initial client render — uses
 * an empty origin so the SSR HTML and the client HTML match exactly.
 * After mount we update state and the buttons re-render with real URLs.
 * Without this discipline React logs a hydration mismatch warning.
 */

import { useEffect, useState } from "react";

export function ShareFooter({ fullName }: { fullName: string }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const pageUrl = origin ? `${origin}/${fullName}` : "";
  const ready = pageUrl !== "";

  const xText = encodeURIComponent(
    `${fullName} on repo-dive — growth chart + AI Discoverability score`,
  );
  const xUrl = ready
    ? `https://x.com/intent/post?text=${xText}&url=${encodeURIComponent(`${pageUrl}?ref=x`)}`
    : "#";
  const hnUrl = ready
    ? `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(`${pageUrl}?ref=hn`)}&t=${encodeURIComponent(
        `Show HN: ${fullName} on repo-dive`,
      )}`
    : "#";

  async function copyLink() {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(`${pageUrl}?ref=copy`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / iframes — silently skip
    }
  }

  const buttonClass =
    "rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-200 hover:border-zinc-600 hover:text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

  return (
    <footer className="mt-12 border-t border-zinc-800 pt-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <a
            href={xUrl}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!ready}
            tabIndex={ready ? 0 : -1}
            className={buttonClass}
          >
            Share on X
          </a>
          <a
            href={hnUrl}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!ready}
            tabIndex={ready ? 0 : -1}
            className={buttonClass}
          >
            Submit to HN
          </a>
          <button
            type="button"
            onClick={copyLink}
            disabled={!ready}
            className={buttonClass}
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
