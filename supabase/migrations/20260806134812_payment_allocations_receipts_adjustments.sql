-- DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — payment allocations, statement receipts,
-- adjustments, and the single atomic monthly-statement issuance RPC.
--
-- This migration is ADDITIVE to the applied B2 foundation (20260805231712). It:
--   * makes payments.invoice_id NULLABLE and changes its FK ON DELETE CASCADE -> RESTRICT (a receipt is
--     authoritative financial evidence and must never be deleted because an invoice is deleted);
--   * adds mode integrity (legacy_direct / allocated / unapplied are mutually exclusive) and a
--     completed-requires-payment_date CHECK ... NOT VALID (never infer/backfill from created_at);
--   * replaces the old public-role FOR ALL payments policy with separate finance SELECT/INSERT/UPDATE/
--     DELETE policies (super_admin read-only; no super_admin write);
--   * creates public.payment_allocations, public.monthly_statement_receipts (system-owned evidence),
--     public.monthly_statement_adjustments;
--   * adds monthly_statements.payments_received_total and unapplied_credit_total and REPLACES the
--     issuance rule so closing_balance = opening_balance + current_total - payments_received_total +
--     adjustments_total, requiring payments_received_total = allocated_payments_total +
--     unapplied_credit_total and matching the persisted receipt snapshot;
--   * defines public.issue_monthly_statement_rpc(uuid, uuid): one SECURITY INVOKER transaction that
--     locks, snapshots receipts, computes totals, validates, and transitions draft -> issued.
-- LINE work is untouched. No existing migration is modified.

-- ── A. payments: nullable invoice_id, preservation-safe FK, mode integrity, payment_date NOT VALID ──
alter table public.payments alter column invoice_id drop not null;

alter table public.payments drop constraint if exists payments_invoice_id_fkey;
alter table public.payments add constraint payments_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete restrict;

-- A payment with no invoice_id (allocated or unapplied mode) MUST carry a server-resolved customer_id.
alter table public.payments drop constraint if exists payments_null_invoice_requires_customer;
alter table public.payments add constraint payments_null_invoice_requires_customer
  check (invoice_id is not null or customer_id is not null);

-- A completed payment MUST have an authoritative payment_date. NOT VALID: enforced on every new/updated
-- completed payment now; existing legacy rows are audited separately before a later VALIDATE phase.
-- payment_date is NEVER inferred or backfilled from created_at.
alter table public.payments drop constraint if exists payments_completed_requires_payment_date;
alter table public.payments add constraint payments_completed_requires_payment_date
  check (status <> 'completed' or payment_date is not null) not valid;

-- ── B. payments RLS: drop the old public-role FOR ALL policy; add finance SELECT/INSERT/UPDATE/DELETE ─
-- RLS was already enabled by 042; re-assert idempotently so this migration's guarantee is self-contained.
alter table public.payments enable row level security;
drop policy if exists "Dealer members can manage their payments" on public.payments;

revoke all on public.payments from anon;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.payments to service_role;

-- SELECT: active staff of the row's dealer (any role), or dealer_members fallback ONLY when no
-- dealer_staff row exists, or active super_admin (read-only). gyeon_admin/logistics_admin get nothing.
create policy payments_select on public.payments
  for select to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager','staff','readonly'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager','staff','readonly'))
    )
    or exists (select 1 from public.admin_users au
                where au.user_id = (select auth.uid()) and au.status = 'active' and au.role = 'super_admin')
  );

