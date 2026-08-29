-- GYEON_ORDER_V3_C5D_POPULATED_UPGRADE
-- Disposable PostgreSQL 17 only. Read-only pgTAP proof for the "populated"
-- lane: representative legacy product_orders/product_order_items rows were
-- inserted and COMMITTED against the version-20260826143000 BASELINE schema
-- (verified directly from 048_create_product_orders.sql plus
-- 079_warehouse_daily_ops.sql's status-check widening) by capture-evidence.sh,
-- BEFORE the formal migration (20260829101726_gyeon_order_v3_contract.sql)
-- was applied via `supabase migration up --local`. The legacy fixture uses
-- ONLY columns that existed at that baseline version: product_orders(id,
-- dealer_id, order_number, status, order_date, notes, created_at,
-- updated_at) and product_order_items(id, order_id, product_id, sku,
-- product_name_snapshot, retail_price_snapshot, quantity, subtotal,
-- created_at). None of the columns the formal migration itself adds
-- (product_orders.created_by/owner_review_state/payment_status/
-- destination_kind/delivery_snapshot/merchandise_list_ex_tax_yen/
-- shipping_fee_ex_tax_yen/tax_yen/grand_total_inc_tax_yen/
-- aggregate_version/contains_backorder, or
-- product_order_items.list_price_ex_tax_snapshot) are ever described as
-- legacy or written by the pre-migration fixture.
--
-- This file inserts no fixtures of its own and never rolls back preceding
-- data: it only asserts (1) the already-committed legacy rows survived the
-- formal migration unchanged, and (2) the new formal-era columns now carry
-- their real post-migration DEFAULT values on those same legacy rows --
-- never treating a formal-era default as if it were legacy data.
--
-- A byte-identical canonical-fingerprint query is already re-run and
-- compared field-by-field (all columns, both tables, plus FK-integrity
-- counts) by capture-evidence.sh before this file ever runs; this file
-- provides the retained, human-auditable per-row breakdown of that same
-- guarantee for the pgtap-populated-upgrade.tap evidence artifact.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, pg_temp, public, pg_catalog;

select plan(26);

-- ---------------------------------------------------------------------------
-- 1-2: the legacy tables themselves still exist post-migration.
-- ---------------------------------------------------------------------------

select has_table('public', 'product_orders', '1 product_orders still exists after the formal migration');
select has_table('public', 'product_order_items', '2 product_order_items still exists after the formal migration');

-- ---------------------------------------------------------------------------
-- 3-4: exact row counts for the two legacy dealers' fixture rows.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.product_orders
   where dealer_id in ('c5d40000-0000-4000-8000-000000000001','c5d40000-0000-4000-8000-000000000002')),
  4,
  '3 all four legacy product_orders rows survived the formal migration'
);

select is(
  (select count(*)::int from public.product_order_items
   where id in ('c5d44000-0000-4000-8000-000000000001','c5d44000-0000-4000-8000-000000000002','c5d44000-0000-4000-8000-000000000003','c5d44000-0000-4000-8000-000000000004')),
  4,
  '4 all four legacy product_order_items rows survived the formal migration'
);

-- ---------------------------------------------------------------------------
-- 5-8: each legacy order's status is exactly preserved.
-- ---------------------------------------------------------------------------

