-- =============================================================================
-- DealerOS — Core Tables Migration
-- File: 001_create_core_tables.sql
-- =============================================================================
-- NOTE: This migration is not applied yet.
--       Created for Development Supabase only.
--       Production use is prohibited until explicit approval.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. customers
-- -----------------------------------------------------------------------------

create table if not exists customers (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  kana        text,
  phone       text,
  email       text,
  postal_code text,
  address     text,
  line_id     text,
  memo        text,
  dealer_id   uuid        null,
  deleted_at  timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists customers_phone_idx on customers (phone);
create index if not exists customers_email_idx on customers (email);


-- -----------------------------------------------------------------------------
-- 2. vehicles
-- -----------------------------------------------------------------------------

create table if not exists vehicles (
  id            uuid        primary key default gen_random_uuid(),
  customer_id   uuid        not null references customers (id) on delete cascade,
  manufacturer  text,
  model         text,
  year          text,
  grade         text,
  body_color    text,
  license_plate text,
  vin           text,
  memo          text,
  dealer_id     uuid        null,
  deleted_at    timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists vehicles_customer_id_idx    on vehicles (customer_id);
create index if not exists vehicles_license_plate_idx  on vehicles (license_plate);


-- -----------------------------------------------------------------------------
-- 3. estimates
-- -----------------------------------------------------------------------------

create table if not exists estimates (
  id          uuid        primary key default gen_random_uuid(),
  customer_id uuid        not null references customers (id) on delete cascade,
  vehicle_id  uuid        not null references vehicles  (id) on delete cascade,
  estimate_no text        not null,
  status      text        not null default 'DRAFT',
  subtotal    numeric     not null default 0,
  tax         numeric     not null default 0,
  total       numeric     not null default 0,
  dealer_id   uuid        null,
  deleted_at  timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint estimates_status_check
    check (status in ('DRAFT', 'SENT', 'APPROVED', 'REJECTED'))
);

create index if not exists estimates_customer_id_idx  on estimates (customer_id);
create index if not exists estimates_vehicle_id_idx   on estimates (vehicle_id);
create index if not exists estimates_estimate_no_idx  on estimates (estimate_no);
create index if not exists estimates_created_at_idx   on estimates (created_at);


-- -----------------------------------------------------------------------------
-- 4. gyeon_service_estimates
-- -----------------------------------------------------------------------------

create table if not exists gyeon_service_estimates (
  id               uuid        primary key default gen_random_uuid(),
  estimate_id      uuid        not null references estimates (id) on delete cascade,
  service_category text        not null,
  body_size        text        not null,
  base_price       numeric     not null default 0,
  options_json     jsonb       not null default '[]'::jsonb,
  discount         numeric     not null default 0,
  subtotal         numeric     not null default 0,
  tax              numeric     not null default 0,
  total            numeric     not null default 0,
  dealer_id        uuid        null,
  deleted_at       timestamptz null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint gyeon_body_size_check
    check (body_size in ('SS', 'S', 'M', 'ML', 'L', 'LL', 'XL')),

  constraint gyeon_service_category_check
    check (service_category in (
      'Coating',
      'PPF',
      'Window Film',
      'Interior',
      'Wheel Coating',
      'Glass Coating',
      'Maintenance'
    ))
);

create index if not exists gyeon_service_estimates_estimate_id_idx
  on gyeon_service_estimates (estimate_id);
