// EW-UI-3C — Pure Step-4 event→patch binding layer for the canonical Estimate Wizard host.
//
// The SINGLE mapping from Screen-4 selector events to section-scoped WizardStore patches. It is
// PURE: it holds no state, renders nothing, and imports no React. Given the current canonical
// services projection and the host's `updateStore`, it returns controlled callbacks for all eight
// serviceConfiguration sections. Every callback:
//   • builds a FULL replacement array/record immutably (never mutates the supplied projection),
//   • issues exactly ONE section-scoped `updateStore({ services: { <section>: <patch> } })` per
//     user event, so sibling sections are never touched, and
//   • preserves existing row IDs on update/delete.
//
// Row creation uses the Web-Crypto row-ID authority (createWizardRowId). The existing-ID set is
// built from BOTH generated-ID row collections (ppf.interiorRows + otherWork.customRows) so the two
// families never collide. On fail-closed null the callback applies NO patch and returns an explicit
// failure result to the component. Row IDs are UI/draft identity ONLY — never pricing/estimate/DB.
//
// FORBIDDEN here (and enforced by the binding test's source guards): React, pricing, save, OCR,
// routes, Supabase, ScreensPreview, fixture constants, safe-random-uuid, Math.random, Date/time,
// and counter/length/index-based IDs.

import type {
  WizardServiceConfigurationDraft,
  WizardCoatingDraft, WizardPpfDraft, PpfFullCoverage, WizardWindowFilmDraft, WizardBodyMaintenanceDraft,
  WizardCarWashDraft, WizardRoomCleaningDraft, WizardOtherWorkDraft, WizardStoreGlobalOptionsDraft,
} from "../draft/wizard-draft-types";
import type { WizardStorePatch } from "../bridge/ew-ui1-controller";
import type { LayerCount, PpfInstallationMethodId, InteriorPpfRow, OtherWorkCustomRow, StoreGlobalOption } from "../screens/step-types";
import { createWizardRowId, type WizardRowIdCryptoSource } from "../contract/wizard-row-id";

/** The host's validated patch sink — structurally exactly `useEstimateWizard().updateStore`. */
export type Step4UpdateStore = (patch: WizardStorePatch) => void;

/** Result of a row-creation callback. The component surfaces the failure to the operator. */
export type RowCreateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "row-id-unavailable" };

const ROW_CREATE_OK: RowCreateResult = { ok: true };
const ROW_CREATE_FAILED: RowCreateResult = { ok: false, reason: "row-id-unavailable" };

// ── immutable helpers — each returns a NEW value; the supplied projection is never mutated ──
function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
function setNum(record: Readonly<Record<string, number>>, id: string, value: number): Record<string, number> {
  return { ...record, [id]: value };
}
function setStr(record: Readonly<Record<string, string>>, id: string, value: string): Record<string, string> {
  return { ...record, [id]: value };
}
function without<T>(record: Readonly<Record<string, T>>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
}

/**
 * GDA-ESTIMATE-OPTION-PRICING-R1 — the authoritative unit-price seed for a NEWLY SELECTED store-global
 * option, as draft text (the same `unitPricesByOption` channel an operator edit uses).
 *
 * The pricing engine prices a store-global option ONLY from `unitPricesByOption[id]`; the pricing
 * configuration carries no price. Until now the toggle never wrote that field, so a selected option
 * whose card displayed its configured price was still reported as 金額未入力 (partial → save blocked),
 * and the runtime marks these options non-editable so no manual entry was even possible.
 *
 * Fail-closed: only a finite, positive, whole-yen configured price is seeded. Anything else returns
 * `null`, and the option stays honestly unpriced (the engine keeps its MANUAL_PRICE_REQUIRED signal).
 * Zero is deliberately NOT seeded: the runtime projection collapses an unconfigured price to 0, so a
 * seeded 0 would manufacture a ¥0 line for an option whose price was never set.
 */
