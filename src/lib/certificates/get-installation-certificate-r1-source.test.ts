// Run with: node --experimental-test-module-mocks --import tsx --test <this file>

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, beforeEach, describe, it, mock } from "node:test";

interface Scenario {
  shared?: unknown;
  upstreamThrows?: boolean;
  clientThrows?: boolean;
  enrichment?: unknown;
  enrichmentError?: { message: string } | null;
}

interface Recorded {
  upstreamIds: string[];
  tables: string[];
  selects: string[];
  eqs: Array<[string, unknown]>;
  maybeSingleCalls: number;
}

let scenario: Scenario = {};
let recorded: Recorded;

const DEALER = "22222222-2222-4222-8222-222222222222";
const REPORT = "33333333-3333-4333-8333-333333333333";
const WORK_ORDER = "44444444-4444-4444-8444-444444444444";

const readyShared = () => ({
  ready: true as const,
  data: {
    report: { id: REPORT, dealer_id: DEALER, work_order_id: WORK_ORDER },
    workOrder: {
      id: WORK_ORDER,
      work_order_number: "WO-00001",
      title: "施工",
      actual_start_at: "2026-09-15T00:00:00.000Z",
      actual_end_at: "2026-09-15T10:00:00.000Z",
      assigned_staff: "西川 敦司",
    },
    customer: { last_name: "石井", first_name: "紗也華" },
    vehicle: { maker: "Ferrari", model: "458 Italia", plate_number: "名古屋 300" },
    items: [
      { category: "coating", item_name: "Q² CanCoat EVO", description: null, sort_order: 1 },
    ],
  },
});

const validEnrichment = () => ({
  customers: { last_name: "石井", first_name: "紗也華", is_business: false },
  vehicles: {
    maker: "Ferrari",
    model: "458 Italia",
    year: "2015",
    grade: "Base",
    vin: "ZFF67N",
    plate_number: "名古屋 300",
    color: "赤",
  },
});

function reset(): void {
  recorded = { upstreamIds: [], tables: [], selects: [], eqs: [], maybeSingleCalls: 0 };
}

reset();

// Node 26 uses `exports`; the installed Node 20 declarations still describe
// `namedExports`. Reflect.apply keeps the runtime current without suppressing
// type errors or retaining the deprecated option.
function mockModule(specifier: string, moduleExports: Record<string, unknown>): void {
  Reflect.apply(mock.module, mock, [specifier, { exports: moduleExports }]);
}

mockModule("@/lib/completion-reports/get-completion-report", {
  getWorkReportSource: async (id: string) => {
    recorded.upstreamIds.push(id);
    if (scenario.upstreamThrows) throw new Error("private upstream error with row details");
    return scenario.shared ?? readyShared();
  },
});

mockModule("@/lib/supabase/server", {
  createClient: async () => {
    if (scenario.clientThrows) throw new Error("private client error with SQL details");
    return {
      from(table: string) {
        recorded.tables.push(table);
        const builder = {
          select(columns: string) {
            recorded.selects.push(columns);
            return builder;
          },
          eq(column: string, value: unknown) {
            recorded.eqs.push([column, value]);
            return builder;
          },
          async maybeSingle() {
            recorded.maybeSingleCalls += 1;
            return {
              data: scenario.enrichment === undefined ? validEnrichment() : scenario.enrichment,
              error: scenario.enrichmentError ?? null,
            };
          },
        };
        return builder;
      },
    };
  },
});

type SourceModule = typeof import("./get-installation-certificate-r1-source");
let getInstallationCertificateR1Source: SourceModule["getInstallationCertificateR1Source"];

before(async () => {
  ({ getInstallationCertificateR1Source } = await import("./get-installation-certificate-r1-source"));
});

beforeEach(() => {
  scenario = {};
  reset();
});

