import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, lstatSync, mkdirSync, readFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  validatePublicInput,
  validateRootIsolation,
  acquireExecutionIdentity,
  buildCanonicalBurnRecord,
  buildLedgerPaths,
  enumerateBurnedKeys,
  verifyLockAcquisitionResult,
  verifyDurableBurnResult,
  verifyMaterializedTree,
  verifyExactPreLaunchIdentity,
  buildGuardedRealProcessAdapter,
  runPreflightOnly,
  runExecuteOnce,
  runHostedExecutionAdapter,
  createGitCliAdapter,
  createConcreteEvidenceAdapter,
  parseLsTreeZ,
  parseCatFileBatch,
  validateAndHashMigrationTree,
  createFsLedgerAdapter,
  createFsPathInspector,
  createPromptScanner,
  deriveExpectedMigrationTime,
  parseListOutput,
  parseUpOutput,
  validateListStderr,
  REQUIRED_LIST_STDERR,
  validateUpStderr,
  buildExpectedUpStderr,
  computeAggregateManifestHash,
  MONTHLY_INVOICE_ATTESTED_DIGEST,
  CONFIRMATION_TOKEN,
  LEDGER_ROOT,
  FIXED_SUPABASE_EXECUTABLE,
  ACCEPTED_GOVERNANCE_PARENT,
  ACCEPTED_GOVERNANCE_TREE,
  CANONICAL_GOVERNANCE_COMMIT,
  CANONICAL_GOVERNANCE_TREE,
  EXACT_IMPLEMENTATION_PATHS,
} from './hosted-execution-adapter.mjs';
import { buildMigrationListArgv, buildMigrationUpArgv } from './replay-command-core.mjs';
import { REQUIRED_PROJECT_REF } from './replay-command-core.mjs';
import { REQUIRED_BRANCH, REQUIRED_PR_NUMBER, REQUIRED_PR_STATE, REQUIRED_PR_DRAFT, REQUIRED_PR_BASE, PROTECTED_PATHS_METADATA } from './preflight.mjs';
import { REQUIRED_STAGED_MIGRATION_COUNT, EXPECTED_AGGREGATE_MANIFEST_SHA256, PROTECTED_LINE_MIGRATION_PATH, PROTECTED_LINE_MIGRATION_MODE, PROTECTED_LINE_MIGRATION_BLOB, MONTHLY_INVOICE_MIGRATION_PATH, MONTHLY_INVOICE_MIGRATION_MODE, MONTHLY_INVOICE_MIGRATION_BLOB, REQUIRED_FORMAL_MIGRATION_COUNT, buildManifest } from './manifest-core.mjs';

const VALID_HEAD = 'a'.repeat(40);
const VALID_TREE = 'b'.repeat(40);
const REPO_ROOT = '/private/isolated-fake-repo-root-never-real';
const RUNTIME_ROOT = '/private/isolated-fake-runtime-root';
const EVIDENCE_ROOT = '/private/isolated-fake-evidence-root';
const REAL_REPO_ROOT = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));

function baseInput(overrides = {}) {
  return {
    mode: 'preflight-only',
    attemptId: 'attempt-001',
    repoRoot: REPO_ROOT,
    runtimeRoot: RUNTIME_ROOT,
    evidenceRoot: EVIDENCE_ROOT,
    ...overrides,
  };
}

function fakeSha256Hex(seed) {
  // Deterministic fake 64-hex-char value without importing node:crypto at module scope.
  let hash = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0').repeat(8).slice(0, 64);
}

function fakeBlobHex(seed) {
  return fakeSha256Hex(`blob-${seed}`).slice(0, 40);
}

function ordinaryEntry(seed) {
  const path = `supabase/migrations/${String(20260000000000 + seed).padStart(14, '0')}_ordinary_${seed}.sql`;
  return { path, mode: '100644', blob: fakeBlobHex(seed), sha256: fakeSha256Hex(seed) };
}

function buildValidRawEntries() {
  const entries = [];
  for (let i = 1; i <= 111; i += 1) entries.push(ordinaryEntry(i));
  entries.push({ path: PROTECTED_LINE_MIGRATION_PATH, mode: PROTECTED_LINE_MIGRATION_MODE, blob: PROTECTED_LINE_MIGRATION_BLOB, sha256: null });
  entries.push({ path: MONTHLY_INVOICE_MIGRATION_PATH, mode: MONTHLY_INVOICE_MIGRATION_MODE, blob: MONTHLY_INVOICE_MIGRATION_BLOB, sha256: null });
  assert.equal(entries.length, REQUIRED_FORMAL_MIGRATION_COUNT);
  return entries;
}

function createGitAdapter(overrides = {}) {
  const calls = { getProtectedPathMetadata: 0 };
  return {
    calls,
    getHead: async () => overrides.head ?? VALID_HEAD,
    getTree: async () => overrides.tree ?? VALID_TREE,
    getBranch: async () => overrides.branch ?? REQUIRED_BRANCH,
    getStatus: async () => overrides.status ?? '',
    getUpstreamAheadBehind: async () => overrides.upstream ?? { ahead: 0, behind: 0 },
    getPullRequest: async () =>
      overrides.pullRequest ?? {
        number: REQUIRED_PR_NUMBER,
        state: REQUIRED_PR_STATE,
        draft: REQUIRED_PR_DRAFT === 'true',
        base: REQUIRED_PR_BASE,
        branch: REQUIRED_BRANCH,
        source: 'pinned_governance_literal',
      },
    getParents: async () => overrides.parents ?? [ACCEPTED_GOVERNANCE_PARENT],
    getTreeForCommit: async () => overrides.parentTree ?? ACCEPTED_GOVERNANCE_TREE,
    getChangedPathsFromParent: async () => overrides.changedPaths ?? [...EXACT_IMPLEMENTATION_PATHS],
    getProtectedPathMetadata: async () => {
      calls.getProtectedPathMetadata += 1;
      return overrides.protectedMetadata ?? PROTECTED_PATHS_METADATA.map((entry) => ({ ...entry }));
    },
    getRawMigrationEntries: async () => overrides.rawMigrationEntries ?? buildValidRawEntries(),
    getCanonicalManifest: async () => overrides.canonicalManifest ?? (overrides.rawMigrationEntries ?? buildValidRawEntries()).map((entry) => ({ ...entry })),
  };
}

function createFilesystemAdapter(overrides = {}) {
  return {
    realpath: async (candidate) => (overrides.realpathMap && candidate in overrides.realpathMap ? overrides.realpathMap[candidate] : candidate),
    getExcludedRoots: async () => overrides.excludedRoots ?? ['/private/tmp', '/tmp', '/var/folders'],
    exists: async () => Boolean(overrides.staleProjectRefExists),
    inspectPathNoFollow: async (candidate) => {
      if (overrides.throwOnInspectPathNoFollow) throw new Error('root inspection failed');
      if (overrides.inspectPathNoFollowMap && candidate in overrides.inspectPathNoFollowMap) {
        return overrides.inspectPathNoFollowMap[candidate];
      }
      return { exists: true, hasSymlinkComponent: false, ownedByEffectiveUid: true, real: candidate, device: 1 };
    },
  };
}

const pathAdapter = { sep: () => '/', join: (...parts) => parts.join('/') };

function createEnvironmentAdapter(snapshot = {}) {
  return { snapshot: async () => snapshot };
}

function hashAggregateOk(staged) {
  return staged.length === REQUIRED_STAGED_MIGRATION_COUNT ? EXPECTED_AGGREGATE_MANIFEST_SHA256 : 'wrong-hash';
}

function defaultInspectedFileFor(workdir, entry) {
  const absolutePath = `${workdir}/${entry.path}`;
  return {
    relativePath: entry.path,
    absolutePath,
    canonicalPath: absolutePath,
    mode: '100644',
    isRegular: true,
    isSymlink: false,
    ownedByEffectiveUid: true,
    linkCount: 1,
    device: 1,
    sha256: entry.sha256,
  };
}

function createMaterializer(overrides = {}) {
  const calls = { writeAll: 0, inspectAll: 0, secureDelete: 0 };
  let lastStaged = null;
  let lastWorkdir = null;
  return {
    calls,
    getLastStaged: () => lastStaged,
    writeAll: async (workdir, staged) => {
      calls.writeAll += 1;
      lastStaged = staged;
      lastWorkdir = workdir;
      if (overrides.throwOnWriteAll) throw new Error('materializer write failed');
      if (overrides.writeAllResult) return overrides.writeAllResult;
      return { ok: true, count: staged.length };
    },
    inspectAll: async (workdir) => {
      calls.inspectAll += 1;
      if (overrides.throwOnInspectAll) throw new Error('materializer inspect failed');
      if (overrides.inspectAllResult) return overrides.inspectAllResult;
      const staged = lastStaged || [];
      const files = staged.map((entry) => defaultInspectedFileFor(lastWorkdir || workdir, entry));
      return { files };
    },
    secureDelete: async () => {
      calls.secureDelete += 1;
      if (overrides.throwOnSecureDelete) throw new Error('materializer delete failed');
      if (overrides.secureDeleteResult) return overrides.secureDeleteResult;
      return { ok: true };
    },
  };
}

function validOwnerRecord(attemptId) {
  return {
    attemptId,
    lockDirMode: '0700',
    ownerFileMode: '0600',
    ownedByEffectiveUid: true,
    linkCount: 1,
    ownerFileFsynced: true,
    lockDirFsynced: true,
  };
}

function validBurnRecord(attemptId) {
  return {
    attemptId,
    content: buildCanonicalBurnRecord(attemptId),
    mode: '0600',
    type: 'regular',
    ownedByEffectiveUid: true,
    linkCount: 1,
    createdExclusiveNoFollow: true,
    fileFsynced: true,
    readBackVerified: true,
    directoryFsynced: true,
  };
}

function createLedgerAdapter(overrides = {}) {
  const calls = { listBurnRecords: 0, acquireLock: 0, durableBurn: 0, releaseLock: 0, checkContinuedOwnership: 0 };
  return {
    calls,
    listBurnRecords: async () => {
      calls.listBurnRecords += 1;
      if (overrides.throwOnList) throw new Error('ledger list failed');
      return overrides.records === undefined ? null : overrides.records;
    },
    acquireLock: async (attemptId) => {
      calls.acquireLock += 1;
      if (overrides.throwOnAcquireLock) throw new Error('lock acquisition failed');
      if (overrides.acquireLockResult) return overrides.acquireLockResult;
      return { ok: true, ownerRecord: validOwnerRecord(attemptId) };
    },
    durableBurn: async (attemptId) => {
      calls.durableBurn += 1;
      if (overrides.throwOnDurableBurn) throw new Error('durable burn failed');
      if (overrides.durableBurnResult) return overrides.durableBurnResult;
      return { ok: true, record: validBurnRecord(attemptId) };
    },
    releaseLock: async () => {
      calls.releaseLock += 1;
      if (typeof overrides.onRelease === 'function') overrides.onRelease();
      if (overrides.throwOnReleaseLock) throw new Error('release failed');
      if (overrides.releaseLockResult) return overrides.releaseLockResult;
      return { ok: true };
    },
    checkContinuedOwnership: async () => {
      calls.checkContinuedOwnership += 1;
      if (overrides.throwOnCheckContinuedOwnership) throw new Error('ownership check failed');
      return overrides.checkContinuedOwnershipResult || { ok: true };
    },
  };
}

function createTargetIdentityAdapter(overrides = {}) {
  const calls = { verify: 0 };
  return {
    calls,
    verify: async () => {
      calls.verify += 1;
      if (overrides.throwOnVerify) throw new Error('target identity check failed');
      return overrides.result ?? { ok: true };
    },
  };
}

