#!/usr/bin/env bash
# ============================================================================
# GDA-1W-C3 — two-connection concurrency runner (BOTH §10.2 races).
# C3-R1 extended per PR #8 comment 5237890508 (C3-R1-CONCURRENCY-COVERAGE).
#
# STATUS: SOURCE CANDIDATE — WRITTEN ONLY. Running this script belongs to the
#         separately authorized disposable-DB verification phase.
#
# WHAT IT PROVES (contract §6 / §10.2), each with two GENUINE separate psql
# connections, deterministic barriers, and bounded execution:
#   RACE 1 — separate-connection SAME-KEY concurrency: both sessions share one
#            idempotency key and identical payload on work order 1. Exactly
#            one `created`; the loser returns the identical canonical result
#            as `replayed` with ZERO additional writes (1 ledger row total).
#   RACE 2 — separate-connection DIFFERENT-KEY / SAME-WORK-ORDER concurrency:
#            each session holds its own key with the identical payload on work
#            order 2. Exactly one `created`; the loser replays the canonical
#            result through the identical-fingerprint alias branch (2 ledger
#            rows total: one `created`, one `replayed`).
# After each race the runner compares canonical identity across the two
# evidence lines and inspects final DB cardinality/immutability invariants.
#
# SAFETY BOUNDARIES:
#   * The database URL must be supplied EXPLICITLY (env DISPOSABLE_DB_URL or
#     argv[1]). There is NO discovery, NO supabase link, NO migration apply,
#     NO service-role key, NO Storage/LINE/external call. URLs that look like
#     a hosted Supabase project are refused outright.
#   * The migration under test must ALREADY be applied to the disposable
#     stack by the separately authorized replay step; this script only reads
#     and exercises it.
#   * Fixtures are created with run-unique UUIDs and left behind: the stack
#     is disposable by definition, and completion-authority rows are
#     deliberately non-deletable (RESTRICT FKs, append-only ledger).
#   * Cleanup removes ONLY this run's own temp directory.
#
# Usage:
#   DISPOSABLE_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
#     scripts/e2e/gda-1w-completion/run-concurrency.sh
#   scripts/e2e/gda-1w-completion/run-concurrency.sh 'postgresql://...'
# ============================================================================

set -euo pipefail

# ── 0. Inputs and tooling ────────────────────────────────────────────────────
DB_URL="${1:-${DISPOSABLE_DB_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "GDA1W-C3-CONC SUMMARY: FAIL reason=no-database-url (set DISPOSABLE_DB_URL or pass argv[1])" >&2
  exit 2
fi
case "$DB_URL" in
  *supabase.co*|*supabase.in*|*pooler.supabase*)
    echo "GDA1W-C3-CONC SUMMARY: FAIL reason=refusing-hosted-database-url (disposable local stack only)" >&2
    exit 2
    ;;
esac
for tool in psql uuidgen; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "GDA1W-C3-CONC SUMMARY: FAIL reason=missing-tool tool=$tool" >&2
    exit 2
  }
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_A="$SCRIPT_DIR/concurrency-a.sql"
SQL_B="$SCRIPT_DIR/concurrency-b.sql"
[ -f "$SQL_A" ] && [ -f "$SQL_B" ] || {
  echo "GDA1W-C3-CONC SUMMARY: FAIL reason=session-sql-missing" >&2
  exit 2
}

PSQL=(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1)

# ── 1. Run-unique working directory + identifiers ────────────────────────────
RUN_ID="$(uuidgen | tr 'A-Z' 'a-z')"
RUN_TAG="$(printf '%s' "$RUN_ID" | cut -c1-8)"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/gda1w-c3-conc.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

DEALER_ID="$(uuidgen | tr 'A-Z' 'a-z')"
ACTOR_ID="$(uuidgen | tr 'A-Z' 'a-z')"
CUSTOMER_ID="$(uuidgen | tr 'A-Z' 'a-z')"
VEHICLE_ID="$(uuidgen | tr 'A-Z' 'a-z')"
WO1_ID="$(uuidgen | tr 'A-Z' 'a-z')"   # race 1: same key
WO2_ID="$(uuidgen | tr 'A-Z' 'a-z')"   # race 2: different keys

