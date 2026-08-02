-- DEALEROS-ESTIMATE-INVOICE-PDF-B1 — issued-invoice immutability boundary.
--
-- Contract
-- --------
-- A draft invoice is fully editable. The moment it leaves draft it becomes a
-- commercial document: its figures, references, dates, customer-facing notes and
-- the issued PDF pointer are frozen. Only money movement (paid_amount,
-- balance_due) and lifecycle status may still change, and a non-draft invoice can
-- never return to draft. Corrections happen by cancelling and issuing a NEW
-- invoice with a new number — never by editing or overwriting the issued one.
--
-- This is enforced in the database, not only in the application, so a direct Data
-- API call or a future code path cannot bypass it.
--
-- No SECURITY DEFINER anywhere. Trigger functions run as the caller (INVOKER) and
-- pin an empty search_path with fully-qualified identifiers, matching the hardened
-- pattern used elsewhere in this repository. Nothing here touches storage.buckets.

-- ---------------------------------------------------------------------------
-- Content snapshot marker
--
-- Issuance renders a PDF from the draft, then flips the row. Between those two
-- steps the draft could change, so the issued row would no longer describe the
-- bytes the customer receives. `content_version` advances whenever anything the
-- PDF renders changes, and issuance carries the captured value in its transition
-- predicate — a draft that moved on simply loses.
--
-- B1-R3-1: the marker is DATABASE-OWNED. The invoices BEFORE UPDATE trigger
-- always derives it from OLD plus detected changes, so a value submitted by a
-- caller is ignored: it can never be raised, lowered, reset, or held still to
-- sneak past an in-flight issuance.
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists content_version bigint not null default 1;

-- ---------------------------------------------------------------------------
-- invoices: freeze commercial data once the row has left draft, and own the
-- content marker outright
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

-- ---------------------------------------------------------------------------
-- invoices: an INSERT may only create a draft
--
-- The UPDATE guard alone left a hole: a direct authenticated INSERT could create
-- an already-`issued` invoice, with or without a PDF pointer, and never pass
-- through issuance at all.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_invoice_insert_is_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from 'draft' then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_insert_must_be_draft';
  end if;

  if (new.pdf_file_path is not null and btrim(new.pdf_file_path) <> '')
     or (new.pdf_file_url is not null and btrim(new.pdf_file_url) <> '') then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_insert_cannot_set_pdf_pointer';
  end if;

  -- A new invoice always starts at the beginning of its own history.
  new.content_version := 1;

  return new;
end;
$$;

drop trigger if exists invoices_insert_is_draft on public.invoices;
create trigger invoices_insert_is_draft
  before insert on public.invoices
  for each row
  execute function public.enforce_invoice_insert_is_draft();

-- ---------------------------------------------------------------------------
-- invoices: a hard DELETE is a draft-only rollback
--
-- The FOR ALL policy on invoices still lets an authenticated dealer member issue
-- a hard DELETE, which would erase a commercial record outright. Deletion stays
-- available for drafts because createInvoice rolls back that way on failure.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_invoice_delete_is_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is distinct from 'draft' then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_issued_cannot_be_hard_deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists invoices_delete_is_draft on public.invoices;
create trigger invoices_delete_is_draft
  before delete on public.invoices
  for each row
  execute function public.enforce_invoice_delete_is_draft();

