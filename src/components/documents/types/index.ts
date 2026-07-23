// DealerOS Document Design System — Shared types.
//
// The Brand Profile contract mirrors the approved `brand-profiles.json` v3.0.1 schema. EVERY issuer
// value is dynamic (injected from Dealer Settings) — nothing here hardcodes Office AZ or any tenant.

// ── GYEON dealer rank ────────────────────────────────────────────────────────
// The four store ranks used by `business.shop_rank` (v3.0.1). `crystal-g` / `wordmark` also exist as
// supplementary marks in the logo library but are not store ranks.
export type GyeonRank = "certified-detailer" | "detailer" | "shop" | "ppf-installer";

/** Rank-logo color variant (navy = default; black = mono/FAX; white = dark background). */
export type GyeonRankColor = "navy" | "black" | "white";

// ── Brand Profile (dynamic issuer identity) ──────────────────────────────────
export interface BrandColors {
  primary: string;
  primaryDark?: string;
  primaryTint?: string;
}

export interface BrandContact {
  postalCode?: string;
  address?: string;
  tel?: string;
  fax?: string;
  email?: string;
  website?: string;
}

export interface BrandBusiness {
  shopRank?: string; // canonical key, e.g. "certified-detailer" (v3.0.1)
  shopRankLabel?: string; // display label, e.g. "GYEON Certified Detailer"
  invoiceRegistrationNumber?: string; // インボイス制度 適格請求書発行事業者番号
  responsiblePerson?: string; // 主任技術者 / 代表者
}

export interface BrandBankAccount {
  bankName?: string;
  branchName?: string;
  accountType?: string; // 普通 / 当座
  accountNumber?: string;
  accountHolder?: string;
}

export interface BrandFooter {
  tagline?: string;
  partnerBrand?: string; // e.g. "GYEON JAPAN"
  showPartnerLogo?: boolean;
}

export type SnsIcon = "instagram" | "line" | "youtube" | "tiktok";

export interface BrandQrLink {
  label: string;
  url: string;
  icon: SnsIcon;
  iconUrl?: string; // per-link icon asset (v3.0.1 qr_links[].icon_url)
  qrImageUrl?: string; // pre-rendered QR image (url → SVG/PNG); generation deferred
}

export interface BrandProfile {
  brandId: string;
  brandNameJa: string;
  brandNameEn?: string;
  brandTaglineJa?: string;
  brandTaglineEn?: string;
  logoUrl?: string; // shop logo (data URI / absolute); empty → text lockup fallback
  logoMonoUrl?: string;
  colors: BrandColors;
  contact: BrandContact;
  business: BrandBusiness;
  footer: BrandFooter;
  bankAccount?: BrandBankAccount;
  sealImageUrl?: string;
  qrLinks: BrandQrLink[]; // 0–4; empty → QR zone hidden
  /** Pre-resolved GYEON rank logo (data URI / absolute), selected from business.shopRank. */
  rankLogoUrl?: string;
  /** GYEON wordmark (data URI / absolute). concept-b uses it for the Summary Invoice masthead. */
  gyeonWordmarkUrl?: string;
  rank?: GyeonRank;
  /**
   * Explicit partner-program discriminator (set from the build-time brand variant). "gyeon" renders
   * the GYEON rank / wordmark / partner footer / philosophy; "none" — or absence — renders none of
   * those GYEON elements. Optional so existing document producers remain compatible; treat absence as
   * non-GYEON.
   */
  partnerProgram?: "gyeon" | "none";
}

// ── Document identity ────────────────────────────────────────────────────────
export type DocumentType =
  | "estimate"
  | "invoice"
  | "delivery-note"
  | "completion-report"
  | "summary-invoice"
  | "coating-certificate"
  | "ppf-certificate"
  | "cancoat-certificate";

/** Serial prefix per document type (`PREFIX/YYYY/NNNNN`). */
export const SERIAL_PREFIX: Record<DocumentType, string> = {
  estimate: "EST",
  invoice: "INV",
  "delivery-note": "DLV",
  "completion-report": "RPT",
  "summary-invoice": "SIN",
  "coating-certificate": "CRT/CO",
  "ppf-certificate": "CRT/PPF",
  "cancoat-certificate": "CRT/CC",
};

export interface DocumentMeta {
  type: DocumentType;
  /** Fully formatted serial (server-allocated), e.g. "EST/2026/00012". */
  serial: string;
  /** Issue date, ISO or already-formatted; rendered as YYYY.MM.DD. */
  issueDate: string;
  titleJa: string; // e.g. "見積書"
  titleEn: string; // e.g. "ESTIMATE"
}

// ── Party (customer / issuer / vehicle) ──────────────────────────────────────
export type PartyKind = "individual" | "corporation" | "business-contact";

export interface Party {
  name: string;
  kind: PartyKind; // drives honorific (様 / 御中 / ご担当者様)
  postalCode?: string;
  address?: string;
  tel?: string;
  contactPerson?: string; // for business-contact
}

export interface VehicleInfo {
  makeModel?: string;
  vin?: string;
  plate?: string;
  color?: string;
  firstRegistration?: string;
  mileage?: string;
}

// ── Money / items ────────────────────────────────────────────────────────────
export interface ItemLine {
  label: string;
  category?: string; // optional tag (e.g. "COATING")
  quantity?: number;
  unitPrice?: number | null; // null → unpriced/manual pending
  amount?: number | null;
  note?: string;
}

export interface SummaryLine {
  label: string;
  amount: number;
  tone?: "default" | "danger"; // danger for discounts / negatives
}

export interface DocumentSummary {
  lines: SummaryLine[]; // subtotal, discount, coupon, taxable, tax …
  grandTotalLabel: string; // "合計" / "ご請求金額" …
  grandTotal: number;
}
