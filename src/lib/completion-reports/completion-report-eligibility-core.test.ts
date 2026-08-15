// GDA-1W-C3 — Pure tests for the work-report eligibility core (contract §8).
//
// Plain `node:test` + `node:assert/strict` (run with `node --import tsx --test
// <file>`). No I/O, no mocks — the core is a pure judgment over facts, so
// every case is a plain object. `assert.deepEqual` on the WHOLE result pins
// both the reason SET and the deterministic reason ORDER.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  evaluateWorkReportEligibility,
  type WorkReportEligibilityFacts,
} from "./completion-report-eligibility-core";

const DEALER   = "22222222-2222-4222-8222-222222222222";
const OTHER    = "99999999-9999-4999-8999-999999999999";
const USER     = "11111111-1111-4111-8111-111111111111";
const REPORT   = "44444444-4444-4444-8444-444444444444";
const ORDER    = "33333333-3333-4333-8333-333333333333";
const CUSTOMER = "55555555-5555-4555-8555-555555555555";
const VEHICLE  = "66666666-6666-4666-8666-666666666666";

/** A fully eligible fact set; each test perturbs exactly what it names. */
function readyFacts(): WorkReportEligibilityFacts {
  return {
    actor: { userId: USER, dealerId: DEALER },
    report: {
      id: REPORT,
      dealer_id: DEALER,
      work_order_id: ORDER,
      status: "draft",
      report_number: "REP-00001",
      report_date: "2026-08-10",
      performed_work_confirmed_at: "2026-08-10T03:05:00.000Z",
      performed_work_version: 1,
    },
    workOrder: {
      id: ORDER,
      dealer_id: DEALER,
      status: "completed",
      actual_end_at: "2026-08-10T03:04:05.678Z",
      customer_id: CUSTOMER,
      vehicle_id: VEHICLE,
    },
    customer: { id: CUSTOMER, dealer_id: DEALER },
    vehicle:  { id: VEHICLE,  dealer_id: DEALER },
    estimate: null,
    canonicalReportId: REPORT,
    confirmedItems: [{ category: "コーティング", item_name: "GYEON施工" }],
  };
}

// ─── Fully eligible ──────────────────────────────────────────────────────────

describe("fully eligible", () => {
  it("is ready with no linked estimate — absence of an estimate never blocks (§3.4)", () => {
    assert.deepEqual(evaluateWorkReportEligibility(readyFacts()), { ready: true });
  });

  it("is ready with a coherently bound linked estimate", () => {
    const facts = {
      ...readyFacts(),
      estimate: { dealer_id: DEALER, customer_id: CUSTOMER, vehicle_id: VEHICLE },
    };
    assert.deepEqual(evaluateWorkReportEligibility(facts), { ready: true });
  });

  it("is ready for every non-archived report status", () => {
    for (const status of ["draft", "generated", "shared"]) {
      const facts = readyFacts();
      assert.deepEqual(
        evaluateWorkReportEligibility({ ...facts, report: { ...facts.report!, status } }),
        { ready: true },
      );
    }
  });
});

// ─── unauthenticated: short-circuits everything ──────────────────────────────

describe("unauthenticated", () => {
  it("null/blank user or dealer yields ONLY unauthenticated, hiding every other fact", () => {
    const variants = [
      { userId: null, dealerId: DEALER },
      { userId: "  ", dealerId: DEALER },
      { userId: USER, dealerId: null },
      { userId: USER, dealerId: "" },
    ];
    for (const actor of variants) {
      // Pair the missing actor with OTHERWISE BROKEN facts: none of those
      // reasons may appear for an unauthenticated caller.
      const result = evaluateWorkReportEligibility({
        ...readyFacts(),
        actor,
        report: null,
        confirmedItems: null,
      });
      assert.deepEqual(result, { ready: false, reasons: ["unauthenticated"] });
    }
  });
});

// ─── Single-reason pins ──────────────────────────────────────────────────────

