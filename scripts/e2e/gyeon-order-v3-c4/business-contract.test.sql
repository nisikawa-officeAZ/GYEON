-- GYEON_ORDER_V3_C4_R1_BUSINESS_CONTRACT
-- Disposable PostgreSQL 17 only.
-- IMPORTANT: JWT claims below are SQL/RLS claim simulation. They prove
-- database behavior only and never replace real Auth/PostgREST evidence.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, pg_temp, public, pg_catalog;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000','c4000000-0000-4000-8000-000000000001','authenticated','authenticated','c4-owner@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','c4000000-0000-4000-8000-000000000002','authenticated','authenticated','c4-staff@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','c4000000-0000-4000-8000-000000000003','authenticated','authenticated','c4-readonly@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','c4000000-0000-4000-8000-000000000004','authenticated','authenticated','c4-foreign@example.invalid','',now(),'{}','{}',now(),now());

insert into public.dealers(id,name,dealer_type,status) values
  ('c4100000-0000-4000-8000-000000000001','C4 Dealer A','GYEON_DETAILER','active'),
  ('c4100000-0000-4000-8000-000000000002','C4 Dealer B','GYEON_DETAILER','active');

insert into public.dealer_members(id,dealer_id,user_id,role,status) values
  ('c4200000-0000-4000-8000-000000000001','c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','owner','active'),
  ('c4200000-0000-4000-8000-000000000002','c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002','staff','active'),
  ('c4200000-0000-4000-8000-000000000003','c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000003','readonly','active'),
  ('c4200000-0000-4000-8000-000000000004','c4100000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000004','owner','active');

insert into public.gyeon_ordering_memberships(dealer_id,membership_status,buyer_rank,effective_from) values
  ('c4100000-0000-4000-8000-000000000001','active','detailer',now()-interval '1 day'),
  ('c4100000-0000-4000-8000-000000000002','active','detailer',now()-interval '1 day');

insert into public.gyeon_products(id,sku,product_name,category,is_active) values
  ('c4300000-0000-4000-8000-000000000001','C4-NORMAL','C4 Normal','coating',true),
  ('c4300000-0000-4000-8000-000000000002','C4-PROMO','C4 Promo','promotional_goods',true);

insert into public.gyeon_product_order_offers_v3(
  id,product_id,buyer_rank,tax_rate_bps,list_price_ex_tax_yen,list_price_inc_tax_yen,
  purchase_price_ex_tax_yen,purchase_price_inc_tax_yen,is_promotional_goods,
  intentional_free,backorder_permitted,publication_state,is_sellable,offer_version,effective_from,authority_updated_at
) values
  ('c4400000-0000-4000-8000-000000000001','c4300000-0000-4000-8000-000000000001','detailer',1000,20000,22000,15000,16500,false,false,true,'published',true,1,now()-interval '1 day',now()),
  ('c4400000-0000-4000-8000-000000000002','c4300000-0000-4000-8000-000000000002','detailer',1000,5000,5500,0,0,true,true,true,'published',true,1,now()-interval '1 day',now());

insert into public.gyeon_order_supply_projection(
  product_id,authority_state,formal_inventory_qty,reserved_qty,
  inbound_confirmed_pending_stocktake_qty,orderable_qty,backorder_allowed,
  source_version,observed_at
) values
  ('c4300000-0000-4000-8000-000000000001','CONFIGURED',3,0,0,3,true,'c4-supply-v1',now()),
  ('c4300000-0000-4000-8000-000000000002','CONFIGURED',10,0,0,10,true,'c4-supply-v1',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','c4000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"c4000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

select is(
  (select count(*) from public.list_gyeon_order_catalog_v3_rpc('c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002')),
  2::bigint,
  '01 active staff sees the two rank-qualified catalog entries'
);

select throws_ok(
  $$select public.save_gyeon_order_v3_draft_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002',
    'c4500000-0000-4000-8000-000000000001',null,0,
    '[{"product_id":"c4300000-0000-4000-8000-000000000001","quantity":1,"price":1}]', '{}')$$,
  '22023','CLIENT_COMMERCIAL_FIELDS_FORBIDDEN',
  '02 client-supplied commercial fields are rejected'
);

