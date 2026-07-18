// EW-UI-4A3 — Canonical host authoritative-pricing UI binding tests.
//
// Proves the host requires the four authoritative inputs, calls the config-driven pricing hook with
// the exact argument order, threads only shopRank + screenConfig to Step4Estimate, keeps pricing
// inputs/results out of business state, and that WizardShell renders pricing FAIL-CLOSED (null → "—",
// genuine zero → "¥0", distinct partial/unavailable/error/complete states, same rule on desktop and
// mobile). No fixture/default pricing dependency enters the host path.
//
// Run: node --import tsx --test src/components/estimates/wizard/EstimateWizard.pricing.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsconfig uses `jsx: preserve`; under tsx the screen components (which rely on the automatic JSX
// runtime) compile to classic React.createElement. Expose React before any render. TEST-ONLY shim.
(globalThis as unknown as { React: typeof React }).React = React;

import EstimateWizard from "./EstimateWizard";
import { WizardShell, type WizardTotals } from "./WizardShell";
import { makePricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { EstimateWizardApi } from "./useEstimateWizard";
import type { WizardScreenConfiguration } from "./contract/wizard-runtime-inputs";
import type { ProductionPricingConfiguration } from "./pricing/wizard-manual-pricing-config";

const render = (node: React.ReactElement): string => renderToStaticMarkup(node);

// ── operator-safe notices (must match WizardShell) ────────────────────────────────
const MSG_PARTIAL = "一部の金額が未確定です。表示金額は確定前です。";
const MSG_UNAVAILABLE = "サービスと必要情報を選択すると金額が表示されます。";
const MSG_ERROR = "金額を計算できません。入力内容を確認してください。";

// Minimal fake api for direct WizardShell render (shell reads only step/jumpTo/completed/back/next/…).
const fakeApi = {
  step: 1, jumpTo: () => {}, next: () => {}, back: () => {},
  isFirst: true, isLast: false, completed: new Set<number>(),
} as unknown as EstimateWizardApi;

const shell = (totals: WizardTotals): string =>
  render(<WizardShell api={fakeApi} title="見積" totals={totals}>x</WizardShell>);

const T = (over: Partial<WizardTotals>): WizardTotals =>
  ({ subtotal: null, discount: null, tax: null, total: null, state: "unavailable", ...over });

// ── source guards / host inputs ───────────────────────────────────────────────────
const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const HOST_SRC = "src/components/estimates/wizard/EstimateWizard.tsx";
const SHELL_SRC = "src/components/estimates/wizard/WizardShell.tsx";
const CONTRACT_SRC = "src/components/estimates/wizard/contract/wizard-pricing-runtime-inputs.ts";

// Compile-time proof that catalog + pricingConfig are REQUIRED props (omitting either is a type error).
type HostProps = React.ComponentProps<typeof EstimateWizard>;
const _catalogRequired: Omit<HostProps, "catalog"> extends HostProps ? false : true = true;
const _pricingConfigRequired: Omit<HostProps, "pricingConfig"> extends HostProps ? false : true = true;

// ── 1. required four inputs, no defaults ──────────────────────────────────────────

test("1. the host requires catalog + pricingConfig (WizardHostRuntimeInputs, no optional/default)", () => {
  assert.equal(_catalogRequired, true);
  assert.equal(_pricingConfigRequired, true);
  const code = codeOf(HOST_SRC);
  assert.match(code, /EstimateWizardProps\s+extends\s+WizardHostRuntimeInputs/, "props use the host contract");
  assert.match(code, /\{\s*mode\s*=\s*"create",\s*shopRank,\s*screenConfig,\s*catalog,\s*pricingConfig\s*\}/, "destructures all four inputs");
  // Contract module is type-only (no runtime logic) and keeps WizardRuntimeInputs unwidened.
  const contract = codeOf(CONTRACT_SRC);
  assert.match(contract, /export\s+type\s+WizardHostRuntimeInputs\s*=\s*WizardRuntimeInputs\s*&\s*WizardPricingRuntimeInputs/, "intersection, not widening");
  assert.equal(/=>|function |useState|console\./.test(contract), false, "contract has no runtime logic");
});

// ── 2. exact authoritative hook call ──────────────────────────────────────────────

test("2. the host calls useWizardPricingFromConfig with the exact four authoritative inputs in order", () => {
  const code = codeOf(HOST_SRC);
  assert.match(
    code,
    /useWizardPricingFromConfig\(\s*api\.draft\s*,\s*pricingConfig\s*,\s*catalog\s*,\s*shopRank\s*,?\s*\)/,
    "hook called with (api.draft, pricingConfig, catalog, shopRank)",
  );
});

// ── 3. only shopRank + screenConfig reach Step4Estimate ───────────────────────────

test("3. only shopRank + screenConfig are passed to Step4Estimate (never catalog/pricingConfig)", () => {
  const code = codeOf(HOST_SRC);
  assert.match(code, /<Step4Estimate\s+api=\{api\}\s+shopRank=\{shopRank\}\s+screenConfig=\{screenConfig\}\s*\/>/);
  // catalog / pricingConfig appear ONLY in the prop destructure and the pricing hook call — never on
  // any <Step…> element (so exactly two references each: destructure + hook argument).
  assert.equal(/<Step[^>]*\b(catalog|pricingConfig)=/.test(code), false, "no step receives pricing inputs");
  assert.equal((code.match(/\bcatalog\b/g) ?? []).length, 2, "catalog: destructure + hook only");
  assert.equal((code.match(/\bpricingConfig\b/g) ?? []).length, 2, "pricingConfig: destructure + hook only");
});

// ── 4–9. fail-closed shell rendering ──────────────────────────────────────────────

test("4. unavailable totals render dashes and never a misleading ¥0", () => {
  const html = shell(T({ state: "unavailable" }));
  assert.ok(html.includes("—"), "dash rendered");
  assert.equal(html.includes("¥"), false, "no ¥ amount manufactured anywhere (desktop + mobile)");
  assert.ok(html.includes(MSG_UNAVAILABLE), "no-price-yet notice");
  assert.equal(html.includes("-—"), false, "discount never renders -—");
});

test("5. error totals render dashes and the safe calculation-failed notice", () => {
  const html = shell(T({ state: "error" }));
  assert.ok(html.includes("—"));
  assert.equal(html.includes("¥"), false, "no ¥ on error");
  assert.ok(html.includes(MSG_ERROR), "calculation-failed notice");
});

test("6. partial state shows the engine numbers but is clearly marked not-final", () => {
  const html = shell(T({ subtotal: 10000, discount: 0, tax: 1000, total: 11000, state: "partial" }));
  assert.ok(html.includes("¥10,000"), "priced-subset numbers shown");
  assert.ok(html.includes("¥11,000"));
  assert.ok(html.includes(MSG_PARTIAL), "provisional / not-final notice");
});

test("7. complete numeric totals render normally with no state notice", () => {
  const html = shell(T({ subtotal: 10000, discount: 500, tax: 950, total: 10450, state: "complete" }));
  assert.ok(html.includes("¥10,000") && html.includes("¥10,450"));
  assert.ok(html.includes("-¥500"), "discount shown as -¥N");
  for (const m of [MSG_PARTIAL, MSG_UNAVAILABLE, MSG_ERROR]) assert.equal(html.includes(m), false, "no notice when complete");
});

test("8. a genuine engine-computed zero renders ¥0 (not a dash)", () => {
  const html = shell(T({ subtotal: 0, discount: 0, tax: 0, total: 0, state: "complete" }));
  assert.ok(html.includes("¥0"), "real zero shows ¥0");
  assert.equal(html.includes("—"), false, "zero is not a dash");
});

test("9. mobile and desktop total displays follow the same null rule", () => {
  // complete: total ¥11,000 appears in BOTH the desktop sticky panel and the mobile bottom bar.
  const complete = shell(T({ subtotal: 10000, discount: 0, tax: 1000, total: 11000, state: "complete" }));
  assert.ok((complete.match(/¥11,000/g) ?? []).length >= 2, "total shown on both desktop and mobile");
  // unavailable: neither display manufactures a number.
  const unavailable = shell(T({ state: "unavailable" }));
  assert.equal(unavailable.includes("¥"), false, "both displays show — for null");
});

// ── 10. pricing inputs/results never enter business state ──────────────────────────

test("10. the host stores no pricing input/result in WizardStore / draft / hook state", () => {
  const code = codeOf(HOST_SRC);
  assert.equal(/useState|useReducer/.test(code), false, "host holds no local state");
  assert.equal(/updateStore\(/.test(code), false, "host never writes services/draft");
  assert.match(code, /useWizardPricingFromConfig\(\s*api\.draft/, "draft is read-only input to pricing");
  assert.match(code, /const\s+totals:\s*WizardTotals\s*=\s*\{/, "result projected into a local view, not stored");
});

// ── 11. no fixture/default pricing dependency in the candidate host path ───────────

test("11. host + shell + contract contain no fixture/default pricing dependency", () => {
  for (const src of [HOST_SRC, SHELL_SRC, CONTRACT_SRC]) {
    const code = codeOf(src);
    assert.equal(/DEFAULT_PRICING_CATALOG/.test(code), false, `${src}: no DEFAULT_PRICING_CATALOG`);
    assert.equal(/FIXTURE_PRESENTATION_METADATA/.test(code), false, `${src}: no fixture metadata`);
    assert.equal(/wizard-catalog-fixtures/.test(code), false, `${src}: no catalog fixtures`);
    assert.equal(/buildWizardPricingInput(?!FromConfig)/.test(code), false, `${src}: no fixture input adapter`);
    assert.equal(/wizard-manual-pricing(?!-config)/.test(code), false, `${src}: no fixture manual pricing`);
    assert.equal(/useWizardPricing(?!FromConfig)/.test(code), false, `${src}: no legacy pricing hook`);
    assert.equal(/ScreensPreview/.test(code), false, `${src}: no ScreensPreview`);
    assert.equal(/production\/EstimateWizardContainer/.test(code), false, `${src}: no production container`);
    assert.equal(/getDealerPricingCatalog/.test(code), false, `${src}: no fail-open reader`);
  }
  // WizardShell is presentation-only: no pricing engine/adapter/catalog/DB/server import.
  const shellCode = codeOf(SHELL_SRC);
  assert.equal(/pricing-engine|pricing-input-adapter|wizard-pricing-result-adapter|@\/lib\/pricing|supabase|server-only/.test(shellCode), false, "shell imports no pricing/DB/server module");
});

// ── binding smoke: the real host mounts with the four inputs and renders fail-closed ──

const SC: WizardScreenConfiguration = {
  filmTypes: [], windowAreas: [], maintenanceMenus: [], washMenus: [], roomMenus: [],
  otherWorkPresets: [], storeGlobalOptions: [], coupons: [], ppfMethods: [], ppfParts: [], ppfTypeGroups: [],
};
const PC: ProductionPricingConfiguration = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
};

test("binding smoke: EstimateWizard mounts with all four inputs and shows the fail-closed unavailable state", () => {
  const html = render(
    <EstimateWizard shopRank="detailer" screenConfig={SC} catalog={makePricingCatalog()} pricingConfig={PC} />,
  );
  assert.ok(html.length > 0, "host renders");
  assert.ok(html.includes(MSG_UNAVAILABLE), "empty draft → unavailable notice (pricing hook is wired)");
  assert.equal(html.includes("¥"), false, "no manufactured ¥ for the empty draft");
});
