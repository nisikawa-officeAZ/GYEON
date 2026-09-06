"use client";

// B7-2C — the operator-facing save surface and the save-execution authority.
//
// FULLY INJECTED. This component reads no `window`, `document`, `history`,
// `location`, `sessionStorage`, `localStorage`, global `crypto`, route param,
// cookie, Supabase client or database. Everything it needs — the session, the
// storage/crypto dependencies, the invoker, the completion callback — arrives as
// props, which is what makes the whole save algorithm provable without a DOM.
//
// ── WHY THE ALGORITHM LIVES IN A SEPARATE FUNCTION ──────────────────────────
// `runWizardSaveAttempt` below is the single implementation of save ordering. The
// component calls it; the tests call the SAME function. Re-implementing the
// ordering inside a test helper would mean the tests prove a copy of the
// algorithm rather than the one that ships.
//
// ── WHY IT NEVER MINTS OR ROTATES A KEY ─────────────────────────────────────
// Identity belongs to B7-2B alone. This module imports the transition functions
// and `isValidEstimateId`, never a generator. A retry reuses the byte-identical
// key by construction: it reads the key back out of the persisted record rather
// than carrying one in a closure.

import { useCallback, useRef, useState } from "react";

import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardSaveIntentInvoker } from "./wizard-save-intent-types";
import {
  markWizardSessionPending, markWizardSessionFailed, markWizardSessionCompleted,
  isValidEstimateId,
  type ValidatedWizardSession, type WizardSessionDeps,
} from "./wizard-idempotency-session";

// ── Binding ─────────────────────────────────────────────────────────────────

/**
 * R89C — where the operator goes after a verified save.
 *
 * A CLOSED union, deliberately: routing must be able to reject anything that is
 * not one of these two, rather than defaulting an unrecognized runtime value
 * into a path. It is a UI intent only — it never enters the persisted session
 * record (whose parser accepts an exact key set), never reaches the invoker
 * payload, and carries no authority of its own.
 */
export type WizardSaveDestination = "estimate" | "pdf";

/**
 * Everything the panel needs to save, threaded from the production wrapper
 * through `EstimateWizard` → `Step7Review` without any step touching it.
 *
 * `session` is the BRANDED `ValidatedWizardSession`, so a binding cannot be
 * assembled from a hand-built object literal: only a successful B7-2B
 * initialization or recovery produces one.
 */
export type WizardSaveBinding = {
  readonly expectedConfigRevision: number;
  readonly saveInvoker: WizardSaveIntentInvoker;
  readonly session: ValidatedWizardSession;
  readonly sessionDeps: WizardSessionDeps;
  /**
   * Receives ONLY a validated estimate id — never the raw result or record —
   * and an EXPLICIT destination. The destination is non-optional so `undefined`
   * can never reach routing and be re-interpreted there.
   */
  readonly onCompleted: (estimateId: string, destination: WizardSaveDestination) => void;
};

/**
 * What the operator is shown. Distinct from the persisted session status: an
 * `unknown` outcome leaves the RECORD pending while the UI says the server result
 * is unknown, and `blocked` is never persisted at all.
 */
export type WizardSaveOutcome =
  | "ready"
  | "submitting"
  | "unknown"
  | "failed"
  | "completed"
  | "blocked";

/** Why the panel is blocked. Fixed vocabulary — never a raw value or message. */
export type WizardSaveBlockedReason =
  | "pending-write-failed"
  | "failed-write-failed"
  | "completed-write-failed"
  | "invalid-estimate-id"
  | "already-completed";

export type WizardSaveAttemptDeps = {
  /** Per-mount guard. Checked and set SYNCHRONOUSLY, before any await. */
  readonly inFlight: { current: boolean };
  readonly draft: Readonly<EstimateWizardDraftV22>;
  readonly binding: WizardSaveBinding;
  /**
   * Where a VERIFIED completion should route. Optional with a safe default of
   * `"estimate"` so every pre-R89C caller keeps its exact behaviour; the value
   * is captured by the caller BEFORE the first await and passed straight
   * through, so it cannot be re-read from state after an async gap.
   */
  readonly destination?: WizardSaveDestination;
  readonly onSession: (session: ValidatedWizardSession) => void;
  readonly onOutcome: (outcome: WizardSaveOutcome, blocked?: WizardSaveBlockedReason) => void;
};

// ── The execution core ──────────────────────────────────────────────────────

