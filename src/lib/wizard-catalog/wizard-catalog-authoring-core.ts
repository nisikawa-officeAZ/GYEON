// C2C3 — Wizard catalog authoring/review: PURE CORE (dependency-injected).
//
// No React, no server module, no Supabase, no DB, no "server-only", no clock. Every
// dependency arrives through the deps objects, so the whole gating + input-shape
// validation surface is testable under plain node:test with fakes.
//
// Division of responsibility: this core enforces the AUTHORIZATION boundary
// (authenticated dealer present; role is owner|manager — the same set the DB helper
// wiz_can_configure accepts) and rejects obvious bad input BEFORE any RPC call. The
// SQL RPC remains the AUTHORITATIVE validator (kind rules, field ranges, ownership,
// immutability, revision invalidation); the core never re-implements pricing.

import type { DealerStaffRole } from "@/lib/staff/staff-types";
import type { RankResolution } from "@/lib/dealer-settings/authoritative-shop-rank-core";
import {
  WIZARD_CATALOG_ACTION_ERRORS as ERR,
  isSupportedAuthoringKind,
  type WizardCatalogItemInput,
  type WizardCatalogUpsertResult,
  type WizardCatalogArchiveResult,
  type WizardCatalogReviewResult,
  type WizardCatalogActionFailure,
  type PpfCoatingAdjustmentInput,
  type PpfCoatingAdjustmentUpsertResult,
  type PpfCoatingAdjustmentArchiveResult,
} from "./wizard-catalog-authoring-types";
import { validatePpfCoatingAdjustmentRule } from "./ppf-coating-adjustment-core";

// ── shared gate ──────────────────────────────────────────────────────────────

/** owner|manager — exactly the roles wiz_can_configure accepts (owner|manager membership). */
const CONFIGURE_ROLES: readonly DealerStaffRole[] = ["owner", "manager"];

export interface AuthzDeps {
  /** Authenticated dealer, or null when there is no active membership. */
  readonly getDealer: () => Promise<{ dealer_id: string } | null>;
  /** Current staff role (single server-side source of truth), or null. */
  readonly getStaffRole: () => Promise<DealerStaffRole | null>;
}

type GateResult =
  | { readonly ok: true; readonly dealerId: string }
  | { readonly ok: false; readonly failure: WizardCatalogActionFailure };

async function gate(deps: AuthzDeps): Promise<GateResult> {
  const dealer = await deps.getDealer();
  if (!dealer) {
    return {
      ok: false,
      failure: { ok: false, code: ERR.DEALER_CONTEXT_REQUIRED, message: "有効なディーラー権限がありません" },
    };
  }
  const role = await deps.getStaffRole();
  if (!role || !CONFIGURE_ROLES.includes(role)) {
    return {
      ok: false,
      failure: { ok: false, code: ERR.PERMISSION_DENIED, message: "この操作を行う権限がありません" },
    };
  }
  return { ok: true, dealerId: dealer.dealer_id };
}

// ── payload builder (only defined fields; snake_case for the RPC) ─────────────

/**
 * Build the jsonb payload for wiz_upsert_catalog_item from validated input. Only
 * keys the caller actually set are included; the RPC's per-kind allowlist rejects
 * any key that does not belong to the item's kind, so this stays deliberately thin.
 */
export function buildUpsertPayload(input: WizardCatalogItemInput): Record<string, unknown> {
  const p: Record<string, unknown> = { label_ja: input.labelJa };
  if (input.displayOrder !== undefined) p.display_order = input.displayOrder;
  if (input.isActive !== undefined) p.is_active = input.isActive;
  if (input.defaultUnitPrice !== undefined) p.default_unit_price = input.defaultUnitPrice;
  if (input.durationMinutes !== undefined) p.duration_minutes = input.durationMinutes;
  if (input.priceable !== undefined) p.priceable = input.priceable;
  if (input.quantityRequired !== undefined) p.quantity_required = input.quantityRequired;
  if (input.minQuantity !== undefined) p.min_quantity = input.minQuantity;
  if (input.maxQuantity !== undefined) p.max_quantity = input.maxQuantity;
  if (input.presentation !== undefined) p.presentation = input.presentation;
  // B1.1 — still only keys the caller actually set. The RPC's per-kind allowlist rejects a
  // coefficient on a menu, or a coupon field on a film type, so this stays deliberately thin.
  if (input.installCoefficientBp !== undefined) p.install_coefficient_bp = input.installCoefficientBp;
  if (input.couponDiscountType !== undefined) p.coupon_discount_type = input.couponDiscountType;
  if (input.couponDiscountValue !== undefined) p.coupon_discount_value = input.couponDiscountValue;
  if (input.couponCombinable !== undefined) p.coupon_combinable = input.couponCombinable;
  if (input.couponValidFrom !== undefined) p.coupon_valid_from = input.couponValidFrom;
  if (input.couponValidTo !== undefined) p.coupon_valid_to = input.couponValidTo;
  return p;
}

