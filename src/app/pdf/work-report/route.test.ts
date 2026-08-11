// GDA-1W-C3 — Focused tests for the authenticated work-report PDF route.
//
// Plain `node:test` + `node:assert/strict`. The route's server dependencies —
// the request-scope dealer resolution, the ONE fail-closed loader, the brand
// profile, and the renderer — are replaced with `mock.module` fakes that
// RECORD every invocation. That record proves the boundary claims: the loader
// runs exactly once per request, the renderer receives EXACTLY the loader's
// eligible source (so an estimate-item substitute cannot exist on this path),
// and no other data source is consulted. The route imports no service-role
// client and no Storage module; nothing here uploads or mutates.
//
// NOTE for the separately authorized verification gate: `mock.module` requires
// Node's module-mock support (`--experimental-test-module-mocks` alongside
// `--import tsx --test`). These are module-boundary tests; the contract's
// genuine cookie-session evidence comes from the separately authorized
// disposable-stack phase, which these assertions supplement, never replace.

import { strict as assert } from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

// ── Scenario + call log ──────────────────────────────────────────────────────

interface Scenario {
  dealer: { dealer_id: string } | null;
  resolved: unknown;
  renderThrows?: boolean;
}

interface CallLog {
  loaderCalls: Array<{ dealerId: string; reportId: string }>;
  brandCalls: string[];
  renderCalls: unknown[];
}

let scenario: Scenario = { dealer: null, resolved: null };
let log: CallLog = { loaderCalls: [], brandCalls: [], renderCalls: [] };

const DEALER = "22222222-2222-4222-8222-222222222222";
const REPORT = "44444444-4444-4444-8444-444444444444";
const PDF_BYTES = Buffer.from("%PDF-1.7 fake");
const BRAND = { name: "GYEON Test" };

const eligibleSource = () => ({
  reportNumber: "REP-00001",
  reportDate: "2026-08-10",
  workDate: "2026-08-10T03:04:05.678Z",
  customerMessage: null,
  customer: { last_name: "山田", first_name: "太郎" },
  vehicle: { maker: "Toyota", model: "Prius", plate_number: null },
  items: [
    { category: "コーティング", item_name: "GYEON施工", description: null, sort_order: 0 },
  ],
});

// ── Module mocks, installed BEFORE the route is imported. ────────────────────

mock.module("@/lib/auth/get-current-dealer", {
  namedExports: {
    getCurrentDealer: async () => scenario.dealer,
  },
});

mock.module("@/lib/pdf/get-work-report-pdf-data", {
  namedExports: {
    getWorkReportPdfData: async (dealerId: string, reportId: string) => {
      log.loaderCalls.push({ dealerId, reportId });
      return scenario.resolved;
    },
  },
});

mock.module("@/lib/pdf/brand-profile", {
  namedExports: {
    getBrandProfile: async (dealerId: string) => {
      log.brandCalls.push(dealerId);
      return BRAND;
    },
  },
});

mock.module("@/lib/pdf/render-work-report-document", {
  namedExports: {
    renderWorkReportDocumentPdf: async (source: unknown, brand: unknown) => {
      log.renderCalls.push({ source, brand });
      if (scenario.renderThrows) throw new Error("secret internal renderer detail");
      return PDF_BYTES;
    },
  },
});

// The route loads AFTER the mock.module registrations above. A typed module
// variable initialized in a root `before` hook replaces the previous
// top-level `await import(...)`: CJS output (no "type": "module" in
// package.json) cannot contain top-level await, but the hook body may await,
// and node:test runs root `before` prior to every registered test.
let GET: typeof import("./route")["GET"];
before(async () => {
  ({ GET } = await import("./route"));
});

// The route reads only req.nextUrl.searchParams; a URL-bearing stub is a
// faithful NextRequest for this handler.
function request(query: string): Parameters<typeof GET>[0] {
  return { nextUrl: new URL(`https://app.test/pdf/work-report${query}`) } as Parameters<typeof GET>[0];
}

beforeEach(() => {
  scenario = { dealer: { dealer_id: DEALER }, resolved: null };
  log = { loaderCalls: [], brandCalls: [], renderCalls: [] };
});

// ── Authentication ───────────────────────────────────────────────────────────

describe("authentication", () => {
  it("401 with no dealer session, before the loader is ever consulted", async () => {
    scenario.dealer = null;
    const res = await GET(request(`?reportId=${REPORT}`));
    assert.equal(res.status, 401);
    assert.equal(await res.text(), "Unauthorized");
    assert.equal(log.loaderCalls.length, 0);
    assert.equal(log.renderCalls.length, 0);
  });

  it("401 when the loader's genuine request scope reports unauthenticated", async () => {
    scenario.resolved = { kind: "unauthenticated" };
    const res = await GET(request(`?reportId=${REPORT}`));
    assert.equal(res.status, 401);
    assert.equal(log.renderCalls.length, 0);
  });
});

