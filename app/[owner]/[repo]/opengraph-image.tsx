/**
 * OG share image for /<owner>/<repo>.
 *
 * Next.js auto-routes this file as the open-graph image for the matching
 * route. The default <head> tags are wired automatically; no extra config
 * needed beyond exporting the size/contentType + the default async function.
 *
 * Strategy: attempt to fetch the repo meta. On success show real data
 * (name + stars). On failure (rate-limited, repo not found, etc.) fall
 * back to a generic repo-dive card. Never throw — OG endpoints that
 * 500 ruin link previews everywhere.
 */

import { ImageResponse } from "next/og";

import { getRepoMetaCached } from "@/lib/repo-meta-cached";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "repo-dive — GitHub repo deep dive";

type Params = { owner: string; repo: string };

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { owner, repo } = await params;

  let title = `${owner}/${repo}`;
  let stars: number | null = null;
  let description: string | null = null;

  try {
    const meta = await getRepoMetaCached(owner, repo);
    title = meta.fullName;
    stars = meta.stars;
    description = meta.description;
  } catch {
    // Fall through to fallback card — never throw from OG generation.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          background: "linear-gradient(160deg, #09090b 0%, #18181b 50%, #09090b 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top brand strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 24,
            color: "#fbbf24",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          ● repo-dive
        </div>

        {/* Main title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 60,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>

          {description && (
            <div
              style={{
                marginTop: 24,
                fontSize: 28,
                color: "#a1a1aa",
                lineHeight: 1.3,
                maxWidth: 900,
                // Trim long descriptions to ~2 lines worth
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </div>
          )}
        </div>

        {/* Bottom strip: stars + footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 32,
            color: "#71717a",
          }}
        >
          {stars !== null ? (
            <div style={{ display: "flex", alignItems: "center", color: "#fbbf24" }}>
              ★{" "}
              <span style={{ color: "#fafafa", marginLeft: 12 }}>
                {stars.toLocaleString()}
              </span>{" "}
              <span style={{ color: "#71717a", marginLeft: 12 }}>stars</span>
            </div>
          ) : (
            <div>GitHub repo deep dive</div>
          )}
          <div style={{ fontSize: 24 }}>repo-dive.app</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
