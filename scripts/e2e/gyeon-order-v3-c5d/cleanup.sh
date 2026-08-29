#!/usr/bin/env bash
set -euo pipefail

# C5-D cleanup for ONE full attempt (all three lanes: fresh, populated,
# runner) sharing one suffix. Run only after setup.sh + capture-evidence.sh
# have each been separately invoked for every lane that was started.
#
# The whole attempt is CLEANED_BUT_SOURCE_ATTEMPT_BURNED if ANY of: the
# shared suffix-level burned.txt exists, any lane's own evidence/burned.txt
# exists, any expected lane directory is entirely MISSING (setup.sh never
# ran for it), any present lane never reached evidence/attempt-completed.txt
# (capture-evidence.sh never finished it), any lane's fixture teardown
# cannot prove a fresh POST-DELETE zero-row count, or any started lane's
# `supabase stop` fails. The same suffix is never repaired, rerun, or
# partially accepted.
#
# fresh/runner fixture identifiers are captured by 'C5D %' dealer-name /
# 'c5d-%@example.invalid' email / 'C5D%' sku pattern (matching whatever
# real-auth.mjs/concurrency.mjs actually committed). populated instead uses
# its own fixed, deterministic identifiers, since that lane's fixture rows
# are inserted with literal known UUIDs by capture-evidence.sh, not
# discovered by name pattern.
#
# For every lane directory that exists: identifiers are captured BEFORE any
# DELETE; the DELETE runs; then a FRESH, SEPARATE, POST-DELETE zero-row count
# (using the SAME preserved identifiers, never a query issued before the
# DELETE) is the sole basis for the zero-row proof. `GYEON_ORDER_V3_C5D_PSQL_BIN`
# must be an executable path whenever a started lane's database needs
# cleanup; if it is missing or not executable at that point, the lane is
# burned rather than silently skipping teardown. Exactly one
# `supabase stop --workdir <lane> --no-backup` is attempted per started lane
# regardless of teardown outcome.
#
# Separate fresh/populated/runner manifest.json files are retained (each
# with that lane's own artifact hashes and command ledger, including this
# script's own teardown/stop commands for that lane), plus one aggregate
# manifest.json covering all three lanes, the formal migration hash, all ten
# harness source-file hashes, and protected-path metadata. cleanup.log is
# retained. Every copied lane-evidence artifact's SHA-256 is computed before
# and after copy and compared before runtime removal. After the per-lane
# manifests and cleanup.log are finalized, every retained regular file is
# hashed recursively into the aggregate manifest; only that aggregate
# manifest itself is excluded to avoid self-reference.

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C5D_IS_DISPOSABLE"
RUNTIME_PARENT="${GYEON_ORDER_V3_C5D_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
SUFFIX="${GYEON_ORDER_V3_C5D_SUFFIX:-}"
REPO_ROOT="${GYEON_ORDER_V3_C5D_REPO_ROOT:-}"
RETAINED_EVIDENCE_PARENT="${GYEON_ORDER_V3_C5D_RETAINED_EVIDENCE_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime/gyeon-order-v3-c5d-evidence}"
PSQL_BIN="${GYEON_ORDER_V3_C5D_PSQL_BIN:-}"
LANES=(fresh populated runner)
FORMAL_BASENAME="20260829101726_gyeon_order_v3_contract.sql"
EXPECTED_FORMAL_SHA256="bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b"

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

fail() {
  printf 'C5D_CLEANUP_ERROR: %s\n' "$1" >&2
  if [[ -n "${AGGREGATE_LOG:-}" ]]; then
    printf '%s FAIL %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1" >> "$AGGREGATE_LOG" 2>/dev/null || true
  fi
  if [[ -n "${SUFFIX_DIR:-}" && -d "${SUFFIX_DIR:-}" ]]; then
    date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SUFFIX_DIR/burned.txt" 2>/dev/null || true
    printf '%s\n' "$1" >> "$SUFFIX_DIR/burned.txt" 2>/dev/null || true
  fi
  exit 1
}

