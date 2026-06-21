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
  report_date:      string | null;   // ISO date "YYYY-MM-DD"
  customer_message: string | null;
  internal_memo:    string | null;
  pdf_file_path:         string | null;
  pdf_file_url:          string | null;
  is_shared:             boolean;
  shared_at:             string | null;
  next_maintenance_date: string | null;
  created_at:            string;
  updated_at:            string;
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
