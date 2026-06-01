# repo-dive

> Paste any GitHub repo URL. Get growth charts and an AI Discoverability score.

A no-login, shareable deep-dive page for any public GitHub repo. Built end-to-end with [Claude Code](https://claude.com/claude-code) and the [gstack](https://github.com/garrytan/gstack) workflow (`/office-hours` → `/plan-eng-review` → 13 implementation tasks).

## What it does

For every repo at `repo-dive.app/<owner>/<repo>`:

- **Star history chart** reconstructed from GitHub's `stargazers` API via sampling (10 pages max regardless of repo size; respects GitHub's 400-page pagination cap)
- **AI Discoverability score** — asks Gemini Flash three category-related questions and counts how often the repo is mentioned. The differentiator: a real signal for "is my repo AI-discoverable?"
- **README quality** — Gemini-rated 0-10 with concrete improvement suggestions
- **Top contributors** with bus-factor bar chart

## Architecture (one paragraph)

Stateless Next.js 16 on Vercel. No backend, no database. All data fetched on demand from GitHub + Gemini Flash, cached 24h in Vercel KV. Server Components fan out 4 parallel data fetches per repo page; Suspense boundaries stream them in independently. Rate-limit aware with a circuit breaker and graceful "Service degraded" fallback instead of 500s.

See [ENG-PLAN.md](ENG-PLAN.md) for the full architecture, decisions D1-D3, and 13 ordered tasks. See [DESIGN.md](DESIGN.md) for the product reasoning (the original spec was a 7-feature social platform; office hours collapsed it to this single-page wedge).

## Stack

- Next.js 16, React 19, TypeScript 5.9, Tailwind v4, Turbopack
- ShadCN UI primitives, Recharts for the area chart
- Vercel KV for cross-request caching (in-memory Map fallback in dev)
- zod for response schema validation (critical for Gemini garbage-response handling)
- Bun 1.3 as the runtime + package manager + test runner
- Playwright for e2e

## Develop

```bash
# 1. Clone and install
git clone <your-fork>
cd github-stars-friends
bun install

# 2. Config
cp .env.example .env.local
# Edit .env.local — at minimum set GITHUB_PAT so the GitHub anonymous
# 60/hr limit doesn't burn out. GEMINI_API_KEY is optional but unlocks the
# AI Discoverability + README quality cards.

# 3. Run
bun run dev          # http://localhost:3000
bun test             # unit tests (66 tests)
bun run test:e2e     # Playwright smoke (6 tests, auto-starts dev server)
bun run typecheck    # tsc --noEmit
bun run build        # production build
```

## Deploy

See [DEPLOY.md](DEPLOY.md) for the step-by-step Vercel deploy.

## License

MIT