/**
 * One save attempt, in a fixed order:
 *
 *   1. check + set the in-flight guard (synchronous, before any await)
 *   2. persist `pending` (synchronous)
 *   3. if the pending write failed → BLOCKED, and the invoker is NOT called
 *   4. show pending
 *   5. invoke the saver exactly once with exactly three root keys
 *   6. process the controlled result
 *   7. release the guard in `finally`
 *
 * ── WHY THE GUARD IS SET BEFORE THE FIRST AWAIT ─────────────────────────────
 * Two clicks in the same tick both enter this function before either yields. A
 * guard set after an await would let both through and produce two invocations of
 * a real save. It is a ref rather than React state for the same reason: a state
 * update is not visible to the second synchronous caller.
 *
 * There is deliberately no time-based debounce and no generated attempt id —
 * neither a clock nor a random value may participate in save identity.
 */
export async function runWizardSaveAttempt(deps: WizardSaveAttemptDeps): Promise<void> {
  if (deps.inFlight.current) return;          // 1. same-tick / double-click
  deps.inFlight.current = true;

  const { binding, draft } = deps;
  const ws = binding.session.wizardSessionId;
  // Resolved ONCE, before any await. Nothing later re-reads it.
  const destination: WizardSaveDestination = deps.destination ?? "estimate";

  try {
    // A completed session is terminal. The wrapper normally redirects before this
    // panel ever mounts, but the component must still refuse rather than trust it.
    if (binding.session.status === "completed") {
      deps.onOutcome("blocked", "already-completed");
      return;
    }

    // 2-3. Pending FIRST. If it cannot be durably recorded, the save must not run:
    // an unrecorded attempt is exactly what allows a duplicate on the next retry.
    const pending = markWizardSessionPending(binding.sessionDeps, ws);
    if (!pending.ok) {
      deps.onOutcome("blocked", "pending-write-failed");
      return;
    }
    deps.onSession(pending.session);           // 4.
    deps.onOutcome("submitting");

    // 5. Exactly three root keys. The key comes from the PERSISTED record, so a
    // retry is byte-identical by construction rather than by discipline.
    let result;
    try {
      result = await binding.saveInvoker({
        draft,
        expectedConfigRevision: binding.expectedConfigRevision,
        idempotencyKey: pending.session.idempotencyKey,
      });
    } catch {
      // THROWN / network-unknown: the SERVER outcome is unknown. Recording
      // `failed` here would licence a retry under the assumption nothing was
      // written — and if the request did land, that retry creates a duplicate.
      // The record stays `pending` and the operator is told the outcome is unknown.
      deps.onOutcome("unknown");
      return;
    }

    // 6. Controlled result only.
    if (!result.ok) {
      const failed = markWizardSessionFailed(binding.sessionDeps, ws);
      if (!failed.ok) {
        // Do not claim the session is failed when that could not be recorded.
        deps.onOutcome("blocked", "failed-write-failed");
        return;
      }
      deps.onSession(failed.session);
      deps.onOutcome("failed");
      return;
    }

    // Success. `markWizardSessionCompleted` validates the UUID before persisting,
    // so an invalid id can never be stored and therefore never later read into a URL.
    const completed = markWizardSessionCompleted(binding.sessionDeps, ws, result.estimateId);
    if (!completed.ok) {
      deps.onOutcome(
        "blocked",
        completed.reason === "invalid-estimate-id" ? "invalid-estimate-id" : "completed-write-failed",
      );
      return;
    }
    deps.onSession(completed.session);
    deps.onOutcome("completed");

    // Only AFTER the verified completed write, and only the validated id — with
    // the destination captured before the invoker ran.
    if (completed.session.status === "completed" && isValidEstimateId(completed.session.estimateId)) {
      binding.onCompleted(completed.session.estimateId, destination);
    }
  } finally {
    deps.inFlight.current = false;             // 7.
  }
}

// ── Component ───────────────────────────────────────────────────────────────

const FAILURE_TEXT = "保存できませんでした。もう一度お試しください。";
const UNKNOWN_TEXT =
  "保存結果を確認できませんでした。二重登録を避けるため、同じ保存キーで再試行します。";
const BLOCKED_TEXT =
  "保存を開始できません。この画面を閉じずに、担当者へご連絡ください。";

