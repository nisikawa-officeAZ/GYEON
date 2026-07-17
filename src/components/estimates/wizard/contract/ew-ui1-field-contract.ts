// EW-FC-1A — EW-UI-1 lossless field-contract registry (typed, immutable).
//
// A DATA-ONLY declaration (no logic, no arithmetic, no DB) that records, for every current
// EW-UI-1 editable field, its canonical (EstimateWizardDraftV22 / NewCustomerDraft /
// NewVehicleDraft) destination, its save-DTO field, and its DB column — plus explicit status
// markers for fields that are not yet (or never) bound. This is the contract the future
// controller/adapter phase must satisfy; it changes no runtime behaviour on its own.

export type FieldStatus =
  | "LOSSLESS"                          // editable value has a faithful canonical + DTO home
  | "REMOVED_DUPLICATE_AUTHORITY"       // removed from the client store (server-authoritative)
  | "DISPLAY_ONLY_UNTIL_TYPED_CONTRACT" // loose/presentational; must not be bound yet
  | "CONTROLLER_PHASE"                  // resolved by the later controller/adapter phase
  | "UNRESOLVED_CANONICAL_CONTRACT";    // canonical domain contract not yet defined (blocked)

export interface FieldContractEntry {
  /** WizardStore path (or canonical-only path for fields not in the store). */
  readonly ewUiField: string;
  /** Canonical EstimateWizardDraftV22 path, or null when no canonical home exists yet. */
  readonly canonical: string | null;
  /** Save-DTO field (EstimateSaveCustomer/EstimateSaveVehicle/...), or null. */
  readonly dto: string | null;
  /** Database column, or null when not persisted (yet). */
  readonly db: string | null;
  readonly status: FieldStatus;
  readonly note?: string;
}

// ── Customer (Screen 1) ──────────────────────────────────────────────────────────
export const CUSTOMER_FIELD_CONTRACT: readonly FieldContractEntry[] = [
  { ewUiField: "customer.regMethod",     canonical: "customer.sourceMode",             dto: "customer.mode",                      db: null,                       status: "LOSSLESS", note: "new/ocr/search → existing/new; OCR is a method, not a mode" },
  { ewUiField: "customer.name",          canonical: "customer.newCustomer.name",       dto: "customer.name",                      db: "customers.name",           status: "LOSSLESS" },
  { ewUiField: "customer.kana",          canonical: "customer.newCustomer.kana",       dto: "customer.kana",                      db: "customers.last_name_kana", status: "LOSSLESS", note: "ONE whole string → NewCustomerDraft.kana → DTO kana → future forward-migration persistence (last_name_kana; first_name_kana=null). NEVER split." },
  { ewUiField: "customer.email",         canonical: "customer.newCustomer.email",      dto: "customer.email",                     db: "customers.email",          status: "LOSSLESS" },
  { ewUiField: "customer.postal",        canonical: "customer.newCustomer.postal",     dto: "customer.postalCode",                db: "customers.postal_code",    status: "LOSSLESS" },
  { ewUiField: "customer.address",       canonical: "customer.newCustomer.address",    dto: "customer.address",                   db: "customers.address",        status: "LOSSLESS" },
  { ewUiField: "customer.phone",         canonical: "customer.newCustomer.phone",      dto: "customer.phone",                     db: "customers.phone",          status: "LOSSLESS" },
  { ewUiField: "customer.lineId",        canonical: "customer.newCustomer.lineId",     dto: "customer.lineId",                    db: "customers.line_user_id",   status: "LOSSLESS" },
  { ewUiField: "customer.existingId",    canonical: "customer.customerId",             dto: "customer.customerId",                db: "estimates.customer_id",    status: "LOSSLESS" },
  { ewUiField: "customer.contractor",    canonical: "customer.newCustomer.isBusiness", dto: "customer.isBusiness",                db: "customers.is_business",    status: "LOSSLESS" },
  { ewUiField: "customer.contractorRate",canonical: "customer.newCustomer.tradeRate",  dto: "customer.tradeRatePercent",          db: "customers.trade_discount_pct", status: "LOSSLESS" },
  { ewUiField: "customer.creditSale",    canonical: "customer.newCustomer.arAllowed",  dto: "customer.accountsReceivableAllowed", db: "customers.accounts_receivable_allowed", status: "LOSSLESS" },
  { ewUiField: "customer.creditClosing", canonical: "customer.newCustomer.closingDay", dto: "customer.closingDay",                db: "customers.closing_day",    status: "LOSSLESS", note: "numeric day-of-month" },
  { ewUiField: "customer.paymentDay",    canonical: "customer.newCustomer.paymentDay", dto: "customer.paymentDay",                db: "customers.payment_day",    status: "LOSSLESS", note: "numeric day-of-month — distinct from free-text creditTerms" },
  { ewUiField: "customer.creditTerms",   canonical: "customer.newCustomer.creditTerms",dto: "customer.creditTerms",               db: "customers.credit_terms",   status: "LOSSLESS", note: "FREE TEXT (支払条件) → future customers.credit_terms persistence; distinct from closingDay/paymentDay" },
];

