"use client";

// Step 1 — 顧客登録. Default mode = 新規顧客登録 (Architect decision). Switchable to
// 車検証OCR / 既存顧客を検索 at any time. Required = registration method + 顧客名 only
// (amber highlight until filled). Business (業者) / credit-sale (掛売り) are two
// INDEPENDENT toggle buttons. LINE ID + LINE QR only (no other SNS). No finance-company
// UI.
//
// B7-2A: 既存顧客を検索 is now a real in-memory filter over the dealer-scoped
// customer references the server supplied — no fetch, no lookup by id, no new
// endpoint. Selecting an existing customer records ONLY the id and the mode; the
// new-customer fields are the CREATE payload and are never populated from a
// reference. Customer save itself is still not performed here.

import { useState } from "react";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { RegMethod } from "../wizard-types";
import type { WizardExistingEntityInputs } from "../contract/wizard-runtime-inputs";
import {
  filterCustomers, effectiveExistingCustomer, customerSelectionPatch,
} from "./existing-entity-selection";
import { OcrEntry } from "../OcrEntry";
import {
  Card, SectionTitle, Field, TextInput, SelectButton, ToggleButton, ChoiceGrid,
} from "../ui";

const REG_METHODS: Array<{ id: RegMethod; label: string; sub: string }> = [
  { id: "new",    label: "新規顧客登録", sub: "手入力（初期選択）" },
  { id: "ocr",    label: "車検証OCR",   sub: "写真/PDFから読み取り" },
  { id: "search", label: "既存顧客を検索", sub: "登録済みから選択" },
];

