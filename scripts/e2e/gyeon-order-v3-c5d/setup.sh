#!/usr/bin/env bash
set -Eeuo pipefail

# Source-only C5-D setup. Execution requires a separate explicit runtime
# approval. It creates ONE lane (fresh|populated|runner) of one disposable
# C5-D attempt, outside the repository worktree, and starts only that local
# project. It never links to, resets, or otherwise contacts a
# hosted/shared/production Supabase project.
#
# A full C5-D attempt is three separate invocations of this script -- one per
# lane -- sharing the same GYEON_ORDER_V3_C5D_SUFFIX, followed by three lane
# invocations of capture-evidence.sh, followed by one invocation of
# cleanup.sh that tears down and retains evidence for all three lanes and
# decides the aggregate burn/pass outcome. Any lane failure burns the whole
# suffix; the same suffix is never repaired or reused.
#
# Unlike the predecessor C5-C harness, the formal migration under test here
# is already a real, committed, terminal-`commit;` timestamped migration
# file (supabase/migrations/20260829101726_gyeon_order_v3_contract.sql). No
# DRAFT->runtime derivative is created or applied. DRAFT_DO_NOT_APPLY is
# checked only for its hash and terminal ROLLBACK guard (predecessor
# provenance identity), and is never copied or executed. The formal
# migration file is copied byte-identically and its SHA-256 is re-verified
# after copy. It is NEVER applied with `psql -f`; only Supabase CLI-native
# `supabase db reset --local` (fresh) or `supabase migration up --local`
# (populated/runner) ever apply it.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C5D_IS_DISPOSABLE"
REPO_ROOT="${GYEON_ORDER_V3_C5D_REPO_ROOT:-}"
RUNTIME_PARENT="${GYEON_ORDER_V3_C5D_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
SUFFIX="${GYEON_ORDER_V3_C5D_SUFFIX:-}"
LANE="${GYEON_ORDER_V3_C5D_LANE:-}"
BASE_PORT="${GYEON_ORDER_V3_C5D_BASE_PORT:-57520}"
PSQL_BIN="${GYEON_ORDER_V3_C5D_PSQL_BIN:-}"

# Invocation-supplied accepted identity. Never hard-coded: a new accepted
# commit does not require editing this script, and a caller that forgets to
# supply them fails closed rather than silently reusing a stale literal.
EXPECTED_EXECUTION_HEAD="${GYEON_ORDER_V3_C5D_EXPECTED_HEAD:-}"
EXPECTED_EXECUTION_TREE="${GYEON_ORDER_V3_C5D_EXPECTED_TREE:-}"

MAIN_BASE_COMMIT="96a66c3fb5969718418da1ef4c75fe62407b48aa"
REQUIRED_BRANCH="agent/gyeon-order-v3-c5d-formal-migration-promotion"
FORMAL_BASENAME="20260829101726_gyeon_order_v3_contract.sql"
FORMAL_VERSION="20260829101726"
EXPECTED_FORMAL_SHA256="bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b"
EXPECTED_DRAFT_SHA256="d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73"
PREVIOUS_MIGRATION_VERSION="20260826143000"
LINE_MIGRATION_BASENAME="20260801110110_line_link_tokens.sql"

PROTECTED_PATHS=(
  "src/components/estimates/wizard/screens/ScreensPreview.tsx"
  "supabase/migrations/20260801110110_line_link_tokens.sql"
  "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"
  "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts"
)
declare -A PROTECTED_BLOBS=(
  ["src/components/estimates/wizard/screens/ScreensPreview.tsx"]="c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f"
  ["supabase/migrations/20260801110110_line_link_tokens.sql"]="accd22345054cc44f89156fd78eaba6dfe4242a4"
  ["supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"]="32fda49583ae1217bc13711784ad8fa31744726c"
  ["src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts"]="fe3c80f22fd80dcbfab076082473216dda582c14"
)
declare -A PROTECTED_MODES=(
  ["src/components/estimates/wizard/screens/ScreensPreview.tsx"]="100644"
  ["supabase/migrations/20260801110110_line_link_tokens.sql"]="100644"
  ["supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"]="100644"
  ["src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts"]="100644"
)

IN_FAIL=0

