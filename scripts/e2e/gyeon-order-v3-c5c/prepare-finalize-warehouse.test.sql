-- GYEON_ORDER_V3_C5C_R4_PREPARE_FINALIZE_WAREHOUSE
-- Disposable PostgreSQL 17 only. White-box proof of the full C5-B RPC
-- lifecycle: owner-submit prepare/finalize, pre-warehouse edit
-- prepare/finalize, durable compensation, the payment-contract snapshot,
-- cancel, and the warehouse release/accept split. Real Auth/PostgREST
-- request-scope proof lives in real-auth.mjs; genuine two-connection races
-- live in concurrency.mjs.
--
-- IMPORTANT: JWT claims set below are SQL/RLS claim simulation used only to
-- exercise auth.uid()-bound server logic; they never substitute for the real
-- local GoTrue tokens and PostgREST requests proved in real-auth.mjs.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, pg_temp, public, pg_catalog;

select plan(48);

create temp table c5c3_scratch(key text primary key, value jsonb);
grant select, insert on c5c3_scratch to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared fixtures. Qualification mode is fixed to 'none' so this file proves
-- prepare/finalize/edit/release/accept without re-deriving the qualification
-- decision math already proved in qualification-evidence.test.sql.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000','c5c30000-0000-4000-8000-000000000001',
  'authenticated','authenticated','c5c3-owner@example.invalid','',now(),'{}','{}',now(),now()
);

insert into public.dealers(id,name,dealer_type,status) values
  ('c5c31000-0000-4000-8000-000000000001','C5C3 Dealer','GYEON_DETAILER','active');

insert into public.dealer_members(id,dealer_id,user_id,role,status) values
  ('c5c32000-0000-4000-8000-000000000001','c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001','owner','active');

insert into public.gyeon_ordering_memberships(dealer_id,membership_status,buyer_rank,effective_from) values
  ('c5c31000-0000-4000-8000-000000000001','active','detailer',now()-interval '1 day');

insert into public.gyeon_dealer_qualification_mode_projection(
  id,dealer_id,qualification_mode,projection_version,authority_state,effective_from
) values (
  'c5c34000-0000-4000-8000-000000000001','c5c31000-0000-4000-8000-000000000001','none',1,'CONFIGURED',now()-interval '1 day'
);

insert into public.gyeon_products(id,sku,product_name,category,is_active) values
  ('c5c33000-0000-4000-8000-000000000001','C5C3-A','C5C3 Product A','coating',true),
  ('c5c33000-0000-4000-8000-000000000002','C5C3-B','C5C3 Product B','coating',true),
  ('c5c33000-0000-4000-8000-000000000003','C5C3-BO','C5C3 Backorder Product','coating',true);

insert into public.gyeon_product_order_offers_v3(
  id,product_id,buyer_rank,tax_rate_bps,list_price_ex_tax_yen,list_price_inc_tax_yen,
  purchase_price_ex_tax_yen,purchase_price_inc_tax_yen,backorder_permitted,publication_state,is_sellable,
  offer_version,effective_from,authority_updated_at
) values
  ('c5c35000-0000-4000-8000-000000000001','c5c33000-0000-4000-8000-000000000001','detailer',1000,20000,22000,15000,16500,true,'published',true,1,now()-interval '1 day',now()),
  ('c5c35000-0000-4000-8000-000000000002','c5c33000-0000-4000-8000-000000000002','detailer',1000,30000,33000,22000,24200,true,'published',true,1,now()-interval '1 day',now()),
  ('c5c35000-0000-4000-8000-000000000003','c5c33000-0000-4000-8000-000000000003','detailer',1000,10000,11000,8000,8800,true,'published',true,1,now()-interval '1 day',now());

