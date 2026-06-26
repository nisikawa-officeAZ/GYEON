// DealerOS — Reputation Platform: Review LINE Message Builder (Sprint 11F Phase A/B)
//
// Deterministic, pure message builder. No AI inference. No LINE API calls.
// No external dependencies. No side effects.
//
// buildReviewLineMessage() — produces a Japanese customer-facing LINE message
//   that thanks the customer, asks for voluntary feedback, and includes
//   configured review destination URLs.
//
// validateReviewLineMessage() — checks the built message against compliance rules:
//   1. No incentive-for-review language
//   2. No pressure language
//   3. No positive-only solicitation
//   4. Voluntary indicator must be present
//
// buildReviewLineMessagePreview() — combines payload + validation + link readiness
//   into the ReviewLineMessagePreview type consumed by the UI.
//
// Message compliance rules (Phase B):
//   * Thank the customer — always present
//   * Voluntary ask — "もしよろしければ" — never pressure
//   * No reward language — no クーポン, 特典, ポイント
//   * No selective targeting language — no "良い口コミのみ" etc.
//   * Dealer name included when available
//   * Service summary included when ≤ 60 characters (privacy-safe cutoff)
//   * URLs included only when non-null
//   * Voluntary indicator "投稿は任意です" always appended
//
// LINE text message limit: 5000 characters (Messaging API).
// Practical target for review messages: ≤ 450 characters for readability.

import type {
  ReviewLineMessageContext,
  ReviewLineMessagePayload,
  ReviewLineMessageValidationResult,
  ReviewMessageViolation,
  ReviewLinkDestination,
  ReviewLineMessagePreview,
} from "./review-line-types";
import { checkReviewLinkReadiness } from "./review-link-readiness";

// LINE Messaging API text message character limit
const LINE_TEXT_MESSAGE_LIMIT = 5000;

// Maximum service summary length to include in the message (privacy-safe cutoff)
const SERVICE_SUMMARY_MAX_INCLUDE = 60;

// ─── Message section builders ──────────────────────────────────────────────────

function buildGreeting(ctx: ReviewLineMessageContext): string {
  const name = ctx.customer_last_name?.trim() ?? "";
  return name ? `${name}様` : "お客様";
}

function buildOpeningLine(ctx: ReviewLineMessageContext): string {
  const dealer = ctx.dealer_name?.trim() ?? "";
  if (dealer) {
    return `この度は${dealer}をご利用いただき、誠にありがとうございました。`;
  }
  return "この度はご利用いただき、誠にありがとうございました。";
}

function buildServiceLine(ctx: ReviewLineMessageContext): string | null {
  const summary = ctx.service_summary?.trim() ?? "";
  if (!summary || summary.length > SERVICE_SUMMARY_MAX_INCLUDE) return null;
  return `${summary}を承りました。`;
}

function buildRequestLine(): string {
  return "もしよろしければ、今回のご感想をお聞かせいただけますと幸いです。いただいたご意見はサービス向上の参考にさせていただきます。";
}

function buildUrlSection(ctx: ReviewLineMessageContext): string | null {
  const lines: string[] = [];

  if (ctx.google_review_url) {
    lines.push(`■ Googleクチコミ\n${ctx.google_review_url}`);
  }
  if (ctx.website_url) {
    lines.push(`■ 公式サイト\n${ctx.website_url}`);
  }
  if (ctx.instagram_url) {
    lines.push(`■ Instagram\n${ctx.instagram_url}`);
  }
  if (ctx.facebook_url) {
    lines.push(`■ Facebook\n${ctx.facebook_url}`);
  }

  return lines.length > 0 ? lines.join("\n\n") : null;
}

function buildFooter(): string {
  return "※ 投稿は任意です。お気軽にどうぞ。";
}

function getIncludedDestinations(ctx: ReviewLineMessageContext): ReviewLinkDestination[] {
  const dests: ReviewLinkDestination[] = [];
  if (ctx.google_review_url)  dests.push("google_review");
  if (ctx.website_url)        dests.push("website_testimonial");
  if (ctx.instagram_url)      dests.push("instagram");
  if (ctx.facebook_url)       dests.push("facebook_review");
  return dests;
}

// ─── buildReviewLineMessage ────────────────────────────────────────────────────

/**
 * buildReviewLineMessage — deterministic LINE message builder.
 *
 * Produces a Japanese, compliance-safe review request message.
 * No AI inference. No LINE API calls. No randomness.
 *
 * The generated message always:
 *   - Greets the customer by name when available
 *   - Thanks the customer for their visit
 *   - Asks for voluntary feedback using "もしよろしければ"
 *   - Includes review destination URLs when configured
 *   - Ends with a voluntary indicator: "投稿は任意です"
 *
 * The message never:
 *   - Offers incentives (no クーポン, 特典, ギフト)
 *   - Pressures the customer (no 必ず, ぜひ高評価, お願いします！)
 *   - Requests only positive reviews
 *   - Contains fake customer review text
 */
