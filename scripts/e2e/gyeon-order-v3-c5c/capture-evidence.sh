#!/usr/bin/env bash
set -euo pipefail

# C5-C one-attempt evidence runner. Run only after separately authorized
# setup.sh. A failed suffix is burned; this script never retries or repairs
# the database, and it never promotes a partial run into acceptance.
#
# Produces the raw evidence artifacts from plan section 8: versions.txt,
# source-hashes.sha256 and runtime-derived-hashes.sha256 are already written
# by setup.sh; this script writes migration-replay.ndjson,
# schema-fingerprint.json, pgtap.tap, real-auth-results.ndjson,
# qualification-results.ndjson, evidence-prepare-finalize-results.ndjson,
# warehouse-results.ndjson, concurrency-results.ndjson, backend-pids.ndjson,
# advisors.txt, query-plans.txt, and secret-scan.txt. It deliberately does
# NOT write manifest.json/summary.json/summary.md: those are finalized only
# by cleanup.sh, only after fixture teardown, the zero-row proof, and the
# project stop all succeed, so they can truthfully include the cleanup
# result. This script instead writes an internal ".run-facts.json" (commands,
# exit codes, TAP plan/counts) for cleanup.sh to fold into that final record.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C5C_IS_DISPOSABLE"
RUNTIME_PARENT="${GYEON_ORDER_V3_C5C_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GYEON_ORDER_V3_C5C_RUNTIME_DIR:-}"

fail() {
  printf 'C5C_EVIDENCE_ERROR: %s\n' "$1" >&2
  if [[ -n "${EVIDENCE_DIR:-}" && -d "$EVIDENCE_DIR" ]]; then
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/burned.txt"
    printf '%s\n' "$1" >> "$EVIDENCE_DIR/burned.txt"
  fi
  exit 1
}

log_cmd() {
  # log_cmd <description> <exit_code> -- appended to the shared command
  # ledger that cleanup.sh folds into the final manifest.json (required 8).
  python3 -c "
import json, sys
with open('$EVIDENCE_DIR/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'capture-evidence.sh', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$1" "$2" 2>/dev/null || true
}

[[ "${GYEON_ORDER_V3_C5C_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$RUNTIME_DIR" ]] || fail "GYEON_ORDER_V3_C5C_RUNTIME_DIR is required"
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gyeon-order-v3-c5c\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "runtime path does not match the dedicated disposable pattern"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"
[[ -f "$RUNTIME_DIR/evidence/supabase-status.env" ]] || fail "status evidence is missing; setup.sh must run first"
[[ ! -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]] || fail "linked project state is forbidden"

EVIDENCE_DIR="$RUNTIME_DIR/evidence"
ATTEMPT_MARKER="$EVIDENCE_DIR/attempt-started.txt"
[[ ! -e "$ATTEMPT_MARKER" ]] || fail "this suffix has already been attempted and is burned"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$ATTEMPT_MARKER"

set -a
# Supabase CLI emits shell-quoted values. The file is private runtime state
# and must never be printed because it contains API secrets.
source "$EVIDENCE_DIR/supabase-status.env"
set +a

C5C_API_URL="${API_URL:-${SUPABASE_URL:-}}"
C5C_DB_URL="${DB_URL:-}"
C5C_ANON_KEY="${ANON_KEY:-}"
C5C_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
[[ -n "$C5C_API_URL" && -n "$C5C_DB_URL" && -n "$C5C_ANON_KEY" && -n "$C5C_SERVICE_ROLE_KEY" ]] || fail "local status did not provide required endpoints and keys"

case "$C5C_API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) fail "API endpoint is not loopback-only" ;;
esac
case "$C5C_DB_URL" in
  postgresql://*127.0.0.1:*|postgresql://*localhost:*) ;;
  *) fail "database endpoint is not loopback-only" ;;
esac

