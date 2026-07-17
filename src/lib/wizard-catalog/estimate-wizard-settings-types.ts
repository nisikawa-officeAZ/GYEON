// C2C4 — Estimate Wizard settings: presentation-safe view contracts (PURE TYPES).
//
// No "use server", no server-only, no DB. These are the ONLY shapes the settings UI
// consumes. They deliberately expose NO dealer id, NO raw lifecycle enum, NO raw
// configuration-revision wording, NO authorization internals, and NO database error
// text. Reuses the accepted C2C3 catalog identities (SupportedAuthoringKind) and the
// canonical ShopRank rather than inventing a second catalog/eligibility model.

import type { SupportedAuthoringKind } from "./wizard-catalog-authoring-types";
import type { ShopRank } from "@/lib/dealer-settings/authoritative-shop-rank-core";

export type { SupportedAuthoringKind, ShopRank };

/** Owner/manager may mutate; everyone else is strictly read-only. */
export type EstimateWizardPermission = "editable" | "readonly";

/** The four editable top-level sections. Coating is summary-only; coupons planned-only. */
export type WizardSettingsSectionId = "film" | "service" | "otherwork" | "store";

/** Film presentation, presentation-safe (already string-normalised). */
export interface FilmPresentationView {
  readonly brand: string | null;
  readonly vlt: string | null;
  readonly heatRejection: string | null;
  readonly color: string | null;
}

/**
 * One catalog item as presented. Identity is the STABLE code (never a label or array
 * index). `itemId` is the item's own server-owned uuid, required by the C2C3
 * add/edit/archive actions — it is NOT a dealer id.
 */
export interface WizardSettingsItemView {
  readonly code: string;
  readonly itemId: string;
  readonly kind: SupportedAuthoringKind;
  readonly labelJa: string;
  readonly priceYen: number | null;
  readonly priceLabelJa: string | null;
  readonly durationMinutes: number | null;
  readonly durationLabelJa: string | null;
  readonly displayOrder: number;
  readonly priceable: boolean;
  readonly quantityRequired: boolean;
  readonly minQuantity: number | null;
  readonly maxQuantity: number | null;
  readonly presentation: FilmPresentationView | null;
}

/** A kind-scoped group; the service section holds three (maintenance/wash/room). */
export interface WizardSettingsGroupView {
  readonly kind: SupportedAuthoringKind;
  readonly labelJa: string;
  readonly items: readonly WizardSettingsItemView[];
}

export interface WizardSettingsSectionView {
  readonly id: WizardSettingsSectionId;
  readonly labelJa: string;
  readonly descriptionJa: string;
  readonly anchorId: string;
  readonly kinds: readonly SupportedAuthoringKind[];
  readonly groups: readonly WizardSettingsGroupView[];
  readonly itemCount: number;
  readonly required: boolean;
  readonly satisfied: boolean;
}

/** Coating: summary + link only. Never a duplicate editor. */
export interface CoatingSummaryView {
  readonly titleJa: string;
  readonly configuredCount: number;
  readonly summaryJa: string;
  readonly noticeJa: string;
  readonly editHref: string;
  readonly editLabelJa: string;
}

/** Coupons: read-only planned card. */
export interface CouponPlannedView {
  readonly titleJa: string;
  readonly badgeJa: string; // 「今後対応予定」
  readonly descriptionJa: string;
}

/** A required-but-missing section, with a direct in-page anchor. */
export interface MissingSectionView {
  readonly sectionId: WizardSettingsSectionId;
  readonly labelJa: string;
  readonly anchorId: string;
  readonly reasonJa: string;
}

/** Durable last-review info — dates and names only, never revision numbers. */
export interface LastReviewView {
  readonly dateLabelJa: string;
  readonly reviewerLabelJa: string | null;
}

export interface ReviewStatusView {
  readonly reviewed: boolean;
  readonly reviewRequired: boolean;
  readonly reviewReady: boolean;
  readonly statusLabelJa: string;
  readonly statusDetailJa: string;
  readonly missingSections: readonly MissingSectionView[];
  readonly lastReview: LastReviewView | null;
}

/** The complete presentation-safe DTO the page consumes. */
export interface EstimateWizardSettingsView {
  readonly permission: EstimateWizardPermission;
  readonly canEdit: boolean;
  readonly rankKnown: boolean;
  readonly filmRequired: boolean;
  readonly reviewStatus: ReviewStatusView;
  readonly sections: readonly WizardSettingsSectionView[];
  readonly coating: CoatingSummaryView;
  readonly coupon: CouponPlannedView;
  /**
   * INTERNAL, NON-VISIBLE concurrency token (the current configuration revision).
   * The UI must NEVER render this; it is used only to detect that the configuration
   * changed underneath a review confirmation and to show the concurrency notice.
   */
  readonly viewedRevision: number;
}

export type EstimateWizardSettingsViewResult =
  | { readonly ok: true; readonly view: EstimateWizardSettingsView }
  | { readonly ok: false; readonly reason: "no-dealer" | "load-failed"; readonly messageJa: string };