// ── Input and not-found ──────────────────────────────────────────────────────

describe("input and not-found", () => {
  it("400 for a missing reportId without calling the loader", async () => {
    const res = await GET(request(""));
    assert.equal(res.status, 400);
    assert.equal(await res.text(), "reportId required");
    assert.equal(log.loaderCalls.length, 0);
  });

  it("400 when the loader classifies the id as invalid", async () => {
    scenario.resolved = { kind: "invalid_request" };
    const res = await GET(request("?reportId=%20"));
    // A whitespace id survives the route's presence check; the loader decides.
    assert.equal(res.status, 400);
  });

  it("404 for foreign/missing reports with a bare body — no reasons, no ownership hint", async () => {
    scenario.resolved = { kind: "not_found" };
    const res = await GET(request(`?reportId=${REPORT}`));
    assert.equal(res.status, 404);
    assert.equal(await res.text(), "Not found");
    assert.equal(log.renderCalls.length, 0);
  });
});

// ── 422: exact shared reasons ────────────────────────────────────────────────

describe("not eligible", () => {
  it("422 with EXACTLY the shared reason codes as JSON, private no-store, no PDF render", async () => {
    scenario.resolved = {
      kind: "not_eligible",
      reasons: ["work-order-not-completed", "snapshot-unconfirmed"],
    };
    const res = await GET(request(`?reportId=${REPORT}`));
    assert.equal(res.status, 422);
    assert.equal(res.headers.get("Content-Type"), "application/json; charset=utf-8");
    assert.equal(res.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await res.json(), {
      ready: false,
      reasons: ["work-order-not-completed", "snapshot-unconfirmed"],
    });
    assert.equal(log.renderCalls.length, 0);
    assert.equal(log.brandCalls.length, 0);
  });
});

// ── Eligible PDF ─────────────────────────────────────────────────────────────

describe("eligible PDF", () => {
  it("200 PDF: loader once with (dealer, report), renderer gets EXACTLY the loader source", async () => {
    const source = eligibleSource();
    scenario.resolved = { kind: "ok", source };
    const res = await GET(request(`?reportId=${REPORT}`));

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/pdf");
    assert.equal(res.headers.get("Cache-Control"), "private, no-store");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    assert.match(disposition, /REP-00001/);

    // Exactly ONE loader call, with the session dealer and the requested id.
    assert.deepEqual(log.loaderCalls, [{ dealerId: DEALER, reportId: REPORT }]);
    // The renderer receives the loader's source BY IDENTITY: nothing was
    // merged in, so an estimate-item substitute is unrepresentable here.
    assert.equal(log.renderCalls.length, 1);
    const call = log.renderCalls[0] as { source: unknown; brand: unknown };
    assert.equal(call.source, source);
    assert.equal(call.brand, BRAND);
    assert.deepEqual(log.brandCalls, [DEALER]);

    const body = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(body, PDF_BYTES);
  });

  it("download=1 switches to attachment disposition; the bytes are identical", async () => {
    scenario.resolved = { kind: "ok", source: eligibleSource() };
    const inline = await GET(request(`?reportId=${REPORT}`));
    const download = await GET(request(`?reportId=${REPORT}&download=1`));

    const inlineDisp = inline.headers.get("Content-Disposition") ?? "";
    const downloadDisp = download.headers.get("Content-Disposition") ?? "";
    assert.notEqual(inlineDisp, downloadDisp);
    assert.match(downloadDisp, /attachment/);
    assert.deepEqual(
      Buffer.from(await inline.arrayBuffer()),
      Buffer.from(await download.arrayBuffer()),
    );
  });
});

// ── Failure and leakage boundaries ───────────────────────────────────────────

describe("failure boundaries", () => {
  it("500 on renderer failure with the generic message — internal detail never leaks", async () => {
    scenario.resolved = { kind: "ok", source: eligibleSource() };
    scenario.renderThrows = true;
    const res = await GET(request(`?reportId=${REPORT}`));
    assert.equal(res.status, 500);
    const body = await res.text();
    assert.equal(body, "PDFの生成に失敗しました");
    assert.equal(body.includes("secret internal renderer detail"), false);
  });

  it("every non-ok outcome renders nothing and calls the loader exactly once", async () => {
    const outcomes: unknown[] = [
      { kind: "unauthenticated" },
      { kind: "invalid_request" },
      { kind: "not_found" },
      { kind: "not_eligible", reasons: ["archived"] },
    ];
    for (const resolved of outcomes) {
      log = { loaderCalls: [], brandCalls: [], renderCalls: [] };
      scenario = { dealer: { dealer_id: DEALER }, resolved };
      await GET(request(`?reportId=${REPORT}`));
      assert.equal(log.loaderCalls.length, 1);
      assert.equal(log.renderCalls.length, 0);
      assert.equal(log.brandCalls.length, 0);
    }
  });
});
