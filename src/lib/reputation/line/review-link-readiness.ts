// DealerOS — Reputation Platform: Review Link Readiness (Sprint 11F Phase C)
//
// Pure link readiness validator. No "use server". No external imports. No side effects.
//
// checkReviewLinkReadiness() — validates which review destination URLs are configured
//   and ready to be included in the LINE message payload.
//
// Supported destinations (Sprint 11F):
//   google_review       — Google Business Profile review URL
//   website_testimonial — Dealer website testimonial / review page URL
//   instagram           — Instagram profile URL
//   facebook_review     — Facebook page review URL
//   custom_url          — (future) any other platform
//
// All destination URLs except website_url (from dealer_settings.business_website)
// are null in Sprint 11F because no reputation settings DB table exists yet.
// The readiness result documents this constraint clearly via status values.
//
// Future:
//   When the reputation_settings table is created (CTO approval pending),
//   google_review_url, instagram_url, and facebook_url will be populated
//   from dealer-configured settings. The context shape and this validator
//   will not change — only the URL values will become non-null.

import type {
  ReviewLineMessageContext,
  ReviewLinkReadinessItem,
  ReviewLinkReadinessResult,
  ReviewLinkReadinessStatus,
  ReviewLinkDestination,
} from "./review-line-types";

// ─── checkReviewLinkReadiness ──────────────────────────────────────────────────

/**
 * checkReviewLinkReadiness — per-destination URL readiness report.
 *
 * Evaluates four supported destinations against the provided context.
 * Returns a structured result the UI can render as a readiness checklist.
 *
 * In Sprint 11F:
 *   - google_review:       always missing_google_review_url  (no reputation settings table)
 *   - website_testimonial: ready if dealer_settings.business_website is set
 *   - instagram:           always missing_destination         (no reputation settings table)
 *   - facebook_review:     always missing_destination         (no reputation settings table)
 */
export function checkReviewLinkReadiness(
  ctx: ReviewLineMessageContext,
): ReviewLinkReadinessResult {
  const items: ReviewLinkReadinessItem[] = [];

  // ── Google Business Profile ────────────────────────────────────────────────────
  items.push({
    destination:          "google_review",
    label:                "Googleクチコミ",
    status:               ctx.google_review_url
                            ? "ready"
                            : "missing_google_review_url",
    url:                  ctx.google_review_url,
    included_in_message:  ctx.google_review_url !== null,
  });

  // ── Website testimonial ────────────────────────────────────────────────────────
  items.push({
    destination:          "website_testimonial",
    label:                "公式サイト（お客様の声）",
    status:               ctx.website_url ? "ready" : "missing_destination",
    url:                  ctx.website_url,
    included_in_message:  ctx.website_url !== null,
  });

  // ── Instagram ──────────────────────────────────────────────────────────────────
  items.push({
    destination:          "instagram",
    label:                "Instagram",
    status:               ctx.instagram_url ? "ready" : "missing_destination",
    url:                  ctx.instagram_url,
    included_in_message:  ctx.instagram_url !== null,
  });

  // ── Facebook review ────────────────────────────────────────────────────────────
  items.push({
    destination:          "facebook_review",
    label:                "Facebookレビュー",
    status:               ctx.facebook_url ? "ready" : "missing_destination",
    url:                  ctx.facebook_url,
    included_in_message:  ctx.facebook_url !== null,
  });

  // ── Aggregate ──────────────────────────────────────────────────────────────────
  const ready_count       = items.filter((i) => i.status === "ready").length;
  const has_any_url       = ready_count > 0;

  // Primary destination: prefer Google, fall back to first ready destination
  const primary_destination: ReviewLinkDestination | null =
    items.find((i) => i.destination === "google_review" && i.status === "ready")?.destination
    ?? items.find((i) => i.status === "ready")?.destination
    ?? null;

  const overall: ReviewLinkReadinessStatus =
    has_any_url ? "ready" : "missing_destination";

  return {
    overall,
    items,
    ready_count,
    has_any_url,
    primary_destination,
  };
}

// ─── Helpers for UI ────────────────────────────────────────────────────────────

/** Human-readable label for a ReviewLinkReadinessStatus value. */
export function linkReadinessStatusLabel(status: ReviewLinkReadinessStatus): string {
  switch (status) {
    case "ready":                       return "設定済み";
    case "missing_google_review_url":   return "Google口コミURLが未設定";
    case "missing_line_customer_link":  return "LINE連携が未設定";
    case "missing_dealer_line_settings":return "LINE設定が未完了";
    case "missing_destination":         return "URLが未設定";
    case "feature_disabled":            return "無効";
  }
}
