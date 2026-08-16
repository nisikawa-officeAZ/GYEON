-- GYEON product-order V1 runtime contract.
--
-- SOURCE ONLY: creating this file does not authorize applying it to any database.
-- The migration removes authenticated direct writes from product orders and exposes
-- three narrowly granted RPCs. Product identity, price, buyer rank, shipping, totals,
-- tenant, actor, and lifecycle authority are resolved inside the database.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ---------------------------------------------------------------------------
-- 1. Server-owned GYEON offer and shipping authority
-- ---------------------------------------------------------------------------

create table if not exists public.gyeon_product_order_offers (
  product_id                  uuid        not null
                                          references public.gyeon_products(id) on delete cascade,
  buyer_rank                  text        not null
                                          check (buyer_rank in ('shop','detailer','ppf_installer','certified')),
  order_unit_qty              integer     not null check (order_unit_qty > 0),
  min_order_qty               integer     not null check (min_order_qty > 0),
  list_price_ex_tax_yen       bigint      not null check (list_price_ex_tax_yen between 0 and 1000000000),
  list_price_inc_tax_yen      bigint      not null check (list_price_inc_tax_yen between 0 and 1000000000),
  unit_discount_ex_tax_yen    bigint      not null default 0
                                          check (unit_discount_ex_tax_yen between 0 and 1000000000),
  unit_discount_inc_tax_yen   bigint      not null default 0
                                          check (unit_discount_inc_tax_yen between 0 and 1000000000),
  tax_rate_bps                integer     not null check (tax_rate_bps between 0 and 10000),
  supply_availability         text        not null default 'unknown'
                                          check (supply_availability in ('in_stock','low_stock','out_of_stock','unknown')),
  backorder_allowed           boolean     not null default false,
  offer_version               integer     not null default 1 check (offer_version > 0),
  is_active                   boolean     not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  primary key (product_id, buyer_rank),
  constraint gyeon_product_order_offers_order_multiple_check
    check (min_order_qty % order_unit_qty = 0),
  constraint gyeon_product_order_offers_price_order_check
    check (
      list_price_inc_tax_yen >= list_price_ex_tax_yen
      and unit_discount_ex_tax_yen <= list_price_ex_tax_yen
      and unit_discount_inc_tax_yen <= list_price_inc_tax_yen
    )
);

create index if not exists gyeon_product_order_offers_active_rank_idx
  on public.gyeon_product_order_offers (buyer_rank, product_id)
  where is_active = true;

alter table public.gyeon_product_order_offers enable row level security;
revoke all privileges on table public.gyeon_product_order_offers
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.gyeon_product_order_offers
  to service_role;

create table if not exists public.gyeon_order_shipping_rates (
  prefecture                text        primary key,
  shipping_zone_code        text        not null,
  under_threshold_fee_yen   bigint      not null
                                        check (under_threshold_fee_yen between 0 and 1000000000),
  rate_version              integer     not null default 1 check (rate_version > 0),
  is_active                 boolean     not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint gyeon_order_shipping_rates_prefecture_nonblank
    check (btrim(prefecture) <> ''),
  constraint gyeon_order_shipping_rates_zone_nonblank
    check (btrim(shipping_zone_code) <> '')
);

create index if not exists gyeon_order_shipping_rates_active_zone_idx
  on public.gyeon_order_shipping_rates (shipping_zone_code, prefecture)
  where is_active = true;

alter table public.gyeon_order_shipping_rates enable row level security;
revoke all privileges on table public.gyeon_order_shipping_rates
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.gyeon_order_shipping_rates
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Additive immutable snapshots on the existing six-state order tables
-- ---------------------------------------------------------------------------

alter table public.product_orders
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists buyer_rank_snapshot text,
  add column if not exists payment_method text,
  add column if not exists free_shipping_basis text,
  add column if not exists free_shipping_threshold_yen bigint,
  add column if not exists shipping_basis_yen bigint,
  add column if not exists shipping_zone_code text,
  add column if not exists shipping_rate_version_snapshot integer,
  add column if not exists shipping_fee_yen bigint,
  add column if not exists free_shipping boolean,
  add column if not exists product_subtotal_inc_tax_yen bigint,
  add column if not exists payable_amount_yen bigint,
  add column if not exists idempotency_key text,
  add column if not exists request_payload jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists fulfilling_at timestamptz,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.product_orders
  drop constraint if exists product_orders_status_check;