function createProcessAdapter(behaviors) {
  const calls = [];
  const executionMetadata = [];
  let index = 0;
  return {
    calls,
    spawn(executable, argv, options) {
      const behavior = behaviors[index] || { type: 'immediate-exit', exitInfo: { code: 0 } };
      index += 1;
      calls.push({ executable, argv, options });
      const exitInfo = behavior.exitInfo || { code: null, signal: 'SIGKILL' };
      const stdout = Buffer.from(behavior.stdout || '', 'utf8');
      const stderr = Buffer.from(behavior.stderr || '', 'utf8');
      executionMetadata.push({
        stage: argv.includes('list') ? 'list' : argv.includes('up') ? 'up' : null,
        exitCode: Number.isInteger(exitInfo.code) ? exitInfo.code : null,
        signal: typeof exitInfo.signal === 'string' ? exitInfo.signal : null,
        stdoutBytes: stdout.length,
        stdoutSha256: createHash('sha256').update(stdout).digest('hex'),
        stderrBytes: stderr.length,
        stderrSha256: createHash('sha256').update(stderr).digest('hex'),
        promptDetected: Boolean(exitInfo.promptDetected),
        truncated: false,
        targetMismatch: Boolean(exitInfo.targetMismatch),
        ledgerMismatch: Boolean(exitInfo.ledgerMismatch),
        spawnFailed: false,
      });
      return {
        onExit(cb) {
          if (behavior.type === 'immediate-exit') queueMicrotask(() => cb(behavior.exitInfo));
        },
        async terminate() {},
        async waitForExit() {
          return behavior.exitInfo || { code: null, signal: 'SIGKILL' };
        },
      };
    },
    getExecutionMetadata: () => executionMetadata.map((entry) => ({ ...entry })),
  };
}

function createFakeTimer() {
  return { setTimeout: (cb, ms) => ({ cb, ms, cleared: false }), clearTimeout: (record) => { record.cleared = true; } };
}

function createFakeEvents() {
  const emitted = [];
  return { emitted, emit: (name, payload) => emitted.push({ name, payload }) };
}

/** A valid, minimal fake evidence adapter (R1 correction item 4: evidence is
 * mandatory, so every default-success test path must supply one). */
function createFakeEvidenceAdapter(overrides = {}) {
  const retentionStore = {};
  const volatileStore = {};
  const rawArtifacts = overrides.rawArtifacts ? [...overrides.rawArtifacts] : [];
  const calls = [];
  let lastSummary = null;
  const recordCall = (name) => {
    calls.push(name);
    if (typeof overrides.onCall === 'function') overrides.onCall(name);
  };
  return {
    calls,
    rawArtifacts,
    recordExecutionSummary: async (name, summary) => {
      recordCall('recordExecutionSummary');
      lastSummary = summary;
      if (overrides.recordResult) return overrides.recordResult;
      volatileStore[name] = `${JSON.stringify(summary)}\n`;
      if (!overrides.skipRegistration) rawArtifacts.push({ name });
      return { ok: true, name, mode: '0600' };
    },
    volatile: {
      read: async (name) => {
        recordCall('volatile.read');
        return Object.prototype.hasOwnProperty.call(overrides, 'rawText') ? overrides.rawText : volatileStore[name];
      },
    },
    retention: {
      write: async (name, text) => {
        recordCall('retention.write');
        retentionStore[name] = text;
      },
      read: async (name) => {
        recordCall('retention.read');
        return retentionStore[name];
      },
    },
    hashing: {
      hash: async (text) => {
        recordCall('hashing.hash');
        return createHash('sha256').update(text, 'utf8').digest('hex');
      },
    },
    deletion: {
      deleteRaw: async (name) => {
        recordCall('deletion.deleteRaw');
        delete volatileStore[name];
      },
    },
    getLastSummary: () => lastSummary,
    getRetainedText: (name) => retentionStore[name],
  };
}

function buildAdapters(overrides = {}) {
  return {
    git: overrides.git || createGitAdapter(overrides.gitOverrides),
    filesystem: overrides.filesystem || createFilesystemAdapter(overrides.filesystemOverrides),
    path: pathAdapter,
    clock: overrides.clock || { now: () => 0 },
    environment: overrides.environment || createEnvironmentAdapter(),
    hashAggregate: overrides.hashAggregate || hashAggregateOk,
    materializer: overrides.materializer || createMaterializer(overrides.materializerOverrides),
    ledger: overrides.ledger || createLedgerAdapter(overrides.ledgerOverrides),
    targetIdentity: overrides.targetIdentity || createTargetIdentityAdapter(overrides.targetIdentityOverrides),
    process: overrides.process || createProcessAdapter(overrides.processBehaviors || [{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]),
    timer: overrides.timer || createFakeTimer(),
    events: overrides.events || createFakeEvents(),
    evidence: Object.prototype.hasOwnProperty.call(overrides, 'evidence') ? overrides.evidence : createFakeEvidenceAdapter(),
  };
}

// ---------------------------------------------------------------------------
// Zero import effects and public input shape
// ---------------------------------------------------------------------------

test('import has zero effects: importing the module performs no I/O (Node built-in imports are allowed and have no import-time effect)', async () => {
  const moduleUrl = new URL('./hosted-execution-adapter.mjs', import.meta.url);
  await import(`${moduleUrl.href}?cache-bust=${Date.now()}`);
  assert.ok(true);
});

test('validatePublicInput accepts the exact narrow shape for preflight-only', () => {
  const result = validatePublicInput(baseInput());
  assert.equal(result.ok, true);
  assert.equal(result.value.confirmation, null);
});

test('validatePublicInput accepts the exact narrow shape for execute-once with the exact confirmation token', () => {
  const result = validatePublicInput(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }));
  assert.equal(result.ok, true);
  assert.equal(result.value.confirmation, CONFIRMATION_TOKEN);
});

test('validatePublicInput rejects an unknown key', () => {
  const result = validatePublicInput(baseInput({ extra: 'not-allowed' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unknown input key/);
});

test('validatePublicInput rejects a caller-supplied projectRef override attempt as an unknown key', () => {
  const result = validatePublicInput(baseInput({ projectRef: 'attacker-supplied-ref' }));
  assert.equal(result.ok, false);
});

test('validatePublicInput rejects a mode outside the exact two allowed values', () => {
  assert.equal(validatePublicInput(baseInput({ mode: 'apply-directly' })).ok, false);
  assert.equal(validatePublicInput(baseInput({ mode: '' })).ok, false);
});

test('attempt grammar: a 1-character attemptId is accepted', () => {
  assert.equal(validatePublicInput(baseInput({ attemptId: 'a' })).ok, true);
});

test('attempt grammar: an exact 128-character attemptId is accepted', () => {
  const attemptId = `a${'b'.repeat(127)}`;
  assert.equal(attemptId.length, 128);
  assert.equal(validatePublicInput(baseInput({ attemptId })).ok, true);
});

test('attempt grammar: a 129-character attemptId is rejected', () => {
  const attemptId = `a${'b'.repeat(128)}`;
  assert.equal(attemptId.length, 129);
  assert.equal(validatePublicInput(baseInput({ attemptId })).ok, false);
});

test('attempt grammar: an attemptId containing a dot is rejected', () => {
  assert.equal(validatePublicInput(baseInput({ attemptId: 'attempt.001' })).ok, false);
});

test('attempt grammar: an attemptId starting with a separator character is rejected', () => {
  assert.equal(validatePublicInput(baseInput({ attemptId: '-attempt' })).ok, false);
  assert.equal(validatePublicInput(baseInput({ attemptId: '_attempt' })).ok, false);
});

test('preflight-only rejects a non-null/non-absent confirmation value', () => {
  const result = validatePublicInput(baseInput({ confirmation: CONFIRMATION_TOKEN }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /confirmation to be absent or null/);
});

test('execute-once rejects a missing or wrong confirmation token', () => {
  assert.equal(validatePublicInput(baseInput({ mode: 'execute-once' })).ok, false);
  assert.equal(validatePublicInput(baseInput({ mode: 'execute-once', confirmation: 'wrong-token' })).ok, false);
});

test('roots must be absolute without a parent-directory reference', () => {
  assert.equal(validatePublicInput(baseInput({ repoRoot: 'relative/path' })).ok, false);
  assert.equal(validatePublicInput(baseInput({ repoRoot: '/abs/../escape' })).ok, false);
  assert.equal(validatePublicInput(baseInput({ runtimeRoot: '' })).ok, false);
});

test('roots exceeding the 4096 UTF-8 byte ceiling are rejected', () => {
  const longRoot = `/${'a'.repeat(4096)}`;
  assert.equal(validatePublicInput(baseInput({ evidenceRoot: longRoot })).ok, false);
});

test('roots must be mutually disjoint: identical roots are rejected', () => {
  const result = validatePublicInput(baseInput({ runtimeRoot: REPO_ROOT }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /mutually disjoint/);
});

test('roots must be mutually disjoint: one root containing another is rejected', () => {
  const result = validatePublicInput(baseInput({ evidenceRoot: `${RUNTIME_ROOT}/nested` }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /mutually disjoint/);
});

test('roots that merely share a string prefix without a path-segment boundary are accepted', () => {
  const result = validatePublicInput(baseInput({ runtimeRoot: `${RUNTIME_ROOT}-sibling` }));
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Git identity acquisition
// ---------------------------------------------------------------------------

test('acquireExecutionIdentity succeeds and returns the freshly derived HEAD/tree', async () => {
  const result = await acquireExecutionIdentity(buildAdapters());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.head, VALID_HEAD);
  assert.equal(result.tree, VALID_TREE);
});

test('R3I-C2: the committed-delta allowlist is exactly the two adapter paths', () => {
  assert.deepEqual(EXACT_IMPLEMENTATION_PATHS, [
    'scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs',
    'scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs',
  ]);
});

test('acquireExecutionIdentity fails when HEAD does not have exactly one accepted governance parent', async () => {
  const git = createGitAdapter({ parents: ['c'.repeat(40)] });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /accepted governance parent/);
});

test('acquireExecutionIdentity fails when HEAD is a merge commit with two parents', async () => {
  const git = createGitAdapter({ parents: [ACCEPTED_GOVERNANCE_PARENT, 'd'.repeat(40)] });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
});

test('acquireExecutionIdentity fails when the changed-path delta is not exactly the two accepted paths', async () => {
  const git = createGitAdapter({ changedPaths: ['scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs'] });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /exactly the 2 accepted paths/);
});

test('acquireExecutionIdentity fails when an unrelated third path is also changed', async () => {
  const git = createGitAdapter({ changedPaths: [...EXACT_IMPLEMENTATION_PATHS, 'src/unexpected.ts'] });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
});

test('acquireExecutionIdentity fails on a dirty worktree/index', async () => {
  const git = createGitAdapter({ status: ' M some/file' });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /not clean/);
});

test('acquireExecutionIdentity fails on upstream divergence other than 0 0', async () => {
  const git = createGitAdapter({ upstream: { ahead: 1, behind: 0 } });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
});

test('acquireExecutionIdentity fails on the wrong branch', async () => {
  const git = createGitAdapter({ branch: 'wrong-branch' });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
});

test('acquireExecutionIdentity fails on wrong PR identity', async () => {
  const git = createGitAdapter({ pullRequest: { number: '999', state: REQUIRED_PR_STATE, draft: true, base: REQUIRED_PR_BASE } });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
});

test('acquireExecutionIdentity fails on protected metadata drift', async () => {
  const drifted = PROTECTED_PATHS_METADATA.map((entry) => ({ ...entry }));
  drifted[0] = { ...drifted[0], blob: 'f'.repeat(40) };
  const git = createGitAdapter({ protectedMetadata: drifted });
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected path metadata mismatch/);
});

test('acquireExecutionIdentity fails closed when the git adapter rejects', async () => {
  const git = { ...createGitAdapter(), getHead: async () => { throw new Error('boom'); } };
  const result = await acquireExecutionIdentity({ ...buildAdapters(), git });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /git adapter failed/);
});

test('acquireExecutionIdentity requires adapters.git', async () => {
  const result = await acquireExecutionIdentity({});
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// Durable burn-record and ledger contract
// ---------------------------------------------------------------------------

test('buildCanonicalBurnRecord produces the exact fixed byte contract with a trailing LF on every line', () => {
  const record = buildCanonicalBurnRecord('attempt-xyz');
  assert.equal(record, `GDA_ESTIMATE_POSTAL_MASTER_R5_CR6_BURN_V1\nproject_ref=${REQUIRED_PROJECT_REF}\nattempt_id=attempt-xyz\nstate=BURNED_NO_RETRY\n`);
  assert.ok(record.endsWith('\n'));
});

test('buildLedgerPaths composes the fixed internal ledger root; the caller cannot override it', () => {
  const paths = buildLedgerPaths(buildAdapters(), 'attempt-001');
  assert.equal(paths.ledgerRoot, LEDGER_ROOT);
  assert.equal(paths.projectDir, `${LEDGER_ROOT}/${REQUIRED_PROJECT_REF}`);
  assert.equal(paths.activeLockPath, `${LEDGER_ROOT}/${REQUIRED_PROJECT_REF}/active.lock`);
  assert.equal(paths.burnPath, `${LEDGER_ROOT}/${REQUIRED_PROJECT_REF}/attempt-001.burn`);
});

test('enumerateBurnedKeys treats an absent ledger (null) as an empty ledger', async () => {
  const ledger = createLedgerAdapter({ records: null });
  const result = await enumerateBurnedKeys({ ledger });
  assert.equal(result.ok, true);
  assert.equal(result.keys.size, 0);
});

test('enumerateBurnedKeys reconstructs a valid burn record into the exact composite key', async () => {
  const attemptId = 'attempt-existing';
  const record = {
    type: 'regular',
    mode: '0600',
    ownedByEffectiveUid: true,
    linkCount: 1,
    attemptId,
    content: buildCanonicalBurnRecord(attemptId),
  };
  const ledger = createLedgerAdapter({ records: [record] });
  const result = await enumerateBurnedKeys({ ledger });
  assert.equal(result.ok, true);
  assert.equal(result.keys.has(`${REQUIRED_PROJECT_REF}::${attemptId}`), true);
});

test('enumerateBurnedKeys fails closed on an unknown/partial burn record shape', async () => {
  const ledger = createLedgerAdapter({ records: [{ type: 'regular' }] });
  const result = await enumerateBurnedKeys({ ledger });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unknown, partial, or malformed/);
});

test('enumerateBurnedKeys fails closed when content does not match the exact canonical bytes for the attempt id', async () => {
  const record = { type: 'regular', mode: '0600', ownedByEffectiveUid: true, linkCount: 1, attemptId: 'a1', content: 'tampered content\n' };
  const ledger = createLedgerAdapter({ records: [record] });
  const result = await enumerateBurnedKeys({ ledger });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /content mismatch/);
});

test('enumerateBurnedKeys fails closed on a hard-link count other than one', async () => {
  const attemptId = 'attempt-linked';
  const record = { type: 'regular', mode: '0600', ownedByEffectiveUid: true, linkCount: 2, attemptId, content: buildCanonicalBurnRecord(attemptId) };
  const ledger = createLedgerAdapter({ records: [record] });
  const result = await enumerateBurnedKeys({ ledger });
  assert.equal(result.ok, false);
});

test('enumerateBurnedKeys fails closed when the listing itself is neither an array nor null/undefined', async () => {
  const ledger = createLedgerAdapter({ records: 'not-an-array' });
  const result = await enumerateBurnedKeys({ ledger });
  assert.equal(result.ok, false);
});

test('enumerateBurnedKeys fails closed when the ledger adapter rejects', async () => {
  const ledger = createLedgerAdapter({ throwOnList: true });
  const result = await enumerateBurnedKeys({ ledger });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /ledger listing failed/);
});