export C5C_API_URL C5C_DB_URL C5C_ANON_KEY C5C_SERVICE_ROLE_KEY
export GYEON_ORDER_V3_C5C_SUFFIX="${GYEON_ORDER_V3_C5C_SUFFIX:-$(basename "$RUNTIME_DIR" | sed 's/^gyeon-order-v3-c5c\.//')}"

# ---------------------------------------------------------------------------
# pgTAP: each of the three test files runs separately so this script can
# attribute raw TAP output to the exact qualification/evidence-prepare-
# finalize/warehouse evidence files required by plan section 8, in addition
# to the combined pgtap.tap record.
#
# pg_prove's own exit code is necessary but not sufficient: it can still
# exit 0 on a run that contains a plan mismatch it doesn't itself fail on in
# every CLI version, or that contains "# SKIP"/"# TODO" directives which TAP
# treats as a soft pass. This script therefore independently parses each raw
# TAP stream's own "1..N" plan header, counts the actual ok/not-ok lines,
# and explicitly rejects skip, todo, NOTESTS, a plan/count mismatch, or zero
# assertions, in addition to relying on the subprocess exit code.
# ---------------------------------------------------------------------------

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

verify_tap_strict() {
  # Exits non-zero (and prints the reason) on any plan mismatch, skip, todo,
  # NOTESTS marker, or zero-assertion run. Prints "plan=N count=N" on success
  # so the caller can capture it for the run-facts record.
  python3 - "$1" "$2" <<'PY'
import re
import sys

raw_path, file_label = sys.argv[1:3]
with open(raw_path, encoding="utf-8", errors="replace") as handle:
    text = handle.read()

if re.search(r"NOTESTS", text):
    print(f"TAP_STRICT_FAIL[{file_label}]: NOTESTS marker present", file=sys.stderr)
    sys.exit(1)
if re.search(r"#\s*SKIP", text, re.IGNORECASE):
    print(f"TAP_STRICT_FAIL[{file_label}]: a SKIP directive is present", file=sys.stderr)
    sys.exit(1)
if re.search(r"#\s*TODO", text, re.IGNORECASE):
    print(f"TAP_STRICT_FAIL[{file_label}]: a TODO directive is present", file=sys.stderr)
    sys.exit(1)

plan_match = re.search(r"^1\.\.(\d+)\s*$", text, re.MULTILINE)
if not plan_match:
    print(f"TAP_STRICT_FAIL[{file_label}]: no '1..N' TAP plan header found", file=sys.stderr)
    sys.exit(1)
plan = int(plan_match.group(1))

result_lines = re.findall(r"^(ok|not ok) ([0-9]+)\b", text, re.MULTILINE)
count = len(result_lines)
if plan == 0 or count == 0:
    print(f"TAP_STRICT_FAIL[{file_label}]: zero assertions (plan={plan}, count={count})", file=sys.stderr)
    sys.exit(1)
if count != plan:
    print(f"TAP_STRICT_FAIL[{file_label}]: plan/count mismatch (plan={plan}, count={count})", file=sys.stderr)
    sys.exit(1)
failed = [seq for status, seq in result_lines if status == "not ok"]
if failed:
    print(f"TAP_STRICT_FAIL[{file_label}]: {len(failed)} failing assertion(s): {','.join(failed)}", file=sys.stderr)
    sys.exit(1)

print(f"plan={plan} count={count}")
PY
}

SCHEMA_TAP_STRICT="$(verify_tap_strict "$TAP_SCHEMA" "schema-rls" 2>&1)" || { printf '%s\n' "$SCHEMA_TAP_STRICT" >&2; fail "schema-rls.test.sql failed explicit TAP strictness verification"; }
QUALIFICATION_TAP_STRICT="$(verify_tap_strict "$TAP_QUALIFICATION" "qualification-evidence" 2>&1)" || { printf '%s\n' "$QUALIFICATION_TAP_STRICT" >&2; fail "qualification-evidence.test.sql failed explicit TAP strictness verification"; }
WAREHOUSE_TAP_STRICT="$(verify_tap_strict "$TAP_WAREHOUSE" "prepare-finalize-warehouse" 2>&1)" || { printf '%s\n' "$WAREHOUSE_TAP_STRICT" >&2; fail "prepare-finalize-warehouse.test.sql failed explicit TAP strictness verification"; }