alter table public.product_orders
  add constraint product_orders_status_check
  check (status in ('draft','submitted','approved','fulfilling','fulfilled','cancelled'));

alter table public.product_orders
  drop constraint if exists product_orders_v1_snapshot_check;
alter table public.product_orders
  add constraint product_orders_v1_snapshot_check
  check (
    (buyer_rank_snapshot is null or buyer_rank_snapshot in ('shop','detailer','ppf_installer','certified'))
    and (payment_method is null or payment_method = 'card')
    and (free_shipping_basis is null or free_shipping_basis = 'list_price_inc_tax_before_discount')
    and (free_shipping_threshold_yen is null or free_shipping_threshold_yen > 0)
    and (shipping_basis_yen is null or shipping_basis_yen >= 0)
    and (shipping_rate_version_snapshot is null or shipping_rate_version_snapshot > 0)
    and (shipping_fee_yen is null or shipping_fee_yen >= 0)
    and (product_subtotal_inc_tax_yen is null or product_subtotal_inc_tax_yen >= 0)
    and (payable_amount_yen is null or payable_amount_yen >= 0)
  );

create index if not exists product_orders_created_by_idx
  on public.product_orders (created_by);
create unique index if not exists product_orders_dealer_order_number_uidx
  on public.product_orders (dealer_id, order_number)
  where order_number is not null;

alter table public.product_order_items
  add column if not exists offer_version_snapshot integer,
  add column if not exists buyer_rank_snapshot text,
  add column if not exists order_unit_qty_snapshot integer,
  add column if not exists list_price_ex_tax_yen_snapshot bigint,
  add column if not exists list_price_inc_tax_yen_snapshot bigint,
  add column if not exists unit_discount_ex_tax_yen_snapshot bigint,
  add column if not exists unit_discount_inc_tax_yen_snapshot bigint,
  add column if not exists tax_rate_bps_snapshot integer,
  add column if not exists line_list_subtotal_inc_tax_yen bigint,
  add column if not exists line_payable_subtotal_inc_tax_yen bigint,
  add column if not exists supply_availability_snapshot text,
  add column if not exists backorder_allowed_snapshot boolean;

alter table public.product_order_items
  drop constraint if exists product_order_items_v1_snapshot_check;
alter table public.product_order_items
  add constraint product_order_items_v1_snapshot_check
  check (
    (offer_version_snapshot is null or offer_version_snapshot > 0)
    and (buyer_rank_snapshot is null or buyer_rank_snapshot in ('shop','detailer','ppf_installer','certified'))
    and (order_unit_qty_snapshot is null or order_unit_qty_snapshot > 0)
    and (list_price_ex_tax_yen_snapshot is null or list_price_ex_tax_yen_snapshot >= 0)
    and (list_price_inc_tax_yen_snapshot is null or list_price_inc_tax_yen_snapshot >= 0)
    and (unit_discount_ex_tax_yen_snapshot is null or unit_discount_ex_tax_yen_snapshot >= 0)
    and (unit_discount_inc_tax_yen_snapshot is null or unit_discount_inc_tax_yen_snapshot >= 0)
    and (tax_rate_bps_snapshot is null or tax_rate_bps_snapshot between 0 and 10000)
    and (line_list_subtotal_inc_tax_yen is null or line_list_subtotal_inc_tax_yen >= 0)
    and (line_payable_subtotal_inc_tax_yen is null or line_payable_subtotal_inc_tax_yen >= 0)
    and (
      supply_availability_snapshot is null
      or supply_availability_snapshot in ('in_stock','low_stock','out_of_stock','unknown')
    )
  );

create index if not exists product_order_items_product_id_idx
  on public.product_order_items (product_id);

-- One row owns one dealer-scoped idempotency key. The request JSON is compared
-- before any offer, sequence, or order mutation occurs. A failed transaction rolls
-- this row back together with the order.
create table if not exists public.gyeon_order_idempotency (
  dealer_id       uuid        not null references public.dealers(id) on delete cascade,
  idempotency_key text        not null,
  request_payload jsonb       not null,
  actor_id        uuid        not null references auth.users(id) on delete restrict,
  order_id        uuid        references public.product_orders(id) on delete cascade,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  primary key (dealer_id, idempotency_key),
  constraint gyeon_order_idempotency_key_nonblank
    check (btrim(idempotency_key) <> '' and length(idempotency_key) <= 200)
);