-- WRITE: active canonical finance role (owner/manager) only; dealer_staff precedence; member fallback.
-- Super_admin has NO write. staff/readonly/disabled/cross-dealer/gyeon/logistics/anon are denied.
create policy payments_insert on public.payments
  for insert to authenticated
  with check (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

create policy payments_update on public.payments
  for update to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  )
  with check (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

create policy payments_delete on public.payments
  for delete to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

-- ── C. payment_allocations ─────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_allocations (
  id               uuid        primary key default gen_random_uuid(),
  dealer_id        uuid        not null references public.dealers(id)   on delete cascade,
  customer_id      uuid        not null references public.customers(id) on delete restrict,
  payment_id       uuid        not null references public.payments(id)  on delete restrict,
  invoice_id       uuid        not null references public.invoices(id)  on delete restrict,
  allocated_amount numeric     not null,
  allocation_order integer     not null default 0,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  idempotency_key  text,
  constraint payment_allocations_amount_finite_positive
    check (allocated_amount > 0 and allocated_amount < 'Infinity'::numeric)
);
create unique index if not exists payment_allocations_idempotency_uidx
  on public.payment_allocations (dealer_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_payment_allocations_payment on public.payment_allocations (payment_id);
create index if not exists idx_payment_allocations_invoice on public.payment_allocations (invoice_id);
create index if not exists idx_payment_allocations_dealer  on public.payment_allocations (dealer_id);

-- ── D. monthly_statement_adjustments ────────────────────────────────────────────────────────────────
create table if not exists public.monthly_statement_adjustments (
  id            uuid        primary key default gen_random_uuid(),
  dealer_id     uuid        not null references public.dealers(id)   on delete cascade,
  customer_id   uuid        not null references public.customers(id) on delete restrict,
  statement_id  uuid        not null references public.monthly_statements(id) on delete cascade,
  signed_amount numeric     not null,
  reason        text        not null,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  constraint monthly_statement_adjustments_amount_finite
    check (signed_amount <> 0 and signed_amount > '-Infinity'::numeric and signed_amount < 'Infinity'::numeric),
  constraint monthly_statement_adjustments_reason_nonblank check (btrim(reason) <> '')
);
create index if not exists idx_msa_statement on public.monthly_statement_adjustments (statement_id);
create index if not exists idx_msa_dealer    on public.monthly_statement_adjustments (dealer_id);

-- ── E. monthly_statement_receipts (SYSTEM-OWNED evidence: authenticated SELECT-only) ─────────────────
create table if not exists public.monthly_statement_receipts (
  id                        uuid        primary key default gen_random_uuid(),
  statement_id              uuid        not null references public.monthly_statements(id) on delete restrict,
  payment_id                uuid        not null references public.payments(id)           on delete restrict,
  dealer_id                 uuid        not null,
  customer_id               uuid        not null,
  payment_date_snapshot     date        not null,
  payment_number_snapshot   text,
  payment_method_snapshot   text        not null,
  amount_snapshot           numeric     not null,
  allocated_amount_snapshot numeric     not null,
  unapplied_amount_snapshot numeric     not null,
  created_at                timestamptz not null default now(),
  constraint monthly_statement_receipts_unique_stmt_payment unique (statement_id, payment_id),
  constraint monthly_statement_receipts_amounts_reconcile
    check (amount_snapshot = allocated_amount_snapshot + unapplied_amount_snapshot
           and allocated_amount_snapshot >= 0 and unapplied_amount_snapshot >= 0
           and amount_snapshot < 'Infinity'::numeric and amount_snapshot > '-Infinity'::numeric)
);
create index if not exists idx_msr_statement on public.monthly_statement_receipts (statement_id);
create index if not exists idx_msr_payment   on public.monthly_statement_receipts (payment_id);

-- ── F. monthly_statements: add the receipt-based totals ──────────────────────────────────────────────
alter table public.monthly_statements add column if not exists payments_received_total numeric not null default 0;
alter table public.monthly_statements add column if not exists unapplied_credit_total  numeric not null default 0;

-- ── G. REPLACE the issuance rule: receipt-based closing formula + reconciliation + snapshot match ─────
-- SECURITY INVOKER (default) with empty search_path. Extends the B2 trigger:
--   closing_balance = opening_balance + current_total - payments_received_total + adjustments_total
--   payments_received_total = allocated_payments_total + unapplied_credit_total
--   the three receipt totals must equal the persisted monthly_statement_receipts snapshot sums
--   payments_received_total / unapplied_credit_total join the frozen-once-issued field set.
create or replace function public.enforce_monthly_statement_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev_status    text;
  v_prev_dealer    uuid;
  v_prev_customer  uuid;
  v_prev_end       date;
  v_prev_closing   numeric;
  v_line_count     integer;
  v_sum_sub        numeric;
  v_sum_disc       numeric;
  v_sum_tax        numeric;
  v_sum_total      numeric;
  v_active_later   integer;
  v_latest_id      uuid;
  v_latest_closing numeric;
  v_overlap        integer;
  v_dup_successor  integer;
  v_cust_dealer    uuid;
  v_inv_id         uuid;
  v_r_recv         numeric;
  v_r_alloc        numeric;
  v_r_unappl       numeric;
begin
  select dealer_id into v_cust_dealer from public.customers where id = new.customer_id;
  if not found or v_cust_dealer is distinct from new.dealer_id then
    raise exception using errcode = 'P0001', message = 'monthly_statement_customer_dealer_mismatch';
  end if;

  if new.previous_statement_id is not null then
    if new.previous_statement_id = new.id then
      raise exception using errcode = 'P0001', message = 'monthly_statement_previous_is_self';
    end if;
    select status, dealer_id, customer_id, period_end, closing_balance
      into v_prev_status, v_prev_dealer, v_prev_customer, v_prev_end, v_prev_closing
      from public.monthly_statements where id = new.previous_statement_id;
    if not found or v_prev_dealer <> new.dealer_id or v_prev_customer <> new.customer_id then
      raise exception using errcode = 'P0001', message = 'monthly_statement_previous_mismatch';
    end if;
    if v_prev_status <> 'issued' then
      raise exception using errcode = 'P0001', message = 'monthly_statement_previous_not_issued';
    end if;
    if v_prev_end >= new.period_start then
      raise exception using errcode = 'P0001', message = 'monthly_statement_previous_not_earlier';
    end if;
    if new.opening_balance is distinct from v_prev_closing then
      raise exception using errcode = 'P0001', message = 'monthly_statement_opening_balance_mismatch';
    end if;
  else
    if new.opening_balance <> 0 then
      raise exception using errcode = 'P0001', message = 'monthly_statement_opening_balance_must_be_zero';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'monthly_statement_insert_must_be_draft';
    end if;
    if new.issued_at is not null or new.issued_by is not null
       or new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception using errcode = 'P0001', message = 'monthly_statement_draft_has_lifecycle_metadata';
    end if;
    return new;
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'issued') then
      raise exception using errcode = 'P0001', message = 'monthly_statement_invalid_draft_transition';
    end if;

    if new.status = 'draft' then
      if new.issued_at is not null or new.issued_by is not null
         or new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
        raise exception using errcode = 'P0001', message = 'monthly_statement_draft_has_lifecycle_metadata';
      end if;
      if (new.dealer_id     is distinct from old.dealer_id
          or new.customer_id  is distinct from old.customer_id
          or new.period_start is distinct from old.period_start
          or new.period_end   is distinct from old.period_end)
         and exists (
           select 1 from public.monthly_statement_lines l
            where l.statement_id = new.id
              and (l.dealer_id     is distinct from new.dealer_id
                   or l.customer_id  is distinct from new.customer_id
                   or l.delivery_date < new.period_start
                   or l.delivery_date > new.period_end)
         ) then
        raise exception using errcode = 'P0001', message = 'monthly_statement_draft_edit_invalidates_lines';
      end if;
      return new;
    end if;

    -- draft → issued: privileged, complete, internally consistent, receipt-reconciled.
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_requires_privileged_path';
    end if;

    perform 1 from public.customers c where c.id = new.customer_id for update;

    if exists (
      select 1 from public.monthly_statement_lines l
       where l.statement_id = new.id
         and (l.dealer_id     is distinct from new.dealer_id
              or l.customer_id  is distinct from new.customer_id
              or l.delivery_date < new.period_start
              or l.delivery_date > new.period_end)
    ) then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_line_scope_or_period_violation';
    end if;

    for v_inv_id in
      select distinct l.invoice_id from public.monthly_statement_lines l
       where l.statement_id = new.id order by l.invoice_id
    loop
      perform 1 from public.invoices where id = v_inv_id for update;
    end loop;

    if exists (
      select 1
        from public.monthly_statement_lines l
        left join public.invoices i on i.id = l.invoice_id
       where l.statement_id = new.id
         and (
              i.id            is null
           or i.status        not in ('issued', 'paid', 'partially_paid', 'overdue')
           or i.dealer_id      is distinct from l.dealer_id
           or i.customer_id    is distinct from l.customer_id
           or i.delivery_date  is distinct from l.delivery_date
           or i.invoice_number is distinct from l.invoice_number
           or i.subtotal       is distinct from l.subtotal_snapshot
           or i.discount_amount is distinct from l.discount_snapshot
           or i.tax_rate       is distinct from l.tax_rate_snapshot
           or i.tax_amount     is distinct from l.tax_snapshot
           or i.total          is distinct from l.total_snapshot
         )
    ) then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_source_invoice_invalid';
    end if;

    if new.statement_number is null or btrim(new.statement_number) = '' then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_requires_number';
    end if;
    if new.issued_at is null or new.issued_by is null then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_requires_issued_metadata';
    end if;
    if new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_has_void_metadata';
    end if;

    select id, closing_balance into v_latest_id, v_latest_closing
      from public.monthly_statements
     where dealer_id = new.dealer_id and customer_id = new.customer_id
       and status = 'issued' and period_end < new.period_start
     order by period_end desc, id desc
     limit 1;
    if v_latest_id is not null then
      if new.previous_statement_id is distinct from v_latest_id then
        raise exception using errcode = 'P0001', message = 'monthly_statement_previous_not_latest';
      end if;
      if new.opening_balance is distinct from v_latest_closing then
        raise exception using errcode = 'P0001', message = 'monthly_statement_opening_balance_mismatch';
      end if;
    else
      if new.previous_statement_id is not null then
        raise exception using errcode = 'P0001', message = 'monthly_statement_previous_not_latest';
      end if;
      if new.opening_balance <> 0 then
        raise exception using errcode = 'P0001', message = 'monthly_statement_opening_balance_must_be_zero';
      end if;
    end if;

    select count(*) into v_overlap
      from public.monthly_statements s
     where s.dealer_id = new.dealer_id and s.customer_id = new.customer_id
       and s.id <> new.id and s.status = 'issued'
       and s.period_start <= new.period_end and s.period_end >= new.period_start;
    if v_overlap > 0 then
      raise exception using errcode = 'P0001', message = 'monthly_statement_period_overlap';
    end if;

    if new.previous_statement_id is not null then
      select count(*) into v_dup_successor
        from public.monthly_statements s
       where s.previous_statement_id = new.previous_statement_id
         and s.id <> new.id and s.status = 'issued';
      if v_dup_successor > 0 then
        raise exception using errcode = 'P0001', message = 'monthly_statement_predecessor_already_succeeded';
      end if;
    end if;

    select count(*),
           coalesce(sum(subtotal_snapshot), 0), coalesce(sum(discount_snapshot), 0),
           coalesce(sum(tax_snapshot), 0),      coalesce(sum(total_snapshot), 0)
      into v_line_count, v_sum_sub, v_sum_disc, v_sum_tax, v_sum_total
      from public.monthly_statement_lines where statement_id = new.id;
    if v_line_count < 1 then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_requires_lines';
    end if;
    if new.current_subtotal <> v_sum_sub or new.current_discount <> v_sum_disc
       or new.current_tax <> v_sum_tax or new.current_total <> v_sum_total then
      raise exception using errcode = 'P0001', message = 'monthly_statement_totals_line_mismatch';
    end if;

    -- B3: the three receipt totals must equal the persisted receipt snapshot (created in the same
    -- issuance transaction BEFORE this transition), and must reconcile.
    select coalesce(sum(amount_snapshot), 0), coalesce(sum(allocated_amount_snapshot), 0),
           coalesce(sum(unapplied_amount_snapshot), 0)
      into v_r_recv, v_r_alloc, v_r_unappl
      from public.monthly_statement_receipts where statement_id = new.id;
    if new.payments_received_total is distinct from v_r_recv
       or new.allocated_payments_total is distinct from v_r_alloc
       or new.unapplied_credit_total is distinct from v_r_unappl then
      raise exception using errcode = 'P0001', message = 'monthly_statement_receipts_total_mismatch';
    end if;
    if new.payments_received_total is distinct from new.allocated_payments_total + new.unapplied_credit_total then
      raise exception using errcode = 'P0001', message = 'monthly_statement_reconciliation_mismatch';
    end if;

    -- B3: receipt-based closing balance.
    if new.closing_balance <>
         new.opening_balance + new.current_total - new.payments_received_total + new.adjustments_total then
      raise exception using errcode = 'P0001', message = 'monthly_statement_closing_balance_mismatch';
    end if;
    return new;
  end if;

  if new.status = 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_cannot_return_to_draft';
  end if;
  if old.status = 'issued' and new.status not in ('issued', 'voided') then
    raise exception using errcode = 'P0001', message = 'monthly_statement_invalid_issued_transition';
  end if;
  if old.status = 'voided' and new.status <> 'voided' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_voided_is_terminal';
  end if;

  if old.status = 'issued' and new.status = 'issued' then
    if new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issued_cannot_have_void_metadata';
    end if;
  end if;

  if old.status = 'issued' and new.status = 'voided' then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception using errcode = 'P0001', message = 'monthly_statement_void_requires_privileged_path';
    end if;
    perform 1 from public.customers c where c.id = old.customer_id for update;
    if new.voided_at is null or new.voided_by is null
       or new.void_reason is null or btrim(new.void_reason) = '' then
      raise exception using errcode = 'P0001', message = 'monthly_statement_void_requires_metadata';
    end if;
    select count(*) into v_active_later
      from public.monthly_statements s
     where s.previous_statement_id = old.id and s.status <> 'voided';
    if v_active_later > 0 then
      raise exception using errcode = 'P0001', message = 'monthly_statement_void_blocked_by_active_successor';
    end if;
  end if;

  if old.status = 'voided' then
    if new.voided_at   is distinct from old.voided_at
       or new.voided_by  is distinct from old.voided_by
       or new.void_reason is distinct from old.void_reason then
      raise exception using errcode = 'P0001', message = 'monthly_statement_voided_metadata_immutable';
    end if;
  end if;

  -- Frozen once out of draft. B3 adds payments_received_total and unapplied_credit_total to the set.
  if new.dealer_id             is distinct from old.dealer_id
     or new.customer_id            is distinct from old.customer_id
     or new.statement_number       is distinct from old.statement_number
     or new.period_start           is distinct from old.period_start
     or new.period_end             is distinct from old.period_end
     or new.closing_date           is distinct from old.closing_date
     or new.payment_due_date       is distinct from old.payment_due_date
     or new.previous_statement_id  is distinct from old.previous_statement_id
     or new.opening_balance        is distinct from old.opening_balance
     or new.current_subtotal       is distinct from old.current_subtotal
     or new.current_discount       is distinct from old.current_discount
     or new.current_tax            is distinct from old.current_tax
     or new.current_total          is distinct from old.current_total
     or new.allocated_payments_total is distinct from old.allocated_payments_total
     or new.payments_received_total is distinct from old.payments_received_total
     or new.unapplied_credit_total is distinct from old.unapplied_credit_total
     or new.adjustments_total      is distinct from old.adjustments_total
     or new.closing_balance        is distinct from old.closing_balance
     or new.customer_snapshot      is distinct from old.customer_snapshot
     or new.dealer_snapshot        is distinct from old.dealer_snapshot
     or new.billing_terms_snapshot is distinct from old.billing_terms_snapshot
     or new.tax_summary_snapshot   is distinct from old.tax_summary_snapshot
     or new.created_at             is distinct from old.created_at
     or new.issued_at              is distinct from old.issued_at
     or new.issued_by              is distinct from old.issued_by then
    raise exception using errcode = 'P0001', message = 'monthly_statement_issued_fields_immutable';
  end if;

  return new;
end;
$$;

-- ── H. payment_allocations rules: tenant, allocated-mode, caps, post-issuance INSERT-only lifecycle ──
create or replace function public.enforce_payment_allocation_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_pay_dealer   uuid;
  v_pay_customer uuid;
  v_pay_invoice  uuid;
  v_pay_amount   numeric;
  v_pay_status   text;
  v_inv_dealer   uuid;
  v_inv_customer uuid;
  v_inv_total    numeric;
  v_sum_pay      numeric;
  v_sum_inv      numeric;
  v_direct_inv   numeric;
  v_in_issued    integer;
  v_lo           uuid;
  v_hi           uuid;
begin
  if tg_op = 'DELETE' then
    -- Lock OLD.payment_id BEFORE the issued-membership check, so a concurrent issuance cannot slip a
    -- receipt snapshot in between the check and the delete. UPDATE/DELETE are forbidden while the
    -- payment belongs to a NON-voided issued statement.
    perform 1 from public.payments where id = old.payment_id for update;
    select count(*) into v_in_issued
      from public.monthly_statement_receipts r
      join public.monthly_statements s on s.id = r.statement_id
     where r.payment_id = old.payment_id and s.status = 'issued';
    if v_in_issued > 0 then
      raise exception using errcode = 'P0001', message = 'payment_allocation_locked_by_issued_statement';
    end if;
    return old;
  end if;

  -- Identity is immutable once inserted: an allocation must never escape issued-statement immutability
  -- or tenant scope by reassigning its payment_id, dealer_id, or customer_id.
  if tg_op = 'UPDATE' then
    if new.payment_id is distinct from old.payment_id
       or new.dealer_id is distinct from old.dealer_id
       or new.customer_id is distinct from old.customer_id then
      raise exception using errcode = 'P0001', message = 'payment_allocation_identity_immutable';
    end if;
    -- Lock the old and new payment rows in deterministic id order (equal after the guard above; locked
    -- defensively when they differ), then test issued membership for BOTH old and new payment ids.
    if old.payment_id <= new.payment_id then v_lo := old.payment_id; v_hi := new.payment_id;
    else v_lo := new.payment_id; v_hi := old.payment_id; end if;
    perform 1 from public.payments where id = v_lo for update;
    if v_hi <> v_lo then perform 1 from public.payments where id = v_hi for update; end if;
    select count(*) into v_in_issued
      from public.monthly_statement_receipts r
      join public.monthly_statements s on s.id = r.statement_id
     where r.payment_id in (old.payment_id, new.payment_id) and s.status = 'issued';
    if v_in_issued > 0 then
      raise exception using errcode = 'P0001', message = 'payment_allocation_locked_by_issued_statement';
    end if;
  end if;

  -- Load + lock the payment (INSERT acquires the lock here; UPDATE already holds it from above).
  select dealer_id, customer_id, invoice_id, amount, status
    into v_pay_dealer, v_pay_customer, v_pay_invoice, v_pay_amount, v_pay_status
    from public.payments where id = new.payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_allocation_payment_not_found';
  end if;

  -- Allocations reference COMPLETED payments only (one authoritative completed-payment set for caps).
  if v_pay_status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'payment_allocation_payment_not_completed';
  end if;

  -- Allocated mode: an allocation's payment must have invoice_id NULL (legacy-direct never has rows).
  if v_pay_invoice is not null then
    raise exception using errcode = 'P0001', message = 'payment_allocation_payment_is_legacy_direct';
  end if;

  select dealer_id, customer_id, total
    into v_inv_dealer, v_inv_customer, v_inv_total
    from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_allocation_invoice_not_found';
  end if;

  -- Tenant: allocation = payment = invoice on dealer; allocation.customer = invoice.customer (= payment).
  if new.dealer_id is distinct from v_pay_dealer or new.dealer_id is distinct from v_inv_dealer then
    raise exception using errcode = 'P0001', message = 'payment_allocation_dealer_mismatch';
  end if;
  if new.customer_id is distinct from v_inv_customer
     or (v_pay_customer is not null and new.customer_id is distinct from v_pay_customer) then
    raise exception using errcode = 'P0001', message = 'payment_allocation_customer_mismatch';
  end if;

  -- Payment cap: sum of this payment's allocations (incl. NEW) must not exceed the payment amount.
  select coalesce(sum(allocated_amount), 0) into v_sum_pay
    from public.payment_allocations
   where payment_id = new.payment_id and id <> new.id;
  if v_sum_pay + new.allocated_amount > v_pay_amount then
    raise exception using errcode = 'P0001', message = 'payment_allocation_exceeds_payment_amount';
  end if;

  -- Invoice cap: allocations to this invoice + direct completed payments must not exceed invoice.total.
  select coalesce(sum(allocated_amount), 0) into v_sum_inv
    from public.payment_allocations
   where invoice_id = new.invoice_id and id <> new.id;
  select coalesce(sum(amount), 0) into v_direct_inv
    from public.payments
   where invoice_id = new.invoice_id and status = 'completed';
  if v_sum_inv + v_direct_inv + new.allocated_amount > v_inv_total then
    raise exception using errcode = 'P0001', message = 'payment_allocation_exceeds_invoice_balance';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_allocation_rules on public.payment_allocations;
create trigger trg_payment_allocation_rules
  before insert or update or delete on public.payment_allocations
  for each row execute function public.enforce_payment_allocation_rules();

-- ── I. adjustment rules: tenant + draft-only mutation (issued/voided immutable) ──────────────────────
create or replace function public.enforce_monthly_statement_adjustment_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_stmt_id       uuid;
  v_stmt_status   text;
  v_stmt_dealer   uuid;
  v_stmt_customer uuid;
begin
  if tg_op = 'DELETE' then v_stmt_id := old.statement_id; else v_stmt_id := new.statement_id; end if;

  select status, dealer_id, customer_id
    into v_stmt_status, v_stmt_dealer, v_stmt_customer
    from public.monthly_statements where id = v_stmt_id for update;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    raise exception using errcode = 'P0001', message = 'monthly_statement_adjustment_no_parent';
  end if;

  -- Adjustments are mutable ONLY while the parent statement is a draft. Issued/voided are immutable.
  if v_stmt_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_adjustment_parent_not_draft';
  end if;

  if tg_op = 'DELETE' then return old; end if;

  if new.dealer_id is distinct from v_stmt_dealer or new.customer_id is distinct from v_stmt_customer then
    raise exception using errcode = 'P0001', message = 'monthly_statement_adjustment_tenant_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_monthly_statement_adjustment_rules on public.monthly_statement_adjustments;
create trigger trg_monthly_statement_adjustment_rules
  before insert or update or delete on public.monthly_statement_adjustments
  for each row execute function public.enforce_monthly_statement_adjustment_rules();

-- ── J. receipt rules: draft-only INSERT, active membership guard, issued/voided immutable ────────────
create or replace function public.enforce_monthly_statement_receipt_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_stmt_status   text;
  v_stmt_dealer   uuid;
  v_stmt_customer uuid;
  v_stmt_pstart   date;
  v_stmt_pend     date;
  v_pay_status    text;
  v_pay_dealer    uuid;
  v_pay_customer  uuid;
  v_pay_date      date;
  v_pay_number    text;
  v_pay_method    text;
  v_pay_amount    numeric;
  v_pay_invoice   uuid;
  v_alloc         numeric;
  v_unappl        numeric;
  v_dup           integer;
begin
  -- Issued/voided receipt snapshots are immutable and retained: no UPDATE or DELETE.
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_immutable';
  end if;

  -- Load + LOCK the authoritative payment (fail if missing). Every snapshot field is re-derived and
  -- re-validated here; a service_role caller is NOT trusted to supply correct amounts.
  select status, dealer_id, customer_id, payment_date, payment_number, payment_method, amount, invoice_id
    into v_pay_status, v_pay_dealer, v_pay_customer, v_pay_date, v_pay_number, v_pay_method,
         v_pay_amount, v_pay_invoice
    from public.payments where id = new.payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_payment_not_found';
  end if;

  -- Lock + read the parent statement (draft only) and its inclusive period.
  select status, dealer_id, customer_id, period_start, period_end
    into v_stmt_status, v_stmt_dealer, v_stmt_customer, v_stmt_pstart, v_stmt_pend
    from public.monthly_statements where id = new.statement_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_no_parent';
  end if;
  if v_stmt_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_parent_not_draft';
  end if;

  -- Only completed receipts may be snapshotted.
  if v_pay_status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_payment_not_completed';
  end if;

  -- Tenant: payment = snapshot = statement on both dealer and customer.
  if new.dealer_id is distinct from v_stmt_dealer or new.dealer_id is distinct from v_pay_dealer then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_dealer_mismatch';
  end if;
  if new.customer_id is distinct from v_stmt_customer or new.customer_id is distinct from v_pay_customer then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_customer_mismatch';
  end if;

  -- payment_date is authoritative, non-null, equal to the snapshot, and inside the inclusive period.
  if v_pay_date is null or new.payment_date_snapshot is distinct from v_pay_date then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_payment_date_mismatch';
  end if;
  if new.payment_date_snapshot < v_stmt_pstart or new.payment_date_snapshot > v_stmt_pend then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_outside_period';
  end if;

  -- Identity + amount snapshots must equal the authoritative payment values.
  if new.payment_number_snapshot is distinct from v_pay_number
     or new.payment_method_snapshot is distinct from v_pay_method
     or new.amount_snapshot is distinct from v_pay_amount then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_identity_mismatch';
  end if;

  -- Authoritative allocated/unapplied split, derived under the payment lock (never trusted from input):
  --   legacy-direct (invoice_id present) → allocated = amount, unapplied = 0;
  --   otherwise                          → allocated = sum(allocations), unapplied = amount − allocated.
  if v_pay_invoice is not null then
    v_alloc := v_pay_amount;
    v_unappl := 0;
  else
    select coalesce(sum(allocated_amount), 0) into v_alloc
      from public.payment_allocations where payment_id = new.payment_id;
    if v_alloc > v_pay_amount then
      raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_over_allocated';
    end if;
    v_unappl := v_pay_amount - v_alloc;
  end if;
  if new.allocated_amount_snapshot is distinct from v_alloc
     or new.unapplied_amount_snapshot is distinct from v_unappl then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_split_mismatch';
  end if;

  -- ACTIVE-MEMBERSHIP GUARD: a payment belongs to at most one NON-voided statement.
  select count(*) into v_dup
    from public.monthly_statement_receipts r
    join public.monthly_statements s on s.id = r.statement_id
   where r.payment_id = new.payment_id and r.id <> new.id and s.status <> 'voided';
  if v_dup > 0 then
    raise exception using errcode = 'P0001', message = 'monthly_statement_receipt_payment_already_active';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_monthly_statement_receipt_rules on public.monthly_statement_receipts;
create trigger trg_monthly_statement_receipt_rules
  before insert or update or delete on public.monthly_statement_receipts
  for each row execute function public.enforce_monthly_statement_receipt_rules();

-- ── K. payment mutation guard: a completed payment captured by an ISSUED statement is frozen ─────────
-- Cannot cancel/refund/reduce/delete in place; correction requires voiding + replacement. A voided
-- statement's receipt does not block (only status = 'issued' blocks). This is a NEW trigger.
create or replace function public.enforce_payment_not_in_issued_statement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id        uuid;
  v_in_issued integer;
  v_alloc_cnt integer;
begin
  if tg_op = 'DELETE' then v_id := old.id; else v_id := new.id; end if;

  select count(*) into v_in_issued
    from public.monthly_statement_receipts r
    join public.monthly_statements s on s.id = r.statement_id
   where r.payment_id = v_id and s.status = 'issued';
  select count(*) into v_alloc_cnt from public.payment_allocations where payment_id = v_id;

  -- (a) A payment captured by a NON-voided ISSUED statement is frozen: it cannot be deleted, and its
  --     financial + receipt-identity fields cannot change in place. Correction requires voiding the
  --     statement and issuing a replacement (or a future-period adjustment). notes / internal_memo stay
  --     editable because they are not part of the authoritative receipt identity.
  if v_in_issued > 0 then
    if tg_op = 'DELETE' then
      raise exception using errcode = 'P0001', message = 'payment_locked_by_issued_statement';
    end if;
    if new.status         is distinct from old.status
       or new.amount         is distinct from old.amount
       or new.fee_amount     is distinct from old.fee_amount
       or new.net_amount     is distinct from old.net_amount
       or new.payment_date   is distinct from old.payment_date
       or new.invoice_id     is distinct from old.invoice_id
       or new.dealer_id      is distinct from old.dealer_id
       or new.customer_id    is distinct from old.customer_id
       or new.payment_number is distinct from old.payment_number
       or new.payment_method is distinct from old.payment_method
       or new.reference_no   is distinct from old.reference_no then
      raise exception using errcode = 'P0001', message = 'payment_locked_by_issued_statement';
    end if;
  end if;

  -- (b) While ANY allocations exist (even before issuance): the payment's tenant may not be reassigned,
  --     and a completed payment may not leave 'completed' until its allocations are removed first — so
  --     the invoice-cap and later recalculation always operate over one authoritative completed set.
  if v_alloc_cnt > 0 and tg_op = 'UPDATE' then
    if new.dealer_id is distinct from old.dealer_id or new.customer_id is distinct from old.customer_id then
      raise exception using errcode = 'P0001', message = 'payment_tenant_locked_by_allocations';
    end if;
    if old.status = 'completed' and new.status is distinct from 'completed' then
      raise exception using errcode = 'P0001', message = 'payment_status_locked_by_allocations';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_payment_not_in_issued_statement on public.payments;
create trigger trg_payment_not_in_issued_statement
  before update or delete on public.payments
  for each row execute function public.enforce_payment_not_in_issued_statement();

-- ── L. the single atomic issuance RPC ────────────────────────────────────────────────────────────────
-- SECURITY INVOKER + empty search_path. EXECUTE is service_role-only (revoked below). One transaction:
-- lock, snapshot receipts, compute totals, validate (via the statement trigger), transition draft->issued.
-- Idempotent: an already-issued statement is returned unchanged with no duplicate snapshots or totals.
-- p_issued_by is the server-verified finance actor resolved by the server action (never raw client input).
create or replace function public.issue_monthly_statement_rpc(p_statement_id uuid, p_issued_by uuid)
returns public.monthly_statements
language plpgsql
set search_path = ''
as $$
declare
  v_stmt      public.monthly_statements;
  v_sub       numeric;
  v_disc      numeric;
  v_tax       numeric;
  v_total     numeric;
  v_recv      numeric;
  v_alloc     numeric;
  v_unappl    numeric;
  v_adj       numeric;
  v_prev_id   uuid;
  v_prev_clos numeric;
  v_opening   numeric;
  v_closing   numeric;
  v_pay_id    uuid;
begin
  select * into v_stmt from public.monthly_statements where id = p_statement_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'monthly_statement_not_found';
  end if;
  -- Idempotent short-circuit (pre-lock fast path).
  if v_stmt.status = 'issued' then
    return v_stmt;
  end if;
  if v_stmt.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_not_draft';
  end if;

  -- Authoritative customer lock BEFORE predecessor/receipt decisions.
  perform 1 from public.customers where id = v_stmt.customer_id for update;

  -- Re-lock and revalidate the target statement after acquiring the customer lock.
  select * into v_stmt from public.monthly_statements where id = p_statement_id for update;
  if v_stmt.status = 'issued' then
    return v_stmt;
  end if;
  if v_stmt.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_not_draft';
  end if;

  if v_stmt.statement_number is null or btrim(v_stmt.statement_number) = '' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_issue_requires_number';
  end if;
  if p_issued_by is null then
    raise exception using errcode = 'P0001', message = 'monthly_statement_issue_requires_issued_metadata';
  end if;

  -- Lock EVERY eligible completed payment row FIRST, in deterministic payment-id order, BEFORE any
  -- allocation SUM or receipt snapshot INSERT. This serialises the snapshot against concurrent
  -- allocation writes so the allocated/unapplied split cannot shift under us mid-issuance.
  for v_pay_id in
    select p.id
      from public.payments p
     where p.dealer_id = v_stmt.dealer_id
       and p.customer_id = v_stmt.customer_id
       and p.status = 'completed'
       and p.payment_date is not null
       and p.payment_date >= v_stmt.period_start
       and p.payment_date <= v_stmt.period_end
       and not exists (
         select 1 from public.monthly_statement_receipts r
           join public.monthly_statements s on s.id = r.statement_id
          where r.payment_id = p.id and s.status <> 'voided'
       )
     order by p.id
  loop
    perform 1 from public.payments where id = v_pay_id for update;
  end loop;

  -- Receipt snapshot: exactly one row per eligible completed customer receipt selected by payment_date
  -- only, within the inclusive period, not already an active member of another non-voided statement.
  -- allocated portion: legacy-direct (invoice_id not null) = full amount; else sum(allocations). The
  -- receipt trigger re-derives and re-validates this split under the payment lock; the RPC never asks
  -- the trigger to trust an externally supplied amount.
  insert into public.monthly_statement_receipts (
    statement_id, payment_id, dealer_id, customer_id,
    payment_date_snapshot, payment_number_snapshot, payment_method_snapshot,
    amount_snapshot, allocated_amount_snapshot, unapplied_amount_snapshot
  )
  select
    v_stmt.id, p.id, v_stmt.dealer_id, v_stmt.customer_id,
    p.payment_date, p.payment_number, p.payment_method,
    p.amount,
    case when p.invoice_id is not null then p.amount
         else coalesce((select sum(a.allocated_amount) from public.payment_allocations a
                         where a.payment_id = p.id), 0) end,
    case when p.invoice_id is not null then 0
         else p.amount - coalesce((select sum(a.allocated_amount) from public.payment_allocations a
                                    where a.payment_id = p.id), 0) end
  from public.payments p
  where p.dealer_id = v_stmt.dealer_id
    and p.customer_id = v_stmt.customer_id
    and p.status = 'completed'
    and p.payment_date is not null
    and p.payment_date >= v_stmt.period_start
    and p.payment_date <= v_stmt.period_end
    and not exists (
      select 1 from public.monthly_statement_receipts r
        join public.monthly_statements s on s.id = r.statement_id
       where r.payment_id = p.id and s.status <> 'voided'
    )
  order by p.id;

  -- Totals from the persisted receipt snapshot and adjustments.
  select coalesce(sum(amount_snapshot), 0), coalesce(sum(allocated_amount_snapshot), 0),
         coalesce(sum(unapplied_amount_snapshot), 0)
    into v_recv, v_alloc, v_unappl
    from public.monthly_statement_receipts where statement_id = v_stmt.id;
  select coalesce(sum(signed_amount), 0) into v_adj
    from public.monthly_statement_adjustments where statement_id = v_stmt.id;

  -- Line-derived current totals (never recomputed from source invoices here — already snapshotted).
  select coalesce(sum(subtotal_snapshot), 0), coalesce(sum(discount_snapshot), 0),
         coalesce(sum(tax_snapshot), 0),      coalesce(sum(total_snapshot), 0)
    into v_sub, v_disc, v_tax, v_total
    from public.monthly_statement_lines where statement_id = v_stmt.id;

  -- Authoritative predecessor + opening balance.
  select id, closing_balance into v_prev_id, v_prev_clos
    from public.monthly_statements
   where dealer_id = v_stmt.dealer_id and customer_id = v_stmt.customer_id
     and status = 'issued' and period_end < v_stmt.period_start
   order by period_end desc, id desc
   limit 1;
  v_opening := coalesce(v_prev_clos, 0);
  v_closing := v_opening + v_total - v_recv + v_adj;

  update public.monthly_statements
     set status = 'issued',
         issued_at = now(),
         issued_by = p_issued_by,
         previous_statement_id = v_prev_id,
         opening_balance = v_opening,
         current_subtotal = v_sub,
         current_discount = v_disc,
         current_tax = v_tax,
         current_total = v_total,
         payments_received_total = v_recv,
         allocated_payments_total = v_alloc,
         unapplied_credit_total = v_unappl,
         adjustments_total = v_adj,
         closing_balance = v_closing,
         updated_at = now()
   where id = v_stmt.id
   returning * into v_stmt;

  return v_stmt;
end;
$$;

-- ── M. RLS + explicit least-privilege grants for the three new tables ────────────────────────────────
alter table public.payment_allocations            enable row level security;
alter table public.monthly_statement_adjustments  enable row level security;
alter table public.monthly_statement_receipts      enable row level security;

revoke all on public.payment_allocations           from anon;
revoke all on public.monthly_statement_adjustments from anon;
revoke all on public.monthly_statement_receipts     from anon;

-- payment_allocations + monthly_statement_adjustments: finance CRUD (like monthly_statements).
grant select, insert, update, delete on public.payment_allocations           to authenticated;
grant select, insert, update, delete on public.payment_allocations           to service_role;
grant select, insert, update, delete on public.monthly_statement_adjustments to authenticated;
grant select, insert, update, delete on public.monthly_statement_adjustments to service_role;

-- monthly_statement_receipts: SYSTEM-OWNED. authenticated SELECT-only; ONLY service_role may write.
grant select on public.monthly_statement_receipts to authenticated;
grant select, insert, update, delete on public.monthly_statement_receipts to service_role;

-- Finance SELECT (member + super_admin read-only) for the three new tables.
create policy payment_allocations_select on public.payment_allocations
  for select to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager','staff','readonly'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payment_allocations.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager','staff','readonly'))
    )
    or exists (select 1 from public.admin_users au
                where au.user_id = (select auth.uid()) and au.status = 'active' and au.role = 'super_admin')
  );

