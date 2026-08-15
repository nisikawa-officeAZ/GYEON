// DealerOS — Completion Report Types (PHASE41)
// Column names match the Supabase completion_reports table exactly (snake_case).

import { WorkOrderFileDB, WorkOrderFilePhase } from "@/lib/work-order-files/work-order-file-types";

export type CompletionReportStatus = 'draft' | 'generated' | 'shared' | 'archived';

export interface CompletionReportDB {
  id:               string;
  dealer_id:        string;
  work_order_id:    string;
  report_number:    string | null;
  title:            string | null;
  status:           CompletionReportStatus;
  report_date:      string | null;   // ISO date "YYYY-MM-DD"; server-derived (Asia/Tokyo) on completion
  customer_message: string | null;
  internal_memo:    string | null;
  pdf_file_path:         string | null;
  pdf_file_url:          string | null;
  is_shared:             boolean;
  shared_at:             string | null;
  next_maintenance_date: string | null;
  created_at:            string;
  updated_at:            string;

  // ── GDA-1W performed-work confirmation authority (contract §4.1) ──
  // All four are null on legacy/unconfirmed rows, which are NOT work-report
  // ready. They are written ONLY by the completion authority operations
  // (complete_work_order_v1 / update_completion_report_draft_v1); raw writes
  // are denied by grants, RLS, and the guard trigger.
  performed_work_confirmed_at: string | null;
  performed_work_confirmed_by: string | null;
  performed_work_version:      number | null;   // positive and monotonic once confirmed
  performed_work_updated_at:   string | null;
}

// Fields for INSERT
export type CompletionReportInput = {
  dealer_id:        string;   // server-injected
  work_order_id:    string;
  report_number:    string | null;
  title:            string | null;
  status:           CompletionReportStatus;
  report_date:      string | null;
  customer_message: string | null;
  internal_memo:    string | null;
};

// Fields allowed for UPDATE
//
// GDA-1W boundary note: raw completion_reports writes are DENIED at the
// database (SELECT-only grants, no write policies, guard trigger). This legacy
// shape survives only for source compatibility while the write paths are
// reworked; `status`, sharing, PDF, and date fields here can no longer reach
// the table. Draft correction goes through UpdateCompletionReportDraftCommand.
export type CompletionReportUpdateInput = {
  title?:            string | null;
  status?:           CompletionReportStatus;
  report_date?:      string | null;
  customer_message?: string | null;
  internal_memo?:    string | null;
  is_shared?:             boolean;
  shared_at?:             string | null;
  pdf_file_path?:         string | null;
  pdf_file_url?:          string | null;
  next_maintenance_date?: string | null;
};

// ─── GDA-1W confirmed performed-work snapshot (contract §4.2) ─────────────────

import type {
  PerformedWorkItemInput,
  WorkOrderCompletionDomainError,
} from "@/lib/work-orders/work-order-completion-contract-core";

export type { PerformedWorkItemInput } from "@/lib/work-orders/work-order-completion-contract-core";

/**
 * One authoritative, monetary-free snapshot row — snake_case exactly as the
 * `completion_report_items` table stores it. These rows are the ONLY
 * performed-work authority for a work report: quantity, price, tax, discount,
 * cost, and margin do not exist here and must never be added.
 */
export interface CompletionReportItemDB {
  id:                   string;
  dealer_id:            string;
  completion_report_id: string;
  sort_order:           number;
  category:             string;
  item_name:            string;
  description:          string | null;
  created_at:           string;
  updated_at:           string;
}

/**
 * ESTIMATE DATA IS PREFILL ONLY (contract §3.2). `estimate_items` are a
 * proposal, never evidence of completed work; a work report must never read
 * its performed rows from them. This mapper produces an EDITABLE candidate the
 * operator must review and explicitly confirm — monetary fields are dropped
 * here by construction and the confirmed snapshot no longer follows later
 * estimate changes.
 */
export function estimateItemsToPerformedWorkPrefill(
  estimateItems: ReadonlyArray<{
    category: string;
    item_name: string;
    description: string | null;
    sort_order: number;
  }>,
): PerformedWorkItemInput[] {
  return [...estimateItems]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      category:    item.category,
      itemName:    item.item_name,
      description: item.description,
    }));
}

// ─── GDA-1W draft correction operation (contract §5.7) ───────────────────────

/**
 * The client-expressible draft correction: version-checked, monetary-free.
 * It cannot express dealer, work order, report number/date, status, sharing,
 * PDF, maintenance, or any financial value — the RPC rejects everything else.
 */
export interface UpdateCompletionReportDraftCommand {
  completionReportId:           string;
  expectedPerformedWorkVersion: number;
  title:                        string | null;
  customerMessage:              string | null;
  internalMemo:                 string | null;
  performedItems:               readonly PerformedWorkItemInput[];
}

