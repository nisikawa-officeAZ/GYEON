#!/usr/bin/env bash
set -Eeuo pipefail

# GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5 one-attempt evidence runner for ONE
# lane (fresh|import). Run only after separately authorized setup.sh for the
# SAME lane and suffix. A failed lane burns the whole suffix; this script
# never retries or repairs the database, and never promotes a partial run
# into acceptance.
#
# fresh:  runs the existing postal pgTAP file plus the new
#         runtime-contract.test.sql, the real Auth/PostgREST driver, and
#         `supabase db lint`.
# import: runs the import-resume.mjs driver (service-role import RPC state
#         machine plus the two real production-importer proofs) under the
#         tsx loader.
#
# This script deliberately does NOT write manifest.json/summary.json: those
# are finalized only by cleanup.sh, after teardown and the project stop both
# succeed for every lane of the suffix.

CONFIRM_LITERAL="I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE"
RUNTIME_PARENT="${GDA_POSTAL_R5_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GDA_POSTAL_R5_RUNTIME_DIR:-}"
LANE="${GDA_POSTAL_R5_LANE:-}"
PSQL_BIN="${GDA_POSTAL_R5_PSQL_BIN:-}"
REPO_ROOT="${GDA_POSTAL_R5_REPO_ROOT:-}"

IN_FAIL=0
PATHS_VALIDATED=0

