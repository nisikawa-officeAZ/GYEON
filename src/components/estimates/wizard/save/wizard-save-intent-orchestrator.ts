// EW-UI-5A1-B3 — Authoritative server save-intent orchestrator (PURE CORE).
//
// The complete, fail-closed ordering of a wizard save: validate → resolve actor → load dealer-bound
// runtime → assert identity → check revision → reprice ON THE SERVER → map → validate DTO → persist.
//
// PURE by construction: NO "use server", NO server-only, NO Supabase, NO React, NO route, NO fixture
// or default catalog, NO clock, NO randomness, NO direct database, and NO persistence class or
// gateway implementation. Every effect arrives through `WizardSaveIntentDeps`, so the ENTIRE ordering
// — including step 1 — is exercisable under plain `node:test` without importing a server-only module.
//
// ── WHY EVERY STEP IS INJECTED, INCLUDING VALIDATION ────────────────────────────
// `validateWizardSaveIntent` is pure and could be imported directly. It is injected anyway so that
// step 1 appears in the SAME observable call trace as steps 2-15. Validating before the orchestrator
// would move that ordering into the Server Action, where "malformed input is rejected before the
// actor is resolved" could only be asserted by reading source text rather than by executing it.
//
// `persist` is a FUNCTION seam, not the persistence service class. That is what keeps this module
// free of any persistence implementation: the caller decides which gateway backs it, and in B3 the
// only wiring that exists binds the disabled `notImplementedPersistenceGateway`.
//
// ── FAIL-CLOSED ─────────────────────────────────────────────────────────────────
// Every dependency call sits in its own guard. A thrown dependency becomes that STAGE's typed
// failure — never an escaped exception, never a later stage running anyway, and never a success.
// No internal reason (actor reason, runtime reason, mapper message, Supabase text) is ever returned.

import type { EstimateSaveActorContext, EstimateSaveActorContextResolution } from "@/lib/auth/estimate-save-actor-context";
import type { AuthoritativeWizardRuntimeConfiguration } from "@/lib/wizard-catalog/wizard-runtime-config";
import type { computeWizardPricingFromConfig } from "../pricing/compute-wizard-pricing-from-config";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { SERVICE_FAMILIES, SERVICE_FAMILY_CATEGORY } from "@/lib/estimates/service-categories";
import type { ServiceFamily, ServiceOfferings } from "@/lib/estimates/service-categories";
import type {
  ConfigSaveMapperFailure, ConfigSaveMapperResult, mapWizardDraftToSaveRequestFromConfig,
} from "./estimate-save-mapper-from-config";
import type { EstimateSaveRequest } from "./estimate-save-dto";
import type { EstimateSaveValidationResult } from "./estimate-save-errors";
import type { validateEstimateSaveRequest } from "./estimate-save-validation";
import type { EstimateSaveActionResult, EstimateSaveServerContext } from "./estimate-save-orchestration-types";
import { ESTIMATE_SAVE_ACTION_ERRORS } from "./estimate-save-orchestration-types";
import type {
  WizardSaveFailureReporter, WizardSaveIntentFailure, WizardSaveIntentResult,
  WizardSaveReportableFailure, WizardSaveIntentValidation,
} from "./wizard-save-intent-types";

/**
 * PPF-OFFERING-R1-B — detect PPF-bearing canonical draft state.
 *
 * The structurally required PPF configuration section always exists on every draft
 * (`serviceConfiguration.ppf` is not optional), so its mere presence is never PPF
 * intent. Only a selected `ppf` category, OR any field inside that section that
 * differs from the canonical initial default, counts. `vehicleCoefficientInput` is
 * compared against the exact canonical default string `"1.0"` rather than a parsed
 * number, matching how the draft carries it — a differently-formatted but
 * numerically-equal string (e.g. `"1.00"`) is still non-default input.
 */
