// EW-UI-2A — Pure patch adapter: apply Partial<WizardStore> onto the canonical
// EstimateWizardDraftV22 using ONLY the official immutable canonical update helpers.
//
// Fail-closed: unsupported/invalid fields return a structured error and DO NOT mutate or partially
// apply the previous draft. No pricing arithmetic, no OCR, no save, no generated IDs, no cloning.

import type {
  EstimateWizardDraftV22, CustomerRegistrationMethod, WizardServiceCategory,
  WizardDiscountDraft, WizardNotesDraft,
} from "../draft/wizard-draft-types";
import type { NewCustomerDraft, NewVehicleDraft } from "../screens/step-types";
import {
  updateCustomer, updateNewCustomer, updateCustomerRegistrationMethod,
  updateVehicle, updateNewVehicle, updateServiceSelection, updateDiscountAndCoupon, updateNotes,
} from "../draft/wizard-draft-state";
import { isServiceCategoryId } from "@/lib/estimates/service-categories";
import type { WizardStore, CustomerDraft, VehicleDraft, ServiceSelections } from "../wizard-types";

/**
 * A WizardStore patch: top-level fields optional, and the nested customer/vehicle/services objects
 * may be partial. `Partial<WizardStore>` (which the hook's updateStore accepts — nested objects
 * complete) is assignable to this, so the public hook signature is unchanged while tests and future
 * callers may also send partial nested patches.
 */
export type WizardStorePatch = {
  readonly customer?: Partial<CustomerDraft>;
  readonly vehicle?: Partial<VehicleDraft>;
  readonly categories?: readonly string[];
  readonly services?: Partial<ServiceSelections>;
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

function servicesIsNonEmpty(s: Partial<ServiceSelections>): boolean {
  return (
    Object.keys(s.coating ?? {}).length > 0 || Object.keys(s.ppf ?? {}).length > 0 ||
    Object.keys(s.window ?? {}).length > 0 || Object.keys(s.roomclean ?? {}).length > 0 ||
    (s.maintenance ?? []).length > 0 || (s.carwash ?? []).length > 0 ||
    (s.other ?? []).length > 0 || (s.storeOptions ?? []).length > 0
  );
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
  // Unsupported: non-empty services (Screen-4 editor not implemented).
  if (patch.services !== undefined && servicesIsNonEmpty(patch.services)) {
    return err("EW_UI_UNSUPPORTED_FIELD", "services binding is not implemented in this phase", ["services"]);
  }
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
