// OBS-1A — the emission entry point.
//
// Sanitize, then emit ONLY the reconstructed event. The caller's original object
// is never forwarded, so nothing this module emits can carry a field the
// sanitizer did not build.

import { sanitizeObservabilityEvent } from "./sanitize-observability-event";
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

/** Current operational sink: structured JSON on the severity-matched channel. */
function consoleSink(event: ObservabilityEvent): void {
  const line = JSON.stringify(event);
  if (event.severity === "error")     console.error(OBSERVABILITY_LOG_PREFIX, line);
  else if (event.severity === "warn") console.warn(OBSERVABILITY_LOG_PREFIX, line);
  else                                console.info(OBSERVABILITY_LOG_PREFIX, line);
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

  const target = sink ?? externalProviderSink ?? consoleSink;
  try {
    target(event);
  } catch {
    // A throwing sink — an injected test double, or a future provider outage —
    // must not escape into the calling operation.
  }
}
