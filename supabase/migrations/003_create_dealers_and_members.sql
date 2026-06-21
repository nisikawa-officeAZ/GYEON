-- =============================================================================
-- DealerOS — Dealers and Dealer Members Migration
-- File: 003_create_dealers_and_members.sql
-- =============================================================================
-- NOTE: This migration is not applied yet.
--       Created for Development Supabase only.
--       Production use is prohibited until explicit approval.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. dealers
-- -----------------------------------------------------------------------------

create table if not exists dealers (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  dealer_type text        not null default 'GYEON_DETAILER',
  prefecture  text,
  address     text,
  phone       text,
  email       text,
  status      text        not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint dealers_dealer_type_check
    check (dealer_type in (
      'GYEON_DETAILER',
      'GYEON_CERTIFIED_DETAILER',
      'ADMIN'
    )),

  constraint dealers_status_check
    check (status in (
      'active',
      'suspended',
      'archived'
    ))
);

create index if not exists dealers_status_idx      on dealers (status);
create index if not exists dealers_dealer_type_idx on dealers (dealer_type);


-- -----------------------------------------------------------------------------
-- 2. dealer_members
-- -----------------------------------------------------------------------------

create table if not exists dealer_members (
  id         uuid        primary key default gen_random_uuid(),
  dealer_id  uuid        not null references dealers    (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  role       text        not null default 'staff',
  status     text        not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dealer_members_role_check
    check (role in (
      'owner',
      'manager',
      'staff',
      'readonly'
    )),

  constraint dealer_members_status_check
    check (status in (
      'active',
      'invited',
      'suspended',
      'removed'
    )),

  constraint dealer_members_dealer_user_unique
    unique (dealer_id, user_id)
);

create index if not exists dealer_members_dealer_id_idx on dealer_members (dealer_id);
create index if not exists dealer_members_user_id_idx   on dealer_members (user_id);
create index if not exists dealer_members_status_idx    on dealer_members (status);
