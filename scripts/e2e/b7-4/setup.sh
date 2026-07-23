#!/usr/bin/env bash
# B7-4 disposable E2E setup. Stands up a throwaway local Supabase project under
# /tmp, applies the committed migrations, creates one disposable Auth user, seeds
# one actor tenant + one foreign sentinel, and writes secret-safe run artifacts.
# It NEVER touches the repository's supabase/ tree, .env.local, or the linked
# remote (fbieiotihlmpfzybowbt). Every failure exits nonzero without contacting
# production. Do NOT run in the implementation phase.

set -Eeuo pipefail
umask 077

REPO="/Users/atsushinishikawa/dealeros"
TEMPLATE_DIR="$REPO/scripts/e2e/b7-4"
ACTOR_DEALER="b7400000-0000-4000-8000-0000000000d1"
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

fail() { printf 'B7-4 setup FAILED: %s\n' "$1" >&2; exit 1; }

# Telemetry OFF before any CLI call (metadata commands would otherwise write state).
export SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1

# ── 0. Preconditions ────────────────────────────────────────────────────────
[ -d "$REPO/supabase/migrations" ] || fail "repo migrations missing"
command -v supabase >/dev/null 2>&1 || fail "supabase CLI not found"
command -v node     >/dev/null 2>&1 || fail "node not found"
command -v psql     >/dev/null 2>&1 || fail "psql not found"

# ── 1. Canonical disposable RUNDIR + EVID, same root+suffix, 0700, no symlinks ─
# macOS resolves /tmp -> /private/tmp, so `pwd -P` yields a /private/tmp path.
# Accept EITHER canonical root but nothing else, derive TMP_ROOT from the
# canonicalized RUNDIR, and build EVID under that SAME root so both stay consistent.
RUNDIR="$(mktemp -d /tmp/dealeros-b7-4.XXXXXX)" || fail "mktemp RUNDIR"
[ -L "$RUNDIR" ] && fail "RUNDIR is a symlink"
RUNDIR="$(cd "$RUNDIR" && pwd -P)"
case "$RUNDIR" in
  /tmp/dealeros-b7-4.*)         TMP_ROOT="/tmp";         SUFFIX="${RUNDIR#/tmp/dealeros-b7-4.}" ;;
  /private/tmp/dealeros-b7-4.*) TMP_ROOT="/private/tmp"; SUFFIX="${RUNDIR#/private/tmp/dealeros-b7-4.}" ;;
  *) fail "RUNDIR pattern" ;;
esac
case "$SUFFIX" in *[!A-Za-z0-9]*|"") fail "RUNDIR suffix" ;; esac
[ "${#SUFFIX}" -eq 6 ] || fail "RUNDIR suffix length"
[ "$RUNDIR" = "$TMP_ROOT/dealeros-b7-4.$SUFFIX" ] || fail "RUNDIR canonical mismatch"
PROJECT_ID="dealeros-b7-4-$SUFFIX"

EVID="$TMP_ROOT/dealeros-b7-4-evidence.$SUFFIX"
[ -e "$EVID" ] && fail "EVID already exists"
mkdir -m 0700 "$EVID" || fail "mkdir EVID"
[ -L "$EVID" ] && fail "EVID is a symlink"
EVID="$(cd "$EVID" && pwd -P)"
[ "$EVID" = "$TMP_ROOT/dealeros-b7-4-evidence.$SUFFIX" ] || fail "EVID canonical mismatch"
chmod 0700 "$RUNDIR" "$EVID"

# ── 2. One-line PROJECT_ID markers ──────────────────────────────────────────
printf 'PROJECT_ID=%s\n' "$PROJECT_ID" > "$RUNDIR/.b7-4-marker"
printf 'PROJECT_ID=%s\n' "$PROJECT_ID" > "$EVID/.b7-4-evidence-marker"
chmod 0600 "$RUNDIR/.b7-4-marker" "$EVID/.b7-4-evidence-marker"