insert into public.gyeon_order_supply_projection(
  product_id,authority_state,formal_inventory_qty,reserved_qty,inbound_confirmed_pending_stocktake_qty,
  orderable_qty,backorder_allowed,source_version,observed_at
) values
  ('c5c33000-0000-4000-8000-000000000001','CONFIGURED',100,0,0,100,true,'c5c3-v1',now()),
  ('c5c33000-0000-4000-8000-000000000002','CONFIGURED',100,0,0,100,true,'c5c3-v1',now()),
  ('c5c33000-0000-4000-8000-000000000003','CONFIGURED',0,0,0,0,true,'c5c3-v1',now());

insert into public.gyeon_warehouse_calendar_days(warehouse_date, operating_mode, cutoff_minute_jst, calendar_version)
select ((now() at time zone 'Asia/Tokyo')::date + g), 'normal', 1439, 1
from generate_series(0,6) g;

select set_config('request.jwt.claim.sub','c5c30000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c5c30000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- ===========================================================================
-- Order O1: full card lifecycle -- prepare, finalize, edit (amount-changing
-- then amount-preserving), release, accept.
-- ===========================================================================

insert into public.product_orders(
  id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status,
  destination_kind,delivery_snapshot,merchandise_list_ex_tax_yen,shipping_fee_ex_tax_yen,tax_yen,
  grand_total_inc_tax_yen,contains_backorder
) values (
  'c5c36000-0000-4000-8000-000000000001','c5c31000-0000-4000-8000-000000000001','draft','c5c30000-0000-4000-8000-000000000001',1,
  'not_requested','selection_required','own_store','{}'::jsonb,20000,0,2000,22000,false
);
insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot
) values (
  'c5c36000-0000-4000-8000-000000000001','c5c33000-0000-4000-8000-000000000001','C5C3-A','C5C3 Product A',22000,1,15000,20000
);

set local role authenticated;
insert into c5c3_scratch values ('o1_prepare', (
  select public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000001',1,'card',null
  )
));
reset role;

select is(
  (select (value ->> 'requires_external_authorization')::boolean from c5c3_scratch where key = 'o1_prepare'),
  true,
  '01 owner-submit prepare requires external card authorization and returns a prepared operation'
);

select is(
  (select count(*) from public.gyeon_order_prepared_operations_v1 where dealer_id = 'c5c31000-0000-4000-8000-000000000001' and kind = 'owner_submit'),
  1::bigint,
  '02 exactly one owner_submit prepared operation is recorded'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
)
select
  'c5c38000-0000-4000-8000-000000000001','initial_authorization','stub_card_psp','evt-o1-auth',
  'c5c31000-0000-4000-8000-000000000001','c5c36000-0000-4000-8000-000000000001',1,
  value ->> 'request_fingerprint', (value ->> 'amount_inc_tax_yen')::integer, 'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-o1-auth'
from c5c3_scratch where key = 'o1_prepare';

set local role authenticated;
insert into c5c3_scratch values ('o1_finalize', (
  select public.finalize_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000001',1,'c5c39000-0000-4000-8000-000000000001',
    'card',null,
    (select value ->> 'prepared_operation_id' from c5c3_scratch where key = 'o1_prepare')::uuid,
    'c5c38000-0000-4000-8000-000000000001'
  )
));
reset role;

select is(
  (select (value ->> 'ok')::boolean from c5c3_scratch where key = 'o1_finalize'),
  true,
  '03 owner-submit finalize succeeds with the exact prepared operation and accepted evidence'
);

