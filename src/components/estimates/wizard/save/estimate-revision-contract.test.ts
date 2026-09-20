import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { initialEstimateWizardDraftV22 } from "../draft/wizard-draft-state";
import { validateWizardRevisionSaveIntent } from "./revision-save-intent";

const migration = readFileSync(
  "supabase/migrations/20260920141616_estimate_revision_issuance.sql",
  "utf8",
);
const editRoute = readFileSync("src/app/estimates/[id]/edit/page.tsx", "utf8");
const gateway = readFileSync("src/components/estimates/wizard/save/supabase-revision-persistence-gateway.ts", "utf8");

const valid = () => ({
  draft: initialEstimateWizardDraftV22,
  expectedConfigRevision: 7,
  idempotencyKey: "RevisionKey_0001",
  predecessorEstimateId: "11111111-1111-4111-8111-111111111111",
  sourceSnapshotFingerprint: "a".repeat(64),
});

test("revision intent accepts only the exact five-field contract", () => {
  assert.equal(validateWizardRevisionSaveIntent(valid()).ok, true);
  assert.equal(validateWizardRevisionSaveIntent({ ...valid(), dealerId: "hostile" }).ok, false);
  assert.equal(validateWizardRevisionSaveIntent({ ...valid(), sourceSnapshotFingerprint: "short" }).ok, false);
  const hostile = valid();
  Object.defineProperty(hostile, "predecessorEstimateId", { enumerable: true, get: () => { throw new Error("hostile"); } });
  assert.deepEqual(validateWizardRevisionSaveIntent(hostile), {
    ok: false,
    issues: [{ path: "intent", code: "unreadable-input" }],
  });
});

test("migration stores immutable snapshots and a one-successor revision chain", () => {
  assert.match(migration, /CREATE TABLE public\.estimate_wizard_snapshots/);
  assert.match(migration, /CREATE TABLE public\.estimate_revisions/);
  assert.match(migration, /UNIQUE \(predecessor_estimate_id\)/);
  assert.match(migration, /UNIQUE \(successor_estimate_id\)/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.estimate_wizard_snapshots/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.estimate_revisions/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.estimates/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON public\.estimate_items/);
  assert.match(migration, /to_jsonb\(NEW\) - ARRAY\['status', 'updated_at'\]::text\[\]/);
  assert.match(migration, /s\.estimate_id = v_old_estimate_id[\s\S]+OR s\.estimate_id = v_new_estimate_id/);
});

test("create and revision RPCs persist the canonical draft in the same transaction", () => {
  assert.match(migration, /^--[\s\S]+\nBEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, /CREATE FUNCTION public\.save_estimate_from_wizard_v2/);
  assert.match(migration, /CREATE FUNCTION public\.issue_estimate_revision_from_wizard/);
  assert.equal((migration.match(/v_result := public\.save_estimate_from_wizard\(/g) ?? []).length, 2);
  assert.equal((migration.match(/INSERT INTO public\.estimate_wizard_snapshots/g) ?? []).length, 2);
  assert.doesNotMatch(migration, /UPDATE public\.estimates/);
});

test("revision persistence is service-role only and never mutates the predecessor", () => {
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.issue_estimate_revision_from_wizard[\s\S]+TO service_role/);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.issue_estimate_revision_from_wizard[^;]+TO (?:PUBLIC|anon|authenticated)/);
  assert.match(gateway, /issue_estimate_revision_from_wizard/);
  assert.doesNotMatch(gateway, /\.update\(|\.delete\(/);
  assert.match(migration, /r\.dealer_id = p_dealer_id/);
  assert.match(migration, /e\.dealer_id = p_dealer_id/);
  assert.match(migration, /s\.dealer_id = p_dealer_id/);
});

test("edit route mounts only the canonical wizard for snapshot-backed estimates and fails legacy rows closed", () => {
  assert.match(editRoute, /getEstimateRevisionSource/);
  assert.match(editRoute, /initialDraft=\{source\.draft\}/);
  assert.match(editRoute, /revisionSaveInvoker=\{issueEstimateRevisionAction\}/);
  assert.match(editRoute, /この見積には正本データがありません/);
  assert.doesNotMatch(editRoute, /EstimateEditor/);
});
