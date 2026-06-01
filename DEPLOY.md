# Deploy to Vercel

Step-by-step. Skip any step you've already done.

## Step 1 — Create a GitHub repo and push

You need a GitHub account. The repo can be public or private.

```bash
# Replace YOUR_USERNAME and CHOSEN_NAME with your values
# Example: https://github.com/garrytan/repo-dive
git remote add origin git@github.com:YOUR_USERNAME/CHOSEN_NAME.git

# Or HTTPS instead of SSH:
# git remote add origin https://github.com/YOUR_USERNAME/CHOSEN_NAME.git

git push -u origin main
```

If you don't have a repo yet:

1. Go to https://github.com/new
2. Name: anything you like (e.g. `repo-dive`)
3. Don't initialize with README/license — your local repo already has those
4. Create
5. Copy the SSH or HTTPS URL it shows, paste into the `git remote add origin ...` above

## Step 2 — Get your API keys ready

You'll set these as env vars on Vercel in Step 4. Get them now:

### GitHub Personal Access Token (required)

1. https://github.com/settings/tokens?type=beta
2. Generate new token (classic also works)
3. **No scopes needed** for public repos. Public read is free.
4. Token expiration: 90 days is fine; 1 year is fine for hobby projects
5. Copy the `ghp_...` token. You'll paste it as `GITHUB_PAT` on Vercel.

This single PAT will service all your traffic at 5000 req/hr (vs anonymous 60/hr).

### Gemini API key (optional but recommended — this is the differentiator)

1. https://aistudio.google.com/apikey
2. "Create API key" — pick any Google Cloud project (or "no project")
3. Copy the `AIza...` key. You'll paste it as `GEMINI_API_KEY` on Vercel.

Cost on Gemini Flash: ~$0.01 per repo, cached 24h. Free tier covers ~1000 distinct repos/day.

### (Optional) Plausible Analytics

1. https://plausible.io/sites/new
2. Add your eventual domain (e.g. `repo-dive.app` or `your-vercel-deployment.vercel.app`)
3. You'll paste the domain string as `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` on Vercel.

Without this, the Plausible script doesn't load. Page analytics still work via Vercel's built-in if you want a free alternative.

## Step 3 — Import the repo into Vercel

1. https://vercel.com/new
2. "Import Git Repository" — pick the repo you just pushed
3. Vercel auto-detects Next.js. Keep the defaults:
   - Framework Preset: **Next.js**
   - Build Command: `bun run build` (or leave default `next build`)
   - Output Directory: `.next` (auto)
   - Install Command: `bun install` (or default)
4. **Don't deploy yet** — click "Environment Variables" first (Step 4)

## Step 4 — Set environment variables on Vercel

Under "Environment Variables" in the import dialog:

| Variable | Required | Value | Notes |
|----------|----------|-------|-------|
| `GITHUB_PAT` | **yes** | `ghp_xxx...` from Step 2 | Production + Preview + Development |
| `GEMINI_API_KEY` | recommended | `AIza...` from Step 2 | Production + Preview |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | optional | e.g. `repo-dive.app` | Production only |

KV vars (`KV_REST_API_URL`, etc.) are added automatically in Step 5.

Click **Deploy**.

## Step 5 — Add Vercel KV

After the first deploy succeeds:

1. Go to your project → **Storage** tab → **Create Database** → **KV**
2. Name it anything (e.g. `repo-dive-cache`)
3. Connect to the project: **Production**, **Preview**, **Development**
4. Vercel auto-adds `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`
5. Redeploy: project → Deployments → click the latest → "Redeploy" (use existing build cache)

Without KV, each page render hits GitHub + Gemini fresh. With KV, second-and-beyond visits to the same repo are nearly instant.

## Step 6 — Try it

Open your Vercel preview URL (looks like `https://repo-dive-xxx.vercel.app`).

1. **Homepage**: should see "repo-dive" + the paste-a-URL form
2. **Submit `vercel/next.js`**: should redirect and show a full deep-dive page with stars chart, AI score (if Gemini key set), README quality, contributors
3. **Random repo of yours**: try one you maintain to see your real AI Discoverability score

## Step 7 (optional) — Custom domain

1. Buy a domain (e.g. via Namecheap, Cloudflare, Porkbun) — `repo-dive.app` is unregistered as of writing this
2. Project → Settings → Domains → Add
3. Follow Vercel's DNS instructions (one CNAME or A record)
4. If you set up Plausible: update `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to the new domain and redeploy

## Smoke checks once deployed

These mirror the Playwright tests but run against the live site:

```bash
DEPLOY_URL=https://your-deployment.vercel.app

# 1. Landing
curl -sI "$DEPLOY_URL/" | head -1                    # expect HTTP/2 200

# 2. Real repo (replace with one you care about)
curl -sI "$DEPLOY_URL/vercel/next.js" | head -1      # expect HTTP/2 200

# 3. OG image
curl -sI "$DEPLOY_URL/vercel/next.js/opengraph-image" | head -3
# expect HTTP/2 200, content-type: image/png

# 4. 404 path renders gracefully (not 500)
curl -sI "$DEPLOY_URL/nonexistent/nope-repo-xyz" | head -1
# expect HTTP/2 200 (with "Repo not found" or "Service degraded" in body)
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| All cards show "Service degraded" | `GITHUB_PAT` not set or invalid | Vercel → Settings → Environment Variables → re-add → redeploy |
| AI cards show "missing-api-key" | `GEMINI_API_KEY` not set | Set + redeploy (existing prod can run without it) |
| First page load is slow (>5s) | First-time KV miss + GitHub cold | Normal. Warm hits should be <500ms. Verify KV is connected. |
| Build fails with "module not found: @vercel/kv" | KV package not installed | `bun install` and recommit. Already in `package.json` so this shouldn't happen. |
| Repo with 100k+ stars shows "early history only" | GitHub paginates stargazers to page 400 max | Working as designed. True complete history needs a backend snapshot worker (deferred to v1.1 per ENG-PLAN). |

## After it's live

- Share `repo-dive.app/<your-best-repo>` on X or Hacker News
- Use the built-in Share buttons (footer of the deep-dive page) — they include `?ref=x` / `?ref=hn` / `?ref=copy` so you can see what drives traffic in Plausible
- Track success criteria from ENG-PLAN: week 4 should hit ≥50 unique repos/week if the wedge is right
