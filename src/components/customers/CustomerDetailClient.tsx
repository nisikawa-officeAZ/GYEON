"use client";

// Phase 2 Sprint 2 — Customer Detail view.
// Composes existing building blocks (CustomerForm, CustomerActivityTimeline) with
// the new derived status/tags and notes panel. No UI redesign of reused parts.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CustomerDB } from "@/lib/customers/customer-types";
import { customerDisplayName, customerKanaName } from "@/lib/customers/customer-types";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerStatusBadge from "@/components/customers/CustomerStatusBadge";
import CustomerTagList from "@/components/customers/CustomerTagList";
import CustomerNotesPanel from "@/components/customers/CustomerNotesPanel";
import CustomerActivityTimeline from "@/components/activity/CustomerActivityTimeline";
import { useCurrentStaff } from "@/contexts/StaffContext";

interface Props {
  customer: CustomerDB;
  vehicles: VehicleDB[];
}

const card = "bg-[#111827] rounded-2xl border border-white/[.08] p-5";
const secHdr = "text-[11px] font-bold text-slate-400 uppercase tracking-[1px] mb-3";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-slate-500 w-24 shrink-0">{label}</span>
      <span className="text-slate-200 break-all">{value || "—"}</span>
    </div>
  );
}

export default function CustomerDetailClient({ customer, vehicles }: Props) {
  const { canEdit } = useCurrentStaff();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const displayName = customerDisplayName(customer) || "（氏名未登録）";
  const kanaName    = customerKanaName(customer);
  const address = [customer.prefecture, customer.city, customer.address1, customer.address2]
    .filter(Boolean).join(" ");

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">

      {/* Back link */}
      <Link href="/customers" className="text-xs text-slate-400 hover:text-slate-200 transition-colors self-start">
        ← 顧客一覧
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-100">{displayName}</h1>
            <CustomerStatusBadge customer={customer} />
          </div>
          {kanaName && <p className="text-xs text-slate-500">{kanaName}</p>}
          <CustomerTagList customer={customer} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/estimates?customer_id=${customer.id}`)}
            className="text-sm font-medium text-emerald-300 border border-emerald-800/40 hover:bg-emerald-950/30 px-4 py-2 rounded-lg transition-colors"
          >
            見積作成
          </button>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-white bg-[#1d4ed8] hover:bg-[#1e40af] px-4 py-2 rounded-lg transition-colors"
            >
              編集
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <CustomerForm
          customer={customer}
          onCancel={() => setEditing(false)}
          onSuccess={() => { setEditing(false); router.refresh(); }}
        />
      ) : (
        <>
          {/* Profile */}
          <div className={card}>
            <div className={secHdr}>プロフィール</div>
            <div className="flex flex-col gap-2">
              <InfoRow label="電話番号" value={customer.phone ?? ""} />
              <InfoRow label="メール"   value={customer.email ?? ""} />
              <InfoRow label="住所"     value={address} />
              <InfoRow label="区分"     value={customer.is_business ? "業者（業販対象）" : "個人"} />
              {customer.is_business && (
                <InfoRow label="業販掛け率" value={`${customer.trade_discount_pct}%`} />
              )}
              {customer.is_business && customer.credit_terms && (
                <InfoRow label="与信条件" value={customer.credit_terms} />
              )}
            </div>
          </div>

          {/* Notes */}
          <div className={card}>
            <CustomerNotesPanel customerId={customer.id} initialNotes={customer.notes ?? ""} />
          </div>

          {/* Linked vehicles */}
          <div className={card}>
            <div className={secHdr}>紐付き車両 ({vehicles.length}台)</div>
            {vehicles.length === 0 ? (
              <p className="text-xs text-slate-600">紐付いている車両はありません</p>
            ) : (
              <div className="flex flex-col gap-2">
                {vehicles.map((v) => (
                  <div key={v.id} className="bg-[#0f172a] rounded-lg px-3 py-2 flex items-center gap-3">
                    <span className="text-slate-300 text-sm font-medium">
                      {[v.maker, v.model].filter(Boolean).join(" ") || "車両"}
                    </span>
                    {v.grade && <span className="text-slate-500 text-xs">{v.grade}</span>}
                    {v.plate_number && (
                      <span className="ml-auto text-xs font-mono text-slate-400">{v.plate_number}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className={card}>
            <div className={secHdr}>アクティビティ</div>
            <CustomerActivityTimeline customerId={customer.id} />
          </div>
        </>
      )}
    </div>
  );
}
