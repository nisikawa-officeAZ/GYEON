-- ============================================================================
-- GDA-1W-C3 — two-connection concurrency harness, SESSION A (the winner).
--
-- STATUS: SOURCE CANDIDATE — WRITTEN ONLY. Executed only by the separately
--         authorized disposable-DB verification phase via run-concurrency.sh,
--         NEVER against the linked, staging, or production stack.
--
-- THE RACES UNDER PROOF (contract §6 / §10.2) — this session script is
-- parameterized and serves BOTH required races; the runner supplies the keys:
--   RACE 1 (same key):        both sessions share ONE idempotency key and one
--                             identical payload on the same work order.
--   RACE 2 (different keys):  each session holds its OWN key with the same
--                             identical payload on the same work order.
-- In both races exactly one session commits `created`; the other must return
-- the SAME canonical result as `replayed` (race 2 additionally appends one
-- immutable alias ledger row). Sequential calls in one session do not count
-- as concurrency evidence.
--
-- DETERMINISM (no sleep-and-hope):
--   1. A opens a transaction and takes the work-order row lock FOR UPDATE —
--      the SAME first lock object, in the SAME order, as the RPC itself
--      (§5.5 position 1), so the function's lock order is not weakened: when
--      A then calls the RPC inside this transaction it re-locks a row this
--      transaction already holds.
--   2. A then WAITS, bounded, until it OBSERVES session B blocked on a lock
--      with B's advertised application_name (a pg_stat_activity barrier).
--      Only then does A execute the RPC and commit. B is therefore proven to
--      have been concurrently inside its own RPC call before A's commit.
--   3. A also holds a transaction-level advisory marker lock so the runner
--      and B can assert A's transaction really was open first.
--
-- REQUIRED psql VARIABLES (supplied by run-concurrency.sh; no defaults):
--   :wo_id     — work order uuid (fixture created by the runner)
--   :actor_id  — authenticated actor uuid (active dealer_staff of the dealer)
--   :idem_key  — THIS session's idempotency key (16-128 chars; equal to B's
--                key in race 1, distinct from B's key in race 2)
--   :end_at    — the shared actual end instant (ISO-8601 text, both sessions)
--   :items     — the shared performed-items JSON array text (both sessions)
--   :b_appname — application_name session B advertises (barrier target)
--
-- EVIDENCE: exactly one machine-parseable line on stdout:
--   GDA1W-C3-CONC|A|{"work_order_id":...,"outcome":"created",...}
-- ============================================================================

-- Fail-fast, machine-parseable output.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on

SET application_name = 'gda1w-c3-conc-a';
SET statement_timeout = '20s';
SET lock_timeout = '15s';

-- Session-local result holder (survives COMMIT, dies with the connection).
CREATE TEMP TABLE conc_a_result (
  work_order_id          uuid,
  completion_report_id   uuid,
  report_number          text,
  performed_work_version integer,
  request_fingerprint    text,
  outcome                text,
  created                boolean,
  replayed               boolean
);
GRANT INSERT ON conc_a_result TO authenticated;

BEGIN;

-- Authenticated execution context, LOCAL to this transaction. The RPC derives
-- identity ONLY from auth.uid(); nothing else is impersonated.
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', :'actor_id', 'role', 'authenticated')::text,
                  true);

-- Marker: A's transaction is open. Transaction-scoped; auto-released on commit.
SELECT pg_advisory_xact_lock(hashtextextended('gda1w-c3-conc:a-open', 0));

-- §5.5 position 1: the work-order row, FOR UPDATE, before anything else.
-- This is the identical first lock the RPC takes, so ordering is preserved.
SELECT id FROM public.work_orders WHERE id = :'wo_id'::uuid FOR UPDATE;

-- Bridge the runner-supplied psql variable into a transaction-local GUC so
-- the barrier's plpgsql block can read it.
SELECT set_config('gda1w.b_appname', :'b_appname', true);

-- ── Deterministic barrier: proceed ONLY once B is genuinely blocked. ──
-- B connects, advertises :b_appname, and calls the RPC; its FOR UPDATE on the
-- same work-order row must WAIT on this transaction. We observe that wait in
-- pg_stat_activity (wait_event_type = 'Lock'), bounded at ~10s, and fail fast
-- otherwise — a barrier timeout means NO concurrency was proven and the run
-- is evidence of nothing.
DO $barrier$
DECLARE
  v_tries integer := 0;
BEGIN
  LOOP
    EXIT WHEN EXISTS (
      SELECT 1 FROM pg_stat_activity
       WHERE application_name = current_setting('gda1w.b_appname', true)
         AND wait_event_type = 'Lock'
         AND state = 'active'
    );
    v_tries := v_tries + 1;
    IF v_tries > 200 THEN
      RAISE EXCEPTION 'GDA1W-C3-CONC BARRIER TIMEOUT: session B never blocked; no concurrency was proven';
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
END
$barrier$;

-- The winning call: executed while B is PROVEN to be waiting on the same row.
-- The RPC re-acquires the row lock this transaction already holds (same
-- object, same order), authorizes via auth.uid(), and performs the atomic
-- completion. Role is switched only for the call itself.
SELECT set_config('role', 'authenticated', true);
INSERT INTO conc_a_result
SELECT * FROM public.complete_work_order_v1(
  :'wo_id'::uuid,
  :'idem_key',
  :'end_at'::timestamptz,
  :'items'::jsonb
);
RESET role;

COMMIT;
-- The commit releases the row lock; B's blocked RPC now resumes, finds the
-- committed request row for the SAME (dealer, key, fingerprint), and must
-- return the identical canonical result as `replayed`.

-- ── Machine-parseable evidence (exactly one line). ──
SELECT 'GDA1W-C3-CONC|A|' || row_to_json(r)::text FROM conc_a_result r;

-- Post-conditions asserted session-locally, fail-fast: A must be the single
-- `created` outcome with a canonical report number and version 1.
DO $verify$
DECLARE
  v conc_a_result%ROWTYPE;
BEGIN
  SELECT * INTO v FROM conc_a_result;
  IF v.outcome IS DISTINCT FROM 'created'
     OR v.created IS DISTINCT FROM true
     OR v.replayed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC A FAILED: expected the winning created outcome, got %', v.outcome;
  END IF;
  IF v.report_number IS NULL OR btrim(v.report_number) = '' THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC A FAILED: created without a canonical report number';
  END IF;
  IF v.performed_work_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC A FAILED: first completion must be snapshot version 1';
  END IF;
  IF v.request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'GDA1W-C3-CONC A FAILED: fingerprint is not lowercase 64-hex';
  END IF;
END
$verify$;
