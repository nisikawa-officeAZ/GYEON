// Unified Estimate Wizard — shared types (Phase 0/1).
//
// One state model for PC / Tablet / Smartphone. Presentation differs by
// breakpoint only; this store shape is breakpoint-agnostic. No pricing/OCR/save
// logic lives here — those are wired to the existing DealerOS modules in Phase 2.

// DiscountMode is the SINGLE canonical union owned by screens/step-types.ts. It is imported
// (for local use by WizardStore) and re-exported (no duplicate declaration) so EW-UI-1 and
// EstimateWizardDraftV22 share exactly one contract.
import type { DiscountMode } from "./screens/step-types";
export type { DiscountMode };

export type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WizardStep {
  id:    StepId;
  key:   string;
  label: string; // full label (desktop stepper)
  short: string; // compact label (tablet/mobile)
}

// Fixed order — must never be reordered (canonical spec §5).
export const WIZARD_STEPS: WizardStep[] = [
  { id: 1, key: "customer", label: "顧客登録",        short: "顧客" },
  { id: 2, key: "vehicle",  label: "車両登録",        short: "車両" },
  { id: 3, key: "category", label: "作業内容選択",    short: "作業" },
  { id: 4, key: "estimate", label: "見積",            short: "見積" },
  { id: 5, key: "discount", label: "値引き / クーポン", short: "値引" },
  { id: 6, key: "notes",    label: "備考",            short: "備考" },
  { id: 7, key: "review",   label: "確認",            short: "確認" },
];

// Screen1 default is New Customer (新規顧客登録) per Architect decision.
// RegMethod is an ALIAS of the SINGLE canonical union (no duplicate literal spelling) — the
// authority is CustomerRegistrationMethod in draft/wizard-draft-types.ts.
import type { CustomerRegistrationMethod } from "./draft/wizard-draft-types";
export type RegMethod = CustomerRegistrationMethod;

export interface CustomerDraft {
  regMethod:      RegMethod;
  name:           string;
  kana:           string;
  email:          string;  // メール → NewCustomerDraft.email → customers.email
  postal:         string;
  address:        string;
  phone:          string;
  lineId:         string;
  existingId:     string | null;
  contractor:     boolean; // 業者
  contractorRate: string;  // 値引率(%)
  creditSale:     boolean; // 掛売り
  creditClosing:  string;  // 締め日 (numeric day) → closingDay
  paymentDay:     string;  // 支払日 (numeric day) → paymentDay — distinct from free-text creditTerms
  creditTerms:    string;  // 支払条件 (free text) → creditTerms
}

export interface VehicleDraft {
  maker:              string;
  model:              string; // 車名 (manual only — required)
  grade:              string;
  vehicleCode:        string; // 型式
  displacement:       string; // 排気量 → NewVehicleDraft.displacement → vehicles.displacement
  vin:                string; // 車体番号
  firstRegYearMonth:  string; // 初年度登録年月
  registrationDate:   string; // 登録年月日
  color:              string; // ボディカラー
  inspectionExpiry:   string; // 車検満了年月日
  plateNumber:        string; // ナンバープレート
  existingId:         string | null;
  suggestedSize:      string | null; // 3M recommendation (highlight only)
  confirmedSize:      string | null; // operator's final choice (never auto-set)
}

// Service selections are intentionally left loosely-shaped for Phase 1; the real
// pricing wiring (ServiceInput[] → buildLineItems) lands in Phase 2.
export interface ServiceSelections {
  coating:      Record<string, unknown>;
  ppf:          Record<string, unknown>;
  window:       Record<string, unknown>;
  maintenance:  string[];
  carwash:      string[];
  roomclean:    Record<string, unknown>;
  other:        Array<{ id: string; name: string; price: number }>;
  storeOptions: string[];
}

export interface WizardStore {
  customer:       CustomerDraft;
  vehicle:        VehicleDraft;
  categories:     string[]; // selected category ids (Screen3)
  services:       ServiceSelections;
  coupons:        string[];
  discountMode:   DiscountMode;
  discountAmount: string;
  discountPercent: string;
  notesCustomer:  string; // 備考 (shown on estimate)
  notesInternal:  string; // 社内メモ
  // NOTE: dealerRank removed (EW-FC-1A) — authoritative rank is a future trusted-host input,
  // never client-held (no duplicate authority).
}

export function initialWizardStore(): WizardStore {
  return {
    customer: {
      regMethod: "new", // ← default: 新規顧客登録
      name: "", kana: "", email: "", postal: "", address: "", phone: "", lineId: "",
      existingId: null,
      contractor: false, contractorRate: "",
      creditSale: false, creditClosing: "", paymentDay: "", creditTerms: "",
    },
    vehicle: {
      maker: "", model: "", grade: "", vehicleCode: "", displacement: "", vin: "",
      firstRegYearMonth: "", registrationDate: "", color: "", inspectionExpiry: "",
      plateNumber: "", existingId: null, suggestedSize: null, confirmedSize: null,
    },
    categories: [],
    services: {
      coating: {}, ppf: {}, window: {}, maintenance: [], carwash: [],
      roomclean: {}, other: [], storeOptions: [],
    },
    coupons: [],
    discountMode: "none",
    discountAmount: "",
    discountPercent: "",
    notesCustomer: "",
    notesInternal: "",
  };
}
