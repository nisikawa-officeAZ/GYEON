-- 063_uat_management.sql
-- PHASE63: UAT (User Acceptance Testing) management tables
-- DO NOT APPLY AUTOMATICALLY.
-- Apply manually in Supabase SQL Editor on STAGING environment only.
-- Never apply to production without CTO approval.

-- ─── uat_dealers ─────────────────────────────────────────────────────────────

create table if not exists uat_dealers (
  id           uuid        primary key default gen_random_uuid(),
  dealer_name  text        not null,
  contact_name text,
  email        text,
  country      text,
  status       text        not null default 'invited',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint uat_dealers_status_check
    check (status in ('invited', 'active', 'completed', 'withdrawn'))
);

-- ─── uat_sessions ────────────────────────────────────────────────────────────

create table if not exists uat_sessions (
  id          uuid        primary key default gen_random_uuid(),
  dealer_id   uuid        references uat_dealers(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  status      text        not null default 'active',
  summary     text,
  created_at  timestamptz not null default now(),
  constraint uat_sessions_status_check
    check (status in ('active', 'completed', 'paused'))
);

create index if not exists uat_sessions_dealer_id_idx
  on uat_sessions(dealer_id);

-- ─── uat_feedback ────────────────────────────────────────────────────────────

create table if not exists uat_feedback (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        references uat_sessions(id) on delete cascade,
  category    text,
  rating      integer     check (rating >= 1 and rating <= 5),
  title       text        not null,
  description text,
  status      text        not null default 'open',
  created_at  timestamptz not null default now(),
  constraint uat_feedback_status_check
    check (status in ('open', 'accepted', 'planned', 'rejected', 'implemented'))
);

create index if not exists uat_feedback_session_id_idx
  on uat_feedback(session_id);

create index if not exists uat_feedback_status_idx
  on uat_feedback(status);

-- ─── uat_issues ──────────────────────────────────────────────────────────────

create table if not exists uat_issues (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        references uat_sessions(id) on delete set null,
  severity     text        not null default 'medium',
  title        text        not null,
  description  text,
  status       text        not null default 'open',
  resolution   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  constraint uat_issues_severity_check
    check (severity in ('low', 'medium', 'high', 'critical')),
  constraint uat_issues_status_check
    check (status in ('open', 'investigating', 'resolved', 'wont_fix'))
);

create index if not exists uat_issues_severity_idx
  on uat_issues(severity, status);

-- ─── RLS: Enable ─────────────────────────────────────────────────────────────

alter table uat_dealers  enable row level security;
alter table uat_sessions enable row level security;
alter table uat_feedback enable row level security;
alter table uat_issues   enable row level security;

-- ─── RLS: Super Admin only — SELECT ──────────────────────────────────────────

create policy "admin_select_uat_dealers"
  on uat_dealers for select to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_select_uat_sessions"
  on uat_sessions for select to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_select_uat_feedback"
  on uat_feedback for select to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_select_uat_issues"
  on uat_issues for select to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- ─── RLS: Super Admin only — INSERT ──────────────────────────────────────────

create policy "admin_insert_uat_dealers"
  on uat_dealers for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_insert_uat_sessions"
  on uat_sessions for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_insert_uat_feedback"
  on uat_feedback for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_insert_uat_issues"
  on uat_issues for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- ─── RLS: Super Admin only — UPDATE ──────────────────────────────────────────

create policy "admin_update_uat_dealers"
  on uat_dealers for update to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_update_uat_sessions"
  on uat_sessions for update to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_update_uat_feedback"
  on uat_feedback for update to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

create policy "admin_update_uat_issues"
  on uat_issues for update to authenticated
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- ─── NO DELETE policies (DELETE prohibited) ───────────────────────────────────

-- ─── updated_at trigger ──────────────────────────────────────────────────────

create or replace function update_uat_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger uat_dealers_updated_at
  before update on uat_dealers
  for each row execute function update_uat_updated_at();

-- ─── Seed: pre-registered test dealers ───────────────────────────────────────
-- These are seeded automatically when this migration is applied.
-- They represent suggested UAT participants for staging verification.

insert into uat_dealers (dealer_name, contact_name, country, status, notes)
values
  ('GYEON Test Osaka',  'Test Operator A', 'Japan',     'invited', 'Primary Japan test dealer — west region'),
  ('GYEON Test Tokyo',  'Test Operator B', 'Japan',     'invited', 'Primary Japan test dealer — east region'),
  ('GYEON Test Sydney', 'Test Operator C', 'Australia', 'invited', 'Asia-Pacific test dealer'),
  ('GYEON Test Munich', 'Test Operator D', 'Germany',   'invited', 'Europe test dealer')
on conflict do nothing;
