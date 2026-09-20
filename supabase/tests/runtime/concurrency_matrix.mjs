/**
 * R4Q-R12 external concurrency proof harness.
 *
 * CANDIDATE: this file is static evidence until a separately approved fresh
 * disposable-local runtime executes it exactly once after the full migration
 * replay and pgTAP package pass. It refuses non-loopback databases and requires
 * an explicit disposable confirmation. It never connects to a linked project.
 *
 * Protocol per family:
 *   - two independent OS `psql` processes, hence two libpq connections;
 *   - distinct backend PIDs observed by a third connection in pg_stat_activity;
 *   - a fixed five-second barrier before each collision statement;
 *   - independent result, SQLSTATE, submit time, and completion time capture;
 *   - one invariant query from the third connection;
 *   - one attempt only; any mismatch exits non-zero and is never retried.
 */

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXPECTED_FAMILIES = 7;
const DISPOSABLE_CONFIRM = 'R12F_DISPOSABLE_LOCAL_ONLY';
const contractSource = readFileSync(
  new URL('../concurrency_matrix.test.sql', import.meta.url), 'utf8');
const contractFamilies = [...contractSource.matchAll(
  /^  \('([^']+)', '(?:function|table)',/gm)].map((match) => match[1]);
if (contractFamilies.length !== EXPECTED_FAMILIES) {
  throw new Error(`contract family count mismatch: ${contractFamilies.length}`);
}
if (!contractSource.includes("status IN (''processing'',''sent'')")) {
  throw new Error('queue contract is not the catalog-valid processing|sent invariant');
}

if (process.env.R12F_DISPOSABLE_CONFIRM !== DISPOSABLE_CONFIRM) {
  throw new Error(`set R12F_DISPOSABLE_CONFIRM=${DISPOSABLE_CONFIRM}`);
}

function parseStatusEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const local = parseStatusEnv(execFileSync('supabase', ['status', '-o', 'env'], {
  encoding: 'utf8',
  env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
}));
const DB_URL = process.env.R12F_DB_URL || local.DB_URL
  || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const parsedDbUrl = new URL(DB_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedDbUrl.hostname)) {
  throw new Error(`refusing non-loopback database host: ${parsedDbUrl.hostname}`);
}

const IDS = Object.freeze({
  dealer: 'c5100000-0000-4000-8000-000000000001',
  actor: 'c5100000-0000-4000-8000-000000000002',
  customer: 'c5100000-0000-4000-8000-000000000003',
  invoice: 'c5100000-0000-4000-8000-000000000004',
  product: 'c5100000-0000-4000-8000-000000000005',
  queue: 'c5100000-0000-4000-8000-000000000006',
});

const payload = {
  idempotencyKey: 'r12f-concurrency-estimate-0001',
  customer: {
    mode: 'new', name: 'R12F Concurrent Customer', phone: '090-0000-0000',
    email: 'r12f-concurrency@example.test', postalCode: '1000001', address: 'Tokyo',
    lineId: '', isBusiness: false, tradeRatePercent: null,
    accountsReceivableAllowed: false, closingDay: null, paymentDay: null,
  },
  vehicle: {
    mode: 'new', maker: 'TOYOTA', model: 'CROWN', grade: '', vehicleCode: '', vin: '',
    firstRegistration: '', registrationDate: '', inspectionExpiry: '', displacement: '',
    color: '', plateNumber: '', bodySizeKey: 'M',
  },
  services: [{
    lineId: 'manual:maintenance:r12f', category: 'maintenance', wizardCategory: 'maintenance',
    pricingSource: 'manual', pricingReferenceId: null,
    manualPricingIdentity: 'maintenance:r12f', pricingPolicy: 'manual_only',
    manualPricePolicy: 'required', label: 'R12F maintenance', description: null,
    quantity: 1, unitPrice: 5000, lineTotal: 5000,
    optionReferenceIds: [], lineMetadata: {},
  }],
  nonPriceableSelections: [],
  discountIntent: { mode: 'none', fixedAmount: null, percentage: null, percentageSupported: false },
  discountAppliedAmount: null,
  couponIntent: { selectedCouponIds: [], status: 'none' },
  couponAppliedAmount: null,
  pricingSnapshot: {
    currency: 'JPY', completeness: 'complete', subtotal: 5000, discountTotal: 0,
    couponTotal: 0, taxableSubtotal: 5000, taxRatePercent: 10, taxTotal: 500,
    grandTotal: 5500, warnings: [], errors: [],
  },
  notes: { customerNotes: '', internalMemo: '' },
  metadata: {
    source: 'estimate-wizard-v2.2', schemaVersion: '2.2', createdFromWizard: true,
    draftLastUpdatedAt: '2026-08-15T00:00:00.000Z', previewConfirmed: true,
  },
};

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runPsql(sql) {
  return execFileSync('psql', [
    '--dbname', DB_URL, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
  ], { input: sql, encoding: 'utf8' }).trim();
}

