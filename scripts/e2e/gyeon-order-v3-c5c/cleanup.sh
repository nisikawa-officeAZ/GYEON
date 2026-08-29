#!/usr/bin/env bash
set -euo pipefail

# C5-C cleanup.
#
# R4 repair: product identifiers are now preserved and used directly (never
# a subquery against gyeon_products after it may already be deleted) for
# offers/supply-projection/classification teardown and zero-row proof. The
# zero-row proof reports NAMED per-family counts, not only one sum.
# Regardless of an identifier-capture, DELETE, or zero-proof failure, the
# exact local Supabase project is still stopped exactly once before this
# script returns failure; a non-zero stop result is itself a cleanup
# failure. The retained evidence path must not already exist before it is
# created. manifest.json -- the 19th and FINAL canonical artifact -- is now
# generated only after evidence copy and exact runtime removal, and records
# both operations' real exit codes.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C5C_IS_DISPOSABLE"
RUNTIME_PARENT="${GYEON_ORDER_V3_C5C_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GYEON_ORDER_V3_C5C_RUNTIME_DIR:-}"
RETAINED_EVIDENCE_PARENT="${GYEON_ORDER_V3_C5C_RETAINED_EVIDENCE_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime/gyeon-order-v3-c5c-evidence}"

fail() {
  printf 'C5C_CLEANUP_ERROR: %s\n' "$1" >&2
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

[[ "${GYEON_ORDER_V3_C5C_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$RUNTIME_DIR" ]] || fail "GYEON_ORDER_V3_C5C_RUNTIME_DIR is required and must not be blank"
case "$RUNTIME_DIR" in
  *'*'*|*'?'*|*'['*) fail "runtime path must not contain glob characters" ;;
  /|"$HOME"|"$HOME"/|\~|\~/*) fail "runtime path must never resolve to \$HOME, ~, or /" ;;
  ..|*/../*|../*|*/..) fail "runtime path must not contain a parent-directory reference" ;;
esac
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gyeon-order-v3-c5c\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "runtime path does not match the exact dedicated disposable pattern"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"

REPO_ROOT="${GYEON_ORDER_V3_C5C_REPO_ROOT:-}"
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

# ---------------------------------------------------------------------------
# required 1/2: fixture teardown as a real bash FUNCTION (not a subshell),
# so that every variable it sets (preserved identifiers, per-family counts)
# remains visible afterward regardless of success or failure. It never calls
# fail()/exit itself -- any failure sets TEARDOWN_REASON and returns 1, so
# the caller can still attempt `supabase stop` before the script ultimately
# fails (required 3).
# ---------------------------------------------------------------------------

TEARDOWN_REASON=""
FIXTURE_ROWS_REMAINING="n/a"
PER_FAMILY_REPORT=""

sql_uuid_array() {
  if [[ -z "$1" ]]; then printf "array[]::uuid[]"; else printf "array['%s']::uuid[]" "${1//,/\',\'}"; fi
}

run_fixture_teardown() {
  # required 1: dealer/user/PRODUCT/order identifiers are all captured
  # up front, from a read-only connection, before any DELETE.
  DEALER_IDS_RAW="$(psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from public.dealers where name like 'C5C %';")"
  local dealer_capture_exit=$?
  log_cmd "psql capture dealer fixture identifiers" "$dealer_capture_exit"
  if [[ "$dealer_capture_exit" -ne 0 ]]; then TEARDOWN_REASON="dealer identifier capture failed with exit $dealer_capture_exit"; return 1; fi

  USER_IDS_RAW="$(psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from auth.users where email like 'c5c-%@example.invalid';")"
  local user_capture_exit=$?
  log_cmd "psql capture user fixture identifiers" "$user_capture_exit"
  if [[ "$user_capture_exit" -ne 0 ]]; then TEARDOWN_REASON="user identifier capture failed with exit $user_capture_exit"; return 1; fi

  PRODUCT_IDS_RAW="$(psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from public.gyeon_products where sku like 'C5C%';")"
  local product_capture_exit=$?
  log_cmd "psql capture product fixture identifiers" "$product_capture_exit"
  if [[ "$product_capture_exit" -ne 0 ]]; then TEARDOWN_REASON="product identifier capture failed with exit $product_capture_exit"; return 1; fi

  ORDER_IDS_RAW="$(psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(o.id::text, ','), '') from public.product_orders o join public.dealers d on d.id = o.dealer_id where d.name like 'C5C %';")"
  local order_capture_exit=$?
  log_cmd "psql capture order fixture identifiers" "$order_capture_exit"
  if [[ "$order_capture_exit" -ne 0 ]]; then TEARDOWN_REASON="order identifier capture failed with exit $order_capture_exit"; return 1; fi
  log "captured fixture identifiers before deletion: dealers=$(echo "$DEALER_IDS_RAW" | tr -cd ',' | wc -c | tr -d ' ') users=$(echo "$USER_IDS_RAW" | tr -cd ',' | wc -c | tr -d ' ') products=$(echo "$PRODUCT_IDS_RAW" | tr -cd ',' | wc -c | tr -d ' ') orders=$(echo "$ORDER_IDS_RAW" | tr -cd ',' | wc -c | tr -d ' ')"

  DEALER_IDS_SQL="$(sql_uuid_array "$DEALER_IDS_RAW")"
  USER_IDS_SQL="$(sql_uuid_array "$USER_IDS_RAW")"
  PRODUCT_IDS_SQL="$(sql_uuid_array "$PRODUCT_IDS_RAW")"
  ORDER_IDS_SQL="$(sql_uuid_array "$ORDER_IDS_RAW")"

  psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -q <<SQL >> "$CLEANUP_LOG" 2>&1
