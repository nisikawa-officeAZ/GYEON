#!/usr/bin/env bash
set -euo pipefail

# GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B one-attempt evidence runner. Run
# only after separately authorized setup.sh. A failed suffix is burned; this
# script never retries or repairs the database, and it never promotes a
# partial run into acceptance.
#
# Produces the raw evidence artifacts: versions.txt and source-hashes.sha256
# are already written by setup.sh; this script writes
# migration-replay.ndjson, schema-fingerprint.json, pgtap.tap,
# offering-guard-results.ndjson, real-auth-results.ndjson,
# concurrency-results.ndjson, backend-pids.ndjson, advisors.txt,
# query-plans.txt, and secret-scan.txt. It deliberately does NOT write
# manifest.json/summary.json/summary.md: those are finalized only by
# cleanup.sh, only after fixture teardown, the zero-row proof, and the
# project stop all succeed, so they can truthfully include the cleanup
# result. This script instead writes an internal ".run-facts.json" for
# cleanup.sh to fold into that final record.
#
# Structurally reuses the accepted
# scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh strict-TAP-verification
# and evidence-sequencing pattern. It copies no GYEON-order fixture, table,
# RPC name, or evidence vocabulary.

CONFIRM_LITERAL="I_UNDERSTAND_GDA_ESTIMATE_OFFERING_R1B_IS_DISPOSABLE"
RUNTIME_PARENT="${GDA_ESTIMATE_OFFERING_R1B_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GDA_ESTIMATE_OFFERING_R1B_RUNTIME_DIR:-}"

fail() {
  printf 'R1B_EVIDENCE_ERROR: %s\n' "$1" >&2
  if [[ -n "${EVIDENCE_DIR:-}" && -d "$EVIDENCE_DIR" ]]; then
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/burned.txt"
    printf '%s\n' "$1" >> "$EVIDENCE_DIR/burned.txt"
  fi
  exit 1
}

log_cmd() {
  # log_cmd <description> <exit_code>
  python3 -c "
import json, sys
with open('$EVIDENCE_DIR/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'capture-evidence.sh', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$1" "$2" 2>/dev/null || true
}

[[ "${GDA_ESTIMATE_OFFERING_R1B_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$RUNTIME_DIR" ]] || fail "GDA_ESTIMATE_OFFERING_R1B_RUNTIME_DIR is required"
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gda-estimate-offering-r1b\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "runtime path does not match the dedicated disposable pattern"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"
[[ -f "$RUNTIME_DIR/evidence/supabase-status.env" ]] || fail "status evidence is missing; setup.sh must run first"
[[ ! -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]] || fail "linked project state is forbidden"

EVIDENCE_DIR="$RUNTIME_DIR/evidence"
ATTEMPT_MARKER="$EVIDENCE_DIR/attempt-started.txt"
[[ ! -e "$ATTEMPT_MARKER" ]] || fail "this suffix has already been attempted and is burned"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$ATTEMPT_MARKER"

set -a
source "$EVIDENCE_DIR/supabase-status.env"
set +a

R1B_API_URL="${API_URL:-${SUPABASE_URL:-}}"
R1B_DB_URL="${DB_URL:-}"
R1B_ANON_KEY="${ANON_KEY:-}"
R1B_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
[[ -n "$R1B_API_URL" && -n "$R1B_DB_URL" && -n "$R1B_ANON_KEY" && -n "$R1B_SERVICE_ROLE_KEY" ]] || fail "local status did not provide required endpoints and keys"

case "$R1B_API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) fail "API endpoint is not loopback-only" ;;
esac
case "$R1B_DB_URL" in
  postgresql://*127.0.0.1:*|postgresql://*localhost:*) ;;
  *) fail "database endpoint is not loopback-only" ;;
esac

export R1B_API_URL R1B_DB_URL R1B_ANON_KEY R1B_SERVICE_ROLE_KEY
export GDA_ESTIMATE_OFFERING_R1B_SUFFIX="${GDA_ESTIMATE_OFFERING_R1B_SUFFIX:-$(basename "$RUNTIME_DIR" | sed 's/^gda-estimate-offering-r1b\.//')}"

# ---------------------------------------------------------------------------
# pgTAP: BOTH pgTAP authorities are executed independently and strictly --
# the extended canonical atomic-save file AND the dedicated offering-guard
# file. `supabase test db` returns pg_prove's reporter output, not
# necessarily the original `1..N`/`ok N` stream, so this script accepts
# either representation and explicitly rejects skip, todo, NOTESTS, parse
# errors, failed assertions, a plan/count mismatch, or zero assertions, in
# addition to relying on the subprocess exit code. Hashing a file's source is
# never treated as proof that it ran; each file below is actually executed
# exactly once, independently, with its own strict plan/count evidence.
# ---------------------------------------------------------------------------