# Early non-secret session identity, emitted right after the markers so a wrapper
# can identify THIS exact session even if a later step fails before the final
# handoff. Contains no secret — only the canonical RUNDIR/EVID/PROJECT_ID.
# When a wrapper supplies B7_IDENTITY_HANDOFF, also publish those three canonical
# values to that 0600 file NOW, so a failure-atomic wrapper can clean up this exact
# session even if setup.sh fails after this point (before the final handoff).
if [ -n "${B7_IDENTITY_HANDOFF:-}" ]; then
  ( umask 077; printf 'RUNDIR=%s\nEVID=%s\nPROJECT_ID=%s\n' "$RUNDIR" "$EVID" "$PROJECT_ID" > "$B7_IDENTITY_HANDOFF" )
  chmod 0600 "$B7_IDENTITY_HANDOFF" 2>/dev/null || :
fi
printf 'B7-4 SESSION-INIT RUNDIR=%s EVID=%s PROJECT_ID=%s\n' "$RUNDIR" "$EVID" "$PROJECT_ID"

# ── 3. Materialize the disposable Supabase tree (no .temp, repo untouched) ──
mkdir -p "$RUNDIR/supabase"
sed "s/__B7_4_PROJECT_ID__/$PROJECT_ID/" "$TEMPLATE_DIR/config.toml" > "$RUNDIR/supabase/config.toml"
cp -R "$REPO/supabase/migrations" "$RUNDIR/supabase/migrations"
[ -e "$RUNDIR/supabase/.temp" ] && fail "unexpected .temp in disposable tree"

# ── 4. Port preflight (fail before Docker; never kill anything) ─────────────
for p in 55321 55322 55320 55323 3000; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then fail "port $p already in use"; fi
done

# ── 5. Start the disposable stack and apply migrations (no seed) ────────────
# `supabase start` prints a summary that can contain the local DB URL, anon key
# and service-role key. That output must NEVER reach the terminal: it is contained
# in a 0600 file under RUNDIR and is never read/printed — removed on success,
# retained (still 0600) on failure for architect-directed recovery.
START_RAW="$RUNDIR/.supabase-start.raw"
if ( umask 077; supabase start --workdir "$RUNDIR" > "$START_RAW" 2>&1 ); then
  chmod 0600 "$START_RAW" || fail "start output permissions"
  rm -f "$START_RAW" || fail "remove start output"
else
  chmod 0600 "$START_RAW" 2>/dev/null || :
  fail "supabase start"
fi
# ── 5a. Restart-policy repair Stage A (R84C lifecycle correction) ───────────
# IMMEDIATELY after a successful `supabase start`, before `db reset`, pin
# restart=no on EVERY currently-running project-owned container. Each running
# container is validated against the known 14-service allowlist (unknown names are
# rejected → fail closed); the 8 core services are required. This closes the reboot
# window for whatever `supabase start` actually launched WITHOUT assuming a fixed
# count (the running auxiliary set varies by CLI version/config). Only validated
# literal names — never a broad glob/prune.
command -v docker >/dev/null 2>&1 || fail "docker not found (restart-policy Stage A)"
docker info >/dev/null 2>&1 || fail "docker unavailable (restart-policy Stage A)"
B7_RP_ALLOWED14="analytics auth db edge_runtime imgproxy inbucket kong pg_meta pooler realtime rest storage studio vector"
B7_RP_CORE8="auth db inbucket kong pg_meta rest storage studio"
B7_RP_RUN=""
for _rpA in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  B7_RP_RUN="$(docker ps --format '{{.Names}}' | LC_ALL=C grep -E "_${PROJECT_ID}\$" | LC_ALL=C sort || true)"
  _core_ok=1
  for s in $B7_RP_CORE8; do
    printf '%s\n' "$B7_RP_RUN" | LC_ALL=C grep -qxF "supabase_${s}_${PROJECT_ID}" || _core_ok=0
  done
  [ "$_core_ok" = "1" ] && break
  sleep 1
