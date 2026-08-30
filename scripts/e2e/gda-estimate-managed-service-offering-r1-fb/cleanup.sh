#!/usr/bin/env bash
set -euo pipefail

# GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_FB cleanup.
#
# Tears down fixtures/runtime exactly once, proves zero residual test rows
# and a stopped project, and creates manifest/summaries with SHA-256.
# Preserves failure evidence and never reruns or repairs the suffix.
#
# Structurally adapted, without mutation, from the accepted
# scripts/e2e/gda-estimate-managed-service-offering-r1-b/cleanup.sh
# preserved-identifier / named-zero-row-proof / retained-hash-verification /
# manifest-last pattern. It copies no GYEON-order or R1-B fixture, table, RPC
# name, or evidence vocabulary beyond the shared repository schema every
# sibling harness in this family already exercises. Regardless of an
# identifier-capture, DELETE, or zero-proof failure, the exact local Supabase
# project is still stopped exactly once before this script returns failure;
# a non-zero stop result is itself a cleanup failure. manifest.json -- the
# 16th and FINAL canonical artifact -- is generated only after evidence copy
# and exact runtime removal.

CONFIRM_LITERAL="I_UNDERSTAND_GDA_ESTIMATE_OFFERING_FB_IS_DISPOSABLE"
RUNTIME_PARENT="${GDA_ESTIMATE_OFFERING_FB_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GDA_ESTIMATE_OFFERING_FB_RUNTIME_DIR:-}"
RETAINED_EVIDENCE_PARENT="${GDA_ESTIMATE_OFFERING_FB_RETAINED_EVIDENCE_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-fb-evidence}"

fail() {
  printf 'FB_CLEANUP_ERROR: %s\n' "$1" >&2
  if [[ -n "${CLEANUP_LOG:-}" ]]; then
    printf '%s FAIL %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1" >> "$CLEANUP_LOG" 2>/dev/null || true
  fi
  exit 1
}

log_cmd() {
  python3 -c "
import json, sys
with open('$EVIDENCE_DIR/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'cleanup.sh', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$1" "$2" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Path validation.
# ---------------------------------------------------------------------------

[[ "${GDA_ESTIMATE_OFFERING_FB_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$RUNTIME_DIR" ]] || fail "GDA_ESTIMATE_OFFERING_FB_RUNTIME_DIR is required and must not be blank"
case "$RUNTIME_DIR" in
  *'*'*|*'?'*|*'['*) fail "runtime path must not contain glob characters" ;;
  /|"$HOME"|"$HOME"/|\~|\~/*) fail "runtime path must never resolve to \$HOME, ~, or /" ;;
  ..|*/../*|../*|*/..) fail "runtime path must not contain a parent-directory reference" ;;
esac
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gda-estimate-offering-fb\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "runtime path does not match the exact dedicated disposable pattern"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"

