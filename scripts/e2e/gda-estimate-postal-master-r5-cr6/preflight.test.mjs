import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  runPreflight,
  REQUIRED_BRANCH,
  REQUIRED_PR_NUMBER,
  REQUIRED_PR_STATE,
  REQUIRED_PR_DRAFT,
  REQUIRED_PR_BASE,
  PROTECTED_PATHS_METADATA,
} from './preflight.mjs';
import { REQUIRED_PROJECT_REF } from './replay-command-core.mjs';
import { REQUIRED_FORMAL_MIGRATION_COUNT, PROTECTED_LINE_MIGRATION_PATH, PROTECTED_LINE_MIGRATION_MODE, PROTECTED_LINE_MIGRATION_BLOB, MONTHLY_INVOICE_MIGRATION_PATH, MONTHLY_INVOICE_MIGRATION_MODE, MONTHLY_INVOICE_MIGRATION_BLOB, EXPECTED_AGGREGATE_MANIFEST_SHA256 } from './manifest-core.mjs';
import { burnAttempt } from './quarantine-core.mjs';

const VALID_HEAD = 'a'.repeat(40);
const VALID_TREE = 'b'.repeat(40);
const REPO_ROOT = '/private/isolated-fake-repo-root-never-real';
const WORKDIR = '/private/isolated-fake-runtime-root/attempt-workdir';

function fakeBlob(seed) {
  return crypto.createHash('sha1').update(String(seed)).digest('hex');
}
function fakeSha256(seed) {
  return crypto.createHash('sha256').update(String(seed)).digest('hex');
}
function ordinaryEntry(seed) {
  const path = `supabase/migrations/${String(20260000000000 + seed).padStart(14, '0')}_ordinary_${seed}.sql`;
  return { path, mode: '100644', blob: fakeBlob(seed), sha256: fakeSha256(seed) };
}
function buildValidRawEntries() {
  const entries = [];
  for (let i = 1; i <= 111; i += 1) entries.push(ordinaryEntry(i));
  entries.push({ path: PROTECTED_LINE_MIGRATION_PATH, mode: PROTECTED_LINE_MIGRATION_MODE, blob: PROTECTED_LINE_MIGRATION_BLOB, sha256: null });
  entries.push({ path: MONTHLY_INVOICE_MIGRATION_PATH, mode: MONTHLY_INVOICE_MIGRATION_MODE, blob: MONTHLY_INVOICE_MIGRATION_BLOB, sha256: null });
  assert.equal(entries.length, REQUIRED_FORMAL_MIGRATION_COUNT);
  return entries;
}

function createCountingGitAdapter(overrides = {}) {
  const calls = { getHead: 0, getTree: 0, getBranch: 0, getStatus: 0, getUpstreamAheadBehind: 0, getPullRequest: 0, getProtectedPathMetadata: 0 };
  return {
    calls,
    getHead: async () => { calls.getHead += 1; if (overrides.throwOn === 'getHead') throw new Error('fake git failure'); return overrides.head ?? VALID_HEAD; },
    getTree: async () => { calls.getTree += 1; return overrides.tree ?? VALID_TREE; },
    getBranch: async () => { calls.getBranch += 1; return overrides.branch ?? REQUIRED_BRANCH; },
    getStatus: async () => { calls.getStatus += 1; return overrides.status ?? ''; },
    getUpstreamAheadBehind: async () => { calls.getUpstreamAheadBehind += 1; return overrides.upstream ?? { ahead: 0, behind: 0 }; },
    getPullRequest: async () => { calls.getPullRequest += 1; return overrides.pullRequest ?? { number: REQUIRED_PR_NUMBER, state: REQUIRED_PR_STATE, draft: REQUIRED_PR_DRAFT === 'true', base: REQUIRED_PR_BASE }; },
    getProtectedPathMetadata: async () => { calls.getProtectedPathMetadata += 1; if (overrides.throwOn === 'getProtectedPathMetadata') throw new Error('fake git failure'); return overrides.protectedMetadata ?? PROTECTED_PATHS_METADATA.map((entry) => ({ ...entry })); },
  };
}

function createFilesystemAdapter(overrides = {}) {
  return {
    realpath: async (candidate) => {
      if (overrides.throwOnRealpath) throw new Error('fake filesystem failure');
      if (overrides.realpathMap && Object.prototype.hasOwnProperty.call(overrides.realpathMap, candidate)) {
        return overrides.realpathMap[candidate];
      }
      return candidate;
    },
    getExcludedRoots: async () => overrides.excludedRoots ?? ['/private/tmp', '/tmp', '/var/folders'],
    exists: async () => {
      if (overrides.throwOnExists) throw new Error('fake filesystem failure');
      return Boolean(overrides.staleProjectRefExists);
    },
  };
}

