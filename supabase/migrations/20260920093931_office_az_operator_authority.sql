-- Office AZ inventory authority persistence and the only public read surface.
-- This migration deliberately creates no assignments, locations, grants, or
-- mutation RPCs: a freshly applied database remains fail-closed.

create schema office_az_inventory_authority_private;

revoke all on schema office_az_inventory_authority_private from public;
revoke all on schema office_az_inventory_authority_private from anon;
revoke all on schema office_az_inventory_authority_private from authenticated;
revoke all on schema office_az_inventory_authority_private from service_role;

create table office_az_inventory_authority_private.locations (
  owner text not null default 'OFFICE_AZ'
    constraint office_az_inventory_locations_owner_check
      check (owner = 'OFFICE_AZ'),
  location_id text primary key
    constraint office_az_inventory_locations_id_check
      check (location_id = btrim(location_id) and length(location_id) between 1 and 512),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp()
);

create table office_az_inventory_authority_private.assignments (
  assignment_id uuid primary key,
  owner text not null default 'OFFICE_AZ'
    constraint office_az_inventory_assignments_owner_check
      check (owner = 'OFFICE_AZ'),
  principal_kind text not null
    constraint office_az_inventory_assignments_principal_kind_check
      check (principal_kind in ('human', 'service')),
  authenticated_user_id uuid,
  actor_id text not null
    constraint office_az_inventory_assignments_actor_check
      check (actor_id = btrim(actor_id) and length(actor_id) between 1 and 512),
  operator_id text not null
    constraint office_az_inventory_assignments_operator_check
      check (operator_id = btrim(operator_id) and length(operator_id) between 1 and 512),
  role text not null
    constraint office_az_inventory_assignments_role_check
      check (role in (
        'office_az_warehouse_operator',
        'office_az_warehouse_manager',
        'office_az_inventory_super_admin',
        'office_az_inventory_service'
      )),
  status text not null
    constraint office_az_inventory_assignments_status_check
      check (status in ('active', 'suspended', 'revoked')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  authority_version bigint not null
    constraint office_az_inventory_assignments_version_check
      check (authority_version > 0 and authority_version <= 9007199254740991),
  created_at timestamptz not null default statement_timestamp(),
  constraint office_az_inventory_assignments_identity_check check (
    actor_id <> operator_id
  ),
  constraint office_az_inventory_assignments_validity_check check (
    valid_until is null or valid_until > valid_from
  ),
  constraint office_az_inventory_assignments_human_binding_check check (
    (principal_kind = 'human' and authenticated_user_id is not null and role <> 'office_az_inventory_service')
    or
    (principal_kind = 'service' and authenticated_user_id is null and role = 'office_az_inventory_service')
  )
);

create table office_az_inventory_authority_private.capability_grants (
  assignment_id uuid not null references office_az_inventory_authority_private.assignments(assignment_id),
  capability text not null
    constraint office_az_inventory_capability_grants_capability_check
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
        'inventory.operator.manage'
      )),
  primary key (assignment_id, capability)
);

create table office_az_inventory_authority_private.location_grants (
  assignment_id uuid not null references office_az_inventory_authority_private.assignments(assignment_id),
  location_id text not null references office_az_inventory_authority_private.locations(location_id),
  primary key (assignment_id, location_id)
);

alter table office_az_inventory_authority_private.locations enable row level security;
alter table office_az_inventory_authority_private.locations force row level security;
alter table office_az_inventory_authority_private.assignments enable row level security;
alter table office_az_inventory_authority_private.assignments force row level security;
alter table office_az_inventory_authority_private.capability_grants enable row level security;
alter table office_az_inventory_authority_private.capability_grants force row level security;
alter table office_az_inventory_authority_private.location_grants enable row level security;
alter table office_az_inventory_authority_private.location_grants force row level security;

revoke all on all tables in schema office_az_inventory_authority_private from public;
revoke all on all tables in schema office_az_inventory_authority_private from anon;
revoke all on all tables in schema office_az_inventory_authority_private from authenticated;
revoke all on all tables in schema office_az_inventory_authority_private from service_role;

create function public.resolve_office_az_inventory_authority(
  p_actor_id text,
  p_operator_id text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when auth.uid() is null
      or p_actor_id is null
      or p_actor_id <> pg_catalog.btrim(p_actor_id)
      or pg_catalog.length(p_actor_id) not between 1 and 512
      or p_operator_id is null
      or p_operator_id <> pg_catalog.btrim(p_operator_id)
      or pg_catalog.length(p_operator_id) not between 1 and 512
    then null
    else pg_catalog.jsonb_build_object(
      'candidates', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'source', 'server_resolved',
            'authenticatedUserId', auth.uid()::text,
            'actorId', assignment.actor_id,
            'operatorId', assignment.operator_id,
            'principalKind', assignment.principal_kind,
            'status', assignment.status,
            'owner', assignment.owner,
            'role', assignment.role,
            'capabilities', coalesce((
              select pg_catalog.jsonb_agg(grant_row.capability order by grant_row.capability)
              from office_az_inventory_authority_private.capability_grants as grant_row
              where grant_row.assignment_id = assignment.assignment_id
            ), '[]'::jsonb),
            'allowedLocationIds', coalesce((
              select pg_catalog.jsonb_agg(location_grant.location_id order by location_grant.location_id)
              from office_az_inventory_authority_private.location_grants as location_grant
              where location_grant.assignment_id = assignment.assignment_id
            ), '[]'::jsonb),
            'validFromIso', pg_catalog.to_char(
              assignment.valid_from at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'validUntilIso', case when assignment.valid_until is null then null else pg_catalog.to_char(
              assignment.valid_until at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ) end,
            'authorityVersion', assignment.authority_version
          ) order by assignment.assignment_id
        )
        from office_az_inventory_authority_private.assignments as assignment
        where assignment.owner = 'OFFICE_AZ'
          and assignment.actor_id = p_actor_id
          and assignment.operator_id = p_operator_id
          and (
            (assignment.principal_kind = 'human' and assignment.authenticated_user_id = auth.uid())
            or assignment.principal_kind = 'service'
          )
      ), '[]'::jsonb),
      'knownLocationIds', coalesce((
        select pg_catalog.jsonb_agg(location_row.location_id order by location_row.location_id)
        from office_az_inventory_authority_private.locations as location_row
        where location_row.owner = 'OFFICE_AZ' and location_row.is_active
      ), '[]'::jsonb)
    )
  end;
$function$;

revoke all on function public.resolve_office_az_inventory_authority(text, text) from public;
revoke all on function public.resolve_office_az_inventory_authority(text, text) from anon;
revoke all on function public.resolve_office_az_inventory_authority(text, text) from service_role;
grant execute on function public.resolve_office_az_inventory_authority(text, text) to authenticated;
