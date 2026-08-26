// Estimate Wizard Ver2.2 — Step1/Step2 presentation prop contracts (Phase 2).
//
// These interfaces mirror EstimateEditor's EXISTING customer/vehicle state and handlers
// 1:1. The screen components hold NO business state of their own — everything is a prop
// supplied by the owner (EstimateEditor remains the single state owner). No new backend.

import type { CustomerDB } from "@/lib/customers/customer-types";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import type { BodySizeEstimate } from "@/lib/vehicles/body-size-estimate";
import type { PpfFullCoverage } from "../draft/wizard-draft-types";

/** Mirrors EstimateEditor `nc` (new-customer draft) exactly. */
export interface NewCustomerDraft {
  name:       string;
  phone:      string;
  email:      string;
  postal:     string;
  address:    string;
  lineId:     string;
  isBusiness: boolean; // 業者
  tradeRate:  string;  // 掛け率(%)
  arAllowed:  boolean; // 掛売り (売掛 / AR)
  closingDay: string;  // 締め日 (numeric day-of-month string)
  paymentDay: string;  // 支払日 (numeric day-of-month string — distinct from free-text creditTerms)
  // EW-FC-1A lossless field-contract additions (optional; existing fixtures unaffected):
  kana?:        string; // フリガナ — ONE whole string (never split into last/first kana)
  creditTerms?: string; // 支払条件 — FREE TEXT (e.g. "翌月末払い"); distinct from numeric closingDay/paymentDay
}

/** Mirrors EstimateEditor `nv` (new-vehicle draft) exactly. */
export interface NewVehicleDraft {
  maker:                       string;
  model:                       string; // 車名 (manual only)
  grade:                       string;
  vehicle_code:                string; // 型式
  vin:                         string; // 車体番号
  first_registration_year_month: string; // 初年度登録年月
  registration_date:           string; // 登録年月日
  inspection_expiry_date:      string; // 車検満了年月日
  displacement:                string; // 排気量
  color:                       string; // ボディカラー
  plate_number:                string; // ナンバープレート
}

export type CustomerMode = "select" | "new";
export type VehicleMode  = "select" | "new";

export interface Step1CustomerProps {
  // registration method ↔ existing customerMode ("new"=手入力 / "select"=既存検索) + OCR
  customerMode:       CustomerMode;
  onSetCustomerMode:  (m: CustomerMode) => void;
  onOpenOcr:          () => void; // opens the EXISTING OCR pipeline (no OCR logic change)
  // existing-customer selection
  customerId:         string;
  onSelectCustomer:   (id: string) => void;
  customers:          CustomerDB[];
  // new-customer draft (existing `nc` state)
  nc:                 NewCustomerDraft;
  onChangeNc:         (patch: Partial<NewCustomerDraft>) => void;
  onCreateCustomer:   () => void;   // existing handleCreateCustomer
  creatingCustomer:   boolean;
  // presentation gating only (店舗設定の LINE Business 有無)
  lineBusinessConfigured?: boolean;
}

export interface Step3CategoryProps {
  /** Selected service-category ids (wizard/presentation selection — controls which
   *  sections appear on Screen4). Owner-held; the component holds no state of its own. */
  selected: string[];
  onToggle: (id: string) => void;
}

// ── Screen 4 (Phase 4A: shared structure + Coating) ─────────────────────────────
export type ShopRank = "shop" | "detailer" | "certified" | "ppf_installer";
export type LayerCount = 1 | 2 | 3;

/** A selectable coating product (presentation option; no price). */
export interface CoatingProductOption {
  id:              string;
  label:           string;
  disabled?:       boolean;
  disabledReason?: string;
}

