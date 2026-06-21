"use client";

import { useState, useTransition } from "react";
import { saveCompanySettings, type CompanySettingsFields } from "@/lib/company/save-company-settings";

interface Props {
  initialSettings: CompanySettingsFields | null;
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  hint?: string;
}

function Field({ label, name, value, onChange, placeholder, type = "text", multiline, hint }: FieldProps) {
  const base =
    "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "未設定"}
          rows={3}
          className={base + " resize-none"}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "未設定"}
          className={base}
        />
      )}
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

const EMPTY: CompanySettingsFields = {
  business_name:            null,
  company_name:             null,
  postal_code:              null,
  business_address:         null,
  business_phone:           null,
  business_email:           null,
  business_website:         null,
  contact_name:             null,
  qualified_invoice_number: null,
  logo_url:                 null,
  stamp_url:                null,
  pdf_footer:               null,
  invoice_note:             null,
  tax_rate:                 10,
};

export default function CompanySettingsForm({ initialSettings }: Props) {
  const src = initialSettings ?? EMPTY;
  const [values, setValues] = useState({
    business_name:            src.business_name ?? "",
    company_name:             src.company_name ?? "",
    postal_code:              src.postal_code ?? "",
    business_address:         src.business_address ?? "",
    business_phone:           src.business_phone ?? "",
    business_email:           src.business_email ?? "",
    business_website:         src.business_website ?? "",
    contact_name:             src.contact_name ?? "",
    qualified_invoice_number: src.qualified_invoice_number ?? "",
    logo_url:                 src.logo_url ?? "",
    stamp_url:                src.stamp_url ?? "",
    pdf_footer:               src.pdf_footer ?? "",
    invoice_note:             src.invoice_note ?? "",
    tax_rate:                 String(src.tax_rate ?? 10),
  });

  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set(key: keyof typeof values) {
    return (v: string) => {
      setValues((prev) => ({ ...prev, [key]: v }));
      setStatus("idle");
    };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveCompanySettings(fd);
      if ("error" in result) {
        setStatus("error");
        setErrorMsg(result.error);
      } else {
        setStatus("saved");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-5">
      {/* ── 基本情報 ── */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">基本情報</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="店舗名" name="business_name" value={values.business_name} onChange={set("business_name")} />
          <Field label="会社名" name="company_name" value={values.company_name} onChange={set("company_name")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="郵便番号" name="postal_code" value={values.postal_code} onChange={set("postal_code")} placeholder="000-0000" />
          <Field label="担当者名" name="contact_name" value={values.contact_name} onChange={set("contact_name")} />
        </div>
        <Field label="住所" name="business_address" value={values.business_address} onChange={set("business_address")} />
      </div>

      {/* ── 連絡先 ── */}
      <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">連絡先</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="電話番号" name="business_phone" value={values.business_phone} onChange={set("business_phone")} type="tel" />
          <Field label="メールアドレス" name="business_email" value={values.business_email} onChange={set("business_email")} type="email" />
        </div>
        <Field label="Webサイト" name="business_website" value={values.business_website} onChange={set("business_website")} type="url" placeholder="https://example.com" />
      </div>

      {/* ── 書類・税務 ── */}
      <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">書類・税務</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="適格請求書番号"
            name="qualified_invoice_number"
            value={values.qualified_invoice_number}
            onChange={set("qualified_invoice_number")}
            placeholder="T0000000000000"
            hint="インボイス制度の登録番号"
          />
          <Field
            label="消費税率 (%)"
            name="tax_rate"
            value={values.tax_rate}
            onChange={set("tax_rate")}
            type="number"
            placeholder="10"
            hint="例: 10（標準税率）、8（軽減税率）"
          />
        </div>
        <Field label="見積書フッター" name="pdf_footer" value={values.pdf_footer} onChange={set("pdf_footer")} multiline />
        <Field label="請求書備考" name="invoice_note" value={values.invoice_note} onChange={set("invoice_note")} multiline />
      </div>

      {/* ── 画像URL ── */}
      <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">画像URL</p>
        <Field label="ロゴURL" name="logo_url" value={values.logo_url} onChange={set("logo_url")} type="url" placeholder="https://example.com/logo.png" />
        <Field label="印影URL" name="stamp_url" value={values.stamp_url} onChange={set("stamp_url")} type="url" placeholder="https://example.com/stamp.png" />
      </div>

      {/* ── 保存 ── */}
      <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
        {status === "saved" && (
          <span className="text-xs text-green-400 font-medium">保存しました</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-400">{errorMsg || "保存に失敗しました"}</span>
        )}
        {!initialSettings && status === "idle" && (
          <span className="text-xs text-slate-600">DB未接続のため保存できない場合があります</span>
        )}
      </div>
    </form>
  );
}
