-- 20260731115631_gyeon_dealer_provisioning.sql
-- GYEON-PARTNER-ONBOARD-F1 — operator-controlled dealer provisioning.
--
-- WHAT: the provisioning ledger for GYEON partner shops plus the three atomic
-- server-side transactions of the onboarding contract:
--   * claim_gyeon_provisioning       — verified-login activation (both arms)
--   * complete_gyeon_shop_profile    — invited-owner profile completion
--   * import_gyeon_provisioning      — all-or-nothing CSV import + audit
--
-- SECURITY MODEL (locked by the phase contract):
--   * RLS enabled with ZERO anon/authenticated policies — the table is
--     reachable ONLY through the service-role server layer, which is itself
--     gated by requireSuperAdmin and the server-only feature gate
--     (GYEON_PARTNER_ONBOARDING_ENABLED). NEXT_PUBLIC variables, market
--     profiles, and brand values never authorize anything here.
--   * All table privileges revoked from PUBLIC, anon, authenticated.
--   * All three functions are SECURITY INVOKER, schema-qualified, and
--     executable by service_role only (EXECUTE revoked from PUBLIC/anon/
--     authenticated).
--   * Two independent state machines:
--       provisioning_status: registered -> claimed | revoked   (eligibility)
--       invitation_state:    none | pending | sent | failed | awaiting_claim
--                                                              (delivery telemetry)
--     invitation_state NEVER appears in the claim predicate.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gyeon_dealer_provisioning (
  id                   uuid        primary key default gen_random_uuid(),

  -- Operator-controlled identity (the ONLY authorization inputs)
  email_normalized     text        not null,
  shop_name            text        not null,
  detailer_rank        text        not null,
  dealer_code          text,

  -- Eligibility state machine (owns claimability)
  provisioning_status  text        not null default 'registered',

  -- Invitation delivery state machine (operational telemetry only)
  invitation_state     text        not null default 'none',
  invited_auth_user_id uuid,
  invite_sent_at       timestamptz,
  invite_last_error    text,

  -- Accountability
  created_by_admin_id  uuid        not null references public.admin_users(id),
  revoked_by_admin_id  uuid        references public.admin_users(id),
  revoked_at           timestamptz,

  -- Claim outcome
  claimed_by_user_id   uuid,
  claimed_dealer_id    uuid        references public.dealers(id) on delete set null,
  claimed_at           timestamptz,

  import_batch_id      uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint gyeon_dealer_provisioning_email_unique
    unique (email_normalized),
  constraint gyeon_dealer_provisioning_dealer_code_unique
    unique (dealer_code),
  constraint gyeon_dealer_provisioning_email_not_blank
    check (btrim(email_normalized) <> ''),
  constraint gyeon_dealer_provisioning_shop_name_not_blank
    check (btrim(shop_name) <> ''),
  constraint gyeon_dealer_provisioning_status_check
    check (provisioning_status in ('registered', 'claimed', 'revoked')),
  constraint gyeon_dealer_provisioning_invitation_check
    check (invitation_state in ('none', 'pending', 'sent', 'failed', 'awaiting_claim')),
  constraint gyeon_dealer_provisioning_rank_check
    check (detailer_rank in ('shop', 'detailer', 'ppf_installer', 'certified'))
);

create index if not exists gyeon_dealer_provisioning_status_idx
  on public.gyeon_dealer_provisioning (provisioning_status);
create index if not exists gyeon_dealer_provisioning_invitation_idx
  on public.gyeon_dealer_provisioning (invitation_state);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS + least privilege — service-role-only surface
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.gyeon_dealer_provisioning enable row level security;
-- ZERO policies on purpose: no anon/authenticated path exists at all.

revoke all privileges on table public.gyeon_dealer_provisioning
  from public, anon, authenticated;
grant select, insert, update, delete on table public.gyeon_dealer_provisioning
  to service_role;

-- F4: the two SECURITY INVOKER identity-revalidation checks below execute as
-- service_role, which has NO default privilege on auth.users (proven in the
-- disposable-stack verification). Grant the MINIMUM column set they read:
--   * claim_gyeon_provisioning      needs id, email, email_confirmed_at
--   * complete_gyeon_shop_profile   needs id, email_confirmed_at
-- Column-level SELECT only — never a table-wide grant, never any other
-- privilege, and never anything for public/anon/authenticated.
grant select (id, email, email_confirmed_at) on table auth.users to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Claim — one idempotent winner-gated transaction, both arms
-- ─────────────────────────────────────────────────────────────────────────────
-- Arm A: the email matches a self-applied PENDING dealer  -> approve it.
-- Arm B: no dealer exists for the email                   -> create it approved.
-- Both arms: owner membership is created as 'invited' (NEVER 'active');
-- activation happens only in complete_gyeon_shop_profile.
-- approved_by is the REAL superAdmin captured on the provisioning record.
-- The winner-gate UPDATE runs FIRST: no dealer or membership row can persist
-- unless this transaction owns the provisioning row.

