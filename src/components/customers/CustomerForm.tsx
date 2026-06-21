"use client";

import { useState, useTransition } from "react";
import { createCustomer } from "@/lib/customers/create-customer";
import { updateCustomer } from "@/lib/customers/update-customer";
import { CustomerDB }     from "@/lib/customers/customer-types";

interface FormFields {
  customer_code:   string;
  last_name:       string;
  first_name:      string;
  last_name_kana:  string;
  first_name_kana: string;
  phone:           string;
  email:           string;
  postal_code:     string;
  prefecture:      string;
  city:            string;
  address1:        string;
  address2:        string;
  birthday:        string;
  gender:          string;
  occupation:      string;
  notes:           string;
  line_user_id:    string;
}

const EMPTY: FormFields = {
  customer_code: "", last_name: "", first_name: "",
  last_name_kana: "", first_name_kana: "",
  phone: "", email: "", postal_code: "",
  prefecture: "", city: "", address1: "", address2: "",
  birthday: "", gender: "", occupation: "",
  notes: "", line_user_id: "",
};

function fromDB(c: CustomerDB): FormFields {
  return {
    customer_code:   c.customer_code   ?? "",
    last_name:       c.last_name        ?? "",
    first_name:      c.first_name       ?? "",
    last_name_kana:  c.last_name_kana   ?? "",
    first_name_kana: c.first_name_kana  ?? "",
    phone:           c.phone            ?? "",
    email:           c.email            ?? "",
    postal_code:     c.postal_code      ?? "",
    prefecture:      c.prefecture       ?? "",
    city:            c.city             ?? "",
    address1:        c.address1         ?? "",
    address2:        c.address2         ?? "",
    birthday:        c.birthday         ?? "",
    gender:          c.gender           ?? "",
    occupation:      c.occupation       ?? "",
    notes:           c.notes            ?? "",
    line_user_id:    c.line_user_id     ?? "",
  };
}

interface CustomerFormProps {
  customer?:  CustomerDB;
  onCancel?:  () => void;
  onSuccess?: () => void;
}

export default function CustomerForm({ customer, onCancel, onSuccess }: CustomerFormProps) {
  const isEdit = !!customer;
  const [form,        setForm]        = useState<FormFields>(customer ? fromDB(customer) : EMPTY);
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

  const inputClass =
    "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";

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

      {/* 姓名 */}
      <div className="grid grid-cols-2 gap-3">
        {field("姓 (Last Name)",  "last_name",  { placeholder: "山田",   required: true })}
        {field("名 (First Name)", "first_name", { placeholder: "太郎" })}
      </div>

      {/* セイメイ */}
      <div className="grid grid-cols-2 gap-3">
        {field("セイ", "last_name_kana",  { placeholder: "ヤマダ" })}
        {field("メイ", "first_name_kana", { placeholder: "タロウ" })}
      </div>

      {/* 連絡先 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("電話番号", "phone", { type: "tel",   placeholder: "090-0000-0000" })}
        {field("メール",   "email", { type: "email", placeholder: "example@email.com" })}
      </div>

      {/* 住所 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field("郵便番号", "postal_code", { placeholder: "000-0000" })}
        {field("都道府県", "prefecture",  { placeholder: "東京都" })}
        {field("市区町村", "city",        { placeholder: "渋谷区" })}
      </div>
      {field("住所1", "address1", { placeholder: "神宮前1-1-1" })}
      {field("住所2", "address2", { placeholder: "マンション名・部屋番号 など" })}

      {/* LINE */}
      {field("LINE ユーザーID", "line_user_id", { placeholder: "Uxxxxxxxxxxxxxxxxxxx" })}

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
        {showExtra ? "追加項目を閉じる" : "追加項目を表示（顧客コード・生年月日・性別・職業）"}
      </button>

      {showExtra && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-700/50 pt-4">
          {field("顧客コード",  "customer_code", { placeholder: "CUST-001" })}
          {field("生年月日",    "birthday",      { type: "date" })}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">性別</label>
            <select
              name="gender"
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              className={inputClass}
            >
              <option value="">選択なし</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </div>
          {field("職業", "occupation", { placeholder: "会社員" })}
        </div>
      )}

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
