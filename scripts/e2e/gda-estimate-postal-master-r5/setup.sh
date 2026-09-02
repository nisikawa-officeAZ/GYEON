#!/usr/bin/env bash
set -Eeuo pipefail

# GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5 setup for ONE lane (fresh|import) of
# one disposable attempt. Execution requires a separate explicit runtime
# approval; authoring this file is a static source candidate only. It
# creates one lane outside the repository worktree and starts only that
# local project. It never links to, resets, or otherwise contacts a
# hosted/shared/production Supabase project.
#
# A full R5 attempt is two separate invocations of this script -- one per
# lane -- sharing the same GDA_POSTAL_R5_SUFFIX, followed by two lane
# invocations of capture-evidence.sh, followed by one invocation of
# cleanup.sh that tears down and retains evidence for both lanes and decides
# the aggregate burn/pass outcome. Any lane failure burns the whole suffix;
# the same suffix is never repaired or reused.
#
# Both lanes replay the FULL formal migration chain from scratch via
# `supabase db reset --local` (never `psql -f` against the target migration).
# `fresh` then exercises the postal pgTAP contract and real Auth/PostgREST
# lookups; `import` exercises the service-role import RPC state machine
# through its own driver, calling the local RPCs directly rather than through
# the production importer CLI (which intentionally refuses a local URL).

CONFIRM_LITERAL="I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE"
REPO_ROOT="${GDA_POSTAL_R5_REPO_ROOT:-}"
RUNTIME_PARENT="${GDA_POSTAL_R5_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
SUFFIX="${GDA_POSTAL_R5_SUFFIX:-}"
LANE="${GDA_POSTAL_R5_LANE:-}"
BASE_PORT="${GDA_POSTAL_R5_BASE_PORT:-57720}"
PSQL_BIN="${GDA_POSTAL_R5_PSQL_BIN:-}"

# Invocation-supplied accepted identity. Never hard-coded: a new accepted
# commit does not require editing this script, and a caller that forgets to
# supply them fails closed rather than silently reusing a stale literal.
EXPECTED_EXECUTION_HEAD="${GDA_POSTAL_R5_EXPECTED_HEAD:-}"
EXPECTED_EXECUTION_TREE="${GDA_POSTAL_R5_EXPECTED_TREE:-}"
# The local branch's configured upstream is origin/main in this repository,
# so a plain `@{u}` == HEAD check (as used by the predecessor C5-D harness)
# would fail closed for a reason unrelated to source drift. GitHub PR
# headRefOid equality is the remote branch authority for this phase instead;
# it must be supplied by the invoking Codex session (which independently
# checked GitHub before invoking Claude) and must equal the execution HEAD.
EXPECTED_PR_HEAD_REF_OID="${GDA_POSTAL_R5_EXPECTED_PR_HEAD_REF_OID:-}"

# Invocation-supplied PR metadata. Never queried from GitHub/network here:
# the invoking Codex session independently checked GitHub before invoking
# this harness and must supply the exact accepted values. Any missing or
# non-matching field fails closed before any runtime is created.
EXPECTED_PR_NUMBER="${GDA_POSTAL_R5_EXPECTED_PR_NUMBER:-}"
EXPECTED_PR_STATE="${GDA_POSTAL_R5_EXPECTED_PR_STATE:-}"
EXPECTED_PR_DRAFT="${GDA_POSTAL_R5_EXPECTED_PR_DRAFT:-}"
EXPECTED_PR_BASE="${GDA_POSTAL_R5_EXPECTED_PR_BASE:-}"

REQUIRED_BRANCH="agent/estimate-wizard-ocr-postal-unified-r1"
REQUIRED_PR_NUMBER="48"
REQUIRED_PR_STATE="OPEN"
REQUIRED_PR_DRAFT="true"
REQUIRED_PR_BASE="main"
MIGRATION_BASENAME="20260901001246_jp_postal_master.sql"
MIGRATION_VERSION="20260901001246"
EXPECTED_MIGRATION_SHA256="2325168075511e7a1657f6c2b2299109a41a0181ac590a86817cf94d44467f7a"
LINE_MIGRATION_BASENAME="20260801110110_line_link_tokens.sql"
POSTAL_PGTAP_BASENAME="jp_postal_master_rpc.test.sql"

PROTECTED_PATHS=(
  "src/components/estimates/wizard/screens/ScreensPreview.tsx"
  "supabase/migrations/20260801110110_line_link_tokens.sql"
  "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"
  "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts"
)

# macOS ships Bash 3.2, which has no associative arrays. Keep the protected
# and R4-manifest metadata as literal case mappings so the harness runs on
# the default shell without weakening the exact pathname/mode/blob contract.
protected_blob_for() {
  case "$1" in
    "src/components/estimates/wizard/screens/ScreensPreview.tsx") printf '%s' "c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f" ;;
    "supabase/migrations/20260801110110_line_link_tokens.sql") printf '%s' "accd22345054cc44f89156fd78eaba6dfe4242a4" ;;
    "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql") printf '%s' "32fda49583ae1217bc13711784ad8fa31744726c" ;;
    "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts") printf '%s' "fe3c80f22fd80dcbfab076082473216dda582c14" ;;
    *) return 1 ;;
  esac
}

protected_mode_for() {
  case "$1" in
    "src/components/estimates/wizard/screens/ScreensPreview.tsx"|\
    "supabase/migrations/20260801110110_line_link_tokens.sql"|\
    "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"|\
    "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts") printf '%s' "100644" ;;
    *) return 1 ;;
  esac
}

