// R90B Phase 1 — the pure decision core for sending a saved estimate over LINE.
//
// ── WHY THIS FILE IS PURE ───────────────────────────────────────────────────
// The transport modules it is driven by (`send-line-message.ts`,
// `create-line-message-log.ts`) are `server-only`, so a test that imported them
// would fail to resolve. Every decision that matters — ordering, recipient
// authority, the customer-visible text, and which typed outcome is returned —
// therefore lives HERE, behind injected dependencies, and is executed directly
// by `node --import tsx --test`. The Server Action shell over it holds no
// branching of its own, so there is nothing in the shipped decision path that
// the tests cannot reach.
//
// No "use server", no server-only, no React, no Supabase, no environment, no
// fetch, no clock. The one time value that exists (`sentAt`) arrives as data
// read from a persisted log, never from `Date`.

// The ONLY import: a type-only one, fully erased at runtime, so the core stays
// importable under `node --import tsx --test`. No value/runtime import exists.
import type { CreateShareOutcome, EstimateShareContext, PdfUnavailableReason } from "../estimates/estimate-share-types";

// ── Client-supplied surface (exactly two values, neither authoritative) ─────

/**
 * How the estimate is delivered. R92B adds `pdf-link`: the same text, plus a
 * revocable public URL to an immutable PDF snapshot. Absent → `text` (Phase-1
 * behaviour, byte-for-byte unchanged).
 */
export type EstimateDeliveryMode = "text" | "pdf-link";

/**
 * The operator's explicit intent. A closed union carrying NO recipient and NO
 * message data: the only thing a client may say is "I mean to send" / "I have
 * seen the prior send and mean to send again", plus an OPTIONAL delivery mode.
 */
export type EstimateResendAuthorization =
  | { readonly kind: "first-send"; readonly mode?: EstimateDeliveryMode }
  | { readonly kind: "confirmed-resend"; readonly mode?: EstimateDeliveryMode };

/**
 * Structural validation — fails closed on anything outside the closed shape.
 * The only permitted keys are `kind` (required) and `mode` (optional); `mode`,
 * when present, must be one of the two delivery literals.
 */
export function isEstimateResendAuthorization(value: unknown): value is EstimateResendAuthorization {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  for (const k of keys) {
    if (k !== "kind" && k !== "mode") return false;
  }
  const kind = (value as { kind: unknown }).kind;
  if (kind !== "first-send" && kind !== "confirmed-resend") return false;
  if ("mode" in (value as Record<string, unknown>)) {
    const mode = (value as { mode: unknown }).mode;
    if (mode !== "text" && mode !== "pdf-link") return false;
  }
  return true;
}

const ESTIMATE_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isValidEstimateId(value: unknown): boolean {
  return typeof value === "string" && ESTIMATE_ID_PATTERN.test(value);
}

// ── Outcomes ────────────────────────────────────────────────────────────────

export type EstimateLineSkipReason = "no-customer" | "not-linked";

export type EstimateLineBlockReason =
  | "estimate-not-found"
  | "line-disabled"
  | "no-access-token"
  /** Malformed estimate id or authorization shape — see the fail-closed rule in C. */
  | "invalid-request"
  /**
   * The duplicate-send preflight could not be answered. A read failure is NOT
   * evidence that nothing was sent, so it must never fall through to a send.
   */
  | "resend-check-unavailable";

