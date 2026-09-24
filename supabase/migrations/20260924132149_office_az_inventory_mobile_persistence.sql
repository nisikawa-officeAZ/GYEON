-- D5B source-only: mobile device/session/enrollment/audit storage plus
-- additive closed-set extension of authority capabilities.
-- This migration creates no assignments, grants, seeds, or live bindings.

create schema office_az_inventory_mobile_private;

revoke all on schema office_az_inventory_mobile_private from public;
revoke all on schema office_az_inventory_mobile_private from anon;
revoke all on schema office_az_inventory_mobile_private from authenticated;
revoke all on schema office_az_inventory_mobile_private from service_role;

alter table office_az_inventory_authority_private.capability_grants
  drop constraint office_az_inventory_capability_grants_capability_check;

alter table office_az_inventory_authority_private.capability_grants
  add constraint office_az_inventory_capability_grants_capability_check
  check (capability in (
    'inventory.quantity.read',
    'inventory.audit.read',
    'inventory.inbound.confirm',
    'inventory.adjust',
    'inventory.reservation.manage',
    'inventory.fulfillment.open',
    'inventory.fulfillment.pick',
    'inventory.fulfillment.pack',
    'inventory.fulfillment.ship',
    'inventory.fulfillment.return',
    'inventory.fulfillment.restock',
    'inventory.transfer.request',
    'inventory.transfer.dispatch',
    'inventory.transfer.receive',
    'inventory.stocktake.open',
    'inventory.stocktake.count',
    'inventory.stocktake.complete',
    'inventory.snapshot.export',
    'inventory.snapshot.import',
    'inventory.recovery.evaluate',
    'inventory.authorization.issue',
    'inventory.operator.manage',
    'inventory.device.register',
    'inventory.session.revoke',
    'inventory.session.issue'
  ));