select is(
  (select status from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'submitted',
  '04 the order transitions from draft to submitted on successful finalize'
);

select is(
  (select payment_status from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'authorized',
  '05 card payment_status becomes authorized on successful finalize'
);

select is(
  (select card_authority_evidence_id from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'c5c38000-0000-4000-8000-000000000001'::uuid,
  '06 the server-owned card authority link is persisted to the exact accepted evidence id'
);

select is(
  (select consumed_at is not null from public.gyeon_order_external_evidence_v1 where id = 'c5c38000-0000-4000-8000-000000000001'),
  true,
  '07 the accepted card evidence is consumed exactly once by finalize'
);

select is(
  (select payment_contract_kind from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'standard_payment',
  '08 the first successful finalize freezes the payment-contract snapshot as standard_payment'
);

select is(
  (select payment_contract_credit_terms_version from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  null::bigint,
  '09 a standard_payment snapshot binds no credit-terms version'
);

-- Idempotent replay: identical inputs, same idempotency key, must not
-- re-consume evidence or re-advance aggregate_version.
set local role authenticated;
select is(
  (select (public.finalize_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000001',1,'c5c39000-0000-4000-8000-000000000001',
    'card',null,
    (select value ->> 'prepared_operation_id' from c5c3_scratch where key = 'o1_prepare')::uuid,
    'c5c38000-0000-4000-8000-000000000001'
  ) ->> 'ok')::boolean),
  true,
  '10 identical idempotent replay of finalize returns the canonical prior result'
);
reset role;

select is(
  (select aggregate_version from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  2::bigint,
  '11 idempotent replay does not advance aggregate_version a second time'
);

-- Amount-changing edit: replace the single line with two lines of Product B.
set local role authenticated;
insert into c5c3_scratch values ('o1_edit_prepare', (
  select public.prepare_gyeon_order_v3_edit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000001',2,
    '[{"product_id":"c5c33000-0000-4000-8000-000000000002","quantity":2}]'::jsonb
  )
));
reset role;

select is(
  (select value ->> 'action' from c5c3_scratch where key = 'o1_edit_prepare'),
  'prepare_card_reauthorization',
  '12 an amount-changing card edit requires a prepared reauthorization'
);

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
)
select
  'c5c38000-0000-4000-8000-000000000002','edit_reauthorization','stub_card_psp','evt-o1-edit',
  'c5c31000-0000-4000-8000-000000000001','c5c36000-0000-4000-8000-000000000001',2,
  value ->> 'request_fingerprint', (value ->> 'amount_inc_tax_yen')::integer, 'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-o1-edit'
from c5c3_scratch where key = 'o1_edit_prepare';

set local role authenticated;
insert into c5c3_scratch values ('o1_edit_finalize', (
  select public.finalize_gyeon_order_v3_edit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000001',2,'c5c39000-0000-4000-8000-000000000002',
    '[{"product_id":"c5c33000-0000-4000-8000-000000000002","quantity":2}]'::jsonb,
    (select value ->> 'prepared_operation_id' from c5c3_scratch where key = 'o1_edit_prepare')::uuid,
    'c5c38000-0000-4000-8000-000000000002'
  )
));
reset role;

select is(
  (select (value ->> 'ok')::boolean from c5c3_scratch where key = 'o1_edit_finalize'),
  true,
  '13 an amount-changing edit finalize succeeds with the accepted reauthorization evidence'
);

select is(
  (select card_authority_evidence_id from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'c5c38000-0000-4000-8000-000000000002'::uuid,
  '14 a successful amount-changing edit atomically replaces the card authority link'
);

select is(
  (select card_authority_request_fingerprint from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  (select request_fingerprint from public.gyeon_order_external_evidence_v1 where id = 'c5c38000-0000-4000-8000-000000000002'),
  '15 the replaced card authority link binds the exact new request fingerprint'
);

select is(
  (select payment_contract_kind from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'standard_payment',
  '16 a pre-warehouse edit never rewrites the frozen payment-contract snapshot'
);

-- Amount-preserving edit: same single line and same total; no external
-- authorization is required and the existing card authority link survives.
set local role authenticated;
insert into c5c3_scratch values ('o1_edit2_prepare', (
  select public.prepare_gyeon_order_v3_edit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000001',3,
    '[{"product_id":"c5c33000-0000-4000-8000-000000000002","quantity":2}]'::jsonb
  )
));
reset role;

select is(
  (select value ->> 'action' from c5c3_scratch where key = 'o1_edit2_prepare'),
  'finalize_without_external_authorization',
  '17 an amount-preserving edit never requires external reauthorization'
);

set local role authenticated;
insert into c5c3_scratch values ('o1_edit2_finalize', (
  select public.finalize_gyeon_order_v3_edit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000001',3,'c5c39000-0000-4000-8000-000000000003',
    '[{"product_id":"c5c33000-0000-4000-8000-000000000002","quantity":2}]'::jsonb
  )
));
reset role;

select is(
  (select card_authority_evidence_id from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'c5c38000-0000-4000-8000-000000000002'::uuid,
  '18 an amount-preserving edit never clears or replaces the existing card authority link'
);

-- Release requires a server-verified inventory_reservation evidence bound to
-- the exact dealer/order/current version/fingerprint/amount/currency.
set local role service_role;
select throws_ok(
  $$select public.release_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099','c5c39000-0000-4000-8000-000000000004')$$,
  '55000','INVENTORY_RESERVATION_EVIDENCE_REQUIRED',
  '19 warehouse release without inventory-reservation evidence fails closed'
);
reset role;

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
)
select
  'c5c38000-0000-4000-8000-000000000003','inventory_reservation','office_az_stub','evt-o1-inv-1',
  'c5c31000-0000-4000-8000-000000000001','c5c36000-0000-4000-8000-000000000001',4,
  private.gyeon_order_v3_fingerprint('inventory_reservation','c5c36000-0000-4000-8000-000000000001',4,'{}'::jsonb),
  o.grand_total_inc_tax_yen,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-o1-inv-1'
from public.product_orders o where o.id = 'c5c36000-0000-4000-8000-000000000001'
union all
select
  'c5c38000-0000-4000-8000-000000000004','inventory_reservation','office_az_stub','evt-o1-inv-2',
  'c5c31000-0000-4000-8000-000000000001','c5c36000-0000-4000-8000-000000000001',4,
  private.gyeon_order_v3_fingerprint('inventory_reservation','c5c36000-0000-4000-8000-000000000001',4,'{}'::jsonb),
  o.grand_total_inc_tax_yen,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-o1-inv-2'
from public.product_orders o where o.id = 'c5c36000-0000-4000-8000-000000000001';

set local role service_role;
select throws_ok(
  $$select public.release_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099','c5c39000-0000-4000-8000-000000000005')$$,
  '55000','INVENTORY_RESERVATION_EVIDENCE_AMBIGUOUS',
  '20 two exact-matching inventory-reservation candidates fail closed as ambiguous'
);
reset role;

update public.gyeon_order_external_evidence_v1
  set state = 'voided'
  where id = 'c5c38000-0000-4000-8000-000000000004';

set local role service_role;
insert into c5c3_scratch values ('o1_release', (
  select public.release_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099','c5c39000-0000-4000-8000-000000000006'
  )
));
reset role;

select is(
  (select (value ->> 'ok')::boolean from c5c3_scratch where key = 'o1_release'),
  true,
  '21 warehouse release succeeds once exactly one valid inventory-reservation evidence row exists'
);

select is(
  (select consumed_at is not null from public.gyeon_order_external_evidence_v1 where id = 'c5c38000-0000-4000-8000-000000000003'),
  true,
  '22 the exact matching inventory-reservation evidence is consumed by release'
);

select is(
  (select count(*) from public.gyeon_order_warehouse_tasks where order_id = 'c5c36000-0000-4000-8000-000000000001'),
  1::bigint,
  '23 exactly one warehouse task is created by release'
);

select is(
  (select task_state from public.gyeon_order_warehouse_tasks where order_id = 'c5c36000-0000-4000-8000-000000000001'),
  'unaccepted',
  '24 the release-created task starts unaccepted'
);

-- Replay of release is a service-only no-op; it never creates a second task.
set local role service_role;
select is(
  (select (public.release_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099','c5c39000-0000-4000-8000-000000000007'
  ) ->> 'action')),
  'noop_existing',
  '25 replaying release against an order that already has a task is a no-op'
);
reset role;

select is(
  (select count(*) from public.gyeon_order_warehouse_tasks where order_id = 'c5c36000-0000-4000-8000-000000000001'),
  1::bigint,
  '26 the no-op replay never creates a second warehouse task'
);

-- Warehouse accept: locks and consumes the existing task; never inserts one.
set local role service_role;
select throws_ok(
  $$select public.accept_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099',4,99,'c5c39000-0000-4000-8000-000000000008')$$,
  '40001','TASK_VERSION_CONFLICT',
  '27 accept with the wrong expected task version fails closed'
);
reset role;

set local role service_role;
select throws_ok(
  $$select public.accept_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099',99,1,'c5c39000-0000-4000-8000-000000000009')$$,
  '40001','ORDER_VERSION_CONFLICT',
  '28 accept with the wrong expected order version fails closed'
);
reset role;

set local role service_role;
insert into c5c3_scratch values ('o1_accept', (
  select public.accept_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099',4,1,'c5c39000-0000-4000-8000-00000000000a'
  )
));
reset role;