select lives_ok(
  $$select public.save_gyeon_order_v3_draft_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002',
    'c4500000-0000-4000-8000-000000000002',null,0,
    '[{"product_id":"c4300000-0000-4000-8000-000000000001","quantity":2},{"product_id":"c4300000-0000-4000-8000-000000000002","quantity":1}]',
    '{"destination_kind":"own_store","delivery_snapshot":{"label":"C4 Dealer A"}}')$$,
  '03 staff can create a server-priced draft'
);

select is((select merchandise_list_ex_tax_yen from public.product_orders where dealer_id='c4100000-0000-4000-8000-000000000001'),45000,'04 list-price total includes promotional goods');
select is((select free_shipping_basis_ex_tax_yen from public.product_orders where dealer_id='c4100000-0000-4000-8000-000000000001'),40000,'05 free-shipping basis excludes promotional goods');
select is((select sum(line_total_ex_tax_snapshot)::integer from public.product_order_items),30000,'06 purchase totals are rebuilt from server offers');

select lives_ok(
  $$select public.save_gyeon_order_v3_draft_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002',
    'c4500000-0000-4000-8000-000000000002',null,0,
    '[{"product_id":"c4300000-0000-4000-8000-000000000001","quantity":2},{"product_id":"c4300000-0000-4000-8000-000000000002","quantity":1}]',
    '{"destination_kind":"own_store","delivery_snapshot":{"label":"C4 Dealer A"}}')$$,
  '07 identical idempotent replay returns without duplicating the order'
);
select is((select count(*) from public.product_orders where dealer_id='c4100000-0000-4000-8000-000000000001'),1::bigint,'08 identical idempotent replay creates one order');

select throws_ok(
  $$select public.save_gyeon_order_v3_draft_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002',
    'c4500000-0000-4000-8000-000000000002',null,0,
    '[{"product_id":"c4300000-0000-4000-8000-000000000001","quantity":3}]','{}')$$,
  '23505','IDEMPOTENCY_KEY_REUSED',
  '09 same key with a different payload is rejected'
);

select set_config('request.jwt.claim.sub','c4000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"c4000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok(
  $$select public.save_gyeon_order_v3_draft_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000003',
    'c4500000-0000-4000-8000-000000000003',null,0,
    '[{"product_id":"c4300000-0000-4000-8000-000000000001","quantity":1}]','{}')$$,
  '42501','ORDERING_AUTHORITY_DENIED','10 readonly member cannot save a draft'
);

select set_config('request.jwt.claim.sub','c4000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"c4000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.product_orders),0::bigint,'11 foreign tenant sees no Dealer A order');

select set_config('request.jwt.claim.sub','c4000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"c4000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok(
  $$select public.request_gyeon_order_v3_owner_review_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002',
    (select id from public.product_orders limit 1),1,'c4500000-0000-4000-8000-000000000004','please review')$$,
  '12 staff can request owner review'
);
select is((select owner_review_state from public.product_orders limit 1),'pending','13 owner-review state is pending');
reset role;
select is((select channels from public.gyeon_order_notification_outbox limit 1),array['bell','email']::text[],'14 owner request queues bell and email');

set local role authenticated;
select set_config('request.jwt.claim.sub','c4000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c4000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok(
  $$select public.owner_submit_gyeon_order_v3_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001',
    (select id from public.product_orders limit 1),2,'c4500000-0000-4000-8000-000000000005',
    'bank_transfer_prepaid',null,null)$$,
  '0A000','QUALIFICATION_AUTHORITY_NOT_CONFIGURED',
  '15 submission fails closed until qualification authority is connected'
);

select lives_ok(
  $$select public.cancel_gyeon_order_v3_before_warehouse_rpc(
    'c4100000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001',
    (select id from public.product_orders limit 1),2,'c4500000-0000-4000-8000-000000000006')$$,
  '16 owner can cancel a pre-warehouse draft'
);

reset role;
select * from finish();
rollback;
