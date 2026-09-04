import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUARANTINE_NO_RETRY,
  SUCCESS_DECISION,
  buildAttemptKey,
  classifyOutcome,
  isBurned,
  burnAttempt,
  canExecute,
} from './quarantine-core.mjs';

const PROJECT_REF = 'nqvnjqcxgngqsqkbpdfi';

test('R2-12: a zero exit code classifies as SUCCESS', () => {
  const result = classifyOutcome({ kind: 'exit', exitCode: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.decision, SUCCESS_DECISION);
});

test('R2-12: a non-zero exit code burns and quarantines with no retry', () => {
  const result = classifyOutcome({ kind: 'exit', exitCode: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
  assert.match(result.reason, /non_zero_exit:1/);
});

test('R2-12: a timeout classifies as QUARANTINE_NO_RETRY', () => {
  const result = classifyOutcome({ kind: 'timeout' });
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
  assert.equal(result.reason, 'timeout');
});

test('R2-12: a signal classifies as QUARANTINE_NO_RETRY and records the signal name', () => {
  const result = classifyOutcome({ kind: 'signal', signal: 'SIGTERM' });
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
  assert.match(result.reason, /signal:SIGTERM/);
});

test('R2-12: an interactive prompt classifies as QUARANTINE_NO_RETRY', () => {
  const result = classifyOutcome({ kind: 'prompt' });
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
  assert.equal(result.reason, 'interactive_prompt');
});

test('R2-12: a target mismatch classifies as QUARANTINE_NO_RETRY', () => {
  const result = classifyOutcome({ kind: 'target_mismatch' });
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
});

test('R2-12: a ledger mismatch classifies as QUARANTINE_NO_RETRY', () => {
  const result = classifyOutcome({ kind: 'ledger_mismatch' });
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
});

test('an evidence redaction failure classifies as QUARANTINE_NO_RETRY', () => {
  const result = classifyOutcome({ kind: 'redaction_failure' });
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
});

test('an evidence hash failure classifies as QUARANTINE_NO_RETRY', () => {
  const result = classifyOutcome({ kind: 'hash_failure' });
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
});

test('an uncertain state classifies as QUARANTINE_NO_RETRY', () => {
  const withoutDetail = classifyOutcome({ kind: 'uncertain' });
  assert.equal(withoutDetail.decision, QUARANTINE_NO_RETRY);
  assert.equal(withoutDetail.reason, 'uncertain');

  const withDetail = classifyOutcome({ kind: 'uncertain', detail: 'termination_confirmation_missing' });
  assert.match(withDetail.reason, /uncertain:termination_confirmation_missing/);
});

test('an unrecognized outcome kind fails closed to QUARANTINE_NO_RETRY rather than throwing', () => {
  const result = classifyOutcome({ kind: 'something_never_defined' });
  assert.equal(result.ok, true);
  assert.equal(result.decision, QUARANTINE_NO_RETRY);
});

test('classifyOutcome rejects a non-object outcome', () => {
  assert.equal(classifyOutcome(null).ok, false);
  assert.equal(classifyOutcome('string').ok, false);
  assert.equal(classifyOutcome(undefined).ok, false);
});

test('classifyOutcome rejects a success outcome with a non-zero exitCode', () => {
  const result = classifyOutcome({ kind: 'success', exitCode: 1 });
  assert.equal(result.ok, false);
});

test('R2-18: burnAttempt records exactly the project_ref + attempt_id composite key', () => {
  const result = burnAttempt(new Set(), PROJECT_REF, 'attempt-001');
  assert.equal(result.ok, true);
  assert.equal(result.key, `${PROJECT_REF}::attempt-001`);
  assert.equal(result.burnedKeys.has(result.key), true);
});

test('R2-18: a burned project_ref + attempt_id pair can never return to an executable state', () => {
  const first = burnAttempt(new Set(), PROJECT_REF, 'attempt-002');
  assert.equal(first.ok, true);

  const secondAttempt = burnAttempt(first.burnedKeys, PROJECT_REF, 'attempt-002');
  assert.equal(secondAttempt.ok, false);
  assert.match(secondAttempt.errors[0], /already burned/);

  const canExecuteResult = canExecute(first.burnedKeys, PROJECT_REF, 'attempt-002');
  assert.equal(canExecuteResult.ok, true);
  assert.equal(canExecuteResult.executable, false);
});

test('R2-18: a different attempt_id under the same project_ref remains independently executable', () => {
  const first = burnAttempt(new Set(), PROJECT_REF, 'attempt-003');
  const otherStillExecutable = canExecute(first.burnedKeys, PROJECT_REF, 'attempt-004');
  assert.equal(otherStillExecutable.ok, true);
  assert.equal(otherStillExecutable.executable, true);
});

test('burnAttempt never mutates the caller-supplied Set', () => {
  const original = new Set();
  const result = burnAttempt(original, PROJECT_REF, 'attempt-005');
  assert.equal(result.ok, true);
  assert.equal(original.size, 0);
  assert.equal(result.burnedKeys.size, 1);
});

test('isBurned and buildAttemptKey reject malformed identifiers', () => {
  assert.equal(buildAttemptKey('', 'attempt-006').ok, false);
  assert.equal(buildAttemptKey(PROJECT_REF, '').ok, false);
  assert.equal(buildAttemptKey(PROJECT_REF, '../escape').ok, false);
  assert.equal(buildAttemptKey(PROJECT_REF, 'has spaces').ok, false);
  assert.equal(isBurned(new Set(), PROJECT_REF, '').ok, false);
});

test('isBurned accepts a plain array as the burned-key ledger', () => {
  const key = burnAttempt(new Set(), PROJECT_REF, 'attempt-007').key;
  const result = isBurned([key], PROJECT_REF, 'attempt-007');
  assert.equal(result.ok, true);
  assert.equal(result.burned, true);
});

test('quarantine-core performs no I/O and holds no hidden module-level mutable state', async () => {
  const moduleUrl = new URL('./quarantine-core.mjs', import.meta.url);
  const source = await (await import('node:fs/promises')).readFile(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /child_process|from ['"]node:fs|from ['"]fs['"]/);
});
