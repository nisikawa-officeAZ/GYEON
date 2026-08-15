-- DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1B-E2-M1 — monthly-invoice artifact security.
--
-- Implements ONLY the accepted E1-R2 database/Storage security contract for the persisted
-- immutable monthly-invoice PDF artifact. No renderer, server action, route, or UI here.
--
--   * monthly_statements gains a pointer pair (pdf_document_file_id + pdf_generated_at) with a
--     dedicated pointer trigger: born null, exactly one privileged null->valid transition for an
--     ISSUED statement, timestamp DERIVED in-database, frozen afterward (incl. issued->voided).
--     The accepted financial issued-immutability function/trigger is NOT touched.
--   * document_files gains the single-active-artifact partial unique index for monthly_invoice
--     plus a SECURITY INVOKER guard trigger protecting BOTH invoice and monthly_invoice ISSUED
--     artifact rows: non-privileged writes rejected outright; privileged callers cannot repoint,
--     rename, retype, re-tenant, or archive a REFERENCED row; compensation DELETE is allowed only
--     while no invoice or monthly-statement pointer references the row.
--   * storage.objects gains exactly TWO authenticated AS RESTRICTIVE policies (INSERT: WITH CHECK
--     only; UPDATE: USING + WITH CHECK) that AND against the live permissive member policies and
--     close the documents/<dealer>/invoice/issued and documents/<dealer>/monthly_invoice/issued
--     namespaces to authenticated writes. SELECT policies are untouched. No storage DML occurs.
--   * attach_monthly_statement_pdf_rpc: SECURITY INVOKER, empty search_path, EXECUTE service_role
--     only; fixed lock order (statement then document row), canonical validation, null->pointer
--     CAS with same-pointer idempotency and different-pointer conflict.

-- ── A. pointer pair on monthly_statements ───────────────────────────────────────────────────────
alter table public.monthly_statements
  add column if not exists pdf_document_file_id uuid
    references public.document_files(id) on delete restrict;
alter table public.monthly_statements
  add column if not exists pdf_generated_at timestamptz;

alter table public.monthly_statements
  add constraint monthly_statements_pdf_pointer_pair
  check ((pdf_document_file_id is null) = (pdf_generated_at is null));

create index if not exists idx_monthly_statements_pdf_document_file
  on public.monthly_statements (pdf_document_file_id);

-- ── B. dedicated pointer trigger (INSERT and UPDATE; never touches the financial trigger) ───────
create or replace function public.enforce_monthly_statement_pdf_pointer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_df record;
begin
  if tg_op = 'INSERT' then
    -- A statement is always born without an artifact pointer.
    if new.pdf_document_file_id is not null or new.pdf_generated_at is not null then
      raise exception using errcode = 'P0001', message = 'monthly_pdf_pointer_forbidden_on_insert';
    end if;
    return new;
  end if;

  -- UPDATE: the pointer pair may change ONLY as the single privileged null->valid transition.
  if old.pdf_document_file_id is null and new.pdf_document_file_id is not null then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception using errcode = 'P0001', message = 'monthly_pdf_pointer_requires_privileged_path';
    end if;
    if old.status <> 'issued' or new.status <> 'issued' then
      raise exception using errcode = 'P0001', message = 'monthly_pdf_pointer_requires_issued';
    end if;
    select id, dealer_id, document_type, document_id, status, mime_type, file_path
      into v_df
      from public.document_files
     where id = new.pdf_document_file_id;
    if v_df.id is null
       or v_df.dealer_id      is distinct from new.dealer_id
       or v_df.document_type  is distinct from 'monthly_invoice'
       or v_df.document_id    is distinct from new.id
       or v_df.status         is distinct from 'active'
       or v_df.mime_type      is distinct from 'application/pdf'
       or v_df.file_path      is distinct from
          new.dealer_id::text || '/monthly_invoice/issued/' || new.id::text || '/' || v_df.id::text || '.pdf' then
      raise exception using errcode = 'P0001', message = 'monthly_pdf_document_not_canonical';
    end if;
    -- The generation timestamp is DERIVED inside the database boundary, never caller-supplied.
    new.pdf_generated_at := now();
    return new;
  end if;

  -- Every other pointer-pair mutation is frozen: change, clear, or timestamp drift. The pair
  -- carries through issued->voided untouched because an unchanged pair passes here.
  if new.pdf_document_file_id is distinct from old.pdf_document_file_id
     or new.pdf_generated_at is distinct from old.pdf_generated_at then
    raise exception using errcode = 'P0001', message = 'monthly_pdf_pointer_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_monthly_statement_pdf_pointer on public.monthly_statements;