create table office_az_inventory_mobile_private.managed_devices (
  device_id_hash text primary key
    constraint office_az_inventory_mobile_devices_hash_check
      check (device_id_hash ~ '^[a-f0-9]{64}$'),
  owner text not null default 'OFFICE_AZ'
    constraint office_az_inventory_mobile_devices_owner_check
      check (owner = 'OFFICE_AZ'),
  actor_id text not null
    constraint office_az_inventory_mobile_devices_actor_check
      check (actor_id = btrim(actor_id) and length(actor_id) between 1 and 512),
  operator_id text not null
    constraint office_az_inventory_mobile_devices_operator_check
      check (operator_id = btrim(operator_id) and length(operator_id) between 1 and 512),
  authenticated_user_id uuid not null,
  location_id text not null
    constraint office_az_inventory_mobile_devices_location_check
      check (location_id = btrim(location_id) and length(location_id) between 1 and 512),
  authority_version bigint not null
    constraint office_az_inventory_mobile_devices_version_check
      check (authority_version > 0 and authority_version <= 9007199254740991),
  status text not null
    constraint office_az_inventory_mobile_devices_status_check
      check (status in ('active', 'revoked')),
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  constraint office_az_inventory_mobile_devices_identity_check check (
    actor_id <> operator_id
  ),
  constraint office_az_inventory_mobile_devices_revoke_state_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table office_az_inventory_mobile_private.enrollment_codes (
  enrollment_code_hash text primary key
    constraint office_az_inventory_mobile_enrollment_hash_check
      check (enrollment_code_hash ~ '^[a-f0-9]{64}$'),
  owner text not null default 'OFFICE_AZ'
    constraint office_az_inventory_mobile_enrollment_owner_check
      check (owner = 'OFFICE_AZ'),
  actor_id text not null
    constraint office_az_inventory_mobile_enrollment_actor_check
      check (actor_id = btrim(actor_id) and length(actor_id) between 1 and 512),
  operator_id text not null
    constraint office_az_inventory_mobile_enrollment_operator_check
      check (operator_id = btrim(operator_id) and length(operator_id) between 1 and 512),
  authenticated_user_id uuid not null,
  location_id text not null
    constraint office_az_inventory_mobile_enrollment_location_check
      check (location_id = btrim(location_id) and length(location_id) between 1 and 512),
  authority_version bigint not null
    constraint office_az_inventory_mobile_enrollment_version_check
      check (authority_version > 0 and authority_version <= 9007199254740991),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_device_id_hash text
    constraint office_az_inventory_mobile_enrollment_device_hash_check
      check (
        redeemed_device_id_hash is null
        or redeemed_device_id_hash ~ '^[a-f0-9]{64}$'
      ),
  constraint office_az_inventory_mobile_enrollment_identity_check check (
    actor_id <> operator_id
  ),
  constraint office_az_inventory_mobile_enrollment_redeem_state_check check (
    (redeemed_at is null and redeemed_device_id_hash is null)
    or (redeemed_at is not null and redeemed_device_id_hash is not null)
  )
);

create table office_az_inventory_mobile_private.sessions (
  session_id_hash text primary key
    constraint office_az_inventory_mobile_sessions_hash_check
      check (session_id_hash ~ '^[a-f0-9]{64}$'),
  device_id_hash text not null
    references office_az_inventory_mobile_private.managed_devices(device_id_hash),
  owner text not null default 'OFFICE_AZ'
    constraint office_az_inventory_mobile_sessions_owner_check
      check (owner = 'OFFICE_AZ'),
  actor_id text not null
    constraint office_az_inventory_mobile_sessions_actor_check
      check (actor_id = btrim(actor_id) and length(actor_id) between 1 and 512),
  operator_id text not null
    constraint office_az_inventory_mobile_sessions_operator_check
      check (operator_id = btrim(operator_id) and length(operator_id) between 1 and 512),
  authenticated_user_id uuid not null,
  location_id text not null
    constraint office_az_inventory_mobile_sessions_location_check
      check (location_id = btrim(location_id) and length(location_id) between 1 and 512),
  authority_version bigint not null
    constraint office_az_inventory_mobile_sessions_version_check
      check (authority_version > 0 and authority_version <= 9007199254740991),
  refresh_hash text not null
    constraint office_az_inventory_mobile_sessions_refresh_hash_check
      check (refresh_hash ~ '^[a-f0-9]{64}$'),
  refresh_version bigint not null
    constraint office_az_inventory_mobile_sessions_refresh_version_check
      check (refresh_version > 0 and refresh_version <= 9007199254740991),
  issued_at timestamptz not null default statement_timestamp(),
  access_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint office_az_inventory_mobile_sessions_identity_check check (
    actor_id <> operator_id
  ),
  constraint office_az_inventory_mobile_sessions_lifetime_check check (
    access_expires_at > issued_at
    and absolute_expires_at = issued_at + interval '12 hours'
    and access_expires_at <= absolute_expires_at
  )
);

create table office_az_inventory_mobile_private.audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  owner text not null default 'OFFICE_AZ'
    constraint office_az_inventory_mobile_audit_owner_check
      check (owner = 'OFFICE_AZ'),
  operation text not null
    constraint office_az_inventory_mobile_audit_operation_check
      check (operation in (
        'register',
        'revoke_device',
        'issue',
        'refresh',
        'revoke'
      )),
  actor_id text not null
    constraint office_az_inventory_mobile_audit_actor_check
      check (actor_id = btrim(actor_id) and length(actor_id) between 1 and 512),
  operator_id text not null
    constraint office_az_inventory_mobile_audit_operator_check
      check (operator_id = btrim(operator_id) and length(operator_id) between 1 and 512),
  authenticated_user_id uuid not null,
  device_id_hash text
    constraint office_az_inventory_mobile_audit_device_hash_check
      check (device_id_hash is null or device_id_hash ~ '^[a-f0-9]{64}$'),
  session_id_hash text
    constraint office_az_inventory_mobile_audit_session_hash_check
      check (session_id_hash is null or session_id_hash ~ '^[a-f0-9]{64}$'),
  enrollment_code_hash text
    constraint office_az_inventory_mobile_audit_enrollment_hash_check
      check (
        enrollment_code_hash is null
        or enrollment_code_hash ~ '^[a-f0-9]{64}$'
      ),
  authority_version bigint not null
    constraint office_az_inventory_mobile_audit_version_check
      check (authority_version > 0 and authority_version <= 9007199254740991),
  created_at timestamptz not null default statement_timestamp(),
  constraint office_az_inventory_mobile_audit_identity_check check (
    actor_id <> operator_id
  )
);

alter table office_az_inventory_mobile_private.managed_devices enable row level security;
alter table office_az_inventory_mobile_private.managed_devices force row level security;
alter table office_az_inventory_mobile_private.enrollment_codes enable row level security;
alter table office_az_inventory_mobile_private.enrollment_codes force row level security;
alter table office_az_inventory_mobile_private.sessions enable row level security;
alter table office_az_inventory_mobile_private.sessions force row level security;
alter table office_az_inventory_mobile_private.audit_events enable row level security;
alter table office_az_inventory_mobile_private.audit_events force row level security;