lane_log_cmd() {
  # lane_log_cmd <lane_dir> <description> <exit_code>
  local dir="$1"
  mkdir -p "$dir/evidence"
  python3 -c "
import json, sys
with open('$dir/evidence/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'cleanup.sh', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$2" "$3" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Preflight.
# ---------------------------------------------------------------------------

[[ "${GYEON_ORDER_V3_C5D_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$SUFFIX" ]] || fail "GYEON_ORDER_V3_C5D_SUFFIX is required"
[[ "$SUFFIX" =~ ^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "suffix must be fresh UTC timestamp plus six lowercase alphanumerics"
[[ -n "$REPO_ROOT" ]] || fail "GYEON_ORDER_V3_C5D_REPO_ROOT is required (needed to hash source/harness files for the retained manifest)"
[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "repo root is not a git worktree"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"
command -v shasum >/dev/null 2>&1 || fail "shasum is required"

SUFFIX_DIR="$RUNTIME_PARENT/gyeon-order-v3-c5d.$SUFFIX"
case "$SUFFIX_DIR" in
  *'*'*|*'?'*|*'['*) fail "suffix path must not contain glob characters" ;;
  /|"$HOME"|"$HOME"/|\~|\~/*) fail "suffix path must never resolve to \$HOME, ~, or /" ;;
  ..|*/../*|../*|*/..) fail "suffix path must not contain a parent-directory reference" ;;
esac
[[ -d "$SUFFIX_DIR" ]] || fail "suffix runtime directory does not exist"
[[ ! -e "$SUFFIX_DIR/cleanup-started.txt" ]] || fail "this suffix has already been cleaned up once; cleanup never runs twice on the same suffix"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SUFFIX_DIR/cleanup-started.txt"

AGGREGATE_LOG="$SUFFIX_DIR/cleanup.log"
: > "$AGGREGATE_LOG"
log() { printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1" >> "$AGGREGATE_LOG"; }

WAS_BURNED="false"
[[ -e "$SUFFIX_DIR/burned.txt" ]] && WAS_BURNED="true" && log "suffix-level burned.txt present at cleanup start"

# ---------------------------------------------------------------------------
# Source/harness/protected metadata, computed once for the aggregate
# manifest. This never opens protected-path CONTENT: only git ls-files
# mode/blob metadata and this harness's own ten source files are hashed.
# ---------------------------------------------------------------------------

HARNESS_DIR="$REPO_ROOT/scripts/e2e/gyeon-order-v3-c5d"
HARNESS_FILES=(config.toml setup.sh capture-evidence.sh cleanup.sh real-auth.mjs concurrency.mjs schema-rls.test.sql qualification-evidence.test.sql prepare-finalize-warehouse.test.sql populated-upgrade.test.sql)
HARNESS_HASHES_JSON="$(python3 - "$HARNESS_DIR" "${HARNESS_FILES[@]}" <<'PY'
import hashlib, json, os, sys
harness_dir = sys.argv[1]
names = sys.argv[2:]
def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()
out = []
for name in names:
    path = os.path.join(harness_dir, name)
    out.append({"name": name, "sha256": sha256_of(path) if os.path.isfile(path) else None})
print(json.dumps(out))
PY
)"

FORMAL_SQL="$REPO_ROOT/supabase/migrations/$FORMAL_BASENAME"
FORMAL_HASH="unavailable"
[[ -f "$FORMAL_SQL" ]] && FORMAL_HASH="$(shasum -a 256 "$FORMAL_SQL" | awk '{print $1}')"

# Protected metadata: mode/blob only, never content, via git.
PROTECTED_METADATA_JSON="[]"
for path in "${PROTECTED_PATHS[@]}"; do
  entry="$(git -C "$REPO_ROOT" ls-files -s -- "$path" 2>/dev/null || true)"
  mode="$(printf '%s' "$entry" | awk '{print $1}')"
  blob="$(printf '%s' "$entry" | awk '{print $2}')"
  PROTECTED_METADATA_JSON="$(python3 -c "
import json, sys
items = json.loads(sys.argv[1])
items.append({'path': sys.argv[2], 'mode': sys.argv[3] or None, 'blob': sys.argv[4] or None, 'expected_mode': sys.argv[5], 'expected_blob': sys.argv[6]})
print(json.dumps(items))
" "$PROTECTED_METADATA_JSON" "$path" "$mode" "$blob" "${PROTECTED_MODES[$path]}" "${PROTECTED_BLOBS[$path]}")"
done

log "source metadata computed: formal_sha256=$FORMAL_HASH harness_files=${#HARNESS_FILES[@]} protected_paths=${#PROTECTED_PATHS[@]}"

# ---------------------------------------------------------------------------
# Fixed populated-lane identifiers (must match capture-evidence.sh exactly).
# ---------------------------------------------------------------------------

POPULATED_DEALER_IDS="array['c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002']::uuid[]"
POPULATED_PRODUCT_IDS="array['c5d43000-0000-4000-8000-000000000001']::uuid[]"
POPULATED_ORDER_IDS="array['c5d42000-0000-4000-8000-000000000001','c5d42000-0000-4000-8000-000000000002','c5d42000-0000-4000-8000-000000000003','c5d42000-0000-4000-8000-000000000004']::uuid[]"

sql_uuid_array() {
  if [[ -z "$1" ]]; then printf "array[]::uuid[]"; else printf "array['%s']::uuid[]" "$(printf '%s' "$1" | sed "s/,/','/g")"; fi
}

# ---------------------------------------------------------------------------
# Exhaustive fixture-family teardown (C5-C breadth, C5-D naming), run against
# a preserved identifier set (either pattern-captured for fresh/runner, or
# the fixed populated set). Sets TEARDOWN_EXIT/TEARDOWN_REASON/
# FIXTURE_ROWS_REMAINING/PER_FAMILY_REPORT. Never calls fail()/exit directly.
# ---------------------------------------------------------------------------

run_exhaustive_teardown() {
  local db_url="$1" lane_dir="$2" dealer_ids_sql="$3" user_ids_sql="$4" product_ids_sql="$5" order_ids_sql="$6"

  set +e
  "$PSQL_BIN" "$db_url" -X -v ON_ERROR_STOP=1 -q -c "
begin;
delete from public.gyeon_order_external_compensation_outbox where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_order_warehouse_tasks where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_order_notification_outbox where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_order_qualification_snapshots where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_order_owner_review_events where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_order_prepared_operations_v1 where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_order_idempotency_v3 where dealer_id = any($dealer_ids_sql);
update public.product_orders
set payment_status = case when payment_status = 'authorized' then 'voided' else payment_status end,
    card_authority_evidence_id = null,
    card_authority_request_fingerprint = null
where dealer_id = any($dealer_ids_sql)
  and (card_authority_evidence_id is not null or card_authority_request_fingerprint is not null);
delete from public.gyeon_order_external_evidence_v1 where dealer_id = any($dealer_ids_sql);
delete from public.product_order_items where order_id = any($order_ids_sql);
delete from public.product_orders where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_dealer_credit_terms where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_dealer_qualification_mode_projection where dealer_id = any($dealer_ids_sql);
delete from public.gyeon_ordering_memberships where dealer_id = any($dealer_ids_sql);
delete from public.dealer_wizard_catalog_lifecycle where dealer_id = any($dealer_ids_sql);
delete from public.dealer_members where dealer_id = any($dealer_ids_sql) or user_id = any($user_ids_sql);
delete from public.gyeon_product_qualification_classification where product_id = any($product_ids_sql);
delete from public.gyeon_product_order_offers_v3 where product_id = any($product_ids_sql);
delete from public.gyeon_order_supply_projection where product_id = any($product_ids_sql);
delete from public.gyeon_products where id = any($product_ids_sql);
delete from public.gyeon_qualification_rule_versions where required_detailer_product_codes && array['C5D2-REQ'];
delete from public.gyeon_warehouse_calendar_days;
delete from public.dealers where id = any($dealer_ids_sql);
delete from auth.users where id = any($user_ids_sql);
commit;
" >> "$AGGREGATE_LOG" 2>&1
  local delete_exit=$?
  set -e
  lane_log_cmd "$lane_dir" "psql fixture DELETE transaction (preserved-identifier predicates)" "$delete_exit"
  if [[ "$delete_exit" -ne 0 ]]; then TEARDOWN_REASON="fixture DELETE transaction failed with exit $delete_exit"; return 1; fi

  # required: a FRESH, SEPARATE, POST-DELETE query -- never the pre-delete
  # capture -- through the same preserved identifiers, is the sole basis for
  # the zero-row proof.
  set +e
  local report
  report="$("$PSQL_BIN" "$db_url" -X -v ON_ERROR_STOP=1 -At -F'|' -c "
select 'dealers', (select count(*) from public.dealers where id = any($dealer_ids_sql))
union all select 'users', (select count(*) from auth.users where id = any($user_ids_sql))
union all select 'products', (select count(*) from public.gyeon_products where id = any($product_ids_sql))
union all select 'offers', (select count(*) from public.gyeon_product_order_offers_v3 where product_id = any($product_ids_sql))
union all select 'supply_projection', (select count(*) from public.gyeon_order_supply_projection where product_id = any($product_ids_sql))
union all select 'qualification_classification', (select count(*) from public.gyeon_product_qualification_classification where product_id = any($product_ids_sql))
union all select 'calendar', (select count(*) from public.gyeon_warehouse_calendar_days)
union all select 'qualification_rules', (select count(*) from public.gyeon_qualification_rule_versions where required_detailer_product_codes && array['C5D2-REQ'])
union all select 'ordering_memberships', (select count(*) from public.gyeon_ordering_memberships where dealer_id = any($dealer_ids_sql))
union all select 'credit_terms', (select count(*) from public.gyeon_dealer_credit_terms where dealer_id = any($dealer_ids_sql))
union all select 'qualification_mode_projection', (select count(*) from public.gyeon_dealer_qualification_mode_projection where dealer_id = any($dealer_ids_sql))
union all select 'wizard_catalog_lifecycle', (select count(*) from public.dealer_wizard_catalog_lifecycle where dealer_id = any($dealer_ids_sql))
union all select 'dealer_members', (select count(*) from public.dealer_members where dealer_id = any($dealer_ids_sql) or user_id = any($user_ids_sql))
union all select 'orders', (select count(*) from public.product_orders where dealer_id = any($dealer_ids_sql))
union all select 'order_items', (select count(*) from public.product_order_items where order_id = any($order_ids_sql))
union all select 'idempotency', (select count(*) from public.gyeon_order_idempotency_v3 where dealer_id = any($dealer_ids_sql))
union all select 'evidence', (select count(*) from public.gyeon_order_external_evidence_v1 where dealer_id = any($dealer_ids_sql))
union all select 'prepared_operations', (select count(*) from public.gyeon_order_prepared_operations_v1 where dealer_id = any($dealer_ids_sql))
union all select 'owner_review_events', (select count(*) from public.gyeon_order_owner_review_events where dealer_id = any($dealer_ids_sql))
union all select 'qualification_snapshots', (select count(*) from public.gyeon_order_qualification_snapshots where dealer_id = any($dealer_ids_sql))
union all select 'compensation_outbox', (select count(*) from public.gyeon_order_external_compensation_outbox where dealer_id = any($dealer_ids_sql))
union all select 'warehouse_tasks', (select count(*) from public.gyeon_order_warehouse_tasks where dealer_id = any($dealer_ids_sql))
union all select 'notification_outbox', (select count(*) from public.gyeon_order_notification_outbox where dealer_id = any($dealer_ids_sql));
  ")"
  local zero_row_exit=$?
  set -e
  lane_log_cmd "$lane_dir" "psql FRESH post-delete NAMED per-family zero-row verification (preserved identifiers)" "$zero_row_exit"
  if [[ "$zero_row_exit" -ne 0 ]]; then TEARDOWN_REASON="post-delete zero-row verification query failed with exit $zero_row_exit"; return 1; fi

  PER_FAMILY_REPORT="$(printf '%s' "$report" | tr '\n' ' ' | sed -E 's/\|/=/g')"
  log "lane_dir=$lane_dir post-delete per-family zero-row counts: $PER_FAMILY_REPORT"

  local total nonzero_families
  total="$(printf '%s\n' "$report" | awk -F'|' '{sum+=$2} END{print sum+0}')"
  nonzero_families="$(printf '%s\n' "$report" | awk -F'|' '$2+0 != 0 {print $1"="$2}' | tr '\n' ',')"
  if [[ "$total" != "0" ]]; then
    TEARDOWN_REASON="post-delete fixture teardown left rows behind in: ${nonzero_families%,} (total=$total)"
    return 1
  fi

  FIXTURE_ROWS_REMAINING="0"
  return 0
}

# ---------------------------------------------------------------------------
# Per-lane processing.
# ---------------------------------------------------------------------------

LANE_RESULTS_JSON="[]"

for LANE in "${LANES[@]}"; do
  LANE_DIR="$SUFFIX_DIR/$LANE"

  if [[ ! -d "$LANE_DIR" ]]; then
    WAS_BURNED="true"
    log "lane=$LANE MISSING: setup.sh never ran for this lane; attempt is burned"
    LANE_RESULTS_JSON="$(python3 -c "
import json, sys
results = json.loads(sys.argv[1])
results.append({'lane': sys.argv[2], 'missing': True, 'was_burned': True, 'reason': 'lane_directory_missing'})
print(json.dumps(results))
" "$LANE_RESULTS_JSON" "$LANE")"
    continue
  fi

  EVIDENCE_DIR="$LANE_DIR/evidence"
  mkdir -p "$EVIDENCE_DIR"

  LANE_BURNED="false"
  [[ -e "$EVIDENCE_DIR/burned.txt" ]] && LANE_BURNED="true" && WAS_BURNED="true" && log "lane=$LANE evidence/burned.txt present"

  START_ATTEMPTED="false"
  [[ -e "$EVIDENCE_DIR/start-attempted.txt" ]] && START_ATTEMPTED="true"

  CAPTURE_COMPLETED="false"
  [[ -e "$EVIDENCE_DIR/attempt-completed.txt" ]] && CAPTURE_COMPLETED="true"
  if [[ "$CAPTURE_COMPLETED" != "true" && "$LANE_BURNED" != "true" ]]; then
    LANE_BURNED="true"; WAS_BURNED="true"
    log "lane=$LANE capture-evidence.sh never completed (attempt-completed.txt missing); attempt is burned"
  fi

  FIXTURE_ROWS_REMAINING="n/a"
  TEARDOWN_EXIT=0
  TEARDOWN_REASON=""
  PER_FAMILY_REPORT="n/a"

  if [[ -f "$EVIDENCE_DIR/supabase-status.env" ]]; then
    C5D_DB_URL=""
    while IFS= read -r status_line; do
      if [[ "$status_line" == DB_URL=* ]]; then
        C5D_DB_URL="${status_line#DB_URL=}"
        C5D_DB_URL="${C5D_DB_URL#\"}"; C5D_DB_URL="${C5D_DB_URL%\"}"
        C5D_DB_URL="${C5D_DB_URL#\'}"; C5D_DB_URL="${C5D_DB_URL%\'}"
        break
      fi
    done < "$EVIDENCE_DIR/supabase-status.env"

    case "$C5D_DB_URL" in
      postgresql://*127.0.0.1:*|postgresql://*localhost:*)
        if [[ -z "$PSQL_BIN" || ! -x "$PSQL_BIN" ]]; then
          TEARDOWN_EXIT=1
          TEARDOWN_REASON="GYEON_ORDER_V3_C5D_PSQL_BIN is missing or not executable; a started lane's database requires it for teardown"
        elif [[ "$LANE" == "populated" ]]; then
          set +e
          run_exhaustive_teardown "$C5D_DB_URL" "$LANE_DIR" "$POPULATED_DEALER_IDS" "array[]::uuid[]" "$POPULATED_PRODUCT_IDS" "$POPULATED_ORDER_IDS"
          TEARDOWN_EXIT=$?
          set -e
        else
          set +e
          DEALER_IDS_RAW="$("$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from public.dealers where name like 'C5D %';" 2>/dev/null)"; C1=$?
          USER_IDS_RAW="$("$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from auth.users where email like 'c5d-%@example.invalid';" 2>/dev/null)"; C2=$?
          PRODUCT_IDS_RAW="$("$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(id::text, ','), '') from public.gyeon_products where sku like 'C5D%';" 2>/dev/null)"; C3=$?
          set -e
          lane_log_cmd "$LANE_DIR" "psql capture pattern identifiers: dealers/users/products (exits $C1/$C2/$C3)" "$(( C1 != 0 || C2 != 0 || C3 != 0 ? 1 : 0 ))"
          if [[ "$C1" -ne 0 || "$C2" -ne 0 || "$C3" -ne 0 ]]; then
            TEARDOWN_EXIT=1
            TEARDOWN_REASON="pattern-based dealer/user/product identifier capture failed (exits $C1/$C2/$C3); cannot safely prove a zero-row teardown"
          else
            DEALER_IDS_SQL="$(sql_uuid_array "$DEALER_IDS_RAW")"
            USER_IDS_SQL="$(sql_uuid_array "$USER_IDS_RAW")"
            PRODUCT_IDS_SQL="$(sql_uuid_array "$PRODUCT_IDS_RAW")"
            set +e
            ORDER_IDS_RAW="$("$PSQL_BIN" "$C5D_DB_URL" -X -v ON_ERROR_STOP=1 -At -c "select coalesce(string_agg(o.id::text, ','), '') from public.product_orders o where o.dealer_id = any($DEALER_IDS_SQL);" 2>/dev/null)"; C4=$?
            set -e
            lane_log_cmd "$LANE_DIR" "psql capture pattern-based order identifiers" "$C4"
            if [[ "$C4" -ne 0 ]]; then
              TEARDOWN_EXIT=1
              TEARDOWN_REASON="pattern-based order identifier capture failed (exit $C4); cannot safely prove a zero-row teardown"
            else
              ORDER_IDS_SQL="$(sql_uuid_array "$ORDER_IDS_RAW")"
              set +e
              run_exhaustive_teardown "$C5D_DB_URL" "$LANE_DIR" "$DEALER_IDS_SQL" "$USER_IDS_SQL" "$PRODUCT_IDS_SQL" "$ORDER_IDS_SQL"
              TEARDOWN_EXIT=$?
              set -e
            fi
          fi
        fi
        ;;
      *)
        TEARDOWN_EXIT=1
        TEARDOWN_REASON="database endpoint is not loopback-only or missing"
        ;;
    esac
    if [[ "$TEARDOWN_EXIT" -ne 0 ]]; then
      LANE_BURNED="true"; WAS_BURNED="true"
      log "lane=$LANE fixture teardown FAILED: ${TEARDOWN_REASON:-unknown reason}; supabase stop is still attempted before this lane is finalized as burned"
    fi
  else
    log "lane=$LANE supabase-status.env absent; database never fully started, fixture teardown skipped (not itself a failure)"
  fi

  STOP_EXIT="n/a"
  if [[ "$START_ATTEMPTED" == "true" ]]; then
    set +e
    env SUPABASE_TELEMETRY_DISABLED=1 supabase stop --workdir "$LANE_DIR" --no-backup >> "$AGGREGATE_LOG" 2>&1
    STOP_EXIT=$?
    set -e
    lane_log_cmd "$LANE_DIR" "supabase stop --workdir <lane> --no-backup" "$STOP_EXIT"
    log "lane=$LANE supabase stop attempted exactly once regardless of teardown outcome: exit=$STOP_EXIT"
    if [[ "$STOP_EXIT" != "0" ]]; then LANE_BURNED="true"; WAS_BURNED="true"; fi
  else
    log "lane=$LANE start-attempted.txt absent; no supabase stop attempted (no container could have been created)"
  fi

  rm -f "$EVIDENCE_DIR/supabase-status.env" "$EVIDENCE_DIR/.start.raw.log" \
        "$EVIDENCE_DIR/.db-reset.raw.log" "$EVIDENCE_DIR/.db-reset-tail.log" \
        "$EVIDENCE_DIR/.migration-up.raw.log" "$EVIDENCE_DIR/.mount-probe" \
        "$EVIDENCE_DIR/start-attempted.txt" "$EVIDENCE_DIR/attempt-started.txt" \
        "$EVIDENCE_DIR/start-succeeded.txt" "$EVIDENCE_DIR/attempt-completed.txt" \
        "$EVIDENCE_DIR/migration-list-before-apply.txt.bak" "$EVIDENCE_DIR/.fingerprint-query.sql"

  LANE_FACTS_JSON="{}"
  [[ -f "$EVIDENCE_DIR/.run-facts.json" ]] && LANE_FACTS_JSON="$(cat "$EVIDENCE_DIR/.run-facts.json")"
  LANE_COMMANDS_JSON="[]"
  if [[ -f "$EVIDENCE_DIR/.command-ledger.ndjson" ]]; then
    LANE_COMMANDS_JSON="$(python3 -c "
import json
cmds = []
with open('$EVIDENCE_DIR/.command-ledger.ndjson', encoding='utf-8') as handle:
    for line in handle:
        line = line.strip()
        if line: cmds.append(json.loads(line))
print(json.dumps(cmds))
")"
  fi
  rm -f "$EVIDENCE_DIR/.run-facts.json" "$EVIDENCE_DIR/.command-ledger.ndjson"

  LANE_RESULTS_JSON="$(python3 -c "
import json, sys
results = json.loads(sys.argv[1])
results.append({
    'lane': '$LANE', 'missing': False, 'was_burned': $( [[ "$LANE_BURNED" == "true" ]] && echo True || echo False ),
    'capture_completed': $( [[ "$CAPTURE_COMPLETED" == "true" ]] && echo True || echo False ),
    'start_attempted': $( [[ "$START_ATTEMPTED" == "true" ]] && echo True || echo False ),
    'stop_exit': '$STOP_EXIT', 'fixture_rows_remaining': '$FIXTURE_ROWS_REMAINING',
    'teardown_reason': $( [[ -n "$TEARDOWN_REASON" ]] && python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$TEARDOWN_REASON" || echo null ),
    'run_facts': json.loads(sys.argv[2]), 'commands': json.loads(sys.argv[3]),
})
print(json.dumps(results))
" "$LANE_RESULTS_JSON" "$LANE_FACTS_JSON" "$LANE_COMMANDS_JSON")"
done

log "all lanes processed: was_burned=$WAS_BURNED"

# ---------------------------------------------------------------------------
# Retained evidence path must not already exist. Copy every present lane's
# evidence dir under retained/<lane>/, precopy-hash the source, postcopy-hash
# the retained copy, compare, then write per-lane manifests, then the
# suffix-level cleanup.log, then the aggregate manifest, then remove the
# exact suffix runtime path.
# ---------------------------------------------------------------------------

RETAINED_DIR="$RETAINED_EVIDENCE_PARENT/$(basename "$SUFFIX_DIR")"
case "$RETAINED_DIR" in ""|/|"$HOME"|"$HOME"/) fail "retained evidence path resolved to an unsafe location" ;; esac
[[ ! -e "$RETAINED_DIR" ]] || fail "retained evidence path already exists: $RETAINED_DIR"
mkdir -p "$RETAINED_EVIDENCE_PARENT" "$RETAINED_DIR"

hash_dir_files() {
  python3 - "$1" <<'PY'
import hashlib, json, os, sys
d = sys.argv[1]
def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()
out = []
if os.path.isdir(d):
    for name in sorted(os.listdir(d)):
        path = os.path.join(d, name)
        if name.startswith(".") or not os.path.isfile(path):
            continue
        out.append({"name": name, "sha256": sha256_of(path)})
print(json.dumps(out))
PY
}

ALL_ARTIFACT_HASHES_JSON="[]"
for LANE in "${LANES[@]}"; do
  LANE_EVIDENCE="$SUFFIX_DIR/$LANE/evidence"
  [[ -d "$LANE_EVIDENCE" ]] || continue

  PRECOPY_HASHES_JSON="$(hash_dir_files "$LANE_EVIDENCE")"

  set +e
  cp -R "$LANE_EVIDENCE" "$RETAINED_DIR/$LANE"
  COPY_EXIT=$?
  set -e
  [[ "$COPY_EXIT" -eq 0 ]] || fail "evidence copy for lane=$LANE to $RETAINED_DIR/$LANE failed with exit $COPY_EXIT; runtime path preserved for recovery"
  [[ ! -e "$RETAINED_DIR/$LANE/supabase-status.env" ]] || fail "supabase-status.env leaked into retained evidence for lane=$LANE"

  POSTCOPY_HASHES_JSON="$(hash_dir_files "$RETAINED_DIR/$LANE")"

  # Real source-to-retained copy hash comparison, BEFORE runtime removal.
  set +e
  HASH_COMPARE_RESULT="$(python3 -c "
import json, sys
pre = json.loads(sys.argv[1])
post = json.loads(sys.argv[2])
if pre == post:
    print('MATCH')
else:
    print('MISMATCH')
    print(json.dumps({'pre': pre, 'post': post}), file=sys.stderr)
" "$PRECOPY_HASHES_JSON" "$POSTCOPY_HASHES_JSON")"
  HASH_COMPARE_EXIT=$?
  set -e
  [[ "$HASH_COMPARE_EXIT" -eq 0 && "$HASH_COMPARE_RESULT" == "MATCH" ]] || fail "source-to-retained copy hash comparison failed for lane=$LANE; runtime path preserved for recovery"

  ALL_ARTIFACT_HASHES_JSON="$(python3 -c "
import json, sys
allh = json.loads(sys.argv[1])
lane_hashes = json.loads(sys.argv[2])
for h in lane_hashes:
    allh.append({'lane': sys.argv[3], **h})
print(json.dumps(allh))
" "$ALL_ARTIFACT_HASHES_JSON" "$POSTCOPY_HASHES_JSON" "$LANE")"

  # Per-lane manifest.json: this lane's own artifact hashes, command ledger
  # (including this script's teardown/stop actions for this lane), run
  # facts, and burn status.
  LANE_RESULT_ENTRY="$(python3 -c "
import json, sys
results = json.loads(sys.argv[1])
for r in results:
    if r.get('lane') == sys.argv[2] and not r.get('missing'):
        print(json.dumps(r)); break
else:
    print('{}')
" "$LANE_RESULTS_JSON" "$LANE")"

  python3 -c "
import datetime, json, sys
retained_lane_dir, lane, result_json, hashes_json = sys.argv[1:5]
result = json.loads(result_json)
manifest = {
    'lane': lane,
    'finalized_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'was_burned': result.get('was_burned', True),
    'capture_completed': result.get('capture_completed', False),
    'start_attempted': result.get('start_attempted', False),
    'stop_exit': result.get('stop_exit', 'n/a'),
    'fixture_rows_remaining': result.get('fixture_rows_remaining', 'n/a'),
    'teardown_reason': result.get('teardown_reason'),
    'run_facts': result.get('run_facts', {}),
    'commands_and_exit_codes': result.get('commands', []),
    'artifacts': hashes_json and json.loads(hashes_json) or [],
}
with open(f'{retained_lane_dir}/manifest.json', 'w', encoding='utf-8') as handle:
    json.dump(manifest, handle, indent=2, sort_keys=True)
    handle.write('\n')
" "$RETAINED_DIR/$LANE" "$LANE" "$LANE_RESULT_ENTRY" "$POSTCOPY_HASHES_JSON"
done

# Retain cleanup.log at the aggregate level before the suffix dir is removed.
cp "$AGGREGATE_LOG" "$RETAINED_DIR/cleanup.log"

[[ "$SUFFIX_DIR" == "$RUNTIME_PARENT"/gyeon-order-v3-c5d.* ]] || fail "final path safety check failed before removal"
set +e
rm -rf -- "$SUFFIX_DIR"
REMOVE_EXIT=$?
set -e

if [[ "$REMOVE_EXIT" -ne 0 ]]; then
  WAS_BURNED="true"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SUFFIX_DIR/burned.txt" 2>/dev/null || true
  printf 'runtime removal failed with exit %s\n' "$REMOVE_EXIT" >> "$SUFFIX_DIR/burned.txt" 2>/dev/null || true
fi
printf '%s runtime removal exit=%s; was_burned=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$REMOVE_EXIT" "$WAS_BURNED" >> "$RETAINED_DIR/cleanup.log"

# Hash every retained regular artifact recursively after the per-lane
# manifests and cleanup.log exist. Only the aggregate manifest itself is
# excluded to avoid self-reference.
ALL_RETAINED_ARTIFACT_HASHES_JSON="$(python3 - "$RETAINED_DIR" <<'PY'
import hashlib, json, os, sys
root = sys.argv[1]
out = []
for current, dirs, files in os.walk(root):
    dirs.sort()
    for name in sorted(files):
        path = os.path.join(current, name)
        rel = os.path.relpath(path, root)
        if rel == 'manifest.json':
            continue
        digest = hashlib.sha256()
        with open(path, 'rb') as handle:
            for chunk in iter(lambda: handle.read(65536), b''):
                digest.update(chunk)
        out.append({'path': rel, 'sha256': digest.hexdigest()})
print(json.dumps(out))
PY
)"

