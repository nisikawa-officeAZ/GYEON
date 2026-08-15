// GDA-1W-C3 — Work-report eligibility — PURE CORE (accepted contract §8).
//
// No React, no server module, no Supabase, no DB, no clock, no randomness, no
// `any`, no I/O of any kind. The caller loads the facts; this module only
// judges them. It is the ONE eligibility contract consumed by BOTH the
// completion UI and the authenticated PDF route (the route remains the final
// authority because it re-loads the facts inside a genuine request scope) —
// the page displays the exact reasons this function returns, so a
// contradictory "PDF is preparing" message is structurally impossible.
//
// ── FAIL-CLOSED, NO FALLBACK ────────────────────────────────────────────────
// Every absent, null, or malformed fact makes the report NOT ready; nothing is
// coerced, defaulted, or repaired. In particular there is NO estimate-item
// fallback anywhere in this file: the confirmed `completion_report_items`
// snapshot is the only performed-work authority, and its absence is the
// 'snapshot-unconfirmed' / 'snapshot-empty' outcome, never a reason to read
// `estimate_items` (§3.2, §8).
//
// ── DETERMINISTIC REASONS ───────────────────────────────────────────────────
// All applicable reasons are collected (not just the first) in one fixed
// order, so UI and route always render identical, stable output for the same
// facts. 'unauthenticated' alone short-circuits: without a genuine actor and
// dealer context none of the other facts is trustworthy, and enumerating them
// would leak existence information to an unauthenticated caller.

import type {
  WorkReportEligibility,
  WorkReportNotReadyReason,
} from "./completion-report-types";

// ─── Fact shapes ─────────────────────────────────────────────────────────────
// Deliberately minimal structural picks: callers pass rows they already hold.
// Monetary fields are unrepresentable here — the item facts carry only the
// three snapshot fields.

/** The authenticated request context. Both must be genuine, server-resolved. */
export interface WorkReportActorFacts {
  readonly userId:   string | null;
  readonly dealerId: string | null;
}

export interface WorkReportReportFacts {
  readonly id:                          string;
  readonly dealer_id:                   string;
  readonly work_order_id:               string;
  readonly status:                      string;
  readonly report_number:               string | null;
  readonly report_date:                 string | null;
  readonly performed_work_confirmed_at: string | null;
  readonly performed_work_version:      number | null;
}

export interface WorkReportWorkOrderFacts {
  readonly id:            string;
  readonly dealer_id:     string;
  readonly status:        string;
  readonly actual_end_at: string | null;
  readonly customer_id:   string | null;
  readonly vehicle_id:    string | null;
}

/** Tenant facts for the customer/vehicle the work order references. */
export interface WorkReportPartyFacts {
  readonly id:        string;
  readonly dealer_id: string;
}

/** A linked estimate is OPTIONAL; when present it must bind coherently. */
export interface WorkReportEstimateFacts {
  readonly dealer_id:   string;
  readonly customer_id: string | null;
  readonly vehicle_id:  string | null;
}

/** One confirmed snapshot row's material fields (completion_report_items). */
export interface WorkReportSnapshotItemFacts {
  readonly category:  string;
  readonly item_name: string;
}

export interface WorkReportEligibilityFacts {
  readonly actor:     WorkReportActorFacts;
  /** Null when the report row could not be loaded in the caller's scope. */
  readonly report:    WorkReportReportFacts | null;
  /** Null when the work order row could not be loaded in the caller's scope. */
  readonly workOrder: WorkReportWorkOrderFacts | null;
  readonly customer:  WorkReportPartyFacts | null;
  readonly vehicle:   WorkReportPartyFacts | null;
  /** Undefined/null when NO estimate is linked — that is fully eligible (§3.4). */
  readonly estimate?: WorkReportEstimateFacts | null;
  /**
   * The id of the ONE canonical report for the work order as the caller
   * resolved it (e.g. the unique (dealer_id, work_order_id) row), or null when
   * none/ambiguous. Passing the judged report's own id unchecked would defeat
   * the canonical test — resolve it independently.
   */
  readonly canonicalReportId: string | null;
  /** Confirmed snapshot rows, from completion_report_items ONLY. */
  readonly confirmedItems: readonly WorkReportSnapshotItemFacts[] | null;
}