create index if not exists gyeon_order_idempotency_actor_idx
  on public.gyeon_order_idempotency (actor_id);
create index if not exists gyeon_order_idempotency_order_idx
  on public.gyeon_order_idempotency (order_id)
  where order_id is not null;

alter table public.gyeon_order_idempotency enable row level security;
revoke all privileges on table public.gyeon_order_idempotency
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Direct-write cut: authenticated reads tenant rows; writes use RPC only
-- ---------------------------------------------------------------------------

drop policy if exists "Dealer members can manage their product_orders"
  on public.product_orders;
drop policy if exists product_orders_v1_select on public.product_orders;
create policy product_orders_v1_select on public.product_orders
  for select to authenticated
  using (
    exists (
      select 1 from public.dealer_staff ds
      where ds.dealer_id = product_orders.dealer_id
        and ds.user_id = (select auth.uid())
        and ds.status = 'active'
        and ds.role in ('owner','manager','staff','readonly')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
        where ds.dealer_id = product_orders.dealer_id
          and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
        where dm.dealer_id = product_orders.dealer_id
          and dm.user_id = (select auth.uid())
          and dm.status = 'active'
          and dm.role in ('owner','manager','staff','readonly')
      )
    )
  );

drop policy if exists "Dealer members can manage their product_order_items"
  on public.product_order_items;
drop policy if exists product_order_items_v1_select on public.product_order_items;
create policy product_order_items_v1_select on public.product_order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.product_orders po
      where po.id = product_order_items.order_id
        and (
          exists (
            select 1 from public.dealer_staff ds
            where ds.dealer_id = po.dealer_id
              and ds.user_id = (select auth.uid())
              and ds.status = 'active'
              and ds.role in ('owner','manager','staff','readonly')
          )
          or (
            not exists (
              select 1 from public.dealer_staff ds
              where ds.dealer_id = po.dealer_id
                and ds.user_id = (select auth.uid())
            )
            and exists (
              select 1 from public.dealer_members dm
              where dm.dealer_id = po.dealer_id
                and dm.user_id = (select auth.uid())
                and dm.status = 'active'
                and dm.role in ('owner','manager','staff','readonly')
            )
          )
        )
    )
  );

revoke all privileges on table public.product_orders
  from public, anon, authenticated;
revoke all privileges on table public.product_order_items
  from public, anon, authenticated;
grant select on table public.product_orders to authenticated;
grant select on table public.product_order_items to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Internal helpers: never granted as Data API endpoints
-- ---------------------------------------------------------------------------