# ---------------------------------------------------------------------------
# Aggregate manifest.json -- the final canonical artifact, written only
# after every lane's evidence has been copied, hash-compared, and the exact
# suffix runtime path removed.
# ---------------------------------------------------------------------------

python3 -c "
import datetime, json, sys
retained_dir, suffix_dir, was_burned, remove_exit, lane_results_json, artifact_hashes_json, formal_hash, expected_formal_hash, harness_hashes_json, protected_metadata_json = sys.argv[1:11]
cleanup_succeeded = int(remove_exit) == 0
manifest = {
    'runtime_dir': suffix_dir,
    'finalized_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'finalized_after_cleanup': cleanup_succeeded,
    'finalized_last_step': 'aggregate manifest.json is generated after every lane evidence copy, hash comparison, runtime removal attempt, cleanup-log finalization, and retained-artifact hashing; nothing is written after it',
    'was_burned': was_burned == 'true',
    'runtime_removal_exit_code': int(remove_exit),
    'source': {
        'formal_migration_sha256': formal_hash,
        'formal_migration_sha256_expected': expected_formal_hash,
        'formal_migration_hash_matches': formal_hash == expected_formal_hash,
        'harness_source_files': json.loads(harness_hashes_json),
        'protected_paths': json.loads(protected_metadata_json),
    },
    'lanes': json.loads(lane_results_json),
    'artifacts': json.loads(artifact_hashes_json),
    'classification_hint': (
        'C5D_FORMAL_MIGRATION_DISPOSABLE_PASS candidate only if was_burned is false, '
        'runtime_removal_exit_code is 0, finalized_after_cleanup is true, AND every '
        'present lane is not missing, reached capture_completed=true, has stop_exit 0 or n/a, and '
        'fixture_rows_remaining 0 or n/a; the raw per-lane evidence files, not this summary, are '
        'authoritative for the actual acceptance decision'
    ),
}
with open(f'{retained_dir}/manifest.json', 'w', encoding='utf-8') as handle:
    json.dump(manifest, handle, indent=2, sort_keys=True)
    handle.write('\n')
" "$RETAINED_DIR" "$SUFFIX_DIR" "$WAS_BURNED" "$REMOVE_EXIT" "$LANE_RESULTS_JSON" "$ALL_RETAINED_ARTIFACT_HASHES_JSON" "$FORMAL_HASH" "$EXPECTED_FORMAL_SHA256" "$HARNESS_HASHES_JSON" "$PROTECTED_METADATA_JSON"

printf 'C5D_EVIDENCE_RETAINED=%s\n' "$RETAINED_DIR"
printf 'C5D_RUNTIME_REMOVAL_EXIT=%s\n' "$REMOVE_EXIT"
if [[ "$REMOVE_EXIT" -ne 0 ]]; then
  printf 'C5D_CLEANUP_ERROR: exact suffix runtime path removal failed with exit %s (manifest.json records the burned result)\n' "$REMOVE_EXIT" >&2
  exit 1
fi