// ---------------------------------------------------------------------------
// preflight-only: materialize, inspect, delete; never lock/burn/link/retain
// ---------------------------------------------------------------------------

test('preflight-only succeeds and returns exactly the staged count with the fixed aggregate hash', async () => {
  const adapters = buildAdapters();
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.decision, 'SUCCESS');
  assert.equal(result.stagedCount, REQUIRED_STAGED_MIGRATION_COUNT);
  assert.equal(result.aggregateSha256, EXPECTED_AGGREGATE_MANIFEST_SHA256);
});

test('preflight-only never touches the ledger lock/burn surface', async () => {
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ ledger });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(ledger.calls.acquireLock, 0);
  assert.equal(ledger.calls.durableBurn, 0);
  assert.equal(ledger.calls.releaseLock, 0);
});

test('preflight-only never invokes the process adapter (no linked command is ever constructed)', async () => {
  const process = createProcessAdapter([]);
  const adapters = buildAdapters({ process });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(process.calls.length, 0);
});

test('preflight-only materializes then always deletes the isolated tree, even on inspection failure', async () => {
  const materializer = createMaterializer({ inspectAllResult: { files: [] } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.equal(materializer.calls.writeAll, 1);
  assert.equal(materializer.calls.inspectAll, 1);
  assert.equal(materializer.calls.secureDelete, 1);
});

test('preflight-only fails closed and still attempts best-effort cleanup when materialization write fails', async () => {
  const materializer = createMaterializer({ throwOnWriteAll: true });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.equal(materializer.calls.writeAll, 1);
  assert.equal(materializer.calls.secureDelete, 1);
});

function buildStagedEntries() {
  return buildValidRawEntries().filter((entry) => entry.path !== PROTECTED_LINE_MIGRATION_PATH);
}

test('preflight-only fails closed when independently inspected file count is not exactly 112', async () => {
  const materializer = createMaterializer({ inspectAllResult: { files: [{ relativePath: 'x', mode: '100644', isRegular: true }] } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /exactly 112/);
});

test('preflight-only fails closed when an inspected entry is not a regular mode-100644 file (symlink)', async () => {
  const staged = buildStagedEntries();
  const files = staged.map((entry) => defaultInspectedFileFor(`${RUNTIME_ROOT}/preflight-attempt-001`, entry));
  files[0] = { ...files[0], mode: '120000', isRegular: false, isSymlink: true };
  const materializer = createMaterializer({ inspectAllResult: { files } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /not mode 100644|not a regular file|symlink or alias/);
});

test('preflight-only fails closed when an inspected entry content hash drifts from the accepted staged manifest', async () => {
  const staged = buildStagedEntries();
  const files = staged.map((entry) => defaultInspectedFileFor(`${RUNTIME_ROOT}/preflight-attempt-001`, entry));
  const ordinaryIndex = files.findIndex((file) => file.sha256 !== null);
  files[ordinaryIndex] = { ...files[ordinaryIndex], sha256: 'f'.repeat(64) };
  const materializer = createMaterializer({ inspectAllResult: { files } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /content hash drift/);
});

test('preflight-only fails closed when an inspected entry is not owned by the effective uid', async () => {
  const staged = buildStagedEntries();
  const files = staged.map((entry) => defaultInspectedFileFor(`${RUNTIME_ROOT}/preflight-attempt-001`, entry));
  files[0] = { ...files[0], ownedByEffectiveUid: false };
  const materializer = createMaterializer({ inspectAllResult: { files } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /not owned by the effective uid/);
});

test('preflight-only fails closed when an inspected entry has a hard link count other than one', async () => {
  const staged = buildStagedEntries();
  const files = staged.map((entry) => defaultInspectedFileFor(`${RUNTIME_ROOT}/preflight-attempt-001`, entry));
  files[0] = { ...files[0], linkCount: 2 };
  const materializer = createMaterializer({ inspectAllResult: { files } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /hard link count other than one/);
});

test('preflight-only fails closed when inspected entries report inconsistent devices', async () => {
  const staged = buildStagedEntries();
  const files = staged.map((entry) => defaultInspectedFileFor(`${RUNTIME_ROOT}/preflight-attempt-001`, entry));
  files[0] = { ...files[0], device: 999 };
  const materializer = createMaterializer({ inspectAllResult: { files } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /device drift/);
});

test('preflight-only fails closed when an inspected entry canonical path does not equal its actual path (alias)', async () => {
  const staged = buildStagedEntries();
  const files = staged.map((entry) => defaultInspectedFileFor(`${RUNTIME_ROOT}/preflight-attempt-001`, entry));
  files[0] = { ...files[0], canonicalPath: '/some/other/aliased/path.sql' };
  const materializer = createMaterializer({ inspectAllResult: { files } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /alias\/symlink escape/);
});

test('preflight-only fails closed when secure delete itself fails, and still reports inspection errors', async () => {
  const materializer = createMaterializer({ secureDeleteResult: { ok: false, errors: ['delete refused'] } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /delete refused/);
});

test('preflight-only fails closed for an already-burned attempt id without touching the materializer', async () => {
  const attemptId = 'attempt-preburned';
  const record = { type: 'regular', mode: '0600', ownedByEffectiveUid: true, linkCount: 1, attemptId, content: buildCanonicalBurnRecord(attemptId) };
  const ledger = createLedgerAdapter({ records: [record] });
  const materializer = createMaterializer();
  const adapters = buildAdapters({ ledger, materializer });
  const result = await runPreflightOnly(baseInput({ attemptId }), adapters);
  assert.equal(result.ok, false);
  assert.equal(materializer.calls.writeAll, 0);
});

test('preflight-only fails closed on a malformed ledger record without touching the materializer', async () => {
  const ledger = createLedgerAdapter({ records: [{ type: 'regular' }] });
  const materializer = createMaterializer();
  const adapters = buildAdapters({ ledger, materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.equal(materializer.calls.writeAll, 0);
});

test('preflight-only fails closed on wrong identity before any materialization occurs', async () => {
  const git = createGitAdapter({ branch: 'wrong-branch' });
  const materializer = createMaterializer();
  const adapters = buildAdapters({ git, materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.equal(materializer.calls.writeAll, 0);
});

test('preflight-only rejects execute-once-shaped input', async () => {
  const result = await runPreflightOnly(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), buildAdapters());
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// execute-once: synthetic target/ledger mismatch classification
// ---------------------------------------------------------------------------

test('execute-once: target-identity drift yields exactly the frozen targetMismatch synthetic exitInfo, one logical call, zero real launches', async () => {
  const targetIdentity = createTargetIdentityAdapter({ result: { ok: false } });
  const realProcess = createProcessAdapter([]);
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ targetIdentity, process: realProcess, ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'target_mismatch');
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(realProcess.calls.length, 0, 'the caller-injected real process adapter must never be invoked on target mismatch');
  assert.equal(ledger.calls.acquireLock, 0);
  assert.equal(ledger.calls.durableBurn, 0);
});

test('execute-once: an exception from the target-identity adapter fails closed without touching the ledger', async () => {
  const targetIdentity = createTargetIdentityAdapter({ throwOnVerify: true });
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ targetIdentity, ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(ledger.calls.acquireLock, 0);
});

test('execute-once: lock acquisition failure yields the exact ledgerMismatch synthetic result with the ACTIVE_LOCK_INVALID subtype', async () => {
  const ledger = createLedgerAdapter({ acquireLockResult: { ok: false, reason: 'active_lock_owned_by_other_attempt' } });
  const realProcess = createProcessAdapter([]);
  const adapters = buildAdapters({ ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ledger_mismatch');
  assert.equal(result.subtype, 'ACTIVE_LOCK_INVALID');
  assert.equal(ledger.calls.durableBurn, 0);
  assert.equal(realProcess.calls.length, 0);
});

test('R1 item 5: durable burn failure yields the exact ledgerMismatch synthetic result with BURN_RECORD_INVALID and never releases the lock (fail-closed, no automatic release)', async () => {
  const ledger = createLedgerAdapter({ durableBurnResult: { ok: false, reason: 'burn_already_exists' } });
  const realProcess = createProcessAdapter([]);
  const adapters = buildAdapters({ ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ledger_mismatch');
  assert.equal(result.subtype, 'BURN_RECORD_INVALID');
  assert.equal(ledger.calls.acquireLock, 1);
  assert.equal(ledger.calls.releaseLock, 0, 'an invalid/uncertain burn must never release the lock');
  assert.equal(realProcess.calls.length, 0);
});

test('execute-once: an exception during durable burn leaves the lock unreleased (fail-closed stale lock, never auto-recovered)', async () => {
  const ledger = createLedgerAdapter({ throwOnDurableBurn: true });
  const adapters = buildAdapters({ ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(ledger.calls.releaseLock, 0);
});

test('execute-once: an already-burned attempt id fails closed before the target-identity or ledger surfaces are touched', async () => {
  const attemptId = 'attempt-execute-preburned';
  const record = { type: 'regular', mode: '0600', ownedByEffectiveUid: true, linkCount: 1, attemptId, content: buildCanonicalBurnRecord(attemptId) };
  const ledgerAdapter = createLedgerAdapter({ records: [record] });
  const targetIdentity = createTargetIdentityAdapter();
  const adapters = buildAdapters({ ledger: ledgerAdapter, targetIdentity });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId }), adapters);
  assert.equal(result.ok, false);
  assert.equal(targetIdentity.calls.verify, 0);
  assert.equal(ledgerAdapter.calls.acquireLock, 0);
});

test('execute-once: exact target and exact readiness invokes the frozen apply-once core with the real process adapter and releases the lock on success', async () => {
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ process: realProcess, ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.decision, 'SUCCESS');
  assert.equal(realProcess.calls.length, 2);
  assert.equal(ledger.calls.acquireLock, 1);
  assert.equal(ledger.calls.durableBurn, 1);
  assert.equal(ledger.calls.releaseLock, 1);
});

test('execute-once: a real non-zero exit from the frozen core quarantines and the attempt remains burned (lock still released after evidence stage)', async () => {
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 1 } }]);
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ process: realProcess, ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.equal(ledger.calls.durableBurn, 1);
  assert.equal(ledger.calls.releaseLock, 1, 'burn stays permanent, but the lock itself is released after finalization even on a real quarantine');
});

test('execute-once: evidence finalization runs before lock release, and a passing finalization allows release', async () => {
  const ledger = createLedgerAdapter();
  const evidence = createFakeEvidenceAdapter();
  const adapters = buildAdapters({ ledger, evidence });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(ledger.calls.releaseLock, 1);
});

test('execute-once: a failed evidence finalization (non-string raw evidence) keeps the lock held (evidence precedes release)', async () => {
  const ledger = createLedgerAdapter();
  const evidence = createFakeEvidenceAdapter({ rawText: undefined });
  const adapters = buildAdapters({ ledger, evidence });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(ledger.calls.releaseLock, 0, 'a failed evidence finalization must never permit lock release');
});

test('R3G evidence: real success records two logical/two real stages and finalizes before lock release', async () => {
  const order = [];
  const evidence = createFakeEvidenceAdapter({ onCall: (name) => order.push(name) });
  const ledger = createLedgerAdapter({ onRelease: () => order.push('ledger.releaseLock') });
  const process = createProcessAdapter([
    { type: 'immediate-exit', exitInfo: { code: 0 }, stdout: 'list-json', stderr: 'list-status' },
    { type: 'immediate-exit', exitInfo: { code: 0 }, stdout: 'up-json', stderr: 'up-status' },
  ]);
  const result = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'evidence-success' }),
    buildAdapters({ evidence, ledger, process }),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  const summary = evidence.getLastSummary();
  assert.equal(summary.logicalCallCount, 2);
  assert.equal(summary.realOsLaunchCount, 2);
  assert.deepEqual(summary.logicalStages, ['list', 'up']);
  assert.deepEqual(summary.processMetadata.map((entry) => entry.stage), ['list', 'up']);
  assert.equal(summary.finalVerification.applyOk, true);
  assert.ok(order.indexOf('retention.read') < order.indexOf('deletion.deleteRaw'));
  assert.ok(order.indexOf('deletion.deleteRaw') < order.indexOf('ledger.releaseLock'));
});

test('R3G evidence: target and ledger mismatches retain one logical/zero-real synthetic outcome with exact flags', async () => {
  const targetEvidence = createFakeEvidenceAdapter();
  const target = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'evidence-target' }),
    buildAdapters({ evidence: targetEvidence, targetIdentity: createTargetIdentityAdapter({ result: { ok: false } }) }),
  );
  assert.equal(target.ok, false);
  assert.equal(targetEvidence.getLastSummary().logicalCallCount, 1);
  assert.equal(targetEvidence.getLastSummary().realOsLaunchCount, 0);
  assert.equal(targetEvidence.getLastSummary().logicalOutcomeMetadata[0].targetMismatch, true);

  const ledgerEvidence = createFakeEvidenceAdapter();
  const ledger = createLedgerAdapter({ acquireLockResult: { ok: false } });
  const ledgerResult = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'evidence-ledger' }),
    buildAdapters({ evidence: ledgerEvidence, ledger }),
  );
  assert.equal(ledgerResult.ok, false);
  assert.equal(ledgerEvidence.getLastSummary().logicalCallCount, 1);
  assert.equal(ledgerEvidence.getLastSummary().realOsLaunchCount, 0);
  assert.equal(ledgerEvidence.getLastSummary().logicalOutcomeMetadata[0].ledgerMismatch, true);
});

test('R3G evidence: non-zero, signal, prompt, and timeout outcomes retain consistent metadata', async () => {
  const cases = [
    { id: 'nonzero', behavior: { type: 'immediate-exit', exitInfo: { code: 9 } }, expected: { exitCode: 9 } },
    { id: 'signal', behavior: { type: 'immediate-exit', exitInfo: { code: null, signal: 'SIGTERM' } }, expected: { signal: 'SIGTERM' } },
    { id: 'prompt', behavior: { type: 'immediate-exit', exitInfo: { code: null, promptDetected: true } }, expected: { promptDetected: true } },
  ];
  for (const item of cases) {
    const evidence = createFakeEvidenceAdapter();
    const result = await runExecuteOnce(
      baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: `evidence-${item.id}` }),
      buildAdapters({ evidence, process: createProcessAdapter([item.behavior]) }),
    );
    assert.equal(result.ok, false);
    assert.equal(evidence.getLastSummary().logicalCallCount, 1);
    assert.equal(evidence.getLastSummary().realOsLaunchCount, 1);
    for (const [key, value] of Object.entries(item.expected)) {
      assert.equal(evidence.getLastSummary().processMetadata[0][key], value, `${item.id}:${key}`);
    }
  }

  const timeoutEvidence = createFakeEvidenceAdapter();
  const immediateTimer = {
    setTimeout: (callback) => {
      queueMicrotask(callback);
      return {};
    },
    clearTimeout: () => {},
  };
  const timeout = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'evidence-timeout' }),
    buildAdapters({
      evidence: timeoutEvidence,
      timer: immediateTimer,
      process: createProcessAdapter([{ type: 'never-exits', exitInfo: { code: null, signal: 'SIGKILL' } }]),
    }),
  );
  assert.equal(timeout.ok, false);
  assert.equal(timeoutEvidence.getLastSummary().finalVerification.reason, 'timeout:list');
  assert.equal(timeoutEvidence.getLastSummary().logicalCallCount, 1);
  assert.equal(timeoutEvidence.getLastSummary().realOsLaunchCount, 1);
});