/** Reusable Screen4 container contract. Shows ONLY the categories selected on Screen3. */
export interface Step4EstimateProps {
  selectedCategories: string[];               // from Screen3 (only these appear)
  activeSection:      string;                 // currently open service section id
  onSelectSection:    (id: string) => void;   // service-section navigation callback
  completed?:         ReadonlySet<string>;    // completed-state indicators
  disabledSections?:  ReadonlySet<string>;    // disabled-state indicators (e.g. rank lock)
  children:           import("react").ReactNode; // active section content (owner-rendered)
  /** Store Global Options (追加サービスオプション) — cross-category, shown below the active
   *  section content. Optional additive slot (Phase 4H); omit to preserve prior behavior. */
  globalOptionsSlot?: import("react").ReactNode;
  /** PPF + Coating supplied-adjustment DISPLAY (Phase 4I). Parent-supplied text/result only —
   *  the container never calculates the reduction, never alters prices, and never modifies the
   *  Coating/PPF components. Rendered as clearly-labelled parent-supplied display data. */
  adjustmentNotice?:  import("react").ReactNode;
}

/** Coating section contract — fully prop-driven; computes no prices, creates no items. */
export interface CoatingSelectorProps {
  shopRank:                ShopRank;
  /** When the rank cannot perform coating (e.g. ppf_installer), the whole section is locked. */
  coatingLocked?:          boolean;
  lockReason?:             string;
  // current selection (existing estimates preload these)
  selectedLayerCount:      LayerCount | null;
  selectedLayer1ProductId: string | null;
  selectedLayer2ProductId: string | null;
  selectedLayer3ProductId: string | null;
  // available products (owner-derived from the approved matrix / rank)
  availableLayer1Products: CoatingProductOption[];
  availableLayer2Products: CoatingProductOption[];
  availableLayer3Products: CoatingProductOption[];
  // callbacks (owner uses existing estimate logic — no pricing here)
  onLayerCountChange:      (n: LayerCount) => void;
  onLayer1Change:          (id: string) => void;
  onLayer2Change:          (id: string) => void;
  onLayer3Change:          (id: string) => void;
  onAddOrUpdate:           () => void;
}

// ── Screen 4 (Phase 4B: PPF) ────────────────────────────────────────────────────
// Five installation methods (Ver2.2 — panoramic roof removed).
export type PpfInstallationMethodId = "full" | "partial" | "windshield" | "sunroof" | "interior";

export interface InstallationMethodOption {
  id:              PpfInstallationMethodId;
  label:           string;
  subLabel?:       string;
  disabled?:       boolean;
  disabledReason?: string;
}

/** A partial-install PPF part (store-configurable). Carries quantity rules; NO price logic. */
export interface PpfPartOption {
  id:              string;
  label:           string;
  quantityRequired?: boolean; // some parts need a quantity, some do not
  minQty?:         number;
  maxQty?:         number;
  disabled?:       boolean;
  disabledReason?: string;
}

/** A PPF product/type (store-configurable, supports non-GYEON/custom). NO price logic. */
export interface PpfTypeOption {
  id:                 string;
  label:              string;
  brand?:             string;   // e.g. GYEON / custom brand
  coefficientDisplay?: string;  // display-only text (component never applies it)
  disabled?:          boolean;
  disabledReason?:    string;
}

/** A visual grouping of PPF products (Gloss / Matte / Color / custom). */
export interface PpfTypeGroup {
  id:       string;
  label:    string;
  products: PpfTypeOption[];
}

/** A free-entry interior-PPF row (location + amount). Amount is a raw string (no calc). */
export interface InteriorPpfRow {
  id:       string;
  location: string;
  amount:   string;
}

/** PPF section contract — fully prop-driven. Computes no price, applies no coefficient,
 *  creates no estimate items, touches no DB/inventory/Server Actions. */
export interface PpfSelectorProps {
  shopRank:                  ShopRank;
  ppfLocked?:                boolean; // e.g. GYEONショップ = PPF不可 (owner-supplied)
  lockReason?:               string;

  // installation method
  selectedInstallationMethod: PpfInstallationMethodId | null;
  installationMethods:        InstallationMethodOption[];
  onInstallationMethodChange: (id: PpfInstallationMethodId) => void;
  selectedFullCoverage?:       PpfFullCoverage | null;
  onFullCoverageChange?:       (coverage: PpfFullCoverage) => void;

  // partial parts + quantity
  selectedPartialPartIds:  string[];
  partialParts:            PpfPartOption[];
  quantitiesByPart:        Record<string, number>;
  onPartialPartToggle:     (id: string) => void;
  onQuantityChange:        (id: string, qty: number) => void;

