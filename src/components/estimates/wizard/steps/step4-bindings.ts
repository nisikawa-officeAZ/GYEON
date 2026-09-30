// EW-UI-3C — Pure Step-4 event→patch binding layer for the canonical Estimate Wizard host.
//
// The SINGLE mapping from Screen-4 selector events to section-scoped WizardStore patches. It is
// PURE: it holds no state, renders nothing, and imports no React. Given the current canonical
// services projection and the host's `updateStore`, it returns controlled callbacks for all eight
// serviceConfiguration sections plus the two dedicated wheel/glass menu sections (B5b2) and the
// distinct other-coating section (GDA-OTHER-COATINGS-R1 C3). Every callback:
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
  WizardDedicatedMenuDraft,
} from "../draft/wizard-draft-types";
import type { WizardStorePatch } from "../bridge/ew-ui1-controller";
import type { LayerCount, PpfInstallationMethodId, InteriorPpfRow, OtherWorkCustomRow } from "../screens/step-types";
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

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5b2): dedicated wheel / glass menu sections ────────────
//
// Both sections share ONE binding shape keyed by the STABLE dealer menu id. The menu facts a
// callback needs (configured tax-exclusive unit price, configured quantity bounds) are passed IN
// with each event by the host from the trusted runtime input; this layer stores nothing and reads
// no catalog. Everything here is operator intent — no subtotal, no tax, no line creation.
//
// Policy (plan §24.1): wheel starts at quantity 4 and glass at 1. These are INITIAL values, not
// minimums: the dealer's configured `minQty`/`maxQty` bound them, and a nominal outside those
// bounds initialises to the NEAREST valid bound. No maximum is invented (`maxQty` null = none).
// A menu whose bounds or configured price are malformed is unusable and FAILS CLOSED (no patch).
// A null configured price is never coerced to "0": the unit-price text is simply left absent for
// the operator to fill in.

/** Which dedicated section an event addresses. */
export type DedicatedMenuKind = "wheel" | "glass";

/** Initial quantity per kind — an initial value, NOT a minimum. */
export const DEDICATED_MENU_INITIAL_QUANTITY: Readonly<Record<DedicatedMenuKind, number>> = { wheel: 4, glass: 1 };

/** The menu facts the callbacks need: a structural subset of the runtime WheelMenu / GlassMenu. */
export interface DedicatedMenuRef {
  readonly id: string;
  readonly defaultUnitPrice: number | null;
  readonly minQty: number;
  readonly maxQty: number | null;
  readonly disabled?: boolean;
}

/** Result of a fail-closed dedicated-menu callback. The host surfaces the failure to the operator. */
export type DedicatedMenuActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "menu-invalid" | "quantity-out-of-bounds" };

const MENU_ACTION_OK: DedicatedMenuActionResult = { ok: true };
const MENU_INVALID: DedicatedMenuActionResult = { ok: false, reason: "menu-invalid" };
const MENU_QUANTITY_OUT_OF_BOUNDS: DedicatedMenuActionResult = { ok: false, reason: "quantity-out-of-bounds" };

/** Configured bounds are valid when minQty is an integer ≥ 1 and maxQty is null or an integer ≥ minQty. */
export function dedicatedMenuBoundsValid(menu: Pick<DedicatedMenuRef, "minQty" | "maxQty">): boolean {
  if (!Number.isSafeInteger(menu.minQty) || menu.minQty < 1) return false;
  if (menu.maxQty === null) return true;
  return Number.isSafeInteger(menu.maxQty) && menu.maxQty >= menu.minQty;
}

/** A configured price is valid when null (not configured) or a non-negative safe integer (yen). */
export function dedicatedMenuPriceValid(price: number | null): boolean {
  return price === null || (Number.isSafeInteger(price) && price >= 0);
}

/** Selectable only when not disabled AND bounds AND price are well-formed. Anything else fails closed. */
export function isDedicatedMenuUsable(menu: DedicatedMenuRef): boolean {
  return menu.disabled !== true && dedicatedMenuBoundsValid(menu) && dedicatedMenuPriceValid(menu.defaultUnitPrice);
}