create policy payment_allocations_insert on public.payment_allocations
  for insert to authenticated
  with check (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payment_allocations.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

create policy payment_allocations_update on public.payment_allocations
  for update to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payment_allocations.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  )
  with check (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payment_allocations.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

create policy payment_allocations_delete on public.payment_allocations
  for delete to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = payment_allocations.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = payment_allocations.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

create policy monthly_statement_adjustments_select on public.monthly_statement_adjustments
  for select to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager','staff','readonly'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = monthly_statement_adjustments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager','staff','readonly'))
    )
    or exists (select 1 from public.admin_users au
                where au.user_id = (select auth.uid()) and au.status = 'active' and au.role = 'super_admin')
  );

create policy monthly_statement_adjustments_insert on public.monthly_statement_adjustments
  for insert to authenticated
  with check (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = monthly_statement_adjustments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

create policy monthly_statement_adjustments_update on public.monthly_statement_adjustments
  for update to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = monthly_statement_adjustments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  )
  with check (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = monthly_statement_adjustments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

create policy monthly_statement_adjustments_delete on public.monthly_statement_adjustments
  for delete to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = monthly_statement_adjustments.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = monthly_statement_adjustments.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  );

-- monthly_statement_receipts: SELECT only for authenticated (member + super_admin read-only). No
-- authenticated INSERT/UPDATE/DELETE policy exists — writes are service_role-only via issuance.
create policy monthly_statement_receipts_select on public.monthly_statement_receipts
  for select to authenticated
  using (
    exists (select 1 from public.dealer_staff ds
             where ds.dealer_id = monthly_statement_receipts.dealer_id and ds.user_id = (select auth.uid())
               and ds.status = 'active' and ds.role in ('owner','manager','staff','readonly'))
    or (
      not exists (select 1 from public.dealer_staff ds
                   where ds.dealer_id = monthly_statement_receipts.dealer_id and ds.user_id = (select auth.uid()))
      and exists (select 1 from public.dealer_members dm
                   where dm.dealer_id = monthly_statement_receipts.dealer_id and dm.user_id = (select auth.uid())
                     and dm.status = 'active' and dm.role in ('owner','manager','staff','readonly'))
    )
    or exists (select 1 from public.admin_users au
                where au.user_id = (select auth.uid()) and au.status = 'active' and au.role = 'super_admin')
  );

