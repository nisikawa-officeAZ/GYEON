// Estimate Wizard Ver2.2 — Canonical draft: initial state, immutable updates, reset, normalize.
//
// Pure & deterministic. No calculation, no persistence, no I/O, no fake data. Update helpers are
// typed and immutable (no generic deep-path mutation, no `any`). No external state library.

import type { ServiceCategoryId } from "@/lib/estimates/service-categories";
import { SERVICE_CATEGORY_IDS } from "@/lib/estimates/service-categories";
import type { NewCustomerDraft, NewVehicleDraft } from "../screens/step-types";
import type {
  EstimateWizardDraftV22,
  WizardCustomerDraft, WizardVehicleDraft, WizardServiceSelectionDraft,
  WizardServiceConfigurationDraft, WizardDiscountDraft, WizardNotesDraft, WizardReviewDraft,
  WizardServiceCategory,
} from "./wizard-draft-types";

const EMPTY_NEW_CUSTOMER: NewCustomerDraft = {
  name: "", phone: "", email: "", postal: "", address: "", lineId: "",
  isBusiness: false, tradeRate: "", arAllowed: false, closingDay: "", paymentDay: "",
  kana: "", creditTerms: "",
};
const EMPTY_NEW_VEHICLE: NewVehicleDraft = {
  maker: "", model: "", grade: "", vehicle_code: "", vin: "",
  first_registration_year_month: "", registration_date: "", inspection_expiry_date: "",
  displacement: "", color: "", plate_number: "",
};

export const MIN_STEP = 1;
export const MAX_STEP = 7;

/** The single canonical initial draft — all empty/null/explicit defaults; no fake data, no IDs. */
export const initialEstimateWizardDraftV22: EstimateWizardDraftV22 = {
  version: "2.2",
  customer: { sourceMode: "new", customerId: null, newCustomer: { ...EMPTY_NEW_CUSTOMER } },
  vehicle: { sourceMode: "new", vehicleId: null, newVehicle: { ...EMPTY_NEW_VEHICLE }, bodySizeKey: "" },
  serviceSelection: { selectedCategories: [] },
  serviceConfiguration: {
    coating: { layerCount: null, layer1Id: null, layer2Id: null, layer3Id: null },
    ppf: { installationMethod: null, selectedPartIds: [], quantitiesByPart: {}, ppfTypeId: null, unitPriceInput: "", interiorRows: [] },
    windowFilm: { selectedAreaIds: [], filmTypeId: null, unitPriceInput: "" },
    bodyMaintenance: { menuId: null, unitPriceInput: "" },
    carWash: { menuId: null, unitPriceInput: "" },
    roomCleaning: { selectedMenuIds: [], unitPricesByMenu: {} },
    otherWork: { selectedPresetIds: [], unitPricesByItem: {}, quantitiesByItem: {}, customRows: [] },
    storeGlobalOptions: { selectedOptionIds: [], unitPricesByOption: {}, quantitiesByOption: {} },
  },
  discountAndCoupon: { mode: "none", percentInput: "", amountInput: "", selectedCouponIds: [], adjustmentReason: "" },
  notes: { customerNotes: "", internalMemo: "" },
  review: { previewConfirmed: false },
  metadata: { schemaVersion: "2.2", currentStep: 1, lastUpdatedAt: null, source: "estimate-wizard-v2.2" },
};

