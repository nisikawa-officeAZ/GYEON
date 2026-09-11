// Offline, dependency-injected evidence finalizer for the CR6 hosted-replay
// harness. Every volatile-storage, retention-storage, hashing, and deletion
// effect is injected through `adapters`; this module never touches a real
// filesystem itself and does not execute anything at import time.

import { redactSecrets, scanForSecrets } from './redaction-core.mjs';

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** R2A-06: accept only a bounded safe artifact identifier. Rejects path
 * separators, parent-directory references, empty segments, and control
 * characters before any storage read or write. */
export function validateArtifactIdentifier(name) {
  if (typeof name !== 'string' || name.length === 0) {
    return { ok: false, errors: ['artifact name must be a non-empty string'] };
  }
  if (name.includes('/') || name.includes('\\')) {
    return { ok: false, errors: [`artifact name must not contain a path separator: ${name}`] };
  }
  if (name === '.' || name === '..' || name.includes('..')) {
    return { ok: false, errors: [`artifact name must not contain a parent-directory reference: ${name}`] };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(name)) {
    return { ok: false, errors: [`artifact name must not contain control characters: ${name}`] };
  }
  if (!SAFE_IDENTIFIER_PATTERN.test(name)) {
    return { ok: false, errors: [`artifact name must match the safe identifier grammar: ${name}`] };
  }
  return { ok: true, key: name };
}

/**
 * Redact before retention, scan the redacted copy, verify retained hashes,
 * and only then dispose of raw output. Any uncertain or failed step returns
 * quarantine and preserves no secret-bearing artifact (R2A-05).
 */
export async function finalizeEvidence(rawArtifacts, adapters) {
  if (!Array.isArray(rawArtifacts)) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['rawArtifacts must be an array'] };
  }
  if (!adapters || typeof adapters !== 'object') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['adapters must be an object'] };
  }

  const validatedKeys = new Set();
  for (const artifact of rawArtifacts) {
    const idResult = validateArtifactIdentifier(artifact && artifact.name);
    if (!idResult.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: idResult.errors };
    if (validatedKeys.has(idResult.key)) {
      return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`duplicate retention key: ${idResult.key}`] };
    }
    validatedKeys.add(idResult.key);
  }

  const retained = [];

  for (const artifact of rawArtifacts) {
    let raw;
    try {
      raw = await adapters.volatile.read(artifact.name);
    } catch (error) {
      return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`volatile read failed for ${artifact.name}: ${errorMessage(error)}`] };
    }

    // R2B-04: pass the raw value itself into fail-closed validation. A
    // non-string, missing, or otherwise unscannable value must quarantine
    // immediately; it must never be coerced to an empty string and treated
    // as verified-clean content.
    if (typeof raw !== 'string') {
      return {
        ok: false,
        decision: 'QUARANTINE_NO_RETRY',
        errors: [`raw evidence for ${artifact.name} is missing or not a scannable string`],
      };
    }

    const redaction = redactSecrets(raw);
    if (!redaction.ok) {
      return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`redaction failed for ${artifact.name}`] };
    }

    const scan = scanForSecrets(redaction.text);
    if (!scan.ok || !scan.clean) {
      return {
        ok: false,
        decision: 'QUARANTINE_NO_RETRY',
        errors: [`post-redaction secret scan failed for ${artifact.name}${scan.matches ? `: ${scan.matches.join(', ')}` : ''}`],
      };
    }

    let writeHash;
    let readBack;
    let readBackHash;
    try {
      await adapters.retention.write(artifact.name, redaction.text);
      writeHash = await adapters.hashing.hash(redaction.text);
      readBack = await adapters.retention.read(artifact.name);
      readBackHash = await adapters.hashing.hash(readBack);
    } catch (error) {
      return {
        ok: false,
        decision: 'QUARANTINE_NO_RETRY',
        errors: [`retention write/read/hash failed for ${artifact.name}: ${errorMessage(error)}`],
      };
    }

    if (typeof writeHash !== 'string' || writeHash.length === 0 || writeHash !== readBackHash) {
      return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`retained hash verification failed for ${artifact.name}`] };
    }

    // R2B-04: secret-scan the retained read-back value itself before
    // permitting deletion. An invalid (non-string) or secret-bearing
    // read-back quarantines even if the hash adapter reports a match.
    if (typeof readBack !== 'string') {
      return {
        ok: false,
        decision: 'QUARANTINE_NO_RETRY',
        errors: [`retained read-back for ${artifact.name} is not a scannable string`],
      };
    }
    const readBackScan = scanForSecrets(readBack);
    if (!readBackScan.ok || !readBackScan.clean) {
      return {
        ok: false,
        decision: 'QUARANTINE_NO_RETRY',
        errors: [
          `retained read-back secret scan failed for ${artifact.name}${readBackScan.matches ? `: ${readBackScan.matches.join(', ')}` : ''}`,
        ],
      };
    }

    retained.push({ name: artifact.name, sha256: writeHash });
  }

  // Only after every artifact has a verified retained redacted copy may raw
  // disposal begin.
  for (const artifact of rawArtifacts) {
    try {
      await adapters.deletion.deleteRaw(artifact.name);
    } catch (error) {
      return {
        ok: false,
        decision: 'QUARANTINE_NO_RETRY',
        errors: [`raw disposal failed for ${artifact.name}: ${errorMessage(error)}`],
        rawDisposal: 'uncertain',
        retained,
      };
    }
  }

  return { ok: true, decision: 'SUCCESS', retained };
}
