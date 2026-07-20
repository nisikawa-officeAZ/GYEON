"use server";

// EW-UI-5A1-B3 — Authoritative save-intent Server Action (NON-MOUNTED).
//
// The thin server boundary: generate a logging request id, wire the real dependencies, delegate every
// decision to the pure orchestrator. It contains NO ordering logic, NO authorization logic, NO
// pricing, NO mapping, NO validation — each of those lives in a module that is unit-testable without
// crossing the server boundary.
//
// ── B7-1: PERSISTENCE IS ARMED, BUT THIS ACTION IS STILL UNREACHABLE ────────────
// The persistence seam now binds `supabasePersistenceGateway`, the REAL atomic-RPC gateway. A save
// that reaches it will write to the database through `save_estimate_from_wizard`.
//
// What keeps that safe today is REACHABILITY, not the binding: this action is imported by NO page,
// route, component, UI module, or ScreensPreview, and it is deliberately NOT re-exported from
// `index.ts`. There is no code path from a browser to this function. The controlled production
// mount is a LATER phase (B7-3), and it is deliberately a separate commit — the change that arms
// persistence and the change that exposes it must never be reviewable as one unit.
//
// The frozen ScreensPreview development harness is unaffected: it calls the LEGACY action, which
// remains bound to `notImplementedPersistenceGateway` and still writes nothing.
//
// ── TENANT AND ROLE COME FROM ONE COHERENT SOURCE ───────────────────────────────
// `getEstimateSaveActorContext()` yields a branded { userId, dealerId, role } triple whose role and
// dealer provably originate from the SAME active membership. The legacy helpers are deliberately not
// used: the current-dealer helper picks an arbitrary tenant via `.limit(1)`, and the current-staff
// helper silently falls back to the membership role on an operational error. Neither is imported.

import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { getAuthoritativeWizardRuntimeConfigForDealer } from "@/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer";
import { computeWizardPricingFromConfig } from "../pricing/compute-wizard-pricing-from-config";
import { mapWizardDraftToSaveRequestFromConfig } from "./estimate-save-mapper-from-config";
import { validateEstimateSaveRequest } from "./estimate-save-validation";
import { EstimatePersistenceService } from "./estimate-persistence-service";
import { supabasePersistenceGateway } from "./supabase-persistence-gateway";
import { validateWizardSaveIntent } from "./wizard-save-intent-validation";
import { runWizardSaveIntent } from "./wizard-save-intent-orchestrator";
import { createObservabilityRequestId } from "@/lib/observability/create-observability-request-id";
import { createWizardSaveFailureReporter } from "./wizard-save-observability";
import type { WizardSaveIntentResult } from "./wizard-save-intent-types";

// The REAL gateway, bound exactly once at module load. The binding is fixed: there is no branch,
// environment check or parameter by which a caller could substitute a different gateway, so which
// persistence backs this action is decided here and nowhere else.
const persistenceService = new EstimatePersistenceService(supabasePersistenceGateway);

/**
 * Accept an untrusted save intent and run the authoritative server save flow.
 *
 * Takes `raw: unknown` — by design. Nothing about the tenant, the role, the catalog, the rank, the
 * pricing, or the totals is accepted from the caller; all of it is resolved or derived server-side.
 * B7-1: a fully valid intent now reaches the atomic RPC and PERSISTS. It no longer terminates in
 * `persistence-unavailable`, and the earlier claim that it still could — "if the RPC reports
 * RPC_NOT_IMPLEMENTED" — was wrong. `supabasePersistenceGateway.mapRpcError` classifies against a
 * FIXED eleven-prefix list that does not contain `RPC_NOT_IMPLEMENTED`, and every unmatched
 * diagnostic collapses to `SAVE_FAILED`. That code is produced only by the placeholder gateway,
 * which this action no longer binds.
 *
 * `persistence-unavailable` therefore remains part of the pure orchestrator contract and its tests —
 * where the persistence seam is an injected double — but it is NOT an expected outcome through this
 * fixed production binding. Nothing calls this function yet.
 */
export async function saveEstimateFromWizardIntentAction(raw: unknown): Promise<WizardSaveIntentResult> {
  // OBS-1L-B7 — the correlation id, generated ONCE per save attempt on the server.
  //
  // This replaces a private `req_` generator. `obs.` is not a cosmetic rename: the
  // authoritative idempotency alphabet is /^[A-Za-z0-9_-]{16,64}$/, which CONTAINS
  // `_`, so a `req_…` value could satisfy both languages at once and a replay token
  // could in principle be logged as a correlation id. `.` is outside that alphabet,
  // making the two provably disjoint rather than merely conventionally different.
  //
  // The browser cannot supply one — this action's only parameter is the raw intent,
  // so there is nowhere for a client id to enter — and it is never derived from
  // `idempotencyKey`: `createObservabilityRequestId` reads no input at all.
  const requestId = createObservabilityRequestId();

  return runWizardSaveIntent(raw, {
    validateIntent: validateWizardSaveIntent,
    resolveActorContext: getEstimateSaveActorContext,
    loadRuntimeConfig: getAuthoritativeWizardRuntimeConfigForDealer,
    computePricing: computeWizardPricingFromConfig,
    mapSaveRequest: mapWizardDraftToSaveRequestFromConfig,
    validateSaveRequest: validateEstimateSaveRequest,
    persist: (request, context) => persistenceService.save(request, context),
    requestId,
    // Bound to the SAME id the persistence context carries, so every record from one
    // save attempt correlates — whether it was emitted before persistence by the
    // orchestrator or inside the service.
    reportFailure: createWizardSaveFailureReporter(requestId),
  });
}