fail() {
  IN_FAIL=1
  printf 'R5_EVIDENCE_ERROR: %s\n' "$1" >&2
  # A capture failure burns BOTH this lane's evidence dir AND the shared
  # suffix-level marker, so no later lane invocation can proceed with the
  # same suffix after this one has failed. Never use RUNTIME_DIR (or a
  # dirname derived from it) for a write before PATHS_VALIDATED confirms it
  # resolved outside every excluded root: a rejection triggered by that very
  # check must not write into the rejected path.
  if [[ "$PATHS_VALIDATED" -eq 1 ]]; then
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
  printf 'R5_EVIDENCE_ERROR: unexpected non-zero script exit (code %s)\n' "$exit_code" >&2
  [[ "$PATHS_VALIDATED" -eq 1 ]] || return
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

log_cmd() {
  python3 -c "
import json, sys
with open('$EVIDENCE_DIR/.command-ledger.ndjson', 'a', encoding='utf-8') as handle:
    handle.write(json.dumps({'script': 'capture-evidence.sh', 'lane': '$LANE', 'command': sys.argv[1], 'exit_code': int(sys.argv[2])}) + '\n')
" "$1" "$2" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# OS-temp / worktree exclusion boundary. Revalidates the same boundary
# setup.sh enforced, against the canonicalized (symlink-resolved) supplied
# runtime path, before this script uses it for anything.
# ---------------------------------------------------------------------------

gda_r5_realpath() {
  python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

gda_r5_assert_outside_excluded_roots() {
  # gda_r5_assert_outside_excluded_roots <label> <path>
  # A canonicalization error itself fails closed (via fail(), which never
  # writes before PATHS_VALIDATED is set) rather than propagating a raw
  # command-substitution failure.
  local label="$1" candidate="$2" real worktree_real systmp_real tmpdir_real
  real="$(gda_r5_realpath "$candidate")" || fail "$label canonicalization failed for $candidate"
  [[ -n "$real" ]] || fail "$label canonicalized to an empty path"
  worktree_real="$(gda_r5_realpath "$REPO_ROOT")" || fail "$label: REPO_ROOT canonicalization failed"
  [[ -n "$worktree_real" ]] || fail "$label: REPO_ROOT canonicalized to an empty path"
  systmp_real="$(python3 -c 'import os, tempfile; print(os.path.realpath(tempfile.gettempdir()))')" || fail "$label: OS temp root canonicalization failed"
  [[ -n "$systmp_real" ]] || fail "$label: OS temp root canonicalized to an empty path"
  case "$real" in
    "$worktree_real"|"$worktree_real"/*) fail "$label must not resolve inside the Git worktree ($real)" ;;
  esac
  case "$real" in
    /private/tmp|/private/tmp/*) fail "$label must not resolve under /private/tmp ($real)" ;;
    /tmp|/tmp/*) fail "$label must not resolve under /tmp ($real)" ;;
    /var/folders|/var/folders/*) fail "$label must not resolve under /var/folders ($real)" ;;
  esac
  case "$real" in
    "$systmp_real"|"$systmp_real"/*) fail "$label must not resolve under the general OS temp directory ($real)" ;;
  esac
  if [[ -n "${TMPDIR:-}" ]]; then
    tmpdir_real="$(gda_r5_realpath "$TMPDIR")" || fail "$label: \$TMPDIR canonicalization failed"
    [[ -n "$tmpdir_real" ]] || fail "$label: \$TMPDIR canonicalized to an empty path"
    case "$real" in
      "$tmpdir_real"|"$tmpdir_real"/*) fail "$label must not resolve under the current \$TMPDIR ($real)" ;;
    esac
  fi
}

[[ "${GDA_POSTAL_R5_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ "$LANE" == "fresh" || "$LANE" == "import" ]] || fail "GDA_POSTAL_R5_LANE must be exactly one of: fresh, import"
[[ -n "$RUNTIME_DIR" ]] || fail "GDA_POSTAL_R5_RUNTIME_DIR is required"
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gda-postal-r5\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}/${LANE}$ ]] || fail "runtime path does not match the dedicated disposable pattern for this lane"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"
[[ -n "$REPO_ROOT" ]] || fail "GDA_POSTAL_R5_REPO_ROOT is required"
gda_r5_assert_outside_excluded_roots "runtime parent" "$RUNTIME_PARENT"
gda_r5_assert_outside_excluded_roots "runtime path" "$RUNTIME_DIR"

# Only after both the runtime-parent and runtime-path canonicalization
# checks succeed may ordinary failure handling or the EXIT trap write burn
# evidence derived from RUNTIME_DIR.
PATHS_VALIDATED=1

[[ -f "$RUNTIME_DIR/evidence/supabase-status.env" ]] || fail "status evidence is missing; setup.sh must run first for this lane"
[[ -f "$RUNTIME_DIR/evidence/migration-list-proof.txt" ]] || fail "full-chain migration replay proof is missing; setup.sh must complete first for this lane"
[[ ! -e "$RUNTIME_DIR/supabase/.temp/project-ref" ]] || fail "linked project state is forbidden"
[[ -n "$PSQL_BIN" && -x "$PSQL_BIN" ]] || fail "GDA_POSTAL_R5_PSQL_BIN must be an executable path"

EVIDENCE_DIR="$RUNTIME_DIR/evidence"

# ---------------------------------------------------------------------------
# Revalidate repository/harness identity against the persisted setup
# contract BEFORE any test executes. This is deliberately a comparison
# against what setup.sh actually hard-gated and wrote to disk -- not a
# second copy of the same literals -- so drift between setup and capture
# (including a tampered/edited harness file) fails closed and burns the
# suffix rather than silently running against changed source.
# ---------------------------------------------------------------------------

SOURCE_CONTRACT="$EVIDENCE_DIR/source-contract.json"
[[ -f "$SOURCE_CONTRACT" ]] || fail "persisted setup source contract is missing; setup.sh must complete first for this lane"

REVALIDATION_REPORT="$EVIDENCE_DIR/.setup-contract-revalidation.json"
set +e
python3 - "$REPO_ROOT" "$SOURCE_CONTRACT" "$REVALIDATION_REPORT" <<'PY'
import hashlib, json, os, subprocess, sys

repo_root, contract_path, report_path = sys.argv[1:4]

def git(*args):
    return subprocess.run(['git', '-C', repo_root, *args], check=True, capture_output=True, text=True).stdout.strip()

def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(65536), b''):
            digest.update(chunk)
    return digest.hexdigest()

def ls_files_entry(path):
    out = subprocess.run(['git', '-C', repo_root, 'ls-files', '-s', '--', path], check=True, capture_output=True, text=True).stdout.strip()
    if not out:
        return None, None
    parts = out.split()
    return parts[0], parts[1]

with open(contract_path, encoding='utf-8') as handle:
    contract = json.load(handle)

mismatches = []

current_head = git('rev-parse', 'HEAD')
current_tree = git('rev-parse', 'HEAD^{tree}')
status = git('status', '--porcelain=v1')
if current_head != contract['head']:
    mismatches.append(f"head: contract={contract['head']} current={current_head}")
if current_tree != contract['tree']:
    mismatches.append(f"tree: contract={contract['tree']} current={current_tree}")
if status:
    mismatches.append('worktree/index not clean before evidence capture')

mig = contract['migration']
mode, blob = ls_files_entry(mig['path'])
if mode != mig['mode'] or blob != mig['blob']:
    mismatches.append(f"migration metadata drift: {mig['path']}")
full_path = os.path.join(repo_root, mig['path'])
if not os.path.isfile(full_path) or sha256_of(full_path) != mig['sha256']:
    mismatches.append(f"migration content drift: {mig['path']}")

for entry in contract['r4_manifest']:
    mode, blob = ls_files_entry(entry['path'])
    if mode != entry['mode'] or blob != entry['blob']:
        mismatches.append(f"r4 manifest metadata drift: {entry['path']}")
    full_path = os.path.join(repo_root, entry['path'])
    if not os.path.isfile(full_path) or sha256_of(full_path) != entry['sha256']:
        mismatches.append(f"r4 manifest content drift: {entry['path']}")

for entry in contract['protected']:
    mode, blob = ls_files_entry(entry['path'])
    if mode != entry['mode'] or blob != entry['blob']:
        mismatches.append(f"protected path metadata drift: {entry['path']}")

harness_dir = os.path.join(repo_root, 'scripts', 'e2e', 'gda-estimate-postal-master-r5')
for entry in contract['harness_files']:
    full_path = os.path.join(harness_dir, entry['name'])
    current_hash = sha256_of(full_path) if os.path.isfile(full_path) else None
    if current_hash != entry['sha256']:
        mismatches.append(f"harness source drift: {entry['name']}")

report = {'mismatches': mismatches}
with open(report_path, 'w', encoding='utf-8') as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
sys.exit(1 if mismatches else 0)
PY
REVALIDATION_EXIT=$?
set -e
mkdir -p "$EVIDENCE_DIR"
log_cmd "revalidate repository/harness identity against persisted setup contract" "$REVALIDATION_EXIT"
[[ "$REVALIDATION_EXIT" -eq 0 ]] || fail "R5_SOURCE_DRIFT: repository or harness identity no longer matches the persisted setup contract (see .setup-contract-revalidation.json)"

ATTEMPT_MARKER="$EVIDENCE_DIR/attempt-started.txt"
[[ ! -e "$ATTEMPT_MARKER" ]] || fail "this lane has already been attempted and is burned"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$ATTEMPT_MARKER"

set -a
source "$EVIDENCE_DIR/supabase-status.env"
set +a

R5_API_URL="${API_URL:-${SUPABASE_URL:-}}"
R5_DB_URL="${DB_URL:-}"
R5_ANON_KEY="${ANON_KEY:-}"
R5_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
[[ -n "$R5_API_URL" && -n "$R5_DB_URL" ]] || fail "local status did not provide required endpoints"

case "$R5_API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) fail "API endpoint is not loopback-only" ;;
esac
case "$R5_DB_URL" in
  postgresql://*127.0.0.1:*|postgresql://*localhost:*) ;;
  *) fail "database endpoint is not loopback-only" ;;
esac

export R5_API_URL R5_DB_URL R5_ANON_KEY R5_SERVICE_ROLE_KEY
export GDA_POSTAL_R5_SUFFIX="${GDA_POSTAL_R5_SUFFIX:-$(basename "$(dirname "$RUNTIME_DIR")" | sed 's/^gda-postal-r5\.//')}"

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
  # Covers legacy JWT-shaped anon/service-role keys, live Stripe-style
  # secrets, PEM private-key headers, explicit password assignments, the
  # modern Supabase secret/publishable API key prefixes (sb_secret_/
  # sb_publishable_), and explicit service-role/anon/publishable/secret
  # key-variable assignments (case-insensitive) such as
  # SUPABASE_SERVICE_ROLE_KEY=... or "anon_key": "...".
  grep -RInE -i \
    '(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sk_live_|sb_secret_[A-Za-z0-9_-]{10,}|sb_publishable_[A-Za-z0-9_-]{10,}|(service[_-]?role|anon|publishable|secret)[_-]?key"?\s*[:=]|SUPABASE_(SERVICE_ROLE|ANON)_KEY\s*[:=]|password"?\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY)' \
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
  TAP_POSTAL="$EVIDENCE_DIR/.tap-jp-postal-master-rpc.raw"
  TAP_RUNTIME="$EVIDENCE_DIR/.tap-runtime-contract.raw"

  LANE_STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
    "$RUNTIME_DIR/supabase/tests/001-jp-postal-master-rpc.test.sql" > "$TAP_POSTAL" 2>&1 &
  POSTAL_TAP_PID=$!
  wait "$POSTAL_TAP_PID"
  POSTAL_TAP_EXIT=$?
  env SUPABASE_TELEMETRY_DISABLED=1 supabase test db --workdir "$RUNTIME_DIR" --local \
    "$RUNTIME_DIR/supabase/tests/002-runtime-contract.test.sql" > "$TAP_RUNTIME" 2>&1 &
  RUNTIME_TAP_PID=$!
  wait "$RUNTIME_TAP_PID"
  RUNTIME_TAP_EXIT=$?
  set -e
  log_cmd "supabase test db 001-jp-postal-master-rpc.test.sql (pid=$POSTAL_TAP_PID)" "$POSTAL_TAP_EXIT"
  log_cmd "supabase test db 002-runtime-contract.test.sql (pid=$RUNTIME_TAP_PID)" "$RUNTIME_TAP_EXIT"

  {
    printf '# file: 001-jp-postal-master-rpc.test.sql\n'; cat "$TAP_POSTAL"
    printf '# file: 002-runtime-contract.test.sql\n'; cat "$TAP_RUNTIME"
  } > "$EVIDENCE_DIR/pgtap.tap"

  POSTAL_TAP_STRICT="$(verify_tap_strict "$TAP_POSTAL" "jp-postal-master-rpc" 2>&1)" || { printf '%s\n' "$POSTAL_TAP_STRICT" >&2; fail "jp_postal_master_rpc.test.sql failed explicit TAP strictness verification"; }
  RUNTIME_TAP_STRICT="$(verify_tap_strict "$TAP_RUNTIME" "runtime-contract" 2>&1)" || { printf '%s\n' "$RUNTIME_TAP_STRICT" >&2; fail "runtime-contract.test.sql failed explicit TAP strictness verification"; }
  rm -f "$TAP_POSTAL" "$TAP_RUNTIME"
  [[ "$POSTAL_TAP_EXIT" -eq 0 && "$RUNTIME_TAP_EXIT" -eq 0 ]] || fail "pgTAP reported a failure, plan mismatch, or non-PASS result; the suffix is burned"

  REAL_AUTH_STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  set +e
  env GDA_POSTAL_R5_PSQL_BIN="$PSQL_BIN" node "$RUNTIME_DIR/real-auth.mjs" > "$EVIDENCE_DIR/real-auth-results.ndjson" 2> "$EVIDENCE_DIR/real-auth.stderr.txt" &
  REAL_AUTH_PID=$!
  wait "$REAL_AUTH_PID"
  REAL_AUTH_EXIT=$?
  set -e
  REAL_AUTH_COMPLETED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  log_cmd "node real-auth.mjs (pid=$REAL_AUTH_PID)" "$REAL_AUTH_EXIT"
  [[ "$REAL_AUTH_EXIT" -eq 0 ]] || fail "real-auth.mjs reported a failure; the suffix is burned"

  set +e
  env SUPABASE_TELEMETRY_DISABLED=1 supabase db lint --workdir "$RUNTIME_DIR" --local \
    --schema public --level warning --fail-on error > "$EVIDENCE_DIR/advisors.txt" 2>&1 &
  LINT_PID=$!
  wait "$LINT_PID"
  LINT_EXIT=$?
  set -e
  log_cmd "supabase db lint --schema public --level warning --fail-on error (pid=$LINT_PID)" "$LINT_EXIT"
  [[ "$LINT_EXIT" -eq 0 ]] || fail "supabase db lint reported an error-level issue; the suffix is burned"

  secret_scan

  LANE_COMPLETED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  python3 - "$EVIDENCE_DIR/.run-facts.json" "$RUNTIME_DIR" "$POSTAL_TAP_EXIT" "$RUNTIME_TAP_EXIT" "$REAL_AUTH_EXIT" "$LINT_EXIT" \
    "$LANE_STARTED_AT" "$LANE_COMPLETED_AT" "$POSTAL_TAP_PID" "$RUNTIME_TAP_PID" "$REAL_AUTH_PID" "$REAL_AUTH_STARTED_AT" "$REAL_AUTH_COMPLETED_AT" "$LINT_PID" <<'PY'
import datetime, json, sys
(out_path, runtime_dir, postal_exit, runtime_tap_exit, real_auth_exit, lint_exit,
 lane_started_at, lane_completed_at, postal_tap_pid, runtime_tap_pid,
 real_auth_pid, real_auth_started_at, real_auth_completed_at, lint_pid) = sys.argv[1:15]
facts = {
    "lane": "fresh", "runtime_dir": runtime_dir,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "started_at": lane_started_at, "completed_at": lane_completed_at,
    "pgtap_exit": {"jp_postal_master_rpc": int(postal_exit), "runtime_contract": int(runtime_tap_exit)},
    "pgtap_pid": {"jp_postal_master_rpc": int(postal_tap_pid), "runtime_contract": int(runtime_tap_pid)},
    "real_auth_exit": int(real_auth_exit),
    "real_auth_pid": int(real_auth_pid),
    "real_auth_started_at": real_auth_started_at, "real_auth_completed_at": real_auth_completed_at,
    "db_lint_exit": int(lint_exit), "db_lint_pid": int(lint_pid),
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(facts, handle, indent=2, sort_keys=True); handle.write("\n")
PY

# ===========================================================================
# LANE: import
# ===========================================================================
elif [[ "$LANE" == "import" ]]; then
  # Phase one and phase two are two genuinely separate `node` process
  # invocations (never a single process simulating an interruption
  # in-memory). Phase two is started only after phase one has fully exited,
  # so it can carry no in-memory state from phase one; it re-derives
  # deterministic identity from GDA_POSTAL_R5_SUFFIX and resumes using only
  # a fresh server-side status RPC. Each phase runs exactly once (no retry).
  PHASE1_LOG="$EVIDENCE_DIR/.import-resume-phase1.ndjson"
  PHASE2_LOG="$EVIDENCE_DIR/.import-resume-phase2.ndjson"

  LANE_STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  set +e
  env GDA_POSTAL_R5_REPO_ROOT="$REPO_ROOT" GDA_POSTAL_R5_IMPORT_PHASE=1 node --import tsx "$RUNTIME_DIR/import-resume.mjs" \
    > "$PHASE1_LOG" 2> "$EVIDENCE_DIR/import-resume-phase1.stderr.txt" &
  PHASE1_PID=$!
  wait "$PHASE1_PID"
  PHASE1_EXIT=$?
  set -e
  PHASE1_COMPLETED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  log_cmd "node --import tsx import-resume.mjs phase=1 (pid=$PHASE1_PID)" "$PHASE1_EXIT"
  [[ "$PHASE1_EXIT" -eq 0 ]] || fail "import-resume.mjs phase 1 reported a failure; the suffix is burned"

  PHASE2_STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  set +e
  env GDA_POSTAL_R5_REPO_ROOT="$REPO_ROOT" GDA_POSTAL_R5_IMPORT_PHASE=2 node --import tsx "$RUNTIME_DIR/import-resume.mjs" \
    > "$PHASE2_LOG" 2> "$EVIDENCE_DIR/import-resume-phase2.stderr.txt" &
  PHASE2_PID=$!
  wait "$PHASE2_PID"
  PHASE2_EXIT=$?
  set -e
  LANE_COMPLETED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  log_cmd "node --import tsx import-resume.mjs phase=2 (pid=$PHASE2_PID)" "$PHASE2_EXIT"

  [[ "$PHASE1_PID" != "$PHASE2_PID" ]] || fail "phase 1 and phase 2 must be distinct processes; observed the same PID $PHASE1_PID"
  [[ "$PHASE1_EXIT" -eq 0 && "$PHASE2_EXIT" -eq 0 ]] || fail "import-resume.mjs reported a failure (phase1=$PHASE1_EXIT phase2=$PHASE2_EXIT); the suffix is burned"

  # Aggregate both phases' NDJSON into the one canonical evidence stream.
  # Neither phase's stdout/stderr ever contains a credential or address row
  # (import-resume.mjs itself never logs them); secret_scan below still
  # covers the aggregated file defensively.
  cat "$PHASE1_LOG" "$PHASE2_LOG" > "$EVIDENCE_DIR/import-resume-results.ndjson"
  rm -f "$PHASE1_LOG" "$PHASE2_LOG"

  secret_scan

  python3 - "$EVIDENCE_DIR/.run-facts.json" "$RUNTIME_DIR" "$PHASE1_EXIT" "$PHASE2_EXIT" \
    "$LANE_STARTED_AT" "$LANE_COMPLETED_AT" "$PHASE1_PID" "$PHASE2_PID" "$PHASE1_COMPLETED_AT" "$PHASE2_STARTED_AT" <<'PY'
import datetime, json, sys
(out_path, runtime_dir, phase1_exit, phase2_exit,
 lane_started_at, lane_completed_at, phase1_pid, phase2_pid,
 phase1_completed_at, phase2_started_at) = sys.argv[1:11]
facts = {
    "lane": "import", "runtime_dir": runtime_dir,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "started_at": lane_started_at, "completed_at": lane_completed_at,
    "phase1_exit": int(phase1_exit), "phase2_exit": int(phase2_exit),
    "import_resume_exit": int(phase1_exit) or int(phase2_exit),
    "phase1_pid": int(phase1_pid), "phase2_pid": int(phase2_pid),
    "phase1_completed_at": phase1_completed_at, "phase2_started_at": phase2_started_at,
    "distinct_pids": int(phase1_pid) != int(phase2_pid),
}
with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(facts, handle, indent=2, sort_keys=True); handle.write("\n")
PY
fi

date -u '+%Y-%m-%dT%H:%M:%SZ' > "$EVIDENCE_DIR/attempt-completed.txt"

printf 'R5_EVIDENCE_CAPTURED=%s\n' "$EVIDENCE_DIR"
printf 'R5_LANE=%s\n' "$LANE"
printf 'R5_CLASSIFICATION_PENDING=cleanup_then_manual_acceptance_review\n'
