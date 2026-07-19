"use server";

// EW-UI-5A1-B3 — Authoritative save-intent Server Action (NON-MOUNTED).
//
// The thin server boundary: generate a logging request id, wire the real dependencies, delegate every
// decision to the pure orchestrator. It contains NO ordering logic, NO authorization logic, NO
// pricing, NO mapping, NO validation — each of those lives in a module that is unit-testable without
// crossing the server boundary.
//
// ── NOT MOUNTED, AND PERSISTENCE IS DISABLED ────────────────────────────────────
// This action is imported by NO page, route, component, UI module, or ScreensPreview, and it is
// deliberately NOT re-exported from `index.ts`. B3 establishes the boundary only; the controlled
// production mount is B7.
//
// The persistence seam is bound to `notImplementedPersistenceGateway`, whose `saveEstimate` throws
// `RPC_NOT_IMPLEMENTED` before any I/O. `supabasePersistenceGateway` — the real atomic-RPC gateway —
// is NOT imported here, so no import path from this action can reach a database write. Migration/RPC
// hardening is B4.
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
import { notImplementedPersistenceGateway } from "./estimate-persistence-gateway";
import { validateWizardSaveIntent } from "./wizard-save-intent-validation";
import { runWizardSaveIntent } from "./wizard-save-intent-orchestrator";
import type { WizardSaveIntentResult } from "./wizard-save-intent-types";

// The DISABLED gateway, bound once. There is no code path here that can substitute the real one.
const persistenceService = new EstimatePersistenceService(notImplementedPersistenceGateway);

/**
 * A correlation id for the PII-free save-stage log, generated on the server.
 *
 * The browser cannot supply one — the action's only parameter is the raw intent — which is the
 * defect being removed from the legacy action's `meta.requestId`. It is never derived from
 * `idempotencyKey` (conflating a log id with a replay token would let a log correlation change
 * duplicate-detection behaviour), and the `req_` prefix keeps the two visibly distinct.
 *
 * It carries no clock, user, customer, vehicle, or pricing data: 16 random bytes and nothing else.
 * `src/lib/uuid/safe-random-uuid.ts` is deliberately NOT imported.
 *
 * A generator failure returns a constant literal rather than throwing. A logging id must never be
 * able to fail a save, and it certainly must never influence which gateway is used — the binding
 * above is fixed at module load and is entirely independent of this value.
 */
function newRequestId(): string {
  try {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `req_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "req_unattributed";
  }
}

/**
 * Accept an untrusted save intent and run the authoritative server save flow.
 *
 * Takes `raw: unknown` — by design. Nothing about the tenant, the role, the catalog, the rank, the
 * pricing, or the totals is accepted from the caller; all of it is resolved or derived server-side.
 * Persistence is disabled, so a fully valid intent terminates in `persistence-unavailable`.
 */
export async function saveEstimateFromWizardIntentAction(raw: unknown): Promise<WizardSaveIntentResult> {
  return runWizardSaveIntent(raw, {
    validateIntent: validateWizardSaveIntent,
    resolveActorContext: getEstimateSaveActorContext,
    loadRuntimeConfig: getAuthoritativeWizardRuntimeConfigForDealer,
    computePricing: computeWizardPricingFromConfig,
    mapSaveRequest: mapWizardDraftToSaveRequestFromConfig,
    validateSaveRequest: validateEstimateSaveRequest,
    persist: (request, context) => persistenceService.save(request, context),
    requestId: newRequestId(),
  });
}