// ── Vehicle (Screen 2) ───────────────────────────────────────────────────────────
export const VEHICLE_FIELD_CONTRACT: readonly FieldContractEntry[] = [
  { ewUiField: "vehicle.maker",             canonical: "vehicle.newVehicle.maker",                         dto: "vehicle.maker",             db: "vehicles.maker",                         status: "LOSSLESS" },
  { ewUiField: "vehicle.model",             canonical: "vehicle.newVehicle.model",                         dto: "vehicle.model",             db: "vehicles.model",                         status: "LOSSLESS" },
  { ewUiField: "vehicle.grade",             canonical: "vehicle.newVehicle.grade",                         dto: "vehicle.grade",             db: "vehicles.grade",                         status: "LOSSLESS" },
  { ewUiField: "vehicle.vehicleCode",       canonical: "vehicle.newVehicle.vehicle_code",                  dto: "vehicle.vehicleCode",       db: "vehicles.vehicle_code",                  status: "LOSSLESS" },
  { ewUiField: "vehicle.displacement",      canonical: "vehicle.newVehicle.displacement",                  dto: "vehicle.displacement",      db: "vehicles.displacement",                  status: "LOSSLESS" },
  { ewUiField: "vehicle.vin",               canonical: "vehicle.newVehicle.vin",                           dto: "vehicle.vin",               db: "vehicles.vin",                           status: "LOSSLESS" },
  { ewUiField: "vehicle.firstRegYearMonth", canonical: "vehicle.newVehicle.first_registration_year_month",dto: "vehicle.firstRegistration", db: "vehicles.first_registration_year_month", status: "LOSSLESS" },
  { ewUiField: "vehicle.registrationDate",  canonical: "vehicle.newVehicle.registration_date",             dto: "vehicle.registrationDate",  db: "vehicles.registration_date",             status: "LOSSLESS" },
  { ewUiField: "vehicle.color",             canonical: "vehicle.newVehicle.color",                         dto: "vehicle.color",             db: "vehicles.color",                         status: "LOSSLESS" },
  { ewUiField: "vehicle.inspectionExpiry",  canonical: "vehicle.newVehicle.inspection_expiry_date",        dto: "vehicle.inspectionExpiry",  db: "vehicles.inspection_expiry_date",        status: "LOSSLESS" },
  { ewUiField: "vehicle.plateNumber",       canonical: "vehicle.newVehicle.plate_number",                  dto: "vehicle.plateNumber",       db: "vehicles.plate_number",                  status: "LOSSLESS" },
  { ewUiField: "vehicle.existingId",        canonical: "vehicle.vehicleId",                                dto: "vehicle.vehicleId",         db: "estimates.vehicle_id",                   status: "LOSSLESS" },
  { ewUiField: "vehicle.confirmedSize",     canonical: "vehicle.bodySizeKey",                              dto: "vehicle.bodySizeKey",       db: "vehicles.body_size",                     status: "LOSSLESS" },
  { ewUiField: "vehicle.suggestedSize",     canonical: null,                                               dto: null,                        db: null,                                     status: "DISPLAY_ONLY_UNTIL_TYPED_CONTRACT", note: "3M recommendation highlight only; never persisted/auto-fixed" },
];

// ── Not-yet-bound / deferred / removed (explicit — nothing silently dropped) ───────
export const DEFERRED_FIELD_CONTRACT: readonly FieldContractEntry[] = [
  { ewUiField: "categories",              canonical: "serviceSelection.selectedCategories", dto: "services[].category", db: null, status: "CONTROLLER_PHASE", note: "string[] → ServiceCategoryId[] via adapter (controller phase)" },
  { ewUiField: "services",                canonical: null, dto: null, db: null, status: "DISPLAY_ONLY_UNTIL_TYPED_CONTRACT", note: "loose Record<string,unknown>; MUST NOT map into canonical serviceConfiguration until a typed Screen-4 contract exists" },
  { ewUiField: "coupons",                 canonical: "discountAndCoupon.selectedCouponIds", dto: "coupon.selectedCouponIds", db: null, status: "CONTROLLER_PHASE", note: "carried as intent; blocked from pricing/persistence by existing gates" },
  { ewUiField: "discountMode",            canonical: null, dto: "discount.intent.mode", db: null, status: "UNRESOLVED_CANONICAL_CONTRACT", note: "EW-UI 'none' has NO canonical DiscountMode state (amount|percent only). NOT resolved and NOT persisted here — a separate bounded canonical-domain phase must add/deal-with 'none' without touching the frozen shared union." },
  { ewUiField: "discountAmount",          canonical: "discountAndCoupon.amountInput", dto: "discount.intent.fixedAmount", db: null, status: "CONTROLLER_PHASE" },
  { ewUiField: "discountPercent",         canonical: "discountAndCoupon.percentInput", dto: "discount.intent.percentage", db: null, status: "CONTROLLER_PHASE", note: "percentage blocked from pricing/persistence by existing gates" },
  { ewUiField: "notesCustomer",           canonical: "notes.customerNotes", dto: "notes.customerNotes", db: "estimates.customer_notes", status: "CONTROLLER_PHASE" },
  { ewUiField: "notesInternal",           canonical: "notes.internalMemo", dto: "notes.internalMemo", db: "estimates.internal_memo", status: "CONTROLLER_PHASE", note: "staff-only; never customer-facing" },
  { ewUiField: "review.previewConfirmed", canonical: "review.previewConfirmed", dto: null, db: null, status: "CONTROLLER_PHASE", note: "preview-only boolean; wired via updateReview in the controller phase" },
  { ewUiField: "dealerRank",              canonical: null, dto: null, db: null, status: "REMOVED_DUPLICATE_AUTHORITY", note: "removed from WizardStore in EW-FC-1A; authoritative rank is a future trusted-host input" },
];

export const EW_UI1_FIELD_CONTRACT: readonly FieldContractEntry[] = [
  ...CUSTOMER_FIELD_CONTRACT,
  ...VEHICLE_FIELD_CONTRACT,
  ...DEFERRED_FIELD_CONTRACT,
];

export function fieldContractFor(ewUiField: string): FieldContractEntry | undefined {
  return EW_UI1_FIELD_CONTRACT.find((e) => e.ewUiField === ewUiField);
}
