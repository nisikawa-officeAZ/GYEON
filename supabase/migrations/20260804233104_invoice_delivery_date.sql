-- DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B1 — authoritative invoices.delivery_date (納品日).
--
-- Adds a NULLABLE delivery_date column (no default, no backfill) so existing rows and open drafts
-- stay valid; every NEWLY issued invoice is gated by the application snapshot validator, not by a
-- table NOT NULL. Two invoice functions carry the new field into their existing contracts and are
-- re-declared here VERBATIM apart from the delivery_date additions:
--
--   * enforce_invoice_issued_immutability() — delivery_date joins the draft content-version set and
--     the post-issue frozen set (exactly like issue_date / due_date). Nothing else changes.
--   * save_invoice_draft() — delivery_date joins both exact allowed-key arrays (LC_ALL=C sorted),
--     the string/null type loop, and the draft UPDATE. The finance gate, FOR UPDATE lock, item
--     replacement, SECURITY INVOKER, search_path pin, grants and fail-closed outcomes are unchanged.
--
-- The prior migration 20260801132658_invoice_issued_immutability.sql is left byte-identical; this
-- migration is additive and, being later, is the effective definition after apply. No monthly
-- statement, allocation, adjustment, numbering or document-type work happens here.

-- R1: fail closed on schema drift. A plain ADD COLUMN errors if `delivery_date` already exists with
-- an unexpected shape, instead of silently accepting it as `add column if not exists` would.
alter table public.invoices
  add column delivery_date date;

comment on column public.invoices.delivery_date is
  '納品日 — authoritative delivery date; required (non-null, valid calendar date) before issuance. No issue_date fallback.';

-- ---------------------------------------------------------------------------
-- invoices: freeze commercial data once the row has left draft, and own the
-- content marker outright. delivery_date added to the versioned and frozen sets.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_invoice_issued_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_bump_for   text := coalesce(current_setting('dealeros.invoice_item_bump', true), '');
  v_versioned  boolean;