REPO_ROOT="${GDA_ESTIMATE_OFFERING_FB_REPO_ROOT:-}"
if [[ -n "$REPO_ROOT" ]]; then
  case "$RUNTIME_DIR" in
    "$REPO_ROOT"|"$REPO_ROOT"/*) fail "runtime path must never resolve inside the repository root" ;;
  esac
fi

EVIDENCE_DIR="$RUNTIME_DIR/evidence"
mkdir -p "$EVIDENCE_DIR"
[[ ! -e "$EVIDENCE_DIR/cleanup-started.txt" ]] || fail "this suffix has already been cleaned up once; cleanup never runs twice on the same suffix"

PROJECT_ID="$(cat "$EVIDENCE_DIR/project-id.txt" 2>/dev/null || echo "")"
WAS_BURNED="false"
[[ -e "$EVIDENCE_DIR/burned.txt" ]] && WAS_BURNED="true"

CLEANUP_LOG="$EVIDENCE_DIR/cleanup.log"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/cleanup-started.txt"
: > "$CLEANUP_LOG"
log() { printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1" >> "$CLEANUP_LOG"; }

log "cleanup started for runtime_dir=$RUNTIME_DIR project_id=${PROJECT_ID:-<none>} was_burned=$WAS_BURNED"

START_ATTEMPTED="false"
[[ -e "$EVIDENCE_DIR/start-attempted.txt" ]] && START_ATTEMPTED="true"
FIXTURE_ATTEMPTED="false"
[[ -e "$EVIDENCE_DIR/attempt-started.txt" ]] && FIXTURE_ATTEMPTED="true"

# ---------------------------------------------------------------------------
# Fixture teardown as a real bash FUNCTION (not a subshell), so every
# variable it sets remains visible afterward regardless of success or
# failure. It never calls fail()/exit itself -- any failure sets
# TEARDOWN_REASON and returns 1, so the caller can still attempt
# `supabase stop` before the script ultimately fails.
# ---------------------------------------------------------------------------

TEARDOWN_REASON=""
FIXTURE_ROWS_REMAINING="n/a"
PER_FAMILY_REPORT=""

sql_uuid_array() {
  if [[ -z "$1" ]]; then
    printf "array[]::uuid[]"
  else
    local joined
    joined="$(printf '%s' "$1" | sed "s/,/','/g")"
    printf "array['%s']::uuid[]" "$joined"
  fi
}

run_fixture_teardown() {
  # Dealer/user identifiers are captured up front, from a read-only
  # connection, before any DELETE. Both real-auth.mjs and concurrency.mjs
  # dealers begin with the same 'FB ' name prefix; both scripts' users use
  # an 'fb-...@example.invalid' email pattern.
  DEALER_IDS_RAW="$(psql "$FB_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from public.dealers where name like 'FB %';")"
  local dealer_capture_exit=$?
  log_cmd "psql capture dealer fixture identifiers" "$dealer_capture_exit"
  if [[ "$dealer_capture_exit" -ne 0 ]]; then TEARDOWN_REASON="dealer identifier capture failed with exit $dealer_capture_exit"; return 1; fi

  USER_IDS_RAW="$(psql "$FB_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from auth.users where email like 'fb-%@example.invalid';")"
  local user_capture_exit=$?
  log_cmd "psql capture user fixture identifiers" "$user_capture_exit"
  if [[ "$user_capture_exit" -ne 0 ]]; then TEARDOWN_REASON="user identifier capture failed with exit $user_capture_exit"; return 1; fi

  ESTIMATE_IDS_RAW="$(psql "$FB_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(e.id::text, ','), '') from public.estimates e join public.dealers d on d.id = e.dealer_id where d.name like 'FB %';")"
  local estimate_capture_exit=$?
  log_cmd "psql capture estimate fixture identifiers" "$estimate_capture_exit"
  if [[ "$estimate_capture_exit" -ne 0 ]]; then TEARDOWN_REASON="estimate identifier capture failed with exit $estimate_capture_exit"; return 1; fi
  log "captured fixture identifiers before deletion: dealers=$(echo "$DEALER_IDS_RAW" | tr -cd ',' | wc -c | tr -d ' ') users=$(echo "$USER_IDS_RAW" | tr -cd ',' | wc -c | tr -d ' ') estimates=$(echo "$ESTIMATE_IDS_RAW" | tr -cd ',' | wc -c | tr -d ' ')"

  DEALER_IDS_SQL="$(sql_uuid_array "$DEALER_IDS_RAW")"
  USER_IDS_SQL="$(sql_uuid_array "$USER_IDS_RAW")"
  ESTIMATE_IDS_SQL="$(sql_uuid_array "$ESTIMATE_IDS_RAW")"

  psql "$FB_DB_URL" -X -v ON_ERROR_STOP=1 -q <<SQL >> "$CLEANUP_LOG" 2>&1
begin;

set local role service_role;
delete from public.estimate_items where estimate_id = any($ESTIMATE_IDS_SQL);
reset role;
delete from public.estimates where id = any($ESTIMATE_IDS_SQL);
delete from public.vehicles where dealer_id = any($DEALER_IDS_SQL);
delete from public.customers where dealer_id = any($DEALER_IDS_SQL);
delete from public.document_sequences where dealer_id = any($DEALER_IDS_SQL);
delete from public.dealer_service_offerings where dealer_id = any($DEALER_IDS_SQL);
delete from public.dealer_wizard_catalog_lifecycle where dealer_id = any($DEALER_IDS_SQL);
delete from public.dealer_members where dealer_id = any($DEALER_IDS_SQL) or user_id = any($USER_IDS_SQL);
delete from public.dealers where id = any($DEALER_IDS_SQL);
delete from auth.users where id = any($USER_IDS_SQL);

commit;
SQL
  local delete_exit=$?
  log_cmd "psql fixture DELETE transaction (preserved-identifier predicates)" "$delete_exit"
  if [[ "$delete_exit" -ne 0 ]]; then TEARDOWN_REASON="fixture DELETE transaction failed with exit $delete_exit"; return 1; fi
  log "fixture DELETE transaction committed across every fixture family using preserved identifiers"

  # Exhaustive per-family zero-row proof, through a fresh independent
  # connection, using the SAME preserved identifier lists, reporting each
  # family's count individually -- not only one summed total.
  local report
  report="$(psql "$FB_DB_URL" -X -v ON_ERROR_STOP=1 -At -F'|' -c "
select 'dealers', (select count(*) from public.dealers where id = any($DEALER_IDS_SQL))
union all select 'users', (select count(*) from auth.users where id = any($USER_IDS_SQL))
union all select 'dealer_members', (select count(*) from public.dealer_members where dealer_id = any($DEALER_IDS_SQL) or user_id = any($USER_IDS_SQL))
union all select 'dealer_service_offerings', (select count(*) from public.dealer_service_offerings where dealer_id = any($DEALER_IDS_SQL))
union all select 'dealer_wizard_catalog_lifecycle', (select count(*) from public.dealer_wizard_catalog_lifecycle where dealer_id = any($DEALER_IDS_SQL))
union all select 'document_sequences', (select count(*) from public.document_sequences where dealer_id = any($DEALER_IDS_SQL))
union all select 'customers', (select count(*) from public.customers where dealer_id = any($DEALER_IDS_SQL))
union all select 'vehicles', (select count(*) from public.vehicles where dealer_id = any($DEALER_IDS_SQL))
union all select 'estimates', (select count(*) from public.estimates where id = any($ESTIMATE_IDS_SQL))
union all select 'estimate_items', (select count(*) from public.estimate_items where estimate_id = any($ESTIMATE_IDS_SQL));
  ")"
  local zero_row_exit=$?
  log_cmd "psql exhaustive NAMED per-family zero-row verification (preserved identifiers)" "$zero_row_exit"
  if [[ "$zero_row_exit" -ne 0 ]]; then TEARDOWN_REASON="zero-row verification query failed with exit $zero_row_exit"; return 1; fi

  PER_FAMILY_REPORT="$(printf '%s' "$report" | tr '\n' ' ' | sed -E 's/\|/=/g')"
  log "per-family zero-row counts: $PER_FAMILY_REPORT"

  local total nonzero_families
  total="$(printf '%s\n' "$report" | awk -F'|' '{sum+=$2} END{print sum+0}')"
  nonzero_families="$(printf '%s\n' "$report" | awk -F'|' '$2+0 != 0 {print $1"="$2}' | tr '\n' ',' )"
  if [[ "$total" != "0" ]]; then
    TEARDOWN_REASON="fixture teardown left rows behind in: ${nonzero_families%,} (total=$total)"
    return 1
  fi

  FIXTURE_ROWS_REMAINING="0"
  return 0
}

DB_STARTED="false"
TEARDOWN_EXIT=0
if [[ -f "$EVIDENCE_DIR/supabase-status.env" ]]; then
  DB_STARTED="true"
  if [[ "$FIXTURE_ATTEMPTED" != "true" ]]; then
    FIXTURE_ROWS_REMAINING="0"
    PER_FAMILY_REPORT="not_applicable_fixture_attempt_never_started"
    log "attempt-started.txt absent; no FB fixture was created, so partial-schema fixture teardown is safely skipped"
  else
    FB_DB_URL=""
    while IFS= read -r status_line; do
      if [[ "$status_line" == DB_URL=* ]]; then
        FB_DB_URL="${status_line#DB_URL=}"
        FB_DB_URL="${FB_DB_URL#\"}"
        FB_DB_URL="${FB_DB_URL%\"}"
        FB_DB_URL="${FB_DB_URL#\'}"
        FB_DB_URL="${FB_DB_URL%\'}"
        break
      fi
    done < "$EVIDENCE_DIR/supabase-status.env"

    if [[ -z "$FB_DB_URL" ]]; then
      TEARDOWN_EXIT=1
      TEARDOWN_REASON="local status file is present but did not provide a database URL"
    else
      case "$FB_DB_URL" in
        postgresql://*127.0.0.1:*|postgresql://*localhost:*)
          log "supabase-status.env present; database-level fixture teardown will run before supabase stop"
          set +e
          run_fixture_teardown
          TEARDOWN_EXIT=$?
          set -e
          ;;
        *)
          TEARDOWN_EXIT=1
          TEARDOWN_REASON="database endpoint is not loopback-only"
          ;;
      esac
    fi
  fi
  if [[ "$TEARDOWN_EXIT" -ne 0 ]]; then
    log "fixture teardown FAILED: ${TEARDOWN_REASON:-unknown reason}; supabase stop is still attempted before this script fails"
  fi
else
  log "supabase-status.env absent; this suffix never reached a fully started+reachable database, so fixture teardown/zero-row-proof are skipped"
fi

# ---------------------------------------------------------------------------
# Attempt the exact local Supabase stop exactly once, regardless of
# identifier-capture/DELETE/zero-proof outcome above. A non-zero stop result
# is itself treated as a cleanup failure.
# ---------------------------------------------------------------------------

STOP_ATTEMPTED="false"
STOP_EXIT="n/a"
if [[ "$START_ATTEMPTED" == "true" ]]; then
  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase stop --workdir "$RUNTIME_DIR" --no-backup >> "$CLEANUP_LOG" 2>&1
  STOP_EXIT=$?
  set -e
  STOP_ATTEMPTED="true"
  log_cmd "supabase stop --workdir <runtime> --no-backup" "$STOP_EXIT"
  log "supabase stop attempted (start_attempted=true, regardless of teardown outcome): exit=$STOP_EXIT"
else
  log "start-attempted.txt absent; no supabase stop is attempted (no container could have been created)"
fi

if [[ "$TEARDOWN_EXIT" -ne 0 && "$STOP_EXIT" != "n/a" && "$STOP_EXIT" != "0" ]]; then
  fail "fixture teardown failed (${TEARDOWN_REASON:-unknown reason}) AND supabase stop failed with exit $STOP_EXIT"
elif [[ "$TEARDOWN_EXIT" -ne 0 ]]; then
  fail "fixture teardown failed: ${TEARDOWN_REASON:-unknown reason} (supabase stop was still attempted: exit=$STOP_EXIT)"
elif [[ "$STOP_EXIT" != "n/a" && "$STOP_EXIT" != "0" ]]; then
  fail "supabase stop failed with exit $STOP_EXIT"
fi

# ---------------------------------------------------------------------------
# Finalize cleanup.log and summary.json/summary.md.
# ---------------------------------------------------------------------------

log "finalizing summaries (LAST cleanup.log entry): was_burned=$WAS_BURNED db_started=$DB_STARTED start_attempted=$START_ATTEMPTED stop_attempted=$STOP_ATTEMPTED stop_exit=$STOP_EXIT fixture_rows_remaining=$FIXTURE_ROWS_REMAINING per_family=$PER_FAMILY_REPORT"

python3 - "$EVIDENCE_DIR" "$RUNTIME_DIR" "$WAS_BURNED" "$DB_STARTED" "$START_ATTEMPTED" "$STOP_ATTEMPTED" "$STOP_EXIT" "$FIXTURE_ROWS_REMAINING" <<'PY'
import datetime
import json
import os
import sys

evidence_dir, runtime_dir, was_burned, db_started, start_attempted, stop_attempted, stop_exit, fixture_rows_remaining = sys.argv[1:9]

run_facts = {}
run_facts_path = os.path.join(evidence_dir, ".run-facts.json")
if os.path.exists(run_facts_path):
    with open(run_facts_path, encoding="utf-8") as handle:
        run_facts = json.load(handle)

pgtap = run_facts.get("pgtap", {})
cleanup_result = "PASS"
if was_burned == "true":
    cleanup_result = "CLEANED_BUT_SOURCE_ATTEMPT_BURNED"
elif db_started != "true":
    cleanup_result = "CLEANED_BUT_DATABASE_NEVER_STARTED"
elif fixture_rows_remaining != "0":
    cleanup_result = "FAIL_FIXTURE_ROWS_NOT_PROVEN_ZERO"

summary_json = {
    "runtime_dir": runtime_dir,
    "was_burned": was_burned == "true",
    "db_started": db_started == "true",
    "start_attempted": start_attempted == "true",
    "stop_attempted": stop_attempted == "true",
    "stop_exit": stop_exit,
    "fixture_rows_remaining": fixture_rows_remaining,
    "pgtap_offering_guard_exit": pgtap.get("offering_guard", {}).get("exit"),
    "real_auth_exit": run_facts.get("real_auth_exit"),
    "concurrency_exit": run_facts.get("concurrency_exit"),
    "cleanup_result": cleanup_result,
    "authoritative": "raw_evidence_files_not_this_summary",
}
with open(os.path.join(evidence_dir, "summary.json"), "w", encoding="utf-8") as handle:
    json.dump(summary_json, handle, indent=2, sort_keys=True)
    handle.write("\n")

lines = [
    "# GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_FB summary", "",
    f"- runtime: {runtime_dir}",
    f"- was_burned: {was_burned}",
    f"- db_started: {db_started}",
    f"- start_attempted: {start_attempted}",
    f"- stop_attempted: {stop_attempted} (exit {stop_exit}; a non-zero result fails cleanup)",
    f"- fixture_rows_remaining: {fixture_rows_remaining}",
]
if pgtap:
    lines.append(
        "- pgtap: offering-guard exit {0} (plan {1}/{2})".format(
            pgtap.get("offering_guard", {}).get("exit"), pgtap.get("offering_guard", {}).get("plan"), pgtap.get("offering_guard", {}).get("count"),
        )
    )
    lines.append(f"- real-auth exit: {run_facts.get('real_auth_exit')}")
    lines.append(f"- concurrency exit: {run_facts.get('concurrency_exit')}")
lines.append("- secret scan: see secret-scan.txt (must read SECRET_SCAN_CLEAN)")
lines.append("- manifest.json is generated only after evidence copy and exact runtime removal, and is the LAST canonical artifact written.")
lines.append("- classification is not decided here; raw evidence in this directory is authoritative.")
with open(os.path.join(evidence_dir, "summary.md"), "w", encoding="utf-8") as handle:
    handle.write("\n".join(lines) + "\n")
PY
log_cmd "python3 finalize summary.json/summary.md" "$?"

# ---------------------------------------------------------------------------
# Retain EXACTLY the canonical 15 named (non-manifest) artifacts on a
# successful run, before copying.
# ---------------------------------------------------------------------------

CANONICAL_15=(
  versions.txt source-hashes.sha256 migration-replay.ndjson schema-fingerprint.json
  pgtap.tap offering-guard-results.ndjson real-auth-results.ndjson concurrency-results.ndjson
  backend-pids.ndjson advisors.txt query-plans.txt secret-scan.txt cleanup.log
  summary.json summary.md
)

if [[ -f "$EVIDENCE_DIR/burned.txt" ]]; then
  printf 'preserved burn reason (from burned.txt, not itself retained): %s\n' "$(tr '\n' ' ' < "$EVIDENCE_DIR/burned.txt")" >> "$CLEANUP_LOG"
fi

rm -f "$EVIDENCE_DIR/supabase-status.env" "$EVIDENCE_DIR/.start.raw.log" \
      "$EVIDENCE_DIR/.migration-apply.raw.log" "$EVIDENCE_DIR/burned.txt" \
      "$EVIDENCE_DIR/cleanup-started.txt" "$EVIDENCE_DIR/start-attempted.txt" \
      "$EVIDENCE_DIR/attempt-started.txt" \
      "$EVIDENCE_DIR/start-succeeded.txt" "$EVIDENCE_DIR/project-id.txt" \
      "$EVIDENCE_DIR/runtime-dir.txt" "$EVIDENCE_DIR/db-port.txt" \
      "$EVIDENCE_DIR/mount-probe.txt" "$EVIDENCE_DIR/protected-paths.txt" \
      "$EVIDENCE_DIR/migration-manifest.txt"

if [[ "$WAS_BURNED" == "false" ]]; then
  [[ -f "$EVIDENCE_DIR/pgtap-canonical-atomic-save.tap" ]] || fail "canonical atomic-save TAP evidence is missing before canonical artifact packaging"
  [[ -f "$EVIDENCE_DIR/pgtap-offering-guard.tap" ]] || fail "offering-guard TAP evidence is missing before canonical artifact packaging"
  {
    cat "$EVIDENCE_DIR/pgtap-canonical-atomic-save.tap"
    printf '\n'
    cat "$EVIDENCE_DIR/pgtap-offering-guard.tap"
  } > "$EVIDENCE_DIR/pgtap.tap"
  rm -f "$EVIDENCE_DIR/pgtap-canonical-atomic-save.tap" \
        "$EVIDENCE_DIR/pgtap-offering-guard.tap" \
        "$EVIDENCE_DIR/canonical-atomic-save-results.ndjson"
  rm -f "$EVIDENCE_DIR/attempt-completed.txt" \
        "$EVIDENCE_DIR/migration-replay-outcome.ndjson" \
        "$EVIDENCE_DIR/real-auth.stderr.txt" \
        "$EVIDENCE_DIR/concurrency.stderr.txt"
  ACTUAL_FILES="$(find "$EVIDENCE_DIR" -maxdepth 1 -type f ! -name '.*' -exec basename {} \; | sort)"
  EXPECTED_FILES="$(printf '%s\n' "${CANONICAL_15[@]}" | sort)"
  [[ "$ACTUAL_FILES" == "$EXPECTED_FILES" ]] || fail "a successful run must retain exactly the canonical 15 named artifacts before evidence copy; found a mismatch"
fi

PRECOPY_HASHES_JSON="$(python3 - "$EVIDENCE_DIR" <<'PY'
import hashlib, json, os, sys
evidence_dir = sys.argv[1]
def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()
artifacts = []
for name in sorted(os.listdir(evidence_dir)):
    path = os.path.join(evidence_dir, name)
    if name.startswith(".") or not os.path.isfile(path):
        continue
    artifacts.append({"name": name, "present": True, "sha256": sha256_of(path)})
print(json.dumps(artifacts))
PY
)"

# ---------------------------------------------------------------------------
# The retained evidence path must NOT already exist.
# ---------------------------------------------------------------------------

RETAINED_DIR="$RETAINED_EVIDENCE_PARENT/$(basename "$RUNTIME_DIR")"
case "$RETAINED_DIR" in
  ""|/|"$HOME"|"$HOME"/) fail "retained evidence path resolved to an unsafe location" ;;
esac
[[ ! -e "$RETAINED_DIR" ]] || fail "retained evidence path already exists: $RETAINED_DIR"
mkdir -p "$RETAINED_EVIDENCE_PARENT"

set +e
cp -R "$EVIDENCE_DIR" "$RETAINED_DIR"
COPY_EXIT=$?
set -e
[[ "$COPY_EXIT" -eq 0 ]] || fail "evidence copy to $RETAINED_DIR failed with exit $COPY_EXIT; runtime path is preserved, not removed, for manual recovery"
[[ ! -e "$RETAINED_DIR/supabase-status.env" ]] || fail "supabase-status.env leaked into retained evidence; refusing to proceed"
[[ ! -e "$RETAINED_DIR/manifest.json" ]] || fail "manifest.json must not already exist in the retained copy before it is generated"

if [[ "$WAS_BURNED" == "false" ]]; then
  RETAINED_COUNT="$(find "$RETAINED_DIR" -maxdepth 1 -type f ! -name '.*' | wc -l | tr -d ' ')"
  [[ "$RETAINED_COUNT" == "15" ]] || fail "retained directory must contain exactly the 15 named artifacts before manifest.json is added; found $RETAINED_COUNT"
fi

set +e
POSTCOPY_HASHES_JSON="$(python3 - "$RETAINED_DIR" "$PRECOPY_HASHES_JSON" <<'PY'
import hashlib, json, os, sys
retained_dir = sys.argv[1]
expected = json.loads(sys.argv[2])

def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()

actual = []
for name in sorted(os.listdir(retained_dir)):
    path = os.path.join(retained_dir, name)
    if name.startswith(".") or not os.path.isfile(path):
        continue
    actual.append({"name": name, "present": True, "sha256": sha256_of(path)})

if actual != expected:
    print(json.dumps({"expected": expected, "actual": actual}, sort_keys=True), file=sys.stderr)
    raise SystemExit(1)
print(json.dumps(actual))
PY
)"
POSTCOPY_HASH_VERIFY_EXIT=$?
set -e
[[ "$POSTCOPY_HASH_VERIFY_EXIT" -eq 0 ]] || fail "retained evidence hash verification failed after copy with exit $POSTCOPY_HASH_VERIFY_EXIT; runtime path is preserved for recovery"

# ---------------------------------------------------------------------------
# Remove only the exact validated runtime path NOW, before manifest.json is
# generated, so the manifest can record the real removal exit code.
# ---------------------------------------------------------------------------

[[ "$RUNTIME_DIR" == "$RUNTIME_PARENT"/gda-estimate-offering-fb.* ]] || fail "final path safety check failed before removal"
set +e
rm -rf -- "$RUNTIME_DIR"
REMOVE_EXIT=$?
set -e

# ---------------------------------------------------------------------------
# Generate manifest.json -- the 16th and FINAL canonical artifact -- directly
# into the retained directory. It includes the copy and removal exit codes.
# Nothing is written after this.
# ---------------------------------------------------------------------------

python3 - "$RETAINED_DIR" "$RUNTIME_DIR" "$WAS_BURNED" "$DB_STARTED" "$FIXTURE_ROWS_REMAINING" "$COPY_EXIT" "$POSTCOPY_HASH_VERIFY_EXIT" "$REMOVE_EXIT" "$POSTCOPY_HASHES_JSON" <<'PY'
import datetime
import json
import os
import sys

retained_dir, runtime_dir, was_burned, db_started, fixture_rows_remaining, copy_exit, hash_verify_exit, remove_exit, retained_hashes_json = sys.argv[1:10]
artifacts = json.loads(retained_hashes_json)

commands = []
ledger_path = os.path.join(retained_dir, ".command-ledger.ndjson")
if os.path.exists(ledger_path):
    with open(ledger_path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                commands.append(json.loads(line))

run_facts = {}
run_facts_path = os.path.join(retained_dir, ".run-facts.json")
if os.path.exists(run_facts_path):
    with open(run_facts_path, encoding="utf-8") as handle:
        run_facts = json.load(handle)
    commands.extend(run_facts.get("commands", []))

for internal in (".run-facts.json", ".command-ledger.ndjson"):
    path = os.path.join(retained_dir, internal)
    if os.path.exists(path):
        os.remove(path)

manifest = {
    "runtime_dir": runtime_dir,
    "finalized_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "finalized_after_cleanup": True,
    "finalized_last_step": "manifest.json is the 16th canonical artifact, generated after evidence copy AND exact runtime removal; nothing is written after it",
    "was_burned": was_burned == "true",
    "db_started": db_started == "true",
    "fixture_rows_remaining": fixture_rows_remaining,
    "copy_exit_code": int(copy_exit),
    "retained_hash_verification_exit_code": int(hash_verify_exit),
    "runtime_removal_exit_code": int(remove_exit),
    "commands_and_exit_codes": commands,
    "pgtap_plan_counts": run_facts.get("pgtap", {}),
    "artifacts": artifacts,
}
with open(os.path.join(retained_dir, "manifest.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

if [[ "$WAS_BURNED" == "false" ]]; then
  FINAL_COUNT="$(find "$RETAINED_DIR" -maxdepth 1 -type f ! -name '.*' | wc -l | tr -d ' ')"
  [[ "$FINAL_COUNT" == "16" ]] || fail "retained directory must contain exactly 16 files after manifest.json is written; found $FINAL_COUNT"
fi

printf 'FB_EVIDENCE_RETAINED=%s\n' "$RETAINED_DIR"
printf 'FB_COPY_EXIT=%s\n' "$COPY_EXIT"
printf 'FB_RUNTIME_REMOVAL_EXIT=%s\n' "$REMOVE_EXIT"
[[ "$REMOVE_EXIT" -eq 0 ]] || fail "exact runtime path removal failed with exit $REMOVE_EXIT (manifest.json already records this)"
