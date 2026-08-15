#!/usr/bin/env bash
# B7-4 durable autonomous E2E runner. Provisions a fresh disposable stack, starts
# the app, runs the canonical Playwright spec (which drives the repo's
# capture-evidence.sh for all seven artifacts), stops the app, runs assertions.sql,
# and tears the stack down — all with no human, no browser, no Terminal work.
#
# Secret handling: xtrace is never enabled; the disposable login and DB URL are read
# locally, passed only through the environment (never argv), and never echoed. Output
# is never piped through grep to hide errors.
#
# Testability (restricted, defaults to production): the preflight, reaper, and
# finalizer honor ${DOCKER}, ${LSOF}, ${B7_TMP_ROOT}; setup publishes a durable
# non-secret identity handoff via B7_IDENTITY_HANDOFF. No unrestricted production
# command override exists — each variable defaults to the real command/path.
#
# Usage:  scripts/e2e/b7-4/run-e2e-auto.sh   (from the repository root; no args)

set +x  # never trace — belt-and-suspenders for secret safety

REPO="/Users/atsushinishikawa/dealeros"
LIBPQ_BIN="/opt/homebrew/opt/libpq/bin"
REQUIRED_PORTS="3000 55320 55321 55322 55323"
CORE8="auth db inbucket kong pg_meta rest storage studio"
CONTAINER_SVC14="analytics auth db edge_runtime imgproxy inbucket kong pg_meta pooler realtime rest storage studio vector"
VOLUME_SVC2="db storage"

# Lifecycle state
IDENTITY_FILE=""
FINALIZED=0
RUNDIR=""; EVID=""; PROJECT_ID=""; APP_PID=""

log() { printf '%s\n' "$*"; }
err() { printf '%s\n' "$*" >&2; }
emit() { [ -n "$1" ] && printf '%s\n' "$1"; return 0; }

