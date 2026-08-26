// Estimate Wizard Ver2.2 — Canonical in-memory draft model (Phase 9).
//
// ONE typed presentation/integration domain model for Screens 1–7. It couples to NO production
// DB row and to NO EstimateEditor internals. It performs NO calculation and NO persistence — it
// records operator intent only. Field separation is strict; `internalMemo` is never merged with
// customer-facing data.
//
// DESIGN NOTE — the Architect's recommended shapes are a superset template. Per the binding rule
// "use only fields that exist in the current approved UI; do not invent", this model mirrors the
// ACTUAL implemented Screen 1–7 state. It therefore:
//   • embeds the approved Screen-1/2 input drafts (NewCustomerDraft / NewVehicleDraft) verbatim
//     instead of inventing lastName/firstName/kana/prefecture/city fields the UI does not have;
//   • keeps numeric text inputs as strings (tradeRate / closingDay / unit prices) to preserve the
//     exact live-input behavior of the approved UI (no lossy number round-trips);
//   • supports MULTIPLE coupons (selectedCouponIds) because Screen 5 implements multi-select;
//   • uses the canonical ServiceCategoryId ids as the category union (matches the single source of
//     truth in @/lib/estimates/service-categories) rather than re-spelled snake_case names.
// Each such deviation is intentional and documented; nothing is invented.

import type { ServiceCategoryId } from "@/lib/estimates/service-categories";
import type {
  NewCustomerDraft, NewVehicleDraft, DiscountMode,
  LayerCount, PpfInstallationMethodId, InteriorPpfRow, OtherWorkCustomRow,
} from "../screens/step-types";

// ── Customer (Screen 1) ─────────────────────────────────────────────────────────
/** Canonical data-entry method for the customer step — the SINGLE authority (EW-UI-1 aliases it).
 *  `new` = manual new-customer entry; `ocr` = OCR selected as the entry method (the result is still
 *  a new-customer draft); `search` = existing-customer search/selection. This is DISTINCT from
 *  `sourceMode` (the persistence mode): new/ocr → new; search → existing. It records only the
 *  selected entry method — it does NOT execute OCR or make OCR operational. */
export type CustomerRegistrationMethod = "new" | "ocr" | "search";

export type WizardCustomerDraft = {
  registrationMethod: CustomerRegistrationMethod; // selected entry method (new/ocr/search) — lossless
  sourceMode: "existing" | "new" | null; // persistence mode; kept coherent with registrationMethod
  customerId: string | null;             // existing-customer id (null until selected; never faked)
  /** Approved Screen-1 new-customer input shape, reused 1:1 (business fields live inside). */
  newCustomer: NewCustomerDraft;
};

// ── Vehicle (Screen 2) ──────────────────────────────────────────────────────────
export type WizardVehicleDraft = {
  sourceMode: "existing" | "new" | null; // ↔ Screen2 vehicleMode
  vehicleId: string | null;              // existing-vehicle id (null until selected)
  /** Approved Screen-2 new-vehicle input shape, reused 1:1 (user input preserved exactly). */
  newVehicle: NewVehicleDraft;
  bodySizeKey: string;                   // 3M body-size selection (sizeKey); "" = not selected
};

// ── Service selection (Screen 3) ────────────────────────────────────────────────
export type WizardServiceCategory = ServiceCategoryId; // coating|ppf|window|maintenance|carwash|roomclean|other

export type WizardServiceSelectionDraft = {
  selectedCategories: WizardServiceCategory[];
};

