// Pure, offline command-construction contract for the CR6 hosted-replay
// harness. No process is spawned here; this module only builds and
// validates argv arrays and execution options for later injection into a
// real process adapter.

export const REQUIRED_PROJECT_REF = 'nqvnjqcxgngqsqkbpdfi';

export const ALLOWED_ENV_KEYS = ['SUPABASE_ACCESS_TOKEN', 'PATH', 'HOME', 'LANG', 'LC_ALL'];

export const FORBIDDEN_ENV_KEYS = ['SUPABASE_PROJECT_ID', 'SUPABASE_DB_URL'];

export const FORBIDDEN_ARGUMENT_TOKENS = [
  '--include-all',
  '--db-url',
  '--local',
  'link',
  '--password',
  '-p',
];

export const FORBIDDEN_ARGUMENT_PHRASES = ['db push', 'migration repair', 'db reset'];

function isAbsolutePosixPath(candidate) {
  return (
    typeof candidate === 'string' &&
    candidate.length > 0 &&
    candidate.startsWith('/') &&
    !candidate.split('/').includes('..')
  );
}

function isForbiddenEnvKey(key) {
  const upper = key.toUpperCase();
  if (FORBIDDEN_ENV_KEYS.includes(upper)) return true;
  if (upper.includes('PASSWORD')) return true;
  if (upper.includes('DB_URL')) return true;
  if (upper.includes('PROJECT_ID')) return true;
  return false;
}

function validateTargetAndWorkdir(projectRef, workdir) {
  const errors = [];
  if (projectRef !== REQUIRED_PROJECT_REF) {
    errors.push(`project ref must equal the fixed target ${REQUIRED_PROJECT_REF}`);
  }
  if (!isAbsolutePosixPath(workdir)) {
    errors.push('workdir must be an absolute path without parent-directory references');
  }
  return errors;
}

/** Exact read-only ledger precheck argv per the CR6-R2 directive Section 6. */
export function buildMigrationListArgv(projectRef, workdir) {
  const errors = validateTargetAndWorkdir(projectRef, workdir);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    executable: 'supabase',
    argv: ['migration', 'list', '--linked', '--project-ref', projectRef, '--workdir', workdir, '--output-format', 'json'],
  };
}

/** Exact single migration application argv per the CR6-R2 directive Section 6. */
export function buildMigrationUpArgv(projectRef, workdir) {
  const errors = validateTargetAndWorkdir(projectRef, workdir);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    executable: 'supabase',
    argv: ['migration', 'up', '--linked', '--project-ref', projectRef, '--workdir', workdir, '--yes', '--output-format', 'json'],
  };
}

/**
 * Build an explicit sanitized child-process environment object. Unknown keys
 * are silently dropped; forbidden keys or non-string values fail closed.
 */
export function sanitizeEnvironment(rawEnv) {
  if (typeof rawEnv !== 'object' || rawEnv === null || Array.isArray(rawEnv)) {
    return { ok: false, errors: ['rawEnv must be a plain object'] };
  }
  const errors = [];
  const sanitized = {};
  for (const key of Object.keys(rawEnv)) {
    const value = rawEnv[key];
    if (typeof value !== 'string') {
      errors.push(`environment value for ${key} must be a string`);
      continue;
    }
    if (isForbiddenEnvKey(key)) {
      errors.push(`forbidden environment key present: ${key}`);
      continue;
    }
    if (ALLOWED_ENV_KEYS.includes(key)) {
      sanitized[key] = value;
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, env: sanitized };
}

/** Require shell:false and an explicit sanitized environment object. */
export function validateExecutionOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { ok: false, errors: ['options must be an object'] };
  }
  if (options.shell !== false) {
    return { ok: false, errors: ['shell must be exactly false'] };
  }
  const envResult = sanitizeEnvironment(options.env || {});
  if (!envResult.ok) return { ok: false, errors: envResult.errors };
  return { ok: true, shell: false, env: envResult.env };
}

/** Reject forbidden flags/commands so argv can never be joined into a shell string. */
export function assertNoForbiddenArguments(argv) {
  if (!Array.isArray(argv)) return { ok: false, errors: ['argv must be an array'] };
  const errors = [];
  for (const forbidden of FORBIDDEN_ARGUMENT_TOKENS) {
    if (argv.includes(forbidden)) errors.push(`forbidden argument present: ${forbidden}`);
  }
  const joined = argv.join(' ');
  for (const phrase of FORBIDDEN_ARGUMENT_PHRASES) {
    if (joined.includes(phrase)) errors.push(`forbidden command present: ${phrase}`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Compose one fully validated replay command: executable, argv, and
 * execution options, returned as separate values with shell:false enforced.
 */
export function buildReplayCommand(kind, { projectRef, workdir, env } = {}) {
  if (kind !== 'list' && kind !== 'up') {
    return { ok: false, errors: ['kind must be exactly "list" or "up"'] };
  }
  const built = kind === 'list' ? buildMigrationListArgv(projectRef, workdir) : buildMigrationUpArgv(projectRef, workdir);
  if (!built.ok) return built;

  const forbiddenCheck = assertNoForbiddenArguments(built.argv);
  if (!forbiddenCheck.ok) return forbiddenCheck;

  const optionsResult = validateExecutionOptions({ shell: false, env: env || {} });
  if (!optionsResult.ok) return optionsResult;

  return {
    ok: true,
    executable: built.executable,
    argv: built.argv,
    options: { shell: optionsResult.shell, env: optionsResult.env },
  };
}
