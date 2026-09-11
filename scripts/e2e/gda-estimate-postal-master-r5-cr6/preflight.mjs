// Offline preflight for the CR6 hosted-replay harness. Every effect is
// injected through the `adapters` argument (git, filesystem, path, clock,
// environment); this module performs no real Git, filesystem, network, or
// process access itself and does not execute anything at import time.

import { buildManifest } from './manifest-core.mjs';
import { REQUIRED_PROJECT_REF, sanitizeEnvironment } from './replay-command-core.mjs';
import { isBurned } from './quarantine-core.mjs';

export const REQUIRED_BRANCH = 'agent/gda-estimate-ocr-postal-clean-replacement-r1';
export const REQUIRED_PR_NUMBER = '67';
export const REQUIRED_PR_STATE = 'OPEN';
export const REQUIRED_PR_DRAFT = 'true';
export const REQUIRED_PR_BASE = 'main';

export const PROTECTED_PATHS_METADATA = [
  {
    path: 'src/components/estimates/wizard/screens/ScreensPreview.tsx',
    mode: '100644',
    blob: 'c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f',
  },
  {
    path: 'supabase/migrations/20260801110110_line_link_tokens.sql',
    mode: '100644',
    blob: 'accd22345054cc44f89156fd78eaba6dfe4242a4',
  },
  {
    path: 'supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql',
    mode: '100644',
    blob: '32fda49583ae1217bc13711784ad8fa31744726c',
  },
  {
    path: 'src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts',
    mode: '100644',
    blob: 'fe3c80f22fd80dcbfab076082473216dda582c14',
  },
];

const HEX40 = /^[0-9a-f]{40}$/;

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

/**
 * Run the complete offline CR6 preflight. `input` carries the invocation's
 * declared identity and manifest data; `adapters` carries every effectful
 * dependency. Returns { ok: true, plan } or { ok: false, errors }. Never
 * throws: every adapter call is wrapped so an adapter rejection produces a
 * fail-closed result rather than an uncaught exception.
 */
