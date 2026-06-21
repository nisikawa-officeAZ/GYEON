-- 062_staging_verification.sql
-- PHASE62: Staging verification tracking tables
-- DO NOT APPLY AUTOMATICALLY.
-- Apply manually in Supabase SQL Editor on STAGING environment only.
-- Never apply to production without CTO approval.

-- ─── staging_verification_runs ────────────────────────────────────────────────

create table if not exists staging_verification_runs (
  id            uuid         primary key default gen_random_uuid(),
  run_name      text         not null,
  environment   text         not null default 'staging',
  status        text         not null default 'in_progress',
  started_at    timestamptz  not null default now(),
  completed_at  timestamptz,
  completed_by  uuid         references auth.users(id) on delete set null,
  summary       text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  constraint staging_verification_runs_status_check
    check (status in ('in_progress', 'passed', 'failed', 'blocked'))
);

-- ─── staging_verification_items ───────────────────────────────────────────────

create table if not exists staging_verification_items (
  id            uuid         primary key default gen_random_uuid(),
  run_id        uuid         not null references staging_verification_runs(id) on delete cascade,
  category      text         not null,
  item_key      text         not null,
  label         text         not null,
  status        text         not null default 'pending',
  operator_note text,
  evidence_url  text,
  checked_by    uuid         references auth.users(id) on delete set null,
  checked_at    timestamptz,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  constraint staging_verification_items_status_check
    check (status in ('pending', 'passed', 'failed', 'blocked', 'not_applicable'))
);

create index if not exists staging_verification_items_run_id_idx
  on staging_verification_items(run_id);

create index if not exists staging_verification_items_category_idx
  on staging_verification_items(run_id, category);

-- ─── staging_issues ───────────────────────────────────────────────────────────

create table if not exists staging_issues (
  id               uuid         primary key default gen_random_uuid(),
  run_id           uuid         references staging_verification_runs(id) on delete set null,
  severity         text         not null default 'medium',
  status           text         not null default 'open',
  title            text         not null,
  description      text,
  related_area     text,
  resolution_note  text,
  created_by       uuid         references auth.users(id) on delete set null,
  resolved_by      uuid         references auth.users(id) on delete set null,
  created_at       timestamptz  not null default now(),
  resolved_at      timestamptz,
  updated_at       timestamptz  not null default now(),
  constraint staging_issues_severity_check
    check (severity in ('low', 'medium', 'high', 'critical')),
  constraint staging_issues_status_check
    check (status in ('open', 'investigating', 'resolved', 'wont_fix'))
);

create index if not exists staging_issues_run_id_idx
  on staging_issues(run_id);

create index if not exists staging_issues_severity_idx
  on staging_issues(severity, status);

-- ─── RLS: Enable ─────────────────────────────────────────────────────────────

alter table staging_verification_runs  enable row level security;
alter table staging_verification_items enable row level security;
alter table staging_issues             enable row level security;

-- ─── RLS: Super Admin only — SELECT ──────────────────────────────────────────

create policy "admin_select_staging_verification_runs"
  on staging_verification_runs for select to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_select_staging_verification_items"
  on staging_verification_items for select to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_select_staging_issues"
  on staging_issues for select to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- ─── RLS: Super Admin only — INSERT ──────────────────────────────────────────

create policy "admin_insert_staging_verification_runs"
  on staging_verification_runs for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_insert_staging_verification_items"
  on staging_verification_items for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_insert_staging_issues"
  on staging_issues for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- ─── RLS: Super Admin only — UPDATE ──────────────────────────────────────────

create policy "admin_update_staging_verification_runs"
  on staging_verification_runs for update to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_update_staging_verification_items"
  on staging_verification_items for update to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_update_staging_issues"
  on staging_issues for update to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- ─── NO DELETE policies (DELETE prohibited) ───────────────────────────────────
-- No delete policy is intentional — DELETE is not allowed on these tables.

-- ─── updated_at triggers ─────────────────────────────────────────────────────

create or replace function update_staging_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger staging_verification_runs_updated_at
  before update on staging_verification_runs
  for each row execute function update_staging_updated_at();

create trigger staging_verification_items_updated_at
  before update on staging_verification_items
  for each row execute function update_staging_updated_at();

create trigger staging_issues_updated_at
  before update on staging_issues
  for each row execute function update_staging_updated_at();
