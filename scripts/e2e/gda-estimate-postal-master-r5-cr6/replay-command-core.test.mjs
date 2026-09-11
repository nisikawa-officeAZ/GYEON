import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_PROJECT_REF,
  buildMigrationListArgv,
  buildMigrationUpArgv,
  sanitizeEnvironment,
  validateExecutionOptions,
  assertNoForbiddenArguments,
  buildReplayCommand,
} from './replay-command-core.mjs';

const WORKDIR = '/private/tmp-not-used/isolated-runtime-workdir';

test('R2-08: the exact read-only ledger precheck argv array matches the CR6-R2 directive', () => {
  const result = buildMigrationListArgv(REQUIRED_PROJECT_REF, WORKDIR);
  assert.equal(result.ok, true);
  assert.equal(result.executable, 'supabase');
  assert.deepEqual(result.argv, [
    'migration', 'list',
    '--linked',
    '--project-ref', REQUIRED_PROJECT_REF,
    '--workdir', WORKDIR,
    '--output-format', 'json',
  ]);
});

test('R2-08: the exact single migration application argv array matches the CR6-R2 directive', () => {
  const result = buildMigrationUpArgv(REQUIRED_PROJECT_REF, WORKDIR);
  assert.equal(result.ok, true);
  assert.equal(result.executable, 'supabase');
  assert.deepEqual(result.argv, [
    'migration', 'up',
    '--linked',
    '--project-ref', REQUIRED_PROJECT_REF,
    '--workdir', WORKDIR,
    '--yes',
    '--output-format', 'json',
  ]);
});

test('fixed target validation: wrong project ref is rejected for both commands', () => {
  const list = buildMigrationListArgv('wrong-ref', WORKDIR);
  const up = buildMigrationUpArgv('wrong-ref', WORKDIR);
  assert.equal(list.ok, false);
  assert.equal(up.ok, false);
  assert.match(list.errors[0], /fixed target/);
});

test('absolute-workdir validation: relative and parent-traversal workdirs are rejected', () => {
  assert.equal(buildMigrationListArgv(REQUIRED_PROJECT_REF, 'relative/path').ok, false);
  assert.equal(buildMigrationListArgv(REQUIRED_PROJECT_REF, '/abs/../escape').ok, false);
  assert.equal(buildMigrationListArgv(REQUIRED_PROJECT_REF, '').ok, false);
  assert.equal(buildMigrationListArgv(REQUIRED_PROJECT_REF, undefined).ok, false);
});

test('R2-09: forbidden environment keys SUPABASE_PROJECT_ID and SUPABASE_DB_URL are rejected', () => {
  const projectId = sanitizeEnvironment({ SUPABASE_PROJECT_ID: 'x' });
  const dbUrl = sanitizeEnvironment({ SUPABASE_DB_URL: 'postgresql://x' });
  assert.equal(projectId.ok, false);
  assert.equal(dbUrl.ok, false);
});

test('R2-09: password-shaped and project-id-shaped environment keys are rejected regardless of case', () => {
  assert.equal(sanitizeEnvironment({ DB_PASSWORD: 'x' }).ok, false);
  assert.equal(sanitizeEnvironment({ supabase_db_url: 'x' }).ok, false);
  assert.equal(sanitizeEnvironment({ SOME_PROJECT_ID: 'x' }).ok, false);
});

