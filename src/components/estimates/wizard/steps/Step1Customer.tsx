"use client";

// Step 1 — 顧客登録. Default mode = 新規顧客登録 (Architect decision). Switchable to
// 車検証OCR / 既存顧客を検索 at any time. Required = registration method + 顧客名 only
// (amber highlight until filled). Business (業者) / credit-sale (掛売り) are two
// INDEPENDENT toggle buttons. LINE ID + LINE QR only (no other SNS). No finance-company
// UI.
//
// B2.2B: 既存顧客を検索 is an AUTHENTICATED SERVER search, replacing the former
// in-memory filter over preloaded references. The browser sends only the term —
// never a dealer id — and the server resolves the tenant from the authenticated
// actor context. Kana, address and name parts are searched server-side and never
// sent to the browser; results carry only { id, displayName, phone }.
//
// This module imports NO Server Action. The invoker is injected from the server
// route, exactly as the save invoker is, so every server entry point stays visible
// at the page rather than scattered through the client tree.
//
// Selecting an existing customer records ONLY the id and the mode; the new-customer
// fields are the CREATE payload and are never populated from a reference. Customer
// save itself is still not performed here.

import { useEffect, useRef, useState } from "react";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { RegMethod } from "../wizard-types";
import type {
  WizardExistingEntityInputs,
  WizardCustomerSearchInputs,
  WizardExistingCustomerReference,
  WizardCustomerSearchFailureCode,
  WizardDuplicateCheckInputs,
  WizardDuplicateCandidate,
  WizardDuplicateCheckFailureCode,
} from "../contract/wizard-runtime-inputs";
import { effectiveExistingCustomer, customerSelectionPatch } from "./existing-entity-selection";
import { OcrEntry } from "../OcrEntry";
import {
  Card, SectionTitle, Field, TextInput, SelectButton, ToggleButton, ChoiceGrid,
} from "../ui";

const REG_METHODS: Array<{ id: RegMethod; label: string; sub: string }> = [
  { id: "new",    label: "新規顧客登録", sub: "手入力（初期選択）" },
  { id: "ocr",    label: "車検証OCR",   sub: "写真/PDFから読み取り" },
  { id: "search", label: "既存顧客を検索", sub: "登録済みから選択" },
];

/** Operator-facing text for each stable failure code. No raw database detail ever reaches here. */
const SEARCH_MESSAGE: Record<WizardCustomerSearchFailureCode, string> = {
  QUERY_TOO_SHORT: "2文字以上で検索してください。",
  UNAUTHENTICATED: "セッションが確認できませんでした。再度ログインしてください。",
  DEALER_CONTEXT_REQUIRED: "この操作を行う権限がありません。",
  SEARCH_FAILED: "検索に失敗しました。時間をおいて再度お試しください。",
};

/**
 * B2-D — operator-facing text per duplicate-check failure code.
 *
 * `NOT_APPLICABLE` maps to the EMPTY string and is never rendered: it means the rule could not fire
 * on this input, which is an internal condition, not something the operator did wrong. Telling them
 * anything there would be noise on nearly every keystroke.
 */
const DUPLICATE_MESSAGE: Record<WizardDuplicateCheckFailureCode, string> = {
  NOT_APPLICABLE: "",
  UNAUTHENTICATED: "セッションが確認できませんでした。再度ログインしてください。",
  DEALER_CONTEXT_REQUIRED: "この操作を行う権限がありません。",
  LOOKUP_FAILED: "重複確認に失敗しました。登録は続行できます。",
};

/** Stable identity for a candidate set, so a dismissal survives re-checks that return the same rows. */
function candidateSignature(candidates: readonly WizardDuplicateCandidate[]): string {
  return candidates.map((c) => c.id).sort().join("|");
}

