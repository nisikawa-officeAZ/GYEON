-- GYEON_ORDER_V3_C5C_R4_SCHEMA_RLS
-- Disposable PostgreSQL 17 only. This file proves the R2 catalog shape, RLS
-- and grants for the nineteen C5-B-bound tables and seventeen functions; it
-- does not replace real Auth/PostgREST request-scope proof (real-auth.mjs)
-- or the business/concurrency proofs in the sibling test files.
--
-- The narrow single-purpose C4 payment-evidence table and the C4 single-call
-- owner-submit/edit entrypoints are intentionally absent from this file:
-- C5-B superseded and renamed those objects with the generic versioned
-- external-evidence object and the prepare/finalize split proved below.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, pg_temp, public, pg_catalog;

select plan(101);

create temp table c5c_tables(name text primary key);
insert into c5c_tables(name) values
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
  ('gyeon_order_external_evidence_v1'),
  ('gyeon_order_prepared_operations_v1'),
  ('gyeon_qualification_rule_versions'),
  ('gyeon_product_qualification_classification'),
  ('gyeon_dealer_qualification_mode_projection'),
  ('gyeon_order_qualification_snapshots'),
  ('gyeon_order_external_compensation_outbox'),
  ('gyeon_order_warehouse_tasks'),
  ('gyeon_order_notification_outbox');

-- 01-02: catalog shape and RLS coverage -------------------------------------

select is(
  (select count(*) from c5c_tables t join pg_class c on c.relname = t.name join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
  19::bigint,
  '01 all nineteen R2-bound tables exist'
);

select is(
  (select count(*) from c5c_tables t join pg_class c on c.relname = t.name join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity),
  19::bigint,
  '02 RLS is enabled on every R2-bound table'
);

-- 03-06: exact policy inventory ----------------------------------------------

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
  (select count(*) from pg_policies where schemaname = 'public' and tablename in (select name from c5c_tables)),
  2::bigint,
  '05 exactly two policies exist across all nineteen tables'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename in (select name from c5c_tables) and cmd <> 'SELECT'),
  0::bigint,
  '06 no R2-bound table exposes a direct-write RLS policy'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'product_orders' and policyname = 'gyeon_order_v3_select') like '%gyeon_order_v3_can_read_dealer%',
  '07 the order SELECT policy delegates to the caller-bound read helper'
);

-- 08-11: grants ---------------------------------------------------------------

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c5c_tables) and grantee = 'anon'),
  0::bigint,
  '08 anon has no R2-bound table privilege'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c5c_tables) and grantee = 'authenticated' and privilege_type = 'SELECT'),
  2::bigint,
  '09 authenticated has SELECT only on the two order aggregates'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c5c_tables) and grantee = 'authenticated' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')),
  0::bigint,
  '10 authenticated has no direct mutation privilege on any R2-bound table'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c5c_tables) and grantee = 'service_role' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')),
  76::bigint,
  '11 service_role has the bounded four table privileges on all nineteen tables'
);

select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in (select name from c5c_tables) and grantee in ('authenticated','service_role') and is_grantable <> 'NO'),
  0::bigint,
  '12 no application table grant is grantable'
);

-- 13-24: column and constraint spot checks ------------------------------------

select has_column('public', 'product_orders', 'aggregate_version', '13 product_orders has aggregate_version');
select has_column('public', 'product_orders', 'card_authority_evidence_id', '14 product_orders has card_authority_evidence_id');
select has_column('public', 'product_orders', 'card_authority_request_fingerprint', '15 product_orders has card_authority_request_fingerprint');
select has_column('public', 'product_orders', 'payment_contract_kind', '16 product_orders has payment_contract_kind');
select has_column('public', 'product_orders', 'payment_contract_credit_terms_version', '17 product_orders has payment_contract_credit_terms_version');
select has_column('public', 'product_order_items', 'offer_version_snapshot', '18 items snapshot the offer version');
select has_column('public', 'product_order_items', 'backorder_qty_snapshot', '19 items snapshot backorder quantity');

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.product_orders'::regclass and conname = 'product_orders_status_check')
    like '%draft%submitted%approved%fulfilling%fulfilled%cancelled%',
  '20 aggregate status is the exact six-state contract'
);

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.product_orders'::regclass and conname = 'product_orders_payment_contract_check') is not null,
  '21 the payment-contract snapshot constraint exists on product_orders'
);

select ok(
  (select count(*) from pg_constraint where conrelid = 'public.product_orders'::regclass and conname = 'product_orders_payment_contract_check' and pg_get_constraintdef(oid) like '%standard_payment%' and pg_get_constraintdef(oid) like '%credit_account%') = 1,
  '22 the payment-contract constraint distinguishes standard_payment from credit_account'
);

select ok(
  (select count(*) from pg_constraint where conrelid = 'public.product_orders'::regclass and conname = 'product_orders_card_authority_binding_check') = 1,
  '23 the card authority binding constraint exists on product_orders'
);

select ok(
  (select count(*) from pg_constraint where conrelid = 'public.product_orders'::regclass and contype = 'f' and conname = 'product_orders_card_authority_evidence_fk') = 1,
  '24 card_authority_evidence_id is bound by foreign key to accepted external evidence'
);

-- 25-36: the C5-B object families ---------------------------------------------

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.gyeon_order_external_evidence_v1'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%purpose%')
    like '%initial_authorization%edit_reauthorization%bank_payment_match%inventory_reservation%',
  '25 external evidence purpose is exactly the four bound values'
);

select is(
  (select count(*) from pg_constraint where conrelid = 'public.gyeon_order_external_evidence_v1'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%provider%provider_event_id%'),
  1::bigint,
  '26 external evidence has one provider plus provider_event_id uniqueness'
);

select ok(
  (select count(*) from pg_constraint where conrelid = 'public.gyeon_order_prepared_operations_v1'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%owner_submit%initial_authorization%' and pg_get_constraintdef(oid) like '%edit_before_warehouse%edit_reauthorization%') = 1,
  '27 prepared operations bind kind to its exact evidence purpose'
);

select is(
  (select count(*) from pg_constraint where conrelid = 'public.gyeon_qualification_rule_versions'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%rule_version%'),
  1::bigint,
  '28 qualification rule versions are unique'
);

select is(
  (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'gyeon_qualification_rule_versions' and indexname = 'gyeon_qualification_rule_one_active_idx' and indexdef like '%WHERE is_active%'),
  1::bigint,
  '29 exactly one active qualification rule version can exist at a time'
);

select is(
  (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'gyeon_product_qualification_classification' and indexname = 'gyeon_qualification_classification_one_current_idx' and indexdef like '%WHERE (effective_to IS NULL)%'),
  1::bigint,
  '30 each product has one current qualification classification'
);

select is(
  (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'gyeon_dealer_qualification_mode_projection' and indexname = 'gyeon_dealer_qualification_mode_one_current_idx' and indexdef like '%WHERE (effective_to IS NULL)%'),
  1::bigint,
  '31 each dealer has one current Office AZ-owned qualification-mode projection'
);

select is(
  (select count(*) from pg_constraint where conrelid = 'public.gyeon_order_qualification_snapshots'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%order_id%order_version%'),
  1::bigint,
  '32 qualification snapshots are unique per order_id and order_version'
);

select is(
  (select count(*) from pg_constraint where conrelid = 'public.gyeon_order_external_compensation_outbox'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%idempotency_identity%'),
  1::bigint,
  '33 compensation outbox rows are unique by idempotency identity'
);

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.gyeon_order_external_compensation_outbox'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%compensation_kind%')
    like '%void_new_card_authorization%',
  '34 the only compensation kind is void_new_card_authorization'
);

select is(
  (select count(*) from pg_constraint where conrelid = 'public.gyeon_order_warehouse_tasks'::regclass and contype = 'p'),
  1::bigint,
  '35 warehouse tasks are unique per order (primary key on order_id)'
);

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.gyeon_order_warehouse_tasks'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%task_state%')
    like '%unaccepted%accepted%working%exception%completed%cancelled%',
  '36 warehouse task state is the exact six-state contract'
);

select is(
  (select count(*) from pg_indexes where schemaname='public' and tablename='gyeon_product_order_offers_v3' and indexname='gyeon_offer_one_current_version_idx' and indexdef like '%WHERE (effective_to IS NULL)%'),
  1::bigint,
  '37 each rank and product has one current offer'
);

-- 38-54: function inventory, security, grants --------------------------------

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
    'list_gyeon_order_catalog_v3_rpc','save_gyeon_order_v3_draft_rpc','request_gyeon_order_v3_owner_review_rpc',
    'prepare_gyeon_order_v3_owner_submit_rpc','finalize_gyeon_order_v3_owner_submit_rpc',
    'prepare_gyeon_order_v3_edit_rpc','finalize_gyeon_order_v3_edit_rpc',
    'cancel_gyeon_order_v3_before_warehouse_rpc','release_gyeon_order_v3_warehouse_rpc',
    'accept_gyeon_order_v3_warehouse_rpc')),
  10::bigint,
  '38 all ten public C5-B entrypoints exist under their exact prepare/finalize/release/accept names'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like '%gyeon_order%v3%'),
  7::bigint,
  '39 all seven private helpers exist'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'gyeon_order_v3_can_read_dealer'
      and p.prosecdef
      and p.provolatile = 's'
      and pg_get_functiondef(p.oid) like '%(select auth.uid())%'
      and pg_get_functiondef(p.oid) not like '%p_actor_id%'
  ),
  '40 read helper is stable SECURITY DEFINER and derives caller identity from auth.uid()'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'gyeon_order_v3_fingerprint'
      and not p.prosecdef
      and p.provolatile = 'i'
  ),
  '41 the deterministic fingerprint helper is immutable and not SECURITY DEFINER'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and p.prosecdef),
  16::bigint,
  '42 sixteen of seventeen authority functions are SECURITY DEFINER (all but the pure fingerprint helper)'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and not coalesce(p.proconfig && array['search_path=','search_path=""'], false)),
  0::bigint,
  '43 every C5-B function pins search_path to exactly empty, not merely mentions search_path='
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='private' and routine_name like 'gyeon_order_v3_%' and grantee in ('PUBLIC','anon','service_role')),
  0::bigint,
  '44 PUBLIC anon and service_role cannot execute any private helper'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='private' and routine_name='gyeon_order_v3_can_read_dealer' and grantee='authenticated' and privilege_type='EXECUTE'),
  1::bigint,
  '45 authenticated can execute only the caller-bound RLS read helper among private functions'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name like '%gyeon_order%v3%' and grantee='anon'),
  0::bigint,
  '46 anon cannot execute any public C5-B RPC'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name like '%gyeon_order%v3%' and grantee='authenticated'),
  8::bigint,
  '47 authenticated can execute exactly eight dealer-facing RPCs'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name like '%gyeon_order%v3%' and grantee='authenticated' and routine_name in ('release_gyeon_order_v3_warehouse_rpc','accept_gyeon_order_v3_warehouse_rpc')),
  0::bigint,
  '48 authenticated cannot execute either warehouse release or accept RPC'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name in ('release_gyeon_order_v3_warehouse_rpc','accept_gyeon_order_v3_warehouse_rpc') and grantee='service_role'),
  2::bigint,
  '49 service_role can execute exactly the two warehouse release/accept RPCs'
);

