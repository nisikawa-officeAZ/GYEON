-- DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B2 — monthly statement foundation.
--
-- Adds the DISTINCT monthly-statement aggregate (monthly_statements + monthly_statement_lines) plus
-- the monthly_invoice numbering type and document type. A monthly statement is NEVER a synthetic
-- single invoice. This migration is additive: the two existing closed enums (document_sequences
-- sequence_type, document_files document_type) are EXTENDED (never narrowed); no table or column is
-- dropped; no prior migration is modified. Payment allocations, adjustments, the monthly PDF
-- renderer and the issuance RPC are OUT OF SCOPE and are not created here.

-- ── A. extend the two existing closed enums (additive; every prior value retained) ──────────────
-- R1: the EFFECTIVE pre-B2 enum is the 8 values reached after migrations 046 (six) + 048
-- (product_order) + 052 (reservation). All eight are retained; only monthly_invoice is added.
alter table public.document_sequences drop constraint if exists document_sequences_sequence_type_check;
alter table public.document_sequences add constraint document_sequences_sequence_type_check
  check (sequence_type in (
    'estimate', 'work_order', 'completion_report',
    'invoice', 'payment', 'maintenance_reminder',
    'product_order', 'reservation',
    'monthly_invoice'
  ));

alter table public.document_files drop constraint if exists document_files_document_type_check;
alter table public.document_files add constraint document_files_document_type_check
  check (document_type in (
    'estimate', 'completion_report', 'invoice', 'product_order',
    'monthly_invoice'
  ));

-- ── B. monthly_statements ───────────────────────────────────────────────────────────────────────
create table if not exists public.monthly_statements (
  id                       uuid        primary key default gen_random_uuid(),
  dealer_id                uuid        not null references public.dealers(id)   on delete cascade,
  customer_id              uuid        not null references public.customers(id) on delete restrict,
  statement_number         text,
  status                   text        not null default 'draft'
                                       check (status in ('draft', 'issued', 'voided')),
  period_start             date        not null,
  period_end               date        not null,
  closing_date             date        not null,
  payment_due_date         date,
  previous_statement_id    uuid        references public.monthly_statements(id) on delete restrict,
  opening_balance          numeric     not null default 0,
  current_subtotal         numeric     not null default 0,
  current_discount         numeric     not null default 0,
  current_tax              numeric     not null default 0,
  current_total            numeric     not null default 0,
  allocated_payments_total numeric     not null default 0,
  adjustments_total        numeric     not null default 0,
  closing_balance          numeric     not null default 0,
  customer_snapshot        jsonb       not null default '{}'::jsonb,
  dealer_snapshot          jsonb       not null default '{}'::jsonb,
  billing_terms_snapshot   jsonb       not null default '{}'::jsonb,
  tax_summary_snapshot     jsonb       not null default '{}'::jsonb,
  issued_at                timestamptz,
  issued_by                uuid,
  voided_at                timestamptz,
  voided_by                uuid,
  void_reason              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint monthly_statements_period_order        check (period_start <= period_end),
  constraint monthly_statements_closing_is_end      check (closing_date = period_end),
  constraint monthly_statements_customer_snap_obj   check (jsonb_typeof(customer_snapshot) = 'object'),
  constraint monthly_statements_dealer_snap_obj     check (jsonb_typeof(dealer_snapshot) = 'object'),
  constraint monthly_statements_billing_snap_obj    check (jsonb_typeof(billing_terms_snapshot) = 'object'),
  constraint monthly_statements_tax_snap_obj        check (jsonb_typeof(tax_summary_snapshot) = 'object')
);

-- statement_number is unique within a dealer WHEN PRESENT (drafts may have none yet).
create unique index if not exists monthly_statements_dealer_number_uidx
  on public.monthly_statements (dealer_id, statement_number)
  where statement_number is not null;