revoke all on all tables in schema office_az_inventory_mobile_private from public;
revoke all on all tables in schema office_az_inventory_mobile_private from anon;
revoke all on all tables in schema office_az_inventory_mobile_private from authenticated;
revoke all on all tables in schema office_az_inventory_mobile_private from service_role;

create function office_az_inventory_mobile_private.current_authority_bound(
  p_actor_id text,
  p_operator_id text,
  p_location_id text,
  p_authority_version bigint,
  p_capability text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  locked_assignment_ids uuid[] := '{}';
  locked_roles text[] := '{}';
  locked_assignment_id uuid;
  locked_role text;
  assignment_row record;
begin
  if auth.uid() is null
    or p_actor_id is null
    or p_operator_id is null
    or p_location_id is null
    or p_authority_version is null
    or p_capability is null
    or p_capability not in (
      'inventory.session.issue',
      'inventory.session.revoke',
      'inventory.device.register'
    )
  then
    return false;
  end if;

  for assignment_row in
    select assignment.assignment_id, assignment.role
    from office_az_inventory_authority_private.assignments as assignment
    where assignment.owner = 'OFFICE_AZ'
      and assignment.actor_id = p_actor_id
      and assignment.operator_id = p_operator_id
      and assignment.status = 'active'
      and assignment.authority_version = p_authority_version
      and assignment.principal_kind = 'human'
      and assignment.authenticated_user_id = auth.uid()
      and assignment.actor_id <> assignment.operator_id
      and assignment.valid_from <= statement_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > statement_timestamp())
    order by assignment.assignment_id
    for update of assignment
  loop
    locked_assignment_ids := locked_assignment_ids || assignment_row.assignment_id;
    locked_roles := locked_roles || assignment_row.role;
  end loop;
  if cardinality(locked_assignment_ids) <> 1 then
    return false;
  end if;

  locked_assignment_id := locked_assignment_ids[1];
  locked_role := locked_roles[1];
  if locked_role is null
    or locked_role = 'office_az_inventory_service'
    or locked_role not in (
      'office_az_warehouse_operator',
      'office_az_warehouse_manager',
      'office_az_inventory_super_admin'
    )
    or not (
      (
        locked_role = 'office_az_warehouse_operator'
        and p_capability = 'inventory.session.issue'
      )
      or (
        locked_role = 'office_az_warehouse_manager'
        and p_capability in ('inventory.session.issue', 'inventory.session.revoke')
      )
      or (
        locked_role = 'office_az_inventory_super_admin'
        and p_capability in (
          'inventory.session.issue',
          'inventory.session.revoke',
          'inventory.device.register'
        )
      )
    )
  then
    return false;
  end if;

  perform 1
  from office_az_inventory_authority_private.capability_grants as grant_row
  where grant_row.assignment_id = locked_assignment_id
    and grant_row.capability = p_capability
  order by grant_row.capability
  for update of grant_row;
  if not found then
    return false;
  end if;

  perform 1
  from office_az_inventory_authority_private.location_grants as location_grant
  where location_grant.assignment_id = locked_assignment_id
    and location_grant.location_id = p_location_id
  order by location_grant.location_id
  for update of location_grant;
  if not found then
    return false;
  end if;

  perform 1
  from office_az_inventory_authority_private.locations as location_row
  where location_row.location_id = p_location_id
    and location_row.owner = 'OFFICE_AZ'
    and location_row.is_active = true
  order by location_row.location_id
  for update of location_row;
  if not found then
    return false;
  end if;

  return exists (
    select 1
    from office_az_inventory_authority_private.assignments as assignment
    join office_az_inventory_authority_private.locations as location_row
      on location_row.location_id = p_location_id
     and location_row.owner = 'OFFICE_AZ'
     and location_row.is_active = true
    where assignment.assignment_id = locked_assignment_id
      and assignment.owner = 'OFFICE_AZ'
      and assignment.status = 'active'
      and assignment.authority_version = p_authority_version
      and assignment.authenticated_user_id = auth.uid()
      and assignment.role = locked_role
      and assignment.principal_kind = 'human'
      and assignment.valid_from <= statement_timestamp()
      and (assignment.valid_until is null or assignment.valid_until > statement_timestamp())
  );
