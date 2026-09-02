#!/usr/bin/env bash
set -euo pipefail

# GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5 cleanup for ONE full attempt (both
# lanes: fresh, import) sharing one suffix. Run only after setup.sh +
# capture-evidence.sh have each been separately invoked for every lane that
# was started.
#
# The whole attempt is CLEANED_BUT_SOURCE_ATTEMPT_BURNED if ANY of: the
# shared suffix-level burned.txt exists, either lane's own evidence/burned.txt
# exists, either expected lane directory is entirely MISSING (setup.sh never
# ran for it), either present lane never reached
# evidence/attempt-completed.txt (capture-evidence.sh never finished it), or
# either started lane's `supabase stop` fails. The same suffix is never
# repaired, rerun, or partially accepted.
#
# Unlike the predecessor C5-D harness, neither R5 lane inserts committed
# legacy fixtures that must coexist with and be torn down from a shared
# production-shaped schema: both lanes are entirely fresh disposable
# databases created solely for this attempt, and every row either lane
# writes is synthetic postal-master/import-batch/dealer/auth-user data
# scoped to that lane's own disposable project. Teardown here is therefore
# limited to stopping and fully removing each lane's disposable project;
# there is no separate "preserve real legacy rows, delete only fixture rows"
# step.
#
# Separate fresh/import manifest.json files are retained (each with that
# lane's own artifact hashes and command ledger, including this script's own
# stop command for that lane), plus one aggregate manifest.json covering
# both lanes, the target migration hash, all seven harness source-file
# hashes, the five R4 source/test hashes, and protected-path metadata.
# cleanup.log is retained. Every copied lane-evidence artifact's SHA-256 is
# computed before and after copy and compared before runtime removal. After
# the per-lane manifests and cleanup.log are finalized, every retained
# regular file is hashed recursively into the aggregate manifest; only that
# aggregate manifest itself is excluded to avoid self-reference.

CONFIRM_LITERAL="I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE"
RUNTIME_PARENT="${GDA_POSTAL_R5_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
SUFFIX="${GDA_POSTAL_R5_SUFFIX:-}"
REPO_ROOT="${GDA_POSTAL_R5_REPO_ROOT:-}"
RETAINED_EVIDENCE_PARENT="${GDA_POSTAL_R5_RETAINED_EVIDENCE_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime/gda-postal-r5-evidence}"
PSQL_BIN="${GDA_POSTAL_R5_PSQL_BIN:-}"
LANES=(fresh import)
MIGRATION_BASENAME="20260901001246_jp_postal_master.sql"
EXPECTED_MIGRATION_SHA256="76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d"
REQUIRED_PR_NUMBER="48"
REQUIRED_PR_STATE="OPEN"
REQUIRED_PR_DRAFT="true"
REQUIRED_PR_BASE="main"

PROTECTED_PATHS=(
  "src/components/estimates/wizard/screens/ScreensPreview.tsx"
  "supabase/migrations/20260801110110_line_link_tokens.sql"
  "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"
  "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts"
)

# macOS ships Bash 3.2, which has no associative arrays. Keep the protected
# and R4-manifest metadata as literal case mappings so cleanup can run on the
# default shell without weakening the exact pathname/mode/blob contract.
protected_blob_for() {
  case "$1" in
    "src/components/estimates/wizard/screens/ScreensPreview.tsx") printf '%s' "c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f" ;;
    "supabase/migrations/20260801110110_line_link_tokens.sql") printf '%s' "accd22345054cc44f89156fd78eaba6dfe4242a4" ;;
    "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql") printf '%s' "32fda49583ae1217bc13711784ad8fa31744726c" ;;
    "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts") printf '%s' "fe3c80f22fd80dcbfab076082473216dda582c14" ;;
    *) return 1 ;;
  esac
}

protected_mode_for() {
  case "$1" in
    "src/components/estimates/wizard/screens/ScreensPreview.tsx"|\
    "supabase/migrations/20260801110110_line_link_tokens.sql"|\
    "supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql"|\
    "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts") printf '%s' "100644" ;;
    *) return 1 ;;
  esac
}