/** True when `qty` is a positive safe integer inside the menu's configured bounds. */
export function isQuantityWithinMenuBounds(qty: number, menu: Pick<DedicatedMenuRef, "minQty" | "maxQty">): boolean {
  if (!Number.isSafeInteger(qty) || qty < 1) return false;
  if (qty < menu.minQty) return false;
  return menu.maxQty === null || qty <= menu.maxQty;
}

/**
 * The quantity a NEWLY selected menu starts at: the kind's nominal initial (wheel 4 / glass 1),
 * clamped to the nearest configured bound when the nominal falls outside them. `null` when the
 * bounds are malformed — the caller must then fail closed rather than guess.
 */
export function initialDedicatedMenuQuantity(kind: DedicatedMenuKind, menu: Pick<DedicatedMenuRef, "minQty" | "maxQty">): number | null {
  if (!dedicatedMenuBoundsValid(menu)) return null;
  const nominal = DEDICATED_MENU_INITIAL_QUANTITY[kind];
  if (nominal < menu.minQty) return menu.minQty;
  if (menu.maxQty !== null && nominal > menu.maxQty) return menu.maxQty;
  return nominal;
}

/**
 * The canonical section to READ for a kind. An older draft may lack the optional section; reading
 * it as empty selects nothing and implies no service — the write path (the reducer) completes the
 * section on the first patch. This is a read projection, never a second copy of state.
 */
export function dedicatedMenuDraftOf(services: WizardServiceConfigurationDraft, kind: DedicatedMenuKind): WizardDedicatedMenuDraft {
  return services[kind] ?? { selectedMenuIds: [], unitPricesByMenu: {}, quantitiesByMenu: {} };
}

export interface DedicatedMenuBindings {
  /** Select/unselect one dealer menu. Selecting initialises quantity/price ONLY where no valid value exists. */
  onMenuToggle: (menu: DedicatedMenuRef) => DedicatedMenuActionResult;
  /** Operator-edited tax-exclusive unit-price text (kept verbatim; validated downstream, never here). */
  onUnitPriceChange: (id: string, v: string) => void;
  /** Positive-integer quantity within the menu's configured bounds; anything else emits NO patch. */
  onQuantityChange: (menu: DedicatedMenuRef, qty: number) => DedicatedMenuActionResult;
}

/** Controlled callbacks for the canonical serviceConfiguration sections (eight + wheel/glass). */
export interface Step4Bindings {
  coating: CoatingBindings;
  ppf: PpfBindings;
  windowFilm: WindowFilmBindings;
  bodyMaintenance: BodyMaintenanceBindings;
  carWash: CarWashBindings;
  roomCleaning: RoomCleaningBindings;
  otherWork: OtherWorkBindings;
  storeGlobalOptions: StoreGlobalOptionsBindings;
  wheel: DedicatedMenuBindings;
  glass: DedicatedMenuBindings;
  /** GDA-OTHER-COATINGS-R1 (C3): the distinct `other_coating` section (same draft shape, own key). */
  otherCoating: OtherCoatingBindings;
}

/**
 * Build one dedicated-menu binding surface over the current section projection.
 * `initialOf` yields the quantity a NEWLY selected menu starts at (null = malformed → fail closed);
 * wheel/glass supply their kind's nominal via `initialDedicatedMenuQuantity`, unchanged from B5b2.
 */