# Injectable, production-default command wrappers (restricted overrides for tests).
port_in_use() { "${LSOF:-lsof}" -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# Docker query that distinguishes success-empty / success-nonempty / FAILURE.
# Sets DQ_OUT to stdout; returns docker's real exit status (never masked).
dquery() { DQ_OUT="$("${DOCKER:-docker}" "$@" 2>/dev/null)"; return $?; }

# ── Orphan reaper ────────────────────────────────────────────────────────────
# Independent container + volume inventories (union of suffixes); container-only,
# volume-only, partial and complete remnants all detected. Every project-prefixed
# object must match the exact canonical literal name; malformed/near-match objects
# block the whole preflight. A non-empty partial subset of allowlisted objects is a
# valid orphan (architect policy). Deletes only validated literal names, then
# re-queries and requires zero objects for the suffix. Any docker query failure
# fails closed nonzero.
reap_orphans() {
  local ROOT="${B7_TMP_ROOT:-/private/tmp}"
  "${DOCKER:-docker}" version >/dev/null 2>&1 || { err "REAP_BLOCKED: docker unavailable"; return 10; }

  local cnames vnames
  dquery ps -a --format '{{.Names}}'   || { err "REAP_BLOCKED: docker ps failed"; return 10; }
  cnames="$DQ_OUT"
  dquery volume ls --format '{{.Name}}' || { err "REAP_BLOCKED: docker volume ls failed"; return 10; }
  vnames="$DQ_OUT"

  local proj_c proj_v
  proj_c="$(printf '%s\n' "$cnames" | LC_ALL=C grep -E 'dealeros-b7-4-' | sed '/^$/d' || true)"
  proj_v="$(printf '%s\n' "$vnames" | LC_ALL=C grep -E 'dealeros-b7-4-' | sed '/^$/d' || true)"
  if [ -z "$proj_c" ] && [ -z "$proj_v" ]; then log "reap: no B7-4 runtime present"; return 0; fi

  # Malformed / near-match anomaly among project-prefixed objects → block entirely.
  local anomaly
  anomaly="$( { emit "$proj_c"; emit "$proj_v"; } | LC_ALL=C grep -vE '^supabase_[a-z_]+_dealeros-b7-4-[A-Za-z0-9]{6}$' || true )"
  [ -z "$anomaly" ] || { err "REAP_BLOCKED: malformed/near-match project object(s): $(printf '%s' "$anomaly" | tr '\n' ' ')"; return 11; }

  # Candidate suffixes from the UNION of containers and volumes.
  local suffixes
  suffixes="$( { emit "$proj_c"; emit "$proj_v"; } | LC_ALL=C sed -nE 's/^supabase_[a-z_]+_dealeros-b7-4-([A-Za-z0-9]{6})$/\1/p' | LC_ALL=C sort -u )"

  local sfx
  for sfx in $suffixes; do
    reap_one_suffix "$sfx" "$ROOT" "$cnames" "$vnames" || return $?
  done
  return 0
}

reap_one_suffix() {
  local sfx="$1" ROOT="$2" cnames="$3" vnames="$4"
  local pid="dealeros-b7-4-$sfx"
  local rundir="$ROOT/dealeros-b7-4.$sfx"
  local evid="$ROOT/dealeros-b7-4-evidence.$sfx"

  # Existence OR symlink ambiguity on either canonical path blocks deletion.
  if [ -e "$rundir" ] || [ -L "$rundir" ] || [ -e "$evid" ] || [ -L "$evid" ]; then
    log "reap: $pid has live RUNDIR/EVID → skip (not an orphan)"; return 0
  fi

  local allow_c allow_v have_c have_v
  allow_c="$(for s in $CONTAINER_SVC14; do printf 'supabase_%s_%s\n' "$s" "$pid"; done | LC_ALL=C sort)"
  allow_v="$(for s in $VOLUME_SVC2;    do printf 'supabase_%s_%s\n' "$s" "$pid"; done | LC_ALL=C sort)"
  have_c="$(printf '%s\n' "$cnames" | LC_ALL=C grep -E "_dealeros-b7-4-$sfx\$" | sed '/^$/d' | LC_ALL=C sort || true)"
  have_v="$(printf '%s\n' "$vnames" | LC_ALL=C grep -E "_dealeros-b7-4-$sfx\$" | sed '/^$/d' | LC_ALL=C sort || true)"

  # Every present object must be in the exact literal allowlist.
  local badc badv
  badc="$(LC_ALL=C comm -23 <(emit "$have_c") <(emit "$allow_c"))"
  [ -z "$badc" ] || { err "REAP_BLOCKED: $pid non-allowlisted container(s): $(printf '%s' "$badc" | tr '\n' ' ')"; return 12; }
  badv="$(LC_ALL=C comm -23 <(emit "$have_v") <(emit "$allow_v"))"
  [ -z "$badv" ] || { err "REAP_BLOCKED: $pid non-allowlisted volume(s): $(printf '%s' "$badv" | tr '\n' ' ')"; return 13; }

  # At least one validated object must exist (partial subset is a valid orphan).
  [ -n "$have_c$have_v" ] || { err "REAP_BLOCKED: $pid no validated objects"; return 17; }

  # An active app on 3000 blocks reaping.
  port_in_use 3000 && { err "REAP_BLOCKED: port 3000 in use"; return 14; }

  # Delete only the validated literal names.
  local n
  while IFS= read -r n; do [ -n "$n" ] || continue; "${DOCKER:-docker}" rm -f "$n" >/dev/null 2>&1 || { err "REAP_FAIL: rm $n"; return 15; }; done <<EOF
$have_c
EOF
  while IFS= read -r n; do [ -n "$n" ] || continue; "${DOCKER:-docker}" volume rm "$n" >/dev/null 2>&1 || { err "REAP_FAIL: volume rm $n"; return 16; }; done <<EOF
$have_v
EOF

  # Re-query BOTH inventories; require zero objects for this exact suffix.
  dquery ps -a --format '{{.Names}}'   || { err "REAP_BLOCKED: post-delete docker ps failed"; return 10; }
  printf '%s\n' "$DQ_OUT" | LC_ALL=C grep -qE "_dealeros-b7-4-$sfx\$" && { err "REAP_FAIL: containers remain for $pid"; return 18; }
  dquery volume ls --format '{{.Name}}' || { err "REAP_BLOCKED: post-delete docker volume ls failed"; return 10; }
  printf '%s\n' "$DQ_OUT" | LC_ALL=C grep -qE "_dealeros-b7-4-$sfx\$" && { err "REAP_FAIL: volumes remain for $pid"; return 18; }

  log "reap: removed orphan $pid (containers=$(emit "$have_c" | grep -c . ), volumes=$(emit "$have_v" | grep -c . ))"
  return 0
}

# ── Production preflight (defect 1: reaper reachable before the port gate) ────
production_preflight() {
  # a. an active app on 3000 aborts immediately (never reap an active app).
  port_in_use 3000 && { err "port 3000 already in use"; return 3; }
  # b. reap orphans (a stale stack on 55321-3 reaches this instead of exiting).
  reap_orphans || return $?
  # c. only after reaping, require every provisioning port free.
  local p
  for p in $REQUIRED_PORTS; do
    port_in_use "$p" && { err "required port $p still in use after reap"; return 3; }
  done
  return 0
}

# ── Identity handoff (durable, non-secret) ───────────────────────────────────
load_identity() {  # $1 = handoff file; strictly validate canonical values
  local f="$1" r e p
  [ -f "$f" ] || return 1
  r="$(LC_ALL=C sed -n 's/^RUNDIR=\(.*\)$/\1/p'     "$f" | tail -1)"
  e="$(LC_ALL=C sed -n 's/^EVID=\(.*\)$/\1/p'       "$f" | tail -1)"
  p="$(LC_ALL=C sed -n 's/^PROJECT_ID=\(.*\)$/\1/p' "$f" | tail -1)"
  printf '%s' "$r" | LC_ALL=C grep -qE '^(/private)?/tmp/dealeros-b7-4\.[A-Za-z0-9]{6}$'          || return 1
  printf '%s' "$e" | LC_ALL=C grep -qE '^(/private)?/tmp/dealeros-b7-4-evidence\.[A-Za-z0-9]{6}$' || return 1
  printf '%s' "$p" | LC_ALL=C grep -qE '^dealeros-b7-4-[A-Za-z0-9]{6}$'                            || return 1
  [ "${r##*.}" = "${e##*.}" ] && [ "${e##*.}" = "${p##*-}" ] || return 1
  RUNDIR="$r"; EVID="$e"; PROJECT_ID="$p"
  return 0
}

validate_identity() {
  [ -n "$RUNDIR" ] && [ -n "$EVID" ] || return 1
  printf '%s' "$RUNDIR" | LC_ALL=C grep -qE '^(/private)?/tmp/dealeros-b7-4\.[A-Za-z0-9]{6}$'          || return 1
  printf '%s' "$EVID"   | LC_ALL=C grep -qE '^(/private)?/tmp/dealeros-b7-4-evidence\.[A-Za-z0-9]{6}$' || return 1
  [ "${RUNDIR##*.}" = "${EVID##*.}" ] || return 1
  return 0
}

# Stop ONLY this session's dev server; never signal an unrelated PID.
stop_app_safe() {
  local pid=""
  [ -n "$EVID" ] && [ -f "$EVID/app.pid" ] && pid="$(cat "$EVID/app.pid" 2>/dev/null || true)"
  case "$pid" in ''|*[!0-9]*) return 0 ;; esac
  kill -0 "$pid" 2>/dev/null || return 0
  local cmd; cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  case "$cmd" in
    *"node_modules/.bin/next dev -p 3000"*) : ;;
    *) err "finalize: pid $pid is not this session's dev server — not killing"; return 0 ;;
  esac
  kill -INT "$pid" 2>/dev/null || true
  local i; for i in $(seq 1 40); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  if kill -0 "$pid" 2>/dev/null; then kill -TERM "$pid" 2>/dev/null || true; sleep 1; fi
  return 0
}

