"use client";

import { useState, useTransition } from "react";
import { saveCompanySettings, type CompanySettingsFields } from "@/lib/company/save-company-settings";
import { lookupPostalAddress } from "@/lib/geo/postal-lookup";

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
  pdf_footer:               null,
  invoice_note:             null,
  tax_rate:                 10,
  bank_name:                null,
  bank_branch_name:         null,
  bank_branch_code:         null,
  account_type:             null,
  account_number:           null,
  account_holder_kana:      null,
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
    pdf_footer:               src.pdf_footer ?? "",
    invoice_note:             src.invoice_note ?? "",
    tax_rate:                 String(src.tax_rate ?? 10),
    bank_name:                src.bank_name ?? "",
    bank_branch_name:         src.bank_branch_name ?? "",
    bank_branch_code:         src.bank_branch_code ?? "",
    account_type:             src.account_type ?? "",
    account_number:           src.account_number ?? "",
    account_holder_kana:      src.account_holder_kana ?? "",
  });

  const [postalBusy, setPostalBusy] = useState(false);

  async function handlePostalLookup() {
    setPostalBusy(true);
    try {
      const addr = await lookupPostalAddress(values.postal_code);
      if (addr) {
        setValues((prev) => ({
          ...prev,
          business_address: `${addr.prefecture}${addr.city}${addr.town}`,
        }));
        setStatus("idle");
      }
    } finally {
      setPostalBusy(false);
    }
  }

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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">郵便番号</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="postal_code"
                value={values.postal_code}
                onChange={(e) => set("postal_code")(e.target.value)}
                placeholder="000-0000"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
              />
              <button
                type="button"
                onClick={handlePostalLookup}
                disabled={postalBusy}
                className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:border-blue-600 hover:text-blue-300 disabled:opacity-50 transition-colors"
              >
                {postalBusy ? "検索中…" : "住所自動入力"}
              </button>
            </div>
          </div>
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

      {/* ── 口座情報 ── */}
      <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">口座情報</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="銀行名" name="bank_name" value={values.bank_name} onChange={set("bank_name")} placeholder="〇〇銀行" />
          <Field label="支店名" name="bank_branch_name" value={values.bank_branch_name} onChange={set("bank_branch_name")} placeholder="〇〇支店" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="支店コード" name="bank_branch_code" value={values.bank_branch_code} onChange={set("bank_branch_code")} placeholder="000" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">口座種別</label>
            <select
              name="account_type"
              value={values.account_type}
              onChange={(e) => set("account_type")(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
            >
              <option value=""    className="bg-slate-900">未設定</option>
              <option value="普通" className="bg-slate-900">普通</option>
              <option value="当座" className="bg-slate-900">当座</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="口座番号" name="account_number" value={values.account_number} onChange={set("account_number")} placeholder="0000000" />
          <Field label="口座名義（カナ）" name="account_holder_kana" value={values.account_holder_kana} onChange={set("account_holder_kana")} placeholder="カ）ジーオン" />
        </div>
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
