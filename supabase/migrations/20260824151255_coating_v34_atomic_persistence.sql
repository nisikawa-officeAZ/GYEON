-- GDA coating pricing V3.4: fail-closed, atomic persistence boundary.
--
-- This function is intentionally SECURITY INVOKER. The caller remains subject
-- to dealer_settings RLS and ordinary authenticated grants. The function also
-- repeats the canonical owner/manager authorization rule before taking a lock:
-- dealer_staff is authoritative when a row exists, including disabled/invited
-- rows which block the dealer_members fallback.

create or replace function public.save_coating_v34_settings(
  p_dealer_id uuid,
  p_coating jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_active_membership_count integer;
  v_member_dealer_id uuid;
  v_member_role text;
  v_staff_count integer;
  v_staff_status text;
  v_staff_role text;
  v_catalog jsonb;
  v_catalog_name text;
  v_price_key text;
  v_entry jsonb;
  v_price_map jsonb;
  v_price jsonb;
  v_key text;
  v_service_price_settings jsonb;
begin
  if v_actor is null or p_dealer_id is null then
    raise exception 'coating_v34_unauthorized' using errcode = '42501';
  end if;

  -- Match getCurrentDealer's fail-closed single-active-membership boundary.
  select count(*),
         (array_agg(dm.dealer_id order by dm.dealer_id))[1],
         min(dm.role)
    into v_active_membership_count, v_member_dealer_id, v_member_role
    from public.dealer_members dm
   where dm.user_id = v_actor
     and dm.status = 'active';

  if v_active_membership_count <> 1 or v_member_dealer_id is distinct from p_dealer_id then
    raise exception 'coating_v34_unauthorized' using errcode = '42501';
  end if;

  -- A dealer_staff row always wins. Non-active or non-finance rows deny and
  -- must never fall back to dealer_members.
  select count(*), min(ds.status), min(ds.role)
    into v_staff_count, v_staff_status, v_staff_role
    from public.dealer_staff ds
   where ds.dealer_id = p_dealer_id
     and ds.user_id = v_actor;

  if v_staff_count > 1 then
    raise exception 'coating_v34_unauthorized' using errcode = '42501';
  elsif v_staff_count = 1 then
    if v_staff_status <> 'active' or v_staff_role not in ('owner', 'manager') then
      raise exception 'coating_v34_unauthorized' using errcode = '42501';
    end if;
  elsif v_member_role not in ('owner', 'manager') then
    raise exception 'coating_v34_unauthorized' using errcode = '42501';
  end if;

  -- Exact top-level V3.4 shape. Unknown, legacy and missing keys fail closed.
  if p_coating is null or jsonb_typeof(p_coating) <> 'object' then
    raise exception 'coating_v34_invalid_payload' using errcode = '22023';
  end if;

  if (select coalesce(array_agg(k order by k), '{}'::text[])
        from jsonb_object_keys(p_coating) as k)
     <> array['baseProducts', 'contractVersion', 'layer2Products', 'layer3Products',
              'option_names', 'option_prices'] then
    raise exception 'coating_v34_invalid_payload' using errcode = '22023';
  end if;

  if jsonb_typeof(p_coating->'contractVersion') <> 'string'
     or p_coating->>'contractVersion' <> '3.4' then
    raise exception 'coating_v34_invalid_payload' using errcode = '22023';
  end if;

  -- Validate each independent layer catalog and its exact seven-size price map.
  foreach v_catalog_name in array array['baseProducts', 'layer2Products', 'layer3Products'] loop
    v_catalog := p_coating->v_catalog_name;
    if jsonb_typeof(v_catalog) <> 'array' then
      raise exception 'coating_v34_invalid_payload' using errcode = '22023';
    end if;

    v_price_key := case v_catalog_name
      when 'baseProducts' then 'pricesBySize'
      when 'layer2Products' then 'layer2PricesBySize'
      else 'layer3PricesBySize'
    end;

    for v_entry in select value from jsonb_array_elements(v_catalog) loop
      if jsonb_typeof(v_entry) <> 'object' then
        raise exception 'coating_v34_invalid_payload' using errcode = '22023';
      end if;

      if (select coalesce(array_agg(k order by k), '{}'::text[])
            from jsonb_object_keys(v_entry) as k)
         <> array['active', v_price_key, 'productId'] then
        raise exception 'coating_v34_invalid_payload' using errcode = '22023';
      end if;

      if jsonb_typeof(v_entry->'productId') <> 'string'
         or btrim(v_entry->>'productId') = ''
         or v_entry->>'productId' <> btrim(v_entry->>'productId')
         or jsonb_typeof(v_entry->'active') <> 'boolean' then
        raise exception 'coating_v34_invalid_payload' using errcode = '22023';
      end if;

      v_price_map := v_entry->v_price_key;
      if jsonb_typeof(v_price_map) <> 'object'
         or (select coalesce(array_agg(k order by k), '{}'::text[])
               from jsonb_object_keys(v_price_map) as k)
            <> array['L', 'LL', 'M', 'ML', 'S', 'SS', 'XL'] then
        raise exception 'coating_v34_invalid_payload' using errcode = '22023';
      end if;

      foreach v_key in array array['SS', 'S', 'M', 'ML', 'L', 'LL', 'XL'] loop
        v_price := v_price_map->v_key;
        if jsonb_typeof(v_price) = 'null' then
          continue;
        end if;
        if jsonb_typeof(v_price) <> 'number'
           or (v_price #>> '{}')::numeric < 0
           or trunc((v_price #>> '{}')::numeric) <> (v_price #>> '{}')::numeric then
          raise exception 'coating_v34_invalid_payload' using errcode = '22023';
        end if;
      end loop;
    end loop;

    if exists (
      select 1
        from jsonb_array_elements(v_catalog) as item
       group by item->>'productId'
      having count(*) > 1
    ) then
      raise exception 'coating_v34_invalid_payload' using errcode = '22023';
    end if;
  end loop;

  if jsonb_typeof(p_coating->'option_prices') <> 'object'
     or jsonb_typeof(p_coating->'option_names') <> 'object' then
    raise exception 'coating_v34_invalid_payload' using errcode = '22023';
  end if;

  for v_key, v_price in select key, value from jsonb_each(p_coating->'option_prices') loop
    if btrim(v_key) = '' or v_key <> btrim(v_key)
       or jsonb_typeof(v_price) <> 'number'
       or (v_price #>> '{}')::numeric < 0
       or trunc((v_price #>> '{}')::numeric) <> (v_price #>> '{}')::numeric then
      raise exception 'coating_v34_invalid_payload' using errcode = '22023';
    end if;
  end loop;

  for v_key, v_price in select key, value from jsonb_each(p_coating->'option_names') loop
    if btrim(v_key) = '' or v_key <> btrim(v_key)
       or jsonb_typeof(v_price) <> 'string'
       or btrim(v_price #>> '{}') = '' then
      raise exception 'coating_v34_invalid_payload' using errcode = '22023';
    end if;
  end loop;

  -- Update-only by design: configuration must already exist. Lock before the
  -- read-modify-write so concurrent saves cannot lose sibling JSON settings.
  select ds.service_price_settings
    into v_service_price_settings
    from public.dealer_settings ds
   where ds.dealer_id = p_dealer_id
   for update;

  if not found then
    raise exception 'coating_v34_not_configured' using errcode = 'P0002';
  end if;

  if v_service_price_settings is not null
     and jsonb_typeof(v_service_price_settings) <> 'object' then
    raise exception 'coating_v34_invalid_stored_payload' using errcode = '22023';
  end if;

  update public.dealer_settings
     set service_price_settings = jsonb_set(
           coalesce(v_service_price_settings, '{}'::jsonb),
           '{coating}',
           p_coating,
           true
         ),
         updated_at = now()
   where dealer_id = p_dealer_id;

  return p_coating;
end;
$$;

revoke all on function public.save_coating_v34_settings(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_coating_v34_settings(uuid, jsonb)
  to authenticated;