-- ── N. function EXECUTE privileges ───────────────────────────────────────────────────────────────────
-- Trigger helpers: never called directly.
revoke all on function public.enforce_payment_allocation_rules()             from public, anon, authenticated;
revoke all on function public.enforce_monthly_statement_adjustment_rules()   from public, anon, authenticated;
revoke all on function public.enforce_monthly_statement_receipt_rules()      from public, anon, authenticated;
revoke all on function public.enforce_payment_not_in_issued_statement()      from public, anon, authenticated;

-- Issuance RPC: service_role-only (the trusted server-side boundary). No SECURITY DEFINER shortcut.
revoke all on function public.issue_monthly_statement_rpc(uuid, uuid) from public;
revoke execute on function public.issue_monthly_statement_rpc(uuid, uuid) from anon, authenticated;
grant  execute on function public.issue_monthly_statement_rpc(uuid, uuid) to service_role;

-- ── O. payment-level idempotency + atomic payment-mutation RPCs (B3-B1A-R2) ─────────────────────────
-- payments gains a per-dealer idempotency key so a retried record/convert request is a no-op instead of
-- a duplicate. The two RPCs are the ONLY transaction-safe boundaries the future create-payment.ts /
-- record-payment-allocation.ts / convert-payment-to-allocated.ts paths call — they never issue a monthly
-- statement and never write monthly_statement_receipts (snapshots remain issuance-only). Both are
-- SECURITY INVOKER with an empty search_path and enforce the finance owner/manager contract in-function;
-- RLS + the allocation/payment triggers remain the authoritative cap/tenant/lifecycle guards.
alter table public.payments add column if not exists idempotency_key text;
alter table public.payments add column if not exists idempotency_fingerprint text;
alter table public.payments add column if not exists conversion_fingerprint text;
create unique index if not exists payments_idempotency_uidx
  on public.payments (dealer_id, idempotency_key) where idempotency_key is not null;