-- ---------------------------------------------------------------------------
-- invoice_items: lock the parent(s), then enforce draft-only mutation
--
-- B1-R3-3: the parent invoice is locked FOR UPDATE before the item row changes.
-- Without that lock, issuance could read `status='draft'`, freeze the invoice and
-- commit in the window between this BEFORE trigger and the AFTER bump — leaving
-- an issued invoice whose lines changed after its PDF was rendered. Taking a
-- conflicting row lock here forces the two transactions to serialise.
--
-- Reparenting locks BOTH parents in ascending UUID order so two opposite-direction
-- moves can never deadlock each other.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_invoice_items_issued_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_id     uuid;
  v_new_id     uuid;
  v_first      uuid;
  v_second     uuid;
  v_old_status text;
  v_new_status text;
  v_old_dealer uuid;
  v_new_dealer uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old_id := old.invoice_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new_id := new.invoice_id; end if;

  -- Deterministic lock order: smaller UUID first when two distinct parents are
  -- involved, so concurrent opposite-direction reparenting cannot deadlock.
  if v_old_id is not null and v_new_id is not null and v_old_id <> v_new_id then
    if v_old_id < v_new_id then
      v_first := v_old_id; v_second := v_new_id;
    else
      v_first := v_new_id; v_second := v_old_id;
    end if;
  else
    v_first := coalesce(v_old_id, v_new_id);
    v_second := null;
  end if;

  -- Acquire the locks, then re-read state from the LOCKED rows.
  perform 1 from public.invoices i where i.id = v_first for update;
  if v_second is not null then
    perform 1 from public.invoices i where i.id = v_second for update;
  end if;

  if v_old_id is not null then
    select i.status, i.dealer_id into v_old_status, v_old_dealer
      from public.invoices i where i.id = v_old_id;
  end if;
  if v_new_id is not null then
    select i.status, i.dealer_id into v_new_status, v_new_dealer
      from public.invoices i where i.id = v_new_id;
  end if;

  if tg_op = 'DELETE' then
    -- The parent-gone case is the proven ON DELETE CASCADE path: invoices are
    -- deleted first, and that deletion is itself draft-only.
    if v_old_status is null then
      return old;
    end if;
    if v_old_status <> 'draft' then
      raise exception using
        errcode = 'P0001',
        message = 'invoice_items_immutable_after_issue';
    end if;
    if old.dealer_id is distinct from v_old_dealer then
      raise exception using
        errcode = 'P0001',
        message = 'invoice_items_dealer_mismatch';
    end if;
    return old;
  end if;

  -- INSERT and UPDATE both require a live, draft destination parent.
  if v_new_status is null then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_items_parent_missing';
  end if;
  if v_new_status <> 'draft' then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_items_immutable_after_issue';
  end if;

  -- An UPDATE must also leave a draft behind: a row may never depart an issued
  -- invoice, even into a draft one.
  if tg_op = 'UPDATE' then
    if v_old_status is null then
      raise exception using
        errcode = 'P0001',
        message = 'invoice_items_parent_missing';
    end if;
    if v_old_status <> 'draft' then
      raise exception using
        errcode = 'P0001',
        message = 'invoice_items_immutable_after_issue';
    end if;
    if old.dealer_id is distinct from v_old_dealer then
      raise exception using
        errcode = 'P0001',
        message = 'invoice_items_dealer_mismatch';
    end if;
  end if;

  -- The item's dealer must be its parent's dealer, so a line cannot be smuggled
  -- across tenants.
  if new.dealer_id is distinct from v_new_dealer then
    raise exception using
      errcode = 'P0001',
      message = 'invoice_items_dealer_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists invoice_items_issued_immutability on public.invoice_items;
create trigger invoice_items_issued_immutability
  before insert or update or delete on public.invoice_items
  for each row
  execute function public.enforce_invoice_items_issued_immutability();

-- ---------------------------------------------------------------------------
-- invoice_items: advance the parent snapshot marker(s)
--
-- B1-R3-4: reparenting touches TWO invoices, so both markers advance. An
-- unchanged parent advances exactly once. This runs in the same transaction as
-- the BEFORE trigger above, while its FOR UPDATE locks are still held.
--
-- B1-R3-5: the increment announces itself with a transaction-local setting that
-- PostgREST never populates from client input, so the invoices trigger can
-- distinguish it from a caller-supplied value without creating an exception an
-- authenticated caller could imitate.
-- ---------------------------------------------------------------------------
create or replace function public.bump_invoice_content_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_id uuid;
  v_new_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old_id := old.invoice_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new_id := new.invoice_id; end if;

  if v_new_id is not null then
    perform set_config('dealeros.invoice_item_bump', v_new_id::text, true);
    update public.invoices i
       set content_version = i.content_version + 1,
           updated_at      = now()
     where i.id = v_new_id
       and i.status = 'draft';
  end if;

  if v_old_id is not null and v_old_id is distinct from v_new_id then
    perform set_config('dealeros.invoice_item_bump', v_old_id::text, true);
    update public.invoices i
       set content_version = i.content_version + 1,
           updated_at      = now()
     where i.id = v_old_id
       and i.status = 'draft';
  end if;

  perform set_config('dealeros.invoice_item_bump', '', true);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_items_bump_content_version on public.invoice_items;