test('R3G evidence: raw secret-shaped child bytes are represented only by counts and hashes, never retained verbatim', async () => {
  const secret = 'SUPABASE_SERVICE_ROLE_KEY=super-secret-test-value';
  const evidence = createFakeEvidenceAdapter();
  const process = createProcessAdapter([
    { type: 'immediate-exit', exitInfo: { code: 1 }, stdout: secret, stderr: `Authorization: Bearer ${secret}` },
  ]);
  const result = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'evidence-secret' }),
    buildAdapters({ evidence, process }),
  );
  assert.equal(result.ok, false);
  const retainedName = result.evidenceResult.retained[0].name;
  const retained = evidence.getRetainedText(retainedName);
  assert.doesNotMatch(retained, /super-secret-test-value|Authorization|SERVICE_ROLE_KEY/);
  assert.equal(evidence.getLastSummary().processMetadata[0].stdoutBytes, Buffer.byteLength(secret));
});

test('R3G evidence: an empty artifact list after summary recording fails closed before lock release', async () => {
  const evidence = createFakeEvidenceAdapter({ skipRegistration: true });
  const ledger = createLedgerAdapter();
  const result = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'evidence-empty' }),
    buildAdapters({ evidence, ledger }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /registration|artifact list/);
  assert.equal(ledger.calls.releaseLock, 0);
});

test('R3G evidence: concrete adapter writes mode-0600 volatile summary, retains verified metadata, then deletes volatile bytes', () =>
  withTempDir(async (dir) => {
    const evidenceRoot = joinPath(dir, 'evidence');
    const evidence = createConcreteEvidenceAdapter(evidenceRoot);
    const ledger = createLedgerAdapter();
    const result = await runExecuteOnce(
      baseInput({
        mode: 'execute-once',
        confirmation: CONFIRMATION_TOKEN,
        attemptId: 'evidence-concrete',
        evidenceRoot,
      }),
      buildAdapters({ evidence, ledger }),
    );
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.evidenceResult.retained.length, 1);
    const name = result.evidenceResult.retained[0].name;
    const retainedPath = joinPath(evidenceRoot, 'retained', name);
    const retainedStat = lstatSync(retainedPath);
    assert.equal((retainedStat.mode & 0o777).toString(8), '600');
    assert.match(readFileSync(retainedPath, 'utf8'), /GDA_ESTIMATE_POSTAL_MASTER_R5_CR6_EXECUTION_METADATA_V1/);
    assert.throws(() => lstatSync(joinPath(evidenceRoot, 'volatile', name)));
    assert.equal(ledger.calls.releaseLock, 1);
  }));

test('execute-once: same-attempt races yield exactly one exclusive burn winner; the loser observes an active-lock ledger mismatch', async () => {
  let lockOwned = false;
  const ledger = {
    listBurnRecords: async () => null,
    acquireLock: async (attemptId) => {
      if (lockOwned) return { ok: false, reason: 'active_lock_owned_by_other_attempt' };
      lockOwned = true;
      return { ok: true, ownerRecord: validOwnerRecord(attemptId) };
    },
    durableBurn: async (attemptId) => ({ ok: true, record: validBurnRecord(attemptId) }),
    releaseLock: async () => {
      lockOwned = false;
      return { ok: true };
    },
    checkContinuedOwnership: async () => ({ ok: true }),
  };
  const winnerProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const winnerAdapters = buildAdapters({ ledger, process: winnerProcess });
  const winnerPromise = runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'attempt-race-a' }), winnerAdapters);

  const loserProcess = createProcessAdapter([]);
  const loserAdapters = buildAdapters({ ledger, process: loserProcess });
  const loserResult = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, attemptId: 'attempt-race-b' }), loserAdapters);

  const winnerResult = await winnerPromise;
  assert.equal(winnerResult.ok, true, JSON.stringify(winnerResult));
  assert.equal(loserResult.ok, false);
  assert.equal(loserResult.reason, 'ledger_mismatch');
  assert.equal(loserProcess.calls.length, 0);
});

test('execute-once requires the exact confirmation token even if the public shape otherwise validates', async () => {
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once' }), buildAdapters());
  assert.equal(result.ok, false);
});

