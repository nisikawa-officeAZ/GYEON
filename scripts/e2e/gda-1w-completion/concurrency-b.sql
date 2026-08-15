-- ============================================================================
-- GDA-1W-C3 — two-connection concurrency harness, SESSION B (the replayed loser).
--
-- STATUS: SOURCE CANDIDATE — WRITTEN ONLY. Executed only by the separately
--         authorized disposable-DB verification phase via run-concurrency.sh,
--         NEVER against the linked, staging, or production stack.
--
-- ROLE IN THE RACES (contract §6 / §10.2): B is a GENUINE second connection
-- calling public.complete_work_order_v1 with the SAME dealer, work order, and
-- payload as session A — sharing A's idempotency key in RACE 1 (same-key) or
-- holding its OWN key in RACE 2 (different-key/same-work-order). B must:
--   1. wait until A's transaction is PROVEN open (A's advisory marker lock is
--      visible as granted in pg_locks) — so B can never sneak in first;
--   2. invoke the RPC, which BLOCKS on the work-order row lock A holds
--      (§5.5 position 1 — the natural lock order, not weakened here) while A
--      observes this very wait through its pg_stat_activity barrier and only
--      then commits `created`;
--   3. resume after A's commit and receive the IDENTICAL canonical result as
--      `outcome = 'replayed'` — with zero additional writes in race 1, or
--      with exactly one immutable ALIAS ledger row appended in race 2
--      (different key, identical authoritative fingerprint; §6 row 4).
--
-- Cross-session identity comparison (A.report ids/number/fingerprint equal
-- B's) belongs to the RUNNER, which parses both evidence lines; B never reads
-- A's temp table and asserts only its own session-local post-conditions.
--
-- REQUIRED psql VARIABLES (supplied by run-concurrency.sh; no defaults):
--   :wo_id     — work order uuid (same fixture as A)
--   :actor_id  — authenticated actor uuid (active dealer_staff of the dealer;
--                may equal or differ from A's actor — both are authorized)
--   :idem_key  — THIS session's idempotency key (identical to A's in race 1;
--                B's own distinct key in race 2)
--   :end_at    — the shared actual end instant (identical to A's)
--   :items     — the shared performed-items JSON array text (identical to A's)
--   :b_appname — application_name THIS session advertises; must be the same
--                value the runner passed to A, because A's barrier watches
--                pg_stat_activity for exactly this name in a Lock wait.
--
-- EVIDENCE: exactly one machine-parseable line on stdout:
--   GDA1W-C3-CONC|B|{"work_order_id":...,"outcome":"replayed",...}
-- ============================================================================

-- Fail-fast, machine-parseable output.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on

-- Advertise the name A's barrier is watching for.
SELECT set_config('application_name', :'b_appname', false);
-- lock_timeout must comfortably exceed A's barrier-poll + RPC time: B is
-- SUPPOSED to wait on the row lock; timing out here would abort the proof.
SET statement_timeout = '30s';
SET lock_timeout = '25s';

-- Session-local result holder (B's own; A's temp table is unreachable by design).
CREATE TEMP TABLE conc_b_result (
  work_order_id          uuid,
  completion_report_id   uuid,
  report_number          text,
  performed_work_version integer,
  request_fingerprint    text,
  outcome                text,
  created                boolean,
  replayed               boolean
);
GRANT INSERT ON conc_b_result TO authenticated;

-- ── Deterministic start gate: proceed ONLY once A's transaction is open. ──
-- A holds pg_advisory_xact_lock(hashtextextended('gda1w-c3-conc:a-open', 0))
-- for the whole winning transaction. B polls pg_locks (bounded, ~10s) until
-- that 64-bit advisory key is visible as GRANTED to another backend, so B's
-- RPC call provably starts while A's transaction is in progress.
DO $gate$
DECLARE
  v_key   bigint := hashtextextended('gda1w-c3-conc:a-open', 0);
  v_tries integer := 0;
BEGIN
  LOOP
    EXIT WHEN EXISTS (
      SELECT 1 FROM pg_locks
       WHERE locktype = 'advisory'
         AND granted
         AND pid <> pg_backend_pid()
         AND ((classid::bigint << 32) | objid::bigint) = v_key
    );
    v_tries := v_tries + 1;
    IF v_tries > 200 THEN
      RAISE EXCEPTION 'GDA1W-C3-CONC START-GATE TIMEOUT: session A''s transaction never opened; no concurrency was proven';
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
END
$gate$;

BEGIN;

-- Authenticated execution context, LOCAL to this transaction. Identity is
-- derived ONLY from auth.uid() inside the RPC.
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', :'actor_id', 'role', 'authenticated')::text,
                  true);

-- The racing call. This statement BLOCKS on the work-order row lock held by
-- session A (the RPC's own §5.5 position-1 FOR UPDATE — B takes no extra lock
-- of its own, so the function's deterministic lock order is untouched). A's
-- barrier watches this wait; after A commits `created`, this call resumes and
-- returns the canonical result as `replayed` — via the committed same-key
-- request row (race 1, zero writes) or via the identical-fingerprint alias
-- branch (race 2, one appended ledger row).
SELECT set_config('role', 'authenticated', true);
INSERT INTO conc_b_result
SELECT * FROM public.complete_work_order_v1(
  :'wo_id'::uuid,
  :'idem_key',
  :'end_at'::timestamptz,
  :'items'::jsonb
);
RESET role;

COMMIT;

-- ── Machine-parseable evidence (exactly one line). ──
SELECT 'GDA1W-C3-CONC|B|' || row_to_json(r)::text FROM conc_b_result r;

-- Session-local post-conditions, fail-fast: B must be the zero-write replay
-- of a canonical result that is IDENTITY-COMPATIBLE with a winning creation —
-- same work order, a real report id/number, version 1, canonical fingerprint.
-- (Field-for-field equality with A's line is the runner's assertion.)
DO $verify$
DECLARE
  v conc_b_result%ROWTYPE;
BEGIN
  SELECT * INTO v FROM conc_b_result;
  IF v.outcome IS DISTINCT FROM 'replayed'
     OR v.created IS DISTINCT FROM false
     OR v.replayed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC B FAILED: expected the replayed outcome, got %', v.outcome;
  END IF;
  IF v.work_order_id IS NULL OR v.completion_report_id IS NULL THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC B FAILED: replay must return the canonical ids';
  END IF;
  IF v.report_number IS NULL OR btrim(v.report_number) = '' THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC B FAILED: replay must return the canonical report number';
  END IF;
  IF v.performed_work_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC B FAILED: replay of the first completion must be version 1';
  END IF;
  IF v.request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC B FAILED: fingerprint is not lowercase 64-hex';
  END IF;
END
$verify$;
