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
    "w-full min-h-12 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-4 py-3 text-sm text-[#edf3fc] placeholder:text-[#526079] transition-all focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-[#a9b7cc]">{label}</label>
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
      {hint && <p className="text-[10px] leading-5 text-[#70809b]">{hint}</p>}
    </div>
  );
}

function SectionTitle({ label, labelEn }: { label: string; labelEn: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-[#20304a] pb-4">
      <div>
        <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">{labelEn}</p>
        <h2 className="mt-1 text-[16px] font-bold text-[#e8eef7]">{label}</h2>
      </div>
      <span className="h-px flex-1 bg-[#20304a]" />
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── 基本情報 ── */}
      <section className="flex flex-col gap-5 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
        <SectionTitle label="基本情報" labelEn="STORE PROFILE" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="店舗名" name="business_name" value={values.business_name} onChange={set("business_name")} />
          <Field label="会社名" name="company_name" value={values.company_name} onChange={set("company_name")} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#a9b7cc]">郵便番号</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="postal_code"
                value={values.postal_code}
                onChange={(e) => set("postal_code")(e.target.value)}
                placeholder="000-0000"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-4 py-3 text-sm text-[#edf3fc] placeholder:text-[#526079] transition-all focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20"
              />
              <button
                type="button"
                onClick={handlePostalLookup}
                disabled={postalBusy}
                className="min-h-12 shrink-0 rounded-xl border border-[#31568c] bg-[#122142] px-4 text-xs font-semibold text-[#91b9ff] transition-colors hover:border-[#4a7fc8] hover:text-[#c4d8ff] disabled:opacity-50"
              >
                {postalBusy ? "検索中…" : "住所自動入力"}
              </button>
            </div>
          </div>
          <Field label="担当者名" name="contact_name" value={values.contact_name} onChange={set("contact_name")} />
        </div>
        <Field label="住所" name="business_address" value={values.business_address} onChange={set("business_address")} />
      </section>

      {/* ── 連絡先 ── */}
      <section className="flex flex-col gap-5 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
        <SectionTitle label="連絡先" labelEn="CONTACT" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="電話番号" name="business_phone" value={values.business_phone} onChange={set("business_phone")} type="tel" />
          <Field label="メールアドレス" name="business_email" value={values.business_email} onChange={set("business_email")} type="email" />
        </div>
        <Field label="Webサイト" name="business_website" value={values.business_website} onChange={set("business_website")} type="url" placeholder="https://example.com" />
      </section>

      {/* ── 書類・税務 ── */}
      <section className="flex flex-col gap-5 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
        <SectionTitle label="書類・税務" labelEn="DOCUMENTS & TAX" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </section>

      {/* ── 口座情報 ── */}
      <section className="flex flex-col gap-5 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
        <SectionTitle label="口座情報" labelEn="BANK ACCOUNT" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="銀行名" name="bank_name" value={values.bank_name} onChange={set("bank_name")} placeholder="〇〇銀行" />
          <Field label="支店名" name="bank_branch_name" value={values.bank_branch_name} onChange={set("bank_branch_name")} placeholder="〇〇支店" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="支店コード" name="bank_branch_code" value={values.bank_branch_code} onChange={set("bank_branch_code")} placeholder="000" />
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#a9b7cc]">口座種別</label>
            <input type="hidden" name="account_type" value={values.account_type} />
            <div className="grid min-h-12 grid-cols-3 gap-2" role="group" aria-label="口座種別">
              {[{ value: "", label: "未設定" }, { value: "普通", label: "普通" }, { value: "当座", label: "当座" }].map((option) => {
                const selected = values.account_type === option.value;
                return (
                  <button
                    key={option.value || "unset"}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => set("account_type")(option.value)}
                    className={selected
                      ? "rounded-xl border border-[#3478ff] bg-[#17336d] px-3 text-xs font-semibold text-[#b9d0ff]"
                      : "rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-3 text-xs font-semibold text-[#8191ad] transition-colors hover:border-[#4a7fc8] hover:text-[#b9d0ff]"}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="口座番号" name="account_number" value={values.account_number} onChange={set("account_number")} placeholder="0000000" />
          <Field label="口座名義（カナ）" name="account_holder_kana" value={values.account_holder_kana} onChange={set("account_holder_kana")} placeholder="カ）ジーオン" />
        </div>
      </section>

      {/* ── 保存 ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:px-6">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-[#2f6bff] px-6 text-sm font-bold text-white shadow-[0_10px_28px_rgba(47,107,255,.24)] transition-colors hover:bg-[#3977ff] disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
        {status === "saved" && (
          <span className="text-xs font-medium text-emerald-400">保存しました</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-400">{errorMsg || "保存に失敗しました"}</span>
        )}
        {!initialSettings && status === "idle" && (
          <span className="text-xs text-[#70809b]">DB未接続のため保存できない場合があります</span>
        )}
      </div>
    </form>
  );
}