test('sanitizeEnvironment keeps only the explicit allowlist and drops unknown keys', () => {
  const result = sanitizeEnvironment({
    SUPABASE_ACCESS_TOKEN: 'token-value',
    PATH: '/usr/bin',
    UNRELATED_VAR: 'dropped',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.env, { SUPABASE_ACCESS_TOKEN: 'token-value', PATH: '/usr/bin' });
  assert.equal(Object.prototype.hasOwnProperty.call(result.env, 'UNRELATED_VAR'), false);
});

test('sanitizeEnvironment rejects a non-string environment value', () => {
  const result = sanitizeEnvironment({ PATH: 123 });
  assert.equal(result.ok, false);
});

test('sanitizeEnvironment rejects non-object input', () => {
  assert.equal(sanitizeEnvironment(null).ok, false);
  assert.equal(sanitizeEnvironment('not-an-object').ok, false);
  assert.equal(sanitizeEnvironment(['array']).ok, false);
});

test('R2-09: shell mode other than exactly false is rejected', () => {
  assert.equal(validateExecutionOptions({ shell: true, env: {} }).ok, false);
  assert.equal(validateExecutionOptions({ env: {} }).ok, false);
  assert.equal(validateExecutionOptions({ shell: 'false', env: {} }).ok, false);
});

test('validateExecutionOptions requires shell:false and returns the sanitized env', () => {
  const result = validateExecutionOptions({ shell: false, env: { PATH: '/usr/bin' } });
  assert.equal(result.ok, true);
  assert.equal(result.shell, false);
  assert.deepEqual(result.env, { PATH: '/usr/bin' });
});

test('R2-09: --include-all is a forbidden argument', () => {
  const result = assertNoForbiddenArguments(['migration', 'up', '--include-all']);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /--include-all/);
});

test('R2-09: every explicitly prohibited command phrase is rejected', () => {
  assert.equal(assertNoForbiddenArguments(['db', 'status']).ok, true);
  assert.equal(assertNoForbiddenArguments(['db', 'push']).ok, false);
  assert.equal(assertNoForbiddenArguments(['db push']).ok, false);
  assert.equal(assertNoForbiddenArguments(['migration repair']).ok, false);
  assert.equal(assertNoForbiddenArguments(['db reset']).ok, false);
  assert.equal(assertNoForbiddenArguments(['link']).ok, false);
  assert.equal(assertNoForbiddenArguments(['--db-url', 'postgresql://x']).ok, false);
  assert.equal(assertNoForbiddenArguments(['--local']).ok, false);
});

test('R2-09: a password argv token is forbidden', () => {
  assert.equal(assertNoForbiddenArguments(['--password', 'secret']).ok, false);
  assert.equal(assertNoForbiddenArguments(['-p', 'secret']).ok, false);
});

test('buildReplayCommand returns executable and argv as separate values with shell:false and a sanitized env', () => {
  const result = buildReplayCommand('list', {
    projectRef: REQUIRED_PROJECT_REF,
    workdir: WORKDIR,
    env: { SUPABASE_ACCESS_TOKEN: 'token', SUPABASE_PROJECT_ID: 'forbidden' },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /forbidden environment key/);
});

test('buildReplayCommand succeeds for both kinds with a clean env and never joins argv into a shell string', () => {
  const listResult = buildReplayCommand('list', {
    projectRef: REQUIRED_PROJECT_REF,
    workdir: WORKDIR,
    env: { SUPABASE_ACCESS_TOKEN: 'token' },
  });
  const upResult = buildReplayCommand('up', {
    projectRef: REQUIRED_PROJECT_REF,
    workdir: WORKDIR,
    env: { SUPABASE_ACCESS_TOKEN: 'token' },
  });
  assert.equal(listResult.ok, true);
  assert.equal(upResult.ok, true);
  assert.equal(listResult.options.shell, false);
  assert.equal(upResult.options.shell, false);
  assert.deepEqual(listResult.options.env, { SUPABASE_ACCESS_TOKEN: 'token' });
  assert.equal(typeof listResult.executable, 'string');
  assert.equal(Array.isArray(listResult.argv), true);
  assert.equal(listResult.argv.some((token) => token.includes(' ')), false);
});

test('buildReplayCommand rejects an unknown kind', () => {
  const result = buildReplayCommand('reset', { projectRef: REQUIRED_PROJECT_REF, workdir: WORKDIR, env: {} });
  assert.equal(result.ok, false);
});

test('replay-command-core performs no process spawning or filesystem access', async () => {
  const moduleUrl = new URL('./replay-command-core.mjs', import.meta.url);
  const source = await (await import('node:fs/promises')).readFile(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /child_process|spawn\(|execFile\(|from ['"]node:fs/);
});
