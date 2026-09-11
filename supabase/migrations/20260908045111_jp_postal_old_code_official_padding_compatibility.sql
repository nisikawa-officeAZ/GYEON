-- Accept the exact fixed-width legacy postal-code shapes present in Japan Post's official
-- `utf_ken_all` CSV while preserving every source character verbatim.
--
-- Observed official shapes:
--   * five ASCII digits
--   * three ASCII digits followed by exactly two ASCII spaces
--
-- This is a corrective migration. The original migration remains immutable.

begin;

alter table private.jp_postal_master
  drop constraint jp_postal_master_old_postal_code_format;

alter table private.jp_postal_master
  add constraint jp_postal_master_old_postal_code_format
  check (old_postal_code ~ '^(\d{5}|\d{3} {2})$');

create or replace function public.jp_postal_import_append(p_batch_id uuid, p_sequence integer, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_appended_sequences integer[];
  v_inserted int;
begin
  if p_sequence is null or p_sequence < 0 then
    return jsonb_build_object('result_code', 'INVALID_SEQUENCE');
  end if;

  select status, appended_sequences into v_status, v_appended_sequences
  from private.jp_postal_import_batches
  where id = p_batch_id
  for update;
  if not found then
    return jsonb_build_object('result_code', 'UNKNOWN_BATCH');
  end if;
  if v_status not in ('staged', 'validating') then
    return jsonb_build_object('result_code', 'BATCH_NOT_APPENDABLE');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) is distinct from 'array' then
    return jsonb_build_object('result_code', 'INVALID_ROWS_PAYLOAD');
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    return jsonb_build_object('result_code', 'INVALID_BATCH_SIZE');
  end if;

  if p_sequence = ANY(v_appended_sequences) then
    return jsonb_build_object('result_code', 'OK', 'appended_count', 0, 'already_appended', true);
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as r
    where jsonb_typeof(r) is distinct from 'object'
      or not (
        coalesce(jsonb_typeof(r -> 'jisCode'), '') = 'string' and (r ->> 'jisCode') ~ '^\d{5}$'
        and coalesce(jsonb_typeof(r -> 'postalCode'), '') = 'string' and (r ->> 'postalCode') ~ '^\d{7}$'
        and coalesce(jsonb_typeof(r -> 'oldPostalCode'), '') = 'string'
        and (r ->> 'oldPostalCode') ~ '^(\d{5}|\d{3} {2})$'
        and coalesce(jsonb_typeof(r -> 'prefectureKanji'), '') = 'string' and coalesce(r ->> 'prefectureKanji', '') <> ''
        and coalesce(jsonb_typeof(r -> 'cityKanji'), '') = 'string' and coalesce(r ->> 'cityKanji', '') <> ''
        and coalesce(jsonb_typeof(r -> 'townKanji'), '') = 'string' and coalesce(r ->> 'townKanji', '') <> ''
        and coalesce(jsonb_typeof(r -> 'prefectureKana'), '') = 'string' and coalesce(r ->> 'prefectureKana', '') <> ''
        and coalesce(jsonb_typeof(r -> 'cityKana'), '') = 'string' and coalesce(r ->> 'cityKana', '') <> ''
        and coalesce(jsonb_typeof(r -> 'townKana'), '') = 'string' and coalesce(r ->> 'townKana', '') <> ''
        and coalesce(jsonb_typeof(r -> 'flagMultiPostalPerTown'), '') = 'string' and (r ->> 'flagMultiPostalPerTown') in ('0', '1')
        and coalesce(jsonb_typeof(r -> 'flagKoazaBanchi'), '') = 'string' and (r ->> 'flagKoazaBanchi') in ('0', '1')
        and coalesce(jsonb_typeof(r -> 'flagHasChome'), '') = 'string' and (r ->> 'flagHasChome') in ('0', '1')
        and coalesce(jsonb_typeof(r -> 'flagMultiTownPerPostal'), '') = 'string' and (r ->> 'flagMultiTownPerPostal') in ('0', '1')
        and coalesce(jsonb_typeof(r -> 'updateFlag'), '') = 'string' and (r ->> 'updateFlag') in ('0', '1', '2')
        and coalesce(jsonb_typeof(r -> 'changeReasonCode'), '') = 'string' and (r ->> 'changeReasonCode') in ('0', '1', '2', '3', '4', '5', '6')
      )
  ) then
    return jsonb_build_object('result_code', 'INVALID_ROW_PAYLOAD');
  end if;

  update private.jp_postal_import_batches
    set status = 'validating', appended_sequences = appended_sequences || p_sequence
    where id = p_batch_id;

  insert into private.jp_postal_master (
    batch_id, jis_code, old_postal_code, postal_code,
    prefecture_kana, city_kana, town_kana, prefecture_kanji, city_kanji, town_kanji,
    flag_multi_postal_per_town, flag_koaza_banchi, flag_has_chome, flag_multi_town_per_postal,
    update_flag, change_reason_code,
    postal_code_norm, address_key, address_prefix_head, is_non_specific_town
  )
  select
    p_batch_id,
    d.r ->> 'jisCode', d.r ->> 'oldPostalCode', d.r ->> 'postalCode',
    d.r ->> 'prefectureKana', d.r ->> 'cityKana', d.r ->> 'townKana',
    d.r ->> 'prefectureKanji', d.r ->> 'cityKanji', d.r ->> 'townKanji',
    (d.r ->> 'flagMultiPostalPerTown') = '1', (d.r ->> 'flagKoazaBanchi') = '1',
    (d.r ->> 'flagHasChome') = '1', (d.r ->> 'flagMultiTownPerPostal') = '1',
    (d.r ->> 'updateFlag')::smallint, (d.r ->> 'changeReasonCode')::smallint,
    d.r ->> 'postalCode',
    case when d.is_non_specific then null else d.derived_address_key end,
    case when d.is_non_specific then null else left(d.derived_address_key, 8) end,
    d.is_non_specific
  from (
    select
      r,
      (r ->> 'prefectureKanji') || (r ->> 'cityKanji') || (r ->> 'townKanji') as derived_address_key,
      (r ->> 'townKanji') = ANY(ARRAY[
        '以下に掲載がない場合', '市区町村名の次に番地がくる場合', '市区町村名一円'
      ]) as is_non_specific
    from jsonb_array_elements(p_rows) as r
  ) as d;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object('result_code', 'OK', 'appended_count', v_inserted, 'already_appended', false);
end;
$$;

revoke all on function public.jp_postal_import_append(uuid, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_import_append(uuid, integer, jsonb) to service_role;

commit;
