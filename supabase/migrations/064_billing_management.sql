-- PHASE64: Commercial billing preparation.
-- dealer_billing: contract/subscription state per dealer.
-- billing_invoices: manual invoice records.
-- No Stripe. No auto-charge. Manual operation only.

-- ─── dealer_billing ────────────────────────────────────────────────────────────

create table if not exists dealer_billing (
  id              uuid primary key default gen_random_uuid(),
  dealer_id       uuid not null references dealers(id) on delete cascade,
  plan_code       text not null default 'trial',
  contract_status text not null default 'trial'
                  check (contract_status in ('trial','active','expired','cancelled','suspended')),
  started_at      timestamptz,
  expires_at      timestamptz,
  renewal_date    timestamptz,
  cancelled_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (dealer_id)
);

-- ─── billing_invoices ──────────────────────────────────────────────────────────

create table if not exists billing_invoices (
  id             uuid primary key default gen_random_uuid(),
  dealer_id      uuid not null references dealers(id) on delete cascade,
  invoice_number text not null unique,
  plan_code      text not null,
  amount         integer not null check (amount >= 0),
  currency       text not null default 'JPY' check (currency = 'JPY'),
  status         text not null default 'draft'
                 check (status in ('draft','issued','paid','overdue','cancelled')),
  issued_at      timestamptz,
  due_at         timestamptz,
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ─── updated_at trigger ────────────────────────────────────────────────────────

create or replace function update_billing_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_dealer_billing_updated_at
  before update on dealer_billing
  for each row execute function update_billing_updated_at();

-- ─── indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_dealer_billing_dealer_id   on dealer_billing(dealer_id);
create index if not exists idx_dealer_billing_status      on dealer_billing(contract_status);
create index if not exists idx_dealer_billing_expires_at  on dealer_billing(expires_at);
create index if not exists idx_billing_invoices_dealer_id on billing_invoices(dealer_id);
create index if not exists idx_billing_invoices_status    on billing_invoices(status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table dealer_billing   enable row level security;
alter table billing_invoices enable row level security;

-- dealer_billing: dealer can view own record
create policy "dealer_billing_dealer_select"
  on dealer_billing for select
  using (
    dealer_id in (
      select id from dealers where user_id = auth.uid()
    )
  );

-- dealer_billing: super admin full access
create policy "dealer_billing_admin_select"
  on dealer_billing for select
  using (exists (select 1 from admin_users where user_id = auth.uid()));

create policy "dealer_billing_admin_insert"
  on dealer_billing for insert
  with check (exists (select 1 from admin_users where user_id = auth.uid()));

create policy "dealer_billing_admin_update"
  on dealer_billing for update
  using (exists (select 1 from admin_users where user_id = auth.uid()));

-- billing_invoices: dealer can view own invoices
create policy "billing_invoices_dealer_select"
  on billing_invoices for select
  using (
    dealer_id in (
      select id from dealers where user_id = auth.uid()
    )
  );

-- billing_invoices: super admin full access
create policy "billing_invoices_admin_select"
  on billing_invoices for select
  using (exists (select 1 from admin_users where user_id = auth.uid()));

create policy "billing_invoices_admin_insert"
  on billing_invoices for insert
  with check (exists (select 1 from admin_users where user_id = auth.uid()));

create policy "billing_invoices_admin_update"
  on billing_invoices for update
  using (exists (select 1 from admin_users where user_id = auth.uid()));

-- NO DELETE policies on either table.
