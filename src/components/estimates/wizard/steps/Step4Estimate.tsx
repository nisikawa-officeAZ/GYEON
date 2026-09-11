"use client";

// EW-UI-3C — Canonical Step-4 binding host.
//
// Replaces the Phase-1 placeholder with the controlled Screen-4 selector UI. It renders ONLY the
// Step-3-selected categories as main sections (plus Store Global Options as the cross-category 8th
// section) and binds every business-state write through the single canonical route:
//
//   selector event → step4 binding → api.updateStore({ services: { <section>: <patch> } })
//                  → applyStorePatch → updateServiceConfiguration → new EstimateWizardDraftV22
//
// It NEVER mutates api.draft or serviceConfiguration directly, holds NO second copy of services or
// selected categories, and runs NO pricing/save/OCR/DB. Trusted runtime inputs (shopRank +
// screenConfig) arrive as props from EstimateWizard and are used here only — they are never stored
// in WizardStore, the canonical draft, or hook state. Display prices come only from screenConfig;
// PPF price/coefficient placeholders stay null. This is NOT the production reference container and
// imports nothing from production/EstimateWizardContainer or screens/ScreensPreview.

import { useState } from "react";

import {
  SERVICE_CATEGORY_IDS,
  SERVICE_FAMILIES,
  SERVICE_FAMILY_CATEGORY,
  serviceFamilyForCategory,
  type ServiceFamily,
} from "@/lib/estimates/service-categories";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { WizardRuntimeInputs } from "../contract/wizard-runtime-inputs";
import type { WizardStorePatch } from "../bridge/ew-ui1-to-draft";

import { Step4Estimate as Step4EstimateShell } from "../screens/Step4Estimate";
import { CoatingSelector } from "../screens/CoatingSelector";
import { PpfSelector } from "../screens/PpfSelector";
import { WindowFilmSelector } from "../screens/WindowFilmSelector";
import { BodyMaintenanceSelector } from "../screens/BodyMaintenanceSelector";
import { CarWashSelector } from "../screens/CarWashSelector";
import { RoomCleaningSelector } from "../screens/RoomCleaningSelector";
import { OtherWorkSelector } from "../screens/OtherWorkSelector";
import { StoreGlobalOptionsSelector } from "../screens/StoreGlobalOptionsSelector";
import { isCoatingAvailableForRank, firstLayerOptions, secondLayerOptions, thirdLayerOptions } from "../screens/coating-matrix";

import { createStep4Bindings, type RowCreateResult } from "./step4-bindings";
import {
  isWindowFilmV1RuntimeReady,
  windowFilmV1SuggestedUnitPrice,
} from "../screens/window-film-v1-suggested-price";

/** Concise, operator-facing message when secure row-ID generation fails closed (no patch applied). */
const ROW_ID_ERROR_MESSAGE = "行を追加できませんでした。もう一度お試しください。";

/**
 * Rank locks — UNCHANGED, and now limited to coating only.
 *
 * B2-E2G: `coating` is deliberately outside the service-offering model, so its rank rule survives
 * exactly as before. Every rank lock on a MANAGED family is gone: PPF's `shop` rule and window
 * film's rank rules are both retired, because rank no longer decides eligibility for any of the
 * five managed families — the dealer's own opt-in does.
 */
const COATING_LOCK_REASON = "GYEON PPFインストーラーはコーティングを施工できません。";

/**
 * Setup-required copy per managed family, used ONLY when the dealer has opted in but the family's
 * prerequisites are not satisfied.
 *
 * The split between "the dealer can fix this" and "only an administrator can" is deliberate and is
 * the whole reason these are separate strings. Four families are configured from dealer-owned
 * catalog data, so their message names the settings destination in TEXT (no link element is
 * introduced into any selector). PPF's prerequisites are GLOBAL rows the dealer cannot author, so
 * sending them to settings would send them somewhere that cannot help. A message must never be
 * broader than the condition it names.
 */