-- AUTHORITATIVE payment scope + numeric guard for EVERY payments INSERT/UPDATE (raw Data API writes as
-- well as both RPCs). It runs BEFORE the direct-cap trigger (name sorts first). It fails CLOSED on any
-- missing / RLS-invisible / cross-tenant invoice or customer, derives or strictly verifies the customer,
-- enforces amount/fee/net integrity, and freezes idempotency + conversion fingerprint metadata on UPDATE.
create or replace function public.enforce_payment_authoritative_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_inv_dealer   uuid;
  v_inv_customer uuid;
  v_cust_dealer  uuid;
begin
  -- ── numeric integrity: amount finite+positive; fee finite/non-negative/<=amount; net = amount-fee ──
  if new.amount is null or new.amount <= 0 or new.amount >= 'Infinity'::numeric then
    raise exception using errcode = 'P0001', message = 'payment_invalid_amount';
  end if;
  if new.fee_amount is null or new.fee_amount < 0 or new.fee_amount >= 'Infinity'::numeric
     or new.fee_amount > new.amount then
    raise exception using errcode = 'P0001', message = 'payment_invalid_fee';
  end if;
  if new.net_amount is null or new.net_amount is distinct from new.amount - new.fee_amount then
    raise exception using errcode = 'P0001', message = 'payment_invalid_net';
  end if;

  -- ── authoritative tenant + customer (fail closed; never return NEW on a failed lookup) ──
  if new.invoice_id is not null then
    select dealer_id, customer_id into v_inv_dealer, v_inv_customer
      from public.invoices where id = new.invoice_id for update;
    if not found or v_inv_dealer is distinct from new.dealer_id then
      raise exception using errcode = 'P0001', message = 'payment_invoice_tenant_violation';
    end if;
    if v_inv_customer is null then
      raise exception using errcode = 'P0001', message = 'payment_invoice_missing_customer';
    end if;
    if new.customer_id is null then
      new.customer_id := v_inv_customer;                 -- derive from the authoritative invoice
    elsif new.customer_id is distinct from v_inv_customer then
      raise exception using errcode = 'P0001', message = 'payment_customer_invoice_mismatch';
    end if;
  else
    if new.customer_id is null then
      raise exception using errcode = 'P0001', message = 'payment_requires_customer';
    end if;
    select dealer_id into v_cust_dealer from public.customers where id = new.customer_id for update;
    if not found or v_cust_dealer is distinct from new.dealer_id then
      raise exception using errcode = 'P0001', message = 'payment_customer_tenant_violation';
    end if;
  end if;

  -- ── conversion fingerprint is NEVER present on INSERT ──
  if tg_op = 'INSERT' and new.conversion_fingerprint is not null then
    raise exception using errcode = 'P0001', message = 'payment_conversion_fingerprint_invalid_init';
  end if;

  -- ── idempotency + conversion fingerprint metadata immutability on UPDATE ──
  if tg_op = 'UPDATE' then
    if new.idempotency_key is distinct from old.idempotency_key
       or new.idempotency_fingerprint is distinct from old.idempotency_fingerprint then
      raise exception using errcode = 'P0001', message = 'payment_idempotency_metadata_immutable';
    end if;
    -- Conversion fingerprint is SET-ONCE and ONLY by the REAL direct->allocated transition:
    --   a null -> value initialization is allowed ONLY when this same UPDATE takes old.invoice_id
    --   (non-null) to new.invoice_id (null); a null -> value with invoice_id unchanged, already null,
    --   or becoming non-null is rejected. Once non-null, any change or clear is rejected.
    if old.conversion_fingerprint is null then
      if new.conversion_fingerprint is not null
         and not (old.invoice_id is not null and new.invoice_id is null) then
        raise exception using errcode = 'P0001', message = 'payment_conversion_fingerprint_invalid_init';
      end if;
    elsif new.conversion_fingerprint is distinct from old.conversion_fingerprint then
      raise exception using errcode = 'P0001', message = 'payment_conversion_fingerprint_immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_authoritative_scope on public.payments;
