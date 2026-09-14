import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HTML = readFileSync(join(process.cwd(), "public", "desktop-home.html"), "utf8");

test("trial UI obeys the hidden attribute for non-trial accounts", () => {
  assert.match(
    HTML,
    /\.trial-stack\[hidden\]\s*,\s*\.trial-countdown\[hidden\]\s*,\s*\.trial-badge\[hidden\]\s*\{\s*display:\s*none\s*;/,
    "author display rules must not override the hidden state applied by the authenticated bootstrap",
  );
  assert.ok(
    HTML.includes("var isTrial = params.get('t') === '1'"),
    "only an explicit authenticated trial flag may enable trial UI",
  );
  assert.ok(
    HTML.includes("trialStack.hidden = !isTrial"),
    "the bootstrap must derive trial visibility from the authenticated trial flag",
  );
});
