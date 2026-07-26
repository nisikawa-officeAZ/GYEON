// C2C3 — Wizard catalog authoring/review: input + result contracts (PURE TYPES).
//
// No "use server", no server-only, no DB — safe to import from cores, wrappers, and
// tests alike. dealer_id is NEVER part of any public input here: it is resolved
// server-side (getCurrentDealer) and injected into the RPC, never accepted from a
// caller.

import type { ShopRank } from "@/lib/dealer-settings/authoritative-shop-rank-core";

/**
 * The dealer-owned kinds that can be authored.
 *
 * B1.1 adds `coupon` and `ppf_type_group`. Both were already policy-authorised for dealer scope
 * (105 seeds the coupon ownership row; 110 seeds the ppf_type_group one) and both already have
 * their value constraints in the schema — only the RPC allowlist and this union kept them shut.
 *
 * Still deliberately absent: `ppf_method`, `ppf_part` and `window_area`. Those are the fixed
 * global vocabulary of WHERE film is applied, not WHICH film a dealer sells, so they stay
 * global read-only.
 */
export const SUPPORTED_AUTHORING_KINDS = [
  "maintenance_menu",
  "wash_menu",
  "room_cleaning_menu",
  "film_type",
  "other_work_preset",
  "store_global_option",
  "coupon",
  "ppf_type_group",
] as const;

export type SupportedAuthoringKind = (typeof SUPPORTED_AUTHORING_KINDS)[number];

export function isSupportedAuthoringKind(value: unknown): value is SupportedAuthoringKind {
  return typeof value === "string"
    && (SUPPORTED_AUTHORING_KINDS as readonly string[]).includes(value);
}

/** Film-type presentation allowlist. Every field optional; every value a string. */
export interface FilmPresentationInput {
  brand?: string;
  vlt?: string;
  heatRejection?: string;
  color?: string;
}

/** Coupon discount kind. `percent` values are integer BASIS POINTS (10000 = 100%). */
export type CouponDiscountType = "amount" | "percent";

/**
 * Authoring input for one catalog item. `itemId` absent/null ⇒ create; present ⇒
 * update. There is deliberately NO dealerId / ownerScope / market / productMode /
 * code field — identity and tenancy are owned by the server + database.
 */
export interface WizardCatalogItemInput {
  readonly itemId?: string | null;
  readonly kind: SupportedAuthoringKind;
  readonly labelJa: string;
  readonly displayOrder?: number;
  readonly isActive?: boolean;
  readonly defaultUnitPrice?: number | null;
  readonly durationMinutes?: number | null;
  readonly priceable?: boolean;
  readonly quantityRequired?: boolean;
  readonly minQuantity?: number;
  readonly maxQuantity?: number | null;
  readonly presentation?: FilmPresentationInput;
  /**
   * PPF installation coefficient in integer BASIS POINTS (10000 = ×1.0). A multiplier, never a
   * price and never a cost — it carries no purchase price and enables no margin calculation.
   * Accepted only for `film_type` / `ppf_type_group`; the RPC rejects it on any other kind.
   */
  readonly installCoefficientBp?: number | null;
  /** Coupon fields — accepted only when `kind === "coupon"`. */
  readonly couponDiscountType?: CouponDiscountType;
  /** yen for `amount`; integer basis points for `percent`. */
  readonly couponDiscountValue?: number;
  readonly couponCombinable?: boolean;
  /** ISO `YYYY-MM-DD`, or null for open-ended. */
  readonly couponValidFrom?: string | null;
  readonly couponValidTo?: string | null;
}

/** One dealer-scoped PPF + coating reduction rule as authored. Identity is the CODE pair. */
export interface PpfCoatingAdjustmentInput {
  readonly ruleId?: string | null;
  readonly ppfMethodCode: string;
  readonly coatingCode: string;
  readonly adjustmentType: "amount" | "percent";
  /** yen for `amount`; integer basis points for `percent`. */
  readonly adjustmentValue: number;
  readonly isActive?: boolean;
}

/** Stable, machine-readable failure codes. Raw DB/exception text is never surfaced. */
export const WIZARD_CATALOG_ACTION_ERRORS = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  DEALER_CONTEXT_REQUIRED: "DEALER_CONTEXT_REQUIRED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNSUPPORTED_KIND: "UNSUPPORTED_KIND",
  RANK_UNAVAILABLE: "RANK_UNAVAILABLE",
  RPC_ERROR: "RPC_ERROR",
  // B1.1 — typed pre-RPC rejections for the three new configuration surfaces.
  INVALID_COEFFICIENT: "INVALID_COEFFICIENT",
  INVALID_COUPON_RULE: "INVALID_COUPON_RULE",
  INVALID_ADJUSTMENT_RULE: "INVALID_ADJUSTMENT_RULE",
} as const;

export type WizardCatalogActionErrorCode =
  (typeof WIZARD_CATALOG_ACTION_ERRORS)[keyof typeof WIZARD_CATALOG_ACTION_ERRORS];

export interface WizardCatalogActionFailure {
  readonly ok: false;
  readonly code: WizardCatalogActionErrorCode;
  readonly message: string;
}

export type WizardCatalogUpsertResult =
  | {
      readonly ok: true;
      readonly itemId: string;
      readonly code: string;
      readonly kind: string;
      readonly action: "created" | "updated";
    }
  | WizardCatalogActionFailure;

export type WizardCatalogArchiveResult =
  | {
      readonly ok: true;
      readonly itemId: string;
      readonly action: "archived" | "already_archived";
    }
  | WizardCatalogActionFailure;

export type PpfCoatingAdjustmentUpsertResult =
  | { readonly ok: true; readonly ruleId: string; readonly action: "created" | "updated" }
  | WizardCatalogActionFailure;

export type PpfCoatingAdjustmentArchiveResult =
  | { readonly ok: true; readonly ruleId: string; readonly action: "archived" | "already_archived" }
  | WizardCatalogActionFailure;

export type WizardCatalogReviewResult =
  | {
      readonly ok: true;
      readonly state: "CATALOG_REVIEWED";
      readonly reviewedRevision: number;
    }
  | WizardCatalogActionFailure;

/** Re-export so callers/tests get the rank union without reaching into dealer-settings. */
export type { ShopRank };
