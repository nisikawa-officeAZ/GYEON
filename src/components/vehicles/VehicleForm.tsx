"use client";

import { useState, useTransition } from "react";
import { createVehicle } from "@/lib/vehicles/create-vehicle";
import { updateVehicle } from "@/lib/vehicles/update-vehicle";
import { VehicleDB }     from "@/lib/vehicles/vehicle-types";
import { CustomerDB }    from "@/lib/customers/customer-types";

interface FormFields {
  customer_id:   string;
  manufacturer:  string;
  model:         string;
  year:          string;
  grade:         string;
  body_color:    string;
  license_plate: string;
  vin:           string;
  memo:          string;
}

const EMPTY: FormFields = {
  customer_id: "", manufacturer: "", model: "", year: "",
  grade: "", body_color: "", license_plate: "", vin: "", memo: "",
};

function fromDB(v: VehicleDB): FormFields {
  return {
    customer_id:   v.customer_id      ?? "",
    manufacturer:  v.manufacturer     ?? "",
    model:         v.model            ?? "",
    year:          v.year             ?? "",
    grade:         v.grade            ?? "",
    body_color:    v.body_color       ?? "",
    license_plate: v.license_plate    ?? "",
    vin:           v.vin              ?? "",
    memo:          v.memo             ?? "",
  };
}

interface VehicleFormProps {
  vehicle?:   VehicleDB;           // present → edit mode
  customers:  CustomerDB[];        // for customer selector
  onCancel?:  () => void;
  onSuccess?: () => void;
}

export default function VehicleForm({ vehicle, customers, onCancel, onSuccess }: VehicleFormProps) {
  const isEdit = !!vehicle;
  const [form,    setForm]    = useState<FormFields>(vehicle ? fromDB(vehicle) : EMPTY);
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(key: keyof FormFields, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    (Object.keys(form) as (keyof FormFields)[]).forEach((k) => fd.set(k, form[k]));

    startTransition(async () => {
      const result = isEdit && vehicle
        ? await updateVehicle(vehicle.id, fd)
        : await createVehicle(fd);

      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onCancel?.();
      }
    });
  }

  const field = (
    label: string,
    key: keyof Omit<FormFields, "customer_id">,
    opts?: { placeholder?: string; required?: boolean }
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400">
        {label}
        {opts?.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type="text"
        name={key}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required}
        className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Customer selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400">
          Customer <span className="text-red-400 ml-1">*</span>
        </label>
        <select
          name="customer_id"
          value={form.customer_id}
          onChange={(e) => set("customer_id", e.target.value)}
          required
          className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors"
        >
          <option value="">Select customer...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.kana ? ` (${c.kana})` : ""}
            </option>
          ))}
        </select>
        {customers.length === 0 && (
          <p className="text-xs text-slate-500">No customers found. Create a customer first.</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("Manufacturer", "manufacturer", { placeholder: "Toyota" })}
        {field("Model",        "model",        { placeholder: "Alphard" })}
        {field("Year",         "year",         { placeholder: "2023" })}
        {field("Grade",        "grade",        { placeholder: "Executive Lounge" })}
        {field("Body Color",   "body_color",   { placeholder: "Pearl White" })}
        {field("License Plate","license_plate",{ placeholder: "品川 300 あ 1234" })}
        {field("VIN",          "vin",          { placeholder: "JT..." })}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400">Memo</label>
        <textarea
          name="memo"
          value={form.memo}
          onChange={(e) => set("memo", e.target.value)}
          rows={3}
          placeholder="Notes..."
          className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] resize-none transition-colors"
        />
      </div>

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