begin;

delete from public.gyeon_order_external_compensation_outbox where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_order_warehouse_tasks where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_order_notification_outbox where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_order_qualification_snapshots where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_order_owner_review_events where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_order_prepared_operations_v1 where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_order_external_evidence_v1 where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_order_idempotency_v3 where dealer_id = any($DEALER_IDS_SQL);
delete from public.product_order_items where order_id = any($ORDER_IDS_SQL);
delete from public.product_orders where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_dealer_credit_terms where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_dealer_qualification_mode_projection where dealer_id = any($DEALER_IDS_SQL);
delete from public.gyeon_ordering_memberships where dealer_id = any($DEALER_IDS_SQL);
delete from public.dealer_members where dealer_id = any($DEALER_IDS_SQL) or user_id = any($USER_IDS_SQL);
-- required 1: preserved product identifiers used directly, never a live
-- subquery against gyeon_products (which this same transaction deletes
-- further below, and which the LATER zero-row proof would otherwise find
-- empty regardless of whether these three families were actually cleared).
delete from public.gyeon_product_qualification_classification where product_id = any($PRODUCT_IDS_SQL);
delete from public.gyeon_product_order_offers_v3 where product_id = any($PRODUCT_IDS_SQL);
delete from public.gyeon_order_supply_projection where product_id = any($PRODUCT_IDS_SQL);
delete from public.gyeon_products where id = any($PRODUCT_IDS_SQL);
delete from public.gyeon_qualification_rule_versions where required_detailer_product_codes && array['C5C2-REQ'];
delete from public.gyeon_warehouse_calendar_days;
delete from public.dealers where id = any($DEALER_IDS_SQL);
delete from auth.users where id = any($USER_IDS_SQL);

commit;
SQL
  local delete_exit=$?
  log_cmd "psql fixture DELETE transaction (preserved-identifier predicates)" "$delete_exit"
  if [[ "$delete_exit" -ne 0 ]]; then TEARDOWN_REASON="fixture DELETE transaction failed with exit $delete_exit"; return 1; fi
  log "fixture DELETE transaction committed across every fixture family using preserved identifiers"

  # required 1/2: exhaustive per-family zero-row proof, through a fresh
  # independent connection, using the SAME preserved identifier lists (never
  # a join/subquery through a row this run already deleted), reporting each
  # family's count individually -- not only one summed total.
  local report
  report="$(psql "$C5C_DB_URL" -X -v ON_ERROR_STOP=1 -At -F'|' -c "
