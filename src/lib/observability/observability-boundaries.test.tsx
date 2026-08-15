// OBS-1B — render + source-boundary tests for the four error UI files.
//
// Run: node --import tsx --test src/lib/observability/observability-boundaries.test.tsx
//
// Rendering uses react-dom/server, already a direct dependency — no jsdom, no
// testing-library, no new package. This mirrors the established pattern in
// EstimateWizard.pricing.test.tsx.
//
// `renderToStaticMarkup` does NOT execute useEffect, so reporting behaviour is
// NOT asserted here and is NOT simulated. Exactly-once reporting is proven
// directly in ui-error-report.test.ts against the pure controller. What this file
// proves is what a user actually SEES.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsconfig uses `jsx: preserve`; under tsx these components compile to classic
// React.createElement. Expose React before any render. TEST-ONLY shim, permitted
// by the R68B ruling for this file alone.
(globalThis as unknown as { React: typeof React }).React = React;

import GlobalError from "../../app/global-error";
import AppError from "../../app/error";
import EstimatesError from "../../app/estimates/error";
import NotFound from "../../app/not-found";

const SRC = {
  global:    "src/app/global-error.tsx",
  app:       "src/app/error.tsx",
  estimates: "src/app/estimates/error.tsx",
  notFound:  "src/app/not-found.tsx",
  controller:"src/lib/observability/ui-error-report.ts",
} as const;

const ALL_SRC = Object.values(SRC);

const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** A thrown value loaded with canaries in every field a boundary must ignore. */
const CANARY_MESSAGE = "CANARY-MESSAGE-山田太郎-must-not-render";
const CANARY_DIGEST = "CANARY-DIGEST-9f3c-must-not-render";
const canaryError = (): Error & { digest?: string } =>
  Object.assign(new Error(CANARY_MESSAGE), { digest: CANARY_DIGEST });

const OBS_CODE = /obs\.[0-9a-f]{32}/;

// ─── 1. Exact Japanese copy ─────────────────────────────────────────────────

test("global-error renders its exact title and body", () => {
  const html = renderToStaticMarkup(<GlobalError error={canaryError()} reset={() => {}} />);
  assert.ok(html.includes("システムエラーが発生しました"), "title");
  assert.ok(
    html.includes("処理を続けられませんでした。再試行しても解決しない場合は、サポート番号をお知らせください。"),
    "body",
  );
});

test("app error renders its exact title and body", () => {
  const html = renderToStaticMarkup(<AppError error={canaryError()} reset={() => {}} />);
  assert.ok(html.includes("ページを表示できませんでした"), "title");
  assert.ok(
    html.includes("一時的な問題が発生しました。再試行しても解決しない場合は、サポート番号をお知らせください。"),
    "body",
  );
});

test("estimates error renders its exact title and body", () => {
  const html = renderToStaticMarkup(<EstimatesError error={canaryError()} reset={() => {}} />);
  assert.ok(html.includes("見積画面でエラーが発生しました"), "title");
  assert.ok(
    html.includes("入力内容は保存されていない可能性があります。再試行しても解決しない場合は、サポート番号をお知らせください。"),
    "body",
  );
});

test("not-found renders its exact title and body", () => {
  const html = renderToStaticMarkup(<NotFound />);
  assert.ok(html.includes("ページが見つかりません"), "title");
  assert.ok(html.includes("URLが正しいか確認するか、ホームへ戻ってください。"), "body");
});

// ─── 2-3. Support code presence and absence ─────────────────────────────────

test("every uncaught boundary renders an obs.* support code with its label", () => {
  for (const [name, html] of [
    ["global", renderToStaticMarkup(<GlobalError error={canaryError()} reset={() => {}} />)],
    ["app", renderToStaticMarkup(<AppError error={canaryError()} reset={() => {}} />)],
    ["estimates", renderToStaticMarkup(<EstimatesError error={canaryError()} reset={() => {}} />)],
  ] as Array<[string, string]>) {
    assert.ok(html.includes("サポート番号"), `${name}: label`);
    assert.match(html, OBS_CODE, `${name}: obs.* code`);
  }
});

test("each render produces a distinct support code (real entropy, one per incident)", () => {
  const a = renderToStaticMarkup(<AppError error={canaryError()} reset={() => {}} />).match(OBS_CODE)?.[0];
  const b = renderToStaticMarkup(<AppError error={canaryError()} reset={() => {}} />).match(OBS_CODE)?.[0];
  assert.ok(a && b);
  assert.notEqual(a, b);
});

