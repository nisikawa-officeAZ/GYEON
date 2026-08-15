-- DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1B-D1 — atomic monthly-statement draft creation.
--
-- One SECURITY INVOKER transaction that creates a draft monthly statement header, its statement
-- number, and every eligible invoice line together — or creates nothing. It is the ONLY application
-- boundary for persisted draft creation; the accepted B2/B3 triggers remain the authoritative
-- validators for every row this RPC inserts.
--
--   * monthly_statements_active_scope_uidx: at most one NON-VOIDED statement (draft or issued) per
--     exact (dealer, customer, period_start, period_end). Deliberately NOT "if not exists" and no
--     duplicate repair: if active duplicates already exist, applying this migration fails closed so
--     the rows can be audited first.
--   * public.create_monthly_statement_draft_rpc(uuid, uuid, uuid, date): authenticated-only,
--     SECURITY INVOKER, empty search_path. Eligibility is delivery_date-only. Numbering is a FIXED
--     contract for this release (sequence_type monthly_invoice, prefix MIV, padding 5, monthly
--     reset, fiscal period = YYYYMM of period_end) allocated through the existing authoritative
--     public.get_next_document_number inside the SAME transaction — stored document_sequences
--     configuration has ZERO authority here and is never read. A rolled-back draft rolls the
--     sequence advance back with it.
--
-- This migration does not touch RLS, table grants, get_next_document_number, migration 104, or any
-- accepted B3-B1A object.

-- ── A. active-scope uniqueness (fail-closed on pre-existing duplicates) ─────────────────────────────
create unique index monthly_statements_active_scope_uidx
  on public.monthly_statements (dealer_id, customer_id, period_start, period_end)
  where status <> 'voided';

-- ── B. the atomic draft-creation RPC ────────────────────────────────────────────────────────────────
create or replace function public.create_monthly_statement_draft_rpc(
  p_dealer_id      uuid,
  p_actor          uuid,
  p_customer_id    uuid,
  p_reference_date date
)
returns public.monthly_statements
language plpgsql
set search_path = ''
as $$
declare
  v_actor            uuid;
  v_cust_dealer      uuid;
  v_closing_day      int;
  v_payment_day      int;
  v_month_start      date;
  v_prev_month_start date;
  v_this_closing     date;
  v_prev_closing     date;
  v_period_start     date;
  v_period_end       date;
  v_due_month_start  date;
  v_due_date         date;
  v_stmt             public.monthly_statements;
  v_inv_ids          uuid[];
  v_inv_id           uuid;
  v_fiscal           int;
  v_seq              int;
  v_seq_text         text;
  v_statement_number text;
  v_customer_snap    jsonb;
  v_dealer_snap      jsonb;
  v_billing_terms    jsonb;