done
[ -n "$B7_RP_RUN" ] || fail "restart-policy Stage A: no project containers running for $PROJECT_ID"
for s in $B7_RP_CORE8; do
  printf '%s\n' "$B7_RP_RUN" | LC_ALL=C grep -qxF "supabase_${s}_${PROJECT_ID}" || fail "restart-policy Stage A: core service supabase_${s}_${PROJECT_ID} not running"
done
while IFS= read -r _cn; do
  [ -n "$_cn" ] || continue
  _svc="$(printf '%s' "$_cn" | sed -E "s/^supabase_(.*)_${PROJECT_ID}\$/\1/")"
  case " $B7_RP_ALLOWED14 " in
    *" $_svc "*) : ;;
    *) fail "restart-policy Stage A: unknown project container $_cn" ;;
  esac
  docker update --restart=no "$_cn" >/dev/null || fail "restart-policy Stage A update failed: $_cn"
  _rpAp="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$_cn" 2>/dev/null || true)"
  [ "$_rpAp" = "no" ] || fail "restart-policy Stage A verify failed: $_cn=$_rpAp"
done <<EOF
$B7_RP_RUN
EOF
printf 'B7-4 restart-policy Stage A: pinned restart=no on %s running project containers (%s)\n' "$(printf '%s\n' "$B7_RP_RUN" | LC_ALL=C grep -c .)" "$PROJECT_ID"

supabase db reset --local --no-seed --workdir "$RUNDIR" || fail "supabase db reset"

# ── 5b. Restart-policy repair Stage B (R84C lifecycle correction) ───────────
# After `db reset`: require the eight core services running; then pin restart=no on
# EVERY remaining project container (running + any stopped auxiliaries), validate
# each against the 14-service allowlist (reject unknowns → fail closed), and verify
# restart=no. Removed auxiliaries are acceptable; still-present ones are pinned.
# Only validated literal names — no wildcard/prune.
B7_RP_CORE8="auth db inbucket kong pg_meta rest storage studio"
B7_RP_ALLOWED14="analytics auth db edge_runtime imgproxy inbucket kong pg_meta pooler realtime rest storage studio vector"
for _rpB in 1 2 3 4 5 6 7 8 9 10; do
  _run="$(docker ps --format '{{.Names}}' | LC_ALL=C grep -E "_${PROJECT_ID}\$" || true)"
  _core_ok=1
  for s in $B7_RP_CORE8; do
    printf '%s\n' "$_run" | LC_ALL=C grep -qxF "supabase_${s}_${PROJECT_ID}" || _core_ok=0
  done
  [ "$_core_ok" = "1" ] && break
  sleep 1
done
for s in $B7_RP_CORE8; do
  docker ps --format '{{.Names}}' | LC_ALL=C grep -qxF "supabase_${s}_${PROJECT_ID}" || fail "restart-policy Stage B: core service supabase_${s}_${PROJECT_ID} not running"
done
B7_RP_ALL="$(docker ps -a --format '{{.Names}}' | LC_ALL=C grep -E "_${PROJECT_ID}\$" | LC_ALL=C sort || true)"
[ -n "$B7_RP_ALL" ] || fail "restart-policy Stage B: no project containers for $PROJECT_ID"
while IFS= read -r _cn; do
  [ -n "$_cn" ] || continue
  _svc="$(printf '%s' "$_cn" | sed -E "s/^supabase_(.*)_${PROJECT_ID}\$/\1/")"
  case " $B7_RP_ALLOWED14 " in
    *" $_svc "*) : ;;
    *) fail "restart-policy Stage B: unknown project container $_cn" ;;
  esac
  docker update --restart=no "$_cn" >/dev/null || fail "restart-policy Stage B update failed: $_cn"
  _rpBp="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$_cn" 2>/dev/null || true)"
  [ "$_rpBp" = "no" ] || fail "restart-policy Stage B verify failed: $_cn=$_rpBp"
done <<EOF
$B7_RP_ALL
EOF
printf 'B7-4 restart-policy Stage B: 8 core running, all project containers pinned+verified restart=no (%s)\n' "$PROJECT_ID"