  // PPF type
  selectedPpfTypeId:       string | null;
  ppfTypes:                PpfTypeGroup[];
  onPpfTypeChange:         (id: string) => void;

  // interior PPF free rows
  interiorRows:            InteriorPpfRow[];
  onInteriorRowAdd:        () => void;
  onInteriorRowUpdate:     (id: string, patch: Partial<InteriorPpfRow>) => void;
  onInteriorRowDelete:     (id: string) => void;

  // pricing DISPLAY ONLY (owner-supplied; component never calculates)
  displayedUnitPrice?:     number | null; // default/displayed unit price
  editableUnitPrice?:      string;        // operator-editable unit price value
  onUnitPriceChange?:      (v: string) => void;
  vehicleCoefficientInput?: string;
  onVehicleCoefficientChange?: (v: string) => void;
  coefficientDisplay?:     string | null; // display-only
  combinedServiceAdjustment?: string | null; // PPF+coating message/result (display only)

  onAddOrUpdate:           () => void;
}

// ── Screen 4 (Phase 4C: Window Film) ────────────────────────────────────────────
/** A window installation area (store-configurable). No price logic. */
export interface WindowAreaOption {
  id:              string;
  label:           string;
  disabled?:       boolean;
  disabledReason?: string;
}

/** A window film product/type (store-configurable, supports custom brands). No price logic. */
export interface FilmTypeOption {
  id:               string;
  label:            string;
  brand?:           string; // supports non-GYEON / custom brands
  vlt?:             string; // Visible Light Transmission (display text, e.g. "15%")
  heatRejection?:   string; // 遮熱 (display text)
  color?:           string; // 色 (display text)
  irCutPercent?:    number; // IR cut specification, 0..100
  uvCutPercent?:    number; // UV cut specification, 0..100
  installationCoefficientBp?: number; // authoritative basis points; parent uses it for suggested price
  defaultUnitPrice?: number; // display default only (component never calculates)
  disabled?:        boolean;
  disabledReason?:  string;
}

export interface WindowFilmConfiguredItem {
  id: string;
  label: string;
  priceYen: number;
  durationMinutes: number;
}

/** Window Film section contract — fully prop-driven; no price calc, no estimate items. */
export interface WindowFilmSelectorProps {
  shopRank:            ShopRank;
  windowLocked?:       boolean; // e.g. GYEONショップ = フィルム不可 (owner-supplied)
  lockReason?:         string;
  // installation areas (multiple)
  areas:               WindowAreaOption[];
  selectedAreaIds:     string[];
  onAreaToggle:        (id: string) => void;
  // film type
  filmTypes:           FilmTypeOption[];
  selectedFilmTypeId:  string | null;
  onFilmTypeChange:    (id: string) => void;
  packages?:           WindowFilmConfiguredItem[];
  selectedPackageCode?: string | null;
  onPackageChange?:    (code: string | null) => void;
  options?:            WindowFilmConfiguredItem[];
  selectedOptionIds?:  string[];
  optionQuantities?:   Record<string, number>;
  onOptionToggle?:     (code: string) => void;
  onOptionQuantityChange?: (code: string, quantity: number) => void;
  // pricing DISPLAY ONLY (owner-supplied)
  displayedUnitPrice?: number | null;
  editableUnitPrice?:  string; // blank means use the displayed calculated suggestion
  onUnitPriceChange?:  (v: string) => void;
  onAddOrUpdate:       () => void;
}

// ── Screen 4 (Phase 4D: Body Regular Maintenance) ───────────────────────────────
/** A store-configured maintenance menu. `estimatedDurationMinutes` is kept in the data
 *  contract for future reservation/calendar workload calculation but is NEVER shown on
 *  the Estimate UI (Architect #3). No price logic. */
export interface MaintenanceMenu {
  id:                        string;
  name:                      string;
  description?:              string;
  defaultPrice:             number;
  estimatedDurationMinutes?: number; // internal only — do NOT display on Estimate UI
  displayOrder?:            number;
  disabled?:                boolean;  // enabled/disabled state
  disabledReason?:          string;
  badge?:                   string;   // optional badge / recommendation text
}