# The shared instant is taken from the DATABASE clock (the +5-minute window
# authority), one minute in the past, as a millisecond UTC ISO instant.
END_AT="$("${PSQL[@]}" -At -c "SELECT to_char((now() - interval '1 minute') AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")"
[ -n "$END_AT" ] || { echo "GDA1W-C3-CONC SUMMARY: FAIL reason=end-at-probe" >&2; exit 2; }
ITEMS='[{"category":"コーティング","itemName":"GYEON施工","description":null}]'

# ── 2. Minimum disposable fixtures (run-unique; staff-only §5.3 actor) ───────
"${PSQL[@]}" >/dev/null <<FIXTURES
BEGIN;
INSERT INTO auth.users (id, email)
VALUES ('${ACTOR_ID}', 'conc-${RUN_ID}@test.local');
INSERT INTO public.dealers (id, name)
VALUES ('${DEALER_ID}', 'GDA1W conc dealer ${RUN_ID}');
INSERT INTO public.dealer_staff (dealer_id, user_id, role, status)
VALUES ('${DEALER_ID}', '${ACTOR_ID}', 'staff', 'active');
INSERT INTO public.customers (id, dealer_id, name)
VALUES ('${CUSTOMER_ID}', '${DEALER_ID}', 'conc customer');
INSERT INTO public.vehicles (id, dealer_id, customer_id, maker, model)
VALUES ('${VEHICLE_ID}', '${DEALER_ID}', '${CUSTOMER_ID}', 'Toyota', 'Prius');
INSERT INTO public.work_orders (id, dealer_id, customer_id, vehicle_id, status, actual_start_at)
VALUES
  ('${WO1_ID}', '${DEALER_ID}', '${CUSTOMER_ID}', '${VEHICLE_ID}', 'in_progress', now() - interval '2 hours'),
  ('${WO2_ID}', '${DEALER_ID}', '${CUSTOMER_ID}', '${VEHICLE_ID}', 'in_progress', now() - interval '2 hours');
COMMIT;
FIXTURES

fail() { echo "GDA1W-C3-CONC SUMMARY: FAIL reason=$1"; exit 1; }

# Field extractor for the flat one-line row_to_json evidence.
field() { # $1 json, $2 key -> raw value without quotes
  printf '%s' "$1" | sed -n "s/.*\"$2\":\"\{0,1\}\([^,\"}]*\)\"\{0,1\}[,}].*/\1/p"
}

run_bounded() { # $1 sql file, $2 out, $3 err, then -v vars...
  local sql="$1" out="$2" err="$3"; shift 3
  if command -v timeout >/dev/null 2>&1; then
    timeout 60 psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@" -f "$sql" >"$out" 2>"$err"
  else
    psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@" -f "$sql" >"$out" 2>"$err"
  fi
}

# ── 3. One race = two genuine connections + identity + invariants ────────────
# run_race <label> <wo_id> <key_a> <key_b> <expected_requests> <expected_replayed_rows>
run_race() {
  local label="$1" wo="$2" key_a="$3" key_b="$4" exp_requests="$5" exp_replayed="$6"
  local a_out="$WORKDIR/${label}-a.out" a_err="$WORKDIR/${label}-a.err"
  local b_out="$WORKDIR/${label}-b.out" b_err="$WORKDIR/${label}-b.err"
  # Race-scoped application_name: A's barrier must never match a backend from
  # an earlier race.
  local b_appname="gda1w-c3-b-${label}-${RUN_TAG}"

  run_bounded "$SQL_A" "$a_out" "$a_err" \
    -v "wo_id=${wo}" -v "actor_id=${ACTOR_ID}" -v "idem_key=${key_a}" \
    -v "end_at=${END_AT}" -v "items=${ITEMS}" -v "b_appname=${b_appname}" &
  local a_pid=$!
  run_bounded "$SQL_B" "$b_out" "$b_err" \
    -v "wo_id=${wo}" -v "actor_id=${ACTOR_ID}" -v "idem_key=${key_b}" \
    -v "end_at=${END_AT}" -v "items=${ITEMS}" -v "b_appname=${b_appname}" &
  local b_pid=$!

  local a_exit=0 b_exit=0
  wait "$a_pid" || a_exit=$?
  wait "$b_pid" || b_exit=$?
  if [ "$a_exit" -ne 0 ] || [ "$b_exit" -ne 0 ]; then
    echo "── ${label} session A stderr ──"; cat "$a_err" || true
    echo "── ${label} session B stderr ──"; cat "$b_err" || true
    fail "${label}-session-exit a_exit=${a_exit} b_exit=${b_exit}"
  fi

  # Exactly one evidence line per session.
  [ "$(grep -c '^GDA1W-C3-CONC|A|' "$a_out" || true)" = "1" ] || fail "${label}-a-evidence-count"
  [ "$(grep -c '^GDA1W-C3-CONC|B|' "$b_out" || true)" = "1" ] || fail "${label}-b-evidence-count"
  local a_json b_json
  a_json="$(grep '^GDA1W-C3-CONC|A|' "$a_out" | head -n1 | cut -d'|' -f3-)"
  b_json="$(grep '^GDA1W-C3-CONC|B|' "$b_out" | head -n1 | cut -d'|' -f3-)"

  local a_wo b_wo a_rep b_rep a_num b_num a_ver b_ver a_fp b_fp a_outcome b_outcome
  a_wo="$(field "$a_json" work_order_id)";          b_wo="$(field "$b_json" work_order_id)"
  a_rep="$(field "$a_json" completion_report_id)";  b_rep="$(field "$b_json" completion_report_id)"
  a_num="$(field "$a_json" report_number)";         b_num="$(field "$b_json" report_number)"
  a_ver="$(field "$a_json" performed_work_version)";b_ver="$(field "$b_json" performed_work_version)"
  a_fp="$(field "$a_json" request_fingerprint)";    b_fp="$(field "$b_json" request_fingerprint)"
  a_outcome="$(field "$a_json" outcome)";           b_outcome="$(field "$b_json" outcome)"

  # Outcomes + full canonical identity across the two connections.
  [ "$a_outcome" = "created" ]  || fail "${label}-a-outcome-not-created outcome=${a_outcome}"
  [ "$b_outcome" = "replayed" ] || fail "${label}-b-outcome-not-replayed outcome=${b_outcome}"
  [ "$a_wo" = "$wo" ]           || fail "${label}-a-work-order-mismatch"
  [ "$a_wo" = "$b_wo" ]         || fail "${label}-work-order-identity"
  [ -n "$a_rep" ] && [ "$a_rep" = "$b_rep" ] || fail "${label}-report-id-identity a=${a_rep} b=${b_rep}"
  [ -n "$a_num" ] && [ "$a_num" = "$b_num" ] || fail "${label}-report-number-identity a=${a_num} b=${b_num}"
  [ "$a_ver" = "1" ] && [ "$b_ver" = "1" ]   || fail "${label}-snapshot-version a=${a_ver} b=${b_ver}"
  printf '%s' "$a_fp" | grep -Eq '^[0-9a-f]{64}$' || fail "${label}-a-fingerprint-shape"
  [ "$a_fp" = "$b_fp" ]         || fail "${label}-fingerprint-identity"

  # Final DB invariants: cardinality + immutability for THIS work order.
  local invariants
  invariants="$("${PSQL[@]}" -At -F'|' <<SQL
SELECT
  (SELECT status FROM public.work_orders WHERE id = '${wo}'),
  (SELECT count(*) FROM public.completion_reports WHERE work_order_id = '${wo}'),
  (SELECT count(*) FROM public.completion_report_items i
     JOIN public.completion_reports r ON r.id = i.completion_report_id
    WHERE r.work_order_id = '${wo}'),
  (SELECT count(*) FROM public.work_order_completion_requests WHERE work_order_id = '${wo}'),
  (SELECT count(*) FROM public.work_order_completion_requests
    WHERE work_order_id = '${wo}' AND outcome = 'created'),
  (SELECT count(*) FROM public.work_order_completion_requests
    WHERE work_order_id = '${wo}' AND outcome = 'replayed'),
  (SELECT report_number FROM public.completion_reports WHERE work_order_id = '${wo}'),
  (SELECT performed_work_version FROM public.completion_reports WHERE work_order_id = '${wo}');
SQL
)"
  local inv_status inv_reports inv_items inv_requests inv_created inv_replayed inv_num inv_ver
  IFS='|' read -r inv_status inv_reports inv_items inv_requests inv_created inv_replayed inv_num inv_ver <<EOF
$invariants
EOF

  [ "$inv_status" = "completed" ]        || fail "${label}-invariant-status status=${inv_status}"
  [ "$inv_reports" = "1" ]               || fail "${label}-invariant-one-canonical-report count=${inv_reports}"
  [ "$inv_items" = "1" ]                 || fail "${label}-invariant-snapshot-cardinality count=${inv_items}"
  [ "$inv_requests" = "$exp_requests" ]  || fail "${label}-invariant-request-rows expected=${exp_requests} got=${inv_requests}"
  [ "$inv_created" = "1" ]               || fail "${label}-invariant-single-created-outcome count=${inv_created}"
  [ "$inv_replayed" = "$exp_replayed" ]  || fail "${label}-invariant-replayed-rows expected=${exp_replayed} got=${inv_replayed}"
  [ "$inv_num" = "$a_num" ]              || fail "${label}-invariant-number-immutable db=${inv_num} evidence=${a_num}"
  [ "$inv_ver" = "1" ]                   || fail "${label}-invariant-version-immutable version=${inv_ver}"

  # Exported for the summary line.
  RACE_RESULT="work_order=${wo} report=${a_rep} number=${a_num} fingerprint=${a_fp} requests=${inv_requests}"
}