# Accepted R4 source/test manifest (git blob object ids, not working-tree
# shasum): the exact five paths named by the R5 directive's required first
# reads. A drifted blob for any one of these fails closed.
r4_manifest_blob_for() {
  case "$1" in
    "supabase/migrations/20260901001246_jp_postal_master.sql") printf '%s' "f81b5a70a760d6350f27ed8c9c0cc87194f775dc" ;;
    "supabase/tests/jp_postal_master_rpc.test.sql") printf '%s' "9832459e92176498944353d38e02ddee4db444ea" ;;
    "src/lib/geo/jp-postal-master-migration-contract.test.ts") printf '%s' "2b653364d0938e55787395cdfd845c9bcfcb1f30" ;;
    "scripts/postal-master/import-japan-post.ts") printf '%s' "49fea46a9e1b3f013d72c385f22107321b046cbd" ;;
    "scripts/postal-master/import-japan-post.test.ts") printf '%s' "71f9fa3e07e648205d916101b835367c7fbd10a6" ;;
    *) return 1 ;;
  esac
}
# Working-tree content SHA-256 for the same five R4 paths (distinct from the
# git blob id above): this is the hard-gated hash of the file's bytes as read
# from disk, matching the accepted-metadata contract supplied at invocation.
r4_manifest_sha256_for() {
  case "$1" in
    "supabase/migrations/20260901001246_jp_postal_master.sql") printf '%s' "2325168075511e7a1657f6c2b2299109a41a0181ac590a86817cf94d44467f7a" ;;
    "supabase/tests/jp_postal_master_rpc.test.sql") printf '%s' "5859bc01453e7a172e52ff3eddaf75bf1ab04e0c2a81d963cb6b40176b2360dc" ;;
    "src/lib/geo/jp-postal-master-migration-contract.test.ts") printf '%s' "6685578850c2f0d4078e2a78aa9563d3e6b389908242c8184cde02bdad92ca60" ;;
    "scripts/postal-master/import-japan-post.ts") printf '%s' "46d0029e70fee826c6b06be5c182e85865805c0f4a2f67f11bc44be009af6ab6" ;;
    "scripts/postal-master/import-japan-post.test.ts") printf '%s' "1cc766e86b4d828e5c81fabb8808c373981d9e639ae9407290391515f42168cd" ;;
    *) return 1 ;;
  esac
}
r4_manifest_mode_for() {
  case "$1" in
    "supabase/migrations/20260901001246_jp_postal_master.sql"|\
    "supabase/tests/jp_postal_master_rpc.test.sql"|\
    "src/lib/geo/jp-postal-master-migration-contract.test.ts"|\
    "scripts/postal-master/import-japan-post.ts"|\
    "scripts/postal-master/import-japan-post.test.ts") printf '%s' "100644" ;;
    *) return 1 ;;
  esac
}
R4_MANIFEST_PATHS=(
  "supabase/migrations/20260901001246_jp_postal_master.sql"
  "supabase/tests/jp_postal_master_rpc.test.sql"
  "src/lib/geo/jp-postal-master-migration-contract.test.ts"
  "scripts/postal-master/import-japan-post.ts"
  "scripts/postal-master/import-japan-post.test.ts"
)
HARNESS_SOURCE_FILES=(config.toml setup.sh capture-evidence.sh cleanup.sh real-auth.mjs import-resume.mjs runtime-contract.test.sql)

IN_FAIL=0
PATHS_VALIDATED=0

fail() {
  IN_FAIL=1
  printf 'R5_SETUP_ERROR: %s\n' "$1" >&2
  # Burn this lane's evidence dir AND the shared suffix-level marker. Any
  # lane failure burns the entire suffix; the same suffix is never repaired
  # or rerun into acceptance. Never write into LANE_DIR/SUFFIX_DIR before
  # PATHS_VALIDATED confirms both resolved outside every excluded root: a
  # rejection triggered by that very check must not write into the rejected
  # path.
  if [[ "$PATHS_VALIDATED" -eq 1 ]]; then
    if [[ -n "${LANE_DIR:-}" ]]; then
      mkdir -p "$LANE_DIR/evidence"
      date -u '+%Y-%m-%dT%H:%M:%SZ' > "$LANE_DIR/evidence/burned.txt"
      printf '%s\n' "$1" >> "$LANE_DIR/evidence/burned.txt"
    fi
    if [[ -n "${SUFFIX_DIR:-}" ]]; then
      mkdir -p "$SUFFIX_DIR"
      date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SUFFIX_DIR/burned.txt"
      printf 'lane=%s %s\n' "${LANE:-unknown}" "$1" >> "$SUFFIX_DIR/burned.txt"
    fi
  fi
  exit 1
}

# Fail-closed EXIT trap: an unexpected non-zero script exit burns the lane
# and shared suffix. EXIT (not ERR) is intentional: Bash fires ERR traps even
# while `set +e` is active, which would break the deliberately captured exit
# codes used throughout this harness.
on_unexpected_exit() {
  local exit_code=$?
  [[ "$exit_code" -eq 0 || "$IN_FAIL" -eq 1 ]] && return
  IN_FAIL=1
  printf 'R5_SETUP_ERROR: unexpected non-zero script exit (code %s)\n' "$exit_code" >&2
  [[ "$PATHS_VALIDATED" -eq 1 ]] || return
  if [[ -n "${LANE_DIR:-}" ]]; then
    mkdir -p "$LANE_DIR/evidence" 2>/dev/null || true
    { date -u '+%Y-%m-%dT%H:%M:%SZ'; printf 'unexpected non-zero script exit code %s (fail-closed EXIT trap)\n' "$exit_code"; } >> "$LANE_DIR/evidence/burned.txt" 2>/dev/null || true
  fi
  if [[ -n "${SUFFIX_DIR:-}" ]]; then
    mkdir -p "$SUFFIX_DIR" 2>/dev/null || true
    { date -u '+%Y-%m-%dT%H:%M:%SZ'; printf 'lane=%s unexpected non-zero script exit code %s (fail-closed EXIT trap)\n' "${LANE:-unknown}" "$exit_code"; } >> "$SUFFIX_DIR/burned.txt" 2>/dev/null || true
  fi
}
trap on_unexpected_exit EXIT

