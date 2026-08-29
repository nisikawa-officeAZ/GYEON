#!/usr/bin/env bash
set -Eeuo pipefail

# C5-D one-attempt evidence runner for ONE lane (fresh|populated|runner). Run
# only after separately authorized setup.sh for the SAME lane and suffix. A
# failed lane burns the whole suffix; this script never retries or repairs
# the database, and never promotes a partial run into acceptance.
#
# fresh:     reruns the full C5-C-equivalent contract proof (pgTAP x3,
#            real Auth/PostgREST, genuine concurrency, advisor, query plans)
#            against the fully-replayed formal chain, plus a CLI-native
#            migration-list proof that the formal version is applied exactly
#            once.
# populated: inserts representative committed legacy fixtures BEFORE the
#            formal migration is applied, captures a pre-migration
#            fingerprint, applies the formal migration via
#            `supabase migration up --local` (never psql -f), captures a
#            post-migration fingerprint, and runs the populated-upgrade
#            pgTAP assertions against the preserved legacy rows.
# runner:    proves the formal migration pending, applies it exactly once via
#            `supabase migration up --local`, and proves zero direct-psql
#            formal application from this script's own command ledger.
#
# This script deliberately does NOT write manifest.json/summary.json/
# summary.md: those are finalized only by cleanup.sh, after fixture
# teardown, the zero-row proof, and the project stop all succeed for every
# lane of the suffix.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C5D_IS_DISPOSABLE"
RUNTIME_PARENT="${GYEON_ORDER_V3_C5D_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GYEON_ORDER_V3_C5D_RUNTIME_DIR:-}"
LANE="${GYEON_ORDER_V3_C5D_LANE:-}"
PSQL_BIN="${GYEON_ORDER_V3_C5D_PSQL_BIN:-}"
FORMAL_BASENAME="20260829101726_gyeon_order_v3_contract.sql"
FORMAL_VERSION="20260829101726"
PREVIOUS_MIGRATION_VERSION="20260826143000"

IN_FAIL=0

fail() {
  IN_FAIL=1
  printf 'C5D_EVIDENCE_ERROR: %s\n' "$1" >&2
  # A capture failure burns BOTH this lane's evidence dir AND the shared
  # suffix-level marker, so no later lane invocation can proceed with the
  # same suffix after this one has failed.
  if [[ -n "${EVIDENCE_DIR:-}" && -d "$EVIDENCE_DIR" ]]; then
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/burned.txt"
    printf '%s\n' "$1" >> "$EVIDENCE_DIR/burned.txt"
  fi
  if [[ -n "${RUNTIME_DIR:-}" ]]; then
    SUFFIX_DIR_FOR_BURN="$(dirname "$RUNTIME_DIR")"
    if [[ -d "$SUFFIX_DIR_FOR_BURN" ]]; then
      date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SUFFIX_DIR_FOR_BURN/burned.txt"
      printf 'lane=%s %s\n' "${LANE:-unknown}" "$1" >> "$SUFFIX_DIR_FOR_BURN/burned.txt"
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
  printf 'C5D_EVIDENCE_ERROR: unexpected non-zero script exit (code %s)\n' "$exit_code" >&2
  if [[ -n "${EVIDENCE_DIR:-}" ]]; then
    mkdir -p "$EVIDENCE_DIR" 2>/dev/null || true
    { date -u '+%Y-%m-%dT%H:%M:%SZ'; printf 'unexpected non-zero script exit code %s (fail-closed EXIT trap)\n' "$exit_code"; } >> "$EVIDENCE_DIR/burned.txt" 2>/dev/null || true
  fi
  if [[ -n "${RUNTIME_DIR:-}" ]]; then
    local suffix_dir_for_burn
    suffix_dir_for_burn="$(dirname "$RUNTIME_DIR" 2>/dev/null || true)"
    if [[ -n "$suffix_dir_for_burn" ]]; then
      mkdir -p "$suffix_dir_for_burn" 2>/dev/null || true
      { date -u '+%Y-%m-%dT%H:%M:%SZ'; printf 'lane=%s unexpected non-zero script exit code %s (fail-closed EXIT trap)\n' "${LANE:-unknown}" "$exit_code"; } >> "$suffix_dir_for_burn/burned.txt" 2>/dev/null || true
    fi
  fi
}
trap on_unexpected_exit EXIT

# `supabase migration list` renders a Local/Remote-column table keyed by
# exact 14-digit version. This isolates the line containing the target
# version and counts its occurrences on that single line: 2 means present in
# both columns (applied), 1 means present in exactly one column (pending/
# local-only), 0 means entirely absent. Delimiter-agnostic (tabs/spaces/
# pipes all work identically).
migration_list_state() {
  python3 - "$1" "$FORMAL_VERSION" <<'PY'
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
}