create or replace function public.claim_gyeon_provisioning(
  p_user_id uuid,
  p_email   text
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_email     text;
  v_rec       public.gyeon_dealer_provisioning%rowtype;
  v_status    text;
  v_dealer_id uuid;
  v_arm       text;
begin
  v_email := lower(btrim(coalesce(p_email, '')));
  if p_user_id is null or v_email = '' then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;

  -- F2-01: database-side identity revalidation. The caller-supplied pair must
  -- match a real, email-confirmed auth.users row BEFORE any provisioning,
  -- dealer, membership, or audit mutation. A mismatched or unconfirmed
  -- identity fails closed with zero writes.
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and lower(btrim(coalesce(u.email, ''))) = v_email
      and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('outcome', 'identity-mismatch');
  end if;

  -- Fail closed: a user already attached to any dealer never claims a second one.
  if exists (
    select 1 from public.dealer_members dm
    where dm.user_id = p_user_id and dm.status in ('active', 'invited')
  ) then
    return jsonb_build_object('outcome', 'already-member');
  end if;

  -- Winner gate — eligibility is provisioning_status + claimed_at ONLY.
  -- invitation_state is deliberately absent from this predicate.
  update public.gyeon_dealer_provisioning g
     set provisioning_status = 'claimed',
         claimed_at          = now(),
         claimed_by_user_id  = p_user_id,
         updated_at          = now()
   where g.email_normalized    = v_email
     and g.provisioning_status = 'registered'
     and g.claimed_at is null
  returning * into v_rec;

  if not found then
    select g.provisioning_status into v_status
      from public.gyeon_dealer_provisioning g
     where g.email_normalized = v_email;
    if not found then
      return jsonb_build_object('outcome', 'no-match');
    elsif v_status = 'claimed' then
      return jsonb_build_object('outcome', 'already-claimed');
    elsif v_status = 'revoked' then
      return jsonb_build_object('outcome', 'revoked');
    end if;
    return jsonb_build_object('outcome', 'no-match');
  end if;

  -- Arm A: approve the caller's OWN self-applied pending dealer.
  -- F2-02: ownership is required — owner_user_id must equal the claimant. A
  -- pending dealer on the same email owned by a DIFFERENT user falls through
  -- to the live-dealer conflict below and aborts the transaction: a dealer is
  -- never reassigned between users.
  select d.id into v_dealer_id
    from public.dealers d
   where lower(btrim(coalesce(d.email, ''))) = v_email
     and d.owner_user_id = p_user_id
     and d.approval_status = 'pending'
     and d.deleted_at is null
   order by d.created_at asc
   limit 1
   for update;

  if found then
    v_arm := 'approve-pending';
    update public.dealers
       set approval_status     = 'approved',
           approved_by         = v_rec.created_by_admin_id,
           approved_at         = now(),
           name                = v_rec.shop_name,
           detailer_rank       = v_rec.detailer_rank,
           subscription_status = 'active',
           status              = 'active',
           updated_at          = now()
     where id = v_dealer_id;
  else
    -- Any other live dealer on this email is a conflict, not a create.
    -- Raising aborts the transaction, so the winner-gate UPDATE above rolls
    -- back too — the record stays 'registered' for human review.
    if exists (
      select 1 from public.dealers d
      where lower(btrim(coalesce(d.email, ''))) = v_email
        and d.deleted_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'gyeon_claim_dealer_conflict';
    end if;

    -- Arm B: invited new shop — create the dealer approved.
    v_arm := 'create-invited';
    insert into public.dealers
      (name, email, owner_user_id, approval_status, approved_by, approved_at,
       detailer_rank, plan, subscription_status, status)
    values
      (v_rec.shop_name, v_email, p_user_id, 'approved', v_rec.created_by_admin_id,
       now(), v_rec.detailer_rank, 'basic', 'active', 'active')
    returning id into v_dealer_id;
  end if;

  -- Owner membership: INVITED until the shop profile is completed.
  insert into public.dealer_members (dealer_id, user_id, role, status)
  values (v_dealer_id, p_user_id, 'owner', 'invited')
  on conflict (dealer_id, user_id)
  do update set role = 'owner', status = 'invited', updated_at = now();

  -- Rank write-through (dealer-facing UI reads dealer_settings).
  insert into public.dealer_settings (dealer_id, detailer_rank, updated_at)
  values (v_dealer_id, v_rec.detailer_rank, now())
  on conflict (dealer_id)
  do update set detailer_rank = excluded.detailer_rank, updated_at = now();

  update public.gyeon_dealer_provisioning
     set claimed_dealer_id = v_dealer_id, updated_at = now()
   where id = v_rec.id;

  -- Audit inside the same transaction — commits or rolls back with the claim.
  insert into public.admin_audit_logs
    (admin_user_id, target_user_id, target_dealer_id, action, details)
  values
    (v_rec.created_by_admin_id, p_user_id, v_dealer_id,
     'gyeon_provisioning_claimed',
     jsonb_build_object(
       'provisioning_id', v_rec.id,
       'arm',             v_arm,
       'detailer_rank',   v_rec.detailer_rank,
       'dealer_code',     v_rec.dealer_code
     ));

  return jsonb_build_object(
    'outcome',   'claimed',
    'dealer_id', v_dealer_id,
    'arm',       v_arm
  );
end;
$$;

revoke execute on function public.claim_gyeon_provisioning(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_gyeon_provisioning(uuid, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Profile completion — writes the required fields and activates atomically
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.complete_gyeon_shop_profile(
  p_user_id    uuid,
  p_phone      text,
  p_prefecture text,
  p_address    text
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_member_id uuid;
  v_dealer_id uuid;
  v_admin_id  uuid;
  v_rows      integer;
begin
  if p_user_id is null
     or btrim(coalesce(p_phone, ''))      = ''
     or btrim(coalesce(p_prefecture, '')) = ''
     or btrim(coalesce(p_address, ''))    = '' then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;

  -- F2-03: database-side identity revalidation — the claimant must be a real,
  -- email-confirmed auth.users row before any mutation.
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('outcome', 'identity-mismatch');
  end if;

  select dm.id, dm.dealer_id into v_member_id, v_dealer_id
    from public.dealer_members dm
    join public.dealers d on d.id = dm.dealer_id
   where dm.user_id = p_user_id
     and dm.role    = 'owner'
     and dm.status  = 'invited'
     and d.deleted_at is null
   order by dm.created_at asc
   limit 1
   for update of dm;

  if not found then
    if exists (
      select 1 from public.dealer_members dm
      where dm.user_id = p_user_id and dm.status = 'active'
    ) then
      return jsonb_build_object('outcome', 'already-active');
    end if;
    return jsonb_build_object('outcome', 'not-eligible');
  end if;

  -- F2-03: the provisioning record, the invited membership, and the claimant
  -- must all belong together — same user AND same dealer — and the audit
  -- actor (the recording superAdmin) must be resolvable. Anything unresolved
  -- fails closed BEFORE any mutation.
  select g.created_by_admin_id into v_admin_id
    from public.gyeon_dealer_provisioning g
   where g.claimed_dealer_id  = v_dealer_id
     and g.claimed_by_user_id = p_user_id
     and g.provisioning_status = 'claimed'
   order by g.claimed_at desc nulls last
   limit 1;
  if not found or v_admin_id is null then
    return jsonb_build_object('outcome', 'not-eligible');
  end if;

  update public.dealers
     set phone      = btrim(p_phone),
         prefecture = btrim(p_prefecture),
         address    = btrim(p_address),
         updated_at = now()
   where id = v_dealer_id;

  update public.dealer_members
     set status = 'active', updated_at = now()
   where id = v_member_id and status = 'invited';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    -- Rolls back the dealer field write too — activation is all-or-nothing.
    raise exception using errcode = 'P0001', message = 'gyeon_profile_activation_lost_row';
  end if;

  insert into public.admin_audit_logs
    (admin_user_id, target_user_id, target_dealer_id, action, details)
  values
    (v_admin_id, p_user_id, v_dealer_id,
     'gyeon_shop_profile_completed',
     jsonb_build_object('member_id', v_member_id));

  return jsonb_build_object('outcome', 'completed', 'dealer_id', v_dealer_id);
end;
$$;

revoke execute on function public.complete_gyeon_shop_profile(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_gyeon_shop_profile(uuid, text, text, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CSV import — all-or-nothing rows + audit in one transaction
-- ─────────────────────────────────────────────────────────────────────────────
-- Rows arrive pre-validated by the server action (shape + in-file duplicates);
-- this function re-validates against the DATABASE atomically: any conflict or
-- invalid row returns with ZERO writes. Invitation is NEVER triggered here.
--
-- F3-01: this locked RPC is the AUTHORITATIVE confirmation — the dry-run
-- action is an advisory preview only. The SHARE ROW EXCLUSIVE table lock
-- taken first serializes confirmed imports against other imports and against
-- direct INSERT/UPDATE/DELETE on the provisioning table, so the
-- classification pass and the insert pass see one consistent truth.

create or replace function public.import_gyeon_provisioning(
  p_admin_id uuid,
  p_rows     jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_batch     uuid;
  v_row       jsonb;
  v_email     text;
  v_shop      text;
  v_rank      text;
  v_code      text;
  v_existing  public.gyeon_dealer_provisioning%rowtype;
  v_conflicts jsonb := '[]'::jsonb;
  v_inserted  integer := 0;
  v_unchanged integer := 0;
  v_rows      integer;
begin
  if p_admin_id is null
     or p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0 then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;

  -- F3-01: serialize BEFORE any classification or insert. Held to commit.
  lock table public.gyeon_dealer_provisioning in share row exclusive mode;

  v_batch := gen_random_uuid();

  -- Pass 1 (F2-04): classify every row — zero writes on any conflict.
  --   * no existing row                                   -> to insert
  --   * IDENTICAL existing row, still registered+unclaimed -> unchanged no-op
  --     (byte-equivalent replay: same shop_name, rank, dealer_code)
  --   * anything else (changed fields, claimed, revoked,
  --     or a dealer_code owned by another email)           -> conflict
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_email := lower(btrim(coalesce(v_row->>'email_normalized', '')));
    v_shop  := btrim(coalesce(v_row->>'shop_name', ''));
    v_rank  := btrim(coalesce(v_row->>'detailer_rank', ''));
    v_code  := nullif(btrim(coalesce(v_row->>'dealer_code', '')), '');

    if v_email = '' or v_shop = ''
       or v_rank not in ('shop', 'detailer', 'ppf_installer', 'certified') then
      return jsonb_build_object('outcome', 'invalid-row', 'email', v_email);
    end if;

    select * into v_existing from public.gyeon_dealer_provisioning g
     where g.email_normalized = v_email;
    if found then
      if not (v_existing.provisioning_status = 'registered'
              and v_existing.claimed_at is null
              and v_existing.shop_name = v_shop
              and v_existing.detailer_rank = v_rank
              and coalesce(v_existing.dealer_code, '') = coalesce(v_code, '')) then
        v_conflicts := v_conflicts || jsonb_build_object('email', v_email, 'reason', 'email-exists');
      end if;
      -- identical + registered + unclaimed: replay no-op (counted in pass 2)
    elsif v_code is not null
      and exists (select 1 from public.gyeon_dealer_provisioning g
                  where g.dealer_code = v_code) then
      v_conflicts := v_conflicts || jsonb_build_object('email', v_email, 'reason', 'dealer-code-exists');
    end if;
  end loop;

  if jsonb_array_length(v_conflicts) > 0 then
    return jsonb_build_object('outcome', 'conflict', 'conflicts', v_conflicts);
  end if;

  -- Pass 2: insert with the email uniqueness as the arbiter. An identical row
  -- (pre-existing or committed by a concurrent identical import) hits the
  -- conflict target and counts as unchanged; a racing dealer_code violation
  -- still aborts the whole batch. Rows and the audit record commit together.
  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.gyeon_dealer_provisioning
      (email_normalized, shop_name, detailer_rank, dealer_code,
       created_by_admin_id, import_batch_id)
    values
      (lower(btrim(v_row->>'email_normalized')),
       btrim(v_row->>'shop_name'),
       btrim(v_row->>'detailer_rank'),
       nullif(btrim(coalesce(v_row->>'dealer_code', '')), ''),
       p_admin_id, v_batch)
    on conflict (email_normalized) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      v_inserted := v_inserted + 1;
    else
      v_unchanged := v_unchanged + 1;
    end if;
  end loop;

  insert into public.admin_audit_logs
    (admin_user_id, action, details)
  values
    (p_admin_id, 'gyeon_provisioning_imported',
     jsonb_build_object('batch_id', v_batch, 'inserted', v_inserted, 'unchanged', v_unchanged));

  return jsonb_build_object(
    'outcome', 'imported',
    'inserted', v_inserted,
    'unchanged', v_unchanged,
    'batch_id', v_batch
  );
end;
$$;

revoke execute on function public.import_gyeon_provisioning(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.import_gyeon_provisioning(uuid, jsonb)
  to service_role;
