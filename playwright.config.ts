import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for repo-dive e2e.
 *
 * Tests live in tests/e2e/*.e2e.ts so they don't collide with the bun
 * test runner (bun test picks up *.test.ts and *.spec.ts).
 *
 * Playwright auto-starts the Next.js dev server on port 3000 via webServer.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
