// Estimate Wizard Ver2.2 — Integration readiness validator (Phase 8-B1E).
//
// PURE. No React, no server module, no DB, no API, no FormData, no pricing, no randomness, no
// clock, no casts. It reads an opaque hydrated draft and decides whether it may be applied back to
// EstimateEditor and persisted through the canonical save path.
//
// ── THE TWO RULES THAT MATTER ───────────────────────────────────────────────────
// 1. This validator accepts a `HydratedWizardDraft` — the module-private opaque class produced by
//    `estimateToWizardDraft()` / `newEstimateWizardDraft()`. A bare `EstimateWizardDraftV22` does
//    not compile here, and neither does a forged literal or a spread copy: the private witness on
//    the implementation class makes the type nominal.
//
// 2. Apply and persist share ONE gate. `canApplyToEstimateEditor` and `canPersist` are both false
//    when any blocking issue exists. There is deliberately no state in which a draft may be applied
//    to the editor but not saved — that asymmetry is exactly how a legacy estimate would end up
//    written back with an empty Screen-4 configuration.
//
// ── WHAT BLOCKS APPLY AND PERSIST ───────────────────────────────────────────────
//   1. Unresolved legacy items      — persisted items that could not be rebuilt.
//   2. Untrustworthy reconstruction — reconstructionStatus is "none" or "partial".
//   3. Invalid source estimate id   — an existing estimate with no id cannot be written back.
//   4. Percentage discount present  — no persisted column exists (Architect Ruling 10).
//   5. Coupon selection present     — no persisted column exists (Architect Ruling 10).
//
// (4) and (5) preserve the operator's input exactly — scalar stays scalar, array stays array. They
// are never applied to pricing, never persisted, never serialized into notes, metadata, or any JSON
// structure, and never silently cleared. They simply cannot be saved yet, and this says so.

import {
  INTEGRATION_ISSUE_CODES,
  hasUnresolvedLegacyItems,
  hasValidSourceEstimateId,
  integrationIssueKey,
  isServiceConfigurationTrustworthy,
  type IntegrationIssue,
  type IntegrationValidationResult,
} from "./estimateWizardIntegrationContract";
import type { HydratedWizardDraft } from "./estimateToWizardDraft";

/** Keep the first occurrence of each (code, field). Hydration and validation can raise the same issue. */
function dedupeIssues(issues: readonly IntegrationIssue[]): IntegrationIssue[] {
  const seen = new Set<string>();
  const unique: IntegrationIssue[] = [];
  for (const issue of issues) {
    const key = integrationIssueKey(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(issue);
  }
  return unique;
}

/**
 * Decide whether a hydrated Wizard draft may be applied back to EstimateEditor and persisted.
 *
 * Pure: reads the draft, calls nothing, mutates nothing, computes no price, clears no value.
 *
 * The returned `issues` carry every hydration issue PLUS every issue raised here, deduplicated by
 * (code, field), so a caller that only ever sees this result still sees the complete picture.
 */
export function validateWizardDraftForEstimateEditorIntegration(
  hydrated: HydratedWizardDraft,
): IntegrationValidationResult {
  const { draft, integration } = hydrated;

  // Hydration issues are carried forward verbatim — never dropped, never downgraded.
  const collected: IntegrationIssue[] = [...integration.issues];

  // ── 1. Unresolved legacy items ────────────────────────────────────────────────
  // The estimate holds real persisted line items that no structured Wizard configuration accounts
  // for. Applying this draft would replace them with an empty Screen-4 configuration.
  if (hasUnresolvedLegacyItems(integration)) {
    collected.push({
      code:     INTEGRATION_ISSUE_CODES.UNRESOLVED_LEGACY_ITEMS,
      field:    "integration.unresolvedItemIds",
      severity: "blocking",
      message:
        "既存の見積明細をウィザードの施工内容として復元できていないため、この内容では反映・保存できません。" +
        "施工内容を選び直してください（元の見積は変更されません）。",
    });
  }

  // ── 2. Untrustworthy reconstruction ───────────────────────────────────────────
  // Belt-and-braces with (1): the status alone must also be sufficient to block. An empty
  // serviceConfiguration is NEVER treated as a successfully restored estimate.
  if (!isServiceConfigurationTrustworthy(integration)) {
    collected.push({
      code:     INTEGRATION_ISSUE_CODES.SERVICE_CONFIGURATION_NOT_RECONSTRUCTED,
      field:    "integration.reconstructionStatus",
      severity: "blocking",
      message:
        "この見積は構造化された施工内容を保持していないため、ウィザードからの反映・保存はできません。",
    });
  }

  // ── 3. Invalid source estimate id ─────────────────────────────────────────────
  // An existing estimate with no usable id cannot be written back to the right row.
  if (!hasValidSourceEstimateId(integration)) {
    collected.push({
      code:     INTEGRATION_ISSUE_CODES.INVALID_SOURCE_ESTIMATE_ID,
      field:    "integration.sourceEstimateId",
      severity: "blocking",
      message:  "元の見積を特定できないため、この内容は反映・保存できません。",
    });
  }

  // ── 4. Percentage discount — no persisted column ──────────────────────────────
  if (draft.discountAndCoupon.percentInput.trim() !== "") {
    collected.push({
      code:     INTEGRATION_ISSUE_CODES.UNSUPPORTED_PERCENTAGE_DISCOUNT_PERSISTENCE,
      field:    "discountAndCoupon.percentInput",
      severity: "blocking",
      message:
        "％値引きは現在の保存項目に対応していないため、この内容では保存できません。" +
        "金額での値引きに変更してください。",
    });
  }

  // ── 5. Coupon selection — no persisted column ─────────────────────────────────
  if (draft.discountAndCoupon.selectedCouponIds.length > 0) {
    collected.push({
      code:     INTEGRATION_ISSUE_CODES.UNSUPPORTED_COUPON_PERSISTENCE,
      field:    "discountAndCoupon.selectedCouponIds",
      severity: "blocking",
      message:
        "クーポンは現在の保存項目に対応していないため、この内容では保存できません。" +
        "クーポンの選択を解除してください。",
    });
  }

  const issues = dedupeIssues(collected);
  const blockingIssues = issues.filter((i) => i.severity === "blocking");
  const ready = blockingIssues.length === 0;

  return {
    canApplyToEstimateEditor: ready,
    canPersist: ready, // one gate — never apply-but-not-save
    issues,
    blockingIssues,
  };
}
