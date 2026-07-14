"use client";

// Estimate Wizard Ver2.2 — PRODUCTION container (Phase 8-B2C).
//
// The first production host of the tracked Screen 1–7 controlled components. It owns ONE legitimate
// V2.2 draft, drives the approved screens, and hands EstimateEditor a fully-validated apply plan.
//
// ── WHAT THIS IS NOT ────────────────────────────────────────────────────────────
// It is NOT ScreensPreview. Nothing is imported from `screens/ScreensPreview.tsx`, from
// `wizard/steps/` (the untracked legacy duplicate), or from any untracked root `wizard/*.tsx` file.
// Every import below resolves to a TRACKED module under screens/, foundation/, draft/, pricing/, or
// integration/. It performs NO save: no `createEstimate`, no `updateEstimate`, no
// `saveEstimateFromWizardAction`, no PDF, no LINE, no Calendar, no OCR, no server action of any kind.
// Applying hands a plan to the editor and stops. The operator still presses 保存 themselves.
//
// ── HOW THE OPAQUE DRAFT IS OWNED ───────────────────────────────────────────────
// `HydratedWizardDraft` can only be produced by `newEstimateWizardDraft()` / `estimateToWizardDraft()`
// — it cannot be rebuilt by spread or literal, and this file never tries. So the container creates
// exactly ONE opaque draft for the wizard session and keeps it in a ref for its whole life.
//
// Screens edit that draft's `.draft` body, which Phase 8-B1G deliberately left MUTABLE precisely
// because it is Wizard-owned presentation state (the `integration` provenance beside it is frozen,
// and stays frozen — the operator can never type over where the draft came from). Each edit runs the
// official pure reducer, then copies the reducer's result back onto the same `.draft` object with
// `Object.assign`, and bumps a render counter.
//
// Why copy back instead of `setState(newDraft)`: the reducers return a NEW `EstimateWizardDraftV22`,
// and there is no constructor that wraps an arbitrary draft in the opaque envelope. Rebuilding the
// envelope around a reducer result would BE the forgery the contract exists to prevent. Keeping one
// envelope and updating its mutable body is the only route that never fabricates provenance.
//
// The body is a private DEEP CLONE (`cloneWizardDraft`), so nothing here is shared with
// `initialEstimateWizardDraftV22` or with any other draft, and the write-back cannot leak.
//
// ── NOT MOUNTED IN PRODUCTION (Phase 8-B2C-S) ───────────────────────────────────
// EstimateEditor does NOT render this component and `/estimates/new` exposes no route to it. It is
// preserved, compiled and type-checked for a later phase, but it is deliberately unreachable until
// (a) an authoritative dealer `shopRank` source exists, (b) dealer-configured Screen-4 option lists
// replace the fixture ones, and (c) persisted new-customer / new-vehicle workflows are wired. Every
// operator-visible collection below is therefore a REQUIRED prop with no default — a caller cannot
// mount this by accident, and cannot silently get fixture data or empty arrays.

import { useCallback, useRef, useState } from "react";

import type { CustomerDB } from "@/lib/customers/customer-types";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { PricedLineItem } from "@/lib/pricing/pricing-engine";
import { SERVICE_CATEGORY_IDS } from "@/lib/estimates/service-categories";

import { WizardShell } from "../foundation/WizardShell";
import type { WizardStepId } from "../foundation/tokens";
import type { WizardTotalsView } from "../foundation/MiniTotalBar";

