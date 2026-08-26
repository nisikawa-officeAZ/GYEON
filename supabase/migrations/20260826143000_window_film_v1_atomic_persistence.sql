-- GDA Window Film V1: atomic dealer settings + film catalog persistence.
-- Source-only in C3. Applying this migration is a separate owner-approved gate.

drop function if exists public.save_window_film_v1_settings(uuid, jsonb, jsonb, integer);

create or replace function public.save_window_film_v1_settings(
  p_dealer_id uuid,
  p_settings jsonb,
  p_films jsonb,
  p_expected_revision integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_memberships integer;
  v_member_dealer uuid;
  v_member_role text;
  v_staff_count integer;
  v_staff_status text;
  v_staff_role text;
  v_mode text;
  v_service jsonb;
  v_current_revision integer;
  v_next_settings jsonb;
  v_area_code text;
  v_area jsonb;
  v_collection_key text;
  v_item jsonb;
  v_seen_codes text[] := '{}'::text[];
  v_seen_active_names text[] := '{}'::text[];
  v_seen_orders integer[] := '{}'::integer[];
  v_seen_item_ids uuid[] := '{}'::uuid[];
  v_film jsonb;
  v_item_id uuid;
  v_existing public.wizard_catalog_items%rowtype;
  v_code text;
  v_presentation jsonb;
  v_saved_films jsonb := '[]'::jsonb;
  v_normalized_collection jsonb;
  v_existing_codes text[];
  v_draft_prefix text;
  v_stable_prefix text;
  v_num numeric;
begin
  if v_actor is null or p_dealer_id is null then
    raise exception 'window_film_v1_unauthorized' using errcode = '42501';
  end if;
  select count(*), (array_agg(dm.dealer_id order by dm.dealer_id))[1], min(dm.role)
    into v_memberships, v_member_dealer, v_member_role
    from public.dealer_members dm
   where dm.user_id = v_actor and dm.status = 'active';
  if v_memberships <> 1 or v_member_dealer is distinct from p_dealer_id then
    raise exception 'window_film_v1_unauthorized' using errcode = '42501';
  end if;
  select count(*), min(ds.status), min(ds.role)
    into v_staff_count, v_staff_status, v_staff_role
    from public.dealer_staff ds
   where ds.dealer_id = p_dealer_id and ds.user_id = v_actor;
  if v_staff_count > 1
     or (v_staff_count = 1 and (v_staff_status <> 'active' or v_staff_role not in ('owner','manager')))
     or (v_staff_count = 0 and v_member_role not in ('owner','manager')) then
    raise exception 'window_film_v1_unauthorized' using errcode = '42501';
  end if;

  if p_settings is null or jsonb_typeof(p_settings) <> 'object'
     or (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(p_settings) k)
        <> array['areas','contractVersion','options','packages','revision']
     or p_settings->>'contractVersion' <> '1.0'
     or jsonb_typeof(p_settings->'revision') <> 'number'
     or p_expected_revision is null
     or (p_settings->>'revision')::numeric <> trunc((p_settings->>'revision')::numeric)
     or (p_settings->>'revision')::numeric <> p_expected_revision
     or p_expected_revision < 0
     or jsonb_typeof(p_settings->'areas') <> 'object'
     or (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(p_settings->'areas') k)
        <> array['front-door-glass','front-windshield','quarter-glass','rear-door-glass','rear-glass','sunroof','triangular-window'] then
    raise exception 'window_film_v1_invalid_settings' using errcode = '22023';
  end if;

  foreach v_area_code in array array['front-windshield','front-door-glass','rear-door-glass','triangular-window','quarter-glass','rear-glass','sunroof'] loop
    v_area := p_settings->'areas'->v_area_code;
    if jsonb_typeof(v_area) <> 'object'
       or (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(v_area) k)
          <> array['durationMinutes','isActive','priceYen']
       or jsonb_typeof(v_area->'isActive') <> 'boolean' then
      raise exception 'window_film_v1_invalid_area' using errcode = '22023';
    end if;
    foreach v_collection_key in array array['priceYen','durationMinutes'] loop
      if jsonb_typeof(v_area->v_collection_key) not in ('number','null') then
        raise exception 'window_film_v1_invalid_area' using errcode = '22023';
      end if;
      if jsonb_typeof(v_area->v_collection_key) = 'number' then
        v_num := (v_area->>v_collection_key)::numeric;
        if v_num <> trunc(v_num) or v_num < 0 or v_num > 9007199254740991 then
          raise exception 'window_film_v1_invalid_area' using errcode = '22023';
        end if;
      end if;
    end loop;
    if (v_area->>'isActive')::boolean
       and (jsonb_typeof(v_area->'priceYen') = 'null' or jsonb_typeof(v_area->'durationMinutes') = 'null') then
      raise exception 'window_film_v1_incomplete_active_area' using errcode = '22023';
    end if;
  end loop;

  foreach v_collection_key in array array['packages','options'] loop
    if jsonb_typeof(p_settings->v_collection_key) <> 'array' then
      raise exception 'window_film_v1_invalid_collection' using errcode = '22023';
    end if;
    v_seen_codes := '{}'::text[];
    v_seen_active_names := '{}'::text[];
    v_seen_orders := '{}'::integer[];
    for v_item in select value from jsonb_array_elements(p_settings->v_collection_key) loop
      if jsonb_typeof(v_item) <> 'object'
         or (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(v_item) k)
            <> array['code','displayOrder','durationMinutes','isActive','name','priceYen']
         or coalesce(v_item->>'code','') !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
         or btrim(coalesce(v_item->>'name','')) = ''
         or jsonb_typeof(v_item->'isActive') <> 'boolean'
         or jsonb_typeof(v_item->'displayOrder') <> 'number'
         or (v_item->>'displayOrder')::numeric <> trunc((v_item->>'displayOrder')::numeric)
         or (v_item->>'displayOrder')::numeric < 0
         or v_item->>'code' = any(v_seen_codes)
         or ((v_item->>'isActive')::boolean and lower(btrim(v_item->>'name')) = any(v_seen_active_names))
         or (v_item->>'displayOrder')::integer = any(v_seen_orders) then
        raise exception 'window_film_v1_invalid_collection_item' using errcode = '22023';
      end if;
      v_seen_codes := array_append(v_seen_codes, v_item->>'code');
      if (v_item->>'isActive')::boolean then
        v_seen_active_names := array_append(v_seen_active_names, lower(btrim(v_item->>'name')));
      end if;
      v_seen_orders := array_append(v_seen_orders, (v_item->>'displayOrder')::integer);
      foreach v_area_code in array array['priceYen','durationMinutes'] loop
        if jsonb_typeof(v_item->v_area_code) not in ('number','null') then
          raise exception 'window_film_v1_invalid_collection_item' using errcode = '22023';
        end if;
        if jsonb_typeof(v_item->v_area_code) = 'number' then
          v_num := (v_item->>v_area_code)::numeric;
          if v_num <> trunc(v_num) or v_num < 0 or v_num > 9007199254740991 then
            raise exception 'window_film_v1_invalid_collection_item' using errcode = '22023';
          end if;
        end if;
      end loop;
      if (v_item->>'isActive')::boolean
         and (jsonb_typeof(v_item->'priceYen') = 'null' or jsonb_typeof(v_item->'durationMinutes') = 'null') then
        raise exception 'window_film_v1_incomplete_active_item' using errcode = '22023';
      end if;
    end loop;
  end loop;

  if p_films is null or jsonb_typeof(p_films) <> 'array' then
    raise exception 'window_film_v1_invalid_films' using errcode = '22023';
  end if;
  v_seen_orders := '{}'::integer[];
  v_seen_item_ids := '{}'::uuid[];
  v_seen_active_names := '{}'::text[];

  select ds.service_price_settings into v_service
    from public.dealer_settings ds
   where ds.dealer_id = p_dealer_id
   for update;
  if not found then raise exception 'window_film_v1_not_configured' using errcode = 'P0002'; end if;
  v_current_revision := coalesce((v_service->'window_film_v1'->>'revision')::integer, 0);
  if v_current_revision <> p_expected_revision then
    raise exception 'window_film_v1_revision_conflict' using errcode = '40001';
  end if;
  -- Only the database issues new package/option codes. Existing codes remain stable;
  -- a caller cannot smuggle in an arbitrary new persistent code through the RPC.
  v_next_settings := p_settings;
  foreach v_collection_key in array array['packages','options'] loop
    v_draft_prefix := case when v_collection_key = 'packages' then 'draft-package-' else 'draft-option-' end;
    v_stable_prefix := case when v_collection_key = 'packages' then 'film-package-' else 'film-option-' end;
    select coalesce(array_agg(value->>'code'), '{}'::text[])
      into v_existing_codes
      from jsonb_array_elements(coalesce(v_service->'window_film_v1'->v_collection_key, '[]'::jsonb));
    v_normalized_collection := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(p_settings->v_collection_key) loop
      if v_item->>'code' like v_draft_prefix || '%' then
        v_item := jsonb_set(v_item, '{code}', to_jsonb(v_stable_prefix || gen_random_uuid()::text), false);
      elsif not (v_item->>'code' = any(v_existing_codes)) then
        raise exception 'window_film_v1_unissued_custom_code' using errcode = '22023';
      end if;
      v_normalized_collection := v_normalized_collection || jsonb_build_array(v_item);
    end loop;
    v_next_settings := jsonb_set(v_next_settings, array[v_collection_key], v_normalized_collection, false);
  end loop;
  v_next_settings := jsonb_set(v_next_settings, '{revision}', to_jsonb(p_expected_revision + 1), false);

  select d.product_mode into v_mode from public.dealers d where d.id = p_dealer_id;
  if v_mode is null then raise exception 'window_film_v1_dealer_missing' using errcode = 'P0002'; end if;

  for v_film in select value from jsonb_array_elements(p_films) loop
    if jsonb_typeof(v_film) <> 'object'
       or (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(v_film) k)
          <> array['code','displayOrder','expectedUpdatedAt','installationCoefficientBp','irCutPercent','isActive','itemId','name','uvCutPercent']
       or btrim(coalesce(v_film->>'name','')) = ''
       or char_length(btrim(v_film->>'name')) > 200
       or jsonb_typeof(v_film->'installationCoefficientBp') <> 'number'
       or (v_film->>'installationCoefficientBp')::numeric <> trunc((v_film->>'installationCoefficientBp')::numeric)
       or (v_film->>'installationCoefficientBp')::integer not between 1000 and 50000
       or jsonb_typeof(v_film->'isActive') <> 'boolean'
       or ((v_film->>'isActive')::boolean and lower(btrim(v_film->>'name')) = any(v_seen_active_names))
       or jsonb_typeof(v_film->'displayOrder') <> 'number'
       or (v_film->>'displayOrder')::numeric <> trunc((v_film->>'displayOrder')::numeric)
       or (v_film->>'displayOrder')::numeric < 0
       or (v_film->>'displayOrder')::integer = any(v_seen_orders)
       or jsonb_typeof(v_film->'itemId') not in ('string','null')
       or jsonb_typeof(v_film->'code') not in ('string','null')
       or jsonb_typeof(v_film->'expectedUpdatedAt') not in ('string','null') then
      raise exception 'window_film_v1_invalid_film' using errcode = '22023';
    end if;
    v_seen_orders := array_append(v_seen_orders, (v_film->>'displayOrder')::integer);
    if (v_film->>'isActive')::boolean then
      v_seen_active_names := array_append(v_seen_active_names, lower(btrim(v_film->>'name')));
    end if;
    foreach v_area_code in array array['irCutPercent','uvCutPercent'] loop
      if jsonb_typeof(v_film->v_area_code) not in ('number','null')
         or (jsonb_typeof(v_film->v_area_code) = 'number' and ((v_film->>v_area_code)::numeric <> trunc((v_film->>v_area_code)::numeric) or (v_film->>v_area_code)::integer not between 0 and 100)) then
        raise exception 'window_film_v1_invalid_film' using errcode = '22023';
      end if;
    end loop;
    v_presentation := jsonb_strip_nulls(jsonb_build_object(
      'irCutPercent', v_film->'irCutPercent',
      'uvCutPercent', v_film->'uvCutPercent'
    ));

    if jsonb_typeof(v_film->'itemId') = 'null' then
      if jsonb_typeof(v_film->'code') <> 'null' or jsonb_typeof(v_film->'expectedUpdatedAt') <> 'null' then
        raise exception 'window_film_v1_invalid_new_film' using errcode = '22023';
      end if;
      v_item_id := gen_random_uuid();
      v_code := 'film-' || v_item_id::text;
      insert into public.wizard_catalog_items (
        id, market, product_mode, kind, owner_scope, dealer_id, code,
        label_owner, price_owner, pricing_ref, label_ja, display_order, is_active,
        default_unit_price, editable_unit_price, priceable, quantity_required,
        min_quantity, max_quantity, duration_minutes, presentation, install_coefficient_bp
      ) values (
        v_item_id, 'jp', v_mode, 'film_type', 'dealer', p_dealer_id, v_code,
        'wizard_catalog', 'wizard_catalog', null, btrim(v_film->>'name'),
        (v_film->>'displayOrder')::integer, (v_film->>'isActive')::boolean,
        null, false, true, false, 1, null, null, v_presentation,
        (v_film->>'installationCoefficientBp')::integer
      );
      insert into public.wizard_catalog_item_ranks (catalog_item_id, rank)
        select v_item_id, unnest(wkp.permitted_ranks)
          from public.wizard_kind_policy wkp
         where wkp.product_mode = v_mode and wkp.kind = 'film_type';
      insert into public.wizard_catalog_item_categories (catalog_item_id, category_id) values (v_item_id, 'window');
      v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);
    else
      v_item_id := (v_film->>'itemId')::uuid;
      if v_item_id = any(v_seen_item_ids) then
        raise exception 'window_film_v1_duplicate_film' using errcode = '22023';
      end if;
      v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);
      select * into v_existing from public.wizard_catalog_items i where i.id = v_item_id for update;
      if not found or v_existing.dealer_id is distinct from p_dealer_id or v_existing.kind <> 'film_type'
         or v_existing.owner_scope <> 'dealer' or v_existing.deleted_at is not null
         or v_existing.code is distinct from v_film->>'code'
         or (v_film->>'expectedUpdatedAt') is null
         or v_existing.updated_at is distinct from (v_film->>'expectedUpdatedAt')::timestamptz then
        raise exception 'window_film_v1_film_conflict' using errcode = '40001';
      end if;
      v_code := v_existing.code;
      v_presentation := (v_existing.presentation - 'irCutPercent' - 'uvCutPercent') || v_presentation;
      update public.wizard_catalog_items set
        label_ja = btrim(v_film->>'name'),
        display_order = (v_film->>'displayOrder')::integer,
        is_active = (v_film->>'isActive')::boolean,
        presentation = v_presentation,
        install_coefficient_bp = (v_film->>'installationCoefficientBp')::integer,
        updated_at = now()
      where id = v_item_id;
    end if;
    select jsonb_build_object(
      'itemId', i.id, 'code', i.code, 'name', i.label_ja,
      'installationCoefficientBp', i.install_coefficient_bp,
      'irCutPercent', i.presentation->'irCutPercent',
      'uvCutPercent', i.presentation->'uvCutPercent',
      'isActive', i.is_active, 'displayOrder', i.display_order,
      'expectedUpdatedAt', i.updated_at
    ) into v_item from public.wizard_catalog_items i where i.id = v_item_id;
    v_saved_films := v_saved_films || jsonb_build_array(v_item);
  end loop;

  -- Omitting an existing dealer-owned film is an explicit archive request. Keep
  -- its identity and history, but remove it from every live wizard read.
  update public.wizard_catalog_items i
     set is_active = false,
         deleted_at = now(),
         updated_at = now()
   where i.dealer_id = p_dealer_id
     and i.owner_scope = 'dealer'
     and i.kind = 'film_type'
     and i.deleted_at is null
     and not (i.id = any(v_seen_item_ids));

  update public.dealer_settings
     set service_price_settings = jsonb_set(coalesce(v_service, '{}'::jsonb), '{window_film_v1}', v_next_settings, true),
         updated_at = now()
   where dealer_id = p_dealer_id;
  perform public.wiz_bump_dealer_revision(p_dealer_id);
  return jsonb_build_object('settings', v_next_settings, 'films', v_saved_films);
end;
$$;

revoke all on function public.save_window_film_v1_settings(uuid, jsonb, jsonb, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.save_window_film_v1_settings(uuid, jsonb, jsonb, integer)
  to authenticated;
