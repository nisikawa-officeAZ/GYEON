-- GYEON_ORDER_V3_C5C_R4_QUALIFICATION_EVIDENCE
-- Disposable PostgreSQL 17 only. White-box proof of the two C5-B authority
-- primitives: the Office AZ-owned qualification evaluation
-- (private.gyeon_order_v3_evaluate_qualification) and the generic one-time
-- external-evidence validation/consumption
-- (private.gyeon_order_v3_validate_and_consume_evidence). Full owner-submit
-- and edit RPC lifecycles are proved separately in
-- prepare-finalize-warehouse.test.sql. Real Auth/PostgREST request-scope
-- proof lives in real-auth.mjs.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, pg_temp, public, pg_catalog;

select plan(37);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000','c5c20000-0000-4000-8000-000000000001',
  'authenticated','authenticated','c5c2-owner@example.invalid','',now(),'{}','{}',now(),now()
);

insert into public.dealers(id,name,dealer_type,status) values
  ('c5c21000-0000-4000-8000-000000000001','C5C2 Dealer','GYEON_DETAILER','active');

insert into public.dealer_members(id,dealer_id,user_id,role,status) values
  ('c5c22000-0000-4000-8000-000000000001','c5c21000-0000-4000-8000-000000000001','c5c20000-0000-4000-8000-000000000001','owner','active');

insert into public.gyeon_ordering_memberships(dealer_id,membership_status,buyer_rank,effective_from) values
  ('c5c21000-0000-4000-8000-000000000001','active','detailer',now()-interval '1 day');

insert into public.gyeon_products(id,sku,product_name,category,is_active) values
  ('c5c23000-0000-4000-8000-000000000001','C5C2-CHEM','C5C2 Chemical','coating',true),
  ('c5c23000-0000-4000-8000-000000000002','C5C2-REQ','C5C2 Required Detailer Product','detailer',true),
  ('c5c23000-0000-4000-8000-000000000003','C5C2-MATT','C5C2 Matt Optional','detailer',true);

insert into public.gyeon_product_qualification_classification(
  id,product_id,classification,classification_version,effective_from
) values
  ('c5c24000-0000-4000-8000-000000000001','c5c23000-0000-4000-8000-000000000001','eligible_chemical',1,now()-interval '1 day'),
  ('c5c24000-0000-4000-8000-000000000002','c5c23000-0000-4000-8000-000000000002','required_detailer_product',1,now()-interval '1 day'),
  ('c5c24000-0000-4000-8000-000000000003','c5c23000-0000-4000-8000-000000000003','optional_matt',1,now()-interval '1 day');

insert into public.gyeon_qualification_rule_versions(
  id,rule_version,shop_initial_threshold_ex_tax_yen,detailer_initial_threshold_ex_tax_yen,
  required_detailer_product_codes,is_active,effective_from
) values (
  'c5c25000-0000-4000-8000-000000000001',1,100000,0,array['C5C2-REQ'],true,now()-interval '1 day'
);

-- Draft order used only as the qualification snapshot's required order_id FK;
-- prepare/finalize lifecycle proof is out of scope for this file.
insert into public.product_orders(id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status) values
  ('c5c26000-0000-4000-8000-000000000001','c5c21000-0000-4000-8000-000000000001','draft','c5c20000-0000-4000-8000-000000000001',1,'not_requested','selection_required');

insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,
  list_price_ex_tax_snapshot
) values
  ('c5c26000-0000-4000-8000-000000000001','c5c23000-0000-4000-8000-000000000001','C5C2-CHEM','C5C2 Chemical',60000,2,120000,60000),
  ('c5c26000-0000-4000-8000-000000000001','c5c23000-0000-4000-8000-000000000002','C5C2-REQ','C5C2 Required Detailer Product',5000,1,5000,5000);

-- A second order for the authority-state gate scenarios (calls the full
-- prepare RPC, which requires a real actor and a delivery-ready draft).
insert into public.product_orders(
  id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status,
  destination_kind,delivery_snapshot
) values (
  'c5c26000-0000-4000-8000-000000000002','c5c21000-0000-4000-8000-000000000001','draft','c5c20000-0000-4000-8000-000000000001',1,
  'not_requested','selection_required','own_store','{"label":"C5C2 Dealer"}'::jsonb
);
insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot
) values (
  'c5c26000-0000-4000-8000-000000000002','c5c23000-0000-4000-8000-000000000001','C5C2-CHEM','C5C2 Chemical',60000,1,60000,60000
);