export type EstimateLineResult =
  | { readonly kind: "sent" }
  | { readonly kind: "resend-required"; readonly sentAt: string | null }
  /**
   * A prior attempt exists but its delivery is unconfirmed (a `pending` log).
   * Distinct from `resend-required` so the UI can tell the operator the truth —
   * "we could not confirm the last send" — rather than "already sent".
   */
  | { readonly kind: "resend-required-indeterminate"; readonly attemptedAt: string | null }
  | { readonly kind: "skipped"; readonly reason: EstimateLineSkipReason }
  | { readonly kind: "blocked"; readonly reason: EstimateLineBlockReason }
  /** An explicit, attributable failure. `copyText` is the exact customer message. */
  | { readonly kind: "failed"; readonly message: string; readonly copyText: string }
  /** Delivery is INDETERMINATE — it may already have reached the customer. */
  | { readonly kind: "unknown"; readonly copyText: string }
  /**
   * pdf-link only: the share (snapshot + link) could NOT be produced, so no LINE
   * message was ever composed or sent. No side effect reached the customer.
   */
  | { readonly kind: "pdf-unavailable"; readonly reason: PdfUnavailableReason };

/** Fixed operator-facing strings. No server detail, no PII, no raw error text. */
export const ESTIMATE_LINE_LOG_UNAVAILABLE_MESSAGE =
  "送信記録を作成できなかったため、送信を中止しました。時間をおいて再度お試しください。";
export const ESTIMATE_LINE_SEND_FAILED_MESSAGE =
  "LINEの送信に失敗しました。下のメッセージをコピーして送信してください。";

// ── Injected world ──────────────────────────────────────────────────────────

/** The persisted, customer-safe projection of an estimate. Nothing else is read. */
export interface EstimateLineSource {
  /** Derived server-side from the dealer-scoped estimate row. */
  readonly customerId: string | null;
  /** `estimate_number ?? estimate_no`, already resolved. */
  readonly estimateNumber: string | null;
  /**
   * NULLABLE on purpose. A missing total is a missing fact — coercing it to 0
   * would put 「合計金額: ¥0」 in front of a customer, which is not an absent
   * value but a WRONG one.
   */
  readonly total: number | null;
  readonly validUntil: string | null;
}

/**
 * The duplicate-send preflight, as three DISTINCT answers.
 *
 * "no row" and "the query failed" are different facts and must not share a
 * representation: collapsing them lets a transient read error authorise a second
 * delivery to a customer who already received the estimate.
 */
export type EstimateResendProbe =
  | { readonly kind: "none" }
  | { readonly kind: "sent"; readonly sentAt: string | null }
  /**
   * The latest relevant attempt is `pending` — it was created but never resolved
   * to sent or failed. Delivery is INDETERMINATE: the message may have reached
   * the customer. `attemptedAt` is the row's `created_at`, never a delivery time.
   */
  | { readonly kind: "indeterminate"; readonly attemptedAt: string | null }
  | { readonly kind: "unavailable" };

export interface EstimateLineRecipient {
  readonly lineCustomerId: string;
  readonly lineUserId: string;
}

export interface EstimateLineConfig {
  readonly enabled: boolean;
  readonly hasAccessToken: boolean;
}

/** What the transport reports back. A THROW is handled by the caller as `unknown`. */
export type EstimateLineTransportOutcome =
  | { readonly kind: "sent" }
  /** `requireLog` was set and the pending log could not be created: nothing was sent. */
  | { readonly kind: "log-unavailable" }
  | { readonly kind: "failed" };

export interface EstimateLineCoreDeps {
  /** Dealer-scoped (id AND dealer_id). `null` for a foreign or missing estimate. */
  readonly loadEstimate: (estimateId: string) => Promise<EstimateLineSource | null>;
  /** Resolved by dealer_id + customer_id + is_friend=true. Never from client input. */
  readonly loadRecipient: (customerId: string) => Promise<EstimateLineRecipient | null>;
  readonly loadConfig: () => Promise<EstimateLineConfig>;
  /** Newest `sent` estimate log for this estimate. Read-only, three-valued. */
  readonly probeLastSent: (estimateId: string) => Promise<EstimateResendProbe>;
  /** The dealer's business name, or null when unset. Never defaulted. */
  readonly loadBusinessName: () => Promise<string | null>;
  /**
   * pdf-link only: create a revocable share (immutable snapshot + tokenized URL).
   * Runs AFTER the resend preflight and is the FIRST side effect in that mode. A
   * non-`created` outcome aborts the send with `pdf-unavailable` — no LINE call is
   * made. The raw token lives only inside the returned `share.url`.
   */
  readonly createShareLink: (estimateId: string) => Promise<CreateShareOutcome>;
  /**
   * Performs the side-effecting send. Creates the pending log FIRST (requireLog),
   * then touches last_message_at, then calls LINE. May THROW for a network /
   * indeterminate outcome — the caller maps that to `unknown`. `mode` and the
   * optional `share` let the wrapper compose the correct log metadata (the token
   * is never among those fields).
   */
  readonly send: (params: {
    readonly recipient: EstimateLineRecipient;
    readonly customerId: string;
    readonly estimateId: string;
    readonly text: string;
    readonly mode: EstimateDeliveryMode;
    readonly share: EstimateShareContext | null;
  }) => Promise<EstimateLineTransportOutcome>;
}

