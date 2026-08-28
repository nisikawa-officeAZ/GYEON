-- =============================================================================
-- GYEON_ORDER_V3_C3_R1_SOURCE_ONLY
-- GYEON_ORDER_V3_C5_B_EXTERNAL_AUTHORITY_DB_SOURCE_ONLY
-- DRAFT_DO_NOT_APPLY: design candidate only. Never apply to any database.
-- Requires C5-C disposable-DB replay, pgTAP, real JWT/RLS and concurrency proof.
--
-- C5-B adds: a generic versioned external-evidence object (renamed from the
-- narrow payment-evidence draft), prepared-operation binding for owner-submit
-- and pre-warehouse-edit, a server-owned versioned qualification authority,
-- an append-only compensation outbox, and a release/accept warehouse-task
-- split so a task is created as unaccepted only when authorities are ready
-- and warehouse acceptance always consumes an existing task.
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
  add column if not exists request_fingerprint text,
  add column if not exists card_authority_evidence_id uuid,
  add column if not exists card_authority_request_fingerprint text,
  add column if not exists payment_contract_kind text,
  add column if not exists payment_contract_credit_terms_version bigint;

alter table public.product_orders
  drop constraint if exists product_orders_status_check,
  drop constraint if exists product_orders_owner_review_state_check,
  drop constraint if exists product_orders_payment_method_check,
  drop constraint if exists product_orders_payment_status_check,
  drop constraint if exists product_orders_backorder_policy_check,
  drop constraint if exists product_orders_destination_kind_check,
  drop constraint if exists product_orders_money_check,
  drop constraint if exists product_orders_payment_contract_check;

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
    ),
  -- R2-02: the first successful owner finalize freezes exactly one explicit
  -- payment-contract snapshot. A submitted order always has one; a draft
  -- order never does. Only `credit_account` binds a terms version.
  add constraint product_orders_payment_contract_check
    check (
      (payment_contract_kind is null and payment_contract_credit_terms_version is null)
      or (payment_contract_kind = 'standard_payment' and payment_contract_credit_terms_version is null)
      or (payment_contract_kind = 'credit_account' and payment_contract_credit_terms_version is not null)
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
-- Immutable idempotency and review-event tables (unchanged from C4).
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

-- -----------------------------------------------------------------------------
-- C5-B: generic versioned external-evidence object. This supersedes and
-- renames the narrow C4 `gyeon_order_payment_evidence` draft table, because
-- the whole file remains DRAFT_DO_NOT_APPLY and was never promoted. Evidence
-- is bound to provider event identity, purpose, dealer/order/version,
-- request fingerprint, amount, currency, verification time, expiry, and
-- one-time consumption. It stores a payload hash only -- never a raw
-- provider payload, card number, bank credential, or other secret.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_order_external_evidence_v1 (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in (
    'initial_authorization', 'edit_reauthorization', 'bank_payment_match', 'inventory_reservation'
  )),
  provider text not null,
  provider_event_id text not null,
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  order_id uuid not null references public.product_orders(id) on delete restrict,
  order_version bigint not null check (order_version > 0),
  request_fingerprint text not null,
  amount_inc_tax_yen integer not null check (amount_inc_tax_yen >= 0),
  currency text not null default 'JPY' check (currency = 'JPY'),
  authority text not null check (authority in ('server_verified', 'unverified')),
  state text not null check (state in ('pending', 'succeeded', 'failed', 'voided')),
  server_verified_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_by_operation text,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  check (expires_at is null or server_verified_at is null or expires_at > server_verified_at),
  check (authority <> 'server_verified' or server_verified_at is not null),
  check (
    state <> 'succeeded'
    or (authority = 'server_verified' and server_verified_at is not null and expires_at is not null)
  ),
  check (consumed_at is null or consumed_by_operation is not null)
);

-- C5-B-R1-A2: server-owned link from an order to the current accepted card
-- authority. `payment_status = 'authorized'` alone is never authority; a
-- successful amount-changing edit atomically replaces this link with the
-- accepted reauthorization evidence, and an amount-preserving edit never
-- clears it.
alter table public.product_orders
  drop constraint if exists product_orders_card_authority_evidence_fk,
  drop constraint if exists product_orders_card_authority_binding_check;

alter table public.product_orders
  add constraint product_orders_card_authority_evidence_fk
    foreign key (card_authority_evidence_id)
    references public.gyeon_order_external_evidence_v1(id),
  add constraint product_orders_card_authority_binding_check
    check (
      (card_authority_evidence_id is null) = (card_authority_request_fingerprint is null)
      and (
        payment_status <> 'authorized'
        or (card_authority_evidence_id is not null and card_authority_request_fingerprint is not null)
      )
    );

-- -----------------------------------------------------------------------------
-- C5-B: server-recomputed prepared operations. Prepare is a short
-- transaction; the caller obtains external-provider evidence outside
-- PostgreSQL, then a separate finalize transaction consumes it once.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_order_prepared_operations_v1 (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('owner_submit', 'edit_before_warehouse')),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  order_id uuid not null references public.product_orders(id) on delete restrict,
  expected_order_version bigint not null check (expected_order_version > 0),
  request_fingerprint text not null,
  amount_inc_tax_yen integer not null check (amount_inc_tax_yen >= 0),
  currency text not null default 'JPY' check (currency = 'JPY'),
  evidence_purpose text not null check (evidence_purpose in (
    'initial_authorization', 'edit_reauthorization'
  )),
  prepared_by uuid not null references auth.users(id),
  prepared_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_operation text,
  check (expires_at > prepared_at),
  check (
    (kind = 'owner_submit' and evidence_purpose = 'initial_authorization')
    or (kind = 'edit_before_warehouse' and evidence_purpose = 'edit_reauthorization')
  )
);

-- -----------------------------------------------------------------------------
-- C5-B: Office AZ-owned versioned qualification authority. DealerOS stores
-- only this versioned server-owned projection; there is no browser writer,
-- MacBook authoring RPC, seed data, fallback value, or inferred classification.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_qualification_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_version bigint not null unique check (rule_version > 0),
  shop_initial_threshold_ex_tax_yen integer not null
    check (shop_initial_threshold_ex_tax_yen >= 0),
  detailer_initial_threshold_ex_tax_yen integer not null
    check (detailer_initial_threshold_ex_tax_yen >= 0),
  required_detailer_product_codes text[] not null,
  is_active boolean not null default false,
  effective_from timestamptz not null,
  effective_to timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create unique index if not exists gyeon_qualification_rule_one_active_idx
  on public.gyeon_qualification_rule_versions (is_active)
  where is_active;

create table if not exists public.gyeon_product_qualification_classification (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.gyeon_products(id) on delete restrict,
  classification text not null check (classification in (
    'eligible_chemical', 'required_detailer_product', 'optional_matt', 'other'
  )),
  classification_version bigint not null check (classification_version > 0),
  authority_source text not null default 'office_az' check (authority_source = 'office_az'),
  effective_from timestamptz not null,
  effective_to timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (product_id, classification_version),
  check (effective_to is null or effective_to > effective_from)
);

create unique index if not exists gyeon_qualification_classification_one_current_idx
  on public.gyeon_product_qualification_classification (product_id)
  where effective_to is null;

-- -----------------------------------------------------------------------------
-- C5-B: Office AZ-owned versioned qualification-mode projection. This is the
-- only source of a dealer's qualification mode. There is no browser writer,
-- MacBook authoring RPC, seed data, default/fallback mode, or inference from
-- buyer rank, order history, or client input. Prepare reads exactly one
-- currently effective row per dealer and fails closed when it is missing,
-- stale (a projection once existed but none is currently effective), or in
-- an explicit error state.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_dealer_qualification_mode_projection (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  qualification_mode text not null check (qualification_mode in (
    'none', 'shop_initial', 'detailer_initial', 'shop_to_detailer'
  )),
  projection_version bigint not null check (projection_version > 0),
  authority_source text not null default 'office_az' check (authority_source = 'office_az'),
  authority_state text not null check (authority_state in (
    'CONFIGURED', 'NOT_CONFIGURED', 'STALE', 'ERROR'
  )),
  effective_from timestamptz not null,
  effective_to timestamptz,
  observed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (dealer_id, projection_version),
  check (effective_to is null or effective_to > effective_from)
);

create unique index if not exists gyeon_dealer_qualification_mode_one_current_idx
  on public.gyeon_dealer_qualification_mode_projection (dealer_id)
  where effective_to is null;