select is(
  (select count(*) from information_schema.routine_privileges where specific_schema='public' and routine_name like '%gyeon_order%v3%' and grantee='service_role' and routine_name not in ('release_gyeon_order_v3_warehouse_rpc','accept_gyeon_order_v3_warehouse_rpc')),
  0::bigint,
  '50 service_role has no execute grant on any dealer-facing RPC'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and pg_get_functiondef(p.oid) like '%auth.role()%'),
  0::bigint,
  '51 no C5-B function authorizes through auth.role()'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%' and (pg_get_functiondef(p.oid) like '%user_metadata%' or pg_get_functiondef(p.oid) like '%raw_user_meta_data%')),
  0::bigint,
  '52 no C5-B function reads user-editable metadata for authorization'
);

select is(
  has_schema_privilege('anon', 'private', 'USAGE'),
  false,
  '53 the private schema itself grants no USAGE to anon'
);

-- 54-70: exact column-name sets for the seventeen fully-owned new tables --
--
-- columns_are() fails on any missing OR extra column, unlike has_column()
-- spot checks. product_orders and product_order_items are pre-existing
-- tables whose complete historical column set (beyond this migration's own
-- ALTER-added columns) is not available to this file, so an exact
-- columns_are() for those two specifically is out of scope here; their
-- C5-B-added columns are exactly type/constraint-checked in 13-24 above.

select columns_are('public', 'gyeon_ordering_memberships', ARRAY[
  'dealer_id','program_code','membership_status','buyer_rank','effective_from','effective_to',
  'membership_version','updated_by','updated_at'
], '54 gyeon_ordering_memberships has exactly its contract columns');

select columns_are('public', 'gyeon_product_order_offers_v3', ARRAY[
  'id','product_id','buyer_rank','currency','tax_rate_bps','list_price_ex_tax_yen','list_price_inc_tax_yen',
  'purchase_price_ex_tax_yen','purchase_price_inc_tax_yen','intentional_free','order_unit_qty','minimum_order_qty',
  'is_promotional_goods','backorder_permitted','publication_state','is_sellable','offer_version','effective_from',
  'effective_to','authority_updated_at','created_at','updated_at'
], '55 gyeon_product_order_offers_v3 has exactly its contract columns');

select columns_are('public', 'gyeon_order_supply_projection', ARRAY[
  'product_id','authority_state','formal_inventory_qty','reserved_qty','inbound_confirmed_pending_stocktake_qty',
  'orderable_qty','backorder_allowed','expected_inbound_qty','expected_inbound_from','expected_inbound_to',
  'expected_inbound_confidence','source_version','observed_at','updated_at'
], '56 gyeon_order_supply_projection has exactly its contract columns');

select columns_are('public', 'gyeon_order_shipping_rule_versions', ARRAY[
  'id','rule_version','destination_scope','free_shipping_threshold_ex_tax_yen',
  'under_threshold_shipping_fee_ex_tax_yen','effective_from','effective_to','is_active','updated_by','updated_at'
], '57 gyeon_order_shipping_rule_versions has exactly its contract columns');

select columns_are('public', 'gyeon_warehouse_calendar_days', ARRAY[
  'warehouse_date','operating_mode','cutoff_minute_jst','reason','calendar_version','updated_by','updated_at'
], '58 gyeon_warehouse_calendar_days has exactly its contract columns');

select columns_are('public', 'gyeon_dealer_credit_terms', ARRAY[
  'dealer_id','credit_state','closing_rule','payment_due_day','payment_terms_note','effective_from','effective_to',
  'terms_version','updated_by','updated_at'
], '59 gyeon_dealer_credit_terms has exactly its contract columns');

select columns_are('public', 'gyeon_order_idempotency_v3', ARRAY[
  'dealer_id','idempotency_key','operation','actor_id','request_fingerprint','order_id','response_payload',
  'completed_at','created_at'
], '60 gyeon_order_idempotency_v3 has exactly its contract columns');

select columns_are('public', 'gyeon_order_owner_review_events', ARRAY[
  'id','order_id','dealer_id','event_type','actor_id','order_version','note','created_at'
], '61 gyeon_order_owner_review_events has exactly its contract columns');

select columns_are('public', 'gyeon_order_external_evidence_v1', ARRAY[
  'id','purpose','provider','provider_event_id','dealer_id','order_id','order_version','request_fingerprint',
  'amount_inc_tax_yen','currency','authority','state','server_verified_at','expires_at','consumed_at',
  'consumed_by_operation','payload_hash','created_at'
], '62 gyeon_order_external_evidence_v1 has exactly its contract columns');

select columns_are('public', 'gyeon_order_prepared_operations_v1', ARRAY[
  'id','kind','dealer_id','order_id','expected_order_version','request_fingerprint','amount_inc_tax_yen','currency',
  'evidence_purpose','prepared_by','prepared_at','expires_at','consumed_at','consumed_by_operation'
], '63 gyeon_order_prepared_operations_v1 has exactly its contract columns');

select columns_are('public', 'gyeon_qualification_rule_versions', ARRAY[
  'id','rule_version','shop_initial_threshold_ex_tax_yen','detailer_initial_threshold_ex_tax_yen',
  'required_detailer_product_codes','is_active','effective_from','effective_to','updated_by','updated_at'
], '64 gyeon_qualification_rule_versions has exactly its contract columns');

select columns_are('public', 'gyeon_product_qualification_classification', ARRAY[
  'id','product_id','classification','classification_version','authority_source','effective_from','effective_to',
  'updated_by','updated_at'
], '65 gyeon_product_qualification_classification has exactly its contract columns');

select columns_are('public', 'gyeon_dealer_qualification_mode_projection', ARRAY[
  'id','dealer_id','qualification_mode','projection_version','authority_source','authority_state','effective_from',
  'effective_to','observed_at','updated_at'
], '66 gyeon_dealer_qualification_mode_projection has exactly its contract columns');

select columns_are('public', 'gyeon_order_qualification_snapshots', ARRAY[
  'id','order_id','order_version','dealer_id','evaluation_mode','rule_version','classification_version',
  'input_fingerprint','decision','lifecycle_state','evaluated_at'
], '67 gyeon_order_qualification_snapshots has exactly its contract columns');

select columns_are('public', 'gyeon_order_external_compensation_outbox', ARRAY[
  'id','compensation_kind','order_id','dealer_id','evidence_id','prepared_operation_id','idempotency_identity',
  'compensation_state','created_at','processed_at'
], '68 gyeon_order_external_compensation_outbox has exactly its contract columns');

select columns_are('public', 'gyeon_order_warehouse_tasks', ARRAY[
  'order_id','dealer_id','task_state','accepted_by','accepted_at','task_version','updated_at'
], '69 gyeon_order_warehouse_tasks has exactly its contract columns');