create or replace function public.gyeon_order_v1_actor_role(
  p_dealer_id uuid,
  p_actor uuid,
  p_allowed_roles text[]
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session_actor uuid;
  v_role text;
  v_status text;
begin
  v_session_actor := (select auth.uid());
  if v_session_actor is null then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_not_authorized';
  end if;
  if p_actor is null or p_actor is distinct from v_session_actor then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_actor_mismatch';
  end if;

  select ds.role, ds.status
    into v_role, v_status
    from public.dealer_staff ds
   where ds.dealer_id = p_dealer_id
     and ds.user_id = v_session_actor;

  if found then
    if v_status = 'active' and v_role = any(p_allowed_roles) then
      return v_role;
    end if;
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_not_authorized';
  end if;

  select dm.role, dm.status
    into v_role, v_status
    from public.dealer_members dm
   where dm.dealer_id = p_dealer_id
     and dm.user_id = v_session_actor;

  if not found or v_status <> 'active' or not (v_role = any(p_allowed_roles)) then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_not_authorized';
  end if;
  return v_role;
end;
$$;

revoke execute on function public.gyeon_order_v1_actor_role(uuid, uuid, text[])
  from public, anon, authenticated, service_role;

create or replace function public.gyeon_order_v1_result(
  p_order_id uuid,
  p_dealer_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select to_jsonb(po) || jsonb_build_object(
    'product_order_items',
    coalesce(
      (
        select jsonb_agg(to_jsonb(poi) order by poi.product_id, poi.id)
        from public.product_order_items poi
        where poi.order_id = po.id
      ),
      '[]'::jsonb
    )
  )
  from public.product_orders po
  where po.id = p_order_id
    and po.dealer_id = p_dealer_id;
$$;

revoke execute on function public.gyeon_order_v1_result(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Atomic draft creation. Input authority is only product id + quantity.
-- ---------------------------------------------------------------------------

create or replace function public.create_gyeon_product_order_v1_rpc(
  p_dealer_id uuid,
  p_actor uuid,
  p_idempotency_key text,
  p_lines jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_element jsonb;
  v_product_text text;
  v_quantity_text text;
  v_product_id uuid;
  v_quantity integer;
  v_product_ids uuid[] := array[]::uuid[];
  v_quantities integer[] := array[]::integer[];
  v_canonical_lines jsonb;
  v_request_payload jsonb;
  v_existing_payload jsonb;
  v_existing_order_id uuid;
  v_dealer_status text;
  v_buyer_rank text;
  v_prefecture text;
  v_shipping_zone text;
  v_under_threshold_fee bigint;
  v_rate_version integer;
  v_offer record;
  v_line_list bigint;
  v_line_payable bigint;
  v_shipping_basis bigint := 0;
  v_product_subtotal bigint := 0;
  v_shipping_fee bigint;
  v_free_shipping boolean;
  v_payable bigint;
  v_line_snapshots jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_sequence integer;
  v_order_number text;
  v_notes text;
begin
  perform public.gyeon_order_v1_actor_role(
    p_dealer_id,
    p_actor,
    array['owner','manager','staff']::text[]
  );

  if p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or length(btrim(p_idempotency_key)) > 200 then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_idempotency_key_required';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and length(v_notes) > 1000 then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_notes_too_long';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_invalid_lines';
  end if;
  if jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 100 then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_invalid_lines';
  end if;

  for v_element in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_element) <> 'object' then
      raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_invalid_lines';
    end if;
    if exists (
      select 1 from jsonb_object_keys(v_element) as k(key)
      where k.key not in ('product_id','quantity')
    ) then
      raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_invalid_lines';
    end if;

    v_product_text := coalesce(v_element ->> 'product_id', '');
    v_quantity_text := coalesce(v_element ->> 'quantity', '');
    if v_product_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or v_quantity_text !~ '^[1-9][0-9]*$'
       or length(v_quantity_text) > 6 then
      raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_invalid_lines';
    end if;

    v_product_id := v_product_text::uuid;
    v_quantity := v_quantity_text::integer;
    if v_quantity > 100000 or v_product_id = any(v_product_ids) then
      raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_invalid_lines';
    end if;
    v_product_ids := array_append(v_product_ids, v_product_id);
    v_quantities := array_append(v_quantities, v_quantity);
  end loop;

  select jsonb_agg(
           jsonb_build_object('productId', x.product_id::text, 'quantity', x.quantity)
           order by x.product_id
         )
    into v_canonical_lines
    from unnest(v_product_ids, v_quantities) as x(product_id, quantity);

  v_request_payload := jsonb_build_object(
    'dealerId', p_dealer_id::text,
    'actorId', p_actor::text,
    'paymentMethod', 'card',
    'status', 'draft',
    'lines', v_canonical_lines,
    'notes', to_jsonb(v_notes)
  );

  insert into public.gyeon_order_idempotency (
    dealer_id, idempotency_key, request_payload, actor_id
  ) values (
    p_dealer_id, btrim(p_idempotency_key), v_request_payload, p_actor
  )
  on conflict (dealer_id, idempotency_key) do nothing;

  select gi.request_payload, gi.order_id
    into v_existing_payload, v_existing_order_id
    from public.gyeon_order_idempotency gi
   where gi.dealer_id = p_dealer_id
     and gi.idempotency_key = btrim(p_idempotency_key)
   for update;

  if v_existing_payload is distinct from v_request_payload then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_idempotency_conflict';
  end if;
  if v_existing_order_id is not null then
    return public.gyeon_order_v1_result(v_existing_order_id, p_dealer_id);
  end if;

  select d.status, d.detailer_rank, d.prefecture
    into v_dealer_status, v_buyer_rank, v_prefecture
    from public.dealers d
   where d.id = p_dealer_id;

  if not found or v_dealer_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_dealer_inactive';
  end if;
  if v_buyer_rank is null
     or v_buyer_rank not in ('shop','detailer','ppf_installer','certified') then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_buyer_rank_denied';
  end if;
  if v_prefecture is null or btrim(v_prefecture) = '' then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_shipping_unresolved';
  end if;

  select sr.shipping_zone_code, sr.under_threshold_fee_yen, sr.rate_version
    into v_shipping_zone, v_under_threshold_fee, v_rate_version
    from public.gyeon_order_shipping_rates sr
   where sr.prefecture = v_prefecture
     and sr.is_active = true
   for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_shipping_unresolved';
  end if;

  -- Every offer row is locked in product-id order. This keeps concurrent catalog
  -- maintenance from mixing versions inside one order and gives every caller the
  -- same lock order.
  for v_product_id, v_quantity in
    select x.product_id, x.quantity
      from unnest(v_product_ids, v_quantities) as x(product_id, quantity)
     order by x.product_id
  loop
    select o.*, p.sku, p.product_name, p.is_active as product_is_active
      into v_offer
      from public.gyeon_product_order_offers o
      join public.gyeon_products p on p.id = o.product_id
     where o.product_id = v_product_id
       and o.buyer_rank = v_buyer_rank
     for share of o, p;

    if not found or not v_offer.is_active or not v_offer.product_is_active then
      raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_offer_unavailable';
    end if;
    if v_quantity < v_offer.min_order_qty
       or v_quantity % v_offer.order_unit_qty <> 0 then
      raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_invalid_quantity';
    end if;
    if v_offer.supply_availability in ('out_of_stock','unknown')
       and not v_offer.backorder_allowed then
      raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_backorder_denied';
    end if;

    v_line_list := v_offer.list_price_inc_tax_yen * v_quantity::bigint;
    v_line_payable :=
      (v_offer.list_price_inc_tax_yen - v_offer.unit_discount_inc_tax_yen)
      * v_quantity::bigint;
    v_shipping_basis := v_shipping_basis + v_line_list;
    v_product_subtotal := v_product_subtotal + v_line_payable;

    v_line_snapshots := v_line_snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', v_offer.product_id,
      'sku', v_offer.sku,
      'product_name', v_offer.product_name,
      'quantity', v_quantity,
      'offer_version', v_offer.offer_version,
      'buyer_rank', v_buyer_rank,
      'order_unit_qty', v_offer.order_unit_qty,
      'list_price_ex_tax_yen', v_offer.list_price_ex_tax_yen,
      'list_price_inc_tax_yen', v_offer.list_price_inc_tax_yen,
      'unit_discount_ex_tax_yen', v_offer.unit_discount_ex_tax_yen,
      'unit_discount_inc_tax_yen', v_offer.unit_discount_inc_tax_yen,
      'tax_rate_bps', v_offer.tax_rate_bps,
      'line_list_subtotal_inc_tax_yen', v_line_list,
      'line_payable_subtotal_inc_tax_yen', v_line_payable,
      'supply_availability', v_offer.supply_availability,
      'backorder_allowed', v_offer.backorder_allowed
    ));
  end loop;

  v_free_shipping := v_shipping_basis >= 30000;
  v_shipping_fee := case when v_free_shipping then 0 else v_under_threshold_fee end;
  v_payable := v_product_subtotal + v_shipping_fee;

  select public.get_next_document_number(
    p_dealer_id, 'product_order', 0, 'PO', 5, 'never'
  ) into v_sequence;
  if v_sequence is null or v_sequence <= 0 then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_numbering_failed';
  end if;
  v_order_number := 'PO-' || lpad(v_sequence::text, 5, '0');

  insert into public.product_orders (
    dealer_id, order_number, status, order_date, notes, created_by,
    buyer_rank_snapshot, payment_method, free_shipping_basis,
    free_shipping_threshold_yen, shipping_basis_yen, shipping_zone_code,
    shipping_rate_version_snapshot,
    shipping_fee_yen, free_shipping, product_subtotal_inc_tax_yen,
    payable_amount_yen, idempotency_key, request_payload
  ) values (
    p_dealer_id, v_order_number, 'draft', current_date, v_notes, p_actor,
    v_buyer_rank, 'card', 'list_price_inc_tax_before_discount',
    30000, v_shipping_basis, v_shipping_zone,
    v_rate_version,
    v_shipping_fee, v_free_shipping, v_product_subtotal,
    v_payable, btrim(p_idempotency_key), v_request_payload
  ) returning id into v_order_id;

  insert into public.product_order_items (
    order_id, product_id, sku, product_name_snapshot, retail_price_snapshot,
    quantity, subtotal, offer_version_snapshot, buyer_rank_snapshot,
    order_unit_qty_snapshot, list_price_ex_tax_yen_snapshot,
    list_price_inc_tax_yen_snapshot, unit_discount_ex_tax_yen_snapshot,
    unit_discount_inc_tax_yen_snapshot, tax_rate_bps_snapshot,
    line_list_subtotal_inc_tax_yen, line_payable_subtotal_inc_tax_yen,
    supply_availability_snapshot, backorder_allowed_snapshot
  )
  select
    v_order_id, x.product_id, x.sku, x.product_name, x.list_price_inc_tax_yen,
    x.quantity, x.line_payable_subtotal_inc_tax_yen, x.offer_version, x.buyer_rank,
    x.order_unit_qty, x.list_price_ex_tax_yen, x.list_price_inc_tax_yen,
    x.unit_discount_ex_tax_yen, x.unit_discount_inc_tax_yen, x.tax_rate_bps,
    x.line_list_subtotal_inc_tax_yen, x.line_payable_subtotal_inc_tax_yen,
    x.supply_availability, x.backorder_allowed
  from jsonb_to_recordset(v_line_snapshots) as x(
    product_id uuid,
    sku text,
    product_name text,
    quantity integer,
    offer_version integer,
    buyer_rank text,
    order_unit_qty integer,
    list_price_ex_tax_yen bigint,
    list_price_inc_tax_yen bigint,
    unit_discount_ex_tax_yen bigint,
    unit_discount_inc_tax_yen bigint,
    tax_rate_bps integer,
    line_list_subtotal_inc_tax_yen bigint,
    line_payable_subtotal_inc_tax_yen bigint,
    supply_availability text,
    backorder_allowed boolean
  );

  update public.gyeon_order_idempotency
     set order_id = v_order_id,
         completed_at = now()
   where dealer_id = p_dealer_id
     and idempotency_key = btrim(p_idempotency_key);

  return public.gyeon_order_v1_result(v_order_id, p_dealer_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Dealer cancellation and draft-note mutation
-- ---------------------------------------------------------------------------

create or replace function public.cancel_gyeon_product_order_v1_rpc(
  p_dealer_id uuid,
  p_actor uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
begin
  perform public.gyeon_order_v1_actor_role(
    p_dealer_id,
    p_actor,
    array['owner','manager']::text[]
  );

  select po.status into v_status
    from public.product_orders po
   where po.id = p_order_id
     and po.dealer_id = p_dealer_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_order_not_found';
  end if;
  if v_status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_same_status';
  end if;
  if v_status not in ('draft','submitted') then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_transition_denied';
  end if;

  update public.product_orders
     set status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   where id = p_order_id
     and dealer_id = p_dealer_id;

  return public.gyeon_order_v1_result(p_order_id, p_dealer_id);
end;
$$;

create or replace function public.update_gyeon_product_order_notes_v1_rpc(
  p_dealer_id uuid,
  p_actor uuid,
  p_order_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_notes text;
begin
  perform public.gyeon_order_v1_actor_role(
    p_dealer_id,
    p_actor,
    array['owner','manager','staff']::text[]
  );

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and length(v_notes) > 1000 then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_notes_too_long';
  end if;

  select po.status into v_status
    from public.product_orders po
   where po.id = p_order_id
     and po.dealer_id = p_dealer_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_order_not_found';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'gyeon_order_rpc_transition_denied';
  end if;

  update public.product_orders
     set notes = v_notes,
         updated_at = now()
   where id = p_order_id
     and dealer_id = p_dealer_id;

  return public.gyeon_order_v1_result(p_order_id, p_dealer_id);
end;
$$;

-- New functions receive PUBLIC EXECUTE by default. Remove it explicitly before
-- granting only the three intended authenticated entry points.
revoke execute on function public.create_gyeon_product_order_v1_rpc(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.cancel_gyeon_product_order_v1_rpc(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.update_gyeon_product_order_notes_v1_rpc(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_gyeon_product_order_v1_rpc(uuid, uuid, text, jsonb, text)
  to authenticated;
grant execute on function public.cancel_gyeon_product_order_v1_rpc(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.update_gyeon_product_order_notes_v1_rpc(uuid, uuid, uuid, text)
  to authenticated;

commit;
