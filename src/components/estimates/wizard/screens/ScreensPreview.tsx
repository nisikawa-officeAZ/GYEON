"use client";

// Estimate Wizard Ver2.2 — development-only preview harness (Phase 9).
//
// SINGLE canonical-draft owner: this harness holds ONE EstimateWizardDraftV22 and drives Screens
// 1–7 by reading from it and writing through the typed immutable update helpers. No duplicate
// per-screen business-state owner exists. It contains NO pricing / OCR / save logic and is NOT
// route-mounted. Preview-only, non-draft context (dealer shop rank, 3M recommendation display,
// Screen-4 active section, id sequence counters, editor-preview toggle) is kept out of the draft.

import { useState } from "react";
import { WizardShell } from "../foundation/WizardShell";
import type { WizardStepId } from "../foundation/tokens";
import type { WizardTotalsView } from "../foundation/MiniTotalBar";
import { Step1Customer } from "./Step1Customer";
import { Step2Vehicle } from "./Step2Vehicle";
import { Step3Category } from "./Step3Category";
import { Step4Estimate } from "./Step4Estimate";
import { CoatingSelector } from "./CoatingSelector";
import {
  firstLayerOptions, secondLayerOptions, thirdLayerOptions, isCoatingAvailableForRank,
} from "./coating-matrix";
import { PpfSelector } from "./PpfSelector";
import { DEFAULT_PPF_METHODS, DEFAULT_PPF_PARTS, DEFAULT_PPF_TYPE_GROUPS } from "./ppf-config";
import { WindowFilmSelector } from "./WindowFilmSelector";
import { DEFAULT_WINDOW_AREAS, EXAMPLE_FILM_TYPES } from "./window-film-config";
import { BodyMaintenanceSelector } from "./BodyMaintenanceSelector";
import { EXAMPLE_MAINTENANCE_MENUS } from "./body-maintenance-config";
import { CarWashSelector } from "./CarWashSelector";
import { EXAMPLE_WASH_MENUS } from "./car-wash-config";
import { RoomCleaningSelector } from "./RoomCleaningSelector";
import { EXAMPLE_ROOM_MENUS } from "./room-cleaning-config";
import { OtherWorkSelector } from "./OtherWorkSelector";
import { EXAMPLE_OTHER_WORK_PRESETS } from "./other-work-config";
import { StoreGlobalOptionsSelector } from "./StoreGlobalOptionsSelector";
import { EXAMPLE_STORE_GLOBAL_OPTIONS } from "./store-global-options-config";
import { Step5Discount } from "./Step5Discount";
import { EXAMPLE_COUPONS } from "./discount-coupon-config";
import { Step6Notes } from "./Step6Notes";
import { Step7Review } from "./Step7Review";
import { WizardEstimatePreviewBridge } from "../integration/WizardEstimatePreviewBridge";
import { wizardToEstimatePreviewAdapter, type PreviewContext } from "../integration/wizardToEstimateAdapter";
import { useWizardPricing } from "../pricing/useWizardPricing";
import { formatYen } from "../foundation/tokens";
import type { PreviewPriceSummary } from "../integration/previewTypes";
import {
  initialEstimateWizardDraftV22, setCurrentStep,
  updateCustomer, updateNewCustomer, updateVehicle, updateNewVehicle,
  updateServiceSelection, updateServiceConfiguration, updateDiscountAndCoupon, updateNotes, updateReview,
} from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, WizardServiceCategory } from "../draft/wizard-draft-types";
import type { ShopRank, CustomerMode, VehicleMode } from "./step-types";
import type { BodySizeEstimate } from "@/lib/vehicles/body-size-estimate";
import { SERVICE_CATEGORY_IDS } from "@/lib/estimates/service-categories";