select 'dealers', (select count(*) from public.dealers where id = any($DEALER_IDS_SQL))
union all select 'users', (select count(*) from auth.users where id = any($USER_IDS_SQL))
union all select 'products', (select count(*) from public.gyeon_products where id = any($PRODUCT_IDS_SQL))
union all select 'offers', (select count(*) from public.gyeon_product_order_offers_v3 where product_id = any($PRODUCT_IDS_SQL))
union all select 'supply_projection', (select count(*) from public.gyeon_order_supply_projection where product_id = any($PRODUCT_IDS_SQL))
union all select 'qualification_classification', (select count(*) from public.gyeon_product_qualification_classification where product_id = any($PRODUCT_IDS_SQL))
union all select 'calendar', (select count(*) from public.gyeon_warehouse_calendar_days)
union all select 'qualification_rules', (select count(*) from public.gyeon_qualification_rule_versions where required_detailer_product_codes && array['C5C2-REQ'])
union all select 'ordering_memberships', (select count(*) from public.gyeon_ordering_memberships where dealer_id = any($DEALER_IDS_SQL))
union all select 'credit_terms', (select count(*) from public.gyeon_dealer_credit_terms where dealer_id = any($DEALER_IDS_SQL))
union all select 'qualification_mode_projection', (select count(*) from public.gyeon_dealer_qualification_mode_projection where dealer_id = any($DEALER_IDS_SQL))
union all select 'dealer_members', (select count(*) from public.dealer_members where dealer_id = any($DEALER_IDS_SQL) or user_id = any($USER_IDS_SQL))
union all select 'orders', (select count(*) from public.product_orders where dealer_id = any($DEALER_IDS_SQL))
union all select 'order_items', (select count(*) from public.product_order_items where order_id = any($ORDER_IDS_SQL))
union all select 'idempotency', (select count(*) from public.gyeon_order_idempotency_v3 where dealer_id = any($DEALER_IDS_SQL))
union all select 'evidence', (select count(*) from public.gyeon_order_external_evidence_v1 where dealer_id = any($DEALER_IDS_SQL))
union all select 'prepared_operations', (select count(*) from public.gyeon_order_prepared_operations_v1 where dealer_id = any($DEALER_IDS_SQL))
union all select 'owner_review_events', (select count(*) from public.gyeon_order_owner_review_events where dealer_id = any($DEALER_IDS_SQL))
union all select 'qualification_snapshots', (select count(*) from public.gyeon_order_qualification_snapshots where dealer_id = any($DEALER_IDS_SQL))
union all select 'compensation_outbox', (select count(*) from public.gyeon_order_external_compensation_outbox where dealer_id = any($DEALER_IDS_SQL))
union all select 'warehouse_tasks', (select count(*) from public.gyeon_order_warehouse_tasks where dealer_id = any($DEALER_IDS_SQL))
union all select 'notification_outbox', (select count(*) from public.gyeon_order_notification_outbox where dealer_id = any($DEALER_IDS_SQL));
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
  C5C_DB_URL=""
  while IFS= read -r status_line; do
    if [[ "$status_line" == DB_URL=* ]]; then
      C5C_DB_URL="${status_line#DB_URL=}"
      C5C_DB_URL="${C5C_DB_URL#\"}"
      C5C_DB_URL="${C5C_DB_URL%\"}"
      C5C_DB_URL="${C5C_DB_URL#\'}"
      C5C_DB_URL="${C5C_DB_URL%\'}"
      break
    fi
  done < "$EVIDENCE_DIR/supabase-status.env"

  if [[ -z "$C5C_DB_URL" ]]; then
    TEARDOWN_EXIT=1
    TEARDOWN_REASON="local status file is present but did not provide a database URL"
  else
    case "$C5C_DB_URL" in
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
  if [[ "$TEARDOWN_EXIT" -ne 0 ]]; then
    log "fixture teardown FAILED: ${TEARDOWN_REASON:-unknown reason}; supabase stop is still attempted before this script fails"
  fi
else
  log "supabase-status.env absent; this suffix never reached a fully started+reachable database, so fixture teardown/zero-row-proof are skipped"
fi

# ---------------------------------------------------------------------------
# required 3/4: attempt the exact local Supabase stop exactly once,
# regardless of identifier-capture/DELETE/zero-proof outcome above. A
# non-zero stop result is itself treated as a cleanup failure.
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
# Finalize cleanup.log and summary.json/summary.md. All data-plane logging
# above is complete and no further log() call occurs after this point.
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
    "pgtap_schema_exit": pgtap.get("schema_rls", {}).get("exit"),
    "pgtap_qualification_exit": pgtap.get("qualification_evidence", {}).get("exit"),
    "pgtap_warehouse_exit": pgtap.get("prepare_finalize_warehouse", {}).get("exit"),
    "real_auth_exit": run_facts.get("real_auth_exit"),
    "concurrency_exit": run_facts.get("concurrency_exit"),
    "cleanup_result": cleanup_result,
    "authoritative": "raw_evidence_files_not_this_summary",
}
with open(os.path.join(evidence_dir, "summary.json"), "w", encoding="utf-8") as handle:
    json.dump(summary_json, handle, indent=2, sort_keys=True)
    handle.write("\n")

