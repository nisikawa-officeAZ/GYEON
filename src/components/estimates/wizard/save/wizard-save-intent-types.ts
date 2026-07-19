// EW-UI-5A1-B3 — Authoritative server save-intent contract (PURE TYPES).
//
// The complete public surface of the save-intent boundary: what a caller may send, what the
// validator reports, and what the orchestrator returns. Plain types + one frozen literal array —
// NO "use server", NO server-only, NO Supabase, NO React, NO route, NO persistence, NO side effects.
//
// ── WHAT THE CLIENT MAY SEND ────────────────────────────────────────────────────
// Exactly three fields. There is no place in `WizardSaveIntent` to put a total, a pricing result, a
// catalog, a pricingConfig, a shopRank, a dealerId, a userId, a role, a capability result, a
// requestId, an `EstimateSaveRequest`, or a persistence payload — every one of those is resolved or
// derived on the server. This is enforced twice: by the type, and by the validator's exact-key check
// (an unexpected root key is a hard `unexpected-field` rejection, never silently ignored).
//
// Contrast the legacy action, which accepts a fully-formed `EstimateSaveRequest` AND a caller-supplied
// `meta.requestId`. That surface is exactly what this boundary removes.

import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { ConfigSaveMapperFailure } from "./estimate-save-mapper-from-config";
import type { EstimateSaveValidationIssue } from "./estimate-save-errors";
import type { EstimateSaveActionResult } from "./estimate-save-orchestration-types";

// ── Intent ───────────────────────────────────────────────────────────────────

/**
 * The complete client-supplied save intent.
 *
 * `idempotencyKey` is REQUIRED and never null: a retry must reuse the same key so the future atomic
 * RPC can recognise it as a replay rather than creating a second estimate. Making it optional would
 * make "no key" indistinguishable from "a new submission".
 */
export type WizardSaveIntent = {
  readonly draft: Readonly<EstimateWizardDraftV22>;
  readonly expectedConfigRevision: number;
  readonly idempotencyKey: string;
};

/** The exact accepted root keys. Anything else is `unexpected-field`. */
export const WIZARD_SAVE_INTENT_ROOT_KEYS = ["draft", "expectedConfigRevision", "idempotencyKey"] as const;

/** Exact idempotency-key format. Retries reuse the key; it is never generated server-side. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

// ── Validation issues ────────────────────────────────────────────────────────

/**
 * Stable, finite issue vocabulary. Deliberately structural: an issue names WHERE and WHAT KIND, never
 * the offending value. A raw value could be a customer name, a phone number, a note, or a price, so
 * echoing it back would turn a validation report into a data leak.
 */
export type WizardSaveIntentIssueCode =
  | "invalid-type"
  | "missing-field"
  | "unexpected-field"
  | "invalid-literal"
  | "invalid-number"
  | "invalid-idempotency-key"
  | "invalid-config-revision"
  | "duplicate-value"
  | "unreadable-input";

/**
 * One structural defect. `path` is a fixed, code-derived dotted path (e.g.
 * `draft.serviceConfiguration.ppf.quantitiesByPart`) — never interpolated from input, so a hostile
 * key cannot smuggle content into it beyond a bracketed key name.
 *
 * There is no `message`, no `value`, no `expected`, no `stack`, no `cause`. The type makes leaking
 * free text, raw values, exceptions, Supabase detail, customer/vehicle data, notes, or pricing
 * impossible rather than merely discouraged.
 */
export type WizardSaveIntentValidationIssue = {
  readonly path: string;
  readonly code: WizardSaveIntentIssueCode;
};

/** Discriminated: `intent` exists ONLY on the success arm, so a failure cannot be read as an intent. */
export type WizardSaveIntentValidation =
  | { readonly ok: true; readonly intent: WizardSaveIntent }
  | { readonly ok: false; readonly issues: readonly WizardSaveIntentValidationIssue[] };

// ── Failure vocabulary ───────────────────────────────────────────────────────