// Preview-only cross-service scenarios (Phase 4I validation aid — not production).
const PREVIEW_SCENARIOS: { label: string; ids: WizardServiceCategory[] }[] = [
  { label: "① コーティングのみ", ids: ["coating"] },
  { label: "② PPFのみ", ids: ["ppf"] },
  { label: "③ フィルムのみ", ids: ["window"] },
  { label: "④ コーティング+PPF", ids: ["coating", "ppf"] },
  { label: "⑤ PPF+フィルム", ids: ["ppf", "window"] },
  { label: "⑥ メンテ+洗車", ids: ["maintenance", "carwash"] },
  { label: "⑦ ルーム+その他", ids: ["roomclean", "other"] },
  { label: "⑧ 全7カテゴリ", ids: [...SERVICE_CATEGORY_IDS] },
];

const MOCK_TOTALS: WizardTotalsView = { subtotal: 0, discount: 0, tax: 0, total: 0, ready: false };

const yenOrDash = (v: number | null) => (v == null ? "—" : formatYen(v));

function cnBtn(active: boolean): string {
  return [
    "text-[11px] px-2.5 min-h-[36px] rounded-md border transition-colors",
    active ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700 text-slate-400",
  ].join(" ");
}

function toggleId<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function ScreensPreview() {
  // ── The single canonical draft (owner) ──────────────────────────────────────
  const [draft, setDraft] = useState<EstimateWizardDraftV22>(initialEstimateWizardDraftV22);
  // ── Preview-only, non-draft context ─────────────────────────────────────────
  const [shopRank, setShopRank] = useState<ShopRank>("detailer");
  const [sizeEstimate, setSizeEstimate] = useState<BodySizeEstimate | null>(null);
  const [activeSection, setActiveSection] = useState("coating");
  const [ppfRowSeq, setPpfRowSeq] = useState(1);
  const [owRowSeq, setOwRowSeq] = useState(1);
  const [showEditorPreview, setShowEditorPreview] = useState(false);

  const goStep = (n: number) => setDraft((d) => setCurrentStep(d, n));

  const step = draft.metadata.currentStep;
  const customer = draft.customer;
  const vehicle = draft.vehicle;
  const nc = customer.newCustomer;
  const nv = vehicle.newVehicle;
  const cfg = draft.serviceConfiguration;
  const categories = draft.serviceSelection.selectedCategories;
  const dc = draft.discountAndCoupon;

  const customerMode: CustomerMode = customer.sourceMode === "existing" ? "select" : "new";
  const vehicleMode: VehicleMode = vehicle.sourceMode === "existing" ? "select" : "new";

  // Screen 4 — valid active section from selected categories (fixed order); state persists in the
  // draft so hidden/deselected sections keep their values.
  const orderedSelected = SERVICE_CATEGORY_IDS.filter((id) => categories.includes(id));
  const resolvedActive = categories.includes(activeSection as WizardServiceCategory)
    ? activeSection
    : (orderedSelected[0] ?? "");
  const showAdjustment = categories.includes("coating") && categories.includes("ppf");

  // Phase 10D — read-only pricing from the PRODUCTION engine (no Screen arithmetic).
  const pricing = useWizardPricing(draft);
  const previewPriceSummary: PreviewPriceSummary = {
    mockRows: [
      { label: "サービス小計", value: yenOrDash(pricing.subtotal) },
      { label: "値引き", value: pricing.discountTotal ? `− ${yenOrDash(pricing.discountTotal)}` : yenOrDash(pricing.discountTotal) },
      { label: "クーポン", value: yenOrDash(pricing.couponTotal) },
      { label: "消費税", value: yenOrDash(pricing.taxTotal) },
      { label: "合計", value: yenOrDash(pricing.grandTotal) },
    ],
    note: "金額は既存の本番価格エンジンが算出（読み取り専用）。保存・PDF・送信は行いません。",
  };

  const nonCombinable = EXAMPLE_COUPONS.filter((c) => c.combinable === false).map((c) => c.id);
  const anyCombinableSelected = dc.selectedCouponIds.some((id) => !nonCombinable.includes(id));
  const anyNonCombinableSelected = dc.selectedCouponIds.some((id) => nonCombinable.includes(id));
  const disabledCouponIds = anyNonCombinableSelected
    ? EXAMPLE_COUPONS.filter((c) => !dc.selectedCouponIds.includes(c.id)).map((c) => c.id)
    : anyCombinableSelected
      ? nonCombinable.filter((id) => !dc.selectedCouponIds.includes(id))
      : [];
  const discountCouponMessages: string[] = [];
  if (anyNonCombinableSelected) discountCouponMessages.push("このクーポンは他のクーポンと併用できません。");
  if (nc.isBusiness) discountCouponMessages.push("業者掛け率適用中は追加値引きできません。");

  // Read-only preview payload (single source for Screen 7 review AND the editor bridge).
  const previewContext: PreviewContext = { shopRank, priceSummary: previewPriceSummary };
  const previewData = wizardToEstimatePreviewAdapter(draft, previewContext);

  // Phase 8/9 — read-only EstimateEditor preview via the adapter bridge (canonical draft → adapter
  // → EstimateEditor). Toggling off (adapter removed) returns to the wizard; the preview disappears.
  if (showEditorPreview) {
    return (
      <div className="min-h-screen bg-[#080d1a]">
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowEditorPreview(false)}
            className="text-xs text-slate-300 border border-slate-700 hover:border-slate-500 px-3 min-h-[40px] rounded-lg transition-colors"
          >
            ← ウィザードに戻る（プレビューを閉じる）
          </button>
        </div>
        <WizardEstimatePreviewBridge draft={draft} context={previewContext} />
      </div>
    );
  }

  return (
    <WizardShell
      title="見積ウィザード（Ver2.2 プレビュー）"
      estimateNo="PREVIEW"
      step={step as WizardStepId}
      jumpTo={(s) => goStep(s)}
      onBack={() => goStep(step - 1)}
      onNext={() => goStep(step + 1)}
      isFirst={step === 1}
      isLast={step === 7}
      totals={MOCK_TOTALS}
    >
      {step === 1 && (
        <Step1Customer
          customerMode={customerMode}
          onSetCustomerMode={(m) => setDraft((d) => updateCustomer(d, { sourceMode: m === "select" ? "existing" : "new" }))}
          onOpenOcr={() => {}}
          customerId={customer.customerId ?? ""}
          onSelectCustomer={(id) => setDraft((d) => updateCustomer(d, { customerId: id || null }))}
          customers={[]}
          nc={nc}
          onChangeNc={(patch) => setDraft((d) => updateNewCustomer(d, patch))}
          onCreateCustomer={() => {}}
          creatingCustomer={false}
          lineBusinessConfigured={false}
        />
      )}
      {step === 2 && (
        <Step2Vehicle
          vehicleMode={vehicleMode}
          onSetVehicleMode={(m) => setDraft((d) => updateVehicle(d, { sourceMode: m === "select" ? "existing" : "new" }))}
          onOpenOcr={() => {}}
          vehicleId={vehicle.vehicleId ?? ""}
          onSelectVehicle={(id) => setDraft((d) => updateVehicle(d, { vehicleId: id || null }))}
          vehicles={[]}
          nv={nv}
          onChangeNv={(patch) => setDraft((d) => updateNewVehicle(d, patch))}
          sizeKey={vehicle.bodySizeKey}
          onSelectSize={(k) => setDraft((d) => updateVehicle(d, { bodySizeKey: k }))}
          sizeKeys={["SS", "S", "M", "ML", "L", "LL", "XL"]}
          sizeEstimate={sizeEstimate}
          onEstimateSize={() => setSizeEstimate({ sizeKey: "L", basis: "プレビュー（3M推定の例）" } as BodySizeEstimate)}
        />
      )}
      {step === 3 && (
        <Step3Category
          selected={categories}
          onToggle={(id) =>
            setDraft((d) => updateServiceSelection(d, { selectedCategories: toggleId(d.serviceSelection.selectedCategories, id as WizardServiceCategory) }))
          }
        />
      )}
      {step === 4 && (
        <div className="flex flex-col gap-3">
          {/* Preview-only cross-service scenario presets (Phase 4I validation aid). */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">シナリオ（プレビュー）:</span>
            {PREVIEW_SCENARIOS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setDraft((d) => updateServiceSelection(d, { selectedCategories: [...s.ids] }))}
                className={cnBtn(categories.length === s.ids.length && s.ids.every((id) => categories.includes(id)))}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Preview-only shop-rank switch (in production this comes from dealer settings). */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">ショップランク（プレビュー切替）:</span>
            {(["shop", "detailer", "certified", "ppf_installer"] as ShopRank[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setShopRank(r); setDraft((d) => updateServiceConfiguration(d, "coating", { layer1Id: null, layer2Id: null, layer3Id: null })); }}
                className={cnBtn(shopRank === r)}
              >
                {r}
              </button>
            ))}
          </div>

          <Step4Estimate
            selectedCategories={categories}
            activeSection={resolvedActive}
            onSelectSection={setActiveSection}
            adjustmentNotice={
              showAdjustment
                ? "コーティング + PPF 併用による店舗設定ベースの価格調整メッセージがここに表示されます（例）。実際の減額計算・価格変更は行いません。"
                : undefined
            }
            globalOptionsSlot={
              <StoreGlobalOptionsSelector
                globalOptions={EXAMPLE_STORE_GLOBAL_OPTIONS}
                selectedCategoryIds={categories}
                selectedGlobalOptionIds={cfg.storeGlobalOptions.selectedOptionIds}
                unitPricesByOption={cfg.storeGlobalOptions.unitPricesByOption}
                quantitiesByOption={cfg.storeGlobalOptions.quantitiesByOption}
                onGlobalOptionToggle={(id) =>
                  setDraft((d) => updateServiceConfiguration(d, "storeGlobalOptions", { selectedOptionIds: toggleId(d.serviceConfiguration.storeGlobalOptions.selectedOptionIds, id) }))
                }
                onUnitPriceChange={(id, v) => setDraft((d) => updateServiceConfiguration(d, "storeGlobalOptions", { unitPricesByOption: { ...d.serviceConfiguration.storeGlobalOptions.unitPricesByOption, [id]: v } }))}
                onQuantityChange={(id, qty) => setDraft((d) => updateServiceConfiguration(d, "storeGlobalOptions", { quantitiesByOption: { ...d.serviceConfiguration.storeGlobalOptions.quantitiesByOption, [id]: qty } }))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            }
          >
            {resolvedActive === "coating" ? (
              <CoatingSelector
                shopRank={shopRank}
                coatingLocked={!isCoatingAvailableForRank(shopRank)}
                lockReason="GYEON PPFインストーラーはコーティングを施工できません。"
                selectedLayerCount={cfg.coating.layerCount}
                selectedLayer1ProductId={cfg.coating.layer1Id}
                selectedLayer2ProductId={cfg.coating.layer2Id}
                selectedLayer3ProductId={cfg.coating.layer3Id}
                availableLayer1Products={firstLayerOptions(shopRank)}
                availableLayer2Products={secondLayerOptions(cfg.coating.layer1Id)}
                availableLayer3Products={thirdLayerOptions(cfg.coating.layer1Id)}
                onLayerCountChange={(n) => setDraft((d) => updateServiceConfiguration(d, "coating", { layerCount: n }))}
                onLayer1Change={(id) => setDraft((d) => updateServiceConfiguration(d, "coating", { layer1Id: id, layer2Id: null, layer3Id: null }))}
                onLayer2Change={(id) => setDraft((d) => updateServiceConfiguration(d, "coating", { layer2Id: id }))}
                onLayer3Change={(id) => setDraft((d) => updateServiceConfiguration(d, "coating", { layer3Id: id }))}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "ppf" ? (
              <PpfSelector
                shopRank={shopRank}
                ppfLocked={shopRank === "shop"}
                lockReason="GYEONショップランクでは PPF は施工できません。"
                selectedInstallationMethod={cfg.ppf.installationMethod}
                installationMethods={DEFAULT_PPF_METHODS}
                onInstallationMethodChange={(id) => setDraft((d) => updateServiceConfiguration(d, "ppf", { installationMethod: id }))}
                selectedPartialPartIds={cfg.ppf.selectedPartIds}
                partialParts={DEFAULT_PPF_PARTS}
                quantitiesByPart={cfg.ppf.quantitiesByPart}
                onPartialPartToggle={(id) =>
                  setDraft((d) => updateServiceConfiguration(d, "ppf", { selectedPartIds: toggleId(d.serviceConfiguration.ppf.selectedPartIds, id) }))
                }
                onQuantityChange={(id, qty) => setDraft((d) => updateServiceConfiguration(d, "ppf", { quantitiesByPart: { ...d.serviceConfiguration.ppf.quantitiesByPart, [id]: qty } }))}
                selectedPpfTypeId={cfg.ppf.ppfTypeId}
                ppfTypes={DEFAULT_PPF_TYPE_GROUPS}
                onPpfTypeChange={(id) => setDraft((d) => updateServiceConfiguration(d, "ppf", { ppfTypeId: id }))}
                interiorRows={cfg.ppf.interiorRows}
                onInteriorRowAdd={() => { const id = `row-${ppfRowSeq}`; setPpfRowSeq((n) => n + 1); setDraft((d) => updateServiceConfiguration(d, "ppf", { interiorRows: [...d.serviceConfiguration.ppf.interiorRows, { id, location: "", amount: "" }] })); }}
                onInteriorRowUpdate={(id, patch) => setDraft((d) => updateServiceConfiguration(d, "ppf", { interiorRows: d.serviceConfiguration.ppf.interiorRows.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))}
                onInteriorRowDelete={(id) => setDraft((d) => updateServiceConfiguration(d, "ppf", { interiorRows: d.serviceConfiguration.ppf.interiorRows.filter((x) => x.id !== id) }))}
                displayedUnitPrice={cfg.ppf.ppfTypeId ? 180000 : null}
                editableUnitPrice={cfg.ppf.unitPriceInput}
                onUnitPriceChange={(v) => setDraft((d) => updateServiceConfiguration(d, "ppf", { unitPriceInput: v }))}
                coefficientDisplay={cfg.ppf.ppfTypeId ? "×1.00（例・表示のみ）" : null}
                combinedServiceAdjustment={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "window" ? (
              <WindowFilmSelector
                shopRank={shopRank}
                windowLocked={shopRank === "shop"}
                lockReason="GYEONショップランクではウィンドウフィルムは選択できません。"
                areas={DEFAULT_WINDOW_AREAS}
                selectedAreaIds={cfg.windowFilm.selectedAreaIds}
                onAreaToggle={(id) =>
                  setDraft((d) => updateServiceConfiguration(d, "windowFilm", { selectedAreaIds: toggleId(d.serviceConfiguration.windowFilm.selectedAreaIds, id) }))
                }
                filmTypes={EXAMPLE_FILM_TYPES}
                selectedFilmTypeId={cfg.windowFilm.filmTypeId}
                onFilmTypeChange={(id) => setDraft((d) => updateServiceConfiguration(d, "windowFilm", { filmTypeId: id }))}
                displayedUnitPrice={cfg.windowFilm.filmTypeId ? (EXAMPLE_FILM_TYPES.find((f) => f.id === cfg.windowFilm.filmTypeId)?.defaultUnitPrice ?? null) : null}
                editableUnitPrice={cfg.windowFilm.unitPriceInput}
                onUnitPriceChange={(v) => setDraft((d) => updateServiceConfiguration(d, "windowFilm", { unitPriceInput: v }))}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "maintenance" ? (
              <BodyMaintenanceSelector
                maintenanceMenus={EXAMPLE_MAINTENANCE_MENUS}
                selectedMaintenanceMenuId={cfg.bodyMaintenance.menuId}
                onMaintenanceMenuChange={(id) => setDraft((d) => updateServiceConfiguration(d, "bodyMaintenance", { menuId: id }))}
                displayedUnitPrice={cfg.bodyMaintenance.menuId ? (EXAMPLE_MAINTENANCE_MENUS.find((m) => m.id === cfg.bodyMaintenance.menuId)?.defaultPrice ?? null) : null}
                editablePriceAllowed
                editableUnitPrice={cfg.bodyMaintenance.unitPriceInput}
                onUnitPriceChange={(v) => setDraft((d) => updateServiceConfiguration(d, "bodyMaintenance", { unitPriceInput: v }))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "carwash" ? (
              <CarWashSelector
                washMenus={EXAMPLE_WASH_MENUS}
                selectedWashMenuId={cfg.carWash.menuId}
                onWashMenuChange={(id) => setDraft((d) => updateServiceConfiguration(d, "carWash", { menuId: id }))}
                displayedUnitPrice={cfg.carWash.menuId ? (EXAMPLE_WASH_MENUS.find((m) => m.id === cfg.carWash.menuId)?.defaultPrice ?? null) : null}
                editablePriceAllowed
                editableUnitPrice={cfg.carWash.unitPriceInput}
                onUnitPriceChange={(v) => setDraft((d) => updateServiceConfiguration(d, "carWash", { unitPriceInput: v }))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "roomclean" ? (
              <RoomCleaningSelector
                roomMenus={EXAMPLE_ROOM_MENUS}
                selectedRoomMenuIds={cfg.roomCleaning.selectedMenuIds}
                onRoomMenuToggle={(id) =>
                  setDraft((d) => updateServiceConfiguration(d, "roomCleaning", { selectedMenuIds: toggleId(d.serviceConfiguration.roomCleaning.selectedMenuIds, id) }))
                }
                editablePriceAllowed
                editableUnitPrices={cfg.roomCleaning.unitPricesByMenu}
                onUnitPriceChange={(id, v) => setDraft((d) => updateServiceConfiguration(d, "roomCleaning", { unitPricesByMenu: { ...d.serviceConfiguration.roomCleaning.unitPricesByMenu, [id]: v } }))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "other" ? (
              <OtherWorkSelector
                presetOtherWorkItems={EXAMPLE_OTHER_WORK_PRESETS}
                selectedPresetItemIds={cfg.otherWork.selectedPresetIds}
                onPresetItemToggle={(id) =>
                  setDraft((d) => updateServiceConfiguration(d, "otherWork", { selectedPresetIds: toggleId(d.serviceConfiguration.otherWork.selectedPresetIds, id) }))
                }
                unitPricesByItem={cfg.otherWork.unitPricesByItem}
                onUnitPriceChange={(id, v) => setDraft((d) => updateServiceConfiguration(d, "otherWork", { unitPricesByItem: { ...d.serviceConfiguration.otherWork.unitPricesByItem, [id]: v } }))}
                quantitiesByItem={cfg.otherWork.quantitiesByItem}
                onQuantityChange={(id, qty) => setDraft((d) => updateServiceConfiguration(d, "otherWork", { quantitiesByItem: { ...d.serviceConfiguration.otherWork.quantitiesByItem, [id]: qty } }))}
                customRows={cfg.otherWork.customRows}
                onCustomRowAdd={() => { const id = `ow-${owRowSeq}`; setOwRowSeq((n) => n + 1); setDraft((d) => updateServiceConfiguration(d, "otherWork", { customRows: [...d.serviceConfiguration.otherWork.customRows, { id, name: "", description: "", unitPrice: "", quantity: "", unitLabel: "" }] })); }}
                onCustomRowUpdate={(id, patch) => setDraft((d) => updateServiceConfiguration(d, "otherWork", { customRows: d.serviceConfiguration.otherWork.customRows.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))}
                onCustomRowDelete={(id) => setDraft((d) => updateServiceConfiguration(d, "otherWork", { customRows: d.serviceConfiguration.otherWork.customRows.filter((x) => x.id !== id) }))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : (
              <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
                <p className="text-xs text-slate-400">
                  「{resolvedActive || "（未選択）"}」セクションは後続フェーズで実装します。追加サービスオプションは全カテゴリ共通で下部に表示されます。
                </p>
              </div>
            )}
          </Step4Estimate>
        </div>
      )}
      {step === 5 && (
        <Step5Discount
          subtotal={pricing.subtotal ?? 0}
          activeDiscountMode={dc.mode}
          discountAmountValue={dc.amountInput}
          discountPercentValue={dc.percentInput}
          convertedDiscountAmount={null}
          maximumDiscountAmount={100000}
          minimumDiscountPercent={0}
          maximumDiscountPercent={30}
          availableCoupons={EXAMPLE_COUPONS}
          selectedCouponIds={dc.selectedCouponIds}
          disabledCouponIds={disabledCouponIds}
          disabledReasonByCoupon={{}}
          informationalMessages={discountCouponMessages}
          discountValidationMessage={null}
          onDiscountModeChange={(m) => setDraft((d) => updateDiscountAndCoupon(d, { mode: m }))}
          onDiscountAmountChange={(v) => setDraft((d) => updateDiscountAndCoupon(d, { amountInput: v }))}
          onDiscountPercentChange={(v) => setDraft((d) => updateDiscountAndCoupon(d, { percentInput: v }))}
          onDiscountClear={() => setDraft((d) => updateDiscountAndCoupon(d, { amountInput: "", percentInput: "" }))}
          onCouponToggle={(id) => setDraft((d) => updateDiscountAndCoupon(d, { selectedCouponIds: toggleId(d.discountAndCoupon.selectedCouponIds, id) }))}
          onContinue={() => goStep(step + 1)}
        />
      )}
      {step === 6 && (
        <Step6Notes
          customerNotes={draft.notes.customerNotes}
          internalMemo={draft.notes.internalMemo}
          onCustomerNotesChange={(v) => setDraft((d) => updateNotes(d, { customerNotes: v }))}
          onInternalMemoChange={(v) => setDraft((d) => updateNotes(d, { internalMemo: v }))}
          onBack={() => goStep(step - 1)}
          onContinue={() => goStep(step + 1)}
        />
      )}
      {step === 7 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowEditorPreview(true)}
            className="text-xs text-blue-300 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-3 min-h-[40px] rounded-lg transition-colors"
          >
            EstimateEditor 読み取りプレビューを開く（Phase 8 ブリッジ）
          </button>
        </div>
      )}
      {step === 7 && (
        <Step7Review
          customerName={previewData.customerName}
          vehicleName={previewData.vehicleName}
          categoryCount={previewData.categoryCount}
          customerFields={previewData.customerFields}
          vehicleFields={previewData.vehicleFields}
          serviceLines={previewData.serviceLines}
          discountFields={previewData.discountFields}
          couponSummaries={previewData.couponSummaries}
          customerNotes={previewData.customerNotes}
          internalMemo={previewData.internalMemo}
          pricing={pricing}
          previewConfirmed={draft.review.previewConfirmed}
          onPreviewConfirm={() => setDraft((d) => updateReview(d, { previewConfirmed: true }))}
          onEditCustomer={() => goStep(1)}
          onEditVehicle={() => goStep(2)}
          onEditServices={() => goStep(categories.length ? 4 : 3)}
          onEditDiscount={() => goStep(5)}
          onEditNotes={() => goStep(6)}
          onBack={() => goStep(6)}
        />
      )}
    </WizardShell>
  );
}