export function Step1Customer({
  api, customers, vehicles, customerSearchInvoker, duplicateCheckInvoker,
}: { api: EstimateWizardApi } & WizardExistingEntityInputs & WizardCustomerSearchInputs
  & WizardDuplicateCheckInputs) {
  const c = api.store.customer;
  const v = api.store.vehicle;
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<readonly WizardExistingCustomerReference[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "done">("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  // Debounced server search. The generation guard is what makes this safe: a slow earlier
  // response must never overwrite a newer one, which would show the operator results for a
  // term they have already replaced.
  useEffect(() => {
    if (!customerSearchInvoker) return;
    const term = query.trim();
    if (term === "") {
      setMatches([]); setSearchState("idle"); setSearchError(null); setTruncated(false);
      return;
    }
    let current = true;
    setSearchState("searching"); setSearchError(null);
    const timer = setTimeout(() => {
      void customerSearchInvoker(term).then((r) => {
        if (!current) return;
        if (r.ok) {
          setMatches(r.results); setTruncated(r.truncated); setSearchError(null);
        } else {
          // Fail closed: never show a stale result set alongside an error.
          setMatches([]); setTruncated(false); setSearchError(SEARCH_MESSAGE[r.code]);
        }
        setSearchState("done");
      }).catch(() => {
        if (!current) return;
        setMatches([]); setTruncated(false);
        setSearchError(SEARCH_MESSAGE.SEARCH_FAILED); setSearchState("done");
      });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query, customerSearchInvoker]);

  // ── B2-D: advisory duplicate warning ────────────────────────────────────────
  // ADVISORY ONLY. Nothing below touches step completion, navigation or saving — `useEstimateWizard`
  // still gates Step 1 on `customer.name || customer.existingId` alone, and it is deliberately not
  // modified. Every state here (in flight, failed, dismissed, candidates shown) leaves the operator
  // able to save exactly as before.
  const [dupCandidates, setDupCandidates] = useState<readonly WizardDuplicateCandidate[]>([]);
  const [dupTruncated, setDupTruncated] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [dupDismissed, setDupDismissed] = useState<string | null>(null);

  // 「入力に戻る」 returns the operator to the field they most likely need to correct. The shared
  // TextInput does not forward a ref and `ui` is out of scope here, so the focus target is reached
  // through a wrapper element rather than by changing the shared component.
  const nameFieldRef = useRef<HTMLDivElement | null>(null);
  const focusNameInput = () => {
    nameFieldRef.current?.querySelector("input")?.focus();
  };

  /** Every not-shown state clears the whole result, so a stale `truncated` can never outlive its rows. */
  const clearDuplicateResult = () => {
    setDupCandidates([]); setDupTruncated(false); setDupError(null);
  };

  useEffect(() => {
    // No seam ⇒ no result at all. Absent must never look like "checked, nothing found".
    if (!duplicateCheckInvoker) { clearDuplicateResult(); return; }
    // A chosen existing customer cannot duplicate itself, so search mode is not checked at all.
    if (c.regMethod === "search") { clearDuplicateResult(); return; }
    // Debounced rather than fired on blur: the OCR path fills these fields programmatically and
    // never blurs them, so a blur trigger would silently skip exactly the entry mode most likely to
    // re-create an existing customer.
    let current = true;
    const timer = setTimeout(() => {
      void duplicateCheckInvoker({ name: c.name, kana: c.kana, phone: c.phone }).then((r) => {
        if (!current) return;
        if (r.ok) {
          setDupCandidates(r.candidates); setDupTruncated(r.truncated); setDupError(null);
        } else {
          // Fail quiet, not loud: a failed check must never look like a blocked registration.
          // NOT_APPLICABLE included — the rule could not fire, so there is nothing to report.
          clearDuplicateResult();
          setDupError(DUPLICATE_MESSAGE[r.code] === "" ? null : DUPLICATE_MESSAGE[r.code]);
        }
      }).catch(() => {
        if (!current) return;
        clearDuplicateResult();
        setDupError(DUPLICATE_MESSAGE.LOOKUP_FAILED);
      });
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [c.regMethod, c.name, c.kana, c.phone, duplicateCheckInvoker]);

  // Re-opens when a genuinely different candidate set arrives; stays closed while it is the same one.
  const dupSignature = candidateSignature(dupCandidates);
  const showDuplicatePanel =
    dupCandidates.length > 0 && dupDismissed !== dupSignature && c.regMethod !== "search";

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

      {/* B2.2B — existing-customer selection: an AUTHENTICATED SERVER search.
          Tenant scoping happens on the server; this surface never sees a dealer id. */}
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
              {!customerSearchInvoker ? (
                // No fabricated fallback. Absent seam means the operator cannot search — it must
                // never be presented as "this dealer has no customers".
                <p className="text-xs text-slate-500 py-2" data-testid="customer-search-unavailable">
                  顧客検索は利用できません。
                </p>
              ) : (
                <>
                  <TextInput
                    value={query}
                    onChange={setQuery}
                    placeholder="名前 / フリガナ / 住所 / 電話番号 / ナンバー下4桁"
                  />
                  <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-slate-800">
                    {searchError ? (
                      <p className="text-xs text-amber-400 py-2" role="alert" data-testid="customer-search-error">
                        {searchError}
                      </p>
                    ) : query.trim() === "" ? (
                      <p className="text-xs text-slate-500 py-2">検索語を入力してください（2文字以上）。</p>
                    ) : searchState === "searching" ? (
                      <p className="text-xs text-slate-500 py-2">検索中…</p>
                    ) : matches.length === 0 ? (
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
                  {truncated && (
                    <p className="text-[11px] text-slate-500 mt-1" data-testid="customer-search-truncated">
                      該当が多いため上位のみ表示しています。条件を絞り込んでください。
                    </p>
                  )}
                </>
              )}
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
        <div ref={nameFieldRef}>
          <Field label="お客様名 / 会社名" required value={c.name}>
            <TextInput value={c.name} onChange={(x) => setC({ name: x })} placeholder="山田太郎 / 株式会社〇〇" required />
          </Field>
        </div>
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

      {/* B2-D — advisory duplicate warning, directly below the manual customer fields.
          role="status" and not "alert": this is information, not an error, and it must never read as
          a blocked registration. All three actions are explicit and none is preselected — in
          particular "新規のお客様として登録する" is exactly as reachable as選択, because creating a
          genuinely distinct customer is a legitimate outcome, not a fallback. */}
      {showNewRecordFields && showDuplicatePanel && (
        <div
          role="status"
          data-testid="duplicate-warning-panel"
          className="mt-4 rounded-xl border border-amber-700/60 bg-amber-950/30 p-3"
        >
          <p className="text-xs text-amber-200">
            同じお客様がすでに登録されている可能性があります。ご確認ください。
          </p>
          <div className="mt-2 divide-y divide-amber-900/40">
            {dupCandidates.map((d) => (
              <div key={d.id} data-testid={`duplicate-warning-candidate-${d.id}`} className="py-2">
                <span className="block text-sm text-slate-100">{d.displayName}</span>
                {d.phone && <span className="block text-[11px] text-slate-400">{d.phone}</span>}
                <span className="block text-[10px] text-amber-300/80">
                  {d.reason === "phone" ? "電話番号が一致" : "お名前とフリガナが一致"}
                </span>
                <button
                  type="button"
                  data-testid={`duplicate-warning-use-${d.id}`}
                  className="mt-1 min-h-[44px] px-3 rounded-lg border border-slate-600 text-xs text-slate-100 hover:bg-slate-800/60"
                  onClick={() => setCustomerSelection(d.id, "search")}
                >
                  この既存のお客様を使う
                </button>
              </div>
            ))}
          </div>
          {dupTruncated && (
            <p className="mt-1 text-[11px] text-amber-300/80" data-testid="duplicate-warning-truncated">
              一致候補がさらにあります。上位10件を表示しています。
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="duplicate-warning-create-anyway"
              className="min-h-[44px] px-3 rounded-lg border border-slate-600 text-xs text-slate-100 hover:bg-slate-800/60"
              onClick={() => setDupDismissed(dupSignature)}
            >
              新規のお客様として登録する
            </button>
            {/* Deliberately does NOT dismiss: the operator is going back to correct the fields, so
                the advisory stays visible until the input actually changes (which re-runs the check)
                or they explicitly choose one of the other two actions. Dismissing here would hide
                the very warning they are acting on. */}
            <button
              type="button"
              data-testid="duplicate-warning-dismiss"
              className="min-h-[44px] px-3 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              onClick={focusNameInput}
            >
              入力に戻る
            </button>
          </div>
        </div>
      )}

      {showNewRecordFields && dupError && (
        <p className="mt-2 text-[11px] text-slate-500" data-testid="duplicate-warning-error">
          {dupError}
        </p>
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
