// DealerOS — Reputation Platform: Review LINE Message Types (Sprint 11F Phase A)
//
// Pure types — no "use server", no external imports, no side effects.
// Used by message builder, link readiness checker, server actions, and the UI.
//
// LINE dispatch: always deferred in Sprint 11F.
// All payload types carry is_ready_to_send: false and dispatch_payload: null
// to document that real LINE sending requires Phase 11G+.

// ─── Link destination types ────────────────────────────────────────────────────

/**
 * ReviewLinkDestination — platforms where a customer review can be left.
 * "custom_url" covers any future platform not yet enumerated.
 */
export type ReviewLinkDestination =
  | "google_review"
  | "instagram"
  | "website_testimonial"
  | "facebook_review"
  | "custom_url";

/**
 * ReviewLinkReadinessStatus — per-destination readiness state.
 *
 * "ready"                       — URL configured and usable
 * "missing_google_review_url"   — Google Business Profile review URL not set
 * "missing_line_customer_link"  — Customer not linked to LINE (future check)
 * "missing_dealer_line_settings"— Dealer LINE channel not configured (future check)
 * "missing_destination"         — No URL configured for this destination
 * "feature_disabled"            — Feature explicitly turned off by dealer
 */
export type ReviewLinkReadinessStatus =
  | "ready"
  | "missing_google_review_url"
  | "missing_line_customer_link"
  | "missing_dealer_line_settings"
  | "missing_destination"
  | "feature_disabled";

/** Per-destination readiness item — one row in the link readiness report. */
export interface ReviewLinkReadinessItem {
  destination:          ReviewLinkDestination;
  label:                string;
  status:               ReviewLinkReadinessStatus;
  /** The configured URL — null if not yet set. */
  url:                  string | null;
  /** True when this destination's URL is included in the built message. */
  included_in_message:  boolean;
}

/** Overall link readiness result across all supported destinations. */
export interface ReviewLinkReadinessResult {
  overall:              ReviewLinkReadinessStatus;
  items:                ReviewLinkReadinessItem[];
  ready_count:          number;
  has_any_url:          boolean;
  /** The highest-priority destination with a configured URL. */
  primary_destination:  ReviewLinkDestination | null;
}

// ─── Message context ───────────────────────────────────────────────────────────

/**
 * ReviewLineMessageContext — all input the builder needs.
 *
 * Caller is responsible for fetching all fields from server-side sources.
 * No secrets — no LINE tokens, no API keys.
 *
 * google_review_url / instagram_url: always null in Sprint 11F (no reputation
 * settings DB table). website_url comes from dealer_settings.business_website.
 */
export interface ReviewLineMessageContext {
  dealer_id:            string;
  dealer_name:          string | null;
  customer_last_name:   string | null;
  customer_first_name:  string | null;
  /** Pre-computed vehicle label — e.g. "トヨタ アルファード 品川300あ1234" */
  vehicle_label:        string | null;
  service_summary:      string | null;
  google_review_url:    string | null;
  website_url:          string | null;
  instagram_url:        string | null;
  facebook_url:         string | null;
  language_preference:  "ja" | "en";
}

// ─── Message payload ───────────────────────────────────────────────────────────

/**
 * ReviewLineMessagePayload — the fully built message ready for UI preview.
 *
 * is_ready_to_send: false — permanently set in Sprint 11F.
 * LINE sending requires dealer LINE settings + explicit dispatch approval (Phase 11G+).
 */
export interface ReviewLineMessagePayload {
  message_text:           string;
  character_count:        number;
  line_count:             number;
  includes_url:           boolean;
  destinations_included:  ReviewLinkDestination[];
  /** Always false in Sprint 11F — LINE dispatch deferred to Phase 11G+ */
  is_ready_to_send:       false;
  /** Explains why LINE sending is not available in Sprint 11F */
  send_blocked_reason:    string;
  built_at:               string;
}

// ─── Validation ────────────────────────────────────────────────────────────────

/** A single compliance violation detected in the message text. */
export interface ReviewMessageViolation {
  rule:        string;
  description: string;
  blocking:    boolean;
}

/**
 * ReviewLineMessageValidationResult — compliance guard result for the built message.
 *
 * The builder always produces compliant messages, so violations should be empty
 * for messages built by buildReviewLineMessage(). The validator exists as a future
 * guard against hand-edited drafts introduced in Phase 11G+.
 */
export interface ReviewLineMessageValidationResult {
  passed:            boolean;
  violations:        ReviewMessageViolation[];
  within_line_limit: boolean;
  character_count:   number;
}

// ─── Preview ───────────────────────────────────────────────────────────────────

/**
 * ReviewLineMessagePreview — the complete preview package returned to the UI.
 *
 * Combines message payload, validation, and link readiness into one object
 * so the UI can render everything with a single field check.
 *
 * dispatch_payload: null — always null in Sprint 11F.
 * Real dispatch requires Phase 11G+ (dealer LINE settings + review_requests table).
 */
export interface ReviewLineMessagePreview {
  payload:           ReviewLineMessagePayload;
  validation:        ReviewLineMessageValidationResult;
  link_readiness:    ReviewLinkReadinessResult;
  /** Always null in Sprint 11F — real LINE dispatch deferred to Phase 11G+ */
  dispatch_payload:  null;
}