test('execute-once rejects preflight-only-shaped input', async () => {
  const result = await runExecuteOnce(baseInput(), buildAdapters());
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// execute-once: durable ledger identity is independently re-verified, not
// blindly trusted from a bare { ok: true }
// ---------------------------------------------------------------------------

test('verifyLockAcquisitionResult accepts only the exact complete owner-record durability shape', () => {
  assert.equal(verifyLockAcquisitionResult({ ok: true, ownerRecord: validOwnerRecord('a1') }, 'a1'), true);
  assert.equal(verifyLockAcquisitionResult({ ok: false }, 'a1'), false);
  assert.equal(verifyLockAcquisitionResult({ ok: true }, 'a1'), false, 'missing ownerRecord must fail');
  assert.equal(verifyLockAcquisitionResult({ ok: true, ownerRecord: { ...validOwnerRecord('a1'), attemptId: 'other' } }, 'a1'), false);
  for (const field of ['lockDirMode', 'ownerFileMode', 'ownedByEffectiveUid', 'linkCount', 'ownerFileFsynced', 'lockDirFsynced']) {
    const drifted = { ...validOwnerRecord('a1') };
    drifted[field] = field === 'linkCount' ? 2 : field === 'ownedByEffectiveUid' || field === 'ownerFileFsynced' || field === 'lockDirFsynced' ? false : 'wrong';
    assert.equal(verifyLockAcquisitionResult({ ok: true, ownerRecord: drifted }, 'a1'), false, `field ${field} must be enforced`);
  }
});

test('verifyDurableBurnResult accepts only the exact complete burn-record durability shape', () => {
  assert.equal(verifyDurableBurnResult({ ok: true, record: validBurnRecord('a1') }, 'a1'), true);
  assert.equal(verifyDurableBurnResult({ ok: false }, 'a1'), false);
  assert.equal(verifyDurableBurnResult({ ok: true }, 'a1'), false, 'missing record must fail');
  assert.equal(verifyDurableBurnResult({ ok: true, record: { ...validBurnRecord('a1'), content: 'tampered\n' } }, 'a1'), false);
  for (const field of ['mode', 'type', 'ownedByEffectiveUid', 'linkCount', 'createdExclusiveNoFollow', 'fileFsynced', 'readBackVerified', 'directoryFsynced']) {
    const drifted = { ...validBurnRecord('a1') };
    drifted[field] = field === 'linkCount' ? 2 : typeof drifted[field] === 'boolean' ? false : 'wrong';
    assert.equal(verifyDurableBurnResult({ ok: true, record: drifted }, 'a1'), false, `field ${field} must be enforced`);
  }
});

test('R1 item 5: a durable-burn result reporting ok:true with tampered content is never blindly trusted, yields BURN_RECORD_INVALID, and never releases the lock', async () => {
  const ledger = createLedgerAdapter({ durableBurnResult: { ok: true, record: { ...validBurnRecord('attempt-001'), content: 'attacker-controlled-bytes\n' } } });
  const realProcess = createProcessAdapter([]);
  const adapters = buildAdapters({ ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.subtype, 'BURN_RECORD_INVALID');
  assert.equal(ledger.calls.releaseLock, 0, 'a tampered-but-ok:true burn result must never release the lock');
  assert.equal(realProcess.calls.length, 0);
});

test('execute-once: a lock-acquisition result reporting ok:true with the wrong owner-record mode is never blindly trusted', async () => {
  const ledger = createLedgerAdapter({ acquireLockResult: { ok: true, ownerRecord: { ...validOwnerRecord('attempt-001'), lockDirMode: '0777' } } });
  const realProcess = createProcessAdapter([]);
  const adapters = buildAdapters({ ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.subtype, 'ACTIVE_LOCK_INVALID');
  assert.equal(ledger.calls.durableBurn, 0);
  assert.equal(realProcess.calls.length, 0);
});

test('R1 item 4: a completely missing evidence adapter fails closed before lock release, not silently accepted as success', async () => {
  const ledger = createLedgerAdapter();
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const adapters = buildAdapters({ ledger, process: realProcess, evidence: undefined });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.match(result.errors.join(' '), /adapters\.evidence .* required/);
  assert.equal(ledger.calls.releaseLock, 0, 'missing evidence must never permit lock release');
});

test('execute-once: a lock-release failure after an otherwise successful apply fails the overall result closed, never swallowed as success', async () => {
  const ledger = createLedgerAdapter({ releaseLockResult: { ok: false } });
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const adapters = buildAdapters({ ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.match(result.errors.join(' '), /lock release did not succeed/);
});

test('execute-once: a lock-release exception after an otherwise successful apply fails the overall result closed', async () => {
  const ledger = createLedgerAdapter({ throwOnReleaseLock: true });
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const adapters = buildAdapters({ ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /lock release failed/);
});

// ---------------------------------------------------------------------------
// execute-once: it must consume the accepted preflight plan and independently
// materialize/verify the isolated tree before target/lock/burn/apply
// ---------------------------------------------------------------------------

test('execute-once fails closed and never touches the ledger when the manifest/preflight contract itself is violated', async () => {
  const canonicalManifest = buildValidRawEntries();
  const tamperedRawEntries = canonicalManifest.map((entry, index) => (index === 0 ? { ...entry, blob: fakeBlobHex('tampered') } : entry));
  const git = createGitAdapter({ rawMigrationEntries: tamperedRawEntries, canonicalManifest });
  const ledger = createLedgerAdapter();
  const materializer = createMaterializer();
  const adapters = buildAdapters({ git, ledger, materializer });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(materializer.calls.writeAll, 0, 'preflight must be consumed before any materialization is attempted');
  assert.equal(ledger.calls.acquireLock, 0);
});

test('execute-once independently materializes and inspects the isolated tree before acquiring the lock', async () => {
  const materializer = createMaterializer();
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ materializer, ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(materializer.calls.writeAll, 1);
  assert.equal(materializer.calls.inspectAll, 1);
  assert.equal(ledger.calls.acquireLock, 1);
});

test('execute-once fails closed on a materialization content-hash drift before any target/lock/burn step, and still cleans up', async () => {
  const materializer = createMaterializer();
  const targetIdentity = createTargetIdentityAdapter();
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ materializer, targetIdentity, ledger });
  const originalInspectAll = materializer.inspectAll;
  materializer.inspectAll = async (workdir) => {
    const result = await originalInspectAll(workdir);
    const files = [...result.files];
    files[0] = { ...files[0], sha256: files[0].sha256 ? 'f'.repeat(64) : files[0].sha256 };
    return { files };
  };
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(targetIdentity.calls.verify, 0);
  assert.equal(ledger.calls.acquireLock, 0);
  assert.equal(materializer.calls.secureDelete, 1);
});

test('execute-once always cleans up the isolated materialized tree on every terminal path: target mismatch, ledger mismatch, and success', async () => {
  const successMaterializer = createMaterializer();
  const successResult = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }),
    buildAdapters({ materializer: successMaterializer }),
  );
  assert.equal(successResult.ok, true, JSON.stringify(successResult));
  assert.equal(successMaterializer.calls.secureDelete, 1);

  const targetMaterializer = createMaterializer();
  const targetIdentity = createTargetIdentityAdapter({ result: { ok: false } });
  const targetResult = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }),
    buildAdapters({ materializer: targetMaterializer, targetIdentity }),
  );
  assert.equal(targetResult.ok, false);
  assert.equal(targetMaterializer.calls.secureDelete, 1);

  const ledgerMaterializer = createMaterializer();
  const ledger = createLedgerAdapter({ acquireLockResult: { ok: false } });
  const ledgerResult = await runExecuteOnce(
    baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }),
    buildAdapters({ materializer: ledgerMaterializer, ledger }),
  );
  assert.equal(ledgerResult.ok, false);
  assert.equal(ledgerMaterializer.calls.secureDelete, 1);
});

// ---------------------------------------------------------------------------
// Root isolation: ledger-root disjointness, symlink/owner/alias hostility
// ---------------------------------------------------------------------------

test('validatePublicInput fails closed when repoRoot equals the fixed internal ledger root (the reported reproducible bad case)', () => {
  const result = validatePublicInput(baseInput({ repoRoot: LEDGER_ROOT, runtimeRoot: '/private/tmp/cr6-runtime', evidenceRoot: '/private/tmp/cr6-evidence', mode: 'preflight-only', attemptId: 'a' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /disjoint from the fixed internal ledger root/);
});

test('validatePublicInput fails closed when a root is contained by the fixed internal ledger root', () => {
  const result = validatePublicInput(baseInput({ runtimeRoot: `${LEDGER_ROOT}/nested` }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /disjoint from the fixed internal ledger root/);
});

test('validatePublicInput fails closed when a root contains the fixed internal ledger root', () => {
  const ledgerParent = LEDGER_ROOT.slice(0, LEDGER_ROOT.lastIndexOf('/'));
  const result = validatePublicInput(baseInput({ evidenceRoot: ledgerParent }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /disjoint from the fixed internal ledger root/);
});

test('validateRootIsolation fails closed when a root path contains a symlink component', async () => {
  const filesystem = createFilesystemAdapter({ inspectPathNoFollowMap: { [REPO_ROOT]: { exists: true, hasSymlinkComponent: true, ownedByEffectiveUid: true, real: REPO_ROOT } } });
  const result = await validateRootIsolation({ filesystem }, baseInput());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /symlink path component/);
});

test('validateRootIsolation fails closed when a root is not owned by the effective uid', async () => {
  const filesystem = createFilesystemAdapter({ inspectPathNoFollowMap: { [RUNTIME_ROOT]: { exists: true, hasSymlinkComponent: false, ownedByEffectiveUid: false, real: RUNTIME_ROOT } } });
  const result = await validateRootIsolation({ filesystem }, baseInput());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /not owned by the effective uid/);
});

test('validateRootIsolation fails closed when a symlink/alias makes the canonical path equal the fixed ledger root', async () => {
  const filesystem = createFilesystemAdapter({ inspectPathNoFollowMap: { [EVIDENCE_ROOT]: { exists: true, hasSymlinkComponent: false, ownedByEffectiveUid: true, real: LEDGER_ROOT } } });
  const result = await validateRootIsolation({ filesystem }, baseInput());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /canonical path must be disjoint from the fixed internal ledger root/);
});

test('validateRootIsolation fails closed when two declared roots alias to the same canonical path', async () => {
  const filesystem = createFilesystemAdapter({
    inspectPathNoFollowMap: {
      [RUNTIME_ROOT]: { exists: true, hasSymlinkComponent: false, ownedByEffectiveUid: true, real: '/private/canonical-shared' },
      [EVIDENCE_ROOT]: { exists: true, hasSymlinkComponent: false, ownedByEffectiveUid: true, real: '/private/canonical-shared' },
    },
  });
  const result = await validateRootIsolation({ filesystem }, baseInput());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /mutually disjoint/);
});

test('validateRootIsolation requires adapters.filesystem.inspectPathNoFollow', async () => {
  const result = await validateRootIsolation({ filesystem: {} }, baseInput());
  assert.equal(result.ok, false);
});

