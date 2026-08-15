// EW-UI-2A — Pure patch adapter: apply Partial<WizardStore> onto the canonical
// EstimateWizardDraftV22 using ONLY the official immutable canonical update helpers.
//
// Fail-closed: unsupported/invalid fields return a structured error and DO NOT mutate or partially
// apply the previous draft. No pricing arithmetic, no OCR, no save, no generated IDs, no cloning.

import type {
  EstimateWizardDraftV22, CustomerRegistrationMethod, WizardServiceCategory,
  WizardDiscountDraft, WizardNotesDraft, WizardServiceConfigurationDraft,
  WizardCoatingDraft, WizardPpfDraft, WizardWindowFilmDraft, WizardBodyMaintenanceDraft,
  WizardCarWashDraft, WizardRoomCleaningDraft, WizardOtherWorkDraft, WizardStoreGlobalOptionsDraft,
} from "../draft/wizard-draft-types";
import type { NewCustomerDraft, NewVehicleDraft } from "../screens/step-types";
import {
  updateCustomer, updateNewCustomer, updateCustomerRegistrationMethod,
  updateVehicle, updateNewVehicle, updateServiceSelection, updateServiceConfiguration,
  updateDiscountAndCoupon, updateNotes,
} from "../draft/wizard-draft-state";
import { isServiceCategoryId } from "@/lib/estimates/service-categories";
import type { WizardStore, CustomerDraft, VehicleDraft } from "../wizard-types";

/** Per-section partial patch of the canonical service configuration (no `any`, no arbitrary paths). */
export type WizardServiceConfigPatch = {
  readonly [K in keyof WizardServiceConfigurationDraft]?: Partial<WizardServiceConfigurationDraft[K]>;
};

/**
 * A WizardStore patch: top-level fields optional, and the nested customer/vehicle/services objects
 * may be partial. `useEstimateWizard.updateStore` accepts this `WizardStorePatch` type. A plain
 * `Partial<WizardStore>` remains assignable wherever its nested objects are complete, so existing
 * complete-object callers keep working; `WizardStorePatch` additionally supports nested partial
 * service-section patches. `services` accepts a per-section partial patch of the canonical service
 * configuration (never `any`, never arbitrary deep paths).
 */
export type WizardStorePatch = {
  readonly customer?: Partial<CustomerDraft>;
  readonly vehicle?: Partial<VehicleDraft>;
  readonly categories?: readonly string[];
  readonly services?: WizardServiceConfigPatch;
  readonly coupons?: readonly string[];
  readonly discountMode?: WizardStore["discountMode"];
  readonly discountAmount?: string;
  readonly discountPercent?: string;
  readonly notesCustomer?: string;
  readonly notesInternal?: string;
};

export type EwUi1PatchErrorCode = "EW_UI_UNSUPPORTED_FIELD" | "EW_UI_INVALID_CATEGORY" | "EW_UI_INVALID_PATCH";

export interface EwUi1PatchError {
  readonly code: EwUi1PatchErrorCode;
  readonly message: string;
  readonly fieldPaths: readonly string[]; // exact unsupported/invalid field paths
}

export type EwUi1ApplyResult =
  | { readonly ok: true; readonly draft: EstimateWizardDraftV22 }
  | { readonly ok: false; readonly error: EwUi1PatchError };

const err = (code: EwUi1PatchErrorCode, message: string, fieldPaths: string[]): EwUi1ApplyResult =>
  ({ ok: false, error: { code, message, fieldPaths } });

// ── Copy-on-apply helpers ──
// Each caller-supplied array, record, or row object is COPIED before it becomes canonical state, so
// the adapter never captures a live reference the caller could mutate afterwards. Supplied row IDs
// are preserved EXACTLY (never generated, normalized, or replaced). Only the keys the caller sent
// are copied — an absent section field leaves the canonical value untouched (updateServiceConfiguration
// does a shallow per-section merge), so removing a Screen-3 category cannot erase its Screen-4 config.

const copyRows = <T>(rows: readonly T[]): T[] => rows.map((r) => ({ ...r }));

