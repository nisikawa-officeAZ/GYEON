"use server";

import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { getAuthoritativeWizardRuntimeConfigForDealer } from "@/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer";
import { computeWizardPricingFromConfig } from "../pricing/compute-wizard-pricing-from-config";
import { mapWizardDraftToSaveRequestFromConfig } from "./estimate-save-mapper-from-config";
import { validateEstimateSaveRequest } from "./estimate-save-validation";
import { EstimatePersistenceService } from "./estimate-persistence-service";
import { runWizardSaveIntent } from "./wizard-save-intent-orchestrator";
import { validateWizardSaveIntent } from "./wizard-save-intent-validation";
import { validateWizardRevisionSaveIntent } from "./revision-save-intent";
import { createSupabaseRevisionPersistenceGateway } from "./supabase-revision-persistence-gateway";
import { createObservabilityRequestId } from "@/lib/observability/create-observability-request-id";
import { createWizardSaveFailureReporter } from "./wizard-save-observability";
import type { WizardSaveIntentResult } from "./wizard-save-intent-types";

export async function issueEstimateRevisionAction(raw: unknown): Promise<WizardSaveIntentResult> {
  const revision = validateWizardRevisionSaveIntent(raw);
  if (!revision.ok) return { ok: false, failure: "invalid-intent", issues: revision.issues };

  const source = {
    predecessorEstimateId: revision.intent.predecessorEstimateId,
    sourceSnapshotFingerprint: revision.intent.sourceSnapshotFingerprint,
  };
  const service = new EstimatePersistenceService(createSupabaseRevisionPersistenceGateway(source));
  const requestId = createObservabilityRequestId();
  const base = {
    draft: revision.intent.draft,
    expectedConfigRevision: revision.intent.expectedConfigRevision,
    idempotencyKey: revision.intent.idempotencyKey,
  };

  return runWizardSaveIntent(base, {
    validateIntent: validateWizardSaveIntent,
    resolveActorContext: getEstimateSaveActorContext,
    loadRuntimeConfig: getAuthoritativeWizardRuntimeConfigForDealer,
    computePricing: computeWizardPricingFromConfig,
    mapSaveRequest: mapWizardDraftToSaveRequestFromConfig,
    validateSaveRequest: validateEstimateSaveRequest,
    persist: (request, context, draftSnapshot) => service.save(request, context, draftSnapshot),
    requestId,
    reportFailure: createWizardSaveFailureReporter(requestId),
  });
}
