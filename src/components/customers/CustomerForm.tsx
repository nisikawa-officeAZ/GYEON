"use client";

import { useState, useTransition } from "react";
import { createCustomer } from "@/lib/customers/create-customer";
import { updateCustomer } from "@/lib/customers/update-customer";
import { CustomerDB }     from "@/lib/customers/customer-types";

interface FormFields {
  name:        string;
  kana:        string;
  phone:       string;
  email:       string;
  postal_code: string;
  address:     string;
  line_id:     string;
  memo:        string;
}

const EMPTY: FormFields = {
  name: "", kana: "", phone: "", email: "",
  postal_code: "", address: "", line_id: "", memo: "",
};

function fromDB(c: CustomerDB): FormFields {
  return {
    name:        c.name          ?? "",
    kana:        c.kana          ?? "",
    phone:       c.phone         ?? "",
    email:       c.email         ?? "",
    postal_code: c.postal_code   ?? "",
    address:     c.address       ?? "",
    line_id:     c.line_id       ?? "",
    memo:        c.memo          ?? "",
  };
}

interface CustomerFormProps {
  customer?:  CustomerDB;   // present → edit mode
  onCancel?:  () => void;
  onSuccess?: () => void;
}

export default function CustomerForm({ customer, onCancel, onSuccess }: CustomerFormProps) {
  const isEdit = !!customer;
  const [form,    setForm]    = useState<FormFields>(customer ? fromDB(customer) : EMPTY);
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
      const result = isEdit && customer
        ? await updateCustomer(customer.id, fd)
        : await createCustomer(fd);

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
    key: keyof FormFields,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("Name",        "name",        { placeholder: "山田 太郎",        required: true })}
        {field("Kana",        "kana",        { placeholder: "ヤマダ タロウ" })}
        {field("Phone",       "phone",       { type: "tel",   placeholder: "090-0000-0000" })}
        {field("Email",       "email",       { type: "email", placeholder: "example@email.com" })}
        {field("Postal Code", "postal_code", { placeholder: "000-0000" })}
        {field("LINE ID",     "line_id",     { placeholder: "line_id" })}
      </div>

      {field("Address", "address", { placeholder: "東京都渋谷区..." })}

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