R4_MANIFEST_PATHS=(
  "supabase/migrations/20260901001246_jp_postal_master.sql"
  "supabase/tests/jp_postal_master_rpc.test.sql"
  "src/lib/geo/jp-postal-master-migration-contract.test.ts"
  "scripts/postal-master/import-japan-post.ts"
  "scripts/postal-master/import-japan-post.test.ts"
)
r4_manifest_blob_for() {
  case "$1" in
    "supabase/migrations/20260901001246_jp_postal_master.sql") printf '%s' "65d2dd2096c29bceaf0060ffaf0f7b77117f0ede" ;;
    "supabase/tests/jp_postal_master_rpc.test.sql") printf '%s' "9832459e92176498944353d38e02ddee4db444ea" ;;
    "src/lib/geo/jp-postal-master-migration-contract.test.ts") printf '%s' "2b653364d0938e55787395cdfd845c9bcfcb1f30" ;;
    "scripts/postal-master/import-japan-post.ts") printf '%s' "49fea46a9e1b3f013d72c385f22107321b046cbd" ;;
    "scripts/postal-master/import-japan-post.test.ts") printf '%s' "71f9fa3e07e648205d916101b835367c7fbd10a6" ;;
    *) return 1 ;;
  esac
}

PATHS_VALIDATED=0

