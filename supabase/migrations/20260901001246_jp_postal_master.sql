-- GDA-2A-OCR-POSTAL-MASTER-R2 — Japan Post internal postal master.
--
-- Deterministic, fail-closed, versioned-batch postal/address lookup. The master is never stored
-- inside customer records and is never populated by a runtime external call: only the controlled
-- import CLI (scripts/postal-master/import-japan-post.ts) writes to it, through the service-role-only
-- RPCs below, from an already-downloaded, checksum-verified official Japan Post `utf_ken_all` CSV.
--
-- ── DEALER-MEMBERSHIP AUTHORITY REUSE ─────────────────────────────────────────────────────────
-- The active-member guard below calls the EXISTING `public.wiz_is_any_active_member()` primitive
-- (already granted `EXECUTE` to `authenticated`; confirmed present via the allowlisted
-- `supabase/tests/grant_rls_role_matrix.test.sql` `expected_function_execute_acl` fixture, row
-- `('public', 'wiz_is_any_active_member', '', 'authenticated', 'EXECUTE', FALSE)`) rather than a new
-- private helper re-deriving the same fact from `public.dealer_members` directly. Reusing the
-- already-accepted authority means this migration cannot silently drift from the rest of the
-- schema's definition of "actively membered", and this phase's restricted read access never needed
-- to guess a table/column shape for it.

create schema if not exists private;

-- The `private` schema is shared with earlier migrations. Never reset schema-wide privileges here:
-- in particular, the GYEON-order contract grants authenticated callers USAGE so its narrow
-- `private.gyeon_order_v3_can_read_dealer(uuid)` RLS helper remains callable. Postal import code
-- needs only the following additive service-role schema grant; postal tables remain object-denied.
grant usage on schema private to service_role;

-- ── Tables ────────────────────────────────────────────────────────────────────────────────────

create table private.jp_postal_import_batches (
  id                     uuid primary key default gen_random_uuid(),
  source_date            date not null,
  sha256                 text not null,
  expected_row_count     integer not null check (expected_row_count >= 0),
  actual_row_count       integer,
  status                 text not null default 'staged'
                           check (status in ('staged', 'validating', 'validated', 'promoted', 'rejected', 'rolled_back')),
  -- Append-sequence evidence (repair A1-1): every sequence number accepted by
  -- `jp_postal_import_append` is recorded here so a replayed/resumed `append` call for a sequence
  -- already applied is a zero-write, stable-result-code no-op rather than a silent duplicate insert.
  appended_sequences     integer[] not null default '{}',
  created_at             timestamptz not null default now(),
  validated_at           timestamptz,
  promoted_at            timestamptz,
  rolled_back_at         timestamptz,
  constraint jp_postal_import_batches_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint jp_postal_import_batches_identity_unique unique (source_date, sha256)
);

-- Identity fields (source_date/sha256/expected_row_count/id) are immutable once inserted; only
-- status/timestamp/appended-sequence progression is permitted. Enforced by trigger, not merely by
-- convention.
create or replace function private.jp_postal_import_batches_prevent_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.source_date is distinct from old.source_date
    or new.sha256 is distinct from old.sha256
    or new.expected_row_count is distinct from old.expected_row_count
  then
    raise exception 'jp_postal_import_batches identity fields are immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger jp_postal_import_batches_immutable_identity
before update on private.jp_postal_import_batches
for each row execute function private.jp_postal_import_batches_prevent_identity_change();

alter table private.jp_postal_import_batches enable row level security;

