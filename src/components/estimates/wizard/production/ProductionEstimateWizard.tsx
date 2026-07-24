"use client";

// B7-2C — the production wizard host and its hydration-safe client bootstrap.
//
// ── WHY THE PUBLIC PROPS CARRY NO SESSION AND NO CALLBACKS ──────────────────
// This component is mounted by an async Server Component in B7-3. That route
// cannot read `sessionStorage`, cannot call `crypto.getRandomValues` on the
// client's behalf, and cannot serialize a function across the RSC boundary.
// Anything the server cannot construct — a session, storage deps, a completion
// handler, a navigation callback — is therefore INTERNAL. The public props are
// exactly what a Server Component can produce, which is what makes the wrapper
// mountable from the route it exists for.
//
// ── WHY A SAVE-ENABLED TREE IS UNREPRESENTABLE WITHOUT A SESSION ────────────
// The internal ready child REQUIRES an `ActiveWizardSession` — branded, and with
// `completed` excluded at the type level. So "a production wizard that can save
// but has no validated session" and "a completed session mounted as an editable
// wizard" are both compile errors rather than review notes.
//
// ── WHY THE BOOTSTRAP DECISIONS ARE PURE FUNCTIONS ──────────────────────────
// `classifyWizardSessionQuery`, `decideWizardBootstrap`, `runOnce`,
// `navigateToEstimate` and the URL helpers take their world as arguments. Every
// lifecycle branch — copied tab, hostile `ws`, corrupt record, unavailable
// storage, Strict-Mode replay, failed redirect — is therefore provable without a
// DOM, which is the only way this many failure modes get covered honestly.

import { useCallback, useEffect, useRef, useState } from "react";

import EstimateWizard from "../EstimateWizard";
import type { WizardHostRuntimeInputs } from "../contract/wizard-pricing-runtime-inputs";
import type {
  WizardExistingEntityInputs, WizardPreselectionInputs,
} from "../contract/wizard-runtime-inputs";
import type { WizardSaveIntentInvoker } from "../save/wizard-save-intent-types";
import type { WizardSaveBinding, WizardSaveDestination } from "../save/WizardSavePanel";
import {
  initializeWizardSession, recoverWizardSession, isValidEstimateId, isValidWizardSessionId,
  type ValidatedWizardSession, type WizardSessionDeps,
  type WizardSessionStorage, type WizardSessionCrypto,
} from "../save/wizard-idempotency-session";

export const WIZARD_SESSION_QUERY_KEY = "ws";

// ── The non-completed active session ────────────────────────────────────────

/**
 * A validated session that is still EDITABLE.
 *
 * `completed` is terminal: its estimate exists, and re-opening the wizard on it
 * would present an editable draft for a saved estimate and expose a save button
 * whose only possible outcome is refusal. Deriving this with `Exclude` rather
 * than redeclaring the union means a future status added to B7-2B lands here
 * automatically instead of silently bypassing the boundary.
 */
export type ActiveWizardSession = Exclude<ValidatedWizardSession, { readonly status: "completed" }>;

// ── Public props: constructible from server-route inputs ALONE ──────────────

export interface ProductionEstimateWizardProps
  extends WizardHostRuntimeInputs, WizardExistingEntityInputs, WizardPreselectionInputs {
  /** REQUIRED. Injected in B7-3; this module imports no Server Action. */
  readonly saveInvoker: WizardSaveIntentInvoker;
  /** REQUIRED. Server-resolved from the dealer-bound runtime configuration. */
  readonly expectedConfigRevision: number;
  /** Preserves EstimateWizard's existing optional mode. */
  readonly mode?: "create" | "edit";
}

// ── Internal ready child: an ACTIVE validated session is REQUIRED ───────────

type ReadyProductionWizardProps = ProductionEstimateWizardProps & {
  /** Branded AND non-completed — only B7-2B can produce one, and never a completed one. */
  readonly session: ActiveWizardSession;
  readonly sessionDeps: WizardSessionDeps;
  readonly onCompleted: (estimateId: string, destination: WizardSaveDestination) => void;
};