# ── 4. RACE 1: separate-connection SAME-KEY concurrency ─────────────────────
# One shared key; the loser's replay writes nothing (1 ledger row, 0 replayed).
SHARED_KEY="gda1w-conc-r1-${RUN_TAG}-shared"
run_race "race1" "$WO1_ID" "$SHARED_KEY" "$SHARED_KEY" 1 0
RACE1_RESULT="$RACE_RESULT"

# ── 5. RACE 2: separate-connection DIFFERENT-KEY / SAME-WORK-ORDER ──────────
# Distinct keys, identical intent; the loser's replay appends one immutable
# alias row (2 ledger rows: 1 created + 1 replayed).
KEY_A2="gda1w-conc-r2-${RUN_TAG}-key-a"
KEY_B2="gda1w-conc-r2-${RUN_TAG}-key-b"
run_race "race2" "$WO2_ID" "$KEY_A2" "$KEY_B2" 2 1
RACE2_RESULT="$RACE_RESULT"

# Race 2 extra: the alias row carries B's DISTINCT key bound to the same
# canonical report and fingerprint as the created row.
ALIAS_CHECK="$("${PSQL[@]}" -At -c "
  SELECT count(*) FROM public.work_order_completion_requests r1
    JOIN public.work_order_completion_requests r2
      ON r2.work_order_id = r1.work_order_id
   WHERE r1.work_order_id = '${WO2_ID}'
     AND r1.outcome = 'created'  AND r1.idempotency_key = '${KEY_A2}'
     AND r2.outcome = 'replayed' AND r2.idempotency_key = '${KEY_B2}'
     AND r2.completion_report_id = r1.completion_report_id
     AND r2.request_fingerprint  = r1.request_fingerprint")"
[ "$ALIAS_CHECK" = "1" ] || fail "race2-alias-row-binding count=${ALIAS_CHECK}"

# ── 6. Deterministic summary ─────────────────────────────────────────────────
echo "GDA1W-C3-CONC SUMMARY: PASS races=2"
echo "GDA1W-C3-CONC RACE1(same-key):           a=created b=replayed ${RACE1_RESULT} replayed_rows=0"
echo "GDA1W-C3-CONC RACE2(diff-key/same-wo):   a=created b=replayed ${RACE2_RESULT} replayed_rows=1 alias=bound"
exit 0
