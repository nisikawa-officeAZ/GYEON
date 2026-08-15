"use server";

// Server Action — GDA-1W atomic work-order completion adapter.
//
// This is the ONLY application path to `public.complete_work_order_v1`
// (accepted contract §5). One deliberate call per intent:
//
//   1. validate the monetary-free command with the pure contract core BEFORE
//      any network write, using the same rules and stable codes the database
//      enforces authoritatively;
//   2. resolve a fail-closed §5.3 actor context for the dealer that OWNS the
//      work order (defense in depth — the database repeats this check inside
//      the function and cannot be bypassed by this adapter);
//   3. call the RPC exactly ONCE — retries reuse the SAME idempotency key and
//      are the caller's decision, never an automatic loop here; and
//   4. map the outcome to typed results and STABLE domain codes. Raw SQL
//      text, SQLSTATE, hints, and payload content are never returned.
//
// NO other side effect exists on this path: no message, invoice, payment,
// maintenance, Storage, engagement-event, or external-service call (§3.5), and
// no cache revalidation is performed here — the calling surface decides what
// to refresh after it has shown the operator the result.

import { createClient } from "@/lib/supabase/server";
import {
  buildCompletionFingerprintCanonicalJson,
  canTransitionToCompleted,
  validateActualEndAt,
  validateIdempotencyKey,
  validatePerformedWorkItems,
  type WorkOrderCompletionDomainError,
} from "./work-order-completion-contract-core";
import {
  resolveWorkOrderCompletionActor,
  type WorkOrderCompletionActorReaders,
} from "./work-order-completion-actor-context";
import type {
  CompleteWorkOrderCommand,
  CompleteWorkOrderRpcRow,
  CompleteWorkOrderResult,
} from "./work-order-types";

/**
 * The adapter can additionally fail in ways the domain contract does not name
 * (network failure, malformed RPC response). Those are surfaced as
 * "UNEXPECTED_ERROR" rather than being disguised as a domain outcome — a
 * caller seeing it may retry with the SAME idempotency key.
 */
export type CompleteWorkOrderActionResult =
  | CompleteWorkOrderResult
  | { ok: false; code: "UNEXPECTED_ERROR" };

const DOMAIN_ERROR_CODES: readonly WorkOrderCompletionDomainError[] = [
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "VALIDATION_ERROR",
  "INVALID_STATE",
  "IDEMPOTENCY_CONFLICT",
  "ALREADY_COMPLETED_CONFLICT",
  "RECOVERY_REQUIRED",
  "COMPLETION_STATE_INCONSISTENT",
  "REPORT_NUMBER_FAILED",
  "STALE_VERSION",
];

const fail = (code: WorkOrderCompletionDomainError): CompleteWorkOrderActionResult => ({
  ok: false,
  code,
});

/**
 * The database raises stable 'CODE: human text' messages (§6). Only the code
 * BEFORE the first colon is trusted and only when it is a literal member of
 * the domain-error set; everything else — including raw PostgREST/SQL text —
 * maps to UNEXPECTED_ERROR and is logged by code alone.
 */
function mapRpcError(message: string | null | undefined): CompleteWorkOrderActionResult {
  const prefix = (message ?? "").split(":", 1)[0]?.trim() ?? "";
  if ((DOMAIN_ERROR_CODES as readonly string[]).includes(prefix)) {
    return fail(prefix as WorkOrderCompletionDomainError);
  }
  console.error("[completeWorkOrder] non-domain RPC failure");
  return { ok: false, code: "UNEXPECTED_ERROR" };
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isRpcRow(value: unknown): value is CompleteWorkOrderRpcRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.work_order_id === "string" &&
    typeof row.completion_report_id === "string" &&
    typeof row.report_number === "string" &&
    typeof row.performed_work_version === "number" &&
    typeof row.request_fingerprint === "string" &&
    (row.outcome === "created" || row.outcome === "replayed" || row.outcome === "recovered") &&
    typeof row.created === "boolean" &&
    typeof row.replayed === "boolean"
  );
}

