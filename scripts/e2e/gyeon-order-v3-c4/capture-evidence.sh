#!/usr/bin/env bash
set -euo pipefail

# C4 one-attempt evidence runner. Run only after separately authorized setup.
# A failed suffix is burned; this script never retries or repairs the database.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C4_IS_DISPOSABLE"
RUNTIME_PARENT="${GYEON_ORDER_V3_C4_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GYEON_ORDER_V3_C4_RUNTIME_DIR:-}"

fail() {
  printf 'C4_EVIDENCE_ERROR: %s\n' "$1" >&2
  exit 1
}

[[ "${GYEON_ORDER_V3_C4_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$RUNTIME_DIR" ]] || fail "GYEON_ORDER_V3_C4_RUNTIME_DIR is required"
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gyeon-order-v3-c4\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "runtime path does not match the dedicated disposable pattern"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"
[[ -f "$RUNTIME_DIR/evidence/supabase-status.env" ]] || fail "status evidence is missing"
[[ ! -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]] || fail "linked project state is forbidden"

EVIDENCE_DIR="$RUNTIME_DIR/evidence"
ATTEMPT_MARKER="$EVIDENCE_DIR/attempt-started.txt"
[[ ! -e "$ATTEMPT_MARKER" ]] || fail "this suffix has already been attempted and is burned"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$ATTEMPT_MARKER"

set -a
# Supabase CLI emits shell-quoted values. The file is private runtime state and
# must never be printed because it contains API secrets.
source "$EVIDENCE_DIR/supabase-status.env"
set +a

C4_API_URL="${API_URL:-${SUPABASE_URL:-}}"
C4_DB_URL="${DB_URL:-}"
C4_ANON_KEY="${ANON_KEY:-}"
C4_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
[[ -n "$C4_API_URL" && -n "$C4_DB_URL" && -n "$C4_ANON_KEY" && -n "$C4_SERVICE_ROLE_KEY" ]] || fail "local status did not provide required endpoints and keys"

case "$C4_API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) fail "API endpoint is not loopback-only" ;;
esac
case "$C4_DB_URL" in
  postgresql://*127.0.0.1:*|postgresql://*localhost:*) ;;
  *) fail "database endpoint is not loopback-only" ;;
esac

export C4_API_URL C4_DB_URL C4_ANON_KEY C4_SERVICE_ROLE_KEY

env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
  "$RUNTIME_DIR/supabase/tests" > "$EVIDENCE_DIR/pgtap.tap" 2>&1

node "$RUNTIME_DIR/real-auth.mjs" > "$EVIDENCE_DIR/real-auth.ndjson" 2> "$EVIDENCE_DIR/real-auth.stderr.txt"
node "$RUNTIME_DIR/concurrency.mjs" > "$EVIDENCE_DIR/concurrency.ndjson" 2> "$EVIDENCE_DIR/concurrency.stderr.txt"

env SUPABASE_TELEMETRY_DISABLED=1 supabase db lint --workdir "$RUNTIME_DIR" --local \
  --schema public --level warning --fail-on error > "$EVIDENCE_DIR/db-lint.txt" 2>&1

psql "$C4_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/catalog-summary.txt" <<'SQL'
select 'postgres_version=' || current_setting('server_version');
select 'c4_rls_tables=' || count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'gyeon_order%' and c.relrowsecurity;
select 'c4_anon_table_grants=' || count(*) from information_schema.role_table_grants where table_schema='public' and table_name like 'gyeon_order%' and grantee='anon';
select 'c4_authenticated_direct_writes=' || count(*) from information_schema.role_table_grants where table_schema='public' and table_name like 'gyeon_order%' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE');
SQL

psql "$C4_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/query-plans.txt" <<'SQL'
explain (costs on, verbose off)
select 1 from public.gyeon_ordering_memberships
where dealer_id='00000000-0000-0000-0000-000000000000'::uuid
  and membership_status='active';
explain (costs on, verbose off)
select 1 from public.gyeon_order_idempotency_v3
where dealer_id='00000000-0000-0000-0000-000000000000'::uuid
  and idempotency_key='00000000-0000-0000-0000-000000000000'::uuid;
SQL

find "$EVIDENCE_DIR" -maxdepth 1 -type f ! -name 'supabase-status.env' -print0 \
  | sort -z \
  | xargs -0 shasum -a 256 > "$EVIDENCE_DIR/SHA256SUMS.txt"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/attempt-completed.txt"

printf 'C4_EVIDENCE_CAPTURED=%s\n' "$EVIDENCE_DIR"
printf 'C4_CLASSIFICATION_PENDING=manual_acceptance_review\n'
