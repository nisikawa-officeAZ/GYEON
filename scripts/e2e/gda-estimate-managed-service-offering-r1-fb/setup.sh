#!/usr/bin/env bash
set -euo pipefail

# GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_FB setup. Source-only. Execution
# requires a separate explicit runtime approval. It creates one fresh
# disposable runtime outside the repository worktree and starts only that
# local project. It never links to, resets, or otherwise contacts a
# hosted/shared/production Supabase project.
#
# This script does not execute pgTAP, real Auth, concurrency, evidence
# capture, or cleanup. It only prepares the runtime and starts the local
# stack; those later stages are wired by capture-evidence.sh and cleanup.sh.
#
# Structurally adapted, without mutation, from the accepted
# scripts/e2e/gda-estimate-managed-service-offering-r1-b/setup.sh (fresh
# unique naming, source-identity gates, offline-only mount probe, attributed
# per-migration psql -f replay). It copies no GYEON-order or R1-B fixture,
# table, RPC name, or evidence vocabulary beyond the shared repository schema
# every sibling harness in this family already exercises.
#
# FB-SPECIFIC DIFFERENCE FROM R1-B: the migration under test is not a
# committed direct-target migration. It is a forward bridge constructed from
# a captured live-Production function definition held in a private,
# owner-approved evidence root outside Git. This script therefore adds one
# additional hard gate -- the private evidence manifest hash -- before any
# runtime is created, and never copies private evidence content into the
# disposable runtime; only its SHA-256 manifest identity is verified.

CONFIRM_LITERAL="I_UNDERSTAND_GDA_ESTIMATE_OFFERING_FB_IS_DISPOSABLE"
REPO_ROOT="${GDA_ESTIMATE_OFFERING_FB_REPO_ROOT:-}"
RUNTIME_PARENT="${GDA_ESTIMATE_OFFERING_FB_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
SUFFIX="${GDA_ESTIMATE_OFFERING_FB_SUFFIX:-}"
BASE_PORT="${GDA_ESTIMATE_OFFERING_FB_BASE_PORT:-57720}"

# The exact accepted governance execution HEAD/tree and the exact accepted
# source-candidate hashes for the source-of-truth paths this harness proves.
# None of these is ever hard-coded here: a caller that forgets to supply one
# fails closed rather than silently reusing a stale literal, and this script
# never starts against any other HEAD/tree/hash combination even if some of
# the individual checks below would still pass.
EXPECTED_EXECUTION_HEAD="${GDA_ESTIMATE_OFFERING_FB_EXPECTED_HEAD:-}"
EXPECTED_EXECUTION_TREE="${GDA_ESTIMATE_OFFERING_FB_EXPECTED_TREE:-}"
EXPECTED_MIGRATION_SHA256="${GDA_ESTIMATE_OFFERING_FB_EXPECTED_MIGRATION_SHA256:-}"
EXPECTED_PGTAP_TEST_SHA256="${GDA_ESTIMATE_OFFERING_FB_EXPECTED_PGTAP_TEST_SHA256:-}"

# Private R0/FB-G1/FB-I1 evidence identity. The evidence root itself lives
# outside Git and outside this runtime; only its manifest hash is checked,
# and only hashes -- never full private function contents -- are ever
# written into evidence produced by this harness.
EXPECTED_PRIVATE_EVIDENCE_MANIFEST_SHA256="${GDA_ESTIMATE_OFFERING_FB_EXPECTED_PRIVATE_EVIDENCE_MANIFEST_SHA256:-}"
PRIVATE_EVIDENCE_ROOT="${GDA_ESTIMATE_OFFERING_FB_PRIVATE_EVIDENCE_ROOT:-}"

LINE_MIGRATION_BASENAME="20260801110110_line_link_tokens.sql"
FB_MIGRATION_BASENAME="20260830121816_estimate_managed_service_production_forward_bridge.sql"

PROTECTED_PATH_BLOBS=(
  "src/components/estimates/wizard/screens/ScreensPreview.tsx:c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f"
  "supabase/migrations/20260801110110_line_link_tokens.sql:accd22345054cc44f89156fd78eaba6dfe4242a4"
  "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql:32fda49583ae1217bc13711784ad8fa31744726c"
  "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts:fe3c80f22fd80dcbfab076082473216dda582c14"
)