select is(
  (select status from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000001'),
  'approved',
  '29 successful accept transitions the order to approved'
);

select is(
  (select task_state from public.gyeon_order_warehouse_tasks where order_id = 'c5c36000-0000-4000-8000-000000000001'),
  'accepted',
  '30 successful accept consumes the existing task instead of inserting a new one'
);

set local role service_role;
select throws_ok(
  $$select public.accept_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000099',5,2,'c5c39000-0000-4000-8000-00000000000b')$$,
  '55000','WAREHOUSE_ACCEPT_NOT_ALLOWED',
  '31 accept on an already-approved order is denied before a second task insert'
);
reset role;

-- ===========================================================================
-- Order O2: card finalize without a prepared operation or evidence fails
-- closed before any lock, and never inserts a compensation row.
-- ===========================================================================

insert into public.product_orders(
  id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status,
  destination_kind,delivery_snapshot,merchandise_list_ex_tax_yen,shipping_fee_ex_tax_yen,tax_yen,
  grand_total_inc_tax_yen,contains_backorder
) values (
  'c5c36000-0000-4000-8000-000000000002','c5c31000-0000-4000-8000-000000000001','draft','c5c30000-0000-4000-8000-000000000001',1,
  'not_requested','selection_required','own_store','{}'::jsonb,20000,0,2000,22000,false
);
insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot
) values (
  'c5c36000-0000-4000-8000-000000000002','c5c33000-0000-4000-8000-000000000001','C5C3-A','C5C3 Product A',22000,1,15000,20000
);

