"use client";

// Step 1 — 顧客登録. Default mode = 新規顧客登録 (Architect decision). Switchable to
// 車検証OCR / 既存顧客を検索 at any time. Required = registration method + 顧客名 only
// (amber highlight until filled). Business (業者) / credit-sale (掛売り) are two
// INDEPENDENT toggle buttons. LINE ID + LINE QR only (no other SNS). No finance-company
// UI. Real customer save/search wire in Phase 2.

import type { EstimateWizardApi } from "../useEstimateWizard";
import type { RegMethod } from "../wizard-types";
import { OcrEntry } from "../OcrEntry";
import {
  Card, SectionTitle, Field, TextInput, SelectButton, ToggleButton, ChoiceGrid,
} from "../ui";

const REG_METHODS: Array<{ id: RegMethod; label: string; sub: string }> = [
  { id: "new",    label: "新規顧客登録", sub: "手入力（初期選択）" },
  { id: "ocr",    label: "車検証OCR",   sub: "写真/PDFから読み取り" },
  { id: "search", label: "既存顧客を検索", sub: "登録済みから選択" },
];

export function Step1Customer({ api }: { api: EstimateWizardApi }) {
  const c = api.store.customer;
  const setC = (patch: Partial<typeof c>) => api.updateStore({ customer: { ...c, ...patch } });

  return (
    <Card>
      <SectionTitle>顧客登録</SectionTitle>

      {/* Registration method — default 新規顧客登録 */}
      <Field label="登録方式" required value={c.regMethod}>
        <ChoiceGrid cols={3}>
          {REG_METHODS.map((m) => (
            <SelectButton key={m.id} selected={c.regMethod === m.id} onClick={() => setC({ regMethod: m.id })}>
              <span className="block font-medium">{m.label}</span>
              <span className="block text-[11px] text-slate-500">{m.sub}</span>
            </SelectButton>
          ))}
        </ChoiceGrid>
      </Field>

      {/* OCR mode → unified OCR entry (existing pipeline; camera/photo/pdf) */}
      {c.regMethod === "ocr" && (
        <div className="mt-4">
          <OcrEntry
            onApply={(f) => {
              const rec = f as Record<string, unknown>;
              const name = rec.customer_candidate_name;
              if (typeof name === "string" && name) setC({ name });
            }}
          />
          <p className="text-[11px] text-slate-500 mt-2">読み取り後、フォームへ反映されます。オペレーターが修正可能です。</p>
        </div>
      )}

      {/* Search mode — real search modal wires in Phase 2 */}
      {c.regMethod === "search" && (
        <p className="text-xs text-slate-400 mt-4">既存顧客の検索モーダル（名前 / フリガナ / 電話 / 住所 / ナンバー下4桁）は Phase 2 で既存データに接続します。</p>
      )}

      {/* Customer fields (shown for new + as editable reflection for ocr/search) */}
      <div className="mt-4 grid grid-cols-1 gap-3">
        <Field label="お客様名 / 会社名" required value={c.name}>
          <TextInput value={c.name} onChange={(v) => setC({ name: v })} placeholder="山田太郎 / 株式会社〇〇" required />
        </Field>
        <ChoiceGrid cols={2}>
          <Field label="フリガナ" value={c.kana}>
            <TextInput value={c.kana} onChange={(v) => setC({ kana: v })} placeholder="ヤマダタロウ" />
          </Field>
          <Field label="電話番号" value={c.phone}>
            <TextInput value={c.phone} onChange={(v) => setC({ phone: v })} placeholder="090-0000-0000" type="tel" inputMode="tel" />
          </Field>
          <Field label="郵便番号" value={c.postal}>
            <TextInput value={c.postal} onChange={(v) => setC({ postal: v })} placeholder="000-0000" />
          </Field>
          <Field label="LINE ID" value={c.lineId}>
            <TextInput value={c.lineId} onChange={(v) => setC({ lineId: v })} placeholder="line-id" />
          </Field>
        </ChoiceGrid>
        <Field label="住所" value={c.address}>
          <TextInput value={c.address} onChange={(v) => setC({ address: v })} placeholder="都道府県・市区町村・番地" />
        </Field>
      </div>

      {/* 業者 / 掛売り — two independent toggles */}
      <div className="mt-4 flex flex-wrap gap-2">
        <ToggleButton active={c.contractor} onClick={() => setC({ contractor: !c.contractor })}>業者</ToggleButton>
        <ToggleButton active={c.creditSale} onClick={() => setC({ creditSale: !c.creditSale })}>掛売り</ToggleButton>
      </div>
      {c.contractor && (
        <div className="mt-3">
          <Field label="値引率（%）" value={c.contractorRate}>
            <TextInput value={c.contractorRate} onChange={(v) => setC({ contractorRate: v })} placeholder="10" inputMode="numeric" />
          </Field>
        </div>
      )}
      {c.creditSale && (
        <ChoiceGrid cols={2}>
          <Field label="締め日" value={c.creditClosing}>
            <TextInput value={c.creditClosing} onChange={(v) => setC({ creditClosing: v })} placeholder="例: 20" inputMode="numeric" />
          </Field>
          <Field label="支払条件" value={c.creditTerms}>
            <TextInput value={c.creditTerms} onChange={(v) => setC({ creditTerms: v })} placeholder="翌月末払い" />
          </Field>
        </ChoiceGrid>
      )}

      <p className="text-[10px] text-slate-600 mt-4">
        LINE QR 取得は、店舗設定で LINE Business を登録した場合のみ表示されます（Phase 2）。
      </p>
    </Card>
  );
}