export function buildReviewLineMessage(
  ctx:  ReviewLineMessageContext,
  now:  string,
): ReviewLineMessagePayload {
  const greeting  = buildGreeting(ctx);
  const opening   = buildOpeningLine(ctx);
  const service   = buildServiceLine(ctx);
  const request   = buildRequestLine();
  const urlBlock  = buildUrlSection(ctx);
  const footer    = buildFooter();

  // Body paragraph: opening + optional service line
  const bodyLines = [opening];
  if (service) bodyLines.push(service);
  const body = bodyLines.join("\n");

  // Assemble all parts, separating with blank lines
  const parts = [greeting, body, request];
  if (urlBlock) parts.push(urlBlock);
  parts.push(footer);

  const message_text       = parts.join("\n\n");
  const character_count    = message_text.length;
  const line_count         = message_text.split("\n").length;
  const destinations       = getIncludedDestinations(ctx);

  return {
    message_text,
    character_count,
    line_count,
    includes_url:           destinations.length > 0,
    destinations_included:  destinations,
    is_ready_to_send:       false,
    send_blocked_reason:
      "LINE dispatch deferred to Phase 11G+ — real sending requires dealer LINE settings and explicit dispatch approval",
    built_at: now,
  };
}

// ─── Compliance validation ─────────────────────────────────────────────────────

// Patterns that indicate reward-for-review — all blocking violations
const INCENTIVE_PATTERNS: string[] = [
  "口コミで特典",
  "口コミを書くと",
  "口コミ投稿で",
  "クーポンプレゼント",
  "レビューを書いていただいた方",
  "口コミ割引",
];

// Patterns that pressure the customer into reviewing — all blocking violations
const PRESSURE_PATTERNS: string[] = [
  "ぜひ高評価",
  "必ず口コミ",
  "高評価をお願い",
  "5つ星をお願い",
  "星5をお願い",
  "お願いします！",
  "お願いいたします！",
];

// Patterns that solicit only positive reviews — all blocking violations
const POSITIVE_ONLY_PATTERNS: string[] = [
  "良い口コミのみ",
  "ポジティブな口コミ",
  "高評価の口コミ",
  "5つ星のみ",
  "星5のみ",
  "悪いレビューは送らないでください",
];

// The message must contain at least one voluntary indicator
const VOLUNTARY_INDICATORS: string[] = [
  "任意",
  "お気軽に",
  "よろしければ",
  "もしよろしければ",
];

/**
 * validateReviewLineMessage — compliance check on a built message payload.
 *
 * The builder always generates compliant messages, so violations should never
 * appear for standard builds. This validator exists as a future guard against
 * hand-edited drafts (Phase 11G+ when editing becomes possible).
 */
export function validateReviewLineMessage(
  payload: ReviewLineMessagePayload,
): ReviewLineMessageValidationResult {
  const text       = payload.message_text;
  const violations: ReviewMessageViolation[] = [];

  for (const pattern of INCENTIVE_PATTERNS) {
    if (text.includes(pattern)) {
      violations.push({
        rule:        "no_incentive_offer",
        description: `Incentive language detected: "${pattern}" — offering rewards for reviews is prohibited`,
        blocking:    true,
      });
    }
  }

  for (const pattern of PRESSURE_PATTERNS) {
    if (text.includes(pattern)) {
      violations.push({
        rule:        "no_pressure_language",
        description: `Pressure language detected: "${pattern}" — customers must not be pressured to review`,
        blocking:    true,
      });
    }
  }

  for (const pattern of POSITIVE_ONLY_PATTERNS) {
    if (text.includes(pattern)) {
      violations.push({
        rule:        "no_selective_targeting",
        description: `Positive-only solicitation detected: "${pattern}" — all reviews must be welcome, not just positive`,
        blocking:    true,
      });
    }
  }

  const hasVoluntaryIndicator = VOLUNTARY_INDICATORS.some((ind) => text.includes(ind));
  if (!hasVoluntaryIndicator) {
    violations.push({
      rule:        "voluntary_and_authentic",
      description: "Message must include a voluntary indicator (e.g. '任意', 'お気軽に', 'もしよろしければ')",
      blocking:    true,
    });
  }

  return {
    passed:             violations.length === 0,
    violations,
    within_line_limit:  payload.character_count <= LINE_TEXT_MESSAGE_LIMIT,
    character_count:    payload.character_count,
  };
}

// ─── buildReviewLineMessagePreview ────────────────────────────────────────────

/**
 * buildReviewLineMessagePreview — assembles the full preview package for the UI.
 *
 * Combines:
 *   - buildReviewLineMessage() — message text
 *   - validateReviewLineMessage() — compliance result
 *   - checkReviewLinkReadiness() — per-destination URL readiness
 *
 * dispatch_payload: always null in Sprint 11F.
 */
export function buildReviewLineMessagePreview(
  ctx: ReviewLineMessageContext,
  now: string,
): ReviewLineMessagePreview {
  const payload       = buildReviewLineMessage(ctx, now);
  const validation    = validateReviewLineMessage(payload);
  const linkReadiness = checkReviewLinkReadiness(ctx);

  return {
    payload,
    validation,
    link_readiness:   linkReadiness,
    dispatch_payload: null,
  };
}
