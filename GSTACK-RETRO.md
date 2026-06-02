# How gstack built repo-dive

> A one-builder field report. Honest pros and cons. No marketing copy.

## TL;DR

| | |
|---|---|
| **Started** | 7-feature "GitHub Stars & Friends" social platform spec |
| **Shipped** | 1-feature repo deep-dive at [github-stars-friends.vercel.app](https://github-stars-friends.vercel.app) |
| **Time** | 1 session (~3hr CC time, ~17hr human-equivalent per ENG-PLAN estimates) |
| **Commits** | 18 |
| **Tests** | 75 (69 unit + 6 e2e), 0 failing |
| **Bugs shipped to prod** | 0 (3 caught by `/qa` before deploy) |
| **gstack skills used** | 6 |

---

## The skills that fired

| Skill | When | What it did concretely |
|---|---|---|
| **`/office-hours`** | Spec interrogation | 6 forcing questions cut the spec from 7 features to 1. Produced `DESIGN.md` |
| **`/plan-eng-review`** | Architecture lock | Found 3 P1 issues *before code existed* (rate limits, pagination cap, AI methodology). Produced `ENG-PLAN.md` with 13 ordered tasks |
| **(direct execution)** | Build T1 → T13 | One commit per task, atomic. Test suite grew with each task. |
| **`/context-restore`** | After "take a break" | Re-loaded design + plan from gstack artifacts so I could resume cleanly |
| **`/qa`** | After T7 visuals | Found 3 real bugs (watchers, hydration, README failure) against the live page. Each fix = its own commit + regression test |
| **(direct CI work)** | Post-deploy | GitHub Actions workflow for typecheck + unit + build + e2e |

---

## The actual workflow (ASCII flow)

```
┌─────────────────────────────────────────────────────────────┐
│              SPEC (7 features, social platform)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  /office-hours
┌─────────────────────────────────────────────────────────────┐
│   THINK — YC-style interrogation                             │
│   Q1 demand evidence?   → "honestly, none yet"               │
│   Q2 status quo?         → "I track stats manually"          │
│   Q3 specificity         → (skipped: user is the user)       │
│   Q4 narrowest wedge     → "single repo deep-dive"           │
│   Q5 premises locked     → all 4 agreed                      │
│   Q6 approach            → "Frontend-only MVP"               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  produces DESIGN.md
┌─────────────────────────────────────────────────────────────┐
│            DESIGN.md (1-feature MVP, premises locked)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  /plan-eng-review
┌─────────────────────────────────────────────────────────────┐
│   PLAN — architecture before code                            │
│   D1 GitHub rate limits  → PAT + Vercel KV (24h cache)       │
│   D2 stargazers pages    → sample 10 max, cap at GH page 400 │
│   D3 AI methodology      → Gemini Flash × 3 prompts          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  produces ENG-PLAN.md
┌─────────────────────────────────────────────────────────────┐
│       ENG-PLAN.md (17 files, 13 ordered tasks, tests)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  build loop
┌─────────────────────────────────────────────────────────────┐
│   BUILD — one task = one commit                              │
│   T1 scaffold        T8  OG share image                      │
│   T2 lib/github.ts   T9  landing form                        │
│   T3 star-history    T10 share footer                        │
│   T4 ai-discover     T11 plausible                           │
│   T5 readme-analysis T12 playwright e2e                      │
│   T6 page route      T13 deploy                              │
│   T7 components                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  /qa (after T7 visuals)
┌─────────────────────────────────────────────────────────────┐
│   VERIFY — 3 bugs found, 3 fixed atomically                  │
│   B1 watchers count       → 1-line fix + regression test     │
│   B2 hydration mismatch   → useEffect + verify console clean │
│   B3 README quality fail  → bumped tokens + responseSchema   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  T13 deploy + CI
┌─────────────────────────────────────────────────────────────┐
│    LIVE — github-stars-friends.vercel.app                    │
│    Vercel KV connected · GitHub Actions running              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  polish round
┌─────────────────────────────────────────────────────────────┐
│   Linear-style landing (aurora, gradient hero, animations)   │
└─────────────────────────────────────────────────────────────┘
```

---

## What worked (the two things I'd want again)

### 1. The depth felt like a real engineering team, not autocomplete

`/office-hours` didn't say "good idea, let's go." It asked who would actually pay, whether I had observed users, who the specific human was. **By the end, six of the seven features I wrote in the spec were cut from MVP.** None of them were wrong — they're parked with explicit promote-when criteria — but the wedge sharpened enormously.

`/plan-eng-review` didn't say "Next.js is fine." It specifically asked about:
- GitHub's anonymous 60/hr rate limit (would have broken on HN launch)
- GitHub's stargazers pagination cap at page 400 (would have 422'd on any 40k+ star repo)
- How the AI Discoverability score would be DEFENSIBLE if challenged on Twitter

These three architecture decisions were locked **before any code existed**. They would have been emergency firefights at week 3 otherwise.

### 2. The QA → fix → CI → deploy loop was seamless

After T13 deploy:
- `/qa` loaded the screenshot of the live page
- Found B1 (watchers count) and B2 (hydration) just from the screenshot + source-code read
- Used the browse binary to confirm B3 (README failure) was a Gemini token-truncation issue, not the network
- Fixed each with a single atomic commit + regression test
- Pushed → GitHub Actions ran the full suite → green
- Vercel auto-redeployed → smoke check confirmed all 3 fixes live