test('preflight-only fails closed on root isolation drift before any materialization occurs', async () => {
  const filesystem = createFilesystemAdapter({ inspectPathNoFollowMap: { [REPO_ROOT]: { exists: true, hasSymlinkComponent: true, ownedByEffectiveUid: true, real: REPO_ROOT } } });
  const materializer = createMaterializer();
  const adapters = buildAdapters({ filesystem, materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.equal(materializer.calls.writeAll, 0);
});

test('execute-once fails closed on root isolation drift before touching the ledger', async () => {
  const filesystem = createFilesystemAdapter({ inspectPathNoFollowMap: { [REPO_ROOT]: { exists: true, hasSymlinkComponent: true, ownedByEffectiveUid: true, real: REPO_ROOT } } });
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ filesystem, ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(ledger.calls.acquireLock, 0);
});

// ---------------------------------------------------------------------------
// Guarded real process adapter: stage order, exact pre-launch identity, and
// immediate pre-launch TOCTOU (R1 correction item 2)
// ---------------------------------------------------------------------------

const GUARDED_WORKDIR = `${RUNTIME_ROOT}/execute-attempt-001`;
const GUARDED_ENV = { SUPABASE_ACCESS_TOKEN: 'token' };

function exactListArgv() {
  return buildMigrationListArgv(REQUIRED_PROJECT_REF, GUARDED_WORKDIR).argv;
}
function exactUpArgv() {
  return buildMigrationUpArgv(REQUIRED_PROJECT_REF, GUARDED_WORKDIR).argv;
}
function exactOptions() {
  return { shell: false, env: { ...GUARDED_ENV } };
}
function guardedContext(overrides = {}) {
  return {
    projectRef: REQUIRED_PROJECT_REF,
    isolatedWorkdir: GUARDED_WORKDIR,
    repoRoot: REPO_ROOT,
    attemptId: 'attempt-001',
    expectedEnv: GUARDED_ENV,
    onSyntheticSubtype: () => {},
    ...overrides,
  };
}

test('verifyExactPreLaunchIdentity accepts the exact executable/argv/options for both stages', () => {
  const context = guardedContext();
  assert.equal(verifyExactPreLaunchIdentity('supabase', exactListArgv(), exactOptions(), context), true);
  assert.equal(verifyExactPreLaunchIdentity('supabase', exactUpArgv(), exactOptions(), context), true);
});

test('verifyExactPreLaunchIdentity rejects a wrong executable string', () => {
  const context = guardedContext();
  assert.equal(verifyExactPreLaunchIdentity('/usr/bin/supabase', exactListArgv(), exactOptions(), context), false);
});

test('verifyExactPreLaunchIdentity rejects an argv with an extra, missing, reordered, or drifted token', () => {
  const context = guardedContext();
  const base = exactListArgv();
  assert.equal(verifyExactPreLaunchIdentity('supabase', [...base, '--extra'], exactOptions(), context), false);
  assert.equal(verifyExactPreLaunchIdentity('supabase', base.slice(0, -1), exactOptions(), context), false);
  const reordered = [...base];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.equal(verifyExactPreLaunchIdentity('supabase', reordered, exactOptions(), context), false);
  const drifted = base.map((token) => (token === REQUIRED_PROJECT_REF ? 'drifted-project-ref' : token));
  assert.equal(verifyExactPreLaunchIdentity('supabase', drifted, exactOptions(), context), false);
});

test('verifyExactPreLaunchIdentity rejects shell !== false and a drifted/extra environment', () => {
  const context = guardedContext();
  assert.equal(verifyExactPreLaunchIdentity('supabase', exactListArgv(), { shell: true, env: GUARDED_ENV }, context), false);
  assert.equal(
    verifyExactPreLaunchIdentity('supabase', exactListArgv(), { shell: false, env: { ...GUARDED_ENV, EXTRA: 'x' } }, context),
    false,
  );
  assert.equal(verifyExactPreLaunchIdentity('supabase', exactListArgv(), { shell: false, env: {} }, context), false);
});

test('verifyExactPreLaunchIdentity rejects a drifted cwd when options carries one', () => {
  const context = guardedContext();
  assert.equal(
    verifyExactPreLaunchIdentity('supabase', exactListArgv(), { ...exactOptions(), cwd: '/somewhere/else' }, context),
    false,
  );
  assert.equal(
    verifyExactPreLaunchIdentity('supabase', exactListArgv(), { ...exactOptions(), cwd: GUARDED_WORKDIR }, context),
    true,
  );
});

test('buildGuardedRealProcessAdapter launches the real process for the correct list-then-up order with exact argv/options', async () => {
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const targetIdentity = createTargetIdentityAdapter();
  const ledger = createLedgerAdapter();
  const adapters = { process: realProcess, targetIdentity, ledger };
  const subtypes = [];
  const guarded = buildGuardedRealProcessAdapter(adapters, guardedContext({ onSyntheticSubtype: (subtype) => subtypes.push(subtype) }));

  const listHandle = guarded.spawn('supabase', exactListArgv(), exactOptions());
  const listExit = await new Promise((resolve) => listHandle.onExit(resolve));
  assert.equal(listExit.code, 0);

  const upHandle = guarded.spawn('supabase', exactUpArgv(), exactOptions());
  const upExit = await new Promise((resolve) => upHandle.onExit(resolve));
  assert.equal(upExit.code, 0);

  assert.equal(realProcess.calls.length, 2);
  assert.deepEqual(subtypes, []);
});

test('buildGuardedRealProcessAdapter never reaches the real spawn when the synchronous pre-launch identity check fails, without even calling targetIdentity.verify', async () => {
  const realProcess = createProcessAdapter([]);
  const targetIdentity = createTargetIdentityAdapter();
  const ledger = createLedgerAdapter();
  const adapters = { process: realProcess, targetIdentity, ledger };
  const guarded = buildGuardedRealProcessAdapter(adapters, guardedContext());
  const handle = guarded.spawn('supabase', [...exactListArgv(), '--extra-unexpected-token'], exactOptions());
  const exitInfo = await new Promise((resolve) => handle.onExit(resolve));
  assert.equal(exitInfo.targetMismatch, true);
  assert.equal(realProcess.calls.length, 0);
  assert.equal(targetIdentity.calls.verify, 0, 'the synchronous check must reject drift before ever calling the async targetIdentity adapter');
});

test('buildGuardedRealProcessAdapter synthesizes ledgerMismatch with STAGE_ORDER_INVALID when up is attempted before any list call', async () => {
  const realProcess = createProcessAdapter([]);
  const adapters = { process: realProcess, targetIdentity: createTargetIdentityAdapter(), ledger: createLedgerAdapter() };
  const subtypes = [];
  const guarded = buildGuardedRealProcessAdapter(adapters, guardedContext({ onSyntheticSubtype: (subtype) => subtypes.push(subtype) }));
  const upHandle = guarded.spawn('supabase', exactUpArgv(), exactOptions());
  const exitInfo = await new Promise((resolve) => upHandle.onExit(resolve));
  assert.equal(exitInfo.ledgerMismatch, true);
  assert.equal(exitInfo.targetMismatch, false);
  assert.equal(realProcess.calls.length, 0);
  assert.deepEqual(subtypes, ['STAGE_ORDER_INVALID']);
});

test('buildGuardedRealProcessAdapter synthesizes ledgerMismatch with STAGE_ORDER_INVALID when list is attempted twice', async () => {
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const adapters = { process: realProcess, targetIdentity: createTargetIdentityAdapter(), ledger: createLedgerAdapter() };
  const subtypes = [];
  const guarded = buildGuardedRealProcessAdapter(adapters, guardedContext({ onSyntheticSubtype: (subtype) => subtypes.push(subtype) }));
  const firstList = guarded.spawn('supabase', exactListArgv(), exactOptions());
  await new Promise((resolve) => firstList.onExit(resolve));
  const secondList = guarded.spawn('supabase', exactListArgv(), exactOptions());
  const exitInfo = await new Promise((resolve) => secondList.onExit(resolve));
  assert.equal(exitInfo.ledgerMismatch, true);
  assert.equal(realProcess.calls.length, 1, 'the second, out-of-order list call must never reach a real launch');
  assert.deepEqual(subtypes, ['STAGE_ORDER_INVALID']);
});

test('buildGuardedRealProcessAdapter revalidates target identity immediately before the real launch (TOCTOU) and never launches on drift', async () => {
  const realProcess = createProcessAdapter([]);
  // Simulates drift discovered only by the immediate pre-launch recheck
  // performed inside the guarded adapter itself, even though an earlier,
  // now-stale outer check (not modeled here) may have passed.
  const targetIdentity = { verify: async () => ({ ok: false }) };
  const adapters = { process: realProcess, targetIdentity, ledger: createLedgerAdapter() };
  const guarded = buildGuardedRealProcessAdapter(adapters, guardedContext());
  const handle = guarded.spawn('supabase', exactListArgv(), exactOptions());
  const exitInfo = await new Promise((resolve) => handle.onExit(resolve));
  assert.equal(exitInfo.targetMismatch, true);
  assert.equal(realProcess.calls.length, 0, 'a target-identity drift discovered immediately before launch must prevent the real spawn');
});

test('buildGuardedRealProcessAdapter revalidates ledger readiness immediately before the real launch (TOCTOU) and yields ACTIVE_LOCK_INVALID', async () => {
  const realProcess = createProcessAdapter([]);
  const ledger = { checkContinuedOwnership: async () => ({ ok: false }) };
  const adapters = { process: realProcess, targetIdentity: createTargetIdentityAdapter(), ledger };
  const subtypes = [];
  const guarded = buildGuardedRealProcessAdapter(adapters, guardedContext({ onSyntheticSubtype: (subtype) => subtypes.push(subtype) }));
  const handle = guarded.spawn('supabase', exactListArgv(), exactOptions());
  const exitInfo = await new Promise((resolve) => handle.onExit(resolve));
  assert.equal(exitInfo.ledgerMismatch, true);
  assert.equal(realProcess.calls.length, 0);
  assert.deepEqual(subtypes, ['ACTIVE_LOCK_INVALID']);
});

test('buildGuardedRealProcessAdapter terminate()/waitForExit() are deterministic no-process operations on a stage-order synthetic handle', async () => {
  const guarded = buildGuardedRealProcessAdapter(
    { process: createProcessAdapter([]), targetIdentity: createTargetIdentityAdapter(), ledger: createLedgerAdapter() },
    guardedContext({ isolatedWorkdir: `${RUNTIME_ROOT}/x`, attemptId: 'a1' }),
  );
  const handle = guarded.spawn('supabase', ['migration', 'up'], { shell: false });
  assert.equal(await handle.terminate(), undefined);
  const exitInfo = await handle.waitForExit();
  assert.equal(exitInfo.ledgerMismatch, true);
});

test('R1 item 7: a synthetic handle rejects a second onExit registration instead of silently scheduling or duplicating delivery', async () => {
  const guarded = buildGuardedRealProcessAdapter(
    { process: createProcessAdapter([]), targetIdentity: createTargetIdentityAdapter(), ledger: createLedgerAdapter() },
    guardedContext({ isolatedWorkdir: `${RUNTIME_ROOT}/x`, attemptId: 'a1' }),
  );
  const handle = guarded.spawn('supabase', ['migration', 'up'], { shell: false });
  await new Promise((resolve) => handle.onExit(resolve));
  assert.throws(() => handle.onExit(() => {}), /only be registered once/);
});

test('execute-once surfaces the STAGE_ORDER_INVALID subtype on the returned result when the frozen core itself only issues one call and it is treated as out of order', async () => {
  // apply-once.mjs always issues list before up, so this exercises the guard
  // directly through runExecuteOnce by making the injected real process
  // adapter report a failing first (list) exit; the guard must still have
  // been consulted and no stage violation should be raised for the normal,
  // in-order single-call path. This proves the guard does not spuriously
  // fire STAGE_ORDER_INVALID against the frozen core's own correct ordering.
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 1 } }]);
  const ledger = createLedgerAdapter();
  const adapters = buildAdapters({ ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false);
  assert.equal(result.subtype, undefined, 'a genuine list failure is not a stage-order violation');
  assert.equal(realProcess.calls.length, 1);
});

// ---------------------------------------------------------------------------
// Public entrypoint: runHostedExecutionAdapter accepts only rawInput
// ---------------------------------------------------------------------------

test('public module exports contain no production-adapter factory setter or resetter', async () => {
  const namespace = await import('./hosted-execution-adapter.mjs');
  assert.equal('__setProductionAdapterFactoryForTestsOnly' in namespace, false);
  assert.equal('__resetProductionAdapterFactoryForTestsOnly' in namespace, false);
});