// ── Immutable, typed section updates ─────────────────────────────────────────────
export function updateCustomer(d: EstimateWizardDraftV22, patch: Partial<WizardCustomerDraft>): EstimateWizardDraftV22 {
  return { ...d, customer: { ...d.customer, ...patch } };
}
export function updateNewCustomer(d: EstimateWizardDraftV22, patch: Partial<NewCustomerDraft>): EstimateWizardDraftV22 {
  return { ...d, customer: { ...d.customer, newCustomer: { ...d.customer.newCustomer, ...patch } } };
}
export function updateVehicle(d: EstimateWizardDraftV22, patch: Partial<WizardVehicleDraft>): EstimateWizardDraftV22 {
  return { ...d, vehicle: { ...d.vehicle, ...patch } };
}
export function updateNewVehicle(d: EstimateWizardDraftV22, patch: Partial<NewVehicleDraft>): EstimateWizardDraftV22 {
  return { ...d, vehicle: { ...d.vehicle, newVehicle: { ...d.vehicle.newVehicle, ...patch } } };
}
export function updateServiceSelection(d: EstimateWizardDraftV22, patch: Partial<WizardServiceSelectionDraft>): EstimateWizardDraftV22 {
  const next = { ...d.serviceSelection, ...patch };
  return { ...d, serviceSelection: { selectedCategories: dedupeCategories(next.selectedCategories) } };
}
/** Update one service-configuration section immutably (section key is typed — no string paths). */
export function updateServiceConfiguration<K extends keyof WizardServiceConfigurationDraft>(
  d: EstimateWizardDraftV22, section: K, patch: Partial<WizardServiceConfigurationDraft[K]>,
): EstimateWizardDraftV22 {
  return {
    ...d,
    serviceConfiguration: {
      ...d.serviceConfiguration,
      [section]: { ...d.serviceConfiguration[section], ...patch },
    },
  };
}
export function updateDiscountAndCoupon(d: EstimateWizardDraftV22, patch: Partial<WizardDiscountDraft>): EstimateWizardDraftV22 {
  return { ...d, discountAndCoupon: { ...d.discountAndCoupon, ...patch } };
}
export function updateNotes(d: EstimateWizardDraftV22, patch: Partial<WizardNotesDraft>): EstimateWizardDraftV22 {
  return { ...d, notes: { ...d.notes, ...patch } };
}
export function updateReview(d: EstimateWizardDraftV22, patch: Partial<WizardReviewDraft>): EstimateWizardDraftV22 {
  return { ...d, review: { ...d.review, ...patch } };
}
export function setCurrentStep(d: EstimateWizardDraftV22, step: number): EstimateWizardDraftV22 {
  return { ...d, metadata: { ...d.metadata, currentStep: clampStep(step) } };
}

/** Explicit reset to the exact canonical initial state (fresh nested copies; no I/O, no storage). */
export function resetWizardDraft(): EstimateWizardDraftV22 {
  return {
    ...initialEstimateWizardDraftV22,
    customer: { ...initialEstimateWizardDraftV22.customer, newCustomer: { ...EMPTY_NEW_CUSTOMER } },
    vehicle: { ...initialEstimateWizardDraftV22.vehicle, newVehicle: { ...EMPTY_NEW_VEHICLE } },
    serviceSelection: { selectedCategories: [] },
    serviceConfiguration: {
      coating: { layerCount: null, layer1Id: null, layer2Id: null, layer3Id: null },
      ppf: { installationMethod: null, selectedPartIds: [], quantitiesByPart: {}, ppfTypeId: null, unitPriceInput: "", interiorRows: [] },
      windowFilm: { selectedAreaIds: [], filmTypeId: null, unitPriceInput: "" },
      bodyMaintenance: { menuId: null, unitPriceInput: "" },
      carWash: { menuId: null, unitPriceInput: "" },
      roomCleaning: { selectedMenuIds: [], unitPricesByMenu: {} },
      otherWork: { selectedPresetIds: [], unitPricesByItem: {}, quantitiesByItem: {}, customRows: [] },
      storeGlobalOptions: { selectedOptionIds: [], unitPricesByOption: {}, quantitiesByOption: {} },
    },
    discountAndCoupon: { mode: "none", percentInput: "", amountInput: "", selectedCouponIds: [], adjustmentReason: "" },
    notes: { customerNotes: "", internalMemo: "" },
    review: { previewConfirmed: false },
    metadata: { schemaVersion: "2.2", currentStep: 1, lastUpdatedAt: null, source: "estimate-wizard-v2.2" },
  };
}

// ── Normalization helpers (deterministic; never calculate / infer / generate IDs) ─
export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return MIN_STEP;
  return Math.min(MAX_STEP, Math.max(MIN_STEP, Math.trunc(step)));
}

/** Remove duplicate category ids while preserving first-seen stable order. Unknown ids are kept
 *  (never silently deleted); a dev warning is emitted so nothing is lost quietly. */
export function dedupeCategories(ids: WizardServiceCategory[]): WizardServiceCategory[] {
  const seen = new Set<string>();
  const out: WizardServiceCategory[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (process.env.NODE_ENV !== "production" && !SERVICE_CATEGORY_IDS.includes(id as ServiceCategoryId)) {
      // eslint-disable-next-line no-console
      console.warn(`[wizard-draft] unknown service category preserved: ${id}`);
    }
    out.push(id);
  }
  return out;
}
