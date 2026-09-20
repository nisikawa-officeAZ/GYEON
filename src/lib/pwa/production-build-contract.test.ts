import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};
const nextConfig = readFileSync("next.config.ts", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");

test("production build uses webpack so the Workbox PWA plugin emits sw.js", () => {
  // Next.js 15.5 uses webpack when no Turbopack opt-in flag is present.
  assert.equal(packageJson.scripts?.build, "next build");
  assert.equal(packageJson.scripts?.dev, "next dev --turbopack");
});

test("production PWA generation remains enabled and targets public artifacts", () => {
  assert.match(nextConfig, /withPWA\(\{/);
  assert.match(nextConfig, /dest:\s*["']public["']/);
  assert.match(nextConfig, /disable:\s*process\.env\.NODE_ENV\s*===\s*["']development["']/);
});

test("authentication middleware never intercepts generated worker artifacts", () => {
  assert.match(middleware, /sw\.js/);
  assert.match(middleware, /workbox/);
});
