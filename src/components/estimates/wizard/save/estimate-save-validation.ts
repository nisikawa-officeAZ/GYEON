// Estimate Wizard Ver2.2 — Estimate Save validation (Phase 11A → 11B, prepared validation only).
//
// PURE, deterministic. Given an EstimateSaveRequest, returns the blocking issues + a save-readiness
// result. It NEVER saves, NEVER calls the database, NEVER checks uniqueness/numbering/auth, NEVER
// performs pricing arithmetic — it only inspects the already-prepared DTO. Save is eligible only when
// readiness.status === "ready".

import type { EstimateSaveRequest } from "./estimate-save-dto";
import {
  ESTIMATE_SAVE_ERRORS,
  type EstimateSaveErrorCode,
  type EstimateSaveValidationIssue,
  type EstimateSaveValidationResult,
  type EstimateSaveReadiness,
} from "./estimate-save-errors";

// Pricing-result error codes (strings) → save validation codes. Keeps the save contract stable while
// faithfully surfacing why a priceable selection has no pricing line.
const PRICING_CODE_TO_SAVE_CODE: Record<string, EstimateSaveErrorCode> = {
  MANUAL_PRICE_REQUIRED:           ESTIMATE_SAVE_ERRORS.MANUAL_PRICE_MISSING,
  INVALID_MANUAL_PRICE:            ESTIMATE_SAVE_ERRORS.MANUAL_PRICE_MISSING,
  MANUAL_PRICING_IDENTITY_MISSING: ESTIMATE_SAVE_ERRORS.UNKNOWN_PRICING_IDENTITY,
  UNKNOWN_PRICING_REFERENCE:       ESTIMATE_SAVE_ERRORS.UNKNOWN_PRICING_IDENTITY,
  INVALID_QUANTITY:                ESTIMATE_SAVE_ERRORS.VALIDATION_ERROR,
};

export function validateEstimateSaveRequest(req: EstimateSaveRequest): EstimateSaveValidationResult {
  const issues: EstimateSaveValidationIssue[] = [];
  const seen = new Set<string>();
  const add = (code: EstimateSaveErrorCode, field: string | null, message: string) => {
    const key = `${code}:${field ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ code, field, message });
  };

  // Customer required
  if (req.customer.mode === "existing") {
    if (!req.customer.customerId) add(ESTIMATE_SAVE_ERRORS.CUSTOMER_REQUIRED, "customer", "お客様が選択されていません。");
  } else if (req.customer.name.trim() === "") {
    add(ESTIMATE_SAVE_ERRORS.CUSTOMER_REQUIRED, "customer.name", "お客様名が未入力です。");
  }

  // Vehicle required
  if (req.vehicle.mode === "existing") {
    if (!req.vehicle.vehicleId) add(ESTIMATE_SAVE_ERRORS.VEHICLE_REQUIRED, "vehicle", "車両が選択されていません。");
  } else if (!req.vehicle.maker && !req.vehicle.model) {
    add(ESTIMATE_SAVE_ERRORS.VEHICLE_REQUIRED, "vehicle", "車両情報が未入力です。");
  }

  // At least one priced service line
  if (req.services.length === 0) {
    add(ESTIMATE_SAVE_ERRORS.SERVICE_REQUIRED, "services", "サービスが1件も選択されていません。");
  }

  // Pricing completeness must be complete; unresolved pricing is not allowed
  if (req.pricing.completeness === "partial" || req.pricing.completeness === "unavailable") {
    add(ESTIMATE_SAVE_ERRORS.PRICING_INCOMPLETE, "pricing", "価格が未確定の項目があるため保存できません。");
  } else if (req.pricing.completeness === "error") {
    add(ESTIMATE_SAVE_ERRORS.VALIDATION_ERROR, "pricing", "価格計算にエラーがあります。");
  }
  if (req.pricing.grandTotal == null || req.pricing.subtotal == null) {
    add(ESTIMATE_SAVE_ERRORS.PRICING_INCOMPLETE, "pricing.grandTotal", "合計金額が確定していません。");
  }

  // A selected priceable item with no pricing line (unresolved) — surface the exact reason
  if (req.pricing.unresolvedItems.length > 0) {
    add(ESTIMATE_SAVE_ERRORS.UNRESOLVED_PRICING, "pricing.unresolvedItems", "価格が算出できない選択項目があります。");
  }
  for (const e of req.pricing.errors) {
    const mapped = PRICING_CODE_TO_SAVE_CODE[e.code];
    if (mapped) add(mapped, "pricing", e.message);
  }

  // Per-line identity integrity (exactly one authoritative identity source per line)
  for (const line of req.services) {
    if (line.pricingSource === "manual" && !line.manualPricingIdentity) {
      add(ESTIMATE_SAVE_ERRORS.UNKNOWN_PRICING_IDENTITY, "services", `「${line.label}」の手入力識別子がありません。`);
    }
    if (line.pricingSource === "catalog" && !line.pricingReferenceId) {
      add(ESTIMATE_SAVE_ERRORS.UNKNOWN_PRICING_IDENTITY, "services", `「${line.label}」のカタログ識別子がありません。`);
    }
  }

  // Unsupported discount selected but not applied → must block a final production save
  if (req.discount.intent.mode === "percentage" && !req.discount.intent.percentageSupported) {
    add(ESTIMATE_SAVE_ERRORS.VALIDATION_ERROR, "discount", "％値引きは本番未対応のため適用されません。金額値引きに変更してください。");
  }

  // Coupon must never be represented as financially applied while deferred
  if (req.coupon.status === "selected_not_priced" && !!req.coupon.appliedAmount) {
    add(ESTIMATE_SAVE_ERRORS.VALIDATION_ERROR, "coupon", "クーポンは未対応のため金額に反映できません。");
  }

  return { ok: issues.length === 0, issues };
}

/** Explicit save-readiness (§18) — no persistence implied. */
export function evaluateEstimateSaveReadiness(req: EstimateSaveRequest): EstimateSaveReadiness {
  const { ok, issues } = validateEstimateSaveRequest(req);
  return { status: ok ? "ready" : "invalid", issues };
}