create trigger trg_monthly_statement_pdf_pointer
  before insert or update on public.monthly_statements
  for each row execute function public.enforce_monthly_statement_pdf_pointer();

revoke all on function public.enforce_monthly_statement_pdf_pointer() from public, anon, authenticated;

-- ── C. single ACTIVE monthly artifact per (dealer, statement) ───────────────────────────────────
create unique index if not exists document_files_monthly_invoice_active_uidx
  on public.document_files (dealer_id, document_id)
  where document_type = 'monthly_invoice' and status = 'active';

-- ── D. protected-artifact guard on document_files (invoice AND monthly_invoice issued rows) ─────
create or replace function public.enforce_protected_artifact_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_protected boolean := false;
  v_new_protected boolean := false;
  v_row_id        uuid;
  v_row_path      text;
  v_referenced    boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_protected := old.document_type in ('invoice', 'monthly_invoice')
      and old.file_path ~ '^[^/]+/(invoice|monthly_invoice)/issued/';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_protected := new.document_type in ('invoice', 'monthly_invoice')
      and new.file_path ~ '^[^/]+/(invoice|monthly_invoice)/issued/';
  end if;
  if not v_old_protected and not v_new_protected then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- Non-privileged roles may never insert, repoint, rename, overwrite, archive, or delete a
  -- protected artifact row (closes the live document_files_dealer_update surface fail-closed).
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception using errcode = 'P0001', message = 'protected_artifact_row_requires_privileged_path';
  end if;

  -- Referenced = pointed at by a monthly statement (by id) or an invoice (by file_path).
  if tg_op = 'DELETE' then v_row_id := old.id; v_row_path := old.file_path;
  else v_row_id := old.id; v_row_path := old.file_path; end if;

  if tg_op in ('UPDATE', 'DELETE') and v_old_protected then
    v_referenced :=
      exists (select 1 from public.monthly_statements ms where ms.pdf_document_file_id = v_row_id)
      or exists (select 1 from public.invoices i where i.pdf_file_path = v_row_path);

    if tg_op = 'DELETE' then
      -- Compensation deletion is allowed ONLY while nothing references the row.
      if v_referenced then
        raise exception using errcode = 'P0001', message = 'protected_artifact_row_referenced';
      end if;
      return old;
    end if;

    -- Privileged UPDATE: a REFERENCED artifact row may never be repointed, renamed, retyped,
    -- re-tenanted, re-mimed, or archived. (Unreferenced rows stay privileged-adjustable so an
    -- interrupted attachment can be compensated.)
    if v_referenced and (
         new.file_path     is distinct from old.file_path
      or new.document_type is distinct from old.document_type
      or new.document_id   is distinct from old.document_id
      or new.dealer_id     is distinct from old.dealer_id
      or new.mime_type     is distinct from old.mime_type
      or new.status        is distinct from old.status) then
      raise exception using errcode = 'P0001', message = 'protected_artifact_row_immutable_while_referenced';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_protected_artifact_rows on public.document_files;
create trigger trg_protected_artifact_rows
  before insert or update or delete on public.document_files
  for each row execute function public.enforce_protected_artifact_rows();

revoke all on function public.enforce_protected_artifact_rows() from public, anon, authenticated;