export function isPpfBearingDraft(draft: EstimateWizardDraftV22): boolean {
  if (draft.serviceSelection.selectedCategories.includes("ppf")) return true;
  const ppf = draft.serviceConfiguration.ppf;
  return (
    ppf.installationMethod !== null ||
    ppf.fullCoverage !== null ||
    ppf.selectedPartIds.length > 0 ||
    Object.keys(ppf.quantitiesByPart).length > 0 ||
    ppf.ppfTypeId !== null ||
    ppf.unitPriceInput !== "" ||
    ppf.vehicleCoefficientInput !== "1.0" ||
    ppf.interiorRows.length > 0
  );
}

/**
 * MANAGED-SERVICE-OFFERING-R1-A — generalized family-aware intent predicate.
 *
 * Category selection is intent for every managed family by construction — the single
 * `SERVICE_FAMILY_CATEGORY` mapping decides which category, so it is never re-spelled
 * here. The switch below only inspects the ONE structurally required configuration
 * section that corresponds to `family`, using the exact canonical-default-vs-intent
 * rule approved for that family. `ppf` delegates to the existing, unchanged
 * `isPpfBearingDraft` so its nine-signal behavior stays byte-for-byte identical.
 *
 * A section is declared structurally required by `EstimateWizardDraftV22`, but pre-existing
 * validated/test draft values are not guaranteed to carry every field the type now declares.
 * A missing section is therefore treated the same as a present-and-canonical one — no intent —
 * exactly like the canonical-default rule above it; only a selected category can still supply
 * intent when a section is absent.
 */
export function isManagedServiceFamilyBearingDraft(
  draft: EstimateWizardDraftV22,
  family: ServiceFamily,
): boolean {
  if (draft.serviceSelection.selectedCategories.includes(SERVICE_FAMILY_CATEGORY[family])) return true;
  switch (family) {
    case "ppf":
      return isPpfBearingDraft(draft);
    case "window_film": {
      const s = draft.serviceConfiguration.windowFilm;
      if (!s) return false;
      return (
        s.selectedAreaIds.length > 0 ||
        s.filmTypeId !== null ||
        s.unitPriceInput !== "" ||
        (s.selectedPackageCode ?? null) !== null ||
        (s.selectedOptionIds?.length ?? 0) > 0 ||
        Object.keys(s.optionQuantities ?? {}).length > 0
      );
    }
    case "maintenance": {
      const s = draft.serviceConfiguration.bodyMaintenance;
      if (!s) return false;
      return s.menuId !== null || s.unitPriceInput !== "";
    }
    case "room_cleaning": {
      const s = draft.serviceConfiguration.roomCleaning;
      if (!s) return false;
      return s.selectedMenuIds.length > 0 || Object.keys(s.unitPricesByMenu).length > 0;
    }
    case "car_wash": {
      const s = draft.serviceConfiguration.carWash;
      if (!s) return false;
      return s.menuId !== null || s.unitPriceInput !== "";
    }
  }
}

/**
 * MANAGED-SERVICE-OFFERING-R1-A — true when ANY family the dealer has NOT opted into
 * carries intent. `SERVICE_FAMILIES` order decides scan order only; the caller never
 * learns WHICH family matched, so the public failure and its observability record
 * stay exactly as sanitized as the PPF-only guard this generalizes. `coating` and
 * `other` are absent from `SERVICE_FAMILIES` and are therefore never inspected here.
 */
function hasDisabledManagedServiceIntent(offerings: ServiceOfferings, draft: EstimateWizardDraftV22): boolean {
  return SERVICE_FAMILIES.some(
    (family) => offerings[family] === false && isManagedServiceFamilyBearingDraft(draft, family),
  );
}

/**
 * Injected dependencies. Note what is NOT here: no dealer id, no user id, no role, no catalog, no
 * pricing config, no rank. Those are produced by `resolveActorContext` / `loadRuntimeConfig`, never
 * supplied by a caller — and `requestId` is a logging value only, generated by the server wrapper
 * because a pure module may not invoke randomness.
 */