# ── 6. Capture local endpoints; quote-safe parse; loopback-only; no key print ─
STATUS_RAW="$RUNDIR/.status.raw"
( umask 077; supabase status -o env --workdir "$RUNDIR" > "$STATUS_RAW" ) || fail "supabase status"
chmod 0600 "$STATUS_RAW"

b7_parse_status() {                 # $1 = raw status file
  local f="$1" line k v cr; cr=$(printf '\r')
  local qre='^[A-Z][A-Z0-9_]*="[^"`;$'"$cr"']*"$'      # proven quoted KEY="value" ONLY
  local n_api=0 n_db=0 n_anon=0 n_srk=0
  API_URL= ; DB_URL= ; ANON_KEY= ; SERVICE_ROLE_KEY=
  while IFS= read -r line || [ -n "$line" ]; do        # handle a final line with no trailing newline
    [ -z "$line" ] && continue
    [[ $line =~ $qre ]] || return 1                     # malformed / continuation / unbalanced / bare -> reject
    k=${line%%=*}; v=${line#*=}; v=${v%\"}; v=${v#\"}   # remove outer quotes exactly once
    case "$k" in
      API_URL)          n_api=$((n_api+1));  [ "$n_api"  -gt 1 ] && return 1; API_URL=$v ;;
      DB_URL)           n_db=$((n_db+1));    [ "$n_db"   -gt 1 ] && return 1; DB_URL=$v ;;
      ANON_KEY)         n_anon=$((n_anon+1)); [ "$n_anon" -gt 1 ] && return 1; ANON_KEY=$v ;;
      SERVICE_ROLE_KEY) n_srk=$((n_srk+1));  [ "$n_srk"  -gt 1 ] && return 1; SERVICE_ROLE_KEY=$v ;;
      *) : ;;                                             # well-formed non-whitelisted line: ignore
    esac
  done < "$f"
  [ "$n_api" -eq 1 ] && [ "$n_db" -eq 1 ] && [ "$n_anon" -eq 1 ] && [ "$n_srk" -eq 1 ] || return 1
  [ -n "$API_URL" ] && [ -n "$DB_URL" ] && [ -n "$ANON_KEY" ] && [ -n "$SERVICE_ROLE_KEY" ] || return 1
  printf '%s' "$API_URL" | grep -qxE 'http://(127\.0\.0\.1|localhost):[0-9]+' || return 1
  printf '%s' "$DB_URL"  | grep -qxE 'postgresql://[^@ ]+@(127\.0\.0\.1|localhost):[0-9]+/[A-Za-z0-9_]+' || return 1
  printf '%s%s' "$API_URL" "$DB_URL" | grep -q 'fbieiotihlmpfzybowbt' && return 1
  printf '%s' "$ANON_KEY"         | grep -qxE '[A-Za-z0-9._-]{20,}' || return 1
  printf '%s' "$SERVICE_ROLE_KEY" | grep -qxE '[A-Za-z0-9._-]{20,}' || return 1
  return 0
}
b7_parse_status "$STATUS_RAW" || fail "status parse/validation"

# ── 7. Secret-safe artifacts (0600) ─────────────────────────────────────────
( umask 077
  printf 'NEXT_PUBLIC_SUPABASE_URL=%s\n'      "$API_URL"          >  "$RUNDIR/.env.b7-4"
  printf 'NEXT_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$ANON_KEY"         >> "$RUNDIR/.env.b7-4"
  printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n'     "$SERVICE_ROLE_KEY" >> "$RUNDIR/.env.b7-4"
  printf '%s\n' "$DB_URL" > "$RUNDIR/.db-url"
)
chmod 0600 "$RUNDIR/.env.b7-4" "$RUNDIR/.db-url"
rm -f "$STATUS_RAW"                     # raw status (with keys) removed after 0600 artifacts written

# ── 8. Disposable password (24 crypto bytes -> base64url >=32) ──────────────
set +x                                  # xtrace OFF before secrets (belt-and-suspenders)
PW="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')"
[ "${#PW}" -ge 32 ] || fail "weak password"