create index if not exists idx_monthly_statements_dealer   on public.monthly_statements (dealer_id);
create index if not exists idx_monthly_statements_customer on public.monthly_statements (dealer_id, customer_id);
create index if not exists idx_monthly_statements_prev     on public.monthly_statements (previous_statement_id);

-- ── C. monthly_statement_lines ────────────────────────────────────────────────────────────────
create table if not exists public.monthly_statement_lines (
  id                        uuid        primary key default gen_random_uuid(),
  dealer_id                 uuid        not null references public.dealers(id)   on delete cascade,
  customer_id               uuid        not null references public.customers(id) on delete restrict,
  statement_id              uuid        not null references public.monthly_statements(id) on delete cascade,
  invoice_id                uuid        not null references public.invoices(id)  on delete restrict,
  delivery_date             date        not null,
  invoice_number            text,
  vehicle_snapshot          jsonb       not null default '{}'::jsonb,
  work_description_snapshot text        not null default '',
  subtotal_snapshot         numeric     not null default 0,
  discount_snapshot         numeric     not null default 0,
  tax_rate_snapshot         numeric     not null default 0,
  tax_snapshot              numeric     not null default 0,
  total_snapshot            numeric     not null default 0,
  sort_order                integer     not null default 0,
  created_at                timestamptz not null default now(),
  constraint monthly_statement_lines_vehicle_snap_obj check (jsonb_typeof(vehicle_snapshot) = 'object')
);
create index if not exists idx_msl_statement on public.monthly_statement_lines (statement_id);
create index if not exists idx_msl_dealer    on public.monthly_statement_lines (dealer_id);
create index if not exists idx_msl_invoice   on public.monthly_statement_lines (invoice_id);

-- ── D. statement rules: previous-link tenant match + immutability after leaving draft ────────────
-- SECURITY INVOKER (default): no authorization shortcut. Comparisons use `is distinct from`.
create or replace function public.enforce_monthly_statement_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prev_status   text;
  v_prev_dealer   uuid;
  v_prev_customer uuid;
  v_prev_end      date;
  v_prev_closing  numeric;
  v_line_count    integer;
  v_sum_sub       numeric;
  v_sum_disc      numeric;
  v_sum_tax       numeric;
  v_sum_total     numeric;
  v_active_later  integer;
  v_latest_id     uuid;
  v_latest_closing numeric;
  v_overlap       integer;
  v_dup_successor integer;
  v_cust_dealer   uuid;
  v_inv_id        uuid;