describe("tenant-mismatch", () => {
  it("fires for each cross-dealer or broken binding, alone when all else is valid", () => {
    const base = readyFacts();
    const mutations: Array<Partial<WorkReportEligibilityFacts>> = [
      { report:    { ...base.report!,    dealer_id: OTHER } },
      { workOrder: { ...base.workOrder!, dealer_id: OTHER } },
      { customer:  { id: CUSTOMER, dealer_id: OTHER } },
      { vehicle:   { id: VEHICLE,  dealer_id: OTHER } },
      { report:    { ...base.report!,    work_order_id: OTHER } },     // report -> wrong order
      { workOrder: { ...base.workOrder!, customer_id: OTHER } },       // order -> wrong customer
      { workOrder: { ...base.workOrder!, vehicle_id: OTHER } },        // order -> wrong vehicle
      { estimate:  { dealer_id: OTHER, customer_id: CUSTOMER, vehicle_id: VEHICLE } },
      { estimate:  { dealer_id: DEALER, customer_id: OTHER,   vehicle_id: VEHICLE } },
      { estimate:  { dealer_id: DEALER, customer_id: CUSTOMER, vehicle_id: OTHER } },
      { customer:  null },
      { vehicle:   null },
    ];
    for (const mutation of mutations) {
      const result = evaluateWorkReportEligibility({ ...base, ...mutation });
      assert.equal(result.ready, false);
      if (!result.ready) {
        assert.deepEqual(result.reasons, ["tenant-mismatch"]);
      }
    }
  });
});

describe("not-canonical", () => {
  it("fires when the independently resolved canonical id differs or is absent", () => {
    for (const canonicalReportId of [OTHER, null]) {
      assert.deepEqual(
        evaluateWorkReportEligibility({ ...readyFacts(), canonicalReportId }),
        { ready: false, reasons: ["not-canonical"] },
      );
    }
  });
});

describe("work-order-not-completed", () => {
  it("fires for every non-completed status and for a null actual end", () => {
    const base = readyFacts();
    const orders = [
      { ...base.workOrder!, status: "scheduled" },
      { ...base.workOrder!, status: "in_progress" },
      { ...base.workOrder!, status: "on_hold" },
      { ...base.workOrder!, status: "cancelled" },
      { ...base.workOrder!, actual_end_at: null },
    ];
    for (const workOrder of orders) {
      assert.deepEqual(evaluateWorkReportEligibility({ ...base, workOrder }), {
        ready: false,
        reasons: ["work-order-not-completed"],
      });
    }
  });
});

describe("missing number and date", () => {
  it("null/blank report_number yields exactly missing-report-number", () => {
    const base = readyFacts();
    for (const report_number of [null, "  "]) {
      assert.deepEqual(
        evaluateWorkReportEligibility({ ...base, report: { ...base.report!, report_number } }),
        { ready: false, reasons: ["missing-report-number"] },
      );
    }
  });

  it("null report_date yields exactly missing-report-date", () => {
    const base = readyFacts();
    assert.deepEqual(
      evaluateWorkReportEligibility({ ...base, report: { ...base.report!, report_date: null } }),
      { ready: false, reasons: ["missing-report-date"] },
    );
  });
});

describe("snapshot-unconfirmed (legacy rows)", () => {
  it("fires for null confirmation, null version, zero, negative, and fractional versions", () => {
    const base = readyFacts();
    const reports = [
      { ...base.report!, performed_work_confirmed_at: null },
      { ...base.report!, performed_work_version: null },
      { ...base.report!, performed_work_version: 0 },
      { ...base.report!, performed_work_version: -1 },
      { ...base.report!, performed_work_version: 1.5 },
    ];
    for (const report of reports) {
      assert.deepEqual(evaluateWorkReportEligibility({ ...base, report }), {
        ready: false,
        reasons: ["snapshot-unconfirmed"],
      });
    }
  });

  it("a fully legacy row (both confirmation fields null) is unconfirmed, never converted", () => {
    const base = readyFacts();
    assert.deepEqual(
      evaluateWorkReportEligibility({
        ...base,
        report: {
          ...base.report!,
          performed_work_confirmed_at: null,
          performed_work_version: null,
        },
      }),
      { ready: false, reasons: ["snapshot-unconfirmed"] },
    );
  });
});

