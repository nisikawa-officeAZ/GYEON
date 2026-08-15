// TEMPLATE-B2 source-boundary tests for the Chromium estimate binding.
//
// These pin the security and design contracts at the SOURCE level:
//  - the vendored template is offline (no Google Fonts, no CDN, no http(s) asset references),
//  - preview-only material (OFFICE AZ fixtures, brand-profiles.json, sample QR files,
//    URL-controlled preview parameters, stress fixtures) never entered the repository,
//  - pagination stays measurement-based (no fixed row capacities),
//  - the renderer keeps its exported signature, uses the Chromium foundation, and never imports
//    the protected wizard path or accepts client-supplied dealer identity.
//
// Run: node --import tsx --test src/lib/pdf/__tests__/template-b2/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DESIGN = path.join(ROOT, "src/lib/pdf/design/premium");
const CHROMIUM = path.join(ROOT, "src/lib/pdf/chromium-document");
const RENDERER = path.join(ROOT, "src/lib/pdf/render-estimate-document.tsx");

const read = (p: string) => readFileSync(p, "utf8");

function walkTextFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkTextFiles(p));
    else if (/\.(html|css|js|ts|tsx|svg|json)$/.test(entry)) out.push(p);
  }
  return out;
}

const designTextFiles = () => walkTextFiles(DESIGN).filter((p) => !p.includes(`${path.sep}fonts${path.sep}files${path.sep}`));

test("B2-1 vendored design contains no OFFICE AZ fixture data or preview brand profile", () => {
  for (const p of designTextFiles()) {
    const body = read(p).toLowerCase();
    for (const needle of ["office az", "office-az", "officeaz", "brand-profiles"]) {
      assert.ok(!body.includes(needle), `${p} contains forbidden preview fixture marker "${needle}"`);
    }
  }
  assert.ok(!existsSync(path.join(DESIGN, "assets/brands")), "preview brand asset directory must not be vendored");
  assert.ok(!existsSync(path.join(DESIGN, "assets/qr-live")), "sample QR directory must not be vendored");
  assert.ok(!existsSync(path.join(DESIGN, "doc-variant.js")), "preview doc-variant.js must not be vendored");
});