end;
$function$;

revoke all on function office_az_inventory_mobile_private.current_authority_bound(text, text, text, bigint, text) from public;
revoke all on function office_az_inventory_mobile_private.current_authority_bound(text, text, text, bigint, text) from anon;
revoke all on function office_az_inventory_mobile_private.current_authority_bound(text, text, text, bigint, text) from authenticated;
revoke all on function office_az_inventory_mobile_private.current_authority_bound(text, text, text, bigint, text) from service_role;

create function public.office_az_inventory_mobile_register(
  p_actor_id text,
  p_operator_id text,
  p_location_id text,
  p_authority_version bigint,
  p_enrollment_code_hash text,
  p_device_id_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  redeemed_count integer;
begin
  if auth.uid() is null
    or p_enrollment_code_hash is null
    or p_enrollment_code_hash !~ '^[a-f0-9]{64}$'
    or p_device_id_hash is null
    or p_device_id_hash !~ '^[a-f0-9]{64}$'
    or not office_az_inventory_mobile_private.current_authority_bound(
      p_actor_id, p_operator_id, p_location_id, p_authority_version, 'inventory.device.register'
    )
  then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  update office_az_inventory_mobile_private.enrollment_codes as enrollment
  set redeemed_at = statement_timestamp(),
      redeemed_device_id_hash = p_device_id_hash
  where enrollment.enrollment_code_hash = p_enrollment_code_hash
    and enrollment.owner = 'OFFICE_AZ'
    and enrollment.actor_id = p_actor_id
    and enrollment.operator_id = p_operator_id
    and enrollment.authenticated_user_id = auth.uid()
    and enrollment.location_id = p_location_id
    and enrollment.authority_version = p_authority_version
    and enrollment.redeemed_at is null
    and enrollment.expires_at > statement_timestamp();
  get diagnostics redeemed_count = row_count;
  if redeemed_count <> 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  insert into office_az_inventory_mobile_private.managed_devices (
    device_id_hash, owner, actor_id, operator_id, authenticated_user_id,
    location_id, authority_version, status
  ) values (
    p_device_id_hash, 'OFFICE_AZ', p_actor_id, p_operator_id, auth.uid(),
    p_location_id, p_authority_version, 'active'
  );

  insert into office_az_inventory_mobile_private.audit_events (
    owner, operation, actor_id, operator_id, authenticated_user_id,
    device_id_hash, enrollment_code_hash, authority_version
  ) values (
    'OFFICE_AZ', 'register', p_actor_id, p_operator_id, auth.uid(),
    p_device_id_hash, p_enrollment_code_hash, p_authority_version
  );

  return pg_catalog.jsonb_build_object('ok', true, 'status', 'accepted');
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  when others then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'failed');
end;
$function$;

create function public.office_az_inventory_mobile_revoke_device(
  p_actor_id text,
  p_operator_id text,
  p_location_id text,
  p_authority_version bigint,
  p_device_id_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  device_count integer;
begin
  if auth.uid() is null
    or p_device_id_hash is null
    or p_device_id_hash !~ '^[a-f0-9]{64}$'
    or not office_az_inventory_mobile_private.current_authority_bound(
      p_actor_id, p_operator_id, p_location_id, p_authority_version, 'inventory.session.revoke'
    )
  then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  update office_az_inventory_mobile_private.managed_devices as device
  set status = 'revoked',
      revoked_at = coalesce(device.revoked_at, statement_timestamp())
  where device.device_id_hash = p_device_id_hash
    and device.owner = 'OFFICE_AZ'
    and device.actor_id = p_actor_id
    and device.operator_id = p_operator_id
    and device.authenticated_user_id = auth.uid()
    and device.location_id = p_location_id
    and device.authority_version = p_authority_version;
  get diagnostics device_count = row_count;
  if device_count <> 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  update office_az_inventory_mobile_private.sessions as session_row
  set revoked_at = coalesce(session_row.revoked_at, statement_timestamp())
  where session_row.device_id_hash = p_device_id_hash
    and session_row.owner = 'OFFICE_AZ';

  insert into office_az_inventory_mobile_private.audit_events (
    owner, operation, actor_id, operator_id, authenticated_user_id,
    device_id_hash, authority_version
  ) values (
    'OFFICE_AZ', 'revoke_device', p_actor_id, p_operator_id, auth.uid(),
    p_device_id_hash, p_authority_version
  );

  return pg_catalog.jsonb_build_object('ok', true, 'status', 'accepted');
exception
  when others then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'failed');