export interface WizardSaveIntentDeps {
  readonly validateIntent: (raw: unknown) => WizardSaveIntentValidation;
  readonly resolveActorContext: () => Promise<EstimateSaveActorContextResolution>;
  readonly loadRuntimeConfig: (context: EstimateSaveActorContext) => Promise<AuthoritativeWizardRuntimeConfiguration>;
  readonly computePricing: typeof computeWizardPricingFromConfig;
  readonly mapSaveRequest: typeof mapWizardDraftToSaveRequestFromConfig;
  readonly validateSaveRequest: typeof validateEstimateSaveRequest;
  readonly persist: (request: EstimateSaveRequest, context: EstimateSaveServerContext) => Promise<EstimateSaveActionResult>;
  readonly requestId: string;
  /**
   * OBS-1L-B7 — pre-persist observability seam.
   *
   * INJECTED, like every other effect, so this module keeps importing no reporting
   * implementation, no console, no Supabase and no transport, and so the emission
   * ordering is assertable in the SAME call trace as steps 1-15 rather than by
   * reading source text. It is REQUIRED, not optional: a default would let a caller
   * silently run the authoritative save with no operational record at all.
   */
  readonly reportFailure: WizardSaveFailureReporter;
}

/**
 * Failure arms that carry no detail. Derived from the public union by EXCLUSION, so the three
 * detail-bearing failures are unreachable through this helper — attaching `save-validation-failed`
 * without its issues is a compile error rather than a review finding.
 */
type PlainFailure = Exclude<
  WizardSaveIntentFailure,
  "invalid-intent" | "save-mapping-failed" | "save-validation-failed"
>;

const failPlain = (failure: PlainFailure): WizardSaveIntentResult => ({ ok: false, failure });

/**
 * Report exactly one pre-persist record, then let the caller return.
 *
 * ── WHY THE TRY/CATCH IS NOT OPTIONAL ───────────────────────────────────────────
 * Observability is a BYSTANDER to the save. `reportObservabilityEvent` already
 * cannot throw, but `reportFailure` is an INJECTED function — a test double, or a
 * future adapter — and a throwing one must not change what the operator sees. If it
 * escaped here it would convert a clean typed failure into `persistence-failed`, or
 * worse, skip a guard. Containing it means a reporting defect can lose a record and
 * nothing else.
 *
 * The argument type is `WizardSaveReportableFailure`, which EXCLUDES all three
 * `persistence-*` failures, so the post-persist remapping arms at the end of this
 * function cannot call this helper at all.
 */
function report(
  deps: WizardSaveIntentDeps,
  failure: WizardSaveReportableFailure,
  dealerId?: string,
): void {
  try {
    deps.reportFailure(dealerId === undefined ? { failure } : { failure, dealerId });
  } catch {
    // A reporting failure is never a save failure.
  }
}

