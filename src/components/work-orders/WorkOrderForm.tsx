"use client";

import { useState, useTransition } from "react";
import { createWorkOrder } from "@/lib/work-orders/create-work-order";
import { updateWorkOrder } from "@/lib/work-orders/update-work-order";
import {
  WorkOrderDB,
  WorkOrderStatus,
  workOrderStatusLabel,
} from "@/lib/work-orders/work-order-types";
import { EstimateDB, estimateDisplayNo, estimateCustomerName } from "@/lib/estimates/estimate-types";
import { CustomerDB } from "@/lib/customers/customer-types";
import { VehicleDB }  from "@/lib/vehicles/vehicle-types";

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormFields {
  estimate_id:        string;
  customer_id:        string;
  vehicle_id:         string;
  work_order_number:  string;
  status:             WorkOrderStatus;
  title:              string;
  scheduled_start_at: string;
  scheduled_end_at:   string;
  actual_start_at:    string;
  actual_end_at:      string;
  assigned_staff:     string;
  service_summary:    string;
  notes:              string;
  internal_memo:      string;
}

const EMPTY: FormFields = {
  estimate_id:        "",
  customer_id:        "",
  vehicle_id:         "",
  work_order_number:  "",
  status:             "scheduled",
  title:              "",
  scheduled_start_at: "",
  scheduled_end_at:   "",
  actual_start_at:    "",
  actual_end_at:      "",
  assigned_staff:     "",
  service_summary:    "",
  notes:              "",
  internal_memo:      "",
};

