"use client";

import { useSearchParams, useRouter } from "next/navigation";
import MaintenanceReminderForm from "@/components/maintenance/MaintenanceReminderForm";

export default function NewReminderForm() {
  const router = useRouter();
  const params = useSearchParams();

  const customerId   = params.get("customer_id")   ?? "";
  const vehicleId    = params.get("vehicle_id")    ?? undefined;
  const workOrderId  = params.get("work_order_id") ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-semibold text-slate-100">メンテナンス予定を作成</h1>
      </div>

      {!customerId && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
          <p className="text-xs text-red-400">customer_id が指定されていません</p>
        </div>
      )}

      {customerId && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6">
          <MaintenanceReminderForm
            prefill={{
              customer_id:   customerId   || undefined,
              vehicle_id:    vehicleId    || null,
              work_order_id: workOrderId  || null,
            }}
            onSaved={(saved) => {
              router.push(`/maintenance/${saved.id}`);
            }}
            onCancel={() => router.back()}
          />
        </div>
      )}
    </div>
  );
}