-- One row per imported source record, keyed to the immutable batch that produced it. Rows are
-- APPEND-ONLY: this migration never grants UPDATE or DELETE on this table to any role, including
-- service_role, so "promotion never rewrites/deletes accepted rows" is a grant-level guarantee,
-- not merely an application convention.
create table private.jp_postal_master (
  id                            bigint generated always as identity primary key,
  batch_id                      uuid not null references private.jp_postal_import_batches(id),

  -- Exact official utf_ken_all source columns, preserved verbatim (including leading zeroes).
  jis_code                      text not null,
  old_postal_code               text not null,
  postal_code                   text not null,
  prefecture_kana                text not null,
  city_kana                      text not null,
  town_kana                      text not null,
  prefecture_kanji                text not null,
  city_kanji                      text not null,
  town_kanji                      text not null,
  flag_multi_postal_per_town     boolean not null,
  flag_koaza_banchi              boolean not null,
  flag_has_chome                 boolean not null,
  flag_multi_town_per_postal     boolean not null,
  update_flag                   smallint not null check (update_flag in (0, 1, 2)),
  change_reason_code            smallint not null check (change_reason_code between 0 and 6),

  -- Derived normalized lookup keys, stored BESIDE the source values (never replacing them).
  postal_code_norm              text not null,
  address_key                   text,
  address_prefix_head           text,
  is_non_specific_town          boolean not null default false,

  created_at                    timestamptz not null default now(),

  constraint jp_postal_master_jis_code_format check (jis_code ~ '^\d{5}$'),
  constraint jp_postal_master_postal_code_format check (postal_code ~ '^\d{7}$'),
  constraint jp_postal_master_postal_code_norm_format check (postal_code_norm ~ '^\d{7}$'),
  constraint jp_postal_master_old_postal_code_format check (old_postal_code ~ '^\d{0,5}$')
);

-- Forward lookup: filter to the active batch, then the exact normalized postal code.
create index jp_postal_master_batch_postal_idx on private.jp_postal_master (batch_id, postal_code_norm);
-- Reverse lookup index-narrowing prefilter (see the two lookup functions below).
create index jp_postal_master_batch_prefix_idx on private.jp_postal_master (batch_id, address_prefix_head);

alter table private.jp_postal_master enable row level security;

-- Singleton pointer to the one active, validated/promoted batch. Promotion/rollback update ONLY
-- this row; they never rewrite or delete `jp_postal_master` rows.
create table private.jp_postal_active_batch (
  singleton   boolean primary key default true check (singleton),
  batch_id    uuid references private.jp_postal_import_batches(id),
  updated_at  timestamptz not null default now()
);

insert into private.jp_postal_active_batch (singleton, batch_id) values (true, null)
on conflict (singleton) do nothing;

alter table private.jp_postal_active_batch enable row level security;