verify_tap_strict() {
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
if re.search(r"^\s*Parse errors?:", text, re.MULTILINE | re.IGNORECASE):
    print(f"TAP_STRICT_FAIL[{file_label}]: pg_prove reported a TAP parse error", file=sys.stderr)
    sys.exit(1)

plan_match = re.search(r"^1\.\.(\d+)\s*$", text, re.MULTILINE)
result_lines = re.findall(r"^(ok|not ok) ([0-9]+)\b", text, re.MULTILINE)

if plan_match and result_lines:
    plan = int(plan_match.group(1))
    count = len(result_lines)
    failed = [seq for status, seq in result_lines if status == "not ok"]
else:
    file_summaries = re.findall(r"\bTests:\s*(\d+)\s+Failed:\s*(\d+)\)", text)
    run_summaries = re.findall(r"\bFiles=\d+,\s*Tests=(\d+)\b", text)
    if not run_summaries:
        print(f"TAP_STRICT_FAIL[{file_label}]: neither raw TAP nor a pg_prove test-count summary was found", file=sys.stderr)
        sys.exit(1)
    plan = int(run_summaries[-1])
    count = plan
    failed_count = sum(int(failed) for _, failed in file_summaries)
    failed_list_match = re.search(r"^\s*Failed tests:\s*(.+)$", text, re.MULTILINE)
    failed = [failed_list_match.group(1).strip()] if failed_list_match else ([str(failed_count)] if failed_count else [])
    if re.search(r"^Result:\s*FAIL\s*$", text, re.MULTILINE):
        failed = failed or ["pg_prove-result-fail"]

if plan == 0 or count == 0:
    print(f"TAP_STRICT_FAIL[{file_label}]: zero assertions (plan={plan}, count={count})", file=sys.stderr)
    sys.exit(1)
if count != plan:
    print(f"TAP_STRICT_FAIL[{file_label}]: plan/count mismatch (plan={plan}, count={count})", file=sys.stderr)
    sys.exit(1)
if failed:
    print(f"TAP_STRICT_FAIL[{file_label}]: failing assertion(s): {','.join(failed)}", file=sys.stderr)
    sys.exit(1)

print(f"plan={plan} count={count}")
PY
}

tap_to_ndjson() {
  python3 - "$1" <<'PY'
import json
import re
import sys

pattern = re.compile(r"^(ok|not ok) ([0-9]+) - (.*)$")
with open(sys.argv[1], encoding="utf-8", errors="replace") as handle:
    text = handle.read()

records = []
for line in text.splitlines():
    match = pattern.match(line)
    if not match:
        continue
    status, seq, description = match.groups()
    records.append({"seq": int(seq), "ok": status == "ok", "description": description, "source": "raw_tap"})

if records:
    for record in records:
        print(json.dumps(record))
else:
    summaries = re.findall(r"\bFiles=\d+,\s*Tests=(\d+)\b", text)
    result_pass = re.search(r"^Result:\s*PASS\s*$", text, re.MULTILINE) is not None
    if not summaries or not result_pass:
        sys.exit("tap_to_ndjson: strict verification should have rejected a reporter stream without a PASS count")
    total = int(summaries[-1])
    for seq in range(1, total + 1):
        print(json.dumps({
            "seq": seq,
            "ok": True,
            "description": f"pg_prove summary-derived PASS assertion {seq} of {total}",
            "source": "pg_prove_summary"
        }))
PY
}

run_pgtap_file() {
  # run_pgtap_file <test_path> <label> <results_ndjson_name>
  # Runs exactly once, verifies strictly, writes separated raw TAP and NDJSON
  # evidence for this file alone, and burns the suffix on any failure. Prints
  # "<exit_code>\n<plan=P count=C>" for the caller to capture.
  local test_path="$1" label="$2" results_name="$3"
  local raw="$EVIDENCE_DIR/.tap-${label}.raw"
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
    "$test_path" > "$raw" 2>&1
  local exit_code=$?
  set -e
  log_cmd "supabase test db $(basename "$test_path")" "$exit_code"

  { printf '# file: %s\n' "$(basename "$test_path")"; cat "$raw"; } > "$EVIDENCE_DIR/pgtap-${label}.tap"

  local strict
  strict="$(verify_tap_strict "$raw" "$label" 2>&1)" || { printf '%s\n' "$strict" >&2; fail "$label failed explicit TAP strictness verification"; }

  tap_to_ndjson "$raw" > "$EVIDENCE_DIR/${results_name}"
  rm -f "$raw"

  if [[ "$exit_code" -ne 0 ]]; then
    fail "$label reported a failure, plan mismatch, or non-PASS result; the suffix is burned"
  fi

  printf '%s\n%s' "$exit_code" "$strict"
}