const fixtureSql = `
DO $guard$
BEGIN
  IF to_regnamespace('r12f_runtime') IS NOT NULL THEN
    RAISE EXCEPTION 'r12f_runtime_already_exists_no_retry';
  END IF;
END $guard$;

CREATE SCHEMA r12f_runtime;

CREATE FUNCTION r12f_runtime.capture(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $capture$
DECLARE
  v_result jsonb;
  v_submit timestamptz := clock_timestamp();
BEGIN
  BEGIN
    EXECUTE p_sql INTO v_result;
    RETURN jsonb_build_object(
      'ok', true,
      'sqlstate', '00000',
      't_submit', v_submit,
      't_complete', clock_timestamp(),
      'result', v_result
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'sqlstate', SQLSTATE,
      'message', SQLERRM,
      't_submit', v_submit,
      't_complete', clock_timestamp(),
      'result', null
    );
  END;
END $capture$;

REVOKE ALL ON SCHEMA r12f_runtime FROM PUBLIC;
REVOKE ALL ON FUNCTION r12f_runtime.capture(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA r12f_runtime TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION r12f_runtime.capture(text) TO authenticated, service_role;

INSERT INTO auth.users (id, email)
VALUES ('${IDS.actor}', 'r12f-concurrency-owner@example.test');

INSERT INTO public.dealers
  (id, name, status, approval_status, owner_user_id, product_mode, detailer_rank)
VALUES
  ('${IDS.dealer}', 'R12F Concurrency Dealer', 'active', 'approved',
   '${IDS.actor}', 'gyeon', 'detailer');

INSERT INTO public.dealer_members (dealer_id, user_id, role, status)
VALUES ('${IDS.dealer}', '${IDS.actor}', 'owner', 'active');

INSERT INTO public.dealer_settings
  (dealer_id, business_name, dealer_closing_day, dealer_payment_day)
VALUES ('${IDS.dealer}', 'R12F Concurrency Dealer', 20, 25);

UPDATE public.dealer_wizard_catalog_lifecycle
   SET state = 'MIGRATED_UNREVIEWED',
       current_configuration_revision = 1,
       reviewed_configuration_revision = NULL,
       reviewed_at = NULL,
       reviewed_by = NULL
 WHERE dealer_id = '${IDS.dealer}';

INSERT INTO public.customers (id, dealer_id, name)
VALUES ('${IDS.customer}', '${IDS.dealer}', 'R12F Billing Customer');

SET session_replication_role = replica;
INSERT INTO public.invoices
  (id, dealer_id, customer_id, invoice_number, status, delivery_date,
   subtotal, discount_amount, tax_rate, tax_amount, total, paid_amount, balance_due)
VALUES
  ('${IDS.invoice}', '${IDS.dealer}', '${IDS.customer}', 'R12F-INV-0001',
   'issued', DATE '2026-08-10', 1000, 0, 10, 100, 1100, 0, 1100);
SET session_replication_role = origin;

INSERT INTO public.gyeon_products (id, sku, product_name, units_per_case)
VALUES ('${IDS.product}', 'R12F-CONCURRENCY-SKU', 'R12F Product', 1);

INSERT INTO public.dealer_stock_levels
  (dealer_id, product_id, case_count, loose_count, units_per_case_used, total_quantity)
VALUES ('${IDS.dealer}', '${IDS.product}', 0, 0, 1, 0);

INSERT INTO public.line_notification_queue
  (id, dealer_id, scheduled_at, message_type, purpose, body, status)
VALUES
  ('${IDS.queue}', '${IDS.dealer}', now(), 'text', 'system',
   'R12F disposable concurrency fixture', 'scheduled');

SELECT 'R12F_FIXTURE_OK';
`;

if (!runPsql(fixtureSql).includes('R12F_FIXTURE_OK')) {
  throw new Error('fixture setup did not complete');
}