# Independent, read-only, CLI-agnostic corroboration of the migration-list
# proof: query the CLI's own ledger table directly (SELECT only, never an
# apply). Prints the exact row count for the formal version.
ledger_count_for_formal_version() {
  "$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -At -c \
    "select count(*) from supabase_migrations.schema_migrations where version = '$FORMAL_VERSION';"
}

# Full post-apply proof for one lane: runs `supabase migration list --local`,
# asserts BOTH (Local+Remote) via version-aware column parsing, then runs the
# independent read-only psql ledger-count proof (expect exactly 1), and
# writes the combined evidence file. Any failure burns via fail().
assert_formal_applied_exactly_once() {
  local list_log="$EVIDENCE_DIR/migration-list-after-apply.txt"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase migration list --local --workdir "$RUNTIME_DIR" > "$list_log" 2>&1
  local list_exit=$?
  set -e
  log_cmd "supabase migration list --local --workdir <lane> (post-apply check)" "$list_exit"
  [[ "$list_exit" -eq 0 ]] || fail "supabase migration list --local failed after apply with exit $list_exit"

  local list_state
  list_state="$(migration_list_state "$list_log")"
  [[ "$list_state" == "BOTH" ]] || fail "C5D_MIGRATION_LIST_PROOF_FAILED: expected formal version $FORMAL_VERSION to be Local+Remote (applied exactly once), observed $list_state"

  set +e
  local ledger_count
  ledger_count="$(ledger_count_for_formal_version)"
  local ledger_exit=$?
  set -e
  log_cmd "psql read-only ledger count after apply (supabase_migrations.schema_migrations)" "$ledger_exit"
  [[ "$ledger_exit" -eq 0 ]] || fail "read-only ledger-count proof query failed after apply"
  [[ "$ledger_count" == "1" ]] || fail "C5D_MIGRATION_LIST_PROOF_FAILED: expected exactly one ledger row for $FORMAL_VERSION after apply, found $ledger_count"

  {
    printf 'formal_version=%s\n' "$FORMAL_VERSION"
    printf 'migration_list_state=%s (expected BOTH)\n' "$list_state"
    printf 'ledger_count=%s (expected 1, read-only psql SELECT against supabase_migrations.schema_migrations)\n' "$ledger_count"
  } > "$EVIDENCE_DIR/migration-list-proof.txt"
}

log_cmd() {
  python3 -c "
import json, sys
with open('$EVIDENCE_DIR/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'capture-evidence.sh', 'lane': '$LANE', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$1" "$2" 2>/dev/null || true
}

[[ "${GYEON_ORDER_V3_C5D_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ "$LANE" == "fresh" || "$LANE" == "populated" || "$LANE" == "runner" ]] || fail "GYEON_ORDER_V3_C5D_LANE must be exactly one of: fresh, populated, runner"
[[ -n "$RUNTIME_DIR" ]] || fail "GYEON_ORDER_V3_C5D_RUNTIME_DIR is required"
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gyeon-order-v3-c5d\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}/${LANE}$ ]] || fail "runtime path does not match the dedicated disposable pattern for this lane"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"
[[ -f "$RUNTIME_DIR/evidence/supabase-status.env" ]] || fail "status evidence is missing; setup.sh must run first for this lane"
[[ ! -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]] || fail "linked project state is forbidden"
[[ -n "$PSQL_BIN" && -x "$PSQL_BIN" ]] || fail "GYEON_ORDER_V3_C5D_PSQL_BIN must be an executable path"

EVIDENCE_DIR="$RUNTIME_DIR/evidence"
ATTEMPT_MARKER="$EVIDENCE_DIR/attempt-started.txt"
[[ ! -e "$ATTEMPT_MARKER" ]] || fail "this lane has already been attempted and is burned"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$ATTEMPT_MARKER"

set -a
source "$EVIDENCE_DIR/supabase-status.env"
set +a

C5D_API_URL="${API_URL:-${SUPABASE_URL:-}}"
C5D_DB_URL="${DB_URL:-}"
C5D_ANON_KEY="${ANON_KEY:-}"
C5D_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
[[ -n "$C5D_API_URL" && -n "$C5D_DB_URL" ]] || fail "local status did not provide required endpoints"

case "$C5D_API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) fail "API endpoint is not loopback-only" ;;
esac
case "$C5D_DB_URL" in
  postgresql://*127.0.0.1:*|postgresql://*localhost:*) ;;
  *) fail "database endpoint is not loopback-only" ;;
esac

export C5D_API_URL C5D_DB_URL C5D_ANON_KEY C5D_SERVICE_ROLE_KEY
export GYEON_ORDER_V3_C5D_SUFFIX="${GYEON_ORDER_V3_C5D_SUFFIX:-$(basename "$(dirname "$RUNTIME_DIR")" | sed 's/^gyeon-order-v3-c5d\.//')}"