function ReadyProductionWizard(props: ReadyProductionWizardProps) {
  const {
    session, sessionDeps, onCompleted, saveInvoker, expectedConfigRevision,
    mode, ...hostInputs
  } = props;

  const saveBinding: WizardSaveBinding = {
    expectedConfigRevision,
    saveInvoker,
    session,
    sessionDeps,
    onCompleted,
  };

  return <EstimateWizard {...hostInputs} mode={mode} saveBinding={saveBinding} />;
}

// ── The URL session-state classifier ────────────────────────────────────────

/**
 * The three URL states, kept DISTINCT.
 *
 * ── WHY THIS IS NOT `string | null` ─────────────────────────────────────────
 * The previous version returned null for both "no ws parameter" and "a ws
 * parameter that failed the grammar", and the bootstrap read null as permission
 * to mint. `?ws=malformed` could therefore create a replacement session id and a
 * replacement idempotency key for an estimate that already had one — the exact
 * duplicate-creation hole B7-2B exists to close, reintroduced through the URL.
 *
 * Absence and invalidity are different facts and must be different values. With
 * a three-arm union the compiler forces every caller to decide what an invalid
 * `ws` means, and there is no null for "mint" to be read out of.
 */
export type WizardSessionQueryState =
  | { readonly kind: "absent" }
  | { readonly kind: "valid"; readonly wizardSessionId: string }
  | { readonly kind: "invalid" };

/**
 * Classify the `ws` query parameter.
 *
 * Takes only a string: no storage, no crypto, no deps. Rejection is therefore
 * structurally incapable of probing for a key, not merely choosing not to.
 *
 * An unparseable query string is `invalid`, never `absent` — failing closed,
 * because "we could not read the URL" is not evidence that a session is absent.
 */
export function classifyWizardSessionQuery(search: string): WizardSessionQueryState {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return { kind: "invalid" };
  }
  const raw = params.get(WIZARD_SESSION_QUERY_KEY);
  if (raw === null) return { kind: "absent" };
  return isValidWizardSessionId(raw) ? { kind: "valid", wizardSessionId: raw } : { kind: "invalid" };
}

// ── Pure URL helpers ────────────────────────────────────────────────────────

/**
 * Add exactly `ws` to a URL, preserving every other query parameter and the hash.
 *
 * The onboarding handoff carries `customer_id`/`vehicle_id`; dropping them while
 * stamping the session id would silently discard the operator's preselection.
 *
 * The idempotency KEY is never placed in a URL — only the session id, which
 * carries no authority of its own — so a copied or shared link cannot carry
 * save identity with it.
 */
export function buildWizardSessionUrl(currentUrl: string, wizardSessionId: string): string {
  const hashAt = currentUrl.indexOf("#");
  const hash = hashAt >= 0 ? currentUrl.slice(hashAt) : "";
  const withoutHash = hashAt >= 0 ? currentUrl.slice(0, hashAt) : currentUrl;

  const queryAt = withoutHash.indexOf("?");
  const path = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
  const params = new URLSearchParams(queryAt >= 0 ? withoutHash.slice(queryAt + 1) : "");

  params.set(WIZARD_SESSION_QUERY_KEY, wizardSessionId);
  return `${path}?${params.toString()}${hash}`;
}

/**
 * The redirect target, or null.
 *
 * Validates independently of whatever produced the id, then encodes the segment.
 * Raw storage text is never concatenated into a path.
 */
export function buildEstimatePath(estimateId: unknown): string | null {
  if (!isValidEstimateId(estimateId)) return null;
  return `/estimates/${encodeURIComponent(estimateId as string)}`;
}

/**
 * The PDF destination (R89C).
 *
 * Same rule as `buildEstimatePath`: the id is validated here, at the last point
 * before it can become a URL, and encoded rather than concatenated. The id is
 * carried as a query value on the existing `/pdf` surface — no PDF module,
 * renderer or Storage call is imported or reached from this file.
 */
export function buildEstimatePdfPath(estimateId: unknown): string | null {
  if (!isValidEstimateId(estimateId)) return null;
  return `/pdf?estimateId=${encodeURIComponent(estimateId as string)}`;
}

/**
 * Resolve a post-save path, FAIL-CLOSED on both axes.
 *
 * An unrecognized runtime destination returns null rather than falling back to
 * either arm: silently treating an unknown value as "estimate" would turn a
 * corrupted or forged intent into a successful navigation, and treating it as
 * "pdf" would do the same in the other direction. Only the two literals route.
 */
