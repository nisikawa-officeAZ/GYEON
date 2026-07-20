// OBS-1B — pure controller for uncaught-UI-error reporting.
//
// No React, no JSX, no DOM, no Next, no Supabase, no network. The boundary
// components own rendering and React state; this module owns the DECISION of
// whether an event may be emitted, so that decision is unit-testable without a
// renderer and without faking an effect.
//
// ── WHY A LATCH RATHER THAN AN EFFECT DEPENDENCY ────────────────────────────
// React 19 double-invokes effects in development Strict Mode, and an effect can
// legitimately re-run. A dependency array alone therefore does NOT guarantee one
// event per incident. The latch makes "already reported this incident" an
// explicit, inspectable value rather than an emergent property of scheduling.

import { reportObservabilityEvent } from "./report-observability-event";
import type { ObservabilitySink } from "./observability-types";

/** The boundaries that may report. Closed union — no free-form stage strings. */
export type UiErrorBoundaryStage =
  | "global-boundary"
  | "app-boundary"
  | "estimates-boundary";

/**
 * The minimal mutable cell the caller owns.
 *
 * Structurally compatible with React's `useRef<string | null>(null)` while
 * requiring no React import here, which is what keeps this module renderer-free.
 */
export type UiErrorReportLatch = { current: string | null };

/** The stable code for every uncaught UI boundary incident. */
export const UI_ERROR_EVENT = "uncaught-ui-error";
export const UI_ERROR_CODE = "UNCAUGHT_UI_ERROR";

/**
 * Report one uncaught-UI-error event for one incident, at most once.
 *
 * ── WHAT IS DELIBERATELY NOT A PARAMETER ────────────────────────────────────
 * There is no `error`, `digest`, `message`, `route`, `url`, `dealerId`,
 * `userId` or metadata parameter. A caller cannot forward the thrown value even
 * by accident, because the signature provides nowhere to put it. That is a
 * stronger guarantee than sanitizing an error after accepting one.
 *
 * `env` and `release` are NOT set here — the committed OBS-1A sanitizer resolves
 * them internally, and this module must not be able to influence them.
 *
 * ── ORDERING ────────────────────────────────────────────────────────────────
 * The latch is set BEFORE delivery is attempted. If a sink fails, the incident
 * still counts as reported: retrying delivery on every effect re-run would turn
 * one broken sink into an unbounded event storm, which is worse than one lost
 * event. Losing an event degrades observability; a storm degrades the service.
 *
 * @param latch       Caller-owned cell holding the last reported support code.
 * @param supportCode The `obs.*` code shown to the operator, used as requestId.
 * @param stage       Which boundary caught the incident.
 * @param sink        Optional override, for tests and a future adapter.
 */
export function reportUiErrorOnce(
  latch: UiErrorReportLatch,
  supportCode: string,
  stage: UiErrorBoundaryStage,
  sink?: ObservabilitySink,
): void {
  // Same incident, already handled — including a Strict Mode second invocation.
  if (latch.current === supportCode) return;

  latch.current = supportCode;

  // `reportObservabilityEvent` sanitizes and never throws, so a failing sink
  // cannot escape into the boundary's effect and break reset or navigation.
  reportObservabilityEvent(
    {
      event:     UI_ERROR_EVENT,
      severity:  "error",
      requestId: supportCode,
      stage,
      code:      UI_ERROR_CODE,
    },
    sink,
  );
}
