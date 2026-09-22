import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import ts from 'typescript';
import {calculateInvoiceTotals, lineTotal} from './invoice-types';
import {formatDocumentNumber, computeFiscalYear} from '../numbering/numbering-types';

const source = fs.readFileSync(new URL('./create-invoice.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../../supabase/migrations/20260913163712_atomic_estimate_invoice_conversion.sql', import.meta.url), 'utf8');
const dealer = 'a1111111-1111-4111-8111-111111111111';
const estimate = 'e1111111-1111-4111-8111-111111111111';
const invoice = 'f1111111-1111-4111-8111-111111111111';

function action(options: {outcome?: unknown; rpcError?: boolean; throws?: boolean; denied?: boolean; mismatch?: boolean} = {}) {
  const calls: unknown[] = [], logs: unknown[] = [];
  const modules: Record<string, unknown> = {
    '@/lib/supabase/server': {createClient: async () => ({
      from: () => { throw Error('split write/read forbidden'); },
      rpc: async (...args: unknown[]) => { calls.push(args); if (options.throws) throw Error('network');
        return {data: options.outcome ?? {outcome: 'existing', id: invoice}, error: options.rpcError ? {} : null}; },
    })},
    '@/lib/auth/get-current-dealer': {getCurrentDealer: async () => ({dealer_id: dealer})},
    '@/lib/auth/require-staff-capability': {requireStaffCapability: async (cap: string) => {
      assert.equal(cap, 'finance'); return options.denied ? {error: 'denied'} : {dealerId: options.mismatch ? invoice : dealer};
    }},
    '@/lib/numbering/get-next-document-number': {getNextDocumentNumber: () => {throw Error('guessed numbering');}},
    '@/lib/activity/activity-log': {createActivityLog: async (value: unknown) => {logs.push(value);}},
    '@/lib/dealer-settings/get-canonical-dealer-settings': {getCanonicalDealerSettings: async () => ({})},
    '@/lib/customer-billing/billing-terms': {resolveBillingTerms: () => ({}), resolveInvoiceDueDate: () => null},
    './invoice-types': {calculateInvoiceTotals, lineTotal},
    './invoice-delivery-date': {},
  };
  const exports: Record<string, (id: string) => Promise<Record<string, unknown>>> = {};
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled, {exports, require: (p: string) => {
    assert.ok(p in modules, `unexpected import ${p}`); return modules[p];
  }, Date, console});
  return {run: exports.createInvoiceFromEstimate, calls, logs};
}

test('other two creation functions remain byte-identical', () => {
  const original = source.slice(source.indexOf('export async function createInvoice(fd:'), source.indexOf('// One transactional'));
  assert.equal(createHash('sha256').update(original).digest('hex'), '1dee31e8fc0689e50ff596ddbbd47c15814487374af3150aa84e412557b811bb');
});
test('replay calls exactly one dealer-scoped RPC and never logs creation', async () => {
  const a = action(); assert.equal((await a.run(estimate)).id, invoice);
  assert.equal(a.calls.length, 1); assert.equal(a.logs.length, 0);
  const [name, params] = a.calls[0] as [string, Record<string, unknown>];
  assert.equal(name, 'create_invoice_from_estimate_atomic');
  assert.deepEqual(Object.keys(params).sort(), ['p_dealer_id', 'p_due_date', 'p_estimate_id', 'p_issue_date']);
  assert.equal(params.p_dealer_id, dealer); assert.equal(params.p_estimate_id, estimate);
});
test('created response logs once; finance/context/UUID failures do not call RPC', async () => {
  const a = action({outcome: {outcome: 'created', id: invoice, customer_id: null, estimate_number: null}});
  assert.equal((await a.run(estimate)).success, true); assert.equal(a.logs.length, 1);
  for (const opts of [{denied: true}, {mismatch: true}]) {
    const b = action(opts); assert.ok((await b.run(estimate)).error); assert.equal(b.calls.length, 0);
  }
  const b = action(); assert.ok((await b.run('not-a-uuid')).error); assert.equal(b.calls.length, 0);
});
test('malformed/unknown/failed results fail closed', async () => {
  for (const outcome of [{}, [], {outcome: 'created', id: invoice}, {outcome: 'existing', id: 'bad'},
    {outcome: 'conflict'}, {outcome: 'not-approved'}, {outcome: 'not-found'},
    {outcome: 'invalid-money'}, {outcome: 'numbering-conflict'}, {outcome: 'unknown', id: invoice}]) {
    const a = action({outcome}); assert.ok((await a.run(estimate)).error); assert.equal(a.logs.length, 0);
  }
  assert.ok((await action({rpcError: true}).run(estimate)).error);
  assert.ok((await action({throws: true}).run(estimate)).error);
});
test('SQL preserves invoker authorization and bounded creation without global cardinality', () => {
  assert.match(migration, /security invoker/i); assert.match(migration, /set search_path = ''/);
  assert.match(migration, /from public, anon, service_role/);
  assert.doesNotMatch(migration, /create\s+(?:unique\s+index|table)|security definer/i);
  assert.ok(migration.indexOf('into v_authorized') < migration.indexOf('for update'));
  assert.ok(migration.indexOf("'outcome', 'existing'") < migration.indexOf('v_next :='));
  assert.doesNotMatch(migration.slice(migration.indexOf('v_next :=')), /exception\s+when|return.*conflict/i);
});