function spawnClient(family, side, preamble, dynamicSql) {
  const script = `${preamble}
SELECT 'READY|' || pg_backend_pid()::text || '|' || clock_timestamp()::text;
SELECT pg_sleep(5);
SELECT 'RESULT|' || r12f_runtime.capture(${sqlLiteral(dynamicSql)})::text;
`;
  const child = spawn('psql', [
    '--dbname', DB_URL, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  let readyResolved = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    const line = stdout.split(/\r?\n/).find((value) => value.startsWith('READY|'));
    if (line && !readyResolved) {
      readyResolved = true;
      const [, pid, readyAt] = line.split('|');
      resolveReady({ pid: Number(pid), readyAt });
    }
  });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (error) => {
    if (!readyResolved) rejectReady(error);
  });

  const done = new Promise((resolve, reject) => {
    child.on('close', (code, signal) => {
      if (!readyResolved) {
        rejectReady(new Error(`${family}/${side} exited before READY: ${stderr}`));
      }
      if (code !== 0 || signal) {
        reject(new Error(`${family}/${side} psql failed code=${code} signal=${signal}: ${stderr}`));
        return;
      }
      const resultLine = stdout.split(/\r?\n/).find((value) => value.startsWith('RESULT|'));
      if (!resultLine) {
        reject(new Error(`${family}/${side} produced no RESULT: ${stdout}`));
        return;
      }
      resolve(JSON.parse(resultLine.slice('RESULT|'.length)));
    });
  });

  child.stdin.end(script);
  return { ready, done };
}