log_cmd() {
  # log_cmd <description> <exit_code>
  if [[ -n "${LANE_DIR:-}" ]]; then
    mkdir -p "$LANE_DIR/evidence"
    python3 -c "
import json, sys
with open('$LANE_DIR/evidence/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'setup.sh', 'lane': '$LANE', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$1" "$2"
  fi
}

# ---------------------------------------------------------------------------
# OS-temp / worktree exclusion boundary. Canonicalizes (symlink-resolves) a
# candidate path with python3's realpath -- so a symlinked /tmp ->
# /private/tmp cannot slip past a literal-prefix check -- then fails closed
# if it resolves inside the Git worktree, /private/tmp, /tmp, /var/folders,
# the current $TMPDIR, or the general OS temp root reported by python3's
# own tempfile.gettempdir(). Bash 3.2 has no associative arrays, so this is
# a small ordered case-statement helper rather than a table.
# ---------------------------------------------------------------------------

gda_r5_realpath() {
  python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

gda_r5_assert_outside_excluded_roots() {
  # gda_r5_assert_outside_excluded_roots <label> <path>
  # A canonicalization error itself fails closed (via fail(), which never
  # writes before PATHS_VALIDATED is set) rather than propagating a raw
  # command-substitution failure.
  local label="$1" candidate="$2" real worktree_real systmp_real tmpdir_real
  real="$(gda_r5_realpath "$candidate")" || fail "$label canonicalization failed for $candidate"
  [[ -n "$real" ]] || fail "$label canonicalized to an empty path"
  worktree_real="$(gda_r5_realpath "$REPO_ROOT")" || fail "$label: REPO_ROOT canonicalization failed"
  [[ -n "$worktree_real" ]] || fail "$label: REPO_ROOT canonicalized to an empty path"
  systmp_real="$(python3 -c 'import os, tempfile; print(os.path.realpath(tempfile.gettempdir()))')" || fail "$label: OS temp root canonicalization failed"
  [[ -n "$systmp_real" ]] || fail "$label: OS temp root canonicalized to an empty path"
  case "$real" in
    "$worktree_real"|"$worktree_real"/*) fail "$label must not resolve inside the Git worktree ($real)" ;;
  esac
  case "$real" in
    /private/tmp|/private/tmp/*) fail "$label must not resolve under /private/tmp ($real)" ;;
    /tmp|/tmp/*) fail "$label must not resolve under /tmp ($real)" ;;
    /var/folders|/var/folders/*) fail "$label must not resolve under /var/folders ($real)" ;;
  esac
  case "$real" in
    "$systmp_real"|"$systmp_real"/*) fail "$label must not resolve under the general OS temp directory ($real)" ;;
  esac
  if [[ -n "${TMPDIR:-}" ]]; then
    tmpdir_real="$(gda_r5_realpath "$TMPDIR")" || fail "$label: \$TMPDIR canonicalization failed"
    [[ -n "$tmpdir_real" ]] || fail "$label: \$TMPDIR canonicalized to an empty path"
    case "$real" in
      "$tmpdir_real"|"$tmpdir_real"/*) fail "$label must not resolve under the current \$TMPDIR ($real)" ;;
    esac
  fi
}

[[ "${GDA_POSTAL_R5_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$EXPECTED_EXECUTION_HEAD" ]] || fail "GDA_POSTAL_R5_EXPECTED_HEAD is required and must not be blank"
[[ "$EXPECTED_EXECUTION_HEAD" =~ ^[0-9a-f]{40}$ ]] || fail "GDA_POSTAL_R5_EXPECTED_HEAD must be a 40-character hex commit SHA"
[[ -n "$EXPECTED_EXECUTION_TREE" ]] || fail "GDA_POSTAL_R5_EXPECTED_TREE is required and must not be blank"
[[ "$EXPECTED_EXECUTION_TREE" =~ ^[0-9a-f]{40}$ ]] || fail "GDA_POSTAL_R5_EXPECTED_TREE must be a 40-character hex tree SHA"
[[ -n "$EXPECTED_PR_HEAD_REF_OID" ]] || fail "GDA_POSTAL_R5_EXPECTED_PR_HEAD_REF_OID is required and must not be blank"
[[ "$EXPECTED_PR_HEAD_REF_OID" =~ ^[0-9a-f]{40}$ ]] || fail "GDA_POSTAL_R5_EXPECTED_PR_HEAD_REF_OID must be a 40-character hex commit SHA"
[[ "$EXPECTED_PR_HEAD_REF_OID" == "$EXPECTED_EXECUTION_HEAD" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: invocation-supplied PR headRefOid does not equal the invocation-supplied execution HEAD"
[[ -n "$EXPECTED_PR_NUMBER" ]] || fail "GDA_POSTAL_R5_EXPECTED_PR_NUMBER is required and must not be blank"
[[ "$EXPECTED_PR_NUMBER" == "$REQUIRED_PR_NUMBER" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: invocation-supplied PR number must be exactly $REQUIRED_PR_NUMBER"
[[ -n "$EXPECTED_PR_STATE" ]] || fail "GDA_POSTAL_R5_EXPECTED_PR_STATE is required and must not be blank"
[[ "$EXPECTED_PR_STATE" == "$REQUIRED_PR_STATE" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: invocation-supplied PR state must be exactly $REQUIRED_PR_STATE"
[[ -n "$EXPECTED_PR_DRAFT" ]] || fail "GDA_POSTAL_R5_EXPECTED_PR_DRAFT is required and must not be blank"
[[ "$EXPECTED_PR_DRAFT" == "$REQUIRED_PR_DRAFT" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: invocation-supplied PR draft flag must be exactly $REQUIRED_PR_DRAFT"
[[ -n "$EXPECTED_PR_BASE" ]] || fail "GDA_POSTAL_R5_EXPECTED_PR_BASE is required and must not be blank"
[[ "$EXPECTED_PR_BASE" == "$REQUIRED_PR_BASE" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: invocation-supplied PR base branch must be exactly $REQUIRED_PR_BASE"
[[ -n "$REPO_ROOT" ]] || fail "GDA_POSTAL_R5_REPO_ROOT is required"
[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "repo root is not a git worktree"
[[ -n "$SUFFIX" ]] || fail "GDA_POSTAL_R5_SUFFIX is required"
[[ "$SUFFIX" =~ ^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "suffix must be fresh UTC timestamp plus six lowercase alphanumerics"
[[ "$LANE" == "fresh" || "$LANE" == "import" ]] || fail "GDA_POSTAL_R5_LANE must be exactly one of: fresh, import"
[[ "$BASE_PORT" =~ ^[0-9]+$ ]] || fail "base port must be numeric"
[[ -n "$PSQL_BIN" ]] || fail "GDA_POSTAL_R5_PSQL_BIN is required"
[[ -x "$PSQL_BIN" ]] || fail "GDA_POSTAL_R5_PSQL_BIN must be an executable path"

# The runtime must live outside the Git worktree and outside every general
# OS temp location, checked against the canonicalized (symlink-resolved)
# path so a disguised or symlinked candidate cannot slip through.
gda_r5_assert_outside_excluded_roots "runtime parent" "$RUNTIME_PARENT"

SUFFIX_DIR="$RUNTIME_PARENT/gda-postal-r5.$SUFFIX"
LANE_DIR="$SUFFIX_DIR/$LANE"
[[ "$LANE_DIR" == "$RUNTIME_PARENT"/gda-postal-r5.*/"$LANE" ]] || fail "runtime path escaped the dedicated prefix"
gda_r5_assert_outside_excluded_roots "suffix path" "$SUFFIX_DIR"
gda_r5_assert_outside_excluded_roots "runtime path" "$LANE_DIR"

# Only after both the suffix-level and lane-level runtime paths are proven to
# resolve outside every excluded root may ordinary failure handling or the
# EXIT trap write burn evidence into them.
PATHS_VALIDATED=1

[[ -e "$SUFFIX_DIR" ]] && [[ -e "$SUFFIX_DIR/burned.txt" ]] && fail "this suffix is already burned; choose a fresh suffix"
[[ ! -e "$LANE_DIR" ]] || fail "this lane of this suffix is already burned or already set up; choose a fresh suffix"

# ---------------------------------------------------------------------------
# R5-0: source integrity preflight. No local/hosted DB is contacted yet.
# ---------------------------------------------------------------------------

command -v git >/dev/null 2>&1 || fail "git is required"
command -v supabase >/dev/null 2>&1 || fail "supabase CLI is required"
command -v node >/dev/null 2>&1 || fail "node is required"
command -v shasum >/dev/null 2>&1 || fail "shasum is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"

CURRENT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
CURRENT_TREE="$(git -C "$REPO_ROOT" rev-parse HEAD^{tree})"
GIT_STATUS="$(git -C "$REPO_ROOT" status --porcelain=v1)"

[[ "$CURRENT_HEAD" == "$EXPECTED_EXECUTION_HEAD" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: execution HEAD $CURRENT_HEAD does not match the invocation-supplied accepted HEAD $EXPECTED_EXECUTION_HEAD"
[[ "$CURRENT_TREE" == "$EXPECTED_EXECUTION_TREE" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: execution tree $CURRENT_TREE does not match the invocation-supplied accepted tree $EXPECTED_EXECUTION_TREE"
[[ -z "$GIT_STATUS" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: worktree/index is not clean"

CURRENT_BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
[[ "$CURRENT_BRANCH" == "$REQUIRED_BRANCH" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: branch $CURRENT_BRANCH does not equal the required branch $REQUIRED_BRANCH"

SOURCE_DIR="$REPO_ROOT/scripts/e2e/gda-estimate-postal-master-r5"
MIGRATION_SQL="$REPO_ROOT/supabase/migrations/$MIGRATION_BASENAME"
POSTAL_PGTAP_SQL="$REPO_ROOT/supabase/tests/$POSTAL_PGTAP_BASENAME"
[[ -f "$SOURCE_DIR/config.toml" ]] || fail "R5 config template is missing"
[[ -f "$MIGRATION_SQL" ]] || fail "target postal migration is missing"
[[ -f "$POSTAL_PGTAP_SQL" ]] || fail "existing postal pgTAP file is missing"

# Target migration candidate count must be exactly one.
MIGRATION_CANDIDATE_COUNT="$(find "$REPO_ROOT/supabase/migrations" -maxdepth 1 -type f -name '*_jp_postal_master.sql' | wc -l | tr -d ' ')"
[[ "$MIGRATION_CANDIDATE_COUNT" == "1" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: expected exactly one target migration candidate, found $MIGRATION_CANDIDATE_COUNT"

MIGRATION_HASH="$(shasum -a 256 "$MIGRATION_SQL" | awk '{print $1}')"
[[ "$MIGRATION_HASH" == "$EXPECTED_MIGRATION_SHA256" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: target migration hash mismatch"
HEAD_MIGRATION_HASH="$(git -C "$REPO_ROOT" show "HEAD:supabase/migrations/$MIGRATION_BASENAME" | shasum -a 256 | awk '{print $1}')"
[[ "$HEAD_MIGRATION_HASH" == "$EXPECTED_MIGRATION_SHA256" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: committed target migration blob mismatch"
MIGRATION_ENTRY="$(git -C "$REPO_ROOT" ls-files -s -- "supabase/migrations/$MIGRATION_BASENAME")"
MIGRATION_MODE="$(printf '%s' "$MIGRATION_ENTRY" | awk '{print $1}')"
MIGRATION_BLOB="$(printf '%s' "$MIGRATION_ENTRY" | awk '{print $2}')"
[[ "$MIGRATION_MODE" == "100644" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: target migration mode mismatch (found $MIGRATION_MODE)"

# R4 source/test manifest: exact git-blob identity, git mode, and
# working-tree content SHA-256 for the five accepted paths named by the R5
# directive's mandatory read scope, hard-gated against the supplied accepted
# metadata rather than merely blob identity.
for path in "${R4_MANIFEST_PATHS[@]}"; do
  entry="$(git -C "$REPO_ROOT" ls-files -s -- "$path")"
  mode="$(printf '%s' "$entry" | awk '{print $1}')"
  blob="$(printf '%s' "$entry" | awk '{print $2}')"
  expected_blob="$(r4_manifest_blob_for "$path")" || fail "R4 manifest blob contract missing: $path"
  expected_mode="$(r4_manifest_mode_for "$path")" || fail "R4 manifest mode contract missing: $path"
  expected_sha256="$(r4_manifest_sha256_for "$path")" || fail "R4 manifest sha256 contract missing: $path"
  [[ -n "$blob" ]] || fail "R4 manifest path metadata missing: $path"
  [[ "$blob" == "$expected_blob" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: R4 source/test blob drift: $path"
  [[ "$mode" == "$expected_mode" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: R4 source/test mode drift: $path (found $mode)"
  [[ -f "$REPO_ROOT/$path" ]] || fail "R4 manifest path is missing on disk: $path"
  actual_sha256="$(shasum -a 256 "$REPO_ROOT/$path" | awk '{print $1}')"
  [[ "$actual_sha256" == "$expected_sha256" ]] || fail "R5_NOT_STARTED_SOURCE_DRIFT: R4 source/test content SHA-256 drift: $path"
done

# Protected paths: pathname/mode/blob/Git-state only. Content is never
# opened, read, printed, diffed, copied, or staged.
for path in "${PROTECTED_PATHS[@]}"; do
  entry="$(git -C "$REPO_ROOT" ls-files -s -- "$path")"
  mode="$(printf '%s' "$entry" | awk '{print $1}')"
  blob="$(printf '%s' "$entry" | awk '{print $2}')"
  status="$(git -C "$REPO_ROOT" status --porcelain -- "$path")"
  expected_mode="$(protected_mode_for "$path")" || fail "protected path mode contract missing: $path"
  expected_blob="$(protected_blob_for "$path")" || fail "protected path blob contract missing: $path"
  [[ -n "$blob" ]] || fail "protected path metadata missing: $path"
  [[ "$mode" == "$expected_mode" ]] || fail "protected path mode drift: $path (found $mode)"
  [[ "$blob" == "$expected_blob" ]] || fail "protected path blob drift: $path"
  [[ -z "$status" ]] || fail "protected path is not clean: $path"
done

# Reject a linked/hosted project state before any runtime is created.
[[ ! -e "$REPO_ROOT/supabase/config.toml" ]] || fail "repository unexpectedly has a root Supabase config"
[[ ! -e "$REPO_ROOT/supabase/.temp/project-ref" ]] || fail "repository has a linked Supabase project reference"

mkdir -p "$LANE_DIR/supabase/migrations"
mkdir -p "$LANE_DIR/supabase/tests"
mkdir -p "$LANE_DIR/evidence"

{
  printf 'repo_root=%s\n' "$REPO_ROOT"
  printf 'lane=%s\n' "$LANE"
  printf 'head=%s (hard-gated == %s)\n' "$CURRENT_HEAD" "$EXPECTED_EXECUTION_HEAD"
  printf 'tree=%s (hard-gated == %s)\n' "$CURRENT_TREE" "$EXPECTED_EXECUTION_TREE"
  printf 'branch=%s (hard-gated == %s)\n' "$CURRENT_BRANCH" "$REQUIRED_BRANCH"
  printf 'pr_number=%s (hard-gated == %s)\n' "$EXPECTED_PR_NUMBER" "$REQUIRED_PR_NUMBER"
  printf 'pr_state=%s (hard-gated == %s)\n' "$EXPECTED_PR_STATE" "$REQUIRED_PR_STATE"
  printf 'pr_draft=%s (hard-gated == %s)\n' "$EXPECTED_PR_DRAFT" "$REQUIRED_PR_DRAFT"
  printf 'pr_base=%s (hard-gated == %s)\n' "$EXPECTED_PR_BASE" "$REQUIRED_PR_BASE"
  printf 'pr_head_ref_oid=%s (hard-gated == head, invocation-supplied remote authority)\n' "$EXPECTED_PR_HEAD_REF_OID"
  printf 'worktree_status_lines=0 (clean, hard-gated above)\n'
  printf 'migration_path=supabase/migrations/%s\n' "$MIGRATION_BASENAME"
  printf 'migration_mode=%s (hard-gated)\n' "$MIGRATION_MODE"
  printf 'migration_blob=%s (hard-gated)\n' "$MIGRATION_BLOB"
  printf 'migration_sha256=%s (hard-gated)\n' "$MIGRATION_HASH"
} > "$LANE_DIR/evidence/source-hashes.sha256"

{
  for path in "${R4_MANIFEST_PATHS[@]}"; do
    expected_blob="$(r4_manifest_blob_for "$path")" || fail "R4 manifest blob contract missing: $path"
    expected_mode="$(r4_manifest_mode_for "$path")" || fail "R4 manifest mode contract missing: $path"
    expected_sha256="$(r4_manifest_sha256_for "$path")" || fail "R4 manifest sha256 contract missing: $path"
    printf 'path=%s mode=%s blob=%s sha256=%s (hard-gated)\n' "$path" "$expected_mode" "$expected_blob" "$expected_sha256"
  done
} > "$LANE_DIR/evidence/r4-manifest.txt"

{
  for path in "${PROTECTED_PATHS[@]}"; do
    expected_mode="$(protected_mode_for "$path")" || fail "protected path mode contract missing: $path"
    expected_blob="$(protected_blob_for "$path")" || fail "protected path blob contract missing: $path"
    printf 'path=%s mode=%s blob=%s (hard-gated)\n' "$path" "$expected_mode" "$expected_blob"
  done
} > "$LANE_DIR/evidence/protected-paths.txt"

# ---------------------------------------------------------------------------
# Persisted machine-readable runtime source contract. capture-evidence.sh and
# cleanup.sh both revalidate against this file before treating repository or
# harness state as trustworthy evidence; a hand-edited literal in a later
# script would no longer agree with what was hard-gated here at setup time.
# Only pathname/mode/blob metadata is recorded for protected paths -- their
# content is never opened, read, or hashed.
# ---------------------------------------------------------------------------

SOURCE_CONTRACT_TMP="$LANE_DIR/evidence/.source-contract-build.json"
python3 - "$SOURCE_CONTRACT_TMP" "$CURRENT_HEAD" "$CURRENT_TREE" "$CURRENT_BRANCH" \
  "$EXPECTED_PR_NUMBER" "$EXPECTED_PR_STATE" "$EXPECTED_PR_DRAFT" "$EXPECTED_PR_BASE" "$EXPECTED_PR_HEAD_REF_OID" \
  "supabase/migrations/$MIGRATION_BASENAME" "$MIGRATION_MODE" "$MIGRATION_BLOB" "$MIGRATION_HASH" \
  "$SOURCE_DIR" <<'PY'
import hashlib, json, os, sys

(out_path, head, tree, branch,
 pr_number, pr_state, pr_draft, pr_base, pr_head_ref_oid,
 migration_path, migration_mode, migration_blob, migration_sha256,
 source_dir) = sys.argv[1:15]

r4_manifest_paths = [
    "supabase/migrations/20260901001246_jp_postal_master.sql",
    "supabase/tests/jp_postal_master_rpc.test.sql",
    "src/lib/geo/jp-postal-master-migration-contract.test.ts",
    "scripts/postal-master/import-japan-post.ts",
    "scripts/postal-master/import-japan-post.test.ts",
]
r4_manifest_blobs = {
    "supabase/migrations/20260901001246_jp_postal_master.sql": "f81b5a70a760d6350f27ed8c9c0cc87194f775dc",
    "supabase/tests/jp_postal_master_rpc.test.sql": "9832459e92176498944353d38e02ddee4db444ea",
    "src/lib/geo/jp-postal-master-migration-contract.test.ts": "2b653364d0938e55787395cdfd845c9bcfcb1f30",
    "scripts/postal-master/import-japan-post.ts": "49fea46a9e1b3f013d72c385f22107321b046cbd",
    "scripts/postal-master/import-japan-post.test.ts": "71f9fa3e07e648205d916101b835367c7fbd10a6",
}
r4_manifest_sha256 = {
    "supabase/migrations/20260901001246_jp_postal_master.sql": "2325168075511e7a1657f6c2b2299109a41a0181ac590a86817cf94d44467f7a",
    "supabase/tests/jp_postal_master_rpc.test.sql": "5859bc01453e7a172e52ff3eddaf75bf1ab04e0c2a81d963cb6b40176b2360dc",
    "src/lib/geo/jp-postal-master-migration-contract.test.ts": "6685578850c2f0d4078e2a78aa9563d3e6b389908242c8184cde02bdad92ca60",
    "scripts/postal-master/import-japan-post.ts": "46d0029e70fee826c6b06be5c182e85865805c0f4a2f67f11bc44be009af6ab6",
    "scripts/postal-master/import-japan-post.test.ts": "1cc766e86b4d828e5c81fabb8808c373981d9e639ae9407290391515f42168cd",
}
protected_paths = {
    "src/components/estimates/wizard/screens/ScreensPreview.tsx": ("100644", "c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f"),
    "supabase/migrations/20260801110110_line_link_tokens.sql": ("100644", "accd22345054cc44f89156fd78eaba6dfe4242a4"),
    "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql": ("100644", "32fda49583ae1217bc13711784ad8fa31744726c"),
    "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts": ("100644", "fe3c80f22fd80dcbfab076082473216dda582c14"),
}

def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()

r4_manifest = [
    {
        "path": p,
        "mode": "100644",
        "blob": r4_manifest_blobs[p],
        "sha256": r4_manifest_sha256[p],
    }
    for p in r4_manifest_paths
]
protected = [
    {"path": p, "mode": mode, "blob": blob}
    for p, (mode, blob) in protected_paths.items()
]
harness_names = ["config.toml", "setup.sh", "capture-evidence.sh", "cleanup.sh", "real-auth.mjs", "import-resume.mjs", "runtime-contract.test.sql"]
harness_files = [
    {"name": name, "sha256": sha256_of(os.path.join(source_dir, name))}
    for name in harness_names
]

contract = {
    "head": head,
    "tree": tree,
    "branch": branch,
    "pr": {
        "number": pr_number,
        "state": pr_state,
        "draft": pr_draft,
        "base": pr_base,
        "head_ref_oid": pr_head_ref_oid,
    },
    "migration": {
        "path": migration_path,
        "mode": migration_mode,
        "blob": migration_blob,
        "sha256": migration_sha256,
    },
    "r4_manifest": r4_manifest,
    "protected": protected,
    "harness_files": harness_files,
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(contract, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
mv "$SOURCE_CONTRACT_TMP" "$LANE_DIR/evidence/source-contract.json"

command -v colima >/dev/null 2>&1 || fail "colima is required"
command -v docker >/dev/null 2>&1 || fail "docker is required"

{
  printf 'node=%s\n' "$(node --version)"
  printf 'supabase_cli=%s\n' "$(env SUPABASE_TELEMETRY_DISABLED=1 supabase --version)"
  printf 'psql=%s\n' "$("$PSQL_BIN" --version)"
  printf 'git=%s\n' "$(git --version)"
  printf 'colima=%s\n' "$(colima version 2>&1 | tr '\n' ' ')"
  printf 'docker=%s\n' "$(docker --version)"
} > "$LANE_DIR/evidence/versions.txt"

NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$NODE_MAJOR" -ge 22 ]] || fail "Node.js 22 or newer is required for the Auth/PostgREST and import-RPC harness drivers"

# ---------------------------------------------------------------------------
# Mount probe (offline-only, container-visible). Confirms the disposable
# runtime path is genuinely visible from inside the container runtime
# Supabase will use, before Colima/Docker/Postgres starts. Never pulls an
# image; if none is already local, fails closed with R5_BLOCKED_ENVIRONMENT.
# ---------------------------------------------------------------------------

PROBE_FILE="$LANE_DIR/.mount-probe"
PROBE_CONTENT="gda-postal-r5-mount-probe-$SUFFIX-$LANE"
echo "$PROBE_CONTENT" > "$PROBE_FILE"
[[ "$(cat "$PROBE_FILE")" == "$PROBE_CONTENT" ]] || fail "host-side mount probe readback failed"

PROBE_IMAGE="$(docker images -q --filter 'dangling=false' | head -n1)"
[[ -n "$PROBE_IMAGE" ]] || fail "R5_BLOCKED_ENVIRONMENT: no Docker image is already available locally; the offline-only mount probe never pulls one"

set +e
CONTAINER_PROBE_OUTPUT="$(docker run --rm --pull=never \
  --entrypoint cat \
  -v "$LANE_DIR:/gda-r5-probe:ro" \
  "$PROBE_IMAGE" "/gda-r5-probe/$(basename "$PROBE_FILE")" 2>/dev/null)"
PROBE_RUN_EXIT=$?
set -e
log_cmd "docker run --rm --pull=never --entrypoint cat <local-image> <probe-file>" "$PROBE_RUN_EXIT"
[[ "$CONTAINER_PROBE_OUTPUT" == "$PROBE_CONTENT" ]] || fail "container-visible mount probe failed: Docker/Colima cannot read the disposable runtime path using an already-local image"

rm -f "$PROBE_FILE"
{
  date -u '+%Y-%m-%dT%H:%M:%SZ'
  printf 'mount_probe_path=%s\n' "$LANE_DIR"
  printf 'mount_probe_mode=container_visible_offline_only\n'
  printf 'mount_probe_result=PASS\n'
} > "$LANE_DIR/evidence/mount-probe.txt"

# ---------------------------------------------------------------------------
# Lane-distinct project id and ports. fresh/import never overlap.
# ---------------------------------------------------------------------------

SUFFIX_ALNUM="${SUFFIX//[^a-zA-Z0-9]/}"
case "$LANE" in
  fresh)  PORT_OFFSET=0  ;;
  import) PORT_OFFSET=20 ;;
esac
PROJECT_ID="gdapostalr5${SUFFIX_ALNUM}${LANE}"
API_PORT="$((BASE_PORT + PORT_OFFSET))"
DB_PORT="$((BASE_PORT + PORT_OFFSET + 1))"
SHADOW_PORT="$((BASE_PORT + PORT_OFFSET + 2))"
STUDIO_PORT="$((BASE_PORT + PORT_OFFSET + 3))"
INBUCKET_PORT="$((BASE_PORT + PORT_OFFSET + 4))"
SMTP_PORT="$((BASE_PORT + PORT_OFFSET + 5))"
POP3_PORT="$((BASE_PORT + PORT_OFFSET + 6))"
APP_PORT="$((BASE_PORT + PORT_OFFSET + 7))"

sed \
  -e "s/__R5_PROJECT_ID__/$PROJECT_ID/g" \
  -e "s/__R5_API_PORT__/$API_PORT/g" \
  -e "s/__R5_DB_PORT__/$DB_PORT/g" \
  -e "s/__R5_SHADOW_PORT__/$SHADOW_PORT/g" \
  -e "s/__R5_STUDIO_PORT__/$STUDIO_PORT/g" \
  -e "s/__R5_INBUCKET_PORT__/$INBUCKET_PORT/g" \
  -e "s/__R5_SMTP_PORT__/$SMTP_PORT/g" \
  -e "s/__R5_POP3_PORT__/$POP3_PORT/g" \
  -e "s/__R5_APP_PORT__/$APP_PORT/g" \
  "$SOURCE_DIR/config.toml" > "$LANE_DIR/supabase/config.toml"

printf '%s\n' "$PROJECT_ID" > "$LANE_DIR/evidence/project-id.txt"
printf '%s\n' "$LANE_DIR" > "$LANE_DIR/evidence/runtime-dir.txt"
printf '%s\n' "$DB_PORT" > "$LANE_DIR/evidence/db-port.txt"

if [[ -e "$LANE_DIR/supabase/.temp/project-ref" ]]; then
  fail "unexpected linked project state detected in the fresh runtime"
fi

# ---------------------------------------------------------------------------
# R5-1: stage every formal migration byte-identically (full-chain replay for
# BOTH lanes), excluding the protected LINE migration by basename only (its
# content is never opened) and excluding DRAFT_DO_NOT_APPLY entirely (a
# maxdepth-1 *.sql glob over supabase/migrations never descends into it).
# ---------------------------------------------------------------------------

STAGED_DIR="$LANE_DIR/.migrations-staged"
mkdir -p "$STAGED_DIR"

MIGRATION_MANIFEST="$LANE_DIR/evidence/migration-manifest.txt"
: > "$MIGRATION_MANIFEST"
while IFS= read -r -d '' migration; do
  base="$(basename "$migration")"
  if [[ "$base" == "$LINE_MIGRATION_BASENAME" ]]; then
    printf 'excluded_protected %s\n' "$base" >> "$MIGRATION_MANIFEST"
    continue
  fi
  cp "$migration" "$STAGED_DIR/"
  printf 'staged %s\n' "$base" >> "$MIGRATION_MANIFEST"
done < <(find "$REPO_ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

if [[ -e "$LANE_DIR/supabase/migrations/$LINE_MIGRATION_BASENAME" || -e "$STAGED_DIR/$LINE_MIGRATION_BASENAME" ]]; then
  fail "protected LINE migration must never be copied into the disposable runtime"
fi
[[ -e "$STAGED_DIR/$MIGRATION_BASENAME" ]] || fail "target postal migration was not staged"

STAGED_MIGRATION_HASH="$(shasum -a 256 "$STAGED_DIR/$MIGRATION_BASENAME" | awk '{print $1}')"
[[ "$STAGED_MIGRATION_HASH" == "$EXPECTED_MIGRATION_SHA256" ]] || fail "staged target migration hash mismatch after byte copy"

cp "$POSTAL_PGTAP_SQL" "$LANE_DIR/supabase/tests/001-jp-postal-master-rpc.test.sql"
cp "$SOURCE_DIR/runtime-contract.test.sql" "$LANE_DIR/supabase/tests/002-runtime-contract.test.sql"
cp "$SOURCE_DIR/capture-evidence.sh" "$LANE_DIR/capture-evidence.sh"
cp "$SOURCE_DIR/cleanup.sh" "$LANE_DIR/cleanup.sh"
chmod +x "$LANE_DIR/capture-evidence.sh" "$LANE_DIR/cleanup.sh"
if [[ "$LANE" == "fresh" ]]; then
  cp "$SOURCE_DIR/real-auth.mjs" "$LANE_DIR/real-auth.mjs"
else
  cp "$SOURCE_DIR/import-resume.mjs" "$LANE_DIR/import-resume.mjs"
fi

# ---------------------------------------------------------------------------
# Start the bare disposable local stack (no application migrations present
# yet). Raw start log/console output is never printed and never retained: it
# can include the local anon/service-role key banner.
# ---------------------------------------------------------------------------

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$LANE_DIR/evidence/start-attempted.txt"

START_LOG="$LANE_DIR/evidence/.start.raw.log"
set +e
env SUPABASE_TELEMETRY_DISABLED=1 supabase start --workdir "$LANE_DIR" > "$START_LOG" 2>&1
START_EXIT=$?
set -e
log_cmd "supabase start --workdir <lane>" "$START_EXIT"
rm -f "$START_LOG"
[[ "$START_EXIT" -eq 0 ]] || fail "supabase start failed (bare project, no application migrations yet)"

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$LANE_DIR/evidence/start-succeeded.txt"

env SUPABASE_TELEMETRY_DISABLED=1 supabase status --workdir "$LANE_DIR" -o env > "$LANE_DIR/evidence/supabase-status.env"
log_cmd "supabase status --workdir <lane> -o env" "$?"

set -a
source "$LANE_DIR/evidence/supabase-status.env"
set +a

case "${API_URL:-${SUPABASE_URL:-}}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) fail "API endpoint is not loopback-only" ;;
esac
case "${DB_URL:-}" in
  postgresql://*127.0.0.1:*|postgresql://*localhost:*) ;;
  *) fail "database endpoint is not loopback-only" ;;
esac

# Move staged migrations into place and replay the FULL chain CLI-natively.
mv "$STAGED_DIR"/*.sql "$LANE_DIR/supabase/migrations/" 2>/dev/null || true
rmdir "$STAGED_DIR" 2>/dev/null || true

RESET_LOG="$LANE_DIR/evidence/.db-reset.raw.log"
set +e
env SUPABASE_TELEMETRY_DISABLED=1 supabase db reset --local --no-seed --yes --workdir "$LANE_DIR" > "$RESET_LOG" 2>&1
RESET_EXIT=$?
set -e
log_cmd "supabase db reset --local --no-seed --yes --workdir <lane> (full chain)" "$RESET_EXIT"
rm -f "$RESET_LOG"
[[ "$RESET_EXIT" -eq 0 ]] || fail "R5_BLOCKED_OR_CHANGES_REQUIRED_SOURCE: supabase db reset --local (full chain) failed with exit $RESET_EXIT"

# `supabase migration list` prints a Local/Remote-column table keyed by exact
# 14-digit version, not a full-filename listing. The line containing the
# target version is isolated, then the version substring is counted within
# that single line: 2 occurrences means the version appears in both columns
# (applied exactly once), 1 or 0 is a failure for a lane that just replayed
# the full chain. Delimiter-agnostic (tabs/spaces/pipes all work).
LIST_LOG="$LANE_DIR/evidence/migration-list-after-reset.txt"
set +e
env SUPABASE_TELEMETRY_DISABLED=1 supabase migration list --local --workdir "$LANE_DIR" > "$LIST_LOG" 2>&1
LIST_EXIT=$?
set -e
log_cmd "supabase migration list --local --workdir <lane> (post-reset check)" "$LIST_EXIT"
[[ "$LIST_EXIT" -eq 0 ]] || fail "supabase migration list --local failed after reset with exit $LIST_EXIT"

LIST_STATE="$(python3 - "$LIST_LOG" "$MIGRATION_VERSION" <<'PY'
import sys
log_path, version = sys.argv[1:3]
with open(log_path, encoding="utf-8", errors="replace") as handle:
    text = handle.read()
matches = [line for line in text.splitlines() if version in line]
if not matches:
    print("ABSENT")
else:
    occurrences = matches[-1].count(version)
    print("BOTH" if occurrences >= 2 else "LOCAL_ONLY")
PY
)"
[[ "$LIST_STATE" == "BOTH" ]] || fail "R5_MIGRATION_LIST_PROOF_FAILED: expected target version $MIGRATION_VERSION to be Local+Remote (applied exactly once) after full-chain reset, observed $LIST_STATE"

# Independent, read-only, CLI-agnostic corroboration: query the CLI's own
# ledger table directly via psql (SELECT only -- never an apply).
set +e
LEDGER_COUNT="$("$PSQL_BIN" "${DB_URL:-}" -X -v ON_ERROR_STOP=1 -At -c \
  "select count(*) from supabase_migrations.schema_migrations where version = '$MIGRATION_VERSION';")"
LEDGER_COUNT_EXIT=$?
set -e
log_cmd "psql read-only ledger count after reset (supabase_migrations.schema_migrations)" "$LEDGER_COUNT_EXIT"
[[ "$LEDGER_COUNT_EXIT" -eq 0 ]] || fail "read-only ledger-count proof query failed after reset"
[[ "$LEDGER_COUNT" == "1" ]] || fail "R5_MIGRATION_LIST_PROOF_FAILED: expected exactly one ledger row for $MIGRATION_VERSION after reset, found $LEDGER_COUNT"

{
  printf 'migration_version=%s\n' "$MIGRATION_VERSION"
  printf 'migration_list_state_after_reset=%s (expected BOTH)\n' "$LIST_STATE"
  printf 'ledger_count_after_reset=%s (expected 1, read-only psql SELECT against supabase_migrations.schema_migrations)\n' "$LEDGER_COUNT"
} > "$LANE_DIR/evidence/migration-list-proof.txt"

printf 'R5_LANE_READY=%s\n' "$LANE_DIR"
printf 'R5_LANE=%s\n' "$LANE"
printf 'R5_PROJECT_ID=%s\n' "$PROJECT_ID"
printf 'R5_DB_PORT=%s\n' "$DB_PORT"