// ── upsert ─────────────────────────────────────────────────────────────────--

export interface UpsertRpcSuccess {
  readonly ok: true;
  readonly itemId: string;
  readonly code: string;
  readonly kind: string;
  readonly action: "created" | "updated";
}

export interface UpsertDeps extends AuthzDeps {
  /** Invoke wiz_upsert_catalog_item with the server-injected dealer id. */
  readonly upsert: (
    dealerId: string,
    input: WizardCatalogItemInput,
  ) => Promise<UpsertRpcSuccess | { ok: false }>;
}

export async function runSaveCatalogItem(
  deps: UpsertDeps,
  input: WizardCatalogItemInput,
): Promise<WizardCatalogUpsertResult> {
  const g = await gate(deps);
  if (!g.ok) return g.failure;

  // Pre-RPC shape checks (must NOT call the RPC when they fail).
  if (!isSupportedAuthoringKind(input.kind)) {
    return { ok: false, code: ERR.UNSUPPORTED_KIND, message: "サポート対象外の項目種別です" };
  }
  if (typeof input.labelJa !== "string" || input.labelJa.trim() === "") {
    return { ok: false, code: ERR.VALIDATION_ERROR, message: "名称は必須です" };
  }
  // B1.1 pre-RPC shape checks. Thin on purpose: the SQL CHECKs stay the authority for ranges,
  // ordering and cross-field rules — this only stops obviously malformed input reaching the RPC.
  if (input.installCoefficientBp !== undefined && input.installCoefficientBp !== null) {
    if (!Number.isInteger(input.installCoefficientBp) || input.installCoefficientBp <= 0) {
      return { ok: false, code: ERR.INVALID_COEFFICIENT, message: "施工係数は正の整数で入力してください" };
    }
  }
  if (input.kind === "coupon") {
    if (input.couponDiscountType !== "amount" && input.couponDiscountType !== "percent") {
      return { ok: false, code: ERR.INVALID_COUPON_RULE, message: "クーポンの割引種別が不正です" };
    }
    if (!Number.isInteger(input.couponDiscountValue) || (input.couponDiscountValue ?? -1) < 0) {
      return { ok: false, code: ERR.INVALID_COUPON_RULE, message: "クーポンの割引値が不正です" };
    }
    if (typeof input.couponCombinable !== "boolean") {
      return { ok: false, code: ERR.INVALID_COUPON_RULE, message: "クーポンの併用可否を指定してください" };
    }
  }

  const r = await deps.upsert(g.dealerId, input);
  if (!r.ok) {
    return { ok: false, code: ERR.RPC_ERROR, message: "保存に失敗しました" };
  }
  return { ok: true, itemId: r.itemId, code: r.code, kind: r.kind, action: r.action };
}

// ── archive ───────────────────────────────────────────────────────────────---

export interface ArchiveRpcSuccess {
  readonly ok: true;
  readonly itemId: string;
  readonly action: "archived" | "already_archived";
}

export interface ArchiveDeps extends AuthzDeps {
  readonly archive: (
    dealerId: string,
    itemId: string,
  ) => Promise<ArchiveRpcSuccess | { ok: false }>;
}

export async function runArchiveCatalogItem(
  deps: ArchiveDeps,
  itemId: string,
): Promise<WizardCatalogArchiveResult> {
  const g = await gate(deps);
  if (!g.ok) return g.failure;

  if (typeof itemId !== "string" || itemId.trim() === "") {
    return { ok: false, code: ERR.VALIDATION_ERROR, message: "項目IDが必要です" };
  }

  const r = await deps.archive(g.dealerId, itemId);
  if (!r.ok) {
    return { ok: false, code: ERR.RPC_ERROR, message: "アーカイブに失敗しました" };
  }
  return { ok: true, itemId: r.itemId, action: r.action };
}

