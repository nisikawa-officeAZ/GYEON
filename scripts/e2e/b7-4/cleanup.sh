#!/usr/bin/env bash
# B7-4 cleanup. Destroys ONLY the exact disposable Supabase project and its
# RUNDIR; preserves EVID. It refuses to act while the foreground app is alive or
# port 3000 is occupied (no automatic kill), never uses --all, never runs
# DELETE/TRUNCATE, and retains RUNDIR if the stop fails. Do NOT run in the
# implementation phase.
#
# Usage: cleanup.sh "$RUNDIR" "$EVID"

set -Eeuo pipefail
umask 077

fail() { printf 'B7-4 cleanup FAILED: %s\n' "$1" >&2; exit 1; }

# ── Denied Supabase project references — TWO DISTINCT PROJECTS ──────────────
# Kept as separate constants with separate messages on purpose. This guard
# previously tested the old Dev ref while reporting it as "the production
# reference", and the real Production ref was tested nowhere — so the check
# advertised a protection it did not provide. Never merge these two into one
# pattern or one message: a cleanup aborted for touching Production and a
# cleanup aborted for touching a frozen project need different responses from
# whoever reads the failure.
REF_PRODUCTION="dmvyaykhibmphrmekjbb"      # DealerOS Production — never a test target
REF_FROZEN_OLD_DEV="fbieiotihlmpfzybowbt"  # DealerOS old Dev — FROZEN_REFERENCE_ONLY

export SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1