export async function runPreflight(input, adapters) {
  try {
    if (!input || typeof input !== 'object') return { ok: false, errors: ['input must be an object'] };
    if (!adapters || typeof adapters !== 'object') return { ok: false, errors: ['adapters must be an object'] };

    const {
      expectedHead,
      expectedTree,
      projectRef,
      isolatedWorkdir,
      repoRoot,
      attemptId,
      burnedKeys,
      rawMigrationEntries,
      canonicalManifest,
      expectedAggregateSha256,
    } = input;

    const structuralErrors = [];
    if (typeof expectedHead !== 'string' || !HEX40.test(expectedHead)) {
      structuralErrors.push('expectedHead must be a 40-character hex commit sha');
    }
    if (typeof expectedTree !== 'string' || !HEX40.test(expectedTree)) {
      structuralErrors.push('expectedTree must be a 40-character hex tree sha');
    }
    // R2A-08: the fixed hosted target is validated before any adapter is
    // invoked, so a wrong target can never produce a plan or a command.
    if (projectRef !== REQUIRED_PROJECT_REF) {
      structuralErrors.push(`projectRef must equal the fixed target ${REQUIRED_PROJECT_REF}`);
    }
    if (!isAbsoluteNoTraversal(isolatedWorkdir)) {
      structuralErrors.push('isolatedWorkdir must be an absolute path without parent-directory references');
    }
    if (!isAbsoluteNoTraversal(repoRoot)) {
      structuralErrors.push('repoRoot must be an absolute path without parent-directory references');
    }
    if (typeof attemptId !== 'string' || attemptId.length === 0) {
      structuralErrors.push('attemptId must be a non-empty string');
    }
    if (structuralErrors.length > 0) return { ok: false, errors: structuralErrors };

    const errors = [];

    let head;
    let tree;
    let branch;
    let status;
    let upstream;
    let pullRequest;
    try {
      head = await adapters.git.getHead();
      tree = await adapters.git.getTree();
      branch = await adapters.git.getBranch();
      status = await adapters.git.getStatus();
      upstream = await adapters.git.getUpstreamAheadBehind();
      pullRequest = await adapters.git.getPullRequest();
    } catch (error) {
      return { ok: false, errors: [`git adapter failed: ${errorMessage(error)}`] };
    }

    if (head !== expectedHead) errors.push(`git HEAD ${head} does not equal the expected accepted HEAD ${expectedHead}`);
    if (tree !== expectedTree) errors.push(`git tree ${tree} does not equal the expected accepted tree ${expectedTree}`);
    if (branch !== REQUIRED_BRANCH) errors.push(`git branch ${branch} does not equal the required branch ${REQUIRED_BRANCH}`);
    if (typeof status !== 'string' || status.length !== 0) errors.push('worktree/index is not clean');
    if (!upstream || upstream.ahead !== 0 || upstream.behind !== 0) {
      errors.push('upstream ahead/behind must be exactly 0 0');
    }
    if (
      !pullRequest ||
      String(pullRequest.number) !== REQUIRED_PR_NUMBER ||
      pullRequest.state !== REQUIRED_PR_STATE ||
      String(pullRequest.draft) !== REQUIRED_PR_DRAFT ||
      pullRequest.base !== REQUIRED_PR_BASE
    ) {
      errors.push('pull request identity does not match the required fixed branch/PR contract');
    }

    let protectedEntries;
    try {
      protectedEntries = await adapters.git.getProtectedPathMetadata(PROTECTED_PATHS_METADATA.map((entry) => entry.path));
    } catch (error) {
      return { ok: false, errors: [`git adapter failed while reading protected metadata: ${errorMessage(error)}`] };
    }
    for (const expected of PROTECTED_PATHS_METADATA) {
      const actual = Array.isArray(protectedEntries) ? protectedEntries.find((entry) => entry && entry.path === expected.path) : undefined;
      if (!actual || actual.mode !== expected.mode || actual.blob !== expected.blob) {
        errors.push(`protected path metadata mismatch: ${expected.path}`);
      }
    }

    let realWorkdir;
    let realRepoRoot;
    let excludedRoots;
    let sep;
    try {
      realWorkdir = await adapters.filesystem.realpath(isolatedWorkdir);
      realRepoRoot = await adapters.filesystem.realpath(repoRoot);
      excludedRoots = await adapters.filesystem.getExcludedRoots();
      sep = adapters.path.sep();
    } catch (error) {
      return { ok: false, errors: [`filesystem/path adapter failed while resolving the isolated workdir: ${errorMessage(error)}`] };
    }
    if (typeof realWorkdir !== 'string' || realWorkdir.length === 0) {
      errors.push('isolated workdir failed to canonicalize');
    } else {
      if (realWorkdir === realRepoRoot || realWorkdir.startsWith(realRepoRoot + sep)) {
        errors.push('isolated workdir must not resolve inside the Git worktree (symlink escape or reuse detected)');
      }
      for (const root of excludedRoots || []) {
        if (realWorkdir === root || realWorkdir.startsWith(root + sep)) {
          errors.push(`isolated workdir must not resolve under excluded root ${root}`);
        }
      }
    }

    let staleProjectRefExists;
    try {
      staleProjectRefExists = await adapters.filesystem.exists(
        adapters.path.join(isolatedWorkdir, 'supabase', '.temp', 'project-ref'),
      );
    } catch (error) {
      return { ok: false, errors: [`filesystem adapter failed while checking for a stale project-ref: ${errorMessage(error)}`] };
    }
    if (staleProjectRefExists) errors.push('a stale supabase/.temp/project-ref already exists in the isolated workdir');

    let burnResult;
    try {
      burnResult = isBurned(burnedKeys, projectRef, attemptId);
    } catch (error) {
      return { ok: false, errors: [`quarantine ledger check failed: ${errorMessage(error)}`] };
    }
    if (!burnResult.ok) return { ok: false, errors: burnResult.errors };
    if (burnResult.burned) {
      errors.push('attempt identifier has already been used and is burned; a burned attempt can never return to an executable state');
    }

    let ambientEnvironment;
    try {
      ambientEnvironment = await adapters.environment.snapshot();
    } catch (error) {
      return { ok: false, errors: [`environment adapter failed: ${errorMessage(error)}`] };
    }
    const environmentResult = sanitizeEnvironment(ambientEnvironment || {});
    if (!environmentResult.ok) {
      errors.push(...environmentResult.errors.map((message) => `ambient environment: ${message}`));
    }

    let manifestResult;
    try {
      // R2B-01: pass the caller's configured expected aggregate through
      // unmodified; buildManifest fails closed unless it is either omitted
      // or exactly equal to the fixed accepted literal. It is never
      // silently defaulted or substituted here.
      manifestResult = buildManifest(rawMigrationEntries, {
        canonicalManifest,
        expectedAggregateSha256,
        hashAggregate: adapters.hashAggregate,
      });
    } catch (error) {
      return { ok: false, errors: [`manifest construction failed: ${errorMessage(error)}`] };
    }
    if (!manifestResult.ok) errors.push(...manifestResult.errors);

    let preflightEvaluatedAt;
    try {
      preflightEvaluatedAt = adapters.clock.now();
    } catch (error) {
      return { ok: false, errors: [`clock adapter failed: ${errorMessage(error)}`] };
    }

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok: true,
      plan: {
        projectRef,
        isolatedWorkdir,
        attemptId,
        head,
        tree,
        branch,
        manifest: manifestResult.staged,
        excluded: manifestResult.excluded,
        aggregateSha256: manifestResult.aggregateSha256,
        sanitizedAmbientEnvironment: environmentResult.ok ? environmentResult.env : {},
        preflightEvaluatedAt,
      },
    };
  } catch (error) {
    return { ok: false, errors: [`unexpected preflight failure: ${errorMessage(error)}`] };
  }
}
