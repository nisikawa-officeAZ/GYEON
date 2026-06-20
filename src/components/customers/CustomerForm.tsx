"use client";

import { useState } from "react";
import { Customer } from "@/types/customer";

type FormState = Omit<Customer, "id" | "createdAt" | "updatedAt">;

const EMPTY_FORM: FormState = {
  name: "",
  kana: "",
  phone: "",
  email: "",
  postalCode: "",
  address: "",
  lineId: "",
  memo: "",
};

interface CustomerFormProps {
  initial?: FormState;
  onCancel?: () => void;
}

export default function CustomerForm({ initial = EMPTY_FORM, onCancel }: CustomerFormProps) {
  const [form, setForm] = useState<FormState>(initial);

  const input = (
    label: string,
    key: keyof FormState,
    options?: { type?: string; placeholder?: string; required?: boolean }
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400">
        {label}
        {options?.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={options?.type ?? "text"}
        value={form[key] ?? ""}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder={options?.placeholder}
        className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {input("Name", "name", { placeholder: "山田 太郎", required: true })}
        {input("Kana", "kana", { placeholder: "ヤマダ タロウ" })}
        {input("Phone", "phone", { type: "tel", placeholder: "090-0000-0000" })}
        {input("Email", "email", { type: "email", placeholder: "example@email.com" })}
        {input("Postal Code", "postalCode", { placeholder: "000-0000" })}
        {input("LINE ID", "lineId", { placeholder: "line_id" })}
      </div>

      {input("Address", "address", { placeholder: "東京都渋谷区..." })}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400">Memo</label>
        <textarea
          value={form.memo ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
          rows={3}
          placeholder="Notes..."
          className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] resize-none transition-colors"
        />
      </div>

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