begin
  -- ── R3: the statement's customer must belong to the statement's dealer ──────────────────────
  -- customer_id is independently mutable, so the RLS dealer predicate alone is insufficient. Under
  -- authenticated RLS a foreign-dealer customer is invisible (→ not found → rejected); under the
  -- privileged issuance role the explicit dealer comparison catches any mismatch. Fail closed.
  select dealer_id into v_cust_dealer from public.customers where id = new.customer_id;
  if not found or v_cust_dealer is distinct from new.dealer_id then
    raise exception using errcode = 'P0001', message = 'monthly_statement_customer_dealer_mismatch';
  end if;

  -- ── previous-statement chain integrity (INSERT and UPDATE) ──────────────────────────────────
  -- Not self; resolves to the SAME dealer+customer; is ISSUED; ends strictly before this period;
  -- and opening_balance equals its closing_balance. With no previous statement, opening_balance = 0.
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
    -- A new statement is always born a draft with NO lifecycle metadata.
    if new.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'monthly_statement_insert_must_be_draft';
    end if;
    if new.issued_at is not null or new.issued_by is not null
       or new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception using errcode = 'P0001', message = 'monthly_statement_draft_has_lifecycle_metadata';
    end if;
    return new;
  end if;

  -- ── UPDATE ──────────────────────────────────────────────────────────────────────────────────
  if old.status = 'draft' then
    -- A draft may only stay draft or be issued; abandonment is a hard delete of the draft.
    if new.status not in ('draft', 'issued') then
      raise exception using errcode = 'P0001', message = 'monthly_statement_invalid_draft_transition';
    end if;

    if new.status = 'draft' then
      -- Still a draft: it must not acquire issue or void metadata.
      if new.issued_at is not null or new.issued_by is not null
         or new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
        raise exception using errcode = 'P0001', message = 'monthly_statement_draft_has_lifecycle_metadata';
      end if;
      -- R3: a draft scope/period edit is allowed ONLY when every existing line stays valid under the
      -- new scope/period. (Issuance re-checks this unconditionally; this is defense in depth and gives
      -- the operator immediate feedback instead of a late issuance failure.)
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

    -- draft → issued: PRIVILEGED, complete, and internally consistent. Direct authenticated issuance
    -- fails closed; the future issuance action runs as service_role.
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issue_requires_privileged_path';
    end if;

    -- R2: serialise the dealer/customer statement chain on an authoritative customer-scoped row, so
    -- two concurrent issuances (or an issuance racing a void) for the same customer cannot both pass.
    -- This lock is taken BEFORE the predecessor-chain decision below.
    perform 1 from public.customers c where c.id = new.customer_id for update;

    -- R3: the draft parent scope/period may have been edited AFTER the lines were inserted, bypassing
    -- the line trigger. Re-validate EVERY persisted line against the FINAL statement scope and period.
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

    -- R4: lock every referenced source invoice in DETERMINISTIC id order (loop, not a bare
    -- ORDER BY ... FOR UPDATE, so the lock order is guaranteed), then revalidate each line's CURRENT
    -- source invoice — a source invoice may have been cancelled or edited after the line was inserted.
    for v_inv_id in
      select distinct l.invoice_id
        from public.monthly_statement_lines l
       where l.statement_id = new.id
       order by l.invoice_id
    loop
      perform 1 from public.invoices where id = v_inv_id for update;
    end loop;

    -- Every line must still match its current source invoice: an eligible status, exact tenant, and
    -- byte-equal delivery_date, invoice_number and monetary snapshots. Nothing is recomputed here.
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

    -- R2 authoritative predecessor: the previous link must be EXACTLY the latest issued statement for
    -- this dealer+customer that ends before this period — or null when none exists — with a matching
    -- opening balance. An older issued statement cannot be chosen while a newer eligible one exists.
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

    -- R2 no overlapping issued (non-voided) statement for the same dealer/customer.
    select count(*) into v_overlap
      from public.monthly_statements s
     where s.dealer_id = new.dealer_id and s.customer_id = new.customer_id
       and s.id <> new.id and s.status = 'issued'
       and s.period_start <= new.period_end and s.period_end >= new.period_start;
    if v_overlap > 0 then
      raise exception using errcode = 'P0001', message = 'monthly_statement_period_overlap';
    end if;

    -- R2 no branching: at most one issued successor may reference a given predecessor.
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
    if new.closing_balance <>
         new.opening_balance + new.current_total - new.allocated_payments_total + new.adjustments_total then
      raise exception using errcode = 'P0001', message = 'monthly_statement_closing_balance_mismatch';
    end if;
    return new;
  end if;

  -- OLD row already left draft: it is a committed commercial record.
  if new.status = 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_cannot_return_to_draft';
  end if;
  if old.status = 'issued' and new.status not in ('issued', 'voided') then
    raise exception using errcode = 'P0001', message = 'monthly_statement_invalid_issued_transition';
  end if;
  if old.status = 'voided' and new.status <> 'voided' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_voided_is_terminal';
  end if;

  -- R2: an issued row that STAYS issued must never acquire void metadata.
  if old.status = 'issued' and new.status = 'issued' then
    if new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception using errcode = 'P0001', message = 'monthly_statement_issued_cannot_have_void_metadata';
    end if;
  end if;

  -- issued → voided: PRIVILEGED and controlled — complete void metadata AND no active later statement
  -- links to it. An authenticated owner/manager cannot void directly; the void action runs as
  -- service_role. The dealer/customer chain is serialised on the same authoritative customer row used
  -- by issuance, so the active-successor recheck is race-safe.
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

  -- R2: once voided, status is terminal (above) AND the void metadata is frozen.
  if old.status = 'voided' then
    if new.voided_at   is distinct from old.voided_at
       or new.voided_by  is distinct from old.voided_by
       or new.void_reason is distinct from old.void_reason then
      raise exception using errcode = 'P0001', message = 'monthly_statement_voided_metadata_immutable';
    end if;
  end if;

  -- Identity, dates, numbering, links, totals and snapshots are FROZEN once out of draft. Only the
  -- void bookkeeping (voided_at, voided_by, void_reason) and updated_at may still move.
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