verify_tap_strict() {
  python3 - "$1" "$2" <<'PY'
import re
import sys

raw_path, file_label = sys.argv[1:3]
with open(raw_path, encoding="utf-8", errors="replace") as handle:
    text = handle.read()

if re.search(r"NOTESTS", text):
    print(f"TAP_STRICT_FAIL[{file_label}]: NOTESTS marker present", file=sys.stderr); sys.exit(1)
if re.search(r"#\s*SKIP", text, re.IGNORECASE):
    print(f"TAP_STRICT_FAIL[{file_label}]: a SKIP directive is present", file=sys.stderr); sys.exit(1)
if re.search(r"#\s*TODO", text, re.IGNORECASE):
    print(f"TAP_STRICT_FAIL[{file_label}]: a TODO directive is present", file=sys.stderr); sys.exit(1)
if re.search(r"^\s*Parse errors?:", text, re.MULTILINE | re.IGNORECASE):
    print(f"TAP_STRICT_FAIL[{file_label}]: pg_prove reported a TAP parse error", file=sys.stderr); sys.exit(1)

plan_match = re.search(r"^1\.\.(\d+)\s*$", text, re.MULTILINE)
result_lines = re.findall(r"^(ok|not ok) ([0-9]+)\b", text, re.MULTILINE)
if plan_match and result_lines:
    plan = int(plan_match.group(1)); count = len(result_lines)
    failed = [seq for status, seq in result_lines if status == "not ok"]
else:
    file_summaries = re.findall(r"\bTests:\s*(\d+)\s+Failed:\s*(\d+)\)", text)
    run_summaries = re.findall(r"\bFiles=\d+,\s*Tests=(\d+)\b", text)
    if not run_summaries:
        print(f"TAP_STRICT_FAIL[{file_label}]: neither raw TAP nor a pg_prove test-count summary was found", file=sys.stderr); sys.exit(1)
    plan = int(run_summaries[-1]); count = plan
    failed_count = sum(int(failed) for _, failed in file_summaries)
    failed_list_match = re.search(r"^\s*Failed tests:\s*(.+)$", text, re.MULTILINE)
    failed = [failed_list_match.group(1).strip()] if failed_list_match else ([str(failed_count)] if failed_count else [])
    if re.search(r"^Result:\s*FAIL\s*$", text, re.MULTILINE):
        failed = failed or ["pg_prove-result-fail"]

if plan == 0 or count == 0:
    print(f"TAP_STRICT_FAIL[{file_label}]: zero assertions (plan={plan}, count={count})", file=sys.stderr); sys.exit(1)
if count != plan:
    print(f"TAP_STRICT_FAIL[{file_label}]: plan/count mismatch (plan={plan}, count={count})", file=sys.stderr); sys.exit(1)
if failed:
    print(f"TAP_STRICT_FAIL[{file_label}]: failing assertion(s): {','.join(failed)}", file=sys.stderr); sys.exit(1)
print(f"plan={plan} count={count}")
PY
}

secret_scan() {
  set +e
  grep -RInE '(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sk_live_|password"?\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY)' \
    --exclude='supabase-status.env' --exclude='secret-scan.txt' --exclude='*.raw' \
    "$EVIDENCE_DIR" > "$EVIDENCE_DIR/secret-scan.txt.matches" 2>/dev/null
  local found=$?
  set -e
  log_cmd "secret scan (grep -RInE over evidence dir)" "$found"
  if [[ "$found" -eq 0 ]]; then
    printf 'SECRET_SCAN_FAIL\n' > "$EVIDENCE_DIR/secret-scan.txt"
    cat "$EVIDENCE_DIR/secret-scan.txt.matches" >> "$EVIDENCE_DIR/secret-scan.txt"
    rm -f "$EVIDENCE_DIR/secret-scan.txt.matches"
    fail "secret scan detected a possible token/password/key pattern in retained evidence"
  else
    printf 'SECRET_SCAN_CLEAN\n' > "$EVIDENCE_DIR/secret-scan.txt"
    rm -f "$EVIDENCE_DIR/secret-scan.txt.matches"
  fi
}