describe("snapshot-empty", () => {
  it("fires for null, empty, and all-blank item sets", () => {
    const base = readyFacts();
    const itemSets = [
      null,
      [],
      [{ category: "", item_name: "GYEON施工" }],
      [{ category: "コーティング", item_name: "  " }],
      [
        { category: "", item_name: "" },
        { category: " ", item_name: " " },
      ],
    ];
    for (const confirmedItems of itemSets) {
      assert.deepEqual(evaluateWorkReportEligibility({ ...base, confirmedItems }), {
        ready: false,
        reasons: ["snapshot-empty"],
      });
    }
  });

  it("one valid item among blanks satisfies the at-least-one rule", () => {
    const base = readyFacts();
    assert.deepEqual(
      evaluateWorkReportEligibility({
        ...base,
        confirmedItems: [
          { category: "", item_name: "" },
          { category: "洗車", item_name: "wash" },
        ],
      }),
      { ready: true },
    );
  });
});

describe("archived", () => {
  it("an archived report is not renderable even when everything else is valid", () => {
    const base = readyFacts();
    assert.deepEqual(
      evaluateWorkReportEligibility({ ...base, report: { ...base.report!, status: "archived" } }),
      { ready: false, reasons: ["archived"] },
    );
  });
});

// ─── No estimate rescue ──────────────────────────────────────────────────────

describe("estimate data cannot rescue eligibility", () => {
  it("a perfectly bound estimate does not substitute for a missing snapshot", () => {
    // The linked estimate is coherent and (conceptually) full of items — but
    // the CONFIRMED snapshot is absent. §3.2/§8: no estimate fallback exists;
    // the fact shape cannot even carry estimate items into the judgment.
    const base = readyFacts();
    const result = evaluateWorkReportEligibility({
      ...base,
      estimate: { dealer_id: DEALER, customer_id: CUSTOMER, vehicle_id: VEHICLE },
      report: {
        ...base.report!,
        performed_work_confirmed_at: null,
        performed_work_version: null,
      },
      confirmedItems: null,
    });
    assert.deepEqual(result, {
      ready: false,
      reasons: ["snapshot-unconfirmed", "snapshot-empty"],
    });
  });

  it("an estimate can only HURT (mismatch) or be neutral — never add readiness", () => {
    const withEstimate = evaluateWorkReportEligibility({
      ...readyFacts(),
      estimate: { dealer_id: DEALER, customer_id: CUSTOMER, vehicle_id: VEHICLE },
    });
    const withoutEstimate = evaluateWorkReportEligibility(readyFacts());
    assert.deepEqual(withEstimate, withoutEstimate);
  });
});

// ─── Deterministic multi-reason accumulation ─────────────────────────────────

describe("deterministic multi-reason order", () => {
  it("a null report accumulates every report-dependent reason in the fixed order", () => {
    const result = evaluateWorkReportEligibility({ ...readyFacts(), report: null });
    assert.deepEqual(result, {
      ready: false,
      reasons: [
        "tenant-mismatch",
        "not-canonical",
        "missing-report-number",
        "missing-report-date",
        "snapshot-unconfirmed",
      ],
    });
  });

  it("a broken order + empty snapshot + archived report lists all reasons, ordered", () => {
    const base = readyFacts();
    const result = evaluateWorkReportEligibility({
      ...base,
      workOrder: { ...base.workOrder!, status: "in_progress", actual_end_at: null },
      report: { ...base.report!, status: "archived" },
      confirmedItems: [],
    });
    assert.deepEqual(result, {
      ready: false,
      reasons: ["work-order-not-completed", "snapshot-empty", "archived"],
    });
  });

  it("the same facts always produce the identical result object shape", () => {
    const facts = { ...readyFacts(), report: null, confirmedItems: null };
    assert.deepEqual(
      evaluateWorkReportEligibility(facts),
      evaluateWorkReportEligibility(facts),
    );
  });
});