set local role authenticated;
insert into c5c3_scratch values ('o2_finalize', (
  select public.finalize_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000002',1,'c5c39000-0000-4000-8000-00000000000c',
    'card',null,null,null
  )
));
reset role;

select is(
  (select value ->> 'code' from c5c3_scratch where key = 'o2_finalize'),
  'card_authority_required',
  '32 card finalize without a prepared operation or evidence id fails closed before any lock'
);

select is(
  (select status from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000002'),
  'draft',
  '33 a denied card finalize never advances the order out of draft'
);

-- ===========================================================================
-- Order O3: a newly succeeded card authorization is queued for durable void
-- when active credit-account terms appear before finalize.
-- ===========================================================================

insert into public.product_orders(
  id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status,
  destination_kind,delivery_snapshot,merchandise_list_ex_tax_yen,shipping_fee_ex_tax_yen,tax_yen,
  grand_total_inc_tax_yen,contains_backorder
) values (
  'c5c36000-0000-4000-8000-000000000003','c5c31000-0000-4000-8000-000000000001','draft','c5c30000-0000-4000-8000-000000000001',1,
  'not_requested','selection_required','own_store','{}'::jsonb,20000,0,2000,22000,false
);
insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot
) values (
  'c5c36000-0000-4000-8000-000000000003','c5c33000-0000-4000-8000-000000000001','C5C3-A','C5C3 Product A',22000,1,15000,20000
);

