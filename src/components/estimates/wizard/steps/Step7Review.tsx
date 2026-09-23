"use client";

// Step 7 — 確認. Shows the estimate summary + action buttons: 修正 / キャンセル / 保存 /
// PDF / LINE(送信 or 文章コピー) / 予約カレンダー / 請求書 / 納品書 / 納品請求書.
// Cancel = no auto-save; all other actions auto-save then navigate to their module.
// Real save/PDF/LINE and module navigation wire in Phase 2 (existing logic, unchanged).

import type { EstimateWizardApi } from "../useEstimateWizard";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "../contract/wizard-runtime-inputs";
import { effectiveExistingCustomer, effectiveExistingVehicle } from "./existing-entity-selection";
import { serviceCategoryLabel } from "@/lib/estimates/service-categories";
import type { WizardSaveBinding } from "../save/WizardSavePanel";
import { WizardSavePanel } from "../save/WizardSavePanel";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";
import { orderedWizardPricingLines, wizardPricingLineId } from "../pricing/wizard-line-order";
import { Card, SectionTitle, PhaseTwoNotice } from "../ui";

const pricingCategoryLabel = (category: string) =>
  category === "store_global_options" ? "共通オプション" : serviceCategoryLabel(category);

// B7-2C: the save binding is OPTIONAL here on purpose. Only the production wrapper
// supplies one; bare EstimateWizard mounts (every non-production test) keep the
// existing presentation seam and need no session, storage or crypto. This step
// creates no session or key, reads no browser storage, and performs no pricing,
// mapping, validation, DB or navigation work — it renders what it is handed.

// GDA-ESTIMATE-REVIEW-DISPLAY-R1: an existing selection stores ONLY an id, never a
// label, so this step receives the SAME server-supplied reference arrays the
// selection steps use and resolves the label at render time through the same pure
// authorities (effectiveExistingCustomer / effectiveExistingVehicle). The resolved
// server-composed displayName is DISPLAY ONLY — it is never written into the
// canonical draft, so persistence stays byte-identical. A claimed reference that
// fails to resolve (missing, stale, duplicate/ambiguous, or owned by another
// customer) fails closed to the em dash rather than guessing a label; new-entity
// entries keep their draft-field display.

export function Step7Review({
  api, customers, vehicles, pricing, saveBinding,
}: {
  api: EstimateWizardApi;
  customers: readonly WizardExistingCustomerReference[];
  vehicles: readonly WizardExistingVehicleReference[];
  pricing: WizardPricingResult;
  saveBinding?: WizardSaveBinding;
}) {
  const s = api.store;
  const orderedLines = orderedWizardPricingLines(pricing.lines, api.draft.review.serviceLineOrder);

  const moveLine = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= orderedLines.length) return;
    const ids = orderedLines.map(wizardPricingLineId);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    api.setServiceLineOrder(ids);
  };

  const existingCustomer = effectiveExistingCustomer(customers, s.customer.regMethod, s.customer.existingId);
  const customerLabel = existingCustomer !== null
    ? existingCustomer.displayName
    // In existing/search mode an unresolved id must not fall back to the
    // new-customer draft field — that field describes a record to CREATE.
    : s.customer.regMethod === "search" ? "—" : (s.customer.name || "—");

  const existingVehicle = effectiveExistingVehicle(vehicles, existingCustomer?.id ?? null, s.vehicle.existingId);
  // A non-empty existingId is a CLAIMED reference: if it did not resolve under the
  // effective customer, showing the new-vehicle draft fields would mislabel it.
  const vehicleReferenceClaimed = typeof s.vehicle.existingId === "string" && s.vehicle.existingId !== "";
  const vehicleLabel = existingVehicle !== null
    ? existingVehicle.displayName
    : vehicleReferenceClaimed ? "—" : ([s.vehicle.maker, s.vehicle.model].filter(Boolean).join(" ") || "—");

  return (
    <>
      <Card>
        <SectionTitle>確認</SectionTitle>
        <dl className="text-xs text-slate-300 space-y-1">
          <div className="flex justify-between"><dt className="text-slate-500">顧客</dt><dd>{customerLabel}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">車両</dt><dd>{vehicleLabel}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">作業</dt><dd>{s.categories.map(serviceCategoryLabel).join(" / ") || "—"}</dd></div>
        </dl>
      </Card>
      <Card>
        <SectionTitle>明細の詳細</SectionTitle>
        <p className="mb-3 text-xs text-slate-500">数量・単価・表示順は、保存後の見積詳細とPDFに反映されます。</p>
        {orderedLines.length === 0 ? (
          <p className="text-xs text-slate-500">明細がありません。</p>
        ) : (
          <ol className="space-y-2">
            {orderedLines.map((line, index) => (
              <li
                key={wizardPricingLineId(line)}
                className="grid min-w-0 grid-cols-1 items-end gap-3 rounded-lg border border-slate-700/60 bg-[#0b1220] p-3 md:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{line.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{pricingCategoryLabel(line.category)}</p>
                </div>
                <label className="grid gap-1 text-[11px] text-slate-400">
                  <span>数量</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    aria-label={`${line.label}の数量`}
                    value={api.draft.review.quantityInputsByLine[wizardPricingLineId(line)] ?? String(line.quantity)}
                    onChange={(event) => api.setServiceLineAdjustment(
                      wizardPricingLineId(line),
                      event.target.value,
                      api.draft.review.unitPriceInputsByLine[wizardPricingLineId(line)] ?? String(line.unitPrice ?? ""),
                    )}
                    className="h-10 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-right text-sm text-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-[11px] text-slate-400">
                  <span>金額（単価）</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">¥</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      aria-label={`${line.label}の金額（単価）`}
                      aria-invalid={line.unitPrice === null}
                      placeholder={line.unitPrice === null ? "金額を入力" : undefined}
                      value={api.draft.review.unitPriceInputsByLine[wizardPricingLineId(line)] ?? String(line.unitPrice ?? "")}
                      onChange={(event) => api.setServiceLineAdjustment(
                        wizardPricingLineId(line),
                        api.draft.review.quantityInputsByLine[wizardPricingLineId(line)] ?? String(line.quantity),
                        event.target.value,
                      )}
                      className="h-10 w-full rounded-lg border border-slate-600 bg-slate-950 pl-7 pr-3 text-right text-sm text-slate-100"
                    />
                  </div>
                  {line.unitPrice === null && <span className="text-amber-400">金額を入力すると保存できます</span>}
                </label>
                <div className="grid shrink-0 grid-cols-2 gap-1" aria-label={`${line.label}の表示順`}>
                  <button
                    type="button"
                    aria-label={`${line.label}を上へ`}
                    onClick={() => moveLine(index, -1)}
                    disabled={index === 0}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-600 text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`${line.label}を下へ`}
                    onClick={() => moveLine(index, 1)}
                    disabled={index === orderedLines.length - 1}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-600 text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {saveBinding
        ? <WizardSavePanel draft={api.draft} binding={saveBinding} />
        : <PhaseTwoNotice screen="保存 / PDF / LINE(送信・文章コピー) / 予約カレンダー / 請求書・納品書・納品請求書" />}
    </>
  );
}