tap_to_ndjson() {
  # Converts "ok N - description" / "not ok N - description" lines to NDJSON.
  # A non-strict TAP line count relative to the file's own `plan(N)` is a
  # pg_prove-detected failure already reflected in its non-zero exit code.
  # Implemented in python3 (already a required dependency) rather than awk,
  # since 3-argument match() capture groups are a gawk extension not
  # guaranteed to exist in every platform's default awk.
  python3 - "$1" <<'PY'
import json
import re
import sys

pattern = re.compile(r"^(ok|not ok) ([0-9]+) - (.*)$")
with open(sys.argv[1], encoding="utf-8", errors="replace") as handle:
    for line in handle:
        match = pattern.match(line.rstrip("\n"))
        if not match:
            continue
        status, seq, description = match.groups()
        print(json.dumps({"seq": int(seq), "ok": status == "ok", "description": description}))
PY
}

tap_to_ndjson "$TAP_QUALIFICATION" > "$EVIDENCE_DIR/qualification-results.ndjson"

# The prepare-finalize-warehouse file's own numbering (matching its plan(48))
# is the exact split point: assertions 1-18 are the owner-submit/edit
# prepare-finalize/card-authority/compensation family; 19-48 are the
# warehouse release/accept/signature family.
: > "$EVIDENCE_DIR/evidence-prepare-finalize-results.ndjson"
: > "$EVIDENCE_DIR/warehouse-results.ndjson"
while IFS= read -r ndjson_line; do
  seq="$(printf '%s' "$ndjson_line" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["seq"])')"
  if [[ "$seq" -le 18 ]]; then
    printf '%s\n' "$ndjson_line" >> "$EVIDENCE_DIR/evidence-prepare-finalize-results.ndjson"
  else
    printf '%s\n' "$ndjson_line" >> "$EVIDENCE_DIR/warehouse-results.ndjson"
  fi
done < <(tap_to_ndjson "$TAP_WAREHOUSE")

rm -f "$TAP_SCHEMA" "$TAP_QUALIFICATION" "$TAP_WAREHOUSE"

if [[ "$SCHEMA_TAP_EXIT" -ne 0 || "$QUALIFICATION_TAP_EXIT" -ne 0 || "$WAREHOUSE_TAP_EXIT" -ne 0 ]]; then
  fail "pgTAP reported a failure, plan mismatch, or non-PASS result; the suffix is burned"
fi

# ---------------------------------------------------------------------------
# Real Auth / PostgREST and genuine two-connection concurrency.
# ---------------------------------------------------------------------------

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
import json
import sys

raw_path, assertions_path, pids_path = sys.argv[1:4]
with open(raw_path, encoding="utf-8") as raw, \
     open(assertions_path, "w", encoding="utf-8") as assertions, \
     open(pids_path, "w", encoding="utf-8") as pids:
    for line in raw:
        line = line.strip()
        if not line:
            continue
        record = json.loads(line)
        if record.get("type") == "assertion":
            assertions.write(json.dumps(record) + "\n")
        elif record.get("type") == "backend_pid":
            pids.write(json.dumps(record) + "\n")
PY
rm -f "$EVIDENCE_DIR/.concurrency.raw.ndjson"

[[ "$CONCURRENCY_EXIT" -eq 0 ]] || fail "concurrency.mjs reported a failure, a non-distinct backend PID, or an UNKNOWN race outcome; the suffix is burned"