test("B2-2 vendored design is offline: no Google Fonts, no http(s) fetchable references", () => {
  for (const p of designTextFiles()) {
    const body = read(p);
    assert.ok(!body.includes("fonts.googleapis"), `${p} references Google Fonts`);
    assert.ok(!/url\(\s*['"]?https?:/i.test(body), `${p} contains a remote CSS url()`);
    assert.ok(!/src="https?:/i.test(body), `${p} contains a remote src attribute`);
    assert.ok(!/\bfetch\s*\(/.test(body) || p.endsWith(".ts"), `${p} contains a runtime fetch`);
    assert.ok(!body.includes("qr-live"), `${p} still references sample QR images`);
  }
});

test("B2-3 doc-tokens.css carries the accepted B1-R1 Japanese numeric-stack fix and local fonts", () => {
  const tokens = read(path.join(DESIGN, "doc-tokens.css"));
  assert.ok(
    tokens.includes("--doc-font-num:     'Geist', 'Noto Sans JP', ui-monospace, 'SF Mono', Menlo, monospace;"),
    "the exact accepted --doc-font-num stack (Geist + Noto Sans JP fallback) is required",
  );
  assert.ok(tokens.includes("@import url('./fonts.css');"), "doc-tokens must import the local fonts.css");
  const fonts = read(path.join(DESIGN, "fonts.css"));
  for (const family of ["'Geist'", "'Noto Sans JP'", "'Noto Serif JP'"]) {
    assert.ok(fonts.includes(`font-family: ${family}`), `fonts.css must declare ${family}`);
  }
  assert.ok(!fonts.includes("http"), "fonts.css must reference only local files");
  const files = readdirSync(path.join(DESIGN, "fonts/files")).filter((f) => f.endsWith(".woff2"));
  assert.ok(files.length > 1000, `expected the full self-hosted woff2 set, found ${files.length}`);
});

test("B2-4 pagination is measurement-based: no fixed capacities, no preview URL parameters", () => {
  const paginate = read(path.join(DESIGN, "estimate-paginate.js"));
  assert.ok(!/CAPACITY_/i.test(paginate), "fixed capacity constants are forbidden");
  assert.ok(!paginate.includes("searchParams"), "URL-controlled preview parameters are forbidden");
  assert.ok(!/stress/i.test(paginate), "stress fixtures are forbidden");
  assert.ok(paginate.includes("scrollHeight <= page.clientHeight"), "DOM-measurement fit check must remain");
  assert.ok(paginate.includes("document.fonts.ready"), "pagination must wait for document.fonts.ready");
  for (const p of designTextFiles()) {
    assert.ok(!/CAPACITY_(FINAL|CONT)/.test(read(p)), `${p} contains fixed pagination capacities`);
  }
});

test("B2-5 doc-brand.js binds only the injected server context (no fetch, no URL params)", () => {
  const brand = read(path.join(DESIGN, "doc-brand.js"));
  assert.ok(!brand.includes("fetch("), "doc-brand must not fetch anything");
  assert.ok(!brand.includes("searchParams"), "doc-brand must not read URL parameters");
  assert.ok(brand.includes("__DEALER_OS_DOC_CONTEXT__"), "doc-brand must read the injected context");
});

test("B2-6 doc-data.js binds via textContent only and fails closed", () => {
  const data = read(path.join(DESIGN, "doc-data.js"));
  assert.ok(!data.includes("innerHTML"), "document data must never be bound through innerHTML");
  assert.ok(data.includes("data-doc-data-error"), "binding must mark failure for the fail-closed renderer gate");
  assert.ok(data.includes("data-doc-data-ready"), "binding must mark completion");
});

test("B2-7 renderer keeps the exported signature and the offline Chromium foundation", () => {
  const renderer = read(RENDERER);
  assert.ok(
    renderer.includes("export async function renderEstimateDocumentPdf(estimate: EstimateDB, brand: BrandProfile): Promise<Buffer>"),
    "the exported renderer signature must be unchanged",
  );
  assert.ok(!renderer.includes("@react-pdf/renderer"), "the estimate renderer no longer uses react-pdf");
  assert.ok(renderer.includes("renderChromiumDocumentPdf"), "the renderer must delegate to the Chromium foundation");
  assert.ok(renderer.includes("toEstimateDocumentData"), "the persisted-snapshot adapter must remain the ONLY data source");

  const core = read(path.join(CHROMIUM, "chromium-renderer.ts"));
  assert.ok(core.includes('"@sparticuz/chromium"') || core.includes("'@sparticuz/chromium'"), "serverless chromium required");
  assert.ok(core.includes("blockedbyclient"), "http/https interception must abort requests");
  assert.ok(core.includes("offline boundary violated"), "renderer must fail closed on any outbound attempt");
  assert.ok(core.includes('format: "A4"') && core.includes("printBackground: true") && core.includes("preferCSSPageSize: true"), "accepted PDF options required");
});

test("B2-8 no client-supplied dealer identity and no protected-path dependency", () => {
  const sources = [RENDERER, ...walkTextFiles(CHROMIUM)];
  for (const p of sources) {
    const body = stripComments(read(p));
    assert.ok(!body.includes("ScreensPreview"), `${p} must not reference the protected wizard path`);
    // legacy-branding-logo.ts is the ONE exempted file: its dealerId parameter is the
    // server-resolved argument from getDealerBranding (never client input), and tests R1-4/R1-8
    // pin that the URL can never redirect it to another dealer's object.
    if (!p.endsWith("legacy-branding-logo.ts")) {
      assert.ok(!/dealer_?id/i.test(body), `${p} must not accept or thread a dealer id — identity comes from BrandProfile only`);
    }
    assert.ok(!body.includes('"use client"'), `${p} must not be a client module`);
  }
  const ctx = stripComments(read(path.join(CHROMIUM, "estimate-document-context.ts")));
  assert.ok(!/https?:/.test(ctx), "context builder must not reference remote URLs");
});

/** Strip // and block comments so prose naming a forbidden symbol never reads as a violation. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("B2-9 internal_memo and margin/cost fields are unreachable from the binding chain", () => {
  const chain = [RENDERER, path.join(CHROMIUM, "estimate-document-context.ts"), path.join(DESIGN, "doc-data.js")];
  for (const p of chain) {
    const body = stripComments(read(p));
    assert.ok(!body.includes("internal_memo") && !body.includes("internalMemo"), `${p} must not touch internal_memo`);
    assert.ok(!/\bmargin\b/i.test(body), `${p} must not touch margin fields`);
    assert.ok(!/dealer_?cost/i.test(body), `${p} must not touch dealer cost`);
  }
});

test("B2-10 the three existing estimate callers are untouched by this binding", () => {
  const route = read(path.join(ROOT, "src/app/pdf/estimate/route.ts"));
  const gen = read(path.join(ROOT, "src/lib/pdf/generate-estimate-pdf.ts"));
  const snap = read(path.join(ROOT, "src/lib/pdf/generate-estimate-snapshot-pdf.ts"));
  for (const [name, body] of [["route", route], ["generate", gen], ["snapshot", snap]] as const) {
    assert.ok(body.includes("renderEstimateDocumentPdf"), `${name} must still call the single renderer`);
    assert.ok(!body.includes("chromium"), `${name} must not know about the Chromium foundation directly`);
  }
});

/* ── TEMPLATE-B2-R1: legacy store-logo bridge ─────────────────────────────────────────────── */

import { parseLegacyBrandingLogoUrl, LEGACY_LOGO_MAX_BYTES } from "../../chromium-document/legacy-branding-logo";
import { brandingStoragePath, BRANDING_BUCKET } from "@/lib/branding/branding-types";

const PROJECT = "https://vhiuiwolnlvlwvoaingd.supabase.co";
const DEALER_A = "11111111-2222-4333-8444-555555555555";
const DEALER_B = "99999999-8888-4777-8666-555555555555";
const canonicalUrl = (dealer: string, project = PROJECT) =>
  `${project}/storage/v1/object/public/${BRANDING_BUCKET}/${brandingStoragePath(dealer, "logo")}`;

test("R1-1 canonical same-project legacy URL resolves to the exact authenticated dealer logo path", () => {
  const path = parseLegacyBrandingLogoUrl(canonicalUrl(DEALER_A), DEALER_A, PROJECT);
  assert.equal(path, brandingStoragePath(DEALER_A, "logo"));
  assert.equal(path, `${DEALER_A}/branding/logo.png`);
});

test("R1-2 another Supabase project is rejected", () => {
  assert.equal(parseLegacyBrandingLogoUrl(canonicalUrl(DEALER_A, "https://otherproj.supabase.co"), DEALER_A, PROJECT), null);
  assert.equal(parseLegacyBrandingLogoUrl(canonicalUrl(DEALER_A), DEALER_A, "https://otherproj.supabase.co"), null);
  assert.equal(parseLegacyBrandingLogoUrl(canonicalUrl(DEALER_A).replace("https:", "http:"), DEALER_A, PROJECT), null);
});

test("R1-3 another bucket is rejected", () => {
  const other = `${PROJECT}/storage/v1/object/public/documents/${brandingStoragePath(DEALER_A, "logo")}`;
  assert.equal(parseLegacyBrandingLogoUrl(other, DEALER_A, PROJECT), null);
});

test("R1-4 dealer A cannot resolve dealer B's logo, and the returned path derives from dealerId alone", () => {
  assert.equal(parseLegacyBrandingLogoUrl(canonicalUrl(DEALER_B), DEALER_A, PROJECT), null);
  assert.equal(parseLegacyBrandingLogoUrl(canonicalUrl(DEALER_A), DEALER_B, PROJECT), null);
});

test("R1-5 traversal, encoded traversal, backslashes, and non-canonical paths are rejected", () => {
  const base = `${PROJECT}/storage/v1/object/public/${BRANDING_BUCKET}`;
  for (const bad of [
    `${base}/${DEALER_A}/branding/../branding/logo.png`,
    `${base}/${DEALER_A}/branding/%2e%2e/logo.png`,
    `${base}/${DEALER_A}%2Fbranding%2Flogo.png`,
    `${base}/${DEALER_A}\\branding\\logo.png`,
    `${base}/${DEALER_A}/branding/logo.png/`,
    `${base}/${DEALER_A}/branding/stamp.png`,
    `${base}//${DEALER_A}/branding/logo.png`,
    `${PROJECT}/storage/v1/object/sign/${BRANDING_BUCKET}/${DEALER_A}/branding/logo.png`,
  ]) {
    assert.equal(parseLegacyBrandingLogoUrl(bad, DEALER_A, PROJECT), null, `should reject: ${bad}`);
  }
});

test("R1-6 credentials, query strings, and fragments are rejected", () => {
  assert.equal(parseLegacyBrandingLogoUrl(canonicalUrl(DEALER_A).replace("https://", "https://user:pw@"), DEALER_A, PROJECT), null);
  assert.equal(parseLegacyBrandingLogoUrl(`${canonicalUrl(DEALER_A)}?download=1`, DEALER_A, PROJECT), null);
  assert.equal(parseLegacyBrandingLogoUrl(`${canonicalUrl(DEALER_A)}#x`, DEALER_A, PROJECT), null);
});

test("R1-7 arbitrary external http(s) URLs are rejected and the module has no network client", () => {
  for (const bad of ["https://example.com/logo.png", "http://evil.example/x.png", "https://cdn.example/dealer.png", "not a url", ""]) {
    assert.equal(parseLegacyBrandingLogoUrl(bad, DEALER_A, PROJECT), null);
  }
  const helper = read(path.join(CHROMIUM, "legacy-branding-logo.ts"));
  const code = stripComments(helper);
  for (const sym of ["fetch(", "undici", "http.request", "axios", "XMLHttpRequest"]) {
    assert.ok(!code.includes(sym), `legacy helper must not contain ${sym}`);
  }
});

test("R1-8 dealer-branding: logo_path stays first, legacy bridge is gated, no raw logo_url passthrough remains", () => {
  const src = read(path.join(ROOT, "src/lib/pdf/dealer-branding.ts"));
  const code = stripComments(src);
  assert.ok(!code.includes("logo = { src: (r.logo_url as string).trim() }"), "raw logo_url passthrough must be gone");
  const pathIdx = code.indexOf('select("logo_path")');
  const legacyIdx = code.indexOf("parseLegacyBrandingLogoUrl(");
  assert.ok(pathIdx !== -1 && legacyIdx !== -1 && pathIdx < legacyIdx, "logo_path resolution must precede the legacy bridge");
  assert.ok(code.includes("if (!logo)"), "legacy bridge must run only when logo_path produced nothing");
  assert.ok(code.includes("LEGACY_LOGO_MAX_BYTES"), "the 5 MiB maximum must gate the legacy download");
  assert.ok(code.includes(".download(legacyPath)"), "legacy bytes must come from the server-side Storage client");
  assert.ok(!code.includes("fetch("), "dealer-branding must not fetch over HTTP");
});

test("R1-9 every logo emitted by dealer-branding is a data URI (never an HTTP URL into Chromium)", () => {
  const code = stripComments(read(path.join(ROOT, "src/lib/pdf/dealer-branding.ts")));
  const assignments = code.match(/logo = \{ src: [^}]+\}/g) ?? [];
  assert.ok(assignments.length >= 2, "expected the logo_path and legacy-bridge assignments");
  for (const a of assignments) {
    assert.ok(a.includes("data:image/png;base64"), `logo assignment must embed bytes as a data URI: ${a}`);
  }
});

test("R1-10 limit constant matches the existing 5 MiB branding maximum", () => {
  assert.equal(LEGACY_LOGO_MAX_BYTES, 5 * 1024 * 1024);
});