begin
  -- ── 1. required inputs (deterministic, fail-closed) ──
  if p_dealer_id is null then
    raise exception using errcode = 'P0001', message = 'statement_draft_dealer_required';
  end if;
  if p_customer_id is null then
    raise exception using errcode = 'P0001', message = 'statement_draft_customer_required';
  end if;
  if p_reference_date is null then
    raise exception using errcode = 'P0001', message = 'statement_draft_reference_date_required';
  end if;

  -- ── 2. actor resolved EXCLUSIVELY from auth.uid(); p_actor may only confirm it ──
  v_actor := (select auth.uid());
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'statement_draft_not_finance_authorized';
  end if;
  if p_actor is not null and p_actor is distinct from v_actor then
    raise exception using errcode = 'P0001', message = 'statement_draft_actor_mismatch';
  end if;

  -- ── 3. active finance owner/manager: dealer_staff precedence, dealer_members fallback ──
  -- Any dealer_staff row for (dealer, actor) blocks the fallback unless it is active owner/manager.
  if not (
    exists (select 1 from public.dealer_staff ds where ds.dealer_id = p_dealer_id
              and ds.user_id = v_actor and ds.status = 'active' and ds.role in ('owner','manager'))
    or (
      not exists (select 1 from public.dealer_staff ds where ds.dealer_id = p_dealer_id and ds.user_id = v_actor)
      and exists (select 1 from public.dealer_members dm where dm.dealer_id = p_dealer_id
                    and dm.user_id = v_actor and dm.status = 'active' and dm.role in ('owner','manager'))
    )
  ) then
    raise exception using errcode = 'P0001', message = 'statement_draft_not_finance_authorized';
  end if;

  -- ── 4. authoritative customer lock + tenant proof ──
  select dealer_id into v_cust_dealer from public.customers where id = p_customer_id for update;
  if not found or v_cust_dealer is distinct from p_dealer_id then
    raise exception using errcode = 'P0001', message = 'statement_draft_customer_not_found';
  end if;

  -- ── 5. dealer closing settings (exactly one persisted row; fail closed otherwise) ──
  select ds.dealer_closing_day, ds.dealer_payment_day
    into v_closing_day, v_payment_day
    from public.dealer_settings ds
   where ds.dealer_id = p_dealer_id;
  if not found or v_closing_day is null or v_closing_day < 1 or v_closing_day > 31 then
    raise exception using errcode = 'P0001', message = 'statement_draft_dealer_not_closing_mode';
  end if;

  -- ── 6. inclusive period containing p_reference_date (short-month clamp) ──
  -- closing date of month M = min(closing_day, last day of M); period_end = first closing date on or
  -- after the reference date; period_start = the day after the previous closing date.
  v_month_start  := date_trunc('month', p_reference_date)::date;
  v_this_closing := v_month_start
    + (least(v_closing_day, extract(day from (v_month_start + interval '1 month' - interval '1 day'))::int) - 1);
  if p_reference_date <= v_this_closing then
    v_period_end       := v_this_closing;
    v_prev_month_start := (v_month_start - interval '1 month')::date;
  else
    v_prev_month_start := v_month_start;
    v_month_start      := (v_month_start + interval '1 month')::date;
    v_period_end       := v_month_start
      + (least(v_closing_day, extract(day from (v_month_start + interval '1 month' - interval '1 day'))::int) - 1);
  end if;
  v_prev_closing := v_prev_month_start
    + (least(v_closing_day, extract(day from (v_prev_month_start + interval '1 month' - interval '1 day'))::int) - 1);
  v_period_start := v_prev_closing + 1;

  -- ── 7. payment due date: clamped payment day in the month immediately after period_end ──
  if v_payment_day is not null then
    v_due_month_start := (date_trunc('month', v_period_end) + interval '1 month')::date;
    v_due_date := v_due_month_start
      + (least(v_payment_day, extract(day from (v_due_month_start + interval '1 month' - interval '1 day'))::int) - 1);
  else
    v_due_date := null;
  end if;

  -- ── 8. serialize concurrent draft creation for this exact scope ──
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_dealer_id::text || '|' || p_customer_id::text || '|' || v_period_end::text, 0));

  -- ── 9. idempotent re-entry / issued-period guard ──
  select * into v_stmt from public.monthly_statements
   where dealer_id = p_dealer_id and customer_id = p_customer_id
     and period_start = v_period_start and period_end = v_period_end
     and status = 'draft';
  if found then
    return v_stmt;   -- existing exact-scope draft is returned unchanged; nothing is allocated
  end if;
  if exists (
    select 1 from public.monthly_statements s
     where s.dealer_id = p_dealer_id and s.customer_id = p_customer_id
       and s.status = 'issued'
       and s.period_start <= v_period_end and s.period_end >= v_period_start
  ) then
    raise exception using errcode = 'P0001', message = 'statement_draft_period_already_issued';
  end if;

  -- ── 10. eligible invoices: delivery_date-only selection inside the inclusive period ──
  select array_agg(i.id order by i.id) into v_inv_ids
    from public.invoices i
   where i.dealer_id = p_dealer_id
     and i.customer_id = p_customer_id
     and i.deleted_at is null
     and i.status in ('issued', 'paid', 'partially_paid', 'overdue')
     and i.delivery_date is not null
     and i.delivery_date >= v_period_start
     and i.delivery_date <= v_period_end
     and not exists (
       select 1 from public.monthly_statement_lines l
         join public.monthly_statements s2 on s2.id = l.statement_id
        where l.invoice_id = i.id and s2.status <> 'voided'
     );

  -- ── 12. zero eligible invoices fails BEFORE any sequence allocation or statement insert ──
  if v_inv_ids is null or array_length(v_inv_ids, 1) is null then
    raise exception using errcode = 'P0001', message = 'statement_draft_no_eligible_invoices';
  end if;

  -- ── 11. deterministic ordered lock loop over every eligible invoice (ascending id) ──
  foreach v_inv_id in array v_inv_ids loop
    perform 1 from public.invoices where id = v_inv_id for update;
  end loop;

  -- ── 13-15. FIXED-contract number allocation inside this same transaction ──
  -- Stored document_sequences configuration has zero authority for monthly_invoice in this release;
  -- the literals below ARE the contract. The fiscal period comes from period_end, never wall-clock.
  v_fiscal := (extract(year from v_period_end)::int * 100) + extract(month from v_period_end)::int;
  v_seq := public.get_next_document_number(p_dealer_id, 'monthly_invoice', v_fiscal, 'MIV', 5, 'monthly');
  if v_seq is null or v_seq <= 0 then
    raise exception using errcode = 'P0001', message = 'statement_draft_number_unavailable';
  end if;
  v_seq_text := v_seq::text;
  if length(v_seq_text) < 5 then
    v_seq_text := lpad(v_seq_text, 5, '0');   -- pad-only; a >5-digit sequence is never truncated
  end if;
  v_statement_number := 'MIV-' || to_char(v_period_end, 'YYYY') || '-' || to_char(v_period_end, 'MM')
    || '-' || v_seq_text;

  -- ── 17-19. explicit jsonb_build_object allowlists (never whole-row serialization) ──
  -- customer_snapshot: billing-visible identity/contact/address only. memo, notes, match keys,
  -- birthday/gender/occupation, and every LINE field are deliberately excluded.
  select jsonb_build_object(
           'id',              c.id,
           'customer_code',   c.customer_code,
           'name',            c.name,
           'kana',            c.kana,
           'last_name',       c.last_name,
           'first_name',      c.first_name,
           'last_name_kana',  c.last_name_kana,
           'first_name_kana', c.first_name_kana,
           'postal_code',     c.postal_code,
           'prefecture',      c.prefecture,
           'city',            c.city,
           'address1',        c.address1,
           'address2',        c.address2,
           'address',         c.address,
           'phone',           c.phone,
           'email',           c.email)
    into v_customer_snap
    from public.customers c
   where c.id = p_customer_id;

  -- dealer_snapshot: renderer-facing dealer identity only (dealers has no postal column; the
  -- prefecture/address pair is its persisted address form). dealer_settings is NEVER serialized.
  select jsonb_build_object(
           'id',         d.id,
           'name',       d.name,
           'prefecture', d.prefecture,
           'address',    d.address,
           'phone',      d.phone,
           'email',      d.email)
    into v_dealer_snap
    from public.dealers d
   where d.id = p_dealer_id;
  if v_customer_snap is null or v_dealer_snap is null then
    -- unreachable for an authorized caller (RLS-visible rows were just locked/read); fail closed.
    raise exception using errcode = 'P0001', message = 'statement_draft_not_finance_authorized';
  end if;

  -- ── 20. billing terms snapshot; tax summary stays an empty object in D1 ──
  v_billing_terms := jsonb_build_object(
    'closing_day',      v_closing_day,
    'payment_day',      v_payment_day,
    'reference_date',   p_reference_date,
    'period_start',     v_period_start,
    'period_end',       v_period_end,
    'payment_due_date', v_due_date);

  -- ── 16. draft header: zero monetary defaults, no lifecycle metadata ──
  insert into public.monthly_statements (
    dealer_id, customer_id, statement_number, status,
    period_start, period_end, closing_date, payment_due_date,
    customer_snapshot, dealer_snapshot, billing_terms_snapshot, tax_summary_snapshot
  ) values (
    p_dealer_id, p_customer_id, v_statement_number, 'draft',
    v_period_start, v_period_end, v_period_end, v_due_date,
    v_customer_snap, v_dealer_snap, v_billing_terms, '{}'::jsonb
  ) returning * into v_stmt;

  -- ── 21-24. one line per locked invoice; snapshots byte-equal to the stored invoice columns.
  -- The accepted B2 line trigger re-locks each invoice and re-proves tenant, eligibility,
  -- delivery-date window, snapshot equality, and single-active-statement membership.
  insert into public.monthly_statement_lines (
    dealer_id, customer_id, statement_id, invoice_id,
    delivery_date, invoice_number, vehicle_snapshot, work_description_snapshot,
    subtotal_snapshot, discount_snapshot, tax_rate_snapshot, tax_snapshot, total_snapshot,
    sort_order
  )
  select
    i.dealer_id, i.customer_id, v_stmt.id, i.id,
    i.delivery_date, i.invoice_number,
    coalesce((
      select jsonb_build_object(
               'maker',        v.maker,
               'model',        v.model,
               'plate_number', v.plate_number,
               'color',        v.color)
        from public.vehicles v
       where v.id = i.vehicle_id
    ), '{}'::jsonb),
    case
      when btrim(coalesce(i.title, '')) <> '' then btrim(i.title)
      else coalesce((
        select case
                 when n.name_count = 1 then n.first_name
                 else n.first_name || ' ほか' || (n.name_count - 1)::text || '件'
               end
          from (
            select (array_agg(btrim(ii.item_name) order by ii.sort_order, ii.id))[1] as first_name,
                   count(*) as name_count
              from public.invoice_items ii
             where ii.invoice_id = i.id
               and btrim(coalesce(ii.item_name, '')) <> ''
          ) n
         where n.name_count > 0
      ), '')
    end,
    i.subtotal, i.discount_amount, i.tax_rate, i.tax_amount, i.total,
    (row_number() over (order by i.delivery_date asc,
                                 (i.invoice_number is null) asc,
                                 i.invoice_number asc,
                                 i.id asc))::int - 1
  from public.invoices i
  where i.id = any (v_inv_ids);

  -- ── 25. the inserted draft row; any failure above rolled back header, lines, and the sequence ──
  return v_stmt;
end;
$$;

-- ── C. EXECUTE: authenticated only — the single runtime invocation role ─────────────────────────────
revoke all     on function public.create_monthly_statement_draft_rpc(uuid, uuid, uuid, date) from public;
revoke execute on function public.create_monthly_statement_draft_rpc(uuid, uuid, uuid, date) from anon;
revoke execute on function public.create_monthly_statement_draft_rpc(uuid, uuid, uuid, date) from service_role;
grant  execute on function public.create_monthly_statement_draft_rpc(uuid, uuid, uuid, date) to authenticated;