# ===========================================================================
# LANE: fresh
# ===========================================================================
if [[ "$LANE" == "fresh" ]]; then
  TAP_SCHEMA="$EVIDENCE_DIR/.tap-schema-rls.raw"
  TAP_QUALIFICATION="$EVIDENCE_DIR/.tap-qualification-evidence.raw"
  TAP_WAREHOUSE="$EVIDENCE_DIR/.tap-prepare-finalize-warehouse.raw"

  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
    "$RUNTIME_DIR/supabase/tests/001-schema-rls.test.sql" > "$TAP_SCHEMA" 2>&1
  SCHEMA_TAP_EXIT=$?
  env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
    "$RUNTIME_DIR/supabase/tests/002-qualification-evidence.test.sql" > "$TAP_QUALIFICATION" 2>&1
  QUALIFICATION_TAP_EXIT=$?
  env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
    "$RUNTIME_DIR/supabase/tests/003-prepare-finalize-warehouse.test.sql" > "$TAP_WAREHOUSE" 2>&1
  WAREHOUSE_TAP_EXIT=$?
  set -e
  log_cmd "supabase test db 001-schema-rls.test.sql" "$SCHEMA_TAP_EXIT"
  log_cmd "supabase test db 002-qualification-evidence.test.sql" "$QUALIFICATION_TAP_EXIT"
  log_cmd "supabase test db 003-prepare-finalize-warehouse.test.sql" "$WAREHOUSE_TAP_EXIT"

  {
    printf '# file: 001-schema-rls.test.sql\n'; cat "$TAP_SCHEMA"
    printf '# file: 002-qualification-evidence.test.sql\n'; cat "$TAP_QUALIFICATION"
    printf '# file: 003-prepare-finalize-warehouse.test.sql\n'; cat "$TAP_WAREHOUSE"
  } > "$EVIDENCE_DIR/pgtap.tap"

  SCHEMA_TAP_STRICT="$(verify_tap_strict "$TAP_SCHEMA" "schema-rls" 2>&1)" || { printf '%s\n' "$SCHEMA_TAP_STRICT" >&2; fail "schema-rls.test.sql failed explicit TAP strictness verification"; }
  QUALIFICATION_TAP_STRICT="$(verify_tap_strict "$TAP_QUALIFICATION" "qualification-evidence" 2>&1)" || { printf '%s\n' "$QUALIFICATION_TAP_STRICT" >&2; fail "qualification-evidence.test.sql failed explicit TAP strictness verification"; }
  WAREHOUSE_TAP_STRICT="$(verify_tap_strict "$TAP_WAREHOUSE" "prepare-finalize-warehouse" 2>&1)" || { printf '%s\n' "$WAREHOUSE_TAP_STRICT" >&2; fail "prepare-finalize-warehouse.test.sql failed explicit TAP strictness verification"; }
  rm -f "$TAP_SCHEMA" "$TAP_QUALIFICATION" "$TAP_WAREHOUSE"
  [[ "$SCHEMA_TAP_EXIT" -eq 0 && "$QUALIFICATION_TAP_EXIT" -eq 0 && "$WAREHOUSE_TAP_EXIT" -eq 0 ]] || fail "pgTAP reported a failure, plan mismatch, or non-PASS result; the suffix is burned"

  set +e
  node "$RUNTIME_DIR/real-auth.mjs" > "$EVIDENCE_DIR/real-auth-results.ndjson" 2> "$EVIDENCE_DIR/real-auth.stderr.txt"
  REAL_AUTH_EXIT=$?
  set -e
  log_cmd "node real-auth.mjs" "$REAL_AUTH_EXIT"
  [[ "$REAL_AUTH_EXIT" -eq 0 ]] || fail "real-auth.mjs reported a failure; the suffix is burned"

  set +e
  node "$RUNTIME_DIR/concurrency.mjs" > "$EVIDENCE_DIR/.concurrency.raw.ndjson" 2> "$EVIDENCE_DIR/concurrency.stderr.txt"
  CONCURRENCY_EXIT=$?
  set -e
  log_cmd "node concurrency.mjs" "$CONCURRENCY_EXIT"
  python3 - "$EVIDENCE_DIR/.concurrency.raw.ndjson" "$EVIDENCE_DIR/concurrency-results.ndjson" "$EVIDENCE_DIR/backend-pids.ndjson" <<'PY'
import json, sys
raw_path, assertions_path, pids_path = sys.argv[1:4]
with open(raw_path, encoding="utf-8") as raw, open(assertions_path, "w", encoding="utf-8") as assertions, open(pids_path, "w", encoding="utf-8") as pids:
    for line in raw:
        line = line.strip()
        if not line: continue
        record = json.loads(line)
        if record.get("type") == "assertion": assertions.write(json.dumps(record) + "\n")
        elif record.get("type") == "backend_pid": pids.write(json.dumps(record) + "\n")
