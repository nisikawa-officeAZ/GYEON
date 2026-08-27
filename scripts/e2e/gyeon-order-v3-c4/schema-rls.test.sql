-- GYEON_ORDER_V3_C4_R1_SCHEMA_RLS
-- Disposable PostgreSQL 17 only. This file proves catalog shape, RLS and
-- grants; it does not replace real Auth/PostgREST request-scope proof.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, pg_temp, public, pg_catalog;

select plan(30);

create temp table c4_tables(name text primary key);
insert into c4_tables(name) values
  ('product_orders'),
  ('product_order_items'),
  ('gyeon_ordering_memberships'),
  ('gyeon_product_order_offers_v3'),
  ('gyeon_order_supply_projection'),
  ('gyeon_order_shipping_rule_versions'),
  ('gyeon_warehouse_calendar_days'),
  ('gyeon_dealer_credit_terms'),
  ('gyeon_order_idempotency_v3'),
  ('gyeon_order_owner_review_events'),
  ('gyeon_order_payment_evidence'),
  ('gyeon_order_warehouse_tasks'),
  ('gyeon_order_notification_outbox');

select is(
  (select count(*) from c4_tables t join pg_class c on c.relname = t.name join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
  13::bigint,
  '01 all thirteen bounded C4 tables exist'
);

select is(
  (select count(*) from c4_tables t join pg_class c on c.relname = t.name join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity),
  13::bigint,
  '02 RLS is enabled on every bounded C4 table'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'product_orders' and policyname = 'gyeon_order_v3_select' and cmd = 'SELECT'),
  1::bigint,
  '03 product_orders has the exact dealer SELECT policy'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'product_order_items' and policyname = 'gyeon_order_item_v3_select' and cmd = 'SELECT'),
  1::bigint,
  '04 product_order_items has the exact item SELECT policy'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename in (select name from c4_tables) and cmd <> 'SELECT'),
  0::bigint,
  '05 no bounded C4 table exposes a direct-write RLS policy'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c4_tables) and grantee = 'anon'),
  0::bigint,
  '06 anon has no bounded C4 table privilege'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c4_tables) and grantee = 'authenticated' and privilege_type = 'SELECT'),
  2::bigint,
  '07 authenticated has SELECT only on order aggregates'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c4_tables) and grantee = 'authenticated' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')),
  0::bigint,
  '08 authenticated has no direct mutation privilege'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c4_tables) and grantee = 'service_role' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')),
  52::bigint,
  '09 service_role has the bounded four table privileges on thirteen tables'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c4_tables) and grantee in ('authenticated','service_role') and is_grantable <> 'NO'),
  0::bigint,
  '10 no application table grant is grantable'
);

select has_column('public', 'product_orders', 'aggregate_version', '11 product_orders has aggregate_version');
select has_column('public', 'product_orders', 'owner_review_state', '12 product_orders has owner_review_state');
select has_column('public', 'product_orders', 'earliest_ship_date', '13 product_orders has earliest_ship_date');
select has_column('public', 'product_order_items', 'offer_version_snapshot', '14 items snapshot the offer version');
select has_column('public', 'product_order_items', 'backorder_qty_snapshot', '15 items snapshot backorder quantity');

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.product_orders'::regclass and conname = 'product_orders_status_check')
    like '%draft%submitted%approved%fulfilling%fulfilled%cancelled%',
  '16 aggregate status is the exact six-state contract'
);

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.gyeon_product_order_offers_v3'::regclass and conname like '%order_unit_qty%') is not null
  and (select count(*) from pg_constraint where conrelid = 'public.gyeon_product_order_offers_v3'::regclass and pg_get_constraintdef(oid) like '%order_unit_qty = 1%') = 1,
  '17 order unit is exactly one item'
);

select is(
  (select column_default from information_schema.columns where table_schema='public' and table_name='gyeon_order_shipping_rule_versions' and column_name='free_shipping_threshold_ex_tax_yen'),
  '30000'::text,
  '18 free-shipping default is tax-exclusive 30000 yen'
);

select ok(
  (select count(*) from pg_constraint where conrelid='public.gyeon_warehouse_calendar_days'::regclass and pg_get_constraintdef(oid) like '%operating_mode%closed%cutoff_minute_jst%') >= 1,
  '19 warehouse operating day and cutoff are contract-bound'
);

select ok(
  (select count(*) from pg_constraint where conrelid='public.gyeon_order_supply_projection'::regclass and pg_get_constraintdef(oid) like '%CONFIGURED%formal_inventory_qty%orderable_qty%') >= 1,
  '20 configured supply requires distinct authority quantities'
);

select is(
  (select count(*) from pg_indexes where schemaname='public' and tablename='gyeon_product_order_offers_v3' and indexname='gyeon_offer_one_current_version_idx' and indexdef like '%WHERE (effective_to IS NULL)%'),
  1::bigint,
  '21 each rank and product has one current offer'
);

select is(
  (select count(*) from pg_constraint where conrelid='public.gyeon_order_idempotency_v3'::regclass and contype='p'),
  1::bigint,
  '22 idempotency ledger has a primary key'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
    'list_gyeon_order_catalog_v3_rpc','save_gyeon_order_v3_draft_rpc','request_gyeon_order_v3_owner_review_rpc',
    'owner_submit_gyeon_order_v3_rpc','edit_gyeon_order_v3_before_warehouse_rpc',
    'cancel_gyeon_order_v3_before_warehouse_rpc','accept_gyeon_order_v3_warehouse_rpc')),
  7::bigint,
  '23 all seven public entrypoints exist'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'gyeon_order_v3_%'),
  4::bigint,
  '24 all four private helpers exist'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and p.prosecdef),
  10::bigint,
  '25 ten mutation/read authority functions are SECURITY DEFINER'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and coalesce(array_to_string(p.proconfig, ','),'') not like '%search_path=%'),
  0::bigint,
  '26 every C4 function pins search_path'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='private' and routine_name like 'gyeon_order_v3_%' and grantee in ('PUBLIC','anon','authenticated','service_role')),
  0::bigint,
  '27 no application role can execute private helpers'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name like '%gyeon_order%v3%' and grantee='anon'),
  0::bigint,
  '28 anon cannot execute any public C4 RPC'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name like '%gyeon_order%v3%' and grantee='authenticated'),
  6::bigint,
  '29 authenticated can execute exactly six dealer-facing RPCs'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and pg_get_functiondef(p.oid) like '%auth.role()%'),
  0::bigint,
  '30 no C4 function authorizes through auth.role()'
);

select * from finish();
rollback;