// ── PPF + coating adjustment rules (B1.1) ────────────────────────────────────
// Same gate, same failure vocabulary, same "DB is the authoritative validator" split as the
// catalog item paths above. dealer_id is injected server-side and never accepted from a caller.

export interface AdjustmentUpsertDeps extends AuthzDeps {
  readonly upsertAdjustment: (
    dealerId: string,
    input: PpfCoatingAdjustmentInput,
  ) => Promise<{ ok: true; ruleId: string; action: "created" | "updated" } | { ok: false }>;
}

export async function runSavePpfCoatingAdjustment(
  deps: AdjustmentUpsertDeps,
  input: PpfCoatingAdjustmentInput,
): Promise<PpfCoatingAdjustmentUpsertResult> {
  const g = await gate(deps);
  if (!g.ok) return g.failure;

  const v = validatePpfCoatingAdjustmentRule({
    ppfMethodCode: input.ppfMethodCode,
    coatingCode: input.coatingCode,
    adjustmentType: input.adjustmentType,
    adjustmentValue: input.adjustmentValue,
  });
  if (!v.ok) {
    return { ok: false, code: ERR.INVALID_ADJUSTMENT_RULE, message: v.message };
  }

  const r = await deps.upsertAdjustment(g.dealerId, input);
  if (!r.ok) {
    return { ok: false, code: ERR.RPC_ERROR, message: "保存に失敗しました" };
  }
  return { ok: true, ruleId: r.ruleId, action: r.action };
}

export interface AdjustmentArchiveDeps extends AuthzDeps {
  readonly archiveAdjustment: (
    dealerId: string,
    ruleId: string,
  ) => Promise<{ ok: true; ruleId: string; action: "archived" | "already_archived" } | { ok: false }>;
}

export async function runArchivePpfCoatingAdjustment(
  deps: AdjustmentArchiveDeps,
  ruleId: string,
): Promise<PpfCoatingAdjustmentArchiveResult> {
  const g = await gate(deps);
  if (!g.ok) return g.failure;

  if (typeof ruleId !== "string" || ruleId.trim() === "") {
    return { ok: false, code: ERR.VALIDATION_ERROR, message: "規則IDが必要です" };
  }

  const r = await deps.archiveAdjustment(g.dealerId, ruleId);
  if (!r.ok) {
    return { ok: false, code: ERR.RPC_ERROR, message: "アーカイブに失敗しました" };
  }
  return { ok: true, ruleId: r.ruleId, action: r.action };
}

// ── review ────────────────────────────────────────────────────────────────---

export interface ReviewRpcSuccess {
  readonly ok: true;
  readonly reviewedRevision: number;
}

export interface ReviewDeps extends AuthzDeps {
  /**
   * Early authoritative-rank probe (optional UX nicety): produces a typed
   * RANK_UNAVAILABLE before the RPC. It is read server-side from the DB — never
   * client-asserted — and is NOT passed to the RPC. The RPC independently resolves
   * and enforces the rank from public.dealers.detailer_rank, so it stays the sole
   * authority even if this probe is skipped or diverges.
   */
  readonly getRank: () => Promise<RankResolution>;
  /** The RPC receives ONLY the server-resolved dealer id — no rank. */
  readonly confirm: (dealerId: string) => Promise<ReviewRpcSuccess | { ok: false }>;
}

export async function runConfirmCatalogReview(
  deps: ReviewDeps,
): Promise<WizardCatalogReviewResult> {
  const g = await gate(deps);
  if (!g.ok) return g.failure;

  const rank = await deps.getRank();
  if (!rank.ok) {
    return { ok: false, code: ERR.RANK_UNAVAILABLE, message: "店舗ランクを確定できません" };
  }

  // Note: rank.rank is deliberately NOT forwarded — the RPC re-resolves it.
  const r = await deps.confirm(g.dealerId);
  if (!r.ok) {
    return { ok: false, code: ERR.RPC_ERROR, message: "レビュー確定に失敗しました" };
  }
  return { ok: true, state: "CATALOG_REVIEWED", reviewedRevision: r.reviewedRevision };
}