create trigger trg_payment_authoritative_scope
  before insert or update on public.payments
  for each row execute function public.enforce_payment_authoritative_scope();

revoke all on function public.enforce_payment_authoritative_scope() from public, anon, authenticated;

-- DB-BOUNDARY direct-payment cap: a completed legacy-direct payment (invoice_id present) may never make
-- authoritative completed direct payments + completed allocated amounts exceed the invoice total. This
-- fires for EVERY payments INSERT/UPDATE (including raw Data API writes), locking the invoice first and
-- excluding the current row on UPDATE. Overpayment must use allocated/unapplied credit, never a silent
-- single-invoice clamp. SECURITY INVOKER.
create or replace function public.enforce_payment_direct_invoice_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total      numeric;
  v_sum_direct numeric;
  v_sum_alloc  numeric;
begin
  if new.invoice_id is null or new.status <> 'completed' then
    return new;
  end if;
  select total into v_total from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_direct_invoice_not_found';
  end if;
  select coalesce(sum(amount), 0) into v_sum_direct
    from public.payments
   where invoice_id = new.invoice_id and status = 'completed' and id <> new.id;
  select coalesce(sum(a.allocated_amount), 0) into v_sum_alloc
    from public.payment_allocations a
    join public.payments p on p.id = a.payment_id
   where a.invoice_id = new.invoice_id and p.status = 'completed';
  if v_sum_direct + v_sum_alloc + new.amount > v_total then
    raise exception using errcode = 'P0001', message = 'payment_direct_exceeds_invoice_total';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_direct_invoice_cap on public.payments;
create trigger trg_payment_direct_invoice_cap
  before insert or update on public.payments
  for each row execute function public.enforce_payment_direct_invoice_cap();

revoke all on function public.enforce_payment_direct_invoice_cap() from public, anon, authenticated;

