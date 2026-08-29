#!/usr/bin/env bash
set -euo pipefail

# Source-only C5-C setup. Execution requires a separate explicit runtime
# approval. It creates one fresh disposable runtime outside the repository
# worktree and starts only that local project. It never links to, resets, or
# otherwise contacts a hosted/shared/production Supabase project.
#
# This script does not execute pgTAP, real Auth, concurrency, evidence
# capture, or cleanup. It only prepares the runtime and starts the local
# stack; those later stages are wired by capture-evidence.sh and cleanup.sh.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C5C_IS_DISPOSABLE"
REPO_ROOT="${GYEON_ORDER_V3_C5C_REPO_ROOT:-}"
RUNTIME_PARENT="${GYEON_ORDER_V3_C5C_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
SUFFIX="${GYEON_ORDER_V3_C5C_SUFFIX:-}"
BASE_PORT="${GYEON_ORDER_V3_C5C_BASE_PORT:-56520}"

# R2-bound source identity. C5-C must never start against source drift.
EXPECTED_SOURCE_COMMIT="3403918d0166c30c44abb95bad1c8a7335877cab"
EXPECTED_SOURCE_TREE="1d1617a49bc1dd1e4b21515fec4940c3fdc4f827"
EXPECTED_SQL_SHA256="d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73"
EXPECTED_RPC_TEST_SHA256="dbc7be4c08195c944eb00a0c28dc839736340b7c0df3e31ad617bdfa957a4159"
EXPECTED_MIGRATION_TEST_SHA256="c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5"
# R2 repair: the two C5-A pure-contract core files are now a hard equality
# gate, matching the invocation-supplied accepted identity, not merely
# recorded for audit.
EXPECTED_EXTERNAL_AUTHORITY_CORE_SHA256="a446017673669a1f4953d73a12b48969f272250ecd167be8ede478f129f8702a"
EXPECTED_CONTRACT_CORE_SHA256="70fd8d20346adac89e9e663481efe041e3e05b687cc21bab800cada2f1d8d2d9"
# R3 repair: the exact execution HEAD/tree accepted for this run are now
# received exclusively through mandatory invocation environment variables.
# The pre-commit HEAD/tree are never hard-coded into this script again: a
# new accepted commit no longer requires editing setup.sh, and a caller that
# forgets to supply them fails closed rather than silently reusing a stale
# literal. C5-C never starts against any other HEAD/tree, even one that
# still passes every individual source-hash check below.
EXPECTED_EXECUTION_HEAD="${GYEON_ORDER_V3_C5C_EXPECTED_HEAD:-}"
EXPECTED_EXECUTION_TREE="${GYEON_ORDER_V3_C5C_EXPECTED_TREE:-}"

LINE_MIGRATION_BASENAME="20260801110110_line_link_tokens.sql"

PROTECTED_PATHS=(
  "src/components/estimates/wizard/screens/ScreensPreview.tsx"
  "supabase/migrations/20260801110110_line_link_tokens.sql"
  "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"
  "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts"
)

fail() {
  printf 'C5C_SETUP_ERROR: %s\n' "$1" >&2
  # Burn the suffix/evidence set on any failure. The same suffix is never
  # repaired or reused; a fresh owner-approved attempt requires a fresh
  # suffix. cleanup.sh may still tear down a burned suffix's containers and
  # runtime path exactly once; it never repairs or reruns it. Per-migration
  # start/finish/exit/SQLSTATE attribution (required 9) is captured directly
  # at the point of each psql -f invocation below, not reconstructed here.
  if [[ -n "${RUNTIME_DIR:-}" ]]; then
    mkdir -p "$RUNTIME_DIR/evidence"
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "$RUNTIME_DIR/evidence/burned.txt"
    printf '%s\n' "$1" >> "$RUNTIME_DIR/evidence/burned.txt"
  fi
  exit 1
}

# Every external command this script runs, and its exit code, is appended
# here (required 8). cleanup.sh folds this into the final manifest/summary.
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

