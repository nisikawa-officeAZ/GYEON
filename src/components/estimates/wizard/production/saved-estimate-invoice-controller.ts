import { isValidEstimateId } from "../save/wizard-idempotency-session";
import { isValidCalendarDate } from "../../../../lib/invoices/invoice-delivery-date";

/** Server route injects these actions. No dealer, price, approval or invoice ID is client-authored. */
export type SavedInvoiceActions = {
  readonly create: (estimateId: string) => Promise<unknown>;
  readonly read: (invoiceId: string) => Promise<unknown>;
  readonly saveDate?: (invoiceId: string, estimateId: string, date: string, expectedVersion: number) => Promise<unknown>;
  readonly issue?: (invoiceId: string, expectedVersion: number) => Promise<unknown>;
  readonly download?: (invoiceId: string) => Promise<unknown>;
};

export type SavedInvoiceSummary = {
  id: string;
  number: string | null;
  status: "draft" | "issued" | "paid" | "partially_paid" | "overdue" | "cancelled";
  issueDate: string | null;
  dueDate: string | null;
  deliveryDate: string | null;
  contentVersion: number;
  total: number;
  items: readonly { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
};
export type SavedInvoiceState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string }
  | { kind: "ready"; invoice: SavedInvoiceSummary; message?: string; pdfUrl?: string };

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const nullableText = (v: unknown): v is string | null => v === null || typeof v === "string";
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Readback only; never calculate, infer a lifecycle state or trust a mismatched source. */
export function parseSavedInvoice(value: unknown, invoiceId: string, estimateId: string): SavedInvoiceSummary | null {
  if (!record(value) || value.id !== invoiceId || value.estimate_id !== estimateId
      || !isValidEstimateId(invoiceId) || value.deleted_at !== null
      || !["draft", "issued", "paid", "partially_paid", "overdue", "cancelled"].includes(value.status as string)
      || !nullableText(value.invoice_number) || !nullableText(value.issue_date)
      || !nullableText(value.due_date) || !nullableText(value.delivery_date)
      || !Number.isSafeInteger(value.content_version) || (value.content_version as number) < 1
      || !finite(value.total) || !Array.isArray(value.invoice_items)) return null;
  const ids = new Set<string>();
  const items: SavedInvoiceSummary["items"][number][] = [];
  for (const item of value.invoice_items) {
    if (!record(item) || !isValidEstimateId(item.id) || item.invoice_id !== invoiceId
        || ids.has(item.id as string) || typeof item.item_name !== "string"
        || !finite(item.quantity) || !finite(item.unit_price) || !finite(item.line_total)
        || !finite(item.sort_order)) return null;
    ids.add(item.id as string);
  }
  for (const item of [...value.invoice_items].sort((a, b) => a.sort_order - b.sort_order)) {
    items.push({ id: item.id, name: item.item_name, quantity: item.quantity, unitPrice: item.unit_price, total: item.line_total });
  }
  return { id: invoiceId, number: value.invoice_number, status: value.status as SavedInvoiceSummary["status"],
    issueDate: value.issue_date, dueDate: value.due_date, deliveryDate: value.delivery_date,
    contentVersion: value.content_version as number, total: value.total, items };
}

export const hasIssuedInvoice = (status: SavedInvoiceSummary["status"]) =>
  ["issued", "paid", "partially_paid", "overdue"].includes(status);

export function safeInvoicePdfUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

const UNKNOWN = "請求書の作成結果を確認できません。同じ見積から再度確認してください。見積の保存は完了しています。";
const READ_FAILED = "請求書の番号は確認できましたが、内容を読み込めませんでした。再度確認しても新しい請求書は作りません。";

