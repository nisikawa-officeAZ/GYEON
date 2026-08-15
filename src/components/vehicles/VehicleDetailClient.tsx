"use client";

// Phase 2 Sprint 3 — Vehicle Detail view.
// Composes existing building blocks (VehicleForm) with the new derived
// status/tags and the service-history foundation. No UI redesign of reused parts.
//
// Customer ↔ Vehicle relationship: the owning customer is resolved server-side
// with a dealer-scoped query (see the page). If the vehicle references a customer
// that does not resolve within this dealer, a verification warning is shown.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import { vehicleDisplayName } from "@/lib/vehicles/vehicle-types";
import type { CustomerDB } from "@/lib/customers/customer-types";
import { customerDisplayName } from "@/lib/customers/customer-types";
import VehicleForm from "@/components/vehicles/VehicleForm";
import VehicleStatusBadge from "@/components/vehicles/VehicleStatusBadge";
import VehicleTagList from "@/components/vehicles/VehicleTagList";
import VehicleServiceHistory from "@/components/vehicles/VehicleServiceHistory";

interface Props {
  vehicle:   VehicleDB;
  customers: CustomerDB[];
  owner:     CustomerDB | null;
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

export default function VehicleDetailClient({ vehicle, customers, owner }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const title = vehicleDisplayName(vehicle) || "車両";
  // The vehicle references a customer that could not be resolved within this dealer.
  const relationshipBroken = !!vehicle.customer_id && !owner;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4">

      {/* Back link */}
      <Link href="/vehicles" className="text-xs text-slate-400 hover:text-slate-200 transition-colors self-start">
        ← 車両一覧
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-100">{title}</h1>
            <VehicleStatusBadge vehicle={vehicle} />
          </div>
          {vehicle.plate_number && <p className="text-xs text-slate-500 font-mono">{vehicle.plate_number}</p>}
          <VehicleTagList vehicle={vehicle} />
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-white bg-[#1d4ed8] hover:bg-[#1e40af] px-4 py-2 rounded-lg transition-colors"
          >
            編集
          </button>
        )}
      </div>

      {/* Owner (customer ↔ vehicle relationship) */}
      <div className={card}>
        <div className={secHdr}>所有者</div>
        {owner ? (
          <Link
            href={`/customers/${owner.id}`}
            className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 transition-colors"
          >
            {customerDisplayName(owner) || "（氏名未登録）"}
            <span className="text-xs">→</span>
          </Link>
        ) : relationshipBroken ? (
          <p className="text-xs text-amber-300">
            ⚠ 紐付く顧客を同一ディーラー内で確認できませんでした。顧客情報をご確認ください。
          </p>
        ) : (
          <p className="text-xs text-slate-600">顧客が紐付いていません</p>
        )}
      </div>

      {editing ? (
        <VehicleForm
          vehicle={vehicle}
          customers={customers}
          onCancel={() => setEditing(false)}
          onSuccess={() => { setEditing(false); router.refresh(); }}
        />
      ) : (
        <>
          {/* Profile */}
          <div className={card}>
            <div className={secHdr}>車両情報</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <InfoRow label="メーカー"   value={vehicle.maker ?? ""} />
              <InfoRow label="車種"       value={vehicle.model ?? ""} />
              <InfoRow label="グレード"   value={vehicle.grade ?? ""} />
              <InfoRow label="年式"       value={vehicle.year ?? ""} />
              <InfoRow label="色"         value={vehicle.color ?? ""} />
              <InfoRow label="ナンバー"   value={vehicle.plate_number ?? ""} />
              <InfoRow label="車台番号"   value={vehicle.vin ?? ""} />
              <InfoRow label="ボディ"     value={vehicle.body_size ?? ""} />
              <InfoRow label="燃料"       value={vehicle.fuel_type ?? ""} />
              <InfoRow label="排気量"     value={vehicle.displacement ?? ""} />
              <InfoRow label="走行距離"   value={vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()}km` : ""} />
              <InfoRow label="初年度登録" value={vehicle.registration_date ?? ""} />
              <InfoRow label="車検満了日" value={vehicle.inspection_expiry_date ?? ""} />
            </div>
            {vehicle.notes && (
              <div className="mt-4 pt-3 border-t border-white/[.06]">
                <p className="text-[11px] text-slate-500 mb-1">メモ</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{vehicle.notes}</p>
              </div>
            )}
          </div>

          {/* Service history foundation */}
          <div className={card}>
            <div className={secHdr}>サービス履歴</div>
            <VehicleServiceHistory vehicleId={vehicle.id} />
          </div>
        </>
      )}
    </div>
  );
}