-- ===========================================================================
-- Qualification authority-state gate (prepare_gyeon_order_v3_owner_submit_rpc)
-- ===========================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub','c5c20000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c5c20000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select is(
  (select (public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c21000-0000-4000-8000-000000000001','c5c20000-0000-4000-8000-000000000001',
    'c5c26000-0000-4000-8000-000000000002',1,'bank_transfer_prepaid',null) ->> 'code')),
  'qualification_authority_not_configured',
  '01 no qualification-mode projection row fails closed as not-configured'
);

insert into public.gyeon_dealer_qualification_mode_projection(
  id,dealer_id,qualification_mode,projection_version,authority_state,effective_from,effective_to
) values (
  'c5c27000-0000-4000-8000-000000000001','c5c21000-0000-4000-8000-000000000001','shop_initial',1,'CONFIGURED',
  now()-interval '2 day',now()-interval '1 day'
);

select is(
  (select (public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c21000-0000-4000-8000-000000000001','c5c20000-0000-4000-8000-000000000001',
    'c5c26000-0000-4000-8000-000000000002',1,'bank_transfer_prepaid',null) ->> 'code')),
  'qualification_authority_stale',
  '02 only a past-effective projection is stale, never treated as not-configured'
);

insert into public.gyeon_dealer_qualification_mode_projection(
  id,dealer_id,qualification_mode,projection_version,authority_state,effective_from
) values (
  'c5c27000-0000-4000-8000-000000000002','c5c21000-0000-4000-8000-000000000001','shop_initial',2,'STALE',now()-interval '1 hour'
);

select is(
  (select (public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c21000-0000-4000-8000-000000000001','c5c20000-0000-4000-8000-000000000001',
    'c5c26000-0000-4000-8000-000000000002',1,'bank_transfer_prepaid',null) ->> 'code')),
  'qualification_authority_stale',
  '03 an explicit current STALE projection fails closed as stale'
);

update public.gyeon_dealer_qualification_mode_projection
  set authority_state = 'ERROR'
  where id = 'c5c27000-0000-4000-8000-000000000002';

select is(
  (select (public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c21000-0000-4000-8000-000000000001','c5c20000-0000-4000-8000-000000000001',
    'c5c26000-0000-4000-8000-000000000002',1,'bank_transfer_prepaid',null) ->> 'code')),
  'qualification_authority_error',
  '04 an explicit current ERROR projection fails closed as error'
);

update public.gyeon_dealer_qualification_mode_projection
  set authority_state = 'NOT_CONFIGURED'
  where id = 'c5c27000-0000-4000-8000-000000000002';

select is(
  (select (public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c21000-0000-4000-8000-000000000001','c5c20000-0000-4000-8000-000000000001',
    'c5c26000-0000-4000-8000-000000000002',1,'bank_transfer_prepaid',null) ->> 'code')),
  'qualification_authority_not_configured',
  '05 an explicit current NOT_CONFIGURED projection fails closed as not-configured'
);

reset role;

-- ===========================================================================
-- Qualification decision math (private.gyeon_order_v3_evaluate_qualification)
-- ===========================================================================

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'bogus_mode','fp-bogus'
  ) ->> 'code')),
  'qualification_authority_invalid',
  '06 an unrecognized mode string is rejected before any snapshot is written'
);

select is(
  (select ((private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'none','fp-none'
  ) -> 'decision') ->> 'officiallyAchieved')::boolean),
  true,
  '07 mode none is unconditionally achieved and writes a not_applicable snapshot'
);

select is(
  (select lifecycle_state from public.gyeon_order_qualification_snapshots where order_id='c5c26000-0000-4000-8000-000000000001' and order_version=1),
  'not_applicable',
  '08 the mode-none snapshot lifecycle_state is not_applicable'
);

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'none','fp-none'
  ) -> 'decision') ->> 'officiallyAchieved'),
  (select decision ->> 'officiallyAchieved' from public.gyeon_order_qualification_snapshots where order_id='c5c26000-0000-4000-8000-000000000001' and order_version=1),
  '09 exact canonical replay (same order/version/mode/fingerprint) returns the existing snapshot decision unchanged'
);

select is(
  (select count(*) from public.gyeon_order_qualification_snapshots where order_id='c5c26000-0000-4000-8000-000000000001' and order_version=1),
  1::bigint,
  '10 exact canonical replay never inserts a second snapshot row'
);

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'none','fp-different'
  ) ->> 'code')),
  'qualification_snapshot_conflict',
  '11 a conflicting input fingerprint on an existing snapshot fails closed instead of overwriting it'
);

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'shop_to_detailer','fp-upgrade'
  ) ->> 'code')),
  'qualification_authority_not_configured',
  '12 shop_to_detailer stays fail-closed: no shipped/returned history authority is connected'
);

