import { defineConfig, devices } from "@playwright/test";

// Durable B7-4 disposable-E2E Playwright config. Runs the canonical spec against a
// throwaway local stack started by run-app.sh. Trace/screenshot/video are DISABLED:
// the login step types the disposable password, and a trace would record that fill
// value — so no artifact that could capture a credential is ever produced.
export default defineConfig({
  testDir: ".",
  testMatch: /b7-4\.spec\.ts/,
  // Keep ALL generated output (incl. .last-run.json) OUT of the repository, so a
  // run never adds a worktree entry outside the implementation allowlist.
  outputDir: "/private/tmp/pw-b7-4-results",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    headless: true,
    // Fresh isolated context each run ⇒ no stale localhost:3000 tab can contaminate
    // the run (eliminates the historical stale-tab / wrong-browser burn classes).
    storageState: undefined,
    trace: "off",
    screenshot: "off",
    video: "off",
    locale: "ja-JP",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