-- ── E. storage.objects: two command-specific AS RESTRICTIVE policies (no storage DML) ───────────
-- They AND against the live permissive documents_member_insert / documents_member_update, so
-- authenticated writes keep working everywhere EXCEPT inside the two issued-artifact namespaces.
-- SELECT policies are deliberately untouched; service_role bypasses RLS for artifact creation.
drop policy if exists "documents_protected_artifacts_insert" on storage.objects;
create policy "documents_protected_artifacts_insert"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    bucket_id <> 'documents'
    or name !~ '^[^/]+/(invoice|monthly_invoice)/issued/'
  );

drop policy if exists "documents_protected_artifacts_update" on storage.objects;
create policy "documents_protected_artifacts_update"
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (
    bucket_id <> 'documents'
    or name !~ '^[^/]+/(invoice|monthly_invoice)/issued/'
  )
  with check (
    bucket_id <> 'documents'
    or name !~ '^[^/]+/(invoice|monthly_invoice)/issued/'
  );

-- ── F. the service-role-only pointer-attach CAS boundary ────────────────────────────────────────
create or replace function public.attach_monthly_statement_pdf_rpc(
  p_dealer_id        uuid,
  p_statement_id     uuid,
  p_document_file_id uuid
)
returns public.monthly_statements
language plpgsql
set search_path = ''
as $$
declare
  v_stmt public.monthly_statements;
  v_df   record;
begin
  if p_dealer_id is null or p_statement_id is null or p_document_file_id is null then
    raise exception using errcode = 'P0001', message = 'monthly_pdf_attach_invalid_input';
  end if;

  -- Fixed lock order: dealer-scoped statement row first, then the document row.
  select * into v_stmt from public.monthly_statements
   where id = p_statement_id and dealer_id = p_dealer_id
   for update;
  if v_stmt.id is null then
    raise exception using errcode = 'P0001', message = 'monthly_pdf_statement_not_found';
  end if;
  if v_stmt.status <> 'issued' then
    raise exception using errcode = 'P0001', message = 'monthly_pdf_statement_not_issued';
  end if;

  -- A pointer that exists and DIFFERS is a hard conflict; a null or matching pointer
  -- continues into full document validation before anything is returned.
  if v_stmt.pdf_document_file_id is not null
     and v_stmt.pdf_document_file_id is distinct from p_document_file_id then
    raise exception using errcode = 'P0001', message = 'monthly_pdf_pointer_conflict';
  end if;

  select id, dealer_id, document_type, document_id, status, mime_type, file_path
    into v_df
    from public.document_files
   where id = p_document_file_id
   for update;
  if v_df.id is null then
    raise exception using errcode = 'P0001', message = 'monthly_pdf_document_not_found';
  end if;
  if v_df.dealer_id      is distinct from p_dealer_id
     or v_df.document_type is distinct from 'monthly_invoice'
     or v_df.document_id   is distinct from p_statement_id
     or v_df.status        is distinct from 'active'
     or v_df.mime_type     is distinct from 'application/pdf'
     or v_df.file_path     is distinct from
        p_dealer_id::text || '/monthly_invoice/issued/' || p_statement_id::text || '/' || v_df.id::text || '.pdf' then
    raise exception using errcode = 'P0001', message = 'monthly_pdf_document_not_canonical';
  end if;

  -- Idempotent return ONLY after the referenced document row has fully revalidated.
  if v_stmt.pdf_document_file_id = p_document_file_id then
    return v_stmt;
  end if;

  -- The pointer trigger revalidates the transition and DERIVES pdf_generated_at in-database.
  update public.monthly_statements
     set pdf_document_file_id = p_document_file_id,
         updated_at = now()
   where id = v_stmt.id
   returning * into v_stmt;

  return v_stmt;
end;
$$;

revoke all     on function public.attach_monthly_statement_pdf_rpc(uuid, uuid, uuid) from public;
revoke execute on function public.attach_monthly_statement_pdf_rpc(uuid, uuid, uuid) from anon;
revoke execute on function public.attach_monthly_statement_pdf_rpc(uuid, uuid, uuid) from authenticated;
grant  execute on function public.attach_monthly_statement_pdf_rpc(uuid, uuid, uuid) to service_role;