import { Step1Customer } from "../screens/Step1Customer";
import { Step2Vehicle } from "../screens/Step2Vehicle";
import { Step3Category } from "../screens/Step3Category";
import { Step4Estimate } from "../screens/Step4Estimate";
import { Step5Discount } from "../screens/Step5Discount";
import { Step6Notes } from "../screens/Step6Notes";
import { Step7Review } from "../screens/Step7Review";
import { CoatingSelector } from "../screens/CoatingSelector";
import { PpfSelector } from "../screens/PpfSelector";
import { WindowFilmSelector } from "../screens/WindowFilmSelector";
import { BodyMaintenanceSelector } from "../screens/BodyMaintenanceSelector";
import { CarWashSelector } from "../screens/CarWashSelector";
import { RoomCleaningSelector } from "../screens/RoomCleaningSelector";
import { OtherWorkSelector } from "../screens/OtherWorkSelector";
import { StoreGlobalOptionsSelector } from "../screens/StoreGlobalOptionsSelector";
import {
  isCoatingAvailableForRank, firstLayerOptions, secondLayerOptions, thirdLayerOptions,
} from "../screens/coating-matrix";
// TYPES ONLY from the screen config modules. No EXAMPLE_* / DEFAULT_* fixture VALUE is imported:
// every operator-visible collection arrives through `WizardScreenConfiguration` below, so fixture
// data can never reach an operator — or an estimate's persisted item_name — through this container.
import type { ComponentProps } from "react";
import type { ShopRank, CustomerMode, VehicleMode } from "../screens/step-types";

import {
  setCurrentStep,
  updateCustomer, updateNewCustomer, updateVehicle, updateNewVehicle,
  updateServiceSelection, updateServiceConfiguration, updateDiscountAndCoupon, updateNotes, updateReview,
} from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, WizardServiceCategory } from "../draft/wizard-draft-types";
import { useWizardPricing } from "../pricing/useWizardPricing";

import { newEstimateWizardDraft, type HydratedWizardDraft } from "../integration/estimateToWizardDraft";
import {
  buildEstimateEditorApplyPlan,
  type EstimateEditorApplyPlan,
  type EstimateEditorMode,
} from "../integration/wizardDraftToEditorPatch";
import type { WizardOwnedFieldPatch } from "../integration/estimateWizardIntegrationContract";
import type { ProductionPricingConfiguration } from "../pricing/wizard-manual-pricing-config";
import { wizardToEstimatePreviewAdapter, type PreviewContext } from "../integration/wizardToEstimateAdapter";
import type { PreviewPriceSummary } from "../integration/previewTypes";
import { formatYen } from "../foundation/tokens";

/**
 * Registering a NEW customer or vehicle from inside the wizard is DEFERRED (Phase 8-B2C).
 *
 * EstimateEditor's `handleCreateCustomer` writes into the editor's OWN `nc` state and is not
 * callable with a wizard draft without changing its API — which this phase's allowlist forbids. The
 * one thing we must never do is invent an id to paper over that, so the sub-path is blocked here
 * with an explicit message instead. Existing-entity selection is fully supported.
 */
const NEW_ENTITY_DEFERRED_MESSAGE =
  "ウィザードからの新規顧客・新規車両の登録は、この段階では利用できません。" +
  "既存の顧客・車両を選択してください（新規登録は従来の登録フローをご利用ください）。";

const OCR_DEFERRED_MESSAGE =
  "ウィザードからの車検証OCR読み取りは、この段階では利用できません。従来の登録フローをご利用ください。";

const SELECTION_REQUIRED_MESSAGE =
  "顧客と車両を選択してください。選択が完了するまで見積編集画面へ反映できません。";

const yenOrDash = (v: number | null) => (v == null ? "—" : formatYen(v));

function toggleId<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * The operator-facing reason a plan was refused. Every branch resolves to real text — a blocked plan
 * is never silently swallowed, and the validator's own Japanese message is preferred wherever it
 * exists, verbatim, exactly as Phase 8-B1 wrote it.
 */
function blockedMessage(plan: Extract<EstimateEditorApplyPlan, { status: "blocked" }>): string {
  const first = plan.blockingIssues[0]?.message ?? plan.pricingErrors[0]?.message;
  if (first) return first;
  switch (plan.reason) {
    case "unsupported-editor-mode":
      return "既存見積の編集画面では、ウィザードからの反映は利用できません。";
    case "source-estimate-not-allowed-in-create":
      return "保存済み見積から作成された内容は、新規見積として反映できません。";
    case "integration-blocked":
    case "pricing-invalid":
    default:
      return "この内容では見積編集画面へ反映できません。入力内容をご確認ください。";
  }
}