create trigger invoice_items_bump_content_version
  after insert or update or delete on public.invoice_items
  for each row
  execute function public.bump_invoice_content_version();

-- ---------------------------------------------------------------------------
-- save_invoice_draft — one transaction for a whole draft edit (R4-1)
--
-- The application used to send a parent UPDATE, then a DELETE of every line, then
-- an INSERT of the new lines — three separate Data API requests, each its own
-- transaction. Between them the invoice was briefly committed in a torn state
-- (new totals with old lines, or no lines at all), and an issuance running
-- concurrently could render and permanently publish that intermediate state.
--
-- Doing the whole edit inside one function makes it a single transaction: it
-- either all lands or none of it does.
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
  -- RLS policies enforce (see the B1-R5-2 section below). dealer_staff is the
  -- canonical source: an active owner or manager row authorizes; a row that
  -- exists in ANY other state blocks the dealer_members fallback outright; the
  -- fallback itself must be an active owner or manager membership. This runs
  -- BEFORE the FOR UPDATE lock so an unauthorized caller never holds a row
  -- lock, and the coarse 'not-found' outcome does not reveal whether the
  -- dealer or the invoice exists. SECURITY INVOKER is unchanged, so these
  -- subqueries are evaluated as the caller under dealer_staff/dealer_members
  -- RLS (dm_self_select guarantees the caller sees their own membership row).
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

  -- B1-V1-R2: fail-closed input schema. Runs strictly AFTER the finance gate —
  -- an unauthorized caller has already received the coarse 'not-found', so
  -- malformed input can never become a validation oracle — and strictly BEFORE
  -- the FOR UPDATE lock, so garbage input never holds a lock and never writes.
  --
  -- The schema mirrors validateDraftSaveFields/validateDraftSaveItems in
  -- invoice-issuance-core.ts (the boundary test pins the key sets together):
  --   p_fields must be a JSON object with an EXACT key set — six nullable-string
  --   text/date keys always; the seven money keys are REQUIRED as JSON numbers
  --   when p_items is an array and FORBIDDEN when p_items is SQL NULL, so stored
  --   totals can only ever change together with an item payload.
  --   p_items must be SQL NULL (preserve lines) or a JSON array whose every
  --   element is an object with exactly the eight line keys and per-key JSON
  --   types. A JSON null literal or any other type is rejected.
  -- JSON numbers cannot encode NaN or Infinity, and requiring the number type
  -- also refuses string numerics — including 'NaN', which ::numeric would
  -- otherwise accept. Money ARITHMETIC is deliberately NOT judged here: the
  -- issuance snapshot validator owns it, so one money policy exists.
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;

  if p_items is not null and jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;

  if p_items is null then
    if (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(p_fields) as k)
       <> array['due_date', 'internal_memo', 'invoice_number', 'issue_date', 'notes', 'title'] then
      return jsonb_build_object('outcome', 'invalid-input');
    end if;
  else
    if (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(p_fields) as k)
       <> array['balance_due', 'discount_amount', 'due_date', 'internal_memo', 'invoice_number',
                'issue_date', 'notes', 'paid_amount', 'subtotal', 'tax_amount', 'tax_rate',
                'title', 'total'] then
      return jsonb_build_object('outcome', 'invalid-input');
    end if;
  end if;

  foreach v_key in array array['invoice_number', 'title', 'issue_date', 'due_date', 'notes', 'internal_memo'] loop
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

-- ---------------------------------------------------------------------------
-- Trigger helpers are invoked by the trigger machinery, never called directly.
-- ---------------------------------------------------------------------------
revoke all on function public.enforce_invoice_issued_immutability() from public;
revoke all on function public.enforce_invoice_issued_immutability() from anon;
revoke all on function public.enforce_invoice_issued_immutability() from authenticated;

revoke all on function public.enforce_invoice_items_issued_immutability() from public;
revoke all on function public.enforce_invoice_items_issued_immutability() from anon;
revoke all on function public.enforce_invoice_items_issued_immutability() from authenticated;

revoke all on function public.enforce_invoice_insert_is_draft() from public;
revoke all on function public.enforce_invoice_insert_is_draft() from anon;
revoke all on function public.enforce_invoice_insert_is_draft() from authenticated;

