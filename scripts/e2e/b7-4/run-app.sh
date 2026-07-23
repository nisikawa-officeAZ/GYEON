#!/usr/bin/env bash
# B7-4 foreground application launcher. Starts exactly one Next.js dev process on
# port 3000 from the REAL checkout, injected with the disposable local Supabase
# values (which take precedence over .env.local via @next/env). It never reads or
# modifies .env.local, never writes a repository env file, and never backgrounds
# the app. Stop it with Ctrl-C after evidence capture. Do NOT run in the
# implementation phase.
#
# Usage: run-app.sh "$RUNDIR" "$EVID"

set -Eeuo pipefail
umask 077

REPO="/Users/atsushinishikawa/dealeros"
fail() { printf 'B7-4 run-app FAILED: %s\n' "$1" >&2; exit 1; }

# ── 1. Two explicit args; validate BEFORE realpath ──────────────────────────
[ "$#" -eq 2 ] || fail "usage: run-app.sh RUNDIR EVID"
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

# ── 2. Exact marker + PROJECT_ID identity ───────────────────────────────────
R_MARKER="$(cat "$RUNDIR/.b7-4-marker")"
E_MARKER="$(cat "$EVID/.b7-4-evidence-marker")"
[ "$R_MARKER" = "$E_MARKER" ] || fail "marker mismatch"
[ "$R_MARKER" = "PROJECT_ID=dealeros-b7-4-$R_SUFFIX" ] || fail "PROJECT_ID identity"

# ── 3. Load ONLY the disposable env, without printing secrets ───────────────
set +x
[ -f "$RUNDIR/.env.b7-4" ] || fail ".env.b7-4 missing"
# shellcheck disable=SC1091
. "$RUNDIR/.env.b7-4"
[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] || fail "url unset"
[ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ] || fail "anon unset"
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || fail "service-role unset"
printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | grep -qxE 'http://(127\.0\.0\.1|localhost):[0-9]+' || fail "url not loopback"
printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | grep -q 'fbieiotihlmpfzybowbt' && fail "url is the production reference"
export NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY

# ── 4. Refuse a second app; record PID; foreground only ─────────────────────
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then fail "port 3000 already in use"; fi
cd "$REPO"                                            # real checkout, never modified
[ -x "node_modules/.bin/next" ] || fail "next binary missing"
printf '%s\n' "$$" > "$EVID/app.pid"                  # PID only, no keys
chmod 0600 "$EVID/app.pid"
printf 'B7-4 app: exec next dev on :3000 (Ctrl-C to stop) — logs -> %s/app.log\n' "$EVID"
exec node_modules/.bin/next dev -p 3000 >> "$EVID/app.log" 2>&1