# ── 1. Two explicit args; validate BEFORE realpath ──────────────────────────
[ "$#" -eq 2 ] || fail "usage: cleanup.sh RUNDIR EVID"
IN_RUNDIR="$1"; IN_EVID="$2"
[ -n "$IN_RUNDIR" ] && [ -n "$IN_EVID" ] || fail "empty argument"
case "$IN_RUNDIR" in /*) : ;; *) fail "RUNDIR not absolute" ;; esac
case "$IN_EVID"   in /*) : ;; *) fail "EVID not absolute"   ;; esac
[ -L "$IN_RUNDIR" ] && fail "RUNDIR is a symlink"
[ -L "$IN_EVID" ]   && fail "EVID is a symlink"
RUNDIR="$(cd "$IN_RUNDIR" && pwd -P)" || fail "RUNDIR unresolved"
EVID="$(cd "$IN_EVID" && pwd -P)" || fail "EVID unresolved"
# Accept EITHER canonical temp root (/tmp on Linux, /private/tmp on macOS) and
# derive an explicit root+suffix from each; nothing else is accepted.
case "$RUNDIR" in
  /tmp/dealeros-b7-4.*)         R_ROOT="/tmp";         R_SUFFIX="${RUNDIR#/tmp/dealeros-b7-4.}" ;;
  /private/tmp/dealeros-b7-4.*) R_ROOT="/private/tmp"; R_SUFFIX="${RUNDIR#/private/tmp/dealeros-b7-4.}" ;;
  *) fail "RUNDIR pattern" ;;
esac
case "$EVID" in
  /tmp/dealeros-b7-4-evidence.*)         E_ROOT="/tmp";         E_SUFFIX="${EVID#/tmp/dealeros-b7-4-evidence.}" ;;
  /private/tmp/dealeros-b7-4-evidence.*) E_ROOT="/private/tmp"; E_SUFFIX="${EVID#/private/tmp/dealeros-b7-4-evidence.}" ;;
  *) fail "EVID pattern" ;;
esac
case "$R_SUFFIX" in *[!A-Za-z0-9]*|"") fail "RUNDIR suffix" ;; esac
case "$E_SUFFIX" in *[!A-Za-z0-9]*|"") fail "EVID suffix" ;; esac
[ "${#R_SUFFIX}" -eq 6 ] || fail "RUNDIR suffix length"
[ "${#E_SUFFIX}" -eq 6 ] || fail "EVID suffix length"
[ "$R_ROOT" = "$E_ROOT" ] || fail "root mismatch"
[ "$R_SUFFIX" = "$E_SUFFIX" ] || fail "suffix mismatch"
[ "$RUNDIR" = "$R_ROOT/dealeros-b7-4.$R_SUFFIX" ] || fail "RUNDIR canonical mismatch"
[ "$EVID" = "$E_ROOT/dealeros-b7-4-evidence.$E_SUFFIX" ] || fail "EVID canonical mismatch"
# Guard against catastrophic targets: reject BOTH broad temp roots explicitly.
case "$RUNDIR" in "/"|"/tmp"|"/private/tmp"|"/private"|"/var/tmp"|"$HOME"|"/Users/atsushinishikawa/dealeros") fail "unsafe RUNDIR" ;; esac

# ── 2. Exact marker + identical suffix/PROJECT_ID identity ──────────────────
R_MARKER="$(cat "$RUNDIR/.b7-4-marker")"
E_MARKER="$(cat "$EVID/.b7-4-evidence-marker")"
[ "$R_MARKER" = "$E_MARKER" ] || fail "marker mismatch"
PROJECT_ID="dealeros-b7-4-$R_SUFFIX"
[ "$R_MARKER" = "PROJECT_ID=$PROJECT_ID" ] || fail "PROJECT_ID identity"

# ── 2b. Effective (non-comment) config identity, comment-blind ──────────────
# Distinguish comments from effective configuration: strip `#` comments and blank
# lines, then inspect only real `key = value` assignments. A recursive content-blind
# grep would false-reject on the frozen old Dev reference that appears in
# config.toml's OWN comments.
CFG="$RUNDIR/supabase/config.toml"
[ -f "$CFG" ] || fail "disposable config missing"
effective_config() { sed -e 's/#.*$//' -e '/^[[:space:]]*$/d' "$CFG"; }
PID_COUNT="$(effective_config | grep -cE '^[[:space:]]*project_id[[:space:]]*=')"
[ "$PID_COUNT" -eq 1 ] || fail "config must have exactly one effective project_id"
CFG_PID="$(effective_config | sed -nE 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"?([^"[:space:]]+)"?.*$/\1/p')"
[ "$CFG_PID" = "$PROJECT_ID" ] || fail "config project_id does not match PROJECT_ID"
# Neither denied project reference may appear in any EFFECTIVE config value.
if effective_config | grep -q "$REF_PRODUCTION"; then
  fail "PRODUCTION project reference ($REF_PRODUCTION) in effective config"
fi
if effective_config | grep -q "$REF_FROZEN_OLD_DEV"; then
  fail "FROZEN OLD DEV project reference ($REF_FROZEN_OLD_DEV) in effective config — reference only, never a test target"
fi

# ── 3. App must be down BEFORE stopping anything (no auto-kill) ──────────────
if [ -f "$EVID/app.pid" ]; then
  PID="$(cat "$EVID/app.pid")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    fail "foreground app (pid $PID) still alive — stop it with Ctrl-C first"
  fi
fi
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  fail "port 3000 still occupied — stop the app first"
fi

# ── 4. Stop ONLY this disposable project; require success before deletion ───
supabase stop --project-id "$PROJECT_ID" --no-backup --workdir "$RUNDIR" \
  || fail "supabase stop failed — RUNDIR retained for recovery"

# ── 5. Mandatory Docker removal verification (fail closed) ──────────────────
# Docker is REQUIRED here: absence, a daemon error, or a failed query all fail and
# retain RUNDIR. Output is captured only AFTER the query itself exited zero, so a
# failed query can never be mistaken for "no matches".
command -v docker >/dev/null 2>&1 || fail "docker unavailable — cannot verify removal, RUNDIR retained"
if ! DOCKER_PS="$(docker ps -a --format '{{.Names}}')"; then
  fail "docker ps query failed — RUNDIR retained"
fi
if ! DOCKER_VOL="$(docker volume ls --format '{{.Name}}')"; then
  fail "docker volume query failed — RUNDIR retained"
fi
if printf '%s\n' "$DOCKER_PS"  | grep -q "supabase_.*_${PROJECT_ID}$"; then
  fail "disposable containers remain — RUNDIR retained"
fi
if printf '%s\n' "$DOCKER_VOL" | grep -q "supabase_.*_${PROJECT_ID}$"; then
  fail "disposable volumes remain — RUNDIR retained"
fi

# ── 6. Remove ONLY the validated RUNDIR; preserve EVID ──────────────────────
rm -rf "$RUNDIR"
[ -e "$RUNDIR" ] && fail "RUNDIR removal incomplete"
printf 'B7-4 cleanup complete. Removed %s. Evidence preserved at %s\n' "$RUNDIR" "$EVID"
