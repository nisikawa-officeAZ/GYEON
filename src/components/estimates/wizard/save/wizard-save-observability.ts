// OBS-1L-B7 — Estimate Wizard save-path observability ADAPTER (domain-local).
//
// The single translation layer between the Estimate Wizard's save vocabulary and the
// generic observability core. It owns every wizard business code; the core owns none.
//
// ── WHY THIS LIVES IN THE DOMAIN, NOT IN src/lib/observability ───────────────────
// The required dependency direction is  domain adapter → generic core.  Placing this
// file under `src/lib/observability` would have made a REUSABLE core the owner of
// `EstimateSaveStage`, `EstimateSaveActionErrorCode` and thirteen Estimate Wizard
// codes, so every future domain would have to add its vocabulary there too. The core
// imports nothing from this domain, and nothing here is generic.
//
// ── WHY EVERY DOMAIN IMPORT IS `import type` ────────────────────────────────────
// `estimate-save-orchestration-types.ts` VALUE-imports this file (its
// `logEstimateSaveStage` is the single emission site). A value import back — most
// temptingly `ESTIMATE_SAVE_ACTION_ERRORS`, to key the maps below — would close a
// runtime cycle between the two modules. Type imports are erased at compile time, so
// the runtime edge stays one-way:
//
//   estimate-save-orchestration-types.ts ─▶ wizard-save-observability.ts ─▶ lib/observability
//
// The maps therefore use LITERAL keys, type-checked against the domain unions. A
// missing or misspelled key is a compile error, so exhaustiveness survives without
// the value import.
//
// ── NO PII CAN REACH AN EVENT FROM HERE ─────────────────────────────────────────
// Both input shapes are CLOSED and scalar: there is nowhere to put a userId, an
// idempotency key, a validation issue, a draft, a total, or a raw Error. The core
// then RECONSTRUCTS the event from an explicit key list rather than copying, so even
// an untyped caller cannot smuggle a field through.

import { reportObservabilityEvent } from "@/lib/observability/report-observability-event";
import type { ObservabilitySeverity, ObservabilitySink } from "@/lib/observability/observability-types";
import type { EstimateSaveStage, EstimateSaveActionErrorCode } from "./estimate-save-orchestration-types";
import type {
  WizardSaveFailureReport, WizardSaveFailureReporter, WizardSaveReportableFailure,
} from "./wizard-save-intent-types";

/** The one event name the entire save path emits. */
export const WIZARD_SAVE_EVENT = "wizard-save";

/**
 * The internal-only code for a persistence seam that threw before returning.
 *
 * It is NOT a member of `EstimateSaveActionErrorCode`: no gateway, RPC or service
 * produces it, and it must never appear in a user-facing result. It exists so the
 * orchestrator's persist-catch has a code of its own instead of borrowing
 * `SAVE_FAILED`, which the service already uses for outcomes it reported itself.
 */
export const PERSIST_INVARIANT_FAILED = "PERSIST_INVARIANT_FAILED";

type ReportableCode = EstimateSaveActionErrorCode | typeof PERSIST_INVARIANT_FAILED;

/**
 * The CLOSED adapter input for a service/legacy stage record.
 *
 * Deliberately four scalars. `EstimateSaveLogEntry` also carries `userId` and
 * `validationOk`; neither is accepted here, so `logEstimateSaveStage` has nowhere to
 * forward them even by accident.
 */
export type WizardSaveStageReport = {
  readonly requestId: string;
  readonly dealerId:  string | null;
  readonly stage:     EstimateSaveStage;
  readonly errorCode: EstimateSaveActionErrorCode | null;
};

// ── Stage vocabulary ────────────────────────────────────────────────────────────
//
// The committed slug pattern is /^[a-z][a-z0-9-]{0,63}$/ — it REJECTS underscores.
// `dealer_context` and `pricing_completeness` would therefore sanitize silently to
// `unknown-stage`, losing exactly the two stages an operator most needs to tell
// apart. This map is the correction, and it is total: adding a stage to
// `EstimateSaveStage` fails typecheck here until it is given a slug.

const STAGE_SLUG: Record<EstimateSaveStage, string> = {
  authentication:       "authentication",
  dealer_context:       "dealer-context",
  permission:           "permission",
  validation:           "validation",
  pricing_completeness: "pricing-completeness",
  rpc:                  "rpc",
  done:                 "done",
};

// ── Severity for a stage record ─────────────────────────────────────────────────
//
// DUPLICATE_SUBMISSION is `info` and must never be `error`: an idempotent retry is
// the replay protection WORKING. Alerting on it would page an operator for correct
// behaviour and train them to ignore the channel. RPC_NOT_IMPLEMENTED is `info` for
// the same reason — persistence is deliberately disabled, so it is the expected
// outcome of every authoritative save today, not an incident.