export function Step1Customer({
  api, customers, vehicles,
}: { api: EstimateWizardApi } & WizardExistingEntityInputs) {
  const c = api.store.customer;
  const v = api.store.vehicle;
  const [query, setQuery] = useState("");
  const matches = filterCustomers(customers, query);

  // EFFECTIVE, not merely stored: the mode must say "search" AND the id must still
  // resolve uniquely. A stale id from a previous mode must not keep the CREATE
  // fields hidden.
  const selected = effectiveExistingCustomer(customers, c.regMethod, c.existingId);

  // Search mode is a SELECTION surface. Until a customer is chosen it shows the
  // selector and nothing else — no CREATE fields, no business/credit-sale terms.
  // Offering them here would let an operator half-describe a new customer while
  // intending to pick an existing one, and the mapper would then have to guess.
  const isSearchMode = c.regMethod === "search";
  const showNewRecordFields = !isSearchMode;

  const setC = (patch: Partial<typeof c>) => api.updateStore({ customer: { ...c, ...patch } });

  /** Ids and mode only — never a spread of the current customer/vehicle snapshots. */
  const setCustomerSelection = (nextExistingId: string | null, nextMethod: RegMethod) => {
    api.updateStore(customerSelectionPatch(vehicles, nextMethod, nextExistingId, v.existingId));
  };

  return (
    <Card>
      <SectionTitle>顧客登録</SectionTitle>

      {/* Registration method — default 新規顧客登録 */}
      <Field label="登録方式" required value={c.regMethod}>
        <ChoiceGrid cols={3}>
          {REG_METHODS.map((m) => (
            <SelectButton key={m.id} selected={c.regMethod === m.id} onClick={() => setCustomerSelection(c.existingId, m.id)}>
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

      {/* B7-2A — existing-customer selection: an in-memory filter over the
          dealer-scoped references the server supplied. No fetch, no lookup by id. */}
      {c.regMethod === "search" && (
        <div className="mt-4" data-testid="existing-customer-selector">
          {selected ? (
            // Read-only summary. There is deliberately no edit affordance: these
            // values describe a record that already exists, and editing them here
            // would imply a write this wizard does not perform.
            <div className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-2" data-testid="existing-customer-summary">
              <p className="text-xs text-emerald-300">既存顧客を選択中</p>
              <p className="text-sm mt-1">{selected.displayName}</p>
              {selected.phone && <p className="text-[11px] text-slate-400">{selected.phone}</p>}
              <button
                type="button"
                className="mt-2 text-[11px] text-slate-400 underline"
                onClick={() => setCustomerSelection(null, "search")}
              >
                選択を解除
              </button>
            </div>
          ) : (
            <>
              <TextInput value={query} onChange={setQuery} placeholder="名前 / 電話番号で絞り込み" />
              <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-slate-800">
                {matches.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">該当する既存顧客がありません。</p>
                ) : (
                  matches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`existing-customer-option-${m.id}`}
                      className="w-full text-left py-2 px-1 hover:bg-slate-800/60"
                      onClick={() => setCustomerSelection(m.id, "search")}
                    >
                      <span className="block text-sm">{m.displayName}</span>
                      {m.phone && <span className="block text-[11px] text-slate-500">{m.phone}</span>}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* New-record fields. Hidden while an existing customer is selected: they are
          the CREATE payload, and showing them filled from a reference — or letting
          the operator type into them — would describe a new customer that duplicates
          the selected one. New and OCR modes keep them fully editable. */}
      {showNewRecordFields && (
      <div className="mt-4 grid grid-cols-1 gap-3">
        <Field label="お客様名 / 会社名" required value={c.name}>
          <TextInput value={c.name} onChange={(x) => setC({ name: x })} placeholder="山田太郎 / 株式会社〇〇" required />
        </Field>
        <ChoiceGrid cols={2}>
          <Field label="フリガナ" value={c.kana}>
            <TextInput value={c.kana} onChange={(x) => setC({ kana: x })} placeholder="ヤマダタロウ" />
          </Field>
          <Field label="電話番号" value={c.phone}>
            <TextInput value={c.phone} onChange={(x) => setC({ phone: x })} placeholder="090-0000-0000" type="tel" inputMode="tel" />
          </Field>
          <Field label="メール" value={c.email}>
            <TextInput value={c.email} onChange={(x) => setC({ email: x })} placeholder="example@mail.jp" type="email" inputMode="email" />
          </Field>
          <Field label="郵便番号" value={c.postal}>
            <TextInput value={c.postal} onChange={(x) => setC({ postal: x })} placeholder="000-0000" />
          </Field>
          <Field label="LINE ID" value={c.lineId}>
            <TextInput value={c.lineId} onChange={(x) => setC({ lineId: x })} placeholder="line-id" />
          </Field>
        </ChoiceGrid>
        <Field label="住所" value={c.address}>
          <TextInput value={c.address} onChange={(x) => setC({ address: x })} placeholder="都道府県・市区町村・番地" />
        </Field>
      </div>
      )}

      {/* 業者 / 掛売り — two independent toggles. Part of the new-customer CREATE
          payload, so they follow the same gating: a selected existing customer
          already carries these terms in the database. */}
      {showNewRecordFields && (
      <>
      <div className="mt-4 flex flex-wrap gap-2">
        <ToggleButton active={c.contractor} onClick={() => setC({ contractor: !c.contractor })}>業者</ToggleButton>
        <ToggleButton active={c.creditSale} onClick={() => setC({ creditSale: !c.creditSale })}>掛売り</ToggleButton>
      </div>
      {c.contractor && (
        <div className="mt-3">
          <Field label="値引率（%）" value={c.contractorRate}>
            <TextInput value={c.contractorRate} onChange={(x) => setC({ contractorRate: x })} placeholder="10" inputMode="numeric" />
          </Field>
        </div>
      )}
      {c.creditSale && (
        <ChoiceGrid cols={2}>
          <Field label="締め日" value={c.creditClosing}>
            <TextInput value={c.creditClosing} onChange={(x) => setC({ creditClosing: x })} placeholder="例: 20" inputMode="numeric" />
          </Field>
          <Field label="支払日" value={c.paymentDay}>
            <TextInput value={c.paymentDay} onChange={(x) => setC({ paymentDay: x })} placeholder="例: 末=31" inputMode="numeric" />
          </Field>
          <Field label="支払条件" value={c.creditTerms}>
            <TextInput value={c.creditTerms} onChange={(x) => setC({ creditTerms: x })} placeholder="翌月末払い" />
          </Field>
        </ChoiceGrid>
      )}
      </>
      )}

      <p className="text-[10px] text-slate-600 mt-4">
        LINE QR 取得は、店舗設定で LINE Business を登録した場合のみ表示されます（Phase 2）。
      </p>
    </Card>
  );
}