drop trigger if exists trg_monthly_statement_rules on public.monthly_statements;
create trigger trg_monthly_statement_rules
  before insert or update on public.monthly_statements
  for each row execute function public.enforce_monthly_statement_rules();

-- Issued/voided statements are corrected by VOIDING, never by hard deletion.
create or replace function public.enforce_monthly_statement_no_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_no_hard_delete';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_monthly_statement_no_hard_delete on public.monthly_statements;
create trigger trg_monthly_statement_no_hard_delete
  before delete on public.monthly_statements
  for each row execute function public.enforce_monthly_statement_no_hard_delete();

-- ── E. line rules: parent-draft, tenant match, invoice eligibility, delivery-date, membership ────
-- A PostgreSQL partial unique index cannot filter a child row by its parent statement's status, so
-- the "at most one NON-VOIDED statement per invoice" guard is a trigger that LOCKS the source invoice
-- row FIRST (serialising concurrent inserts), then checks membership. SECURITY INVOKER: no shortcut.
create or replace function public.enforce_monthly_statement_line_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_statement_id  uuid;
  v_stmt_status   text;
  v_stmt_dealer   uuid;
  v_stmt_customer uuid;
  v_stmt_pstart   date;
  v_stmt_pend     date;
  v_inv_status    text;
  v_inv_dealer    uuid;
  v_inv_customer  uuid;
  v_inv_delivery  date;
  v_inv_number    text;
  v_inv_subtotal  numeric;
  v_inv_discount  numeric;
  v_inv_tax_rate  numeric;
  v_inv_tax       numeric;
  v_inv_total     numeric;
  v_dup           integer;
