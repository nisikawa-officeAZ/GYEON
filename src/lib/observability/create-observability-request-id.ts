// OBS-1A — observability correlation id.
//
// A correlation id ONLY. It is not a replay token, not a session id, and not an
// authorization value. It exists so an operator can tie a user-visible support
// code to a log line without any personal data passing through either.

import { OBSERVABILITY_FALLBACK_REQUEST_ID } from "./observability-types";

/**
 * `obs.` + 32 lowercase hex characters, from 16 cryptographically random bytes.
 *
 * ── WHY THE DOT MATTERS ─────────────────────────────────────────────────────
 * The `.` separator is load-bearing, not cosmetic. The idempotency-key language
 * is `/^[A-Za-z0-9_-]{16,64}$/`, which admits `_` — so an `obs_…` id could also
 * be a valid key, and the two identifier spaces would merely look different
 * rather than be different. `.` is outside that alphabet, so every id produced
 * here is structurally impossible as an idempotency key.
 *
 * ── WHY ONLY Web Crypto ─────────────────────────────────────────────────────
 * `Date`, `Math.random`, a module counter and `crypto.randomUUID` are all
 * deliberately unused:
 *   • a clock or counter makes ids guessable and correlatable ACROSS requests,
 *     which turns a correlation id into a weak tracking identifier;
 *   • `Math.random` is not cryptographically random, and
 *     `src/lib/uuid/safe-random-uuid.ts` falls back to it — which is exactly why
 *     that helper is NOT reused here;
 *   • `crypto.randomUUID` is unavailable outside secure contexts, so it would
 *     force a fallback path, and the only safe fallback is "no id at all".
 *
 * ── WHY FAILURE IS A CONSTANT, NOT A THROW ──────────────────────────────────
 * Generating a log id must never be able to fail the operation it is describing.
 * When Web Crypto is missing or throws, this returns the fixed literal
 * `obs.unattributed`: the event still reaches the sink and remains countable for
 * alerting, it simply cannot be correlated to a single request. Losing
 * correlation is acceptable; inventing a fake id, or crashing a save because a
 * log id could not be produced, is not.
 *
 * The id is NEVER derived from an idempotency key. Conflating the two would let
 * a logging concern change duplicate-detection behaviour.
 */
export function createObservabilityRequestId(): string {
  try {
    const webCrypto = globalThis.crypto;
    if (!webCrypto || typeof webCrypto.getRandomValues !== "function") {
      return OBSERVABILITY_FALLBACK_REQUEST_ID;
    }
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    return `obs.${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return OBSERVABILITY_FALLBACK_REQUEST_ID;
  }
}
