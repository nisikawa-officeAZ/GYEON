"use client";

// Phase 2 Sprint 5 — OCR session history viewer.
// Read-only list of previous OCR sessions with status, reviewed summary, and the
// resulting (linked) customer/vehicle records. Reuses dealer-scoped data fetched
// server-side; no OCR/customer/vehicle data is modified here.

import Link from "next/link";
import type { OcrSession } from "@/lib/ocr/ocr-session-types";
import type { CustomerDB } from "@/lib/customers/customer-types";
import { customerDisplayName } from "@/lib/customers/customer-types";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import { vehicleDisplayName } from "@/lib/vehicles/vehicle-types";
import { summarizeReviewedResult } from "@/lib/ocr/ocr-session-summary";
import OcrStatusBadge from "./OcrStatusBadge";

interface Props {
  sessions:    OcrSession[];
  customerMap: Record<string, CustomerDB>;
  vehicleMap:  Record<string, VehicleDB>;
}

function formatDateTime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export default function OcrSessionList({ sessions, customerMap, vehicleMap }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">OCRセッションの履歴はありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => {
        const customer = s.customer_id ? customerMap[s.customer_id] : undefined;
        const vehicle  = s.vehicle_id  ? vehicleMap[s.vehicle_id]   : undefined;

        return (
          <div key={s.id} className="bg-[#1e293b] rounded-xl shadow-lg p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <OcrStatusBadge status={s.status} />
                <span className="text-sm text-slate-200">{summarizeReviewedResult(s.reviewed_result)}</span>
              </div>
              <span className="text-[11px] text-slate-500">{formatDateTime(s.created_at)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              {/* Customer outcome */}
              <span className="flex items-center gap-1">
                <span className="text-slate-500">顧客:</span>
                {customer ? (
                  <Link href={`/customers/${customer.id}`} className="text-blue-300 hover:text-blue-200">
                    {customerDisplayName(customer) || "（氏名未登録）"}（既存リンク）
                  </Link>
                ) : s.customer_id ? (
                  <span className="text-amber-300">リンク先を確認できません</span>
                ) : (
                  <span className="text-slate-600">未リンク</span>
                )}
              </span>

              {/* Vehicle outcome */}
              <span className="flex items-center gap-1">
                <span className="text-slate-500">車両:</span>
                {vehicle ? (
                  <Link href={`/vehicles/${vehicle.id}`} className="text-blue-300 hover:text-blue-200">
                    {vehicleDisplayName(vehicle) || "車両"}（既存リンク）
                  </Link>
                ) : s.vehicle_id ? (
                  <span className="text-amber-300">リンク先を確認できません</span>
                ) : (
                  <span className="text-slate-600">未リンク</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
