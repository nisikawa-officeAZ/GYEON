#!/usr/bin/env bash
# B7-4 operator evidence capture. Captures ONE clipboard artifact per invocation
# into the ACTIVE run's evidence directory, and refuses everything else.
#
# Usage: capture-evidence.sh <kind> <canonical-EVID>
#
# ── WHY THE OPERATOR NEVER NAMES THE OUTPUT FILE ────────────────────────────
# The destination is derived solely from the closed `kind` enum. An operator-
# supplied filename would let a typo write evidence under a name no later gate
# reads, which is indistinguishable from evidence that was never captured.
#
# ── WHY A FRESHNESS SENTINEL, NOT "START THE WATCHER FIRST" ─────────────────
# The clipboard may ALREADY hold a syntactically valid ws, key or UUID from an
# earlier step, so a watcher that merely starts first can capture a stale value
# that passes every format check. This script overwrites the clipboard with a
# sentinel that cannot match ANY accepted kind, proves the sentinel landed, and
# only then prints READY. A value is accepted only after it REPLACES the
# sentinel. Timing is never the proof; the sentinel transition is. `sleep` sets
# poll cadence only.
#
# ── WHY THE CLIPBOARD IS NEVER READ THROUGH COMMAND SUBSTITUTION ────────────
# `v="$(pbpaste)"` strips trailing newlines, so it cannot prove the original
# bytes and would silently accept a multi-line or newline-terminated value.
# pbpaste is redirected DIRECTLY into a temporary file and the bytes on disk are
# what get validated.
#
# ── WHY ACTIVE-RUN BINDING (Phase 3) EXISTS ─────────────────────────────────
# Structural EVID checks alone accept any self-consistent evidence directory,
# including a historical one preserved from an earlier run. PID liveness and the
# command name are also insufficient: a PID can be recycled, and a DIFFERENT
# DealerOS server may legitimately be running for a different EVID. The
# authoritative binding is the foreground process's stdout: run-app.sh execs the
# dev server with `>> "$EVID/app.log"`, so fd 1 IS that regular file. Comparing
# device:inode of fd 1 against the supplied EVID's app.log ties this invocation
# to exactly one live run, and defeats symlinks, path aliasing, and a log file
# replaced after the process opened it.
#
# Nothing is mutated — not the clipboard, not a temporary file — until every
# read-only check has passed.

set -Eeuo pipefail
umask 077

REPO="/Users/atsushinishikawa/dealeros"
EXPECTED_CMD="$REPO/node_modules/.bin/next dev -p 3000"
POLL_SECONDS=120
POLL_CADENCE=0.25

die() { printf '%s\n' "$1" >&2; exit "$2"; }

# ── Phase 1: argument count + closed kind enum (no filesystem access) ────────
[ "$#" -eq 2 ] || die 'USAGE_ERROR' 2

KIND="$1"
IN_EVID="$2"

# Per-kind destination and acceptance. MODE is `literal` or `regex`.
case "$KIND" in
  customer)  FINAL='ui-step1-customer.txt'; MODE='literal'; ACCEPT='CUSTOMER_OK';  MINLEN=11; MAXLEN=11 ;;
  isolation) FINAL='ui-isolation.txt';      MODE='literal'; ACCEPT='ISOLATION_OK'; MINLEN=12; MAXLEN=12 ;;
  vehicle)   FINAL='ui-step2-vehicle.txt';  MODE='literal'; ACCEPT='VEHICLE_OK';   MINLEN=10; MAXLEN=10 ;;
  armed)     FINAL='ui-armed.txt';          MODE='literal'; ACCEPT='ARMED';        MINLEN=5;  MAXLEN=5  ;;
  ws)        FINAL='ui-ws.txt';             MODE='regex';   ACCEPT='^ws\.[0-9a-f]{32}$';        MINLEN=35; MAXLEN=35 ;;
  key)       FINAL='ui-key.txt';            MODE='regex';   ACCEPT='^[A-Za-z0-9_-]{16,64}$';    MINLEN=16; MAXLEN=64 ;;
  estimate)  FINAL='ui-estimate.txt';       MODE='regex'
             ACCEPT='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
             MINLEN=36; MAXLEN=36 ;;
  *) die 'UNKNOWN_KIND' 2 ;;
