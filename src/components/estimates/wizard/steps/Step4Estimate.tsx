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

import { SERVICE_CATEGORY_IDS } from "@/lib/estimates/service-categories";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { WizardRuntimeInputs } from "../contract/wizard-runtime-inputs";

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

/** Concise, operator-facing message when secure row-ID generation fails closed (no patch applied). */
const ROW_ID_ERROR_MESSAGE = "行を追加できませんでした。もう一度お試しください。";

/** Rank locks — the accepted availability behavior (preserved exactly): ppf_installer cannot coat;
 *  shop cannot sell PPF or window film. */
const COATING_LOCK_REASON = "GYEON PPFインストーラーはコーティングを施工できません。";
const PPF_LOCK_REASON = "GYEONショップランクでは PPF は施工できません。";
const WINDOW_LOCK_REASON = "GYEONショップランクではウィンドウフィルムは選択できません。";

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
  const orderedSelected = SERVICE_CATEGORY_IDS.filter((id) => categories.includes(id));
  const resolvedActive = categories.includes(activeSection) ? activeSection : (orderedSelected[0] ?? "");

  // Rank locks (also reflected as disabled section tabs in the shell nav).
  const coatingLocked = !isCoatingAvailableForRank(shopRank);
  const ppfLocked = shopRank === "shop";
  const windowLocked = shopRank === "shop";
  const disabledSections = new Set<string>();
  if (coatingLocked) disabledSections.add("coating");
  if (ppfLocked) disabledSections.add("ppf");
  if (windowLocked) disabledSections.add("window");

  // Row-creation callbacks surface the fail-closed result to the operator; success clears the notice.
  const withRowResult = (run: () => RowCreateResult) => () => setRowIdError(run().ok ? null : ROW_ID_ERROR_MESSAGE);

  const sectionContent = (() => {
    switch (resolvedActive) {
      case "coating":
        return (
          <CoatingSelector
            shopRank={shopRank}
            coatingLocked={coatingLocked}
            lockReason={COATING_LOCK_REASON}
            selectedLayerCount={cfg.coating.layerCount}
            selectedLayer1ProductId={cfg.coating.layer1Id}
            selectedLayer2ProductId={cfg.coating.layer2Id}
            selectedLayer3ProductId={cfg.coating.layer3Id}
            availableLayer1Products={firstLayerOptions(shopRank)}
            availableLayer2Products={secondLayerOptions(cfg.coating.layer1Id)}
            availableLayer3Products={thirdLayerOptions(cfg.coating.layer1Id)}
            onLayerCountChange={bindings.coating.onLayerCountChange}
            onLayer1Change={bindings.coating.onLayer1Change}
            onLayer2Change={bindings.coating.onLayer2Change}
            onLayer3Change={bindings.coating.onLayer3Change}
            onAddOrUpdate={() => {}}
          />
        );
      case "ppf":
        return (
          <PpfSelector
            shopRank={shopRank}
            ppfLocked={ppfLocked}
            lockReason={PPF_LOCK_REASON}
            selectedInstallationMethod={cfg.ppf.installationMethod}
            installationMethods={screenConfig.ppfMethods}
            onInstallationMethodChange={bindings.ppf.onInstallationMethodChange}
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
            coefficientDisplay={null}
            combinedServiceAdjustment={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "window":
        return (
          <WindowFilmSelector
            shopRank={shopRank}
            windowLocked={windowLocked}
            lockReason={WINDOW_LOCK_REASON}
            areas={screenConfig.windowAreas}
            selectedAreaIds={cfg.windowFilm.selectedAreaIds}
            onAreaToggle={bindings.windowFilm.onAreaToggle}
            filmTypes={screenConfig.filmTypes}
            selectedFilmTypeId={cfg.windowFilm.filmTypeId}
            onFilmTypeChange={bindings.windowFilm.onFilmTypeChange}
            displayedUnitPrice={
              cfg.windowFilm.filmTypeId
                ? (screenConfig.filmTypes.find((f) => f.id === cfg.windowFilm.filmTypeId)?.defaultUnitPrice ?? null)
                : null
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
      selectedCategories={categories}
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