[[ "${GYEON_ORDER_V3_C5C_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$EXPECTED_EXECUTION_HEAD" ]] || fail "GYEON_ORDER_V3_C5C_EXPECTED_HEAD is required and must not be blank"
[[ "$EXPECTED_EXECUTION_HEAD" =~ ^[0-9a-f]{40}$ ]] || fail "GYEON_ORDER_V3_C5C_EXPECTED_HEAD must be a 40-character hex commit SHA"
[[ -n "$EXPECTED_EXECUTION_TREE" ]] || fail "GYEON_ORDER_V3_C5C_EXPECTED_TREE is required and must not be blank"
[[ "$EXPECTED_EXECUTION_TREE" =~ ^[0-9a-f]{40}$ ]] || fail "GYEON_ORDER_V3_C5C_EXPECTED_TREE must be a 40-character hex tree SHA"
[[ -n "$REPO_ROOT" ]] || fail "GYEON_ORDER_V3_C5C_REPO_ROOT is required"
[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "repo root is not a git worktree"
[[ -n "$SUFFIX" ]] || fail "GYEON_ORDER_V3_C5C_SUFFIX is required"
[[ "$SUFFIX" =~ ^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "suffix must be fresh UTC timestamp plus six lowercase alphanumerics"
[[ "$BASE_PORT" =~ ^[0-9]+$ ]] || fail "base port must be numeric"

# The runtime must live outside the Git worktree and outside /private/tmp.
case "$RUNTIME_PARENT" in
  /private/tmp|/private/tmp/*) fail "runtime parent must not be under /private/tmp" ;;
esac
case "$RUNTIME_PARENT" in
  "$REPO_ROOT"|"$REPO_ROOT"/*) fail "runtime parent must be outside the Git worktree" ;;
esac

RUNTIME_DIR="$RUNTIME_PARENT/gyeon-order-v3-c5c.$SUFFIX"
[[ "$RUNTIME_DIR" == "$RUNTIME_PARENT"/gyeon-order-v3-c5c.* ]] || fail "runtime path escaped the dedicated prefix"
[[ ! -e "$RUNTIME_DIR" ]] || fail "runtime suffix is already burned; choose a fresh suffix"

# ---------------------------------------------------------------------------
# C5C-0: source integrity preflight. No local/hosted DB is contacted yet.
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

# R2 repair: hard-gate the exact invocation-supplied execution HEAD/tree.
# This is a stronger, independent check than the source-hash checks below --
# it fails closed even if every individual source hash still matched but the
# repository had moved to a different accepted governance commit.
[[ "$CURRENT_HEAD" == "$EXPECTED_EXECUTION_HEAD" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: execution HEAD $CURRENT_HEAD does not match the invocation-supplied accepted HEAD $EXPECTED_EXECUTION_HEAD"
[[ "$CURRENT_TREE" == "$EXPECTED_EXECUTION_TREE" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: execution tree $CURRENT_TREE does not match the invocation-supplied accepted tree $EXPECTED_EXECUTION_TREE"

SOURCE_DIR="$REPO_ROOT/scripts/e2e/gyeon-order-v3-c5c"
DRAFT_SQL="$REPO_ROOT/supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql"
RPC_TEST="$REPO_ROOT/src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts"
MIGRATION_TEST="$REPO_ROOT/src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts"
EXTERNAL_AUTHORITY_CORE="$REPO_ROOT/src/lib/product-orders/gyeon-order-v3-external-authority-core.ts"
CONTRACT_CORE="$REPO_ROOT/src/lib/product-orders/gyeon-order-v3-contract-core.ts"
[[ -f "$SOURCE_DIR/config.toml" ]] || fail "C5-C config template is missing"
[[ -f "$DRAFT_SQL" ]] || fail "R2 guarded SQL is missing"
[[ -f "$RPC_TEST" ]] || fail "R2 RPC contract test is missing"
[[ -f "$MIGRATION_TEST" ]] || fail "R2 migration contract test is missing"
[[ -f "$EXTERNAL_AUTHORITY_CORE" ]] || fail "C5-A external-authority-core.ts is missing"
[[ -f "$CONTRACT_CORE" ]] || fail "C5-A contract-core.ts is missing"

# The index and worktree must be exactly clean before any disposable runtime
# is created. An uncommitted candidate is never executed.
[[ -z "$GIT_STATUS" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: worktree/index is not clean"

# Upstream tracking must be configured and is recorded for audit; a branch
# with no upstream cannot be the accepted, pushed candidate this harness
# requires.
UPSTREAM_REF="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
[[ -n "$UPSTREAM_REF" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: no upstream tracking ref is configured for this branch"
AHEAD_BEHIND="$(git -C "$REPO_ROOT" rev-list --left-right --count "@{u}...HEAD" 2>/dev/null || echo "unknown unknown")"

# The R2 source commit/tree predate later governance-only commits, so HEAD is
# not required to equal the source commit. What must never drift is the exact
# blob content of the three allowlisted R2 source paths, verified both by
# direct file hash and by the committed blob at HEAD.
DRAFT_HASH="$(shasum -a 256 "$DRAFT_SQL" | awk '{print $1}')"
RPC_TEST_HASH="$(shasum -a 256 "$RPC_TEST" | awk '{print $1}')"
MIGRATION_TEST_HASH="$(shasum -a 256 "$MIGRATION_TEST" | awk '{print $1}')"
EXTERNAL_AUTHORITY_CORE_HASH="$(shasum -a 256 "$EXTERNAL_AUTHORITY_CORE" | awk '{print $1}')"
CONTRACT_CORE_HASH="$(shasum -a 256 "$CONTRACT_CORE" | awk '{print $1}')"
[[ "$DRAFT_HASH" == "$EXPECTED_SQL_SHA256" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: guarded SQL hash mismatch"
[[ "$RPC_TEST_HASH" == "$EXPECTED_RPC_TEST_SHA256" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: RPC contract test hash mismatch"
[[ "$MIGRATION_TEST_HASH" == "$EXPECTED_MIGRATION_TEST_SHA256" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: migration contract test hash mismatch"
[[ "$EXTERNAL_AUTHORITY_CORE_HASH" == "$EXPECTED_EXTERNAL_AUTHORITY_CORE_SHA256" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: external-authority-core.ts hash mismatch"
[[ "$CONTRACT_CORE_HASH" == "$EXPECTED_CONTRACT_CORE_SHA256" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: contract-core.ts hash mismatch"

HEAD_DRAFT_HASH="$(git -C "$REPO_ROOT" show "HEAD:supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql" | shasum -a 256 | awk '{print $1}')"
[[ "$HEAD_DRAFT_HASH" == "$EXPECTED_SQL_SHA256" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: committed guarded SQL blob mismatch"

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
  printf 'expected_source_commit=%s\n' "$EXPECTED_SOURCE_COMMIT"
  printf 'expected_source_tree=%s\n' "$EXPECTED_SOURCE_TREE"
  printf 'sql_sha256=%s (hard-gated)\n' "$DRAFT_HASH"
  printf 'rpc_test_sha256=%s (hard-gated)\n' "$RPC_TEST_HASH"
  printf 'migration_test_sha256=%s (hard-gated)\n' "$MIGRATION_TEST_HASH"
  printf 'external_authority_core_sha256=%s (hard-gated)\n' "$EXTERNAL_AUTHORITY_CORE_HASH"
  printf 'contract_core_sha256=%s (hard-gated)\n' "$CONTRACT_CORE_HASH"
} > "$RUNTIME_DIR/evidence/source-hashes.sha256"

{
  for path in "${PROTECTED_PATHS[@]}"; do
    entry="$(git -C "$REPO_ROOT" ls-files -s -- "$path")"
    status="$(git -C "$REPO_ROOT" status --porcelain -- "$path")"
    printf 'path=%s\n' "$path"
    printf '  ls-files -s: %s\n' "${entry:-<not tracked or not found>}"
    printf '  status: %s\n' "${status:-<clean>}"
  done
} > "$RUNTIME_DIR/evidence/protected-paths.txt"

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
# A host-only file write/read is not accepted as proof of container
# visibility; the probe must actually run a throwaway container.
#
# R2 repair: offline-only. Official Supabase documentation confirms the
# first `supabase start` on a machine may pull images, and this probe must
# never be the thing that triggers a pull (that would make the probe itself
# a network action, and would defeat the point of probing before startup).
# It only ever uses an image that is ALREADY present locally; if none is,
# it fails closed with C5C_BLOCKED_ENVIRONMENT instead of pulling one.
# `--pull=never` is passed explicitly as defense in depth even though image
# selection already guarantees this.
# ---------------------------------------------------------------------------

command -v docker >/dev/null 2>&1 || fail "docker is required for the container-visible mount probe"

PROBE_FILE="$RUNTIME_DIR/.mount-probe"
PROBE_CONTENT="gyeon-order-v3-c5c-mount-probe-$SUFFIX"
echo "$PROBE_CONTENT" > "$PROBE_FILE"
[[ "$(cat "$PROBE_FILE")" == "$PROBE_CONTENT" ]] || fail "host-side mount probe readback failed"

PROBE_IMAGE="$(docker images -q --filter 'dangling=false' | head -n1)"
[[ -n "$PROBE_IMAGE" ]] || fail "C5C_BLOCKED_ENVIRONMENT: no Docker image is already available locally; the offline-only mount probe never pulls one"

set +e
CONTAINER_PROBE_OUTPUT="$(docker run --rm --pull=never \
  --entrypoint cat \
  -v "$RUNTIME_DIR:/gyeon-c5c-probe:ro" \
  "$PROBE_IMAGE" "/gyeon-c5c-probe/$(basename "$PROBE_FILE")" 2>/dev/null)"
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
# C5C-1 (part 1): stage only formal migrations, excluding the protected LINE
# migration. Its content is never opened; only its basename is compared and
# recorded as excluded. The closed finance migration is applied mechanically
# with every other formal migration and is not separately reviewed.
#
# R2 repair: migrations are staged in a holding directory, NOT copied
# directly into supabase/migrations/, so that `supabase start` below brings
# up a bare project with no application schema. Each migration is then
# applied individually via a direct psql -f invocation, giving exact
# per-migration start time, finish time, exit code, and (on failure)
# SQLSTATE -- captured directly, never inferred only from
# supabase_migrations.schema_migrations.
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

MIGRATION_OUTCOME="$RUNTIME_DIR/evidence/migration-replay-outcome.ndjson"
: > "$MIGRATION_OUTCOME"
grep '^excluded_protected ' "$MIGRATION_MANIFEST" | while IFS= read -r line; do
  name="${line#excluded_protected }"
  python3 -c "import json; print(json.dumps({'migration': '$name', 'status': 'excluded_protected', 'started_at': None, 'finished_at': None, 'exit_code': None, 'sqlstate': None}))" >> "$MIGRATION_OUTCOME"
done

# ---------------------------------------------------------------------------
# C5-C verification assets. Only the nine harness paths and the three C5-B
# source-contract paths participate; application UI and ScreensPreview.tsx
# are never copied.
# ---------------------------------------------------------------------------

cp "$SOURCE_DIR/schema-rls.test.sql" "$RUNTIME_DIR/supabase/tests/001-schema-rls.test.sql"
cp "$SOURCE_DIR/qualification-evidence.test.sql" "$RUNTIME_DIR/supabase/tests/002-qualification-evidence.test.sql"
cp "$SOURCE_DIR/prepare-finalize-warehouse.test.sql" "$RUNTIME_DIR/supabase/tests/003-prepare-finalize-warehouse.test.sql"
cp "$SOURCE_DIR/real-auth.mjs" "$RUNTIME_DIR/real-auth.mjs"
cp "$SOURCE_DIR/concurrency.mjs" "$RUNTIME_DIR/concurrency.mjs"
cp "$SOURCE_DIR/capture-evidence.sh" "$RUNTIME_DIR/capture-evidence.sh"
cp "$SOURCE_DIR/cleanup.sh" "$RUNTIME_DIR/cleanup.sh"
chmod +x "$RUNTIME_DIR/capture-evidence.sh" "$RUNTIME_DIR/cleanup.sh"

PROJECT_ID="gyeonorderv3c5c${SUFFIX//[^a-zA-Z0-9]/}"
API_PORT="$BASE_PORT"
DB_PORT="$((BASE_PORT + 1))"
SHADOW_PORT="$((BASE_PORT + 2))"
STUDIO_PORT="$((BASE_PORT + 3))"
INBUCKET_PORT="$((BASE_PORT + 4))"
SMTP_PORT="$((BASE_PORT + 5))"
POP3_PORT="$((BASE_PORT + 6))"
APP_PORT="$((BASE_PORT + 7))"

sed \
  -e "s/__C5C_PROJECT_ID__/$PROJECT_ID/g" \
  -e "s/__C5C_API_PORT__/$API_PORT/g" \
  -e "s/__C5C_DB_PORT__/$DB_PORT/g" \
  -e "s/__C5C_SHADOW_PORT__/$SHADOW_PORT/g" \
  -e "s/__C5C_STUDIO_PORT__/$STUDIO_PORT/g" \
  -e "s/__C5C_INBUCKET_PORT__/$INBUCKET_PORT/g" \
  -e "s/__C5C_SMTP_PORT__/$SMTP_PORT/g" \
  -e "s/__C5C_POP3_PORT__/$POP3_PORT/g" \
  -e "s/__C5C_APP_PORT__/$APP_PORT/g" \
  "$SOURCE_DIR/config.toml" > "$RUNTIME_DIR/supabase/config.toml"

# ---------------------------------------------------------------------------
# C5-B runtime SQL derivative: exactly one terminal ROLLBACK -> COMMIT byte
# change, machine-verified, never written back to the Git worktree.
# ---------------------------------------------------------------------------

RUNTIME_SQL="$STAGED_MIGRATIONS_DIR/99999999999999_gyeon_order_v3_contract_c5c_runtime.sql"

python3 - "$DRAFT_SQL" "$RUNTIME_SQL" <<'PY'
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
matches = list(re.finditer(r"(?im)^rollback;\s*$", source))
if len(matches) != 1:
    raise SystemExit(f"expected exactly one terminal rollback guard, found {len(matches)}")
match = matches[0]
if source[match.end():].strip():
    raise SystemExit("rollback guard is not the final SQL statement")
promoted = source[:match.start()] + "commit;" + source[match.end():]
Path(sys.argv[2]).write_text(promoted, encoding="utf-8")
PY

RUNTIME_HASH="$(shasum -a 256 "$RUNTIME_SQL" | awk '{print $1}')"
DIFF_LINES="$(diff -U0 "$DRAFT_SQL" "$RUNTIME_SQL" | grep -Ec '^[+-](rollback|commit);$' || true)"
[[ "$DIFF_LINES" == "2" ]] || fail "C5C_NOT_STARTED_SOURCE_DRIFT: runtime derivative differs by more than the terminal guard"
printf 'staged 99999999999999_gyeon_order_v3_contract_c5c_runtime.sql\n' >> "$MIGRATION_MANIFEST"

{
  printf 'source_sha256=%s\n' "$DRAFT_HASH"
  printf 'runtime_sha256=%s\n' "$RUNTIME_HASH"
  printf 'guard_replacement=rollback->commit\n'
  printf 'guard_replacement_count=1\n'
} > "$RUNTIME_DIR/evidence/runtime-derived-hashes.sha256"

printf '%s\n' "$PROJECT_ID" > "$RUNTIME_DIR/evidence/project-id.txt"
printf '%s\n' "$RUNTIME_DIR" > "$RUNTIME_DIR/evidence/runtime-dir.txt"
printf '%s\n' "$DB_PORT" > "$RUNTIME_DIR/evidence/db-port.txt"

if [[ -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]]; then
  fail "unexpected linked project state detected in the fresh runtime"
fi

# ---------------------------------------------------------------------------
# C5C-1 (part 2): start the disposable local stack with NO application
# migrations present (supabase/migrations/ is still empty at this point), so
# `supabase start` only brings up the bare Supabase project. Explicit
# start-attempted/start-succeeded markers let cleanup.sh always stop a
# partially-started project exactly once, even if it never reaches
# start-succeeded.txt. The raw start log/console output is never printed and
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

# A bare `supabase start` does not necessarily create the CLI-managed
# migration ledger until the CLI itself applies a migration. This harness
# applies files directly with psql, so initialise the current Supabase CLI
# ledger shape before recording any successfully applied 14-digit migration.
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
# C5C-1 (part 3): apply each staged migration individually via a direct
# psql -f invocation, in filename order. Start time, finish time, exit code,
# and (on failure) SQLSTATE are captured per migration, directly from this
# invocation -- never inferred only from supabase_migrations.schema_migrations
# after the fact. A successfully applied migration is moved into
# supabase/migrations/ and its version is also recorded into
# schema_migrations for consistency with normal Supabase tooling, but that
# insert is a supplementary cross-reference, not the attribution source.
# ---------------------------------------------------------------------------

: > "$MIGRATION_OUTCOME"
grep '^excluded_protected ' "$MIGRATION_MANIFEST" | while IFS= read -r line; do
  name="${line#excluded_protected }"
  python3 -c "import json; print(json.dumps({'migration': '$name', 'status': 'excluded_protected', 'started_at': None, 'finished_at': None, 'exit_code': None, 'sqlstate': None}))" >> "$MIGRATION_OUTCOME"
done

# required 7: pre-computed as an array (not a process-substitution loop) so
# that, on failure, every staged migration AFTER the failing one can still
# be given an explicit "not_reached" outcome record instead of silently
# having no entry at all.
RUNTIME_DERIVATIVE_BASENAME="99999999999999_gyeon_order_v3_contract_c5c_runtime.sql"
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
    # required 7: match the ACTUAL `psql -v VERBOSITY=verbose` error format,
    # where the SQLSTATE is rendered immediately after "ERROR:" (e.g.
    # `psql:file.sql:5: ERROR:  23505: duplicate key value ...`), not a
    # literal "SQLSTATE" label. A secondary pattern covers the rarer case
    # where libpq instead emits an explicit "SQLSTATE:" field.
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
    # required 7: every staged migration after this one is explicitly
    # recorded as not_reached, never left with no record at all.
    for remaining_index in "${!STAGED_FILES[@]}"; do
      if [[ "$remaining_index" -gt "$staged_index" ]]; then
        remaining_name="$(basename "${STAGED_FILES[$remaining_index]}")"
        python3 -c "import json; print(json.dumps({'migration': '$remaining_name', 'status': 'not_reached', 'started_at': None, 'finished_at': None, 'exit_code': None, 'sqlstate': None}))" >> "$MIGRATION_OUTCOME"
      fi
    done
    # required 7: the C5-B runtime derivative is classified separately from
    # an existing/baseline migration failure, matching the governing plan's
    # C5C_CHANGES_REQUIRED_SOURCE vs C5C_BASELINE_BLOCKED distinction.
    if [[ "$migration_name" == "$RUNTIME_DERIVATIVE_BASENAME" ]]; then
      fail "C5C_CHANGES_REQUIRED_SOURCE: the C5-B runtime derivative failed with exit $MIGRATION_EXIT; see migration-replay-outcome.ndjson for its captured SQLSTATE"
    else
      fail "C5C_BASELINE_BLOCKED: baseline migration $migration_name failed with exit $MIGRATION_EXIT; see migration-replay-outcome.ndjson for its captured SQLSTATE"
    fi
  fi

  cp "$staged_file" "$RUNTIME_DIR/supabase/migrations/"
  version="$(printf '%s' "$migration_name" | sed -nE 's/^([0-9]{14}).*/\1/p')"
  if [[ -n "$version" ]]; then
    # required 6: the real exit code of this ledger insert is captured and
    # logged -- never swallowed with "|| true" -- and its failure is now
    # FATAL. schema_migrations remains supplementary corroboration only for
    # attribution purposes (required 7/9: the per-migration psql -f capture
    # above is the actual attribution source), but a harness that cannot
    # even keep its own bookkeeping consistent does not silently continue.
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

printf 'C5C_RUNTIME_READY=%s\n' "$RUNTIME_DIR"
printf 'C5C_PROJECT_ID=%s\n' "$PROJECT_ID"
printf 'C5C_DB_PORT=%s\n' "$DB_PORT"