const SETUP_REQUIRED_REASON: Readonly<Record<ServiceFamily, string>> = {
  window_film:
    "ウィンドウフィルムを利用するには、見積設定（見積ウィザード設定）でフィルム種類を登録してください。",
  maintenance:
    "ボディ定期メンテナンスを利用するには、見積設定（見積ウィザード設定）でメンテナンスメニューを登録してください。",
  car_wash:
    "メンテナンス洗車を利用するには、見積設定（見積ウィザード設定）で洗車メニューを登録してください。",
  room_cleaning:
    "ルームクリーニングを利用するには、見積設定（見積ウィザード設定）でルームクリーニングメニューを登録してください。",
  ppf: "PPFの施工メニューが利用できません。管理者にお問い合わせください。",
};

/**
 * Window film has a SECOND incomplete state the dealer cannot fix: film types exist, but no
 * installation areas resolve. Areas are global rows, so this one is administrator-only.
 */
const WINDOW_AREAS_UNAVAILABLE_REASON =
  "ウィンドウフィルム設定で、提供する部位またはセットの金額と所要時間を登録してください。";

/**
 * GDA-ESTIMATE-PPF-OFFERING-R1-A — the compact attached action offered from the coating section
 * when the operator has not selected the main PPF category. Exact label per the frozen directive.
 */
const ATTACHED_PARTIAL_PPF_LABEL = "部分PPFを追加";

/**
 * Pure, directly testable canonical patch for the attached-partial-PPF action. It reuses the
 * EXISTING `ppf` category and the existing `services.ppf.installationMethod` field — no second
 * PPF model, category, price route, or line identity. The existing category order is preserved;
 * `ppf` is appended only when absent, so calling this twice never duplicates it.
 */
export function attachedPartialPpfPatch(categories: readonly string[]): WizardStorePatch {
  return {
    categories: categories.includes("ppf") ? categories : [...categories, "ppf"],
    services: { ppf: { installationMethod: "partial" } },
  };
}

export interface Step4EstimateProps extends WizardRuntimeInputs {
  api: EstimateWizardApi;
}

