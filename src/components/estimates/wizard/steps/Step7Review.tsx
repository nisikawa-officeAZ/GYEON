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
import type {
  WizardPricingLineResult,
  WizardPricingResult,
  WizardReviewQuantityBounds,
} from "../pricing/wizard-pricing-types";
import { orderedWizardPricingLines, wizardPricingLineId } from "../pricing/wizard-line-order";
import { Card, SectionTitle, PhaseTwoNotice } from "../ui";

const pricingCategoryLabel = (category: string) =>
  category === "store_global_options" ? "共通オプション" : serviceCategoryLabel(category);

// GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A): the canonical per-line quantity policy as annotated by
// the authoritative compute route. `undefined` (not annotated) is treated EXACTLY like `null` (fixed)
// so the screen can never offer an editable quantity the pricing route would reject.
const quantityPolicyOf = (line: WizardPricingLineResult): WizardReviewQuantityBounds | null =>
  line.quantityPolicy ?? null;

// GDA-OTHER-COATINGS-R1 (C5 F2): the unit-price input's `min` mirrors the per-line rule the pricing
// route enforces — an `other_coating` line must stay POSITIVE (¥0 is refused by the adjuster on
// preview and save), every other line keeps the existing non-negative rule. Presentation only: the
// browser hint never decides anything; the adjuster re-validates the same text.
const unitPriceMinOf = (line: WizardPricingLineResult): "0" | "1" =>
  line.category === "other_coating" ? "1" : "0";

// GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A stale repair): a restored draft/revision may still carry a
// `quantityInputsByLine` entry for a FIXED line (typed before the input was removed, or malformed).
// The pricing route accepts exactly `String(line.quantity)` (plain digits) as the identity; any other
// text on a fixed line fails the WHOLE result closed, and with no number input the operator had no
// way to correct it. Returns that stale draft text so the row can offer an explicit reset back to the
// authoritative quantity; `null` = nothing to recover (entry absent or identity). The draft value is
// never discarded silently — only the operator's activation of the reset control replaces it.
const staleFixedQuantityInput = (
  inputs: Readonly<Record<string, string>>,
  lineId: string,
  quantity: number,
): string | null => {
  if (!Object.prototype.hasOwnProperty.call(inputs, lineId)) return null;
  const raw = inputs[lineId];
  return raw === String(quantity) ? null : raw;
};

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
            {orderedLines.map((line, index) => {
              const quantityPolicy = quantityPolicyOf(line);
              const lineId = wizardPricingLineId(line);
              const staleQuantityInput = quantityPolicy === null
                ? staleFixedQuantityInput(api.draft.review.quantityInputsByLine, lineId, line.quantity)
                : null;
              return (
              <li
                key={wizardPricingLineId(line)}
                className="grid min-w-0 grid-cols-1 items-end gap-3 rounded-lg border border-slate-700/60 bg-[#0b1220] p-3 md:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{line.label}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {pricingCategoryLabel(line.category)}
                    {line.lineTotal !== null ? `・¥${line.lineTotal.toLocaleString("ja-JP")}` : ""}
                  </p>
                </div>
                {/* GDA-ESTIMATE-PR123-R2 — quantity / tax-exclusive unit price, keyed by the SAME stable
                    line identity as the saved order. The edit is draft text only; the authoritative
                    pricing route re-validates and recomputes it, and any edit resets preview confirmation.
                    GDA-ESTIMATE-PR133 P2-2 — each input submits ONLY its own field, so editing one never
                    freezes the other at its currently displayed value.
                    GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A) — the quantity control follows the SAME
                    canonical policy the pricing route enforces (`line.quantityPolicy`, annotated by the
                    compute route from `reviewQuantityPolicyForLine`): a fixed-quantity line (body
                    coating, topcoats, full / front-full PPF, …) shows a read-only quantity with NO
                    number input and NO quantity change handler; a quantity-required store option keeps
                    the input with the configured min/max. An un-annotated line is treated as fixed
                    (fail closed). This is presentation only — the pricing/save route stays authoritative.
                    GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — a partial PPF PART line is editable within
                    its configured bounds; its handler additionally passes `ppfPartSync` (the part code +
                    bounds from the same annotation) so the hook can write a VALID edit through to the
                    canonical Step-4 part quantity. Store options still submit `{ quantityInput }` only.
                    GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c2, plan §24.1) — a DEDICATED wheel / glass menu
                    line is editable within its configured bounds under its own category label
                    (ホイール / ガラス, never 共通オプション); its handler passes `dedicatedMenuSync` (kind +
                    stable menu code + bounds from the same annotation) so the hook can write a VALID
                    edit through to the canonical Step-4 `quantitiesByMenu`. Body coating, full /
                    front-full PPF and every other fixed line keep the read-only quantity above.
                    GDA-OTHER-COATINGS-R1 (C4) — an `other_coating` menu line follows the SAME
                    annotation under its own label (その他コーティング): a QUANTITY-BEARING row arrives
                    with bounds + `dedicatedMenu { kind: "other_coating" }` and is editable here
                    (synced to `services.otherCoating.quantitiesByMenu` by the hook); a FIXED-ONE row
                    arrives with `quantityPolicy: null` and renders the read-only quantity 1. The
                    unit price stays editable on both. Nothing here decides which — the pricing route
                    annotates, this screen only renders. */}
                {quantityPolicy === null ? (
                  <div className="grid gap-1 text-[11px] text-slate-400">
                    <span>数量</span>
                    <p
                      data-testid="review-quantity-fixed"
                      title="この明細の数量は変更できません"
                      className="flex h-10 w-full items-center justify-end rounded-lg border border-slate-800 bg-slate-900/60 px-3 text-sm text-slate-300"
                    >
                      {line.quantity}
                    </p>
                    {/* Stale repair — a non-identity draft quantity on this fixed line (restored draft /
                        revision, blank or non-numeric included) would fail the pricing route closed with
                        no way to fix it here. Show the stale text and an explicit, labeled reset that
                        writes the authoritative quantity back through the SAME adjustment API, which is
                        the accepted identity and resets preview confirmation (recompute). Nothing is
                        discarded without the operator's action. */}
                    {staleQuantityInput !== null ? (
                      <>
                        <p data-testid="review-quantity-stale-notice" className="text-[11px] text-amber-300">
                          下書きに残った数量{staleQuantityInput.trim() === "" ? "（空欄）" : `「${staleQuantityInput}」`}は使用できません。
                        </p>
                        <button
                          type="button"
                          data-testid="review-quantity-stale-reset"
                          aria-label={`${line.label}の数量を${line.quantity}に戻す`}
                          onClick={() => api.setServiceLineAdjustment(
                            lineId,
                            { quantityInput: String(line.quantity) },
                          )}
                          className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-amber-500/60 px-2 text-[11px] text-amber-200"
                        >
                          数量を{line.quantity}に戻す
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <label className="grid gap-1 text-[11px] text-slate-400">
                    <span>数量</span>
                    <input
                      type="number"
                      min={quantityPolicy.minQuantity}
                      max={quantityPolicy.maxQuantity ?? undefined}
                      step="1"
                      inputMode="numeric"
                      aria-label={`${line.label}の数量`}
                      value={api.draft.review.quantityInputsByLine[wizardPricingLineId(line)] ?? String(line.quantity)}
                      onChange={(event) => api.setServiceLineAdjustment(
                        wizardPricingLineId(line),
                        quantityPolicy.ppfPartCode !== undefined
                          ? {
                              quantityInput: event.target.value,
                              ppfPartSync: {
                                partCode: quantityPolicy.ppfPartCode,
                                minQuantity: quantityPolicy.minQuantity,
                                maxQuantity: quantityPolicy.maxQuantity,
                              },
                            }
                          : quantityPolicy.dedicatedMenu !== undefined
                            ? {
                                quantityInput: event.target.value,
                                dedicatedMenuSync: {
                                  kind: quantityPolicy.dedicatedMenu.kind,
                                  menuCode: quantityPolicy.dedicatedMenu.menuCode,
                                  minQuantity: quantityPolicy.minQuantity,
                                  maxQuantity: quantityPolicy.maxQuantity,
                                },
                              }
                            : { quantityInput: event.target.value },
                      )}
                      className="h-10 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-right text-sm text-slate-100"
                    />
                  </label>
                )}
                <label className="grid gap-1 text-[11px] text-slate-400">
                  <span>金額（単価・税抜）</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">¥</span>
                    <input
                      type="number"
                      min={unitPriceMinOf(line)}
                      step="1"
                      inputMode="numeric"
                      aria-label={`${line.label}の金額（単価）`}
                      value={api.draft.review.unitPriceInputsByLine[wizardPricingLineId(line)] ?? String(line.unitPrice ?? "")}
                      onChange={(event) => api.setServiceLineAdjustment(
                        wizardPricingLineId(line),
                        { unitPriceInput: event.target.value },
                      )}
                      className="h-10 w-full rounded-lg border border-slate-600 bg-slate-950 pl-7 pr-3 text-right text-sm text-slate-100"
                    />
                  </div>
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
              );
            })}
          </ol>
        )}
      </Card>
      {saveBinding
        // The SAME read-only pricing result shown above gates the save controls: the panel
        // refuses a fresh save unless it is unambiguously complete.
        ? <WizardSavePanel draft={api.draft} pricing={pricing} binding={saveBinding} />
        : <PhaseTwoNotice screen="保存 / PDF / LINE(送信・文章コピー) / 予約カレンダー / 請求書・納品書・納品請求書" />}
    </>
  );
}