fail() {
  IN_FAIL=1
  printf 'C5D_SETUP_ERROR: %s\n' "$1" >&2
  # Burn this lane's evidence dir AND the shared suffix-level marker. Any
  # lane failure burns the entire suffix; the same suffix is never repaired
  # or rerun into acceptance.
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
  printf 'C5D_SETUP_ERROR: unexpected non-zero script exit (code %s)\n' "$exit_code" >&2
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

[[ "${GYEON_ORDER_V3_C5D_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$EXPECTED_EXECUTION_HEAD" ]] || fail "GYEON_ORDER_V3_C5D_EXPECTED_HEAD is required and must not be blank"
[[ "$EXPECTED_EXECUTION_HEAD" =~ ^[0-9a-f]{40}$ ]] || fail "GYEON_ORDER_V3_C5D_EXPECTED_HEAD must be a 40-character hex commit SHA"
[[ -n "$EXPECTED_EXECUTION_TREE" ]] || fail "GYEON_ORDER_V3_C5D_EXPECTED_TREE is required and must not be blank"
[[ "$EXPECTED_EXECUTION_TREE" =~ ^[0-9a-f]{40}$ ]] || fail "GYEON_ORDER_V3_C5D_EXPECTED_TREE must be a 40-character hex tree SHA"
[[ -n "$REPO_ROOT" ]] || fail "GYEON_ORDER_V3_C5D_REPO_ROOT is required"
[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "repo root is not a git worktree"
[[ -n "$SUFFIX" ]] || fail "GYEON_ORDER_V3_C5D_SUFFIX is required"
[[ "$SUFFIX" =~ ^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "suffix must be fresh UTC timestamp plus six lowercase alphanumerics"
[[ "$LANE" == "fresh" || "$LANE" == "populated" || "$LANE" == "runner" ]] || fail "GYEON_ORDER_V3_C5D_LANE must be exactly one of: fresh, populated, runner"
[[ "$BASE_PORT" =~ ^[0-9]+$ ]] || fail "base port must be numeric"
[[ -n "$PSQL_BIN" ]] || fail "GYEON_ORDER_V3_C5D_PSQL_BIN is required"
[[ -x "$PSQL_BIN" ]] || fail "GYEON_ORDER_V3_C5D_PSQL_BIN must be an executable path"

# The runtime must live outside the Git worktree and outside /private/tmp.
case "$RUNTIME_PARENT" in
  /private/tmp|/private/tmp/*) fail "runtime parent must not be under /private/tmp" ;;
esac
case "$RUNTIME_PARENT" in
  "$REPO_ROOT"|"$REPO_ROOT"/*) fail "runtime parent must be outside the Git worktree" ;;
esac

SUFFIX_DIR="$RUNTIME_PARENT/gyeon-order-v3-c5d.$SUFFIX"
LANE_DIR="$SUFFIX_DIR/$LANE"
[[ "$LANE_DIR" == "$RUNTIME_PARENT"/gyeon-order-v3-c5d.*/"$LANE" ]] || fail "runtime path escaped the dedicated prefix"
[[ -e "$SUFFIX_DIR" ]] && [[ -e "$SUFFIX_DIR/burned.txt" ]] && fail "this suffix is already burned; choose a fresh suffix"
[[ ! -e "$LANE_DIR" ]] || fail "this lane of this suffix is already burned or already set up; choose a fresh suffix"

# ---------------------------------------------------------------------------
# C5D-0: source integrity preflight. No local/hosted DB is contacted yet.
# ---------------------------------------------------------------------------

command -v git >/dev/null 2>&1 || fail "git is required"
command -v supabase >/dev/null 2>&1 || fail "supabase CLI is required"
command -v node >/dev/null 2>&1 || fail "node is required"
command -v shasum >/dev/null 2>&1 || fail "shasum is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"

CURRENT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
CURRENT_TREE="$(git -C "$REPO_ROOT" rev-parse HEAD^{tree})"
GIT_STATUS="$(git -C "$REPO_ROOT" status --porcelain=v1)"

[[ "$CURRENT_HEAD" == "$EXPECTED_EXECUTION_HEAD" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: execution HEAD $CURRENT_HEAD does not match the invocation-supplied accepted HEAD $EXPECTED_EXECUTION_HEAD"
[[ "$CURRENT_TREE" == "$EXPECTED_EXECUTION_TREE" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: execution tree $CURRENT_TREE does not match the invocation-supplied accepted tree $EXPECTED_EXECUTION_TREE"
[[ -z "$GIT_STATUS" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: worktree/index is not clean"

CURRENT_BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
[[ "$CURRENT_BRANCH" == "$REQUIRED_BRANCH" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: branch $CURRENT_BRANCH does not equal the required branch $REQUIRED_BRANCH"

git -C "$REPO_ROOT" merge-base --is-ancestor "$MAIN_BASE_COMMIT" HEAD || fail "C5D_NOT_STARTED_SOURCE_DRIFT: main base commit is not an ancestor of HEAD"

UPSTREAM_REF="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
[[ -n "$UPSTREAM_REF" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: no upstream tracking ref is configured for this branch"
UPSTREAM_HEAD="$(git -C "$REPO_ROOT" rev-parse '@{u}' 2>/dev/null || true)"
[[ "$UPSTREAM_HEAD" == "$CURRENT_HEAD" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: upstream $UPSTREAM_HEAD does not equal HEAD $CURRENT_HEAD"

SOURCE_DIR="$REPO_ROOT/scripts/e2e/gyeon-order-v3-c5d"
FORMAL_SQL="$REPO_ROOT/supabase/migrations/$FORMAL_BASENAME"
DRAFT_SQL="$REPO_ROOT/supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql"
PREVIOUS_MIGRATION="$REPO_ROOT/supabase/migrations/${PREVIOUS_MIGRATION_VERSION}_window_film_v1_atomic_persistence.sql"
[[ -f "$SOURCE_DIR/config.toml" ]] || fail "C5-D config template is missing"
[[ -f "$FORMAL_SQL" ]] || fail "formal migration candidate is missing"
[[ -f "$DRAFT_SQL" ]] || fail "DRAFT provenance SQL is missing"
[[ -f "$PREVIOUS_MIGRATION" ]] || fail "previous migration version $PREVIOUS_MIGRATION_VERSION is missing"

# Formal candidate count must be exactly one.
FORMAL_CANDIDATE_COUNT="$(find "$REPO_ROOT/supabase/migrations" -maxdepth 1 -type f -name '*_gyeon_order_v3_contract.sql' | wc -l | tr -d ' ')"
[[ "$FORMAL_CANDIDATE_COUNT" == "1" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: expected exactly one formal candidate, found $FORMAL_CANDIDATE_COUNT"

FORMAL_HASH="$(shasum -a 256 "$FORMAL_SQL" | awk '{print $1}')"
[[ "$FORMAL_HASH" == "$EXPECTED_FORMAL_SHA256" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: formal migration hash mismatch"
HEAD_FORMAL_HASH="$(git -C "$REPO_ROOT" show "HEAD:supabase/migrations/$FORMAL_BASENAME" | shasum -a 256 | awk '{print $1}')"
[[ "$HEAD_FORMAL_HASH" == "$EXPECTED_FORMAL_SHA256" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: committed formal migration blob mismatch"

# Formal migration must have exactly one terminal `commit;` and no terminal
# rollback guard. This is a metadata/text-shape check of the formal file
# itself (not the protected/DRAFT content), required by the promotion plan.
python3 - "$FORMAL_SQL" <<'PY'
import re
import sys
text = open(sys.argv[1], encoding="utf-8").read()
commits = list(re.finditer(r"(?im)^commit;\s*$", text))
if len(commits) != 1:
    raise SystemExit(f"expected exactly one terminal commit;, found {len(commits)}")
if text[commits[0].end():].strip():
    raise SystemExit("terminal commit; is not the final statement")
if re.search(r"(?im)^rollback;\s*$", text):
    raise SystemExit("formal migration must not contain a terminal rollback guard")
PY
[[ "$?" -eq 0 ]] || fail "formal migration terminal-guard shape check failed"

# DRAFT is verified for hash + terminal ROLLBACK identity only (predecessor
# provenance). It is never copied, derived from, or applied.
DRAFT_HASH="$(shasum -a 256 "$DRAFT_SQL" | awk '{print $1}')"
[[ "$DRAFT_HASH" == "$EXPECTED_DRAFT_SHA256" ]] || fail "C5D_NOT_STARTED_SOURCE_DRIFT: DRAFT hash mismatch"
python3 - "$DRAFT_SQL" <<'PY'
import re
import sys
text = open(sys.argv[1], encoding="utf-8").read()
rollbacks = list(re.finditer(r"(?im)^rollback;\s*$", text))
if len(rollbacks) != 1:
    raise SystemExit(f"expected exactly one terminal rollback;, found {len(rollbacks)}")
if text[rollbacks[0].end():].strip():
    raise SystemExit("terminal rollback; is not the final statement")
PY
[[ "$?" -eq 0 ]] || fail "DRAFT terminal ROLLBACK guard check failed"

# Protected paths: pathname/mode/blob/Git-state only. Content is never
# opened, read, printed, diffed, copied, or staged.
for path in "${PROTECTED_PATHS[@]}"; do
  entry="$(git -C "$REPO_ROOT" ls-files -s -- "$path")"
  mode="$(printf '%s' "$entry" | awk '{print $1}')"
  blob="$(printf '%s' "$entry" | awk '{print $2}')"
  status="$(git -C "$REPO_ROOT" status --porcelain -- "$path")"
  [[ -n "$blob" ]] || fail "protected path metadata missing: $path"
  [[ "$mode" == "${PROTECTED_MODES[$path]}" ]] || fail "protected path mode drift: $path (found $mode)"
  [[ "$blob" == "${PROTECTED_BLOBS[$path]}" ]] || fail "protected path blob drift: $path"
  [[ -z "$status" ]] || fail "protected path is not clean: $path"
done

# Reject a linked/hosted project state before any runtime is created.
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
  printf 'upstream=%s (hard-gated == HEAD)\n' "$UPSTREAM_REF"
  printf 'main_base=%s (hard-gated ancestor)\n' "$MAIN_BASE_COMMIT"
  printf 'worktree_status_lines=0 (clean, hard-gated above)\n'
  printf 'formal_path=supabase/migrations/%s\n' "$FORMAL_BASENAME"
  printf 'formal_sha256=%s (hard-gated)\n' "$FORMAL_HASH"
  printf 'draft_sha256=%s (hard-gated, metadata-only identity)\n' "$DRAFT_HASH"
  printf 'previous_migration_version=%s\n' "$PREVIOUS_MIGRATION_VERSION"
} > "$LANE_DIR/evidence/source-hashes.sha256"

{
  for path in "${PROTECTED_PATHS[@]}"; do
    printf 'path=%s mode=%s blob=%s (hard-gated)\n' "$path" "${PROTECTED_MODES[$path]}" "${PROTECTED_BLOBS[$path]}"
  done
} > "$LANE_DIR/evidence/protected-paths.txt"

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
[[ "$NODE_MAJOR" -ge 22 ]] || fail "Node.js 22 or newer is required for the Auth/PostgREST harness"

# ---------------------------------------------------------------------------
# Mount probe (offline-only, container-visible). Confirms the disposable
# runtime path is genuinely visible from inside the container runtime
# Supabase will use, before Colima/Docker/Postgres starts. Never pulls an
# image; if none is already local, fails closed with C5D_BLOCKED_ENVIRONMENT.
# colima/docker presence itself is already hard-required above.
# ---------------------------------------------------------------------------

PROBE_FILE="$LANE_DIR/.mount-probe"
PROBE_CONTENT="gyeon-order-v3-c5d-mount-probe-$SUFFIX-$LANE"
echo "$PROBE_CONTENT" > "$PROBE_FILE"
[[ "$(cat "$PROBE_FILE")" == "$PROBE_CONTENT" ]] || fail "host-side mount probe readback failed"

PROBE_IMAGE="$(docker images -q --filter 'dangling=false' | head -n1)"
[[ -n "$PROBE_IMAGE" ]] || fail "C5D_BLOCKED_ENVIRONMENT: no Docker image is already available locally; the offline-only mount probe never pulls one"

set +e
CONTAINER_PROBE_OUTPUT="$(docker run --rm --pull=never \
  --entrypoint cat \
  -v "$LANE_DIR:/gyeon-c5d-probe:ro" \
  "$PROBE_IMAGE" "/gyeon-c5d-probe/$(basename "$PROBE_FILE")" 2>/dev/null)"
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
# Lane-distinct project id and ports. fresh/populated/runner never overlap.
# ---------------------------------------------------------------------------

SUFFIX_ALNUM="${SUFFIX//[^a-zA-Z0-9]/}"
case "$LANE" in
  fresh)     PORT_OFFSET=0  ;;
  populated) PORT_OFFSET=20 ;;
  runner)    PORT_OFFSET=40 ;;
esac
PROJECT_ID="gyeonorderv3c5d${SUFFIX_ALNUM}${LANE}"
API_PORT="$((BASE_PORT + PORT_OFFSET))"
DB_PORT="$((BASE_PORT + PORT_OFFSET + 1))"
SHADOW_PORT="$((BASE_PORT + PORT_OFFSET + 2))"
STUDIO_PORT="$((BASE_PORT + PORT_OFFSET + 3))"
INBUCKET_PORT="$((BASE_PORT + PORT_OFFSET + 4))"
SMTP_PORT="$((BASE_PORT + PORT_OFFSET + 5))"
POP3_PORT="$((BASE_PORT + PORT_OFFSET + 6))"
APP_PORT="$((BASE_PORT + PORT_OFFSET + 7))"

sed \
  -e "s/__C5D_PROJECT_ID__/$PROJECT_ID/g" \
  -e "s/__C5D_API_PORT__/$API_PORT/g" \
  -e "s/__C5D_DB_PORT__/$DB_PORT/g" \
  -e "s/__C5D_SHADOW_PORT__/$SHADOW_PORT/g" \
  -e "s/__C5D_STUDIO_PORT__/$STUDIO_PORT/g" \
  -e "s/__C5D_INBUCKET_PORT__/$INBUCKET_PORT/g" \
  -e "s/__C5D_SMTP_PORT__/$SMTP_PORT/g" \
  -e "s/__C5D_POP3_PORT__/$POP3_PORT/g" \
  -e "s/__C5D_APP_PORT__/$APP_PORT/g" \
  "$SOURCE_DIR/config.toml" > "$LANE_DIR/supabase/config.toml"

printf '%s\n' "$PROJECT_ID" > "$LANE_DIR/evidence/project-id.txt"
printf '%s\n' "$LANE_DIR" > "$LANE_DIR/evidence/runtime-dir.txt"
printf '%s\n' "$DB_PORT" > "$LANE_DIR/evidence/db-port.txt"

if [[ -e "$LANE_DIR/supabase/.temp/project-ref" ]]; then
  fail "unexpected linked project state detected in the fresh runtime"
fi

# ---------------------------------------------------------------------------
# C5D-1: stage baseline migrations only (never the formal candidate itself,
# never DRAFT_DO_NOT_APPLY), excluding the protected LINE migration by
# basename only -- its content is never opened. Staged into a holding dir so
# `supabase start` below brings up a bare project with no application
# schema; migrations are applied only via CLI-native commands afterward.
#
# fresh:     every formal migration up to and including the newest (the
#            formal candidate is included in this lane's staging set, since
#            the whole chain is replayed by one `db reset --local`).
# populated: only migrations up to and including PREVIOUS_MIGRATION_VERSION.
#            The formal candidate is copied separately below, AFTER the
#            baseline reset, so it is provably left "pending" first.
# runner:    identical staging to populated.
# ---------------------------------------------------------------------------

STAGED_DIR="$LANE_DIR/.migrations-staged"
mkdir -p "$STAGED_DIR"

MIGRATION_MANIFEST="$LANE_DIR/evidence/migration-manifest.txt"
: > "$MIGRATION_MANIFEST"
while IFS= read -r -d '' migration; do
  base="$(basename "$migration")"
  version="$(printf '%s' "$base" | sed -nE 's/^([0-9]{14}).*/\1/p')"
  if [[ "$base" == "$LINE_MIGRATION_BASENAME" ]]; then
    printf 'excluded_protected %s\n' "$base" >> "$MIGRATION_MANIFEST"
    continue
  fi
  if [[ "$base" == "$FORMAL_BASENAME" ]]; then
    if [[ "$LANE" == "fresh" ]]; then
      cp "$migration" "$STAGED_DIR/"
      printf 'staged %s\n' "$base" >> "$MIGRATION_MANIFEST"
    else
      printf 'held_pending_for_migration_up %s\n' "$base" >> "$MIGRATION_MANIFEST"
    fi
    continue
  fi
  if [[ "$LANE" != "fresh" && -n "$version" && "$version" > "$PREVIOUS_MIGRATION_VERSION" ]]; then
    printf 'excluded_after_baseline %s\n' "$base" >> "$MIGRATION_MANIFEST"
    continue
  fi
  cp "$migration" "$STAGED_DIR/"
  printf 'staged %s\n' "$base" >> "$MIGRATION_MANIFEST"
done < <(find "$REPO_ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

if [[ -e "$LANE_DIR/supabase/migrations/$LINE_MIGRATION_BASENAME" || -e "$STAGED_DIR/$LINE_MIGRATION_BASENAME" ]]; then
  fail "protected LINE migration must never be copied into the disposable runtime"
fi

cp "$SOURCE_DIR/schema-rls.test.sql" "$LANE_DIR/supabase/tests/001-schema-rls.test.sql"
cp "$SOURCE_DIR/qualification-evidence.test.sql" "$LANE_DIR/supabase/tests/002-qualification-evidence.test.sql"
cp "$SOURCE_DIR/prepare-finalize-warehouse.test.sql" "$LANE_DIR/supabase/tests/003-prepare-finalize-warehouse.test.sql"
cp "$SOURCE_DIR/populated-upgrade.test.sql" "$LANE_DIR/supabase/tests/004-populated-upgrade.test.sql"
cp "$SOURCE_DIR/real-auth.mjs" "$LANE_DIR/real-auth.mjs"
cp "$SOURCE_DIR/concurrency.mjs" "$LANE_DIR/concurrency.mjs"
cp "$SOURCE_DIR/capture-evidence.sh" "$LANE_DIR/capture-evidence.sh"
cp "$SOURCE_DIR/cleanup.sh" "$LANE_DIR/cleanup.sh"
chmod +x "$LANE_DIR/capture-evidence.sh" "$LANE_DIR/cleanup.sh"

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

# Move staged baseline migrations into place and apply them CLI-natively.
mv "$STAGED_DIR"/*.sql "$LANE_DIR/supabase/migrations/" 2>/dev/null || true
rmdir "$STAGED_DIR" 2>/dev/null || true

if [[ "$LANE" == "fresh" ]]; then
  RESET_LOG="$LANE_DIR/evidence/.db-reset.raw.log"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase db reset --local --no-seed --yes --workdir "$LANE_DIR" > "$RESET_LOG" 2>&1
  RESET_EXIT=$?
  set -e
  log_cmd "supabase db reset --local --no-seed --yes --workdir <lane>" "$RESET_EXIT"
  cp "$RESET_LOG" "$LANE_DIR/evidence/.db-reset-tail.log" 2>/dev/null || true
  rm -f "$RESET_LOG"
  [[ "$RESET_EXIT" -eq 0 ]] || fail "C5D_BASELINE_BLOCKED_OR_CHANGES_REQUIRED_SOURCE: supabase db reset --local (full chain) failed with exit $RESET_EXIT"
else
  RESET_LOG="$LANE_DIR/evidence/.db-reset.raw.log"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase db reset --local --version "$PREVIOUS_MIGRATION_VERSION" --no-seed --yes --workdir "$LANE_DIR" > "$RESET_LOG" 2>&1
  RESET_EXIT=$?
  set -e
  log_cmd "supabase db reset --local --version $PREVIOUS_MIGRATION_VERSION --no-seed --yes --workdir <lane>" "$RESET_EXIT"
  rm -f "$RESET_LOG"
  [[ "$RESET_EXIT" -eq 0 ]] || fail "C5D_BASELINE_BLOCKED: baseline reset to $PREVIOUS_MIGRATION_VERSION failed with exit $RESET_EXIT"

  # Now stage the formal migration byte-identically and bind its hash, so it
  # is provably PENDING (present locally, not yet in the CLI ledger) before
  # capture-evidence.sh applies it via `supabase migration up --local`.
  cp "$FORMAL_SQL" "$LANE_DIR/supabase/migrations/$FORMAL_BASENAME"
  COPIED_FORMAL_HASH="$(shasum -a 256 "$LANE_DIR/supabase/migrations/$FORMAL_BASENAME" | awk '{print $1}')"
  [[ "$COPIED_FORMAL_HASH" == "$EXPECTED_FORMAL_SHA256" ]] || fail "formal migration copy hash mismatch after byte copy"
  {
    printf 'formal_basename=%s\n' "$FORMAL_BASENAME"
    printf 'formal_sha256=%s\n' "$COPIED_FORMAL_HASH"
    printf 'copy_mode=byte_identical_cp_never_psql_f\n'
  } > "$LANE_DIR/evidence/formal-migration-staged.txt"

  LIST_LOG="$LANE_DIR/evidence/migration-list-before-apply.txt"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase migration list --local --workdir "$LANE_DIR" > "$LIST_LOG" 2>&1
  LIST_EXIT=$?
  set -e
  log_cmd "supabase migration list --local --workdir <lane> (pending check)" "$LIST_EXIT"
  [[ "$LIST_EXIT" -eq 0 ]] || fail "supabase migration list --local failed before apply with exit $LIST_EXIT"

  # `supabase migration list` prints a Local/Remote-column table keyed by
  # exact 14-digit version, not a full-filename listing. A version present in
  # BOTH columns is already applied; a version present in only the Local
  # column is genuinely pending. The line containing the target version is
  # isolated, then the version substring is counted within that single line:
  # 2 occurrences means the version appears in both columns (applied), 1
  # means it appears in exactly one column (pending/local-only), 0 means the
  # version is entirely absent from the table. This is delimiter-agnostic
  # (works whether the CLI renders the table with tabs, spaces, or pipes).
  LIST_STATE_BEFORE="$(python3 - "$LIST_LOG" "$FORMAL_VERSION" <<'PY'
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
  [[ "$LIST_STATE_BEFORE" == "LOCAL_ONLY" ]] || fail "C5D_MIGRATION_LIST_PROOF_FAILED: expected formal version $FORMAL_VERSION to be Local-only (pending) before apply, observed $LIST_STATE_BEFORE"

  # Independent, read-only, CLI-agnostic corroboration: query the CLI's own
  # ledger table directly via psql (SELECT only -- never an apply). Exactly
  # zero rows for this version before the formal migration is applied.
  set +e
  LEDGER_COUNT_BEFORE="$("$PSQL_BIN" "${DB_URL:-}" -X -v ON_ERROR_STOP=1 -At -c \
    "select count(*) from supabase_migrations.schema_migrations where version = '$FORMAL_VERSION';")"
  LEDGER_COUNT_BEFORE_EXIT=$?
  set -e
  log_cmd "psql read-only ledger count before apply (supabase_migrations.schema_migrations)" "$LEDGER_COUNT_BEFORE_EXIT"
  [[ "$LEDGER_COUNT_BEFORE_EXIT" -eq 0 ]] || fail "read-only ledger-count proof query failed before apply"
  [[ "$LEDGER_COUNT_BEFORE" == "0" ]] || fail "C5D_MIGRATION_LIST_PROOF_FAILED: expected zero ledger rows for $FORMAL_VERSION before apply, found $LEDGER_COUNT_BEFORE"

  {
    printf 'formal_version=%s\n' "$FORMAL_VERSION"
    printf 'migration_list_state_before_apply=%s (expected LOCAL_ONLY)\n' "$LIST_STATE_BEFORE"
    printf 'ledger_count_before_apply=%s (expected 0, read-only psql SELECT against supabase_migrations.schema_migrations)\n' "$LEDGER_COUNT_BEFORE"
  } > "$LANE_DIR/evidence/migration-list-proof-before-apply.txt"
fi

printf 'C5D_LANE_READY=%s\n' "$LANE_DIR"
printf 'C5D_LANE=%s\n' "$LANE"
printf 'C5D_PROJECT_ID=%s\n' "$PROJECT_ID"
printf 'C5D_DB_PORT=%s\n' "$DB_PORT"