begin
  if tg_op = 'DELETE' then v_statement_id := old.statement_id; else v_statement_id := new.statement_id; end if;

  -- Lock and read the parent statement. Lines are mutable ONLY while the parent is a draft.
  select status, dealer_id, customer_id, period_start, period_end
    into v_stmt_status, v_stmt_dealer, v_stmt_customer, v_stmt_pstart, v_stmt_pend
    from public.monthly_statements where id = v_statement_id for update;

  if not found then
    -- Parent already gone: only reachable via ON DELETE CASCADE, where removing the child is correct.
    if tg_op = 'DELETE' then return old; end if;
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_no_parent';
  end if;

  if v_stmt_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_parent_not_draft';
  end if;

  if tg_op = 'DELETE' then return old; end if;

  -- The line dealer/customer must match its parent statement.
  if new.dealer_id is distinct from v_stmt_dealer or new.customer_id is distinct from v_stmt_customer then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_statement_tenant_mismatch';
  end if;

  -- Lock and read the source invoice, then validate it. The line SNAPSHOTS are proven equal to the
  -- invoice's own stored values (no derivation, no recomputation).
  select status, dealer_id, customer_id, delivery_date,
         invoice_number, subtotal, discount_amount, tax_rate, tax_amount, total
    into v_inv_status, v_inv_dealer, v_inv_customer, v_inv_delivery,
         v_inv_number, v_inv_subtotal, v_inv_discount, v_inv_tax_rate, v_inv_tax, v_inv_total
    from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_invoice_not_found';
  end if;

  -- The line dealer/customer must also match the source invoice.
  if new.dealer_id is distinct from v_inv_dealer or new.customer_id is distinct from v_inv_customer then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_invoice_tenant_mismatch';
  end if;

  -- Only issued/paid/partially_paid/overdue invoices are eligible; draft and cancelled are rejected.
  if v_inv_status not in ('issued', 'paid', 'partially_paid', 'overdue') then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_invoice_not_eligible';
  end if;

  -- delivery_date is required and is sourced ONLY from the invoice; issue_date is never a fallback.
  if v_inv_delivery is null then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_invoice_missing_delivery_date';
  end if;
  if new.delivery_date is distinct from v_inv_delivery then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_delivery_date_mismatch';
  end if;

  -- R2: the invoice delivery_date must fall within the parent statement's INCLUSIVE period.
  if new.delivery_date < v_stmt_pstart or new.delivery_date > v_stmt_pend then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_delivery_outside_period';
  end if;

  -- The stored invoice_number and every monetary snapshot must EXACTLY equal the source invoice.
  if new.invoice_number is distinct from v_inv_number then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_invoice_number_mismatch';
  end if;
  if new.subtotal_snapshot  is distinct from v_inv_subtotal
     or new.discount_snapshot is distinct from v_inv_discount
     or new.tax_rate_snapshot is distinct from v_inv_tax_rate
     or new.tax_snapshot      is distinct from v_inv_tax
     or new.total_snapshot    is distinct from v_inv_total then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_snapshot_mismatch';
  end if;

  -- ACTIVE-MEMBERSHIP GUARD: this invoice may belong to at most one NON-VOIDED statement. The invoice
  -- row is already locked above, so two concurrent inserts of the same invoice serialise here and
  -- cannot both pass. Reuse becomes possible only once the prior parent statement is genuinely voided.
  select count(*)
    into v_dup
    from public.monthly_statement_lines l
    join public.monthly_statements s on s.id = l.statement_id
   where l.invoice_id = new.invoice_id
     and l.id <> new.id
     and s.status <> 'voided';
  if v_dup > 0 then
    raise exception using errcode = 'P0001', message = 'monthly_statement_line_invoice_already_active';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_monthly_statement_line_rules on public.monthly_statement_lines;
create trigger trg_monthly_statement_line_rules
  before insert or update or delete on public.monthly_statement_lines
  for each row execute function public.enforce_monthly_statement_line_rules();

-- ── E2. post-issuance cancellation guard on invoices (SEPARATE trigger) ──────────────────────────
-- R4: an invoice that a NON-voided-and-ISSUED monthly statement already includes cannot be cancelled
-- out from under it. A voided parent releases the invoice (only status = 'issued' blocks); a draft
-- parent does NOT permanently block cancellation — but that draft's later issuance will fail the R4
-- source-invoice revalidation until the cancelled invoice's line is removed. This is a NEW trigger; it
-- does not modify or weaken the existing enforce_invoice_issued_immutability trigger. SECURITY INVOKER.
create or replace function public.enforce_invoice_cancel_not_in_issued_statement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if exists (
      select 1
        from public.monthly_statement_lines l
        join public.monthly_statements s on s.id = l.statement_id
       where l.invoice_id = new.id
         and s.status = 'issued'
    ) then
      raise exception using errcode = 'P0001', message = 'invoice_cancel_blocked_by_issued_statement';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_cancel_not_in_issued_statement on public.invoices;
create trigger trg_invoice_cancel_not_in_issued_statement
  before update on public.invoices
  for each row execute function public.enforce_invoice_cancel_not_in_issued_statement();

revoke all on function public.enforce_invoice_cancel_not_in_issued_statement() from public, anon, authenticated;

-- ── F. RLS + explicit least-privilege grants ─────────────────────────────────────────────────────
alter table public.monthly_statements       enable row level security;
alter table public.monthly_statement_lines  enable row level security;

