#!/usr/bin/env bash
set -euo pipefail

# Source-only C4 setup. Execution requires a separate explicit runtime approval.
# It creates a fresh disposable runtime outside the repository and starts only
# that local project. It never links to or resets a hosted Supabase project.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C4_IS_DISPOSABLE"
REPO_ROOT="${GYEON_ORDER_V3_C4_REPO_ROOT:-}"
RUNTIME_PARENT="${GYEON_ORDER_V3_C4_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
SUFFIX="${GYEON_ORDER_V3_C4_SUFFIX:-}"
BASE_PORT="${GYEON_ORDER_V3_C4_BASE_PORT:-56420}"

fail() {
  printf 'C4_SETUP_ERROR: %s\n' "$1" >&2
  exit 1
}

[[ "${GYEON_ORDER_V3_C4_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$REPO_ROOT" ]] || fail "GYEON_ORDER_V3_C4_REPO_ROOT is required"
[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "repo root is not a git worktree"
[[ -n "$SUFFIX" ]] || fail "GYEON_ORDER_V3_C4_SUFFIX is required"
[[ "$SUFFIX" =~ ^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "suffix must be fresh UTC timestamp plus six lowercase alphanumerics"
[[ "$BASE_PORT" =~ ^[0-9]+$ ]] || fail "base port must be numeric"

RUNTIME_DIR="$RUNTIME_PARENT/gyeon-order-v3-c4.$SUFFIX"
[[ "$RUNTIME_DIR" == "$RUNTIME_PARENT"/gyeon-order-v3-c4.* ]] || fail "runtime path escaped the dedicated prefix"
[[ ! -e "$RUNTIME_DIR" ]] || fail "runtime suffix is already burned; choose a fresh suffix"

SOURCE_DIR="$REPO_ROOT/scripts/e2e/gyeon-order-v3-c4"
DRAFT_SQL="$REPO_ROOT/supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql"
[[ -f "$SOURCE_DIR/config.toml" ]] || fail "C4 config template is missing"
[[ -f "$DRAFT_SQL" ]] || fail "C3 draft SQL is missing"

mkdir -p "$RUNTIME_DIR/supabase/migrations"
mkdir -p "$RUNTIME_DIR/supabase/tests"
mkdir -p "$RUNTIME_DIR/evidence"

# Replay only formal migrations. The guarded C3 draft is promoted into a
# runtime-only derivative below and is never copied from DRAFT_DO_NOT_APPLY.
find "$REPO_ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print0 \
  | sort -z \
  | while IFS= read -r -d '' migration; do cp "$migration" "$RUNTIME_DIR/supabase/migrations/"; done

cp "$SOURCE_DIR/schema-rls.test.sql" "$RUNTIME_DIR/supabase/tests/001-schema-rls.test.sql"
cp "$SOURCE_DIR/business-contract.test.sql" "$RUNTIME_DIR/supabase/tests/002-business-contract.test.sql"
cp "$SOURCE_DIR/real-auth.mjs" "$RUNTIME_DIR/real-auth.mjs"
cp "$SOURCE_DIR/concurrency.mjs" "$RUNTIME_DIR/concurrency.mjs"
cp "$SOURCE_DIR/capture-evidence.sh" "$RUNTIME_DIR/capture-evidence.sh"
cp "$SOURCE_DIR/cleanup.sh" "$RUNTIME_DIR/cleanup.sh"

PROJECT_ID="gyeonorderv3c4${SUFFIX//[^a-zA-Z0-9]/}"
API_PORT="$BASE_PORT"
DB_PORT="$((BASE_PORT + 1))"
SHADOW_PORT="$((BASE_PORT + 2))"
STUDIO_PORT="$((BASE_PORT + 3))"
INBUCKET_PORT="$((BASE_PORT + 4))"
SMTP_PORT="$((BASE_PORT + 5))"
POP3_PORT="$((BASE_PORT + 6))"
APP_PORT="$((BASE_PORT + 7))"

sed \
  -e "s/__C4_PROJECT_ID__/$PROJECT_ID/g" \
  -e "s/__C4_API_PORT__/$API_PORT/g" \
  -e "s/__C4_DB_PORT__/$DB_PORT/g" \
  -e "s/__C4_SHADOW_PORT__/$SHADOW_PORT/g" \
  -e "s/__C4_STUDIO_PORT__/$STUDIO_PORT/g" \
  -e "s/__C4_INBUCKET_PORT__/$INBUCKET_PORT/g" \
  -e "s/__C4_SMTP_PORT__/$SMTP_PORT/g" \
  -e "s/__C4_POP3_PORT__/$POP3_PORT/g" \
  -e "s/__C4_APP_PORT__/$APP_PORT/g" \
  "$SOURCE_DIR/config.toml" > "$RUNTIME_DIR/supabase/config.toml"

DRAFT_HASH="$(shasum -a 256 "$DRAFT_SQL" | awk '{print $1}')"
RUNTIME_SQL="$RUNTIME_DIR/supabase/migrations/99999999999999_gyeon_order_v3_contract_c4_runtime.sql"

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
[[ "$DIFF_LINES" == "2" ]] || fail "runtime derivative differs by more than the terminal guard"

printf '%s  %s\n' "$DRAFT_HASH" "$DRAFT_SQL" > "$RUNTIME_DIR/evidence/source-draft.sha256"
printf '%s  %s\n' "$RUNTIME_HASH" "$RUNTIME_SQL" > "$RUNTIME_DIR/evidence/runtime-migration.sha256"
printf '%s\n' "$PROJECT_ID" > "$RUNTIME_DIR/evidence/project-id.txt"
printf '%s\n' "$RUNTIME_DIR" > "$RUNTIME_DIR/evidence/runtime-dir.txt"
printf '%s\n' "$DB_PORT" > "$RUNTIME_DIR/evidence/db-port.txt"

if [[ -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]]; then
  fail "unexpected linked project state detected"
fi

env SUPABASE_TELEMETRY_DISABLED=1 supabase start --workdir "$RUNTIME_DIR"
env SUPABASE_TELEMETRY_DISABLED=1 supabase status --workdir "$RUNTIME_DIR" -o env > "$RUNTIME_DIR/evidence/supabase-status.env"

printf 'C4_RUNTIME_READY=%s\n' "$RUNTIME_DIR"
printf 'C4_PROJECT_ID=%s\n' "$PROJECT_ID"
printf 'C4_DB_PORT=%s\n' "$DB_PORT"