create table if not exists public.gyeon_order_qualification_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete restrict,
  order_version bigint not null check (order_version > 0),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  evaluation_mode text not null check (evaluation_mode in (
    'none', 'shop_initial', 'detailer_initial', 'shop_to_detailer'
  )),
  rule_version bigint,
  classification_version bigint,
  input_fingerprint text not null,
  decision jsonb not null,
  lifecycle_state text not null default 'not_applicable'
    check (lifecycle_state in (
      'not_applicable', 'provisional_met', 'officially_achieved', 'recheck_required'
    )),
  evaluated_at timestamptz not null default now(),
  unique (order_id, order_version)
);

-- -----------------------------------------------------------------------------
-- C5-B: append-only compensation outbox. A finalize conflict that occurs
-- after a newly succeeded (but now unusable) authorization inserts exactly
-- one row here instead of raising, and never mutates the original order.
-- -----------------------------------------------------------------------------

create table if not exists public.gyeon_order_external_compensation_outbox (
  id uuid primary key default gen_random_uuid(),
  compensation_kind text not null default 'void_new_card_authorization'
    check (compensation_kind = 'void_new_card_authorization'),
  order_id uuid not null references public.product_orders(id) on delete restrict,
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  evidence_id uuid references public.gyeon_order_external_evidence_v1(id) on delete restrict,
  prepared_operation_id uuid references public.gyeon_order_prepared_operations_v1(id) on delete restrict,
  idempotency_identity text not null unique,
  compensation_state text not null default 'pending'
    check (compensation_state in ('pending', 'processing', 'done', 'failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- -----------------------------------------------------------------------------
-- Warehouse task. C5-B separates task creation (release, service-only, exactly
-- once, unaccepted) from task consumption (accept, locks an existing task).
-- -----------------------------------------------------------------------------

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
-- C5-B helper: one-time, purpose/dealer/order/version/fingerprint/amount/
-- currency-bound evidence validation and consumption. Distinct codes for
-- mismatch, expiry, and prior consumption; never a boolean success flag.
-- -----------------------------------------------------------------------------

create or replace function private.gyeon_order_v3_validate_and_consume_evidence(
  p_evidence_id uuid,
  p_purpose text,
  p_dealer_id uuid,
  p_order_id uuid,
  p_order_version bigint,
  p_request_fingerprint text,
  p_amount_inc_tax_yen integer,
  p_currency text,
  p_consumed_by_operation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.gyeon_order_external_evidence_v1%rowtype;
begin
  if p_evidence_id is null then
    return jsonb_build_object('ok', false, 'code', 'evidence_missing');
  end if;

  select * into v_evidence
  from public.gyeon_order_external_evidence_v1 e
  where e.id = p_evidence_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'evidence_missing');
  end if;
  if v_evidence.authority <> 'server_verified' then
    return jsonb_build_object('ok', false, 'code', 'evidence_not_server_verified');
  end if;
  if v_evidence.state <> 'succeeded' then
    return jsonb_build_object('ok', false, 'code', 'evidence_not_succeeded');
  end if;
  if v_evidence.consumed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'evidence_consumed');
  end if;
  if v_evidence.expires_at is null or now() >= v_evidence.expires_at then
    return jsonb_build_object('ok', false, 'code', 'evidence_expired');
  end if;
  if v_evidence.purpose <> p_purpose then
    return jsonb_build_object('ok', false, 'code', 'evidence_purpose_mismatch');
  end if;
  if v_evidence.dealer_id <> p_dealer_id or v_evidence.order_id <> p_order_id then
    return jsonb_build_object('ok', false, 'code', 'evidence_order_binding_mismatch');
  end if;
  if v_evidence.order_version <> p_order_version then
    return jsonb_build_object('ok', false, 'code', 'evidence_version_mismatch');
  end if;
  if v_evidence.request_fingerprint <> p_request_fingerprint then
    return jsonb_build_object('ok', false, 'code', 'evidence_fingerprint_mismatch');
  end if;
  if v_evidence.amount_inc_tax_yen <> p_amount_inc_tax_yen then
    return jsonb_build_object('ok', false, 'code', 'evidence_amount_mismatch');
  end if;
  if v_evidence.currency <> p_currency then
    return jsonb_build_object('ok', false, 'code', 'evidence_currency_mismatch');
  end if;

  update public.gyeon_order_external_evidence_v1
    set consumed_at = now(), consumed_by_operation = p_consumed_by_operation
  where id = p_evidence_id;

  return jsonb_build_object('ok', true, 'evidence_id', p_evidence_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- C5-B helper: server-owned qualification evaluation. It reads the versioned
-- rule authority and the Office AZ-owned classification projection; it never
-- reads the legacy rules_snapshot ->> 'qualification_verified' client text.
-- Upgrade mode (shop_to_detailer) stays fail-closed until a shipped/returned
-- history authority object is added in a later gate.
-- -----------------------------------------------------------------------------

create or replace function private.gyeon_order_v3_evaluate_qualification(
  p_dealer_id uuid,
  p_order_id uuid,
  p_order_version bigint,
  p_mode text,
  p_input_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.gyeon_qualification_rule_versions%rowtype;
  v_threshold integer;
  v_qualifying_amount integer := 0;
  v_missing text[];
  v_line record;
  v_classification_version bigint;
  v_item_count integer;
  v_remaining integer;
  v_met boolean;
  v_decision jsonb;
  v_lifecycle_state text;
  v_existing_snapshot public.gyeon_order_qualification_snapshots%rowtype;
begin
  if p_mode not in ('none', 'shop_initial', 'detailer_initial', 'shop_to_detailer') then
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_invalid');
  end if;

  if p_mode = 'none' then
    v_decision := jsonb_build_object(
      'provisionalMet', true, 'officiallyAchieved', true,
      'qualifyingAmountExTaxYen', 0, 'amountRemainingExTaxYen', 0,
      'missingRequiredProductCodes', '[]'::jsonb
    );
    v_lifecycle_state := 'not_applicable';

    insert into public.gyeon_order_qualification_snapshots (
      order_id, order_version, dealer_id, evaluation_mode, rule_version,
      classification_version, input_fingerprint, decision, lifecycle_state
    ) values (
      p_order_id, p_order_version, p_dealer_id, p_mode, null, null,
      p_input_fingerprint, v_decision, v_lifecycle_state
    )
    on conflict (order_id, order_version) do nothing;

    if not found then
      select * into v_existing_snapshot
      from public.gyeon_order_qualification_snapshots s
      where s.order_id = p_order_id and s.order_version = p_order_version;

      if v_existing_snapshot.dealer_id <> p_dealer_id
         or v_existing_snapshot.evaluation_mode <> p_mode
         or v_existing_snapshot.rule_version is not null
         or v_existing_snapshot.classification_version is not null
         or v_existing_snapshot.input_fingerprint <> p_input_fingerprint
         or v_existing_snapshot.decision <> v_decision
         or v_existing_snapshot.lifecycle_state <> v_lifecycle_state
      then
        return jsonb_build_object('ok', false, 'code', 'qualification_snapshot_conflict');
      end if;
      v_decision := v_existing_snapshot.decision;
    end if;

    return jsonb_build_object('ok', true, 'rule_version', null, 'classification_version', null, 'decision', v_decision);
  end if;

  if p_mode = 'shop_to_detailer' then
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_not_configured');
  end if;

  select * into v_rule
  from public.gyeon_qualification_rule_versions r
  where r.is_active
    and r.effective_from <= now()
    and (r.effective_to is null or r.effective_to > now());
  if not found then
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_not_configured');
  end if;

  v_threshold := case p_mode
    when 'shop_initial' then v_rule.shop_initial_threshold_ex_tax_yen
    when 'detailer_initial' then v_rule.detailer_initial_threshold_ex_tax_yen
  end;
  v_missing := case when p_mode = 'shop_initial' then array[]::text[] else v_rule.required_detailer_product_codes end;

  select count(*) into v_item_count
  from public.product_order_items i where i.order_id = p_order_id;
  if v_item_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_invalid');
  end if;

  for v_line in
    select i.quantity, i.list_price_ex_tax_snapshot, c.classification, c.classification_version, p.sku
    from public.product_order_items i
    join public.gyeon_products p on p.id = i.product_id
    left join public.gyeon_product_qualification_classification c
      on c.product_id = i.product_id and c.effective_to is null
    where i.order_id = p_order_id
  loop
    if v_line.classification_version is null then
      return jsonb_build_object('ok', false, 'code', 'qualification_authority_stale');
    end if;
    if v_classification_version is null then
      v_classification_version := v_line.classification_version;
    elsif v_line.classification_version <> v_classification_version then
      return jsonb_build_object('ok', false, 'code', 'qualification_authority_mixed_classification_version');
    end if;
    if v_line.classification = 'eligible_chemical' then
      v_qualifying_amount := v_qualifying_amount
        + coalesce(v_line.list_price_ex_tax_snapshot, 0) * v_line.quantity;
    end if;
    if v_line.quantity > 0 then
      v_missing := array_remove(v_missing, v_line.sku);
    end if;
  end loop;

  v_remaining := greatest(0, v_threshold - v_qualifying_amount);
  v_met := v_remaining = 0 and array_length(v_missing, 1) is null;
  v_decision := jsonb_build_object(
    'provisionalMet', v_met, 'officiallyAchieved', false,
    'qualifyingAmountExTaxYen', v_qualifying_amount,
    'amountRemainingExTaxYen', v_remaining,
    'missingRequiredProductCodes', to_jsonb(coalesce(v_missing, array[]::text[]))
  );
  v_lifecycle_state := case when v_met then 'provisional_met' else 'not_applicable' end;

  insert into public.gyeon_order_qualification_snapshots (
    order_id, order_version, dealer_id, evaluation_mode, rule_version,
    classification_version, input_fingerprint, decision, lifecycle_state
  ) values (
    p_order_id, p_order_version, p_dealer_id, p_mode, v_rule.rule_version,
    v_classification_version, p_input_fingerprint, v_decision, v_lifecycle_state
  )
  on conflict (order_id, order_version) do nothing;

  if not found then
    select * into v_existing_snapshot
    from public.gyeon_order_qualification_snapshots s
    where s.order_id = p_order_id and s.order_version = p_order_version;

    if v_existing_snapshot.dealer_id <> p_dealer_id
       or v_existing_snapshot.evaluation_mode <> p_mode
       or coalesce(v_existing_snapshot.rule_version, -1) <> coalesce(v_rule.rule_version, -1)
       or coalesce(v_existing_snapshot.classification_version, -1) <> coalesce(v_classification_version, -1)
       or v_existing_snapshot.input_fingerprint <> p_input_fingerprint
       or v_existing_snapshot.decision <> v_decision
       or v_existing_snapshot.lifecycle_state <> v_lifecycle_state
    then
      return jsonb_build_object('ok', false, 'code', 'qualification_snapshot_conflict');
    end if;
    v_decision := v_existing_snapshot.decision;
    v_met := v_existing_snapshot.lifecycle_state = 'provisional_met';
  end if;

  if not v_met then
    return jsonb_build_object('ok', false, 'code', 'qualification_not_met', 'decision', v_decision);
  end if;
  return jsonb_build_object(
    'ok', true, 'rule_version', v_rule.rule_version,
    'classification_version', v_classification_version, 'decision', v_decision
  );
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

-- -----------------------------------------------------------------------------
-- C5-B: owner-submit prepare/finalize split. Prepare recomputes server
-- commercial facts and the qualification authority, then writes a versioned
-- prepared operation for card orders. External PSP work happens outside this
-- transaction and outside PostgreSQL. Finalize locks the prepared operation,
-- the order, and the evidence in that deterministic order, recomputes the
-- fingerprint, checks expiry/version/binding, consumes evidence once, and
-- commits the commercial mutation atomically.
-- -----------------------------------------------------------------------------

drop function if exists public.owner_submit_gyeon_order_v3_rpc(uuid, uuid, uuid, bigint, uuid, text, text, uuid);
drop function if exists public.prepare_gyeon_order_v3_owner_submit_rpc(uuid, uuid, uuid, bigint, text, text, text);

create or replace function public.prepare_gyeon_order_v3_owner_submit_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_payment_method text,
  p_backorder_policy text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_credit public.gyeon_dealer_credit_terms%rowtype;
  v_credit_active boolean := false;
  v_qualification_authority public.gyeon_dealer_qualification_mode_projection%rowtype;
  v_qualification jsonb;
  v_fingerprint text;
  v_prepared_id uuid;
  v_amount integer;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  perform private.gyeon_order_v3_assert_actor(p_dealer_id, p_actor_id, array['owner']::text[]);

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
  if p_payment_method not in ('card', 'bank_transfer_prepaid', 'cash_on_delivery', 'credit_account') then
    raise exception using errcode = '22023', message = 'PAYMENT_METHOD_INVALID';
  end if;
  if p_payment_method = 'cash_on_delivery' and v_order.destination_kind = 'customer_direct' then
    raise exception using errcode = '22023', message = 'COD_CUSTOMER_DIRECT_FORBIDDEN';
  end if;

  -- A2-02: active, currently effective credit-account terms force the
  -- payment method server-side, regardless of the requested method. A
  -- browser can never keep card/bank/COD selected once the dealer is on
  -- forced credit terms, and credit_account is always denied without
  -- active/effective terms.
  select * into v_credit from public.gyeon_dealer_credit_terms c
   where c.dealer_id = p_dealer_id
     and c.effective_from <= now()
     and (c.effective_to is null or c.effective_to > now());
  v_credit_active := found and v_credit.credit_state = 'active';

  if v_credit_active and p_payment_method <> 'credit_account' then
    raise exception using errcode = '42501', message = 'CREDIT_ACCOUNT_TERMS_FORCE_METHOD';
  end if;
  if p_payment_method = 'credit_account' and not v_credit_active then
    raise exception using errcode = '42501', message = 'CREDIT_ACCOUNT_NOT_ENABLED';
  end if;

  -- Server-owned qualification-mode authority. A browser can never select,
  -- bypass, or downgrade the mode; it is loaded here from the Office
  -- AZ-owned projection and fails closed before any prepared operation
  -- exists. "Stale" means a projection once existed for this dealer but
  -- none is currently effective; "not configured" means none ever existed.
  select * into v_qualification_authority
  from public.gyeon_dealer_qualification_mode_projection q
  where q.dealer_id = p_dealer_id
    and q.effective_from <= now()
    and (q.effective_to is null or q.effective_to > now())
  order by q.projection_version desc
  limit 1;

  if not found then
    if exists (
      select 1 from public.gyeon_dealer_qualification_mode_projection q
      where q.dealer_id = p_dealer_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'qualification_authority_stale');
    end if;
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_not_configured');
  end if;

  if v_qualification_authority.authority_state = 'NOT_CONFIGURED' then
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_not_configured');
  elsif v_qualification_authority.authority_state = 'STALE' then
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_stale');
  elsif v_qualification_authority.authority_state <> 'CONFIGURED' then
    return jsonb_build_object('ok', false, 'code', 'qualification_authority_error');
  end if;

  -- Never reads a client-supplied verification flag or accepts a client
  -- qualification result; only the internally loaded mode is evaluated.
  v_qualification := private.gyeon_order_v3_evaluate_qualification(
    p_dealer_id, p_order_id, p_expected_version, v_qualification_authority.qualification_mode,
    private.gyeon_order_v3_fingerprint(
      'qualification', p_order_id, p_expected_version,
      jsonb_build_object(
        'mode', v_qualification_authority.qualification_mode,
        'projection_version', v_qualification_authority.projection_version
      )
    )
  );
  if not (v_qualification ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'code', coalesce(v_qualification ->> 'code', 'qualification_not_met'));
  end if;

  v_amount := coalesce(
    v_order.grand_total_inc_tax_yen,
    coalesce(v_order.merchandise_list_ex_tax_yen, 0)
      + coalesce(v_order.shipping_fee_ex_tax_yen, 0)
      + coalesce(v_order.tax_yen, 0)
  );
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'owner_submit_finalize', p_order_id, p_expected_version,
    jsonb_build_object('payment_method', p_payment_method, 'backorder_policy', p_backorder_policy)
  );

  if p_payment_method = 'card' then
    insert into public.gyeon_order_prepared_operations_v1 (
      kind, dealer_id, order_id, expected_order_version, request_fingerprint,
      amount_inc_tax_yen, currency, evidence_purpose, prepared_by, expires_at
    ) values (
      'owner_submit', p_dealer_id, p_order_id, p_expected_version, v_fingerprint,
      v_amount, 'JPY', 'initial_authorization', p_actor_id, v_expires_at
    ) returning id into v_prepared_id;

    return jsonb_build_object(
      'ok', true, 'requires_external_authorization', true,
      'prepared_operation_id', v_prepared_id, 'evidence_purpose', 'initial_authorization',
      'request_fingerprint', v_fingerprint, 'amount_inc_tax_yen', v_amount,
      'currency', 'JPY', 'expires_at', v_expires_at
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'requires_external_authorization', false,
    'request_fingerprint', v_fingerprint, 'amount_inc_tax_yen', v_amount, 'currency', 'JPY'
  );
end;
$$;

create or replace function public.finalize_gyeon_order_v3_owner_submit_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid,
  p_payment_method text,
  p_backorder_policy text,
  p_prepared_operation_id uuid default null,
  p_evidence_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prepared public.gyeon_order_prepared_operations_v1%rowtype;
  v_order public.product_orders%rowtype;
  v_credit public.gyeon_dealer_credit_terms%rowtype;
  v_credit_active boolean := false;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
  v_validation jsonb;
  v_should_compensate boolean := false;
begin
  perform private.gyeon_order_v3_assert_actor(p_dealer_id, p_actor_id, array['owner']::text[]);
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'owner_submit_finalize', p_order_id, p_expected_version,
    jsonb_build_object('payment_method', p_payment_method, 'backorder_policy', p_backorder_policy)
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    p_dealer_id, p_actor_id, p_idempotency_key, 'owner_submit_finalize', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;

  -- A2-01: card authority may never be synthesized from status text. A card
  -- finalize without an exact prepared operation and exact accepted
  -- evidence fails closed before any lock is taken.
  if p_payment_method = 'card' and (p_prepared_operation_id is null or p_evidence_id is null) then
    v_result := jsonb_build_object('ok', false, 'code', 'card_authority_required', 'compensation', 'none');
    update public.gyeon_order_idempotency_v3 i set
      order_id = p_order_id, response_payload = v_result, completed_at = now()
    where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
    return v_result;
  end if;

  -- Deterministic lock order: prepared operation, then order, then evidence.
  if p_prepared_operation_id is not null then
    select * into v_prepared
    from public.gyeon_order_prepared_operations_v1 p
    where p.id = p_prepared_operation_id
      and p.kind = 'owner_submit' and p.dealer_id = p_dealer_id and p.order_id = p_order_id
    for update;
    if not found or v_prepared.consumed_at is not null then
      v_result := jsonb_build_object('ok', false, 'code', 'prepared_operation_invalid', 'compensation', 'none');
      update public.gyeon_order_idempotency_v3 i set
        order_id = p_order_id, response_payload = v_result, completed_at = now()
      where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
      return v_result;
    end if;
  end if;

  select * into v_order from public.product_orders o
   where o.id = p_order_id and o.dealer_id = p_dealer_id for update;
  if not found or v_order.status <> 'draft' then
    raise exception using errcode = '55000', message = 'OWNER_SUBMIT_NOT_ALLOWED';
  end if;

  -- A3-03: a card authorization can succeed outside PostgreSQL while credit
  -- terms change before finalize. Identify that exact new authorization
  -- before the credit-method gate so a denial records a durable void intent.
  if p_payment_method = 'card' and p_prepared_operation_id is not null then
    select exists (
      select 1 from public.gyeon_order_external_evidence_v1 e
      where e.id = p_evidence_id
        and e.authority = 'server_verified' and e.state = 'succeeded' and e.consumed_at is null
        and e.purpose = v_prepared.evidence_purpose
        and e.dealer_id = v_prepared.dealer_id and e.order_id = v_prepared.order_id
        and e.order_version = v_prepared.expected_order_version
        and e.request_fingerprint = v_prepared.request_fingerprint
        and e.amount_inc_tax_yen = v_prepared.amount_inc_tax_yen
        and e.currency = v_prepared.currency
      for update
    ) into v_should_compensate;
  end if;

  -- A2-02: finalize independently preserves the credit-forcing rule; a
  -- caller may not bypass prepare by supplying another method here.
  select * into v_credit from public.gyeon_dealer_credit_terms c
   where c.dealer_id = p_dealer_id
     and c.effective_from <= now()
     and (c.effective_to is null or c.effective_to > now());
  v_credit_active := found and v_credit.credit_state = 'active';

  if v_credit_active and p_payment_method <> 'credit_account' then
    v_result := jsonb_build_object(
      'ok', false,
      'code', 'credit_account_terms_force_method',
      'compensation', case when v_should_compensate then 'void_new_card_authorization' else 'none' end
    );
    if v_should_compensate then
      insert into public.gyeon_order_external_compensation_outbox (
        order_id, dealer_id, evidence_id, prepared_operation_id, idempotency_identity
      ) values (
        p_order_id, p_dealer_id, p_evidence_id, v_prepared.id,
        concat('void:', v_prepared.id, ':', p_evidence_id::text)
      )
      on conflict (idempotency_identity) do nothing;
    end if;
    update public.gyeon_order_idempotency_v3 i set
      order_id = p_order_id, response_payload = v_result, completed_at = now()
    where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
    return v_result;
  end if;
  if p_payment_method = 'credit_account' and not v_credit_active then
    v_result := jsonb_build_object('ok', false, 'code', 'credit_account_not_enabled', 'compensation', 'none');
    update public.gyeon_order_idempotency_v3 i set
      order_id = p_order_id, response_payload = v_result, completed_at = now()
    where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
    return v_result;
  end if;

  if p_prepared_operation_id is not null then
    if now() >= v_prepared.expires_at then
      v_result := jsonb_build_object('ok', false, 'code', 'prepared_operation_expired',
        'compensation', case when v_should_compensate then 'void_new_card_authorization' else 'none' end);
    elsif v_order.aggregate_version <> v_prepared.expected_order_version then
      v_result := jsonb_build_object('ok', false, 'code', 'order_version_conflict',
        'compensation', case when v_should_compensate then 'void_new_card_authorization' else 'none' end);
    elsif v_fingerprint <> v_prepared.request_fingerprint then
      v_result := jsonb_build_object('ok', false, 'code', 'request_fingerprint_conflict',
        'compensation', case when v_should_compensate then 'void_new_card_authorization' else 'none' end);
    else
      v_validation := private.gyeon_order_v3_validate_and_consume_evidence(
        p_evidence_id, v_prepared.evidence_purpose, p_dealer_id, p_order_id,
        p_expected_version, v_fingerprint, v_prepared.amount_inc_tax_yen,
        v_prepared.currency, 'owner_submit_finalize'
      );
      if not (v_validation ->> 'ok')::boolean then
        v_result := jsonb_build_object('ok', false, 'code', v_validation ->> 'code', 'compensation', 'none');
      else
        update public.gyeon_order_prepared_operations_v1
          set consumed_at = now(), consumed_by_operation = 'owner_submit_finalize'
        where id = v_prepared.id;
        v_result := null;
      end if;
    end if;

    -- Durable compensation: a normal failure JSON result, not an exception,
    -- after inserting exactly one compensation-outbox row. The original
    -- order and original authorization are never mutated on this path.
    if v_result is not null and (v_result ->> 'compensation') = 'void_new_card_authorization' then
      insert into public.gyeon_order_external_compensation_outbox (
        order_id, dealer_id, evidence_id, prepared_operation_id, idempotency_identity
      ) values (
        p_order_id, p_dealer_id, p_evidence_id, v_prepared.id,
        concat('void:', v_prepared.id, ':', coalesce(p_evidence_id::text, 'none'))
      )
      on conflict (idempotency_identity) do nothing;
    end if;

    if v_result is not null then
      update public.gyeon_order_idempotency_v3 i set
        order_id = p_order_id, response_payload = v_result, completed_at = now()
      where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
      return v_result;
    end if;
  else
    if v_order.aggregate_version <> p_expected_version then
      v_result := jsonb_build_object('ok', false, 'code', 'order_version_conflict', 'compensation', 'none');
      update public.gyeon_order_idempotency_v3 i set
        order_id = p_order_id, response_payload = v_result, completed_at = now()
      where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
      return v_result;
    end if;
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
    -- A2-01: persist the server-owned link to the accepted card evidence.
    -- Reaching this update with payment_method = 'card' already proves the
    -- exact prepared operation and exact accepted evidence were consumed.
    card_authority_evidence_id = case when p_payment_method = 'card' then p_evidence_id else card_authority_evidence_id end,
    card_authority_request_fingerprint = case
      when p_payment_method = 'card' then v_prepared.request_fingerprint
      else card_authority_request_fingerprint
    end,
    -- R2-02: this is the one and only place a payment-contract snapshot is
    -- ever written. Reaching this update already proves v_order.status was
    -- 'draft' (owner-submit finalize is the sole draft-to-submitted path),
    -- so the snapshot is written exactly once per order and is never
    -- revisited by a later edit, cancel, or credit-terms change.
    payment_contract_kind = case
      when p_payment_method = 'credit_account' then 'credit_account'
      else 'standard_payment'
    end,
    payment_contract_credit_terms_version = case
      when p_payment_method = 'credit_account' then v_credit.terms_version
      else null
    end,
    backorder_policy = p_backorder_policy,
    earliest_ship_date = private.gyeon_order_v3_earliest_ship_date(now()),
    aggregate_version = aggregate_version + 1,
    updated_at = now()
  where id = p_order_id;

  insert into public.gyeon_order_owner_review_events (
    order_id, dealer_id, event_type, actor_id, order_version
  ) values (p_order_id, p_dealer_id, 'owner_confirmed', p_actor_id, p_expected_version + 1);

  v_result := jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', 'submitted');
  update public.gyeon_order_idempotency_v3 i set
    order_id = p_order_id, response_payload = v_result, completed_at = now()
  where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- C5-B: pre-warehouse-edit prepare/finalize split. When the amount is
-- unchanged, finalize proceeds without external authorization; a changed
-- amount for a card order requires a prepared card reauthorization first.
-- -----------------------------------------------------------------------------

drop function if exists public.edit_gyeon_order_v3_before_warehouse_rpc(uuid, uuid, uuid, bigint, uuid, jsonb, uuid);

create or replace function public.prepare_gyeon_order_v3_edit_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_replacement_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_buyer_rank text;
  v_line jsonb;
  v_product public.gyeon_products%rowtype;
  v_offer public.gyeon_product_order_offers_v3%rowtype;
  v_quantity integer;
  v_new_list_ex integer := 0;
  v_new_grand_total integer;
  v_fingerprint text;
  v_prepared_id uuid;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  perform private.gyeon_order_v3_assert_actor(p_dealer_id, p_actor_id, array['owner']::text[]);
  select * into v_order from public.product_orders o
   where o.id = p_order_id and o.dealer_id = p_dealer_id for update;
  if not found or v_order.status <> 'submitted' or v_order.warehouse_accepted_at is not null then
    raise exception using errcode = '55000', message = 'WAREHOUSE_ACCEPTED_ORDER_IMMUTABLE';
  end if;
  -- R2-02: a submitted order without an explicit frozen payment-contract
  -- snapshot fails closed. Nothing is inferred, defaulted, or backfilled.
  if v_order.payment_contract_kind is null then
    raise exception using errcode = '55000', message = 'PAYMENT_CONTRACT_SNAPSHOT_MISSING';
  end if;
  if v_order.aggregate_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
  end if;
  if jsonb_typeof(p_replacement_lines) <> 'array' or jsonb_array_length(p_replacement_lines) = 0 then
    raise exception using errcode = '22023', message = 'ORDER_LINES_REQUIRED';
  end if;

  select gom.buyer_rank into strict v_buyer_rank
  from public.gyeon_ordering_memberships gom
  where gom.dealer_id = p_dealer_id
    and gom.membership_status = 'active'
    and gom.effective_from <= now()
    and (gom.effective_to is null or gom.effective_to > now());

  for v_line in select value from jsonb_array_elements(p_replacement_lines)
  loop
    if (v_line - array['product_id', 'quantity']) <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'CLIENT_COMMERCIAL_FIELDS_FORBIDDEN';
    end if;
    if (v_line ->> 'quantity') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = '22023', message = 'QUANTITY_MUST_BE_POSITIVE_INTEGER';
    end if;
    v_quantity := (v_line ->> 'quantity')::integer;
    select * into strict v_product from public.gyeon_products p
     where p.id = (v_line ->> 'product_id')::uuid and p.is_active = true;
    select o.* into strict v_offer from public.gyeon_product_order_offers_v3 o
     where o.product_id = v_product.id and o.buyer_rank = v_buyer_rank
       and o.publication_state = 'published' and o.is_sellable = true
       and o.effective_from <= now() and (o.effective_to is null or o.effective_to > now());
    v_new_list_ex := v_new_list_ex + (v_offer.list_price_ex_tax_yen * v_quantity);
  end loop;

  v_new_grand_total := v_new_list_ex + coalesce(v_order.shipping_fee_ex_tax_yen, 0) + coalesce(v_order.tax_yen, 0);
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'edit_finalize', p_order_id, p_expected_version, p_replacement_lines
  );

  if v_order.payment_method <> 'card' or v_new_grand_total = coalesce(v_order.grand_total_inc_tax_yen, v_new_grand_total) then
    return jsonb_build_object(
      'ok', true, 'action', 'finalize_without_external_authorization',
      'request_fingerprint', v_fingerprint, 'amount_inc_tax_yen', v_new_grand_total, 'currency', 'JPY'
    );
  end if;

  insert into public.gyeon_order_prepared_operations_v1 (
    kind, dealer_id, order_id, expected_order_version, request_fingerprint,
    amount_inc_tax_yen, currency, evidence_purpose, prepared_by, expires_at
  ) values (
    'edit_before_warehouse', p_dealer_id, p_order_id, p_expected_version, v_fingerprint,
    v_new_grand_total, 'JPY', 'edit_reauthorization', p_actor_id, v_expires_at
  ) returning id into v_prepared_id;

  return jsonb_build_object(
    'ok', true, 'action', 'prepare_card_reauthorization',
    'prepared_operation_id', v_prepared_id, 'evidence_purpose', 'edit_reauthorization',
    'request_fingerprint', v_fingerprint, 'amount_inc_tax_yen', v_new_grand_total,
    'currency', 'JPY', 'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.finalize_gyeon_order_v3_edit_rpc(
  p_dealer_id uuid,
  p_actor_id uuid,
  p_order_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid,
  p_replacement_lines jsonb,
  p_prepared_operation_id uuid default null,
  p_evidence_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prepared public.gyeon_order_prepared_operations_v1%rowtype;
  v_order public.product_orders%rowtype;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
  v_validation jsonb;
  v_should_compensate boolean := false;
  v_line jsonb;
  v_product public.gyeon_products%rowtype;
  v_offer public.gyeon_product_order_offers_v3%rowtype;
  v_buyer_rank text;
  v_quantity integer;
  v_list_ex integer := 0;
begin
  perform private.gyeon_order_v3_assert_actor(p_dealer_id, p_actor_id, array['owner']::text[]);
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'edit_finalize', p_order_id, p_expected_version, p_replacement_lines
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    p_dealer_id, p_actor_id, p_idempotency_key, 'edit_finalize', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;

  -- Deterministic lock order: prepared operation, then order, then evidence.
  if p_prepared_operation_id is not null then
    select * into v_prepared
    from public.gyeon_order_prepared_operations_v1 p
    where p.id = p_prepared_operation_id
      and p.kind = 'edit_before_warehouse' and p.dealer_id = p_dealer_id and p.order_id = p_order_id
    for update;
    if not found or v_prepared.consumed_at is not null then
      v_result := jsonb_build_object('ok', false, 'code', 'prepared_operation_invalid', 'compensation', 'none');
      update public.gyeon_order_idempotency_v3 i set
        order_id = p_order_id, response_payload = v_result, completed_at = now()
      where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
      return v_result;
    end if;
  end if;

  select * into v_order from public.product_orders o
   where o.id = p_order_id and o.dealer_id = p_dealer_id for update;
  if not found or v_order.status <> 'submitted' or v_order.warehouse_accepted_at is not null then
    raise exception using errcode = '55000', message = 'WAREHOUSE_ACCEPTED_ORDER_IMMUTABLE';
  end if;
  -- R2-02: a submitted order without an explicit frozen payment-contract
  -- snapshot fails closed. Nothing is inferred, defaulted, or backfilled.
  if v_order.payment_contract_kind is null then
    raise exception using errcode = '55000', message = 'PAYMENT_CONTRACT_SNAPSHOT_MISSING';
  end if;

  if p_prepared_operation_id is not null then
    v_should_compensate := p_evidence_id is not null and exists (
      select 1 from public.gyeon_order_external_evidence_v1 e
      where e.id = p_evidence_id
        and e.authority = 'server_verified' and e.state = 'succeeded' and e.consumed_at is null
        and e.purpose = v_prepared.evidence_purpose
        and e.dealer_id = v_prepared.dealer_id and e.order_id = v_prepared.order_id
        and e.order_version = v_prepared.expected_order_version
        and e.request_fingerprint = v_prepared.request_fingerprint
        and e.amount_inc_tax_yen = v_prepared.amount_inc_tax_yen
        and e.currency = v_prepared.currency
    );

    if now() >= v_prepared.expires_at then
      v_result := jsonb_build_object('ok', false, 'code', 'prepared_operation_expired',
        'compensation', case when v_should_compensate then 'void_new_card_authorization' else 'none' end);
    elsif v_order.aggregate_version <> v_prepared.expected_order_version then
      v_result := jsonb_build_object('ok', false, 'code', 'order_version_conflict',
        'compensation', case when v_should_compensate then 'void_new_card_authorization' else 'none' end);
    elsif v_fingerprint <> v_prepared.request_fingerprint then
      v_result := jsonb_build_object('ok', false, 'code', 'request_fingerprint_conflict',
        'compensation', case when v_should_compensate then 'void_new_card_authorization' else 'none' end);
    else
      v_validation := private.gyeon_order_v3_validate_and_consume_evidence(
        p_evidence_id, v_prepared.evidence_purpose, p_dealer_id, p_order_id,
        p_expected_version, v_fingerprint, v_prepared.amount_inc_tax_yen,
        v_prepared.currency, 'edit_finalize'
      );
      if not (v_validation ->> 'ok')::boolean then
        v_result := jsonb_build_object('ok', false, 'code', v_validation ->> 'code', 'compensation', 'none');
      else
        update public.gyeon_order_prepared_operations_v1
          set consumed_at = now(), consumed_by_operation = 'edit_finalize'
        where id = v_prepared.id;
        v_result := null;
      end if;
    end if;

    -- Durable compensation: a normal failure JSON result, not an exception.
    if v_result is not null and (v_result ->> 'compensation') = 'void_new_card_authorization' then
      insert into public.gyeon_order_external_compensation_outbox (
        order_id, dealer_id, evidence_id, prepared_operation_id, idempotency_identity
      ) values (
        p_order_id, p_dealer_id, p_evidence_id, v_prepared.id,
        concat('void:', v_prepared.id, ':', coalesce(p_evidence_id::text, 'none'))
      )
      on conflict (idempotency_identity) do nothing;
    end if;

    if v_result is not null then
      update public.gyeon_order_idempotency_v3 i set
        order_id = p_order_id, response_payload = v_result, completed_at = now()
      where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
      return v_result;
    end if;
  else
    if v_order.aggregate_version <> p_expected_version then
      v_result := jsonb_build_object('ok', false, 'code', 'order_version_conflict', 'compensation', 'none');
      update public.gyeon_order_idempotency_v3 i set
        order_id = p_order_id, response_payload = v_result, completed_at = now()
      where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
      return v_result;
    end if;
  end if;

  -- Replacement lines are re-snapshotted from server offer/product authority,
  -- mirroring save_gyeon_order_v3_draft_rpc. Prepare and finalize are
  -- separate transactions, so the recompute is intentionally repeated here.
  delete from public.product_order_items where order_id = p_order_id;

  select gom.buyer_rank into strict v_buyer_rank
  from public.gyeon_ordering_memberships gom
  where gom.dealer_id = p_dealer_id
    and gom.membership_status = 'active'
    and gom.effective_from <= now()
    and (gom.effective_to is null or gom.effective_to > now());

  for v_line in select value from jsonb_array_elements(p_replacement_lines)
  loop
    v_quantity := (v_line ->> 'quantity')::integer;
    select * into strict v_product from public.gyeon_products p
     where p.id = (v_line ->> 'product_id')::uuid and p.is_active = true;
    select o.* into strict v_offer from public.gyeon_product_order_offers_v3 o
     where o.product_id = v_product.id and o.buyer_rank = v_buyer_rank
       and o.publication_state = 'published' and o.is_sellable = true
       and o.effective_from <= now() and (o.effective_to is null or o.effective_to > now());
    v_list_ex := v_list_ex + (v_offer.list_price_ex_tax_yen * v_quantity);
    insert into public.product_order_items (
      order_id, product_id, sku, product_name_snapshot, retail_price_snapshot,
      quantity, subtotal, list_price_ex_tax_snapshot, list_price_inc_tax_snapshot,
      purchase_price_ex_tax_snapshot, purchase_price_inc_tax_snapshot,
      tax_rate_bps_snapshot, line_total_ex_tax_snapshot, line_total_inc_tax_snapshot,
      offer_version_snapshot, is_promotional_goods_snapshot
    ) values (
      p_order_id, v_product.id, v_product.sku, v_product.product_name,
      v_offer.list_price_ex_tax_yen, v_quantity,
      v_offer.purchase_price_ex_tax_yen * v_quantity,
      v_offer.list_price_ex_tax_yen, v_offer.list_price_inc_tax_yen,
      v_offer.purchase_price_ex_tax_yen, v_offer.purchase_price_inc_tax_yen,
      v_offer.tax_rate_bps, v_offer.purchase_price_ex_tax_yen * v_quantity,
      v_offer.purchase_price_inc_tax_yen * v_quantity, v_offer.offer_version,
      v_offer.is_promotional_goods
    );
  end loop;

  update public.product_orders set
    merchandise_list_ex_tax_yen = v_list_ex,
    grand_total_inc_tax_yen = v_list_ex + coalesce(shipping_fee_ex_tax_yen, 0) + coalesce(tax_yen, 0),
    -- A2-01: reaching this update with p_prepared_operation_id not null
    -- already proves the reauthorization evidence was consumed, so the
    -- link is atomically replaced. An amount-preserving edit never took
    -- the prepared-operation path, so the existing link is preserved.
    card_authority_evidence_id = case when p_prepared_operation_id is not null then p_evidence_id else card_authority_evidence_id end,
    card_authority_request_fingerprint = case
      when p_prepared_operation_id is not null then v_prepared.request_fingerprint
      else card_authority_request_fingerprint
    end,
    aggregate_version = aggregate_version + 1,
    request_fingerprint = v_fingerprint,
    updated_at = now()
  where id = p_order_id;

  v_result := jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', 'submitted');
  update public.gyeon_order_idempotency_v3 i set
    order_id = p_order_id, response_payload = v_result, completed_at = now()
  where i.dealer_id = p_dealer_id and i.idempotency_key = p_idempotency_key;
  return v_result;
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

-- -----------------------------------------------------------------------------
-- C5-B: warehouse release/accept split. Release is service-only and creates
-- exactly one `unaccepted` task once payment, supply, reservation/backorder,
-- and calendar authorities are ready. Accept requires expected order and
-- task versions, locks and consumes an existing unaccepted task, and never
-- performs the first insert.
-- -----------------------------------------------------------------------------

create or replace function public.release_gyeon_order_v3_warehouse_rpc(
  p_order_id uuid,
  p_service_actor_id uuid,
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
  v_supply_ok boolean;
  v_reservation_fingerprint text;
  v_reservation_evidence_count integer;
  v_reservation_evidence_id uuid;
  v_bank_fingerprint text;
  v_bank_evidence_count integer;
  v_bank_evidence_id uuid;
  v_card_evidence public.gyeon_order_external_evidence_v1%rowtype;
begin
  select * into v_order from public.product_orders o where o.id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'warehouse_release', p_order_id, v_order.aggregate_version, '{}'::jsonb
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    v_order.dealer_id, p_service_actor_id, p_idempotency_key, 'warehouse_release', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;

  if v_order.status <> 'submitted' then
    raise exception using errcode = '55000', message = 'ORDER_NOT_SUBMITTED';
  end if;

  if exists (select 1 from public.gyeon_order_warehouse_tasks t where t.order_id = p_order_id) then
    v_result := jsonb_build_object('ok', true, 'action', 'noop_existing', 'order_id', p_order_id);
    update public.gyeon_order_idempotency_v3 i set
      order_id = p_order_id, response_payload = v_result, completed_at = now()
    where i.dealer_id = v_order.dealer_id and i.idempotency_key = p_idempotency_key;
    return v_result;
  end if;

  -- R2-02: release revalidates the frozen payment-contract snapshot, never
  -- the mutable current credit-terms row. A later credit-terms activation
  -- must not retroactively force an already-frozen standard-payment order
  -- onto credit_account, and a frozen credit_account order can never
  -- release under a different method. A submitted order without an
  -- explicit frozen snapshot fails closed; nothing is inferred, defaulted,
  -- or backfilled from the mutable current row.
  if v_order.payment_contract_kind is null then
    raise exception using errcode = '55000', message = 'PAYMENT_CONTRACT_SNAPSHOT_MISSING';
  end if;
  if v_order.payment_contract_kind = 'credit_account' and v_order.payment_method <> 'credit_account' then
    raise exception using errcode = '55000', message = 'CREDIT_ACCOUNT_TERMS_FORCE_METHOD';
  end if;
  if v_order.payment_contract_kind = 'standard_payment' and v_order.payment_method = 'credit_account' then
    raise exception using errcode = '55000', message = 'PAYMENT_CONTRACT_SNAPSHOT_MISMATCH';
  end if;

  -- Payment-method-specific release authority. Explicit allow rules replace
  -- a status blocklist; every branch independently revalidates its own
  -- authority at release time instead of trusting stale prepare/finalize state.
  if v_order.payment_method = 'card' then
    if v_order.payment_status <> 'authorized' then
      raise exception using errcode = '55000', message = 'PAYMENT_NOT_RELEASED_TO_WAREHOUSE';
    end if;

    -- A2-01: `payment_status = 'authorized'` alone is never authority. The
    -- server-owned link must resolve to accepted evidence bound to this
    -- exact dealer/order, in the succeeded server-verified state, and
    -- consumed by the finalize operation that produced it.
    if v_order.card_authority_evidence_id is null
       or v_order.card_authority_request_fingerprint is null
    then
      raise exception using errcode = '55000', message = 'CARD_AUTHORITY_MISSING';
    end if;

    select * into v_card_evidence
    from public.gyeon_order_external_evidence_v1 e
    where e.id = v_order.card_authority_evidence_id
    for update;

    if not found
       or v_card_evidence.dealer_id <> v_order.dealer_id
       or v_card_evidence.order_id <> p_order_id
       or v_card_evidence.purpose not in ('initial_authorization', 'edit_reauthorization')
       or v_card_evidence.authority <> 'server_verified'
       or v_card_evidence.state <> 'succeeded'
       or v_card_evidence.expires_at is null
       or now() >= v_card_evidence.expires_at
       or v_card_evidence.consumed_at is null
       or (
         v_card_evidence.purpose = 'initial_authorization'
         and v_card_evidence.consumed_by_operation <> 'owner_submit_finalize'
       )
       or (
         v_card_evidence.purpose = 'edit_reauthorization'
         and v_card_evidence.consumed_by_operation <> 'edit_finalize'
       )
       or v_card_evidence.request_fingerprint <> v_order.card_authority_request_fingerprint
       or v_card_evidence.amount_inc_tax_yen <> v_order.grand_total_inc_tax_yen
       or v_card_evidence.currency <> 'JPY'
    then
      raise exception using errcode = '55000', message = 'CARD_AUTHORITY_INVALID';
    end if;

    if v_order.contains_backorder and v_order.backorder_policy = 'ship_available_first' then
      raise exception using errcode = '55000', message = 'CARD_SPLIT_CAPTURE_UNRESOLVED';
    end if;
  elsif v_order.payment_method = 'bank_transfer_prepaid' then
    if v_order.payment_status <> 'payment_pending' then
      raise exception using errcode = '55000', message = 'PAYMENT_NOT_RELEASED_TO_WAREHOUSE';
    end if;

    v_bank_fingerprint := private.gyeon_order_v3_fingerprint(
      'bank_payment_match', p_order_id, v_order.aggregate_version, '{}'::jsonb
    );

    with candidate as (
      select id
      from public.gyeon_order_external_evidence_v1 e
      where e.purpose = 'bank_payment_match'
        and e.dealer_id = v_order.dealer_id
        and e.order_id = p_order_id
        and e.order_version = v_order.aggregate_version
        and e.request_fingerprint = v_bank_fingerprint
        and e.amount_inc_tax_yen = v_order.grand_total_inc_tax_yen
        and e.currency = 'JPY'
        and e.authority = 'server_verified'
        and e.state = 'succeeded'
        and e.consumed_at is null
        and e.expires_at is not null and e.expires_at > now()
      for update
    )
    select count(*), (array_agg(id))[1] into v_bank_evidence_count, v_bank_evidence_id from candidate;

    if v_bank_evidence_count = 0 then
      raise exception using errcode = '55000', message = 'BANK_PAYMENT_MATCH_EVIDENCE_REQUIRED';
    elsif v_bank_evidence_count > 1 then
      raise exception using errcode = '55000', message = 'BANK_PAYMENT_MATCH_EVIDENCE_AMBIGUOUS';
    end if;

    update public.gyeon_order_external_evidence_v1
      set consumed_at = now(), consumed_by_operation = 'warehouse_release'
    where id = v_bank_evidence_id;

    -- A2-03: bank evidence consumption atomically advances the order to
    -- `paid` before any warehouse task is created.
    update public.product_orders set payment_status = 'paid' where id = p_order_id;
    v_order.payment_status := 'paid';
  elsif v_order.payment_method = 'cash_on_delivery' then
    if v_order.destination_kind = 'customer_direct' then
      raise exception using errcode = '55000', message = 'COD_CUSTOMER_DIRECT_FORBIDDEN';
    end if;
    if v_order.payment_status <> 'not_required' or v_order.owner_review_state <> 'owner_confirmed' then
      raise exception using errcode = '55000', message = 'PAYMENT_NOT_RELEASED_TO_WAREHOUSE';
    end if;
  elsif v_order.payment_method = 'credit_account' then
    if v_order.payment_status <> 'not_required' then
      raise exception using errcode = '55000', message = 'PAYMENT_NOT_RELEASED_TO_WAREHOUSE';
    end if;
    -- R2-02: revalidate the exact bound terms version, not merely any
    -- currently active row. A stopped, expired, missing, or otherwise
    -- different current version is never a substitute for the version
    -- bound at first finalize.
    if not exists (
      select 1 from public.gyeon_dealer_credit_terms c
      where c.dealer_id = v_order.dealer_id
        and c.terms_version = v_order.payment_contract_credit_terms_version
        and c.credit_state = 'active'
        and c.effective_from <= now()
        and (c.effective_to is null or c.effective_to > now())
    ) then
      raise exception using errcode = '55000', message = 'CREDIT_ACCOUNT_NOT_ENABLED';
    end if;
  else
    raise exception using errcode = '55000', message = 'PAYMENT_NOT_RELEASED_TO_WAREHOUSE';
  end if;

  if v_order.earliest_ship_date is null then
    raise exception using errcode = '55000', message = 'EARLIEST_SHIP_DATE_AUTHORITY_REQUIRED';
  end if;

  select bool_and(coalesce(s.authority_state, 'NOT_CONFIGURED') = 'CONFIGURED')
    into v_supply_ok
  from public.product_order_items i
  left join public.gyeon_order_supply_projection s on s.product_id = i.product_id
  where i.order_id = p_order_id;
  if not coalesce(v_supply_ok, false) then
    raise exception using errcode = '55000', message = 'SUPPLY_AUTHORITY_NOT_VERIFIED';
  end if;

  -- R2-01: a non-backorder release requires exactly one unconsumed,
  -- server-verified, successful, unexpired inventory_reservation evidence
  -- row bound to the exact dealer/order/current version/server-owned
  -- fingerprint/amount/currency. The candidate is locked and consumed
  -- exactly once, before the warehouse task is inserted. The separately
  -- approved backorder authority stays independent: a backorder release
  -- never searches for or consumes this evidence.
  if not v_order.contains_backorder then
    v_reservation_fingerprint := private.gyeon_order_v3_fingerprint(
      'inventory_reservation', p_order_id, v_order.aggregate_version, '{}'::jsonb
    );

    with candidate as (
      select id
      from public.gyeon_order_external_evidence_v1 e
      where e.purpose = 'inventory_reservation'
        and e.dealer_id = v_order.dealer_id
        and e.order_id = p_order_id
        and e.order_version = v_order.aggregate_version
        and e.request_fingerprint = v_reservation_fingerprint
        and e.amount_inc_tax_yen = v_order.grand_total_inc_tax_yen
        and e.currency = 'JPY'
        and e.authority = 'server_verified'
        and e.state = 'succeeded'
        and e.consumed_at is null
        and e.expires_at is not null and e.expires_at > now()
      for update
    )
    select count(*), (array_agg(id))[1] into v_reservation_evidence_count, v_reservation_evidence_id from candidate;

    if v_reservation_evidence_count = 0 then
      raise exception using errcode = '55000', message = 'INVENTORY_RESERVATION_EVIDENCE_REQUIRED';
    elsif v_reservation_evidence_count > 1 then
      raise exception using errcode = '55000', message = 'INVENTORY_RESERVATION_EVIDENCE_AMBIGUOUS';
    end if;

    update public.gyeon_order_external_evidence_v1
      set consumed_at = now(), consumed_by_operation = 'warehouse_release'
    where id = v_reservation_evidence_id;
  end if;

  insert into public.gyeon_order_warehouse_tasks (order_id, dealer_id, task_state, task_version)
  values (p_order_id, v_order.dealer_id, 'unaccepted', 1)
  on conflict (order_id) do nothing;

  v_result := jsonb_build_object('ok', true, 'action', 'create_unaccepted', 'order_id', p_order_id);
  update public.gyeon_order_idempotency_v3 i set
    order_id = p_order_id, response_payload = v_result, completed_at = now()
  where i.dealer_id = v_order.dealer_id and i.idempotency_key = p_idempotency_key;
  return v_result;
end;
$$;

drop function if exists public.accept_gyeon_order_v3_warehouse_rpc(uuid, uuid, bigint, uuid);

create or replace function public.accept_gyeon_order_v3_warehouse_rpc(
  p_order_id uuid,
  p_service_actor_id uuid,
  p_expected_order_version bigint,
  p_expected_task_version bigint,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.product_orders%rowtype;
  v_task public.gyeon_order_warehouse_tasks%rowtype;
  v_fingerprint text;
  v_prior jsonb;
  v_result jsonb;
begin
  select * into v_order from public.product_orders o where o.id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  v_fingerprint := private.gyeon_order_v3_fingerprint(
    'warehouse_accept', p_order_id, p_expected_order_version,
    jsonb_build_object('expected_task_version', p_expected_task_version)
  );
  v_prior := private.gyeon_order_v3_claim_idempotency(
    v_order.dealer_id, p_service_actor_id, p_idempotency_key, 'warehouse_accept', v_fingerprint
  );
  if v_prior is not null then return v_prior; end if;

  if v_order.status <> 'submitted' then
    raise exception using errcode = '55000', message = 'WAREHOUSE_ACCEPT_NOT_ALLOWED';
  end if;
  if v_order.aggregate_version <> p_expected_order_version then
    raise exception using errcode = '40001', message = 'ORDER_VERSION_CONFLICT';
  end if;

  -- The task must already exist from release_gyeon_order_v3_warehouse_rpc.
  -- This RPC locks and consumes it; it never performs the first insert.
  select * into v_task from public.gyeon_order_warehouse_tasks t
   where t.order_id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'WAREHOUSE_TASK_NOT_FOUND';
  end if;
  if v_task.task_state <> 'unaccepted' then
    raise exception using errcode = '55000', message = 'WAREHOUSE_TASK_NOT_UNACCEPTED';
  end if;
  if v_task.task_version <> p_expected_task_version then
    raise exception using errcode = '40001', message = 'TASK_VERSION_CONFLICT';
  end if;

  update public.gyeon_order_warehouse_tasks set
    task_state = 'accepted', accepted_by = p_service_actor_id, accepted_at = now(),
    task_version = task_version + 1, updated_at = now()
  where order_id = p_order_id;

  update public.product_orders set status = 'approved', warehouse_accepted_by = p_service_actor_id,
    warehouse_accepted_at = now(), aggregate_version = aggregate_version + 1,
    updated_at = now() where id = p_order_id;

  v_result := jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', 'approved');
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
alter table public.gyeon_order_external_evidence_v1 enable row level security;
alter table public.gyeon_order_prepared_operations_v1 enable row level security;
alter table public.gyeon_qualification_rule_versions enable row level security;
alter table public.gyeon_product_qualification_classification enable row level security;
alter table public.gyeon_dealer_qualification_mode_projection enable row level security;
alter table public.gyeon_order_qualification_snapshots enable row level security;
alter table public.gyeon_order_external_compensation_outbox enable row level security;
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
  public.gyeon_order_external_evidence_v1,
  public.gyeon_order_prepared_operations_v1,
  public.gyeon_qualification_rule_versions,
  public.gyeon_product_qualification_classification,
  public.gyeon_dealer_qualification_mode_projection,
  public.gyeon_order_qualification_snapshots,
  public.gyeon_order_external_compensation_outbox,
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
  public.gyeon_order_external_evidence_v1,
  public.gyeon_order_prepared_operations_v1,
  public.gyeon_qualification_rule_versions,
  public.gyeon_product_qualification_classification,
  public.gyeon_dealer_qualification_mode_projection,
  public.gyeon_order_qualification_snapshots,
  public.gyeon_order_external_compensation_outbox,
  public.gyeon_order_warehouse_tasks,
  public.gyeon_order_notification_outbox
to service_role;

-- Revoke default function execution, then grant exact public entrypoints.
revoke all on function private.gyeon_order_v3_assert_actor(uuid, uuid, text[]) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_can_read_dealer(uuid) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_fingerprint(text, uuid, bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_claim_idempotency(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_earliest_ship_date(timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_validate_and_consume_evidence(uuid, text, uuid, uuid, bigint, text, integer, text, text) from public, anon, authenticated, service_role;
revoke all on function private.gyeon_order_v3_evaluate_qualification(uuid, uuid, bigint, text, text) from public, anon, authenticated, service_role;
revoke all on function public.list_gyeon_order_catalog_v3_rpc(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.save_gyeon_order_v3_draft_rpc(uuid, uuid, uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.request_gyeon_order_v3_owner_review_rpc(uuid, uuid, uuid, bigint, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.prepare_gyeon_order_v3_owner_submit_rpc(uuid, uuid, uuid, bigint, text, text) from public, anon, authenticated, service_role;
revoke all on function public.finalize_gyeon_order_v3_owner_submit_rpc(uuid, uuid, uuid, bigint, uuid, text, text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.prepare_gyeon_order_v3_edit_rpc(uuid, uuid, uuid, bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.finalize_gyeon_order_v3_edit_rpc(uuid, uuid, uuid, bigint, uuid, jsonb, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_gyeon_order_v3_before_warehouse_rpc(uuid, uuid, uuid, bigint, uuid) from public, anon, authenticated, service_role;
revoke all on function public.release_gyeon_order_v3_warehouse_rpc(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.accept_gyeon_order_v3_warehouse_rpc(uuid, uuid, bigint, bigint, uuid) from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.gyeon_order_v3_can_read_dealer(uuid) to authenticated;
grant execute on function public.save_gyeon_order_v3_draft_rpc(uuid, uuid, uuid, uuid, bigint, jsonb, jsonb) to authenticated;
grant execute on function public.list_gyeon_order_catalog_v3_rpc(uuid, uuid) to authenticated;
grant execute on function public.request_gyeon_order_v3_owner_review_rpc(uuid, uuid, uuid, bigint, uuid, text) to authenticated;
grant execute on function public.prepare_gyeon_order_v3_owner_submit_rpc(uuid, uuid, uuid, bigint, text, text) to authenticated;
grant execute on function public.finalize_gyeon_order_v3_owner_submit_rpc(uuid, uuid, uuid, bigint, uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.prepare_gyeon_order_v3_edit_rpc(uuid, uuid, uuid, bigint, jsonb) to authenticated;
grant execute on function public.finalize_gyeon_order_v3_edit_rpc(uuid, uuid, uuid, bigint, uuid, jsonb, uuid, uuid) to authenticated;
grant execute on function public.cancel_gyeon_order_v3_before_warehouse_rpc(uuid, uuid, uuid, bigint, uuid) to authenticated;
grant execute on function public.release_gyeon_order_v3_warehouse_rpc(uuid, uuid, uuid) to service_role;
grant execute on function public.accept_gyeon_order_v3_warehouse_rpc(uuid, uuid, bigint, bigint, uuid) to service_role;

-- Deliberately roll back if this file is accidentally executed as a script.
-- Formal migration promotion must remove this guard only after C5-C acceptance.
rollback;
