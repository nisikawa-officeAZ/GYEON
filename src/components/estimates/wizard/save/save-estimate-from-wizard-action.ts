"use server";

// Estimate Wizard Ver2.2 — Server save orchestration entry (Phase 11E).
//
// The one server-side entry point for saving a wizard estimate. It: (1) verifies the authenticated
// user, (2) resolves the dealer via getCurrentDealer() (NEVER from the client), (3) enforces the
// existing staff permission gate, then (4) delegates to the pure orchestration core (validation →
// pricing completeness → future atomic RPC). It performs NO database write, NO number allocation, NO
// inventory reservation, NO PDF, and does NOT mutate the wizard draft or EstimateEditor. Persistence is
// the future atomic RPC — currently a controlled RPC_NOT_IMPLEMENTED placeholder.

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import type { EstimateSaveRequest } from "./estimate-save-dto";
import { EstimatePersistenceService } from "./estimate-persistence-service";
import { notImplementedPersistenceGateway } from "./estimate-persistence-gateway";
import {
  ESTIMATE_SAVE_ACTION_ERRORS, logEstimateSaveStage, type EstimateSaveActionResult,
} from "./estimate-save-orchestration-types";
// The SINGLE pattern authority, byte-identical to the RPC's own `^[A-Za-z0-9_-]{16,64}$`.
// Imported, never re-declared: a second copy could drift out of step with SQL.
import { IDEMPOTENCY_KEY_PATTERN } from "./wizard-save-intent-types";
// The canonical fail-closed correlation id. Imported, never re-declared, so this
// action cannot drift away from the literal the sanitizer itself falls back to.
import { OBSERVABILITY_FALLBACK_REQUEST_ID } from "@/lib/observability/observability-types";

// ── R56B: THIS PATH IS DISABLED ──────────────────────────────────────────────
// This action was the ONE source-complete route to real persistence: it is reached from
// ScreensPreview (dev-preview mount) and, until R56B, bound the real atomic-RPC gateway. Two
// properties made that unacceptable to leave standing:
//
//   1. ScreensPreview is a CLIENT component that computes pricing in the browser and passes the
//      finished DTO here. The RPC performs no repricing, so client-chosen prices would persist.
//   2. R56B makes the RPC service-role-only. Leaving the real gateway bound here would have turned
//      a client-priced write into a client-priced write executing with service-role privilege and
//      no RLS — strictly worse than before.
//
// It is therefore rebound to the placeholder gateway and now terminates with the controlled
// RPC_NOT_IMPLEMENTED result. No persistence occurs. The authentication, dealer-context and
// permission gates below are retained deliberately: they are the behaviour ScreensPreview expects,
// and removing them would change the observable failure ordering of a frozen UI.
//
// ScreensPreview.tsx is NOT edited. Rebinding here severs the path on its own.
// Re-binding the real gateway is B7 work, and is blocked on R56D (numbering) and R56E (required
// idempotency typing).
const persistenceService = new EstimatePersistenceService(notImplementedPersistenceGateway);

