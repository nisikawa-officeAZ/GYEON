// PHASE64: Admin billing management page.
// Super Admin only. Manual billing operations. No Stripe. No auto-charge.

"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { getBillingDashboardData }    from "@/lib/billing/billing";
import { getRenewalTargets }          from "@/lib/billing/reminder";
import type { DealerBillingWithInvoices } from "@/lib/billing/billing-types";
import type { RenewalTarget }         from "@/lib/billing/reminder";
import BillingDashboard               from "@/components/admin/BillingDashboard";

export const dynamic = "force-dynamic";

export default function AdminBillingPage() {
  const [billings,         setBillings]         = useState<DealerBillingWithInvoices[]>([]);
  const [upcomingRenewals, setUpcomingRenewals] = useState<DealerBillingWithInvoices[]>([]);
  const [expiredBillings,  setExpiredBillings]  = useState<DealerBillingWithInvoices[]>([]);
  const [renewalTargets,   setRenewalTargets]   = useState<RenewalTarget[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [, startTransition]                     = useTransition();

  const loadData = useCallback(() => {
    setLoading(true);
    startTransition(async () => {
      const [dashData, targets] = await Promise.all([
        getBillingDashboardData(),
        getRenewalTargets(),
      ]);
      setBillings(dashData.billings);
      setUpcomingRenewals(dashData.upcomingRenewals);
      setExpiredBillings(dashData.expiredBillings);
      setRenewalTargets(targets);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Billing Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            請求・サブスクリプション管理 — 手動オペレーション。Stripe 未接続。自動課金なし。
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
        >
          更新
        </button>
      </div>

      {/* Manual operation notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-700/40 bg-blue-950/20">
        <span className="text-blue-400 shrink-0">ℹ</span>
        <p className="text-xs text-blue-300">
          このページは手動請求管理ページです。外部決済サービスとの連携はありません。
          請求レコードの作成・請求書発行・入金確認はすべて管理者が手動で行います。
          詳細は docs/BILLING_OPERATION_MANUAL.md を参照してください。
        </p>
      </div>

      {/* Renewal reminder summary */}
      {renewalTargets.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
          <span className="text-amber-400 shrink-0">⚠</span>
          <div className="text-xs text-amber-300">
            <span className="font-semibold">更新リマインダー: </span>
            {renewalTargets.filter(t => t.urgency === "expired").length > 0 && (
              <span className="mr-2">期限超過 {renewalTargets.filter(t => t.urgency === "expired").length}件</span>
            )}
            {renewalTargets.filter(t => t.urgency === "7days").length > 0 && (
              <span className="mr-2">7日以内 {renewalTargets.filter(t => t.urgency === "7days").length}件</span>
            )}
            {renewalTargets.filter(t => t.urgency === "30days").length > 0 && (
              <span>30日以内 {renewalTargets.filter(t => t.urgency === "30days").length}件</span>
            )}
          </div>
        </div>
      )}

      {/* Dashboard */}
      <BillingDashboard
        billings={billings}
        upcomingRenewals={upcomingRenewals}
        expiredBillings={expiredBillings}
        onRefresh={loadData}
      />
    </div>
  );
}