begin
  -- B1-R3-2: everything the issued PDF renders, plus every immutable commercial
  -- identifier. If any of these differ, the rendered content is no longer the
  -- stored content.
  v_versioned :=
       new.dealer_id            is distinct from old.dealer_id
    or new.customer_id          is distinct from old.customer_id
    or new.vehicle_id           is distinct from old.vehicle_id
    or new.estimate_id          is distinct from old.estimate_id
    or new.work_order_id        is distinct from old.work_order_id
    or new.completion_report_id is distinct from old.completion_report_id
    or new.invoice_number       is distinct from old.invoice_number
    or new.title                is distinct from old.title
    or new.issue_date           is distinct from old.issue_date
    or new.due_date             is distinct from old.due_date
    or new.delivery_date        is distinct from old.delivery_date
    or new.subtotal             is distinct from old.subtotal
    or new.discount_amount      is distinct from old.discount_amount
    or new.tax_rate             is distinct from old.tax_rate
    or new.tax_amount           is distinct from old.tax_amount
    or new.total                is distinct from old.total
    or new.paid_amount          is distinct from old.paid_amount
    or new.balance_due          is distinct from old.balance_due
    or new.notes                is distinct from old.notes;

  -- B1-R3-1/B1-R3-5: derive the marker. The ONLY way it advances without a
  -- versioned field changing is the item-driven bump below, which announces
  -- itself through a transaction-local setting that PostgREST never populates
  -- from client input — so an authenticated caller cannot imitate it.
  if old.status = 'draft'
     and v_bump_for = old.id::text
     and not v_versioned
     and new.content_version = old.content_version + 1 then
    null;  -- keep the item trigger's increment
  elsif old.status = 'draft' and v_versioned then
    new.content_version := old.content_version + 1;
  else
    -- Every other case, including draft→issued: carry OLD forward untouched.
    new.content_version := old.content_version;
  end if;

  if old.status = 'draft' then
    -- Draft may only stay draft, become issued, or be cancelled outright.
    if new.status not in ('draft', 'issued', 'cancelled') then
      raise exception using
        errcode = 'P0001',
        message = 'invoice_invalid_draft_transition';
    end if;

    -- A draft must not acquire PDF pointers except by being issued.
    if new.status <> 'issued'
       and (new.pdf_file_path is distinct from old.pdf_file_path
            or new.pdf_file_url is distinct from old.pdf_file_url) then
      raise exception using
        errcode = 'P0001',
        message = 'invoice_draft_cannot_set_pdf_pointer';
    end if;

    if new.status = 'issued' then
      -- Issuance is a PRIVILEGED operation. `document_files` is insertable by any
      -- dealer member and the storage policies allow a member to write inside
      -- their own folder, so the existence of a row is not proof on its own.
      -- Requiring the service role confines issuance to the server action.
      if current_user not in ('service_role', 'postgres', 'supabase_admin') then
        raise exception using
          errcode = 'P0001',
          message = 'invoice_issue_requires_privileged_path';
      end if;

      if new.pdf_file_path is null or btrim(new.pdf_file_path) = '' then
        raise exception using
          errcode = 'P0001',
          message = 'invoice_issue_requires_pdf_artifact';
      end if;

      -- The pointer must match an ACTIVE invoice PDF row for this dealer whose
      -- own file_path is the canonical key derived from the dealer, the invoice
      -- and that row's id. A row pointing anywhere else cannot authorise issuance.
      if not exists (
        select 1
          from public.document_files df
         where df.dealer_id     = new.dealer_id
           and df.document_type = 'invoice'
           and df.document_id   = new.id
           and df.status        = 'active'
           and df.mime_type     = 'application/pdf'
           and df.file_path     = new.pdf_file_path
           and df.file_path     = new.dealer_id::text || '/invoice/issued/' ||
                                  new.id::text || '/' || df.id::text || '.pdf'
      ) then
        raise exception using
          errcode = 'P0001',
          message = 'invoice_issue_requires_canonical_artifact';
      end if;
    end if;

    return new;
  end if;

  -- From here the OLD row was NOT a draft: the document is already committed.

  -- A committed invoice can never be reopened for editing.
  if new.status = 'draft' then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_cannot_return_to_draft';
  end if;

  -- Commercial identity, figures, references, dates, customer-facing notes and
  -- the issued artifact pointer are all frozen. Comparisons use `is distinct
  -- from` so a NULL/value change is caught too. (content_version was already
  -- forced equal to OLD above, so it cannot drift here either.)
  if new.dealer_id            is distinct from old.dealer_id
     or new.customer_id       is distinct from old.customer_id
     or new.vehicle_id        is distinct from old.vehicle_id
     or new.estimate_id       is distinct from old.estimate_id
     or new.work_order_id     is distinct from old.work_order_id
     or new.completion_report_id is distinct from old.completion_report_id
     or new.invoice_number    is distinct from old.invoice_number
     or new.title             is distinct from old.title
     or new.issue_date        is distinct from old.issue_date
     or new.due_date          is distinct from old.due_date
     or new.delivery_date     is distinct from old.delivery_date
     or new.subtotal          is distinct from old.subtotal
     or new.discount_amount   is distinct from old.discount_amount
     or new.tax_rate          is distinct from old.tax_rate
     or new.tax_amount        is distinct from old.tax_amount
     or new.total             is distinct from old.total
     or new.notes             is distinct from old.notes
     or new.pdf_file_path     is distinct from old.pdf_file_path
     or new.pdf_file_url      is distinct from old.pdf_file_url
     or new.created_at        is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_issued_fields_immutable';
  end if;

  -- Soft deletion of a committed invoice is a correction, not an edit.
  if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_issued_cannot_be_deleted';
  end if;

  -- Everything still permitted: paid_amount, balance_due, internal_memo,
  -- updated_at and a lifecycle status among the post-issue set.
  if new.status not in ('issued', 'partially_paid', 'paid', 'overdue', 'cancelled') then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_invalid_lifecycle_transition';
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_issued_immutability on public.invoices;
create trigger invoices_issued_immutability
  before update on public.invoices
  for each row
  execute function public.enforce_invoice_issued_immutability();

revoke all on function public.enforce_invoice_issued_immutability() from public;
revoke all on function public.enforce_invoice_issued_immutability() from anon;
revoke all on function public.enforce_invoice_issued_immutability() from authenticated;