test('public source directly binds the lexical production factory and contains no mutable factory registry or gh invocation', () => {
  const source = readFileSync(new URL('./hosted-execution-adapter.mjs', import.meta.url), 'utf8');
  assert.match(source, /adapters = buildProductionAdapters\(validated\.value\)/);
  assert.doesNotMatch(source, /productionAdapterFactory|__setProductionAdapterFactory|__resetProductionAdapterFactory/);
  assert.doesNotMatch(source, /execFileSync\(['"]gh['"]|\bgh\s+pr\s+view\b/);
});

test('runHostedExecutionAdapter validates public input before any concrete adapter work', async () => {
  const result = await runHostedExecutionAdapter({ mode: 'not-a-real-mode' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /mode must be exactly one of/);
});

test('runHostedExecutionAdapter explicitly rejects an attempted second (adapters) argument rather than silently ignoring it', async () => {
  const materializer = createMaterializer();
  const ledger = createLedgerAdapter();
  const callerSuppliedAdapters = buildAdapters({ materializer, ledger });
  const result = await runHostedExecutionAdapter(baseInput(), callerSuppliedAdapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /accepts only rawInput/);
  assert.equal(materializer.calls.writeAll, 0, 'a second positional argument must never be used to select an adapter');
  assert.equal(ledger.calls.acquireLock, 0);
});

test('runHostedExecutionAdapter never touches a caller-supplied second-argument adapter', async () => {
  const ledger = createLedgerAdapter();
  const result = await runHostedExecutionAdapter(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), ledger);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /accepts only rawInput/);
  assert.equal(ledger.calls.acquireLock, 0);
});

test('concrete Git adapter returns independent exact canonical and actual 113-entry manifests using only local Git', async () => {
  const git = createGitCliAdapter(REAL_REPO_ROOT);
  const canonical = await git.getCanonicalManifest();
  const actual = await git.getRawMigrationEntries();
  assert.equal(canonical.length, REQUIRED_FORMAL_MIGRATION_COUNT);
  assert.equal(actual.length, REQUIRED_FORMAL_MIGRATION_COUNT);
  assert.notStrictEqual(canonical, actual);
  assert.notStrictEqual(canonical[0], actual[0]);
  assert.deepEqual(canonical, actual);
  assert.equal(await git.getTreeForCommit(CANONICAL_GOVERNANCE_COMMIT), CANONICAL_GOVERNANCE_TREE);
});

test('fixed manifest-core accepts the authority mix of legacy and timestamp migration names', async () => {
  const git = createGitCliAdapter(REAL_REPO_ROOT);
  const canonical = await git.getCanonicalManifest();
  const actual = await git.getRawMigrationEntries();
  const result = buildManifest(actual, { canonicalManifest: canonical, hashAggregate: computeAggregateManifestHash });
  assert.equal(result.ok, true);
  assert.equal(result.formalCount, REQUIRED_FORMAL_MIGRATION_COUNT);
  assert.equal(result.stagedCount, REQUIRED_STAGED_MIGRATION_COUNT);
  assert.equal(actual.filter((entry) => /^supabase\/migrations\/[0-9]{3}_/.test(entry.path)).length, 76);
  assert.equal(actual.filter((entry) => /^supabase\/migrations\/[0-9]{14}_/.test(entry.path)).length, 37);
});

test('concrete Git adapter supplies pinned PR facts without a hosted lookup', async () => {
  const git = createGitCliAdapter(REAL_REPO_ROOT);
  assert.deepEqual(await git.getPullRequest(), {
    number: REQUIRED_PR_NUMBER,
    state: REQUIRED_PR_STATE,
    draft: true,
    base: REQUIRED_PR_BASE,
    branch: REQUIRED_BRANCH,
    source: 'pinned_governance_literal',
  });
});

test('fixed Git acquisition ignores hostile ambient PATH and HOME values', async () => {
  const oldPath = process.env.PATH;
  const oldHome = process.env.HOME;
  process.env.PATH = '/attacker-controlled-bin';
  process.env.HOME = '/attacker-controlled-home';
  try {
    const git = createGitCliAdapter(REAL_REPO_ROOT);
    assert.equal(await git.getTreeForCommit(CANONICAL_GOVERNANCE_COMMIT), CANONICAL_GOVERNANCE_TREE);
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
  }
});

test('canonical acquisition fails closed for a wrong fixed tree and for a repository missing the fixed commit', async () => {
  assert.throws(
    () => validateAndHashMigrationTree(REAL_REPO_ROOT, CANONICAL_GOVERNANCE_COMMIT, '0'.repeat(40)),
    /fixed governance tree identity mismatch/,
  );
  await withTempDir(async (dir) => {
    await assert.rejects(
      createGitCliAdapter(dir).getCanonicalManifest(),
      /Command failed|not a git repository|unknown revision|bad object/,
    );
  });
});

test('strict NUL-framed ls-tree and cat-file parsers reject missing terminators, header drift, short bytes, and extra bytes', () => {
  const blob = 'a'.repeat(40);
  const validTree = `100644 blob ${blob}\tsupabase/migrations/20260101000000_x.sql\0`;
  assert.equal(parseLsTreeZ(validTree).length, 1);
  assert.throws(() => parseLsTreeZ(validTree.slice(0, -1)), /final NUL terminator/);
  assert.throws(() => parseLsTreeZ(`100644 blob ${blob} supabase/migrations/x.sql\0`), /metadata\/path tab/);

  const content = Buffer.from('abc', 'utf8');
  const validBatch = Buffer.concat([Buffer.from(`${blob} blob ${content.length}\n`), content, Buffer.from('\n')]);
  assert.equal(parseCatFileBatch(validBatch, [blob]).get(blob), createHash('sha256').update(content).digest('hex'));
  assert.throws(() => parseCatFileBatch(Buffer.from(`b${blob.slice(1)} blob 3\nabc\n`), [blob]), /header drift/);
  assert.throws(() => parseCatFileBatch(Buffer.from(`${blob} blob 4\nabc\n`), [blob]), /content framing drift/);
  assert.throws(() => parseCatFileBatch(Buffer.concat([validBatch, Buffer.from('extra')]), [blob]), /extra bytes/);
});

test('both candidate source files are ordinary UTF-8 text with zero NUL, CR, and BOM bytes', () => {
  for (const relative of ['hosted-execution-adapter.mjs', 'hosted-execution-adapter.test.mjs']) {
    const bytes = readFileSync(new URL(`./${relative}`, import.meta.url));
    assert.equal([...bytes].filter((value) => value === 0).length, 0, `${relative} NUL count`);
    assert.equal([...bytes].filter((value) => value === 13).length, 0, `${relative} CR count`);
    assert.equal(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, `${relative} BOM count`);
  }
});

// ---------------------------------------------------------------------------
// Exact real CLI byte mapping: prompt scanner, list/up parsing, stderr
// contracts (R1 correction item 3)
// ---------------------------------------------------------------------------

test('createPromptScanner detects a prompt token split across two chunks', () => {
  const scanner = createPromptScanner();
  assert.equal(scanner.push('Enter your pass'), false);
  assert.equal(scanner.push('word: '), true);
});

test('createPromptScanner detects the JSON "Cannot prompt" error envelope split across chunks', () => {
  const scanner = createPromptScanner();
  assert.equal(scanner.push('{"error":"Cannot prompt for '), false);
  assert.equal(scanner.push('values when not attached to a TTY"}'), true);
});

test('createPromptScanner reports clean for ordinary non-prompt output', () => {
  const scanner = createPromptScanner();
  assert.equal(scanner.push('{"migrations":[],"message":"Migrations listed"}\n'), false);
});

test('deriveExpectedMigrationTime derives the exact version-derived time and rejects a malformed version', () => {
  assert.equal(deriveExpectedMigrationTime('000'), '000');
  assert.equal(deriveExpectedMigrationTime('20260901001246'), '2026-09-01 00:12:46');
  assert.equal(deriveExpectedMigrationTime('not-a-version'), null);
  assert.equal(deriveExpectedMigrationTime(undefined), null);
});

function stagedForCli() {
  return [
    { path: 'supabase/migrations/000_shared_functions.sql', sha256: '0'.repeat(64) },
    { path: 'supabase/migrations/20260101000000_first.sql', sha256: 'a'.repeat(64) },
    { path: 'supabase/migrations/20260102000000_second.sql', sha256: 'b'.repeat(64) },
  ];
}

function validListStdout(staged) {
  const migrations = staged.map((entry) => ({
    local: migrationVersionFromPathForTest(entry.path),
    remote: '',
    time: deriveExpectedMigrationTime(migrationVersionFromPathForTest(entry.path)),
  }));
  return `${JSON.stringify({ migrations, message: 'Migrations listed' })}\n`;
}

function migrationVersionFromPathForTest(path) {
  return /^((?:\d{3}|\d{14}))_/.exec(path.slice(path.lastIndexOf('/') + 1))[1];
}

test('parseListOutput accepts the exact valid list JSON contract', () => {
  const staged = stagedForCli();
  const result = parseListOutput(validListStdout(staged), staged);
  assert.equal(result.ok, true);
});

test('parseListOutput rejects output missing the required single trailing LF', () => {
  const staged = stagedForCli();
  const withoutLf = validListStdout(staged).slice(0, -1);
  assert.equal(parseListOutput(withoutLf, staged).ok, false);
  assert.equal(parseListOutput(`${validListStdout(staged)}\n`, staged).ok, false);
});

test('parseListOutput rejects duplicate/multiple JSON objects in one payload', () => {
  const staged = stagedForCli();
  const doubled = `${validListStdout(staged).trimEnd()}${validListStdout(staged)}`;
  assert.equal(parseListOutput(doubled, staged).ok, false);
});

test('parseListOutput rejects a malformed (non-JSON) payload even with exit code 0 implied by the caller', () => {
  const staged = stagedForCli();
  assert.equal(parseListOutput('not json at all\n', staged).ok, false);
});

test('parseListOutput rejects wrong top-level keys, wrong message, wrong row count, non-empty remote, and drifted time', () => {
  const staged = stagedForCli();
  const parsedGood = JSON.parse(validListStdout(staged).slice(0, -1));

  assert.equal(parseListOutput(`${JSON.stringify({ ...parsedGood, extra: 1 })}\n`, staged).ok, false);
  assert.equal(parseListOutput(`${JSON.stringify({ migrations: parsedGood.migrations, message: 'Wrong message' })}\n`, staged).ok, false);
  assert.equal(
    parseListOutput(`${JSON.stringify({ migrations: parsedGood.migrations.slice(0, 1), message: 'Migrations listed' })}\n`, staged).ok,
    false,
  );
  const withRemote = { ...parsedGood, migrations: parsedGood.migrations.map((row, i) => (i === 0 ? { ...row, remote: '20260101000000' } : row)) };
  assert.equal(parseListOutput(`${JSON.stringify(withRemote)}\n`, staged).ok, false);
  const withDriftedTime = { ...parsedGood, migrations: parsedGood.migrations.map((row, i) => (i === 0 ? { ...row, time: '1999-01-01 00:00:00' } : row)) };
  assert.equal(parseListOutput(`${JSON.stringify(withDriftedTime)}\n`, staged).ok, false);
});

test('validateListStderr requires the exact fixed two-line role-init-then-connection stderr', () => {
  assert.equal(validateListStderr('Initialising login role...\nConnecting to remote database...\n'), true);
  assert.equal(validateListStderr('Connecting to remote database...\n'), false);
  assert.equal(validateListStderr('Connecting to remote database...'), false);
  assert.equal(validateListStderr('unexpected stderr\n'), false);
});

// R3J-R3: authoritative one-time hosted capture result fixed REQUIRED_LIST_STDERR
// to the exact two-line "Initialising login role..." + "Connecting to remote
// database..." LF-terminated form (60 bytes,
// sha256 b9977cb727ae28f6dfc5ee83a4ca928c7a9f42b11c4757f73dd5a17e85681a5f). These
// hostile fixtures prove byte-for-byte exactness: only the exact two-line LF
// form is accepted, and every other close-but-wrong byte sequence is rejected.
test('validateListStderr: hostile exactness fixtures around the fixed two-line stderr contract', () => {
  const exact = 'Initialising login role...\nConnecting to remote database...\n';
  assert.equal(exact.length, 60);
  assert.equal(createHash('sha256').update(exact, 'utf8').digest('hex'), 'b9977cb727ae28f6dfc5ee83a4ca928c7a9f42b11c4757f73dd5a17e85681a5f');
  assert.equal(REQUIRED_LIST_STDERR, exact);

  // Exact two-line LF form: accepted.
  assert.equal(validateListStderr(exact), true);

  // Old one-line form (pre-R3J-R3 contract): rejected.
  assert.equal(validateListStderr('Connecting to remote database...\n'), false);
  assert.equal(validateListStderr('Initialising login role...\n'), false);

  // Missing final LF: rejected.
  assert.equal(validateListStderr(exact.slice(0, -1)), false);

  // Reversed line order: rejected.
  assert.equal(validateListStderr('Connecting to remote database...\nInitialising login role...\n'), false);

  // Extra prefix line: rejected.
  assert.equal(validateListStderr(`extra prefix line\n${exact}`), false);

  // Extra suffix line: rejected.
  assert.equal(validateListStderr(`${exact}extra suffix line\n`), false);

  // CRLF line endings instead of LF: rejected.
  assert.equal(validateListStderr('Initialising login role...\r\nConnecting to remote database...\r\n'), false);
  assert.equal(validateListStderr(exact.replace(/\n/g, '\r\n')), false);

  // ANSI escape / control-byte injection anywhere in the text: rejected.
  assert.equal(validateListStderr(`Initialising login role...\n\x1B[31mConnecting to remote database...\x1B[0m\n`), false);
  assert.equal(validateListStderr(`\x07${exact}`), false);
  assert.equal(validateListStderr(exact.replace('Connecting', 'Connecting\x00')), false);

  // Whitespace/case drift: rejected.
  assert.equal(validateListStderr(exact.toUpperCase()), false);
  assert.equal(validateListStderr(`${exact} `), false);
  assert.equal(validateListStderr(` ${exact}`), false);
  assert.equal(validateListStderr(exact.replace('role...', 'role... ')), false);

  // Empty/undefined/non-string input: rejected.
  assert.equal(validateListStderr(''), false);
  assert.equal(validateListStderr(undefined), false);
});

function validUpStdout(staged, workdir) {
  const applied = staged.map((entry) => `${workdir}/${entry.path}`);
  return `${JSON.stringify({ applied, message: 'Migrations applied' })}\n`;
}

test('parseUpOutput accepts the exact valid up JSON contract with exact canonical absolute isolated paths', () => {
  const staged = stagedForCli();
  const result = parseUpOutput(validUpStdout(staged, GUARDED_WORKDIR), staged, GUARDED_WORKDIR);
  assert.equal(result.ok, true);
});

test('parseUpOutput rejects a wrong applied path, wrong count, and wrong message', () => {
  const staged = stagedForCli();
  const parsedGood = JSON.parse(validUpStdout(staged, GUARDED_WORKDIR).slice(0, -1));
  const wrongPath = { ...parsedGood, applied: parsedGood.applied.map((path, i) => (i === 0 ? '/wrong/path.sql' : path)) };
  assert.equal(parseUpOutput(`${JSON.stringify(wrongPath)}\n`, staged, GUARDED_WORKDIR).ok, false);
  assert.equal(parseUpOutput(`${JSON.stringify({ ...parsedGood, applied: parsedGood.applied.slice(0, 1) })}\n`, staged, GUARDED_WORKDIR).ok, false);
  assert.equal(parseUpOutput(`${JSON.stringify({ ...parsedGood, message: 'Wrong' })}\n`, staged, GUARDED_WORKDIR).ok, false);
});

test('buildExpectedUpStderr/validateUpStderr require the connection line plus exactly one ordered Applying-migration line per staged entry', () => {
  const staged = stagedForCli();
  const expected = buildExpectedUpStderr(staged);
  assert.equal(expected, 'Connecting to remote database...\nApplying migration 000_shared_functions.sql...\nApplying migration 20260101000000_first.sql...\nApplying migration 20260102000000_second.sql...\n');
  assert.equal(validateUpStderr(expected, staged), true);
  assert.equal(validateUpStderr('Connecting to remote database...\n', staged), false);
  const reordered = [staged[1], staged[0], staged[2]];
  assert.equal(validateUpStderr(expected, reordered), false);
});

test('computeAggregateManifestHash uses the fixed attested digest for the monthly row and each ordinary entry sha256 otherwise', () => {
  const staged = [
    { path: 'supabase/migrations/20260101000000_first.sql', sha256: 'a'.repeat(64) },
    { path: 'supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql', sha256: null },
  ];
  const rows = `${'a'.repeat(64)}  supabase/migrations/20260101000000_first.sql\n${MONTHLY_INVOICE_ATTESTED_DIGEST}  supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql\n`;
  const expected = createHash('sha256').update(rows, 'utf8').digest('hex');
  assert.equal(computeAggregateManifestHash(staged), expected);
});

// ---------------------------------------------------------------------------
// Concrete durable ledger and root-inspection adapters backed by real
// `node:fs` operations against a disposable temporary directory — never
// against the fixed production LEDGER_ROOT, and never touching Git/Supabase
// (R1 correction item 6). Every fsync/write/read-back step, root mode/type/
// device, and an enumeration race are exercised for real.
// ---------------------------------------------------------------------------

function withTempDir(run) {
  // Resolve away any ambient OS-level symlink in the temp-directory ancestor
  // (e.g. macOS `/var` -> `/private/var`) so `inspectPathNoFollow` tests only
  // observe symlinks this test itself creates.
  const dir = realpathSync(mkdtempSync(joinPath(tmpdir(), 'cr6-ledger-test-')));
  return run(dir).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test('createFsLedgerAdapter: acquireLock creates a real mode-0700 lock directory with an exact mode-0600 owner record, then durableBurn writes/fsyncs/reads back the exact canonical bytes', () =>
  withTempDir(async (dir) => {
    const ledger = createFsLedgerAdapter(dir, 'test-project');
    const lockResult = await ledger.acquireLock('attempt-fs-001');
    assert.equal(lockResult.ok, true, JSON.stringify(lockResult));
    assert.equal(verifyLockAcquisitionResult(lockResult, 'attempt-fs-001'), true);

    const lockStat = lstatSync(joinPath(dir, 'test-project', 'active.lock'));
    assert.equal(lockStat.isDirectory(), true);
    assert.equal((lockStat.mode & 0o777).toString(8), '700');

    const burnResult = await ledger.durableBurn('attempt-fs-001');
    assert.equal(burnResult.ok, true, JSON.stringify(burnResult));
    assert.equal(verifyDurableBurnResult(burnResult, 'attempt-fs-001'), true);

    const burnPath = joinPath(dir, 'test-project', 'attempt-fs-001.burn');
    const burnStat = lstatSync(burnPath);
    assert.equal(burnStat.isFile(), true);
    assert.equal((burnStat.mode & 0o777).toString(8), '600');
    assert.equal(readFileSync(burnPath, 'utf8'), buildCanonicalBurnRecord('attempt-fs-001'));

    const releaseResult = await ledger.releaseLock();
    assert.equal(releaseResult.ok, true, JSON.stringify(releaseResult));
    assert.throws(() => lstatSync(joinPath(dir, 'test-project', 'active.lock')));
  }));

test('createFsLedgerAdapter: durableBurn throws EEXIST on a second attempt to create the same burn file, and never truncates/replaces it', () =>
  withTempDir(async (dir) => {
    const ledger = createFsLedgerAdapter(dir, 'test-project');
    await ledger.acquireLock('attempt-fs-002');
    const first = await ledger.durableBurn('attempt-fs-002');
    assert.equal(first.ok, true);
    await assert.rejects(() => ledger.durableBurn('attempt-fs-002'), /EEXIST/);
    const burnPath = joinPath(dir, 'test-project', 'attempt-fs-002.burn');
    assert.equal(readFileSync(burnPath, 'utf8'), buildCanonicalBurnRecord('attempt-fs-002'));
  }));

test('createFsLedgerAdapter: acquireLock fails closed (EEXIST) when the active lock already exists for a different attempt', () =>
  withTempDir(async (dir) => {
    const ledger = createFsLedgerAdapter(dir, 'test-project');
    const first = await ledger.acquireLock('attempt-fs-a');
    assert.equal(first.ok, true);
    const second = await ledger.acquireLock('attempt-fs-b');
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'active_lock_owned_by_other_attempt');
  }));

test('createFsLedgerAdapter: checkContinuedOwnership reflects the real owner-record file content', () =>
  withTempDir(async (dir) => {
    const ledger = createFsLedgerAdapter(dir, 'test-project');
    await ledger.acquireLock('attempt-fs-c');
    const owned = await ledger.checkContinuedOwnership('attempt-fs-c');
    assert.equal(owned.ok, true);
    const notOwned = await ledger.checkContinuedOwnership('attempt-fs-other');
    assert.equal(notOwned.ok, false);
  }));

test('createFsLedgerAdapter: listBurnRecords returns null for an absent ledger and real records once created', () =>
  withTempDir(async (dir) => {
    const ledger = createFsLedgerAdapter(dir, 'test-project');
    const empty = await ledger.listBurnRecords();
    assert.equal(empty, null);
    await ledger.acquireLock('attempt-fs-d');
    await ledger.durableBurn('attempt-fs-d');
    const records = await ledger.listBurnRecords();
    assert.equal(Array.isArray(records), true);
    assert.equal(records.length, 1);
    assert.equal(records[0].attemptId, 'attempt-fs-d');
    assert.equal(records[0].content, buildCanonicalBurnRecord('attempt-fs-d'));
  }));

test('createFsLedgerAdapter: listBurnRecords fails closed (unknown type) on an enumeration-race entry that is a directory, not a regular .burn file', () =>
  withTempDir(async (dir) => {
    const ledger = createFsLedgerAdapter(dir, 'test-project');
    await ledger.acquireLock('attempt-fs-e');
    await ledger.durableBurn('attempt-fs-e');
    mkdirSync(joinPath(dir, 'test-project', 'race-intruder.burn'));
    const records = await ledger.listBurnRecords();
    assert.ok(records.some((record) => record.type === 'unknown'));
    const enumerated = await enumerateBurnedKeys({ ledger });
    assert.equal(enumerated.ok, false, 'an unknown enumeration-race entry must fail closed as burned/ledger uncertainty');
  }));

test('R3I-C3: createFsPathInspector canonicalizes existing and fresh paths while rejecting symlink components', () =>
  withTempDir(async (dir) => {
    const inspector = createFsPathInspector();
    const realDir = joinPath(dir, 'real-target');
    mkdirSync(realDir);
    const symlinkPath = joinPath(dir, 'link-to-target');
    symlinkSync(realDir, symlinkPath);

    const symlinkResult = await inspector.inspectPathNoFollow(symlinkPath);
    assert.equal(symlinkResult.hasSymlinkComponent, true);

    const nestedThroughSymlink = joinPath(symlinkPath, 'nested');
    const nestedResult = await inspector.inspectPathNoFollow(nestedThroughSymlink);
    assert.equal(nestedResult.hasSymlinkComponent, true);

    const absentResult = await inspector.inspectPathNoFollow(joinPath(dir, 'does-not-exist'));
    assert.equal(absentResult.exists, false);

    const freshWorkdir = joinPath(dir, 'fresh-runtime-root', 'preflight-new-attempt');
    assert.equal(await inspector.realpath(freshWorkdir), freshWorkdir);

    const realResult = await inspector.inspectPathNoFollow(realDir);
    assert.equal(realResult.exists, true);
    assert.equal(realResult.hasSymlinkComponent, false);
    assert.equal(realResult.ownedByEffectiveUid, true);
    assert.equal(await inspector.realpath(realDir), realpathSync(realDir));

    await assert.rejects(
      () => inspector.realpath(nestedThroughSymlink),
      /symlink component/,
    );
  }));

// ---------------------------------------------------------------------------
// Cleanup fail-closed behavior (R1 correction item 7): cleanup failure must
// never be swallowed as best-effort on a success path, and the cleanup
// target must never touch LEDGER_ROOT or the evidence payload root.
// ---------------------------------------------------------------------------

test('R1 item 7: a secure-delete failure after an otherwise fully successful execute-once turns the overall result closed rather than being swallowed', async () => {
  const materializer = createMaterializer({ secureDeleteResult: { ok: false, errors: ['disk busy'] } });
  const ledger = createLedgerAdapter();
  const realProcess = createProcessAdapter([{ type: 'immediate-exit', exitInfo: { code: 0 } }, { type: 'immediate-exit', exitInfo: { code: 0 } }]);
  const adapters = buildAdapters({ materializer, ledger, process: realProcess });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN }), adapters);
  assert.equal(result.ok, false, 'cleanup failure must override an otherwise successful result');
  assert.equal(result.decision, 'QUARANTINE_NO_RETRY');
  assert.ok(Array.isArray(result.cleanupErrors) && result.cleanupErrors.length > 0);
});

test('R1 item 7: a secure-delete failure during preflight-only is reported, not swallowed', async () => {
  const materializer = createMaterializer({ secureDeleteResult: { ok: false, errors: ['disk busy'] } });
  const adapters = buildAdapters({ materializer });
  const result = await runPreflightOnly(baseInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /disk busy/);
});

test('R1 item 7: an evidenceRoot nested inside runtimeRoot (which would make cleanup unsafe) is already rejected at public input validation, before any materialization or cleanup is attempted', async () => {
  const materializer = createMaterializer();
  const ledger = createLedgerAdapter();
  const nestedEvidenceRoot = `${RUNTIME_ROOT}/nested-evidence`;
  const adapters = buildAdapters({ materializer, ledger });
  const result = await runExecuteOnce(baseInput({ mode: 'execute-once', confirmation: CONFIRMATION_TOKEN, evidenceRoot: nestedEvidenceRoot }), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /mutually disjoint/);
  assert.equal(materializer.calls.writeAll, 0);
});