function fromDB(wo: WorkOrderDB): FormFields {
  return {
    estimate_id:        wo.estimate_id        ?? "",
    customer_id:        wo.customer_id        ?? "",
    vehicle_id:         wo.vehicle_id         ?? "",
    work_order_number:  wo.work_order_number  ?? "",
    status:             wo.status,
    title:              wo.title              ?? "",
    scheduled_start_at: wo.scheduled_start_at ? wo.scheduled_start_at.slice(0, 16) : "",
    scheduled_end_at:   wo.scheduled_end_at   ? wo.scheduled_end_at.slice(0, 16)   : "",
    actual_start_at:    wo.actual_start_at    ? wo.actual_start_at.slice(0, 16)    : "",
    actual_end_at:      wo.actual_end_at      ? wo.actual_end_at.slice(0, 16)      : "",
    assigned_staff:     wo.assigned_staff     ?? "",
    service_summary:    wo.service_summary    ?? "",
    notes:              wo.notes              ?? "",
    internal_memo:      wo.internal_memo      ?? "",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: WorkOrderStatus[] = [
  'scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold',
];

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";
const labelClass = "text-xs font-medium text-slate-400";

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkOrderFormProps {
  workOrder?:       WorkOrderDB;
  estimates:        EstimateDB[];
  customers:        CustomerDB[];
  vehicles:         VehicleDB[];
  initialEstimateId?: string;   // pre-filled when launched from Estimate detail
  onCancel?:        () => void;
  onSuccess?:       () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkOrderForm({
  workOrder,
  estimates,
  customers,
  vehicles,
  initialEstimateId,
  onCancel,
  onSuccess,
}: WorkOrderFormProps) {
  const isEdit = !!workOrder;

  const [form, setForm] = useState<FormFields>(() => {
    if (workOrder) return fromDB(workOrder);
    if (initialEstimateId) {
      // Find the estimate and pre-fill customer/vehicle/title
      const est = estimates.find((e) => e.id === initialEstimateId);
      return {
        ...EMPTY,
        estimate_id: initialEstimateId,
        customer_id: est?.customer_id ?? "",
        vehicle_id:  est?.vehicle_id  ?? "",
        title:       est?.title ?? (est ? estimateDisplayNo(est) : ""),
      };
    }
    return EMPTY;
  });

  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // When estimate changes, auto-fill customer/vehicle/title.
  function handleEstimateChange(estimateId: string) {
    const est = estimates.find((e) => e.id === estimateId);
    set("estimate_id", estimateId);
    if (est) {
      set("customer_id", est.customer_id ?? "");
      set("vehicle_id",  est.vehicle_id  ?? "");
      if (!form.title) set("title", est.title ?? estimateDisplayNo(est));
    }
  }

  // Filter vehicles to those belonging to selected customer.
  const filteredVehicles = form.customer_id
    ? vehicles.filter((v) => v.customer_id === form.customer_id)
    : vehicles;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    (Object.keys(form) as (keyof FormFields)[]).forEach((k) => fd.set(k, form[k]));

    startTransition(async () => {
      const result = isEdit && workOrder
        ? await updateWorkOrder(workOrder.id, fd)
        : await createWorkOrder(fd);

      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onCancel?.();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── No & Status ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>作業番号</label>
          <input
            type="text"
            value={form.work_order_number}
            onChange={(e) => set("work_order_number", e.target.value)}
            placeholder="WO-2024-001"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>ステータス</label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as WorkOrderStatus)}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{workOrderStatusLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Linked Estimate ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>見積（紐付け）</label>
        <select
          value={form.estimate_id}
          onChange={(e) => handleEstimateChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— 紐付けなし —</option>
          {estimates.map((est) => (
            <option key={est.id} value={est.id}>
              {estimateDisplayNo(est)}
              {est.customers ? ` — ${estimateCustomerName(est.customers)}` : ""}
              {est.vehicles?.model ? ` / ${est.vehicles.model}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Title ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>タイトル</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="例: コーティング施工 山田様"
          className={inputClass}
        />
      </div>

      {/* ── Customer ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>顧客</label>
        <select
          value={form.customer_id}
          onChange={(e) => {
            set("customer_id", e.target.value);
            set("vehicle_id", "");
          }}
          className={inputClass}
        >
          <option value="">— 顧客を選択 —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.last_name, c.first_name].filter(Boolean).join(" ")}
              {(c.last_name_kana || c.first_name_kana)
                ? ` (${[c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ")})`
                : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Vehicle ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>車両</label>
        <select
          value={form.vehicle_id}
          onChange={(e) => set("vehicle_id", e.target.value)}
          disabled={!form.customer_id}
          className={inputClass}
        >
          <option value="">— 車両を選択 —</option>
          {filteredVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.maker, v.model, v.plate_number].filter(Boolean).join(" ") || v.id}
            </option>
          ))}
        </select>
        {!form.customer_id && (
          <p className="text-[10px] text-slate-600">先に顧客を選択してください。</p>
        )}
      </div>

      {/* ── Scheduled ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>施工予定</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">開始</span>
            <input
              type="datetime-local"
              value={form.scheduled_start_at}
              onChange={(e) => set("scheduled_start_at", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">終了</span>
            <input
              type="datetime-local"
              value={form.scheduled_end_at}
              onChange={(e) => set("scheduled_end_at", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Actual ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>実施工</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">開始</span>
            <input
              type="datetime-local"
              value={form.actual_start_at}
              onChange={(e) => set("actual_start_at", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">終了</span>
            <input
              type="datetime-local"
              value={form.actual_end_at}
              onChange={(e) => set("actual_end_at", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Assigned Staff ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>担当者</label>
        <input
          type="text"
          value={form.assigned_staff}
          onChange={(e) => set("assigned_staff", e.target.value)}
          placeholder="担当者名"
          className={inputClass}
        />
      </div>

      {/* ── Service Summary ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>作業概要</label>
        <textarea
          value={form.service_summary}
          onChange={(e) => set("service_summary", e.target.value)}
          rows={3}
          placeholder="施工内容の概要..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* ── Notes & Internal Memo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>備考（顧客向け）</label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="備考・メモ..."
            className={`${inputClass} resize-none`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>内部メモ</label>
          <textarea
            value={form.internal_memo}
            onChange={(e) => set("internal_memo", e.target.value)}
            rows={3}
            placeholder="社内向けメモ..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* ── Buttons ── */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "Saving..." : isEdit ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
}
