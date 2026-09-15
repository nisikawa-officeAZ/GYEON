// GDA legacy customer registration — Gate B1 static migration contract test.
// Reads the migration SQL as text and asserts every owner-ratified invariant from
// docs/master_specification/GDA_LEGACY_CUSTOMER_REGISTRATION_IMPLEMENTATION_CONTRACT_V1.md.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260915063440_legacy_customer_registration.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf8');

function assertMatch(pattern: RegExp, message: string): void {
  assert.match(sql, pattern, message);
}

test('vehicle_service_history exists with tenant-bound customer and vehicle foreign keys', () => {
  assertMatch(
    /CREATE TABLE public\.vehicle_service_history\s*\(/,
    'vehicle_service_history table must be created',
  );
  assertMatch(
    /CONSTRAINT vehicle_service_history_vehicle_tenant_fkey\s+FOREIGN KEY \(vehicle_id, dealer_id\) REFERENCES public\.vehicles \(id, dealer_id\)/,
    'vehicle FK must be composite (vehicle_id, dealer_id) → vehicles (id, dealer_id)',
  );
  assertMatch(
    /CONSTRAINT vehicle_service_history_customer_tenant_fkey\s+FOREIGN KEY \(customer_id, dealer_id\) REFERENCES public\.customers \(id, dealer_id\)/,
    'customer FK must be composite (customer_id, dealer_id) → customers (id, dealer_id)',
  );
  assertMatch(
    /CREATE UNIQUE INDEX IF NOT EXISTS customers_id_dealer_id_uidx ON public\.customers \(id, dealer_id\)/,
    'composite-FK anchor index on customers must exist',
  );
  assertMatch(
    /CREATE UNIQUE INDEX IF NOT EXISTS vehicles_id_dealer_id_uidx\s+ON public\.vehicles\s+\(id, dealer_id\)/,
    'composite-FK anchor index on vehicles must exist',
  );
  assertMatch(
    /ON public\.vehicle_service_history \(dealer_id, vehicle_id, performed_on DESC\)/,
    'required (dealer_id, vehicle_id, performed_on desc) index must exist',
  );
});

test('legacy_customer_registration_receipts exists and is immutable for authenticated callers', () => {
  assertMatch(
    /CREATE TABLE public\.legacy_customer_registration_receipts\s*\(/,
    'receipts table must be created',
  );
  assertMatch(
    /UNIQUE \(dealer_id, idempotency_key\)/,
    'receipts must be unique per (dealer_id, idempotency_key)',
  );
  // The only grant back to authenticated on receipts is SELECT, INSERT — never UPDATE/DELETE.
  assertMatch(
    /GRANT SELECT, INSERT ON TABLE public\.legacy_customer_registration_receipts TO authenticated;/,
    'authenticated may only SELECT/INSERT receipts',
  );
  const receiptGrantsToAuthenticated = sql.match(
    /GRANT [^;]*ON TABLE public\.legacy_customer_registration_receipts TO authenticated;/g,
  ) ?? [];
  assert.equal(receiptGrantsToAuthenticated.length, 1, 'exactly one authenticated grant on receipts');
  assert.ok(
    !/GRANT [^;]*(UPDATE|DELETE)[^;]*ON TABLE public\.legacy_customer_registration_receipts TO authenticated/.test(sql),
    'no authenticated UPDATE/DELETE grant on receipts',
  );
  // No UPDATE or DELETE RLS policy on receipts (fail closed under RLS).
  assert.ok(
    !/CREATE POLICY [^;]*ON public\.legacy_customer_registration_receipts[^;]*FOR (UPDATE|DELETE)/s.test(sql),
    'no UPDATE/DELETE policy on receipts',
  );
});

test('register_legacy_customer(jsonb) is SECURITY INVOKER with pinned search_path', () => {
  assertMatch(
    /CREATE OR REPLACE FUNCTION public\.register_legacy_customer\(p_payload jsonb\)\s+RETURNS jsonb\s+LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = public, pg_temp/,
    'function must be SECURITY INVOKER with search_path = public, pg_temp',
  );
  assert.ok(!/SECURITY DEFINER/i.test(sql), 'no SECURITY DEFINER anywhere in the migration');
});

test('execute is revoked from PUBLIC/anon/authenticated/service_role before authenticated-only grant', () => {
  const revokeRe =
    /REVOKE EXECUTE ON FUNCTION public\.register_legacy_customer\(jsonb\)\s+FROM PUBLIC, anon, authenticated, service_role;/;
  const grantRe =
    /GRANT EXECUTE ON FUNCTION public\.register_legacy_customer\(jsonb\) TO authenticated;/;
  assertMatch(revokeRe, 'execute must be revoked from PUBLIC, anon, authenticated, service_role');
  assertMatch(grantRe, 'execute must be granted back to authenticated only');
  const revokeIdx = sql.search(revokeRe);
  const grantIdx = sql.search(grantRe);
  assert.ok(revokeIdx >= 0 && grantIdx > revokeIdx, 'revoke must precede the exact regrant');
  const executeGrants = sql.match(/GRANT EXECUTE ON FUNCTION public\.register_legacy_customer\(jsonb\)[^;]*;/g) ?? [];
  assert.equal(executeGrants.length, 1, 'exactly one execute grant, to authenticated');
  // Table privileges follow the same revoke-first posture.
  assertMatch(
    /REVOKE ALL PRIVILEGES ON TABLE public\.vehicle_service_history\s+FROM PUBLIC, anon, authenticated, service_role;/,
    'vehicle_service_history automatic grants revoked first',
  );
  assertMatch(
    /REVOKE ALL PRIVILEGES ON TABLE public\.legacy_customer_registration_receipts\s+FROM PUBLIC, anon, authenticated, service_role;/,
    'receipts automatic grants revoked first',
  );
  assert.ok(!/GRANT [^;]*TO anon/i.test(sql), 'anon receives no grant anywhere');
});

test('RLS is enabled and every policy requires active dealer membership and auth.uid attribution', () => {
  assertMatch(
    /ALTER TABLE public\.vehicle_service_history ENABLE ROW LEVEL SECURITY;/,
    'RLS enabled on vehicle_service_history',
  );
  assertMatch(
    /ALTER TABLE public\.legacy_customer_registration_receipts ENABLE ROW LEVEL SECURITY;/,
    'RLS enabled on receipts',
  );
  const policies = sql.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
  assert.equal(policies.length, 4, 'exactly four policies (SELECT + INSERT per table)');
  for (const policy of policies) {
    assert.match(policy, /TO authenticated/, 'every policy is scoped to authenticated');
    assert.match(
      policy,
      /EXISTS \(SELECT 1 FROM public\.dealer_members dm\s+WHERE dm\.user_id = auth\.uid\(\)\s+AND dm\.dealer_id = \w+\.dealer_id\s+AND dm\.status = 'active'/,
      'every policy binds to active dealer membership via auth.uid()',
    );
  }
  const insertPolicies = policies.filter((p) => /FOR INSERT/.test(p));
  assert.equal(insertPolicies.length, 2, 'one INSERT policy per table');
  for (const policy of insertPolicies) {
    assert.match(
      policy,
      /WITH CHECK \(created_by = auth\.uid\(\)/,
      'INSERT policies require created_by = auth.uid() attribution',
    );
    // Edit capability: active dealer_staff role wins, else the membership role; readonly cannot
    // bypass the RPC through a direct INSERT.
    assert.match(
      policy,
      /AND coalesce\(\s*\(SELECT ds\.role::text FROM public\.dealer_staff ds\s+WHERE ds\.user_id = auth\.uid\(\)\s+AND ds\.dealer_id = \w+\.dealer_id\s+AND ds\.status = 'active'\),\s*dm\.role::text\) IN \('owner', 'manager', 'staff'\)/,
      'INSERT policies enforce the staff-else-membership edit capability (owner/manager/staff only)',
    );
  }
});

test('function resolves edit capability from dealer_staff with membership fallback', () => {
  assertMatch(
    /SELECT dealer_id, role::text INTO v_dealer_id, v_membership_role\s+FROM public\.dealer_members\s+WHERE user_id = v_actor AND status = 'active';/,
    'dealer_id and membership role derived together from the single active membership row',
  );
  assertMatch(
    /SELECT role::text INTO v_staff_role\s+FROM public\.dealer_staff\s+WHERE user_id = v_actor AND dealer_id = v_dealer_id AND status = 'active';/,
    'staff role read for the SAME actor and dealer from active dealer_staff',
  );
  assertMatch(
    /v_effective_role := coalesce\(v_staff_role, v_membership_role\);/,
    'effective role is the active staff role, else the same membership row role',
  );
  assertMatch(
    /IF v_effective_role IS NULL OR v_effective_role NOT IN \('owner', 'manager', 'staff'\) THEN\s+RAISE EXCEPTION 'PERMISSION_DENIED/,
    'unknown or non-editing (incl. readonly) effective role fails closed with PERMISSION_DENIED',
  );
});

test('dealer and actor are derived server-side from auth.uid(), never from the payload', () => {
  assertMatch(/v_actor := auth\.uid\(\);/, 'actor derived from auth.uid()');
  assertMatch(
    /IF v_actor IS NULL THEN\s+RAISE EXCEPTION 'AUTH_REQUIRED/,
    'null auth.uid() fails closed with AUTH_REQUIRED',
  );
  assertMatch(
    /SELECT count\(\*\) INTO v_membership_count\s+FROM public\.dealer_members\s+WHERE user_id = v_actor AND status = 'active';/,
    'dealer resolved via active membership count',
  );
  assertMatch(/'FORBIDDEN_NO_ACTIVE_MEMBERSHIP/, 'zero memberships fail closed');
  assertMatch(/'DEALER_CONTEXT_AMBIGUOUS/, 'ambiguous tenant fails closed');
  assertMatch(
    /SELECT dealer_id, role::text INTO v_dealer_id, v_membership_role\s+FROM public\.dealer_members\s+WHERE user_id = v_actor AND status = 'active';/,
    'dealer_id derived server-side from membership',
  );
  // The payload must never supply the tenant or actor.
  assert.ok(
    !/p_payload\s*->>?\s*'(dealerId|dealer_id|createdBy|created_by|actor|role|capability)'/.test(sql),
    'payload never names dealer, actor, role, or capability',
  );
});

test('payload fingerprint is server-owned canonical SHA-256', () => {
  assertMatch(
    /v_canonical := jsonb_build_object\(\s*'customer', v_customer_canon, 'vehicle', v_vehicle_canon, 'history', v_history_canon\);/,
    'canonical payload built server-side from validated canonical parts',
  );
  assertMatch(
    /v_fingerprint := encode\(sha256\(convert_to\(v_canonical::text, 'UTF8'\)\), 'hex'\);/,
    'fingerprint is SHA-256 hex of the canonical payload',
  );
  assertMatch(
    /CHECK \(payload_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'\)/,
    'receipts enforce lowercase 64-hex fingerprint',
  );
  assert.ok(
    !/p_payload\s*->>?\s*'(payloadFingerprint|fingerprint|payload_fingerprint)'/.test(sql),
    'fingerprint is never accepted from the payload',
  );
});

test('same key + same fingerprint replays original ids without writes', () => {
  assertMatch(
    /SELECT payload_fingerprint, customer_id, vehicle_id INTO v_existing\s+FROM public\.legacy_customer_registration_receipts\s+WHERE dealer_id = v_dealer_id AND idempotency_key = v_key;/,
    'existing receipt looked up by (dealer_id, idempotency_key)',
  );
  assertMatch(
    /IF v_existing\.payload_fingerprint = v_fingerprint THEN\s+--[^\n]*\n\s*RETURN jsonb_build_object\(\s*'ok', true, 'customerId', v_existing\.customer_id, 'vehicleId', v_existing\.vehicle_id,\s*'idempotentReplay', true\);/,
    'matching fingerprint returns the ORIGINAL ids with idempotentReplay=true before any write',
  );
  const replayReturnIdx = sql.indexOf("'idempotentReplay', true");
  const firstWriteIdx = sql.indexOf('INSERT INTO public.customers');
  assert.ok(
    replayReturnIdx >= 0 && firstWriteIdx > replayReturnIdx,
    'replay return happens before any INSERT in the function body',
  );
});

test('same key + different fingerprint fails closed', () => {
  assertMatch(
    /RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: idempotency key reused with a different payload';/,
    'fingerprint mismatch raises stable IDEMPOTENCY_CONFLICT',
  );
});

test('advisory transaction locking serializes concurrent same-key callers', () => {
  assertMatch(
    /PERFORM pg_advisory_xact_lock\(\s*hashtextextended\('legacy_customer_registration:' \|\| v_dealer_id::text \|\| ':' \|\| v_key, 0\)\);/,
    'pg_advisory_xact_lock keyed on dealer + idempotency key',
  );
  const lockIdx = sql.indexOf('pg_advisory_xact_lock');
  const receiptLookupIdx = sql.indexOf('SELECT payload_fingerprint, customer_id, vehicle_id INTO v_existing');
  assert.ok(
    lockIdx >= 0 && receiptLookupIdx > lockIdx,
    'lock is taken before the receipt existence check',
  );
});

test('zero history entries are accepted while the receipt anchor is still written', () => {
  assertMatch(
    /v_history\s+:= coalesce\(p_payload -> 'history', '\[\]'::jsonb\);/,
    'missing history defaults to an empty array (zero rows accepted)',
  );
  assertMatch(
    /-- 8\. Insert ZERO or more history rows/,
    'history insert loop explicitly supports zero rows',
  );
  assertMatch(
    /INSERT INTO public\.legacy_customer_registration_receipts \(\s*dealer_id, idempotency_key, payload_fingerprint, customer_id, vehicle_id, created_by\s*\) VALUES \(\s*v_dealer_id, v_key, v_fingerprint, v_customer_id, v_vehicle_id, v_actor\s*\) RETURNING id INTO v_receipt_id;/,
    'receipt anchor is written unconditionally with resolved ids and server-derived actor',
  );
  const historyLoopIdx = sql.indexOf('-- 8. Insert ZERO or more history rows');
  const receiptInsertIdx = sql.indexOf('INSERT INTO public.legacy_customer_registration_receipts');
  assert.ok(
    historyLoopIdx >= 0 && receiptInsertIdx > historyLoopIdx,
    'receipt insert is outside/after the history loop, not gated on history rows',
  );
});

test('stable sanitized errors and a generic backstop exist', () => {
  for (const code of [
    'AUTH_REQUIRED',
    'FORBIDDEN_NO_ACTIVE_MEMBERSHIP',
    'DEALER_CONTEXT_AMBIGUOUS',
    'PERMISSION_DENIED',
    'VALIDATION_ERROR',
    'IDEMPOTENCY_KEY_INVALID',
    'IDEMPOTENCY_CONFLICT',
    'HISTORY_INVALID',
    'CUSTOMER_NOT_FOUND',
    'VEHICLE_NOT_FOUND',
    'VEHICLE_CUSTOMER_MISMATCH',
    'REGISTRATION_FAILED',
  ]) {
    assertMatch(
      new RegExp(`RAISE EXCEPTION '${code}:`),
      `stable sanitized code ${code} must be raised`,
    );
  }
  assertMatch(
    /EXCEPTION\s+WHEN raise_exception THEN\s+RAISE;[\s\S]*?WHEN OTHERS THEN\s+--[^\n]*\n\s*RAISE EXCEPTION 'REGISTRATION_FAILED: legacy customer registration could not be completed';/,
    'WHEN OTHERS backstop re-raises only the generic sanitized REGISTRATION_FAILED code',
  );
});