# ---------------------------------------------------------------------------
# Migration replay ledger, schema fingerprint, advisors, query plans.
#
# The attributable per-migration outcome (exact start time, finish time,
# exit code, and SQLSTATE on failure) was already captured directly by
# setup.sh at the point of each individual `psql -f` invocation; this step
# carries that exact attribution through verbatim. The schema_migrations
# cross-reference appended below is supplementary corroboration only, never
# the attribution source itself (required 9).
# ---------------------------------------------------------------------------

MIGRATION_OUTCOME_SOURCE="$RUNTIME_DIR/evidence/migration-replay-outcome.ndjson"
[[ -f "$MIGRATION_OUTCOME_SOURCE" ]] || fail "setup.sh's attributable migration-replay-outcome.ndjson is missing"
cp "$MIGRATION_OUTCOME_SOURCE" "$EVIDENCE_DIR/migration-replay.ndjson"

psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/.applied-migrations.txt" <<'SQL'
select version from supabase_migrations.schema_migrations order by version;
SQL
python3 - "$EVIDENCE_DIR/.applied-migrations.txt" "$EVIDENCE_DIR/migration-replay.ndjson" <<'PY'
import sys

applied_path, out_path = sys.argv[1:3]
with open(applied_path, encoding="utf-8") as applied:
    versions = [line.strip() for line in applied if line.strip()]
with open(out_path, "a", encoding="utf-8") as out:
    out.write('{"applied_migration_count":%d}\n' % len(versions))
PY
rm -f "$EVIDENCE_DIR/.applied-migrations.txt"

psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/schema-fingerprint.json" <<'SQL'
select jsonb_build_object(
  'postgres_version', current_setting('server_version'),
  'table_count', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'gyeon_order%' or c.relname in ('product_orders','product_order_items')),
  'rls_enabled_count', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and (c.relname like 'gyeon_order%' or c.relname in ('product_orders','product_order_items'))),
  'policy_count', (select count(*) from pg_policies where schemaname='public' and (tablename like 'gyeon_order%' or tablename in ('product_orders','product_order_items'))),
  'public_function_count', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%gyeon_order%v3%'),
  'private_function_count', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'gyeon_order_v3_%'),
  'security_definer_count', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and p.prosecdef),
  'index_count', (select count(*) from pg_indexes where schemaname='public' and (tablename like 'gyeon_order%' or tablename in ('product_orders','product_order_items')))
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
psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/query-plans.txt" 2>&1 <<'SQL'
select '-- qualification-mode projection lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.gyeon_dealer_qualification_mode_projection
where dealer_id = '00000000-0000-0000-0000-000000000000'::uuid
  and effective_from <= now()
  and (effective_to is null or effective_to > now());
select '-- classification left-join lookup --';
explain (analyze, buffers, costs on, verbose off)
select i.quantity, c.classification, c.classification_version
from public.product_order_items i
left join public.gyeon_product_qualification_classification c
  on c.product_id = i.product_id and c.effective_to is null
where i.order_id = '00000000-0000-0000-0000-000000000000'::uuid;
select '-- prepared/evidence lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.gyeon_order_external_evidence_v1
where purpose = 'inventory_reservation'
  and dealer_id = '00000000-0000-0000-0000-000000000000'::uuid
  and order_id = '00000000-0000-0000-0000-000000000000'::uuid
  and consumed_at is null;
select '-- warehouse task lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.gyeon_order_warehouse_tasks
where order_id = '00000000-0000-0000-0000-000000000000'::uuid;
SQL
QUERY_PLANS_EXIT=$?
set -e
log_cmd "psql explain (analyze, buffers) x4" "$QUERY_PLANS_EXIT"
[[ "$QUERY_PLANS_EXIT" -eq 0 ]] || fail "query-plan capture failed; the suffix is burned"

# ---------------------------------------------------------------------------
# Secret scan. Must run and pass clean before any later result is accepted.
# ---------------------------------------------------------------------------

SECRET_SCAN_FILE="$EVIDENCE_DIR/secret-scan.txt"
set +e
grep -RInE '(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sk_live_|password"?\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY)' \
  --exclude='supabase-status.env' --exclude='secret-scan.txt' --exclude='*.raw' \
  "$EVIDENCE_DIR" > "$SECRET_SCAN_FILE.matches" 2>/dev/null