/** Body Regular Maintenance section contract — fully prop-driven; no price calc,
 *  no estimate items, no calendar/reminder/history access. */
export interface BodyMaintenanceSelectorProps {
  maintenanceMenus:          MaintenanceMenu[];
  selectedMaintenanceMenuId: string | null;
  onMaintenanceMenuChange:   (id: string) => void;
  // pricing DISPLAY ONLY (owner-supplied for the selected menu)
  displayedUnitPrice?:       number | null;
  editablePriceAllowed?:     boolean;
  editableUnitPrice?:        string;
  onUnitPriceChange?:        (v: string) => void;
  // supplied informational text only (no history/eligibility logic in this component)
  informationalMessage?:     string | null;
  onAddOrUpdate:             () => void;
}

// ── Screen 4 (Phase 4E: Car Wash) ───────────────────────────────────────────────
/** A store-configured car-wash menu. `estimatedDurationMinutes` is retained in the data
 *  contract for future reservation workload calculation but is NEVER shown on the Estimate
 *  UI. No price logic. */
export interface WashMenu {
  id:                        string;
  name:                      string;
  description?:              string;
  defaultPrice:             number;
  estimatedDurationMinutes?: number; // internal only — do NOT display on Estimate UI
  displayOrder?:            number;
  disabled?:                boolean;
  disabledReason?:          string;
  badge?:                   string;
}

/** Car Wash section contract — fully prop-driven; no price calc, no estimate items. */
export interface CarWashSelectorProps {
  washMenus:            WashMenu[];
  selectedWashMenuId:   string | null;
  onWashMenuChange:     (id: string) => void;
  displayedUnitPrice?:  number | null;
  editablePriceAllowed?: boolean;
  editableUnitPrice?:   string;
  onUnitPriceChange?:   (v: string) => void;
  informationalMessage?: string | null;
  onAddOrUpdate:        () => void;
}

// ── Screen 4 (Phase 4F: Room Cleaning) ──────────────────────────────────────────
/** A store-configured room-cleaning menu. `estimatedDurationMinutes` is retained in the
 *  data contract for future reservation/calendar workload calculation but is NEVER shown
 *  on the Estimate UI. No price logic. */
export interface RoomMenu {
  id:                        string;
  name:                      string;
  description?:              string;
  defaultPrice:             number;
  estimatedDurationMinutes?: number; // internal only — do NOT display on Estimate UI
  displayOrder?:            number;
  disabled?:                boolean;
  disabledReason?:          string;
  badge?:                   string;
  recommendedText?:         string; // optional recommended text
}

/** Room Cleaning section contract — MULTIPLE selection; fully prop-driven; no price calc,
 *  no estimate items. Editable unit price is per-selected-menu (id → value). */
export interface RoomCleaningSelectorProps {
  roomMenus:            RoomMenu[];
  selectedRoomMenuIds:  string[];
  onRoomMenuToggle:     (id: string) => void;
  editablePriceAllowed?: boolean;
  editableUnitPrices?:  Record<string, string>; // per-menu unit-price override (id → value)
  onUnitPriceChange?:   (id: string, v: string) => void;
  informationalMessage?: string | null;
  onAddOrUpdate:        () => void;
}

// ── Screen 4 (Phase 4G: Other Work) ─────────────────────────────────────────────
/** A store-configured preset "other work" item. `estimatedDurationMinutes` is internal
 *  (future calendar/workload) and is NEVER shown on the Estimate UI. No price logic. */
export interface OtherWorkPresetItem {
  id:                        string;
  name:                      string;
  description?:              string;
  defaultPrice:             number;
  estimatedDurationMinutes?: number; // internal only — do NOT display on Estimate UI
  displayOrder?:            number;
  disabled?:                boolean;
  disabledReason?:          string;
  editableUnitPrice?:       boolean;
  quantityRequired?:        boolean;
  minQty?:                  number;
  maxQty?:                  number;
  unitLabel?:               string;  // e.g. 個 / 枚 / 時間
  badge?:                   string;
}

/** A fully manual custom row (no Store Settings registration required). Values are raw
 *  strings the owner interprets later; the component performs no calculation. */
