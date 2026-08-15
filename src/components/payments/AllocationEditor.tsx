"use client";

// B3-B1B I1 — advisory allocation editor.
//
// Shows the customer's dealer-scoped open invoices (loaded by the parent through the
// allowlisted read helper) and lets the operator review/edit how a payment is split.
// Everything computed here is a DISPLAY/PROPOSAL helper only — the database RPC and its
// triggers remain the sole financial authority. This component never changes the payment
// amount and rejects malformed local input before submission.

import { OpenInvoiceOption, PaymentAllocationInput } from "@/lib/payments/payment-types";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

/**
 * Oldest-due-first advisory proposal (deterministic: the invoice list arrives already
 * ordered by due_date asc / nulls last / invoice_number / id). Fills each invoice up to
 * its balance_due until the payment amount is exhausted.
 */
export function proposeOldestDueFirst(
  invoices: OpenInvoiceOption[],
  amount: number,
): PaymentAllocationInput[] {
  const out: PaymentAllocationInput[] = [];
  let remaining = Number.isFinite(amount) && amount > 0 ? amount : 0;
  let order = 0;
  for (const inv of invoices) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, inv.balance_due);
    if (take > 0) {
      out.push({ invoice_id: inv.id, allocated_amount: take, allocation_order: order });
      order += 1;
      remaining -= take;
    }
  }
  return out;
}

/** Local pre-submit validation. The database remains final authority. */
export function validateAllocations(
  allocations: PaymentAllocationInput[],
  invoices: OpenInvoiceOption[],
  amount: number,
): string | null {
  const balances = new Map(invoices.map((i) => [i.id, i.balance_due]));
  const seen = new Set<string>();
  let total = 0;
  for (const a of allocations) {
    if (!a.invoice_id || seen.has(a.invoice_id)) return "同じ請求書への割当が重複しています";
    seen.add(a.invoice_id);
    if (!Number.isFinite(a.allocated_amount) || a.allocated_amount <= 0) {
      return "割当額は正の数値で入力してください";
    }
    const bal = balances.get(a.invoice_id);
    if (bal !== undefined && a.allocated_amount > bal) {
      return "割当額が請求書残高を超えています";
    }
    total += a.allocated_amount;
  }
  if (total > amount) return "割当合計が入金額を超えています";
  return null;
}

interface AllocationEditorProps {
  invoices:    OpenInvoiceOption[];
  amount:      number;
  allocations: PaymentAllocationInput[];
  onChange:    (next: PaymentAllocationInput[]) => void;
  /** Extra rows (e.g. the conversion-origin invoice) pinned above the open list. */
  pinnedInvoices?: OpenInvoiceOption[];
}

export default function AllocationEditor({
  invoices,
  amount,
  allocations,
  onChange,
  pinnedInvoices = [],
}: AllocationEditorProps) {
  const rows: OpenInvoiceOption[] = [
    ...pinnedInvoices,
    ...invoices.filter((i) => !pinnedInvoices.some((p) => p.id === i.id)),
  ];
  const byInvoice = new Map(allocations.map((a) => [a.invoice_id, a]));
  const allocatedTotal = allocations.reduce((s, a) => s + a.allocated_amount, 0);
  const unapplied = amount - allocatedTotal;

  function setAmount(invoiceId: string, raw: string) {
    const value = raw === "" ? 0 : parseFloat(raw);
    const next = allocations.filter((a) => a.invoice_id !== invoiceId);
    if (Number.isFinite(value) && value > 0) {
      next.push({ invoice_id: invoiceId, allocated_amount: value, allocation_order: 0 });
    }
    // Deterministic explicit order: the on-screen (oldest-due-first) row order.
    const orderOf = new Map(rows.map((r, i) => [r.id, i]));
    next.sort((a, b) => (orderOf.get(a.invoice_id) ?? 999) - (orderOf.get(b.invoice_id) ?? 999));
    onChange(next.map((a, i) => ({ ...a, allocation_order: i })));
  }

  function reproposeAdvisory() {
    onChange(proposeOldestDueFirst(rows, amount));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">割当先請求書（古い期日から提案）</p>
        <button type="button" onClick={reproposeAdvisory}
          className="text-[10px] text-[#1d4ed8] hover:text-blue-400 transition-colors">
          提案を再計算
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">未払いの請求書がありません</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((inv) => {
            const alloc = byInvoice.get(inv.id);
            return (
              <div key={inv.id}
                className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-200 truncate">
                    {inv.invoice_number ?? "（番号なし）"}
                    {inv.title && <span className="text-slate-500 ml-1">{inv.title}</span>}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    期日 {inv.due_date ?? "—"} ・ 残高 {formatYen(inv.balance_due)}
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  value={alloc ? alloc.allocated_amount : ""}
                  placeholder="0"
                  onChange={(e) => setAmount(inv.id, e.target.value)}
                  className="w-28 bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-right text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between text-[11px] pt-1">
        <span className="text-slate-500">割当合計: <span className="text-slate-200">{formatYen(allocatedTotal)}</span></span>
        <span className="text-slate-500">
          残り（前受金）: <span className={unapplied < 0 ? "text-red-400" : "text-slate-200"}>{formatYen(unapplied)}</span>
        </span>
      </div>
      {unapplied < 0 && (
        <p className="text-[10px] text-red-400">割当合計が入金額を超えています</p>
      )}
    </div>
  );
}