GREP_FOUND_MATCH=$?
set -e
log_cmd "secret scan (grep -RInE over evidence dir)" "$GREP_FOUND_MATCH"
if [[ "$GREP_FOUND_MATCH" -eq 0 ]]; then
  printf 'SECRET_SCAN_FAIL\n' > "$SECRET_SCAN_FILE"
  cat "$SECRET_SCAN_FILE.matches" >> "$SECRET_SCAN_FILE"
  rm -f "$SECRET_SCAN_FILE.matches"
  fail "secret scan detected a possible token/password/key pattern in retained evidence"
else
  printf 'SECRET_SCAN_CLEAN\n' > "$SECRET_SCAN_FILE"
  rm -f "$SECRET_SCAN_FILE.matches"
fi

# ---------------------------------------------------------------------------
# Run facts. This is an internal record (not one of the required evidence
# filenames) for cleanup.sh to fold into the FINAL manifest.json/summary.json
# /summary.md once fixture teardown, the zero-row proof, and the project stop
# have all actually succeeded. capture-evidence.sh never writes those three
# files itself: a manifest/summary written before cleanup could falsely
# imply acceptance of a run whose cleanup later fails.
# ---------------------------------------------------------------------------

SCHEMA_PLAN="$(printf '%s' "$SCHEMA_TAP_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\1/p')"
SCHEMA_COUNT="$(printf '%s' "$SCHEMA_TAP_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\2/p')"
QUALIFICATION_PLAN="$(printf '%s' "$QUALIFICATION_TAP_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\1/p')"
QUALIFICATION_COUNT="$(printf '%s' "$QUALIFICATION_TAP_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\2/p')"
WAREHOUSE_PLAN="$(printf '%s' "$WAREHOUSE_TAP_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\1/p')"
WAREHOUSE_COUNT="$(printf '%s' "$WAREHOUSE_TAP_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\2/p')"

python3 - "$EVIDENCE_DIR/.run-facts.json" \
  "$RUNTIME_DIR" "$SCHEMA_TAP_EXIT" "$SCHEMA_PLAN" "$SCHEMA_COUNT" \
  "$QUALIFICATION_TAP_EXIT" "$QUALIFICATION_PLAN" "$QUALIFICATION_COUNT" \
  "$WAREHOUSE_TAP_EXIT" "$WAREHOUSE_PLAN" "$WAREHOUSE_COUNT" \
  "$REAL_AUTH_EXIT" "$CONCURRENCY_EXIT" <<'PY'
import datetime
import json
import sys

(out_path, runtime_dir, schema_exit, schema_plan, schema_count,
 qualification_exit, qualification_plan, qualification_count,
 warehouse_exit, warehouse_plan, warehouse_count,
 real_auth_exit, concurrency_exit) = sys.argv[1:14]

facts = {
    "runtime_dir": runtime_dir,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    # Individual commands and exit codes are recorded via log_cmd() into the
    # shared .command-ledger.ndjson (required 8), not duplicated here.
    "pgtap": {
        "schema_rls": {"exit": int(schema_exit), "plan": int(schema_plan), "count": int(schema_count)},
        "qualification_evidence": {"exit": int(qualification_exit), "plan": int(qualification_plan), "count": int(qualification_count)},
        "prepare_finalize_warehouse": {"exit": int(warehouse_exit), "plan": int(warehouse_plan), "count": int(warehouse_count)},
    },
    "real_auth_exit": int(real_auth_exit),
    "concurrency_exit": int(concurrency_exit),
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(facts, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/attempt-completed.txt"

printf 'C5C_EVIDENCE_CAPTURED=%s\n' "$EVIDENCE_DIR"
printf 'C5C_CLASSIFICATION_PENDING=cleanup_then_manual_acceptance_review\n'
