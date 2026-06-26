// DealerOS — Reputation Platform: Review LINE Message — Public API
//
// Sprint 11F: deterministic LINE review request message builder.
// LINE dispatch is deferred to Phase 11G+.
//
// Exports:
//   Types         — all type definitions from review-line-types.ts
//   Builder       — buildReviewLineMessage, validateReviewLineMessage, buildReviewLineMessagePreview
//   Link readiness — checkReviewLinkReadiness, linkReadinessStatusLabel

export type {
  ReviewLinkDestination,
  ReviewLinkReadinessStatus,
  ReviewLinkReadinessItem,
  ReviewLinkReadinessResult,
  ReviewLineMessageContext,
  ReviewLineMessagePayload,
  ReviewMessageViolation,
  ReviewLineMessageValidationResult,
  ReviewLineMessagePreview,
} from "./review-line-types";

export {
  buildReviewLineMessage,
  validateReviewLineMessage,
  buildReviewLineMessagePreview,
} from "./review-line-message-builder";

export {
  checkReviewLinkReadiness,
  linkReadinessStatusLabel,
} from "./review-link-readiness";
