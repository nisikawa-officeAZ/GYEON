"use client";

import { useState, useTransition } from "react";
import { createEstimate } from "@/lib/estimates/create-estimate";
import { updateEstimate } from "@/lib/estimates/update-estimate";
import { EstimateDB, EstimateStatus } from "@/lib/estimates/estimate-types";
import { CustomerDB } from "@/lib/customers/customer-types";
import { VehicleDB }  from "@/lib/vehicles/vehicle-types";

interface FormFields {
  customer_id: string;
  vehicle_id:  string;
  estimate_no: string;
  status:      EstimateStatus;
  subtotal:    string;
  tax:         string;
  total:       string;
}

const EMPTY: FormFields = {
  customer_id: "",
  vehicle_id:  "",
  estimate_no: "",
  status:      "DRAFT",
  subtotal:    "0",
  tax:         "0",
  total:       "0",
};

function fromDB(e: EstimateDB): FormFields {
  return {
    customer_id: e.customer_id,
    vehicle_id:  e.vehicle_id,
    estimate_no: e.estimate_no,
    status:      e.status,
    subtotal:    String(e.subtotal),
    tax:         String(e.tax),
    total:       String(e.total),
  };
}

interface EstimateFormProps {
  estimate?:  EstimateDB;
  customers:  CustomerDB[];
  vehicles:   VehicleDB[];
  onCancel?:  () => void;
  onSuccess?: () => void;
}

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";
const labelClass = "text-xs font-medium text-slate-400";

export default function EstimateForm({
  estimate, customers, vehicles, onCancel, onSuccess,
}: EstimateFormProps) {
  const isEdit = !!estimate;
  const [form,    setForm]    = useState<FormFields>(estimate ? fromDB(estimate) : EMPTY);
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Filter vehicles to only those belonging to the selected customer
  const filteredVehicles = form.customer_id
    ? vehicles.filter((v) => v.customer_id === form.customer_id)
    : vehicles;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    (Object.keys(form) as (keyof FormFields)[]).forEach((k) => fd.set(k, form[k]));

    startTransition(async () => {
      const result = isEdit && estimate
        ? await updateEstimate(estimate.id, fd)
        : await createEstimate(fd);

      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onCancel?.();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Estimate No */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
          Estimate No <span className="text-red-400 ml-1">*</span>
        </label>
        <input
          type="text"
          name="estimate_no"
          value={form.estimate_no}
          onChange={(e) => set("estimate_no", e.target.value)}
          placeholder="EST-2024-001"
          required
          className={inputClass}
        />
      </div>

      {/* Customer */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
          Customer <span className="text-red-400 ml-1">*</span>
        </label>
        <select
          name="customer_id"
          value={form.customer_id}
          onChange={(e) => {
            set("customer_id", e.target.value);
            set("vehicle_id", ""); // reset vehicle when customer changes
          }}
          required
          className={inputClass}
        >
          <option value="">Select customer...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.last_name, c.first_name].filter(Boolean).join(" ")}
              {(c.last_name_kana || c.first_name_kana)
                ? ` (${[c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ")})`
                : ""}
            </option>
          ))}
        </select>
        {customers.length === 0 && (
          <p className="text-[10px] text-slate-600">No customers found. Create a customer first.</p>
        )}
      </div>

      {/* Vehicle */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
          Vehicle <span className="text-red-400 ml-1">*</span>
        </label>
        <select
          name="vehicle_id"
          value={form.vehicle_id}
          onChange={(e) => set("vehicle_id", e.target.value)}
          required
          disabled={!form.customer_id}
          className={inputClass}
        >
          <option value="">Select vehicle...</option>
          {filteredVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.manufacturer, v.model, v.year].filter(Boolean).join(" ") || v.id}
            </option>
          ))}
        </select>
        {form.customer_id && filteredVehicles.length === 0 && (
          <p className="text-[10px] text-slate-600">No vehicles for this customer. Create a vehicle first.</p>
        )}
        {!form.customer_id && (
          <p className="text-[10px] text-slate-600">Select a customer first.</p>
        )}
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Status</label>
        <select
          name="status"
          value={form.status}
          onChange={(e) => set("status", e.target.value as EstimateStatus)}
          className={inputClass}
        >
          <option value="DRAFT">DRAFT</option>
          <option value="SENT">SENT</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["subtotal", "tax", "total"] as const).map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <label className={labelClass}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
            <input
              type="number"
              name={key}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              min="0"
              placeholder="0"
              className={inputClass}
            />
          </div>
        ))}
      </div>

      {/* Buttons */}
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