function asMillis(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid evidence timestamp: ${value}`);
  return parsed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireSuccess(family, side, capture) {
  assert(capture?.ok === true, `${family}/${side} failed: ${JSON.stringify(capture)}`);
  assert(capture.sqlstate === '00000', `${family}/${side} SQLSTATE=${capture.sqlstate}`);
  assert(capture.t_submit && capture.t_complete, `${family}/${side} missing timestamps`);
}

async function runFamily({ family, preambleA, preambleB, sqlA, sqlB, invariantSql, verify }) {
  const c1 = spawnClient(family, 'C1', preambleA, sqlA);
  const c2 = spawnClient(family, 'C2', preambleB, sqlB);
  const [ready1, ready2] = await Promise.all([c1.ready, c2.ready]);

  assert(Number.isInteger(ready1.pid) && Number.isInteger(ready2.pid), `${family}: invalid backend PID`);
  assert(ready1.pid !== ready2.pid, `${family}: backend PIDs are not distinct`);
  const activeCount = Number(runPsql(`
    SELECT count(*) FROM pg_stat_activity
     WHERE pid IN (${ready1.pid}, ${ready2.pid}) AND datname = current_database();
  `));
  assert(activeCount === 2, `${family}: pg_stat_activity saw ${activeCount}/2 clients`);

  const [result1, result2] = await Promise.all([c1.done, c2.done]);
  requireSuccess(family, 'C1', result1);
  requireSuccess(family, 'C2', result2);
  assert(Math.abs(asMillis(result1.t_submit) - asMillis(result2.t_submit)) <= 1000,
    `${family}: collision submissions were more than one second apart`);
  const invariant = runPsql(invariantSql);
  verify(result1, result2, invariant);

  const evidence = {
    family,
    pid_1: ready1.pid,
    pid_2: ready2.pid,
    t1_submit: result1.t_submit,
    t2_submit: result2.t_submit,
    t_complete_1: result1.t_complete,
    t_complete_2: result2.t_complete,
    sqlstate_1: result1.sqlstate,
    sqlstate_2: result2.sqlstate,
    result_1: result1.result,
    result_2: result2.result,
    invariant,
  };
  console.log(JSON.stringify(evidence));
  return evidence;
}

const authPreamble = `
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '${IDS.actor}', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
`;
const servicePreamble = 'SET ROLE service_role;';
const postgresPreamble = '';
const results = [];

const estimateSql = `
  SELECT jsonb_build_object(
    'estimate_id', r->>'estimate_id',
    'idempotent_replay', (r->>'idempotent_replay')::boolean)
  FROM (SELECT public.save_estimate_from_wizard(
    '${IDS.dealer}'::uuid,
    '${IDS.actor}'::uuid,
    ${sqlLiteral(JSON.stringify(payload))}::jsonb) AS r) q
`;
results.push(await runFamily({
  family: 'atomic_idempotent_estimate_and_invoice_saves',
  preambleA: servicePreamble,
  preambleB: servicePreamble,
  sqlA: estimateSql,
  sqlB: estimateSql,
  invariantSql: `SELECT jsonb_build_object('count', count(*), 'ids', jsonb_agg(id ORDER BY id))
                   FROM public.estimates
                  WHERE dealer_id='${IDS.dealer}' AND idempotency_key='r12f-concurrency-estimate-0001';`,
  verify: (a, b, invariant) => {
    const ids = [a.result.estimate_id, b.result.estimate_id];
    const replays = [a.result.idempotent_replay, b.result.idempotent_replay].sort();
    assert(ids[0] && ids[0] === ids[1], 'estimate family did not return one canonical identity');
    assert(JSON.stringify(replays) === JSON.stringify([false, true]),
      `estimate family replay outcomes invalid: ${JSON.stringify(replays)}`);
    assert(JSON.parse(invariant).count === 1, `estimate invariant failed: ${invariant}`);
  },
}));

const numberingSql = `
  SELECT to_jsonb(public.get_next_document_number(
    '${IDS.dealer}'::uuid, 'work_order', 202608, 'R12', 5, 'never'))
`;
results.push(await runFamily({
  family: 'document_numbering',
  preambleA: authPreamble,
  preambleB: authPreamble,
  sqlA: numberingSql,
  sqlB: numberingSql,
  invariantSql: `SELECT current_number FROM public.document_sequences
                   WHERE dealer_id='${IDS.dealer}' AND sequence_type='work_order' AND fiscal_year=202608;`,
  verify: (a, b, invariant) => {
    const numbers = [Number(a.result), Number(b.result)].sort((x, y) => x - y);
    assert(JSON.stringify(numbers) === JSON.stringify([1, 2]),
      `document numbering outcomes invalid: ${JSON.stringify(numbers)}`);
    assert(Number(invariant) === 2, `document numbering invariant failed: ${invariant}`);
  },
}));

const paymentSql = `
  SELECT jsonb_build_object('id', (p).id, 'amount', (p).amount)
  FROM (SELECT public.record_payment_with_allocations_rpc(
    '${IDS.dealer}'::uuid, '${IDS.actor}'::uuid, 'unapplied', NULL,
    '${IDS.customer}'::uuid, 100, 0, 100, DATE '2026-08-15', 'cash', 'completed',
    'R12F-PAY-0001', 'R12F', 'concurrency proof', NULL,
    'r12f-payment-idempotency-0001', '[]'::jsonb) AS p) q
`;
results.push(await runFamily({
  family: 'payment_recording_allocation_conversion',
  preambleA: servicePreamble,
  preambleB: servicePreamble,
  sqlA: paymentSql,
  sqlB: paymentSql,
  invariantSql: `SELECT jsonb_build_object('count', count(*), 'amount', max(amount))
                   FROM public.payments
                  WHERE dealer_id='${IDS.dealer}' AND idempotency_key='r12f-payment-idempotency-0001';`,
  verify: (a, b, invariant) => {
    assert(a.result.id && a.result.id === b.result.id,
      'payment family did not return one canonical payment identity');
    const state = JSON.parse(invariant);
    assert(state.count === 1 && Number(state.amount) === 100,
      `payment invariant failed: ${invariant}`);
  },
}));

const statementSql = `
  SELECT jsonb_build_object('id', (s).id, 'status', (s).status)
  FROM (SELECT public.create_monthly_statement_draft_rpc(
    '${IDS.dealer}'::uuid, '${IDS.actor}'::uuid, '${IDS.customer}'::uuid,
    DATE '2026-08-15') AS s) q
`;
results.push(await runFamily({
  family: 'monthly_statement_create_issue_pdf_attach',
  preambleA: authPreamble,
  preambleB: authPreamble,
  sqlA: statementSql,
  sqlB: statementSql,
  invariantSql: `SELECT jsonb_build_object('count', count(*), 'ids', jsonb_agg(id ORDER BY id))
                   FROM public.monthly_statements
                  WHERE dealer_id='${IDS.dealer}' AND customer_id='${IDS.customer}'
                    AND period_start=DATE '2026-07-21' AND period_end=DATE '2026-08-20';`,
  verify: (a, b, invariant) => {
    assert(a.result.id && a.result.id === b.result.id,
      'monthly statement family did not return one canonical statement identity');
    assert(a.result.status === 'draft' && b.result.status === 'draft',
      'monthly statement family returned a non-draft status');
    assert(JSON.parse(invariant).count === 1, `monthly statement invariant failed: ${invariant}`);
  },
}));

const reviewSql = `
  SELECT public.wiz_confirm_catalog_review('${IDS.dealer}'::uuid)
`;
results.push(await runFamily({
  family: 'wizard_catalog_review_upserts_archive',
  preambleA: authPreamble,
  preambleB: authPreamble,
  sqlA: reviewSql,
  sqlB: reviewSql,
  invariantSql: `SELECT jsonb_build_object('count', count(*), 'state', max(state),
                    'revision', max(reviewed_configuration_revision))
                   FROM public.dealer_wizard_catalog_lifecycle
                  WHERE dealer_id='${IDS.dealer}';`,
  verify: (a, b, invariant) => {
    assert(a.result.state === 'CATALOG_REVIEWED' && b.result.state === 'CATALOG_REVIEWED',
      'catalog review family returned an unexpected state');
    assert(Number(a.result.reviewed_revision) === 1 && Number(b.result.reviewed_revision) === 1,
      'catalog review family returned divergent revisions');
    const state = JSON.parse(invariant);
    assert(state.count === 1 && state.state === 'CATALOG_REVIEWED' && Number(state.revision) === 1,
      `catalog review invariant failed: ${invariant}`);
  },
}));

const queueSql = `
  WITH claimed AS (
    UPDATE public.line_notification_queue
       SET status='processing', attempts=attempts+1, last_attempt_at=clock_timestamp()
     WHERE id='${IDS.queue}'::uuid AND status='scheduled'
     RETURNING id)
  SELECT jsonb_build_object('rows_affected', count(*)) FROM claimed
`;
results.push(await runFamily({
  family: 'notification_line_queues',
  preambleA: servicePreamble,
  preambleB: servicePreamble,
  sqlA: queueSql,
  sqlB: queueSql,
  invariantSql: `SELECT jsonb_build_object('count', count(*), 'status', max(status),
                    'attempts', max(attempts))
                   FROM public.line_notification_queue
                  WHERE id='${IDS.queue}' AND status IN ('processing','sent');`,
  verify: (a, b, invariant) => {
    const affected = [Number(a.result.rows_affected), Number(b.result.rows_affected)].sort();
    assert(JSON.stringify(affected) === JSON.stringify([0, 1]),
      `queue claim outcomes invalid: ${JSON.stringify(affected)}`);
    const state = JSON.parse(invariant);
    assert(state.count === 1 && state.status === 'processing' && Number(state.attempts) === 1,
      `queue invariant failed: ${invariant}`);
  },
}));

function inventorySql(delta, note) {
  return `
    WITH receipt AS (
      INSERT INTO public.inventory_receipts
        (dealer_id, product_id, case_count, loose_count, units_per_case_snapshot,
         total_quantity, received_by, note)
      VALUES ('${IDS.dealer}'::uuid, '${IDS.product}'::uuid, 0, ${delta}, 1,
              ${delta}, '${IDS.actor}'::uuid, ${sqlLiteral(note)})
      RETURNING id),
    level AS (
      UPDATE public.dealer_stock_levels
         SET loose_count=loose_count+${delta}, total_quantity=total_quantity+${delta}
       WHERE dealer_id='${IDS.dealer}'::uuid AND product_id='${IDS.product}'::uuid
       RETURNING total_quantity)
    SELECT jsonb_build_object(
      'receipt_rows', (SELECT count(*) FROM receipt),
      'total_quantity_after', (SELECT total_quantity FROM level),
      'delta', ${delta})
  `;
}
results.push(await runFamily({
  family: 'inventory_order_fulfillment_writes',
  preambleA: servicePreamble,
  preambleB: servicePreamble,
  sqlA: inventorySql(7, 'R12F-C1'),
  sqlB: inventorySql(11, 'R12F-C2'),
  invariantSql: `SELECT jsonb_build_object(
                    'total_quantity', max(total_quantity),
                    'loose_count', max(loose_count),
                    'receipt_count', (SELECT count(*) FROM public.inventory_receipts
                       WHERE dealer_id='${IDS.dealer}' AND product_id='${IDS.product}'))
                   FROM public.dealer_stock_levels
                  WHERE dealer_id='${IDS.dealer}' AND product_id='${IDS.product}';`,
  verify: (a, b, invariant) => {
    assert(Number(a.result.receipt_rows) === 1 && Number(b.result.receipt_rows) === 1,
      'inventory family did not persist exactly two receipt ledgers');
    const state = JSON.parse(invariant);
    assert(Number(state.total_quantity) === 18 && Number(state.loose_count) === 18
      && Number(state.receipt_count) === 2, `inventory invariant failed: ${invariant}`);
  },
}));

assert(results.length === EXPECTED_FAMILIES,
  `family plan mismatch: planned=${EXPECTED_FAMILIES} ran=${results.length}`);
assert(JSON.stringify(results.map((result) => result.family)) === JSON.stringify(contractFamilies),
  'runtime family order does not exactly match the pgTAP contract inventory');
console.log(`RESULT: PASS families=${results.length} attempts_per_family=1 retries=0`);