test("not-found renders NO support-code label and NO obs.* value", () => {
  const html = renderToStaticMarkup(<NotFound />);
  assert.equal(html.includes("サポート番号"), false, "no label");
  assert.equal(OBS_CODE.test(html), false, "no obs.* code");
});

test("not-found imports no reporting code at all", () => {
  const code = codeOf(SRC.notFound);
  assert.equal(code.includes("reportUiErrorOnce"), false);
  assert.equal(code.includes("createObservabilityRequestId"), false);
  assert.equal(code.includes("useEffect"), false);
  assert.equal(code.includes("use client"), false, "not-found stays a Server Component");
});

// ─── 4. global-error owns the document shell ────────────────────────────────

test("global-error renders its own html and body", () => {
  const html = renderToStaticMarkup(<GlobalError error={canaryError()} reset={() => {}} />);
  assert.match(html, /^<html[^>]*>/, "starts with <html>");
  assert.ok(html.includes("<body"), "contains <body>");
  assert.ok(html.includes('lang="ja"'), "declares Japanese");
  assert.ok(html.trimEnd().endsWith("</html>"), "closes </html>");
});

test("global-error depends on no root layout, provider or stylesheet", () => {
  const code = codeOf(SRC.global);
  assert.equal(code.includes("globals.css"), false, "no stylesheet import");
  assert.equal(code.includes("next/font"), false, "no font dependency");
  assert.equal(code.includes("className="), false, "inline styles only — Tailwind may not be loaded");
  assert.ok(code.includes("style={"), "uses inline styles");
});

// ─── 5-6. Actions ───────────────────────────────────────────────────────────

test("retry is a real button wired to reset, and is omitted when reset is absent", () => {
  for (const render of [
    (r?: () => void) => renderToStaticMarkup(<GlobalError error={canaryError()} reset={r} />),
    (r?: () => void) => renderToStaticMarkup(<AppError error={canaryError()} reset={r} />),
    (r?: () => void) => renderToStaticMarkup(<EstimatesError error={canaryError()} reset={r} />),
  ]) {
    const withReset = render(() => {});
    assert.ok(withReset.includes("もう一度試す"), "retry label present");
    assert.match(withReset, /<button[^>]*type="button"/, "native button with type=button");

    const withoutReset = render(undefined);
    assert.equal(withoutReset.includes("もう一度試す"), false, "no dead retry button without reset");
  }
});

test("every boundary offers a safe home link to /", () => {
  for (const html of [
    renderToStaticMarkup(<GlobalError error={canaryError()} reset={() => {}} />),
    renderToStaticMarkup(<AppError error={canaryError()} reset={() => {}} />),
    renderToStaticMarkup(<EstimatesError error={canaryError()} reset={() => {}} />),
    renderToStaticMarkup(<NotFound />),
  ]) {
    assert.ok(html.includes("ホームへ戻る"), "home label");
    assert.match(html, /<a[^>]*href="\/"/, 'anchor to "/"');
  }
});

test("uncaught boundaries expose an accessible alert region", () => {
  for (const html of [
    renderToStaticMarkup(<GlobalError error={canaryError()} reset={() => {}} />),
    renderToStaticMarkup(<AppError error={canaryError()} reset={() => {}} />),
    renderToStaticMarkup(<EstimatesError error={canaryError()} reset={() => {}} />),
  ]) {
    assert.match(html, /role="alert"/);
  }
});

// ─── 7. The thrown value never reaches the screen ───────────────────────────

test("CANARY: the raw message and digest never appear in rendered output", () => {
  for (const [name, html] of [
    ["global", renderToStaticMarkup(<GlobalError error={canaryError()} reset={() => {}} />)],
    ["app", renderToStaticMarkup(<AppError error={canaryError()} reset={() => {}} />)],
    ["estimates", renderToStaticMarkup(<EstimatesError error={canaryError()} reset={() => {}} />)],
  ] as Array<[string, string]>) {
    // 1. The render ACTUALLY produced the boundary — absence is meaningless otherwise.
    assert.ok(html.length > 0 && html.includes("サポート番号"), `${name}: boundary really rendered`);
    // 2. Only then does absence mean anything.
    assert.equal(html.includes(CANARY_MESSAGE), false, `${name}: message leaked`);
    assert.equal(html.includes(CANARY_DIGEST), false, `${name}: digest leaked`);
    assert.equal(html.includes("CANARY-MESSAGE"), false, `${name}: partial message leaked`);
    assert.equal(html.includes("CANARY-DIGEST"), false, `${name}: partial digest leaked`);
    assert.equal(html.includes("山田太郎"), false, `${name}: PII leaked`);
  }
});