-- shop_initial: two eligible-chemical units at 60,000 each = 120,000 >= 100,000 threshold.
select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',2,'shop_initial','fp-shop-met'
  ) ->> 'ok')::boolean),
  true,
  '13 shop_initial is met once qualifying (non-promotional) ex-tax amount reaches the threshold'
);

update public.product_order_items set quantity = 1, subtotal = 60000
  where order_id = 'c5c26000-0000-4000-8000-000000000001' and product_id = 'c5c23000-0000-4000-8000-000000000001';

select is(
  (select ((private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',3,'shop_initial','fp-shop-short'
  ) -> 'decision') ->> 'amountRemainingExTaxYen')::integer),
  40000,
  '14 shop_initial below threshold reports the exact remaining ex-tax amount and fails as not met'
);

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',3,'shop_initial','fp-shop-short'
  ) ->> 'code')),
  'qualification_not_met',
  '15 shop_initial below threshold returns qualification_not_met'
);

-- detailer_initial: the required SKU line still exists (quantity 1), so the
-- required-code list is satisfied regardless of the (irrelevant) threshold.
select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',4,'detailer_initial','fp-detailer-met'
  ) ->> 'ok')::boolean),
  true,
  '16 detailer_initial is met once every required product code is present'
);

delete from public.product_order_items
  where order_id = 'c5c26000-0000-4000-8000-000000000001' and product_id = 'c5c23000-0000-4000-8000-000000000002';

select is(
  (select ((private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',5,'detailer_initial','fp-detailer-missing'
  ) -> 'decision') -> 'missingRequiredProductCodes') ? 'C5C2-REQ',
  true,
  '17 detailer_initial reports the exact missing required product code'
);

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',5,'detailer_initial','fp-detailer-missing'
  ) ->> 'code')),
  'qualification_not_met',
  '18 detailer_initial with a missing required code returns qualification_not_met, never a silent pass'
);

-- Mixed classification version: bump one line's classification to version 2
-- while the other line stays on version 1.
insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot
) values (
  'c5c26000-0000-4000-8000-000000000001','c5c23000-0000-4000-8000-000000000003','C5C2-MATT','C5C2 Matt Optional',3000,1,3000,3000
);
update public.gyeon_product_qualification_classification set effective_to = now()
  where id = 'c5c24000-0000-4000-8000-000000000003';
insert into public.gyeon_product_qualification_classification(
  id,product_id,classification,classification_version,effective_from
) values (
  'c5c24000-0000-4000-8000-000000000004','c5c23000-0000-4000-8000-000000000003','optional_matt',2,now()
);

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',6,'shop_initial','fp-mixed'
  ) ->> 'code')),
  'qualification_authority_mixed_classification_version',
  '19 a single order with lines on two different classification versions fails closed'
);

update public.gyeon_product_qualification_classification set effective_to = null
  where id = 'c5c24000-0000-4000-8000-000000000004';
update public.gyeon_product_qualification_classification set effective_to = now()
  where id = 'c5c24000-0000-4000-8000-000000000004' and false; -- no-op guard, keeps statement count stable

delete from public.product_order_items
  where order_id = 'c5c26000-0000-4000-8000-000000000001' and product_id = 'c5c23000-0000-4000-8000-000000000003';

-- Stale/missing classification: a product line with no current classification row.
insert into public.gyeon_products(id,sku,product_name,category,is_active) values
  ('c5c23000-0000-4000-8000-000000000004','C5C2-UNCLASSIFIED','C5C2 Unclassified','coating',true);
insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot
) values (
  'c5c26000-0000-4000-8000-000000000001','c5c23000-0000-4000-8000-000000000004','C5C2-UNCLASSIFIED','C5C2 Unclassified',1000,1,1000,1000
);

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',7,'shop_initial','fp-unclassified'
  ) ->> 'code')),
  'qualification_authority_stale',
  '20 a line with no current Office AZ classification fails closed as stale, never defaults to other'
);

delete from public.product_order_items where order_id = 'c5c26000-0000-4000-8000-000000000001';

select is(
  (select (private.gyeon_order_v3_evaluate_qualification(
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',8,'shop_initial','fp-empty'
  ) ->> 'code')),
  'qualification_authority_invalid',
  '21 an order with zero items is never evaluated as qualifying'
);

