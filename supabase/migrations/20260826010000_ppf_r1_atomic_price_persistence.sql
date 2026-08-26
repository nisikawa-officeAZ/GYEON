-- GDA PPF R1: fail-closed, atomic persistence boundary for dealer_settings.ppf_price_tables.
--
-- ppf_price_tables becomes a versioned PPF R1 price payload only. The legacy
-- five-map shape (plan_prices, film_coeff, rank_coeff, glass_prices,
-- parts_prices) is not accepted by this RPC. This function is intentionally
-- SECURITY DEFINER with no table grants: the caller cannot write the shared
-- override table directly. The function repeats the canonical owner/manager
-- authorization rule before taking any lock (dealer_staff is authoritative
-- when a row exists, including disabled/invited rows which block the
-- dealer_members fallback), matching save_coating_v34_settings.

drop function if exists public.save_ppf_r1_price_settings(uuid, jsonb);

create or replace function public.save_ppf_r1_price_settings(
  p_dealer_id uuid,
  p_ppf jsonb,
  p_coefficients jsonb
) returns jsonb
language plpgsql
security definer
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
  v_size_map jsonb;
  v_size_key text;
  v_size_price jsonb;
  v_part_key text;
  v_part_price jsonb;
  v_coefficient_key text;
  v_coefficient_value jsonb;
  v_catalog_item_id uuid;