set local role authenticated;
insert into c5c3_scratch values ('o3_prepare', (
  select public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000003',1,'card',null
  )
));
reset role;

insert into public.gyeon_order_external_evidence_v1(
  id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,
  amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash
)
select
  'c5c38000-0000-4000-8000-000000000005','initial_authorization','stub_card_psp','evt-o3-auth',
  'c5c31000-0000-4000-8000-000000000001','c5c36000-0000-4000-8000-000000000003',1,
  value ->> 'request_fingerprint', (value ->> 'amount_inc_tax_yen')::integer, 'JPY',
  'server_verified','succeeded',now(),now()+interval '10 minutes','hash-o3-auth'
from c5c3_scratch where key = 'o3_prepare';

-- Credit-account terms activate for the dealer after the external
-- authorization already succeeded, but before finalize is called.
insert into public.gyeon_dealer_credit_terms(dealer_id,credit_state,terms_version,effective_from) values
  ('c5c31000-0000-4000-8000-000000000001','active',1,now()-interval '1 minute');

set local role authenticated;
insert into c5c3_scratch values ('o3_finalize', (
  select public.finalize_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000003',1,'c5c39000-0000-4000-8000-00000000000d',
    'card',null,
    (select value ->> 'prepared_operation_id' from c5c3_scratch where key = 'o3_prepare')::uuid,
    'c5c38000-0000-4000-8000-000000000005'
  )
));
reset role;

select is(
  (select value ->> 'code' from c5c3_scratch where key = 'o3_finalize'),
  'credit_account_terms_force_method',
  '34 finalize independently re-checks the credit-forcing rule and denies the stale card method'
);

select is(
  (select value ->> 'compensation' from c5c3_scratch where key = 'o3_finalize'),
  'void_new_card_authorization',
  '35 the denial reports a durable void-compensation intent for the newly succeeded authorization'
);

select is(
  (select count(*) from public.gyeon_order_external_compensation_outbox where evidence_id = 'c5c38000-0000-4000-8000-000000000005'),
  1::bigint,
  '36 exactly one compensation-outbox row is inserted for the new authorization'
);