end;
$function$;

create function public.office_az_inventory_mobile_issue(
  p_actor_id text,
  p_operator_id text,
  p_location_id text,
  p_authority_version bigint,
  p_device_id_hash text,
  p_session_id_hash text,
  p_refresh_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  issued_at timestamptz := statement_timestamp();
begin
  if auth.uid() is null
    or p_device_id_hash is null
    or p_device_id_hash !~ '^[a-f0-9]{64}$'
    or p_session_id_hash is null
    or p_session_id_hash !~ '^[a-f0-9]{64}$'
    or p_refresh_hash is null
    or p_refresh_hash !~ '^[a-f0-9]{64}$'
    or not office_az_inventory_mobile_private.current_authority_bound(
      p_actor_id, p_operator_id, p_location_id, p_authority_version, 'inventory.session.issue'
    )
  then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  perform 1
  from office_az_inventory_mobile_private.managed_devices as device
  where device.device_id_hash = p_device_id_hash
    and device.owner = 'OFFICE_AZ'
    and device.actor_id = p_actor_id
    and device.operator_id = p_operator_id
    and device.authenticated_user_id = auth.uid()
    and device.location_id = p_location_id
    and device.authority_version = p_authority_version
    and device.status = 'active'
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  insert into office_az_inventory_mobile_private.sessions (
    session_id_hash, device_id_hash, owner, actor_id, operator_id,
    authenticated_user_id, location_id, authority_version, refresh_hash,
    refresh_version, issued_at, access_expires_at, absolute_expires_at
  ) values (
    p_session_id_hash, p_device_id_hash, 'OFFICE_AZ', p_actor_id, p_operator_id,
    auth.uid(), p_location_id, p_authority_version, p_refresh_hash,
    1, issued_at, issued_at + interval '1 hour', issued_at + interval '12 hours'
  );

  insert into office_az_inventory_mobile_private.audit_events (
    owner, operation, actor_id, operator_id, authenticated_user_id,
    device_id_hash, session_id_hash, authority_version
  ) values (
    'OFFICE_AZ', 'issue', p_actor_id, p_operator_id, auth.uid(),
    p_device_id_hash, p_session_id_hash, p_authority_version
  );

  return pg_catalog.jsonb_build_object('ok', true, 'status', 'accepted');
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  when others then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'failed');
end;
$function$;

create function public.office_az_inventory_mobile_refresh(
  p_actor_id text,
  p_operator_id text,
  p_location_id text,
  p_authority_version bigint,
  p_session_id_hash text,
  p_current_refresh_hash text,
  p_current_refresh_version bigint,
  p_next_refresh_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  rotated_count integer;
begin
  if auth.uid() is null
    or p_session_id_hash is null
    or p_session_id_hash !~ '^[a-f0-9]{64}$'
    or p_current_refresh_hash is null
    or p_current_refresh_hash !~ '^[a-f0-9]{64}$'
    or p_next_refresh_hash is null
    or p_next_refresh_hash !~ '^[a-f0-9]{64}$'
    or p_current_refresh_version is null
    or p_current_refresh_version < 1
    or p_next_refresh_hash = p_current_refresh_hash
    or not office_az_inventory_mobile_private.current_authority_bound(
      p_actor_id, p_operator_id, p_location_id, p_authority_version, 'inventory.session.issue'
    )
  then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  update office_az_inventory_mobile_private.sessions as session_row
  set refresh_hash = p_next_refresh_hash,
      refresh_version = session_row.refresh_version + 1,
      access_expires_at = least(
        statement_timestamp() + interval '1 hour',
        session_row.absolute_expires_at
      )
  where session_row.session_id_hash = p_session_id_hash
    and session_row.owner = 'OFFICE_AZ'
    and session_row.actor_id = p_actor_id
    and session_row.operator_id = p_operator_id
    and session_row.authenticated_user_id = auth.uid()
    and session_row.location_id = p_location_id
    and session_row.authority_version = p_authority_version
    and session_row.refresh_hash = p_current_refresh_hash
    and session_row.refresh_version = p_current_refresh_version
    and session_row.revoked_at is null
    and session_row.absolute_expires_at > statement_timestamp();
  get diagnostics rotated_count = row_count;
  if rotated_count <> 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  insert into office_az_inventory_mobile_private.audit_events (
    owner, operation, actor_id, operator_id, authenticated_user_id,
    session_id_hash, authority_version
  ) values (
    'OFFICE_AZ', 'refresh', p_actor_id, p_operator_id, auth.uid(),
    p_session_id_hash, p_authority_version
  );

  return pg_catalog.jsonb_build_object('ok', true, 'status', 'accepted');
exception
  when others then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'failed');
