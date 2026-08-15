"use server";

// Server Action — completion-report DRAFT correction (GDA-1W boundary).
//
// Raw report/item writes are GONE from this file. Under the accepted contract
// (§3.3, §5.7, §7.1) a confirmed report is corrected ONLY through the atomic
// database operation `public.update_completion_report_draft_v1`, which:
//   * accepts only a status-'draft' report and an expected snapshot version
//     (optimistic concurrency — the loser gets STALE_VERSION with zero writes);
//   * updates only title, customer message, internal memo, and the
//     monetary-free performed-work snapshot, replacing all item rows
//     atomically and incrementing the version exactly once; and
//   * cannot change dealer, work order, report number, report date, status,
//     sharing state, PDF fields, maintenance fields, or any financial value —
//     canonical report identity, number, and date are preserved by
//     construction, and the database grants/trigger deny every raw write this
//     file used to perform.
//
// The previous raw UPDATE (status, report_date, is_shared/shared_at,
// next_maintenance_date) and the automatic maintenance-reminder side effect
// are removed: sharing, archival, and maintenance scheduling are separate,
// separately authorized future operations (§2, §3.5, §5.7), and the reminder
// hook violated the no-side-effect rule. This action performs NO side effect
// beyond the single RPC (plus a UI cache revalidation on success).

import { revalidatePath }         from "next/cache";
import { createClient }           from "@/lib/supabase/server";
import { getCurrentDealer }       from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import {
  validatePerformedWorkItems,
  type WorkOrderCompletionDomainError,
} from "@/lib/work-orders/work-order-completion-contract-core";
import type {
  UpdateCompletionReportDraftCommand,
  UpdateCompletionReportDraftResult,
  UpdateCompletionReportDraftRpcRow,
} from "./completion-report-types";

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

const fail = (code: WorkOrderCompletionDomainError): UpdateCompletionReportDraftResult => ({
  ok: false,
  code,
});

/** Trust only a literal 'CODE: text' prefix; raw SQL text never propagates. */
function mapRpcError(message: string | null | undefined): UpdateCompletionReportDraftResult {
  const prefix = (message ?? "").split(":", 1)[0]?.trim() ?? "";
  if ((DOMAIN_ERROR_CODES as readonly string[]).includes(prefix)) {
    return fail(prefix as WorkOrderCompletionDomainError);
  }
  console.error("[updateCompletionReportDraft] non-domain RPC failure");
  return fail("COMPLETION_STATE_INCONSISTENT");
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isRpcRow(value: unknown): value is UpdateCompletionReportDraftRpcRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.completion_report_id === "string" &&
    typeof row.performed_work_version === "number" &&
    (row.outcome === "updated" || row.outcome === "STALE_VERSION")
  );
}

/**
 * Typed draft-correction adapter: ONE RPC call per invocation. The database
 * repeats the §5.3 fail-closed actor check (dealer_staff primary, blocking row
 * never falls back) for the report's owning dealer; the checks here are
 * defense in depth only and can deny, never grant.
 */
export async function updateCompletionReportDraft(
  command: UpdateCompletionReportDraftCommand,
): Promise<UpdateCompletionReportDraftResult> {
  // ── Fail-closed application context: an authenticated edit-capable actor
  //    with exactly one active dealer context, or nothing runs.
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return fail("PERMISSION_DENIED");

  const dealer = await getCurrentDealer();
  if (!dealer) return fail("PERMISSION_DENIED");

  // ── Pure validation BEFORE any I/O, with the same rules the RPC re-checks.
  if (
    typeof command.completionReportId !== "string" ||
    !UUID_RE.test(command.completionReportId)
  ) {
    return fail("VALIDATION_ERROR");
  }
  if (
    typeof command.expectedPerformedWorkVersion !== "number" ||
    !Number.isInteger(command.expectedPerformedWorkVersion) ||
    command.expectedPerformedWorkVersion < 1
  ) {
    return fail("VALIDATION_ERROR");
  }
  const itemsResult = validatePerformedWorkItems(command.performedItems);
  if (!itemsResult.ok) return fail(itemsResult.code);

  const supabase = await createClient();

  // ── ONE atomic RPC. The payload carries only what §5.7 permits: no dealer,
  //    actor, status, number, date, sharing, PDF, maintenance, or money.
  const { data, error } = await supabase.rpc("update_completion_report_draft_v1", {
    p_completion_report_id:            command.completionReportId,
    p_expected_performed_work_version: command.expectedPerformedWorkVersion,
    p_title:                           command.title,
    p_customer_message:                command.customerMessage,
    p_internal_memo:                   command.internalMemo,
    p_performed_items: itemsResult.items.map((item) => ({
      category:    item.category,
      itemName:    item.itemName,
      description: item.description,
    })),
  });

  if (error) return mapRpcError(error.message);

  const row: unknown = Array.isArray(data) ? data[0] : data;
  if (!isRpcRow(row)) {
    console.error("[updateCompletionReportDraft] RPC returned an unrecognized row shape");
    return fail("COMPLETION_STATE_INCONSISTENT");
  }

  // STALE_VERSION is a first-class zero-write outcome, surfaced as a failure
  // code so callers reload and re-present the newer snapshot.
  if (row.outcome === "STALE_VERSION") return fail("STALE_VERSION");

  return { ok: true, result: row };
}