export function buildPostSavePath(estimateId: unknown, destination: unknown): string | null {
  if (destination === "estimate") return buildEstimatePath(estimateId);
  if (destination === "pdf") return buildEstimatePdfPath(estimateId);
  return null;
}

// ── The one-shot guard ──────────────────────────────────────────────────────

/** A synchronous run-once latch. A ref cell, never React state. */
export type RunOnceGuard = { current: boolean };

/**
 * Run `operation` at most once per guard, and report whether it ran.
 *
 * ── WHY THE LATCH IS SET BEFORE THE OPERATION ───────────────────────────────
 * Two calls in the same tick — a React 19 Strict-Mode effect replay, or a double
 * click on "start a new estimate" — both enter before either yields. Latching
 * after the operation, or using `useState`, would let both through: the second
 * caller reads the pre-update value and mints a SECOND session id and idempotency
 * key for one logical estimate. That is precisely the duplicate this whole layer
 * exists to prevent.
 *
 * ── WHY A FAILURE DOES NOT RESET THE LATCH ──────────────────────────────────
 * A throw is not evidence that nothing happened. `initializeWizardSession` can
 * fail after persisting a record, so auto-retrying would mint a second key over a
 * durable first one. The operator recovers through an explicit new attempt on a
 * fresh mount, which carries a fresh guard.
 */
export function runOnce(guard: RunOnceGuard, operation: () => void): boolean {
  if (guard.current) return false;
  guard.current = true;
  operation();
  return true;
}

// ── The navigation seam ─────────────────────────────────────────────────────

/** Injected so navigation is provable without a router or a DOM. */
export type NavigationSeam = (path: string) => void;

export type NavigationOutcome =
  | { readonly kind: "navigated"; readonly path: string }
  | { readonly kind: "invalid-estimate-id" }
  | { readonly kind: "invalid-destination" }
  | { readonly kind: "redirect-failed" };

/**
 * The ONLY way an estimate id becomes a URL — for either post-save destination.
 *
 * Validation happens here, at the last point before navigation, regardless of
 * what already validated upstream — so no raw value can reach a URL even if a
 * future caller forgets. The id is checked FIRST, so an invalid id is reported
 * as such whatever the destination is, and an unrecognized destination is its
 * own distinct outcome rather than a silent fallback. A throwing navigator is a
 * reported outcome, not a swallowed one: a silent failure would leave the
 * operator staring at a wizard for an estimate that was already saved.
 *
 * `destination` defaults to `"estimate"` for the pre-R89C internal caller (the
 * completed-session reload), whose behaviour is unchanged.
 */
export function navigateToEstimate(
  navigate: NavigationSeam,
  estimateId: unknown,
  destination: unknown = "estimate",
): NavigationOutcome {
  if (!isValidEstimateId(estimateId)) return { kind: "invalid-estimate-id" };
  const path = buildPostSavePath(estimateId, destination);
  if (path === null) return { kind: "invalid-destination" };
  try {
    navigate(path);
  } catch {
    return { kind: "redirect-failed" };
  }
  return { kind: "navigated", path };
}

// ── Pure bootstrap decision ─────────────────────────────────────────────────

export type WizardBootstrapDecision =
  | { readonly kind: "active"; readonly session: ActiveWizardSession }
  | { readonly kind: "missing-session" }
  | { readonly kind: "completed"; readonly estimateId: string }
  | { readonly kind: "blocked"; readonly reason: string };

/**
 * Decide what to do for a given URL state — without touching the DOM.
 *
 * The three arms are exhaustive and their permissions do not overlap:
 *
 *   absent  → MAY initialize. The only branch that can mint identity.
 *   valid   → MAY recover only. A valid ws with no record is `missing-session`,
 *             because a copied URL or a second tab minting a replacement key is
 *             exactly how one logical estimate becomes two.
 *   invalid → blocked, and reaches no dependency at all. Note the ordering: the
 *             invalid arm returns BEFORE `deps` is read, so a hostile `ws` cannot
 *             cause a storage read, a crypto call, a write, or a URL change.
 *
 * The invalid `ws` is deliberately left in the address bar. Rewriting it would
 * destroy the evidence an operator needs to explain how they got here.
 */