export interface OtherWorkCustomRow {
  id:          string;
  name:        string;
  description: string;
  unitPrice:   string;
  quantity:    string;
  unitLabel:   string;
}

/** Other Work section contract — presets (multi-select) + manual rows. Fully prop-driven;
 *  no totals calc, no estimate items, no DB/inventory/calendar access. */
export interface OtherWorkSelectorProps {
  // preset items
  presetOtherWorkItems: OtherWorkPresetItem[];
  selectedPresetItemIds: string[];
  onPresetItemToggle:   (id: string) => void;
  unitPricesByItem:     Record<string, string>; // editable unit price per preset item
  onUnitPriceChange:    (id: string, v: string) => void;
  quantitiesByItem:     Record<string, number>; // quantity per preset item
  onQuantityChange:     (id: string, qty: number) => void;
  // manual custom rows
  customRows:           OtherWorkCustomRow[];
  onCustomRowAdd:       () => void;
  onCustomRowUpdate:    (id: string, patch: Partial<OtherWorkCustomRow>) => void;
  onCustomRowDelete:    (id: string) => void;
  // misc
  informationalMessage?: string | null;
  onAddOrUpdate:        () => void;
}

// ── Screen 4 (Phase 4H: Store Global Options / 追加サービスオプション) ────────────
/** A store-configured global option (追加サービスオプション). These are NOT tied to a single
 *  category — a store defines which service categories each option applies to (or all). They
 *  may be used with multiple categories (e.g. 鉄粉除去 for Coating or PPF). Applicability rules
 *  arrive through data (`applicableCategoryIds` / `appliesToAllCategories`), never hardcoded.
 *  `estimatedDurationMinutes` is internal (future calendar/workload) and NEVER shown on the
 *  Estimate UI. No price logic. */
export interface StoreGlobalOption {
  id:                        string;
  name:                      string;
  description?:              string;
  defaultPrice:             number;
  editableUnitPrice?:       boolean;
  quantityRequired?:        boolean;
  minQty?:                  number;
  maxQty?:                  number;
  unitLabel?:               string;  // e.g. 個 / 枚 / 箇所
  estimatedDurationMinutes?: number; // internal only — do NOT display on Estimate UI
  applicableCategoryIds?:   string[]; // service-category ids this option applies to
  appliesToAllCategories?:  boolean;  // when true, applies to every category
  displayOrder?:            number;
  enabled?:                 boolean;  // store enable/disable (undefined = enabled)
  disabledReason?:          string;
  badge?:                   string;
}

/** Store Global Options section contract — MULTIPLE selection; fully prop-driven. Computes no
 *  totals/discounts/coupons, creates no estimate items, mutates no EstimateEditor state, calls
 *  no Server Actions, and touches no DB/inventory/calendar. Applicability filtering is done
 *  from the supplied `selectedCategoryIds` + each option's rule (nothing hardcoded). */
export interface StoreGlobalOptionsSelectorProps {
  globalOptions:            StoreGlobalOption[];
  selectedCategoryIds:      string[];              // selected Screen3 categories (applicability)
  selectedGlobalOptionIds:  string[];              // current selection (existing estimates preload)
  unitPricesByOption:       Record<string, string>; // editable unit price per option (id → value)
  quantitiesByOption:       Record<string, number>; // quantity per option (id → value)
  // additional disabled-state supplied independently of each option's own `enabled` flag
  disabledOptionIds?:       string[];
  disabledReasonByOption?:  Record<string, string>;
  informationalMessage?:    string | null;
  onGlobalOptionToggle:     (id: string) => void;
  onUnitPriceChange:        (id: string, v: string) => void;
  onQuantityChange:         (id: string, qty: number) => void;
  onAddOrUpdate:            () => void;
}

// ── Screen 5 (Phase 5: Discount / Coupon — 値引き・クーポン選択) ──────────────────
/** Canonical discount mode — the SINGLE authority shared by EW-UI-1 and EstimateWizardDraftV22.
 *  Exactly ONE may be active. `none` = 値引きなし (no discount); `amount`/`percent` are never
 *  applied simultaneously. Switching mode preserves the other modes' inactive input values; only
 *  the active mode's value participates in pricing (later, via the EW-DC-1 engine when wired). */