-- anon gets nothing. authenticated gets the operations the app performs (RLS row-confines them).
-- service_role gets everything for future server-side issuance (it bypasses RLS).
revoke all on public.monthly_statements      from anon;
revoke all on public.monthly_statement_lines from anon;
grant select, insert, update, delete on public.monthly_statements      to authenticated;
grant select, insert, update, delete on public.monthly_statement_lines to authenticated;
grant select, insert, update, delete on public.monthly_statements      to service_role;
grant select, insert, update, delete on public.monthly_statement_lines to service_role;

-- SELECT: an ACTIVE staff identity of the row's dealer (any role), or the dealer_members fallback
-- ONLY when no dealer_staff row exists, or an ACTIVE super-admin (read-only). auth.uid() is wrapped
-- in a scalar subselect. No user_metadata. Never `to authenticated` without a tenant predicate.
create policy monthly_statements_select on public.monthly_statements
  for select to authenticated
  using (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statements.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager', 'staff', 'readonly')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statements.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statements.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager', 'staff', 'readonly')
      )
    )
    -- R1: read-only super-admin ONLY. gyeon_admin / logistics_admin (migration 075) get no
    -- cross-tenant statement access.
    or exists (
      select 1 from public.admin_users au
       where au.user_id = (select auth.uid())
         and au.status  = 'active'
         and au.role    = 'super_admin'
    )
  );

-- WRITE: the ACTIVE canonical finance role (owner or manager) only; dealer_staff takes precedence
-- and a non-active dealer_staff row blocks the dealer_members fallback. Super-admin has NO write.
create policy monthly_statements_insert on public.monthly_statements
  for insert to authenticated
  with check (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statements.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  );

create policy monthly_statements_update on public.monthly_statements
  for update to authenticated
  using (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statements.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  )
  with check (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statements.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  );

create policy monthly_statements_delete on public.monthly_statements
  for delete to authenticated
  using (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statements.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statements.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  );

-- monthly_statement_lines: same tenant key (its own dealer_id, proven equal to statement + invoice
-- by the line trigger) and the same finance/admin rules.
create policy monthly_statement_lines_select on public.monthly_statement_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statement_lines.dealer_id
         and ds.user_id = (select auth.uid()) and ds.status = 'active'
         and ds.role in ('owner', 'manager', 'staff', 'readonly')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statement_lines.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager', 'staff', 'readonly')
      )
    )
    -- R1: read-only super-admin ONLY (see monthly_statements_select).
    or exists (
      select 1 from public.admin_users au
       where au.user_id = (select auth.uid()) and au.status = 'active' and au.role = 'super_admin'
    )
  );

create policy monthly_statement_lines_insert on public.monthly_statement_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statement_lines.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  );

create policy monthly_statement_lines_update on public.monthly_statement_lines
  for update to authenticated
  using (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statement_lines.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  )
  with check (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statement_lines.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  );

create policy monthly_statement_lines_delete on public.monthly_statement_lines
  for delete to authenticated
  using (
    exists (
      select 1 from public.dealer_staff ds
       where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
         and ds.status = 'active' and ds.role in ('owner', 'manager')
    )
    or (
      not exists (
        select 1 from public.dealer_staff ds
         where ds.dealer_id = monthly_statement_lines.dealer_id and ds.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.dealer_members dm
         where dm.dealer_id = monthly_statement_lines.dealer_id and dm.user_id = (select auth.uid())
           and dm.status = 'active' and dm.role in ('owner', 'manager')
      )
    )
  );

-- Trigger helpers are invoked by the trigger machinery, never called directly.
revoke all on function public.enforce_monthly_statement_rules()          from public, anon, authenticated;
revoke all on function public.enforce_monthly_statement_no_hard_delete() from public, anon, authenticated;
revoke all on function public.enforce_monthly_statement_line_rules()     from public, anon, authenticated;