function dedicatedMenuBindings(
  initialOf: (menu: DedicatedMenuRef) => number | null,
  current: WizardDedicatedMenuDraft,
  emit: (patch: Partial<WizardDedicatedMenuDraft>) => void,
): DedicatedMenuBindings {
  return {
    onMenuToggle: (menu) => {
      if (current.selectedMenuIds.includes(menu.id)) {
        // Unselect drops the id ONLY. The operator's price/quantity stay in the draft so a return
        // finds them intact; `selectedMenuIds` alone decides whether a line exists downstream.
        emit({ selectedMenuIds: current.selectedMenuIds.filter((x) => x !== menu.id) });
        return MENU_ACTION_OK;
      }
      if (!isDedicatedMenuUsable(menu)) return MENU_INVALID;
      const initial = initialOf(menu);
      if (initial === null) return MENU_INVALID;

      const patch: Partial<WizardDedicatedMenuDraft> = { selectedMenuIds: [...current.selectedMenuIds, menu.id] };
      // Quantity: keep an existing value that is still valid for these bounds; otherwise initialise.
      const existingQty: number | undefined = current.quantitiesByMenu[menu.id];
      if (existingQty === undefined || !isQuantityWithinMenuBounds(existingQty, menu)) {
        patch.quantitiesByMenu = setNum(current.quantitiesByMenu, menu.id, initial);
      }
      // Price: keep any existing operator text; prefill from the configured price only when absent
      // AND configured. A null configured price leaves the text absent — never "0".
      const existingPrice: string | undefined = current.unitPricesByMenu[menu.id];
      if ((existingPrice === undefined || existingPrice === "") && menu.defaultUnitPrice !== null) {
        patch.unitPricesByMenu = setStr(current.unitPricesByMenu, menu.id, String(menu.defaultUnitPrice));
      }
      emit(patch);
      return MENU_ACTION_OK;
    },
    onUnitPriceChange: (id, v) => emit({ unitPricesByMenu: setStr(current.unitPricesByMenu, id, v) }),
    onQuantityChange: (menu, qty) => {
      if (!isDedicatedMenuUsable(menu)) return MENU_INVALID;
      if (!isQuantityWithinMenuBounds(qty, menu)) return MENU_QUANTITY_OUT_OF_BOUNDS;
      emit({ quantitiesByMenu: setNum(current.quantitiesByMenu, menu.id, qty) });
      return MENU_ACTION_OK;
    },
  };
}

// ── GDA-OTHER-COATINGS-R1 (C3): the distinct `other_coating` section ────────────────────────────
//
// Non-body coatings (resin trim / seat / engine room / dealer-added items) are a DISTINCT Screen-3
// category with their OWN draft section (`services.otherCoating`, same dedicated-menu shape as
// wheel/glass). Unlike wheel/glass, quantity is read from the ROW, not fixed by kind:
//   • fixed-one item (`quantityRequired: false`) → effective quantity EXACTLY 1; the bounds are
//     {1, 1}, so any other quantity is out of bounds and the host offers no quantity control;
//   • quantity-bearing item (`quantityRequired: true`) → initial 1 clamped to the configured lower
//     bound (absent min = 1; absent max = no maximum), positive-integer bounds, editable.
// Price: a POSITIVE configured price is prefilled as text. null / 0 / unconfigured is left ABSENT
// (never "0"): the operator may type a positive price, but no zero-price line is ever prepared.
// Malformed bounds, a negative / non-integer price, or a disabled row FAIL CLOSED (no patch).
// The wheel/glass kinds, nominal initials and copy are untouched; nothing here is priced.

/** The runtime OtherCoatingMenu facts the callbacks need (a structural subset of the C2 row). */
export interface OtherCoatingMenuRef {
  readonly id: string;
  readonly defaultUnitPrice: number | null;
  readonly quantityRequired: boolean;
  readonly minQty?: number;
  readonly maxQty?: number;
  readonly disabled?: boolean;
}

/** Nominal initial for a quantity-bearing other-coating item (an initial value, NOT a minimum). */
export const OTHER_COATING_INITIAL_QUANTITY = 1;

/** A fixed-one item has NO editable quantity: its effective quantity is exactly 1. */
export function isOtherCoatingFixedOne(menu: Pick<OtherCoatingMenuRef, "quantityRequired">): boolean {
  return menu.quantityRequired !== true;
}

/**
 * TOTAL normalisation of an other-coating row into the dedicated-menu contract, so every B5b2
 * validity / bounds / prefill rule applies unchanged. It never rejects — a malformed configured
 * value is passed THROUGH so `isDedicatedMenuUsable` fails it closed:
 *   • fixed-one → bounds {1, 1};  quantity-bearing → {minQty ?? 1, maxQty ?? null};
 *   • price 0 → null ("not configured"); other values pass through (positive prefill, negative /
 *     non-integer rejected downstream). Nothing is ever coerced to 0.
 */
export function toOtherCoatingMenuRef(menu: OtherCoatingMenuRef): DedicatedMenuRef {
  const price = menu.defaultUnitPrice === 0 ? null : menu.defaultUnitPrice;
  const bounds = isOtherCoatingFixedOne(menu)
    ? { minQty: 1, maxQty: 1 as number | null }
    : { minQty: menu.minQty ?? 1, maxQty: menu.maxQty ?? null };
  return { id: menu.id, defaultUnitPrice: price, ...bounds, ...(menu.disabled === true ? { disabled: true } : {}) };
}