// ── Customer-safe text ──────────────────────────────────────────────────────

/** Group an integer with ASCII commas. Locale-independent, so tests are stable. */
function groupYen(n: number): string {
  const negative = n < 0;
  const digits = Math.trunc(Math.abs(n)).toString();
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return `${negative ? "-" : ""}${out}`;
}

/**
 * The EXACT customer-visible message.
 *
 * Persisted, customer-safe fields only. A line whose source is null is OMITTED —
 * never replaced with a placeholder, never invented. `internal_memo`, dealer
 * cost, margin, internal ids, staff names and operator notes are not parameters
 * of this function, so they are unreachable rather than merely unused.
 */
export function buildEstimateLineText(input: {
  readonly estimateNumber: string | null;
  readonly total: number | null;
  readonly validUntil: string | null;
  readonly businessName: string | null;
  /**
   * pdf-link only. When present, the customer-visible message gains a PDF link
   * block. In `text` mode this is null/absent and the message is byte-for-byte
   * the Phase-1 text.
   */
  readonly shareUrl?: string | null;
}): string {
  const lines: string[] = [];
  // Every line is conditional on its OWN persisted source. A missing number
  // omits the header outright rather than sending a bare 【お見積書】, and a
  // missing total omits the amount rather than quoting ¥0.
  if (input.estimateNumber && input.estimateNumber.trim()) {
    lines.push(`【お見積書】${input.estimateNumber}`);
  }
  lines.push("お車のお見積をお送りします。");
  if (input.total !== null) lines.push(`合計金額: ¥${groupYen(input.total)}`);
  if (input.validUntil) lines.push(`有効期限: ${input.validUntil}`);
  if (input.businessName) lines.push(input.businessName);
  // The PDF link is the LAST block, appended only in pdf-link mode. It is the one
  // place the raw token appears in the delivered message.
  if (input.shareUrl) {
    lines.push("お見積書（PDF）は下記からご確認いただけます。");
    lines.push(input.shareUrl);
  }
  return lines.join("\n");
}

// ── The decision core ───────────────────────────────────────────────────────

/**
 * One send attempt, in a fixed, observable order:
 *
 *   1. validate the two client values                    (fail closed)
 *   2. load the dealer-scoped estimate                   → estimate-not-found
 *   3. derive customer_id from the PERSISTED estimate    → no-customer
 *   4. resolve the recipient (dealer + customer + friend) → not-linked
 *   5. read LINE configuration                           → line-disabled / no-access-token
 *   6. RESEND PREFLIGHT                                  → resend-required
 *   6b. pdf-link ONLY: create the share                 → pdf-unavailable
 *   7. build the customer-safe text (+ link in pdf-link)
 *   8. send (pending log → last_message_at → LINE)
 *
 * Steps 1-6 perform NO writes: no share, no pending log, no LINE call is made
 * before the resend decision. In `text` mode step 8 is the first and only side
 * effect; in `pdf-link` mode the share creation (6b) is the first side effect,
 * and a LINE failure afterwards LEAVES THE SHARE ACTIVE so the operator can
 * deliver the link by hand from `copyText`.
 */
