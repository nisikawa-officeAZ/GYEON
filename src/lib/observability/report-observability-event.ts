// OBS-1A — the emission entry point.
//
// Sanitize, then emit ONLY the reconstructed event. The caller's original object
// is never forwarded, so nothing this module emits can carry a field the
// sanitizer did not build.

import { sanitizeObservabilityEvent } from "./sanitize-observability-event";
import { isTransportableEvent, sendObservabilityEvent } from "./observability-transport";
import type { ObservabilityEvent, ObservabilitySink } from "./observability-types";

/** Stable, greppable marker for the operational sink. */
export const OBSERVABILITY_LOG_PREFIX = "[observability]";

/**
 * The future external-provider adapter seam.
 *
 * DELIBERATELY NULL IN OBS-1A. No vendor SDK is installed, no account exists, no
 * network call is made, and no environment variable enables one. Activating a
 * provider is a separate, cost-bearing phase requiring owner authorization; this
 * constant exists so that phase is a one-line change against a tested seam
 * rather than a refactor of every call site.
 */
const externalProviderSink: ObservabilitySink | null = null;

/** Server/operational sink: structured JSON on the severity-matched channel. */
function consoleSink(event: ObservabilityEvent): void {
  const line = JSON.stringify(event);
  if (event.severity === "error")     console.error(OBSERVABILITY_LOG_PREFIX, line);
  else if (event.severity === "warn") console.warn(OBSERVABILITY_LOG_PREFIX, line);
  else                                console.info(OBSERVABILITY_LOG_PREFIX, line);
}

/**
 * OBS-1P — sink selection.
 *
 * On the SERVER, `consoleSink` reaches the platform's runtime logs, which an
 * operator can search. In the BROWSER it reaches the end user's own devtools
 * console and nobody else — so an `obs.*` support code the UI told the user to
 * quote was unsearchable. Browser uncaught-UI events therefore go to the
 * first-party same-origin route instead.
 *
 * ── WHY THIS CANNOT LOOP ────────────────────────────────────────────────────
 * The route handler runs on the server, where `window` is undefined, so its own
 * `reportObservabilityEvent` call selects `consoleSink`. A browser event cannot
 * reach the route's sink and the route's event cannot reach the transport; the
 * separation is the runtime itself, not a flag anyone could set wrongly.
 *
 * Only the ONE closed uncaught-UI event is transportable. Generic events reaching
 * a browser bundle still go to the console rather than opening the public
 * endpoint to arbitrary payloads.
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function selectDefaultSink(event: ObservabilityEvent): ObservabilitySink {
  return isBrowser() && isTransportableEvent(event)
    ? (e) => { sendObservabilityEvent(e); }
    : consoleSink;
}

/**
 * Report an observability event. Accepts untrusted input.
 *
 * ── WHY THIS CAN NEVER THROW ────────────────────────────────────────────────
 * Observability is a bystander to the operation it describes. If reporting could
 * throw, a logging defect would become an outage — a save that succeeded would
 * surface to the operator as a failure. Sanitization, serialization and sink
 * delivery are therefore each contained, and every failure path is silent.
 *
 * There is deliberately NO raw `Error`/`cause` parameter in this phase. Adding
 * one would reintroduce exactly the object whose diagnostic fields carry leaked
 * row data, and a caller would eventually pass it straight through.
 *
 * @param input Untrusted candidate event; reconstructed before emission.
 * @param sink  Optional override, for tests and the future provider adapter.
 */
export function reportObservabilityEvent(input: unknown, sink?: ObservabilitySink): void {
  let event: ObservabilityEvent;
  try {
    event = sanitizeObservabilityEvent(input);
  } catch {
    return; // sanitization is total, but a failure here must still stay silent
  }

  // An explicitly injected sink still wins outright — that is what keeps every
  // committed behavioural test asserting against a captured array rather than a
  // network call. The provider seam stays null; the default is chosen per-runtime.
  const target = sink ?? externalProviderSink ?? selectDefaultSink(event);
  try {
    target(event);
  } catch {
    // A throwing sink — an injected test double, or a future provider outage —
    // must not escape into the calling operation.
  }
}
