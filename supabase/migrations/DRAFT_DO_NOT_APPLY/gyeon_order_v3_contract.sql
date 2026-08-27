-- =============================================================================
-- GYEON_ORDER_V3_C3_R1_SOURCE_ONLY
-- DRAFT_DO_NOT_APPLY: design candidate only. Never apply to any database.
-- Requires C4 disposable-DB replay, pgTAP, real JWT/RLS and concurrency proof.
-- =============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Commercial membership. This is independent from ordinary dealer membership.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_ordering_memberships (
  dealer_id uuid primary key references public.dealers(id) on delete cascade,
  program_code text not null default 'gyeon_ordering'
    check (program_code = 'gyeon_ordering'),
  membership_status text not null
    check (membership_status in ('pending', 'active', 'suspended', 'revoked', 'expired')),
  buyer_rank text not null
    check (buyer_rank in ('shop', 'detailer', 'certified_detailer')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  membership_version bigint not null default 1 check (membership_version > 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

-- -----------------------------------------------------------------------------
-- Server-owned product/rank offer. One item means one item; no case multiple.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_product_order_offers_v3 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.gyeon_products(id) on delete restrict,
  buyer_rank text not null
    check (buyer_rank in ('shop', 'detailer', 'certified_detailer')),
  currency text not null default 'JPY' check (currency = 'JPY'),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  list_price_ex_tax_yen integer not null check (list_price_ex_tax_yen >= 0),
  list_price_inc_tax_yen integer not null check (list_price_inc_tax_yen >= 0),
  purchase_price_ex_tax_yen integer not null check (purchase_price_ex_tax_yen >= 0),
  purchase_price_inc_tax_yen integer not null check (purchase_price_inc_tax_yen >= 0),
  intentional_free boolean not null default false,
  order_unit_qty integer not null default 1 check (order_unit_qty = 1),
  minimum_order_qty integer not null default 1 check (minimum_order_qty = 1),
  is_promotional_goods boolean not null default false,
  backorder_permitted boolean not null default false,
  publication_state text not null
    check (publication_state in ('draft', 'published', 'withdrawn')),
  is_sellable boolean not null default false,
  offer_version bigint not null check (offer_version > 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  authority_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, buyer_rank, offer_version),
  check (effective_to is null or effective_to > effective_from),
  check (
    intentional_free
    or (
      list_price_ex_tax_yen > 0
      and list_price_inc_tax_yen > 0
      and purchase_price_ex_tax_yen > 0
      and purchase_price_inc_tax_yen > 0
    )
  )
);

create unique index if not exists gyeon_offer_one_current_version_idx
  on public.gyeon_product_order_offers_v3 (product_id, buyer_rank)
  where effective_to is null;

-- -----------------------------------------------------------------------------
-- Read projection from Office AZ authority. It never owns inventory here.
-- Unknown is nullable and explicit; unknown must never be converted to zero.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_order_supply_projection (
  product_id uuid primary key references public.gyeon_products(id) on delete restrict,
  authority_state text not null
    check (authority_state in ('CONFIGURED', 'NOT_CONFIGURED', 'STALE', 'ERROR')),
  formal_inventory_qty integer check (formal_inventory_qty >= 0),
  reserved_qty integer check (reserved_qty >= 0),
  inbound_confirmed_pending_stocktake_qty integer
    check (inbound_confirmed_pending_stocktake_qty >= 0),
  orderable_qty integer check (orderable_qty >= 0),
  backorder_allowed boolean,
  expected_inbound_qty integer check (expected_inbound_qty >= 0),
  expected_inbound_from date,
  expected_inbound_to date,
  expected_inbound_confidence text
    check (expected_inbound_confidence in ('estimated', 'confirmed')),
  source_version text,
  observed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (expected_inbound_to is null or expected_inbound_from is not null),
  check (expected_inbound_to is null or expected_inbound_to >= expected_inbound_from),
  check (
    authority_state <> 'CONFIGURED'
    or (
      formal_inventory_qty is not null
      and reserved_qty is not null
      and inbound_confirmed_pending_stocktake_qty is not null
      and orderable_qty is not null
      and backorder_allowed is not null
      and source_version is not null
      and observed_at is not null
    )
  )
);

-- -----------------------------------------------------------------------------
-- Versioned shipping rules and an explicit per-day warehouse calendar.
-- No Saturday/Sunday convention is embedded in the database contract.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_order_shipping_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_version bigint not null unique check (rule_version > 0),
  destination_scope text not null default 'domestic',
  free_shipping_threshold_ex_tax_yen integer not null default 30000
    check (free_shipping_threshold_ex_tax_yen >= 0),
  under_threshold_shipping_fee_ex_tax_yen integer not null
    check (under_threshold_shipping_fee_ex_tax_yen >= 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  is_active boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create table if not exists public.gyeon_warehouse_calendar_days (
  warehouse_date date primary key,
  operating_mode text not null
    check (operating_mode in ('normal', 'closed', 'exceptional', 'shortened')),
  cutoff_minute_jst integer check (cutoff_minute_jst between 0 and 1439),
  reason text,
  calendar_version bigint not null check (calendar_version > 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (
    (operating_mode = 'closed' and cutoff_minute_jst is null)
    or (operating_mode <> 'closed' and cutoff_minute_jst is not null)
  )
);

create table if not exists public.gyeon_dealer_credit_terms (
  dealer_id uuid primary key references public.dealers(id) on delete restrict,
  credit_state text not null check (credit_state in ('active', 'stopped', 'expired')),
  closing_rule text not null default 'month_end' check (closing_rule = 'month_end'),
  payment_due_day integer check (payment_due_day between 1 and 31),
  payment_terms_note text,
  effective_from timestamptz not null,
  effective_to timestamptz,
  terms_version bigint not null check (terms_version > 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

-- -----------------------------------------------------------------------------
-- Extend the existing order aggregate. States that are not commercial order
-- status remain separate columns/tables.
-- -----------------------------------------------------------------------------

alter table public.product_orders
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists owner_review_state text not null default 'not_requested',
  add column if not exists owner_review_requested_by uuid references auth.users(id),
  add column if not exists owner_review_requested_at timestamptz,
  add column if not exists owner_confirmed_by uuid references auth.users(id),
  add column if not exists owner_confirmed_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'selection_required',
  add column if not exists backorder_policy text,
  add column if not exists contains_backorder boolean not null default false,
  add column if not exists destination_kind text,
  add column if not exists delivery_snapshot jsonb,
  add column if not exists acknowledgements_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists rules_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists merchandise_list_ex_tax_yen integer,
  add column if not exists free_shipping_basis_ex_tax_yen integer,
  add column if not exists shipping_fee_ex_tax_yen integer,
  add column if not exists tax_yen integer,
  add column if not exists grand_total_inc_tax_yen integer,
  add column if not exists shipping_rule_version bigint,
  add column if not exists earliest_ship_date date,
  add column if not exists warehouse_accepted_by uuid,
  add column if not exists warehouse_accepted_at timestamptz,
  add column if not exists aggregate_version bigint not null default 1,
  add column if not exists request_fingerprint text;

alter table public.product_orders
  drop constraint if exists product_orders_status_check,
  drop constraint if exists product_orders_owner_review_state_check,
  drop constraint if exists product_orders_payment_method_check,
  drop constraint if exists product_orders_payment_status_check,
  drop constraint if exists product_orders_backorder_policy_check,
  drop constraint if exists product_orders_destination_kind_check,
  drop constraint if exists product_orders_money_check;

alter table public.product_orders
  add constraint product_orders_status_check
    check (status in ('draft', 'submitted', 'approved', 'fulfilling', 'fulfilled', 'cancelled')),
  add constraint product_orders_owner_review_state_check
    check (owner_review_state in ('not_requested', 'pending', 'changes_requested', 'owner_confirmed')),
  add constraint product_orders_payment_method_check
    check (payment_method is null or payment_method in (
      'card', 'bank_transfer_prepaid', 'cash_on_delivery', 'credit_account'
    )),
  add constraint product_orders_payment_status_check
    check (payment_status in (
      'not_required', 'selection_required', 'authorization_pending', 'authorized',
      'payment_pending', 'paid', 'failed', 'voided'
    )),
  add constraint product_orders_backorder_policy_check
    check (backorder_policy is null or backorder_policy in (
      'ship_available_first', 'ship_when_complete'
    )),
  add constraint product_orders_destination_kind_check
    check (destination_kind is null or destination_kind in (
      'own_store', 'head_office', 'branch', 'other_store', 'customer_direct'
    )),
  add constraint product_orders_money_check
    check (
      (merchandise_list_ex_tax_yen is null or merchandise_list_ex_tax_yen >= 0)
      and (free_shipping_basis_ex_tax_yen is null or free_shipping_basis_ex_tax_yen >= 0)
      and (shipping_fee_ex_tax_yen is null or shipping_fee_ex_tax_yen >= 0)
      and (tax_yen is null or tax_yen >= 0)
      and (grand_total_inc_tax_yen is null or grand_total_inc_tax_yen >= 0)
      and aggregate_version > 0
    );

alter table public.product_order_items
  add column if not exists list_price_ex_tax_snapshot integer,
  add column if not exists list_price_inc_tax_snapshot integer,
  add column if not exists purchase_price_ex_tax_snapshot integer,
  add column if not exists purchase_price_inc_tax_snapshot integer,
  add column if not exists tax_rate_bps_snapshot integer,
  add column if not exists discount_ex_tax_snapshot integer not null default 0,
  add column if not exists line_total_ex_tax_snapshot integer,
  add column if not exists line_total_inc_tax_snapshot integer,
  add column if not exists offer_version_snapshot bigint,
  add column if not exists supply_source_version_snapshot text,
  add column if not exists orderable_qty_snapshot integer,
  add column if not exists backorder_qty_snapshot integer,
  add column if not exists is_promotional_goods_snapshot boolean not null default false;

alter table public.product_order_items
  drop constraint if exists product_order_items_v3_snapshot_check;

alter table public.product_order_items
  add constraint product_order_items_v3_snapshot_check check (
    quantity > 0
    and (list_price_ex_tax_snapshot is null or list_price_ex_tax_snapshot >= 0)
    and (list_price_inc_tax_snapshot is null or list_price_inc_tax_snapshot >= 0)
    and (purchase_price_ex_tax_snapshot is null or purchase_price_ex_tax_snapshot >= 0)
    and (purchase_price_inc_tax_snapshot is null or purchase_price_inc_tax_snapshot >= 0)
    and (tax_rate_bps_snapshot is null or tax_rate_bps_snapshot between 0 and 10000)
    and discount_ex_tax_snapshot >= 0
    and (orderable_qty_snapshot is null or orderable_qty_snapshot >= 0)
    and (backorder_qty_snapshot is null or backorder_qty_snapshot >= 0)
  );

-- -----------------------------------------------------------------------------
-- Immutable evidence and workflow tables.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_order_idempotency_v3 (
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  idempotency_key uuid not null,
  operation text not null,
  actor_id uuid not null references auth.users(id),
  request_fingerprint text not null,
  order_id uuid references public.product_orders(id) on delete restrict,
  response_payload jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (dealer_id, idempotency_key)
);

create table if not exists public.gyeon_order_owner_review_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete restrict,
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  event_type text not null
    check (event_type in ('requested', 'changes_requested', 'owner_confirmed')),
  actor_id uuid not null references auth.users(id),
  order_version bigint not null check (order_version > 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.gyeon_order_payment_evidence (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete restrict,
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  payment_method text not null check (payment_method in (
    'card', 'bank_transfer_prepaid', 'cash_on_delivery', 'credit_account'
  )),
  evidence_state text not null check (evidence_state in (
    'pending', 'authorized', 'paid', 'failed', 'voided'
  )),
  provider_reference text,
  authorized_amount_inc_tax_yen integer check (authorized_amount_inc_tax_yen >= 0),
  server_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, id)
);

create table if not exists public.gyeon_order_warehouse_tasks (
  order_id uuid primary key references public.product_orders(id) on delete restrict,
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  task_state text not null default 'unaccepted'
    check (task_state in ('unaccepted', 'accepted', 'working', 'exception', 'completed', 'cancelled')),
  accepted_by uuid,
  accepted_at timestamptz,
  task_version bigint not null default 1 check (task_version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.gyeon_order_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  order_id uuid references public.product_orders(id) on delete restrict,
  event_key text not null,
  channels text[] not null check (channels <@ array['bell', 'email']::text[]),
  payload jsonb not null,
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'delivering', 'delivered', 'failed')),
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helper: authenticate exact dealer role and active commercial membership.
-- Caller-supplied roles are never accepted; allowed roles are fixed by RPC.
-- -----------------------------------------------------------------------------

create or replace function private.gyeon_order_v3_assert_actor(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_allowed_roles text[]
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception using errcode = '42501', message = 'ACTOR_MISMATCH';
  end if;

  select count(*), min(dm.role)
    into v_count, v_role
  from public.dealer_members dm
  join public.dealers d on d.id = dm.dealer_id and d.status = 'active'
  join public.gyeon_ordering_memberships gom
    on gom.dealer_id = dm.dealer_id
   and gom.program_code = 'gyeon_ordering'
   and gom.membership_status = 'active'
   and gom.effective_from <= now()
   and (gom.effective_to is null or gom.effective_to > now())
  where dm.dealer_id = p_dealer_id
    and dm.user_id = p_actor_id
    and dm.status = 'active';

  if v_count <> 1 or not (v_role = any(p_allowed_roles)) then
    raise exception using errcode = '42501', message = 'ORDERING_AUTHORITY_DENIED';
  end if;

  return v_role;
end;
$$;

-- Read-only RLS helper. It exposes only a boolean and derives caller identity
-- from auth.uid(); the server-owned membership table remains unreadable.
create or replace function private.gyeon_order_v3_can_read_dealer(
  p_dealer_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.dealer_members dm
      join public.dealers d
        on d.id = dm.dealer_id
       and d.status = 'active'
      join public.gyeon_ordering_memberships gom
        on gom.dealer_id = dm.dealer_id
       and gom.program_code = 'gyeon_ordering'
       and gom.membership_status = 'active'
       and gom.effective_from <= now()
       and (gom.effective_to is null or gom.effective_to > now())
      where dm.dealer_id = p_dealer_id
        and dm.user_id = auth.uid()
        and dm.status = 'active'
    );
$$;

create or replace function private.gyeon_order_v3_fingerprint(
  p_operation text,
  p_order_id uuid,
  p_expected_version bigint,
  p_payload jsonb
) returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.md5(
    pg_catalog.concat_ws(
      '|', p_operation, p_order_id::text, p_expected_version::text,
      coalesce(p_payload, '{}'::jsonb)::text
    )
  );
$$;

create or replace function private.gyeon_order_v3_claim_idempotency(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_operation text,
  p_request_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.gyeon_order_idempotency_v3%rowtype;
begin
  insert into public.gyeon_order_idempotency_v3 (
    dealer_id, idempotency_key, operation, actor_id, request_fingerprint
  ) values (
    p_dealer_id, p_idempotency_key, p_operation, p_actor_id, p_request_fingerprint
  )
  on conflict (dealer_id, idempotency_key) do nothing
  returning * into v_existing;

  if found then
    return null;
  end if;

  select * into v_existing
  from public.gyeon_order_idempotency_v3 i
  where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key
  for update;

  if v_existing.operation <> p_operation
     or v_existing.request_fingerprint <> p_request_fingerprint then
    raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
  end if;

  return v_existing.response_payload;
end;
$$;

-- A missing calendar day is an error. Weekend conventions are intentionally absent.
create or replace function private.gyeon_order_v3_earliest_ship_date(
  p_ready_at timestamptz
) returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := (p_ready_at at time zone 'Asia/Tokyo')::date;
  v_minute integer := extract(hour from (p_ready_at at time zone 'Asia/Tokyo'))::integer * 60
                    + extract(minute from (p_ready_at at time zone 'Asia/Tokyo'))::integer;
  v_day public.gyeon_warehouse_calendar_days%rowtype;
  v_guard integer := 0;
begin
  loop
    v_guard := v_guard + 1;
    if v_guard > 370 then
      raise exception using errcode = 'P0001', message = 'WAREHOUSE_CALENDAR_EXHAUSTED';
    end if;

    select * into v_day
    from public.gyeon_warehouse_calendar_days c
    where c.warehouse_date = v_date;

    if not found then
      raise exception using errcode = 'P0001', message = 'WAREHOUSE_CALENDAR_NOT_CONFIGURED';
    end if;

    if v_day.operating_mode <> 'closed'
       and (v_date > (p_ready_at at time zone 'Asia/Tokyo')::date
            or v_minute <= v_day.cutoff_minute_jst) then
      return v_date;
    end if;

    v_date := v_date + 1;
    v_minute := 0;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dealer-facing read RPC. It exposes a safe projection, not authority tables.
-- -----------------------------------------------------------------------------

create or replace function public.list_gyeon_order_catalog_v3_rpc(
  p_dealer_id uuid,
  p_actor_id uuid
) returns table (
  product_id uuid,
  sku text,
  product_name text,
  list_price_ex_tax_yen integer,
  list_price_inc_tax_yen integer,
  purchase_price_ex_tax_yen integer,
  purchase_price_inc_tax_yen integer,
  order_unit_qty integer,
  is_promotional_goods boolean,
  supply_authority_state text,
  orderable_qty integer,
  backorder_allowed boolean,
  expected_inbound_qty integer,
  expected_inbound_from date,
  expected_inbound_to date,
  expected_inbound_confidence text,
  supply_observed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_rank text;
begin
  perform private.gyeon_order_v3_assert_actor(
    p_dealer_id, p_actor_id, array['owner', 'manager', 'staff', 'readonly']::text[]
  );
  select gom.buyer_rank into strict v_buyer_rank
  from public.gyeon_ordering_memberships gom
  where gom.dealer_id = p_dealer_id
    and gom.membership_status = 'active'
    and gom.effective_from <= now()
    and (gom.effective_to is null or gom.effective_to > now());

  return query
  select
    p.id,
    p.sku,
    p.product_name,
    o.list_price_ex_tax_yen,
    o.list_price_inc_tax_yen,
    o.purchase_price_ex_tax_yen,
    o.purchase_price_inc_tax_yen,
    o.order_unit_qty,
    o.is_promotional_goods,
    coalesce(s.authority_state, 'NOT_CONFIGURED'),
    case when s.authority_state = 'CONFIGURED' then s.orderable_qty else null end,
    case when s.authority_state = 'CONFIGURED' then s.backorder_allowed else null end,
    s.expected_inbound_qty,
    s.expected_inbound_from,
    s.expected_inbound_to,
    s.expected_inbound_confidence,
    s.observed_at
  from public.gyeon_products p
  join public.gyeon_product_order_offers_v3 o
    on o.product_id = p.id
   and o.buyer_rank = v_buyer_rank
   and o.publication_state = 'published'
   and o.is_sellable = true
   and o.effective_from <= now()
   and (o.effective_to is null or o.effective_to > now())
  left join public.gyeon_order_supply_projection s on s.product_id = p.id
  where p.is_active = true
  order by p.category nulls last, p.product_name, p.sku;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dealer-facing mutation RPCs. Commercial values are rebuilt from server tables.
-- -----------------------------------------------------------------------------

create or replace function public.save_gyeon_order_v3_draft_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_lines jsonb,
  p_draft_fields jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_line jsonb;
  v_offer public.gyeon_product_order_offers_v3%rowtype;
  v_supply public.gyeon_order_supply_projection%rowtype;
  v_product public.gyeon_products%rowtype;
  v_quantity integer;
  v_orderable integer;
  v_backorder integer;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
  v_list_ex integer := 0;
  v_purchase_ex integer := 0;
  v_contains_backorder boolean := false;
  v_buyer_rank text;
begin
  perform private.gyeon_order_v3_assert_actor(
    p_dealer_id, p_actor_id, array['owner', 'manager', 'staff']::text[]
  );

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'ORDER_LINES_REQUIRED';
  end if;
  if (coalesce(p_draft_fields, '{}'::jsonb) - array[
    'notes', 'destination_kind', 'delivery_snapshot', 'acknowledgements'
  ]) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'CLIENT_DRAFT_FIELDS_FORBIDDEN';
  end if;

  select gom.buyer_rank into strict v_buyer_rank
  from public.gyeon_ordering_memberships gom
  where gom.dealer_id = p_dealer_id
    and gom.program_code = 'gyeon_ordering'
    and gom.membership_status = 'active'
    and gom.effective_from <= now()
    and (gom.effective_to is null or gom.effective_to > now());

  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'save_draft', p_order_id, p_expected_version,
    jsonb_build_object('lines', p_lines, 'draft', coalesce(p_draft_fields, '{}'::jsonb))
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    p_dealer_id, p_actor_id, p_idempotency_key, 'save_draft', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;

  if p_order_id is null then
    insert into public.product_orders (
      dealer_id, status, created_by, aggregate_version, request_fingerprint,
      owner_review_state, payment_status, notes, destination_kind, delivery_snapshot,
      acknowledgements_snapshot
    ) values (
      p_dealer_id, 'draft', p_actor_id, 1, v_fingerprint,
      'not_requested', 'selection_required', p_draft_fields ->> 'notes',
      nullif(p_draft_fields ->> 'destination_kind', ''),
      p_draft_fields -> 'delivery_snapshot',
      coalesce(p_draft_fields -> 'acknowledgements', '{}'::jsonb)
    ) returning * into v_order;
  else
    select * into v_order from public.product_orders o
    where o.id = p_order_id and o.dealer_id = p_dealer_id
    for update;
    if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
    if v_order.status <> 'draft' then raise exception using errcode = '55000', message = 'ORDER_NOT_DRAFT'; end if;
    if v_order.aggregate_version <> p_expected_version then
      raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
    end if;
    delete from public.product_order_items where order_id = v_order.id;
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if (v_line - array['product_id', 'quantity']) <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'CLIENT_COMMERCIAL_FIELDS_FORBIDDEN';
    end if;
    if (v_line ->> 'quantity') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = '22023', message = 'QUANTITY_MUST_BE_POSITIVE_INTEGER';
    end if;
    v_quantity := (v_line ->> 'quantity')::integer;

    select * into strict v_product
    from public.gyeon_products p
    where p.id = (v_line ->> 'product_id')::uuid and p.is_active = true;

    select o.* into strict v_offer
    from public.gyeon_product_order_offers_v3 o
    where o.product_id = v_product.id
      and o.buyer_rank = v_buyer_rank
      and o.publication_state = 'published'
      and o.is_sellable = true
      and o.effective_from <= now()
      and (o.effective_to is null or o.effective_to > now());

    select * into strict v_supply
    from public.gyeon_order_supply_projection s where s.product_id = v_product.id;
    if v_supply.authority_state <> 'CONFIGURED' then
      raise exception using errcode = '55000', message = 'SUPPLY_NOT_CONFIGURED';
    end if;

    v_orderable := least(v_quantity, v_supply.orderable_qty);
    v_backorder := v_quantity - v_orderable;
    if v_backorder > 0 and not (v_supply.backorder_allowed and v_offer.backorder_permitted) then
      raise exception using errcode = '55000', message = 'BACKORDER_NOT_PERMITTED';
    end if;

    v_contains_backorder := v_contains_backorder or v_backorder > 0;
    v_list_ex := v_list_ex + (v_offer.list_price_ex_tax_yen * v_quantity);
    v_purchase_ex := v_purchase_ex + (v_offer.purchase_price_ex_tax_yen * v_quantity);

    insert into public.product_order_items (
      order_id, product_id, sku, product_name_snapshot, retail_price_snapshot,
      quantity, subtotal, list_price_ex_tax_snapshot, list_price_inc_tax_snapshot,
      purchase_price_ex_tax_snapshot, purchase_price_inc_tax_snapshot,
      tax_rate_bps_snapshot, line_total_ex_tax_snapshot, line_total_inc_tax_snapshot,
      offer_version_snapshot, supply_source_version_snapshot,
      orderable_qty_snapshot, backorder_qty_snapshot, is_promotional_goods_snapshot
    ) values (
      v_order.id, v_product.id, v_product.sku, v_product.product_name,
      v_offer.list_price_ex_tax_yen, v_quantity,
      v_offer.purchase_price_ex_tax_yen * v_quantity,
      v_offer.list_price_ex_tax_yen, v_offer.list_price_inc_tax_yen,
      v_offer.purchase_price_ex_tax_yen, v_offer.purchase_price_inc_tax_yen,
      v_offer.tax_rate_bps, v_offer.purchase_price_ex_tax_yen * v_quantity,
      v_offer.purchase_price_inc_tax_yen * v_quantity, v_offer.offer_version,
      v_supply.source_version, v_orderable, v_backorder, v_offer.is_promotional_goods
    );
  end loop;

  update public.product_orders o set
    contains_backorder = v_contains_backorder,
    merchandise_list_ex_tax_yen = v_list_ex,
    free_shipping_basis_ex_tax_yen = (
      select coalesce(sum(i.list_price_ex_tax_snapshot * i.quantity), 0)::integer
      from public.product_order_items i
      where i.order_id = v_order.id and not i.is_promotional_goods_snapshot
    ),
    aggregate_version = case when p_order_id is null then 1 else o.aggregate_version + 1 end,
    request_fingerprint = v_fingerprint,
    owner_review_state = 'not_requested',
    owner_confirmed_by = null,
    owner_confirmed_at = null,
    updated_at = now()
  where o.id = v_order.id
  returning jsonb_build_object(
    'order_id', o.id, 'status', o.status, 'aggregate_version', o.aggregate_version,
    'contains_backorder', o.contains_backorder
  ) into v_result;

  update public.gyeon_order_idempotency_v3 i set
    order_id = v_order.id, response_payload = v_result, completed_at = now()
  where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

create or replace function public.request_gyeon_order_v3_owner_review_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
begin
  perform private.gyeon_order_v3_assert_actor(
    p_dealer_id, p_actor_id, array['manager', 'staff']::text[]
  );
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'request_owner_review', p_order_id, p_expected_version,
    jsonb_build_object('note', p_note)
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    p_dealer_id, p_actor_id, p_idempotency_key, 'request_owner_review', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;
  select * into v_order from public.product_orders o
   where o.id = p_order_id and o.dealer_id = p_dealer_id for update;
  if not found or v_order.status <> 'draft' then
    raise exception using errcode = '55000', message = 'OWNER_REVIEW_REQUEST_NOT_ALLOWED';
  end if;
  if v_order.aggregate_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
  end if;

  update public.product_orders set
    owner_review_state = 'pending', owner_review_requested_by = p_actor_id,
    owner_review_requested_at = now(), aggregate_version = aggregate_version + 1
  where id = p_order_id;
  insert into public.gyeon_order_owner_review_events (
    order_id, dealer_id, event_type, actor_id, order_version, note
  ) values (p_order_id, p_dealer_id, 'requested', p_actor_id, p_expected_version + 1, p_note);
  insert into public.gyeon_order_notification_outbox (
    dealer_id, order_id, event_key, channels, payload, idempotency_key
  ) values (
    p_dealer_id, p_order_id, 'owner_review_requested', array['bell', 'email']::text[],
    jsonb_build_object('order_id', p_order_id),
    concat('owner-review:', p_dealer_id, ':', p_idempotency_key)
  );
  v_result := jsonb_build_object('order_id', p_order_id, 'owner_review_state', 'pending');
  update public.gyeon_order_idempotency_v3 i set
    order_id = p_order_id, response_payload = v_result, completed_at = now()
  where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
  return v_result;
end;
$$;

create or replace function public.owner_submit_gyeon_order_v3_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid,
  p_payment_method text,
  p_backorder_policy text,
  p_payment_evidence_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_credit public.gyeon_dealer_credit_terms%rowtype;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
begin
  perform private.gyeon_order_v3_assert_actor(
    p_dealer_id, p_actor_id, array['owner']::text[]
  );
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'owner_submit', p_order_id, p_expected_version,
    jsonb_build_object(
      'payment_method', p_payment_method,
      'backorder_policy', p_backorder_policy,
      'payment_evidence_id', p_payment_evidence_id
    )
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    p_dealer_id, p_actor_id, p_idempotency_key, 'owner_submit', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;
  select * into v_order from public.product_orders o
   where o.id = p_order_id and o.dealer_id = p_dealer_id for update;
  if not found or v_order.status <> 'draft' then
    raise exception using errcode = '55000', message = 'OWNER_SUBMIT_NOT_ALLOWED';
  end if;
  if v_order.aggregate_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
  end if;
  if v_order.destination_kind is null or v_order.delivery_snapshot is null then
    raise exception using errcode = '22023', message = 'DELIVERY_DESTINATION_REQUIRED';
  end if;
  if v_order.contains_backorder and p_backorder_policy not in ('ship_available_first', 'ship_when_complete') then
    raise exception using errcode = '22023', message = 'BACKORDER_POLICY_REQUIRED';
  end if;
  if not v_order.contains_backorder and p_backorder_policy is not null then
    raise exception using errcode = '22023', message = 'BACKORDER_POLICY_NOT_APPLICABLE';
  end if;
  if p_payment_method = 'cash_on_delivery' and v_order.destination_kind = 'customer_direct' then
    raise exception using errcode = '22023', message = 'COD_CUSTOMER_DIRECT_FORBIDDEN';
  end if;
  if p_payment_method = 'card' and not exists (
    select 1 from public.gyeon_order_payment_evidence e
     where e.id = p_payment_evidence_id and e.order_id = p_order_id
       and e.dealer_id = p_dealer_id and e.payment_method = 'card'
       and e.evidence_state = 'authorized' and e.server_verified_at is not null
       and e.authorized_amount_inc_tax_yen = v_order.grand_total_inc_tax_yen
  ) then
    raise exception using errcode = '55000', message = 'CARD_AUTHORIZATION_EVIDENCE_REQUIRED';
  end if;
  if p_payment_method = 'credit_account' then
    select * into v_credit from public.gyeon_dealer_credit_terms c
     where c.dealer_id = p_dealer_id and c.credit_state = 'active'
       and c.effective_from <= now()
       and (c.effective_to is null or c.effective_to > now());
    if not found then
      raise exception using errcode = '42501', message = 'CREDIT_ACCOUNT_NOT_ENABLED';
    end if;
  end if;
  if p_payment_method not in ('card', 'bank_transfer_prepaid', 'cash_on_delivery', 'credit_account') then
    raise exception using errcode = '22023', message = 'PAYMENT_METHOD_INVALID';
  end if;

  -- Qualification, shipping rule and supply recalc must be wired to canonical
  -- authority before C4 promotion. Until then submission is deliberately closed.
  if coalesce(v_order.rules_snapshot ->> 'qualification_verified', '') <> 'true' then
    raise exception using errcode = '0A000', message = 'QUALIFICATION_AUTHORITY_NOT_CONFIGURED';
  end if;

  update public.product_orders set
    status = 'submitted', owner_review_state = 'owner_confirmed',
    owner_confirmed_by = p_actor_id, owner_confirmed_at = now(),
    payment_method = p_payment_method,
    payment_status = case
      when p_payment_method = 'card' then 'authorized'
      when p_payment_method = 'bank_transfer_prepaid' then 'payment_pending'
      when p_payment_method = 'cash_on_delivery' then 'not_required'
      when p_payment_method = 'credit_account' then 'not_required'
    end,
    backorder_policy = p_backorder_policy,
    earliest_ship_date = private.gyeon_order_v3_earliest_ship_date(now()),
    aggregate_version = aggregate_version + 1,
    updated_at = now()
  where id = p_order_id;

  insert into public.gyeon_order_owner_review_events (
    order_id, dealer_id, event_type, actor_id, order_version
  ) values (p_order_id, p_dealer_id, 'owner_confirmed', p_actor_id, p_expected_version + 1);

  v_result := jsonb_build_object('order_id', p_order_id, 'status', 'submitted');
  update public.gyeon_order_idempotency_v3 i set
    order_id = p_order_id, response_payload = v_result, completed_at = now()
  where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
  return v_result;
end;
$$;

create or replace function public.edit_gyeon_order_v3_before_warehouse_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid,
  p_replacement_lines jsonb,
  p_new_card_authorization_evidence_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
begin
  perform private.gyeon_order_v3_assert_actor(p_dealer_id, p_actor_id, array['owner']::text[]);
  select * into v_order from public.product_orders o
   where o.id = p_order_id and o.dealer_id = p_dealer_id for update;
  if not found or v_order.status <> 'submitted' or v_order.warehouse_accepted_at is not null then
    raise exception using errcode = '55000', message = 'WAREHOUSE_ACCEPTED_ORDER_IMMUTABLE';
  end if;
  if v_order.aggregate_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
  end if;
  if v_order.payment_method = 'card' and not exists (
    select 1 from public.gyeon_order_payment_evidence e
     where e.id = p_new_card_authorization_evidence_id and e.order_id = p_order_id
       and e.evidence_state = 'authorized' and e.server_verified_at is not null
  ) then
    -- Original order and original authorization stay untouched on failure.
    raise exception using errcode = '55000', message = 'CARD_REAUTH_FAILED_OR_MISSING';
  end if;
  raise exception using errcode = '0A000', message = 'SERVER_REPRICE_EDIT_ADAPTER_NOT_CONFIGURED';
end;
$$;

create or replace function public.cancel_gyeon_order_v3_before_warehouse_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
begin
  perform private.gyeon_order_v3_assert_actor(p_dealer_id, p_actor_id, array['owner']::text[]);
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'cancel_before_warehouse', p_order_id, p_expected_version, '{}'::jsonb
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    p_dealer_id, p_actor_id, p_idempotency_key, 'cancel_before_warehouse', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;
  select * into v_order from public.product_orders o
   where o.id = p_order_id and o.dealer_id = p_dealer_id for update;
  if not found or v_order.status not in ('draft', 'submitted') or v_order.warehouse_accepted_at is not null then
    raise exception using errcode = '55000', message = 'ORDER_CANCELLATION_NOT_ALLOWED';
  end if;
  if v_order.aggregate_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
  end if;
  update public.product_orders set status = 'cancelled', aggregate_version = aggregate_version + 1,
    updated_at = now() where id = p_order_id;
  v_result := jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
  update public.gyeon_order_idempotency_v3 i set
    order_id = p_order_id, response_payload = v_result, completed_at = now()
  where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
  return v_result;
end;
$$;

create or replace function public.accept_gyeon_order_v3_warehouse_rpc(
  p_order_id uuid,
  p_service_actor_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
begin
  select * into v_order from public.product_orders o where o.id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'warehouse_accept', p_order_id, p_expected_version, '{}'::jsonb
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    v_order.dealer_id, p_service_actor_id, p_idempotency_key, 'warehouse_accept', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;
  if v_order.status <> 'submitted' or v_order.warehouse_accepted_at is not null then
    raise exception using errcode = '55000', message = 'WAREHOUSE_ACCEPT_NOT_ALLOWED';
  end if;
  if v_order.aggregate_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
  end if;
  if v_order.payment_status in ('selection_required', 'authorization_pending', 'payment_pending', 'failed') then
    raise exception using errcode = '55000', message = 'PAYMENT_NOT_RELEASED_TO_WAREHOUSE';
  end if;
  update public.product_orders set status = 'approved', warehouse_accepted_by = p_service_actor_id,
    warehouse_accepted_at = now(), aggregate_version = aggregate_version + 1,
    updated_at = now() where id = p_order_id;
  insert into public.gyeon_order_warehouse_tasks (
    order_id, dealer_id, task_state, accepted_by, accepted_at
  ) values (p_order_id, v_order.dealer_id, 'accepted', p_service_actor_id, now());
  v_result := jsonb_build_object('order_id', p_order_id, 'status', 'approved');
  update public.gyeon_order_idempotency_v3 i set
    order_id = p_order_id, response_payload = v_result, completed_at = now()
  where i.dealer_id = v_order.dealer_id and i.idempotency_key = p_idempotency_key;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS and grants. Dealer users can read tenant rows, never write tables directly.
-- -----------------------------------------------------------------------------

alter table public.gyeon_ordering_memberships enable row level security;
alter table public.gyeon_product_order_offers_v3 enable row level security;
alter table public.gyeon_order_supply_projection enable row level security;
alter table public.gyeon_order_shipping_rule_versions enable row level security;
alter table public.gyeon_warehouse_calendar_days enable row level security;
alter table public.gyeon_dealer_credit_terms enable row level security;
alter table public.gyeon_order_idempotency_v3 enable row level security;
alter table public.gyeon_order_owner_review_events enable row level security;
alter table public.gyeon_order_payment_evidence enable row level security;
alter table public.gyeon_order_warehouse_tasks enable row level security;
alter table public.gyeon_order_notification_outbox enable row level security;
alter table public.product_orders enable row level security;
alter table public.product_order_items enable row level security;

drop policy if exists "Dealer members can manage their product_orders" on public.product_orders;
drop policy if exists "Dealer members can manage their product_order_items" on public.product_order_items;
drop policy if exists gyeon_order_v3_select on public.product_orders;
drop policy if exists gyeon_order_item_v3_select on public.product_order_items;

create policy gyeon_order_v3_select on public.product_orders
  for select to authenticated
  using (
    private.gyeon_order_v3_can_read_dealer(product_orders.dealer_id)
  );

create policy gyeon_order_item_v3_select on public.product_order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.product_orders o
      where o.id = product_order_items.order_id
    )
  );

revoke all privileges on table
  public.product_orders,
  public.product_order_items,
  public.gyeon_ordering_memberships,
  public.gyeon_product_order_offers_v3,
  public.gyeon_order_supply_projection,
  public.gyeon_order_shipping_rule_versions,
  public.gyeon_warehouse_calendar_days,
  public.gyeon_dealer_credit_terms,
  public.gyeon_order_idempotency_v3,
  public.gyeon_order_owner_review_events,
  public.gyeon_order_payment_evidence,
  public.gyeon_order_warehouse_tasks,
  public.gyeon_order_notification_outbox
from public, anon, authenticated, service_role;

grant select on table public.product_orders, public.product_order_items to authenticated;

grant select, insert, update, delete on table
  public.product_orders,
  public.product_order_items,
  public.gyeon_ordering_memberships,
  public.gyeon_product_order_offers_v3,
  public.gyeon_order_supply_projection,
  public.gyeon_order_shipping_rule_versions,
  public.gyeon_warehouse_calendar_days,
  public.gyeon_dealer_credit_terms,
  public.gyeon_order_idempotency_v3,
  public.gyeon_order_owner_review_events,
  public.gyeon_order_payment_evidence,
  public.gyeon_order_warehouse_tasks,
  public.gyeon_order_notification_outbox
to service_role;

-- Revoke default function execution, then grant exact public entrypoints.
revoke all on function private.gyeon_order_v3_assert_actor(uuid, uuid, text[]) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_can_read_dealer(uuid) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_fingerprint(text, uuid, bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_claim_idempotency(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_earliest_ship_date(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.list_gyeon_order_catalog_v3_rpc(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.save_gyeon_order_v3_draft_rpc(uuid, uuid, uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.request_gyeon_order_v3_owner_review_rpc(uuid, uuid, uuid, bigint, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.owner_submit_gyeon_order_v3_rpc(uuid, uuid, uuid, bigint, uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.edit_gyeon_order_v3_before_warehouse_rpc(uuid, uuid, uuid, bigint, uuid, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_gyeon_order_v3_before_warehouse_rpc(uuid, uuid, uuid, bigint, uuid) from public, anon, authenticated, service_role;
revoke all on function public.accept_gyeon_order_v3_warehouse_rpc(uuid, uuid, bigint, uuid) from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.gyeon_order_v3_can_read_dealer(uuid) to authenticated;
grant execute on function public.save_gyeon_order_v3_draft_rpc(uuid, uuid, uuid, uuid, bigint, jsonb, jsonb) to authenticated;
grant execute on function public.list_gyeon_order_catalog_v3_rpc(uuid, uuid) to authenticated;
grant execute on function public.request_gyeon_order_v3_owner_review_rpc(uuid, uuid, uuid, bigint, uuid, text) to authenticated;
grant execute on function public.owner_submit_gyeon_order_v3_rpc(uuid, uuid, uuid, bigint, uuid, text, text, uuid) to authenticated;
grant execute on function public.edit_gyeon_order_v3_before_warehouse_rpc(uuid, uuid, uuid, bigint, uuid, jsonb, uuid) to authenticated;
grant execute on function public.cancel_gyeon_order_v3_before_warehouse_rpc(uuid, uuid, uuid, bigint, uuid) to authenticated;
grant execute on function public.accept_gyeon_order_v3_warehouse_rpc(uuid, uuid, bigint, uuid) to service_role;

-- Deliberately roll back if this file is accidentally executed as a script.
-- Formal migration promotion must remove this guard only after C4 acceptance.
rollback;
