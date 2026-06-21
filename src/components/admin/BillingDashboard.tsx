"use client";

// PHASE64: Admin billing dashboard component.

import { useState, useTransition } from "react";
import type { DealerBillingWithInvoices } from "@/lib/billing/billing-types";
import {
  contractStatusLabel,
  contractStatusColor,
  invoiceStatusLabel,
  invoiceStatusColor,
  planCodeLabel,
  formatJPY,
  type ContractStatus,
  type InvoiceStatus,
} from "@/lib/billing/billing-types";
import {
  suspendDealer,
  cancelSubscription,
  renewSubscription,
  markInvoicePaid,
  updateInvoiceStatus,
  createBillingInvoice,
  createDealerBilling,
} from "@/lib/billing/billing";

const CONTRACT_STATUS_OPTIONS: ContractStatus[] = [
  "trial", "active", "expired", "cancelled", "suspended",
];

const INVOICE_STATUS_OPTIONS: InvoiceStatus[] = [
  "draft", "issued", "paid", "overdue", "cancelled",
];

// ─── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  onRefresh,
}: {
  invoice: { id: string; invoice_number: string; plan_code: string; amount: number; status: InvoiceStatus; issued_at: string | null; due_at: string | null; paid_at: string | null };
  onRefresh: () => void;
}) {
  const [status,    setStatus]  = useState<InvoiceStatus>(invoice.status);
  const [isPending, startTrans] = useTransition();
  const [saved,     setSaved]   = useState(false);

  const handleSave = () => {
    startTrans(async () => {
      const result = await updateInvoiceStatus(invoice.id, status);
      if (result.success) { setSaved(true); onRefresh(); }
    });
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-800/50 last:border-0 text-[10px]">
      <span className="text-slate-400 font-mono w-36 shrink-0">{invoice.invoice_number}</span>
      <span className="text-slate-300 w-20 shrink-0">{planCodeLabel(invoice.plan_code)}</span>
      <span className="text-slate-200 font-medium w-24 shrink-0">{formatJPY(invoice.amount)}</span>
      <span className={`px-1.5 py-0.5 rounded border ${invoiceStatusColor(invoice.status)} shrink-0`}>
        {invoiceStatusLabel(invoice.status)}
      </span>
      <span className="text-slate-600 shrink-0">{invoice.due_at?.slice(0, 10) ?? "—"}</span>
      <span className="text-slate-600 shrink-0">{invoice.paid_at?.slice(0, 10) ?? "—"}</span>
      <div className="flex items-center gap-1 ml-auto">
        <select
          value={status}
          onChange={e => { setStatus(e.target.value as InvoiceStatus); setSaved(false); }}
          className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
        >
          {INVOICE_STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{invoiceStatusLabel(s)}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-[10px] px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40"
        >
          {isPending ? "..." : "保存"}
        </button>
        {saved && <span className="text-[10px] text-green-400">✓</span>}
      </div>
    </div>
  );
}

// ─── Dealer Billing Row ───────────────────────────────────────────────────────

function DealerBillingRow({
  billing,
  onRefresh,
}: {
  billing:   DealerBillingWithInvoices;
  onRefresh: () => void;
}) {
  const [expanded,    setExpanded]   = useState(false);
  const [showInvForm, setShowInvForm] = useState(false);
  const [isPending,   startTrans]    = useTransition();

  // Invoice form state
  const [invNumber, setInvNumber] = useState("");
  const [invPlan,   setInvPlan]   = useState(billing.plan_code);
  const [invAmount, setInvAmount] = useState("");
  const [invDueAt,  setInvDueAt]  = useState("");
  const [invNotes,  setInvNotes]  = useState("");
  const [invError,  setInvError]  = useState<string | null>(null);

  const handleSuspend = () => {
    if (!confirm("このディーラーを停止しますか？")) return;
    startTrans(async () => {
      await suspendDealer(billing.id, billing.dealer_id);
      onRefresh();
    });
  };

  const handleCancel = () => {
    if (!confirm("このサブスクリプションを解約しますか？")) return;
    startTrans(async () => {
      await cancelSubscription(billing.id, billing.dealer_id);
      onRefresh();
    });
  };

  const handleRenew = () => {
    const newExpires  = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const newRenewal  = new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString();
    startTrans(async () => {
      await renewSubscription(billing.id, billing.dealer_id, newExpires, newRenewal);
      onRefresh();
    });
  };

  const handleCreateInvoice = () => {
    if (!invNumber.trim() || !invAmount) return;
    setInvError(null);
    startTrans(async () => {
      const result = await createBillingInvoice({
        dealerId:      billing.dealer_id,
        invoiceNumber: invNumber.trim(),
        planCode:      invPlan,
        amount:        parseInt(invAmount, 10),
        dueAt:         invDueAt || null,
        notes:         invNotes,
      });
      if (!result.success) {
        setInvError(result.error ?? "Failed");
      } else {
        setInvNumber(""); setInvAmount(""); setInvDueAt(""); setInvNotes("");
        setShowInvForm(false);
        onRefresh();
      }
    });
  };

  const paidInvoices    = billing.invoices.filter(i => i.status === "paid");
  const pendingInvoices = billing.invoices.filter(i => i.status === "issued" || i.status === "overdue");

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/30">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-400 hover:text-slate-200 text-[10px] w-4 shrink-0"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{billing.dealer_name ?? billing.dealer_id.slice(0, 8)}</p>
          <p className="text-[10px] text-slate-500">{billing.dealer_id.slice(0, 8)}</p>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">{planCodeLabel(billing.plan_code)}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${contractStatusColor(billing.contract_status)} shrink-0`}>
          {contractStatusLabel(billing.contract_status)}
        </span>
        <span className="text-[10px] text-slate-500 shrink-0 w-24">{billing.expires_at?.slice(0, 10) ?? "—"}</span>
        <span className="text-[10px] text-slate-500 shrink-0 w-24">{billing.renewal_date?.slice(0, 10) ?? "—"}</span>

        {/* Quick stats */}
        <div className="flex items-center gap-1 shrink-0">
          {pendingInvoices.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-orange-700/50 text-orange-300 bg-orange-950/30">
              未払い {pendingInvoices.length}
            </span>
          )}
          <span className="text-[10px] text-slate-500">
            {paidInvoices.length}件支払済み
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {billing.contract_status === "active" && (
            <button
              onClick={handleRenew}
              disabled={isPending}
              className="text-[10px] px-2 py-1 rounded bg-green-800 hover:bg-green-700 text-white disabled:opacity-40"
            >
              更新
            </button>
          )}
          {(billing.contract_status === "active" || billing.contract_status === "trial") && (
            <button
              onClick={handleSuspend}
              disabled={isPending}
              className="text-[10px] px-2 py-1 rounded border border-orange-700 text-orange-300 hover:bg-orange-950/40 disabled:opacity-40"
            >
              停止
            </button>
          )}
          {billing.contract_status !== "cancelled" && (
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="text-[10px] px-2 py-1 rounded border border-red-800 text-red-400 hover:bg-red-950/40 disabled:opacity-40"
            >
              解約
            </button>
          )}
        </div>
      </div>

      {/* Expanded: invoices */}
      {expanded && (
        <div className="border-t border-slate-800">
          {/* Invoice header */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-800 bg-slate-900/50">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex-1">Invoices</span>
            <button
              onClick={() => setShowInvForm(f => !f)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
            >
              + 請求書作成
            </button>
          </div>

          {/* Invoice form */}
          {showInvForm && (
            <div className="p-3 border-b border-slate-800 bg-slate-900/20 flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="請求書番号 (例: INV-202601-0001) *"
                  value={invNumber}
                  onChange={e => setInvNumber(e.target.value)}
                  className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 placeholder:text-slate-600 flex-1 min-w-40"
                />
                <input
                  type="number"
                  placeholder="金額 (JPY) *"
                  value={invAmount}
                  onChange={e => setInvAmount(e.target.value)}
                  className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 placeholder:text-slate-600 w-32"
                />
                <input
                  type="date"
                  value={invDueAt}
                  onChange={e => setInvDueAt(e.target.value)}
                  className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 w-36"
                />
              </div>
              {invError && <p className="text-[10px] text-red-400">{invError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowInvForm(false)}
                  className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={!invNumber.trim() || !invAmount || isPending}
                  className="text-[10px] px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40"
                >
                  {isPending ? "..." : "作成"}
                </button>
              </div>
            </div>
          )}

          {/* Column headers */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-800/50">
            <span className="text-[10px] text-slate-600 w-36">番号</span>
            <span className="text-[10px] text-slate-600 w-20">プラン</span>
            <span className="text-[10px] text-slate-600 w-24">金額</span>
            <span className="text-[10px] text-slate-600 w-20">ステータス</span>
            <span className="text-[10px] text-slate-600 w-20">期限</span>
            <span className="text-[10px] text-slate-600 w-20">支払日</span>
          </div>

          {billing.invoices.length === 0 ? (
            <p className="text-[10px] text-slate-600 text-center py-4">請求書なし</p>
          ) : (
            billing.invoices.map(inv => (
              <InvoiceRow
                key={inv.id}
                invoice={inv as Parameters<typeof InvoiceRow>[0]["invoice"]}
                onRefresh={onRefresh}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Billing Record Form ───────────────────────────────────────────────

function CreateBillingForm({
  dealerId,
  onRefresh,
  onClose,
}: {
  dealerId:  string;
  onRefresh: () => void;
  onClose:   () => void;
}) {
  const [planCode,  setPlanCode]  = useState("trial");
  const [status,    setStatus]    = useState<ContractStatus>("trial");
  const [startedAt, setStartedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [renewal,   setRenewal]   = useState("");
  const [notes,     setNotes]     = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTrans]   = useTransition();

  const handleCreate = () => {
    setError(null);
    startTrans(async () => {
      const result = await createDealerBilling({
        dealerId,
        planCode,
        contractStatus: status,
        startedAt:      startedAt || null,
        expiresAt:      expiresAt || null,
        renewalDate:    renewal   || null,
        notes,
      });
      if (!result.success) {
        setError(result.error ?? "Failed");
      } else {
        onRefresh();
        onClose();
      }
    });
  };

  return (
    <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/40 flex flex-col gap-3">
      <p className="text-xs font-semibold text-slate-300">請求レコード作成</p>
      <div className="flex gap-2 flex-wrap">
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">プラン</label>
          <select
            value={planCode}
            onChange={e => setPlanCode(e.target.value)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
          >
            {["trial","basic","pro","pro_plus"].map(p => (
              <option key={p} value={p}>{planCodeLabel(p)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">ステータス</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ContractStatus)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
          >
            {CONTRACT_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{contractStatusLabel(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">開始日</label>
          <input type="date" value={startedAt} onChange={e => setStartedAt(e.target.value)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 w-36" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">期限</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 w-36" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">更新日</label>
          <input type="date" value={renewal} onChange={e => setRenewal(e.target.value)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 w-36" />
        </div>
      </div>
      <textarea
        rows={2}
        placeholder="メモ..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 resize-none"
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400">
          キャンセル
        </button>
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="text-[10px] px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40"
        >
          {isPending ? "..." : "作成"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface Props {
  billings:         DealerBillingWithInvoices[];
  upcomingRenewals: DealerBillingWithInvoices[];
  expiredBillings:  DealerBillingWithInvoices[];
  onRefresh:        () => void;
}

export default function BillingDashboard({ billings, upcomingRenewals, expiredBillings, onRefresh }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createDealerId, setCreateDealerId] = useState("");
  const [dealerIdInput,  setDealerIdInput]  = useState("");
  const [filter,         setFilter]         = useState<ContractStatus | "all">("all");

  const totalActive    = billings.filter(b => b.contract_status === "active").length;
  const totalTrial     = billings.filter(b => b.contract_status === "trial").length;
  const totalExpired   = billings.filter(b => b.contract_status === "expired").length;
  const totalSuspended = billings.filter(b => b.contract_status === "suspended").length;

  const totalRevenue = billings
    .flatMap(b => b.invoices)
    .filter(i => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);

  const pendingRevenue = billings
    .flatMap(b => b.invoices)
    .filter(i => i.status === "issued" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  const filtered = filter === "all" ? billings : billings.filter(b => b.contract_status === filter);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "有効",     value: totalActive,    color: "text-green-300"  },
          { label: "トライアル", value: totalTrial,    color: "text-blue-300"   },
          { label: "期限切れ",  value: totalExpired,   color: "text-orange-300" },
          { label: "停止中",    value: totalSuspended, color: "text-red-300"    },
          { label: "売上合計",  value: formatJPY(totalRevenue),   color: "text-green-300", raw: true },
          { label: "未収金",    value: formatJPY(pendingRevenue), color: "text-amber-300", raw: true },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <p className="text-[10px] text-slate-500 mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming renewals */}
      {upcomingRenewals.length > 0 && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold text-amber-300 mb-3">更新期限が近いディーラー ({upcomingRenewals.length}件)</p>
          <div className="flex flex-col gap-2">
            {upcomingRenewals.map(b => (
              <div key={b.id} className="flex items-center gap-3 text-[10px]">
                <span className="text-slate-300 font-medium flex-1">{b.dealer_name}</span>
                <span className="text-amber-300">{b.renewal_date?.slice(0, 10) ?? "—"}</span>
                <span className="text-slate-500">{planCodeLabel(b.plan_code)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired but active */}
      {expiredBillings.length > 0 && (
        <div className="rounded-xl border border-red-700/40 bg-red-950/20 p-4">
          <p className="text-xs font-semibold text-red-300 mb-3">期限超過（要対応） ({expiredBillings.length}件)</p>
          <div className="flex flex-col gap-2">
            {expiredBillings.map(b => (
              <div key={b.id} className="flex items-center gap-3 text-[10px]">
                <span className="text-slate-300 font-medium flex-1">{b.dealer_name}</span>
                <span className="text-red-300">{b.expires_at?.slice(0, 10) ?? "—"}</span>
                <span className="text-slate-500">{planCodeLabel(b.plan_code)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(["all", "trial", "active", "expired", "cancelled", "suspended"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
                filter === f
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              {f === "all" ? "すべて" : contractStatusLabel(f)}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Quick create — dealer ID required */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Dealer UUID"
            value={dealerIdInput}
            onChange={e => setDealerIdInput(e.target.value)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 w-72 font-mono"
          />
          <button
            onClick={() => { if (dealerIdInput.trim()) { setCreateDealerId(dealerIdInput.trim()); setShowCreateForm(true); } }}
            disabled={!dealerIdInput.trim()}
            className="text-[10px] px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40"
          >
            請求レコード作成
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateBillingForm
          dealerId={createDealerId}
          onRefresh={onRefresh}
          onClose={() => { setShowCreateForm(false); setDealerIdInput(""); setCreateDealerId(""); }}
        />
      )}

      {/* Dealer billing list */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-8">データなし</p>
        ) : (
          filtered.map(b => (
            <DealerBillingRow key={b.id} billing={b} onRefresh={onRefresh} />
          ))
        )}
      </div>
    </div>
  );
}