// ─── Legacy FormData wrapper ─────────────────────────────────────────────────
// Preserves the (reportId, formData) → { success } | { error } surface for
// existing callers, now backed EXCLUSIVELY by the draft RPC. The form must
// supply the concurrency token and the confirmed items:
//   expected_performed_work_version — the version the operator was shown;
//   performed_items — JSON array of { category, itemName, description }.
// Fields this operation can no longer change (status, report_date, is_shared,
// shared_at, next_maintenance_date) are REFUSED with guidance when present,
// never silently dropped — sharing/archival/maintenance are separate flows.

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

const ERROR_MESSAGES: Record<WorkOrderCompletionDomainError, string> = {
  UNAUTHENTICATED:               "ログインが必要です。",
  NOT_FOUND:                     "完了報告書が見つかりません。",
  PERMISSION_DENIED:             "編集権限がありません。",
  VALIDATION_ERROR:              "入力内容を確認してください（実施した作業 1〜100 件が必要です）。",
  INVALID_STATE:                 "下書きの報告書のみ修正できます。共有済み・アーカイブ済みは変更できません。",
  IDEMPOTENCY_CONFLICT:          "リクエストが競合しました。再読み込みしてください。",
  ALREADY_COMPLETED_CONFLICT:    "この報告書は変更できない状態です。",
  RECOVERY_REQUIRED:             "過去データの復旧確認が必要です。管理者に連絡してください。",
  COMPLETION_STATE_INCONSISTENT: "更新に失敗しました。再読み込みしてもう一度お試しください。",
  REPORT_NUMBER_FAILED:          "更新に失敗しました。もう一度お試しください。",
  STALE_VERSION:                 "他の更新が先に行われました。最新の内容を読み込み直してください。",
};

export async function updateCompletionReport(reportId: string, formData: FormData) {
  // Refuse — do not silently drop — fields this operation may not change.
  for (const forbidden of [
    "status",
    "report_date",
    "is_shared",
    "shared_at",
    "next_maintenance_date",
    "report_number",
  ]) {
    if (formData.get(forbidden) !== null) {
      return {
        error:
          "ステータス・報告日・共有状態・メンテナンス予定はこの操作では変更できません。専用の操作をご利用ください。",
      };
    }
  }

  const versionRaw = str(formData, "expected_performed_work_version");
  const version = versionRaw !== null ? Number(versionRaw) : NaN;
  if (!Number.isInteger(version) || version < 1) {
    return { error: "報告書のバージョン情報がありません。画面を再読み込みしてください。" };
  }

  const itemsRaw = str(formData, "performed_items");
  let performedItems: unknown;
  try {
    performedItems = itemsRaw === null ? null : JSON.parse(itemsRaw);
  } catch {
    return { error: ERROR_MESSAGES.VALIDATION_ERROR };
  }
  if (!Array.isArray(performedItems)) {
    return { error: ERROR_MESSAGES.VALIDATION_ERROR };
  }

  const result = await updateCompletionReportDraft({
    completionReportId:           reportId,
    expectedPerformedWorkVersion: version,
    title:                        str(formData, "title"),
    customerMessage:              str(formData, "customer_message"),
    internalMemo:                 str(formData, "internal_memo"),
    performedItems:               performedItems as UpdateCompletionReportDraftCommand["performedItems"],
  });

  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.code] };
  }

  revalidatePath("/work-orders");
  return { success: true, performed_work_version: result.result.performed_work_version };
}
