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
    <div className="flex flex-col gap-3 rounded-2xl border border-[#263955] bg-[#0b1220]/55 p-3 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93A4BD]">割当先請求書 / ALLOCATION</p>
        <button type="button" onClick={reproposeAdvisory}
          className="rounded-full border border-[#2F6BFF]/35 bg-[#2F6BFF]/10 px-3 py-1 text-[10px] font-semibold text-[#60a5fa] transition-colors hover:bg-[#2F6BFF]/15">
          提案を再計算
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#263955] bg-[#111826]/60 py-3 text-center text-xs text-[#5C6B84]">未払いの請求書がありません</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((inv) => {
            const alloc = byInvoice.get(inv.id);
            return (
              <div key={inv.id}
                className="flex items-center gap-3 rounded-xl border border-[#263955] bg-[#111826]/80 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#E8EEF7]">
                    {inv.invoice_number ?? "（番号なし）"}
                    {inv.title && <span className="ml-1 font-normal text-[#5C6B84]">{inv.title}</span>}
                  </p>
                  <p className="text-[10px] text-[#5C6B84]">
                    期日 {inv.due_date ?? "—"} ・ 残高 {formatYen(inv.balance_due)}
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  value={alloc ? alloc.allocated_amount : ""}
                  placeholder="0"
                  onChange={(e) => setAmount(inv.id, e.target.value)}
                  className="w-28 rounded-lg border border-[#263955] bg-[#0b1220]/80 px-2 py-1.5 text-right text-xs text-[#E8EEF7] transition-colors focus:border-[#60a5fa] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/20"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between gap-3 border-t border-[#263955] pt-2 text-[11px]">
        <span className="text-[#5C6B84]">割当合計: <span className="text-[#E8EEF7]">{formatYen(allocatedTotal)}</span></span>
        <span className="text-[#5C6B84]">
          残り（前受金）: <span className={unapplied < 0 ? "text-red-300" : "text-[#E8EEF7]"}>{formatYen(unapplied)}</span>
        </span>
      </div>
      {unapplied < 0 && (
        <p className="rounded-xl border border-red-500/35 bg-red-950/30 px-3 py-2 text-[10px] text-red-300">割当合計が入金額を超えています</p>
      )}
    </div>
  );
}
