import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { EstimateSaveActorContext } from "@/lib/auth/estimate-save-actor-context";
import { validateWizardSaveIntent } from "@/components/estimates/wizard/save/wizard-save-intent-validation";
import type { EstimateWizardDraftV22 } from "@/components/estimates/wizard/draft/wizard-draft-types";

export type EstimateRevisionSource = {
  readonly predecessorEstimateId: string;
  readonly sourceSnapshotFingerprint: string;
  readonly draft: Readonly<EstimateWizardDraftV22>;
};

/**
 * Load and re-validate the immutable canonical source for a revision.
 * Legacy rows have no snapshot and return null; line items are never reverse-engineered.
 */
export async function getEstimateRevisionSource(
  estimateId: string,
  actor: EstimateSaveActorContext,
): Promise<EstimateRevisionSource | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(estimateId)) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("estimate_wizard_snapshots")
    .select("estimate_id, dealer_id, draft_snapshot, snapshot_fingerprint, configuration_revision")
    .eq("estimate_id", estimateId)
    .eq("dealer_id", actor.dealerId)
    .maybeSingle();

  if (error || !data || typeof data.snapshot_fingerprint !== "string") return null;
  if (!/^[0-9a-f]{64}$/.test(data.snapshot_fingerprint)) return null;

  // Reuse the complete authoritative draft validator. The synthetic key is a
  // fixed validator fixture, never save identity and never sent to persistence.
  const validated = validateWizardSaveIntent({
    draft: data.draft_snapshot,
    expectedConfigRevision: data.configuration_revision,
    idempotencyKey: "RevisionReadOnly1",
  });
  if (!validated.ok) return null;

  return {
    predecessorEstimateId: data.estimate_id,
    sourceSnapshotFingerprint: data.snapshot_fingerprint,
    draft: validated.intent.draft,
  };
}
