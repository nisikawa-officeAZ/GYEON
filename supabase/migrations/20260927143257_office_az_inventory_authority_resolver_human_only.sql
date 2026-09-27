-- INV001 P19 D6-B F1/F1b: human-only Office AZ inventory authority resolver.
--
-- Forward-only replacement of the single public read surface created by
-- 20260920093931_office_az_operator_authority.sql. That file is not edited.
--
-- F1  The previous body also returned principal_kind = 'service' assignments
--     to any authenticated caller who knew the actor/operator pair. Service
--     candidates are never returned through this human-facing RPC any more.
-- F1b The previous body returned every active Office AZ location to callers
--     with zero matching human assignments. knownLocationIds is now [] when no
--     human assignment matches auth.uid() + actor + operator. When at least one
--     matches, knownLocationIds remains the full active Office AZ location list
--     in location_id order (D4 compatibility boundary); it is deliberately NOT
--     narrowed to the caller's location grants.
--
-- Preserved: signature (text, text) -> jsonb, invalid-input null result, the
-- two-key JSON shape {candidates, knownLocationIds}, per-candidate fields and
-- ordering, security definer with empty search_path, fully schema-qualified
-- references, and the authenticated-only EXECUTE grant. create or replace keeps
-- the function oid, owner, and ACL. No table, seed, trigger, policy, grant to
-- anon/service_role/public, or mutation RPC is introduced.

create or replace function public.resolve_office_az_inventory_authority(
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
    else (
      with human_candidate as (
        select
          assignment.assignment_id,
          assignment.owner,
          assignment.principal_kind,
          assignment.actor_id,
          assignment.operator_id,
          assignment.role,
          assignment.status,
          assignment.valid_from,
          assignment.valid_until,
          assignment.authority_version
        from office_az_inventory_authority_private.assignments as assignment
        where assignment.owner = 'OFFICE_AZ'
          and assignment.actor_id = p_actor_id
          and assignment.operator_id = p_operator_id
          and assignment.principal_kind = 'human'
          and assignment.authenticated_user_id = auth.uid()
      )
      select pg_catalog.jsonb_build_object(
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
          from human_candidate as assignment
        ), '[]'::jsonb),
        'knownLocationIds', case
          when exists (select 1 from human_candidate)
          then coalesce((
            select pg_catalog.jsonb_agg(location_row.location_id order by location_row.location_id)
            from office_az_inventory_authority_private.locations as location_row
            where location_row.owner = 'OFFICE_AZ' and location_row.is_active
          ), '[]'::jsonb)
          else '[]'::jsonb
        end
      )
    )
  end;
$function$;

revoke all on function public.resolve_office_az_inventory_authority(text, text) from public;
revoke all on function public.resolve_office_az_inventory_authority(text, text) from anon;
revoke all on function public.resolve_office_az_inventory_authority(text, text) from service_role;
grant execute on function public.resolve_office_az_inventory_authority(text, text) to authenticated;
