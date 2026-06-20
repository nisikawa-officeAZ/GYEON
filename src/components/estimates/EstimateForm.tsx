"use client";

import { useState } from "react";
import { Estimate } from "@/types/estimate";
import { CUSTOMER_NAMES, VEHICLE_NAMES } from "./mockEstimates";

type FormState = {
  estimateNo: string;
  customerId: string;
  vehicleId: string;
  status: Estimate["status"];
  subtotal: string;
  tax: string;
  total: string;
};

const EMPTY_FORM: FormState = {
  estimateNo: "",
  customerId: "1",
  vehicleId: "1",
  status: "DRAFT",
  subtotal: "",
  tax: "",
  total: "",
};

interface EstimateFormProps {
  initial?: FormState;
  onCancel?: () => void;
}

export default function EstimateForm({ initial = EMPTY_FORM, onCancel }: EstimateFormProps) {
  const [form, setForm] = useState<FormState>(initial);

  const inputClass =
    "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";
  const disabledClass =
    "bg-[#0f172a] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed";
  const labelClass = "text-xs font-medium text-slate-400";

  return (
    <div className="flex flex-col gap-4">
      {/* Estimate No */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Estimate No</label>
        <input
          type="text"
          value={form.estimateNo}
          onChange={(e) => setForm((prev) => ({ ...prev, estimateNo: e.target.value }))}
          placeholder="EST-2024-001"
          className={inputClass}
        />
      </div>

      {/* Customer (disabled) */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Customer</label>
        <select disabled className={disabledClass}>
          {Object.entries(CUSTOMER_NAMES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <p className="text-[10px] text-slate-600">Select from Customers page</p>
      </div>

      {/* Vehicle (disabled) */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Vehicle</label>
        <select disabled className={disabledClass}>
          {Object.entries(VEHICLE_NAMES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <p className="text-[10px] text-slate-600">Select from Vehicles page</p>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Status</label>
        <select
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Estimate["status"] }))}
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
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Subtotal</label>
          <input
            type="number"
            value={form.subtotal}
            onChange={(e) => setForm((prev) => ({ ...prev, subtotal: e.target.value }))}
            placeholder="0"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Tax</label>
          <input
            type="number"
            value={form.tax}
            onChange={(e) => setForm((prev) => ({ ...prev, tax: e.target.value }))}
            placeholder="0"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Total</label>
          <input
            type="number"
            value={form.total}
            onChange={(e) => setForm((prev) => ({ ...prev, total: e.target.value }))}
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