test("no boundary reads message, stack, digest or serializes the error", () => {
  for (const file of [SRC.global, SRC.app, SRC.estimates, SRC.notFound]) {
    const code = codeOf(file);
    for (const token of [".mess" + "age", ".sta" + "ck", ".dig" + "est", ".ca" + "use"]) {
      assert.equal(code.includes(token), false, `${file} reads ${token}`);
    }
    assert.equal(/JSON\.stringify\s*\(\s*error/.test(code), false, `${file} serializes the error`);
    assert.equal(/\{\s*error\s*[,}]/.test(code), false, `${file} destructures error`);
    assert.equal(/reportUiErrorOnce\([^)]*error/.test(code), false, `${file} forwards the error`);
    assert.equal(/reportObservabilityEvent/.test(code), false, `${file} calls the reporter directly`);
  }
});

// ─── 8-11. Contract and scope guards ────────────────────────────────────────

test("the retry callback is reset, never unstable_retry", () => {
  for (const file of [SRC.global, SRC.app, SRC.estimates]) {
    const code = codeOf(file);
    assert.ok(code.includes("reset"), `${file} uses reset`);
    assert.equal(code.includes("unstable_retry"), false, `${file} uses unstable_retry`);
  }
});

test("client boundaries declare use client; not-found does not", () => {
  for (const file of [SRC.global, SRC.app, SRC.estimates]) {
    assert.match(readFileSync(file, "utf8"), /^"use client";/, `${file} must start with the client directive`);
  }
  // Comment-stripped: not-found.tsx DOCUMENTS that it carries no client directive,
  // so a raw-text check would match its own explanatory comment.
  assert.equal(codeOf(SRC.notFound).includes("use client"), false);
});

test("no monitoring vendor is imported", () => {
  const vendors = ["sen" + "try", "data" + "dog", "bug" + "snag", "roll" + "bar",
                   "open" + "telemetry", "new" + "relic", "post" + "hog"];
  for (const file of ALL_SRC) {
    const code = codeOf(file).toLowerCase();
    for (const v of vendors) assert.equal(code.includes(v), false, `${file} imports ${v}`);
  }
});

test("no save action, gateway, Supabase or persistence reachability", () => {
  const forbidden = ["supa" + "base", "createClient", "createAdminClient", ".rpc(",
                     "persistence-gateway", "save-estimate-from-wizard",
                     "EstimatePersistenceService", "Screens" + "Preview"];
  for (const file of ALL_SRC) {
    const code = codeOf(file);
    for (const token of forbidden) assert.equal(code.includes(token), false, `${file} contains ${token}`);
  }
});

test("boundaries mount no route and redirect nothing", () => {
  for (const file of [SRC.global, SRC.app, SRC.estimates, SRC.notFound]) {
    const code = codeOf(file);
    for (const token of ["redirect(", "notFound(", "useRouter", "router.push", "next/navigation"]) {
      assert.equal(code.includes(token), false, `${file} contains ${token}`);
    }
  }
});

test("no type-checking escape hatches outside the single permitted shim", () => {
  const hatches = ["as " + "any", "@ts-" + "ignore", "@ts-" + "expect-error", "@ts-" + "nocheck"];
  for (const file of [...ALL_SRC, "src/lib/observability/ui-error-report.test.ts"]) {
    const raw = readFileSync(file, "utf8");
    for (const token of hatches) assert.equal(raw.includes(token), false, `${file} contains ${token}`);
  }
  // The one permitted shim lives only in THIS file. The token is assembled from
  // fragments so this assertion does not count its own search term.
  const shim = "as " + "unknown " + "as";
  const self = readFileSync("src/lib/observability/observability-boundaries.test.tsx", "utf8");
  assert.equal(self.split(shim).length - 1, 1, "exactly one permitted shim");
  for (const file of ALL_SRC) {
    assert.equal(readFileSync(file, "utf8").includes(shim), false, `${file} uses a cast`);
  }
});

test("the committed OBS-1A core is untouched by this phase", () => {
  const controller = codeOf(SRC.controller);
  assert.match(controller, /from "\.\/report-observability-event"/, "reuses the committed reporter");
  assert.equal(controller.includes("process.env"), false, "does not resolve env or release itself");
  assert.equal(controller.includes("Date.now"), false);
  assert.equal(controller.includes("Math.random"), false);
  assert.equal(controller.includes("randomUUID"), false);
});