export async function completeWorkOrder(
  command: CompleteWorkOrderCommand,
): Promise<CompleteWorkOrderActionResult> {
  // ── 1. Pure command validation (§3.2 / §3.4 / §4.3) — no I/O yet. ─────────
  if (typeof command.workOrderId !== "string" || !UUID_RE.test(command.workOrderId)) {
    return fail("VALIDATION_ERROR");
  }

  const keyResult = validateIdempotencyKey(command.idempotencyKey);
  if (!keyResult.ok) return fail(keyResult.code);

  const itemsResult = validatePerformedWorkItems(command.performedItems);
  if (!itemsResult.ok) return fail(itemsResult.code);

  if (typeof command.actualEndAt !== "string") return fail("VALIDATION_ERROR");
  const actualEndAt = new Date(command.actualEndAt);
  // The database clock is the +5-minute authority; this pre-check only refuses
  // instants that are unparsable or grossly ahead of THIS host's clock.
  const endCheck = validateActualEndAt(actualEndAt, null, new Date());
  if (!endCheck.ok) return fail(endCheck.code);

  const supabase = await createClient();

  // ── 2. Resolve the OWNING dealer from the work order row, then the actor. ──
  // The read is RLS-scoped, so a cross-dealer or missing work order yields the
  // same coarse NOT_FOUND here that the database function yields (§5.3).
  const { data: workOrder, error: workOrderError } = await supabase
    .from("work_orders")
    .select("dealer_id, status, actual_start_at, deleted_at")
    .eq("id", command.workOrderId)
    .maybeSingle();
  if (workOrderError) {
    console.error("[completeWorkOrder] work order read failed");
    return { ok: false, code: "UNEXPECTED_ERROR" };
  }
  if (!workOrder || workOrder.deleted_at !== null) return fail("NOT_FOUND");

  // Cheap pre-checks with the exact rules the RPC re-validates authoritatively.
  if (workOrder.status !== "completed" && !canTransitionToCompleted(workOrder.status)) {
    return fail("INVALID_STATE");
  }
  if (workOrder.actual_start_at !== null) {
    const startCheck = validateActualEndAt(
      actualEndAt,
      new Date(workOrder.actual_start_at),
      new Date(),
    );
    if (!startCheck.ok) return fail(startCheck.code);
  }

  const readers: WorkOrderCompletionActorReaders = {
    getUserId: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data.user?.id ?? null;
    },
    getDealerStaffRows: async (userId, dealerId) => {
      const { data, error } = await supabase
        .from("dealer_staff")
        .select("status, role")
        .eq("dealer_id", dealerId)
        .eq("user_id", userId);
      if (error || data === null) return { ok: false };
      return { ok: true, rows: data };
    },
    getActiveMemberRole: async (userId, dealerId) => {
      const { data, error } = await supabase
        .from("dealer_members")
        .select("role")
        .eq("dealer_id", dealerId)
        .eq("user_id", userId)
        .eq("status", "active");
      if (error || data === null) return { ok: false };
      if (data.length === 0) return { ok: true, role: null };
      if (data.length > 1) return { ok: false }; // ambiguous state: fail closed
      return { ok: true, role: (data[0] as { role: string }).role };
    },
    getIsDealerOwner: async (userId, dealerId) => {
      const { data, error } = await supabase
        .from("dealers")
        .select("id")
        .eq("id", dealerId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (error) return { ok: false };
      return { ok: true, isOwner: data !== null };
    },
  };

  const actor = await resolveWorkOrderCompletionActor(workOrder.dealer_id, readers);
  if (!actor.ok) {
    return fail(actor.reason === "unauthenticated" ? "UNAUTHENTICATED" : "PERMISSION_DENIED");
  }

  // The canonical text is built ONLY to fail fast if serialization is somehow
  // impossible; the DATABASE-computed fingerprint is the authority (§5.4) and
  // nothing from this string is sent.
  buildCompletionFingerprintCanonicalJson(command.workOrderId, actualEndAt, itemsResult.items);

  // ── 3. ONE RPC call. The payload is the normalized, monetary-free intent:
  //       the trimmed key, the instant, and exactly three fields per item. No
  //       dealer, actor, role, report, number, date, status, or version is
  //       sent — the database derives or owns all of those (§5.1).
  const { data, error } = await supabase.rpc("complete_work_order_v1", {
    p_work_order_id: command.workOrderId,
    p_idempotency_key: keyResult.key,
    p_actual_end_at: actualEndAt.toISOString(),
    p_performed_items: itemsResult.items.map((item) => ({
      category: item.category,
      itemName: item.itemName,
      description: item.description,
    })),
  });

  if (error) return mapRpcError(error.message);

  // ── 4. Typed result. A set-returning function arrives as an array of one. ──
  const row: unknown = Array.isArray(data) ? data[0] : data;
  if (!isRpcRow(row)) {
    console.error("[completeWorkOrder] RPC returned an unrecognized row shape");
    return { ok: false, code: "UNEXPECTED_ERROR" };
  }

  return { ok: true, result: row };
}