select is((select status from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000001'), 'draft', '5 legacy draft order status preserved');
select is((select status from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000002'), 'submitted', '6 legacy submitted order status preserved');
select is((select status from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000003'), 'approved', '7 legacy approved order status preserved');
select is((select status from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000004'), 'cancelled', '8 legacy cancelled order status preserved');

-- ---------------------------------------------------------------------------
-- 9: every legacy line item still has a strictly positive quantity.
-- ---------------------------------------------------------------------------

select ok(
  (select bool_and(quantity > 0) from public.product_order_items
   where id in ('c5d44000-0000-4000-8000-000000000001','c5d44000-0000-4000-8000-000000000002','c5d44000-0000-4000-8000-000000000003','c5d44000-0000-4000-8000-000000000004')),
  '9 every legacy line item retains a strictly positive quantity'
);

-- ---------------------------------------------------------------------------
-- 10: aggregate legacy money (subtotal) is exactly preserved.
-- ---------------------------------------------------------------------------

select is(
  (select sum(subtotal)::int from public.product_order_items
   where id in ('c5d44000-0000-4000-8000-000000000001','c5d44000-0000-4000-8000-000000000002','c5d44000-0000-4000-8000-000000000003','c5d44000-0000-4000-8000-000000000004')),
  75000,
  '10 aggregate legacy subtotal is exactly preserved (10000+20000+30000+15000)'
);

-- ---------------------------------------------------------------------------
-- 11-12: FK integrity -- zero legacy items reference a missing order or an
-- invalid product.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.product_order_items i
   where i.id in ('c5d44000-0000-4000-8000-000000000001','c5d44000-0000-4000-8000-000000000002','c5d44000-0000-4000-8000-000000000003','c5d44000-0000-4000-8000-000000000004')
     and not exists (select 1 from public.product_orders o where o.id = i.order_id)),
  0,
  '11 zero legacy line items reference a missing order (FK integrity intact)'
);

select is(
  (select count(*)::int from public.product_order_items i
   where i.id in ('c5d44000-0000-4000-8000-000000000001','c5d44000-0000-4000-8000-000000000002','c5d44000-0000-4000-8000-000000000003','c5d44000-0000-4000-8000-000000000004')
     and i.product_id is not null
     and not exists (select 1 from public.gyeon_products p where p.id = i.product_id)),
  0,
  '12 zero legacy line items reference a missing product (FK integrity intact)'
);

-- ---------------------------------------------------------------------------
-- 13-16: nullable legacy order_number is preserved exactly as inserted
-- (null for draft/cancelled, populated for submitted/approved).
-- ---------------------------------------------------------------------------

select is((select order_number from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000001'), null, '13 legacy draft order nullable order_number stayed null');
select is((select order_number from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000004'), null, '14 legacy cancelled order nullable order_number stayed null');
select is((select order_number from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000002'), 'PO-LEGACY-0002', '15 legacy submitted order order_number preserved exactly');
select is((select order_number from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000003'), 'PO-LEGACY-0003', '16 legacy approved order order_number preserved exactly');

-- ---------------------------------------------------------------------------
-- 17-20: nullable order_date and notes preserved exactly.
-- ---------------------------------------------------------------------------

select is((select order_date from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000001'), null, '17 legacy draft order nullable order_date stayed null');
select is((select order_date from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000002'), '2026-08-21'::date, '18 legacy submitted order order_date preserved exactly');
select is((select notes from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000002'), 'legacy submitted note', '19 legacy submitted order notes preserved exactly');
select is((select notes from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000003'), null, '20 legacy approved order nullable notes stayed null');

-- ---------------------------------------------------------------------------
-- 21-22: explicit fixed legacy timestamps preserved byte-for-byte (never
-- now()-derived, so exact preservation is a meaningful assertion).
-- ---------------------------------------------------------------------------

select is((select created_at from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000001'), '2026-08-20T01:00:00Z'::timestamptz, '21 legacy draft order created_at preserved exactly');
select is((select updated_at from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000002'), '2026-08-21T03:00:00Z'::timestamptz, '22 legacy submitted order updated_at preserved exactly');

-- ---------------------------------------------------------------------------
-- 23: legacy dealer identity row is unchanged.
-- ---------------------------------------------------------------------------

select is((select name from public.dealers where id = 'c5d40000-0000-4000-8000-000000000001'), 'C5D Populated Dealer One', '23 legacy dealer one name preserved');

-- ---------------------------------------------------------------------------
-- 24: the legacy primary key constraint itself survived the migration.
-- ---------------------------------------------------------------------------

select col_is_pk('public', 'product_orders', 'id', '24 product_orders.id is still the primary key after the formal migration');

-- ---------------------------------------------------------------------------
-- 25: a genuinely new v3 object introduced by the formal migration is now
-- live, proving this is a real post-migration schema, not merely an
-- unchanged baseline.
-- ---------------------------------------------------------------------------

select has_table('public', 'gyeon_order_external_evidence_v1', '25 a new v3 object from the formal migration is live post-upgrade');

-- ---------------------------------------------------------------------------
-- 26: new formal-era columns receive their real post-migration DEFAULT on
-- the pre-existing legacy row -- asserted here as a NEW-COLUMN default, not
-- described anywhere as part of the legacy fixture itself.
-- ---------------------------------------------------------------------------

select ok(
  (select aggregate_version = 1
     and owner_review_state = 'not_requested'
     and payment_status = 'selection_required'
     and contains_backorder = false
   from public.product_orders where id = 'c5d42000-0000-4000-8000-000000000001'),
  '26 new formal-era columns (aggregate_version/owner_review_state/payment_status/contains_backorder) carry their real ALTER TABLE ... DEFAULT values on the pre-existing legacy row'
);

select * from finish();
rollback;