export function Step4Estimate({ api, shopRank, screenConfig }: Step4EstimateProps) {
  // Local UI-only state — NOTHING else lives here (no second copy of services or categories).
  const [activeSection, setActiveSection] = useState<string>("coating");
  const [rowIdError, setRowIdError] = useState<string | null>(null);

  const categories = api.store.categories;
  const cfg = api.store.services; // canonical projection (read-only)
  const bindings = createStep4Bindings(cfg, api.updateStore);

  // Resolve the open section against the CURRENT selection. A deselected active section falls back
  // to the first selected canonical category — WITHOUT deleting that section's saved configuration
  // (category selection and service configuration are separate canonical fields).
  // ── B2-E2G: managed service-family visibility ─────────────────────────────────────────────────
  // OPTED OUT  → the family's section is ABSENT: filtered out of the sections this screen presents,
  //              so no tab, no content and no lock card, and NO setup prompt. A dealer who does not
  //              offer a service has nothing to fix and must never be nagged to configure it. The
  //              canonical draft is untouched, so opting back in restores their Screen-3 selection
  //              and saved configuration intact.
  // OPTED IN   → the section is PRESENT, and locked only while its prerequisites are unsatisfied.
  //
  // Both effects are confined to the one family. Every other enabled family, and both unmanaged
  // categories, are unaffected — so an incomplete setup can never block an estimate for a service
  // the dealer HAS configured.
  const offerings = screenConfig.serviceOfferings;

  /** Prerequisites per managed family. Rank appears nowhere. */
  const familyComplete: Readonly<Record<ServiceFamily, boolean>> = {
    window_film: isWindowFilmV1RuntimeReady(screenConfig),
    ppf: screenConfig.ppfMethods.length > 0
      && screenConfig.ppfParts.length > 0
      && screenConfig.ppfTypeGroups.length > 0,
    maintenance: screenConfig.maintenanceMenus.length > 0,
    car_wash: screenConfig.washMenus.length > 0,
    room_cleaning: screenConfig.roomMenus.length > 0,
  };

  // An UNMANAGED category (coating, other) is always visible: it is outside this model entirely.
  const visibleCategories = categories.filter((id) => {
    const family = serviceFamilyForCategory(id);
    return family === null || offerings[family];
  });

  const orderedSelected = SERVICE_CATEGORY_IDS.filter((id) => visibleCategories.includes(id));
  // When the only selected category is an opted-out family, nothing remains to open and the shell
  // renders its no-selection placeholder — deliberately, rather than silently opening a section the
  // dealer did not choose.
  const resolvedActive = visibleCategories.includes(activeSection) ? activeSection : (orderedSelected[0] ?? "");

  // The ONLY surviving rank lock. Coating is outside the offering model (see the constant above).
  const coatingLocked = !isCoatingAvailableForRank(shopRank);

  // Incompleteness is evaluated only for families the dealer opted INTO — an opted-out family is
  // not "incomplete", and its section is already absent.
  const familyLocked = (family: ServiceFamily): boolean => offerings[family] && !familyComplete[family];

  const lockReasonFor = (family: ServiceFamily): string =>
    family === "window_film" && screenConfig.filmTypes.length > 0
      ? WINDOW_AREAS_UNAVAILABLE_REASON   // films exist; the missing half is the global areas
      : SETUP_REQUIRED_REASON[family];

  const disabledSections = new Set<string>();
  if (coatingLocked) disabledSections.add("coating");
  for (const family of SERVICE_FAMILIES) {
    if (familyLocked(family)) disabledSections.add(SERVICE_FAMILY_CATEGORY[family]);
  }

  // Row-creation callbacks surface the fail-closed result to the operator; success clears the notice.
  const withRowResult = (run: () => RowCreateResult) => () => setRowIdError(run().ok ? null : ROW_ID_ERROR_MESSAGE);

  // ── GDA-ESTIMATE-PPF-OFFERING-R1-A — attached partial PPF from a coating-only-so-far selection ──
  // Visible only while the operator has not selected the main PPF category and the dealer offers
  // PPF at all; absent when PPF is off (opt-out) or already selected (the existing PPF tab and
  // full/partial flow remain authoritative in that case).
  const showAttachedPartialPpf = categories.includes("coating") && !categories.includes("ppf") && offerings.ppf;
  const attachedPartialPpfComplete = familyComplete.ppf;
  const onAttachPartialPpf = () => {
    api.updateStore(attachedPartialPpfPatch(categories));
    setActiveSection("ppf");
  };

  const sectionContent = (() => {
    switch (resolvedActive) {
      case "coating":
        return (
          <div className="flex flex-col gap-3">
            <CoatingSelector
              shopRank={shopRank}
              coatingLocked={coatingLocked}
              lockReason={COATING_LOCK_REASON}
              selectedLayerCount={cfg.coating.layerCount}
              selectedLayer1ProductId={cfg.coating.layer1Id}
              selectedLayer2ProductId={cfg.coating.layer2Id}
              selectedLayer3ProductId={cfg.coating.layer3Id}
              availableLayer1Products={firstLayerOptions(shopRank)}
              availableLayer2Products={secondLayerOptions(cfg.coating.layer1Id, shopRank)}
              availableLayer3Products={thirdLayerOptions(cfg.coating.layer1Id)}
              onLayerCountChange={bindings.coating.onLayerCountChange}
              onLayer1Change={bindings.coating.onLayer1Change}
              onLayer2Change={bindings.coating.onLayer2Change}
              onLayer3Change={bindings.coating.onLayer3Change}
              onAddOrUpdate={() => {}}
            />
            {showAttachedPartialPpf && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={attachedPartialPpfComplete ? onAttachPartialPpf : undefined}
                  disabled={!attachedPartialPpfComplete}
                  className="self-start text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors"
                >
                  {ATTACHED_PARTIAL_PPF_LABEL}
                </button>
                {!attachedPartialPpfComplete && (
                  <p className="text-[11px] text-slate-500">{lockReasonFor("ppf")}</p>
                )}
              </div>
            )}
          </div>
        );
      case "ppf":
        return (
          <PpfSelector
            shopRank={shopRank}
            ppfLocked={familyLocked("ppf")}
            lockReason={lockReasonFor("ppf")}
            selectedInstallationMethod={cfg.ppf.installationMethod}
            installationMethods={screenConfig.ppfMethods}
            onInstallationMethodChange={bindings.ppf.onInstallationMethodChange}
            selectedFullCoverage={cfg.ppf.fullCoverage}
            onFullCoverageChange={bindings.ppf.onFullCoverageChange}
            selectedPartialPartIds={cfg.ppf.selectedPartIds}
            partialParts={screenConfig.ppfParts}
            quantitiesByPart={cfg.ppf.quantitiesByPart}
            onPartialPartToggle={bindings.ppf.onPartialPartToggle}
            onQuantityChange={bindings.ppf.onQuantityChange}
            selectedPpfTypeId={cfg.ppf.ppfTypeId}
            ppfTypes={screenConfig.ppfTypeGroups}
            onPpfTypeChange={bindings.ppf.onPpfTypeChange}
            interiorRows={cfg.ppf.interiorRows}
            onInteriorRowAdd={withRowResult(bindings.ppf.onInteriorRowAdd)}
            onInteriorRowUpdate={bindings.ppf.onInteriorRowUpdate}
            onInteriorRowDelete={bindings.ppf.onInteriorRowDelete}
            displayedUnitPrice={null}
            editableUnitPrice={cfg.ppf.unitPriceInput}
            onUnitPriceChange={bindings.ppf.onUnitPriceChange}
            vehicleCoefficientInput={cfg.ppf.vehicleCoefficientInput}
            onVehicleCoefficientChange={bindings.ppf.onVehicleCoefficientChange}
            coefficientDisplay={null}
            combinedServiceAdjustment={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "window":
        return (
          <WindowFilmSelector
            shopRank={shopRank}
            windowLocked={familyLocked("window_film")}
            lockReason={lockReasonFor("window_film")}
            areas={screenConfig.windowAreas}
            selectedAreaIds={cfg.windowFilm.selectedAreaIds}
            onAreaToggle={bindings.windowFilm.onAreaToggle}
            filmTypes={screenConfig.filmTypes}
            selectedFilmTypeId={cfg.windowFilm.filmTypeId}
            onFilmTypeChange={bindings.windowFilm.onFilmTypeChange}
            packages={screenConfig.windowFilmPackages}
            selectedPackageCode={cfg.windowFilm.selectedPackageCode ?? null}
            onPackageChange={bindings.windowFilm.onPackageChange}
            options={screenConfig.windowFilmOptions}
            selectedOptionIds={cfg.windowFilm.selectedOptionIds ?? []}
            optionQuantities={cfg.windowFilm.optionQuantities ?? {}}
            onOptionToggle={bindings.windowFilm.onOptionToggle}
            onOptionQuantityChange={bindings.windowFilm.onOptionQuantityChange}
            displayedUnitPrice={
              windowFilmV1SuggestedUnitPrice(screenConfig, cfg.windowFilm)
            }
            editableUnitPrice={cfg.windowFilm.unitPriceInput}
            onUnitPriceChange={bindings.windowFilm.onUnitPriceChange}
            onAddOrUpdate={() => {}}
          />
        );
      case "maintenance":
        return (
          <BodyMaintenanceSelector
            maintenanceMenus={screenConfig.maintenanceMenus}
            selectedMaintenanceMenuId={cfg.bodyMaintenance.menuId}
            onMaintenanceMenuChange={bindings.bodyMaintenance.onMenuChange}
            displayedUnitPrice={
              cfg.bodyMaintenance.menuId
                ? (screenConfig.maintenanceMenus.find((m) => m.id === cfg.bodyMaintenance.menuId)?.defaultPrice ?? null)
                : null
            }
            editablePriceAllowed
            editableUnitPrice={cfg.bodyMaintenance.unitPriceInput}
            onUnitPriceChange={bindings.bodyMaintenance.onUnitPriceChange}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "carwash":
        return (
          <CarWashSelector
            washMenus={screenConfig.washMenus}
            selectedWashMenuId={cfg.carWash.menuId}
            onWashMenuChange={bindings.carWash.onMenuChange}
            displayedUnitPrice={
              cfg.carWash.menuId
                ? (screenConfig.washMenus.find((m) => m.id === cfg.carWash.menuId)?.defaultPrice ?? null)
                : null
            }
            editablePriceAllowed
            editableUnitPrice={cfg.carWash.unitPriceInput}
            onUnitPriceChange={bindings.carWash.onUnitPriceChange}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "roomclean":
        return (
          <RoomCleaningSelector
            roomMenus={screenConfig.roomMenus}
            selectedRoomMenuIds={cfg.roomCleaning.selectedMenuIds}
            onRoomMenuToggle={bindings.roomCleaning.onMenuToggle}
            editablePriceAllowed
            editableUnitPrices={cfg.roomCleaning.unitPricesByMenu}
            onUnitPriceChange={bindings.roomCleaning.onUnitPriceChange}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "other":
        return (
          <OtherWorkSelector
            presetOtherWorkItems={screenConfig.otherWorkPresets}
            selectedPresetItemIds={cfg.otherWork.selectedPresetIds}
            onPresetItemToggle={bindings.otherWork.onPresetToggle}
            unitPricesByItem={cfg.otherWork.unitPricesByItem}
            onUnitPriceChange={bindings.otherWork.onUnitPriceChange}
            quantitiesByItem={cfg.otherWork.quantitiesByItem}
            onQuantityChange={bindings.otherWork.onQuantityChange}
            customRows={cfg.otherWork.customRows}
            onCustomRowAdd={withRowResult(bindings.otherWork.onCustomRowAdd)}
            onCustomRowUpdate={bindings.otherWork.onCustomRowUpdate}
            onCustomRowDelete={bindings.otherWork.onCustomRowDelete}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      default:
        return (
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <p className="text-xs text-slate-400">作業カテゴリを選択してください。</p>
          </div>
        );
    }
  })();

  return (
    <Step4EstimateShell
      selectedCategories={visibleCategories}
      activeSection={resolvedActive}
      onSelectSection={setActiveSection}
      disabledSections={disabledSections}
      globalOptionsSlot={
        <StoreGlobalOptionsSelector
          globalOptions={screenConfig.storeGlobalOptions}
          selectedCategoryIds={categories}
          selectedGlobalOptionIds={cfg.storeGlobalOptions.selectedOptionIds}
          unitPricesByOption={cfg.storeGlobalOptions.unitPricesByOption}
          quantitiesByOption={cfg.storeGlobalOptions.quantitiesByOption}
          onGlobalOptionToggle={bindings.storeGlobalOptions.onOptionToggle}
          onUnitPriceChange={bindings.storeGlobalOptions.onUnitPriceChange}
          onQuantityChange={bindings.storeGlobalOptions.onQuantityChange}
          informationalMessage={null}
          onAddOrUpdate={() => {}}
        />
      }
    >
      {rowIdError !== null && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {rowIdError}
        </div>
      )}
      {sectionContent}
    </Step4EstimateShell>
  );
}