export type DiscountMode = "none" | "amount" | "percent";

/** A selectable coupon (presentation-only). `discountType`/`discountValue` are DISPLAY data —
 *  the component never applies them. Combinability / conflict is decided by the parent and
 *  surfaced via disabled state + reason; the component contains NO combination logic. */
export interface CouponOption {
  id:              string;
  name:            string;
  description?:    string;
  discountType:    "amount" | "percent"; // display only
  discountValue:   number;               // display only (yen or %)
  validityText?:   string;               // e.g. 有効期限 / 条件 (display only)
  enabled?:        boolean;              // store/master enable (undefined = enabled)
  disabledReason?: string;
  combinable?:     boolean;              // display hint only; conflict comes via disabled props
  displayOrder?:   number;
  badge?:          string;
}

/** Screen5 (Discount / Coupon) section contract — fully prop-driven. Computes NO estimate
 *  totals/tax, applies no discount to prices, mutates no EstimateEditor state, calls no Server
 *  Actions, touches no DB / coupon master / customer data. The parent merges the converted yen
 *  amount into its existing discountAmount flow; this component only collects input + selection.
 *  Dealer-rate / credit-sales rules arrive ONLY as informational text / disabled state. */
export interface Step5DiscountProps {
  // subtotal (display + validation bounds only — supplied by parent, never recalculated here)
  subtotal:                 number;
  // discount input state (owner-held; existing estimates preload the active mode + value)
  activeDiscountMode:       DiscountMode;
  discountAmountValue:      string;
  discountPercentValue:     string;
  convertedDiscountAmount?: number | null; // parent-supplied yen conversion for % mode (display)
  // safe bounds supplied through props (never hardcoded)
  maximumDiscountAmount?:   number | null;
  minimumDiscountPercent?:  number;
  maximumDiscountPercent?:  number;
  // coupons
  availableCoupons:         CouponOption[];
  selectedCouponIds:        string[];
  disabledCouponIds?:       string[];
  disabledReasonByCoupon?:  Record<string, string>;
  // parent-supplied messages (conflict / dealer-rate / max-discount — never invented here)
  informationalMessages?:   string[];
  discountValidationMessage?: string | null;
  // callbacks (owner uses existing discount/pricing flow — no calc here)
  onDiscountModeChange:     (m: DiscountMode) => void;
  onDiscountAmountChange:   (v: string) => void;
  onDiscountPercentChange:  (v: string) => void;
  onDiscountClear:          () => void;
  onCouponToggle:           (id: string) => void;
  onContinue:               () => void;
}

// ── Screen 6 (Phase 6: Notes and Internal Memo) ─────────────────────────────────
/** Screen6 presentation state. Two STRICTLY SEPARATED fields with explicit names — never
 *  merged into a single notes string. `internalMemo` is protected internal data and must never
 *  reach any customer-facing payload (PDF / invoice / LINE / email / preview / portal / API). */
export type Step6NotesState = {
  customerNotes: string; // may appear on customer-facing documents later
  internalMemo:  string; // staff-only — NEVER customer-facing
};

/** Recommended initial Screen6 state (presentation-only; no persistence). */
export const initialStep6NotesState: Step6NotesState = {
  customerNotes: "",
  internalMemo:  "",
};

/** A hardcoded quick-note template for customer-facing notes (presentation-only). No template
 *  master / tenant settings / DB / API — text is appended to `customerNotes` only. */
export interface QuickNoteTemplate {
  id:       string;
  category: string; // display grouping (e.g. 作業時間 / 注意事項 / 代車 …)
  label:    string; // button label
  text:     string; // appended to customerNotes (never internalMemo)
}

/** Screen6 (Notes and Guidance) section contract — fully prop-driven; owner holds the two
 *  explicit fields. The component performs NO persistence, no API/DB access, and never merges
 *  the two fields. Max lengths arrive via props (defaults 1000 / 2000). */