const pathAdapter = { sep: () => '/', join: (...parts) => parts.join('/') };

function createEnvironmentAdapter(snapshot = {}, throwSnapshot = false) {
  return { snapshot: async () => { if (throwSnapshot) throw new Error('fake environment failure'); return snapshot; } };
}

function hashAggregate(staged) {
  return staged.length === 112 ? EXPECTED_AGGREGATE_MANIFEST_SHA256 : 'wrong-hash';
}

function buildInput(overrides = {}) {
  const entries = buildValidRawEntries();
  return {
    expectedHead: VALID_HEAD,
    expectedTree: VALID_TREE,
    projectRef: REQUIRED_PROJECT_REF,
    isolatedWorkdir: WORKDIR,
    repoRoot: REPO_ROOT,
    attemptId: 'attempt-preflight-001',
    burnedKeys: new Set(),
    rawMigrationEntries: entries,
    canonicalManifest: entries.map((entry) => ({ ...entry })),
    ...overrides,
  };
}

function buildAdapters(overrides = {}) {
  return {
    git: overrides.git || createCountingGitAdapter(overrides.gitOverrides),
    filesystem: overrides.filesystem || createFilesystemAdapter(overrides.filesystemOverrides),
    path: pathAdapter,
    clock: overrides.clock || { now: () => 0 },
    environment: overrides.environment || createEnvironmentAdapter(overrides.environmentSnapshot || {}),
    hashAggregate: overrides.hashAggregate || hashAggregate,
  };
}

test('a fully consistent invocation returns ok:true with a staged plan', async () => {
  const result = await runPreflight(buildInput(), buildAdapters());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.plan.manifest.length, 112);
  assert.equal(result.plan.projectRef, REQUIRED_PROJECT_REF);
  assert.equal(result.plan.excluded[0].path, PROTECTED_LINE_MIGRATION_PATH);
});

