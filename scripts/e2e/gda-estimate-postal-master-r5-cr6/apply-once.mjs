// Offline, dependency-injected single-apply orchestrator for the CR6
// hosted-replay harness. Every process, clock, timer, environment, and
// event-sink effect is injected through `adapters`; this module never
// imports node:child_process and never spawns a real process itself. It
// does not execute anything at import time.

import { buildReplayCommand } from './replay-command-core.mjs';

/** One attempt-level ceiling shared by the read-only list call and the
 * single migration-up call (R2A-03: never two independent 30-minute
 * windows). */
export const MAX_DURATION_MS = 1_800_000;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Spawn one injected process for one replay command and resolve to a
 * deterministic decision under an injected clock/timer. On deadline
 * expiry, requests termination and waits for confirmed exit before
 * resolving (R2A-02: timeout never leaves the process running unconfirmed).
 */
export async function runWithTimeout(adapters, build, remainingMs, label) {
  if (typeof remainingMs !== 'number' || remainingMs <= 0) {
    return { decision: 'QUARANTINE_NO_RETRY', reason: `timeout:${label}` };
  }

  let handle;
  try {
    handle = adapters.process.spawn(build.executable, build.argv, build.options);
  } catch (error) {
    return { decision: 'QUARANTINE_NO_RETRY', reason: `spawn_failed:${label}`, detail: errorMessage(error) };
  }

  return new Promise((resolve) => {
    let settled = false;

    const timer = adapters.timer.setTimeout(async () => {
      if (settled) return;
      settled = true;
      try {
        await handle.terminate();
        await handle.waitForExit();
        resolve({ decision: 'QUARANTINE_NO_RETRY', reason: `timeout:${label}` });
      } catch (error) {
        resolve({ decision: 'QUARANTINE_NO_RETRY', reason: `timeout_termination_uncertain:${label}`, detail: errorMessage(error) });
      }
    }, remainingMs);

    try {
      handle.onExit((exitInfo) => {
        if (settled) return;
        settled = true;
        adapters.timer.clearTimeout(timer);

        const info = exitInfo || {};
        if (info.promptDetected) {
          resolve({ decision: 'QUARANTINE_NO_RETRY', reason: 'interactive_prompt', promptDetected: true });
          return;
        }
        if (info.signal) {
          resolve({ decision: 'QUARANTINE_NO_RETRY', reason: `signal:${info.signal}` });
          return;
        }
        if (info.targetMismatch) {
          resolve({ decision: 'QUARANTINE_NO_RETRY', reason: 'target_mismatch', targetMismatch: true });
          return;
        }
        if (info.ledgerMismatch) {
          resolve({ decision: 'QUARANTINE_NO_RETRY', reason: 'ledger_mismatch', ledgerMismatch: true });
          return;
        }
        if (info.code === 0) {
          resolve({ decision: 'SUCCESS' });
          return;
        }
        resolve({
          decision: 'QUARANTINE_NO_RETRY',
          reason: `non_zero_exit:${info.code}`,
          lastMigrationStart: info.lastMigrationStart,
        });
      });
    } catch (error) {
      if (!settled) {
        settled = true;
        adapters.timer.clearTimeout(timer);
        resolve({ decision: 'QUARANTINE_NO_RETRY', reason: `process_wiring_failed:${label}`, detail: errorMessage(error) });
      }
    }
  });
}

/**
 * Consume a previously accepted preflight plan and perform the exact
 * production-shaped sequence: one read-only list, at most one apply, a
 * shared 30-minute ceiling, explicit signal/prompt/mismatch handling, and a
 * result without retry.
 */
export async function applyOnce(plan, adapters) {
  if (!plan || typeof plan !== 'object') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['plan must be an object'] };
  }
  const { projectRef, isolatedWorkdir } = plan;
  if (typeof projectRef !== 'string' || projectRef.length === 0 || typeof isolatedWorkdir !== 'string' || isolatedWorkdir.length === 0) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['plan must carry projectRef and isolatedWorkdir'] };
  }
  if (!adapters || typeof adapters !== 'object') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['adapters must be an object'] };
  }

  let startedAt;
  try {
    startedAt = adapters.clock.now();
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`clock adapter failed: ${errorMessage(error)}`] };
  }
  const deadline = startedAt + MAX_DURATION_MS;

  const env = plan.sanitizedAmbientEnvironment || {};

  const listBuild = buildReplayCommand('list', { projectRef, workdir: isolatedWorkdir, env });
  if (!listBuild.ok) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: listBuild.errors };
  }

  let remainingForList;
  try {
    remainingForList = deadline - adapters.clock.now();
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`clock adapter failed: ${errorMessage(error)}`] };
  }
  if (remainingForList <= 0) {
    adapters.events.emit('quarantine', { stage: 'list', reason: 'timeout' });
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', reason: 'timeout' };
  }

  const listResult = await runWithTimeout(adapters, listBuild, remainingForList, 'list');
  if (listResult.decision !== 'SUCCESS') {
    adapters.events.emit('quarantine', { stage: 'list', reason: listResult.reason });
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', reason: listResult.reason };
  }

  let remainingForUp;
  try {
    remainingForUp = deadline - adapters.clock.now();
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`clock adapter failed: ${errorMessage(error)}`] };
  }
  if (remainingForUp <= 0) {
    adapters.events.emit('quarantine', { stage: 'up', reason: 'timeout' });
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', reason: 'timeout' };
  }

  const upBuild = buildReplayCommand('up', { projectRef, workdir: isolatedWorkdir, env });
  if (!upBuild.ok) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: upBuild.errors };
  }

  const upResult = await runWithTimeout(adapters, upBuild, remainingForUp, 'up');
  if (upResult.decision !== 'SUCCESS') {
    adapters.events.emit('quarantine', { stage: 'up', reason: upResult.reason, lastMigrationStart: upResult.lastMigrationStart });
    return {
      ok: false,
      decision: 'QUARANTINE_NO_RETRY',
      reason: upResult.reason,
      lastMigrationStart: upResult.lastMigrationStart,
    };
  }

  adapters.events.emit('success', { projectRef, isolatedWorkdir });
  return { ok: true, decision: 'SUCCESS' };
}