# ── 9. Credentials artifact (env-only input; never argv) ────────────────────
B7_4_PASSWORD="$PW" B7_4_CREDENTIALS_PATH="$RUNDIR/.credentials" node -e '
  const fs = require("fs");
  const password = process.env.B7_4_PASSWORD;
  const path = process.env.B7_4_CREDENTIALS_PATH;
  if (!password || password.length < 32 || !path) process.exit(1);
  fs.writeFileSync(path, JSON.stringify({ email: "b7-4-verify@localhost.test", password }) + "\n",
    { mode: 0o600, flag: "wx" });
' || fail "write credentials"
chmod 0600 "$RUNDIR/.credentials"

# ── 10. Create the disposable Auth user via the LOCAL service-role client ────
# Node resolves @supabase/supabase-js from the real repo; only three vars cross in;
# only the created UUID is emitted; no URL/key/password in errors.
VUSER="$(
  cd "$REPO" && \
  env -i PATH="$PATH" \
    LOCAL_API_URL="$API_URL" LOCAL_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" B7_4_PASSWORD="$PW" \
    node -e '
      const { createClient } = require("@supabase/supabase-js");
      (async () => {
        try {
          const sb = createClient(process.env.LOCAL_API_URL, process.env.LOCAL_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } });
          const { data, error } = await sb.auth.admin.createUser({
            email: "b7-4-verify@localhost.test",
            password: process.env.B7_4_PASSWORD,
            email_confirm: true,
          });
          if (error || !data || !data.user || !data.user.id) { process.stderr.write("AUTH_CREATE_FAILED\n"); process.exit(1); }
          process.stdout.write(data.user.id);
        } catch (_e) { process.stderr.write("AUTH_CREATE_EXCEPTION\n"); process.exit(1); }
      })();
    '
)" || fail "auth createUser"
[[ "$VUSER" =~ $UUID_RE ]] || fail "auth UUID malformed"

# ── 11. Persist the UUID (no reliance on an inherited variable later) ───────
[ -e "$RUNDIR/.vuser" ] && fail ".vuser already exists"
( set -o noclobber; printf '%s\n' "$VUSER" > "$RUNDIR/.vuser" ) || fail "write .vuser"
chmod 0600 "$RUNDIR/.vuser"
grep -qixE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$RUNDIR/.vuser" || fail ".vuser validation"

# ── 12. Apply the tenant seed against the disposable loopback DB ────────────
psql "$(cat "$RUNDIR/.db-url")" -v ON_ERROR_STOP=1 -v vuser="$(cat "$RUNDIR/.vuser")" \
  -f "$TEMPLATE_DIR/seed.sql" || fail "seed.sql"

# ── 13. Sequence snapshot AFTER seed, BEFORE the UI app starts ──────────────
psql "$(cat "$RUNDIR/.db-url")" -v ON_ERROR_STOP=1 -tA -q -c \
"SELECT coalesce((SELECT current_number FROM public.document_sequences \
  WHERE dealer_id='$ACTOR_DEALER'::uuid AND sequence_type='estimate' AND fiscal_year=0), 0)::bigint;" \
  > "$EVID/seq-before-ui.txt" || fail "seq snapshot"
grep -qxE '[0-9]+' "$EVID/seq-before-ui.txt" || fail "seq-before-ui not a single unsigned integer"
[ "$(wc -l < "$EVID/seq-before-ui.txt")" -eq 1 ] || fail "seq-before-ui not exactly one line"

# ── 14. Non-secret handoff ──────────────────────────────────────────────────
printf 'RUNDIR=%s\nEVID=%s\nPROJECT_ID=%s\n' "$RUNDIR" "$EVID" "$PROJECT_ID" | tee "$EVID/handoff.txt"
chmod 0600 "$EVID/handoff.txt"
printf 'B7-4 setup complete.\n  RUNDIR=%s\n  EVID=%s\n' "$RUNDIR" "$EVID"
printf 'Next: read %s/.credentials, then run-app.sh "%s" "%s"\n' "$RUNDIR" "$RUNDIR" "$EVID"
