// Pure, deterministic state-transition contract for the CR6 harness. No I/O
// occurs here; the caller is responsible for persisting the burned-attempt
// ledger between invocations.

export const QUARANTINE_NO_RETRY = 'QUARANTINE_NO_RETRY';
export const SUCCESS_DECISION = 'SUCCESS';

const SAFE_ATTEMPT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/** Build the exact `project_ref + attempt_id` composite key. */
export function buildAttemptKey(projectRef, attemptId) {
  if (typeof projectRef !== 'string' || projectRef.length === 0) {
    return { ok: false, errors: ['projectRef must be a non-empty string'] };
  }
  if (typeof attemptId !== 'string' || !SAFE_ATTEMPT_ID_PATTERN.test(attemptId)) {
    return { ok: false, errors: ['attemptId must be a bounded safe identifier'] };
  }
  return { ok: true, key: `${projectRef}::${attemptId}` };
}

function toSet(burnedKeys) {
  return burnedKeys instanceof Set ? burnedKeys : new Set(burnedKeys || []);
}

/** Classify a single outcome into a deterministic decision. Unknown or
 * uncertain outcomes fail closed to QUARANTINE_NO_RETRY. */
export function classifyOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object') {
    return { ok: false, errors: ['outcome must be an object'] };
  }
  switch (outcome.kind) {
    case 'success': {
      if (outcome.exitCode !== 0) return { ok: false, errors: ['success outcome requires exitCode === 0'] };
      return { ok: true, decision: SUCCESS_DECISION };
    }
    case 'exit': {
      if (typeof outcome.exitCode !== 'number') {
        return { ok: false, errors: ['exit outcome requires a numeric exitCode'] };
      }
      if (outcome.exitCode === 0) return { ok: true, decision: SUCCESS_DECISION };
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: `non_zero_exit:${outcome.exitCode}` };
    }
    case 'timeout':
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: 'timeout' };
    case 'signal': {
      if (typeof outcome.signal !== 'string' || outcome.signal.length === 0) {
        return { ok: false, errors: ['signal outcome requires a signal name'] };
      }
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: `signal:${outcome.signal}` };
    }
    case 'prompt':
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: 'interactive_prompt' };
    case 'target_mismatch':
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: 'target_mismatch' };
    case 'ledger_mismatch':
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: 'ledger_mismatch' };
    case 'redaction_failure':
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: 'redaction_failure' };
    case 'hash_failure':
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: 'hash_failure' };
    case 'uncertain':
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: outcome.detail ? `uncertain:${outcome.detail}` : 'uncertain' };
    default:
      return { ok: true, decision: QUARANTINE_NO_RETRY, reason: `unknown_outcome_kind:${String(outcome.kind)}` };
  }
}

/** Whether the exact attempt key has already been burned. */
export function isBurned(burnedKeys, projectRef, attemptId) {
  const keyResult = buildAttemptKey(projectRef, attemptId);
  if (!keyResult.ok) return { ok: false, errors: keyResult.errors };
  return { ok: true, burned: toSet(burnedKeys).has(keyResult.key), key: keyResult.key };
}

/**
 * Burn the exact attempt key. Returns a new immutable ledger (never mutates
 * the caller's set). Fails closed if the key is already burned: there is no
 * transition back to an executable state.
 */
export function burnAttempt(burnedKeys, projectRef, attemptId) {
  const keyResult = buildAttemptKey(projectRef, attemptId);
  if (!keyResult.ok) return { ok: false, errors: keyResult.errors };
  const set = new Set(toSet(burnedKeys));
  if (set.has(keyResult.key)) {
    return { ok: false, errors: ['attempt key is already burned; it can never be reused'] };
  }
  set.add(keyResult.key);
  return { ok: true, burnedKeys: set, key: keyResult.key };
}

/** Whether the exact attempt key may still start execution. */
export function canExecute(burnedKeys, projectRef, attemptId) {
  const burnedResult = isBurned(burnedKeys, projectRef, attemptId);
  if (!burnedResult.ok) return burnedResult;
  return { ok: true, executable: !burnedResult.burned, key: burnedResult.key };
}