-- ---------------------------------------------------------------------------
-- save_invoice_draft: delivery_date joins both exact key arrays (sorted), the
-- string/null loop, and the draft UPDATE. Everything else is verbatim.
--
-- SECURITY INVOKER on purpose. Ordinary draft editing must stay under the
-- caller's own permissions so the invoices and invoice_items RLS policies still
-- apply — this is not a privileged operation and must never use the service role.
-- The FOR UPDATE lock is the same one the invoice_items triggers take, so a
-- concurrent issuance serialises against it.
-- ---------------------------------------------------------------------------
create or replace function public.save_invoice_draft(
  p_invoice_id uuid,
  p_dealer_id  uuid,
  p_fields     jsonb,
  p_items      jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status             text;
  v_item               jsonb;
  v_finance_authorized boolean;
  v_key                text;
begin
  if p_invoice_id is null or p_dealer_id is null then
    return jsonb_build_object('outcome', 'not-found');
  end if;

  -- B1-R5-3: defence in depth — the same fail-closed finance rule the invoice
  -- RLS policies enforce. dealer_staff is the canonical source: an active owner
  -- or manager row authorizes; a row that exists in ANY other state blocks the
  -- dealer_members fallback outright; the fallback itself must be an active owner
  -- or manager membership. This runs BEFORE the FOR UPDATE lock so an unauthorized
  -- caller never holds a row lock, and the coarse 'not-found' outcome does not
  -- reveal whether the dealer or the invoice exists.
  select
       exists (
         select 1
           from public.dealer_staff ds
          where ds.dealer_id = p_dealer_id
            and ds.user_id   = (select auth.uid())
            and ds.status    = 'active'
            and ds.role      in ('owner', 'manager')
       )
    or (
         not exists (
           select 1
             from public.dealer_staff ds
            where ds.dealer_id = p_dealer_id
              and ds.user_id   = (select auth.uid())
         )
         and exists (
           select 1
             from public.dealer_members dm
            where dm.dealer_id = p_dealer_id
              and dm.user_id   = (select auth.uid())
              and dm.status    = 'active'
              and dm.role      in ('owner', 'manager')
         )
       )
    into v_finance_authorized;

  if not coalesce(v_finance_authorized, false) then
    return jsonb_build_object('outcome', 'not-found');
  end if;

  -- B1-V1-R2: fail-closed input schema. Runs strictly AFTER the finance gate and
  -- strictly BEFORE the FOR UPDATE lock. delivery_date is a nullable-string date
  -- key (like issue_date / due_date): present in BOTH exact key arrays and the
  -- string/null loop. Money ARITHMETIC is deliberately NOT judged here — the
  -- issuance snapshot validator owns it, so one money policy exists.
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;

  if p_items is not null and jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;

  if p_items is null then
    if (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(p_fields) as k)
       <> array['delivery_date', 'due_date', 'internal_memo', 'invoice_number', 'issue_date', 'notes', 'title'] then
      return jsonb_build_object('outcome', 'invalid-input');
    end if;
  else
    if (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(p_fields) as k)
       <> array['balance_due', 'delivery_date', 'discount_amount', 'due_date', 'internal_memo', 'invoice_number',
                'issue_date', 'notes', 'paid_amount', 'subtotal', 'tax_amount', 'tax_rate',
                'title', 'total'] then
      return jsonb_build_object('outcome', 'invalid-input');
    end if;
  end if;

  foreach v_key in array array['invoice_number', 'title', 'issue_date', 'due_date', 'delivery_date', 'notes', 'internal_memo'] loop
    if jsonb_typeof(p_fields->v_key) not in ('string', 'null') then
      return jsonb_build_object('outcome', 'invalid-input');
    end if;
  end loop;

  if p_items is not null then
    foreach v_key in array array['discount_amount', 'tax_rate', 'paid_amount', 'subtotal', 'tax_amount', 'total', 'balance_due'] loop
      if jsonb_typeof(p_fields->v_key) <> 'number' then
        return jsonb_build_object('outcome', 'invalid-input');
      end if;
    end loop;

    for v_item in select * from jsonb_array_elements(p_items) loop
      if jsonb_typeof(v_item) <> 'object' then
        return jsonb_build_object('outcome', 'invalid-input');
      end if;
      if (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(v_item) as k)
         <> array['category', 'description', 'discount_rate', 'item_name', 'line_total',
                  'quantity', 'sort_order', 'unit_price'] then
        return jsonb_build_object('outcome', 'invalid-input');
      end if;
      if jsonb_typeof(v_item->'category') <> 'string'
         or jsonb_typeof(v_item->'item_name') <> 'string'
         or jsonb_typeof(v_item->'description') not in ('string', 'null')
         or jsonb_typeof(v_item->'quantity') <> 'number'
         or jsonb_typeof(v_item->'unit_price') <> 'number'
         or jsonb_typeof(v_item->'discount_rate') <> 'number'
         or jsonb_typeof(v_item->'line_total') <> 'number'
         or jsonb_typeof(v_item->'sort_order') <> 'number' then
        return jsonb_build_object('outcome', 'invalid-input');
      end if;
    end loop;
  end if;

  -- Lock first, then read: the status we validate is the status we act on.
  -- RLS still applies, so a foreign dealer's row is invisible here and the
  -- explicit dealer predicate is defence in depth.
  select i.status into v_status
    from public.invoices i
   where i.id = p_invoice_id
     and i.dealer_id = p_dealer_id
     for update;

  if not found then
    return jsonb_build_object('outcome', 'not-found');
  end if;

  if v_status <> 'draft' then
    return jsonb_build_object('outcome', 'not-draft');
  end if;

  update public.invoices i
     set invoice_number  = nullif(p_fields->>'invoice_number', ''),
         title           = nullif(p_fields->>'title', ''),
         issue_date      = nullif(p_fields->>'issue_date', '')::date,
         due_date        = nullif(p_fields->>'due_date', '')::date,
         delivery_date   = nullif(p_fields->>'delivery_date', '')::date,
         discount_amount = coalesce((p_fields->>'discount_amount')::numeric, i.discount_amount),
         tax_rate        = coalesce((p_fields->>'tax_rate')::numeric, i.tax_rate),
         paid_amount     = coalesce((p_fields->>'paid_amount')::numeric, i.paid_amount),
         subtotal        = coalesce((p_fields->>'subtotal')::numeric, i.subtotal),
         tax_amount      = coalesce((p_fields->>'tax_amount')::numeric, i.tax_amount),
         total           = coalesce((p_fields->>'total')::numeric, i.total),
         balance_due     = coalesce((p_fields->>'balance_due')::numeric, i.balance_due),
         notes           = nullif(p_fields->>'notes', ''),
         internal_memo   = nullif(p_fields->>'internal_memo', ''),
         updated_at      = now()
   where i.id = p_invoice_id
     and i.dealer_id = p_dealer_id
     and i.status = 'draft';

  if not found then
    return jsonb_build_object('outcome', 'not-draft');
  end if;

  -- Line items are replaced only when the caller actually sent a set. A null
  -- payload means "leave the lines alone".
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    delete from public.invoice_items ii
     where ii.invoice_id = p_invoice_id
       and ii.dealer_id  = p_dealer_id;

    for v_item in select * from jsonb_array_elements(p_items) loop
      insert into public.invoice_items
        (invoice_id, dealer_id, category, item_name, description,
         quantity, unit_price, discount_rate, line_total, sort_order)
      values
        (p_invoice_id,
         p_dealer_id,
         coalesce(v_item->>'category', 'other'),
         coalesce(v_item->>'item_name', ''),
         nullif(v_item->>'description', ''),
         coalesce((v_item->>'quantity')::numeric, 1),
         coalesce((v_item->>'unit_price')::numeric, 0),
         coalesce((v_item->>'discount_rate')::numeric, 0),
         coalesce((v_item->>'line_total')::numeric, 0),
         coalesce((v_item->>'sort_order')::integer, 0));
    end loop;
  end if;

  return jsonb_build_object('outcome', 'saved');
end;
$$;

revoke all on function public.save_invoice_draft(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.save_invoice_draft(uuid, uuid, jsonb, jsonb) from anon;
grant execute on function public.save_invoice_draft(uuid, uuid, jsonb, jsonb) to authenticated;