end;
$function$;

create function public.office_az_inventory_mobile_revoke(
  p_actor_id text,
  p_operator_id text,
  p_location_id text,
  p_authority_version bigint,
  p_session_id_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  session_count integer;
begin
  if auth.uid() is null
    or p_session_id_hash is null
    or p_session_id_hash !~ '^[a-f0-9]{64}$'
    or not office_az_inventory_mobile_private.current_authority_bound(
      p_actor_id, p_operator_id, p_location_id, p_authority_version, 'inventory.session.revoke'
    )
  then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  update office_az_inventory_mobile_private.sessions as session_row
  set revoked_at = coalesce(session_row.revoked_at, statement_timestamp())
  where session_row.session_id_hash = p_session_id_hash
    and session_row.owner = 'OFFICE_AZ'
    and session_row.actor_id = p_actor_id
    and session_row.operator_id = p_operator_id
    and session_row.authenticated_user_id = auth.uid()
    and session_row.location_id = p_location_id
    and session_row.authority_version = p_authority_version;
  get diagnostics session_count = row_count;
  if session_count <> 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'invalid_or_stale');
  end if;

  insert into office_az_inventory_mobile_private.audit_events (
    owner, operation, actor_id, operator_id, authenticated_user_id,
    session_id_hash, authority_version
  ) values (
    'OFFICE_AZ', 'revoke', p_actor_id, p_operator_id, auth.uid(),
    p_session_id_hash, p_authority_version
  );

  return pg_catalog.jsonb_build_object('ok', true, 'status', 'accepted');
exception
  when others then
    return pg_catalog.jsonb_build_object('ok', false, 'status', 'failed');
end;
$function$;

revoke all on function public.office_az_inventory_mobile_register(text, text, text, bigint, text, text) from public;
revoke all on function public.office_az_inventory_mobile_register(text, text, text, bigint, text, text) from anon;
revoke all on function public.office_az_inventory_mobile_register(text, text, text, bigint, text, text) from service_role;
grant execute on function public.office_az_inventory_mobile_register(text, text, text, bigint, text, text) to authenticated;

revoke all on function public.office_az_inventory_mobile_revoke_device(text, text, text, bigint, text) from public;
revoke all on function public.office_az_inventory_mobile_revoke_device(text, text, text, bigint, text) from anon;
revoke all on function public.office_az_inventory_mobile_revoke_device(text, text, text, bigint, text) from service_role;
grant execute on function public.office_az_inventory_mobile_revoke_device(text, text, text, bigint, text) to authenticated;

revoke all on function public.office_az_inventory_mobile_issue(text, text, text, bigint, text, text, text) from public;
revoke all on function public.office_az_inventory_mobile_issue(text, text, text, bigint, text, text, text) from anon;
revoke all on function public.office_az_inventory_mobile_issue(text, text, text, bigint, text, text, text) from service_role;
grant execute on function public.office_az_inventory_mobile_issue(text, text, text, bigint, text, text, text) to authenticated;

revoke all on function public.office_az_inventory_mobile_refresh(text, text, text, bigint, text, text, bigint, text) from public;
revoke all on function public.office_az_inventory_mobile_refresh(text, text, text, bigint, text, text, bigint, text) from anon;
revoke all on function public.office_az_inventory_mobile_refresh(text, text, text, bigint, text, text, bigint, text) from service_role;
grant execute on function public.office_az_inventory_mobile_refresh(text, text, text, bigint, text, text, bigint, text) to authenticated;

revoke all on function public.office_az_inventory_mobile_revoke(text, text, text, bigint, text) from public;
revoke all on function public.office_az_inventory_mobile_revoke(text, text, text, bigint, text) from anon;
revoke all on function public.office_az_inventory_mobile_revoke(text, text, text, bigint, text) from service_role;
grant execute on function public.office_az_inventory_mobile_revoke(text, text, text, bigint, text) to authenticated;