/**
 * The quantity a NEWLY selected other-coating item starts at: exactly 1 for a fixed-one item; the
 * nominal 1 clamped to the nearest configured bound for a quantity-bearing item (so: its lower
 * bound). `null` when the bounds are malformed — the caller then fails closed.
 */
export function initialOtherCoatingQuantity(menu: Pick<DedicatedMenuRef, "minQty" | "maxQty">): number | null {
  if (!dedicatedMenuBoundsValid(menu)) return null;
  if (OTHER_COATING_INITIAL_QUANTITY < menu.minQty) return menu.minQty;
  if (menu.maxQty !== null && OTHER_COATING_INITIAL_QUANTITY > menu.maxQty) return menu.maxQty;
  return OTHER_COATING_INITIAL_QUANTITY;
}

/** The canonical `otherCoating` section to READ (absent on older drafts → empty; never a 2nd copy). */
export function otherCoatingDraftOf(services: WizardServiceConfigurationDraft): WizardDedicatedMenuDraft {
  return services.otherCoating ?? { selectedMenuIds: [], unitPricesByMenu: {}, quantitiesByMenu: {} };
}

export interface OtherCoatingBindings {
  /** Select/unselect one dealer item. Selecting initialises quantity (fixed-one: 1) / price only where absent. */
  onMenuToggle: (menu: OtherCoatingMenuRef) => DedicatedMenuActionResult;
  /** Operator-edited tax-exclusive unit-price text (kept verbatim; validated downstream, never here). */
  onUnitPriceChange: (id: string, v: string) => void;
  /** Positive-integer quantity within the item's bounds (a fixed-one item accepts ONLY 1); else NO patch. */
  onQuantityChange: (menu: OtherCoatingMenuRef, qty: number) => DedicatedMenuActionResult;
}

function otherCoatingBindings(
  current: WizardDedicatedMenuDraft,
  emit: (patch: Partial<WizardDedicatedMenuDraft>) => void,
): OtherCoatingBindings {
  const inner = dedicatedMenuBindings(initialOtherCoatingQuantity, current, emit);
  return {
    onMenuToggle: (menu) => inner.onMenuToggle(toOtherCoatingMenuRef(menu)),
    onUnitPriceChange: inner.onUnitPriceChange,
    onQuantityChange: (menu, qty) => inner.onQuantityChange(toOtherCoatingMenuRef(menu), qty),
  };
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
 */
export function createStep4Bindings(
  services: WizardServiceConfigurationDraft,
  updateStore: Step4UpdateStore,
  cryptoSource?: WizardRowIdCryptoSource,
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
  // B5b2 — the two dedicated sections; each patch names exactly its own section key.
  const emitWheel = (patch: Partial<WizardDedicatedMenuDraft>) => updateStore({ services: { wheel: patch } });
  const emitGlass = (patch: Partial<WizardDedicatedMenuDraft>) => updateStore({ services: { glass: patch } });
  // C3 — the distinct other-coating section; its patch names exactly its own section key.
  const emitOtherCoating = (patch: Partial<WizardDedicatedMenuDraft>) => updateStore({ services: { otherCoating: patch } });

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
      onOptionToggle: (id) => emitStoreGlobalOptions({ selectedOptionIds: toggle(services.storeGlobalOptions.selectedOptionIds, id) }),
      onUnitPriceChange: (id, v) => emitStoreGlobalOptions({ unitPricesByOption: setStr(services.storeGlobalOptions.unitPricesByOption, id, v) }),
      onQuantityChange: (id, qty) => emitStoreGlobalOptions({ quantitiesByOption: setNum(services.storeGlobalOptions.quantitiesByOption, id, qty) }),
    },
    wheel: dedicatedMenuBindings((m) => initialDedicatedMenuQuantity("wheel", m), dedicatedMenuDraftOf(services, "wheel"), emitWheel),
    glass: dedicatedMenuBindings((m) => initialDedicatedMenuQuantity("glass", m), dedicatedMenuDraftOf(services, "glass"), emitGlass),
    otherCoating: otherCoatingBindings(otherCoatingDraftOf(services), emitOtherCoating),
  };
}
