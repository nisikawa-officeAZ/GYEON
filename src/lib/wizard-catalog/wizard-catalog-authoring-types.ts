// C2C3 — Wizard catalog authoring/review: input + result contracts (PURE TYPES).
//
// No "use server", no server-only, no DB — safe to import from cores, wrappers, and
// tests alike. dealer_id is NEVER part of any public input here: it is resolved
// server-side (getCurrentDealer) and injected into the RPC, never accepted from a
// caller.

import type { ShopRank } from "@/lib/dealer-settings/authoritative-shop-rank-core";

/** The six dealer-owned kinds this phase can author. Coupons are intentionally absent. */
export const SUPPORTED_AUTHORING_KINDS = [
  "maintenance_menu",
  "wash_menu",
  "room_cleaning_menu",
  "film_type",
  "other_work_preset",
  "store_global_option",
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

export type WizardCatalogReviewResult =
  | {
      readonly ok: true;
      readonly state: "CATALOG_REVIEWED";
      readonly reviewedRevision: number;
    }
  | WizardCatalogActionFailure;

/** Re-export so callers/tests get the rank union without reaching into dealer-settings. */
export type { ShopRank };