/**
 * Every operator-visible collection on Screens 4–5, supplied by the caller.
 *
 * Each field's type is derived from the SELECTOR'S OWN prop type, so it cannot drift from what the
 * approved screens actually accept, and no shape is re-declared here.
 *
 * There is no default and no fallback. Not `EXAMPLE_*`, not `[]`. A caller that cannot supply a
 * dealer-configured list cannot mount this container — which is the point: silently substituting
 * fixture menus would put invented service names in front of an operator and, because manual line
 * labels become `item_name`, onto persisted estimates.
 */
export interface WizardScreenConfiguration {
  filmTypes:          ComponentProps<typeof WindowFilmSelector>["filmTypes"];
  windowAreas:        ComponentProps<typeof WindowFilmSelector>["areas"];
  maintenanceMenus:   ComponentProps<typeof BodyMaintenanceSelector>["maintenanceMenus"];
  washMenus:          ComponentProps<typeof CarWashSelector>["washMenus"];
  roomMenus:          ComponentProps<typeof RoomCleaningSelector>["roomMenus"];
  otherWorkPresets:   ComponentProps<typeof OtherWorkSelector>["presetOtherWorkItems"];
  storeGlobalOptions: ComponentProps<typeof StoreGlobalOptionsSelector>["globalOptions"];
  coupons:            ComponentProps<typeof Step5Discount>["availableCoupons"];
  ppfMethods:         ComponentProps<typeof PpfSelector>["installationMethods"];
  ppfParts:           ComponentProps<typeof PpfSelector>["partialParts"];
  ppfTypeGroups:      ComponentProps<typeof PpfSelector>["ppfTypes"];
}

export interface EstimateWizardContainerProps {
  /** The hosting editor's mode. Only "create" can produce a ready plan — the planner enforces it. */
  mode: EstimateEditorMode;
  /** The editor's OWN catalog, so wizard items price exactly as editor items would. REQUIRED. */
  catalog: PricingCatalog;
  customers: CustomerDB[];
  vehicles: VehicleDB[];
  /**
   * Authoritative dealer shop rank. REQUIRED, with NO default.
   *
   * It gates real authorization: `shop` may not sell PPF or window film, `ppf_installer` may not
   * sell coating, and the available coating products differ per rank. Defaulting this to
   * `"detailer"` (as an earlier revision did) handed `shop` and `ppf_installer` operators services
   * they are not authorized to sell. A rank is never inferred, guessed, or defaulted here — the
   * caller must supply one, and no such authoritative source exists yet.
   */
  shopRank: ShopRank;
  /** Dealer-configured Screen-4/5 option lists. REQUIRED — no fixture fallback. */
  screenConfig: WizardScreenConfiguration;
  /**
   * Authoritative labels + quantity rules for every manual-priced category. REQUIRED (Phase 8-B2F-B).
   *
   * This is what becomes `estimate_items.item_name`. `screenConfig` governs only what the operator
   * SEES; before B2F-B the persisted label was resolved inside the pricing layer from hard-imported
   * fixtures, with a `?? id` fallback — so a preview-invented name or a raw id could be written onto
   * a real estimate. Supplying this is now the only way to price a draft.
   */
  pricingConfig: ProductionPricingConfiguration;
  /** Hand the validated plan to the editor. Scalars + items only — the editor owns the mutation. */
  onApply: (patch: WizardOwnedFieldPatch, items: readonly PricedLineItem[]) => void;
  /** Close without touching a single byte of editor state. */
  onCancel: () => void;
}