fail() {
  printf 'R5_CLEANUP_ERROR: %s\n' "$1" >&2
  # Never write into SUFFIX_DIR (or AGGREGATE_LOG, which lives under it)
  # before PATHS_VALIDATED confirms the runtime parent, suffix path,
  # retained-evidence parent, and derived retained destination all resolved
  # outside every excluded root: a rejection triggered by one of those very
  # checks must not write into the rejected path.
  if [[ "$PATHS_VALIDATED" -eq 1 ]]; then
    if [[ -n "${AGGREGATE_LOG:-}" ]]; then
      printf '%s FAIL %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1" >> "$AGGREGATE_LOG" 2>/dev/null || true
    fi
    if [[ -n "${SUFFIX_DIR:-}" && -d "${SUFFIX_DIR:-}" ]]; then
      date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SUFFIX_DIR/burned.txt" 2>/dev/null || true
      printf '%s\n' "$1" >> "$SUFFIX_DIR/burned.txt" 2>/dev/null || true
    fi
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
# OS-temp / worktree exclusion boundary. Revalidates the same boundary
# setup.sh enforced, against the canonicalized (symlink-resolved) suffix
# runtime path and retained-evidence parent/destination, before creating,
# copying, or removing anything.
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

# ---------------------------------------------------------------------------
# Preflight.
# ---------------------------------------------------------------------------

[[ "${GDA_POSTAL_R5_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$SUFFIX" ]] || fail "GDA_POSTAL_R5_SUFFIX is required"
[[ "$SUFFIX" =~ ^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "suffix must be fresh UTC timestamp plus six lowercase alphanumerics"
[[ -n "$REPO_ROOT" ]] || fail "GDA_POSTAL_R5_REPO_ROOT is required (needed to hash source/harness files for the retained manifest)"
[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "repo root is not a git worktree"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"
command -v shasum >/dev/null 2>&1 || fail "shasum is required"

gda_r5_assert_outside_excluded_roots "runtime parent" "$RUNTIME_PARENT"

SUFFIX_DIR="$RUNTIME_PARENT/gda-postal-r5.$SUFFIX"
case "$SUFFIX_DIR" in
  *'*'*|*'?'*|*'['*) fail "suffix path must not contain glob characters" ;;
  /|"$HOME"|"$HOME"/|\~|\~/*) fail "suffix path must never resolve to \$HOME, ~, or /" ;;
  ..|*/../*|../*|*/..) fail "suffix path must not contain a parent-directory reference" ;;
esac
gda_r5_assert_outside_excluded_roots "suffix runtime path" "$SUFFIX_DIR"

RETAINED_DIR="$RETAINED_EVIDENCE_PARENT/$(basename "$SUFFIX_DIR")"
case "$RETAINED_DIR" in ""|/|"$HOME"|"$HOME"/) fail "retained evidence path resolved to an unsafe location" ;; esac
gda_r5_assert_outside_excluded_roots "retained evidence parent" "$RETAINED_EVIDENCE_PARENT"
gda_r5_assert_outside_excluded_roots "retained evidence destination" "$RETAINED_DIR"

# Only after the runtime parent, suffix path, retained-evidence parent, and
# derived retained destination all resolve outside every excluded root may
# cleanup-started.txt, aggregate logs, lane stop/processing, copy, mkdir,
# removal, or any burn write occur. This gate must be set before the
# retained-destination existence check below: a safe-but-already-existing
# RETAINED_DIR must still burn the existing safe suffix via fail(), not exit
# unburned.
PATHS_VALIDATED=1

[[ ! -e "$RETAINED_DIR" ]] || fail "retained evidence path already exists: $RETAINED_DIR"

[[ -d "$SUFFIX_DIR" ]] || fail "suffix runtime directory does not exist"
[[ ! -e "$SUFFIX_DIR/cleanup-started.txt" ]] || fail "this suffix has already been cleaned up once; cleanup never runs twice on the same suffix"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$SUFFIX_DIR/cleanup-started.txt"

AGGREGATE_LOG="$SUFFIX_DIR/cleanup.log"
: > "$AGGREGATE_LOG"
log() { printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1" >> "$AGGREGATE_LOG"; }

WAS_BURNED="false"
[[ -e "$SUFFIX_DIR/burned.txt" ]] && WAS_BURNED="true" && log "suffix-level burned.txt present at cleanup start"

# ---------------------------------------------------------------------------
# Source/harness/protected/R4-manifest metadata, computed once for the
# aggregate manifest. This never opens protected-path CONTENT: only git
# ls-files mode/blob metadata and this harness's own seven source files are
# hashed.
# ---------------------------------------------------------------------------

HARNESS_DIR="$REPO_ROOT/scripts/e2e/gda-estimate-postal-master-r5"
HARNESS_FILES=(config.toml setup.sh capture-evidence.sh cleanup.sh real-auth.mjs import-resume.mjs runtime-contract.test.sql)
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

MIGRATION_SQL="$REPO_ROOT/supabase/migrations/$MIGRATION_BASENAME"
MIGRATION_HASH="unavailable"
[[ -f "$MIGRATION_SQL" ]] && MIGRATION_HASH="$(shasum -a 256 "$MIGRATION_SQL" | awk '{print $1}')"

R4_MANIFEST_JSON="$(python3 -c "
import json, sys
paths = sys.argv[1:]
print(json.dumps(paths))
" "${R4_MANIFEST_PATHS[@]}")"
R4_MANIFEST_BLOBS_JSON="[]"
for path in "${R4_MANIFEST_PATHS[@]}"; do
  entry="$(git -C "$REPO_ROOT" ls-files -s -- "$path" 2>/dev/null || true)"
  blob="$(printf '%s' "$entry" | awk '{print $2}')"
  expected_blob="$(r4_manifest_blob_for "$path")" || fail "R4 manifest blob contract missing: $path"
  R4_MANIFEST_BLOBS_JSON="$(python3 -c "
import json, sys
items = json.loads(sys.argv[1])
items.append({'path': sys.argv[2], 'blob': sys.argv[3] or None, 'expected_blob': sys.argv[4]})
print(json.dumps(items))
" "$R4_MANIFEST_BLOBS_JSON" "$path" "$blob" "$expected_blob")"
done

# Protected metadata: mode/blob only, never content, via git.
PROTECTED_METADATA_JSON="[]"
for path in "${PROTECTED_PATHS[@]}"; do
  entry="$(git -C "$REPO_ROOT" ls-files -s -- "$path" 2>/dev/null || true)"
  mode="$(printf '%s' "$entry" | awk '{print $1}')"
  blob="$(printf '%s' "$entry" | awk '{print $2}')"
  expected_mode="$(protected_mode_for "$path")" || fail "protected path mode contract missing: $path"
  expected_blob="$(protected_blob_for "$path")" || fail "protected path blob contract missing: $path"
  PROTECTED_METADATA_JSON="$(python3 -c "
import json, sys
items = json.loads(sys.argv[1])
items.append({'path': sys.argv[2], 'mode': sys.argv[3] or None, 'blob': sys.argv[4] or None, 'expected_mode': sys.argv[5], 'expected_blob': sys.argv[6]})
print(json.dumps(items))
" "$PROTECTED_METADATA_JSON" "$path" "$mode" "$blob" "$expected_mode" "$expected_blob")"
done

log "source metadata computed: migration_sha256=$MIGRATION_HASH harness_files=${#HARNESS_FILES[@]} r4_manifest_paths=${#R4_MANIFEST_PATHS[@]} protected_paths=${#PROTECTED_PATHS[@]}"

# ---------------------------------------------------------------------------
# Per-lane processing. Neither lane preserves real legacy rows: each lane's
# entire disposable project is stopped, and its runtime directory is later
# removed wholesale by the suffix-level removal below. There is no row-level
# fixture teardown step because there is no shared populated schema to
# preserve in this harness.
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

  STOP_EXIT="n/a"
  if [[ "$START_ATTEMPTED" == "true" ]]; then
    set +e
    env SUPABASE_TELEMETRY_DISABLED=1 supabase stop --workdir "$LANE_DIR" --no-backup >> "$AGGREGATE_LOG" 2>&1
    STOP_EXIT=$?
    set -e
    lane_log_cmd "$LANE_DIR" "supabase stop --workdir <lane> --no-backup" "$STOP_EXIT"
    log "lane=$LANE supabase stop attempted exactly once: exit=$STOP_EXIT"
    if [[ "$STOP_EXIT" != "0" ]]; then LANE_BURNED="true"; WAS_BURNED="true"; fi
  else
    log "lane=$LANE start-attempted.txt absent; no supabase stop attempted (no container could have been created)"
  fi

  rm -f "$EVIDENCE_DIR/supabase-status.env" "$EVIDENCE_DIR/.start.raw.log" \
        "$EVIDENCE_DIR/.db-reset.raw.log" "$EVIDENCE_DIR/.mount-probe" \
        "$EVIDENCE_DIR/start-attempted.txt" "$EVIDENCE_DIR/attempt-started.txt" \
        "$EVIDENCE_DIR/start-succeeded.txt" "$EVIDENCE_DIR/attempt-completed.txt"

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
    'stop_exit': '$STOP_EXIT',
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
# exact suffix runtime path. RETAINED_DIR/RETAINED_EVIDENCE_PARENT were
# already canonicalized and validated outside every excluded root during
# preflight, before PATHS_VALIDATED was set.
# ---------------------------------------------------------------------------

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
  # (including this script's stop action for this lane), run facts, and burn
  # status.
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

[[ "$SUFFIX_DIR" == "$RUNTIME_PARENT"/gda-postal-r5.* ]] || fail "final path safety check failed before removal"
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
retained_dir, suffix_dir, was_burned, remove_exit, lane_results_json, artifact_hashes_json, migration_hash, expected_migration_hash, harness_hashes_json, protected_metadata_json, r4_manifest_json = sys.argv[1:12]
cleanup_succeeded = int(remove_exit) == 0
manifest = {
    'runtime_dir': suffix_dir,
    'finalized_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'finalized_after_cleanup': cleanup_succeeded,
    'finalized_last_step': 'aggregate manifest.json is generated after every lane evidence copy, hash comparison, runtime removal attempt, cleanup-log finalization, and retained-artifact hashing; nothing is written after it',
    'was_burned': was_burned == 'true',
    'runtime_removal_exit_code': int(remove_exit),
    'source': {
        'target_migration_sha256': migration_hash,
        'target_migration_sha256_expected': expected_migration_hash,
        'target_migration_hash_matches': migration_hash == expected_migration_hash,
        'harness_source_files': json.loads(harness_hashes_json),
        'r4_source_test_manifest': json.loads(r4_manifest_json),
        'protected_paths': json.loads(protected_metadata_json),
    },
    'lanes': json.loads(lane_results_json),
    'artifacts': json.loads(artifact_hashes_json),
    'classification_hint': (
        'GDA_POSTAL_R5_DISPOSABLE_DB_PASS candidate only if was_burned is false, '
        'runtime_removal_exit_code is 0, finalized_after_cleanup is true, AND every '
        'present lane is not missing, reached capture_completed=true, and has stop_exit '
        '0 or n/a; the raw per-lane evidence files, not this summary, are authoritative '
        'for the actual acceptance decision'
    ),
}
with open(f'{retained_dir}/manifest.json', 'w', encoding='utf-8') as handle:
    json.dump(manifest, handle, indent=2, sort_keys=True)
    handle.write('\n')
" "$RETAINED_DIR" "$SUFFIX_DIR" "$WAS_BURNED" "$REMOVE_EXIT" "$LANE_RESULTS_JSON" "$ALL_RETAINED_ARTIFACT_HASHES_JSON" "$MIGRATION_HASH" "$EXPECTED_MIGRATION_SHA256" "$HARNESS_HASHES_JSON" "$PROTECTED_METADATA_JSON" "$R4_MANIFEST_BLOBS_JSON"

printf 'R5_EVIDENCE_RETAINED=%s\n' "$RETAINED_DIR"
printf 'R5_RUNTIME_REMOVAL_EXIT=%s\n' "$REMOVE_EXIT"
if [[ "$REMOVE_EXIT" -ne 0 ]]; then
  printf 'R5_CLEANUP_ERROR: exact suffix runtime path removal failed with exit %s (manifest.json records the burned result)\n' "$REMOVE_EXIT" >&2
  exit 1
fi