// ─── The one eligibility judgment ────────────────────────────────────────────

const isUsable = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== "";

/** A snapshot row is valid only with non-blank category and item name (§4.2). */
const isValidItem = (item: WorkReportSnapshotItemFacts): boolean =>
  isUsable(item.category) && isUsable(item.item_name);

/**
 * Judge work-report readiness (§8). Pure and total: every input combination
 * returns a value; nothing throws. Reason order is FIXED:
 *
 *   unauthenticated → tenant-mismatch → not-canonical →
 *   work-order-not-completed → missing-report-number → missing-report-date →
 *   snapshot-unconfirmed → snapshot-empty → archived
 */
export function evaluateWorkReportEligibility(
  facts: WorkReportEligibilityFacts,
): WorkReportEligibility {
  // 1. Genuine authenticated user AND active dealer context, or nothing else
  //    is evaluated at all.
  if (!isUsable(facts.actor.userId) || !isUsable(facts.actor.dealerId)) {
    return { ready: false, reasons: ["unauthenticated"] };
  }
  const dealerId = facts.actor.dealerId;

  const reasons: WorkReportNotReadyReason[] = [];
  const report = facts.report;
  const workOrder = facts.workOrder;

  // 2. Tenant coherence: report, work order, customer, and vehicle must all
  //    exist in the caller's dealer; the report must reference THIS work
  //    order and the work order must reference THIS customer and vehicle.
  //    A linked estimate, when present, must bind to the same three.
  const tenantMismatch =
    report === null ||
    workOrder === null ||
    facts.customer === null ||
    facts.vehicle === null ||
    report.dealer_id !== dealerId ||
    workOrder.dealer_id !== dealerId ||
    facts.customer.dealer_id !== dealerId ||
    facts.vehicle.dealer_id !== dealerId ||
    report.work_order_id !== workOrder.id ||
    workOrder.customer_id !== facts.customer.id ||
    workOrder.vehicle_id !== facts.vehicle.id ||
    (facts.estimate != null &&
      (facts.estimate.dealer_id !== dealerId ||
        facts.estimate.customer_id !== workOrder.customer_id ||
        facts.estimate.vehicle_id !== workOrder.vehicle_id));
  if (tenantMismatch) reasons.push("tenant-mismatch");

  // 3. The judged report must BE the independently resolved canonical report.
  if (report === null || facts.canonicalReportId === null || facts.canonicalReportId !== report.id) {
    reasons.push("not-canonical");
  }

  // 4. Completed work order with a real actual end.
  if (workOrder === null || workOrder.status !== "completed" || !isUsable(workOrder.actual_end_at)) {
    reasons.push("work-order-not-completed");
  }

  // 5/6. Authoritative number and server-derived date.
  if (report === null || !isUsable(report.report_number)) reasons.push("missing-report-number");
  if (report === null || !isUsable(report.report_date))   reasons.push("missing-report-date");

  // 7. Confirmed snapshot: confirmation timestamp AND a positive version.
  //    Legacy rows (all-null) land here and are never silently converted.
  const confirmed =
    report !== null &&
    isUsable(report.performed_work_confirmed_at) &&
    typeof report.performed_work_version === "number" &&
    Number.isInteger(report.performed_work_version) &&
    report.performed_work_version > 0;
  if (!confirmed) reasons.push("snapshot-unconfirmed");

  // 8. At least one VALID confirmed item. `confirmedItems` comes from
  //    completion_report_items only; there is no estimate fallback by design.
  const items = facts.confirmedItems;
  if (items === null || !items.some(isValidItem)) reasons.push("snapshot-empty");

  // 9. Archived reports are not renderable.
  if (report !== null && report.status === "archived") reasons.push("archived");

  if (reasons.length > 0) return { ready: false, reasons };
  return { ready: true };
}
