"use client";

// Estimate Wizard Ver2.2 — Step 1 顧客登録 (presentation-only).
//
// Implements the approved GenSpark Ver2.2 customer screen, driven ENTIRELY by props that
// map 1:1 to EstimateEditor's existing customer state + handlers. This component holds no
// business state and performs no pricing/OCR/save logic — it calls the owner's handlers.
// Default registration method = 手入力（新規顧客登録）(Ver2.2). Business/credit are two
// independent toggles mapped to the existing `isBusiness` / `arAllowed` state.

import { customerDisplayName } from "@/lib/customers/customer-types";
import { SelectButton, ToggleButton } from "../foundation/SelectButton";
import { Field, TextInput } from "../foundation/Field";
import { cn } from "../foundation/tokens";
import type { Step1CustomerProps, CustomerMode } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4";

// registration method → existing customerMode / OCR
type Method = "manual" | "ocr" | "search";
const METHODS: Array<{ id: Method; label: string; sub: string }> = [
  { id: "manual", label: "手入力（新規顧客登録）", sub: "既定" },
  { id: "ocr",    label: "車検証OCR",            sub: "写真/PDF から読み取り" },
  { id: "search", label: "既存顧客を検索",        sub: "登録済みから選択" },
];

export function Step1Customer(props: Step1CustomerProps) {
  const {
    customerMode, onSetCustomerMode, onOpenOcr,
    customerId, onSelectCustomer, customers,
    nc, onChangeNc, onCreateCustomer, creatingCustomer,
    lineBusinessConfigured = false,
  } = props;

  // present the 3 Ver2.2 methods on top of the existing 2-mode state + OCR entry
  const method: Method = customerMode === "select" ? "search" : "manual";
  const pick = (m: Method) => {
    if (m === "ocr") { onOpenOcr(); return; }
    onSetCustomerMode(m === "search" ? "select" : "new");
  };

  return (
    <div className={CARD}>
      <h3 className={SECHDR}>顧客登録</h3>

      {/* 登録方式（既定 = 手入力）*/}
      <Field label="登録方式" required value={method}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <SelectButton
              key={m.id}
              selected={m.id === "ocr" ? false : method === m.id}
              subLabel={m.sub}
              onSelect={() => pick(m.id)}
            >
              {m.label}
            </SelectButton>
          ))}
        </div>
      </Field>

      {/* 既存顧客を検索（＝select モード）: タップ選択リスト（プルダウン不使用）*/}
      {customerMode === "select" && (
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-400">顧客を選択</label>
          <div className="mt-1 flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
            {customers.length === 0 && <p className="text-[11px] text-slate-500">顧客がありません。「手入力」で新規登録できます。</p>}
            {customers.map((c) => (
              <SelectButton
                key={c.id}
                selected={customerId === c.id}
                onSelect={() => onSelectCustomer(c.id)}
              >
                {customerDisplayName(c) || c.last_name || "（無名）"}
              </SelectButton>
            ))}
          </div>
        </div>
      )}

      {/* 新規顧客フォーム（＝new モード / 既存 nc 状態）*/}
      {customerMode === "new" && (
        <div className="mt-4 flex flex-col gap-3">
          <Field label="お客様名 / 会社名" required value={nc.name}>
            <TextInput value={nc.name} onChange={(v) => onChangeNc({ name: v })} placeholder="山田太郎 / 株式会社〇〇" required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="電話番号" value={nc.phone}>
              <TextInput value={nc.phone} onChange={(v) => onChangeNc({ phone: v })} placeholder="090-0000-0000" type="tel" inputMode="tel" />
            </Field>
            <Field label="メール" value={nc.email}>
              <TextInput value={nc.email} onChange={(v) => onChangeNc({ email: v })} type="email" />
            </Field>
            <Field label="郵便番号" value={nc.postal}>
              <TextInput value={nc.postal} onChange={(v) => onChangeNc({ postal: v })} placeholder="000-0000" />
            </Field>
            {/* LINE ID エリア（通信ボタンは placeholder）*/}
            <Field label="LINE ID" value={nc.lineId}>
              <div className="flex items-center gap-2">
                <TextInput value={nc.lineId} onChange={(v) => onChangeNc({ lineId: v })} />
                <button
                  type="button"
                  disabled={!lineBusinessConfigured}
                  title={lineBusinessConfigured ? "LINE 友達追加 QR 読み取り" : "LINE Business 未設定"}
                  className={cn(
                    "shrink-0 text-xs px-3 min-h-[44px] rounded-lg border transition-colors",
                    lineBusinessConfigured
                      ? "text-blue-400 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
                      : "text-slate-600 border-slate-800 opacity-50 cursor-not-allowed",
                  )}
                >
                  QR
                </button>
              </div>
            </Field>
          </div>
          <Field label="住所" value={nc.address}>
            <TextInput value={nc.address} onChange={(v) => onChangeNc({ address: v })} placeholder="都道府県・市区町村・番地" />
          </Field>

          {/* 業者 / 掛売り = 独立2ボタン（既存 isBusiness / arAllowed）*/}
          <div className="flex flex-wrap gap-2">
            <ToggleButton active={nc.isBusiness} onToggle={() => onChangeNc({ isBusiness: !nc.isBusiness })}>業者</ToggleButton>
            <ToggleButton active={nc.arAllowed} onToggle={() => onChangeNc({ arAllowed: !nc.arAllowed })}>掛売り</ToggleButton>
          </div>
          {nc.isBusiness && (
            <Field label="値引率（%）" value={nc.tradeRate}>
              <TextInput value={nc.tradeRate} onChange={(v) => onChangeNc({ tradeRate: v })} placeholder="10" inputMode="numeric" />
            </Field>
          )}
          {nc.arAllowed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="締め日" value={nc.closingDay}>
                <TextInput value={nc.closingDay} onChange={(v) => onChangeNc({ closingDay: v })} placeholder="例: 20" inputMode="numeric" />
              </Field>
              <Field label="支払日" value={nc.paymentDay}>
                <TextInput value={nc.paymentDay} onChange={(v) => onChangeNc({ paymentDay: v })} placeholder="例: 末=31" inputMode="numeric" />
              </Field>
            </div>
          )}

          <button
            type="button"
            onClick={onCreateCustomer}
            disabled={creatingCustomer || !nc.name.trim()}
            className="self-start text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 min-h-[44px] rounded-lg transition-colors"
          >
            {creatingCustomer ? "登録中..." : "この顧客を登録"}
          </button>
        </div>
      )}

      <p className="text-[10px] text-slate-600 mt-4">
        LINE QR は店舗設定で LINE Business を登録した場合のみ有効になります。
      </p>
    </div>
  );
}
