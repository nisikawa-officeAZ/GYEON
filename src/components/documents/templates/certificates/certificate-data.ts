// Certificate document-data contracts (Layer 4 — 施工証明系 3 帳票 + メンテナンス履歴).
//
// These are PRESENTATION contracts, not database rows. Nothing here maps 1:1 to a table: a
// completion/work record is expected to pass through an adapter that resolves products, warranty
// terms, and the issuer's Brand Profile, and hands the template a fully-resolved value object:
//
//   Saved Work / Completion data → (adapter) → CertificateDocumentData → Certificate template
//
// The templates therefore never query, never compute eligibility, and never see internal fields.
// Purchase cost, dealer margin, internal pricing, and private operational memos are deliberately
// absent from every type below — a certificate is a customer-facing document and must not be able
// to leak them.
//
// Serials follow `CRT/CO`, `CRT/PPF`, `CRT/CC` (DESIGN_SPEC_CERTIFICATE §05a–c).

import type { DocumentType } from "../../types";

/** Which of the three approved certificates this is. */
export type CertificateKind = "coating" | "ppf" | "cancoat";

/** Certificate kind → the shared DocumentType used for serial prefixes. */
export const CERTIFICATE_DOCUMENT_TYPE: Record<CertificateKind, DocumentType> = {
  coating: "coating-certificate",
  ppf: "ppf-certificate",
  cancoat: "cancoat-certificate",
};

/**
 * What to render. The duplex form (front + maintenance history) is the default issue format;
 * the single-sided modes exist for reprints of one half.
 */
export type CertificateOutputMode = "front" | "maintenance" | "duplex";

export const DEFAULT_CERTIFICATE_OUTPUT_MODE: CertificateOutputMode = "duplex";

// ── Shared front-page data ───────────────────────────────────────────────────

export interface CertificateCustomer {
  name: string;
  /** 様 / 御中 — resolved by the adapter from the customer kind, never guessed here. */
  honorific?: string;
}

export interface CertificateVehicle {
  name: string; // 車種
  year?: string;
  color?: string;
  vin?: string; // 車体番号
  plate?: string; // 登録番号
}

export interface CertificateInstallation {
  /** 施工日 */
  appliedDate: string;
  /** 主任技術者 */
  technician?: string;
}

/** A row of the "Applied Coating" / "Applied Films" table. `tag` is the leading navy chip. */
export interface AppliedProductRow {
  /** Base / Top (coating) · Protect+ / Enhance / Hybrid / Matte … (PPF) — supplied, never inferred. */
  tag: string;
  /** 使用製品 (coating) · 施工箇所 (PPF) — the emphasised cell. */
  name: string;
  /** Sub-line under `name`. */
  description?: string;
  /** 施工箇所 (coating) · 使用フィルム (PPF) — the right-hand monospaced cell. */
  appliedTo: string;
}

/** One entry of the PPF Film Warranty list (e.g. PROTECT+ → 変色 10 年保証). */
export interface FilmWarrantyItem {
  product: string;
  coverage: string;
}

/** A titled prose/list block inside the Coverage · Exclusions grid. */
export interface TermsBlock {
  labelEn: string;
  labelJa: string;
  /** Paragraphs, rendered in order. */
  paragraphs?: string[];
  /** Numbered items (保証の除外 / 取り扱い上の注意). */
  items?: string[];
}

/** The navy Infinity Warranty (Coating) / grey Proof of Installation (CanCoat) callout. */
export interface CertificateCallout {
  /** "∞" or "✓" — the oversized mark on the left. */
  mark: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Navy reversal (Coating) vs. grey panel with navy text (CanCoat). */
  tone: "navy" | "grey";
}

/**
 * Signature areas. concept-b's approved certificate fronts carry NO signature block, so this is
 * opt-in: supply it and the block renders below the care section; omit it and the front matches the
 * approved design exactly. See the PHASE 12G report.
 */
export interface CertificateSignatures {
  customerLabel: string;
  installerLabel: string;
  /** Pre-printed under the installer rule (usually the technician). Blank for the customer. */
  installerName?: string;
}

export interface CertificateBaseData {
  kind: CertificateKind;
  /** Fully formatted serial, e.g. "CRT/CO/2026/00087" — allocated server-side. */
  serial: string;
  /** Short serial shown large in the masthead, e.g. "— 0005097". */
  serialDisplay?: string;
  issueDate: string;
  titleJa: string;
  titleEn: string;
  /** The masthead's programme line, e.g. "Coating · Certified Detailer". */
  programLabel: string;
  programSubLabel?: string;
  intro: string;

  customer: CertificateCustomer;
  vehicle: CertificateVehicle;
  installation: CertificateInstallation;

  /** Applied Coating / Applied Films. */
  productLabelEn: string;
  productLabelJa: string;
  productColumns: { tag: string; name: string; appliedTo: string };
  products: AppliedProductRow[];

  callout?: CertificateCallout;

  /** Coverage · Scope (left) and Exclusions · Handling Notice (right). */
  terms: { left: TermsBlock[]; right: TermsBlock[] };
  /** Care Instructions · From GYEON · Recommendation. */
  care: TermsBlock[];
  privacyNotice: string;

  signatures?: CertificateSignatures;

  /** Bottom rule text, e.g. "GYEON Coating Japan Certified Detailer". */
  footerProgramLine: string;
}

/** PPF adds the Film Warranty section between the film table and the terms grid. */
export interface PpfCertificateExtras {
  filmWarranty?: {
    titleEn: string;
    titleJa: string;
    intro: string;
    items: FilmWarrantyItem[];
    /** 保証対象外の商品 note. */
    note: string;
  };
}

export type CertificateDocumentData = CertificateBaseData & PpfCertificateExtras;

// ── Maintenance history back page ────────────────────────────────────────────

/** Exactly ten writable rows — the count is fixed by the approved spec, not by the data. */
export const MAINTENANCE_ROW_COUNT = 10;

export const MAINTENANCE_HISTORY_TITLE = "メンテナンス履歴";

export const MAINTENANCE_HISTORY_NOTE =
  "定期的なメンテナンスを実施することで、施工性能をより長く維持できます。詳しくは施工店へご相談ください。";

/**
 * The five columns, in order, with their approved widths. No "No." column and no "使用GYEON製品"
 * column: both were explicitly removed. メンテナンス内容 is the widest so it can be written in.
 */
export const MAINTENANCE_COLUMNS: ReadonlyArray<{ label: string; width: string }> = [
  { label: "メンテナンス日", width: "13%" },
  { label: "走行距離", width: "11%" },
  { label: "メンテナンス内容", width: "46%" },
  { label: "次回推奨日", width: "12%" },
  { label: "店舗印・サイン", width: "18%" },
];