/** The single result row of `public.update_completion_report_draft_v1`. */
export interface UpdateCompletionReportDraftRpcRow {
  completion_report_id:   string;
  performed_work_version: number;
  outcome:                'updated' | 'STALE_VERSION';
}

/**
 * Typed adapter result. STALE_VERSION is a first-class, zero-write outcome —
 * the caller reloads and re-presents the newer snapshot — while hard failures
 * carry the same stable domain codes as completion (§6), never raw SQL text.
 */
export type UpdateCompletionReportDraftResult =
  | { ok: true;  result: UpdateCompletionReportDraftRpcRow }
  | { ok: false; code: WorkOrderCompletionDomainError };

// ─── GDA-1W work-report eligibility (contract §8) ────────────────────────────

/**
 * Why a work report is not ready. ONE pure contract consumed by both the
 * completion UI and the authenticated PDF route, so the page can never show a
 * contradictory "PDF is preparing" message: it displays the exact reason.
 *
 *   'unauthenticated'          — no genuine authenticated user / dealer context.
 *   'tenant-mismatch'          — report, work order, customer, vehicle, or the
 *                                linked estimate is not all in the caller's dealer.
 *   'not-canonical'            — the report is not the one canonical report for
 *                                its work order.
 *   'work-order-not-completed' — work order status is not 'completed' or
 *                                actual_end_at is null.
 *   'missing-report-number'    — report_number is null.
 *   'missing-report-date'      — report_date is null.
 *   'snapshot-unconfirmed'     — performed_work_confirmed_at is null or the
 *                                version is not a positive number (legacy rows
 *                                land here and are NOT silently converted).
 *   'snapshot-empty'           — the confirmed snapshot has no valid item.
 *   'archived'                 — report status is 'archived'.
 */
export type WorkReportNotReadyReason =
  | 'unauthenticated'
  | 'tenant-mismatch'
  | 'not-canonical'
  | 'work-order-not-completed'
  | 'missing-report-number'
  | 'missing-report-date'
  | 'snapshot-unconfirmed'
  | 'snapshot-empty'
  | 'archived';

/** Discriminated readiness: reasons exist ONLY on the not-ready arm. */
export type WorkReportEligibility =
  | { ready: true }
  | { ready: false; reasons: readonly WorkReportNotReadyReason[] };

// ─── Full data for preview rendering ─────────────────────────────────────────

export interface DealerInfo {
  id:         string;
  name:       string;
  dealer_type: string;
  prefecture: string | null;
  address:    string | null;
  phone:      string | null;
  email:      string | null;
}

export interface CompletionReportFullData {
  report:     CompletionReportDB;
  dealer:     DealerInfo | null;
  work_order: {
    id:                 string;
    work_order_number:  string | null;
    title:              string | null;
    status:             string;
    scheduled_start_at: string | null;
    scheduled_end_at:   string | null;
    actual_start_at:    string | null;
    actual_end_at:      string | null;
    assigned_staff:     string | null;
    service_summary:    string | null;
    notes:              string | null;
    customers: {
      last_name:  string | null;
      first_name: string | null;
      phone:      string | null;
      email:      string | null;
    } | null;
    vehicles: {
      maker:        string | null;
      model:        string | null;
      year:         string | null;
      grade:        string | null;
      plate_number: string | null;
      color:        string | null;
    } | null;
    estimates: {
      estimate_number: string | null;
      title:           string | null;
      subtotal:        number;
      tax_rate:        number;
      tax_amount:      number;
      discount_amount: number;
      total:           number;
      estimate_items: {
        id:            string;
        category:      string;
        item_name:     string;
        description:   string | null;
        quantity:      number;
        unit_price:    number;
        discount_rate: number;
        line_total:    number;
        sort_order:    number;
      }[];
    } | null;
  } | null;
  files: WorkOrderFileDB[];
}

// Files grouped by phase for preview
export type FilesByPhase = Partial<Record<WorkOrderFilePhase, WorkOrderFileDB[]>>;

export function groupFilesByPhase(files: WorkOrderFileDB[]): FilesByPhase {
  return files.reduce<FilesByPhase>((acc, f) => {
    if (!acc[f.phase]) acc[f.phase] = [];
    acc[f.phase]!.push(f);
    return acc;
  }, {});
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CompletionReportStatus, string> = {
  draft:     '下書き',
  generated: '生成済み',
  shared:    '共有済み',
  archived:  'アーカイブ',
};

export function completionReportStatusLabel(status: CompletionReportStatus | string): string {
  return STATUS_LABELS[status as CompletionReportStatus] ?? status;
}

export function completionReportDisplayNo(
  r: Pick<CompletionReportDB, 'report_number' | 'id'>
): string {
  return r.report_number ?? `RPT-${r.id.slice(0, 8).toUpperCase()}`;
}