lines = [
    "# GYEON_ORDER_V3_C5C summary", "",
    f"- runtime: {runtime_dir}",
    f"- was_burned: {was_burned}",
    f"- db_started: {db_started}",
    f"- start_attempted: {start_attempted}",
    f"- stop_attempted: {stop_attempted} (exit {stop_exit}; a non-zero result fails cleanup)",
    f"- fixture_rows_remaining: {fixture_rows_remaining}",
]
if pgtap:
    lines.append(
        "- pgtap: schema-rls exit {0} (plan {1}/{2}), qualification-evidence exit {3} (plan {4}/{5}), "
        "prepare-finalize-warehouse exit {6} (plan {7}/{8})".format(
            pgtap.get("schema_rls", {}).get("exit"), pgtap.get("schema_rls", {}).get("plan"), pgtap.get("schema_rls", {}).get("count"),
            pgtap.get("qualification_evidence", {}).get("exit"), pgtap.get("qualification_evidence", {}).get("plan"), pgtap.get("qualification_evidence", {}).get("count"),
            pgtap.get("prepare_finalize_warehouse", {}).get("exit"), pgtap.get("prepare_finalize_warehouse", {}).get("plan"), pgtap.get("prepare_finalize_warehouse", {}).get("count"),
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
# Retain EXACTLY the canonical 18 named (non-manifest) artifacts on a
# successful run, before copying.
# ---------------------------------------------------------------------------

CANONICAL_18=(
  versions.txt source-hashes.sha256 runtime-derived-hashes.sha256
  migration-replay.ndjson schema-fingerprint.json pgtap.tap real-auth-results.ndjson
  qualification-results.ndjson evidence-prepare-finalize-results.ndjson
  warehouse-results.ndjson concurrency-results.ndjson backend-pids.ndjson
  advisors.txt query-plans.txt secret-scan.txt cleanup.log summary.json summary.md
)

if [[ -f "$EVIDENCE_DIR/burned.txt" ]]; then
  printf 'preserved burn reason (from burned.txt, not itself retained): %s\n' "$(tr '\n' ' ' < "$EVIDENCE_DIR/burned.txt")" >> "$CLEANUP_LOG"
fi

rm -f "$EVIDENCE_DIR/supabase-status.env" "$EVIDENCE_DIR/.start.raw.log" \
      "$EVIDENCE_DIR/.migration-apply.raw.log" "$EVIDENCE_DIR/burned.txt" \
      "$EVIDENCE_DIR/cleanup-started.txt" "$EVIDENCE_DIR/start-attempted.txt" \
      "$EVIDENCE_DIR/start-succeeded.txt" "$EVIDENCE_DIR/project-id.txt" \
      "$EVIDENCE_DIR/runtime-dir.txt" "$EVIDENCE_DIR/db-port.txt" \
      "$EVIDENCE_DIR/mount-probe.txt" "$EVIDENCE_DIR/protected-paths.txt" \
      "$EVIDENCE_DIR/migration-manifest.txt"

if [[ "$WAS_BURNED" == "false" ]]; then
  ACTUAL_FILES="$(find "$EVIDENCE_DIR" -maxdepth 1 -type f ! -name '.*' -exec basename {} \; | sort)"
  EXPECTED_FILES="$(printf '%s\n' "${CANONICAL_18[@]}" | sort)"
  [[ "$ACTUAL_FILES" == "$EXPECTED_FILES" ]] || fail "a successful run must retain exactly the canonical 18 named artifacts before evidence copy; found a mismatch"
fi

# Pre-compute the 18 artifacts' hashes now (their content is already final;
# they are about to be copied verbatim). manifest.json itself is generated
# only after copy + removal below (required 8).
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
# required 5: the retained evidence path must NOT already exist.
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
  [[ "$RETAINED_COUNT" == "18" ]] || fail "retained directory must contain exactly the 18 named artifacts before manifest.json is added; found $RETAINED_COUNT"
fi

# Hash every retained canonical artifact after the copy, then compare the
# exact (name, presence, SHA-256) set with the pre-copy source set. The
# manifest records these retained-file hashes, never merely the source-side
# values that existed before cp completed.
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
# required 8: remove only the exact validated runtime path NOW, before
# manifest.json is generated, so the manifest can record the real removal
# exit code as the harness's own last verified action.
# ---------------------------------------------------------------------------

[[ "$RUNTIME_DIR" == "$RUNTIME_PARENT"/gyeon-order-v3-c5c.* ]] || fail "final path safety check failed before removal"
set +e
rm -rf -- "$RUNTIME_DIR"
REMOVE_EXIT=$?
set -e

# ---------------------------------------------------------------------------
# required 3/8: generate manifest.json -- the 19th and FINAL canonical
# artifact -- directly into the retained directory (the source evidence dir
# no longer exists once removal succeeds). It includes the copy and removal
# exit codes. Nothing is written after this.
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
    "finalized_last_step": "manifest.json is the 19th canonical artifact, generated after evidence copy AND exact runtime removal; nothing is written after it",
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
  [[ "$FINAL_COUNT" == "19" ]] || fail "retained directory must contain exactly 19 files after manifest.json is written; found $FINAL_COUNT"
fi

printf 'C5C_EVIDENCE_RETAINED=%s\n' "$RETAINED_DIR"
printf 'C5C_COPY_EXIT=%s\n' "$COPY_EXIT"
printf 'C5C_RUNTIME_REMOVAL_EXIT=%s\n' "$REMOVE_EXIT"
[[ "$REMOVE_EXIT" -eq 0 ]] || fail "exact runtime path removal failed with exit $REMOVE_EXIT (manifest.json already records this)"