esac

# ── Phase 2: structural EVID validation (read-only) ─────────────────────────
# Same canonical method as run-app.sh / cleanup.sh: reject a symlink BEFORE
# resolving, then require `cd … && pwd -P` to reproduce the supplied path.
[ -n "$IN_EVID" ] || die 'EVID_INVALID' 3
case "$IN_EVID" in /*) : ;; *) die 'EVID_INVALID' 3 ;; esac
[ -L "$IN_EVID" ] && die 'EVID_INVALID' 3
[ -d "$IN_EVID" ] || die 'EVID_INVALID' 3
EVID="$(cd "$IN_EVID" && pwd -P)" || die 'EVID_INVALID' 3
[ "$EVID" = "$IN_EVID" ] || die 'EVID_INVALID' 3

case "$EVID" in
  /tmp/dealeros-b7-4-evidence.*)         SUFFIX="${EVID#/tmp/dealeros-b7-4-evidence.}" ;;
  /private/tmp/dealeros-b7-4-evidence.*) SUFFIX="${EVID#/private/tmp/dealeros-b7-4-evidence.}" ;;
  *) die 'EVID_INVALID' 3 ;;
esac
case "$SUFFIX" in *[!A-Za-z0-9]*|"") die 'EVID_INVALID' 3 ;; esac
[ "${#SUFFIX}" -eq 6 ] || die 'EVID_INVALID' 3

[ "$(stat -f '%Su' "$EVID")" = "$(id -un)" ] || die 'EVID_INVALID' 3
[ "$(stat -f '%Lp' "$EVID")" = "700" ]       || die 'EVID_INVALID' 3

MARKER="$EVID/.b7-4-evidence-marker"
[ -L "$MARKER" ] && die 'EVID_INVALID' 3
[ -f "$MARKER" ] || die 'EVID_INVALID' 3
[ "$(stat -f '%Su' "$MARKER")" = "$(id -un)" ] || die 'EVID_INVALID' 3
[ "$(stat -f '%Lp' "$MARKER")" = "600" ]       || die 'EVID_INVALID' 3
# BYTE-EXACT whole-file comparison, boolean only; marker content is never printed.
# `grep -qxF` would accept a marker holding the correct line PLUS extra lines;
# cmp against the generated expected bytes proves the file is exactly one
# terminated line with no prefix, suffix, second line, or unterminated tail.
printf 'PROJECT_ID=dealeros-b7-4-%s\n' "$SUFFIX" | cmp -s - "$MARKER" || die 'EVID_INVALID' 3

# ── Phase 3: active-run binding (read-only) ─────────────────────────────────
# Every failure below is the SAME fixed token, and every one of them happens
# before pbcopy and before any temporary file exists.
APP_PID_FILE="$EVID/app.pid"
APP_LOG="$EVID/app.log"

[ -L "$APP_PID_FILE" ] && die 'ACTIVE_EVID_REQUIRED' 4
[ -f "$APP_PID_FILE" ] || die 'ACTIVE_EVID_REQUIRED' 4
[ "$(stat -f '%Su' "$APP_PID_FILE")" = "$(id -un)" ] || die 'ACTIVE_EVID_REQUIRED' 4
[ "$(stat -f '%Lp' "$APP_PID_FILE")" = "600" ]       || die 'ACTIVE_EVID_REQUIRED' 4

# app.pid must be BYTE-FOR-BYTE equal to "<digits>\n". run-app.sh writes
# `printf '%s\n' "$$"`, so a genuine app.pid carries exactly one trailing newline.
# This rule is deliberately different from the zero-newline rule applied to
# clipboard artifacts below — applying that rule here would reject every real
# app.pid.
#
# Counting newlines and digits separately is NOT sufficient: a file containing
# "12\n34" has one newline, yields numeric lines, collapses to "1234" after
# newline stripping, and still satisfies bytes == digits + 1. Deriving the
# candidate PID and then comparing the regenerated bytes against the whole file
# is what rejects it, along with any space, sign, carriage return, second line,
# or unterminated tail.
PID="$(LC_ALL=C head -1 "$APP_PID_FILE" | LC_ALL=C tr -d '\n')"
case "$PID" in ''|*[!0-9]*) die 'ACTIVE_EVID_REQUIRED' 4 ;; esac
printf '%s\n' "$PID" | cmp -s - "$APP_PID_FILE" || die 'ACTIVE_EVID_REQUIRED' 4

kill -0 "$PID" 2>/dev/null || die 'ACTIVE_EVID_REQUIRED' 4

# Command identity. Only the leading argv[0] token is normalized away: the node
# interpreter may appear bare or as an absolute path. Everything after it must
# match the repository-scoped foreground dev server exactly.
CMDLINE="$(ps -p "$PID" -o command= 2>/dev/null || true)"
[ -n "$CMDLINE" ] || die 'ACTIVE_EVID_REQUIRED' 4
case "$CMDLINE" in *' '*) : ;; *) die 'ACTIVE_EVID_REQUIRED' 4 ;; esac
[ "${CMDLINE#* }" = "$EXPECTED_CMD" ] || die 'ACTIVE_EVID_REQUIRED' 4

[ -L "$APP_LOG" ] && die 'ACTIVE_EVID_REQUIRED' 4
[ -f "$APP_LOG" ] || die 'ACTIVE_EVID_REQUIRED' 4
[ "$(stat -f '%Su' "$APP_LOG")" = "$(id -un)" ] || die 'ACTIVE_EVID_REQUIRED' 4
[ "$(stat -f '%Lp' "$APP_LOG")" = "600" ]       || die 'ACTIVE_EVID_REQUIRED' 4

# THE binding: the live foreground process's stdout must BE this EVID's app.log.
FD1_LINES="$(lsof -p "$PID" -a -d 1 -Fn 2>/dev/null | LC_ALL=C grep '^n' || true)"
[ -n "$FD1_LINES" ] || die 'ACTIVE_EVID_REQUIRED' 4
[ "$(printf '%s\n' "$FD1_LINES" | LC_ALL=C grep -c '^n')" = "1" ] || die 'ACTIVE_EVID_REQUIRED' 4
FD1_PATH="${FD1_LINES#n}"
[ -f "$FD1_PATH" ] || die 'ACTIVE_EVID_REQUIRED' 4
# device:inode, never path strings — defeats symlinks, aliasing, and a log file
# replaced after the process opened it.
[ "$(stat -f '%d:%i' "$FD1_PATH")" = "$(stat -f '%d:%i' "$APP_LOG")" ] || die 'ACTIVE_EVID_REQUIRED' 4

# ── Phase 4: destination must not already exist (no overwrite, ever) ────────
DEST="$EVID/$FINAL"
if [ -e "$DEST" ] || [ -L "$DEST" ]; then die 'ARTIFACT_EXISTS' 5; fi

# ── Capture: the first mutation in this script happens below this line ──────
TMP=''
# Cleanup removes ONLY a path that still matches the exact identity mktemp
# produces inside this EVID. An empty or unvalidated TMP can never become a
# removal target, and there is no broad pattern to expand.
cleanup() {
  case "${TMP:-}" in
    "$EVID"/.capture.??????) rm -f -- "$TMP" ;;
  esac
  return 0
}
# EXIT does the removal. INT/TERM exit NONZERO, which runs the EXIT trap and
# TERMINATES — no signal path returns to the polling loop, so no later pbpaste
# redirection can recreate the file after cleanup, and the final artifact is
# absent after an interrupted capture.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

TMP="$(mktemp "$EVID/.capture.XXXXXX")" || die 'TEMP_CREATE_FAILED' 6
[ "$(stat -f '%Lp' "$TMP")" = "600" ] || die 'TEMP_MODE_INVALID' 6

# Freshness sentinel. The embedded SPACE is what makes it unmatchable by every
# accepted kind: it fails `key` ([A-Za-z0-9_-] only), fails the anchored ws and
# UUID patterns, and equals none of the four literals.
SENTINEL="B7-4 FRESHNESS $(LC_ALL=C hexdump -n 16 -e '4/4 "%08x"' /dev/urandom)"

printf '%s' "$SENTINEL" | pbcopy || die 'CLIPBOARD_UNAVAILABLE' 7
pbpaste > "$TMP" || die 'CLIPBOARD_UNAVAILABLE' 7
cmp -s "$TMP" <(printf '%s' "$SENTINEL") || die 'CLIPBOARD_UNAVAILABLE' 7

printf 'READY:%s\n' "$FINAL"

# Poll. A value is accepted ONLY after it replaces the sentinel and passes every
# byte check. The captured value is never echoed, never stored in a variable, and
# never reaches a diagnostic path.
DEADLINE_ITERS=$(( POLL_SECONDS * 4 ))
i=0
while [ "$i" -lt "$DEADLINE_ITERS" ]; do
  i=$(( i + 1 ))
  sleep "$POLL_CADENCE"
  pbpaste > "$TMP" 2>/dev/null || continue

  # Still the sentinel → the operator has not copied yet.
  if cmp -s "$TMP" <(printf '%s' "$SENTINEL"); then continue; fi

  # Zero newline bytes: rejects multi-line and newline-terminated clipboards.
  [ "$(LC_ALL=C tr -dc '\n' < "$TMP" | wc -c | tr -d ' ')" = "0" ] || continue

  BYTES="$(wc -c < "$TMP" | tr -d ' ')"
  [ "$BYTES" -ge "$MINLEN" ] && [ "$BYTES" -le "$MAXLEN" ] || continue

  # Anchored WHOLE-FILE acceptance. Combined with the zero-newline proof above,
  # -qx on a newline-free file means the entire byte content matched; no leading,
  # trailing or extra bytes are representable.
  if [ "$MODE" = 'literal' ]; then
    LC_ALL=C grep -qxF -- "$ACCEPT" "$TMP" || continue
  else
    LC_ALL=C grep -qxE -- "$ACCEPT" "$TMP" || continue
  fi

  [ "$(stat -f '%Lp' "$TMP")" = "600" ] || die 'TEMP_MODE_INVALID' 6

  # ── No-clobber finalization ──────────────────────────────────────────────
  # The Phase-4 existence check is necessary but NOT sufficient: a second
  # same-kind helper, or any other process of this user, can create DEST in the
  # window between that check and finalization. A plain `mv` would silently
  # overwrite it. `mv -n` refuses to replace an existing destination, and the
  # assertions below prove which outcome actually occurred.
  TMP_ID="$(stat -f '%d:%i' "$TMP")"
  mv -n -- "$TMP" "$DEST" || die 'FINALIZE_FAILED' 8
  # mv -n leaves the source in place when it refuses. A surviving TMP therefore
  # means DEST appeared concurrently: fail WITHOUT touching that destination.
  # (The EXIT trap removes only TMP; the pre-existing DEST is never modified or
  # removed.)
  if [ -e "$TMP" ]; then die 'FINALIZE_FAILED' 8; fi
  if [ -L "$DEST" ]; then die 'FINALIZE_FAILED' 8; fi
  if [ ! -f "$DEST" ]; then die 'FINALIZE_FAILED' 8; fi
  # Identity: the published file must be OUR temporary file, not some other
  # file that arrived at the same path.
  [ "$(stat -f '%d:%i' "$DEST")" = "$TMP_ID" ] || die 'FINALIZE_FAILED' 8
  [ "$(stat -f '%Lp' "$DEST")" = "600" ]       || die 'FINALIZE_FAILED' 8
  # Only after every assertion passes may the trap be cleared.
  trap - EXIT INT TERM
  printf 'CAPTURED:%s\n' "$FINAL"
  exit 0
done

# Timeout: the trap removes only $TMP; no final artifact is left behind.
printf 'CAPTURE_TIMEOUT:%s\n' "$FINAL" >&2
exit 9
