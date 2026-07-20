// OBS-1P — first-party browser → server observability transport.
//
// ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
// OBS-1B ships a UI that shows a user an `obs.*` support code and tells them to
// quote it. Until now that code was written by `consoleSink` to the END USER'S
// OWN devtools console and nowhere else — so support was handed an identifier
// they had no way to look up. The mechanism looked complete and was inert.
//
// ── WHY fetch + keepalive, AND NOTHING ELSE ─────────────────────────────────
// `navigator.sendBeacon` cannot set `Content-Type: application/json`: a beacon
// sends text/plain, multipart/form-data or x-www-form-urlencoded. Accepting one
// of those would force the route to widen exactly the surface its closed DTO
// narrows. `keepalive: true` gives the same survives-page-teardown property
// while keeping the strict content type, so the route can reject anything else
// outright.
//
// A beacon→fetch fallback chain is deliberately NOT implemented: two transports
// means two body encodings, two parser paths and two sets of tests, doubling the
// attack surface of a PUBLIC UNAUTHENTICATED endpoint to hedge a case keepalive
// already covers.
//
// ── WHAT THIS MODULE MUST NEVER DO ──────────────────────────────────────────
// Throw, retry, await, read cookies, accept a configurable host, carry a
// caller-supplied header, or report its own failure through the observability
// pipeline. That last one is not a style rule: a transport failure reported via
// the transport is an infinite loop under precisely the condition (network
// down) that triggers it.

import type { ObservabilityEvent } from "./observability-types";

/** Same-origin by construction. There is no configurable host, ever. */
export const OBSERVABILITY_EVENT_PATH = "/api/observability/event";

/** The ONE event this transport carries. Generic events stay server-side. */
export const TRANSPORTABLE_EVENT = "uncaught-ui-error";
export const TRANSPORTABLE_CODE = "UNCAUGHT_UI_ERROR";
export const TRANSPORTABLE_STAGES = [
  "global-boundary", "app-boundary", "estimates-boundary",
] as const;

export type TransportableStage = (typeof TRANSPORTABLE_STAGES)[number];

/**
 * `obs.<32 lowercase hex>` ONLY.
 *
 * Deliberately stricter than the core's pattern, which also admits
 * `obs.unattributed`. An unattributable code sent from an anonymous public
 * endpoint is not worth a log line: nobody can search for it, and accepting it
 * would let a caller emit unlimited indistinguishable records.
 */
const ATTRIBUTED_REQUEST_ID = /^obs\.[0-9a-f]{32}$/;

/** The complete wire contract. Four scalar keys. Nowhere to put anything else. */
export type ObservabilityTransportBody = {
  readonly requestId: string;
  readonly event: typeof TRANSPORTABLE_EVENT;
  readonly stage: TransportableStage;
  readonly code: typeof TRANSPORTABLE_CODE;
};

/** Minimal shape of `fetch`, so a test double needs no DOM lib types. */
export type FetchLike = (input: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
  credentials: "omit";
  keepalive: boolean;
}) => unknown;

/**
 * Build the wire body, or `null` when the event is not transportable.
 *
 * Reconstructs from four validated fields rather than copying the event, so a
 * field the sanitizer added (`env`, `release`, `dealerId`, `userId`,
 * `durationMs`, `severity`) has no path onto the wire even though it is present
 * on the input object.
 */
export function toTransportBody(event: ObservabilityEvent): ObservabilityTransportBody | null {
  if (event.event !== TRANSPORTABLE_EVENT) return null;
  if (event.code !== TRANSPORTABLE_CODE) return null;
  if (!(TRANSPORTABLE_STAGES as readonly string[]).includes(event.stage)) return null;
  if (typeof event.requestId !== "string" || !ATTRIBUTED_REQUEST_ID.test(event.requestId)) return null;

  return {
    requestId: event.requestId,
    event: TRANSPORTABLE_EVENT,
    stage: event.stage as TransportableStage,
    code: TRANSPORTABLE_CODE,
  };
}

/** True when this event is the one the browser transport carries. */
export function isTransportableEvent(event: ObservabilityEvent): boolean {
  return toTransportBody(event) !== null;
}

/**
 * Fire-and-forget delivery. Returns `void` — there is nothing for a caller to
 * await, and nothing it could usefully do with a result.
 *
 * Every failure mode is contained:
 *   • `fetch` absent               → return silently
 *   • `fetch` throws synchronously → caught (a malformed argument can do this,
 *                                    not only a rejected promise)
 *   • the promise rejects          → swallowed, never retried
 *
 * Retrying is not an oversight. During an error storm the network is the thing
 * that is failing; retrying would turn observability into the outage.
 */
export function sendObservabilityEvent(event: ObservabilityEvent, fetchImpl?: FetchLike): void {
  try {
    const body = toTransportBody(event);
    if (body === null) return;

    const send = fetchImpl ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (typeof send !== "function") return;

    const result = send(OBSERVABILITY_EVENT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // `omit` is stated EXPLICITLY. The fetch default is "same-origin", which
      // WOULD attach cookies; the route authenticates nothing, so they serve no
      // purpose and their absence is worth guaranteeing rather than inheriting.
      credentials: "omit",
      // Survives the page teardown that a global error boundary often precedes.
      keepalive: true,
    });

    // Swallow rejection without awaiting. Never `.catch` blindly — a double may
    // return a non-promise, and calling a missing method would throw here.
    const maybe = result as { then?: (a: unknown, b: () => void) => unknown } | undefined;
    if (maybe && typeof maybe.then === "function") maybe.then(undefined, () => {});
  } catch {
    // Silent by contract. Reporting this failure through reportObservabilityEvent
    // would re-enter this function and loop forever exactly when the network is
    // down. A lost report is the correct outcome.
  }
}