export function decideWizardBootstrap(
  deps: WizardSessionDeps,
  query: WizardSessionQueryState,
  replaceUrl: (wizardSessionId: string) => void,
): WizardBootstrapDecision {
  if (query.kind === "invalid") {
    // Nothing below this line runs: no deps read, no replaceUrl call.
    return { kind: "blocked", reason: "invalid-session-id" };
  }

  if (query.kind === "valid") {
    const recovered = recoverWizardSession(deps, query.wizardSessionId);
    if (!recovered.ok) {
      return recovered.reason === "missing-record"
        ? { kind: "missing-session" }
        : { kind: "blocked", reason: recovered.reason };
    }
    if (recovered.session.status === "completed") {
      // Terminal. The id is carried, not a path: only `navigateToEstimate` builds
      // one, so there is a single validation point rather than two.
      return { kind: "completed", estimateId: recovered.session.estimateId };
    }
    return { kind: "active", session: recovered.session };
  }

  // No ws at all → a genuinely new session, the one case that may mint.
  const created = initializeWizardSession(deps, replaceUrl);
  if (!created.ok) return { kind: "blocked", reason: created.reason };
  return created.session.status === "completed"
    // Unreachable by construction: initialization always yields `ready`. Handled
    // rather than asserted so the active arm's type stays honest.
    ? { kind: "blocked", reason: "invalid-transition" }
    : { kind: "active", session: created.session };
}

// ── Safe browser dependency acquisition ─────────────────────────────────────
//
// Property ACCESS itself can throw (blocked cookies/storage in some browsers), so
// each read is individually contained. A failure yields null, which the session
// authority then treats as unavailable and fails closed on.

function safeSessionStorage(): WizardSessionStorage | null {
  try {
    const s = window.sessionStorage;
    return s && typeof s.getItem === "function" && typeof s.setItem === "function" ? s : null;
  } catch {
    return null;
  }
}

function safeCrypto(): WizardSessionCrypto | null {
  try {
    const c = window.crypto;
    return c && typeof c.getRandomValues === "function"
      ? { getRandomValues: (a: Uint8Array) => c.getRandomValues(a) }
      : null;
  } catch {
    return null;
  }
}

/** The real navigator. Called only from an effect or an operator callback. */
function browserNavigate(path: string): void {
  window.location.assign(path);
}

// ── The wrapper ─────────────────────────────────────────────────────────────

type BootstrapState =
  | { readonly kind: "booting" }
  | { readonly kind: "active"; readonly session: ActiveWizardSession; readonly deps: WizardSessionDeps }
  | { readonly kind: "missing-session" }
  | { readonly kind: "completed"; readonly path: string }
  | { readonly kind: "redirect-failed" }
  | { readonly kind: "blocked"; readonly reason: string };