-- No role -- including service_role -- receives a direct table grant on any private table (repair
-- A1-4). service_role writes exclusively through the SECURITY DEFINER import RPCs below, whose
-- function owner privileges (not the caller's own table grants) perform the actual read/write.
revoke all on table private.jp_postal_import_batches from public, anon, authenticated, service_role;
revoke all on table private.jp_postal_master from public, anon, authenticated, service_role;
revoke all on table private.jp_postal_active_batch from public, anon, authenticated, service_role;

-- ── Public RPCs — authenticated forward/reverse lookup ───────────────────────────────────────
--
-- Both functions independently re-verify actor + active dealer membership INSIDE the function body
-- (not merely via GRANT EXECUTE), so a direct PostgREST call using any authenticated-but-non-member
-- token is refused on the same terms as a call routed through the Server Action.

create or replace function public.jp_postal_master_lookup_forward(p_postal_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_active_batch uuid;
  v_norm text;
  v_count int;
  v_distinct_addr_count int;
  v_ambiguous boolean;
  v_address jsonb;
begin
  if not public.wiz_is_any_active_member() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_norm := regexp_replace(coalesce(p_postal_code, ''), '[^0-9]', '', 'g');
  if v_norm !~ '^\d{7}$' then
    return jsonb_build_object('result_code', 'INVALID_INPUT');
  end if;

  select batch_id into v_active_batch from private.jp_postal_active_batch where singleton;
  if v_active_batch is null then
    return jsonb_build_object('result_code', 'MASTER_UNAVAILABLE');
  end if;

  -- Repair A1-7: uniqueness is decided by distinct SPECIFIC address keys, not raw row count.
  -- Multiple official rows that reduce to the same one specific address, with no flag-13
  -- (`flag_multi_town_per_postal`) or non-specific-town conflict, may still return FOUND.
  select count(*), count(distinct address_key) filter (where is_non_specific_town = false),
    bool_or(flag_multi_town_per_postal or is_non_specific_town)
    into v_count, v_distinct_addr_count, v_ambiguous
  from private.jp_postal_master
  where batch_id = v_active_batch and postal_code_norm = v_norm;

  if v_count = 0 then
    return jsonb_build_object('result_code', 'NOT_FOUND');
  end if;
  if v_ambiguous or v_distinct_addr_count is distinct from 1 then
    return jsonb_build_object('result_code', 'AMBIGUOUS');
  end if;

  select jsonb_build_object(
    'postal_code', postal_code_norm,
    'prefecture_kanji', prefecture_kanji,
    'city_kanji', city_kanji,
    'town_kanji', town_kanji,
    'prefecture_kana', prefecture_kana,
    'city_kana', city_kana,
    'town_kana', town_kana
  ) into v_address
  from private.jp_postal_master
  where batch_id = v_active_batch and postal_code_norm = v_norm
  limit 1;

  return jsonb_build_object('result_code', 'FOUND', 'address', v_address);
end;
$$;

revoke all on function public.jp_postal_master_lookup_forward(text) from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_master_lookup_forward(text) to authenticated;

create or replace function public.jp_postal_master_lookup_reverse(p_address text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_active_batch uuid;
  v_norm text;
  -- Index-narrowing prefix CANDIDATES, one per head length from 1 up to the fixed maximum. MUST
  -- equal JP_POSTAL_ADDRESS_PREFIX_HEAD_LENGTH in src/lib/geo/jp-postal-master-contract.ts
  -- (currently 8). A master row's stored `address_prefix_head` is `left(address_key, 8)`, which is
  -- SHORTER than 8 characters whenever `address_key` itself is shorter than 8 -- matching only
  -- `left(v_norm, 8)` would then silently miss it (repair A1-2: the short-address false negative).
  -- Generating every candidate head length keeps the `(batch_id, address_prefix_head)` btree index
  -- usable via `= ANY(...)` while still reaching a master row whose head is naturally shorter.
  v_prefix_candidates text[];
  v_best_len int;
  v_conflict boolean;
  v_postal_codes text[];
begin
  if not public.wiz_is_any_active_member() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_norm := btrim(coalesce(p_address, ''));
  if v_norm = '' then
    return jsonb_build_object('result_code', 'INVALID_INPUT');
  end if;

  select batch_id into v_active_batch from private.jp_postal_active_batch where singleton;
  if v_active_batch is null then
    return jsonb_build_object('result_code', 'MASTER_UNAVAILABLE');
  end if;

  select array_agg(left(v_norm, gs)) into v_prefix_candidates
  from generate_series(1, least(8, length(v_norm))) as gs;

  select max(length(address_key)) into v_best_len
  from private.jp_postal_master
  where batch_id = v_active_batch
    and is_non_specific_town = false
    and address_prefix_head = ANY(v_prefix_candidates)
    and starts_with(v_norm, address_key);

  if v_best_len is null then
    return jsonb_build_object('result_code', 'NOT_FOUND');
  end if;

  select bool_or(flag_multi_postal_per_town), array_agg(distinct postal_code_norm)
    into v_conflict, v_postal_codes
  from private.jp_postal_master
  where batch_id = v_active_batch
    and is_non_specific_town = false
    and address_prefix_head = ANY(v_prefix_candidates)
    and starts_with(v_norm, address_key)
    and length(address_key) = v_best_len;

  if v_conflict or array_length(v_postal_codes, 1) is distinct from 1 then
    return jsonb_build_object('result_code', 'AMBIGUOUS');
  end if;

  return jsonb_build_object('result_code', 'FOUND', 'postal_code', v_postal_codes[1]);
end;
$$;

revoke all on function public.jp_postal_master_lookup_reverse(text) from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_master_lookup_reverse(text) to authenticated;

-- ── Public RPCs — service-role-only controlled import ────────────────────────────────────────
--
-- Authorization for the five import RPCs below is enforced EXCLUSIVELY by the
-- `revoke all ... grant execute ... to service_role` posture on each function (Postgres/PostgREST
-- grant-level authorization), never by an internal `auth.role()` check. `auth.role()` depends on
-- Supabase Auth request-context helpers that are absent from a disposable pgTAP session and from any
-- plain `SET ROLE`/`SET SESSION AUTHORIZATION` switch, so it cannot be exercised or proven there; the
-- GRANT/REVOKE posture works identically in PostgREST and in a bare `SET LOCAL ROLE service_role`.

create or replace function public.jp_postal_import_status(
  p_source_date date,
  p_sha256 text,
  p_expected_row_count integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_batch private.jp_postal_import_batches%rowtype;
  v_active_batch_id uuid;
begin
  if p_source_date is null then
    return jsonb_build_object('result_code', 'INVALID_SOURCE_DATE');
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('result_code', 'INVALID_SHA256');
  end if;
  if p_expected_row_count is null or p_expected_row_count < 0 then
    return jsonb_build_object('result_code', 'INVALID_EXPECTED_ROW_COUNT');
  end if;

  select * into v_batch
  from private.jp_postal_import_batches
  where source_date = p_source_date and sha256 = p_sha256;

  if not found then
    return jsonb_build_object(
      'result_code', 'NOT_FOUND',
      'expected_row_count', p_expected_row_count,
      'appended_sequences', '[]'::jsonb,
      'is_active', false
    );
  end if;

  if v_batch.expected_row_count is distinct from p_expected_row_count then
    return jsonb_build_object(
      'result_code', 'EXPECTED_ROW_COUNT_MISMATCH',
      'batch_id', v_batch.id,
      'status', v_batch.status,
      'expected_row_count', v_batch.expected_row_count,
      'appended_sequences', to_jsonb(v_batch.appended_sequences),
      'is_active', false
    );
  end if;

  select batch_id into v_active_batch_id
  from private.jp_postal_active_batch
  where singleton;

  return jsonb_build_object(
    'result_code', 'OK',
    'batch_id', v_batch.id,
    'status', v_batch.status,
    'expected_row_count', v_batch.expected_row_count,
    'appended_sequences', to_jsonb(v_batch.appended_sequences),
    'is_active', v_active_batch_id is not distinct from v_batch.id
  );
end;
$$;

revoke all on function public.jp_postal_import_status(date, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_import_status(date, text, integer) to service_role;

create or replace function public.jp_postal_import_begin(p_source_date date, p_sha256 text, p_expected_row_count integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing record;
  v_active_batch_id uuid;
  v_batch_id uuid;
begin
  if p_source_date is null then
    return jsonb_build_object('result_code', 'INVALID_SOURCE_DATE');
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('result_code', 'INVALID_SHA256');
  end if;
  if p_expected_row_count is null or p_expected_row_count < 0 then
    return jsonb_build_object('result_code', 'INVALID_EXPECTED_ROW_COUNT');
  end if;

  -- Repair A1-5: lock the identity row (if one already exists) for the rest of this transaction so a
  -- concurrent begin/append/finalize/rollback against the same batch serializes instead of racing.
  select id, status, expected_row_count into v_existing
  from private.jp_postal_import_batches
  where source_date = p_source_date and sha256 = p_sha256
  for update;

  if not found then
    -- Repair R2: a previously absent identity locks no row above, so two concurrent first-time begins
    -- can both reach here. Let the unique index pick one winner via ON CONFLICT DO NOTHING instead of
    -- leaking a raw 23505 to the loser; the loser re-reads the winner's row below and falls through to
    -- the same status-result block as any other pre-existing identity.
    insert into private.jp_postal_import_batches (source_date, sha256, expected_row_count, status)
    values (p_source_date, p_sha256, p_expected_row_count, 'staged')
    on conflict (source_date, sha256) do nothing
    returning id into v_batch_id;

    if v_batch_id is not null then
      return jsonb_build_object('result_code', 'OK', 'batch_id', v_batch_id, 'already_promoted', false);
    end if;

    select id, status, expected_row_count into v_existing
    from private.jp_postal_import_batches
    where source_date = p_source_date and sha256 = p_sha256
    for update;
  end if;

  if v_existing.expected_row_count is distinct from p_expected_row_count then
    return jsonb_build_object('result_code', 'EXPECTED_ROW_COUNT_MISMATCH');
  end if;
  if v_existing.status in ('staged', 'validating') then
    -- Begin remains a stable non-OK result for an identity another runner may have created. The
    -- caller must re-read the service-role status RPC once and resume only the exact identity/count;
    -- begin itself never exposes a writable batch id through this race outcome.
    return jsonb_build_object('result_code', 'IMPORT_IN_PROGRESS');
  end if;
  if v_existing.status = 'promoted' then
    select batch_id into v_active_batch_id from private.jp_postal_active_batch where singleton;
    if v_active_batch_id = v_existing.id then
      return jsonb_build_object('result_code', 'OK', 'batch_id', v_existing.id, 'already_promoted', true);
    end if;
  end if;
  -- promoted-but-superseded, rejected, or rolled_back: this exact (date, checksum) identity
  -- already reached a terminal outcome that is not the current active batch.
  return jsonb_build_object('result_code', 'CHECKSUM_REPLAY_CONFLICT');
end;
$$;

revoke all on function public.jp_postal_import_begin(date, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_import_begin(date, text, integer) to service_role;

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
  -- Repair A2-4: NULL is not merely "not negative" -- `NULL < 0` and `NULL = ANY(...)` both evaluate
  -- to NULL (falsy in a plain IF), so a NULL sequence would otherwise silently reach the append
  -- below and leave ambiguous sequence evidence. Reject it explicitly before any other check.
  if p_sequence is null or p_sequence < 0 then
    return jsonb_build_object('result_code', 'INVALID_SEQUENCE');
  end if;

  -- Repair A1-5: lock the batch row for the rest of this transaction. This serializes concurrent
  -- append calls against the same batch AND blocks a concurrent finalize from counting rows while an
  -- append is still in flight (finalize takes the identical `for update` lock on this row below).
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
  -- Repair A2-4: a NULL p_rows already satisfies `jsonb_typeof(NULL) IS DISTINCT FROM 'array'`, but
  -- the explicit `p_rows is null` disjunct keeps that guarantee independent of jsonb_typeof's NULL
  -- propagation semantics.
  if p_rows is null or jsonb_typeof(p_rows) is distinct from 'array' then
    return jsonb_build_object('result_code', 'INVALID_ROWS_PAYLOAD');
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    return jsonb_build_object('result_code', 'INVALID_BATCH_SIZE');
  end if;

  -- A sequence already recorded as appended is a successful, explicit, zero-row-write no-op. The
  -- caller may have learned an older status immediately before another importer appended the same
  -- sequence, so returning a failure here would make the resume protocol race-prone.
  if p_sequence = ANY(v_appended_sequences) then
    return jsonb_build_object('result_code', 'OK', 'appended_count', 0, 'already_appended', true);
  end if;

  -- Repair A1-6: fail-closed payload validation, evaluated over every row BEFORE any insert, so an
  -- invalid row anywhere in the batch rejects the whole call with zero rows written. Flag columns
  -- 10-13 must be the exact official '0'/'1' strings -- never coerced to false by an `= '1'`
  -- equality comparison, which would silently accept e.g. '2' or 'true' as false.
  -- Repair A2-4: `r ->> key` on a non-object element or a missing/NULL-typed key returns SQL NULL,
  -- and `NOT (... AND NULL AND ...)` then evaluates to NULL -- which a WHERE clause treats as "not
  -- invalid", silently letting a bare scalar array element, a JSON null element, or an object missing
  -- a required field or holding the wrong JSON scalar type (e.g. a numeric postalCode) reach the
  -- INSERT below. Every field check is therefore guarded by
  -- `coalesce(jsonb_typeof(r -> key), '') = 'string'`, which is always determinately true/false
  -- (never NULL), before the existing regex/membership check runs.
  if exists (
    select 1
    from jsonb_array_elements(p_rows) as r
    where jsonb_typeof(r) is distinct from 'object'
      or not (
        coalesce(jsonb_typeof(r -> 'jisCode'), '') = 'string' and (r ->> 'jisCode') ~ '^\d{5}$'
        and coalesce(jsonb_typeof(r -> 'postalCode'), '') = 'string' and (r ->> 'postalCode') ~ '^\d{7}$'
        and coalesce(jsonb_typeof(r -> 'oldPostalCode'), '') = 'string' and (r ->> 'oldPostalCode') ~ '^\d{0,5}$'
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

  -- Repair A1-6: `address_key` / `address_prefix_head` / `is_non_specific_town` are RECOMPUTED here
  -- from the source prefecture/city/town kanji columns -- the caller's own `addressKey` /
  -- `addressPrefixHead` / `isNonSpecificTown` fields are never read or trusted, so a privileged
  -- caller cannot submit a lying derived key. The non-specific-town text list and the prefix length
  -- (8) MUST stay identical to JP_POSTAL_NON_SPECIFIC_TOWN_TEXTS and
  -- JP_POSTAL_ADDRESS_PREFIX_HEAD_LENGTH in src/lib/geo/jp-postal-master-contract.ts.
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

revoke all on function public.jp_postal_import_append(uuid, integer, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_import_append(uuid, integer, jsonb) to service_role;

create or replace function public.jp_postal_import_finalize(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_expected int;
  v_actual int;
begin
  -- Repair A2-2: lock the singleton active-batch pointer row FIRST, before any
  -- `jp_postal_import_batches` row, using the exact same global lock order as
  -- `jp_postal_import_rollback` below (pointer, then batch row(s)). A preceding version locked the
  -- batch row before the pointer here while rollback locked its target batch row before the pointer
  -- too but then locked a SECOND (outgoing) batch row after the pointer -- so a concurrent
  -- finalize(Y) and a concurrent rollback(X) whose outgoing batch happened to be Y could deadlock
  -- (finalize holding Y waiting on the pointer while rollback held the pointer waiting on Y). Locking
  -- the pointer first, always, serializes every finalize/rollback through this one singleton row and
  -- removes that cycle entirely.
  perform 1 from private.jp_postal_active_batch where singleton for update;

  -- Repair A1-5 (retained): the identical `for update` lock taken by `jp_postal_import_append` on
  -- this same row means a concurrent append blocks here until this finalize call's transaction ends,
  -- so the row count below can never be read mid-append.
  select status, expected_row_count into v_status, v_expected
  from private.jp_postal_import_batches
  where id = p_batch_id
  for update;
  if not found then
    return jsonb_build_object('result_code', 'UNKNOWN_BATCH');
  end if;
  if v_status not in ('staged', 'validating') then
    return jsonb_build_object('result_code', 'BATCH_NOT_FINALIZABLE');
  end if;

  select count(*) into v_actual from private.jp_postal_master where batch_id = p_batch_id;
  if v_actual is distinct from v_expected then
    update private.jp_postal_import_batches
      set status = 'rejected', actual_row_count = v_actual, validated_at = now()
      where id = p_batch_id;
    return jsonb_build_object('result_code', 'ROW_COUNT_MISMATCH', 'expected', v_expected, 'actual', v_actual);
  end if;

  update private.jp_postal_import_batches
    set status = 'promoted', actual_row_count = v_actual, validated_at = now(), promoted_at = now()
    where id = p_batch_id;

  update private.jp_postal_active_batch set batch_id = p_batch_id, updated_at = now() where singleton;

  return jsonb_build_object('result_code', 'OK', 'total_count', v_actual);
end;
$$;

revoke all on function public.jp_postal_import_finalize(uuid) from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_import_finalize(uuid) to service_role;

create or replace function public.jp_postal_import_rollback(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_outgoing_batch_id uuid;
begin
  -- Repair A2-2: lock AND read the singleton pointer FIRST, before the target batch row, using the
  -- exact same global lock order as `jp_postal_import_finalize` above (pointer, then batch row(s)).
  -- The outgoing batch id below is therefore read from a row this transaction already holds locked,
  -- so no concurrent finalize/rollback can repoint the pointer between this read and the repointing
  -- UPDATE further down; the value captured here is the exact one this transaction acts on.
  select batch_id into v_outgoing_batch_id from private.jp_postal_active_batch where singleton for update;

  -- Repair A1-5 (retained): lock the rollback TARGET row for the rest of this transaction.
  select status into v_status from private.jp_postal_import_batches where id = p_batch_id for update;
  if not found then
    return jsonb_build_object('result_code', 'UNKNOWN_BATCH');
  end if;
  if v_status is distinct from 'promoted' then
    return jsonb_build_object('result_code', 'BATCH_NOT_ROLLBACK_TARGET');
  end if;

  update private.jp_postal_active_batch set batch_id = p_batch_id, updated_at = now() where singleton;

  -- Repair A1-5: the batch the pointer is moving AWAY FROM is recorded as rolled back, never
  -- rewriting/deleting `jp_postal_master` rows. The target batch keeps its existing `promoted` status
  -- (already required above) since it is not written again here.
  if v_outgoing_batch_id is not null and v_outgoing_batch_id is distinct from p_batch_id then
    update private.jp_postal_import_batches
      set status = 'rolled_back', rolled_back_at = now()
      where id = v_outgoing_batch_id and status = 'promoted';
  end if;

  return jsonb_build_object('result_code', 'OK', 'promoted_batch_id', p_batch_id);
end;
$$;

revoke all on function public.jp_postal_import_rollback(uuid) from public, anon, authenticated, service_role;
grant execute on function public.jp_postal_import_rollback(uuid) to service_role;