-- Double-count-safe invoice recalculation: direct completed payments that carry NO allocations, PLUS
-- allocations from completed payments. Never counts a payment through both paths. SECURITY INVOKER.
create or replace function public.b3_recalc_invoice_payment(p_invoice_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_total   numeric;
  v_due     date;
  v_status  text;
  v_paid    numeric;
  v_balance numeric;
  v_new     text;
  v_today   date;
begin
  select total, due_date, status into v_total, v_due, v_status
    from public.invoices where id = p_invoice_id;
  if not found then return; end if;

  select coalesce((select sum(p.amount) from public.payments p
                    where p.invoice_id = p_invoice_id and p.status = 'completed'
                      and not exists (select 1 from public.payment_allocations a where a.payment_id = p.id)), 0)
       + coalesce((select sum(a.allocated_amount) from public.payment_allocations a
                    join public.payments p on p.id = a.payment_id
                    where a.invoice_id = p_invoice_id and p.status = 'completed'), 0)
    into v_paid;

  v_balance := greatest(0, v_total - v_paid);
  v_today := current_date;
  if v_balance <= 0 then
    v_new := 'paid';
  elsif v_paid > 0 then
    v_new := case when v_due is not null and v_due < v_today then 'overdue' else 'partially_paid' end;
  else
    if v_due is not null and v_due < v_today and v_status in ('issued', 'partially_paid') then
      v_new := 'overdue';
    elsif v_status in ('paid', 'partially_paid') then
      v_new := 'issued';
    else
      v_new := v_status;
    end if;
  end if;

  update public.invoices
     set paid_amount = v_paid, balance_due = v_balance, status = v_new, updated_at = now()
   where id = p_invoice_id;
end;
$$;

-- RPC: record a payment (legacy_direct | allocated | unapplied) and any allocations atomically.
create or replace function public.record_payment_with_allocations_rpc(
  p_dealer_id       uuid,
  p_actor           uuid,
  p_mode            text,
  p_invoice_id      uuid,
  p_customer_id     uuid,
  p_amount          numeric,
  p_fee_amount      numeric,
  p_net_amount      numeric,
  p_payment_date    date,
  p_payment_method  text,
  p_status          text,
  p_payment_number  text,
  p_reference_no    text,
  p_notes           text,
  p_internal_memo   text,
  p_idempotency_key text,
  p_allocations     jsonb
)
returns public.payments
language plpgsql
set search_path = ''
as $$
declare
  v_existing    public.payments;
  v_pay         public.payments;
  v_customer    uuid;
  v_inv_dealer  uuid;
  v_inv_customer uuid;
  v_cust_dealer uuid;
  v_inv_id      uuid;
  v_rec         record;
  v_actor       uuid;
  v_fee         numeric;
  v_net         numeric;
  v_fp          text;
  v_alloc_json  jsonb;
begin
  -- ── numeric integrity: amount strictly positive; fee finite, non-negative, <= amount; net DERIVED ──
  if p_amount is null or p_amount <= 0 or p_amount >= 'Infinity'::numeric then
    raise exception using errcode = 'P0001', message = 'payment_rpc_invalid_amount';
  end if;
  v_fee := coalesce(p_fee_amount, 0);
  if v_fee < 0 or v_fee >= 'Infinity'::numeric or v_fee > p_amount then
    raise exception using errcode = 'P0001', message = 'payment_rpc_invalid_fee';
  end if;
  v_net := p_amount - v_fee;   -- server-derived; a caller-supplied p_net_amount is never trusted

  -- ── trusted actor resolution + finance authorization ──
  -- authenticated: actor = auth.uid() (a non-matching p_actor is rejected). service_role/postgres: the
  -- trusted server path supplies p_actor. Either way the RESOLVED actor must be an active owner/manager.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    v_actor := p_actor;
  else
    v_actor := (select auth.uid());
    if p_actor is not null and p_actor is distinct from v_actor then
      raise exception using errcode = 'P0001', message = 'payment_rpc_actor_mismatch';
    end if;
  end if;
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'payment_rpc_not_finance_authorized';
  end if;
  if not (
    exists (select 1 from public.dealer_staff ds where ds.dealer_id = p_dealer_id
              and ds.user_id = v_actor and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds where ds.dealer_id = p_dealer_id and ds.user_id = v_actor)
      and exists (select 1 from public.dealer_members dm where dm.dealer_id = p_dealer_id
                    and dm.user_id = v_actor and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  ) then
    raise exception using errcode = 'P0001', message = 'payment_rpc_not_finance_authorized';
  end if;

  -- ── a non-blank idempotency key is REQUIRED for the atomic recording RPC ──
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception using errcode = 'P0001', message = 'payment_rpc_idempotency_key_required';
  end if;

  -- ── resolve mode + AUTHORITATIVE customer (locked, dealer-scoped); never trust raw client identity ──
  if p_mode = 'legacy_direct' then
    if p_invoice_id is null then
      raise exception using errcode = 'P0001', message = 'payment_rpc_legacy_requires_invoice';
    end if;
    if jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) <> 0 then
      raise exception using errcode = 'P0001', message = 'payment_rpc_legacy_no_allocations';
    end if;
    select dealer_id, customer_id into v_inv_dealer, v_inv_customer
      from public.invoices where id = p_invoice_id for update;
    if not found or v_inv_dealer is distinct from p_dealer_id then
      raise exception using errcode = 'P0001', message = 'payment_rpc_invoice_not_found';
    end if;
    if v_inv_customer is null then
      raise exception using errcode = 'P0001', message = 'payment_rpc_invoice_missing_customer';
    end if;
    v_customer := v_inv_customer;   -- derived ONLY from the locked invoice
  elsif p_mode in ('allocated', 'unapplied') then
    if p_invoice_id is not null then
      raise exception using errcode = 'P0001', message = 'payment_rpc_nonlegacy_no_invoice';
    end if;
    if p_customer_id is null then
      raise exception using errcode = 'P0001', message = 'payment_rpc_requires_customer';
    end if;
    -- lock + validate the customer against the dealer; fail closed on missing/cross-dealer.
    select dealer_id into v_cust_dealer from public.customers where id = p_customer_id for update;
    if not found or v_cust_dealer is distinct from p_dealer_id then
      raise exception using errcode = 'P0001', message = 'payment_rpc_customer_not_found';
    end if;
    v_customer := p_customer_id;
    if p_mode = 'unapplied' and jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) <> 0 then
      raise exception using errcode = 'P0001', message = 'payment_rpc_unapplied_no_allocations';
    end if;
    if p_mode = 'allocated' and jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
      raise exception using errcode = 'P0001', message = 'payment_rpc_allocated_requires_allocations';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'payment_rpc_invalid_mode';
  end if;

  -- ── validate allocation numeric values before any mutation (beyond the table constraints) ──
  if p_mode = 'allocated' then
    if exists (
      select 1 from jsonb_array_elements(p_allocations) e
       where (e->>'invoice_id') is null
          or (e->>'allocated_amount') is null
          or (e->>'allocated_amount')::numeric <= 0
          or (e->>'allocated_amount')::numeric >= 'Infinity'::numeric
    ) then
      raise exception using errcode = 'P0001', message = 'payment_rpc_invalid_allocation';
    end if;
  end if;

  -- ── canonical server-generated request fingerprint (unambiguous JSONB; no delimiter injection) ──
  -- Numerics are scale-normalized (10, 10.0, 10.00 collapse to one value) and allocation objects are
  -- canonically sorted; all user text lives inside JSON strings, so pipes/commas/colons/quotes/Unicode
  -- cannot alias two distinct requests to the same fingerprint.
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'invoice', (e->>'invoice_id')::uuid,
             'amount',  pg_catalog.trim_scale((e->>'allocated_amount')::numeric),
             'order',   coalesce((e->>'allocation_order')::int, 0))
             order by (e->>'invoice_id')::uuid, (e->>'allocated_amount')::numeric,
                      coalesce((e->>'allocation_order')::int, 0)),
           '[]'::jsonb)
    into v_alloc_json
    from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) e;
  v_fp := pg_catalog.md5((jsonb_build_object(
      'mode',        p_mode,
      'dealer',      p_dealer_id,
      'customer',    v_customer,
      'invoice',     p_invoice_id,
      'amount',      pg_catalog.trim_scale(p_amount),
      'fee',         pg_catalog.trim_scale(v_fee),
      'net',         pg_catalog.trim_scale(v_net),
      'date',        p_payment_date,
      'method',      coalesce(p_payment_method, 'cash'),
      'status',      coalesce(p_status, 'completed'),
      'number',      p_payment_number,
      'reference',   p_reference_no,
      'notes',       p_notes,
      'memo',        p_internal_memo,
      'allocations', v_alloc_json))::text);

  -- ── serialize concurrent first use of the same (dealer, key); then compare-or-create ──
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_dealer_id::text || '|' || p_idempotency_key, 0));

  select * into v_existing from public.payments
    where dealer_id = p_dealer_id and idempotency_key = p_idempotency_key for update;
  if found then
    -- Retry: return the winner only when the COMPLETE fingerprint matches; else fail closed. A legacy-
    -- direct retry compares the RESOLVED invoice customer via the fingerprint (v_customer), not raw input.
    if v_existing.idempotency_fingerprint is distinct from v_fp then
      raise exception using errcode = 'P0001', message = 'payment_idempotency_conflict';
    end if;
    return v_existing;
  end if;

  -- ── insert the payment (RLS + payment triggers + direct-cap apply); no visible cross-mode state ──
  insert into public.payments (
    dealer_id, invoice_id, customer_id, payment_number, payment_date, payment_method,
    amount, fee_amount, net_amount, status, reference_no, notes, internal_memo,
    idempotency_key, idempotency_fingerprint
  ) values (
    p_dealer_id, p_invoice_id, v_customer, p_payment_number, p_payment_date, coalesce(p_payment_method, 'cash'),
    p_amount, v_fee, v_net, coalesce(p_status, 'completed'),
    p_reference_no, p_notes, p_internal_memo, p_idempotency_key, v_fp
  ) returning * into v_pay;

  -- Allocated mode: lock every affected invoice in deterministic id order, then insert allocations. The
  -- allocation trigger enforces caps (over-payment/over-invoice), tenant, allocated-mode, and completed.
  if p_mode = 'allocated' then
    for v_inv_id in
      select distinct (e->>'invoice_id')::uuid from jsonb_array_elements(p_allocations) e order by 1
    loop
      perform 1 from public.invoices where id = v_inv_id for update;
    end loop;
    for v_rec in
      select (e->>'invoice_id')::uuid as inv,
             (e->>'allocated_amount')::numeric as amt,
             coalesce((e->>'allocation_order')::int, 0) as ord
        from jsonb_array_elements(p_allocations) e
    loop
      insert into public.payment_allocations (
        dealer_id, customer_id, payment_id, invoice_id, allocated_amount, allocation_order, created_by
      ) values (p_dealer_id, v_customer, v_pay.id, v_rec.inv, v_rec.amt, v_rec.ord, v_actor);
    end loop;
  end if;

  -- Recalculate every affected invoice inside the SAME transaction (never touches receipts).
  if p_mode = 'legacy_direct' then
    perform public.b3_recalc_invoice_payment(p_invoice_id);
  elsif p_mode = 'allocated' then
    for v_inv_id in
      select distinct (e->>'invoice_id')::uuid from jsonb_array_elements(p_allocations) e order by 1
    loop
      perform public.b3_recalc_invoice_payment(v_inv_id);
    end loop;
  end if;

  return v_pay;