revoke all on function public.enforce_invoice_delete_is_draft() from public;
revoke all on function public.enforce_invoice_delete_is_draft() from anon;
revoke all on function public.enforce_invoice_delete_is_draft() from authenticated;

revoke all on function public.bump_invoice_content_version() from public;
revoke all on function public.bump_invoice_content_version() from anon;
revoke all on function public.bump_invoice_content_version() from authenticated;

-- ---------------------------------------------------------------------------
-- B1-R5-2: command-specific invoice RLS
--
-- The legacy FOR ALL policies accepted ANY dealer_members row — no status
-- check, no role distinction — so a suspended, removed, staff or readonly
-- account kept a direct Data API write path to invoices and invoice_items.
--
-- They are replaced by per-command policies with two rules:
--
--   READ  (SELECT)                : an ACTIVE staff identity of the same
--                                   dealer, any recognized role.
--   WRITE (INSERT/UPDATE/DELETE)  : the ACTIVE canonical finance role only —
--                                   owner or manager.
--
-- dealer_staff is the PRIMARY source. The dealer_members branch applies ONLY
-- when no dealer_staff row exists at all for the user in that dealer: a row
-- that exists in any non-active status (invited, disabled) blocks the
-- fallback instead of dropping into it. auth.uid() is wrapped in a scalar
-- subselect so it is evaluated once per statement, and every policy names
-- `to authenticated` explicitly — service_role bypasses RLS, anon gets
-- nothing. No SECURITY DEFINER helper is involved; the subqueries run as the
-- caller. Under caller RLS, dealer_staff rows are visible to any active
-- member of the dealer (dealer_staff_select) and a user always sees their own
-- dealer_members row (dm_self_select), so every visibility combination that
-- could hide a dealer_staff row also lacks the active membership the fallback
-- branch demands — each such case denies.
-- ---------------------------------------------------------------------------

drop policy if exists "Dealer members can manage their invoices" on public.invoices;
drop policy if exists "Dealer members can manage their invoice items" on public.invoice_items;

-- ── invoices ────────────────────────────────────────────────────────────────

create policy invoices_select_active_staff on public.invoices
  for select to authenticated
  using (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoices.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager', 'staff', 'readonly')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoices.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoices.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager', 'staff', 'readonly')
      )
    )
  );

create policy invoices_insert_finance on public.invoices
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoices.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoices.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoices.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  );

create policy invoices_update_finance on public.invoices
  for update to authenticated
  using (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoices.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoices.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoices.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  )
  with check (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoices.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoices.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoices.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  );

create policy invoices_delete_finance on public.invoices
  for delete to authenticated
  using (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoices.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoices.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoices.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  );

-- ── invoice_items ───────────────────────────────────────────────────────────
-- The item's own dealer_id is the tenant key; the items trigger already proves
-- it equals the parent invoice's dealer_id (invoice_items_dealer_mismatch).

create policy invoice_items_select_active_staff on public.invoice_items
  for select to authenticated
  using (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoice_items.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager', 'staff', 'readonly')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoice_items.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoice_items.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager', 'staff', 'readonly')
      )
    )
  );

create policy invoice_items_insert_finance on public.invoice_items
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoice_items.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoice_items.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoice_items.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  );

create policy invoice_items_update_finance on public.invoice_items
  for update to authenticated
  using (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoice_items.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoice_items.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoice_items.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  )
  with check (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoice_items.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoice_items.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoice_items.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  );

create policy invoice_items_delete_finance on public.invoice_items
  for delete to authenticated
  using (
    exists (
      select 1
        from public.dealer_staff ds
       where ds.dealer_id = invoice_items.dealer_id
         and ds.user_id   = (select auth.uid())
         and ds.status    = 'active'
         and ds.role      in ('owner', 'manager')
    )
    or (
      not exists (
        select 1
          from public.dealer_staff ds
         where ds.dealer_id = invoice_items.dealer_id
           and ds.user_id   = (select auth.uid())
      )
      and exists (
        select 1
          from public.dealer_members dm
         where dm.dealer_id = invoice_items.dealer_id
           and dm.user_id   = (select auth.uid())
           and dm.status    = 'active'
           and dm.role      in ('owner', 'manager')
      )
    )
  );
