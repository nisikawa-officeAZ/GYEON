"use client";

import { useState, useTransition } from "react";
import { createVehicle } from "@/lib/vehicles/create-vehicle";
import { updateVehicle } from "@/lib/vehicles/update-vehicle";
import { VehicleDB }     from "@/lib/vehicles/vehicle-types";
import { CustomerDB }    from "@/lib/customers/customer-types";

interface FormFields {
  customer_id:            string;
  vehicle_code:           string;
  maker:                  string;
  model:                  string;
  grade:                  string;
  year:                   string;
  body_size:              string;
  color:                  string;
  plate_number:           string;
  vin:                    string;
  mileage:                string;
  inspection_expiry_date: string;
  notes:                  string;
}

const EMPTY: FormFields = {
  customer_id: "", vehicle_code: "", maker: "", model: "",
  grade: "", year: "", body_size: "", color: "",
  plate_number: "", vin: "", mileage: "", inspection_expiry_date: "", notes: "",
};

function fromDB(v: VehicleDB): FormFields {
  return {
    customer_id:            v.customer_id              ?? "",
    vehicle_code:           v.vehicle_code             ?? "",
    maker:                  v.maker                    ?? "",
    model:                  v.model                    ?? "",
    grade:                  v.grade                    ?? "",
    year:                   v.year                     ?? "",
    body_size:              v.body_size                ?? "",
    color:                  v.color                    ?? "",
    plate_number:           v.plate_number             ?? "",
    vin:                    v.vin                      ?? "",
    mileage:                v.mileage != null ? String(v.mileage) : "",
    inspection_expiry_date: v.inspection_expiry_date   ?? "",
    notes:                  v.notes                    ?? "",
  };
}

const BODY_SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"];

interface VehicleFormProps {
  vehicle?:   VehicleDB;
  customers:  CustomerDB[];
  onCancel?:  () => void;
  onSuccess?: () => void;
}

export default function VehicleForm({ vehicle, customers, onCancel, onSuccess }: VehicleFormProps) {
  const isEdit = !!vehicle;
  const [form,        setForm]        = useState<FormFields>(vehicle ? fromDB(vehicle) : EMPTY);
  const [showExtra,   setShowExtra]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();

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

  const inputClass =
    "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";

  const field = (
    label: string,
    key: keyof Omit<FormFields, "customer_id">,
    opts?: { type?: string; placeholder?: string; required?: boolean }
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400">
        {label}
        {opts?.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={opts?.type ?? "text"}
        name={key}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required}
        className={inputClass}
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

      {/* 顧客 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400">
          顧客 <span className="text-red-400 ml-1">*</span>
        </label>
        <select
          name="customer_id"
          value={form.customer_id}
          onChange={(e) => set("customer_id", e.target.value)}
          required
          className={inputClass}
        >
          <option value="">顧客を選択...</option>
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
          <p className="text-xs text-slate-500">顧客が登録されていません。先に顧客を作成してください。</p>
        )}
      </div>

      {/* メーカー・車種・グレード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("メーカー",  "maker",  { placeholder: "Toyota" })}
        {field("車種",      "model",  { placeholder: "Alphard" })}
        {field("グレード",  "grade",  { placeholder: "Executive Lounge" })}
        {field("年式",      "year",   { placeholder: "2023" })}
      </div>

      {/* ボディサイズ */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400">ボディサイズ</label>
        <select
          name="body_size"
          value={form.body_size}
          onChange={(e) => set("body_size", e.target.value)}
          className={inputClass}
        >
          <option value="">選択なし</option>
          {BODY_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* 色・ナンバー */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("ボディカラー", "color",        { placeholder: "パールホワイト" })}
        {field("ナンバー",     "plate_number", { placeholder: "品川 300 あ 1234" })}
      </div>

      {/* 車台番号・走行距離 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("車台番号 (VIN)", "vin",     { placeholder: "JT..." })}
        {field("走行距離 (km)",  "mileage", { type: "number", placeholder: "15000" })}
      </div>

      {/* 車検満了日 */}
      {field("車検満了日", "inspection_expiry_date", { type: "date" })}

      {/* メモ */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400">メモ</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="備考・メモ..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* 追加項目トグル */}
      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors self-start"
      >
        <span>{showExtra ? "▲" : "▼"}</span>
        {showExtra ? "追加項目を閉じる" : "追加項目を表示（車両コード）"}
      </button>

      {showExtra && (
        <div className="border-t border-slate-700/50 pt-4">
          {field("車両コード", "vehicle_code", { placeholder: "VH-001" })}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "保存中..." : isEdit ? "更新" : "保存"}
        </button>
      </div>
    </form>
  );
}