export interface Step6NotesProps {
  customerNotes:            string;
  internalMemo:             string;
  onCustomerNotesChange:    (v: string) => void;
  onInternalMemoChange:     (v: string) => void;
  customerNotesMaxLength?:  number; // default 1000
  internalMemoMaxLength?:   number; // default 2000
  templates?:               QuickNoteTemplate[]; // customer-facing quick templates
  onBack?:                  () => void;
  onContinue?:              () => void;
}

// ── Screen 7 (Phase 7: Final Review) ────────────────────────────────────────────
/** A read-only label/value pair for the review screen. `value` is a display-ready string the
 *  owner has already resolved (ids → labels); the review component never resolves or calculates. */
export interface ReviewField {
  label: string;
  value: string; // already display-ready ("未入力" / "未選択" etc. for empty)
}

/** A read-only summary line for one selected service (owner-resolved display strings only). */
export interface ReviewServiceLine {
  category: string;  // category label
  name:     string;  // service / menu name (or "未選択")
  detail?:  string;  // package / area / qty / options summary (display only)
  amount?:  string;  // user-entered amount (display only — NOT a calculated total)
}

/** Price summary DISPLAY data. Presentation-only: the review screen NEVER calculates. `mockRows`
 *  are values already present in the preview implementation, clearly marked as preview/mock. */
export interface ReviewPriceSummary {
  mockRows?: { label: string; value: string }[];
  note:      string; // e.g. "本計算（税・合計）はプレビューでは行いません"
}

/** Preview-only Screen7 confirmation state (never a production submission state). */
export type Step7ReviewState = {
  previewConfirmed: boolean;
};

/** Recommended initial Screen7 state. */
export const initialStep7ReviewState: Step7ReviewState = {
  previewConfirmed: false,
};

/** Screen7 (Final Review) contract — read-only aggregation of preview state. The component
 *  performs NO pricing/tax/discount/coupon calculation, NO save, NO API/DB/PDF/LINE, and never
 *  mutates EstimateEditor. `internalMemo` is kept as an explicit, isolated field — never merged
 *  with `customerNotes` and never passed into a customer-facing block. Edit callbacks use the
 *  existing wizard step controller (no browser navigation, no second state owner). */
export interface Step7ReviewProps {
  // compact header
  customerName:      string; // "未入力" when empty
  vehicleName:       string; // "未入力" when empty
  categoryCount:     number;
  // sections (owner-resolved display data)
  customerFields:    ReviewField[];
  vehicleFields:     ReviewField[];
  serviceLines:      ReviewServiceLine[];
  discountFields:    ReviewField[];
  couponSummaries:   string[];
  customerNotes:     string; // customer-facing (may appear on customer output later)
  internalMemo:      string; // staff-only — isolated, never customer-facing
  /** Phase 10D — read-only pricing result from the PRODUCTION engine (Screen 7 performs no math). */
  pricing:           import("../pricing/wizard-pricing-types").WizardPricingResult;
  // preview-only confirmation
  previewConfirmed:  boolean;
  onPreviewConfirm:  () => void;
  // edit navigation (existing wizard step controller)
  onEditCustomer:    () => void;
  onEditVehicle:     () => void;
  onEditServices:    () => void;
  onEditDiscount:    () => void;
  onEditNotes:       () => void;
  onBack:            () => void;
}

export interface Step2VehicleProps {
  vehicleMode:      VehicleMode;
  onSetVehicleMode: (m: VehicleMode) => void;
  onOpenOcr:        () => void; // EXISTING OCR pipeline
  vehicleId:        string;
  onSelectVehicle:  (id: string) => void;
  vehicles:         VehicleDB[]; // owner-filtered by customer
  nv:               NewVehicleDraft;
  onChangeNv:       (patch: Partial<NewVehicleDraft>) => void;
  // 3M body size — existing state/handler
  sizeKey:          string;                    // operator's confirmed selection
  onSelectSize:     (k: string) => void;       // sets sizeKey (final decision)
  sizeKeys:         string[];                  // catalog body-size keys (SS..XL)
  sizeEstimate:     BodySizeEstimate | null;   // 3M recommendation (highlight only)
  onEstimateSize:   () => void;                // existing estimateSize()
}