// `meta.idempotencyKey` is typed `unknown` DELIBERATELY. This is a "use server" action reachable from
// a client component, so its parameter types are a compile-time claim only — the caller can send any
// runtime value. Declaring `string` here would assert a guarantee the boundary cannot enforce; the
// key is therefore validated at runtime below (step 4) before it is trusted.
export async function saveEstimateFromWizardAction(
  request: EstimateSaveRequest,
  meta?: { requestId?: string; idempotencyKey?: unknown },
): Promise<EstimateSaveActionResult> {
  const E = ESTIMATE_SAVE_ACTION_ERRORS;

  // ── OBS-1L-B7-F1: `meta.requestId` is ACCEPTED AND DISCARDED ────────────────
  //
  // The property stays in the parameter shape because ScreensPreview — a FROZEN
  // file — passes it, and removing it would break a callsite this phase may not
  // touch. But the value is never read, trimmed, validated, sanitized, forwarded
  // or emitted.
  //
  // Discarding is the only correct treatment, and validation is not a substitute.
  // The sanitizer checks the SHAPE of a correlation id, not its PROVENANCE: it
  // cannot tell an id this server generated from one a client fabricated. So a
  // caller sending a perfectly formed `obs.0123456789abcdef0123456789abcdef`
  // would have had it accepted verbatim and emitted as a trusted correlation id —
  // letting a client choose how its own save attempts are grouped in the
  // operational record, or collide them with another tenant's.
  //
  // This action therefore reports under the canonical unattributed literal. That
  // is honest: this path IS unattributed, because no trustworthy id exists for it.
  // Generating a real `obs.*` id here would be worse than the spoof — it would
  // manufacture the appearance of a trustworthy correlation for a disabled,
  // client-reachable legacy path. The AUTHORITATIVE intent action is the one that
  // generates a real id, and it can, because it accepts no requestId parameter at
  // all: immunity by construction rather than by validation.
  const requestId = OBSERVABILITY_FALLBACK_REQUEST_ID;

  // 1. Authentication
  const user = await getCurrentUser();
  if (!user) {
    logEstimateSaveStage({ requestId, dealerId: null, userId: null, stage: "authentication", validationOk: null, errorCode: E.UNAUTHENTICATED });
    return { ok: false, code: E.UNAUTHENTICATED, message: "ログインが必要です。", stage: "authentication" };
  }

  // 2. Dealer context — server-resolved (never from client input)
  const dealer = await getCurrentDealer();
  if (!dealer) {
    logEstimateSaveStage({ requestId, dealerId: null, userId: user.id, stage: "dealer_context", validationOk: null, errorCode: E.DEALER_CONTEXT_REQUIRED });
    return { ok: false, code: E.DEALER_CONTEXT_REQUIRED, message: "ディーラー情報の取得に失敗しました。", stage: "dealer_context" };
  }

  // 3. Permission — reuse the authoritative existing gate (not weakened)
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) {
    logEstimateSaveStage({ requestId, dealerId: dealer.dealer_id, userId: user.id, stage: "permission", validationOk: null, errorCode: E.PERMISSION_DENIED });
    return { ok: false, code: E.PERMISSION_DENIED, message: auth.error, stage: "permission" };
  }

  // 4. Idempotency key — REQUIRED, exact format, checked AFTER the three authorization gates.
  //
  // ORDERING IS DELIBERATE. Validating earlier would tell an unauthenticated or unauthorized caller
  // whether their key was well-formed, and would change the observable failure ordering that the
  // frozen ScreensPreview depends on. Authentication, dealer context and permission all still win.
  //
  // NO trim: a key that needs trimming is malformed, and silently trimming would send SQL a different
  // string than the caller believes it sent. NO fallback: the server never invents, derives or
  // substitutes a key — doing so would defeat duplicate detection precisely on the retry path the
  // key exists to protect. Retry stability is the caller's responsibility.
  //
  // The rejected VALUE IS NEVER ECHOED — not in the message, not in issues (none are attached), and
  // not in the log, which carries ids/stage/outcome only. A malformed idempotency key can embed
  // attacker- or PII-derived text, so reflecting it would leak it into logs and the client.
  const rawKey: unknown = meta?.idempotencyKey;
  if (typeof rawKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(rawKey)) {
    logEstimateSaveStage({ requestId, dealerId: dealer.dealer_id, userId: user.id, stage: "validation", validationOk: false, errorCode: E.VALIDATION_ERROR });
    return { ok: false, code: E.VALIDATION_ERROR, message: "入力内容に不備があります。", stage: "validation" };
  }

  // 5/6. Validation → pricing completeness → payload → atomic RPC (via the canonical service).
  // `rawKey` is now a proven string and is passed BYTE-FOR-BYTE into the strict context.
  return persistenceService.save(
    request,
    { requestId, dealerId: dealer.dealer_id, userId: user.id, idempotencyKey: rawKey },
  );
}