/**
 * The complete public failure vocabulary. Every internal reason — the six
 * `EstimateSaveActorContextFailure` values, the fourteen `WizardRuntimeConfigFailure` values, the
 * sixteen `ConfigSaveMapperFailure` values, every Supabase/Postgres error — collapses into exactly
 * one of these. No internal reason is ever returned verbatim.
 *
 *   "actor-context-unavailable" — an OPERATIONAL failure reading membership or staff rows. It is
 *     deliberately NOT `forbidden` (that would assert a permission decision the server never made)
 *     and NOT `unauthenticated` (that would tell a signed-in operator to log in again). An outage
 *     must not masquerade as an authorization outcome.
 *   "tenant-context-unavailable" — the actor belongs to MORE THAN ONE dealer, or the runtime
 *     configuration resolved for a different dealer than the actor context authorizes. Kept distinct
 *     from `forbidden` so multi-membership ambiguity stays diagnosable.
 *   "forbidden" — authenticated, but not permitted: either no active membership at all, or a role
 *     that may not edit business data. The two collapse deliberately; separating them would signal
 *     whether an account is linked to a shop. The distinction survives in the PII-free log only.
 */
export type WizardSaveIntentFailure =
  | "invalid-intent"
  | "unauthenticated"
  | "actor-context-unavailable"
  | "forbidden"
  | "tenant-context-unavailable"
  | "runtime-config-unavailable"
  | "stale-config-revision"
  | "server-pricing-failed"
  | "save-mapping-failed"
  | "save-validation-failed"
  | "persistence-unavailable"
  | "persistence-conflict"
  | "persistence-failed";

// ── Result ───────────────────────────────────────────────────────────────────

/**
 * The success arm, taken from the EXISTING action result rather than redeclared.
 *
 * `EstimateSaveActionResult` is itself a union of a success arm and a failure arm. Returning it whole
 * under an `ok: true` wrapper would permit `{ ok: true, outcome: { ok: false, ... } }` — a "successful
 * failure". Extracting only the `ok: true` arm makes that state unrepresentable, and keeping it
 * derived (rather than copied) means a future field added to the real success arm cannot silently
 * drift out of this contract.
 */
export type WizardSaveIntentSuccess = Extract<EstimateSaveActionResult, { readonly ok: true }>;

/**
 * The strict result union.
 *
 * Detail is attached to exactly the arm that can produce it, so four states are unrepresentable:
 *   • a success containing an inner failure       (the success arm is the extracted arm, not a wrapper)
 *   • `invalid-intent` without validator issues   (`issues` is required on that arm)
 *   • mapping codes on an unrelated failure       (`mappingCodes` exists only on `save-mapping-failed`)
 *   • save-validation issues on an unrelated arm  (`saveIssues` exists only on `save-validation-failed`)
 *
 * The catch-all arm uses `Exclude<...>` so adding a failure to `WizardSaveIntentFailure` later
 * automatically lands there rather than being silently unhandled.
 */
export type WizardSaveIntentResult =
  | WizardSaveIntentSuccess
  | {
      readonly ok: false;
      readonly failure: "invalid-intent";
      readonly issues: readonly WizardSaveIntentValidationIssue[];
    }
  | {
      readonly ok: false;
      readonly failure: "save-mapping-failed";
      // Stable mapper CODES only. `ConfigSaveMapperIssue.message` is deliberately not carried:
      // forwarding it would couple this public contract to mapper-internal wording.
      readonly mappingCodes: readonly ConfigSaveMapperFailure[];
    }
  | {
      readonly ok: false;
      readonly failure: "save-validation-failed";
      // Already-stable DTO codes + operator-safe text produced by the existing pure validator.
      readonly saveIssues: readonly EstimateSaveValidationIssue[];
    }
  | {
      readonly ok: false;
      readonly failure: Exclude<
        WizardSaveIntentFailure,
        "invalid-intent" | "save-mapping-failed" | "save-validation-failed"
      >;
    };