verify_restart_policies() {
  local s pol
  for s in $CORE8; do
    pol="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "supabase_${s}_${PROJECT_ID}" 2>/dev/null || true)"
    [ "$pol" = "no" ] || { err "restart policy != no: supabase_${s}_${PROJECT_ID} (=$pol)"; return 1; }
  done
  log "restart policies verified: all 8 = no"
  return 0
}

run_assertions() {
  # DB URL parsed into libpq env — never placed in argv, password never echoed.
  # Read all five fields (one per line) and export them together, so PGPORT/PGUSER/
  # PGDATABASE are actually exported (a prior eval-of-multiline exported only PGHOST).
  local PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD
  { IFS= read -r PGHOST; IFS= read -r PGPORT; IFS= read -r PGUSER; IFS= read -r PGDATABASE; IFS= read -r PGPASSWORD; } < <(
    node -e '
      const fs = require("fs");
      const u = new URL(fs.readFileSync(process.argv[1], "utf8").trim());
      process.stdout.write([
        u.hostname, u.port, decodeURIComponent(u.username),
        u.pathname.replace(/^\//, ""), decodeURIComponent(u.password)
      ].join("\n") + "\n");
    ' "$RUNDIR/.db-url"
  ) || { err "db-url parse failed"; return 1; }
  [ -n "$PGHOST" ] && [ -n "$PGPORT" ] && [ -n "$PGUSER" ] && [ -n "$PGDATABASE" ] || { err "db-url parse incomplete"; return 1; }
  export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD
  local rc=0
  ( umask 077
    psql -v ON_ERROR_STOP=1 \
      -v vuser="$(cat "$RUNDIR/.vuser")" \
      -v ui_key="$(cat "$EVID/ui-key.txt")" \
      -v ui_estimate="$(cat "$EVID/ui-estimate.txt")" \
      -v seq_before_ui="$(cat "$EVID/seq-before-ui.txt")" \
      -f "$REPO/scripts/e2e/b7-4/assertions.sql" > "$EVID/assertions.out" 2>&1
  ) || rc=$?
  unset PGPASSWORD
  if [ "$rc" -ne 0 ]; then err "assertions FAILED"; tail -20 "$EVID/assertions.out" >&2; return 1; fi
  log "assertions PASSED (EVID/assertions.out, 0600)"
  return 0
}

run_pipeline() {
  "$REPO/scripts/e2e/b7-4/run-app.sh" "$RUNDIR" "$EVID" >/dev/null 2>&1 &
  local code
  code="$(curl --retry 60 --retry-delay 2 --retry-all-errors --retry-connrefused -sS -o /dev/null -w '%{http_code}' --max-time 180 http://localhost:3000/login 2>/dev/null || true)"
  [ "$code" = "200" ] || { err "app not ready (login HTTP=$code)"; return 20; }
  APP_PID="$(head -1 "$EVID/app.pid" 2>/dev/null || true)"
  log "app ready on :3000 (pid=$APP_PID)"
  verify_restart_policies || return 21
  # Disposable login → env only. Never argv, never echoed.
  EMAIL="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).email)' "$RUNDIR/.credentials")" || { err "email read failed"; return 22; }
  PASSWORD="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).password)' "$RUNDIR/.credentials")" || { err "password read failed"; return 22; }
  [ -n "$EMAIL" ] && [ -n "$PASSWORD" ] || { err "empty credentials"; return 22; }
  export EMAIL PASSWORD EVID BASE_URL="http://localhost:3000"
  "$REPO/node_modules/.bin/playwright" test --config="$REPO/scripts/e2e/b7-4/e2e/playwright.config.ts" || { unset PASSWORD; err "Playwright spec failed"; return 23; }
  unset PASSWORD
  stop_app_safe
  port_in_use 3000 && { err "port 3000 still open after stop"; return 24; }
  log "app stopped; port 3000 free"
  run_assertions || return 25
  return 0
}

# ── Idempotent EXIT/INT/TERM finalizer ───────────────────────────────────────
finalize() {
  [ "$FINALIZED" = "1" ] && return 0
  FINALIZED=1
  set +e                          # the finalizer does its own error handling
  local rc="${1:-0}"

  # Resolve identity from shell vars OR the durable non-secret handoff.
  if { [ -z "$RUNDIR" ] || [ -z "$EVID" ]; } && [ -n "$IDENTITY_FILE" ]; then
    load_identity "$IDENTITY_FILE" || true
  fi

  stop_app_safe

  if validate_identity && [ -d "$RUNDIR" ] && [ -d "$EVID" ]; then
    if port_in_use 3000; then
      err "finalize: port 3000 still held — retaining recovery state: RUNDIR=$RUNDIR EVID=$EVID"
      [ "$rc" -eq 0 ] && rc=30
    elif "$REPO/scripts/e2e/b7-4/cleanup.sh" "$RUNDIR" "$EVID"; then
      # Exact stack-removal verification (RUNDIR is removed by cleanup.sh on success).
      local remain=0
      dquery ps -a --format '{{.Names}}'   && printf '%s\n' "$DQ_OUT" | LC_ALL=C grep -qE "_${PROJECT_ID}\$" && remain=1
      dquery volume ls --format '{{.Name}}' && printf '%s\n' "$DQ_OUT" | LC_ALL=C grep -qE "_${PROJECT_ID}\$" && remain=1
      if [ "$remain" -ne 0 ]; then
        err "finalize: objects remain for $PROJECT_ID after cleanup"
        [ "$rc" -eq 0 ] && rc=31
      else
        log "finalize: cleanup complete (RUNDIR removed, EVID preserved)"
      fi
    else
      err "finalize: cleanup FAILED — retaining recovery state: RUNDIR=$RUNDIR EVID=$EVID"
      [ "$rc" -eq 0 ] && rc=30
    fi
  elif [ -n "${RUNDIR}${EVID}" ]; then
    err "finalize: identity unproven — retaining any recovery state (RUNDIR=${RUNDIR:-?} EVID=${EVID:-?})"
    [ "$rc" -eq 0 ] && rc=32
  fi

  [ -n "$IDENTITY_FILE" ] && rm -f "$IDENTITY_FILE" 2>/dev/null
  if [ "$rc" -eq 0 ]; then log "R84C-AUTO OK (EVID=${EVID:-none})"; else err "R84C-AUTO FAILED rc=$rc (EVID=${EVID:-none})"; fi
  trap - EXIT INT TERM            # prevent EXIT recursion
  exit "$rc"
}

main() {
  set -Eeuo pipefail
  umask 077
  cd "$REPO" 2>/dev/null || { err "cannot cd to repo"; exit 2; }
  [ "$(pwd -P)" = "$REPO" ] || { err "not the real repository root"; exit 2; }
  [ -x scripts/e2e/b7-4/setup.sh ] || { err "harness setup.sh missing/not exec"; exit 2; }
  export PATH="$LIBPQ_BIN:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
  command -v psql >/dev/null 2>&1 || { err "psql not found"; exit 2; }
  command -v node >/dev/null 2>&1 || { err "node not found"; exit 2; }
  [ -x "$REPO/node_modules/.bin/playwright" ] || { err "playwright not installed"; exit 2; }

  # Lifecycle protection installed BEFORE any runtime state can be created.
  IDENTITY_FILE="$(mktemp -t b7-4-identity.XXXXXX)"
  trap 'finalize "$?"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  production_preflight || exit $?

  # Provision — setup publishes the durable identity handoff immediately (marker time).
  local setup_out; setup_out="$(mktemp -t b7-4-setup.XXXXXX)"
  if ! B7_IDENTITY_HANDOFF="$IDENTITY_FILE" scripts/e2e/b7-4/setup.sh >"$setup_out" 2>&1; then
    cat "$setup_out" >&2; rm -f "$setup_out"
    err "setup.sh failed"
    exit 5   # EXIT trap → finalize resolves identity from the handoff and cleans up
  fi
  cat "$setup_out"
  if ! load_identity "$IDENTITY_FILE"; then
    RUNDIR="$(LC_ALL=C sed -n 's/^RUNDIR=\(.*\)$/\1/p' "$setup_out" | tail -1)"
    EVID="$(LC_ALL=C sed -n 's/^EVID=\(.*\)$/\1/p' "$setup_out" | tail -1)"
    PROJECT_ID="$(LC_ALL=C sed -n 's/^PROJECT_ID=\(.*\)$/\1/p' "$setup_out" | tail -1)"
  fi
  rm -f "$setup_out"
  [ -n "$RUNDIR" ] && [ -d "$RUNDIR" ] || { err "RUNDIR unresolved"; exit 5; }
  [ -n "$EVID" ] && [ -d "$EVID" ] || { err "EVID unresolved"; exit 5; }
  [ -n "$PROJECT_ID" ] || { err "PROJECT_ID unresolved"; exit 5; }
  log "provisioned: PROJECT_ID=$PROJECT_ID"

  run_pipeline || exit $?
  exit 0   # EXIT trap → finalize performs cleanup with rc=0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
