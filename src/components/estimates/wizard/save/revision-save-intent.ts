import type { WizardSaveIntent, WizardSaveIntentValidationIssue } from "./wizard-save-intent-types";
import { validateWizardSaveIntent } from "./wizard-save-intent-validation";

export type WizardRevisionSource = {
  readonly predecessorEstimateId: string;
  readonly sourceSnapshotFingerprint: string;
};

export type WizardRevisionSaveIntent = WizardSaveIntent & WizardRevisionSource;

export type WizardRevisionSaveIntentValidation =
  | { readonly ok: true; readonly intent: WizardRevisionSaveIntent }
  | { readonly ok: false; readonly issues: readonly WizardSaveIntentValidationIssue[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const ROOT_KEYS = [
  "draft", "expectedConfigRevision", "idempotencyKey",
  "predecessorEstimateId", "sourceSnapshotFingerprint",
] as const;

export function validateWizardRevisionSaveIntent(raw: unknown): WizardRevisionSaveIntentValidation {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, issues: [{ path: "intent", code: "invalid-type" }] };
    }
    const value = raw as Record<string, unknown>;
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return { ok: false, issues: [{ path: "intent", code: "invalid-type" }] };
    }
    const keys = Object.keys(value);
    if (keys.some((key) => !(ROOT_KEYS as readonly string[]).includes(key)) || ROOT_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
      return { ok: false, issues: [{ path: "intent.*", code: "unexpected-field" }] };
    }

    // Read every revision field once before delegating the reconstructed base
    // envelope. Throwing getters/proxy traps are converted to unreadable input.
    const draft = value.draft;
    const expectedConfigRevision = value.expectedConfigRevision;
    const idempotencyKey = value.idempotencyKey;
    const predecessorEstimateId = value.predecessorEstimateId;
    const sourceSnapshotFingerprint = value.sourceSnapshotFingerprint;
    const base = validateWizardSaveIntent({ draft, expectedConfigRevision, idempotencyKey });
    if (!base.ok) return base;
    if (typeof predecessorEstimateId !== "string" || !UUID.test(predecessorEstimateId)) {
      return { ok: false, issues: [{ path: "intent.predecessorEstimateId", code: "invalid-literal" }] };
    }
    if (typeof sourceSnapshotFingerprint !== "string" || !SHA256.test(sourceSnapshotFingerprint)) {
      return { ok: false, issues: [{ path: "intent.sourceSnapshotFingerprint", code: "invalid-literal" }] };
    }
    return {
      ok: true,
      intent: {
        ...base.intent,
        predecessorEstimateId,
        sourceSnapshotFingerprint,
      },
    };
  } catch {
    return { ok: false, issues: [{ path: "intent", code: "unreadable-input" }] };
  }
}