CANONICAL_RUN="$(run_pgtap_file "$RUNTIME_DIR/supabase/tests/000-canonical-atomic-save.test.sql" "canonical-atomic-save" "canonical-atomic-save-results.ndjson")"
CANONICAL_TAP_EXIT="$(printf '%s' "$CANONICAL_RUN" | sed -n '1p')"
CANONICAL_STRICT="$(printf '%s' "$CANONICAL_RUN" | sed -n '2p')"

OFFERING_RUN="$(run_pgtap_file "$RUNTIME_DIR/supabase/tests/001-offering-guard.test.sql" "offering-guard" "offering-guard-results.ndjson")"
OFFERING_TAP_EXIT="$(printf '%s' "$OFFERING_RUN" | sed -n '1p')"
OFFERING_STRICT="$(printf '%s' "$OFFERING_RUN" | sed -n '2p')"

CANONICAL_PLAN="$(printf '%s' "$CANONICAL_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\1/p')"
CANONICAL_COUNT="$(printf '%s' "$CANONICAL_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\2/p')"
OFFERING_PLAN="$(printf '%s' "$OFFERING_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\1/p')"
OFFERING_COUNT="$(printf '%s' "$OFFERING_STRICT" | sed -nE 's/plan=([0-9]+) count=([0-9]+)/\2/p')"
# Correctly derived aggregate: the sum of the two independently strict plans
# and counts. Never a guessed or copied literal.
AGGREGATE_PLAN=$((CANONICAL_PLAN + OFFERING_PLAN))
AGGREGATE_COUNT=$((CANONICAL_COUNT + OFFERING_COUNT))

# Both run_pgtap_file calls above already `fail` (and exit) on a non-zero
# exit code, so reaching here means both files independently passed.
TAP_EXIT=0

# ---------------------------------------------------------------------------
# Real Auth / PostgREST and genuine two-process concurrency.
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
# ---------------------------------------------------------------------------

MIGRATION_OUTCOME_SOURCE="$RUNTIME_DIR/evidence/migration-replay-outcome.ndjson"
[[ -f "$MIGRATION_OUTCOME_SOURCE" ]] || fail "setup.sh's attributable migration-replay-outcome.ndjson is missing"
cp "$MIGRATION_OUTCOME_SOURCE" "$EVIDENCE_DIR/migration-replay.ndjson"

psql "$R1B_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/.applied-migrations.txt" <<'SQL'
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