end;
$$;

-- RPC: convert a legacy-direct payment into allocated mode atomically.
create or replace function public.convert_payment_to_allocated_rpc(
  p_dealer_id   uuid,
  p_actor       uuid,
  p_payment_id  uuid,
  p_allocations jsonb
)
returns public.payments
language plpgsql
set search_path = ''
as $$
declare
  v_pay            public.payments;
  v_orig_invoice   uuid;
  v_customer       uuid;
  v_inv_id         uuid;
  v_rec            record;
  v_has_orig       boolean;
  v_actor          uuid;
  v_conv_fp        text;
  v_alloc_json     jsonb;
begin
  -- trusted actor + finance authorization (same contract as record_payment_with_allocations_rpc).
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    v_actor := p_actor;
  else
    v_actor := (select auth.uid());
    if p_actor is not null and p_actor is distinct from v_actor then
      raise exception using errcode = 'P0001', message = 'payment_rpc_actor_mismatch';
    end if;
  end if;
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'payment_rpc_not_finance_authorized';
  end if;
  if not (
    exists (select 1 from public.dealer_staff ds where ds.dealer_id = p_dealer_id
              and ds.user_id = v_actor and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds where ds.dealer_id = p_dealer_id and ds.user_id = v_actor)
      and exists (select 1 from public.dealer_members dm where dm.dealer_id = p_dealer_id
                    and dm.user_id = v_actor and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  ) then
    raise exception using errcode = 'P0001', message = 'payment_rpc_not_finance_authorized';
  end if;

  if jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception using errcode = 'P0001', message = 'payment_rpc_conversion_requires_allocations';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_allocations) e
     where (e->>'invoice_id') is null
        or (e->>'allocated_amount') is null
        or (e->>'allocated_amount')::numeric <= 0
        or (e->>'allocated_amount')::numeric >= 'Infinity'::numeric
  ) then
    raise exception using errcode = 'P0001', message = 'payment_rpc_invalid_allocation';
  end if;

  -- Canonical original-conversion request fingerprint (unambiguous JSONB; scale-normalized; sorted).
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'invoice', (e->>'invoice_id')::uuid,
             'amount',  pg_catalog.trim_scale((e->>'allocated_amount')::numeric),
             'order',   coalesce((e->>'allocation_order')::int, 0))
             order by (e->>'invoice_id')::uuid, (e->>'allocated_amount')::numeric,
                      coalesce((e->>'allocation_order')::int, 0)),
           '[]'::jsonb)
    into v_alloc_json
    from jsonb_array_elements(p_allocations) e;
  v_conv_fp := pg_catalog.md5(jsonb_build_object('payment', p_payment_id, 'allocations', v_alloc_json)::text);

  -- Lock the payment (serialises concurrent conversions of the same payment).
  select * into v_pay from public.payments where id = p_payment_id and dealer_id = p_dealer_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_rpc_payment_not_found';
  end if;

  -- RETRY-SAFETY: if the payment is ALREADY converted (invoice_id null), compare against the PERSISTED
  -- original conversion fingerprint — NOT the current, mutable allocation collection — so a later valid
  -- allocation INSERT never breaks an identical retry; a materially different retry fails closed.
  if v_pay.invoice_id is null then
    if v_pay.conversion_fingerprint is not distinct from v_conv_fp then
      return v_pay;
    end if;
    raise exception using errcode = 'P0001', message = 'payment_rpc_conversion_conflict';
  end if;

  if v_pay.status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'payment_rpc_payment_not_completed';
  end if;
  if exists (select 1 from public.monthly_statement_receipts r
               join public.monthly_statements s on s.id = r.statement_id
              where r.payment_id = v_pay.id and s.status = 'issued') then
    raise exception using errcode = 'P0001', message = 'payment_rpc_payment_frozen_by_issued_statement';
  end if;

  v_orig_invoice := v_pay.invoice_id;

  -- The allocation set must include a positive allocation back to the original invoice.
  select bool_or((e->>'invoice_id')::uuid = v_orig_invoice and (e->>'allocated_amount')::numeric > 0)
    into v_has_orig from jsonb_array_elements(p_allocations) e;
  if not coalesce(v_has_orig, false) then
    raise exception using errcode = 'P0001', message = 'payment_rpc_conversion_missing_original_invoice';
  end if;

  -- Allocated payments require a customer; derive from the original invoice when the payment lacks one.
  if v_pay.customer_id is not null then
    v_customer := v_pay.customer_id;
  else
    select customer_id into v_customer from public.invoices where id = v_orig_invoice;
  end if;

  -- Lock the original + every allocation-target invoice in deterministic id order BEFORE mutation.
  for v_inv_id in
    select distinct inv from (
      select v_orig_invoice as inv
      union
      select (e->>'invoice_id')::uuid from jsonb_array_elements(p_allocations) e
    ) z order by inv
  loop
    perform 1 from public.invoices where id = v_inv_id for update;
  end loop;

  -- Atomically drop the direct link (setting customer if needed) and PERSIST the immutable conversion
  -- fingerprint, then insert the full allocation set.
  update public.payments set invoice_id = null, customer_id = v_customer,
         conversion_fingerprint = v_conv_fp, updated_at = now()
    where id = v_pay.id returning * into v_pay;

  for v_rec in
    select (e->>'invoice_id')::uuid as inv,
           (e->>'allocated_amount')::numeric as amt,
           coalesce((e->>'allocation_order')::int, 0) as ord
      from jsonb_array_elements(p_allocations) e
  loop
    insert into public.payment_allocations (
      dealer_id, customer_id, payment_id, invoice_id, allocated_amount, allocation_order, created_by
    ) values (p_dealer_id, v_customer, v_pay.id, v_rec.inv, v_rec.amt, v_rec.ord, v_actor);
  end loop;

  -- Recalculate the original + all newly affected invoices in the SAME transaction.
  for v_inv_id in
    select distinct inv from (
      select v_orig_invoice as inv
      union
      select (e->>'invoice_id')::uuid from jsonb_array_elements(p_allocations) e
    ) z order by inv
  loop
    perform public.b3_recalc_invoice_payment(v_inv_id);
  end loop;

  return v_pay;
end;
$$;

-- EXECUTE privileges: explicit, never default. The recalc helper + both RPCs run as the authenticated
-- finance caller (SECURITY INVOKER); anon is denied. No SECURITY DEFINER anywhere.
revoke all     on function public.b3_recalc_invoice_payment(uuid) from public;
revoke execute on function public.b3_recalc_invoice_payment(uuid) from anon;
grant  execute on function public.b3_recalc_invoice_payment(uuid) to authenticated, service_role;

revoke all     on function public.record_payment_with_allocations_rpc(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb) from public;
revoke execute on function public.record_payment_with_allocations_rpc(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb) from anon;
grant  execute on function public.record_payment_with_allocations_rpc(uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb) to authenticated, service_role;

revoke all     on function public.convert_payment_to_allocated_rpc(uuid, uuid, uuid, jsonb) from public;
revoke execute on function public.convert_payment_to_allocated_rpc(uuid, uuid, uuid, jsonb) from anon;
grant  execute on function public.convert_payment_to_allocated_rpc(uuid, uuid, uuid, jsonb) to authenticated, service_role;