export function configuredStoreGlobalOptionUnitPrice(option: Pick<StoreGlobalOption, "defaultPrice"> | undefined): string | null {
  if (option === undefined) return null;
  const price = option.defaultPrice;
  if (typeof price !== "number" || !Number.isInteger(price) || price <= 0) return null;
  return String(price);
}

export interface CoatingBindings {
  onLayerCountChange: (n: LayerCount) => void;
  onLayer1Change: (id: string) => void;
  onLayer2Change: (id: string) => void;
  onLayer3Change: (id: string) => void;
}
export interface PpfBindings {
  onInstallationMethodChange: (id: PpfInstallationMethodId) => void;
  onFullCoverageChange: (coverage: PpfFullCoverage) => void;
  onPartialPartToggle: (id: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
  onPpfTypeChange: (id: string) => void;
  onUnitPriceChange: (v: string) => void;
  onVehicleCoefficientChange: (v: string) => void;
  onInteriorRowAdd: () => RowCreateResult;
  onInteriorRowUpdate: (id: string, patch: Partial<InteriorPpfRow>) => void;
  onInteriorRowDelete: (id: string) => void;
}
export interface WindowFilmBindings {
  onAreaToggle: (id: string) => void;
  onFilmTypeChange: (id: string) => void;
  onUnitPriceChange: (v: string) => void;
  onPackageChange: (code: string | null) => void;
  onOptionToggle: (code: string) => void;
  onOptionQuantityChange: (code: string, quantity: number) => void;
}
export interface BodyMaintenanceBindings {
  onMenuChange: (id: string) => void;
  onUnitPriceChange: (v: string) => void;
}
export interface CarWashBindings {
  onMenuChange: (id: string) => void;
  onUnitPriceChange: (v: string) => void;
}
export interface RoomCleaningBindings {
  onMenuToggle: (id: string) => void;
  onUnitPriceChange: (id: string, v: string) => void;
}
export interface OtherWorkBindings {
  onPresetToggle: (id: string) => void;
  onUnitPriceChange: (id: string, v: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
  onCustomRowAdd: () => RowCreateResult;
  onCustomRowUpdate: (id: string, patch: Partial<OtherWorkCustomRow>) => void;
  onCustomRowDelete: (id: string) => void;
}
export interface StoreGlobalOptionsBindings {
  onOptionToggle: (id: string) => void;
  onUnitPriceChange: (id: string, v: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
}

/** Controlled callbacks for the eight canonical serviceConfiguration sections. */
export interface Step4Bindings {
  coating: CoatingBindings;
  ppf: PpfBindings;
  windowFilm: WindowFilmBindings;
  bodyMaintenance: BodyMaintenanceBindings;
  carWash: CarWashBindings;
  roomCleaning: RoomCleaningBindings;
  otherWork: OtherWorkBindings;
  storeGlobalOptions: StoreGlobalOptionsBindings;
}

/** ONE existing-ID set spanning BOTH generated-ID row collections (PPF interior + other-work custom). */
function existingRowIds(services: WizardServiceConfigurationDraft): Set<string> {
  const ids = new Set<string>();
  for (const row of services.ppf.interiorRows) ids.add(row.id);
  for (const row of services.otherWork.customRows) ids.add(row.id);
  return ids;
}

/**
 * Build the eight-section binding surface from the current canonical services projection.
 *
 * @param services     Current canonical service configuration (read-only; never mutated).
 * @param updateStore  The host's validated patch sink (`useEstimateWizard().updateStore`).
 * @param cryptoSource Optional Web-Crypto source for row-ID generation (defaults to
 *                     `globalThis.crypto` inside createWizardRowId). Injected only in tests.
 * @param storeGlobalOptions Trusted runtime store-global options (from `screenConfig`). Read ONLY to
 *                     seed a newly selected option's configured unit price into the canonical draft.
 *                     Absent/unknown ⇒ nothing is seeded and the option stays unpriced (fail-closed).
 */
export function createStep4Bindings(
  services: WizardServiceConfigurationDraft,
  updateStore: Step4UpdateStore,
  cryptoSource?: WizardRowIdCryptoSource,
  storeGlobalOptions?: readonly StoreGlobalOption[],
): Step4Bindings {
  // Section-scoped emit — exactly ONE section key per patch, so siblings are never included.
  const emitCoating = (patch: Partial<WizardCoatingDraft>) => updateStore({ services: { coating: patch } });
  const emitPpf = (patch: Partial<WizardPpfDraft>) => updateStore({ services: { ppf: patch } });
  const emitWindowFilm = (patch: Partial<WizardWindowFilmDraft>) => updateStore({ services: { windowFilm: patch } });
  const emitBodyMaintenance = (patch: Partial<WizardBodyMaintenanceDraft>) => updateStore({ services: { bodyMaintenance: patch } });
  const emitCarWash = (patch: Partial<WizardCarWashDraft>) => updateStore({ services: { carWash: patch } });
  const emitRoomCleaning = (patch: Partial<WizardRoomCleaningDraft>) => updateStore({ services: { roomCleaning: patch } });
  const emitOtherWork = (patch: Partial<WizardOtherWorkDraft>) => updateStore({ services: { otherWork: patch } });
  const emitStoreGlobalOptions = (patch: Partial<WizardStoreGlobalOptionsDraft>) => updateStore({ services: { storeGlobalOptions: patch } });

  return {
    coating: {
      onLayerCountChange: (n) => emitCoating({ layerCount: n }),
      // Choosing a new first layer clears the now-invalid dependent upper layers (matrix invariant).
      onLayer1Change: (id) => emitCoating({ layer1Id: id, layer2Id: null, layer3Id: null }),
      onLayer2Change: (id) => emitCoating({ layer2Id: id }),
      onLayer3Change: (id) => emitCoating({ layer3Id: id }),
    },
    ppf: {
      onInstallationMethodChange: (id) => emitPpf({
        installationMethod: id,
        ...(id !== "full" ? { fullCoverage: null } : {}),
      }),
      onFullCoverageChange: (fullCoverage) => emitPpf({ fullCoverage }),
      onPartialPartToggle: (id) => emitPpf({ selectedPartIds: toggle(services.ppf.selectedPartIds, id) }),
      onQuantityChange: (id, qty) => emitPpf({ quantitiesByPart: setNum(services.ppf.quantitiesByPart, id, qty) }),
      onPpfTypeChange: (id) => emitPpf({ ppfTypeId: id }),
      onUnitPriceChange: (v) => emitPpf({ unitPriceInput: v }),
      onVehicleCoefficientChange: (v) => emitPpf({ vehicleCoefficientInput: v }),
      onInteriorRowAdd: () => {
        // ID set spans BOTH row families; fail closed with no patch if secure generation is unavailable.
        const id = createWizardRowId("ppfInterior", existingRowIds(services), cryptoSource);
        if (id === null) return ROW_CREATE_FAILED;
        const row: InteriorPpfRow = { id, location: "", amount: "" };
        emitPpf({ interiorRows: [...services.ppf.interiorRows, row] });
        return ROW_CREATE_OK;
      },
      onInteriorRowUpdate: (id, patch) =>
        emitPpf({ interiorRows: services.ppf.interiorRows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      onInteriorRowDelete: (id) =>
        emitPpf({ interiorRows: services.ppf.interiorRows.filter((r) => r.id !== id) }),
    },
    windowFilm: {
      onAreaToggle: (id) => emitWindowFilm({ selectedAreaIds: toggle(services.windowFilm.selectedAreaIds, id), selectedPackageCode: null }),
      onFilmTypeChange: (id) => emitWindowFilm({ filmTypeId: id }),
      onUnitPriceChange: (v) => emitWindowFilm({ unitPriceInput: v }),
      onPackageChange: (code) => emitWindowFilm({ selectedPackageCode: code, selectedAreaIds: code ? [] : services.windowFilm.selectedAreaIds }),
      onOptionToggle: (code) => emitWindowFilm({ selectedOptionIds: toggle(services.windowFilm.selectedOptionIds ?? [], code) }),
      onOptionQuantityChange: (code, quantity) => emitWindowFilm({ optionQuantities: setNum(services.windowFilm.optionQuantities ?? {}, code, quantity) }),
    },
    bodyMaintenance: {
      onMenuChange: (id) => emitBodyMaintenance({ menuId: id }),
      onUnitPriceChange: (v) => emitBodyMaintenance({ unitPriceInput: v }),
    },
    carWash: {
      onMenuChange: (id) => emitCarWash({ menuId: id }),
      onUnitPriceChange: (v) => emitCarWash({ unitPriceInput: v }),
    },
    roomCleaning: {
      onMenuToggle: (id) => emitRoomCleaning({ selectedMenuIds: toggle(services.roomCleaning.selectedMenuIds, id) }),
      onUnitPriceChange: (id, v) => emitRoomCleaning({ unitPricesByMenu: setStr(services.roomCleaning.unitPricesByMenu, id, v) }),
    },
    otherWork: {
      onPresetToggle: (id) => emitOtherWork({ selectedPresetIds: toggle(services.otherWork.selectedPresetIds, id) }),
      onUnitPriceChange: (id, v) => emitOtherWork({ unitPricesByItem: setStr(services.otherWork.unitPricesByItem, id, v) }),
      onQuantityChange: (id, qty) => emitOtherWork({ quantitiesByItem: setNum(services.otherWork.quantitiesByItem, id, qty) }),
      onCustomRowAdd: () => {
        const id = createWizardRowId("otherWork", existingRowIds(services), cryptoSource);
        if (id === null) return ROW_CREATE_FAILED;
        const row: OtherWorkCustomRow = { id, name: "", description: "", unitPrice: "", quantity: "", unitLabel: "" };
        emitOtherWork({ customRows: [...services.otherWork.customRows, row] });
        return ROW_CREATE_OK;
      },
      onCustomRowUpdate: (id, patch) =>
        emitOtherWork({ customRows: services.otherWork.customRows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      onCustomRowDelete: (id) =>
        emitOtherWork({ customRows: services.otherWork.customRows.filter((r) => r.id !== id) }),
    },
    storeGlobalOptions: {
      // ONE patch per toggle. SELECT seeds the configured unit price (or clears a stale entry when no
      // valid configured price exists) so the engine can bill the option immediately. DESELECT drops
      // the option's price and quantity so a later re-selection never resurfaces a stale amount.
      // Explicit operator edits made WHILE selected flow through onUnitPriceChange and are untouched.
      onOptionToggle: (id) => {
        const current = services.storeGlobalOptions;
        if (current.selectedOptionIds.includes(id)) {
          emitStoreGlobalOptions({
            selectedOptionIds: current.selectedOptionIds.filter((x) => x !== id),
            unitPricesByOption: without(current.unitPricesByOption, id),
            quantitiesByOption: without(current.quantitiesByOption, id),
          });
          return;
        }
        const seed = configuredStoreGlobalOptionUnitPrice(storeGlobalOptions?.find((o) => o.id === id));
        emitStoreGlobalOptions({
          selectedOptionIds: [...current.selectedOptionIds, id],
          unitPricesByOption: seed === null
            ? without(current.unitPricesByOption, id)
            : setStr(current.unitPricesByOption, id, seed),
        });
      },
      onUnitPriceChange: (id, v) => emitStoreGlobalOptions({ unitPricesByOption: setStr(services.storeGlobalOptions.unitPricesByOption, id, v) }),
      onQuantityChange: (id, qty) => emitStoreGlobalOptions({ quantitiesByOption: setNum(services.storeGlobalOptions.quantitiesByOption, id, qty) }),
    },
  };
}