export function WizardSavePanel({
  draft, binding,
}: { draft: Readonly<EstimateWizardDraftV22>; binding: WizardSaveBinding }) {
  const inFlight = useRef(false);
  const [session, setSession] = useState<ValidatedWizardSession>(binding.session);
  const [outcome, setOutcome] = useState<WizardSaveOutcome>(
    // A REMOUNT is not retry authorization. A recovered pending/failed session
    // shows its own state and its own explicit control; nothing runs automatically.
    binding.session.status === "pending" ? "unknown"
      : binding.session.status === "failed" ? "failed"
      : binding.session.status === "completed" ? "completed"
      : "ready",
  );
  const [blocked, setBlocked] = useState<WizardSaveBlockedReason | null>(null);

  /**
   * The remembered destination — a REF, not state, and deliberately so.
   *
   * `setDestination(d)` followed by starting the attempt would read the value
   * from the PREVIOUS render: React state is not visible to the same
   * synchronous caller that set it. The attempt would then route with a stale
   * destination. A ref is written and read in the same tick, so the value the
   * operator clicked is the value that is passed in.
   *
   * It starts at `"estimate"`, so a remount / reload — which cannot restore a
   * UI preference, because the destination is never persisted — falls back to
   * the safe default rather than to a PDF route nobody asked for on this mount.
   */
  const lastDestination = useRef<WizardSaveDestination>("estimate");

  const attempt = useCallback((destination?: WizardSaveDestination) => {
    // Read the SHARED guard before remembering anything: a second same-tick
    // click must neither start a second invocation nor repoint the destination
    // of the attempt that was already accepted. This is the same ref the
    // execution core latches — not a second guard.
    if (inFlight.current) return;
    if (destination !== undefined) lastDestination.current = destination;
    setBlocked(null);
    void runWizardSaveAttempt({
      inFlight,
      draft,
      binding: { ...binding, session },
      // Passed explicitly, from the ref just written — never re-read from state.
      destination: lastDestination.current,
      onSession: setSession,
      onOutcome: (o, reason) => { setOutcome(o); if (reason) setBlocked(reason); },
    });
  }, [draft, binding, session]);

  const submitting = outcome === "submitting";
  const isBlocked = outcome === "blocked";
  const recoveredPending = outcome === "unknown";
  const isFailed = outcome === "failed";
  const isCompleted = outcome === "completed";
  // The plain Save button exists ONLY for a genuinely fresh attempt. A recovered
  // pending or failed session gets a separate, explicitly-labelled retry control,
  // so an operator can never mistake "try again" for "save a new estimate".
  const canSaveFresh = outcome === "ready";

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3" data-testid="wizard-save-panel">
      {isCompleted && (
        <p className="text-sm text-emerald-300" data-testid="save-state-completed">
          保存が完了しました。見積を開いています…
        </p>
      )}

      {isBlocked && (
        <div data-testid="save-state-blocked">
          <p className="text-sm text-amber-300">{BLOCKED_TEXT}</p>
          <p className="text-[11px] text-slate-500 mt-1" data-testid="save-blocked-reason">{blocked ?? ""}</p>
        </div>
      )}

      {recoveredPending && (
        <div data-testid="save-state-unknown">
          <p className="text-sm text-amber-300">{UNKNOWN_TEXT}</p>
          <button
            type="button"
            data-testid="save-retry-same-key"
            disabled={submitting}
            onClick={() => attempt()}
            className="mt-2 rounded-md border border-amber-600 px-4 py-2 text-sm"
          >
            同じ保存キーで再試行
          </button>
        </div>
      )}

      {isFailed && (
        <div data-testid="save-state-failed">
          <p className="text-sm text-rose-300">{FAILURE_TEXT}</p>
          <button
            type="button"
            data-testid="save-retry-same-key"
            disabled={submitting}
            onClick={() => attempt()}
            className="mt-2 rounded-md border border-rose-600 px-4 py-2 text-sm"
          >
            同じ保存キーで再試行
          </button>
        </div>
      )}

      {submitting && (
        <p className="text-sm text-slate-300" data-testid="save-state-submitting">保存中…</p>
      )}

      {canSaveFresh && (
        <div data-testid="save-state-ready" className="flex flex-wrap gap-2">
          {/* Both controls run the SAME attempt, on the same guard, session and
              key. They differ only in where a VERIFIED completion routes. */}
          <button
            type="button"
            data-testid="save-submit"
            onClick={() => attempt("estimate")}
            className="rounded-md border border-emerald-600 bg-emerald-900/40 px-5 py-2.5 text-sm text-white"
          >
            保存
          </button>
          <button
            type="button"
            data-testid="save-submit-pdf"
            onClick={() => attempt("pdf")}
            className="rounded-md border border-sky-600 bg-sky-900/40 px-5 py-2.5 text-sm text-white"
          >
            保存してPDFを開く
          </button>
        </div>
      )}
    </div>
  );
}
