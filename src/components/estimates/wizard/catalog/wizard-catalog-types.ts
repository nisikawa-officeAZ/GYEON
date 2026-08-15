// Estimate Wizard Ver2.2 — Catalog projection types (Phase 10C).
//
// A Wizard-facing PRESENTATION projection of the authoritative production pricing catalog. The
// production catalog owns identity + pricing; the Wizard owns presentation metadata only. These
// types expose NO price values, NO tax, NO totals — identity + policy + presentation only. This
// module depends on production pricing contract types (Phase 10B) and the Wizard category id; it
// imports NO screen component and the production catalog imports nothing from here.

import type { PricingPolicy, ManualPricePolicy } from "@/lib/pricing/canonical-pricing-engine";
import type { WizardServiceCategory } from "../draft/wizard-draft-types";

/** Projection category id. Extends the 7 Screen-3 categories with the cross-category
 *  `store_global_options` (production models these as coating options). */
export type WizardCatalogCategoryId = WizardServiceCategory | "store_global_options";

/** A single projected, priceable catalog item (presentation view). No price value is exposed. */
export type WizardCatalogItem = {
  presentationId:      string;                  // stable id (production id reused intentionally)
  pricingReferenceId:  string | null;           // authoritative production catalog id (null = manual/none)
  category:            WizardCatalogCategoryId;
  label:               string;                  // from catalog name or presentation override
  description:         string | null;
  pricingPolicy:       PricingPolicy;           // from approved 10A conclusions / production metadata
  manualPricePolicy:   ManualPricePolicy;       // safest fallback when not authoritatively provable
  active:              boolean;                  // catalog activeness (default true — no inactive marker in catalog)
  eligible:            boolean;                  // rank/cert eligibility NOT recomputed here (see audit)
  supportedBodySizes:  string[];                // size keys with a price table (coating/ppf); [] otherwise
  optionReferenceIds:  string[];                // attachable production option ids
  presentation: {
    displayOrder:      number;                  // presentation only (not identity)
    iconKey:           string | null;
    badge:             string | null;
    groupKey:          string | null;
  };
};

export type WizardCatalogCategory = {
  categoryId: WizardCatalogCategoryId;
  label:      string;
  items:      WizardCatalogItem[];
};

export type WizardCatalogProjection = {
  schemaVersion: "2.2";
  categories:    WizardCatalogCategory[];
  warnings:      WizardCatalogWarning[];
  errors:        WizardCatalogError[];
};

// ── Presentation metadata input (owned by the Wizard; NO prices allowed) ─────────
export type WizardPresentationItemMetadata = {
  displayOrder?:  number;
  iconKey?:       string | null;
  badge?:         string | null;
  groupKey?:      string | null;
  description?:   string | null;
  labelOverride?: string | null;
};

export type WizardPresentationMetadata = {
  /** keyed by production catalog id (== pricingReferenceId). */
  byId:            Record<string, WizardPresentationItemMetadata>;
  categoryLabels?: Partial<Record<WizardCatalogCategoryId, string>>;
};

// ── Warning / error contracts (stable codes; no stack traces) ────────────────────
export type WizardCatalogWarningCode =
  | "MISSING_PRESENTATION_METADATA"
  | "MISSING_ICON_METADATA"
  | "UNSUPPORTED_WIZARD_CATEGORY"
  | "INACTIVE_CATALOG_ITEM"
  | "INELIGIBLE_CATALOG_ITEM"
  | "NO_BODY_SIZE_PRICE_TABLE"
  | "NO_OPTION_METADATA"
  | "MANUAL_POLICY_UNRESOLVED";

export type WizardCatalogWarning = {
  code:     WizardCatalogWarningCode;
  sourceId: string | null;
  category: WizardCatalogCategoryId | null;
  message:  string;
};

export type WizardCatalogErrorCode =
  | "MISSING_PRICING_REFERENCE"
  | "DUPLICATE_PRODUCTION_ID"
  | "DUPLICATE_PRESENTATION_ID"
  | "DUPLICATE_OPTION_ID"
  | "INVALID_CATEGORY"
  | "INVALID_PRICING_POLICY"
  | "INVALID_MANUAL_PRICE_POLICY"
  | "CATALOG_PROJECTION_FAILED";

export type WizardCatalogError = {
  code:     WizardCatalogErrorCode;
  sourceId: string | null;
  category: WizardCatalogCategoryId | null;
  message:  string;
};