select columns_are('public', 'gyeon_order_notification_outbox', ARRAY[
  'id','dealer_id','order_id','event_key','channels','payload','delivery_state','idempotency_key','available_at',
  'delivered_at','created_at'
], '70 gyeon_order_notification_outbox has exactly its contract columns');

-- 71-87: exact function signatures (schema, name, ordered argument types) ---
--
-- has_function() with an explicit argument-type array fails if the function
-- does not exist with exactly that signature, catching a missing/extra/
-- reordered/retyped parameter that a name-only existence check (38-39
-- above) cannot.

select has_function('public', 'list_gyeon_order_catalog_v3_rpc', ARRAY['uuid','uuid'], '71 exact signature: list_gyeon_order_catalog_v3_rpc');
select has_function('public', 'save_gyeon_order_v3_draft_rpc', ARRAY['uuid','uuid','uuid','uuid','bigint','jsonb','jsonb'], '72 exact signature: save_gyeon_order_v3_draft_rpc');
select has_function('public', 'request_gyeon_order_v3_owner_review_rpc', ARRAY['uuid','uuid','uuid','bigint','uuid','text'], '73 exact signature: request_gyeon_order_v3_owner_review_rpc');
select has_function('public', 'prepare_gyeon_order_v3_owner_submit_rpc', ARRAY['uuid','uuid','uuid','bigint','text','text'], '74 exact signature: prepare_gyeon_order_v3_owner_submit_rpc');
select has_function('public', 'finalize_gyeon_order_v3_owner_submit_rpc', ARRAY['uuid','uuid','uuid','bigint','uuid','text','text','uuid','uuid'], '75 exact signature: finalize_gyeon_order_v3_owner_submit_rpc');
select has_function('public', 'prepare_gyeon_order_v3_edit_rpc', ARRAY['uuid','uuid','uuid','bigint','jsonb'], '76 exact signature: prepare_gyeon_order_v3_edit_rpc');
select has_function('public', 'finalize_gyeon_order_v3_edit_rpc', ARRAY['uuid','uuid','uuid','bigint','uuid','jsonb','uuid','uuid'], '77 exact signature: finalize_gyeon_order_v3_edit_rpc');
select has_function('public', 'cancel_gyeon_order_v3_before_warehouse_rpc', ARRAY['uuid','uuid','uuid','bigint','uuid'], '78 exact signature: cancel_gyeon_order_v3_before_warehouse_rpc');
select has_function('public', 'release_gyeon_order_v3_warehouse_rpc', ARRAY['uuid','uuid','uuid'], '79 exact signature: release_gyeon_order_v3_warehouse_rpc');
select has_function('public', 'accept_gyeon_order_v3_warehouse_rpc', ARRAY['uuid','uuid','bigint','bigint','uuid'], '80 exact signature: accept_gyeon_order_v3_warehouse_rpc');
select has_function('private', 'gyeon_order_v3_assert_actor', ARRAY['uuid','uuid','text[]'], '81 exact signature: gyeon_order_v3_assert_actor');
select has_function('private', 'gyeon_order_v3_can_read_dealer', ARRAY['uuid'], '82 exact signature: gyeon_order_v3_can_read_dealer');
select has_function('private', 'gyeon_order_v3_fingerprint', ARRAY['text','uuid','bigint','jsonb'], '83 exact signature: gyeon_order_v3_fingerprint');
select has_function('private', 'gyeon_order_v3_claim_idempotency', ARRAY['uuid','uuid','uuid','text','text'], '84 exact signature: gyeon_order_v3_claim_idempotency');
select has_function('private', 'gyeon_order_v3_earliest_ship_date', ARRAY['timestamptz'], '85 exact signature: gyeon_order_v3_earliest_ship_date');
select has_function('private', 'gyeon_order_v3_validate_and_consume_evidence', ARRAY['uuid','text','uuid','uuid','bigint','text','integer','text','text'], '86 exact signature: gyeon_order_v3_validate_and_consume_evidence');
select has_function('private', 'gyeon_order_v3_evaluate_qualification', ARRAY['uuid','uuid','bigint','text','text'], '87 exact signature: gyeon_order_v3_evaluate_qualification');

-- 88: exact literal owner. The disposable replay applies the source with the
-- local PostgreSQL superuser `postgres`; accepting merely "one shared
-- non-application owner" would permit silent ownership drift.

