import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOnce, runWithTimeout, MAX_DURATION_MS } from './apply-once.mjs';
import { REQUIRED_PROJECT_REF } from './replay-command-core.mjs';

const WORKDIR = '/private/isolated-fake-runtime-root/attempt-workdir';

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createFakeProcessAdapter(behaviors) {
  const calls = [];
  let index = 0;
  return {
    calls,
    spawn(executable, argv, options) {
      const behavior = behaviors[index] || { type: 'hang' };
      index += 1;
      calls.push({ executable, argv, options, behavior });
      return {
        onExit(cb) {
          behavior.exitCallback = cb;
          if (behavior.type === 'immediate-exit') {
            queueMicrotask(() => cb(behavior.exitInfo));
          }
        },
        async terminate() {
          behavior.terminated = true;
        },
        async waitForExit() {
          behavior.waitedForExit = true;
          return behavior.confirmedExit || { code: null, signal: 'SIGKILL' };
        },
      };
    },
  };
}

function createSequenceClock(values) {
  let index = 0;
  return {
    now: () => {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      return value;
    },
  };
}

function createFakeTimer() {
  const timers = [];
  return {
    timers,
    setTimeout(cb, ms) {
      const record = { cb, ms, cleared: false, fired: false };
      timers.push(record);
      return record;
    },
    clearTimeout(record) {
      record.cleared = true;
    },
    fireLast() {
      const active = timers.filter((t) => !t.cleared && !t.fired);
      const record = active[active.length - 1];
      if (!record) throw new Error('no active timer to fire');
      record.fired = true;
      return record.cb();
    },
  };
}

function createFakeEvents() {
  const emitted = [];
  return { emitted, emit: (name, payload) => emitted.push({ name, payload }) };
}

function buildPlan(overrides = {}) {
  return { projectRef: REQUIRED_PROJECT_REF, isolatedWorkdir: WORKDIR, sanitizedAmbientEnvironment: { SUPABASE_ACCESS_TOKEN: 'token' }, ...overrides };
}

function buildAdapters(overrides = {}) {
  return {
    process: overrides.process,
    clock: overrides.clock || createSequenceClock([0, 10, 20, 30, 40]),
    timer: overrides.timer || createFakeTimer(),
    events: overrides.events || createFakeEvents(),
  };
}

test('R2-11: the read-only list call precedes the single apply call, and both succeed', async () => {
  const process = createFakeProcessAdapter([
    { type: 'immediate-exit', exitInfo: { code: 0 } },
    { type: 'immediate-exit', exitInfo: { code: 0 } },
  ]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.ok, true);
  assert.equal(result.decision, 'SUCCESS');
  assert.equal(process.calls.length, 2);
  assert.ok(process.calls[0].argv.includes('list'));
  assert.ok(process.calls[1].argv.includes('up'));
});

test('R2-11: apply spawns the apply process at most once; a failing list call never spawns apply', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 1 } }]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.match(result.reason, /non_zero_exit:1/);
  assert.equal(process.calls.length, 1);
});

test('R2-12: a password/interactive prompt during list quarantines without spawning apply', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { promptDetected: true } }]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(result.reason, 'interactive_prompt');
  assert.equal(process.calls.length, 1);
});

test('R2-12: a target mismatch during list quarantines', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { targetMismatch: true } }]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(result.reason, 'target_mismatch');
  assert.equal(process.calls.length, 1);
});

test('R2-12: a ledger mismatch during list quarantines', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { ledgerMismatch: true } }]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(result.reason, 'ledger_mismatch');
  assert.equal(process.calls.length, 1);
});

test('R2-12: a signal received during the apply call quarantines with the signal recorded', async () => {
  const process = createFakeProcessAdapter([
    { type: 'immediate-exit', exitInfo: { code: 0 } },
    { type: 'immediate-exit', exitInfo: { signal: 'SIGTERM' } },
  ]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.match(result.reason, /signal:SIGTERM/);
  assert.equal(process.calls.length, 2);
});

test('R2-12/R2A-03: a non-zero exit on apply quarantines and records the last observed migration-start event', async () => {
  const process = createFakeProcessAdapter([
    { type: 'immediate-exit', exitInfo: { code: 0 } },
    { type: 'immediate-exit', exitInfo: { code: 1, lastMigrationStart: '20260901001246_jp_postal_master.sql' } },
  ]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.match(result.reason, /non_zero_exit:1/);
  assert.equal(result.lastMigrationStart, '20260901001246_jp_postal_master.sql');
});

test('R2A-03: the 30-minute ceiling is shared across list and apply; a slow list leaves no time for apply and apply is never spawned', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const clock = createSequenceClock([0, 0, MAX_DURATION_MS + 1]);
  const adapters = buildAdapters({ process, clock });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(result.reason, 'timeout');
  assert.equal(process.calls.length, 1, 'apply must never be spawned once the shared deadline has passed');
});

test('R2-13: MAX_DURATION_MS is exactly the fixed 1,800,000 ms watchdog', () => {
  assert.equal(MAX_DURATION_MS, 1_800_000);
});

test('R2A-02: a hung apply process is terminated and its exit is confirmed before the deadline quarantines it', async () => {
  const process = createFakeProcessAdapter([
    { type: 'immediate-exit', exitInfo: { code: 0 } },
    { type: 'hang', confirmedExit: { code: null, signal: 'SIGKILL' } },
  ]);
  const timer = createFakeTimer();
  const adapters = buildAdapters({ process, timer, clock: createSequenceClock([0, 10, 20]) });

  const resultPromise = applyOnce(buildPlan(), adapters);
  await flushMicrotasks();
  await timer.fireLast();
  const result = await resultPromise;

  assert.equal(result.ok, false);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.match(result.reason, /timeout:up/);
  assert.equal(process.calls.length, 2);
  assert.equal(process.calls[1].behavior.terminated, true);
  assert.equal(process.calls[1].behavior.waitedForExit, true);
});

test('runWithTimeout resolves SUCCESS immediately on a zero exit code', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const timer = createFakeTimer();
  const build = { executable: 'supabase', argv: ['migration', 'list'], options: { shell: false, env: {} } };
  const result = await runWithTimeout({ process, timer }, build, 1000, 'list');
  assert.equal(result.decision, 'SUCCESS');
  assert.equal(timer.timers[0].cleared, true);
});

test('runWithTimeout fails closed with zero or negative remaining time without spawning', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const build = { executable: 'supabase', argv: ['migration', 'list'], options: { shell: false, env: {} } };
  const zero = await runWithTimeout({ process, timer: createFakeTimer() }, build, 0, 'list');
  const negative = await runWithTimeout({ process, timer: createFakeTimer() }, build, -5, 'list');
  assert.equal(zero.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(negative.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(process.calls.length, 0);
});

test('applyOnce rejects a malformed plan without spawning anything', async () => {
  const process = createFakeProcessAdapter([]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce({}, adapters);
  assert.equal(result.ok, false);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(process.calls.length, 0);
});

test('applyOnce never retries: a single failing attempt produces exactly one terminal decision', async () => {
  const process = createFakeProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 1 } }]);
  const adapters = buildAdapters({ process });
  const result = await applyOnce(buildPlan(), adapters);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(process.calls.length, 1);
});

test('apply-once.mjs never imports node:child_process and performs no spawning at import time', async () => {
  const moduleUrl = new URL('./apply-once.mjs', import.meta.url);
  const source = await (await import('node:fs/promises')).readFile(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /from ['"]node:child_process|require\(['"]child_process['"]\)/);
});