/** One controller per keyed saved estimate. Synchronous lock prevents rapid double clicks. */
export function createSavedInvoiceController(estimateId: string, actions: SavedInvoiceActions, publish: (state: SavedInvoiceState) => void) {
  let pending = false;
  let generation = 0;
  let invoiceId: string | null = null;
  let snapshot: SavedInvoiceSummary | null = null;

  async function operate(kind: "save" | "issue" | "download", date?: string, confirmed = false): Promise<void> {
    const before = snapshot;
    if (pending || !before || !invoiceId) return;
    if (kind === "save" && (!actions.saveDate || before.status !== "draft" || !isValidCalendarDate(date))) return;
    if (kind === "issue" && (!actions.issue || before.status !== "draft" || !confirmed || !isValidCalendarDate(before.deliveryDate))) return;
    if (kind === "download" && (!actions.download || !hasIssuedInvoice(before.status))) return;
    pending = true;
    snapshot = null;
    const request = generation;
    const current = () => request === generation;
    publish({ kind: "pending" });
    let outcome: unknown;
    try {
      try {
        outcome = kind === "save" ? await actions.saveDate!(before.id, estimateId, date!, before.contentVersion)
          : kind === "issue" ? await actions.issue!(before.id, before.contentVersion)
            : await actions.download!(before.id);
      } catch { /* A lost response is unknown, not proof that the write failed. */ }
      if (!current()) return;
      const data = await actions.read(before.id);
      if (!current()) return;
      const invoice = parseSavedInvoice(data, before.id, estimateId);
      if (!invoice) { publish({ kind: "error", message: "操作結果を確認できません。同じ請求書を再確認してください。見積の保存は完了しています。" }); return; }
      snapshot = invoice;
      const result = record(outcome) && !("error" in outcome) ? outcome : null;
      const pdfUrl = result && hasIssuedInvoice(invoice.status)
        && (result.kind === "issued" || result.kind === "already_issued") ? safeInvoicePdfUrl(result.signedUrl) : undefined;
      let message: string;
      if (kind === "save") {
        message = result?.success === true && invoice.status === "draft" && invoice.deliveryDate === date
          ? "納品日を保存しました。保存内容を確認してから確定発行してください。"
          : "納品日の保存結果が一致しないか、途中で変更されています。表示された最新内容を再確認してください。";
      } else if (result?.kind === "cleanup_failed") {
        message = "PDF保存後の後処理に失敗しました。管理者の確認が必要です。再発行せず、請求書の状態を確認してください。";
      } else if (pdfUrl) {
        message = "発行済みの請求書PDFを表示できます。同じPDFを取得し、再発行はしません。";
      } else {
        message = hasIssuedInvoice(invoice.status)
          ? "発行済みです。PDFを取得できませんでした。「発行済みPDFを表示」で再取得してください。"
          : "確定発行を確認できません。納品日・明細・権限を確認してください。内容が変更された場合は、最新内容の確認が必要です。";
      }
      publish({ kind: "ready", invoice, message, pdfUrl });
    } catch {
      if (current()) publish({ kind: "error", message: "操作結果を確認できません。同じ請求書を再確認してください。見積の保存は完了しています。" });
    } finally { if (current()) pending = false; }
  }
  return {
    cancel() { generation++; pending = false; snapshot = null; },
    saveDeliveryDate(date: string) { return operate("save", date); },
    issue(confirmed: boolean) { return operate("issue", undefined, confirmed); },
    download() { return operate("download"); },
    async run(): Promise<void> {
      if (pending || !isValidEstimateId(estimateId)) return;
      pending = true;
      snapshot = null;
      const request = generation;
      const current = () => request === generation;
      publish({ kind: "pending" });
      try {
        if (invoiceId === null) {
          const result = await actions.create(estimateId);
          if (!current()) return;
          if (!record(result) || result.success !== true || "error" in result || !isValidEstimateId(result.id)) {
            const message = record(result) && result.error === "請求書の作成結果を確認できません。同じ見積から再度確認してください。"
              ? UNKNOWN
              : record(result) && result.error === "承認済みの見積のみ請求書を作成できます"
              ? "見積の承認が必要です。見積詳細で承認を確認してから、もう一度操作してください。自動承認は行いません。"
              : record(result) && typeof result.error === "string" && result.error !== ""
                ? "請求書を作成できません。見積の承認状態・請求操作の権限・関連する請求書を確認してください。見積の保存は完了しています。"
                : UNKNOWN;
            publish({ kind: "error", message });
            return;
          }
          invoiceId = result.id as string;
        }
        const result = await actions.read(invoiceId);
        if (!current()) return;
        const invoice = parseSavedInvoice(result, invoiceId, estimateId);
        snapshot = invoice;
        publish(invoice ? { kind: "ready", invoice } : { kind: "error", message: READ_FAILED });
      } catch {
        if (current()) publish({ kind: "error", message: invoiceId === null ? UNKNOWN : READ_FAILED });
      } finally {
        if (current()) pending = false;
      }
    },
  };
}