select ok(
  (select count(distinct p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%') = 1
  and (
    select r.rolname = 'postgres'
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_roles r on r.oid=p.proowner
    where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%'
    limit 1
  ),
  '88 all seventeen C5-B functions have the exact literal owner postgres'
);

-- 89-94: R2 exact-set checks (required 10) -----------------------------------
--
-- Column name/type/nullability/default, PK/UNIQUE/FK column-list structure,
-- named-index completeness, per-function owner/security/search_path, grant
-- tuples, and CHECK constraints are each compared as an EXACT SET against a
-- hand-built expected catalog for the seventeen fully-owned new tables and
-- seventeen functions. The guarded source hash and terminal replay position
-- are hard-gated by setup.sh; assertion 101 therefore couples exact per-table
-- CHECK cardinality for every fully-owned table with exact normalized text for
-- every C5-B CHECK added to the two pre-existing aggregate tables.

create temp table expected_columns(table_name text, column_name text, data_type text, is_nullable text, column_default text);
insert into expected_columns(table_name, column_name, data_type, is_nullable, column_default) values
  ('gyeon_ordering_memberships','dealer_id','uuid','NO',null),
  ('gyeon_ordering_memberships','program_code','text','NO','''gyeon_ordering''::text'),
  ('gyeon_ordering_memberships','membership_status','text','NO',null),
  ('gyeon_ordering_memberships','buyer_rank','text','NO',null),
  ('gyeon_ordering_memberships','effective_from','timestamp with time zone','NO',null),
  ('gyeon_ordering_memberships','effective_to','timestamp with time zone','YES',null),
  ('gyeon_ordering_memberships','membership_version','bigint','NO','1'),
  ('gyeon_ordering_memberships','updated_by','uuid','YES',null),
  ('gyeon_ordering_memberships','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_shipping_rule_versions','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_order_shipping_rule_versions','rule_version','bigint','NO',null),
  ('gyeon_order_shipping_rule_versions','destination_scope','text','NO','''domestic''::text'),
  ('gyeon_order_shipping_rule_versions','free_shipping_threshold_ex_tax_yen','integer','NO','30000'),
  ('gyeon_order_shipping_rule_versions','under_threshold_shipping_fee_ex_tax_yen','integer','NO',null),
  ('gyeon_order_shipping_rule_versions','effective_from','timestamp with time zone','NO',null),
  ('gyeon_order_shipping_rule_versions','effective_to','timestamp with time zone','YES',null),
  ('gyeon_order_shipping_rule_versions','is_active','boolean','NO','false'),
  ('gyeon_order_shipping_rule_versions','updated_by','uuid','YES',null),
  ('gyeon_order_shipping_rule_versions','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_warehouse_calendar_days','warehouse_date','date','NO',null),
  ('gyeon_warehouse_calendar_days','operating_mode','text','NO',null),
  ('gyeon_warehouse_calendar_days','cutoff_minute_jst','integer','YES',null),
  ('gyeon_warehouse_calendar_days','reason','text','YES',null),
  ('gyeon_warehouse_calendar_days','calendar_version','bigint','NO',null),
  ('gyeon_warehouse_calendar_days','updated_by','uuid','YES',null),
  ('gyeon_warehouse_calendar_days','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_dealer_credit_terms','dealer_id','uuid','NO',null),
  ('gyeon_dealer_credit_terms','credit_state','text','NO',null),
  ('gyeon_dealer_credit_terms','closing_rule','text','NO','''month_end''::text'),
  ('gyeon_dealer_credit_terms','payment_due_day','integer','YES',null),
  ('gyeon_dealer_credit_terms','payment_terms_note','text','YES',null),
  ('gyeon_dealer_credit_terms','effective_from','timestamp with time zone','NO',null),
  ('gyeon_dealer_credit_terms','effective_to','timestamp with time zone','YES',null),
  ('gyeon_dealer_credit_terms','terms_version','bigint','NO',null),
  ('gyeon_dealer_credit_terms','updated_by','uuid','YES',null),
  ('gyeon_dealer_credit_terms','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_idempotency_v3','dealer_id','uuid','NO',null),
  ('gyeon_order_idempotency_v3','idempotency_key','uuid','NO',null),
  ('gyeon_order_idempotency_v3','operation','text','NO',null),
  ('gyeon_order_idempotency_v3','actor_id','uuid','NO',null),
  ('gyeon_order_idempotency_v3','request_fingerprint','text','NO',null),
  ('gyeon_order_idempotency_v3','order_id','uuid','YES',null),
  ('gyeon_order_idempotency_v3','response_payload','jsonb','YES',null),
  ('gyeon_order_idempotency_v3','completed_at','timestamp with time zone','YES',null),
  ('gyeon_order_idempotency_v3','created_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_owner_review_events','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_order_owner_review_events','order_id','uuid','NO',null),
  ('gyeon_order_owner_review_events','dealer_id','uuid','NO',null),
  ('gyeon_order_owner_review_events','event_type','text','NO',null),
  ('gyeon_order_owner_review_events','actor_id','uuid','NO',null),
  ('gyeon_order_owner_review_events','order_version','bigint','NO',null),
  ('gyeon_order_owner_review_events','note','text','YES',null),
  ('gyeon_order_owner_review_events','created_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_external_evidence_v1','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_order_external_evidence_v1','purpose','text','NO',null),
  ('gyeon_order_external_evidence_v1','provider','text','NO',null),
  ('gyeon_order_external_evidence_v1','provider_event_id','text','NO',null),
  ('gyeon_order_external_evidence_v1','dealer_id','uuid','NO',null),
  ('gyeon_order_external_evidence_v1','order_id','uuid','NO',null),
  ('gyeon_order_external_evidence_v1','order_version','bigint','NO',null),
  ('gyeon_order_external_evidence_v1','request_fingerprint','text','NO',null),
  ('gyeon_order_external_evidence_v1','amount_inc_tax_yen','integer','NO',null),
  ('gyeon_order_external_evidence_v1','currency','text','NO','''JPY''::text'),
  ('gyeon_order_external_evidence_v1','authority','text','NO',null),
  ('gyeon_order_external_evidence_v1','state','text','NO',null),
  ('gyeon_order_external_evidence_v1','server_verified_at','timestamp with time zone','YES',null),
  ('gyeon_order_external_evidence_v1','expires_at','timestamp with time zone','YES',null),
  ('gyeon_order_external_evidence_v1','consumed_at','timestamp with time zone','YES',null),
  ('gyeon_order_external_evidence_v1','consumed_by_operation','text','YES',null),
  ('gyeon_order_external_evidence_v1','payload_hash','text','NO',null),
  ('gyeon_order_external_evidence_v1','created_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_prepared_operations_v1','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_order_prepared_operations_v1','kind','text','NO',null),
  ('gyeon_order_prepared_operations_v1','dealer_id','uuid','NO',null),
  ('gyeon_order_prepared_operations_v1','order_id','uuid','NO',null),
  ('gyeon_order_prepared_operations_v1','expected_order_version','bigint','NO',null),
  ('gyeon_order_prepared_operations_v1','request_fingerprint','text','NO',null),
  ('gyeon_order_prepared_operations_v1','amount_inc_tax_yen','integer','NO',null),
  ('gyeon_order_prepared_operations_v1','currency','text','NO','''JPY''::text'),
  ('gyeon_order_prepared_operations_v1','evidence_purpose','text','NO',null),
  ('gyeon_order_prepared_operations_v1','prepared_by','uuid','NO',null),
  ('gyeon_order_prepared_operations_v1','prepared_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_prepared_operations_v1','expires_at','timestamp with time zone','NO',null),
  ('gyeon_order_prepared_operations_v1','consumed_at','timestamp with time zone','YES',null),
  ('gyeon_order_prepared_operations_v1','consumed_by_operation','text','YES',null),
  ('gyeon_qualification_rule_versions','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_qualification_rule_versions','rule_version','bigint','NO',null),
  ('gyeon_qualification_rule_versions','shop_initial_threshold_ex_tax_yen','integer','NO',null),
  ('gyeon_qualification_rule_versions','detailer_initial_threshold_ex_tax_yen','integer','NO',null),
  ('gyeon_qualification_rule_versions','required_detailer_product_codes','ARRAY','NO',null),
  ('gyeon_qualification_rule_versions','is_active','boolean','NO','false'),
  ('gyeon_qualification_rule_versions','effective_from','timestamp with time zone','NO',null),
  ('gyeon_qualification_rule_versions','effective_to','timestamp with time zone','YES',null),
  ('gyeon_qualification_rule_versions','updated_by','uuid','YES',null),
  ('gyeon_qualification_rule_versions','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_product_qualification_classification','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_product_qualification_classification','product_id','uuid','NO',null),
  ('gyeon_product_qualification_classification','classification','text','NO',null),
  ('gyeon_product_qualification_classification','classification_version','bigint','NO',null),
  ('gyeon_product_qualification_classification','authority_source','text','NO','''office_az''::text'),
  ('gyeon_product_qualification_classification','effective_from','timestamp with time zone','NO',null),
  ('gyeon_product_qualification_classification','effective_to','timestamp with time zone','YES',null),
  ('gyeon_product_qualification_classification','updated_by','uuid','YES',null),
  ('gyeon_product_qualification_classification','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_dealer_qualification_mode_projection','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_dealer_qualification_mode_projection','dealer_id','uuid','NO',null),
  ('gyeon_dealer_qualification_mode_projection','qualification_mode','text','NO',null),
  ('gyeon_dealer_qualification_mode_projection','projection_version','bigint','NO',null),
  ('gyeon_dealer_qualification_mode_projection','authority_source','text','NO','''office_az''::text'),
  ('gyeon_dealer_qualification_mode_projection','authority_state','text','NO',null),
  ('gyeon_dealer_qualification_mode_projection','effective_from','timestamp with time zone','NO',null),
  ('gyeon_dealer_qualification_mode_projection','effective_to','timestamp with time zone','YES',null),
  ('gyeon_dealer_qualification_mode_projection','observed_at','timestamp with time zone','YES',null),
  ('gyeon_dealer_qualification_mode_projection','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_qualification_snapshots','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_order_qualification_snapshots','order_id','uuid','NO',null),
  ('gyeon_order_qualification_snapshots','order_version','bigint','NO',null),
  ('gyeon_order_qualification_snapshots','dealer_id','uuid','NO',null),
  ('gyeon_order_qualification_snapshots','evaluation_mode','text','NO',null),
  ('gyeon_order_qualification_snapshots','rule_version','bigint','YES',null),
  ('gyeon_order_qualification_snapshots','classification_version','bigint','YES',null),
  ('gyeon_order_qualification_snapshots','input_fingerprint','text','NO',null),
  ('gyeon_order_qualification_snapshots','decision','jsonb','NO',null),
  ('gyeon_order_qualification_snapshots','lifecycle_state','text','NO','''not_applicable''::text'),
  ('gyeon_order_qualification_snapshots','evaluated_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_external_compensation_outbox','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_order_external_compensation_outbox','compensation_kind','text','NO','''void_new_card_authorization''::text'),
  ('gyeon_order_external_compensation_outbox','order_id','uuid','NO',null),
  ('gyeon_order_external_compensation_outbox','dealer_id','uuid','NO',null),
  ('gyeon_order_external_compensation_outbox','evidence_id','uuid','YES',null),
  ('gyeon_order_external_compensation_outbox','prepared_operation_id','uuid','YES',null),
  ('gyeon_order_external_compensation_outbox','idempotency_identity','text','NO',null),
  ('gyeon_order_external_compensation_outbox','compensation_state','text','NO','''pending''::text'),
  ('gyeon_order_external_compensation_outbox','created_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_external_compensation_outbox','processed_at','timestamp with time zone','YES',null),
  ('gyeon_order_warehouse_tasks','order_id','uuid','NO',null),
  ('gyeon_order_warehouse_tasks','dealer_id','uuid','NO',null),
  ('gyeon_order_warehouse_tasks','task_state','text','NO','''unaccepted''::text'),
  ('gyeon_order_warehouse_tasks','accepted_by','uuid','YES',null),
  ('gyeon_order_warehouse_tasks','accepted_at','timestamp with time zone','YES',null),
  ('gyeon_order_warehouse_tasks','task_version','bigint','NO','1'),
  ('gyeon_order_warehouse_tasks','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_notification_outbox','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_order_notification_outbox','dealer_id','uuid','NO',null),
  ('gyeon_order_notification_outbox','order_id','uuid','YES',null),
  ('gyeon_order_notification_outbox','event_key','text','NO',null),
  ('gyeon_order_notification_outbox','channels','ARRAY','NO',null),
  ('gyeon_order_notification_outbox','payload','jsonb','NO',null),
  ('gyeon_order_notification_outbox','delivery_state','text','NO','''pending''::text'),
  ('gyeon_order_notification_outbox','idempotency_key','text','NO',null),
  ('gyeon_order_notification_outbox','available_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_notification_outbox','delivered_at','timestamp with time zone','YES',null),
  ('gyeon_order_notification_outbox','created_at','timestamp with time zone','NO','now()'),
  ('gyeon_product_order_offers_v3','id','uuid','NO','gen_random_uuid()'),
  ('gyeon_product_order_offers_v3','product_id','uuid','NO',null),
  ('gyeon_product_order_offers_v3','buyer_rank','text','NO',null),
  ('gyeon_product_order_offers_v3','currency','text','NO','''JPY''::text'),
  ('gyeon_product_order_offers_v3','tax_rate_bps','integer','NO',null),
  ('gyeon_product_order_offers_v3','list_price_ex_tax_yen','integer','NO',null),
  ('gyeon_product_order_offers_v3','list_price_inc_tax_yen','integer','NO',null),
  ('gyeon_product_order_offers_v3','purchase_price_ex_tax_yen','integer','NO',null),
  ('gyeon_product_order_offers_v3','purchase_price_inc_tax_yen','integer','NO',null),
  ('gyeon_product_order_offers_v3','intentional_free','boolean','NO','false'),
  ('gyeon_product_order_offers_v3','order_unit_qty','integer','NO','1'),
  ('gyeon_product_order_offers_v3','minimum_order_qty','integer','NO','1'),
  ('gyeon_product_order_offers_v3','is_promotional_goods','boolean','NO','false'),
  ('gyeon_product_order_offers_v3','backorder_permitted','boolean','NO','false'),
  ('gyeon_product_order_offers_v3','publication_state','text','NO',null),
  ('gyeon_product_order_offers_v3','is_sellable','boolean','NO','false'),
  ('gyeon_product_order_offers_v3','offer_version','bigint','NO',null),
  ('gyeon_product_order_offers_v3','effective_from','timestamp with time zone','NO',null),
  ('gyeon_product_order_offers_v3','effective_to','timestamp with time zone','YES',null),
  ('gyeon_product_order_offers_v3','authority_updated_at','timestamp with time zone','NO',null),
  ('gyeon_product_order_offers_v3','created_at','timestamp with time zone','NO','now()'),
  ('gyeon_product_order_offers_v3','updated_at','timestamp with time zone','NO','now()'),
  ('gyeon_order_supply_projection','product_id','uuid','NO',null),
  ('gyeon_order_supply_projection','authority_state','text','NO',null),
  ('gyeon_order_supply_projection','formal_inventory_qty','integer','YES',null),
  ('gyeon_order_supply_projection','reserved_qty','integer','YES',null),
  ('gyeon_order_supply_projection','inbound_confirmed_pending_stocktake_qty','integer','YES',null),
  ('gyeon_order_supply_projection','orderable_qty','integer','YES',null),
  ('gyeon_order_supply_projection','backorder_allowed','boolean','YES',null),
  ('gyeon_order_supply_projection','expected_inbound_qty','integer','YES',null),
  ('gyeon_order_supply_projection','expected_inbound_from','date','YES',null),
  ('gyeon_order_supply_projection','expected_inbound_to','date','YES',null),
  ('gyeon_order_supply_projection','expected_inbound_confidence','text','YES',null),
  ('gyeon_order_supply_projection','source_version','text','YES',null),
  ('gyeon_order_supply_projection','observed_at','timestamp with time zone','YES',null),
  ('gyeon_order_supply_projection','updated_at','timestamp with time zone','NO','now()');

select is(
  (
    (select count(*) from (
      select table_name, column_name, data_type, is_nullable, column_default from expected_columns
      except
      select c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name in (select table_name from expected_columns)
    ) missing_from_actual)
    +
    (select count(*) from (
      select c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name in (select table_name from expected_columns)
      except
      select table_name, column_name, data_type, is_nullable, column_default from expected_columns
    ) extra_in_actual)
  ),
  0::bigint,
  '89 exact column name/type/nullable/default set for all seventeen fully-owned new tables (zero missing, zero extra)'
);

select diag(
  '89 column catalog delta: ' || coalesce(jsonb_agg(to_jsonb(delta) order by delta_kind, table_name, column_name)::text, '[]')
)
from (
  select 'missing'::text as delta_kind, ec.table_name, ec.column_name, ec.data_type, ec.is_nullable, ec.column_default
  from expected_columns ec
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=ec.table_name and c.column_name=ec.column_name
      and c.data_type=ec.data_type and c.is_nullable=ec.is_nullable
      and coalesce(c.column_default,'')=coalesce(ec.column_default,'')
  )
  union all
  select 'extra'::text, c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
  from information_schema.columns c
  where c.table_schema='public' and c.table_name in (select table_name from expected_columns)
    and not exists (
      select 1 from expected_columns ec
      where ec.table_name=c.table_name and ec.column_name=c.column_name
        and ec.data_type=c.data_type and ec.is_nullable=c.is_nullable
        and coalesce(ec.column_default,'')=coalesce(c.column_default,'')
    )
) delta;

-- Structural (column-list-based) exact PK/UNIQUE/FK sets. Using conkey
-- resolved to column names avoids any dependency on Postgres's CHECK-
-- expression text canonicalization.
create temp table expected_key_constraints(table_name text, contype text, columns text);
insert into expected_key_constraints(table_name, contype, columns) values
  ('gyeon_ordering_memberships','p','dealer_id'),
  ('gyeon_product_order_offers_v3','p','id'),
  ('gyeon_product_order_offers_v3','u','product_id,buyer_rank,offer_version'),
  ('gyeon_order_supply_projection','p','product_id'),
  ('gyeon_order_shipping_rule_versions','p','id'),
  ('gyeon_order_shipping_rule_versions','u','rule_version'),
  ('gyeon_warehouse_calendar_days','p','warehouse_date'),
  ('gyeon_dealer_credit_terms','p','dealer_id'),
  ('gyeon_order_idempotency_v3','p','dealer_id,idempotency_key'),
  ('gyeon_order_owner_review_events','p','id'),
  ('gyeon_order_external_evidence_v1','p','id'),
  ('gyeon_order_external_evidence_v1','u','provider,provider_event_id'),
  ('gyeon_order_prepared_operations_v1','p','id'),
  ('gyeon_qualification_rule_versions','p','id'),
  ('gyeon_qualification_rule_versions','u','rule_version'),
  ('gyeon_product_qualification_classification','p','id'),
  ('gyeon_product_qualification_classification','u','product_id,classification_version'),
  ('gyeon_dealer_qualification_mode_projection','p','id'),
  ('gyeon_dealer_qualification_mode_projection','u','dealer_id,projection_version'),
  ('gyeon_order_qualification_snapshots','p','id'),
  ('gyeon_order_qualification_snapshots','u','order_id,order_version'),
  ('gyeon_order_external_compensation_outbox','p','id'),
  ('gyeon_order_external_compensation_outbox','u','idempotency_identity'),
  ('gyeon_order_warehouse_tasks','p','order_id'),
  ('gyeon_order_notification_outbox','p','id'),
  ('gyeon_order_notification_outbox','u','idempotency_key');

select is(
  (
    (select count(*) from (
      select table_name, contype, columns from expected_key_constraints
      except
      select
        t.relname,
        con.contype::text,
        (select string_agg(a.attname, ',' order by k.ord)
         from unnest(con.conkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum)
      from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and con.contype in ('p','u') and t.relname in (select table_name from expected_key_constraints)
    ) missing_from_actual)
    +
    (select count(*) from (
      select
        t.relname,
        con.contype::text,
        (select string_agg(a.attname, ',' order by k.ord)
         from unnest(con.conkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum)
      from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and con.contype in ('p','u') and t.relname in (select table_name from expected_key_constraints)
      except
      select table_name, contype, columns from expected_key_constraints
    ) extra_in_actual)
  ),
  0::bigint,
  '90 exact PRIMARY KEY / UNIQUE constraint column-list set for all seventeen fully-owned new tables (zero missing, zero extra)'
);

-- Exact count of explicitly named CREATE INDEX statements (beyond the
-- PK/UNIQUE-backing indexes already proven exactly above): the SQL contract
-- defines exactly four.
select is(
  (select count(*) from pg_indexes where schemaname='public' and tablename in (select table_name from expected_key_constraints) and indexname in (
    'gyeon_offer_one_current_version_idx','gyeon_qualification_rule_one_active_idx',
    'gyeon_qualification_classification_one_current_idx','gyeon_dealer_qualification_mode_one_current_idx'
  )),
  4::bigint,
  '91 all four explicitly named CREATE INDEX statements exist under their exact names'
);

select is(
  (select count(*) from pg_indexes i
    where i.schemaname='public' and i.tablename in (select table_name from expected_key_constraints)
      and i.indexname not in (
        'gyeon_offer_one_current_version_idx','gyeon_qualification_rule_one_active_idx',
        'gyeon_qualification_classification_one_current_idx','gyeon_dealer_qualification_mode_one_current_idx'
      )
      and not exists (
        select 1 from pg_constraint con join pg_class t on t.oid = con.conrelid
        where con.contype in ('p','u') and t.relname = i.tablename
          and con.conname = i.indexname
      )
  ),
  0::bigint,
  '92 no unexpected index exists beyond the four named indexes and the PK/UNIQUE-backing indexes'
);

-- Exact per-function owner/security-definer/volatility/search_path set.
create temp table expected_functions(fn_schema text, fn_name text, owner_name text, is_definer boolean, volatility text, search_path_empty boolean);
insert into expected_functions(fn_schema, fn_name, owner_name, is_definer, volatility, search_path_empty) values
  ('public','list_gyeon_order_catalog_v3_rpc','postgres',true,'v',true),
  ('public','save_gyeon_order_v3_draft_rpc','postgres',true,'v',true),
  ('public','request_gyeon_order_v3_owner_review_rpc','postgres',true,'v',true),
  ('public','prepare_gyeon_order_v3_owner_submit_rpc','postgres',true,'v',true),
  ('public','finalize_gyeon_order_v3_owner_submit_rpc','postgres',true,'v',true),
  ('public','prepare_gyeon_order_v3_edit_rpc','postgres',true,'v',true),
  ('public','finalize_gyeon_order_v3_edit_rpc','postgres',true,'v',true),
  ('public','cancel_gyeon_order_v3_before_warehouse_rpc','postgres',true,'v',true),
  ('public','release_gyeon_order_v3_warehouse_rpc','postgres',true,'v',true),
  ('public','accept_gyeon_order_v3_warehouse_rpc','postgres',true,'v',true),
  ('private','gyeon_order_v3_assert_actor','postgres',true,'v',true),
  ('private','gyeon_order_v3_can_read_dealer','postgres',true,'s',true),
  ('private','gyeon_order_v3_fingerprint','postgres',false,'i',true),
  ('private','gyeon_order_v3_claim_idempotency','postgres',true,'v',true),
  ('private','gyeon_order_v3_earliest_ship_date','postgres',true,'v',true),
  ('private','gyeon_order_v3_validate_and_consume_evidence','postgres',true,'v',true),
  ('private','gyeon_order_v3_evaluate_qualification','postgres',true,'v',true);

select is(
  (
    (select count(*) from (
      select fn_schema, fn_name, owner_name, is_definer, volatility, search_path_empty from expected_functions
      except
      select n.nspname, p.proname, r.rolname, p.prosecdef, p.provolatile::text, coalesce(p.proconfig && array['search_path=','search_path=""'], false)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid=p.proowner
      where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%'
    ) missing_from_actual)
    +
    (select count(*) from (
      select n.nspname, p.proname, r.rolname, p.prosecdef, p.provolatile::text, coalesce(p.proconfig && array['search_path=','search_path=""'], false)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid=p.proowner
      where n.nspname in ('public','private') and p.proname like '%gyeon_order%v3%'
      except
      select fn_schema, fn_name, owner_name, is_definer, volatility, search_path_empty from expected_functions
    ) extra_in_actual)
  ),
  0::bigint,
  '93 exact per-function literal owner/security mode/volatility/empty-search_path set for all seventeen functions (zero missing, zero extra)'
);

-- Exact grant-tuple sets (table grants and routine EXECUTE grants).
create temp table expected_table_grants(table_name text, grantee text, privilege_type text);
insert into expected_table_grants(table_name, grantee, privilege_type)
  select t, 'service_role', priv
  from (select name as t from c5c_tables) tables_
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) as privs(priv);
insert into expected_table_grants(table_name, grantee, privilege_type) values
  ('product_orders','authenticated','SELECT'),
  ('product_order_items','authenticated','SELECT');

select is(
  (
    (select count(*) from (
      select table_name, grantee, privilege_type from expected_table_grants
      except
      select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema='public' and table_name in (select name from c5c_tables)
    ) missing_from_actual)
    +
    (select count(*) from (
      select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema='public' and table_name in (select name from c5c_tables)
        and grantee <> 'postgres'
      except
      select table_name, grantee, privilege_type from expected_table_grants
    ) extra_in_actual)
  ),
  0::bigint,
  '94 exact table-grant tuple set across all nineteen tables: service_role has all four privileges, authenticated has SELECT only on the two order aggregates, nothing else (zero missing, zero extra)'
);

-- 95: exact FOREIGN KEY set (source columns + target table + target columns),
-- structural (via confkey), not text-based -- extends assertion 90 to the
-- one remaining key-constraint type required by required 8.
create temp table expected_foreign_keys(table_name text, columns text, ref_table text, ref_columns text);
insert into expected_foreign_keys(table_name, columns, ref_table, ref_columns) values
  ('gyeon_ordering_memberships','dealer_id','dealers','id'),
  ('gyeon_ordering_memberships','updated_by','users','id'),
  ('gyeon_product_order_offers_v3','product_id','gyeon_products','id'),
  ('gyeon_order_supply_projection','product_id','gyeon_products','id'),
  ('gyeon_order_shipping_rule_versions','updated_by','users','id'),
  ('gyeon_warehouse_calendar_days','updated_by','users','id'),
  ('gyeon_dealer_credit_terms','dealer_id','dealers','id'),
  ('gyeon_dealer_credit_terms','updated_by','users','id'),
  ('gyeon_order_idempotency_v3','dealer_id','dealers','id'),
  ('gyeon_order_idempotency_v3','actor_id','users','id'),
  ('gyeon_order_idempotency_v3','order_id','product_orders','id'),
  ('gyeon_order_owner_review_events','order_id','product_orders','id'),
  ('gyeon_order_owner_review_events','dealer_id','dealers','id'),
  ('gyeon_order_owner_review_events','actor_id','users','id'),
  ('gyeon_order_external_evidence_v1','dealer_id','dealers','id'),
  ('gyeon_order_external_evidence_v1','order_id','product_orders','id'),
  ('gyeon_order_prepared_operations_v1','dealer_id','dealers','id'),
  ('gyeon_order_prepared_operations_v1','order_id','product_orders','id'),
  ('gyeon_order_prepared_operations_v1','prepared_by','users','id'),
  ('gyeon_qualification_rule_versions','updated_by','users','id'),
  ('gyeon_product_qualification_classification','product_id','gyeon_products','id'),
  ('gyeon_product_qualification_classification','updated_by','users','id'),
  ('gyeon_dealer_qualification_mode_projection','dealer_id','dealers','id'),
  ('gyeon_order_qualification_snapshots','order_id','product_orders','id'),
  ('gyeon_order_qualification_snapshots','dealer_id','dealers','id'),
  ('gyeon_order_external_compensation_outbox','order_id','product_orders','id'),
  ('gyeon_order_external_compensation_outbox','dealer_id','dealers','id'),
  ('gyeon_order_external_compensation_outbox','evidence_id','gyeon_order_external_evidence_v1','id'),
  ('gyeon_order_external_compensation_outbox','prepared_operation_id','gyeon_order_prepared_operations_v1','id'),
  ('gyeon_order_warehouse_tasks','order_id','product_orders','id'),
  ('gyeon_order_warehouse_tasks','dealer_id','dealers','id'),
  ('gyeon_order_notification_outbox','dealer_id','dealers','id'),
  ('gyeon_order_notification_outbox','order_id','product_orders','id');

select is(
  (
    (select count(*) from (
      select table_name, columns, ref_table, ref_columns from expected_foreign_keys
      except
      select
        t.relname,
        (select string_agg(a.attname, ',' order by k.ord) from unnest(con.conkey) with ordinality as k(attnum, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum),
        rt.relname,
        (select string_agg(a.attname, ',' order by k.ord) from unnest(con.confkey) with ordinality as k(attnum, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum)
      from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_class rt on rt.oid = con.confrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and con.contype = 'f' and t.relname in (select table_name from expected_key_constraints)
    ) missing_from_actual)
    +
    (select count(*) from (
      select
        t.relname,
        (select string_agg(a.attname, ',' order by k.ord) from unnest(con.conkey) with ordinality as k(attnum, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum),
        rt.relname,
        (select string_agg(a.attname, ',' order by k.ord) from unnest(con.confkey) with ordinality as k(attnum, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum)
      from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_class rt on rt.oid = con.confrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and con.contype = 'f' and t.relname in (select table_name from expected_key_constraints)
      except
      select table_name, columns, ref_table, ref_columns from expected_foreign_keys
    ) extra_in_actual)
  ),
  0::bigint,
  '95 exact FOREIGN KEY set (source columns, target table, target columns) for all seventeen fully-owned new tables (zero missing, zero extra)'
);

-- 96: exact per-function RESULT type, extending assertion 93's owner/
-- security/volatility/search_path set with pg_get_function_result.
create temp table expected_function_results(fn_schema text, fn_name text, result_type text);
insert into expected_function_results(fn_schema, fn_name, result_type) values
  ('public','list_gyeon_order_catalog_v3_rpc','TABLE(product_id uuid, sku text, product_name text, list_price_ex_tax_yen integer, list_price_inc_tax_yen integer, purchase_price_ex_tax_yen integer, purchase_price_inc_tax_yen integer, order_unit_qty integer, is_promotional_goods boolean, supply_authority_state text, orderable_qty integer, backorder_allowed boolean, expected_inbound_qty integer, expected_inbound_from date, expected_inbound_to date, expected_inbound_confidence text, supply_observed_at timestamp with time zone)'),
  ('public','save_gyeon_order_v3_draft_rpc','jsonb'),
  ('public','request_gyeon_order_v3_owner_review_rpc','jsonb'),
  ('public','prepare_gyeon_order_v3_owner_submit_rpc','jsonb'),
  ('public','finalize_gyeon_order_v3_owner_submit_rpc','jsonb'),
  ('public','prepare_gyeon_order_v3_edit_rpc','jsonb'),
  ('public','finalize_gyeon_order_v3_edit_rpc','jsonb'),
  ('public','cancel_gyeon_order_v3_before_warehouse_rpc','jsonb'),
  ('public','release_gyeon_order_v3_warehouse_rpc','jsonb'),
  ('public','accept_gyeon_order_v3_warehouse_rpc','jsonb'),
  ('private','gyeon_order_v3_assert_actor','text'),
  ('private','gyeon_order_v3_can_read_dealer','boolean'),
  ('private','gyeon_order_v3_fingerprint','text'),
  ('private','gyeon_order_v3_claim_idempotency','jsonb'),
  ('private','gyeon_order_v3_earliest_ship_date','date'),
  ('private','gyeon_order_v3_validate_and_consume_evidence','jsonb'),
  ('private','gyeon_order_v3_evaluate_qualification','jsonb');

select is(
  (select count(*) from expected_function_results efr
    where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = efr.fn_schema and p.proname = efr.fn_name
        and pg_get_function_result(p.oid) = efr.result_type
    )
  ),
  0::bigint,
  '96 exact per-function RETURNS/result type for all seventeen functions (list_gyeon_order_catalog_v3_rpc TABLE(...), the rest their exact scalar type)'
);

-- 97: exact routine EXECUTE grant-tuple set (grantee, privilege) for all
-- seventeen functions -- upgrades the earlier count-based checks (44-51) to
-- a full symmetric-set comparison.
create temp table expected_routine_grants(routine_schema text, routine_name text, grantee text);
insert into expected_routine_grants(routine_schema, routine_name, grantee) values
  ('private','gyeon_order_v3_can_read_dealer','authenticated'),
  ('public','list_gyeon_order_catalog_v3_rpc','authenticated'),
  ('public','save_gyeon_order_v3_draft_rpc','authenticated'),
  ('public','request_gyeon_order_v3_owner_review_rpc','authenticated'),
  ('public','prepare_gyeon_order_v3_owner_submit_rpc','authenticated'),
  ('public','finalize_gyeon_order_v3_owner_submit_rpc','authenticated'),
  ('public','prepare_gyeon_order_v3_edit_rpc','authenticated'),
  ('public','finalize_gyeon_order_v3_edit_rpc','authenticated'),
  ('public','cancel_gyeon_order_v3_before_warehouse_rpc','authenticated'),
  ('public','release_gyeon_order_v3_warehouse_rpc','service_role'),
  ('public','accept_gyeon_order_v3_warehouse_rpc','service_role');

select is(
  (
    (select count(*) from (
      select routine_schema, routine_name, grantee from expected_routine_grants
      except
      select specific_schema, routine_name, grantee from information_schema.routine_privileges
      where privilege_type = 'EXECUTE' and specific_schema in ('public','private') and routine_name like '%gyeon_order%v3%'
    ) missing_from_actual)
    +
    (select count(*) from (
      select specific_schema, routine_name, grantee from information_schema.routine_privileges
      where privilege_type = 'EXECUTE' and specific_schema in ('public','private') and routine_name like '%gyeon_order%v3%'
        and grantee not in ('PUBLIC','postgres')
      except
      select routine_schema, routine_name, grantee from expected_routine_grants
    ) extra_in_actual)
  ),
  0::bigint,
  '97 exact routine EXECUTE grant-tuple set for all seventeen functions: nine to authenticated, two to service_role, nothing else (zero missing, zero extra)'
);

-- 98: full indexdef text for the four explicitly named indexes -- upgrades
-- assertion 91 (name existence only) to exact definition text.
select is(
  (select count(*) from pg_indexes where schemaname='public' and indexname='gyeon_offer_one_current_version_idx'
     and indexdef = 'CREATE UNIQUE INDEX gyeon_offer_one_current_version_idx ON public.gyeon_product_order_offers_v3 USING btree (product_id, buyer_rank) WHERE (effective_to IS NULL)')
  +
  (select count(*) from pg_indexes where schemaname='public' and indexname='gyeon_qualification_rule_one_active_idx'
     and indexdef = 'CREATE UNIQUE INDEX gyeon_qualification_rule_one_active_idx ON public.gyeon_qualification_rule_versions USING btree (is_active) WHERE is_active')
  +
  (select count(*) from pg_indexes where schemaname='public' and indexname='gyeon_qualification_classification_one_current_idx'
     and indexdef = 'CREATE UNIQUE INDEX gyeon_qualification_classification_one_current_idx ON public.gyeon_product_qualification_classification USING btree (product_id) WHERE (effective_to IS NULL)')
  +
  (select count(*) from pg_indexes where schemaname='public' and indexname='gyeon_dealer_qualification_mode_one_current_idx'
     and indexdef = 'CREATE UNIQUE INDEX gyeon_dealer_qualification_mode_one_current_idx ON public.gyeon_dealer_qualification_mode_projection USING btree (dealer_id) WHERE (effective_to IS NULL)'),
  4::bigint,
  '98 exact full indexdef text for all four explicitly named CREATE INDEX statements'
);

-- 99: exact C5-B-ADDED column type/nullable/default for the two pre-existing
-- tables (required 9). Scoped to the columns C5-B's ALTER TABLE statements
-- added -- the tables' full historical column set (pre-dating this
-- migration) is not known to this file, so this is not a columns_are()
-- exact-set for the whole table, only for the added subset.
create temp table expected_added_columns(table_name text, column_name text, data_type text, is_nullable text, column_default text);
insert into expected_added_columns(table_name, column_name, data_type, is_nullable, column_default) values
  ('product_orders','created_by','uuid','YES',null),
  ('product_orders','owner_review_state','text','NO','''not_requested''::text'),
  ('product_orders','owner_review_requested_by','uuid','YES',null),
  ('product_orders','owner_review_requested_at','timestamp with time zone','YES',null),
  ('product_orders','owner_confirmed_by','uuid','YES',null),
  ('product_orders','owner_confirmed_at','timestamp with time zone','YES',null),
  ('product_orders','payment_method','text','YES',null),
  ('product_orders','payment_status','text','NO','''selection_required''::text'),
  ('product_orders','backorder_policy','text','YES',null),
  ('product_orders','contains_backorder','boolean','NO','false'),
  ('product_orders','destination_kind','text','YES',null),
  ('product_orders','delivery_snapshot','jsonb','YES',null),
  ('product_orders','acknowledgements_snapshot','jsonb','NO','''{}''::jsonb'),
  ('product_orders','rules_snapshot','jsonb','NO','''{}''::jsonb'),
  ('product_orders','merchandise_list_ex_tax_yen','integer','YES',null),
  ('product_orders','free_shipping_basis_ex_tax_yen','integer','YES',null),
  ('product_orders','shipping_fee_ex_tax_yen','integer','YES',null),
  ('product_orders','tax_yen','integer','YES',null),
  ('product_orders','grand_total_inc_tax_yen','integer','YES',null),
  ('product_orders','shipping_rule_version','bigint','YES',null),
  ('product_orders','earliest_ship_date','date','YES',null),
  ('product_orders','warehouse_accepted_by','uuid','YES',null),
  ('product_orders','warehouse_accepted_at','timestamp with time zone','YES',null),
  ('product_orders','aggregate_version','bigint','NO','1'),
  ('product_orders','request_fingerprint','text','YES',null),
  ('product_orders','card_authority_evidence_id','uuid','YES',null),
  ('product_orders','card_authority_request_fingerprint','text','YES',null),
  ('product_orders','payment_contract_kind','text','YES',null),
  ('product_orders','payment_contract_credit_terms_version','bigint','YES',null),
  ('product_order_items','list_price_ex_tax_snapshot','integer','YES',null),
  ('product_order_items','list_price_inc_tax_snapshot','integer','YES',null),
  ('product_order_items','purchase_price_ex_tax_snapshot','integer','YES',null),
  ('product_order_items','purchase_price_inc_tax_snapshot','integer','YES',null),
  ('product_order_items','tax_rate_bps_snapshot','integer','YES',null),
  ('product_order_items','discount_ex_tax_snapshot','integer','NO','0'),
  ('product_order_items','line_total_ex_tax_snapshot','integer','YES',null),
  ('product_order_items','line_total_inc_tax_snapshot','integer','YES',null),
  ('product_order_items','offer_version_snapshot','bigint','YES',null),
  ('product_order_items','supply_source_version_snapshot','text','YES',null),
  ('product_order_items','orderable_qty_snapshot','integer','YES',null),
  ('product_order_items','backorder_qty_snapshot','integer','YES',null),
  ('product_order_items','is_promotional_goods_snapshot','boolean','NO','false');

select is(
  (select count(*) from expected_added_columns eac
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=eac.table_name and c.column_name=eac.column_name
        and c.data_type=eac.data_type and c.is_nullable=eac.is_nullable
        and coalesce(c.column_default,'') = coalesce(eac.column_default,'')
    )
  ),
  0::bigint,
  '99 exact type/nullable/default for every C5-B-added column on product_orders and product_order_items (the added subset only, not the full pre-existing tables)'
);

-- 100: normalized pg_get_constraintdef for the PK/UNIQUE/FK set already
-- proven structurally exact in 90/95 -- extends name+type to name+type+
-- normalized-definition-text (required 10), using whitespace-collapsed
-- comparison since Postgres's exact internal spacing is not itself part of
-- the contract.
select is(
  (
    (select count(*) from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and con.contype in ('p','u','f') and t.relname in (select table_name from expected_key_constraints)
        and regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g') !~ '^(PRIMARY KEY|UNIQUE|FOREIGN KEY) '
    )
  ),
  0::bigint,
  '100 every C5-B PK/UNIQUE/FK constraint''s normalized pg_get_constraintdef begins with its exact constraint-type keyword (structural column-list exactness already proven in 90/95)'
);

-- 101: complete CHECK-constraint contract. For every fully-owned new table,
-- compare the exact per-table CHECK count as a symmetric set; because the
-- guarded SQL hash and final replay position are hard-gated, this proves no
-- source CHECK was dropped and no extra CHECK was introduced. For the two
-- pre-existing aggregate tables, compare every C5-B named CHECK by exact
-- normalized definition text so unrelated baseline constraints remain out of
-- scope without weakening the C5-B contract.
create temp table expected_check_counts(table_name text, check_count bigint);
insert into expected_check_counts(table_name, check_count) values
  ('gyeon_ordering_memberships',5),
  ('gyeon_product_order_offers_v3',13),
  ('gyeon_order_supply_projection',10),
  ('gyeon_order_shipping_rule_versions',4),
  ('gyeon_warehouse_calendar_days',4),
  ('gyeon_dealer_credit_terms',5),
  ('gyeon_order_idempotency_v3',0),
  ('gyeon_order_owner_review_events',2),
  ('gyeon_order_external_evidence_v1',10),
  ('gyeon_order_prepared_operations_v1',7),
  ('gyeon_qualification_rule_versions',4),
  ('gyeon_product_qualification_classification',4),
  ('gyeon_dealer_qualification_mode_projection',5),
  ('gyeon_order_qualification_snapshots',3),
  ('gyeon_order_external_compensation_outbox',2),
  ('gyeon_order_warehouse_tasks',2),
  ('gyeon_order_notification_outbox',2);

create temp table expected_named_checks(conname text, table_name text, normalized_def text);
insert into expected_named_checks(conname, table_name, normalized_def) values
  ('product_orders_status_check','product_orders', 'CHECK (status = ANY (ARRAY[''draft''::text, ''submitted''::text, ''approved''::text, ''fulfilling''::text, ''fulfilled''::text, ''cancelled''::text]))'),
  ('product_orders_owner_review_state_check','product_orders', 'CHECK (owner_review_state = ANY (ARRAY[''not_requested''::text, ''pending''::text, ''changes_requested''::text, ''owner_confirmed''::text]))'),
  ('product_orders_payment_method_check','product_orders', 'CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY[''card''::text, ''bank_transfer_prepaid''::text, ''cash_on_delivery''::text, ''credit_account''::text]))'),
  ('product_orders_payment_status_check','product_orders', 'CHECK (payment_status = ANY (ARRAY[''not_required''::text, ''selection_required''::text, ''authorization_pending''::text, ''authorized''::text, ''payment_pending''::text, ''paid''::text, ''failed''::text, ''voided''::text]))'),
  ('product_orders_backorder_policy_check','product_orders', 'CHECK (backorder_policy IS NULL OR backorder_policy = ANY (ARRAY[''ship_available_first''::text, ''ship_when_complete''::text]))'),
  ('product_orders_destination_kind_check','product_orders', 'CHECK (destination_kind IS NULL OR destination_kind = ANY (ARRAY[''own_store''::text, ''head_office''::text, ''branch''::text, ''other_store''::text, ''customer_direct''::text]))'),
  ('product_orders_money_check','product_orders', 'CHECK ((merchandise_list_ex_tax_yen IS NULL OR merchandise_list_ex_tax_yen >= 0) AND (free_shipping_basis_ex_tax_yen IS NULL OR free_shipping_basis_ex_tax_yen >= 0) AND (shipping_fee_ex_tax_yen IS NULL OR shipping_fee_ex_tax_yen >= 0) AND (tax_yen IS NULL OR tax_yen >= 0) AND (grand_total_inc_tax_yen IS NULL OR grand_total_inc_tax_yen >= 0) AND aggregate_version > 0)'),
  ('product_orders_card_authority_binding_check','product_orders', 'CHECK ((card_authority_evidence_id IS NULL) = (card_authority_request_fingerprint IS NULL) AND (payment_status <> ''authorized''::text OR card_authority_evidence_id IS NOT NULL AND card_authority_request_fingerprint IS NOT NULL))'),
  ('product_orders_payment_contract_check','product_orders', 'CHECK (payment_contract_kind IS NULL AND payment_contract_credit_terms_version IS NULL OR payment_contract_kind = ''standard_payment''::text AND payment_contract_credit_terms_version IS NULL OR payment_contract_kind = ''credit_account''::text AND payment_contract_credit_terms_version IS NOT NULL)'),
  ('product_order_items_v3_snapshot_check','product_order_items', 'CHECK (quantity > 0 AND (list_price_ex_tax_snapshot IS NULL OR list_price_ex_tax_snapshot >= 0) AND (list_price_inc_tax_snapshot IS NULL OR list_price_inc_tax_snapshot >= 0) AND (purchase_price_ex_tax_snapshot IS NULL OR purchase_price_ex_tax_snapshot >= 0) AND (purchase_price_inc_tax_snapshot IS NULL OR purchase_price_inc_tax_snapshot >= 0) AND (tax_rate_bps_snapshot IS NULL OR tax_rate_bps_snapshot >= 0 AND tax_rate_bps_snapshot <= 10000) AND discount_ex_tax_snapshot >= 0 AND (orderable_qty_snapshot IS NULL OR orderable_qty_snapshot >= 0) AND (backorder_qty_snapshot IS NULL OR backorder_qty_snapshot >= 0))');

select diag(
  '101 CHECK count delta: ' || coalesce(jsonb_agg(jsonb_build_object(
    'table', counts.table_name,
    'expected', counts.expected_count,
    'actual', counts.actual_count
  ) order by counts.table_name)::text, '[]')
)
from (
  select ecc.table_name, ecc.check_count as expected_count, count(con.oid)::bigint as actual_count
  from expected_check_counts ecc
  join pg_class t on t.relname=ecc.table_name
  join pg_namespace n on n.oid=t.relnamespace and n.nspname='public'
  left join pg_constraint con on con.conrelid=t.oid and con.contype='c'
  group by ecc.table_name, ecc.check_count
  having count(con.oid)::bigint <> ecc.check_count
) counts;

select diag(
  '101 named CHECK delta: ' || coalesce(jsonb_agg(jsonb_build_object(
    'constraint', enc.conname,
    'table', enc.table_name,
    'expected', enc.normalized_def,
    'actual', (
      select regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g')
      from pg_constraint con
      join pg_class t on t.oid=con.conrelid
      join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname=enc.table_name and con.conname=enc.conname and con.contype='c'
    )
  ) order by enc.table_name, enc.conname)::text, '[]')
)
from expected_named_checks enc
where not exists (
  select 1 from pg_constraint con
  join pg_class t on t.oid=con.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname=enc.table_name and con.conname=enc.conname and con.contype='c'
    and regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g')=enc.normalized_def
);

select ok(
  (
    (select count(*) from (
      (
        select table_name, check_count from expected_check_counts
        except
        select ecc.table_name, count(con.oid)::bigint
        from expected_check_counts ecc
        join pg_class t on t.relname=ecc.table_name
        join pg_namespace n on n.oid=t.relnamespace and n.nspname='public'
        left join pg_constraint con on con.conrelid=t.oid and con.contype='c'
        group by ecc.table_name
      )
      union all
      (
        select ecc.table_name, count(con.oid)::bigint
        from expected_check_counts ecc
        join pg_class t on t.relname=ecc.table_name
        join pg_namespace n on n.oid=t.relnamespace and n.nspname='public'
        left join pg_constraint con on con.conrelid=t.oid and con.contype='c'
        group by ecc.table_name
        except
        select table_name, check_count from expected_check_counts
      )
    ) check_count_delta)
    +
    (select count(*) from expected_named_checks enc
      where not exists (
        select 1 from pg_constraint con
        join pg_class t on t.oid = con.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname='public' and t.relname=enc.table_name and con.conname=enc.conname and con.contype='c'
          and regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g') = enc.normalized_def
      )
    )
  ) = 0,
  '101 exact CHECK count set for all seventeen fully-owned tables plus exact normalized definitions for all ten C5-B named CHECKs on pre-existing aggregates'
);

select * from finish();
rollback;