const CODE_SEVERITY: Record<ReportableCode, ObservabilitySeverity> = {
  UNAUTHENTICATED:          "info",
  DEALER_CONTEXT_REQUIRED:  "warn",
  PERMISSION_DENIED:        "warn",
  VALIDATION_ERROR:         "info",
  PRICING_INCOMPLETE:       "info",
  CUSTOMER_NOT_FOUND:       "warn",
  VEHICLE_NOT_FOUND:        "warn",
  DUPLICATE_SUBMISSION:     "info",
  ESTIMATE_NUMBER_FAILED:   "error",
  SAVE_FAILED:              "error",
  RPC_NOT_IMPLEMENTED:      "info",
  UNKNOWN_SAVE_ERROR:       "error",
  PERSIST_INVARIANT_FAILED: "error",
};

// ── Pre-persist failure vocabulary ──────────────────────────────────────────────
//
// Severity is stated PER FAILURE and is deliberately NOT derived from CODE_SEVERITY.
// Four failures share `VALIDATION_ERROR` but do not share a severity:
// `stale-config-revision` is `warn` because the operator priced against a catalog
// that has since changed — a real race worth noticing — while a malformed intent or a
// failed DTO check is `info`, an ordinary correctable rejection. Deriving severity
// from the code would flatten that distinction and there would be no way to restate
// it without inventing a second code.

const PRE_PERSIST: Record<
  WizardSaveReportableFailure,
  { readonly stage: string; readonly code: ReportableCode; readonly severity: ObservabilitySeverity }
> = {
  "invalid-intent":            { stage: "intent-validation",    code: "VALIDATION_ERROR",         severity: "info"  },
  "unauthenticated":           { stage: "authentication",       code: "UNAUTHENTICATED",          severity: "info"  },
  "actor-context-unavailable": { stage: "authentication",       code: "SAVE_FAILED",              severity: "error" },
  "forbidden":                 { stage: "permission",           code: "PERMISSION_DENIED",        severity: "warn"  },
  "tenant-context-unavailable":{ stage: "dealer-context",       code: "DEALER_CONTEXT_REQUIRED",  severity: "warn"  },
  "runtime-config-unavailable":{ stage: "dealer-context",       code: "SAVE_FAILED",              severity: "error" },
  "stale-config-revision":     { stage: "config-revision",      code: "VALIDATION_ERROR",         severity: "warn"  },
  "server-pricing-failed":     { stage: "pricing-completeness", code: "PRICING_INCOMPLETE",       severity: "info"  },
  "save-mapping-failed":       { stage: "save-mapping",         code: "VALIDATION_ERROR",         severity: "info"  },
  "save-validation-failed":    { stage: "validation",           code: "VALIDATION_ERROR",         severity: "info"  },
  "persist-invariant":         { stage: "rpc",                  code: PERSIST_INVARIANT_FAILED,   severity: "error" },
};

/** The exact maps, exported so a test can prove exhaustiveness at runtime too. */
export const WIZARD_SAVE_MAPS = { STAGE_SLUG, CODE_SEVERITY, PRE_PERSIST } as const;

/**
 * Emit ONE record for a service/legacy stage outcome.
 *
 * `dealerId` is passed through only when the core recognizes it as UUID-shaped; any
 * other value (including the legacy action's `null`) is dropped by the sanitizer, so
 * a non-UUID tenant string can never ride in as an identifier.
 */
export function reportWizardSaveStage(report: WizardSaveStageReport, sink?: ObservabilitySink): void {
  const code = report.errorCode;
  reportObservabilityEvent(
    {
      event:     WIZARD_SAVE_EVENT,
      severity:  code === null ? "info" : CODE_SEVERITY[code],
      requestId: report.requestId,
      stage:     STAGE_SLUG[report.stage],
      code,
      dealerId:  report.dealerId ?? undefined,
    },
    sink,
  );
}

/**
 * Emit ONE record for an orchestrator pre-persist failure, or for a persistence seam
 * that threw before returning.
 *
 * The argument type admits none of the three post-persist failures, so the
 * orchestrator's result-remapping arms cannot call this even by mistake.
 */
export function reportWizardSaveFailure(
  requestId: string,
  report: WizardSaveFailureReport,
  sink?: ObservabilitySink,
): void {
  const mapped = PRE_PERSIST[report.failure];
  reportObservabilityEvent(
    {
      event:     WIZARD_SAVE_EVENT,
      severity:  mapped.severity,
      requestId,
      stage:     mapped.stage,
      code:      mapped.code,
      dealerId:  report.dealerId,
    },
    sink,
  );
}

/**
 * Bind a request id once, at the server boundary, and hand the orchestrator a
 * reporter that carries no other state.
 *
 * The orchestrator is a PURE module: it may not generate a request id (that is
 * randomness) and must not import this adapter. Binding here keeps the id out of the
 * reporter's argument shape entirely, so a caller cannot substitute a different
 * correlation id per call — every record from one save attempt shares one id by
 * construction rather than by discipline.
 */
export function createWizardSaveFailureReporter(
  requestId: string,
  sink?: ObservabilitySink,
): WizardSaveFailureReporter {
  return (report) => { reportWizardSaveFailure(requestId, report, sink); };
}