export default function EstimateWizardContainer({
  mode,
  catalog,
  customers,
  vehicles,
  shopRank,
  screenConfig,
  pricingConfig,
  onApply,
  onCancel,
}: EstimateWizardContainerProps) {
  // ── The single opaque draft for this wizard session ──────────────────────────
  // Created ONCE by the official factory. Never rebuilt, never spread, never cast.
  const hydratedRef = useRef<HydratedWizardDraft | null>(null);
  if (hydratedRef.current === null) hydratedRef.current = newEstimateWizardDraft();
  const hydrated = hydratedRef.current;
  const draft = hydrated.draft;

  const [, bumpVersion] = useState(0);
  const [activeSection, setActiveSection] = useState("coating");
  const [ppfRowSeq, setPpfRowSeq] = useState(1);
  const [owRowSeq, setOwRowSeq] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  /**
   * Run an official pure reducer, then copy its result back onto the SAME mutable draft body the
   * opaque envelope holds. `Object.assign` replaces nested references (the reducers rebuild them),
   * so nothing shared with `initialEstimateWizardDraftV22` is ever mutated in place.
   */
  const update = useCallback((reduce: (d: EstimateWizardDraftV22) => EstimateWizardDraftV22) => {
    Object.assign(hydrated.draft, reduce(hydrated.draft));
    bumpVersion((v) => v + 1);
  }, [hydrated]);

  const goStep = useCallback((n: number) => update((d) => setCurrentStep(d, n)), [update]);

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

  const orderedSelected = SERVICE_CATEGORY_IDS.filter((id) => categories.includes(id));
  const resolvedActive = categories.includes(activeSection as WizardServiceCategory)
    ? activeSection
    : (orderedSelected[0] ?? "");

  // Read-only pricing from the PRODUCTION engine. No arithmetic happens in this container.
  const pricing = useWizardPricing(draft);

  const wizardTotals: WizardTotalsView = {
    subtotal: pricing.subtotal ?? 0,
    discount: pricing.discountTotal ?? 0,
    tax:      pricing.taxTotal ?? 0,
    total:    pricing.grandTotal ?? 0,
    ready:    pricing.completeness === "complete",
  };
  const priceSummary: PreviewPriceSummary = {
    mockRows: [
      { label: "サービス小計", value: yenOrDash(pricing.subtotal) },
      { label: "値引き",       value: yenOrDash(pricing.discountTotal) },
      { label: "クーポン",     value: yenOrDash(pricing.couponTotal) },
      { label: "消費税",       value: yenOrDash(pricing.taxTotal) },
      { label: "合計",         value: yenOrDash(pricing.grandTotal) },
    ],
    note: "金額は既存の本番価格エンジンが算出（読み取り専用）。反映後、見積編集画面で保存してください。",
  };
  const previewContext: PreviewContext = { shopRank, priceSummary };
  const previewData = wizardToEstimatePreviewAdapter(draft, previewContext);

  const nonCombinable = screenConfig.coupons.filter((c) => c.combinable === false).map((c) => c.id);
  const anyCombinableSelected = dc.selectedCouponIds.some((id) => !nonCombinable.includes(id));
  const anyNonCombinableSelected = dc.selectedCouponIds.some((id) => nonCombinable.includes(id));
  const disabledCouponIds = anyNonCombinableSelected
    ? screenConfig.coupons.filter((c) => !dc.selectedCouponIds.includes(c.id)).map((c) => c.id)
    : anyCombinableSelected
      ? nonCombinable.filter((id) => !dc.selectedCouponIds.includes(id))
      : [];

  // ── Apply ───────────────────────────────────────────────────────────────────
  // Build the plan, refuse it or hand it over. No save, no server action, no side effect.
  const handleApply = useCallback(() => {
    setMessage(null);

    // The wizard cannot register new entities yet (see NEW_ENTITY_DEFERRED_MESSAGE), so an apply
    // without BOTH ids selected would carry `null` and blank the editor's selection. Refused here,
    // before the plan is even built. No id is ever invented to get past this.
    if (!draft.customer.customerId || !draft.vehicle.vehicleId) {
      setMessage(SELECTION_REQUIRED_MESSAGE);
      return;
    }

    const plan = buildEstimateEditorApplyPlan(hydrated, mode, catalog, pricingConfig);
    if (plan.status === "blocked") {
      setMessage(blockedMessage(plan)); // applies nothing
      return;
    }
    onApply(plan.patch, plan.items);
  }, [hydrated, mode, catalog, pricingConfig, draft, onApply]);

  return (
    <WizardShell
      title="見積ウィザード"
      estimateNo={null}
      step={step as WizardStepId}
      jumpTo={(s) => goStep(s)}
      onBack={() => (step === 1 ? onCancel() : goStep(step - 1))}
      onNext={() => goStep(step + 1)}
      isFirst={step === 1}
      isLast={step === 7}
      totals={wizardTotals}
    >
      {message !== null && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {message}
        </div>
      )}

      {step === 1 && (
        <Step1Customer
          customerMode={customerMode}
          onSetCustomerMode={(m) => {
            if (m === "new") setMessage(NEW_ENTITY_DEFERRED_MESSAGE);
            update((d) => updateCustomer(d, { sourceMode: m === "select" ? "existing" : "new" }));
          }}
          onOpenOcr={() => setMessage(OCR_DEFERRED_MESSAGE)}
          customerId={customer.customerId ?? ""}
          onSelectCustomer={(id) => update((d) => updateCustomer(d, { customerId: id || null }))}
          customers={customers}
          nc={nc}
          onChangeNc={(patch) => update((d) => updateNewCustomer(d, patch))}
          onCreateCustomer={() => setMessage(NEW_ENTITY_DEFERRED_MESSAGE)}
          creatingCustomer={false}
          lineBusinessConfigured={false}
        />
      )}

      {step === 2 && (
        <Step2Vehicle
          vehicleMode={vehicleMode}
          onSetVehicleMode={(m) => {
            if (m === "new") setMessage(NEW_ENTITY_DEFERRED_MESSAGE);
            update((d) => updateVehicle(d, { sourceMode: m === "select" ? "existing" : "new" }));
          }}
          onOpenOcr={() => setMessage(OCR_DEFERRED_MESSAGE)}
          vehicleId={vehicle.vehicleId ?? ""}
          onSelectVehicle={(id) => update((d) => updateVehicle(d, { vehicleId: id || null }))}
          vehicles={vehicles}
          nv={nv}
          onChangeNv={(patch) => update((d) => updateNewVehicle(d, patch))}
          sizeKey={vehicle.bodySizeKey}
          onSelectSize={(k) => update((d) => updateVehicle(d, { bodySizeKey: k }))}
          sizeKeys={catalog.bodySizes.map((b) => b.key)}
          sizeEstimate={null}
          onEstimateSize={() => setMessage(OCR_DEFERRED_MESSAGE)}
        />
      )}

      {step === 3 && (
        <Step3Category
          selected={categories}
          onToggle={(id) =>
            update((d) =>
              updateServiceSelection(d, {
                selectedCategories: toggleId(d.serviceSelection.selectedCategories, id as WizardServiceCategory),
              }),
            )
          }
        />
      )}

      {step === 4 && (
        <Step4Estimate
          selectedCategories={categories}
          activeSection={resolvedActive}
          onSelectSection={setActiveSection}
          globalOptionsSlot={
            <StoreGlobalOptionsSelector
              globalOptions={screenConfig.storeGlobalOptions}
              selectedCategoryIds={categories}
              selectedGlobalOptionIds={cfg.storeGlobalOptions.selectedOptionIds}
              unitPricesByOption={cfg.storeGlobalOptions.unitPricesByOption}
              quantitiesByOption={cfg.storeGlobalOptions.quantitiesByOption}
              onGlobalOptionToggle={(id) =>
                update((d) => updateServiceConfiguration(d, "storeGlobalOptions", {
                  selectedOptionIds: toggleId(d.serviceConfiguration.storeGlobalOptions.selectedOptionIds, id),
                }))
              }
              onUnitPriceChange={(id, v) =>
                update((d) => updateServiceConfiguration(d, "storeGlobalOptions", {
                  unitPricesByOption: { ...d.serviceConfiguration.storeGlobalOptions.unitPricesByOption, [id]: v },
                }))
              }
              onQuantityChange={(id, qty) =>
                update((d) => updateServiceConfiguration(d, "storeGlobalOptions", {
                  quantitiesByOption: { ...d.serviceConfiguration.storeGlobalOptions.quantitiesByOption, [id]: qty },
                }))
              }
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
              onLayerCountChange={(n) => update((d) => updateServiceConfiguration(d, "coating", { layerCount: n }))}
              onLayer1Change={(id) => update((d) => updateServiceConfiguration(d, "coating", { layer1Id: id, layer2Id: null, layer3Id: null }))}
              onLayer2Change={(id) => update((d) => updateServiceConfiguration(d, "coating", { layer2Id: id }))}
              onLayer3Change={(id) => update((d) => updateServiceConfiguration(d, "coating", { layer3Id: id }))}
              onAddOrUpdate={() => {}}
            />
          ) : resolvedActive === "ppf" ? (
            <PpfSelector
              shopRank={shopRank}
              ppfLocked={shopRank === "shop"}
              lockReason="GYEONショップランクでは PPF は施工できません。"
              selectedInstallationMethod={cfg.ppf.installationMethod}
              installationMethods={screenConfig.ppfMethods}
              onInstallationMethodChange={(id) => update((d) => updateServiceConfiguration(d, "ppf", { installationMethod: id }))}
              selectedPartialPartIds={cfg.ppf.selectedPartIds}
              partialParts={screenConfig.ppfParts}
              quantitiesByPart={cfg.ppf.quantitiesByPart}
              onPartialPartToggle={(id) =>
                update((d) => updateServiceConfiguration(d, "ppf", {
                  selectedPartIds: toggleId(d.serviceConfiguration.ppf.selectedPartIds, id),
                }))
              }
              onQuantityChange={(id, qty) =>
                update((d) => updateServiceConfiguration(d, "ppf", {
                  quantitiesByPart: { ...d.serviceConfiguration.ppf.quantitiesByPart, [id]: qty },
                }))
              }
              selectedPpfTypeId={cfg.ppf.ppfTypeId}
              ppfTypes={screenConfig.ppfTypeGroups}
              onPpfTypeChange={(id) => update((d) => updateServiceConfiguration(d, "ppf", { ppfTypeId: id }))}
              interiorRows={cfg.ppf.interiorRows}
              onInteriorRowAdd={() => {
                const id = `row-${ppfRowSeq}`;
                setPpfRowSeq((n) => n + 1);
                update((d) => updateServiceConfiguration(d, "ppf", {
                  interiorRows: [...d.serviceConfiguration.ppf.interiorRows, { id, location: "", amount: "" }],
                }));
              }}
              onInteriorRowUpdate={(id, patch) =>
                update((d) => updateServiceConfiguration(d, "ppf", {
                  interiorRows: d.serviceConfiguration.ppf.interiorRows.map((x) => (x.id === id ? { ...x, ...patch } : x)),
                }))
              }
              onInteriorRowDelete={(id) =>
                update((d) => updateServiceConfiguration(d, "ppf", {
                  interiorRows: d.serviceConfiguration.ppf.interiorRows.filter((x) => x.id !== id),
                }))
              }
              displayedUnitPrice={null}
              editableUnitPrice={cfg.ppf.unitPriceInput}
              onUnitPriceChange={(v) => update((d) => updateServiceConfiguration(d, "ppf", { unitPriceInput: v }))}
              coefficientDisplay={null}
              combinedServiceAdjustment={null}
              onAddOrUpdate={() => {}}
            />
          ) : resolvedActive === "window" ? (
            <WindowFilmSelector
              shopRank={shopRank}
              windowLocked={shopRank === "shop"}
              lockReason="GYEONショップランクではウィンドウフィルムは選択できません。"
              areas={screenConfig.windowAreas}
              selectedAreaIds={cfg.windowFilm.selectedAreaIds}
              onAreaToggle={(id) =>
                update((d) => updateServiceConfiguration(d, "windowFilm", {
                  selectedAreaIds: toggleId(d.serviceConfiguration.windowFilm.selectedAreaIds, id),
                }))
              }
              filmTypes={screenConfig.filmTypes}
              selectedFilmTypeId={cfg.windowFilm.filmTypeId}
              onFilmTypeChange={(id) => update((d) => updateServiceConfiguration(d, "windowFilm", { filmTypeId: id }))}
              displayedUnitPrice={
                cfg.windowFilm.filmTypeId
                  ? (screenConfig.filmTypes.find((f) => f.id === cfg.windowFilm.filmTypeId)?.defaultUnitPrice ?? null)
                  : null
              }
              editableUnitPrice={cfg.windowFilm.unitPriceInput}
              onUnitPriceChange={(v) => update((d) => updateServiceConfiguration(d, "windowFilm", { unitPriceInput: v }))}
              onAddOrUpdate={() => {}}
            />
          ) : resolvedActive === "maintenance" ? (
            <BodyMaintenanceSelector
              maintenanceMenus={screenConfig.maintenanceMenus}
              selectedMaintenanceMenuId={cfg.bodyMaintenance.menuId}
              onMaintenanceMenuChange={(id) => update((d) => updateServiceConfiguration(d, "bodyMaintenance", { menuId: id }))}
              displayedUnitPrice={
                cfg.bodyMaintenance.menuId
                  ? (screenConfig.maintenanceMenus.find((m) => m.id === cfg.bodyMaintenance.menuId)?.defaultPrice ?? null)
                  : null
              }
              editablePriceAllowed
              editableUnitPrice={cfg.bodyMaintenance.unitPriceInput}
              onUnitPriceChange={(v) => update((d) => updateServiceConfiguration(d, "bodyMaintenance", { unitPriceInput: v }))}
              informationalMessage={null}
              onAddOrUpdate={() => {}}
            />
          ) : resolvedActive === "carwash" ? (
            <CarWashSelector
              washMenus={screenConfig.washMenus}
              selectedWashMenuId={cfg.carWash.menuId}
              onWashMenuChange={(id) => update((d) => updateServiceConfiguration(d, "carWash", { menuId: id }))}
              displayedUnitPrice={
                cfg.carWash.menuId
                  ? (screenConfig.washMenus.find((m) => m.id === cfg.carWash.menuId)?.defaultPrice ?? null)
                  : null
              }
              editablePriceAllowed
              editableUnitPrice={cfg.carWash.unitPriceInput}
              onUnitPriceChange={(v) => update((d) => updateServiceConfiguration(d, "carWash", { unitPriceInput: v }))}
              informationalMessage={null}
              onAddOrUpdate={() => {}}
            />
          ) : resolvedActive === "roomclean" ? (
            <RoomCleaningSelector
              roomMenus={screenConfig.roomMenus}
              selectedRoomMenuIds={cfg.roomCleaning.selectedMenuIds}
              onRoomMenuToggle={(id) =>
                update((d) => updateServiceConfiguration(d, "roomCleaning", {
                  selectedMenuIds: toggleId(d.serviceConfiguration.roomCleaning.selectedMenuIds, id),
                }))
              }
              editablePriceAllowed
              editableUnitPrices={cfg.roomCleaning.unitPricesByMenu}
              onUnitPriceChange={(id, v) =>
                update((d) => updateServiceConfiguration(d, "roomCleaning", {
                  unitPricesByMenu: { ...d.serviceConfiguration.roomCleaning.unitPricesByMenu, [id]: v },
                }))
              }
              informationalMessage={null}
              onAddOrUpdate={() => {}}
            />
          ) : resolvedActive === "other" ? (
            <OtherWorkSelector
              presetOtherWorkItems={screenConfig.otherWorkPresets}
              selectedPresetItemIds={cfg.otherWork.selectedPresetIds}
              onPresetItemToggle={(id) =>
                update((d) => updateServiceConfiguration(d, "otherWork", {
                  selectedPresetIds: toggleId(d.serviceConfiguration.otherWork.selectedPresetIds, id),
                }))
              }
              unitPricesByItem={cfg.otherWork.unitPricesByItem}
              onUnitPriceChange={(id, v) =>
                update((d) => updateServiceConfiguration(d, "otherWork", {
                  unitPricesByItem: { ...d.serviceConfiguration.otherWork.unitPricesByItem, [id]: v },
                }))
              }
              quantitiesByItem={cfg.otherWork.quantitiesByItem}
              onQuantityChange={(id, qty) =>
                update((d) => updateServiceConfiguration(d, "otherWork", {
                  quantitiesByItem: { ...d.serviceConfiguration.otherWork.quantitiesByItem, [id]: qty },
                }))
              }
              customRows={cfg.otherWork.customRows}
              onCustomRowAdd={() => {
                const id = `ow-${owRowSeq}`;
                setOwRowSeq((n) => n + 1);
                update((d) => updateServiceConfiguration(d, "otherWork", {
                  customRows: [...d.serviceConfiguration.otherWork.customRows, { id, name: "", description: "", unitPrice: "", quantity: "", unitLabel: "" }],
                }));
              }}
              onCustomRowUpdate={(id, patch) =>
                update((d) => updateServiceConfiguration(d, "otherWork", {
                  customRows: d.serviceConfiguration.otherWork.customRows.map((x) => (x.id === id ? { ...x, ...patch } : x)),
                }))
              }
              onCustomRowDelete={(id) =>
                update((d) => updateServiceConfiguration(d, "otherWork", {
                  customRows: d.serviceConfiguration.otherWork.customRows.filter((x) => x.id !== id),
                }))
              }
              informationalMessage={null}
              onAddOrUpdate={() => {}}
            />
          ) : (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <p className="text-xs text-slate-400">
                作業カテゴリを選択してください。
              </p>
            </div>
          )}
        </Step4Estimate>
      )}

      {step === 5 && (
        <Step5Discount
          subtotal={pricing.subtotal ?? 0}
          activeDiscountMode={dc.mode}
          discountAmountValue={dc.amountInput}
          discountPercentValue={dc.percentInput}
          convertedDiscountAmount={null}
          maximumDiscountAmount={null}
          minimumDiscountPercent={0}
          maximumDiscountPercent={30}
          availableCoupons={screenConfig.coupons}
          selectedCouponIds={dc.selectedCouponIds}
          disabledCouponIds={disabledCouponIds}
          disabledReasonByCoupon={{}}
          informationalMessages={[
            "％値引きとクーポンは現在の保存項目に対応していないため、反映・保存できません。金額での値引きをご利用ください。",
          ]}
          discountValidationMessage={null}
          onDiscountModeChange={(m) => update((d) => updateDiscountAndCoupon(d, { mode: m }))}
          onDiscountAmountChange={(v) => update((d) => updateDiscountAndCoupon(d, { amountInput: v }))}
          onDiscountPercentChange={(v) => update((d) => updateDiscountAndCoupon(d, { percentInput: v }))}
          onDiscountClear={() => update((d) => updateDiscountAndCoupon(d, { amountInput: "", percentInput: "" }))}
          onCouponToggle={(id) =>
            update((d) => updateDiscountAndCoupon(d, {
              selectedCouponIds: toggleId(d.discountAndCoupon.selectedCouponIds, id),
            }))
          }
          onContinue={() => goStep(step + 1)}
        />
      )}

      {step === 6 && (
        <Step6Notes
          customerNotes={draft.notes.customerNotes}
          internalMemo={draft.notes.internalMemo}
          onCustomerNotesChange={(v) => update((d) => updateNotes(d, { customerNotes: v }))}
          onInternalMemoChange={(v) => update((d) => updateNotes(d, { internalMemo: v }))}
          onBack={() => goStep(step - 1)}
          onContinue={() => goStep(step + 1)}
        />
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
          onPreviewConfirm={() => update((d) => updateReview(d, { previewConfirmed: true }))}
          onEditCustomer={() => goStep(1)}
          onEditVehicle={() => goStep(2)}
          onEditServices={() => goStep(categories.length ? 4 : 3)}
          onEditDiscount={() => goStep(5)}
          onEditNotes={() => goStep(6)}
          onBack={() => goStep(6)}
          savePanel={
            // Apply hands the plan to EstimateEditor and stops. It performs NO save: the operator
            // reviews the result in the editor and presses 保存 there, through the existing path.
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleApply}
                className="w-full min-h-[48px] rounded-lg bg-[#1d4ed8] text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                見積編集画面へ反映する
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full min-h-[44px] rounded-lg border border-slate-700 text-slate-300 text-xs hover:border-slate-500 transition-colors"
              >
                キャンセル（反映せずに閉じる）
              </button>
              <p className="text-[11px] text-slate-500">
                反映しても保存はされません。内容を確認のうえ、見積編集画面で保存してください。
              </p>
            </div>
          }
        />
      )}
    </WizardShell>
  );
}