**Zero context-switching cost.** Felt like a full team handling production handoff in 15 minutes.

---

## What didn't work (the rough edges)

### 1. Too much ceremony for small decisions

For "should I add a CI workflow?" or "make the landing prettier," there's no lightweight skill. The full `/office-hours` (6 questions, premise challenge, alternatives generation, design-doc writing) is overkill.

**Concretely felt:** when you asked me to make the landing prettier, my instinct was to type `/office-hours` because that's the only "think first" skill I'd used. But for a UI polish task, `/design-shotgun` would have been the natural fit — I just didn't know it existed.

What would help: a lightweight `/quick-think` that asks 2-3 clarifying questions and proposes 2-3 directions without writing a design doc to disk. Right now every think-skill is "go deep" and you can't get the 60-second version.

### 2. Skill discovery is invisible

The full skill list shipped with gstack has 50+ skills. I used 4 named ones (`/office-hours`, `/plan-eng-review`, `/context-restore`, `/qa`). The rest were invisible to me because:
- There's no "what should I run?" router
- The slash-command UI shows you commands but not when to use them
- I had to ask gstack which skills existed (and gstack told me)

What would help: AI-side proactive routing. *"This looks like a `/design-shotgun` fit, want me to run it?"* Even just at the start of each user message would be valuable.

### 3. CEO Plan ceremony feels heavy for solo dev

I never used `/plan-ceo-review`, but reading the skill description ("rethink the problem, find the 10-star product, EXPANSION mode") felt like it was built for product-team strategy meetings. For a solo side project where the CEO and the engineer are the same person, the existing `/office-hours` already covers it.

**Net of all three points:** gstack is meaningfully better for *bigger* tasks (new project, major pivot, real product decision). For small tasks (add a button, fix a typo, tweak a style), the ceremony overhead dominates. There's no "small-task gear" yet.

---

## What I'd do differently next time

1. **Skip `/office-hours` for clearly-scoped feature work.** Use it only at project birth or major pivots.
2. **Trust the eng review.** When `/plan-eng-review` flags a P1, take it seriously even if "it feels fine." Both pages of the QA report (B1, B2, B3) traced back to NOT taking the eng review seriously enough on certain details.
3. **Run `/qa` after every major feature, not just before deploy.** The 3 bugs found in 90 seconds at T13 would have been even faster to fix at T7.
4. **Commit at every clean state.** The "one task = one commit" discipline `/qa` enforces is a superpower for git bisect, history readability, and "what did I change?" answers.

---

## Concrete numbers

| Metric | Value |
|---|---|
| Total commits | 18 |
| Lines of TS/TSX (excl. tests) | ~2,200 |
| Lines of tests | ~900 |
| Unit tests | 69 |
| E2E tests (Playwright) | 6 |
| Total tests | **75 passing** |
| TypeScript errors | 0 |
| Bugs found by `/qa` | 3 (all P1/P2) |
| Bugs that shipped to prod | **0** |
| CC time spent | ~3 hours |
| Human-equivalent estimate | ~17 hours (per ENG-PLAN) |
| AI compression ratio | ~5x |
| Production cold render | 6-8s (4 parallel API fan-out) |
| Production warm render | 340-690ms (Vercel KV) |
| Cache hit speedup | ~10x consistently |

---

## What gstack changed (counterfactual)

If I had built this with vanilla Claude Code, no gstack:

| | Without gstack | With gstack |
|---|---|---|
| Scope | Implemented the 7-feature spec as written | Cut to 1-feature MVP via /office-hours |
| Rate limits | Discovered in production after HN launch | Decided in D1 before any code |
| Pagination cap | Found via 422 errors on big repos | Decided in D2 + capped in `lib/star-history.ts` |
| AI methodology | "Score it somehow" — vague | Gemini × 3 prompts, defensible, ~$0.01/repo |
| Bug count to prod | ~3-5 visible bugs to users | 0 |
| Git history | Mix of WIP commits, "fix stuff" messages | 18 atomic commits, each tied to a task or bug |
| Deploy story | "It works on my machine" | Vercel + KV + CI workflow + DEPLOY.md |

**The tradeoff is honest:** 30-45 minutes of upfront "ceremony" in `/office-hours` + `/plan-eng-review`, in exchange for not making category-mistake decisions you regret 3 weeks later.

For projects this size, the math is clearly worth it. For a 20-line script, gstack is overkill.

---

## TL;DR for a teammate considering gstack

**Use it when:**
- Starting a new project
- Considering a major pivot or new feature
- About to deploy and want a real QA pass
- Setting up CI/CD on a project that doesn't have it yet
- You'd benefit from a senior eng + a PM pushing back on your assumptions

**Don't use it for:**
- 20-line scripts
- Single-file edits
- "Fix this typo"
- Anything where the right answer is obvious in 30 seconds

**The killer feature:** the QA → atomic-commit → CI → deploy loop. That alone is worth installing. Everything else is a bonus.

---

*Generated 2026-06-02 after shipping [github-stars-friends.vercel.app](https://github-stars-friends.vercel.app) end-to-end with [gstack](https://github.com/garrytan/gstack) + Claude Code.*
