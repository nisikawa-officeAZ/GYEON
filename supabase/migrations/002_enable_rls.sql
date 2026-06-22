-- =============================================================================
-- DealerOS — Row Level Security Migration
-- File: 002_enable_rls.sql
-- =============================================================================
-- NOTE: This migration is not applied yet.
--       Created for Development Supabase only.
--       Production use is prohibited until explicit approval.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------

alter table customers               enable row level security;
alter table vehicles                enable row level security;
alter table estimates               enable row level security;
alter table gyeon_service_estimates enable row level security;


-- -----------------------------------------------------------------------------
-- customers policies
-- -----------------------------------------------------------------------------

create policy customers_select_own
  on customers
  for select
  using (dealer_id = auth.uid());

create policy customers_insert_own
  on customers
  for insert
  with check (dealer_id = auth.uid());

create policy customers_update_own
  on customers
  for update
  using (dealer_id = auth.uid())
  with check (dealer_id = auth.uid());

create policy customers_delete_own
  on customers
  for delete
  using (dealer_id = auth.uid());


-- -----------------------------------------------------------------------------
-- vehicles policies
-- -----------------------------------------------------------------------------

create policy vehicles_select_own
  on vehicles
  for select
  using (dealer_id = auth.uid());

create policy vehicles_insert_own
  on vehicles
  for insert
  with check (dealer_id = auth.uid());

create policy vehicles_update_own
  on vehicles
  for update
  using (dealer_id = auth.uid())
  with check (dealer_id = auth.uid());

create policy vehicles_delete_own
  on vehicles
  for delete
  using (dealer_id = auth.uid());


-- -----------------------------------------------------------------------------
-- estimates policies
-- -----------------------------------------------------------------------------

create policy estimates_select_own
  on estimates
  for select
  using (dealer_id = auth.uid());

create policy estimates_insert_own
  on estimates
  for insert
  with check (dealer_id = auth.uid());

create policy estimates_update_own
  on estimates
  for update
  using (dealer_id = auth.uid())
  with check (dealer_id = auth.uid());

create policy estimates_delete_own
  on estimates
  for delete
  using (dealer_id = auth.uid());


-- -----------------------------------------------------------------------------
-- gyeon_service_estimates policies
-- -----------------------------------------------------------------------------

create policy gyeon_select_own
  on gyeon_service_estimates
  for select
  using (dealer_id = auth.uid());

create policy gyeon_insert_own
  on gyeon_service_estimates
  for insert
  with check (dealer_id = auth.uid());

create policy gyeon_update_own
  on gyeon_service_estimates
  for update
  using (dealer_id = auth.uid())
  with check (dealer_id = auth.uid());

create policy gyeon_delete_own
  on gyeon_service_estimates
  for delete
  using (dealer_id = auth.uid());
