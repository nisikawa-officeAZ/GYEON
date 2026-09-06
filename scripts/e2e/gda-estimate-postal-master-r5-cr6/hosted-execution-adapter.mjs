// Offline-authored, production-capable hosted-execution adapter for the CR6
// hosted-replay harness (CR6-R3F, corrected under the R2 source-correction
// gate). Node built-in imports (`node:fs`, `node:child_process`,
// `node:crypto`, `node:path`) are permitted here: importing a Node built-in
// module has zero effect by itself, and this module still performs no real
// Git, filesystem, network, or process access merely by being imported.
// Every real-world effect happens only inside a function body that is
// actually invoked.
//
// `runHostedExecutionAdapter(rawInput)` is the only production-shaped public
// entrypoint: it accepts exactly one argument (a second argument is
// explicitly rejected) and can never be given, or used to select, a
// Git/process/fs/path/parser/timer/clock/ledger/evidence/materializer
// adapter. It internally constructs concrete, non-overridable adapters
// (backed by real `git`, `node:fs`, and the fixed Supabase CLI executable)
// and routes to the internal `runPreflightOnly`/`runExecuteOnce` functions
// using only that internally constructed set. There is no setter, registry,
// environment switch, or test hook capable of replacing that factory.
// `runPreflightOnly(rawInput, adapters)` and
// `runExecuteOnce(rawInput, adapters)` remain the internal/test-only,
// dependency-injected surface. `execute-once` is present here and is fully
// wired, but a real invocation against the hosted project requires a
// separate Owner authorization outside this offline correction pass;
// `preflight-only` local materialization/independent inspection/deletion
// never acquires a lock, writes a burn record, constructs a linked command,
// contacts hosted state, or retains hosted evidence.

import {
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  readSync,
  writeSync,
  fsyncSync,
  mkdirSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  lstatSync,
  fstatSync,
  statSync,
  realpathSync,
  readdirSync,
  constants as fsConstants,
} from 'node:fs';
import { spawn as spawnRealProcess, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join as joinPath, sep as posixSep } from 'node:path';

import {
  REQUIRED_FORMAL_MIGRATION_COUNT,
  REQUIRED_STAGED_MIGRATION_COUNT,
  REQUIRED_ENTRY_MODE,
  MIGRATIONS_DIR_PREFIX,
  PROTECTED_LINE_MIGRATION_PATH,
  PROTECTED_LINE_MIGRATION_MODE,
  PROTECTED_LINE_MIGRATION_BLOB,
  MONTHLY_INVOICE_MIGRATION_PATH,
  MONTHLY_INVOICE_MIGRATION_MODE,
  MONTHLY_INVOICE_MIGRATION_BLOB,
  EXPECTED_AGGREGATE_MANIFEST_SHA256,
} from './manifest-core.mjs';
import {
  runPreflight,
  REQUIRED_BRANCH,
  REQUIRED_PR_NUMBER,
  REQUIRED_PR_STATE,
  REQUIRED_PR_DRAFT,
  REQUIRED_PR_BASE,
  PROTECTED_PATHS_METADATA,
} from './preflight.mjs';
import {
  REQUIRED_PROJECT_REF,
  buildMigrationListArgv,
  buildMigrationUpArgv,
} from './replay-command-core.mjs';
import { applyOnce } from './apply-once.mjs';
import { buildAttemptKey, isBurned as coreIsBurned } from './quarantine-core.mjs';
import { finalizeEvidence } from './finalize-evidence.mjs';

/** Fixed executable identity (R3F §7); never caller-selectable. */
export const FIXED_SUPABASE_EXECUTABLE = '/opt/homebrew/Cellar/supabase/2.116.0/bin/supabase';
export const REQUIRED_SUPABASE_VERSION = '2.116.0';
const GIT_EXECUTABLE = '/usr/bin/git';
const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const GIT_FIXED_ENV = Object.freeze({
  PATH: '/usr/bin:/bin',
  HOME: '/var/empty',
  LANG: 'C',
  LC_ALL: 'C',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: '/usr/bin/false',
  SSH_ASKPASS: '/usr/bin/false',
});

/** Bounded stdout/stderr collectors for the real CLI byte mapping (R3F §7). */
export const STDOUT_BYTE_CEILING = 8 * 1024 * 1024;
export const STDERR_BYTE_CEILING = 2 * 1024 * 1024;

/** Fixed pinned attested digest used only for the monthly-invoice aggregate
 * manifest row (R3F §4/§5); the manifest entry's own `sha256` field stays
 * `null` per the frozen `manifest-core.mjs` contract. */
export const MONTHLY_INVOICE_ATTESTED_DIGEST =
  '1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255';

/** The narrow public entrypoint accepts exactly these six keys. */
export const PUBLIC_INPUT_KEYS = ['mode', 'attemptId', 'confirmation', 'repoRoot', 'runtimeRoot', 'evidenceRoot'];
export const ALLOWED_MODES = ['preflight-only', 'execute-once'];
export const CONFIRMATION_TOKEN = 'EXECUTE_GDA_POSTAL_R5_CR6_ONCE';
export const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
export const MAX_ROOT_BYTES = 4096;

/** Internally fixed durable burn-ledger location; never caller-selectable. */
export const LEDGER_ROOT =
  '/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/runtime/gda-estimate-postal-master-r5-cr6/burn-ledger-v1';

/**
 * Fixed accepted governance parent and the exact two-file committed delta.
 * The accepted parent already contains the R3H manifest corrections and the
 * R3I-C1 adapter correction. This closes the circular self-hash problem: the
 * adapter never hardcodes its own post-correction HEAD/tree; it proves the
 * current commit is the single direct child of this exact accepted parent by
 * exactly the two adapter paths, then uses the freshly derived current
 * HEAD/tree as identity for every downstream check.
 */
export const CANONICAL_GOVERNANCE_COMMIT = 'e2371101356ac275e9bf1569fb18f887ad94796b';
export const CANONICAL_GOVERNANCE_TREE = 'c52212942d91fb31c423b49ef50536806bdd25ff';
export const ACCEPTED_GOVERNANCE_PARENT = 'dfd59f95466408783730d46fdd58a5f8a107ca62';
export const ACCEPTED_GOVERNANCE_TREE = '5e1ffa64fb1598b6ac32fb7e37cf4e4aacc807fd';
export const DRAFT_MIGRATION_TREE_PATH = 'supabase/migrations/DRAFT_DO_NOT_APPLY';
export const DRAFT_MIGRATION_TREE_BLOB = 'b6b9b1bd0cefedd0a08a40ef7c2c55c4fa5f4018';
const OBSERVED_MIGRATION_BASENAME_PATTERN = /^(?:[0-9]{3}|[0-9]{14})_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*\.sql$/;
export const EXACT_IMPLEMENTATION_PATHS = [
  'scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs',
  'scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs',
];

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isAbsoluteNoTraversal(candidate) {
  return (
    typeof candidate === 'string' &&
    candidate.length > 0 &&
    candidate.startsWith('/') &&
    !candidate.split('/').includes('..')
  );
}

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

/** True when neither path contains the other at a path-segment boundary,
 * and the two paths are not identical. */