fail() {
  printf 'FB_SETUP_ERROR: %s\n' "$1" >&2
  # Burn the suffix/evidence set on any failure. The same suffix is never
  # repaired or reused; a fresh owner-approved attempt requires a fresh
  # suffix. cleanup.sh may still tear down a burned suffix's containers and
  # runtime path exactly once; it never repairs or reruns it.
  if [[ -n "${RUNTIME_DIR:-}" ]]; then
    mkdir -p "$RUNTIME_DIR/evidence"
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "$RUNTIME_DIR/evidence/burned.txt"
    printf '%s\n' "$1" >> "$RUNTIME_DIR/evidence/burned.txt"
  fi
  exit 1
}

# Every external command this script runs, and its exit code, is appended
# here. cleanup.sh folds this into the final manifest.
COMMAND_LEDGER=""
log_cmd() {
  # log_cmd <description> <exit_code>
  if [[ -n "${RUNTIME_DIR:-}" ]]; then
    mkdir -p "$RUNTIME_DIR/evidence"
    python3 -c "
import json, sys
with open('$RUNTIME_DIR/evidence/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'setup.sh', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$1" "$2"
  fi
}

[[ "${GDA_ESTIMATE_OFFERING_FB_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$EXPECTED_EXECUTION_HEAD" ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_HEAD is required and must not be blank"
[[ "$EXPECTED_EXECUTION_HEAD" =~ ^[0-9a-f]{40}$ ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_HEAD must be a 40-character hex commit SHA"
[[ -n "$EXPECTED_EXECUTION_TREE" ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_TREE is required and must not be blank"
[[ "$EXPECTED_EXECUTION_TREE" =~ ^[0-9a-f]{40}$ ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_TREE must be a 40-character hex tree SHA"
[[ -n "$EXPECTED_MIGRATION_SHA256" ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_MIGRATION_SHA256 is required"
[[ "$EXPECTED_MIGRATION_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_MIGRATION_SHA256 must be a 64-character hex SHA-256"
[[ -n "$EXPECTED_PGTAP_TEST_SHA256" ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_PGTAP_TEST_SHA256 is required"
[[ "$EXPECTED_PGTAP_TEST_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_PGTAP_TEST_SHA256 must be a 64-character hex SHA-256"
[[ -n "$EXPECTED_PRIVATE_EVIDENCE_MANIFEST_SHA256" ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_PRIVATE_EVIDENCE_MANIFEST_SHA256 is required"
[[ "$EXPECTED_PRIVATE_EVIDENCE_MANIFEST_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "GDA_ESTIMATE_OFFERING_FB_EXPECTED_PRIVATE_EVIDENCE_MANIFEST_SHA256 must be a 64-character hex SHA-256"
[[ -n "$PRIVATE_EVIDENCE_ROOT" ]] || fail "GDA_ESTIMATE_OFFERING_FB_PRIVATE_EVIDENCE_ROOT is required"
[[ -d "$PRIVATE_EVIDENCE_ROOT" ]] || fail "GDA_ESTIMATE_OFFERING_FB_PRIVATE_EVIDENCE_ROOT is not a directory"
[[ -n "$REPO_ROOT" ]] || fail "GDA_ESTIMATE_OFFERING_FB_REPO_ROOT is required"
[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "repo root is not a git worktree"
[[ -n "$SUFFIX" ]] || fail "GDA_ESTIMATE_OFFERING_FB_SUFFIX is required"
[[ "$SUFFIX" =~ ^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "suffix must be fresh UTC timestamp plus six lowercase alphanumerics"
[[ "$BASE_PORT" =~ ^[0-9]+$ ]] || fail "base port must be numeric"

# The runtime must live outside the Git worktree and outside /private/tmp.
case "$RUNTIME_PARENT" in
  /private/tmp|/private/tmp/*) fail "runtime parent must not be under /private/tmp" ;;
esac
case "$RUNTIME_PARENT" in
  "$REPO_ROOT"|"$REPO_ROOT"/*) fail "runtime parent must be outside the Git worktree" ;;
esac

RUNTIME_DIR="$RUNTIME_PARENT/gda-estimate-offering-fb.$SUFFIX"
[[ "$RUNTIME_DIR" == "$RUNTIME_PARENT"/gda-estimate-offering-fb.* ]] || fail "runtime path escaped the dedicated prefix"
[[ ! -e "$RUNTIME_DIR" ]] || fail "runtime suffix is already burned; choose a fresh suffix"

# ---------------------------------------------------------------------------
# FB-0: source integrity preflight. No local/hosted DB is contacted yet.
# ---------------------------------------------------------------------------

command -v git >/dev/null 2>&1 || fail "git is required"
command -v supabase >/dev/null 2>&1 || fail "supabase CLI is required"
command -v node >/dev/null 2>&1 || fail "node is required"
command -v psql >/dev/null 2>&1 || fail "psql client is required"
command -v shasum >/dev/null 2>&1 || fail "shasum is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"

CURRENT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
CURRENT_TREE="$(git -C "$REPO_ROOT" rev-parse HEAD^{tree})"
GIT_STATUS="$(git -C "$REPO_ROOT" status --porcelain=v1)"

[[ "$CURRENT_HEAD" == "$EXPECTED_EXECUTION_HEAD" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: execution HEAD $CURRENT_HEAD does not match the invocation-supplied accepted HEAD $EXPECTED_EXECUTION_HEAD"
[[ "$CURRENT_TREE" == "$EXPECTED_EXECUTION_TREE" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: execution tree $CURRENT_TREE does not match the invocation-supplied accepted tree $EXPECTED_EXECUTION_TREE"

SOURCE_DIR="$REPO_ROOT/scripts/e2e/gda-estimate-managed-service-offering-r1-fb"
FB_MIGRATION="$REPO_ROOT/supabase/migrations/$FB_MIGRATION_BASENAME"
PGTAP_TEST="$REPO_ROOT/supabase/tests/estimate_wizard_atomic_save.test.sql"
[[ -f "$SOURCE_DIR/config.toml" ]] || fail "FB config template is missing"
[[ -f "$FB_MIGRATION" ]] || fail "the FB forward-bridge migration is missing"
[[ -f "$PGTAP_TEST" ]] || fail "the extended pgTAP file is missing"
[[ -f "$SOURCE_DIR/offering-guard.test.sql" ]] || fail "the offering-guard harness test is missing"

# The index and worktree must be exactly clean before any disposable runtime
# is created. An uncommitted candidate is never executed.
[[ -z "$GIT_STATUS" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: worktree/index is not clean"

UPSTREAM_REF="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
[[ -n "$UPSTREAM_REF" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: no upstream tracking ref is configured for this branch"
AHEAD_BEHIND="$(git -C "$REPO_ROOT" rev-list --left-right --count "@{u}...HEAD" 2>/dev/null)" || fail "FB_NOT_STARTED_SOURCE_DRIFT: upstream ahead/behind could not be computed"
[[ "$AHEAD_BEHIND" == $'0\t0' ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: upstream ahead/behind is not exactly 0 0 (got: $AHEAD_BEHIND)"

MIGRATION_HASH="$(shasum -a 256 "$FB_MIGRATION" | awk '{print $1}')"
PGTAP_HASH="$(shasum -a 256 "$PGTAP_TEST" | awk '{print $1}')"
OFFERING_GUARD_TEST="$SOURCE_DIR/offering-guard.test.sql"
OFFERING_GUARD_HASH="$(shasum -a 256 "$OFFERING_GUARD_TEST" | awk '{print $1}')"
[[ "$MIGRATION_HASH" == "$EXPECTED_MIGRATION_SHA256" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: forward-bridge migration hash mismatch"
[[ "$PGTAP_HASH" == "$EXPECTED_PGTAP_TEST_SHA256" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: pgTAP test hash mismatch"

HEAD_MIGRATION_HASH="$(git -C "$REPO_ROOT" show "HEAD:supabase/migrations/$FB_MIGRATION_BASENAME" 2>/dev/null | shasum -a 256 | awk '{print $1}')"
[[ "$HEAD_MIGRATION_HASH" == "$EXPECTED_MIGRATION_SHA256" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: committed forward-bridge migration blob mismatch"
HEAD_PGTAP_HASH="$(git -C "$REPO_ROOT" show "HEAD:supabase/tests/estimate_wizard_atomic_save.test.sql" 2>/dev/null | shasum -a 256 | awk '{print $1}')"
[[ "$HEAD_PGTAP_HASH" == "$EXPECTED_PGTAP_TEST_SHA256" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: committed pgTAP test blob mismatch"

# ---------------------------------------------------------------------------
# FB-0b: private evidence manifest gate. The forward bridge is constructed
# from a captured live-Production function definition, not from a committed
# direct-target migration, so the disposable harness additionally proves it
# is still bound to the exact accepted private evidence identity before any
# runtime is created. Only the manifest hash and per-file shasum -c result
# are checked; no private file content is ever copied into the runtime or
# retained evidence.
# ---------------------------------------------------------------------------

[[ -f "$PRIVATE_EVIDENCE_ROOT/SHA256SUMS.txt" ]] || fail "FB_BLOCKED_EVIDENCE: private evidence manifest is missing"
PRIVATE_MANIFEST_HASH="$(shasum -a 256 "$PRIVATE_EVIDENCE_ROOT/SHA256SUMS.txt" | awk '{print $1}')"
[[ "$PRIVATE_MANIFEST_HASH" == "$EXPECTED_PRIVATE_EVIDENCE_MANIFEST_SHA256" ]] || fail "FB_BLOCKED_EVIDENCE: private evidence manifest hash mismatch"

set +e
PRIVATE_MANIFEST_CHECK="$(cd "$PRIVATE_EVIDENCE_ROOT" && shasum -a 256 -c SHA256SUMS.txt 2>&1)"
PRIVATE_MANIFEST_CHECK_EXIT=$?
set -e
log_cmd "shasum -a 256 -c <private-evidence-root>/SHA256SUMS.txt" "$PRIVATE_MANIFEST_CHECK_EXIT"
[[ "$PRIVATE_MANIFEST_CHECK_EXIT" -eq 0 ]] || fail "FB_BLOCKED_EVIDENCE: private evidence manifest verification failed"
PRIVATE_MANIFEST_PASS_COUNT="$(printf '%s\n' "$PRIVATE_MANIFEST_CHECK" | grep -c ': OK$' || true)"
printf 'private_evidence_manifest_sha256=%s (hard-gated)\n' "$PRIVATE_MANIFEST_HASH" > "$RUNTIME_DIR.privatecheck.tmp" 2>/dev/null || true
rm -f "$RUNTIME_DIR.privatecheck.tmp" 2>/dev/null || true

# Reject a linked/hosted project state before any runtime is created.
[[ ! -e "$REPO_ROOT/supabase/.temp/project-ref" ]] || fail "repository has a linked Supabase project reference"

mkdir -p "$RUNTIME_DIR/supabase/migrations"
mkdir -p "$RUNTIME_DIR/supabase/tests"
mkdir -p "$RUNTIME_DIR/evidence"

{
  printf 'repo_root=%s\n' "$REPO_ROOT"
  printf 'head=%s (hard-gated == %s)\n' "$CURRENT_HEAD" "$EXPECTED_EXECUTION_HEAD"
  printf 'tree=%s (hard-gated == %s)\n' "$CURRENT_TREE" "$EXPECTED_EXECUTION_TREE"
  printf 'branch=%s\n' "$(git -C "$REPO_ROOT" branch --show-current)"
  printf 'upstream=%s\n' "$UPSTREAM_REF"
  printf 'ahead_behind_of_upstream=%s\n' "$AHEAD_BEHIND"
  printf 'worktree_status_lines=0 (clean, hard-gated above)\n'
  printf 'forward_bridge_migration_sha256=%s (hard-gated)\n' "$MIGRATION_HASH"
  printf 'pgtap_test_sha256=%s (hard-gated)\n' "$PGTAP_HASH"
  printf 'offering_guard_test_sha256=%s\n' "$OFFERING_GUARD_HASH"
  printf 'private_evidence_manifest_sha256=%s (hard-gated)\n' "$PRIVATE_MANIFEST_HASH"
  printf 'private_evidence_manifest_check=%s of expected OK lines\n' "$PRIVATE_MANIFEST_PASS_COUNT"
} > "$RUNTIME_DIR/evidence/source-hashes.sha256"

{
  for entry in "${PROTECTED_PATH_BLOBS[@]}"; do
    path="${entry%%:*}"
    expected_blob="${entry##*:}"
    ls_line="$(git -C "$REPO_ROOT" ls-tree HEAD -- "$path")"
    status_line="$(git -C "$REPO_ROOT" status --porcelain -- "$path")"
    printf 'path=%s\n' "$path"
    printf '  ls-tree HEAD: %s\n' "${ls_line:-<missing from HEAD>}"
    printf '  status: %s\n' "${status_line:-<clean>}"
    printf '  expected_blob: %s\n' "$expected_blob"
  done
} > "$RUNTIME_DIR/evidence/protected-paths.txt"

# Fail-closed protected-path gate: exact mode 100644, exact blob, and no Git
# status entry for each protected path. Recording metadata above is evidence,
# not an acceptance gate; this loop is the gate.
for entry in "${PROTECTED_PATH_BLOBS[@]}"; do
  path="${entry%%:*}"
  expected_blob="${entry##*:}"
  ls_line="$(git -C "$REPO_ROOT" ls-tree HEAD -- "$path")"
  [[ -n "$ls_line" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: protected path missing from HEAD: $path"
  actual_mode="$(printf '%s' "$ls_line" | awk '{print $1}')"
  actual_blob="$(printf '%s' "$ls_line" | awk '{print $3}')"
  [[ "$actual_mode" == "100644" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: protected path mode is not 100644: $path"
  [[ "$actual_blob" == "$expected_blob" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: protected path blob mismatch: $path"
  status_line="$(git -C "$REPO_ROOT" status --porcelain -- "$path")"
  [[ -z "$status_line" ]] || fail "FB_NOT_STARTED_SOURCE_DRIFT: protected path has a Git status entry: $path"
done

{
  printf 'node=%s\n' "$(node --version)"
  printf 'supabase_cli=%s\n' "$(supabase --version)"
  printf 'psql=%s\n' "$(psql --version)"
  printf 'git=%s\n' "$(git --version)"
  if command -v colima >/dev/null 2>&1; then printf 'colima=%s\n' "$(colima version 2>&1 | tr '\n' ' ')"; fi
  if command -v docker >/dev/null 2>&1; then printf 'docker=%s\n' "$(docker --version)"; fi
} > "$RUNTIME_DIR/evidence/versions.txt"

NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  fail "Node.js 22 or newer is required for the Auth/PostgREST harness"
fi

# ---------------------------------------------------------------------------
# Mount probe. Confirm the disposable runtime path is genuinely visible from
# INSIDE the container runtime Supabase will use, before any Colima/Docker/
# Postgres process starts, and before protected content is ever approached.
# Offline-only: never pulls an image; fails closed if none is already local.
# ---------------------------------------------------------------------------

command -v docker >/dev/null 2>&1 || fail "docker is required for the container-visible mount probe"

PROBE_FILE="$RUNTIME_DIR/.mount-probe"
PROBE_CONTENT="gda-estimate-offering-fb-mount-probe-$SUFFIX"
echo "$PROBE_CONTENT" > "$PROBE_FILE"
[[ "$(cat "$PROBE_FILE")" == "$PROBE_CONTENT" ]] || fail "host-side mount probe readback failed"

PROBE_IMAGE="$(docker images -q --filter 'dangling=false' | head -n1)"
[[ -n "$PROBE_IMAGE" ]] || fail "FB_BLOCKED_ENVIRONMENT: no Docker image is already available locally; the offline-only mount probe never pulls one"

set +e
CONTAINER_PROBE_OUTPUT="$(docker run --rm --pull=never \
  --entrypoint cat \
  -v "$RUNTIME_DIR:/gda-fb-probe:ro" \
  "$PROBE_IMAGE" "/gda-fb-probe/$(basename "$PROBE_FILE")" 2>/dev/null)"
PROBE_RUN_EXIT=$?
set -e
log_cmd "docker run --rm --pull=never --entrypoint cat <local-image> <probe-file>" "$PROBE_RUN_EXIT"
[[ "$CONTAINER_PROBE_OUTPUT" == "$PROBE_CONTENT" ]] || fail "container-visible mount probe failed: Docker/Colima cannot read the disposable runtime path using an already-local image"

rm -f "$PROBE_FILE"
{
  date -u '+%Y-%m-%dT%H:%M:%SZ'
  printf 'mount_probe_path=%s\n' "$RUNTIME_DIR"
  printf 'mount_probe_mode=container_visible_offline_only\n'
  printf 'mount_probe_image=%s (pre-existing local image id, never pulled)\n' "$PROBE_IMAGE"
  printf 'mount_probe_result=PASS\n'
} > "$RUNTIME_DIR/evidence/mount-probe.txt"

# ---------------------------------------------------------------------------
# FB-1 (part 1): stage every formal migration, excluding only the protected
# LINE migration, in a holding directory (never copied directly into
# supabase/migrations/), so `supabase start` below brings up a bare project
# with no application schema. Each migration is then applied individually via
# a direct psql -f invocation, giving exact per-migration start time, finish
# time, exit code, and (on failure) SQLSTATE.
#
# The forward-bridge migration is an ordinary forward-only file (no
# DRAFT_DO_NOT_APPLY guard, no terminal ROLLBACK->COMMIT transform): it is
# staged and applied byte-identical to the committed blob, in filename order
# together with every other non-excluded migration. The historical
# 20260830160000 guard migration is NOT excluded here: both it and the new
# forward-bridge migration produce a byte-identical accepted function body,
# so replaying both in filename order is idempotent and does not change the
# final schema/function state.
# ---------------------------------------------------------------------------

STAGED_MIGRATIONS_DIR="$RUNTIME_DIR/.migrations-staged"
mkdir -p "$STAGED_MIGRATIONS_DIR"

MIGRATION_MANIFEST="$RUNTIME_DIR/evidence/migration-manifest.txt"
: > "$MIGRATION_MANIFEST"
while IFS= read -r -d '' migration; do
  base="$(basename "$migration")"
  if [[ "$base" == "$LINE_MIGRATION_BASENAME" ]]; then
    printf 'excluded_protected %s\n' "$base" >> "$MIGRATION_MANIFEST"
    continue
  fi
  cp "$migration" "$STAGED_MIGRATIONS_DIR/"
  printf 'staged %s\n' "$base" >> "$MIGRATION_MANIFEST"
done < <(find "$REPO_ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

if [[ -e "$RUNTIME_DIR/supabase/migrations/$LINE_MIGRATION_BASENAME" || -e "$STAGED_MIGRATIONS_DIR/$LINE_MIGRATION_BASENAME" ]]; then
  fail "protected LINE migration must never be copied into the disposable runtime"
fi
if ! grep -q "^staged $FB_MIGRATION_BASENAME\$" "$MIGRATION_MANIFEST"; then
  fail "FB_NOT_STARTED_SOURCE_DRIFT: the FB forward-bridge migration was not staged for replay"
fi

MIGRATION_OUTCOME="$RUNTIME_DIR/evidence/migration-replay-outcome.ndjson"
: > "$MIGRATION_OUTCOME"
grep '^excluded_protected ' "$MIGRATION_MANIFEST" | while IFS= read -r line; do
  name="${line#excluded_protected }"
  python3 -c "import json; print(json.dumps({'migration': '$name', 'status': 'excluded_protected', 'started_at': None, 'finished_at': None, 'exit_code': None, 'sqlstate': None}))" >> "$MIGRATION_OUTCOME"
done

# ---------------------------------------------------------------------------
# FB verification assets. Only the seven harness paths and the two source
# paths (forward-bridge migration, extended pgTAP test) participate;
# application UI and ScreensPreview.tsx are never copied.
# ---------------------------------------------------------------------------

# Both pgTAP authorities are copied and are each executed independently and
# strictly by capture-evidence.sh: the extended canonical atomic-save file
# (000-) and the dedicated offering-guard file (001-). Hashing the canonical
# file alone is never treated as proof that it ran.
cp "$PGTAP_TEST" "$RUNTIME_DIR/supabase/tests/000-canonical-atomic-save.test.sql"
cp "$SOURCE_DIR/offering-guard.test.sql" "$RUNTIME_DIR/supabase/tests/001-offering-guard.test.sql"
cp "$SOURCE_DIR/real-auth.mjs" "$RUNTIME_DIR/real-auth.mjs"
cp "$SOURCE_DIR/concurrency.mjs" "$RUNTIME_DIR/concurrency.mjs"
cp "$SOURCE_DIR/capture-evidence.sh" "$RUNTIME_DIR/capture-evidence.sh"
cp "$SOURCE_DIR/cleanup.sh" "$RUNTIME_DIR/cleanup.sh"
chmod +x "$RUNTIME_DIR/capture-evidence.sh" "$RUNTIME_DIR/cleanup.sh"

PROJECT_ID="gdaofffb${SUFFIX//[^a-zA-Z0-9]/}"
API_PORT="$BASE_PORT"
DB_PORT="$((BASE_PORT + 1))"
SHADOW_PORT="$((BASE_PORT + 2))"
STUDIO_PORT="$((BASE_PORT + 3))"
INBUCKET_PORT="$((BASE_PORT + 4))"
SMTP_PORT="$((BASE_PORT + 5))"
POP3_PORT="$((BASE_PORT + 6))"
APP_PORT="$((BASE_PORT + 7))"

sed \
  -e "s/__FB_PROJECT_ID__/$PROJECT_ID/g" \
  -e "s/__FB_API_PORT__/$API_PORT/g" \
  -e "s/__FB_DB_PORT__/$DB_PORT/g" \
  -e "s/__FB_SHADOW_PORT__/$SHADOW_PORT/g" \
  -e "s/__FB_STUDIO_PORT__/$STUDIO_PORT/g" \
  -e "s/__FB_INBUCKET_PORT__/$INBUCKET_PORT/g" \
  -e "s/__FB_SMTP_PORT__/$SMTP_PORT/g" \
  -e "s/__FB_POP3_PORT__/$POP3_PORT/g" \
  -e "s/__FB_APP_PORT__/$APP_PORT/g" \
  "$SOURCE_DIR/config.toml" > "$RUNTIME_DIR/supabase/config.toml"

printf '%s\n' "$PROJECT_ID" > "$RUNTIME_DIR/evidence/project-id.txt"
printf '%s\n' "$RUNTIME_DIR" > "$RUNTIME_DIR/evidence/runtime-dir.txt"
printf '%s\n' "$DB_PORT" > "$RUNTIME_DIR/evidence/db-port.txt"

if [[ -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]]; then
  fail "unexpected linked project state detected in the fresh runtime"
fi

# ---------------------------------------------------------------------------
# FB-1 (part 2): start the disposable local stack with NO application
# migrations present yet, so `supabase start` only brings up the bare
# Supabase project. The raw start log/console output is never printed and
# never retained: it can include the local anon/service-role key banner.
# ---------------------------------------------------------------------------

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$RUNTIME_DIR/evidence/start-attempted.txt"

START_LOG="$RUNTIME_DIR/evidence/.start.raw.log"
set +e
env SUPABASE_TELEMETRY_DISABLED=1 supabase start --workdir "$RUNTIME_DIR" > "$START_LOG" 2>&1
START_EXIT=$?
set -e
log_cmd "supabase start --workdir <runtime>" "$START_EXIT"
rm -f "$START_LOG"
[[ "$START_EXIT" -eq 0 ]] || fail "supabase start failed (bare project, no application migrations yet); raw output was captured only long enough to determine the exit code and was never printed or retained"

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$RUNTIME_DIR/evidence/start-succeeded.txt"

env SUPABASE_TELEMETRY_DISABLED=1 supabase status --workdir "$RUNTIME_DIR" -o env > "$RUNTIME_DIR/evidence/supabase-status.env"
log_cmd "supabase status --workdir <runtime> -o env" "$?"

set -a
source "$RUNTIME_DIR/evidence/supabase-status.env"
set +a

MIGRATION_LEDGER_INIT_LOG="$RUNTIME_DIR/evidence/.migration-ledger-init.raw.log"
set +e
psql "${DB_URL:-}" -X -v ON_ERROR_STOP=1 -q > "$MIGRATION_LEDGER_INIT_LOG" 2>&1 <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
alter table supabase_migrations.schema_migrations
  add column if not exists statements text[];
alter table supabase_migrations.schema_migrations
  add column if not exists name text;
SQL
MIGRATION_LEDGER_INIT_EXIT=$?
set -e
log_cmd "psql initialise supabase_migrations.schema_migrations" "$MIGRATION_LEDGER_INIT_EXIT"
[[ "$MIGRATION_LEDGER_INIT_EXIT" -eq 0 ]] || fail "schema_migrations ledger initialisation failed with exit $MIGRATION_LEDGER_INIT_EXIT"
rm -f "$MIGRATION_LEDGER_INIT_LOG"

# ---------------------------------------------------------------------------
# FB-1 (part 3): apply each staged migration individually via a direct
# psql -f invocation, in filename order. Start time, finish time, exit code,
# and (on failure) SQLSTATE are captured per migration, directly from this
# invocation.
# ---------------------------------------------------------------------------

: > "$MIGRATION_OUTCOME"
grep '^excluded_protected ' "$MIGRATION_MANIFEST" | while IFS= read -r line; do
  name="${line#excluded_protected }"
  python3 -c "import json; print(json.dumps({'migration': '$name', 'status': 'excluded_protected', 'started_at': None, 'finished_at': None, 'exit_code': None, 'sqlstate': None}))" >> "$MIGRATION_OUTCOME"
done

STAGED_FILES=()
while IFS= read -r -d '' staged_file; do STAGED_FILES+=("$staged_file"); done < <(find "$STAGED_MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

for staged_index in "${!STAGED_FILES[@]}"; do
  staged_file="${STAGED_FILES[$staged_index]}"
  migration_name="$(basename "$staged_file")"
  started_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  PER_MIGRATION_LOG="$RUNTIME_DIR/evidence/.migration-apply.raw.log"
  set +e
  psql "${DB_URL:-}" -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f "$staged_file" > "$PER_MIGRATION_LOG" 2>&1
  MIGRATION_EXIT=$?
  set -e
  finished_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  log_cmd "psql -f $migration_name" "$MIGRATION_EXIT"

  sqlstate=""
  if [[ "$MIGRATION_EXIT" -ne 0 ]]; then
    sqlstate="$(python3 -c "
import re
with open('$PER_MIGRATION_LOG', encoding='utf-8', errors='replace') as handle:
    text = handle.read()
match = re.search(r'ERROR:\s*([0-9A-Z]{5}):', text)
if not match:
    match = re.search(r'SQLSTATE[:\s]+([0-9A-Za-z]{5})', text, re.IGNORECASE)
print(match.group(1) if match else '')
")"
  fi
  set +e
  python3 - "$migration_name" "$started_at" "$finished_at" "$MIGRATION_EXIT" "$sqlstate" >> "$MIGRATION_OUTCOME" <<'PY'
import json
import sys

migration, started_at, finished_at, exit_code_raw, sqlstate_raw = sys.argv[1:6]
exit_code = int(exit_code_raw)
print(json.dumps({
    'migration': migration,
    'status': 'applied' if exit_code == 0 else 'failed',
    'started_at': started_at,
    'finished_at': finished_at,
    'exit_code': exit_code,
    'sqlstate': sqlstate_raw or None,
}))
PY
  MIGRATION_OUTCOME_WRITE_EXIT=$?
  set -e
  log_cmd "python3 append migration outcome ($migration_name)" "$MIGRATION_OUTCOME_WRITE_EXIT"
  [[ "$MIGRATION_OUTCOME_WRITE_EXIT" -eq 0 ]] || fail "migration outcome serialization failed for $migration_name with exit $MIGRATION_OUTCOME_WRITE_EXIT"
  rm -f "$PER_MIGRATION_LOG"

  if [[ "$MIGRATION_EXIT" -ne 0 ]]; then
    for remaining_index in "${!STAGED_FILES[@]}"; do
      if [[ "$remaining_index" -gt "$staged_index" ]]; then
        remaining_name="$(basename "${STAGED_FILES[$remaining_index]}")"
        python3 -c "import json; print(json.dumps({'migration': '$remaining_name', 'status': 'not_reached', 'started_at': None, 'finished_at': None, 'exit_code': None, 'sqlstate': None}))" >> "$MIGRATION_OUTCOME"
      fi
    done
    if [[ "$migration_name" == "$FB_MIGRATION_BASENAME" ]]; then
      fail "FB_CHANGES_REQUIRED_SOURCE: the FB forward-bridge migration failed with exit $MIGRATION_EXIT; see migration-replay-outcome.ndjson for its captured SQLSTATE"
    else
      fail "FB_BASELINE_BLOCKED: baseline migration $migration_name failed with exit $MIGRATION_EXIT; see migration-replay-outcome.ndjson for its captured SQLSTATE"
    fi
  fi

  cp "$staged_file" "$RUNTIME_DIR/supabase/migrations/"
  version="$(printf '%s' "$migration_name" | sed -nE 's/^([0-9]{14}).*/\1/p')"
  if [[ -n "$version" ]]; then
    MIGRATION_LEDGER_INSERT_LOG="$RUNTIME_DIR/evidence/.migration-ledger-insert.raw.log"
    set +e
    psql "${DB_URL:-}" -X -v ON_ERROR_STOP=1 -q -c \
      "insert into supabase_migrations.schema_migrations(version, name, statements) values ('$version', '$migration_name', null) on conflict (version) do nothing;" \
      > "$MIGRATION_LEDGER_INSERT_LOG" 2>&1
    SCHEMA_MIGRATIONS_INSERT_EXIT=$?
    set -e
    log_cmd "psql insert supabase_migrations.schema_migrations ($migration_name)" "$SCHEMA_MIGRATIONS_INSERT_EXIT"
    [[ "$SCHEMA_MIGRATIONS_INSERT_EXIT" -eq 0 ]] || fail "schema_migrations ledger insert failed for $migration_name with exit $SCHEMA_MIGRATIONS_INSERT_EXIT"
    rm -f "$MIGRATION_LEDGER_INSERT_LOG"
  fi
done

rm -rf "$STAGED_MIGRATIONS_DIR"

printf 'FB_RUNTIME_READY=%s\n' "$RUNTIME_DIR"
printf 'FB_PROJECT_ID=%s\n' "$PROJECT_ID"
printf 'FB_DB_PORT=%s\n' "$DB_PORT"
