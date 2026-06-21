-- =============================================================================
-- DealerOS — SaaS RLS Migration (dealer_members based)
-- File: 004_enable_saas_rls.sql
-- =============================================================================
-- NOTE: This migration is not applied yet.
--       Created for Development Supabase only.
--       Production use is prohibited until explicit approval.
--
-- Access model:
--   Users access data only through dealer_members membership.
--   dealer_id = auth.uid() is NOT used.
--   All access is resolved via:
--     dealer_id IN (
--       SELECT dealer_id FROM dealer_members
--       WHERE user_id = auth.uid() AND status = 'active'
--     )
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

create policy customers_saas_select
  on customers
  for select
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy customers_saas_insert
  on customers
  for insert
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy customers_saas_update
  on customers
  for update
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  )
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy customers_saas_delete
  on customers
  for delete
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );


-- -----------------------------------------------------------------------------
-- vehicles policies
-- -----------------------------------------------------------------------------

create policy vehicles_saas_select
  on vehicles
  for select
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy vehicles_saas_insert
  on vehicles
  for insert
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy vehicles_saas_update
  on vehicles
  for update
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  )
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy vehicles_saas_delete
  on vehicles
  for delete
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );


-- -----------------------------------------------------------------------------
-- estimates policies
-- -----------------------------------------------------------------------------

create policy estimates_saas_select
  on estimates
  for select
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy estimates_saas_insert
  on estimates
  for insert
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy estimates_saas_update
  on estimates
  for update
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  )
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy estimates_saas_delete
  on estimates
  for delete
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );


-- -----------------------------------------------------------------------------
-- gyeon_service_estimates policies
-- -----------------------------------------------------------------------------

create policy gyeon_saas_select
  on gyeon_service_estimates
  for select
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy gyeon_saas_insert
  on gyeon_service_estimates
  for insert
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy gyeon_saas_update
  on gyeon_service_estimates
  for update
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  )
  with check (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy gyeon_saas_delete
  on gyeon_service_estimates
  for delete
  using (
    dealer_id in (
      select dealer_id
      from dealer_members
      where user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'manager')
    )
  );
