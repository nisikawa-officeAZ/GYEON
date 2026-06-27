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

// Parse business metadata from occupation/notes (backward compatible with wizard encoding)
function parseBusinessInfo(c: CustomerDB) {
  const isBusiness   = (c.occupation ?? "").includes("業者");
  const rateMatch    = (c.notes ?? "").match(/業販掛け率:\s*(\d+)%/);
  const dealerRate   = rateMatch ? parseInt(rateMatch[1], 10) : 70;
  const termsMatch   = (c.notes ?? "").match(/与信条件:\s*([^\n]+)/);
  const creditTerms  = termsMatch ? termsMatch[1].trim() : "";
  const cleanNotes   = (c.notes ?? "")
    .replace(/業販掛け率:\s*\d+%\n?/, "")
    .replace(/与信条件:\s*[^\n]+\n?/, "")
    .trim();
  return { isBusiness, dealerRate, creditTerms, cleanNotes };
}

function fromDB(c: CustomerDB): FormFields {
  const { cleanNotes } = parseBusinessInfo(c);
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
    occupation:      (c.occupation ?? "").includes("業者") ? "" : (c.occupation ?? ""),
    notes:           cleanNotes,
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
  const parsed = customer ? parseBusinessInfo(customer) : null;
  const [form,        setForm]        = useState<FormFields>(customer ? fromDB(customer) : EMPTY);
  const [isBusiness,  setIsBusiness]  = useState(parsed?.isBusiness ?? false);
  const [dealerRate,  setDealerRate]  = useState(parsed?.dealerRate ?? 70);
  const [creditTerms, setCreditTerms] = useState(parsed?.creditTerms ?? "");
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

    // Encode business info into occupation and notes (same convention as EstimateWizard)
    const encodedOccupation = isBusiness ? "業者" : form.occupation;
    const metaLines: string[] = [];
    if (isBusiness) {
      metaLines.push(`業販掛け率: ${dealerRate}%`);
      if (creditTerms.trim()) metaLines.push(`与信条件: ${creditTerms.trim()}`);
    }
    const encodedNotes = metaLines.length > 0
      ? [...metaLines, form.notes].filter(Boolean).join("\n")
      : form.notes;

    (Object.keys(form) as (keyof FormFields)[]).forEach((k) => {
      if (k === "occupation") fd.set(k, encodedOccupation);
      else if (k === "notes") fd.set(k, encodedNotes);
      else fd.set(k, form[k]);
    });

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

  // ── スタイル定数（Genspark世界観 × PC向け） ─────────────────────────────────
  const card    = "bg-[#111827] rounded-2xl border border-white/[.08] p-5";
  const secHdr  = "text-[11px] font-bold text-slate-400 uppercase tracking-[1px] mb-3";
  const lbl     = "block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.5px] mb-1.5";
  const inp     = "w-full bg-[#1a2236] border border-white/[.08] rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-[#1e2a42] transition-colors";

  // ── 入力フィールドヘルパー ──────────────────────────────────────────────────
  function Field({
    label, fieldKey, type = "text", placeholder, required: req, children,
  }: {
    label: string; fieldKey?: keyof FormFields; type?: string;
    placeholder?: string; required?: boolean; children?: React.ReactNode;
  }) {
    return (
      <div>
        <label className={lbl}>
          {label}
          {req && <span className="text-red-400 normal-case tracking-normal font-bold ml-1">*</span>}
        </label>
        {children ?? (
          <input
            type={type}
            value={fieldKey ? form[fieldKey] : ""}
            onChange={(e) => fieldKey && set(fieldKey, e.target.value)}
            placeholder={placeholder}
            required={req}
            className={inp}
          />
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── 基本情報 ── */}
      <div className={card}>
        <div className={secHdr}>基本情報</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="姓" fieldKey="last_name" placeholder="山田" required />
          <Field label="名" fieldKey="first_name" placeholder="太郎" />
          <Field label="セイ" fieldKey="last_name_kana" placeholder="ヤマダ" />
          <Field label="メイ" fieldKey="first_name_kana" placeholder="タロウ" />
        </div>
      </div>

      {/* ── 連絡先 ＋ 住所（横2カラム） ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* 連絡先カード */}
        <div className={card}>
          <div className={secHdr}>連絡先</div>
          <div className="flex flex-col gap-4">
            <Field label="電話番号" fieldKey="phone" type="tel" placeholder="090-0000-0000" />
            <Field label="メール" fieldKey="email" type="email" placeholder="example@email.com" />
            <Field label="LINE ID" fieldKey="line_user_id" placeholder="Uxxxxxxxxxxxxxxxxxxx" />
          </div>
        </div>

        {/* 住所カード */}
        <div className={card}>
          <div className={secHdr}>住所</div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="郵便番号" fieldKey="postal_code" placeholder="000-0000" />
              <Field label="都道府県" fieldKey="prefecture" placeholder="東京都" />
            </div>
            <Field label="市区町村" fieldKey="city" placeholder="渋谷区" />
            <Field label="住所1" fieldKey="address1" placeholder="神宮前1-1-1" />
            <Field label="住所2" fieldKey="address2" placeholder="マンション名・部屋番号" />
          </div>
        </div>

      </div>

      {/* ── 業者フラグ ── */}
      <div className={card}>
        <div className={secHdr}>業者フラグ</div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setIsBusiness(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isBusiness ? "bg-amber-500" : "bg-slate-700"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isBusiness ? "translate-x-4" : "translate-x-1"}`} />
          </div>
          <span className="text-sm text-slate-300">業者顧客（業販対象）</span>
        </label>
        {isBusiness && (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label className={lbl}>業販掛け率 (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={dealerRate}
                  onChange={e => setDealerRate(Number(e.target.value))}
                  className={inp}
                />
                <span className="text-sm text-slate-400 shrink-0">%</span>
              </div>
            </div>
            <div>
              <label className={lbl}>与信条件</label>
              <input
                type="text"
                value={creditTerms}
                onChange={e => setCreditTerms(e.target.value)}
                placeholder="例: 月末締め翌月末払い"
                className={inp}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── メモ ── */}
      <div className={card}>
        <div className={secHdr}>メモ</div>
        <textarea
          name="notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="備考・メモ..."
          className={`${inp} resize-none`}
        />
      </div>

      {/* ── 追加項目トグル ── */}
      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="text-[12px] text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors self-start"
      >
        <span className="text-[10px]">{showExtra ? "▲" : "▼"}</span>
        {showExtra ? "追加項目を閉じる" : "追加項目（顧客コード・生年月日・性別・職業）"}
      </button>

      {/* ── 追加項目 ── */}
      {showExtra && (
        <div className={card}>
          <div className={secHdr}>追加項目</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="顧客コード" fieldKey="customer_code" placeholder="CUST-001" />
            <Field label="生年月日" fieldKey="birthday" type="date" />
            <Field label="性別">
              <select
                name="gender"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className={inp}
              >
                <option value="" className="bg-[#111827]">選択なし</option>
                <option value="male"   className="bg-[#111827]">男性</option>
                <option value="female" className="bg-[#111827]">女性</option>
                <option value="other"  className="bg-[#111827]">その他</option>
              </select>
            </Field>
            <Field label="職業" fieldKey="occupation" placeholder="会社員" />
          </div>
        </div>
      )}

      {/* ── アクションボタン ── */}
      <div className="flex justify-end gap-3 pt-1 border-t border-white/[.08]">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-5 py-2.5 text-sm font-medium text-slate-400 rounded-xl border border-white/[.08] hover:border-white/20 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-8 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 transition-colors disabled:opacity-40"
        >
          {pending ? "保存中..." : isEdit ? "更新" : "保存"}
        </button>
      </div>

    </form>
  );
}