psql "$R1B_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/schema-fingerprint.json" <<'SQL'
select jsonb_build_object(
  'postgres_version', current_setting('server_version'),
  'dealer_service_offerings_exists', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='dealer_service_offerings'),
  'dealer_service_offerings_rls_enabled', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='dealer_service_offerings'), false),
  'dealer_service_offerings_policy_count', (select count(*) from pg_policies where schemaname='public' and tablename='dealer_service_offerings'),
  'save_rpc_signature_present', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_estimate_from_wizard'),
  'save_rpc_security_invoker', (select not p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_estimate_from_wizard' limit 1),
  'save_rpc_service_role_execute', (select has_function_privilege('service_role','public.save_estimate_from_wizard(uuid,uuid,jsonb)','EXECUTE')),
  'save_rpc_authenticated_execute', (select has_function_privilege('authenticated','public.save_estimate_from_wizard(uuid,uuid,jsonb)','EXECUTE')),
  'offering_invalidation_trigger_count', (select count(*) from pg_trigger where tgrelid = 'public.dealer_service_offerings'::regclass and not tgisinternal)
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
psql "$R1B_DB_URL" -X -v ON_ERROR_STOP=1 -At > "$EVIDENCE_DIR/query-plans.txt" 2>&1 <<'SQL'
select '-- C.9a offering guard set-based lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.dealer_service_offerings o
 where o.dealer_id = '00000000-0000-0000-0000-000000000000'::uuid
   and o.family = 'maintenance'
   and o.enabled is true;
select '-- C.9 idempotency lookup --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.estimates
 where dealer_id = '00000000-0000-0000-0000-000000000000'::uuid
   and idempotency_key = 'nonexistent-key-000000000000000';
select '-- C.10a document_sequences selection --';
explain (analyze, buffers, costs on, verbose off)
select 1 from public.document_sequences s
 where s.dealer_id = '00000000-0000-0000-0000-000000000000'::uuid
   and s.sequence_type = 'estimate'
 order by s.updated_at desc, s.created_at desc, s.fiscal_year desc, s.id desc
 limit 1;
SQL
QUERY_PLANS_EXIT=$?
set -e
log_cmd "psql explain (analyze, buffers) x3" "$QUERY_PLANS_EXIT"
[[ "$QUERY_PLANS_EXIT" -eq 0 ]] || fail "query-plan capture failed; the suffix is burned"

# ---------------------------------------------------------------------------
# Secret scan. Must run and pass clean before any later result is accepted.
# ---------------------------------------------------------------------------

SECRET_SCAN_FILE="$EVIDENCE_DIR/secret-scan.txt"
set +e
grep -RInE '(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sk_live_|password"?\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY)' \
  --exclude='supabase-status.env' --exclude='secret-scan.txt' --exclude='*.raw' \
  "$EVIDENCE_DIR" > "$SECRET_SCAN_FILE.matches" 2>"$SECRET_SCAN_FILE.stderr"
GREP_EXIT=$?
set -e
log_cmd "secret scan (grep -RInE over evidence dir)" "$GREP_EXIT"
# Fail-closed on every grep exit status: 0 is a possible match (fail+burn), 1
# alone is a clean run, and any other status is a scan failure (fail+burn).
# A scan error is never classified as SECRET_SCAN_CLEAN.
if [[ "$GREP_EXIT" -eq 0 ]]; then
  printf 'SECRET_SCAN_FAIL\n' > "$SECRET_SCAN_FILE"
  cat "$SECRET_SCAN_FILE.matches" >> "$SECRET_SCAN_FILE"
  rm -f "$SECRET_SCAN_FILE.matches" "$SECRET_SCAN_FILE.stderr"
  fail "secret scan detected a possible token/password/key pattern in retained evidence"
elif [[ "$GREP_EXIT" -eq 1 ]]; then
  printf 'SECRET_SCAN_CLEAN\n' > "$SECRET_SCAN_FILE"
  rm -f "$SECRET_SCAN_FILE.matches" "$SECRET_SCAN_FILE.stderr"
else
  printf 'SECRET_SCAN_ERROR (grep exit %s)\n' "$GREP_EXIT" > "$SECRET_SCAN_FILE"
  cat "$SECRET_SCAN_FILE.stderr" >> "$SECRET_SCAN_FILE" 2>/dev/null || true
  rm -f "$SECRET_SCAN_FILE.matches" "$SECRET_SCAN_FILE.stderr"
  fail "secret scan exited with an unexpected status ($GREP_EXIT), neither a clean run nor a confirmed match; never classified as SECRET_SCAN_CLEAN"
fi

# ---------------------------------------------------------------------------
# Run facts. Internal record for cleanup.sh to fold into the FINAL
# manifest.json/summary.json/summary.md once fixture teardown, the zero-row
# proof, and the project stop have all actually succeeded.
# ---------------------------------------------------------------------------

python3 - "$EVIDENCE_DIR/.run-facts.json" \
  "$RUNTIME_DIR" \
  "$CANONICAL_TAP_EXIT" "$CANONICAL_PLAN" "$CANONICAL_COUNT" \
  "$OFFERING_TAP_EXIT" "$OFFERING_PLAN" "$OFFERING_COUNT" \
  "$AGGREGATE_PLAN" "$AGGREGATE_COUNT" \
  "$REAL_AUTH_EXIT" "$CONCURRENCY_EXIT" <<'PY'
import datetime
import json
import sys

(out_path, runtime_dir,
 canonical_exit, canonical_plan, canonical_count,
 offering_exit, offering_plan, offering_count,
 aggregate_plan, aggregate_count,
 real_auth_exit, concurrency_exit) = sys.argv[1:12]

facts = {
    "runtime_dir": runtime_dir,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "pgtap": {
        "canonical_atomic_save": {"exit": int(canonical_exit), "plan": int(canonical_plan), "count": int(canonical_count)},
        "offering_guard": {"exit": int(offering_exit), "plan": int(offering_plan), "count": int(offering_count)},
        "aggregate": {"plan": int(aggregate_plan), "count": int(aggregate_count)},
    },
    "real_auth_exit": int(real_auth_exit),
    "concurrency_exit": int(concurrency_exit),
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(facts, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/attempt-completed.txt"

printf 'R1B_EVIDENCE_CAPTURED=%s\n' "$EVIDENCE_DIR"
printf 'R1B_CLASSIFICATION_PENDING=cleanup_then_manual_acceptance_review\n'