begin
  if v_actor is null or p_dealer_id is null then
    raise exception 'ppf_r1_unauthorized' using errcode = '42501';
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
    raise exception 'ppf_r1_unauthorized' using errcode = '42501';
  end if;

  -- A dealer_staff row always wins. Non-active or non-owner/manager rows deny
  -- and must never fall back to dealer_members.
  select count(*), min(ds.status), min(ds.role)
    into v_staff_count, v_staff_status, v_staff_role
    from public.dealer_staff ds
   where ds.dealer_id = p_dealer_id
     and ds.user_id = v_actor;

  if v_staff_count > 1 then
    raise exception 'ppf_r1_unauthorized' using errcode = '42501';
  elsif v_staff_count = 1 then
    if v_staff_status <> 'active' or v_staff_role not in ('owner', 'manager') then
      raise exception 'ppf_r1_unauthorized' using errcode = '42501';
    end if;
  elsif v_member_role not in ('owner', 'manager') then
    raise exception 'ppf_r1_unauthorized' using errcode = '42501';
  end if;

  -- Exact top-level PPF R1 shape. Unknown, legacy five-map, and missing keys
  -- fail closed; this RPC never supplies a legacy or hardcoded default price.
  if p_ppf is null or jsonb_typeof(p_ppf) <> 'object' then
    raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
  end if;

  if (select coalesce(array_agg(k order by k), '{}'::text[])
        from jsonb_object_keys(p_ppf) as k)
     <> array['contractVersion', 'frontFullPricesBySize', 'fullBodyPricesBySize',
              'partialPartPrices'] then
    raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
  end if;

  if jsonb_typeof(p_ppf->'contractVersion') <> 'string'
     or p_ppf->>'contractVersion' <> '1.0' then
    raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
  end if;

  -- Validate the two independent seven-size price panels.
  foreach v_size_key in array array['frontFullPricesBySize', 'fullBodyPricesBySize'] loop
    v_size_map := p_ppf->v_size_key;
    if jsonb_typeof(v_size_map) <> 'object'
       or (select coalesce(array_agg(k order by k), '{}'::text[])
             from jsonb_object_keys(v_size_map) as k)
          <> array['L', 'LL', 'M', 'ML', 'S', 'SS', 'XL'] then
      raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
    end if;

    for v_size_price in select value from jsonb_each(v_size_map) loop
      if jsonb_typeof(v_size_price) = 'null' then
        continue;
      end if;
      if jsonb_typeof(v_size_price) <> 'number'
         or (v_size_price #>> '{}')::numeric < 0
         or (v_size_price #>> '{}')::numeric > 9007199254740991
         or trunc((v_size_price #>> '{}')::numeric) <> (v_size_price #>> '{}')::numeric then
        raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
      end if;
    end loop;
  end loop;

  -- Validate the independent partial-part price map: safe stable codes only.
  if jsonb_typeof(p_ppf->'partialPartPrices') <> 'object' then
    raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
  end if;

  for v_part_key, v_part_price in select key, value from jsonb_each(p_ppf->'partialPartPrices') loop
    -- Match the canonical wizard-catalog code contract. Seeded PPF part
    -- identities include hyphens (`front-bumper`, `door-mirror`).
    if v_part_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
      raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(v_part_price) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v_part_price) <> 'number'
       or (v_part_price #>> '{}')::numeric < 0
       or (v_part_price #>> '{}')::numeric > 9007199254740991
       or trunc((v_part_price #>> '{}')::numeric) <> (v_part_price #>> '{}')::numeric then
      raise exception 'ppf_r1_invalid_payload' using errcode = '22023';
    end if;
  end loop;

  -- Every offered GYEON product needs an explicit coefficient. A partial
  -- payload is rejected instead of silently treating an absent value as ×1.0.
  if p_coefficients is null or jsonb_typeof(p_coefficients) <> 'object'
     or (select coalesce(array_agg(k order by k), '{}'::text[])
           from jsonb_object_keys(p_coefficients) as k)
        <> array['contractVersion', 'installationCoefficientsBpByProductCode']
     or jsonb_typeof(p_coefficients->'contractVersion') <> 'string'
     or p_coefficients->>'contractVersion' <> '1.0'
     or jsonb_typeof(p_coefficients->'installationCoefficientsBpByProductCode') <> 'object'
     or (select coalesce(array_agg(k order by k), '{}'::text[])
           from jsonb_object_keys(p_coefficients->'installationCoefficientsBpByProductCode') as k)
        <> array['black', 'carbon', 'color-line', 'enhance', 'hybrid', 'matte', 'protect-plus', 'tint'] then
    raise exception 'ppf_r1_invalid_coefficients' using errcode = '22023';
  end if;

  for v_coefficient_key, v_coefficient_value in
    select key, value from jsonb_each(p_coefficients->'installationCoefficientsBpByProductCode')
  loop
    if jsonb_typeof(v_coefficient_value) <> 'number'
       or (v_coefficient_value #>> '{}')::numeric <= 0
       or (v_coefficient_value #>> '{}')::numeric > 2147483647
       or trunc((v_coefficient_value #>> '{}')::numeric) <> (v_coefficient_value #>> '{}')::numeric then
      raise exception 'ppf_r1_invalid_coefficients' using errcode = '22023';
    end if;
  end loop;

  -- Update-only by design: configuration must already exist. Lock before the
  -- read-modify-write so concurrent saves cannot lose sibling row state.
  perform 1
    from public.dealer_settings ds
   where ds.dealer_id = p_dealer_id
   for update;

  if not found then
    raise exception 'ppf_r1_not_configured' using errcode = 'P0002';
  end if;

  update public.dealer_settings
     set ppf_price_tables = p_ppf,
         updated_at = now()
   where dealer_id = p_dealer_id;

  -- Resolve immutable global identities inside the database and update only
  -- the coefficient column. Price and all eight coefficients share one
  -- transaction; any missing catalog product rolls back the whole save.
  for v_coefficient_key, v_coefficient_value in
    select key, value from jsonb_each(p_coefficients->'installationCoefficientsBpByProductCode')
  loop
    select i.id into v_catalog_item_id
      from public.wizard_catalog_items i
     where i.market = 'jp'
       and i.product_mode = 'gyeon'
       and i.kind = 'ppf_type_group'
       and i.owner_scope = 'global'
       and i.dealer_id is null
       and i.code = v_coefficient_key
       and i.ppf_type_group_id is not null
       and i.is_active is true
       and i.deleted_at is null;

    if not found then
      raise exception 'ppf_r1_catalog_product_missing' using errcode = 'P0002';
    end if;

    insert into public.dealer_wizard_catalog_overrides
      (dealer_id, catalog_item_id, install_coefficient_bp)
    values
      (p_dealer_id, v_catalog_item_id, (v_coefficient_value #>> '{}')::integer)
    on conflict (dealer_id, catalog_item_id) do update
      set install_coefficient_bp = excluded.install_coefficient_bp,
          updated_at = now();
  end loop;

  return jsonb_build_object('ppf', p_ppf, 'coefficients', p_coefficients);
end;
$$;

revoke all on function public.save_ppf_r1_price_settings(uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_ppf_r1_price_settings(uuid, jsonb, jsonb)
  to authenticated;