function copyCoating(p: Partial<WizardCoatingDraft>): Partial<WizardCoatingDraft> {
  return { ...p }; // all scalar fields
}
function copyPpf(p: Partial<WizardPpfDraft>): Partial<WizardPpfDraft> {
  const out: Partial<WizardPpfDraft> = { ...p };
  if (p.selectedPartIds !== undefined) out.selectedPartIds = [...p.selectedPartIds];
  if (p.quantitiesByPart !== undefined) out.quantitiesByPart = { ...p.quantitiesByPart };
  if (p.interiorRows !== undefined) out.interiorRows = copyRows(p.interiorRows);
  return out;
}
function copyWindowFilm(p: Partial<WizardWindowFilmDraft>): Partial<WizardWindowFilmDraft> {
  const out: Partial<WizardWindowFilmDraft> = { ...p };
  if (p.selectedAreaIds !== undefined) out.selectedAreaIds = [...p.selectedAreaIds];
  return out;
}
function copyBodyMaintenance(p: Partial<WizardBodyMaintenanceDraft>): Partial<WizardBodyMaintenanceDraft> {
  return { ...p }; // all scalar fields
}
function copyCarWash(p: Partial<WizardCarWashDraft>): Partial<WizardCarWashDraft> {
  return { ...p }; // all scalar fields
}
function copyRoomCleaning(p: Partial<WizardRoomCleaningDraft>): Partial<WizardRoomCleaningDraft> {
  const out: Partial<WizardRoomCleaningDraft> = { ...p };
  if (p.selectedMenuIds !== undefined) out.selectedMenuIds = [...p.selectedMenuIds];
  if (p.unitPricesByMenu !== undefined) out.unitPricesByMenu = { ...p.unitPricesByMenu };
  return out;
}
function copyOtherWork(p: Partial<WizardOtherWorkDraft>): Partial<WizardOtherWorkDraft> {
  const out: Partial<WizardOtherWorkDraft> = { ...p };
  if (p.selectedPresetIds !== undefined) out.selectedPresetIds = [...p.selectedPresetIds];
  if (p.unitPricesByItem !== undefined) out.unitPricesByItem = { ...p.unitPricesByItem };
  if (p.quantitiesByItem !== undefined) out.quantitiesByItem = { ...p.quantitiesByItem };
  if (p.customRows !== undefined) out.customRows = copyRows(p.customRows);
  return out;
}
function copyStoreGlobalOptions(p: Partial<WizardStoreGlobalOptionsDraft>): Partial<WizardStoreGlobalOptionsDraft> {
  const out: Partial<WizardStoreGlobalOptionsDraft> = { ...p };
  if (p.selectedOptionIds !== undefined) out.selectedOptionIds = [...p.selectedOptionIds];
  if (p.unitPricesByOption !== undefined) out.unitPricesByOption = { ...p.unitPricesByOption };
  if (p.quantitiesByOption !== undefined) out.quantitiesByOption = { ...p.quantitiesByOption };
  return out;
}

/** Apply the service-config patch section-by-section via the official reducer, with copy-on-apply. */
function applyServiceConfigPatch(draft: EstimateWizardDraftV22, sp: WizardServiceConfigPatch): EstimateWizardDraftV22 {
  let d = draft;
  if (sp.coating !== undefined) d = updateServiceConfiguration(d, "coating", copyCoating(sp.coating));
  if (sp.ppf !== undefined) d = updateServiceConfiguration(d, "ppf", copyPpf(sp.ppf));
  if (sp.windowFilm !== undefined) d = updateServiceConfiguration(d, "windowFilm", copyWindowFilm(sp.windowFilm));
  if (sp.bodyMaintenance !== undefined) d = updateServiceConfiguration(d, "bodyMaintenance", copyBodyMaintenance(sp.bodyMaintenance));
  if (sp.carWash !== undefined) d = updateServiceConfiguration(d, "carWash", copyCarWash(sp.carWash));
  if (sp.roomCleaning !== undefined) d = updateServiceConfiguration(d, "roomCleaning", copyRoomCleaning(sp.roomCleaning));
  if (sp.otherWork !== undefined) d = updateServiceConfiguration(d, "otherWork", copyOtherWork(sp.otherWork));
  if (sp.storeGlobalOptions !== undefined) d = updateServiceConfiguration(d, "storeGlobalOptions", copyStoreGlobalOptions(sp.storeGlobalOptions));
  return d;
}

/**
 * Apply a WizardStore patch onto the canonical draft. Validates FIRST (fails closed before any
 * change); on success applies via the official immutable reducers only.
 */