-- ===========================================================================
-- External evidence: generic purpose-bound one-time validation/consumption
-- (private.gyeon_order_v3_validate_and_consume_evidence)
-- ===========================================================================

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    null,'initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-1',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_missing',
  '22 a null evidence id fails closed as evidence_missing before any lock is taken'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000099','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-1',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_missing',
  '23 a nonexistent evidence id fails closed as evidence_missing'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000001','initial_authorization','stub_card_psp','evt-unverified',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-1',10000,'JPY',
  'unverified','pending','hash-unverified'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000001','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-1',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_not_server_verified',
  '24 an unverified-authority evidence row is denied'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000002','initial_authorization','stub_card_psp','evt-pending',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-2',10000,'JPY',
  'server_verified','pending',now(),now()+interval '10 minutes','hash-pending'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000002','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-2',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_not_succeeded',
  '25 a pending (not-yet-succeeded) evidence row is denied'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,consumed_at,consumed_by_operation,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000003','initial_authorization','stub_card_psp','evt-consumed',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-3',10000,'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes',now(),'owner_submit_finalize','hash-consumed'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000003','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-3',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_consumed',
  '26 an already-consumed evidence row can never be consumed again'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000004','initial_authorization','stub_card_psp','evt-expired',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-4',10000,'JPY',
  'server_verified','succeeded',now()-interval '20 minutes',now()-interval '10 minutes','hash-expired'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000004','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-4',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_expired',
  '27 an expired evidence row is denied even if otherwise server-verified and succeeded'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000005','edit_reauthorization','stub_card_psp','evt-purpose',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-5',10000,'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-purpose'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000005','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-5',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_purpose_mismatch',
  '28 evidence whose purpose does not match the requested purpose is denied'
);

insert into public.dealers(id,name,dealer_type,status) values
  ('c5c21000-0000-4000-8000-000000000002','C5C2 Dealer B','GYEON_DETAILER','active');
insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000006','initial_authorization','stub_card_psp','evt-wrong-dealer',
  'c5c21000-0000-4000-8000-000000000002','c5c26000-0000-4000-8000-000000000001',1,'fp-6',10000,'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-wrong-dealer'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000006','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-6',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_order_binding_mismatch',
  '29 evidence bound to a different dealer is denied even for the correct order id'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000007','initial_authorization','stub_card_psp','evt-wrong-version',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',2,'fp-7',10000,'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-wrong-version'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000007','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-7',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_version_mismatch',
  '30 evidence bound to a stale order version is denied'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000008','initial_authorization','stub_card_psp','evt-wrong-fp',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-other',10000,'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-wrong-fp'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000008','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-8',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_fingerprint_mismatch',
  '31 evidence bound to a different server-owned request fingerprint is denied'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-000000000009','initial_authorization','stub_card_psp','evt-wrong-amount',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-9',99999,'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-wrong-amount'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000009','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-9',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_amount_mismatch',
  '32 evidence bound to a different amount is denied'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-000000000009','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-9',99999,'USD','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_currency_mismatch',
  '33 once the amount matches exactly, a mismatched currency is independently denied'
);

select throws_ok(
  $$insert into public.gyeon_order_external_evidence_v1(
    id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
    amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
  ) values (
    'c5c28000-0000-4000-8000-00000000000a','bank_payment_match','stub_card_psp','evt-consumed',
    'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-dup',10000,'JPY',
    'server_verified','succeeded',now(),now()+interval '10 minutes','hash-dup')$$,
  '23505',
  '34 a duplicate (provider, provider_event_id) is rejected by the unique constraint'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
) values (
  'c5c28000-0000-4000-8000-00000000000b','initial_authorization','stub_card_psp','evt-exact',
  'c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',1,'fp-exact',10000,'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-exact'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-00000000000b','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-exact',10000,'JPY','owner_submit_finalize'
  ) ->> 'ok')::boolean),
  true,
  '35 an exact dealer/order/version/fingerprint/amount/currency/purpose match consumes successfully'
);

select is(
  (select consumed_by_operation from public.gyeon_order_external_evidence_v1 where id = 'c5c28000-0000-4000-8000-00000000000b'),
  'owner_submit_finalize',
  '36 the consumed evidence row records the exact consuming operation'
);

select is(
  (select (private.gyeon_order_v3_validate_and_consume_evidence(
    'c5c28000-0000-4000-8000-00000000000b','initial_authorization','c5c21000-0000-4000-8000-000000000001','c5c26000-0000-4000-8000-000000000001',
    1,'fp-exact',10000,'JPY','owner_submit_finalize'
  ) ->> 'code')),
  'evidence_consumed',
  '37 replaying the exact same evidence id a second time is denied, never double-consumed'
);

select * from finish();
rollback;