export async function runEstimateLineSend(
  deps: EstimateLineCoreDeps,
  estimateId: unknown,
  authorization: unknown,
): Promise<EstimateLineResult> {
  // 1. Fail closed on anything malformed, before any dependency is touched.
  if (!isValidEstimateId(estimateId) || !isEstimateResendAuthorization(authorization)) {
    return { kind: "blocked", reason: "invalid-request" };
  }
  const id = estimateId as string;
  // Absent mode is Phase-1 text — the default preserves existing behaviour.
  const mode: EstimateDeliveryMode = authorization.mode ?? "text";

  // 2-3. The estimate is the only source of the customer.
  const estimate = await deps.loadEstimate(id);
  if (!estimate) return { kind: "blocked", reason: "estimate-not-found" };
  if (!estimate.customerId) return { kind: "skipped", reason: "no-customer" };

  // 4. The recipient is derived, never supplied.
  const recipient = await deps.loadRecipient(estimate.customerId);
  if (!recipient) return { kind: "skipped", reason: "not-linked" };

  // 5. Configuration.
  const config = await deps.loadConfig();
  if (!config.enabled) return { kind: "blocked", reason: "line-disabled" };
  if (!config.hasAccessToken) return { kind: "blocked", reason: "no-access-token" };

  // 6. Resend preflight — before any write, and FAIL CLOSED on an unreadable or
  // unconfirmed answer. A `sent` row means resend-required; a `pending` row means
  // the last attempt's delivery is UNCONFIRMED, which must warn distinctly rather
  // than be read as "no attempt". Either way nothing is sent until the operator
  // supplies { kind: "confirmed-resend" }.
  if (authorization.kind === "first-send") {
    const probe = await deps.probeLastSent(id);
    if (probe.kind === "unavailable") return { kind: "blocked", reason: "resend-check-unavailable" };
    if (probe.kind === "sent") return { kind: "resend-required", sentAt: probe.sentAt };
    if (probe.kind === "indeterminate") {
      return { kind: "resend-required-indeterminate", attemptedAt: probe.attemptedAt };
    }
  }

  // 6b. pdf-link ONLY: mint the share BEFORE composing the message. A failure
  // here aborts with `pdf-unavailable` and NO LINE call — nothing reached the
  // customer. In text mode this block is skipped entirely.
  let share: EstimateShareContext | null = null;
  if (mode === "pdf-link") {
    const created = await deps.createShareLink(id);
    if (created.kind !== "created") {
      return { kind: "pdf-unavailable", reason: created.reason };
    }
    share = created.share;
  }

  // 7. The text, from persisted fields only (+ the link in pdf-link mode).
  const text = buildEstimateLineText({
    estimateNumber: estimate.estimateNumber,
    total: estimate.total,
    validUntil: estimate.validUntil,
    businessName: await deps.loadBusinessName(),
    shareUrl: share?.url ?? null,
  });

  // 8. The single side effect.
  let outcome: EstimateLineTransportOutcome;
  try {
    outcome = await deps.send({
      recipient,
      customerId: estimate.customerId,
      estimateId: id,
      text,
      mode,
      share,
    });
  } catch {
    // THROWN / network: the pending log stays as it is and the SERVER outcome is
    // indeterminate. Reporting `failed` here would licence a retry under the
    // assumption nothing was delivered.
    return { kind: "unknown", copyText: text };
  }

  if (outcome.kind === "sent") return { kind: "sent" };

  // A missing pending log means NO LINE request was made, so it is never
  // `unknown`: delivery is not indeterminate, it provably did not happen.
  if (outcome.kind === "log-unavailable") {
    return { kind: "failed", message: ESTIMATE_LINE_LOG_UNAVAILABLE_MESSAGE, copyText: text };
  }

  return { kind: "failed", message: ESTIMATE_LINE_SEND_FAILED_MESSAGE, copyText: text };
}