export function applyEwUi1StorePatch(draft: EstimateWizardDraftV22, patch: WizardStorePatch): EwUi1ApplyResult {
  if (patch === null || typeof patch !== "object") {
    return err("EW_UI_INVALID_PATCH", "patch must be an object", []);
  }

  // ── 1. Fail-closed validation (nothing is applied if any check fails) ──
  // Unsupported: suggestedSize (display-only until its typed recommendation contract exists).
  if (patch.vehicle !== undefined && patch.vehicle.suggestedSize != null) {
    return err("EW_UI_UNSUPPORTED_FIELD", "vehicle.suggestedSize is display-only", ["vehicle.suggestedSize"]);
  }
  // Invalid categories: only canonical ServiceCategoryId values allowed (never cast arbitrary strings).
  let categories: WizardServiceCategory[] | undefined;
  if (patch.categories !== undefined) {
    const invalid = patch.categories.filter((id) => !isServiceCategoryId(id));
    if (invalid.length > 0) {
      return err("EW_UI_INVALID_CATEGORY", "unknown service category id(s)", invalid.map((id) => `categories:${id}`));
    }
    categories = patch.categories.filter(isServiceCategoryId);
  }

  // ── 2. Apply via official immutable reducers only ──
  let d = draft;

  // Customer
  const pc = patch.customer;
  if (pc) {
    if (pc.regMethod !== undefined) d = updateCustomerRegistrationMethod(d, pc.regMethod as CustomerRegistrationMethod);
    if (pc.existingId !== undefined) d = updateCustomer(d, { customerId: pc.existingId });
    const nc: Partial<NewCustomerDraft> = {};
    if (pc.name !== undefined) nc.name = pc.name;
    if (pc.kana !== undefined) nc.kana = pc.kana;
    if (pc.email !== undefined) nc.email = pc.email;
    if (pc.postal !== undefined) nc.postal = pc.postal;
    if (pc.address !== undefined) nc.address = pc.address;
    if (pc.phone !== undefined) nc.phone = pc.phone;
    if (pc.lineId !== undefined) nc.lineId = pc.lineId;
    if (pc.contractor !== undefined) nc.isBusiness = pc.contractor;
    if (pc.contractorRate !== undefined) nc.tradeRate = pc.contractorRate;
    if (pc.creditSale !== undefined) nc.arAllowed = pc.creditSale;
    if (pc.creditClosing !== undefined) nc.closingDay = pc.creditClosing;
    if (pc.paymentDay !== undefined) nc.paymentDay = pc.paymentDay;
    if (pc.creditTerms !== undefined) nc.creditTerms = pc.creditTerms;
    if (Object.keys(nc).length > 0) d = updateNewCustomer(d, nc);
  }

  // Vehicle
  const pv = patch.vehicle;
  if (pv) {
    if (pv.existingId !== undefined) {
      // existingId present → existing selection; null → new (never invent a vehicle id).
      d = updateVehicle(d, { vehicleId: pv.existingId, sourceMode: pv.existingId ? "existing" : "new" });
    }
    if (pv.confirmedSize !== undefined) d = updateVehicle(d, { bodySizeKey: pv.confirmedSize ?? "" });
    const nv: Partial<NewVehicleDraft> = {};
    if (pv.maker !== undefined) nv.maker = pv.maker;
    if (pv.model !== undefined) nv.model = pv.model;
    if (pv.grade !== undefined) nv.grade = pv.grade;
    if (pv.vehicleCode !== undefined) nv.vehicle_code = pv.vehicleCode;
    if (pv.displacement !== undefined) nv.displacement = pv.displacement;
    if (pv.vin !== undefined) nv.vin = pv.vin;
    if (pv.firstRegYearMonth !== undefined) nv.first_registration_year_month = pv.firstRegYearMonth;
    if (pv.registrationDate !== undefined) nv.registration_date = pv.registrationDate;
    if (pv.color !== undefined) nv.color = pv.color;
    if (pv.inspectionExpiry !== undefined) nv.inspection_expiry_date = pv.inspectionExpiry;
    if (pv.plateNumber !== undefined) nv.plate_number = pv.plateNumber;
    if (Object.keys(nv).length > 0) d = updateNewVehicle(d, nv);
  }

  // Categories (validated above; official helper dedupes + preserves stable order)
  if (categories !== undefined) d = updateServiceSelection(d, { selectedCategories: categories });

  // Service configuration (Screen-4 operator intent; copy-on-apply, per-section shallow merge).
  // Category selection (above) and service configuration are SEPARATE fields — deselecting a
  // Screen-3 category never erases the corresponding Screen-4 configuration here.
  if (patch.services !== undefined) d = applyServiceConfigPatch(d, patch.services);

  // Discount / coupons (intent only; preserve inactive inputs + multiple coupon ids; no arithmetic)
  const dcPatch: Partial<WizardDiscountDraft> = {};
  if (patch.coupons !== undefined) dcPatch.selectedCouponIds = [...patch.coupons];
  if (patch.discountMode !== undefined) dcPatch.mode = patch.discountMode;
  if (patch.discountAmount !== undefined) dcPatch.amountInput = patch.discountAmount;
  if (patch.discountPercent !== undefined) dcPatch.percentInput = patch.discountPercent;
  if (Object.keys(dcPatch).length > 0) d = updateDiscountAndCoupon(d, dcPatch);

  // Notes (strictly separated)
  const notesPatch: Partial<WizardNotesDraft> = {};
  if (patch.notesCustomer !== undefined) notesPatch.customerNotes = patch.notesCustomer;
  if (patch.notesInternal !== undefined) notesPatch.internalMemo = patch.notesInternal;
  if (Object.keys(notesPatch).length > 0) d = updateNotes(d, notesPatch);

  return { ok: true, draft: d };
}