PY
  rm -f "$EVIDENCE_DIR/.concurrency.raw.ndjson"
  [[ "$CONCURRENCY_EXIT" -eq 0 ]] || fail "concurrency.mjs reported a failure, a non-distinct backend PID, or an UNKNOWN race outcome; the suffix is burned"

  assert_formal_applied_exactly_once

  psql_query() { "$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -At "$@"; }

  psql_query > "$EVIDENCE_DIR/schema-fingerprint.json" <<'SQL'
select jsonb_build_object(
  'postgres_version', current_setting('server_version'),
  'table_count', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (c.relname like 'gyeon_order%' or c.relname in ('product_orders','product_order_items'))),
  'rls_enabled_count', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and (c.relname like 'gyeon_order%' or c.relname in ('product_orders','product_order_items'))),
  'policy_count', (select count(*) from pg_policies where schemaname='public' and (tablename like 'gyeon_order%' or tablename in ('product_orders','product_order_items'))),
  'public_function_count', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%gyeon_order%v3%'),
  'private_function_count', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'gyeon_order_v3_%')
)::text;
SQL

  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase db lint --workdir "$RUNTIME_DIR" --local \
    --schema public --level warning --fail-on error > "$EVIDENCE_DIR/advisors.txt" 2>&1
  LINT_EXIT=$?
  set -e
  log_cmd "supabase db lint --schema public --level warning --fail-on error" "$LINT_EXIT"
  [[ "$LINT_EXIT" -eq 0 ]] || fail "supabase db lint reported an error-level issue; the suffix is burned"

  set +e
  psql_query > "$EVIDENCE_DIR/query-plans.txt" 2>&1 <<'SQL'
select '-- qualification-mode projection lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.gyeon_dealer_qualification_mode_projection
where dealer_id = '00000000-0000-0000-0000-000000000000'::uuid
  and effective_from <= now() and (effective_to is null or effective_to > now());
select '-- classification left-join lookup --';
explain (analyze, buffers, costs on, verbose off)
select i.quantity from public.product_order_items i
where i.order_id = '00000000-0000-0000-0000-000000000000'::uuid;
select '-- prepared/evidence lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.gyeon_order_external_evidence_v1
where purpose = 'inventory_reservation' and dealer_id = '00000000-0000-0000-0000-000000000000'::uuid
  and order_id = '00000000-0000-0000-0000-000000000000'::uuid and consumed_at is null;
select '-- warehouse task lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.gyeon_order_warehouse_tasks where order_id = '00000000-0000-0000-0000-000000000000'::uuid;
SQL
  QUERY_PLANS_EXIT=$?
  set -e
  log_cmd "psql explain (analyze, buffers) x4" "$QUERY_PLANS_EXIT"
  [[ "$QUERY_PLANS_EXIT" -eq 0 ]] || fail "query-plan capture failed; the suffix is burned"

  secret_scan

  python3 - "$EVIDENCE_DIR/.run-facts.json" "$RUNTIME_DIR" "$SCHEMA_TAP_EXIT" "$QUALIFICATION_TAP_EXIT" "$WAREHOUSE_TAP_EXIT" "$REAL_AUTH_EXIT" "$CONCURRENCY_EXIT" <<'PY'
