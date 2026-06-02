/**
 * End-to-end smoke test.
 *
 * Covers the critical user paths regardless of GitHub auth status:
 *   1. Landing page loads with the form
 *   2. Submit valid input → redirects to /[owner]/[repo]
 *   3. /[owner]/[repo] renders (fully or degraded — both are acceptable)
 *   4. Invalid input shows inline error, no redirect
 *   5. Unknown repo path returns a useful page (not 500)
 *
 * Auth-agnostic: when GITHUB_PAT is set and the bucket has headroom the
 * tests see the rich page; when anonymous and burned the tests see the
 * Service degraded fallback. Both are valid outcomes — these tests assert
 * "no crash" + "URL routing works", not exact content.
 */

import { expect, test } from "@playwright/test";

test.describe("repo-dive smoke", () => {
  test("landing page renders form", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/repo-dive/);
    // Hero copy may evolve — assert the essence (the "AI" framing and the form)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /AI|repo/i,
    );
    await expect(
      page.getByPlaceholder(/vercel\/next\.js/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /dive in/i })).toBeVisible();
  });

  test("valid input redirects to /[owner]/[repo]", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/vercel\/next\.js/).fill("vercel/next.js");
    await page.getByRole("button", { name: /dive in/i }).click();
    await page.waitForURL("**/vercel/next.js", { timeout: 15_000 });
    expect(page.url()).toContain("/vercel/next.js");
  });

  test("URL form gets parsed correctly", async ({ page }) => {
    await page.goto("/");
    await page
      .getByPlaceholder(/vercel\/next\.js/)
      .fill("https://github.com/anthropics/claude-code/tree/main");
    await page.getByRole("button", { name: /dive in/i }).click();
    await page.waitForURL("**/anthropics/claude-code", { timeout: 15_000 });
  });

  test("invalid input shows inline error, no redirect", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/vercel\/next\.js/).fill("not a real input");
    await page.getByRole("button", { name: /dive in/i }).click();
    // Stays on / and surfaces an error. Filter the alert by text content
    // because Next.js injects its own route-announcer with role="alert".
    await expect(page).toHaveURL(/\/$/);
    const ourError = page
      .getByRole("alert")
      .filter({ hasText: /parse|owner|repo/i });
    await expect(ourError).toBeVisible({ timeout: 5_000 });
  });

  test("repo page returns 200 (rich or degraded)", async ({ page }) => {
    const response = await page.goto("/vercel/next.js");
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    // The page MUST render either the rich version (header with stars) OR
    // the degraded fallback. Either way: the word "repo-dive" appears
    // somewhere on the page (in metadata + footer).
    const body = await page.content();
    expect(body).toContain("repo-dive");
  });

  test("unknown repo path renders gracefully (not 500)", async ({ page }) => {
    const response = await page.goto("/this-org-does-not/exist-12345");
    expect(response).not.toBeNull();
    // Two valid outcomes depending on whether GitHub was reachable:
    //   - 404: GitHub confirmed the repo doesn't exist → not-found.tsx
    //   - 200: rate-limited or couldn't reach GitHub → DegradedFallback
    // The wrong outcome (proving a regression) would be 500 from error.tsx.
    const status = response!.status();
    expect([200, 404]).toContain(status);
    const body = await page.content();
    expect(body).toMatch(/Repo not found|Service degraded/);
  });
});