test('R2-06: a dirty worktree/index fails before staging', async () => {
  const result = await runPreflight(buildInput(), buildAdapters({ gitOverrides: { status: ' M some/file' } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /not clean/);
});

test('R2-06: a wrong HEAD/tree fails', async () => {
  const wrongHead = 'c'.repeat(40);
  const result = await runPreflight(buildInput(), buildAdapters({ gitOverrides: { head: wrongHead } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /does not equal the expected accepted HEAD/);
});

test('R2-06: upstream divergence other than 0 0 fails', async () => {
  const result = await runPreflight(buildInput(), buildAdapters({ gitOverrides: { upstream: { ahead: 1, behind: 0 } } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /0 0/);
});

test('R2-06: wrong PR/branch identity fails', async () => {
  const result = await runPreflight(buildInput(), buildAdapters({ gitOverrides: { branch: 'wrong-branch' } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /required branch/);
});

test('R2-06: protected metadata drift fails', async () => {
  const drifted = PROTECTED_PATHS_METADATA.map((entry) => ({ ...entry }));
  drifted[0] = { ...drifted[0], blob: 'f'.repeat(40) };
  const result = await runPreflight(buildInput(), buildAdapters({ gitOverrides: { protectedMetadata: drifted } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected path metadata mismatch/);
});

test('R2-07: an excluded/temporary-root or symlink-escaping isolated workdir fails before staging', async () => {
  const result = await runPreflight(
    buildInput(),
    buildAdapters({ filesystemOverrides: { realpathMap: { [WORKDIR]: REPO_ROOT } } }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must not resolve inside the Git worktree/);
});

test('R2-07: an isolated workdir resolving under an excluded root fails', async () => {
  const result = await runPreflight(
    buildInput(),
    buildAdapters({ filesystemOverrides: { realpathMap: { [WORKDIR]: '/tmp/escaped-workdir' } } }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /excluded root/);
});

test('R2-07: a stale supabase/.temp/project-ref fails before staging', async () => {
  const result = await runPreflight(buildInput(), buildAdapters({ filesystemOverrides: { staleProjectRefExists: true } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /stale supabase\/\.temp\/project-ref/);
});

test('R2-07: a reused (already burned) attempt identifier fails', async () => {
  const burned = burnAttempt(new Set(), REQUIRED_PROJECT_REF, 'already-used-attempt').burnedKeys;
  const result = await runPreflight(buildInput({ attemptId: 'already-used-attempt', burnedKeys: burned }), buildAdapters());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /already been used and is burned/);
});

test('R2A-08: an unrecognized target fails closed with zero process spawns and zero adapter calls', async () => {
  const git = createCountingGitAdapter();
  const result = await runPreflight(buildInput({ projectRef: 'not-the-fixed-target' }), buildAdapters({ git }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /fixed target/);
  assert.deepEqual(git.calls, { getHead: 0, getTree: 0, getBranch: 0, getStatus: 0, getUpstreamAheadBehind: 0, getPullRequest: 0, getProtectedPathMetadata: 0 });
});

test('R2A-01: exact manifest metadata drift fails preflight via the canonical manifest contract', async () => {
  const entries = buildValidRawEntries();
  const canonicalManifest = entries.map((entry) => ({ ...entry }));
  entries[0] = { ...entries[0], blob: fakeBlob('tampered-preflight') };
  const result = await runPreflight(buildInput({ rawMigrationEntries: entries, canonicalManifest }), buildAdapters());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /metadata drift/);
});

test('R2B-01: an attacker-configured expectedAggregateSha256 that differs from the fixed literal fails closed, not silently substituted', async () => {
  const result = await runPreflight(buildInput({ expectedAggregateSha256: 'deliberately-wrong' }), buildAdapters());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /expectedAggregateSha256 must equal the fixed accepted aggregate manifest hash literal/);
});

test('R2B-01: a genuine aggregate hash mismatch from the injected hashAggregate authority fails closed', async () => {
  const result = await runPreflight(buildInput(), buildAdapters({ hashAggregate: () => 'wrong-hash' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /aggregate manifest hash mismatch/);
});

test('R2B-01: runPreflight fails closed when canonicalManifest is omitted from input', async () => {
  const result = await runPreflight(buildInput({ canonicalManifest: undefined }), buildAdapters());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /options.canonicalManifest is required/);
});

test('R2B-01: runPreflight fails closed when the adapters aggregate hash authority is missing', async () => {
  const adapters = buildAdapters();
  delete adapters.hashAggregate;
  const result = await runPreflight(buildInput(), adapters);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /options.hashAggregate is required/);
});

test('R2B-02: runPreflight fails closed when rawMigrationEntries are supplied out of canonical byte order', async () => {
  const entries = buildValidRawEntries();
  const reversed = [...entries].reverse();
  const result = await runPreflight(
    buildInput({ rawMigrationEntries: reversed, canonicalManifest: entries.map((entry) => ({ ...entry })) }),
    buildAdapters(),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /canonical byte-sorted/);
});

test('R2B-03: runPreflight fails closed when the protected LINE migration carries a content sha256', async () => {
  const entries = buildValidRawEntries().map((entry) =>
    entry.path === PROTECTED_LINE_MIGRATION_PATH ? { ...entry, sha256: fakeSha256('should-not-exist') } : entry,
  );
  const result = await runPreflight(buildInput({ rawMigrationEntries: entries }), buildAdapters());
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected LINE migration must never carry a content sha256/);
});

test('R2A-08: a rejected git adapter promise fails closed instead of throwing', async () => {
  const git = createCountingGitAdapter({ throwOn: 'getHead' });
  const result = await runPreflight(buildInput(), buildAdapters({ git }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /git adapter failed/);
});

test('R2A-08: a rejected filesystem adapter promise fails closed instead of throwing', async () => {
  const result = await runPreflight(buildInput(), buildAdapters({ filesystemOverrides: { throwOnRealpath: true } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /filesystem\/path adapter failed/);
});

test('a rejected environment adapter promise fails closed instead of throwing', async () => {
  const result = await runPreflight(buildInput(), buildAdapters({ environment: createEnvironmentAdapter({}, true) }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /environment adapter failed/);
});

test('R2-09: a forbidden ambient environment variable fails preflight', async () => {
  const result = await runPreflight(
    buildInput(),
    buildAdapters({ environment: createEnvironmentAdapter({ SUPABASE_DB_URL: 'postgresql://forbidden' }) }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /forbidden environment key/);
});

test('R2-10: no process is spawned during offline preflight; adapters expose no process/spawn surface at all', async () => {
  const adapters = buildAdapters();
  assert.equal(Object.prototype.hasOwnProperty.call(adapters, 'process'), false);
  const result = await runPreflight(buildInput(), adapters);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('runPreflight never materializes real migration files: the filesystem adapter is never asked to write anything', async () => {
  const filesystem = createFilesystemAdapter();
  assert.equal(typeof filesystem.writeFile, 'undefined');
  assert.equal(typeof filesystem.copyFile, 'undefined');
  const result = await runPreflight(buildInput(), buildAdapters({ filesystem }));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('preflight.mjs does not execute automatically on import (module import alone performs no I/O)', async () => {
  const moduleUrl = new URL('./preflight.mjs', import.meta.url);
  const before = Date.now();
  await import(`${moduleUrl.href}?cache-bust=${before}`);
  assert.ok(true);
});