import datetime, json, sys
out_path, runtime_dir, schema_exit, qualification_exit, warehouse_exit, real_auth_exit, concurrency_exit = sys.argv[1:8]
facts = {
    "lane": "fresh", "runtime_dir": runtime_dir,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "pgtap_exit": {"schema_rls": int(schema_exit), "qualification_evidence": int(qualification_exit), "prepare_finalize_warehouse": int(warehouse_exit)},
    "real_auth_exit": int(real_auth_exit), "concurrency_exit": int(concurrency_exit),
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(facts, handle, indent=2, sort_keys=True); handle.write("\n")
PY

# ===========================================================================
# LANE: populated
# ===========================================================================
elif [[ "$LANE" == "populated" ]]; then
  psql_exec() { "$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -q "$@"; }
  psql_query() { "$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -At "$@"; }

  # Representative committed legacy fixtures against the version-20260826143000
  # BASELINE schema only (verified directly from 048_create_product_orders.sql
  # plus 079_warehouse_daily_ops.sql's status-check widening; no column
  # introduced by the formal migration -- created_by, aggregate_version,
  # owner_review_state, payment_status, destination_kind, delivery_snapshot,
  # merchandise_list_ex_tax_yen, shipping_fee_ex_tax_yen, tax_yen,
  # grand_total_inc_tax_yen, contains_backorder on product_orders, or
  # list_price_ex_tax_snapshot on product_order_items -- is ever referenced):
  #
  #   product_orders(id, dealer_id, order_number, status, order_date, notes,
  #                   created_at, updated_at)
  #   product_order_items(id, order_id, product_id, sku, product_name_snapshot,
  #                         retail_price_snapshot, quantity, subtotal, created_at)
  #
  # Two dealers, all four legacy statuses (draft/submitted/approved/cancelled
  # -- valid under both the pre- and post-migration status CHECK, which the
  # formal migration reproduces unchanged), one real legacy gyeon_products row
  # (FK-valid product_id, never NULL), positive item quantities, legacy money
  # (retail_price_snapshot/subtotal), nullable legacy columns (order_number/
  # order_date/notes populated on some rows and left NULL on others), and
  # fixed explicit timestamps (never now()) so post-migration preservation can
  # be asserted byte-for-byte rather than merely "not null".
  FIXTURE_LOG="$EVIDENCE_DIR/.fixture-insert.raw.log"
  set +e
  psql_exec -f /dev/stdin > "$FIXTURE_LOG" 2>&1 <<'SQL'
begin;
insert into public.dealers(id,name,dealer_type,status) values
  ('c5d40000-0000-4000-8000-000000000001','C5D Populated Dealer One','GYEON_DETAILER','active'),
  ('c5d40000-0000-4000-8000-000000000002','C5D Populated Dealer Two','GYEON_DETAILER','active');

insert into public.gyeon_products(id,sku,product_name,category,is_active) values
  ('c5d43000-0000-4000-8000-000000000001','C5D-LEGACY-1','C5D Legacy Product 1','coating',true);

insert into public.product_orders(id,dealer_id,order_number,status,order_date,notes,created_at,updated_at) values
  ('c5d42000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000001',null,'draft',null,null,'2026-08-20T01:00:00Z','2026-08-20T01:00:00Z'),
  ('c5d42000-0000-4000-8000-000000000002','c5d40000-0000-4000-8000-000000000001','PO-LEGACY-0002','submitted','2026-08-21','legacy submitted note','2026-08-21T02:00:00Z','2026-08-21T03:00:00Z'),
  ('c5d42000-0000-4000-8000-000000000003','c5d40000-0000-4000-8000-000000000002','PO-LEGACY-0003','approved','2026-08-22',null,'2026-08-22T04:00:00Z','2026-08-22T05:00:00Z'),
  ('c5d42000-0000-4000-8000-000000000004','c5d40000-0000-4000-8000-000000000002',null,'cancelled',null,'legacy cancelled note','2026-08-23T06:00:00Z','2026-08-23T06:30:00Z');

insert into public.product_order_items(id,order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,created_at) values
  ('c5d44000-0000-4000-8000-000000000001','c5d42000-0000-4000-8000-000000000001','c5d43000-0000-4000-8000-000000000001','C5D-LEGACY-1','C5D Legacy Product 1',11000,1,10000,'2026-08-20T01:00:00Z'),
  ('c5d44000-0000-4000-8000-000000000002','c5d42000-0000-4000-8000-000000000002','c5d43000-0000-4000-8000-000000000001','C5D-LEGACY-1','C5D Legacy Product 1',11000,2,20000,'2026-08-21T02:00:00Z'),
  ('c5d44000-0000-4000-8000-000000000003','c5d42000-0000-4000-8000-000000000003','c5d43000-0000-4000-8000-000000000001','C5D-LEGACY-1','C5D Legacy Product 1',11000,3,30000,'2026-08-22T04:00:00Z'),
  ('c5d44000-0000-4000-8000-000000000004','c5d42000-0000-4000-8000-000000000004','c5d43000-0000-4000-8000-000000000001','C5D-LEGACY-1','C5D Legacy Product 1',11000,1,15000,'2026-08-23T06:00:00Z');
commit;
SQL
  FIXTURE_EXIT=$?
  set -e
  log_cmd "psql legacy fixture insert (committed, pre-migration, baseline columns only)" "$FIXTURE_EXIT"
  [[ "$FIXTURE_EXIT" -eq 0 ]] || { cat "$FIXTURE_LOG" >&2; rm -f "$FIXTURE_LOG"; fail "legacy fixture insert failed with exit $FIXTURE_EXIT"; }
  rm -f "$FIXTURE_LOG"

  # Canonical fingerprint: full per-row detail (not just id/status/total) for
  # both product_orders and product_order_items, plus explicit PK/FK-integrity
  # counts. Run byte-identically before and after the formal migration.
  cat > "$EVIDENCE_DIR/.fingerprint-query.sql" <<'SQL'
select jsonb_build_object(
  'orders', (
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'dealer_id', o.dealer_id, 'order_number', o.order_number,
      'status', o.status, 'order_date', o.order_date, 'notes', o.notes,
      'created_at', o.created_at, 'updated_at', o.updated_at
    ) order by o.id)
    from public.product_orders o
    where o.dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002')
  ),
  'order_count', (select count(*) from public.product_orders where dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002')),
  'items', (
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'order_id', i.order_id, 'product_id', i.product_id, 'sku', i.sku,
      'product_name_snapshot', i.product_name_snapshot, 'retail_price_snapshot', i.retail_price_snapshot,
      'quantity', i.quantity, 'subtotal', i.subtotal, 'created_at', i.created_at
    ) order by i.id)
    from public.product_order_items i
    where i.order_id in (select id from public.product_orders where dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002'))
  ),
  'item_count', (select count(*) from public.product_order_items where order_id in (select id from public.product_orders where dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002'))),
  'item_quantities_all_positive', (select bool_and(quantity > 0) from public.product_order_items where order_id in (select id from public.product_orders where dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002'))),
  'orphan_items_missing_order', (
    select count(*) from public.product_order_items i
    where i.id in ('c5d44000-0000-4000-8000-000000000001','c5d44000-0000-4000-8000-000000000002','c5d44000-0000-4000-8000-000000000003','c5d44000-0000-4000-8000-000000000004')
      and not exists (select 1 from public.product_orders o where o.id = i.order_id)
  ),
  'items_with_invalid_product_fk', (
    select count(*) from public.product_order_items i
    where i.id in ('c5d44000-0000-4000-8000-000000000001','c5d44000-0000-4000-8000-000000000002','c5d44000-0000-4000-8000-000000000003','c5d44000-0000-4000-8000-000000000004')
      and i.product_id is not null
      and not exists (select 1 from public.gyeon_products p where p.id = i.product_id)
  ),
  'canonical_hash', (
    select md5(string_agg(
      o.id::text||'|'||o.dealer_id::text||'|'||coalesce(o.order_number,'<null>')||'|'||o.status||'|'
      ||coalesce(o.order_date::text,'<null>')||'|'||coalesce(o.notes,'<null>')||'|'
      ||o.created_at::text||'|'||o.updated_at::text,
      ',' order by o.id
    ))
    from public.product_orders o
    where o.dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002')
  ),
  'canonical_hash_items', (
    select md5(string_agg(
      i.id::text||'|'||i.order_id::text||'|'||coalesce(i.product_id::text,'<null>')||'|'||i.sku||'|'
      ||i.product_name_snapshot||'|'||coalesce(i.retail_price_snapshot::text,'<null>')||'|'
      ||i.quantity::text||'|'||coalesce(i.subtotal::text,'<null>')||'|'||i.created_at::text,
      ',' order by i.id
    ))
    from public.product_order_items i
    where i.order_id in (select id from public.product_orders where dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002'))
  )
)::text;
SQL

  psql_query -f "$EVIDENCE_DIR/.fingerprint-query.sql" > "$EVIDENCE_DIR/pre-migration-fingerprint.json"

  APPLY_LOG="$EVIDENCE_DIR/.migration-up.raw.log"
  APPLY_STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase migration up --local --workdir "$RUNTIME_DIR" > "$APPLY_LOG" 2>&1
  APPLY_EXIT=$?
  set -e
  APPLY_FINISHED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  log_cmd "supabase migration up --local --workdir <lane>" "$APPLY_EXIT"
  {
    printf 'command=supabase migration up --local\n'
    printf 'started_at=%s\n' "$APPLY_STARTED_AT"
    printf 'finished_at=%s\n' "$APPLY_FINISHED_AT"
    printf 'exit_code=%s\n' "$APPLY_EXIT"
  } > "$EVIDENCE_DIR/formal-migration-apply.txt"
  rm -f "$APPLY_LOG"
  [[ "$APPLY_EXIT" -eq 0 ]] || fail "C5D_CHANGES_REQUIRED_SOURCE: supabase migration up --local (formal, populated lane) failed with exit $APPLY_EXIT"

  # Byte-identical query file re-run post-migration: a genuine complete
  # canonical-fingerprint comparison, not merely id/status/grand-total.
  psql_query -f "$EVIDENCE_DIR/.fingerprint-query.sql" > "$EVIDENCE_DIR/post-migration-fingerprint.json"
  rm -f "$EVIDENCE_DIR/.fingerprint-query.sql"

  FINGERPRINT_COMPARE="$(python3 - "$EVIDENCE_DIR/pre-migration-fingerprint.json" "$EVIDENCE_DIR/post-migration-fingerprint.json" <<'PY'
import json, sys
pre_path, post_path = sys.argv[1:3]
pre = json.load(open(pre_path))
post = json.load(open(post_path))
mismatches = []
for key in ('orders', 'order_count', 'items', 'item_count', 'canonical_hash', 'canonical_hash_items'):
    if pre.get(key) != post.get(key):
        mismatches.append(key)
if pre.get('orphan_items_missing_order') != 0 or post.get('orphan_items_missing_order') != 0:
    mismatches.append('orphan_items_missing_order_nonzero')
if pre.get('items_with_invalid_product_fk') != 0 or post.get('items_with_invalid_product_fk') != 0:
    mismatches.append('items_with_invalid_product_fk_nonzero')
if not pre.get('item_quantities_all_positive') or not post.get('item_quantities_all_positive'):
    mismatches.append('item_quantities_all_positive_false')
if mismatches:
    print('MISMATCH:' + ','.join(mismatches))
else:
    print('MATCH')
PY
)"
  [[ "$FINGERPRINT_COMPARE" == "MATCH" ]] || fail "canonical legacy fingerprint changed across the formal migration: $FINGERPRINT_COMPARE"

  TAP_UPGRADE="$EVIDENCE_DIR/.tap-populated-upgrade.raw"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
    "$RUNTIME_DIR/supabase/tests/004-populated-upgrade.test.sql" > "$TAP_UPGRADE" 2>&1
  UPGRADE_TAP_EXIT=$?
  set -e
  log_cmd "supabase test db 004-populated-upgrade.test.sql" "$UPGRADE_TAP_EXIT"
  cp "$TAP_UPGRADE" "$EVIDENCE_DIR/pgtap-populated-upgrade.tap"
  UPGRADE_TAP_STRICT="$(verify_tap_strict "$TAP_UPGRADE" "populated-upgrade" 2>&1)" || { printf '%s\n' "$UPGRADE_TAP_STRICT" >&2; rm -f "$TAP_UPGRADE"; fail "populated-upgrade.test.sql failed explicit TAP strictness verification"; }
  rm -f "$TAP_UPGRADE"
  [[ "$UPGRADE_TAP_EXIT" -eq 0 ]] || fail "populated-upgrade.test.sql pgTAP reported a failure; the suffix is burned"

  assert_formal_applied_exactly_once

  secret_scan

  python3 - "$EVIDENCE_DIR/.run-facts.json" "$RUNTIME_DIR" "$APPLY_EXIT" "$UPGRADE_TAP_EXIT" <<'PY'
import datetime, json, sys
out_path, runtime_dir, apply_exit, upgrade_tap_exit = sys.argv[1:5]
facts = {
    "lane": "populated", "runtime_dir": runtime_dir,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "migration_up_exit": int(apply_exit), "populated_upgrade_tap_exit": int(upgrade_tap_exit),
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(facts, handle, indent=2, sort_keys=True); handle.write("\n")
PY

# ===========================================================================
# LANE: runner
# ===========================================================================
elif [[ "$LANE" == "runner" ]]; then
  [[ -f "$EVIDENCE_DIR/migration-list-before-apply.txt" ]] || fail "setup.sh's pre-apply pending proof is missing"
  cp "$EVIDENCE_DIR/migration-list-before-apply.txt" "$EVIDENCE_DIR/migration-list-before-apply.txt.bak" 2>/dev/null || true

  APPLY_LOG="$EVIDENCE_DIR/.migration-up.raw.log"
  APPLY_STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase migration up --local --workdir "$RUNTIME_DIR" > "$APPLY_LOG" 2>&1
  APPLY_EXIT=$?
  set -e
  APPLY_FINISHED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  log_cmd "supabase migration up --local --workdir <lane>" "$APPLY_EXIT"
  {
    printf 'command=supabase migration up --local\n'
    printf 'started_at=%s\n' "$APPLY_STARTED_AT"
    printf 'finished_at=%s\n' "$APPLY_FINISHED_AT"
    printf 'exit_code=%s\n' "$APPLY_EXIT"
  } > "$EVIDENCE_DIR/formal-migration-apply.txt"
  rm -f "$APPLY_LOG"
  [[ "$APPLY_EXIT" -eq 0 ]] || fail "C5D_CHANGES_REQUIRED_SOURCE: supabase migration up --local (formal, runner lane) failed with exit $APPLY_EXIT"

  assert_formal_applied_exactly_once

  # Zero direct-psql formal-application proof: this lane's own command ledger
  # (every command this script and setup.sh ran) must contain no entry that
  # invokes psql with the formal migration basename.
  ZERO_PSQL_PROOF="$EVIDENCE_DIR/zero-direct-psql-formal-apply-proof.txt"
  set +e
  grep -i "psql" "$EVIDENCE_DIR/.command-ledger.ndjson" | grep -F "$FORMAL_BASENAME" > /dev/null 2>&1
  PSQL_FORMAL_MATCH=$?
  set -e
  if [[ "$PSQL_FORMAL_MATCH" -eq 0 ]]; then
    fail "command ledger shows a psql invocation referencing the formal migration; direct-psql formal application is forbidden"
  fi
  {
    printf 'zero_direct_psql_formal_apply=true\n'
    printf 'formal_apply_command=supabase migration up --local\n'
    printf 'verified_against=.command-ledger.ndjson\n'
  } > "$ZERO_PSQL_PROOF"
  log_cmd "grep command ledger for psql+formal basename (must be zero matches)" "0"

  secret_scan

  python3 - "$EVIDENCE_DIR/.run-facts.json" "$RUNTIME_DIR" "$APPLY_EXIT" <<'PY'
import datetime, json, sys
out_path, runtime_dir, apply_exit = sys.argv[1:4]
facts = {
    "lane": "runner", "runtime_dir": runtime_dir,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "migration_up_exit": int(apply_exit),
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(facts, handle, indent=2, sort_keys=True); handle.write("\n")
PY
fi

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/attempt-completed.txt"

printf 'C5D_EVIDENCE_CAPTURED=%s\n' "$EVIDENCE_DIR"
printf 'C5D_LANE=%s\n' "$LANE"
printf 'C5D_CLASSIFICATION_PENDING=cleanup_then_manual_acceptance_review\n'