export default function ProductionEstimateWizard(props: ProductionEstimateWizardProps) {
  const [state, setState] = useState<BootstrapState>({ kind: "booting" });

  // ── Two SEPARATE one-shot guards ───────────────────────────────────────
  // The hydration bootstrap and the explicit operator action are different
  // authorizations. Sharing one latch would mean a bootstrap that ran (and
  // legitimately ended in `missing-session`) had already consumed the operator's
  // single chance to start a new estimate.
  const bootstrapGuard = useRef(false);
  const startNewGuard = useRef(false);

  // `destination` defaults to the estimate detail, which is what the completed-
  // session reload branch below relies on. A save supplies it explicitly.
  const completeNavigation = useCallback((estimateId: unknown, destination: unknown = "estimate") => {
    const outcome = navigateToEstimate(browserNavigate, estimateId, destination);
    if (outcome.kind === "invalid-estimate-id") { setState({ kind: "blocked", reason: "invalid-estimate-id" }); return; }
    if (outcome.kind === "invalid-destination") { setState({ kind: "blocked", reason: "invalid-destination" }); return; }
    if (outcome.kind === "redirect-failed") { setState({ kind: "redirect-failed" }); return; }
    setState({ kind: "completed", path: outcome.path });
  }, []);

  const runBootstrap = useCallback(() => {
    let search = "";
    let href = "";
    try {
      search = window.location.search;
      href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    } catch {
      setState({ kind: "blocked", reason: "location-unavailable" });
      return;
    }

    const query = classifyWizardSessionQuery(search);

    // A hostile or malformed `ws` stops here — before storage or crypto is even
    // acquired, so the blocked path cannot touch either.
    if (query.kind === "invalid") { setState({ kind: "blocked", reason: "invalid-session-id" }); return; }

    const deps: WizardSessionDeps = { storage: safeSessionStorage(), crypto: safeCrypto() };

    const replaceUrl = (ws: string) => {
      // History REPLACEMENT — a second entry would make Back re-enter a session
      // that no longer matches the address bar.
      window.history.replaceState(null, "", buildWizardSessionUrl(href, ws));
    };

    const decision = decideWizardBootstrap(deps, query, replaceUrl);
    if (decision.kind === "active") { setState({ kind: "active", session: decision.session, deps }); return; }
    if (decision.kind === "completed") { completeNavigation(decision.estimateId); return; }
    if (decision.kind === "missing-session") { setState({ kind: "missing-session" }); return; }
    setState({ kind: "blocked", reason: decision.reason });
  }, [completeNavigation]);

  // ── The hydration boundary ─────────────────────────────────────────────
  // No browser API is touched during module evaluation or server render; the first
  // access happens here, after hydration. React 19 development replays effects, so
  // the shared one-shot helper — not a `useState` flag — is what makes the replay
  // a no-op rather than a second bootstrap that would see the ws the first one
  // just wrote and take a different branch.
  useEffect(() => {
    runOnce(bootstrapGuard, runBootstrap);
  }, [runBootstrap]);

  /**
   * The ONLY operator action permitted to mint a new session id and key, and it
   * fires at most once per mount through the same shipping helper.
   */
  const startNewEstimate = useCallback(() => {
    runOnce(startNewGuard, () => {
      let href = "";
      try {
        href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      } catch {
        setState({ kind: "blocked", reason: "location-unavailable" });
        return;
      }
      const deps: WizardSessionDeps = { storage: safeSessionStorage(), crypto: safeCrypto() };
      const created = initializeWizardSession(deps, (ws) => {
        window.history.replaceState(null, "", buildWizardSessionUrl(href, ws));
      });
      if (!created.ok) { setState({ kind: "blocked", reason: created.reason }); return; }
      if (created.session.status === "completed") { setState({ kind: "blocked", reason: "invalid-transition" }); return; }
      setState({ kind: "active", session: created.session, deps });
    });
  }, []);

  if (state.kind === "booting") {
    return <p className="text-xs text-slate-400 p-4" data-testid="bootstrap-booting">保存セッションを準備しています…</p>;
  }

  if (state.kind === "missing-session") {
    return (
      <div className="p-4" data-testid="bootstrap-missing-session">
        <p className="text-sm text-amber-300">
          この見積の保存セッションが見つかりません。別のタブで開いた、またはURLをコピーした可能性があります。
        </p>
        <button
          type="button"
          data-testid="bootstrap-start-new"
          onClick={startNewEstimate}
          className="mt-3 rounded-md border border-slate-600 px-4 py-2 text-sm"
        >
          新しい見積を開始
        </button>
      </div>
    );
  }

  if (state.kind === "completed") {
    return <p className="text-sm text-emerald-300 p-4" data-testid="bootstrap-completed-redirect">保存済みの見積を開いています…</p>;
  }

  if (state.kind === "redirect-failed") {
    return <p className="text-sm text-rose-300 p-4" data-testid="bootstrap-redirect-failed">画面を移動できませんでした。担当者へご連絡ください。</p>;
  }

  if (state.kind === "blocked") {
    return (
      <div className="p-4" data-testid="bootstrap-blocked">
        <p className="text-sm text-amber-300">保存機能を利用できません。担当者へご連絡ください。</p>
        <p className="text-[11px] text-slate-500 mt-1" data-testid="bootstrap-blocked-reason">{state.reason}</p>
      </div>
    );
  }

  return (
    <div data-testid="bootstrap-active">
      <ReadyProductionWizard
        {...props}
        session={state.session}
        sessionDeps={state.deps}
        onCompleted={completeNavigation}
      />
    </div>
  );
}