export async function runWizardSaveIntent(
  raw: unknown,
  deps: WizardSaveIntentDeps,
): Promise<WizardSaveIntentResult> {
  // ── 1. Validate the untrusted intent. Nothing downstream runs on malformed input. ──
  let validation: WizardSaveIntentValidation;
  try {
    validation = deps.validateIntent(raw);
  } catch {
    report(deps, "invalid-intent");
    return { ok: false, failure: "invalid-intent", issues: [{ path: "intent", code: "unreadable-input" }] };
  }
  if (!validation.ok) {
    report(deps, "invalid-intent");
    return { ok: false, failure: "invalid-intent", issues: validation.issues };
  }
  const intent = validation.intent;

  // ── 2. Resolve the actor EXACTLY ONCE. ──
  //
  // No tenant is known until step 3 succeeds, so every record up to that point is
  // reported WITHOUT a dealerId. Substituting a placeholder would be worse than
  // omitting it: an operator could not tell "tenant unknown" from "tenant known".
  let actor: EstimateSaveActorContextResolution;
  try {
    actor = await deps.resolveActorContext();
  } catch {
    report(deps, "actor-context-unavailable");
    return failPlain("actor-context-unavailable");
  }

  // ── 3. Map the actor failure. The internal reason never leaves this switch. ──
  if (!actor.ok) {
    switch (actor.reason) {
      case "unauthenticated":            report(deps, "unauthenticated");            return failPlain("unauthenticated");
      case "membership-read-failed":     report(deps, "actor-context-unavailable");  return failPlain("actor-context-unavailable");
      case "staff-read-failed":          report(deps, "actor-context-unavailable");  return failPlain("actor-context-unavailable");
      case "no-active-membership":       report(deps, "forbidden");                  return failPlain("forbidden");
      case "permission-denied":          report(deps, "forbidden");                  return failPlain("forbidden");
      case "tenant-context-unavailable": report(deps, "tenant-context-unavailable"); return failPlain("tenant-context-unavailable");
    }
  }
  const context = actor.context;

  // ── 4. Load the dealer-bound runtime configuration for THAT actor's tenant. ──
  let runtime: AuthoritativeWizardRuntimeConfiguration;
  try {
    runtime = await deps.loadRuntimeConfig(context);
  } catch {
    report(deps, "runtime-config-unavailable", context.dealerId);
    return failPlain("runtime-config-unavailable");
  }

  // ── 5. Every WizardRuntimeConfigFailure collapses here; the specific reason is never returned. ──
  if (!runtime.ok) {
    report(deps, "runtime-config-unavailable", context.dealerId);
    return failPlain("runtime-config-unavailable");
  }

  // ── 6. The configuration must describe the tenant the actor is authorized for, and no other. ──
  //
  // The reported dealerId is the ACTOR's tenant, never `runtime.dealerId`. Reporting
  // the mismatched one would attribute the incident to the tenant that was wrongly
  // loaded rather than the tenant whose save was refused.
  if (runtime.dealerId !== context.dealerId) {
    report(deps, "tenant-context-unavailable", context.dealerId);
    return failPlain("tenant-context-unavailable");
  }

  // ── 7. The client's expected revision must match the configuration actually loaded. A stale
  //       revision means the operator priced against a catalog that has since changed. ──
  if (intent.expectedConfigRevision !== runtime.lifecycle.currentRevision) {
    report(deps, "stale-config-revision", context.dealerId);
    return failPlain("stale-config-revision");
  }

  // ── 7b. The current dealer-bound runtime is the ONLY service-offering authority, for all five
  //        managed families. A draft bearing intent for a family the dealer has not opted into is
  //        rejected here — before pricing, mapping, DTO validation, or persistence run. No offering
  //        flag, rank, or catalog inference is accepted from the client; only
  //        `runtime.screenConfig.serviceOfferings` decides. `coating` and `other` are unmanaged and
  //        are never inspected. ──
  if (hasDisabledManagedServiceIntent(runtime.screenConfig.serviceOfferings, intent.draft)) {
    report(deps, "service-not-offered", context.dealerId);
    return failPlain("service-not-offered");
  }

  // ── 8. Reprice ON THE SERVER, from the SERVER's runtime inputs only. The client sent no totals,
  //       no catalog, no pricing config and no rank — there is nowhere for it to have sent them. ──
  let pricing: WizardPricingResult;
  try {
    pricing = deps.computePricing(intent.draft, runtime.pricingConfig, runtime.catalog, runtime.shopRank);
  } catch {
    report(deps, "server-pricing-failed", context.dealerId);
    return failPlain("server-pricing-failed");
  }

  // ── 9. Pricing must be unambiguously complete. A partial/unavailable/error result carries null
  //       totals by contract, and an unresolved item means a selection produced no priced line. ──
  if (
    pricing.status !== "success" ||
    pricing.completeness !== "complete" ||
    pricing.errors.length !== 0 ||
    pricing.unresolvedItems.length !== 0
  ) {
    report(deps, "server-pricing-failed", context.dealerId);
    return failPlain("server-pricing-failed");
  }

  // ── 10. Map to the canonical DTO using the SAME draft and the EXACT runtime inputs. ──
  let mapped: ConfigSaveMapperResult;
  try {
    mapped = deps.mapSaveRequest({
      draft: intent.draft,
      pricingResult: pricing,
      pricingConfig: runtime.pricingConfig,
      catalog: runtime.catalog,
      shopRank: runtime.shopRank,
    });
  } catch {
    report(deps, "save-mapping-failed", context.dealerId);
    return { ok: false, failure: "save-mapping-failed", mappingCodes: ["mapping-failed"] };
  }

  // ── 11. Mapper CODES only. `ConfigSaveMapperIssue.message` is deliberately not forwarded. ──
  //        The codes travel in the RESULT only — the observability record carries the
  //        stage and a stable code, never mapper-internal detail.
  if (!mapped.ok) {
    const codes: ConfigSaveMapperFailure[] = mapped.issues.length > 0
      ? mapped.issues.map((i) => i.code)
      : [mapped.reason];
    report(deps, "save-mapping-failed", context.dealerId);
    return { ok: false, failure: "save-mapping-failed", mappingCodes: codes };
  }
  const request = mapped.request;

  // ── 12/13. Authoritative DTO validation BEFORE persistence is entered, so a DTO defect is never
  //           reported as a persistence-stage error. ──
  let dto: EstimateSaveValidationResult;
  try {
    dto = deps.validateSaveRequest(request);
  } catch {
    report(deps, "save-validation-failed", context.dealerId);
    return { ok: false, failure: "save-validation-failed", saveIssues: [] };
  }
  // BOTH save-validation-failed branches return here, BEFORE `deps.persist` below, so
  // the persistence service is never entered and cannot own either outcome. The
  // record must carry the `validation` stage, not a persistence stage — reporting a
  // DTO defect as an RPC failure is exactly what step 12/13 exists to prevent.
  if (!dto.ok) {
    report(deps, "save-validation-failed", context.dealerId);
    return { ok: false, failure: "save-validation-failed", saveIssues: dto.issues };
  }

  // ── 14. Persist. dealerId and userId come from the actor context — never from the intent. ──
  let outcome: EstimateSaveActionResult;
  try {
    outcome = await deps.persist(request, {
      requestId: deps.requestId,
      dealerId: context.dealerId,
      userId: context.userId,
      idempotencyKey: intent.idempotencyKey,
    });
  } catch {
    // The seam THREW rather than returning. EstimatePersistenceService emits its
    // record immediately before each of its five returns, so a throw means it
    // emitted NOTHING — its two pre-try steps (structural re-validation and RPC
    // payload construction) sit outside its try block by design. This is the only
    // persistence outcome the orchestrator owns, and it is reported under the
    // internal `persist-invariant` code so an operator can tell "a layer that is
    // supposed to be total threw" apart from a normal mapped failure.
    report(deps, "persist-invariant", context.dealerId);
    return failPlain("persistence-failed");
  }

  // ── 15. Map the persistence result. The success arm is returned DIRECTLY — never nested inside an
  //        `ok: true` wrapper, which is what would make an "ok:true containing a failure" possible. ──
  //
  //        NOTHING below reports. Every outcome here was already reported INSIDE the
  //        service, and re-reporting would double-count every save in the metrics an
  //        operator is meant to trust. The reporter's argument type excludes all three
  //        `persistence-*` failures, so these arms cannot report even by mistake.
  if (outcome.ok) return outcome;
  switch (outcome.code) {
    case ESTIMATE_SAVE_ACTION_ERRORS.RPC_NOT_IMPLEMENTED:  return failPlain("persistence-unavailable");
    case ESTIMATE_SAVE_ACTION_ERRORS.DUPLICATE_SUBMISSION: return failPlain("persistence-conflict");
    default:                                               return failPlain("persistence-failed");
  }
}