select is(
  (select status from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000003'),
  'draft',
  '37 the original order is never mutated by a compensated finalize failure'
);

select is(
  (select consumed_at from public.gyeon_order_external_evidence_v1 where id = 'c5c38000-0000-4000-8000-000000000005'),
  null::timestamptz,
  '38 the original new authorization is left unconsumed, never mutated, pending external void'
);

-- Replay (retry with a different idempotency key, simulating a client retry
-- after the same denial) must never create a second compensation row.
set local role authenticated;
select (public.finalize_gyeon_order_v3_owner_submit_rpc(
  'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
  'c5c36000-0000-4000-8000-000000000003',1,'c5c39000-0000-4000-8000-00000000000e',
  'card',null,
  (select value ->> 'prepared_operation_id' from c5c3_scratch where key = 'o3_prepare')::uuid,
  'c5c38000-0000-4000-8000-000000000005'
));
reset role;

select is(
  (select count(*) from public.gyeon_order_external_compensation_outbox where evidence_id = 'c5c38000-0000-4000-8000-000000000005'),
  1::bigint,
  '39 a retried denial never creates a second compensation-outbox row for the same authorization'
);

-- ===========================================================================
-- Order O4: active credit-account terms force credit_account at prepare
-- time, and release revalidates the exact bound terms version.
-- ===========================================================================

insert into public.product_orders(
  id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status,
  destination_kind,delivery_snapshot,merchandise_list_ex_tax_yen,shipping_fee_ex_tax_yen,tax_yen,
  grand_total_inc_tax_yen,contains_backorder
) values (
  'c5c36000-0000-4000-8000-000000000004','c5c31000-0000-4000-8000-000000000001','draft','c5c30000-0000-4000-8000-000000000001',1,
  'not_requested','selection_required','own_store','{}'::jsonb,20000,0,2000,22000,false
);
insert into public.product_order_items(
  order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot
) values (
  'c5c36000-0000-4000-8000-000000000004','c5c33000-0000-4000-8000-000000000001','C5C3-A','C5C3 Product A',22000,1,15000,20000
);

set local role authenticated;
select throws_ok(
  $$select public.prepare_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000004',1,'card',null)$$,
  '42501','CREDIT_ACCOUNT_TERMS_FORCE_METHOD',
  '40 active credit-account terms force credit_account and reject card at prepare time, before any prepared row'
);
reset role;

select is(
  (select count(*) from public.gyeon_order_prepared_operations_v1 where order_id = 'c5c36000-0000-4000-8000-000000000004'),
  0::bigint,
  '41 the rejected prepare call never creates a prepared operation'
);

set local role authenticated;
insert into c5c3_scratch values ('o4_finalize', (
  select public.finalize_gyeon_order_v3_owner_submit_rpc(
    'c5c31000-0000-4000-8000-000000000001','c5c30000-0000-4000-8000-000000000001',
    'c5c36000-0000-4000-8000-000000000004',1,'c5c39000-0000-4000-8000-00000000000f',
    'credit_account',null,null,null
  )
));
reset role;

select is(
  (select (value ->> 'ok')::boolean from c5c3_scratch where key = 'o4_finalize'),
  true,
  '42 finalize succeeds for credit_account once active/effective terms exist'
);

select is(
  (select payment_contract_kind from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000004'),
  'credit_account',
  '43 the frozen snapshot records credit_account'
);

select is(
  (select payment_contract_credit_terms_version from public.product_orders where id = 'c5c36000-0000-4000-8000-000000000004'),
  1::bigint,
  '44 the frozen snapshot binds the exact credit-terms version used at finalize'
);

update public.gyeon_dealer_credit_terms set credit_state = 'stopped' where dealer_id = 'c5c31000-0000-4000-8000-000000000001';

set local role service_role;
select throws_ok(
  $$select public.release_gyeon_order_v3_warehouse_rpc(
    'c5c36000-0000-4000-8000-000000000004','c5c30000-0000-4000-8000-000000000099','c5c39000-0000-4000-8000-000000000010')$$,
  '55000','CREDIT_ACCOUNT_NOT_ENABLED',
  '45 warehouse release revalidates the exact bound terms version and denies once it is stopped'
);
reset role;

-- ===========================================================================
-- Warehouse-only functions run as service_role, matching their exclusive
-- execute grant.
-- ===========================================================================

set local role service_role;

select throws_ok(
  $$select public.release_gyeon_order_v3_warehouse_rpc(
    '00000000-0000-4000-8000-000000000000','c5c30000-0000-4000-8000-000000000099','c5c39000-0000-4000-8000-000000000011')$$,
  'P0002','ORDER_NOT_FOUND',
  '46 release against a nonexistent order fails closed instead of silently no-op'
);

reset role;

-- ===========================================================================
-- No function accepts a client-authoritative role, price, or evidence
-- success flag. Signature review confirms only server-computed inputs.
-- ===========================================================================

select is(
  (select count(*) from information_schema.parameters
    where specific_schema = 'public' and specific_name in (
      select specific_name from information_schema.routines
      where routine_schema = 'public' and routine_name like '%gyeon_order%v3%'
    )
    and parameter_name in ('p_role','p_price','p_evidence_success','p_qualification_mode','p_qualification_verified')),
  0::bigint,
  '47 no public C5-B function signature accepts a client role, price, or evidence-success parameter'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%'
    and (pg_get_functiondef(p.oid) ilike '%http%' or pg_get_functiondef(p.oid) ilike '%net.http%' or pg_get_functiondef(p.oid) ilike '%pg_net%')),
  0::bigint,
  '48 no C5-B function body references an HTTP or network call'
);

select * from finish();
rollback;