// ── GDA-ESTIMATE-POST-TAX-ADJUSTMENT-R1: the forward-only post-tax replacement ──

const postTaxMigration = fs.readFileSync(new URL('../../../supabase/migrations/20260922090000_estimate_invoice_post_tax_adjustment.sql', import.meta.url), 'utf8');

test('post-tax migration replaces ONLY the conversion function with the ratified money block', () => {
  // Exactly one CREATE OR REPLACE of the conversion function, nothing else defined.
  assert.equal((postTaxMigration.match(/create or replace function/g) ?? []).length, 1);
  assert.match(postTaxMigration, /create or replace function public\.create_invoice_from_estimate_atomic\(/);
  // Ratified order: tax from the FULL subtotal → gross clamp → post-tax total.
  assert.match(postTaxMigration, /v_tax := floor\(v_subtotal \* v_tax_rate \/ 100::double precision\);/);
  assert.match(postTaxMigration, /v_x := least\(greatest\(0::double precision, v_discount\), v_subtotal \+ v_tax\);/);
  assert.match(postTaxMigration, /v_total := v_subtotal \+ v_tax - v_x;/);
  assert.ok(postTaxMigration.indexOf('v_tax := floor(v_subtotal') < postTaxMigration.indexOf('v_x := least('),
    'tax is computed before the discount clamp');
  // The pre-tax computation is gone from the effective definition.
  assert.doesNotMatch(postTaxMigration, /v_subtotal - least/);
  // Security, guards, authorization and grants are preserved verbatim.
  assert.match(postTaxMigration, /security invoker/i);
  assert.match(postTaxMigration, /set search_path = ''/);
  assert.match(postTaxMigration, /from public, anon, service_role/);
  assert.match(postTaxMigration, /grant execute on function public\.create_invoice_from_estimate_atomic\(uuid, uuid, date, date\)\s*\n\s*to authenticated/);
  assert.doesNotMatch(postTaxMigration, /security definer/i);
  assert.ok(postTaxMigration.indexOf('into v_authorized') < postTaxMigration.indexOf('for update'));
  assert.match(postTaxMigration, /9007199254740991/);
  assert.match(postTaxMigration, /'NaN', 'Infinity', '-Infinity'/);
  // Forward-only, definition-only: no schema change and no data backfill.
  assert.doesNotMatch(postTaxMigration, /alter\s+table|create\s+table|create\s+(unique\s+)?index|drop\s+/i);
  assert.doesNotMatch(postTaxMigration, /^\s*update\s+public\./im);
});

test('the historical conversion migration remains byte-identical', () => {
  assert.equal(
    createHash('sha256').update(fs.readFileSync(new URL('../../../supabase/migrations/20260913163712_atomic_estimate_invoice_conversion.sql', import.meta.url))).digest('hex'),
    '8a09a70ef65343fa949439063d1e5d54ca48dac977bab551399a72ea6a22e5de',
    'the accepted 20260913163712 definition must never be edited');
});

test('canonical JS totals follow the ratified post-tax rule', () => {
  // Owner reference case.
  assert.deepEqual(calculateInvoiceTotals([{quantity: 1, unit_price: 93500, discount_rate: 0}], 2850, 10, 0),
    {subtotal: 93500, tax_amount: 9350, total: 100000, balance_due: 100000});
  // Above-gross discount clamps to subtotal + tax → total exactly 0 (the SQL mirrors this clamp).
  assert.deepEqual(calculateInvoiceTotals([{quantity: 2, unit_price: 1000, discount_rate: 0}], 5000, 10, 0),
    {subtotal: 2000, tax_amount: 200, total: 0, balance_due: 0});
  // Zero discount unchanged; line-level discount remains a pre-tax line input.
  assert.deepEqual(calculateInvoiceTotals([{quantity: 1, unit_price: 10000, discount_rate: 50}], 0, 10, 0),
    {subtotal: 5000, tax_amount: 500, total: 5500, balance_due: 5500});
  assert.equal(lineTotal(2, 1000, 10), 1800);
});

// Runtime tests opt in ONLY to an exact owned disposable container, never a DB URL.
// Without it this explicit skip must not be reported as SQL/concurrency acceptance.
const cid = process.env.INVOICE_TEST_CONTAINER;
test('disposable PG17 conversion: real RLS, rollback, parity and concurrent replay', {skip: !cid, timeout: 90000}, async t => {
  assert.match(cid!, /^[a-f0-9]{64}$/);
  const token = process.env.INVOICE_TEST_OWNER;
  assert.match(token ?? '', /^[a-f0-9-]{36}$/);
  const env: NodeJS.ProcessEnv = {
    PATH: '/opt/homebrew/bin:/usr/bin:/bin',
    DOCKER_HOST: 'unix:///Users/atsushinishikawa/.colima/default/docker.sock',
    NODE_ENV: 'test',
  };
  const identity = spawnSync('/opt/homebrew/bin/docker', ['inspect', '--format', '{{index .Config.Labels "codex.invoice-direct"}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}', cid!], {encoding: 'utf8', env});
  assert.equal(identity.status, 0); assert.equal(identity.stdout.trim(), `${token}|none|{}`);
  const args = ['exec', '-i', '-e', 'PGOPTIONS=-c statement_timeout=10000 -c lock_timeout=5000', cid!,
    'psql', '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
  const sql = (text: string) => {
    const r = spawnSync('/opt/homebrew/bin/docker', args, {input: text, encoding: 'utf8', env, timeout: 15000});
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  const runAsync = (text: string, onData?: (s: string) => void) => new Promise<string>((resolve, reject) => {
    const p = spawn('/opt/homebrew/bin/docker', args, {env, stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '', stderr = ''; p.stdout.on('data', b => {stdout += b; onData?.(stdout);});
    p.stderr.on('data', b => stderr += b); p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(Error(stderr))); p.stdin.end(text);
  });
  const q = (s: string) => "'" + s.replaceAll("'", "''") + "'";
  const user = randomUUID(), otherUser = randomUUID(), did = randomUUID(), otherDealer = randomUUID();
  const customer = randomUUID(), vehicle = randomUUID();
  const auth = (uid = user) => `set local role authenticated; set local request.jwt.claim.sub=${q(uid)}; set local request.jwt.claims=${q(JSON.stringify({sub: uid, role: 'authenticated'}))};`;
  const call = (id: string, d = did) => `select public.create_invoice_from_estimate_atomic(${q(d)},${q(id)},'2026-09-14',null);`;
  const parse = (s: string) => JSON.parse(s.split('\n').find(l => l.startsWith('{'))!);
  const convert = (id: string, uid = user, d = did) => parse(sql(`begin; ${auth(uid)} ${call(id, d)} commit;`));
  sql(`insert into auth.users(id,email) values(${q(user)},'invoice-a@example.test'),(${q(otherUser)},'invoice-b@example.test');
    insert into public.dealers(id,name) values(${q(did)},'Invoice A'),(${q(otherDealer)},'Invoice B');
    insert into public.dealer_members(dealer_id,user_id,role,status) values
      (${q(did)},${q(user)},'owner','active'),(${q(otherDealer)},${q(otherUser)},'owner','active');
    insert into public.customers(id,dealer_id,name) values(${q(customer)},${q(did)},'Invoice Customer');
    insert into public.vehicles(id,dealer_id,customer_id) values(${q(vehicle)},${q(did)},${q(customer)});`);
  const seed = (items = [{quantity: 2, unit_price: 1000, discount_rate: 0}], discount = 0, tax = 10, status = 'approved') => {
    const id = randomUUID();
    sql(`insert into public.estimates(id,dealer_id,customer_id,vehicle_id,estimate_no,estimate_number,status,discount_amount,tax_rate)
      values(${q(id)},${q(did)},${q(customer)},${q(vehicle)},${q(id)},'EST-TEST',${q(status)},${discount},${tax});
      ${items.map((x, n) => `insert into public.estimate_items(estimate_id,dealer_id,category,item_name,quantity,unit_price,discount_rate,sort_order)
      values(${q(id)},${q(did)},'other','line ${n}',${x.quantity},${x.unit_price},${x.discount_rate},${n});`).join('\n')}`);
    return id;
  };
  const seq = () => Number(sql(`select coalesce(sum(current_number),0) from public.document_sequences where dealer_id=${q(did)} and sequence_type='invoice';`));
  await t.test('create and replay retain identity, dates, lines and one number', () => {
    const id = seed(), before = seq(), first = convert(id);
    assert.equal(first.outcome, 'created'); const snapshot = sql(`select row_to_json(i) from public.invoices i where id=${q(first.id)};`);
    const again = parse(sql(`begin; ${auth()} select public.create_invoice_from_estimate_atomic(${q(did)},${q(id)},'2027-01-01','2027-02-01'); commit;`));
    assert.equal(again.outcome, 'existing'); assert.equal(again.id, first.id);
    assert.equal(seq(), before + 1); assert.equal(sql(`select row_to_json(i) from public.invoices i where id=${q(first.id)};`), snapshot);
    const row = JSON.parse(snapshot); assert.equal(row.total, 2200); assert.equal(row.status, 'draft'); assert.equal(row.delivery_date, null);
  });
  await t.test('nonapproved/deleted/foreign source and foreign caller denied without numbering', () => {
    const draft = seed(undefined, 0, 10, 'draft'), id = seed(), before = seq();
    assert.equal(convert(draft).outcome, 'not-approved'); assert.equal(convert(id, otherUser).outcome, 'not-found');
    assert.equal(convert(id, user, otherDealer).outcome, 'not-found');
    sql(`update public.estimates set deleted_at=now() where id=${q(id)};`);
    assert.equal(convert(id).outcome, 'not-found'); assert.equal(seq(), before);
  });
  await t.test('staff precedence blocks membership fallback; anonymous cannot execute', () => {
    const id = seed(), before = seq();
    sql(`insert into public.dealer_staff(dealer_id,user_id,role,status) values(${q(did)},${q(user)},'readonly','active');`);
    assert.equal(convert(id).outcome, 'not-found'); assert.equal(seq(), before);
    sql(`delete from public.dealer_staff where dealer_id=${q(did)} and user_id=${q(user)};`);
    assert.equal(sql(`select has_function_privilege('anon','public.create_invoice_from_estimate_atomic(uuid,uuid,date,date)','execute');`), 'f');
    assert.equal(sql(`select has_function_privilege('service_role','public.create_invoice_from_estimate_atomic(uuid,uuid,date,date)','execute');`), 'f');
    assert.equal(sql("select has_table_privilege('authenticated','public.estimate_items','UPDATE');"), 'f');
  });
  await t.test('cancelled/deleted/ambiguous links do not recreate; generic cardinality unchanged', () => {
    for (const column of ["status='cancelled'", 'deleted_at=now()']) {
      const id = seed(), first = convert(id); sql(`update public.invoices set ${column} where id=${q(first.id)};`);
      const before = seq(); assert.equal(convert(id).outcome, 'conflict'); assert.equal(seq(), before);
    }
    const id = seed(); convert(id);
    sql(`insert into public.invoices(dealer_id,estimate_id,customer_id,vehicle_id) values(${q(did)},${q(id)},${q(customer)},${q(vehicle)});`);
    const before = seq(); assert.equal(convert(id).outcome, 'conflict'); assert.equal(seq(), before);
  });
  await t.test('header, items AND number roll back on forced item insertion failure', () => {
    const id = seed(), before = seq();
    sql(`update public.estimate_items set item_name='ROLLBACK_PROBE' where estimate_id=${q(id)};
      create function public.invoice_conversion_test_fail() returns trigger language plpgsql as $$begin
      if new.item_name='ROLLBACK_PROBE' then raise exception 'forced_item_failure'; end if; return new; end;$$;
      create trigger invoice_conversion_test_fail before insert on public.invoice_items for each row execute function public.invoice_conversion_test_fail();`);
    const r = spawnSync('/opt/homebrew/bin/docker', args, {input: `begin; ${auth()} ${call(id)} commit;`, encoding: 'utf8', env});
    assert.notEqual(r.status, 0); assert.match(r.stderr, /forced_item_failure/);
    assert.equal(sql(`select count(*) from public.invoices where estimate_id=${q(id)};`), '0'); assert.equal(seq(), before);
    sql('drop trigger invoice_conversion_test_fail on public.invoice_items; drop function public.invoice_conversion_test_fail();');
    assert.equal(convert(id).outcome, 'created'); assert.equal(seq(), before + 1);
  });
  await t.test('SQL calculations equal canonical JS including IEEE754 and negative ties', () => {
    const cases = [
      {items: [{quantity: 1, unit_price: 0.49999999999999994, discount_rate: 0}], discount: 0, tax: 10},
      {items: [{quantity: 1, unit_price: -1.5, discount_rate: 0}, {quantity: 1, unit_price: 5, discount_rate: 0}], discount: 0, tax: 10},
      {items: [{quantity: 0.1, unit_price: 255, discount_rate: 10}, {quantity: 3, unit_price: 1999.99, discount_rate: 12.5}], discount: 123.4, tax: 8},
      {items: [{quantity: 2, unit_price: 1000, discount_rate: 0}], discount: 5000, tax: 10},
      {items: [{quantity: 2, unit_price: 1000, discount_rate: 0}], discount: -10, tax: 10},
      {items: [{quantity: 1, unit_price: 9007199254740991, discount_rate: 0}], discount: 0, tax: 0},
    ];
    for (const c of cases) {
      const id = seed(c.items, c.discount, c.tax), result = convert(id); assert.equal(result.outcome, 'created');
      const row = JSON.parse(sql(`select row_to_json(i) from public.invoices i where id=${q(result.id)};`));
      const expected = calculateInvoiceTotals(c.items, c.discount, c.tax, 0);
      for (const k of ['subtotal', 'tax_amount', 'total', 'balance_due'] as const) assert.equal(row[k], expected[k], `${k}: ${JSON.stringify(c)}`);
      const lines = JSON.parse(sql(`select json_agg(line_total order by sort_order) from public.invoice_items where invoice_id=${q(result.id)};`));
      assert.deepEqual(lines, c.items.map(i => lineTotal(i.quantity, i.unit_price, i.discount_rate)));
    }
  });
  await t.test('two overlapping connections return one identity and allocate once', async () => {
    const id = seed(), before = seq(); let ready!: () => void;
    const started = new Promise<void>(r => ready = r);
    const a = runAsync(`begin; ${auth()} ${call(id)} select pg_sleep(1); commit;`, s => {if (s.includes('created')) ready();});
    await Promise.race([started, a.then(() => {throw Error('leader did not expose created result');})]);
    const b = runAsync(`set application_name='invoice-conversion-follower'; begin; ${auth()} ${call(id)} commit;`);
    const waits = sql("select count(*) from pg_stat_activity where application_name='invoice-conversion-follower' and wait_event_type='Lock';");
    // The call starts asynchronously; if not visible yet, let the DB scheduler run.
    if (waits === '0') { await new Promise(r => setTimeout(r, 100));
      assert.equal(sql("select count(*) from pg_stat_activity where application_name='invoice-conversion-follower' and wait_event_type='Lock';"), '1'); }
    const [ra, rb] = await Promise.all([a, b]); assert.equal(parse(ra).outcome, 'created');
    assert.equal(parse(rb).outcome, 'existing'); assert.equal(parse(ra).id, parse(rb).id);
    assert.equal(seq(), before + 1); assert.equal(sql(`select count(*) from public.invoices where estimate_id=${q(id)};`), '1');
  });
  await t.test('canonical numbering formatting, period and fail-closed ambiguous config', () => {
    for (const reset of ['never', 'yearly', 'monthly'] as const) {
      sql(`delete from public.document_sequences where dealer_id=${q(did)} and sequence_type='invoice';
        insert into public.document_sequences(dealer_id,sequence_type,prefix,padding,reset_policy,fiscal_year,current_number)
        values(${q(did)},'invoice','',3,${q(reset)},${computeFiscalYear(reset)},1234);`);
      const r = convert(seed()); assert.equal(r.outcome, 'created');
      const actual = sql(`select invoice_number from public.invoices where id=${q(r.id)};`);
      assert.equal(actual, formatDocumentNumber('', 1235, 3, computeFiscalYear(reset)));
    }
    sql(`insert into public.document_sequences(dealer_id,sequence_type,prefix,padding,reset_policy,fiscal_year,current_number)
      values(${q(did)},'invoice','INV',5,'never',0,0);`);
    const before = seq(); assert.equal(convert(seed()).outcome, 'numbering-conflict'); assert.equal(seq(), before);
  });
});