function pathsDisjoint(a, b) {
  if (a === b) return false;
  const withSepA = a.endsWith('/') ? a : `${a}/`;
  const withSepB = b.endsWith('/') ? b : `${b}/`;
  if (b.startsWith(withSepA)) return false;
  if (a.startsWith(withSepB)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Exact real CLI byte mapping (R3F §7): streaming prompt scanner, bounded
// stdout/stderr parsing, and the exact list/up JSON+stderr contracts. These
// are pure functions operating only on their string/array arguments; the
// concrete real spawn adapter later in this module is the only place that
// performs actual process I/O.
// ---------------------------------------------------------------------------

/** Known interactive-prompt token patterns plus the JSON `Cannot prompt`
 * error envelope. Unknown/unlisted prompt shapes are never silently
 * accepted: every other drift independently quarantines via a JSON/shape/
 * stderr mismatch, so an unrecognized prompt still fails closed. */
export const PROMPT_TOKEN_PATTERNS = [
  /password/i,
  /overwrite/i,
  /\(y\/n\)/i,
  /do you want to/i,
  /press any key/i,
  /continue\?/i,
];
export const JSON_CANNOT_PROMPT_MESSAGE = 'Cannot prompt for values when not attached to a TTY';
const PROMPT_SCANNER_OVERLAP_CHARS = 256;

/** A streaming scanner that carries a bounded overlap window across chunk
 * boundaries so a prompt token split across two `data` events is still
 * detected (R3F §7). */
export function createPromptScanner() {
  let carry = '';
  return {
    push(chunkText) {
      const window = carry + chunkText;
      const found =
        PROMPT_TOKEN_PATTERNS.some((pattern) => pattern.test(window)) || window.includes(JSON_CANNOT_PROMPT_MESSAGE);
      carry = window.slice(-PROMPT_SCANNER_OVERLAP_CHARS);
      return found;
    },
  };
}

function migrationVersionFromPath(path) {
  const basename = path.slice(path.lastIndexOf('/') + 1);
  const match = /^((?:\d{3}|\d{14}))_/.exec(basename);
  return match ? match[1] : null;
}

/** Exact version-derived `time` value for one migration row. */
export function deriveExpectedMigrationTime(version) {
  // Supabase CLI 2.116.0 preserves a legacy three-digit sequence verbatim in
  // the time column. Fourteen-digit versions are rendered as UTC timestamps.
  if (typeof version === 'string' && /^\d{3}$/.test(version)) return version;
  if (typeof version !== 'string' || !/^\d{14}$/.test(version)) return null;
  const y = version.slice(0, 4);
  const mo = version.slice(4, 6);
  const d = version.slice(6, 8);
  const h = version.slice(8, 10);
  const mi = version.slice(10, 12);
  const s = version.slice(12, 14);
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function hasExactlyOneTrailingLf(text) {
  return typeof text === 'string' && text.length > 0 && text.endsWith('\n') && text.indexOf('\n') === text.length - 1;
}

function hasExactOwnKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

/** Validate the exact list JSON+stderr contract (R3F §7). `staged` must be
 * the accepted, exactly-ordered 112-entry manifest. */
export function parseListOutput(stdoutText, staged) {
  if (!hasExactlyOneTrailingLf(stdoutText)) {
    return { ok: false, errors: ['list stdout must be exactly one UTF-8 JSON object plus one trailing LF'] };
  }
  let parsed;
  try {
    parsed = JSON.parse(stdoutText.slice(0, -1));
  } catch (error) {
    return { ok: false, errors: [`list stdout is not valid JSON: ${errorMessage(error)}`] };
  }
  if (!hasExactOwnKeys(parsed, ['migrations', 'message'])) {
    return { ok: false, errors: ['list stdout JSON must have exactly the keys migrations and message'] };
  }
  if (parsed.message !== 'Migrations listed') {
    return { ok: false, errors: ['list stdout message must be exactly "Migrations listed"'] };
  }
  if (!Array.isArray(parsed.migrations) || parsed.migrations.length !== staged.length) {
    return { ok: false, errors: [`list stdout must contain exactly ${staged.length} migration rows`] };
  }
  for (let i = 0; i < parsed.migrations.length; i += 1) {
    const row = parsed.migrations[i];
    if (!hasExactOwnKeys(row, ['local', 'remote', 'time'])) {
      return { ok: false, errors: [`list row ${i} must have exactly the keys local, remote, time`] };
    }
    if (row.remote !== '') {
      return { ok: false, errors: [`list row ${i} must carry an empty remote value`] };
    }
    const expectedVersion = staged[i] ? migrationVersionFromPath(staged[i].path) : null;
    if (row.local !== expectedVersion) {
      return { ok: false, errors: [`list row ${i} local version does not match the expected staged order`] };
    }
    if (row.time !== deriveExpectedMigrationTime(expectedVersion)) {
      return { ok: false, errors: [`list row ${i} time does not match the exact version-derived time`] };
    }
  }
  return { ok: true, message: parsed.message };
}

export const REQUIRED_LIST_STDERR = 'Connecting to remote database...\n';

export function validateListStderr(stderrText) {
  return stderrText === REQUIRED_LIST_STDERR;
}

/** Validate the exact up JSON contract (R3F §7). */
export function parseUpOutput(stdoutText, staged, isolatedWorkdir) {
  if (!hasExactlyOneTrailingLf(stdoutText)) {
    return { ok: false, errors: ['up stdout must be exactly one UTF-8 JSON object plus one trailing LF'] };
  }
  let parsed;
  try {
    parsed = JSON.parse(stdoutText.slice(0, -1));
  } catch (error) {
    return { ok: false, errors: [`up stdout is not valid JSON: ${errorMessage(error)}`] };
  }
  if (!hasExactOwnKeys(parsed, ['applied', 'message'])) {
    return { ok: false, errors: ['up stdout JSON must have exactly the keys applied and message'] };
  }
  if (parsed.message !== 'Migrations applied') {
    return { ok: false, errors: ['up stdout message must be exactly "Migrations applied"'] };
  }
  if (!Array.isArray(parsed.applied) || parsed.applied.length !== staged.length) {
    return { ok: false, errors: [`up stdout must contain exactly ${staged.length} applied paths`] };
  }
  for (let i = 0; i < parsed.applied.length; i += 1) {
    const expected = `${isolatedWorkdir}/${staged[i].path}`;
    if (parsed.applied[i] !== expected) {
      return { ok: false, errors: [`up applied[${i}] does not match the exact canonical absolute isolated path`] };
    }
  }
  return { ok: true, message: parsed.message };
}

/** Build the exact expected up-stderr contract: the connection line followed
 * by exactly one ordered `Applying migration <basename>...` line per staged
 * entry (R3F §7). */
export function buildExpectedUpStderr(staged) {
  const lines = ['Connecting to remote database...'];
  for (const entry of staged) {
    const basename = entry.path.slice(entry.path.lastIndexOf('/') + 1);
    lines.push(`Applying migration ${basename}...`);
  }
  return `${lines.join('\n')}\n`;
}

export function validateUpStderr(stderrText, staged) {
  return stderrText === buildExpectedUpStderr(staged);
}

/**
 * Validate the exact narrow public input shape. The caller cannot supply or
 * override project ref, fixed HEAD/tree, migration set, manifests, digests,
 * executable, argv, cwd, environment, adapters, parser, timer, clock,
 * ledger root, lock path, evidence sink, or timeouts/limits. Unknown keys
 * fail closed. Every caller root must additionally be disjoint from the
 * fixed internal `LEDGER_ROOT`: it may never equal, contain, or be
 * contained by it (R1 correction: this previously reproducible case
 * returned `ok:true` and is now fail-closed at the string level, before any
 * adapter is invoked).
 */
export function validatePublicInput(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['input must be a plain object'] };
  }

  const keys = Object.keys(input);
  const unknown = keys.filter((key) => !PUBLIC_INPUT_KEYS.includes(key));
  if (unknown.length > 0) {
    return { ok: false, errors: [`unknown input key(s): ${unknown.join(', ')}`] };
  }

  const errors = [];
  const { mode, attemptId, confirmation, repoRoot, runtimeRoot, evidenceRoot } = input;

  if (!ALLOWED_MODES.includes(mode)) {
    errors.push(`mode must be exactly one of ${ALLOWED_MODES.join(' or ')}`);
  }
  if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) {
    errors.push('attemptId must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$');
  }

  if (mode === 'preflight-only') {
    if (confirmation !== undefined && confirmation !== null) {
      errors.push('preflight-only requires confirmation to be absent or null');
    }
  } else if (mode === 'execute-once') {
    if (confirmation !== CONFIRMATION_TOKEN) {
      errors.push(`execute-once requires confirmation to equal exactly "${CONFIRMATION_TOKEN}"`);
    }
  }

  const roots = { repoRoot, runtimeRoot, evidenceRoot };
  for (const [name, value] of Object.entries(roots)) {
    if (!isAbsoluteNoTraversal(value)) {
      errors.push(`${name} must be an absolute path without a parent-directory reference`);
      continue;
    }
    if (byteLength(value) > MAX_ROOT_BYTES) {
      errors.push(`${name} must not exceed ${MAX_ROOT_BYTES} UTF-8 bytes`);
    }
  }

  if (errors.length === 0) {
    for (const [name, value] of Object.entries(roots)) {
      if (!pathsDisjoint(value, LEDGER_ROOT)) {
        errors.push(`${name} must be disjoint from the fixed internal ledger root; it may never equal, contain, or be contained by it`);
      }
    }
    const pairs = [
      ['repoRoot', 'runtimeRoot'],
      ['repoRoot', 'evidenceRoot'],
      ['runtimeRoot', 'evidenceRoot'],
    ];
    for (const [a, b] of pairs) {
      if (!pathsDisjoint(roots[a], roots[b])) {
        errors.push(`${a} and ${b} must be mutually disjoint`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      mode,
      attemptId,
      confirmation: mode === 'execute-once' ? confirmation : null,
      repoRoot,
      runtimeRoot,
      evidenceRoot,
    },
  };
}

/**
 * Independently re-validate the three caller-declared roots against the
 * real filesystem through injected no-follow adapters: no symlink
 * component anywhere in the path, ownership by the effective uid, and
 * mutual/ledger disjointness recomputed on the *canonical* path so a
 * symlink or bind-mount alias can never be used to smuggle a root inside
 * `LEDGER_ROOT`, inside another declared root, or into an otherwise
 * excluded location. `validatePublicInput` alone cannot detect this class
 * of drift because it never touches the filesystem.
 */
export async function validateRootIsolation(adapters, roots) {
  if (!adapters || typeof adapters !== 'object' || !adapters.filesystem || typeof adapters.filesystem.inspectPathNoFollow !== 'function') {
    return { ok: false, errors: ['adapters.filesystem.inspectPathNoFollow is required for root isolation validation'] };
  }
  const { repoRoot, runtimeRoot, evidenceRoot } = roots;
  const named = { repoRoot, runtimeRoot, evidenceRoot };
  const errors = [];
  const canonical = {};

  for (const [name, value] of Object.entries(named)) {
    let inspection;
    try {
      inspection = await adapters.filesystem.inspectPathNoFollow(value);
    } catch (error) {
      errors.push(`root inspection failed for ${name}: ${errorMessage(error)}`);
      continue;
    }
    if (!inspection || typeof inspection !== 'object') {
      errors.push(`root inspection returned an invalid result for ${name}`);
      continue;
    }
    if (inspection.hasSymlinkComponent === true) {
      errors.push(`${name} contains a symlink path component`);
      continue;
    }
    if (inspection.exists === true && inspection.ownedByEffectiveUid !== true) {
      errors.push(`${name} is not owned by the effective uid`);
      continue;
    }
    canonical[name] = typeof inspection.real === 'string' && inspection.real.length > 0 ? inspection.real : value;
  }

  if (errors.length > 0) return { ok: false, errors };

  for (const [name, value] of Object.entries(canonical)) {
    if (!pathsDisjoint(value, LEDGER_ROOT)) {
      errors.push(`${name} canonical path must be disjoint from the fixed internal ledger root`);
    }
  }
  const pairs = [
    ['repoRoot', 'runtimeRoot'],
    ['repoRoot', 'evidenceRoot'],
    ['runtimeRoot', 'evidenceRoot'],
  ];
  for (const [a, b] of pairs) {
    if (!pathsDisjoint(canonical[a], canonical[b])) {
      errors.push(`${a} and ${b} canonical paths must be mutually disjoint`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, canonical };
}

/**
 * Acquire and validate Git-derived execution identity through the injected
 * `adapters.git`. Proves the current commit descends from the exact
 * accepted governance parent by exactly the two allowed adapter paths, and
 * that fixed branch/PR/protected-metadata/clean/upstream identity all hold,
 * before returning the freshly derived current HEAD and tree as the identity
 * used by every downstream check.
 */
export async function acquireExecutionIdentity(adapters) {
  if (!adapters || typeof adapters !== 'object' || !adapters.git) {
    return { ok: false, errors: ['adapters.git is required'] };
  }
  const g = adapters.git;

  let head;
  let tree;
  let branch;
  let status;
  let upstream;
  let pullRequest;
  let parents;
  let parentTree;
  let changedPaths;
  let protectedEntries;
  try {
    head = await g.getHead();
    tree = await g.getTree();
    branch = await g.getBranch();
    status = await g.getStatus();
    upstream = await g.getUpstreamAheadBehind();
    pullRequest = await g.getPullRequest();
    parents = await g.getParents(head);
    parentTree = await g.getTreeForCommit(ACCEPTED_GOVERNANCE_PARENT);
    changedPaths = await g.getChangedPathsFromParent(ACCEPTED_GOVERNANCE_PARENT);
    protectedEntries = await g.getProtectedPathMetadata(PROTECTED_PATHS_METADATA.map((entry) => entry.path));
  } catch (error) {
    return { ok: false, errors: [`git adapter failed: ${errorMessage(error)}`] };
  }

  const errors = [];

  if (typeof head !== 'string' || !/^[0-9a-f]{40}$/.test(head)) errors.push('HEAD must be a 40-character hex commit sha');
  if (typeof tree !== 'string' || !/^[0-9a-f]{40}$/.test(tree)) errors.push('tree must be a 40-character hex tree sha');
  if (typeof status !== 'string' || status.length !== 0) errors.push('worktree/index is not clean');
  if (!upstream || upstream.uncertain === true || upstream.ahead !== 0 || upstream.behind !== 0) {
    errors.push('upstream ahead/behind must be certainly and exactly 0 0');
  }
  if (branch !== REQUIRED_BRANCH) errors.push(`branch must equal the required branch ${REQUIRED_BRANCH}`);
  if (
    !pullRequest ||
    String(pullRequest.number) !== REQUIRED_PR_NUMBER ||
    pullRequest.state !== REQUIRED_PR_STATE ||
    String(pullRequest.draft) !== REQUIRED_PR_DRAFT ||
    pullRequest.base !== REQUIRED_PR_BASE ||
    pullRequest.branch !== REQUIRED_BRANCH ||
    pullRequest.source !== 'pinned_governance_literal'
  ) {
    errors.push('pull request identity does not match the required fixed branch/PR contract');
  }
  if (!Array.isArray(parents) || parents.length !== 1 || parents[0] !== ACCEPTED_GOVERNANCE_PARENT) {
    errors.push('HEAD must have exactly one parent equal to the accepted governance parent commit');
  }
  if (parentTree !== ACCEPTED_GOVERNANCE_TREE) {
    errors.push('accepted governance parent tree does not match its fixed identity');
  }
  if (!Array.isArray(changedPaths)) {
    errors.push('changed paths from the accepted governance parent must be an array');
  } else {
    const actual = [...changedPaths].sort();
    const expected = [...EXACT_IMPLEMENTATION_PATHS].sort();
    const matches = actual.length === expected.length && actual.every((path, index) => path === expected[index]);
    if (!matches) {
      errors.push(`the committed delta from the accepted governance parent must be exactly the ${EXACT_IMPLEMENTATION_PATHS.length} accepted paths`);
    }
  }
  for (const expected of PROTECTED_PATHS_METADATA) {
    const actual = Array.isArray(protectedEntries) ? protectedEntries.find((entry) => entry && entry.path === expected.path) : undefined;
    if (!actual || actual.mode !== expected.mode || actual.blob !== expected.blob) {
      errors.push(`protected path metadata mismatch: ${expected.path}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, head, tree, branch, parents, changedPaths };
}

/** The exact canonical durable burn-record byte contract (CR6-R3E/R3F §8.2). */
export function buildCanonicalBurnRecord(attemptId) {
  return (
    'GDA_ESTIMATE_POSTAL_MASTER_R5_CR6_BURN_V1\n' +
    `project_ref=${REQUIRED_PROJECT_REF}\n` +
    `attempt_id=${attemptId}\n` +
    'state=BURNED_NO_RETRY\n'
  );
}

/** Fixed ledger path composition using the injected path adapter. */
export function buildLedgerPaths(adapters, attemptId) {
  const projectDir = adapters.path.join(LEDGER_ROOT, REQUIRED_PROJECT_REF);
  return {
    ledgerRoot: LEDGER_ROOT,
    projectDir,
    activeLockPath: adapters.path.join(projectDir, 'active.lock'),
    burnPath: attemptId ? adapters.path.join(projectDir, `${attemptId}.burn`) : undefined,
  };
}

/**
 * Read-only reconstruction of the durable burned-attempt ledger into the
 * exact `Set` shape consumed by the frozen `isBurned`/`burnAttempt` pair.
 * An absent ledger/project directory is treated as an empty ledger (only
 * `execute-once` may later create it). Any unknown, partial, malformed, or
 * mismatched record fails closed rather than being silently skipped.
 */
export async function enumerateBurnedKeys(adapters) {
  if (!adapters || typeof adapters !== 'object' || !adapters.ledger || typeof adapters.ledger.listBurnRecords !== 'function') {
    return { ok: false, errors: ['adapters.ledger.listBurnRecords is required'] };
  }

  let records;
  try {
    records = await adapters.ledger.listBurnRecords();
  } catch (error) {
    return { ok: false, errors: [`ledger listing failed: ${errorMessage(error)}`] };
  }

  if (records === null || records === undefined) {
    return { ok: true, keys: new Set() };
  }
  if (!Array.isArray(records)) {
    return { ok: false, errors: ['ledger record listing must be an array, or null/undefined for an absent ledger'] };
  }

  const keys = new Set();
  let expectedDevice;
  for (const record of records) {
    if (
      !record ||
      typeof record !== 'object' ||
      record.type !== 'regular' ||
      record.mode !== '0600' ||
      record.ownedByEffectiveUid !== true ||
      record.linkCount !== 1 ||
      typeof record.attemptId !== 'string' ||
      typeof record.content !== 'string'
    ) {
      return {
        ok: false,
        errors: ['ledger enumeration found an unknown, partial, or malformed burn record; treated as burned/ledger uncertainty'],
      };
    }
    if (record.content !== buildCanonicalBurnRecord(record.attemptId)) {
      return { ok: false, errors: [`ledger burn record content mismatch for attempt ${record.attemptId}`] };
    }
    if (Object.prototype.hasOwnProperty.call(record, 'device')) {
      if (expectedDevice === undefined) expectedDevice = record.device;
      else if (record.device !== expectedDevice) {
        return { ok: false, errors: [`ledger burn record device drift for attempt ${record.attemptId}`] };
      }
    }
    const keyResult = buildAttemptKey(REQUIRED_PROJECT_REF, record.attemptId);
    if (!keyResult.ok) {
      return { ok: false, errors: [`ledger burn record has an invalid attempt id: ${record.attemptId}`] };
    }
    keys.add(keyResult.key);
  }
  return { ok: true, keys };
}

/**
 * Independently verify a lock-acquisition result's exact owner-record
 * identity rather than trusting a bare `{ ok: true }`. Every fixed
 * durability field must be present and correct: the composite key excludes
 * a different attempt, and a missing/wrong field is treated exactly like an
 * acquisition failure (R1 correction: never blindly trust an external
 * `{ ok: true }`).
 */
export function verifyLockAcquisitionResult(result, attemptId) {
  if (!result || result.ok !== true) return false;
  const owner = result.ownerRecord;
  return Boolean(
    owner &&
      owner.attemptId === attemptId &&
      owner.lockDirMode === '0700' &&
      owner.ownerFileMode === '0600' &&
      owner.ownedByEffectiveUid === true &&
      owner.linkCount === 1 &&
      owner.ownerFileFsynced === true &&
      owner.lockDirFsynced === true,
  );
}

/**
 * Independently verify a durable-burn result's exact record identity rather
 * than trusting a bare `{ ok: true }`: exact canonical content, mode,
 * ownership, link count, exclusive no-follow creation, and the complete
 * write/fsync/read-back/directory-fsync durability sequence must all be
 * confirmed before the attempt is treated as durably burned (R1
 * correction).
 */
export function verifyDurableBurnResult(result, attemptId) {
  if (!result || result.ok !== true) return false;
  const record = result.record;
  return Boolean(
    record &&
      record.attemptId === attemptId &&
      record.content === buildCanonicalBurnRecord(attemptId) &&
      record.mode === '0600' &&
      record.type === 'regular' &&
      record.ownedByEffectiveUid === true &&
      record.linkCount === 1 &&
      record.createdExclusiveNoFollow === true &&
      record.fileFsynced === true &&
      record.readBackVerified === true &&
      record.directoryFsynced === true,
  );
}

/**
 * Release the durable execution lock and fail closed on any release
 * failure instead of swallowing it as success. A failed release is
 * retained as a fail-closed stale lock and is never auto-recovered by this
 * adapter (R1 correction: a release failure must never be silently
 * downgraded to an overall success).
 */
async function releaseLockStrict(adapters) {
  let result;
  try {
    result = await adapters.ledger.releaseLock();
  } catch (error) {
    return { ok: false, errors: [`lock release failed: ${errorMessage(error)}`] };
  }
  if (!result || result.ok !== true) {
    return { ok: false, errors: ['lock release did not succeed; the lock remains a fail-closed stale lock and is never auto-recovered'] };
  }
  return { ok: true };
}

const EXECUTION_EVIDENCE_MARKER = 'GDA_ESTIMATE_POSTAL_MASTER_R5_CR6_EXECUTION_METADATA_V1';
const PROCESS_METADATA_KEYS = [
  'stage',
  'exitCode',
  'signal',
  'stdoutBytes',
  'stdoutSha256',
  'stderrBytes',
  'stderrSha256',
  'promptDetected',
  'truncated',
  'targetMismatch',
  'ledgerMismatch',
  'spawnFailed',
];

function validateProcessMetadata(records, trace) {
  if (!Array.isArray(records)) return ['process metadata must be an array'];
  if (records.length !== trace.realStages.length) {
    return ['process metadata count must equal the independently traced real OS launch count'];
  }
  const errors = [];
  records.forEach((record, index) => {
    if (!hasExactOwnKeys(record, PROCESS_METADATA_KEYS)) {
      errors.push(`process metadata row ${index} has an invalid key set`);
      return;
    }
    if (record.stage !== trace.realStages[index] || !['list', 'up'].includes(record.stage)) {
      errors.push(`process metadata row ${index} has an inconsistent stage`);
    }
    if (record.exitCode !== null && !Number.isInteger(record.exitCode)) errors.push(`process metadata row ${index} has an invalid exitCode`);
    if (record.signal !== null && typeof record.signal !== 'string') errors.push(`process metadata row ${index} has an invalid signal`);
    if (!Number.isSafeInteger(record.stdoutBytes) || record.stdoutBytes < 0) errors.push(`process metadata row ${index} has invalid stdoutBytes`);
    if (!Number.isSafeInteger(record.stderrBytes) || record.stderrBytes < 0) errors.push(`process metadata row ${index} has invalid stderrBytes`);
    if (!/^[0-9a-f]{64}$/.test(record.stdoutSha256)) errors.push(`process metadata row ${index} has invalid stdoutSha256`);
    if (!/^[0-9a-f]{64}$/.test(record.stderrSha256)) errors.push(`process metadata row ${index} has invalid stderrSha256`);
    for (const flag of ['promptDetected', 'truncated', 'targetMismatch', 'ledgerMismatch', 'spawnFailed']) {
      if (typeof record[flag] !== 'boolean') errors.push(`process metadata row ${index} has invalid ${flag}`);
    }
  });
  return errors;
}

async function finalizeExecutionEvidence(adapters, input, details) {
  if (
    !adapters.evidence ||
    typeof adapters.evidence !== 'object' ||
    !Array.isArray(adapters.evidence.rawArtifacts) ||
    typeof adapters.evidence.recordExecutionSummary !== 'function'
  ) {
    return {
      ok: false,
      decision: 'QUARANTINE_NO_RETRY',
      errors: ['adapters.evidence with rawArtifacts and recordExecutionSummary is required'],
    };
  }
  if (!adapters.process || typeof adapters.process.getExecutionMetadata !== 'function') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['process metadata accessor is required'] };
  }

  let processMetadata;
  try {
    processMetadata = adapters.process.getExecutionMetadata();
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`process metadata acquisition failed: ${errorMessage(error)}`] };
  }
  const metadataErrors = validateProcessMetadata(processMetadata, details.trace);
  if (metadataErrors.length > 0) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: metadataErrors };

  const artifactName = `execution-${createHash('sha256').update(input.attemptId, 'utf8').digest('hex').slice(0, 32)}.json`;
  const burnPath = joinPath(LEDGER_ROOT, REQUIRED_PROJECT_REF, `${input.attemptId}.burn`);
  const syntheticCount = details.trace.logicalStages.length - details.trace.realStages.length;
  if (syntheticCount < 0 || syntheticCount > 1) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['logical/real launch counts are inconsistent'] };
  }
  const reason = details.reason || (details.applyResult && details.applyResult.reason) || null;
  const emptySha256 = createHash('sha256').update(Buffer.alloc(0)).digest('hex');
  const logicalOutcomeMetadata = processMetadata.map((entry) => ({ ...entry, realOsLaunch: true }));
  if (syntheticCount === 1) {
    logicalOutcomeMetadata.push({
      stage: details.trace.logicalStages[details.trace.logicalStages.length - 1] || 'unknown',
      exitCode: null,
      signal: null,
      stdoutBytes: 0,
      stdoutSha256: emptySha256,
      stderrBytes: 0,
      stderrSha256: emptySha256,
      promptDetected: reason === 'interactive_prompt',
      truncated: false,
      targetMismatch: reason === 'target_mismatch',
      ledgerMismatch: reason === 'ledger_mismatch',
      spawnFailed: false,
      realOsLaunch: false,
    });
  }
  const summary = {
    marker: EXECUTION_EVIDENCE_MARKER,
    logicalCallCount: details.trace.logicalStages.length,
    logicalStages: [...details.trace.logicalStages],
    realOsLaunchCount: details.trace.realStages.length,
    processMetadata,
    logicalOutcomeMetadata,
    burnPathIdentitySha256: createHash('sha256').update(burnPath, 'utf8').digest('hex'),
    lockLifecycle: {
      acquired: details.lockAcquired === true,
      burnRecorded: details.burnRecorded === true,
      releaseState: details.lockAcquired === true ? 'pending_until_evidence_finalized' : 'not_owned',
    },
    subtype: details.subtype || null,
    finalVerification: {
      targetVerified: details.targetVerified === true,
      ledgerVerified: details.ledgerVerified === true,
      processMetadataConsistent: true,
      applyOk: details.applyResult && details.applyResult.ok === true,
      decision: details.applyResult && details.applyResult.decision ? details.applyResult.decision : 'QUARANTINE_NO_RETRY',
      reason,
    },
  };

  let recorded;
  try {
    recorded = await adapters.evidence.recordExecutionSummary(artifactName, summary);
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`evidence summary write failed: ${errorMessage(error)}`] };
  }
  if (
    !recorded ||
    recorded.ok !== true ||
    recorded.name !== artifactName ||
    recorded.mode !== '0600' ||
    !adapters.evidence.rawArtifacts.some((artifact) => artifact && artifact.name === artifactName)
  ) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['evidence summary registration or mode verification failed'] };
  }
  if (adapters.evidence.rawArtifacts.length === 0) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['execute-once evidence artifact list must not be empty'] };
  }

  let evidenceResult;
  try {
    evidenceResult = await finalizeEvidence(adapters.evidence.rawArtifacts, adapters.evidence);
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`evidence finalization failed: ${errorMessage(error)}`] };
  }
  if (!evidenceResult || evidenceResult.ok !== true) {
    return {
      ok: false,
      decision: 'QUARANTINE_NO_RETRY',
      errors: ['evidence finalization did not succeed; lock remains held'],
      evidenceResult,
    };
  }
  return { ok: true, evidenceResult };
}

/**
 * Independently verify a materialized isolated tree against the accepted
 * staged manifest: the exact 112-path set, exact per-file content hash for
 * every ordinary entry (the protected monthly entry is never re-hashed, per
 * R3F §5/§8.1), regular type, mode 100644, no symlink, effective-uid
 * ownership, a single hard link, one consistent device across every entry,
 * and canonical-path-equals-actual-path (no alias/mount substitution).
 * Count and mode alone are never sufficient (R1 correction).
 */
export function verifyMaterializedTree(staged, inspected) {
  const files = inspected && Array.isArray(inspected.files) ? inspected.files : null;
  if (!files || files.length !== REQUIRED_STAGED_MIGRATION_COUNT) {
    return [`expected exactly ${REQUIRED_STAGED_MIGRATION_COUNT} independently inspected regular files, found ${files ? files.length : 'none'}`];
  }

  const errors = [];
  const expectedByPath = new Map(staged.map((entry) => [entry.path, entry]));
  const seenPaths = new Set();
  let expectedDevice;

  for (const file of files) {
    if (!file || typeof file.relativePath !== 'string' || file.relativePath.length === 0) {
      errors.push('materialized entry is missing a relativePath');
      continue;
    }
    if (seenPaths.has(file.relativePath)) {
      errors.push(`duplicate materialized path: ${file.relativePath}`);
      continue;
    }
    seenPaths.add(file.relativePath);

    const expected = expectedByPath.get(file.relativePath);
    if (!expected) {
      errors.push(`materialized path is not present in the accepted staged manifest: ${file.relativePath}`);
      continue;
    }

    if (file.mode !== REQUIRED_ENTRY_MODE) errors.push(`materialized entry is not mode ${REQUIRED_ENTRY_MODE}: ${file.relativePath}`);
    if (file.isRegular !== true) errors.push(`materialized entry is not a regular file: ${file.relativePath}`);
    if (file.isSymlink === true) errors.push(`materialized entry is a symlink or alias: ${file.relativePath}`);
    if (file.ownedByEffectiveUid !== true) errors.push(`materialized entry is not owned by the effective uid: ${file.relativePath}`);
    if (file.linkCount !== 1) errors.push(`materialized entry has a hard link count other than one: ${file.relativePath}`);
    if (Object.prototype.hasOwnProperty.call(file, 'device')) {
      if (expectedDevice === undefined) expectedDevice = file.device;
      else if (file.device !== expectedDevice) errors.push(`materialized entry device drift: ${file.relativePath}`);
    }
    if (
      typeof file.canonicalPath === 'string' &&
      typeof file.absolutePath === 'string' &&
      file.canonicalPath !== file.absolutePath
    ) {
      errors.push(`materialized entry canonical path does not equal its actual path (alias/symlink escape): ${file.relativePath}`);
    }

    const isProtectedEntry = expected.sha256 === null;
    if (!isProtectedEntry) {
      if (typeof file.sha256 !== 'string' || file.sha256 !== expected.sha256) {
        errors.push(`materialized content hash drift: ${file.relativePath}`);
      }
    }
  }

  for (const expected of staged) {
    if (!seenPaths.has(expected.path)) {
      errors.push(`staged manifest path missing from independent inspection: ${expected.path}`);
    }
  }

  return errors;
}

/**
 * Materialize the staged manifest into the isolated workdir and
 * independently inspect every resulting file against the strict
 * `verifyMaterializedTree` contract. Never deletes the tree itself; callers
 * decide cleanup timing.
 */
async function materializeAndVerify(adapters, isolatedWorkdir, staged) {
  if (
    !adapters.materializer ||
    typeof adapters.materializer.writeAll !== 'function' ||
    typeof adapters.materializer.inspectAll !== 'function'
  ) {
    return { ok: false, errors: ['adapters.materializer.writeAll/inspectAll are required'] };
  }

  let materialized;
  try {
    materialized = await adapters.materializer.writeAll(isolatedWorkdir, staged);
  } catch (error) {
    return { ok: false, errors: [`materialization failed: ${errorMessage(error)}`] };
  }
  if (!materialized || materialized.ok !== true) {
    return { ok: false, errors: (materialized && materialized.errors) || ['materialization did not succeed'] };
  }

  let inspected;
  try {
    inspected = await adapters.materializer.inspectAll(isolatedWorkdir);
  } catch (error) {
    return { ok: false, errors: [`inspection failed: ${errorMessage(error)}`] };
  }

  const verifyErrors = verifyMaterializedTree(staged, inspected);
  if (verifyErrors.length > 0) return { ok: false, errors: verifyErrors };
  return { ok: true };
}

/**
 * Delete the isolated materialized tree and fail closed on any cleanup
 * failure or uncertainty instead of swallowing it as best-effort (R1
 * correction item 7). Cleanup may never target, equal, contain, or be
 * contained by the fixed `LEDGER_ROOT` or the caller's `evidenceRoot`; both
 * are re-checked immediately before deletion as a defensive belt-and-braces
 * measure even though `validatePublicInput`/`validateRootIsolation` already
 * enforce this for the roots the isolated workdir is derived from.
 */
async function cleanupIsolatedWorkdir(adapters, isolatedWorkdir, evidenceRoot) {
  if (!pathsDisjoint(isolatedWorkdir, LEDGER_ROOT)) {
    return { ok: false, errors: ['cleanup target must never equal, contain, or be contained by the fixed ledger root'] };
  }
  if (typeof evidenceRoot === 'string' && !pathsDisjoint(isolatedWorkdir, evidenceRoot)) {
    return { ok: false, errors: ['cleanup target must never equal, contain, or be contained by the evidence payload root'] };
  }
  if (!adapters.materializer || typeof adapters.materializer.secureDelete !== 'function') {
    return { ok: false, errors: ['adapters.materializer.secureDelete is required for cleanup'] };
  }
  let deletion;
  try {
    deletion = await adapters.materializer.secureDelete(isolatedWorkdir);
  } catch (error) {
    return { ok: false, errors: [`secure delete failed: ${errorMessage(error)}`] };
  }
  if (!deletion || deletion.ok !== true) {
    return { ok: false, errors: (deletion && deletion.errors) || ['secure delete did not succeed'] };
  }
  return { ok: true };
}

/**
 * Build the exact frozen synthetic exitInfo for a target-identity or
 * execution-readiness mismatch (R3F §9.1/§9.2). Never adds a new field.
 */
function buildFrozenExitInfo(kind) {
  return Object.freeze({
    code: null,
    signal: null,
    promptDetected: false,
    targetMismatch: kind === 'targetMismatch',
    ledgerMismatch: kind === 'ledgerMismatch',
  });
}

/**
 * A synthetic, zero-real-process handle. `onExit` may be registered exactly
 * once: a second registration fails closed (throws) rather than silently
 * scheduling or duplicating delivery (R3F/R1 correction item 7). Delivery is
 * exactly one asynchronous callback invocation; `waitForExit` returns the
 * same frozen exitInfo object; `terminate` resolves `undefined`.
 */
function buildSyntheticHandle(kind) {
  const exitInfo = buildFrozenExitInfo(kind);
  let onExitRegistered = false;
  return {
    onExit(callback) {
      if (typeof callback !== 'function') throw new TypeError('onExit callback must be a function');
      if (onExitRegistered) throw new Error('onExit may only be registered once per handle');
      onExitRegistered = true;
      queueMicrotask(() => callback(exitInfo));
    },
    async terminate() {
      return undefined;
    },
    async waitForExit() {
      return exitInfo;
    },
  };
}

/**
 * Build a synthetic process-adapter override that never spawns a real OS
 * process. `applyOnce` still performs its usual single logical
 * `spawn()`/`onExit()` cycle, but the handle itself is entirely in-memory.
 */
function buildSyntheticProcessAdapters(adapters, kind, trace = null) {
  return {
    ...adapters,
    process: {
      spawn(_executable, argv) {
        if (trace) trace.logicalStages.push(stageFromArgv(argv) || 'unknown');
        return buildSyntheticHandle(kind);
      },
    },
  };
}

function stageFromArgv(argv) {
  if (!Array.isArray(argv)) return null;
  if (argv.includes('list')) return 'list';
  if (argv.includes('up')) return 'up';
  return null;
}

function arraysExactlyEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function envsExactlyEqual(a, b) {
  const left = a && typeof a === 'object' ? a : {};
  const right = b && typeof b === 'object' ? b : {};
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

/**
 * Synchronous pre-launch identity check examining the executable, complete
 * argv (recomputed from the frozen `replay-command-core.mjs` builders so
 * token positions are exact, including the fixed project ref, exact
 * isolated workdir, `--yes` only for up, and `--output-format json`), and
 * options themselves (R1 correction item 2). This never delegates the
 * argv/option-shape check to an opaque adapter call; it is pure and
 * examines only its own arguments.
 */
export function verifyExactPreLaunchIdentity(executable, argv, options, context) {
  if (executable !== 'supabase') return false;
  const stage = stageFromArgv(argv);
  if (stage === null) return false;
  const expected =
    stage === 'list'
      ? buildMigrationListArgv(context.projectRef, context.isolatedWorkdir)
      : buildMigrationUpArgv(context.projectRef, context.isolatedWorkdir);
  if (!expected.ok || !arraysExactlyEqual(argv, expected.argv)) return false;
  if (!options || options.shell !== false) return false;
  if (!envsExactlyEqual(options.env, context.expectedEnv)) return false;
  if (Object.prototype.hasOwnProperty.call(options, 'cwd') && options.cwd !== context.isolatedWorkdir) return false;
  return true;
}

/**
 * Wrap the caller-injected real process adapter so that every possible real
 * OS launch is preceded by (1) a synchronous examination of the executable,
 * argv, and options themselves, then (2) an async re-verification of
 * executable byte identity through `adapters.targetIdentity.verify` (which
 * now receives the full executable/argv/options context, not just
 * projectRef/workdir/repoRoot — R1 correction item 2), and (3) execution
 * readiness. Stage order (list exactly once, then up at most once, strictly
 * after list's exact success) is enforced independently of whatever the
 * frozen core happens to build. Any drift discovered here — including a
 * drift that only appears between the outer pre-lock/pre-burn check and the
 * actual launch (TOCTOU) — produces the exact frozen synthetic exitInfo and
 * launches zero real processes; it never retries, repairs, or replays the
 * request. Wrong, repeated, or out-of-order stages classify as
 * `ledgerMismatch` with the exact `STAGE_ORDER_INVALID` private subtype.
 */
export function buildGuardedRealProcessAdapter(adapters, context) {
  const expectedStages = ['list', 'up'];
  let nextStageIndex = 0;
  let listConfirmedSuccess = false;

  return {
    spawn(executable, argv, options) {
      const stage = stageFromArgv(argv);
      if (typeof context.onLogicalCall === 'function') context.onLogicalCall(stage || 'unknown');
      const expectedStage = expectedStages[nextStageIndex];
      nextStageIndex += 1;

      let orderOk = stage !== null && stage === expectedStage;
      if (stage === 'up' && !listConfirmedSuccess) orderOk = false;

      if (!orderOk) {
        context.onSyntheticSubtype('STAGE_ORDER_INVALID');
        return buildSyntheticHandle('ledgerMismatch');
      }

      const preLaunchIdentityOk = verifyExactPreLaunchIdentity(executable, argv, options, context);

      let outcome = null; // 'target' | 'ledger' | 'real'
      let realHandle = null;
      const readyPromise = (async () => {
        if (!preLaunchIdentityOk) {
          outcome = 'target';
          return;
        }

        let targetCheck;
        try {
          targetCheck = await adapters.targetIdentity.verify({
            executable,
            argv,
            options,
            projectRef: context.projectRef,
            workdir: context.isolatedWorkdir,
            repoRoot: context.repoRoot,
          });
        } catch {
          outcome = 'target';
          return;
        }
        if (!targetCheck || targetCheck.ok !== true) {
          outcome = 'target';
          return;
        }

        let readiness;
        try {
          readiness = await adapters.ledger.checkContinuedOwnership(context.attemptId);
        } catch {
          outcome = 'ledger';
          context.onSyntheticSubtype('ACTIVE_LOCK_INVALID');
          return;
        }
        if (!readiness || readiness.ok !== true) {
          outcome = 'ledger';
          context.onSyntheticSubtype('ACTIVE_LOCK_INVALID');
          return;
        }

        outcome = 'real';
        if (typeof context.onRealLaunch === 'function') context.onRealLaunch(stage || 'unknown');
        realHandle = adapters.process.spawn(executable, argv, options);
      })();

      let onExitRegistered = false;
      return {
        onExit(callback) {
          if (typeof callback !== 'function') throw new TypeError('onExit callback must be a function');
          if (onExitRegistered) throw new Error('onExit may only be registered once per handle');
          onExitRegistered = true;
          readyPromise.then(() => {
            if (outcome === 'real') {
              realHandle.onExit((info) => {
                const clean = info && info.code === 0 && !info.signal && !info.promptDetected && !info.targetMismatch && !info.ledgerMismatch;
                if (stage === 'list' && clean) listConfirmedSuccess = true;
                callback(info);
              });
            } else {
              callback(buildFrozenExitInfo(outcome === 'target' ? 'targetMismatch' : 'ledgerMismatch'));
            }
          });
        },
        async terminate() {
          await readyPromise;
          if (realHandle) return realHandle.terminate();
          return undefined;
        },
        async waitForExit() {
          await readyPromise;
          if (realHandle) return realHandle.waitForExit();
          return buildFrozenExitInfo(outcome === 'target' ? 'targetMismatch' : 'ledgerMismatch');
        },
      };
    },
  };
}

/**
 * Acquire the accepted preflight plan for either mode: fixed Git
 * acquisition, protected metadata, the exact 111/112 batches, and the
 * canonical aggregate, all through the frozen `runPreflight`. Neither mode
 * may bypass this or operate without an accepted plan (R1 correction).
 */
async function acquireAcceptedPlan(adapters, identity, input, isolatedWorkdir, burnedKeys) {
  if (!adapters.git || typeof adapters.git.getRawMigrationEntries !== 'function' || typeof adapters.git.getCanonicalManifest !== 'function') {
    return { ok: false, errors: ['adapters.git.getRawMigrationEntries and getCanonicalManifest are required'] };
  }
  let rawMigrationEntries;
  let canonicalManifest;
  try {
    rawMigrationEntries = await adapters.git.getRawMigrationEntries();
    canonicalManifest = await adapters.git.getCanonicalManifest();
  } catch (error) {
    return { ok: false, errors: [`git adapter failed while acquiring the manifest: ${errorMessage(error)}`] };
  }

  let preflightResult;
  try {
    preflightResult = await runPreflight(
      {
        expectedHead: identity.head,
        expectedTree: identity.tree,
        projectRef: REQUIRED_PROJECT_REF,
        isolatedWorkdir,
        repoRoot: input.repoRoot,
        attemptId: input.attemptId,
        burnedKeys,
        rawMigrationEntries,
        canonicalManifest,
      },
      adapters,
    );
  } catch (error) {
    return { ok: false, errors: [`preflight failed: ${errorMessage(error)}`] };
  }
  if (!preflightResult.ok) return { ok: false, errors: preflightResult.errors };
  return { ok: true, plan: preflightResult.plan };
}

/**
 * `preflight-only`: locally materializes, independently inspects, and
 * deletes one fresh isolated 112-file tree. It never acquires an execution
 * lock, writes a burn record, constructs a linked command, contacts hosted
 * state, or retains hosted evidence.
 *
 * INTERNAL / TEST-ONLY: this function accepts an injected `adapters`
 * object and must never be called from a production entrypoint. Production
 * code must call `runHostedExecutionAdapter(rawInput)` only.
 */
export async function runPreflightOnly(rawInput, adapters) {
  const validated = validatePublicInput(rawInput);
  if (!validated.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: validated.errors };
  const input = validated.value;
  if (input.mode !== 'preflight-only') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['runPreflightOnly requires mode "preflight-only"'] };
  }
  if (!adapters || typeof adapters !== 'object') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['adapters must be an object'] };
  }

  const rootIsolation = await validateRootIsolation(adapters, input);
  if (!rootIsolation.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: rootIsolation.errors };

  let identity;
  try {
    identity = await acquireExecutionIdentity(adapters);
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`identity acquisition failed: ${errorMessage(error)}`] };
  }
  if (!identity.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: identity.errors };

  const burned = await enumerateBurnedKeys(adapters);
  if (!burned.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: burned.errors };

  const isolatedWorkdir = adapters.path.join(input.runtimeRoot, `preflight-${input.attemptId}`);

  const planResult = await acquireAcceptedPlan(adapters, identity, input, isolatedWorkdir, burned.keys);
  if (!planResult.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: planResult.errors };
  const staged = planResult.plan.manifest;

  if (!adapters.materializer || typeof adapters.materializer.secureDelete !== 'function') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['adapters.materializer.secureDelete is required'] };
  }

  const materialization = await materializeAndVerify(adapters, isolatedWorkdir, staged);
  const materializationErrors = materialization.errors || [];

  const cleanup = await cleanupIsolatedWorkdir(adapters, isolatedWorkdir, input.evidenceRoot);
  if (!cleanup.ok) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [...cleanup.errors, ...materializationErrors] };
  }

  if (!materialization.ok) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: materializationErrors };
  }

  return {
    ok: true,
    decision: 'SUCCESS',
    mode: 'preflight-only',
    projectRef: REQUIRED_PROJECT_REF,
    head: identity.head,
    tree: identity.tree,
    stagedCount: staged.length,
    aggregateSha256: planResult.plan.aggregateSha256,
  };
}

/**
 * `execute-once`: present here but not run against a real hosted project by
 * this implementation phase. It must consume the same accepted preflight
 * plan as `preflight-only` (exact Git acquisition, protected metadata,
 * 111/112 batches, canonical aggregate) and independently verify a fresh
 * isolated 112-file materialization before any target/lock/burn/apply step
 * (R1 correction). Target-identity drift and execution-readiness (durable
 * burn/lock/stage-order) drift are mapped to the exact frozen
 * `targetMismatch`/`ledgerMismatch` synthetic outcomes before any real
 * process may launch; only an exact-target, exact-readiness attempt reaches
 * the frozen `apply-once.mjs` core with a guarded real process adapter that
 * revalidates readiness immediately before each possible real launch.
 *
 * INTERNAL / TEST-ONLY: this function accepts an injected `adapters`
 * object and must never be called from a production entrypoint. Production
 * code must call `runHostedExecutionAdapter(rawInput)` only.
 */
export async function runExecuteOnce(rawInput, adapters) {
  const validated = validatePublicInput(rawInput);
  if (!validated.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: validated.errors };
  const input = validated.value;
  if (input.mode !== 'execute-once') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['runExecuteOnce requires mode "execute-once"'] };
  }
  if (input.confirmation !== CONFIRMATION_TOKEN) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['execute-once requires the exact confirmation token'] };
  }
  if (!adapters || typeof adapters !== 'object') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['adapters must be an object'] };
  }

  const rootIsolation = await validateRootIsolation(adapters, input);
  if (!rootIsolation.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: rootIsolation.errors };

  let identity;
  try {
    identity = await acquireExecutionIdentity(adapters);
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`identity acquisition failed: ${errorMessage(error)}`] };
  }
  if (!identity.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: identity.errors };

  const burned = await enumerateBurnedKeys(adapters);
  if (!burned.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: burned.errors };

  const alreadyBurned = coreIsBurned(burned.keys, REQUIRED_PROJECT_REF, input.attemptId);
  if (!alreadyBurned.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: alreadyBurned.errors };
  if (alreadyBurned.burned) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['attempt id is already burned and can never be reused'] };
  }

  if (!adapters.targetIdentity || typeof adapters.targetIdentity.verify !== 'function') {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: ['adapters.targetIdentity.verify is required'] };
  }
  if (
    !adapters.ledger ||
    typeof adapters.ledger.acquireLock !== 'function' ||
    typeof adapters.ledger.durableBurn !== 'function' ||
    typeof adapters.ledger.releaseLock !== 'function' ||
    typeof adapters.ledger.checkContinuedOwnership !== 'function'
  ) {
    return {
      ok: false,
      decision: 'QUARANTINE_NO_RETRY',
      errors: ['adapters.ledger.acquireLock, durableBurn, releaseLock, and checkContinuedOwnership are required'],
    };
  }

  const isolatedWorkdir = adapters.path.join(input.runtimeRoot, `execute-${input.attemptId}`);

  const planResult = await acquireAcceptedPlan(adapters, identity, input, isolatedWorkdir, burned.keys);
  if (!planResult.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: planResult.errors };
  const staged = planResult.plan.manifest;
  const applyPlan = { projectRef: REQUIRED_PROJECT_REF, isolatedWorkdir, sanitizedAmbientEnvironment: planResult.plan.sanitizedAmbientEnvironment };

  const materialization = await materializeAndVerify(adapters, isolatedWorkdir, staged);
  if (!materialization.ok) {
    const earlyCleanup = await cleanupIsolatedWorkdir(adapters, isolatedWorkdir, input.evidenceRoot);
    const errors = earlyCleanup.ok ? materialization.errors : [...materialization.errors, ...earlyCleanup.errors];
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors };
  }

  if (typeof adapters.process.configure === 'function') {
    adapters.process.configure(staged);
  }
  const trace = { logicalStages: [], realStages: [] };

  // From this point the isolated tree exists and must be cleaned up (proven
  // disjoint from LEDGER_ROOT by the earlier root-isolation check) on every
  // exit path below. A cleanup failure fails the overall result closed
  // rather than being swallowed as best-effort (R1 correction item 7).
  const finalize = async (result) => {
    const cleanup = await cleanupIsolatedWorkdir(adapters, isolatedWorkdir, input.evidenceRoot);
    if (!cleanup.ok) {
      return { ...result, ok: false, decision: 'QUARANTINE_NO_RETRY', cleanupErrors: cleanup.errors };
    }
    return result;
  };

  const finishWithEvidence = async (result, details, releaseAfterEvidence = false) => {
    const finalized = await finalizeExecutionEvidence(adapters, input, {
      ...details,
      trace,
      applyResult: result.applyResult,
      reason: result.reason,
      subtype: result.subtype,
    });
    if (!finalized.ok) {
      return finalize({
        ...result,
        ok: false,
        decision: 'QUARANTINE_NO_RETRY',
        errors: finalized.errors,
        evidenceResult: finalized.evidenceResult,
      });
    }
    if (releaseAfterEvidence) {
      const release = await releaseLockStrict(adapters);
      if (!release.ok) {
        return finalize({
          ...result,
          ok: false,
          decision: 'QUARANTINE_NO_RETRY',
          errors: release.errors,
          evidenceResult: finalized.evidenceResult,
        });
      }
    }
    return finalize({ ...result, evidenceResult: finalized.evidenceResult });
  };

  let targetCheck;
  try {
    targetCheck = await adapters.targetIdentity.verify({
      projectRef: REQUIRED_PROJECT_REF,
      workdir: isolatedWorkdir,
      repoRoot: input.repoRoot,
    });
  } catch (error) {
    const syntheticAdapters = buildSyntheticProcessAdapters(adapters, 'targetMismatch', trace);
    const applyResult = await applyOnce(applyPlan, syntheticAdapters);
    return finishWithEvidence(
      { ok: false, decision: applyResult.decision, reason: 'target_mismatch', subtype: 'TARGET_CHECK_EXCEPTION', applyResult },
      { targetVerified: false, lockAcquired: false, burnRecorded: false, ledgerVerified: false },
    );
  }

  if (!targetCheck || targetCheck.ok !== true) {
    const syntheticAdapters = buildSyntheticProcessAdapters(adapters, 'targetMismatch', trace);
    const applyResult = await applyOnce(applyPlan, syntheticAdapters);
    return finishWithEvidence(
      { ok: false, decision: applyResult.decision, reason: 'target_mismatch', applyResult },
      { targetVerified: false, lockAcquired: false, burnRecorded: false, ledgerVerified: false },
    );
  }

  let lockResult;
  try {
    lockResult = await adapters.ledger.acquireLock(input.attemptId);
  } catch (error) {
    const syntheticAdapters = buildSyntheticProcessAdapters(adapters, 'ledgerMismatch', trace);
    const applyResult = await applyOnce(applyPlan, syntheticAdapters);
    return finishWithEvidence(
      { ok: false, decision: applyResult.decision, reason: 'ledger_mismatch', subtype: 'ACTIVE_LOCK_EXCEPTION', applyResult },
      { targetVerified: true, lockAcquired: false, burnRecorded: false, ledgerVerified: false },
    );
  }
  if (!verifyLockAcquisitionResult(lockResult, input.attemptId)) {
    const syntheticAdapters = buildSyntheticProcessAdapters(adapters, 'ledgerMismatch', trace);
    const applyResult = await applyOnce(applyPlan, syntheticAdapters);
    return finishWithEvidence(
      { ok: false, decision: applyResult.decision, reason: 'ledger_mismatch', subtype: 'ACTIVE_LOCK_INVALID', applyResult },
      { targetVerified: true, lockAcquired: false, burnRecorded: false, ledgerVerified: false },
    );
  }

  let burnResult;
  try {
    burnResult = await adapters.ledger.durableBurn(input.attemptId);
  } catch (error) {
    // An uncertain/exceptional burn attempt leaves the lock unreleased: a
    // fail-closed stale lock that is never auto-recovered here.
    const syntheticAdapters = buildSyntheticProcessAdapters(adapters, 'ledgerMismatch', trace);
    const applyResult = await applyOnce(applyPlan, syntheticAdapters);
    return finishWithEvidence(
      { ok: false, decision: applyResult.decision, reason: 'ledger_mismatch', subtype: 'BURN_RECORD_EXCEPTION', applyResult },
      { targetVerified: true, lockAcquired: true, burnRecorded: false, ledgerVerified: false },
    );
  }
  if (!verifyDurableBurnResult(burnResult, input.attemptId)) {
    // R1 correction item 5: an uncertain/invalid burn result (including a
    // resolved-but-tampered `{ ok: true }`, EEXIST, or any other partial
    // outcome) must never release the lock. The attempt remains permanently
    // burned/uncertain and the active lock stays held fail-closed with no
    // automatic release, deletion, repair, overwrite, or retry.
    const syntheticAdapters = buildSyntheticProcessAdapters(adapters, 'ledgerMismatch', trace);
    const applyResult = await applyOnce(applyPlan, syntheticAdapters);
    return finishWithEvidence(
      { ok: false, decision: applyResult.decision, reason: 'ledger_mismatch', subtype: 'BURN_RECORD_INVALID', applyResult },
      { targetVerified: true, lockAcquired: true, burnRecorded: false, ledgerVerified: false },
    );
  }

  const subtypeHolder = { value: null };
  const guardedAdapters = {
    ...adapters,
    process: buildGuardedRealProcessAdapter(adapters, {
      projectRef: REQUIRED_PROJECT_REF,
      isolatedWorkdir,
      repoRoot: input.repoRoot,
      attemptId: input.attemptId,
      expectedEnv: planResult.plan.sanitizedAmbientEnvironment || {},
      onSyntheticSubtype: (subtype) => {
        subtypeHolder.value = subtype;
      },
      onLogicalCall: (stage) => trace.logicalStages.push(stage),
      onRealLaunch: (stage) => trace.realStages.push(stage),
    }),
  };

  let applyResult;
  try {
    applyResult = await applyOnce(applyPlan, guardedAdapters);
  } catch (error) {
    applyResult = { ok: false, decision: 'QUARANTINE_NO_RETRY', reason: 'apply_invocation_failed' };
    return finishWithEvidence(
      { ok: false, decision: 'QUARANTINE_NO_RETRY', reason: 'apply_invocation_failed', errors: [`apply-once invocation failed: ${errorMessage(error)}`], applyResult },
      { targetVerified: true, lockAcquired: true, burnRecorded: true, ledgerVerified: true },
    );
  }

  const finalResult = {
    ok: applyResult.ok === true,
    decision: applyResult.decision,
    mode: 'execute-once',
    projectRef: REQUIRED_PROJECT_REF,
    head: identity.head,
    tree: identity.tree,
    applyResult,
  };
  if (subtypeHolder.value) finalResult.subtype = subtypeHolder.value;
  return finishWithEvidence(
    finalResult,
    { targetVerified: true, lockAcquired: true, burnRecorded: true, ledgerVerified: true },
    true,
  );
}

// ---------------------------------------------------------------------------
// Concrete production adapters (R1 correction items 1, 2, 3, 6). These are
// the only adapters `runHostedExecutionAdapter` ever wires; none of their
// function bodies execute merely by importing this module, and a production
// caller can never reach, inject, or override them.
// ---------------------------------------------------------------------------

function runGitSync(repoRoot, args, options = {}) {
  return execFileSync(GIT_EXECUTABLE, args, {
    cwd: repoRoot,
    shell: false,
    stdio: [options.input !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    input: options.input,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    env: GIT_FIXED_ENV,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
  });
}

export function parseLsTreeZ(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || !raw.endsWith('\0')) {
    throw new Error('ls-tree -z output must be a non-empty string with one final NUL terminator');
  }
  const records = raw.slice(0, -1).split('\0');
  if (records.some((record) => record.length === 0)) throw new Error('ls-tree -z output contains an empty record');
  return records.map((record, index) => {
    const tabIndex = record.indexOf('\t');
    if (tabIndex <= 0 || record.indexOf('\t', tabIndex + 1) !== -1) {
      throw new Error(`ls-tree -z record ${index} must contain exactly one metadata/path tab`);
    }
    const match = /^([0-7]{6}) (blob|tree) ([0-9a-f]{40})$/.exec(record.slice(0, tabIndex));
    if (!match) throw new Error(`ls-tree -z record ${index} has invalid metadata framing`);
    const path = record.slice(tabIndex + 1);
    if (path.length === 0) throw new Error(`ls-tree -z record ${index} has an empty path`);
    return { path, mode: match[1], type: match[2], blob: match[3] };
  });
}

export function parseCatFileBatch(buffer, expectedBlobOrder) {
  if (!Buffer.isBuffer(buffer)) throw new Error('cat-file --batch output must be a Buffer');
  const hashes = new Map();
  let offset = 0;
  for (const expectedBlob of expectedBlobOrder) {
    const headerEnd = buffer.indexOf(0x0a, offset);
    if (headerEnd < 0) throw new Error(`cat-file --batch is missing a header LF for ${expectedBlob}`);
    const header = buffer.slice(offset, headerEnd).toString('utf8');
    const match = /^([0-9a-f]{40}) blob ([0-9]+)$/.exec(header);
    if (!match || match[1] !== expectedBlob) throw new Error(`cat-file --batch header drift for ${expectedBlob}`);
    const size = Number.parseInt(match[2], 10);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`cat-file --batch size drift for ${expectedBlob}`);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= buffer.length || buffer[contentEnd] !== 0x0a) {
      throw new Error(`cat-file --batch content framing drift for ${expectedBlob}`);
    }
    const content = buffer.slice(contentStart, contentEnd);
    hashes.set(expectedBlob, createHash('sha256').update(content).digest('hex'));
    offset = contentEnd + 1;
  }
  if (offset !== buffer.length) throw new Error('cat-file --batch output contains trailing or extra bytes');
  return hashes;
}

function byteSorted(paths) {
  return [...paths].sort((a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')));
}

export function validateAndHashMigrationTree(repoRoot, commit, expectedTree = null) {
  if (typeof commit !== 'string' || !/^(?:HEAD|[0-9a-f]{40})$/.test(commit)) {
    throw new Error('migration authority commit must be HEAD or a fixed 40-character commit id');
  }
  const observedTree = runGitSync(repoRoot, ['rev-parse', `${commit}^{tree}`]).trim();
  if (!/^[0-9a-f]{40}$/.test(observedTree)) throw new Error('migration authority tree id is malformed');
  if (expectedTree !== null && observedTree !== expectedTree) throw new Error('fixed governance tree identity mismatch');

  const raw = runGitSync(repoRoot, ['ls-tree', '-z', commit, '--', 'supabase/migrations/']);
  const entries = parseLsTreeZ(raw);
  if (entries.length !== REQUIRED_FORMAL_MIGRATION_COUNT + 1) {
    throw new Error(`migration tree must contain exactly ${REQUIRED_FORMAL_MIGRATION_COUNT} SQL blobs plus one draft tree`);
  }
  const paths = entries.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) throw new Error('migration tree contains duplicate paths');
  const sortedPaths = byteSorted(paths);
  if (!paths.every((path, index) => path === sortedPaths[index])) throw new Error('migration tree is not in canonical byte order');

  const draftEntries = entries.filter((entry) => entry.path === DRAFT_MIGRATION_TREE_PATH);
  if (
    draftEntries.length !== 1 ||
    draftEntries[0].mode !== '040000' ||
    draftEntries[0].type !== 'tree' ||
    draftEntries[0].blob !== DRAFT_MIGRATION_TREE_BLOB
  ) {
    throw new Error('DRAFT_DO_NOT_APPLY tree identity mismatch');
  }

  const sqlEntries = entries.filter((entry) => entry.path !== DRAFT_MIGRATION_TREE_PATH);
  if (sqlEntries.length !== REQUIRED_FORMAL_MIGRATION_COUNT) throw new Error('formal top-level SQL count mismatch');
  for (const entry of sqlEntries) {
    const basename = entry.path.startsWith(MIGRATIONS_DIR_PREFIX)
      ? entry.path.slice(MIGRATIONS_DIR_PREFIX.length)
      : '';
    if (
      entry.type !== 'blob' ||
      entry.mode !== REQUIRED_ENTRY_MODE ||
      basename.length === 0 ||
      basename.includes('/') ||
      !OBSERVED_MIGRATION_BASENAME_PATTERN.test(basename)
    ) {
      throw new Error(`invalid top-level migration entry: ${entry.path}`);
    }
  }

  const protectedLine = sqlEntries.find((entry) => entry.path === PROTECTED_LINE_MIGRATION_PATH);
  const protectedMonthly = sqlEntries.find((entry) => entry.path === MONTHLY_INVOICE_MIGRATION_PATH);
  if (
    !protectedLine ||
    protectedLine.mode !== PROTECTED_LINE_MIGRATION_MODE ||
    protectedLine.blob !== PROTECTED_LINE_MIGRATION_BLOB
  ) {
    throw new Error('protected LINE migration metadata mismatch');
  }
  if (
    !protectedMonthly ||
    protectedMonthly.mode !== MONTHLY_INVOICE_MIGRATION_MODE ||
    protectedMonthly.blob !== MONTHLY_INVOICE_MIGRATION_BLOB
  ) {
    throw new Error('protected monthly migration metadata mismatch');
  }

  const protectedPaths = new Set([PROTECTED_LINE_MIGRATION_PATH, MONTHLY_INVOICE_MIGRATION_PATH]);
  const ordinary = sqlEntries.filter((entry) => !protectedPaths.has(entry.path));
  if (ordinary.length !== 111) throw new Error('ordinary migration blob count must be exactly 111');
  const batchInput = `${ordinary.map((entry) => entry.blob).join('\n')}\n`;
  const batchOutput = runGitSync(repoRoot, ['cat-file', '--batch'], {
    input: batchInput,
    encoding: null,
  });
  const hashes = parseCatFileBatch(batchOutput, ordinary.map((entry) => entry.blob));
  const manifest = sqlEntries.map((entry) => ({
    path: entry.path,
    mode: entry.mode,
    blob: entry.blob,
    sha256: protectedPaths.has(entry.path) ? null : hashes.get(entry.blob),
  }));
  const staged = manifest.filter((entry) => entry.path !== PROTECTED_LINE_MIGRATION_PATH);
  if (
    staged.length !== REQUIRED_STAGED_MIGRATION_COUNT ||
    computeAggregateManifestHash(staged) !== EXPECTED_AGGREGATE_MANIFEST_SHA256
  ) {
    throw new Error('migration authority aggregate mismatch');
  }
  return manifest;
}

/** Concrete Git adapter wired to the real `/usr/bin/git` executable with
 * argument arrays, `shell:false`, closed stdin (except the exact
 * `cat-file --batch` call), a fixed sanitized environment, and byte/time
 * ceilings (R3F §5). PR facts are deliberately pinned offline governance
 * literals. This adapter contains no GitHub client and performs no hosted
 * lookup during public preflight. */
export function createGitCliAdapter(repoRoot) {
  return {
    async getHead() {
      return runGitSync(repoRoot, ['rev-parse', 'HEAD']).trim();
    },
    async getTree() {
      return runGitSync(repoRoot, ['rev-parse', 'HEAD^{tree}']).trim();
    },
    async getTreeForCommit(commit) {
      return runGitSync(repoRoot, ['rev-parse', `${commit}^{tree}`]).trim();
    },
    async getBranch() {
      return runGitSync(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    },
    async getStatus() {
      return runGitSync(repoRoot, ['status', '--porcelain']).trim();
    },
    async getUpstreamAheadBehind() {
      let raw;
      try {
        raw = runGitSync(repoRoot, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']).trim();
      } catch (error) {
        return { ahead: 0, behind: 0, uncertain: true, detail: errorMessage(error) };
      }
      const [behind, ahead] = raw.split(/\s+/).map((value) => Number.parseInt(value, 10));
      return { ahead, behind };
    },
    async getPullRequest() {
      return {
        number: REQUIRED_PR_NUMBER,
        state: REQUIRED_PR_STATE,
        draft: REQUIRED_PR_DRAFT === 'true',
        base: REQUIRED_PR_BASE,
        branch: REQUIRED_BRANCH,
        source: 'pinned_governance_literal',
      };
    },
    async getParents(commit) {
      const raw = runGitSync(repoRoot, ['rev-list', '--parents', '-n', '1', commit]).trim();
      return raw.split(/\s+/).slice(1);
    },
    async getChangedPathsFromParent(parentCommit) {
      const raw = runGitSync(repoRoot, ['diff', '--name-only', `${parentCommit}..HEAD`]).trim();
      return raw.length === 0 ? [] : raw.split('\n');
    },
    async getProtectedPathMetadata(paths) {
      const raw = runGitSync(repoRoot, ['ls-tree', '-z', 'HEAD', '--', ...paths]);
      return parseLsTreeZ(raw).map(({ path, mode, blob }) => ({ path, mode, blob }));
    },
    async getRawMigrationEntries() {
      return validateAndHashMigrationTree(repoRoot, 'HEAD');
    },
    async getCanonicalManifest() {
      return validateAndHashMigrationTree(repoRoot, CANONICAL_GOVERNANCE_COMMIT, CANONICAL_GOVERNANCE_TREE);
    },
  };
}

/** Concrete no-follow filesystem path inspector used for root isolation
 * (R1 correction item 6). Walks every path component with `lstat` so a
 * symlink anywhere in the chain is detected rather than silently
 * followed. */
export function createFsPathInspector() {
  const inspectPathNoFollow = async (candidatePath) => {
    const segments = candidatePath.split('/').filter((segment) => segment.length > 0);
    let current = '';
    for (let index = 0; index < segments.length; index += 1) {
      current += `/${segments[index]}`;
      const isLeaf = index === segments.length - 1;
      let stat;
      try {
        stat = lstatSync(current);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return { exists: false, hasSymlinkComponent: false, ownedByEffectiveUid: true, real: candidatePath };
        }
        throw error;
      }
      if (stat.isSymbolicLink()) {
        return { exists: true, hasSymlinkComponent: true, ownedByEffectiveUid: false, real: candidatePath };
      }
      if (isLeaf) {
        return {
          exists: true,
          hasSymlinkComponent: false,
          ownedByEffectiveUid: stat.uid === process.geteuid(),
          real: realpathSync(candidatePath),
          device: stat.dev,
        };
      }
    }
    return { exists: false, hasSymlinkComponent: false, ownedByEffectiveUid: true, real: candidatePath };
  };

  return {
    inspectPathNoFollow,
    async realpath(candidatePath) {
      const inspection = await inspectPathNoFollow(candidatePath);
      if (inspection.hasSymlinkComponent === true) {
        throw new Error('cannot canonicalize a path containing a symlink component');
      }
      if (inspection.exists === true) {
        if (typeof inspection.real !== 'string' || inspection.real.length === 0) {
          throw new Error('existing path inspection did not return a canonical path');
        }
        return inspection.real;
      }
      // A fresh isolated workdir intentionally does not exist until the
      // materializer creates it. All existing ancestors were already walked
      // with lstat above, so preserving the validated absolute spelling is
      // safe and lets preflight reject aliases before materialization.
      return candidatePath;
    },
  };
}

const LEDGER_DIR_MODE = 0o700;
const OWNER_FILE_MODE = 0o600;
const BURN_FILE_MODE = 0o600;

function fsyncPathSync(path) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Concrete durable burn-ledger and execution-lock adapter implementing the
 * fixed no-follow path checks, exact owner record, O_EXCL/O_NOFOLLOW burn
 * file, full write, file fsync, close, no-follow read-back, directory
 * fsync, and exact release fsync ordering using real `node:fs` operations
 * (R3F §8, R1 correction item 6). Accepts `ledgerRoot`/`projectRef` so the
 * production factory can wire the fixed internal `LEDGER_ROOT`, while this
 * module's own tests can independently exercise the identical logic against
 * a disposable temporary directory. */
export function createFsLedgerAdapter(ledgerRoot, projectRef) {
  const projectDir = joinPath(ledgerRoot, projectRef);
  const activeLockPath = joinPath(projectDir, 'active.lock');
  const ownerFilePath = joinPath(activeLockPath, 'attempt');

  function ensureLedgerDirs() {
    for (const dir of [ledgerRoot, projectDir]) {
      try {
        mkdirSync(dir, { recursive: false, mode: LEDGER_DIR_MODE });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  }

  return {
    async listBurnRecords() {
      let entries;
      try {
        entries = readdirSync(projectDir);
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
      const records = [];
      let expectedDevice;
      for (const name of entries) {
        if (name === 'active.lock') continue;
        const match = /^(.+)\.burn$/.exec(name);
        const full = joinPath(projectDir, name);
        let stat;
        try {
          stat = lstatSync(full);
        } catch {
          records.push({ type: 'unknown' });
          continue;
        }
        if (!match || !stat.isFile() || stat.isSymbolicLink()) {
          records.push({ type: 'unknown' });
          continue;
        }
        if (expectedDevice === undefined) expectedDevice = stat.dev;
        const content = readFileSync(full, 'utf8');
        records.push({
          type: 'regular',
          mode: (stat.mode & 0o777) === OWNER_FILE_MODE ? '0600' : 'wrong',
          ownedByEffectiveUid: stat.uid === process.geteuid(),
          linkCount: stat.nlink,
          attemptId: match[1],
          content,
          device: stat.dev === expectedDevice ? expectedDevice : stat.dev,
        });
      }
      return records;
    },
    async acquireLock(attemptId) {
      ensureLedgerDirs();
      try {
        mkdirSync(activeLockPath, { recursive: false, mode: LEDGER_DIR_MODE });
      } catch (error) {
        return { ok: false, reason: error.code === 'EEXIST' ? 'active_lock_owned_by_other_attempt' : `mkdir_failed:${error.code}` };
      }
      try {
        writeFileSync(ownerFilePath, `${attemptId}\n`, { mode: OWNER_FILE_MODE, flag: 'wx' });
        fsyncPathSync(ownerFilePath);
        fsyncPathSync(activeLockPath);
        const ownerStat = lstatSync(ownerFilePath);
        const lockStat = lstatSync(activeLockPath);
        return {
          ok: true,
          ownerRecord: {
            attemptId,
            lockDirMode: (lockStat.mode & 0o777) === LEDGER_DIR_MODE ? '0700' : 'wrong',
            ownerFileMode: (ownerStat.mode & 0o777) === OWNER_FILE_MODE ? '0600' : 'wrong',
            ownedByEffectiveUid: ownerStat.uid === process.geteuid(),
            linkCount: ownerStat.nlink,
            ownerFileFsynced: true,
            lockDirFsynced: true,
          },
        };
      } catch (error) {
        return { ok: false, reason: `owner_record_write_failed:${error.code || errorMessage(error)}` };
      }
    },
    async durableBurn(attemptId) {
      ensureLedgerDirs();
      const burnPath = joinPath(projectDir, `${attemptId}.burn`);
      const content = buildCanonicalBurnRecord(attemptId);
      const buffer = Buffer.from(content, 'utf8');
      const fd = openSync(burnPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, BURN_FILE_MODE);
      try {
        const written = writeSync(fd, buffer, 0, buffer.length, 0);
        if (written !== buffer.length) throw new Error('short write while creating the durable burn record');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      let readBackContent;
      const readFd = openSync(burnPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      try {
        const readBuffer = Buffer.alloc(buffer.length + 1);
        const bytesRead = readSync(readFd, readBuffer, 0, readBuffer.length, 0);
        readBackContent = readBuffer.slice(0, bytesRead).toString('utf8');
      } finally {
        closeSync(readFd);
      }
      fsyncPathSync(projectDir);
      const stat = lstatSync(burnPath);
      return {
        ok: true,
        record: {
          attemptId,
          content: readBackContent,
          mode: (stat.mode & 0o777) === BURN_FILE_MODE ? '0600' : 'wrong',
          type: stat.isFile() && !stat.isSymbolicLink() ? 'regular' : 'wrong',
          ownedByEffectiveUid: stat.uid === process.geteuid(),
          linkCount: stat.nlink,
          createdExclusiveNoFollow: true,
          fileFsynced: true,
          readBackVerified: readBackContent === content,
          directoryFsynced: true,
        },
      };
    },
    async releaseLock() {
      try {
        unlinkSync(ownerFilePath);
        fsyncPathSync(activeLockPath);
        rmdirSync(activeLockPath);
        fsyncPathSync(projectDir);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: `release_failed:${error.code || errorMessage(error)}` };
      }
    },
    async checkContinuedOwnership(attemptId) {
      try {
        const content = readFileSync(ownerFilePath, 'utf8');
        return { ok: content === `${attemptId}\n` };
      } catch {
        return { ok: false };
      }
    },
  };
}

/** Concrete target-identity adapter: verifies the fixed Supabase executable
 * is a regular, non-symlink file and records its SHA-256 on first use,
 * requiring byte-for-byte identity on every subsequent call within the same
 * process lifetime (R1 correction item 2). */
export function createConcreteTargetIdentityAdapter() {
  let recordedSha256 = null;
  return {
    async verify({ projectRef, workdir, repoRoot }) {
      if (projectRef !== REQUIRED_PROJECT_REF) return { ok: false };
      if (typeof workdir === 'string' && typeof repoRoot === 'string' && workdir === repoRoot) return { ok: false };
      let stat;
      try {
        stat = lstatSync(FIXED_SUPABASE_EXECUTABLE);
      } catch {
        return { ok: false };
      }
      if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false };
      const sha256 = createHash('sha256').update(readFileSync(FIXED_SUPABASE_EXECUTABLE)).digest('hex');
      if (recordedSha256 === null) {
        recordedSha256 = sha256;
      } else if (recordedSha256 !== sha256) {
        return { ok: false };
      }
      return { ok: true, sha256 };
    },
  };
}

/** Concrete materializer using `git cat-file --batch` (closed stdin except
 * this exact batch call) to write the isolated tree, then independently
 * inspecting every resulting file with `lstat`/`realpath` (R1 correction
 * item 6). */
export function createConcreteMaterializer(repoRoot) {
  return {
    async writeAll(workdir, staged) {
      try {
        mkdirSync(workdir, { recursive: true, mode: 0o700 });
        const batchInput = `${staged.map((entry) => entry.blob).join('\n')}\n`;
        const raw = runGitSync(repoRoot, ['cat-file', '--batch'], {
          input: batchInput,
          encoding: null,
        });
        let offset = 0;
        for (const entry of staged) {
          const headerEnd = raw.indexOf(0x0a, offset);
          const header = raw.slice(offset, headerEnd).toString('utf8');
          const [, , sizeStr] = header.split(' ');
          const size = Number.parseInt(sizeStr, 10);
          const contentStart = headerEnd + 1;
          const content = raw.slice(contentStart, contentStart + size);
          const destination = joinPath(workdir, entry.path);
          mkdirSync(destination.slice(0, destination.lastIndexOf('/')), { recursive: true, mode: 0o700 });
          writeFileSync(destination, content, { mode: 0o644 });
          offset = contentStart + size + 1;
        }
        return { ok: true, count: staged.length };
      } catch (error) {
        return { ok: false, errors: [errorMessage(error)] };
      }
    },
    async inspectAll(workdir) {
      const files = [];
      const walk = (dir, prefix) => {
        for (const name of readdirSync(dir)) {
          const full = joinPath(dir, name);
          const relative = prefix ? `${prefix}/${name}` : name;
          const stat = lstatSync(full);
          if (stat.isDirectory()) {
            walk(full, relative);
            continue;
          }
          files.push({
            relativePath: relative,
            absolutePath: full,
            canonicalPath: stat.isSymbolicLink() ? full : realpathSync(full),
            mode: (stat.mode & 0o777) === 0o644 ? REQUIRED_ENTRY_MODE : 'wrong',
            isRegular: stat.isFile(),
            isSymlink: stat.isSymbolicLink(),
            ownedByEffectiveUid: stat.uid === process.geteuid(),
            linkCount: stat.nlink,
            device: stat.dev,
            sha256: stat.isFile() && !stat.isSymbolicLink() ? createHash('sha256').update(readFileSync(full)).digest('hex') : null,
          });
        }
      };
      try {
        walk(workdir, '');
      } catch {
        return { files: [] };
      }
      return { files };
    },
    async secureDelete(workdir) {
      try {
        rmSync(workdir, { recursive: true, force: true });
        return { ok: true };
      } catch (error) {
        return { ok: false, errors: [errorMessage(error)] };
      }
    },
  };
}

/** Concrete evidence adapter: retained artifacts are written strictly below
 * the validated canonical `evidenceRoot` (R1 correction item 4); nothing is
 * adapter-selected elsewhere. */
export function createConcreteEvidenceAdapter(evidenceRoot) {
  const volatileDir = joinPath(evidenceRoot, 'volatile');
  const retentionDir = joinPath(evidenceRoot, 'retained');
  const rawArtifacts = [];
  function ensureDir(dir) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stat = lstatSync(dir);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.geteuid() ||
      (stat.mode & 0o777) !== 0o700
    ) {
      throw new Error('evidence directory identity or mode mismatch');
    }
  }
  function readRegular0600NoFollow(path) {
    const before = lstatSync(path);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.uid !== process.geteuid() ||
      (before.mode & 0o777) !== 0o600
    ) {
      throw new Error('evidence file identity or mode mismatch');
    }
    const fd = openSync(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    try {
      const opened = fstatSync(fd);
      if (opened.dev !== before.dev || opened.ino !== before.ino || !opened.isFile() || opened.nlink !== 1) {
        throw new Error('evidence file changed during no-follow open');
      }
      return readFileSync(fd, 'utf8');
    } finally {
      closeSync(fd);
    }
  }
  return {
    rawArtifacts,
    async recordExecutionSummary(name, summary) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) {
        return { ok: false, errors: ['unsafe evidence summary identifier'] };
      }
      const text = `${JSON.stringify(summary)}\n`;
      const destination = joinPath(volatileDir, name);
      let fd;
      try {
        ensureDir(volatileDir);
        fd = openSync(
          destination,
          fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
          0o600,
        );
        const bytes = Buffer.from(text, 'utf8');
        let written = 0;
        while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written);
        fsyncSync(fd);
        closeSync(fd);
        fd = undefined;
        const stat = lstatSync(destination);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600) {
          return { ok: false, errors: ['evidence summary file identity or mode mismatch'] };
        }
        if (readRegular0600NoFollow(destination) !== text) {
          return { ok: false, errors: ['evidence summary read-back mismatch'] };
        }
        rawArtifacts.push({ name });
        return { ok: true, name, mode: '0600' };
      } catch (error) {
        if (fd !== undefined) {
          try {
            closeSync(fd);
          } catch {
            // The primary write failure remains the fail-closed result.
          }
        }
        return { ok: false, errors: [errorMessage(error)] };
      }
    },
    volatile: {
      read: async (name) => readRegular0600NoFollow(joinPath(volatileDir, name)),
    },
    retention: {
      write: async (name, text) => {
        ensureDir(retentionDir);
        const destination = joinPath(retentionDir, name);
        const fd = openSync(
          destination,
          fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
          0o600,
        );
        try {
          const bytes = Buffer.from(text, 'utf8');
          let written = 0;
          while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
      },
      read: async (name) => readRegular0600NoFollow(joinPath(retentionDir, name)),
    },
    hashing: {
      hash: async (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
    },
    deletion: {
      deleteRaw: async (name) => {
        try {
          unlinkSync(joinPath(volatileDir, name));
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      },
    },
  };
}

function migrationTimeAggregateRowDigest(entry) {
  return entry.path === MONTHLY_INVOICE_MIGRATION_PATH ? MONTHLY_INVOICE_ATTESTED_DIGEST : entry.sha256;
}

/** The injected pure aggregate-hash authority (R3F §5): concatenate the
 * exact `<64 lowercase hex sha256><two spaces><path><LF>` rows in the
 * supplied order and SHA-256 the result. The monthly row uses only its
 * fixed attested digest; the frozen `manifest-core.mjs` contract already
 * enforces that this entry's own `sha256` field stays `null`. */
export function computeAggregateManifestHash(staged) {
  const rows = staged.map((entry) => `${migrationTimeAggregateRowDigest(entry)}  ${entry.path}\n`);
  return createHash('sha256').update(rows.join(''), 'utf8').digest('hex');
}

/** Real process adapter performing the exact CLI byte mapping (R3F §7,
 * R1 correction item 3): closed stdin, bounded stdout/stderr collectors with
 * streaming prompt detection (chunk overlap), and strict list/up JSON+stderr
 * validation. `configure(staged)` must be called with the accepted staged
 * manifest before any real launch so output can be validated against it;
 * `runExecuteOnce` does this automatically once the manifest is known. */
export function createRealSupabaseProcessAdapter() {
  let staged = null;
  const executionMetadata = [];
  return {
    configure(newStaged) {
      staged = newStaged;
    },
    spawn(executable, argv, options) {
      const stage = stageFromArgv(argv);
      const workdirIndex = argv.indexOf('--workdir');
      const isolatedWorkdir = workdirIndex >= 0 ? argv[workdirIndex + 1] : undefined;

      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let truncated = false;
      let promptDetected = false;
      const stdoutScanner = createPromptScanner();
      const stderrScanner = createPromptScanner();

      const child = spawnRealProcess(FIXED_SUPABASE_EXECUTABLE, argv, {
        cwd: isolatedWorkdir,
        env: options.env || {},
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (chunk) => {
        if (stdout.length + chunk.length > STDOUT_BYTE_CEILING) {
          truncated = true;
          child.kill('SIGKILL');
          return;
        }
        stdout = Buffer.concat([stdout, chunk]);
        if (stdoutScanner.push(chunk.toString('utf8'))) promptDetected = true;
      });
      child.stderr.on('data', (chunk) => {
        if (stderr.length + chunk.length > STDERR_BYTE_CEILING) {
          truncated = true;
          child.kill('SIGKILL');
          return;
        }
        stderr = Buffer.concat([stderr, chunk]);
        if (stderrScanner.push(chunk.toString('utf8'))) promptDetected = true;
      });

      let exitInfo = null;
      let exitCallback = null;
      let onExitRegistered = false;
      let delivered = false;

      const deliver = (info) => {
        if (delivered) return;
        delivered = true;
        exitInfo = info;
        executionMetadata.push({
          stage,
          exitCode: Number.isInteger(info && info.code) ? info.code : null,
          signal: info && typeof info.signal === 'string' ? info.signal : null,
          stdoutBytes: stdout.length,
          stdoutSha256: createHash('sha256').update(stdout).digest('hex'),
          stderrBytes: stderr.length,
          stderrSha256: createHash('sha256').update(stderr).digest('hex'),
          promptDetected: Boolean(info && info.promptDetected),
          truncated,
          targetMismatch: Boolean(info && info.targetMismatch),
          ledgerMismatch: Boolean(info && info.ledgerMismatch),
          spawnFailed: Boolean(info && info.spawnFailed),
        });
        if (exitCallback) exitCallback(info);
      };

      child.on('error', () => {
        deliver({ code: null, signal: null, promptDetected: false, targetMismatch: false, ledgerMismatch: false, spawnFailed: true });
      });

      child.on('close', (code, signal) => {
        if (promptDetected) {
          deliver({ code: null, signal: null, promptDetected: true, targetMismatch: false, ledgerMismatch: false });
          return;
        }
        if (truncated) {
          deliver({ code: null, signal: null, promptDetected: false, targetMismatch: false, ledgerMismatch: false });
          return;
        }
        if (signal) {
          deliver({ code: null, signal, promptDetected: false, targetMismatch: false, ledgerMismatch: false });
          return;
        }
        if (code !== 0) {
          deliver({ code, signal: null, promptDetected: false, targetMismatch: false, ledgerMismatch: false });
          return;
        }

        const stdoutText = stdout.toString('utf8');
        const stderrText = stderr.toString('utf8');
        const parsed =
          stage === 'list' ? parseListOutput(stdoutText, staged || []) : parseUpOutput(stdoutText, staged || [], isolatedWorkdir);
        const stderrOk = stage === 'list' ? validateListStderr(stderrText) : validateUpStderr(stderrText, staged || []);
        if (!parsed.ok || !stderrOk) {
          deliver({ code: null, signal: null, promptDetected: false, targetMismatch: false, ledgerMismatch: true });
          return;
        }
        deliver({ code: 0, signal: null, promptDetected: false, targetMismatch: false, ledgerMismatch: false });
      });

      return {
        onExit(callback) {
          if (typeof callback !== 'function') throw new TypeError('onExit callback must be a function');
          if (onExitRegistered) throw new Error('onExit may only be registered once per handle');
          onExitRegistered = true;
          exitCallback = callback;
          if (exitInfo) callback(exitInfo);
        },
        async terminate() {
          child.kill('SIGTERM');
        },
        async waitForExit() {
          if (exitInfo) return exitInfo;
          return new Promise((resolve) => {
            const previous = exitCallback;
            exitCallback = (info) => {
              if (previous) previous(info);
              resolve(info);
            };
          });
        },
      };
    },
    getExecutionMetadata() {
      return executionMetadata.map((entry) => ({ ...entry }));
    },
  };
}

/** Build the complete concrete, non-overridable production adapter set. No
 * function body here executes merely by defining/importing this module;
 * every effect happens only when `runHostedExecutionAdapter` actually calls
 * through to `runPreflightOnly`/`runExecuteOnce` with this adapter set. */
function buildProductionAdapters(input) {
  const filesystemPathInspector = createFsPathInspector();
  return {
    git: createGitCliAdapter(input.repoRoot),
    filesystem: {
      ...filesystemPathInspector,
      getExcludedRoots: async () => ['/private/tmp', '/tmp', '/var/folders'],
      exists: async (candidate) => {
        try {
          statSync(candidate);
          return true;
        } catch {
          return false;
        }
      },
    },
    path: { sep: () => posixSep, join: (...parts) => joinPath(...parts) },
    clock: { now: () => Date.now() },
    environment: { snapshot: async () => ({ ...process.env }) },
    hashAggregate: computeAggregateManifestHash,
    materializer: createConcreteMaterializer(input.repoRoot),
    ledger: createFsLedgerAdapter(LEDGER_ROOT, REQUIRED_PROJECT_REF),
    targetIdentity: createConcreteTargetIdentityAdapter(),
    process: createRealSupabaseProcessAdapter(),
    timer: {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle),
    },
    events: { emit: () => {} },
    evidence: createConcreteEvidenceAdapter(input.evidenceRoot),
  };
}

/**
 * The single production-shaped public entrypoint. Accepts exactly
 * `rawInput`: no second argument is ever bound to a parameter, and passing
 * one anyway is explicitly rejected rather than silently ignored. It
 * internally constructs concrete, non-overridable adapters and routes to
 * `runPreflightOnly`/`runExecuteOnce`; a production caller can never inject,
 * override, or otherwise select any Git/process/fs/path/parser/timer/clock/
 * ledger/evidence/materializer adapter.
 */
export async function runHostedExecutionAdapter(rawInput) {
  if (arguments.length > 1) {
    return {
      ok: false,
      decision: 'QUARANTINE_NO_RETRY',
      errors: ['runHostedExecutionAdapter accepts only rawInput; adapter injection is not part of the public entrypoint'],
    };
  }
  const validated = validatePublicInput(rawInput);
  if (!validated.ok) return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: validated.errors };

  let adapters;
  try {
    adapters = buildProductionAdapters(validated.value);
  } catch (error) {
    return { ok: false, decision: 'QUARANTINE_NO_RETRY', errors: [`adapter construction failed: ${errorMessage(error)}`] };
  }

  if (validated.value.mode === 'preflight-only') {
    return runPreflightOnly(rawInput, adapters);
  }
  return runExecuteOnce(rawInput, adapters);
}