describe("getInstallationCertificateR1Source", () => {
  it("rejects a blank request before calling the shared source", async () => {
    assert.deepEqual(await getInstallationCertificateR1Source("  "), { kind: "invalid_request" });
    assert.equal(recorded.upstreamIds.length, 0);
    assert.equal(recorded.tables.length, 0);
  });

  it("maps unauthenticated and stops before enrichment", async () => {
    scenario.shared = { ready: false, reasons: ["unauthenticated"] };
    assert.deepEqual(await getInstallationCertificateR1Source(REPORT), { kind: "unauthenticated" });
    assert.equal(recorded.upstreamIds.length, 1);
    assert.equal(recorded.tables.length, 0);
  });

  it("calls getWorkReportSource exactly once with the trimmed ID", async () => {
    const result = await getInstallationCertificateR1Source(`  ${REPORT}  `);
    assert.equal(result.kind, "ok");
    assert.deepEqual(recorded.upstreamIds, [REPORT]);
  });

  it("makes foreign and missing shared records indistinguishable", async () => {
    scenario.shared = { ready: false, reasons: ["tenant-mismatch"] };
    assert.deepEqual(await getInstallationCertificateR1Source(REPORT), { kind: "not_found" });

    scenario.shared = readyShared();
    scenario.enrichment = null;
    reset();
    assert.deepEqual(await getInstallationCertificateR1Source(REPORT), { kind: "not_found" });
  });

  it("passes shared non-tenant eligibility reasons through unchanged", async () => {
    const reasons = ["work-order-not-completed", "snapshot-unconfirmed"] as const;
    scenario.shared = { ready: false, reasons };
    assert.deepEqual(await getInstallationCertificateR1Source(REPORT), {
      kind: "not_eligible",
      reasons,
    });
    assert.equal(recorded.tables.length, 0);
  });

  it("enriches only the proven dealer and work order with allowed display columns", async () => {
    const result = await getInstallationCertificateR1Source(REPORT);
    assert.equal(result.kind, "ok");
    assert.deepEqual(recorded.tables, ["work_orders"]);
    assert.deepEqual(recorded.eqs, [["id", WORK_ORDER], ["dealer_id", DEALER]]);
    assert.equal(recorded.maybeSingleCalls, 1);

    const selection = recorded.selects.join(" ").replace(/\s+/g, " ");
    for (const allowed of [
      "last_name", "first_name", "is_business", "maker", "model", "year", "grade", "vin",
      "plate_number", "color",
    ]) assert.equal(selection.includes(allowed), true, allowed);
    for (const forbidden of [
      "estimate", "quantity", "price", "tax", "discount", "total", "cost", "margin", "payment",
      "invoice", "memo", "message", "notes", "warranty",
    ]) assert.equal(selection.toLowerCase().includes(forbidden), false, forbidden);
  });

  it("runs projection only after valid enrichment and retains CanCoat without warranty data", async () => {
    const result = await getInstallationCertificateR1Source(REPORT);
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.equal(result.projection.documentClass, "installation-certificate-r1");
    assert.equal(result.projection.items[0]?.name, "Q² CanCoat EVO");
    assert.equal(JSON.stringify(result).toLowerCase().includes("warranty"), false);

    scenario.enrichment = { customers: null, vehicles: validEnrichment().vehicles };
    reset();
    assert.deepEqual(await getInstallationCertificateR1Source(REPORT), { kind: "not_found" });
  });

  it("returns certificate-specific failures only after shared source and enrichment succeed", async () => {
    scenario.enrichment = {
      customers: { last_name: "", first_name: null, is_business: false },
      vehicles: validEnrichment().vehicles,
    };
    const result = await getInstallationCertificateR1Source(REPORT);
    assert.deepEqual(result, { kind: "not_eligible", reasons: ["missing-customer-name"] });
    assert.equal(recorded.upstreamIds.length, 1);
    assert.equal(recorded.maybeSingleCalls, 1);
  });

  it("sanitizes thrown and Supabase errors", async () => {
    scenario.upstreamThrows = true;
    assert.deepEqual(await getInstallationCertificateR1Source(REPORT), { kind: "not_found" });

    scenario = { shared: readyShared(), enrichmentError: { message: "secret SQL and row payload" } };
    reset();
    const result = await getInstallationCertificateR1Source(REPORT);
    assert.deepEqual(result, { kind: "not_found" });
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });

  it("contains no mutation, privileged client, Storage, estimate, warranty, or payload logging path", () => {
    const source = readFileSync(
      "src/lib/certificates/get-installation-certificate-r1-source.ts",
      "utf8",
    );
    for (const forbidden of [
      ".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", ".upload(", "service_role",
      "estimate_items", "estimateItems", ".storage", "CertificateDocumentData", "filmWarranty",
      "console.log", "console.error", "console.warn",
    ]) assert.equal(source.includes(forbidden), false, forbidden);
  });
});