// ── Service configuration (Screen 4) — mirrors the implemented Screen-4 state ─────
export type WizardCoatingDraft = {
  layerCount: LayerCount | null;
  layer1Id: string | null;
  layer2Id: string | null;
  layer3Id: string | null;
};
export type PpfFullCoverage = "front_full" | "full_body";
export type WizardPpfDraft = {
  installationMethod: PpfInstallationMethodId | null;
  fullCoverage: PpfFullCoverage | null;  // required only when installationMethod === "full"
  selectedPartIds: string[];
  quantitiesByPart: Record<string, number>;
  ppfTypeId: string | null;
  unitPriceInput: string;                // editable unit-price text (string preserves live input)
  vehicleCoefficientInput: string;       // multiplier text; canonical default "1.0"
  interiorRows: InteriorPpfRow[];
};
export type WizardWindowFilmDraft = {
  selectedAreaIds: string[];
  filmTypeId: string | null;
  unitPriceInput: string;
  selectedPackageCode?: string | null;
  selectedOptionIds?: string[];
  optionQuantities?: Record<string, number>;
};
export type WizardBodyMaintenanceDraft = {
  menuId: string | null;
  unitPriceInput: string;
};
export type WizardCarWashDraft = {
  menuId: string | null;
  unitPriceInput: string;
};
export type WizardRoomCleaningDraft = {
  selectedMenuIds: string[];
  unitPricesByMenu: Record<string, string>;
};
export type WizardOtherWorkDraft = {
  selectedPresetIds: string[];
  unitPricesByItem: Record<string, string>;
  quantitiesByItem: Record<string, number>;
  customRows: OtherWorkCustomRow[];
};
export type WizardStoreGlobalOptionsDraft = {
  selectedOptionIds: string[];           // cross-category (NOT a Screen-3 category)
  unitPricesByOption: Record<string, string>;
  quantitiesByOption: Record<string, number>;
};

export type WizardServiceConfigurationDraft = {
  coating: WizardCoatingDraft;
  ppf: WizardPpfDraft;
  windowFilm: WizardWindowFilmDraft;
  bodyMaintenance: WizardBodyMaintenanceDraft;
  carWash: WizardCarWashDraft;
  roomCleaning: WizardRoomCleaningDraft;
  otherWork: WizardOtherWorkDraft;
  storeGlobalOptions: WizardStoreGlobalOptionsDraft;
};

// ── Discount / coupon (Screen 5) — records selections ONLY (no calculation) ──────
export type WizardDiscountDraft = {
  mode: DiscountMode;                    // canonical "none"|"amount"|"percent". "amount" ≈ recommended "fixed".
  percentInput: string;                  // string preserves live input
  amountInput: string;
  selectedCouponIds: string[];           // multi-select (Screen 5 implements multiple coupons)
  adjustmentReason: string;              // reserved for future operator note (no UI input yet) — always ""
};

// ── Notes (Screen 6) — strictly separated fields ─────────────────────────────────
export type WizardNotesDraft = {
  customerNotes: string; // may appear on customer output later
  internalMemo:  string; // staff-only — NEVER customer-facing
};

// ── Review (Screen 7) — preview-only (NOT save / submission / approval status) ────
export type WizardReviewDraft = {
  previewConfirmed: boolean;
};

// ── Metadata (in-memory only) ────────────────────────────────────────────────────
export type WizardDraftMetadata = {
  schemaVersion: "2.2";
  currentStep: number;                   // 1..7
  lastUpdatedAt: string | null;          // in-memory only; never persisted / never a DB timestamp
  source: "estimate-wizard-v2.2";
};

// ── Root canonical draft ─────────────────────────────────────────────────────────
export type EstimateWizardDraftV22 = {
  version: "2.2";
  customer: WizardCustomerDraft;
  vehicle: WizardVehicleDraft;
  serviceSelection: WizardServiceSelectionDraft;
  serviceConfiguration: WizardServiceConfigurationDraft;
  discountAndCoupon: WizardDiscountDraft;
  notes: WizardNotesDraft;
  review: WizardReviewDraft;
  metadata: WizardDraftMetadata;
};

// ── Validation metadata (non-blocking; structural completeness only) ─────────────
export type WizardValidationIssue = {
  field: string;
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};
export type WizardValidationState = {
  issues: WizardValidationIssue[];
  isCompleteForPreview: boolean;
};
