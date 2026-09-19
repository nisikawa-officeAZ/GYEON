-- INV001-P24 Book D3B B1: private one-to-one Foundation product identity mapping.
-- Source-only in B1. Applying this migration requires a later disposable-DB gate.
-- Foundation remains the identity authority. This schema stores current mappings
-- and append-only evidence only. It never creates a second product master.

create schema if not exists foundation_product_mapping_private;

revoke all on schema foundation_product_mapping_private from public, anon, authenticated;

create table foundation_product_mapping_private.current_mappings (
  foundation_product_id text not null,
  book_product_id uuid not null,
  legal_owner text not null,
  foundation_lifecycle text not null,
  foundation_identity_revision bigint not null,
  mapping_revision bigint not null,
  mapping_state text not null,
  evidence_reference text not null,
  successor_foundation_product_id text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (foundation_product_id),
  constraint current_mappings_foundation_product_id_check
    check (foundation_product_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  constraint current_mappings_legal_owner_check
    check (legal_owner in ('OFFICE_AZ', 'ATTRACTION')),
  constraint current_mappings_lifecycle_check
    check (foundation_lifecycle in ('active', 'suspended', 'retired', 'superseded')),
  constraint current_mappings_identity_revision_check
    check (foundation_identity_revision >= 1),
  constraint current_mappings_mapping_revision_check
    check (mapping_revision >= 1),
  constraint current_mappings_state_check
    check (mapping_state = 'accepted'),
  constraint current_mappings_evidence_reference_check
    check (evidence_reference ~ '^[a-f0-9]{64}$'),
  constraint current_mappings_successor_check
    check (
      successor_foundation_product_id is null
      or successor_foundation_product_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  constraint current_mappings_book_product_fk
    foreign key (book_product_id) references public.gyeon_products (id)
    on update restrict
    on delete restrict
);

create unique index current_mappings_book_product_uidx
  on foundation_product_mapping_private.current_mappings (book_product_id);

create table foundation_product_mapping_private.mapping_events (
  sequence bigint generated always as identity primary key,
  event_kind text not null,
  foundation_product_id text not null,
  book_product_id uuid not null,
  legal_owner text not null,
  foundation_lifecycle text not null,
  foundation_identity_revision bigint not null,
  mapping_revision bigint not null,
  confirmer_user_id text not null,
  dealer_tenant_context text not null,
  authority_source text not null,
  capability_snapshot text not null,
  request_id text not null,
  evidence_digest text not null,
  review_snapshot jsonb not null,
  successor_foundation_product_id text,
  created_at timestamptz not null default statement_timestamp(),
  constraint mapping_events_kind_check
    check (event_kind in (
      'candidate', 'confirm', 'change', 'suspend', 'retire', 'supersede', 'rejection'
    )),
  constraint mapping_events_foundation_product_id_check
    check (foundation_product_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  constraint mapping_events_legal_owner_check
    check (legal_owner in ('OFFICE_AZ', 'ATTRACTION')),
  constraint mapping_events_lifecycle_check
    check (foundation_lifecycle in ('active', 'suspended', 'retired', 'superseded')),
  constraint mapping_events_identity_revision_check
    check (foundation_identity_revision >= 1),
  constraint mapping_events_mapping_revision_check
    check (mapping_revision >= 0),
  constraint mapping_events_identity_text_check
    check (
      confirmer_user_id = btrim(confirmer_user_id) and char_length(confirmer_user_id) between 1 and 512
      and dealer_tenant_context = btrim(dealer_tenant_context) and char_length(dealer_tenant_context) between 1 and 512
      and authority_source = btrim(authority_source) and char_length(authority_source) between 1 and 512
      and capability_snapshot = btrim(capability_snapshot) and char_length(capability_snapshot) between 1 and 512
      and request_id = btrim(request_id) and char_length(request_id) between 1 and 512
    ),
  constraint mapping_events_evidence_digest_check
    check (evidence_digest ~ '^[a-f0-9]{64}$'),
  constraint mapping_events_review_snapshot_check
    check (jsonb_typeof(review_snapshot) = 'object'),
  constraint mapping_events_successor_check
    check (
      successor_foundation_product_id is null
      or successor_foundation_product_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
);

create index mapping_events_pair_sequence_idx
  on foundation_product_mapping_private.mapping_events
  (foundation_product_id, book_product_id, sequence);

alter table foundation_product_mapping_private.current_mappings enable row level security;
alter table foundation_product_mapping_private.current_mappings force row level security;
alter table foundation_product_mapping_private.mapping_events enable row level security;
alter table foundation_product_mapping_private.mapping_events force row level security;

revoke all on all tables in schema foundation_product_mapping_private
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema foundation_product_mapping_private
  from public, anon, authenticated, service_role;

create or replace function foundation_product_mapping_private.deny_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'mapping_events_are_append_only';
end;
$$;

create trigger mapping_events_deny_update
  before update on foundation_product_mapping_private.mapping_events
  for each row execute function foundation_product_mapping_private.deny_history_mutation();

create trigger mapping_events_deny_delete
  before delete on foundation_product_mapping_private.mapping_events
  for each row execute function foundation_product_mapping_private.deny_history_mutation();

create or replace function foundation_product_mapping_private.apply_confirmed_mapping(
  p_event_kind text,
  p_foundation_product_id text,
  p_book_product_id uuid,
  p_legal_owner text,
  p_foundation_lifecycle text,
  p_foundation_identity_revision bigint,
  p_expected_mapping_revision bigint,
  p_confirmer_user_id text,
  p_dealer_tenant_context text,
  p_authority_source text,
  p_capability_snapshot text,
  p_request_id text,
  p_evidence_digest text,
  p_review_snapshot jsonb,
  p_successor_foundation_product_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current foundation_product_mapping_private.current_mappings%rowtype;
  v_next_revision bigint;
begin
  if p_event_kind is distinct from 'confirm' and p_event_kind is distinct from 'change' then
    return jsonb_build_object('tag', 'denied');
  end if;
  if p_legal_owner is distinct from 'OFFICE_AZ' and p_legal_owner is distinct from 'ATTRACTION' then
    return jsonb_build_object('tag', 'denied');
  end if;
  if p_foundation_product_id is null
     or p_foundation_product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_book_product_id is null
     or p_foundation_lifecycle not in ('active', 'suspended', 'retired', 'superseded')
     or p_foundation_identity_revision is null or p_foundation_identity_revision < 1
     or p_expected_mapping_revision is null or p_expected_mapping_revision < 0
     or p_confirmer_user_id is null or p_confirmer_user_id <> btrim(p_confirmer_user_id)
     or char_length(p_confirmer_user_id) not between 1 and 512
     or p_dealer_tenant_context is null or p_dealer_tenant_context <> btrim(p_dealer_tenant_context)
     or char_length(p_dealer_tenant_context) not between 1 and 512
     or p_authority_source is null or p_authority_source <> btrim(p_authority_source)
     or char_length(p_authority_source) not between 1 and 512
     or p_capability_snapshot is null or p_capability_snapshot <> btrim(p_capability_snapshot)
     or char_length(p_capability_snapshot) not between 1 and 512
     or p_request_id is null or p_request_id <> btrim(p_request_id)
     or char_length(p_request_id) not between 1 and 512
     or p_evidence_digest is null or p_evidence_digest !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_review_snapshot) is distinct from 'object' then
    return jsonb_build_object('tag', 'denied');
  end if;

  select * into v_current
    from foundation_product_mapping_private.current_mappings
   where foundation_product_id = p_foundation_product_id
      or book_product_id = p_book_product_id
   for update;

  if found then
    if v_current.foundation_product_id is distinct from p_foundation_product_id
       or v_current.book_product_id is distinct from p_book_product_id then
      return jsonb_build_object('tag', 'duplicate');
    end if;
    if v_current.mapping_revision is distinct from p_expected_mapping_revision then
      return jsonb_build_object('tag', 'stale', 'revision', v_current.mapping_revision);
    end if;
    v_next_revision := v_current.mapping_revision + 1;
    update foundation_product_mapping_private.current_mappings
       set legal_owner = p_legal_owner,
           foundation_lifecycle = p_foundation_lifecycle,
           foundation_identity_revision = p_foundation_identity_revision,
           mapping_revision = v_next_revision,
           evidence_reference = p_evidence_digest,
           successor_foundation_product_id = p_successor_foundation_product_id,
           updated_at = statement_timestamp()
     where foundation_product_id = p_foundation_product_id
       and mapping_revision = p_expected_mapping_revision;
    if not found then
      return jsonb_build_object('tag', 'stale');
    end if;
  else
    if p_event_kind is distinct from 'confirm' or p_expected_mapping_revision is distinct from 0 then
      return jsonb_build_object('tag', 'stale');
    end if;
    v_next_revision := 1;
    insert into foundation_product_mapping_private.current_mappings (
      foundation_product_id, book_product_id, legal_owner, foundation_lifecycle,
      foundation_identity_revision, mapping_revision, mapping_state, evidence_reference,
      successor_foundation_product_id
    ) values (
      p_foundation_product_id, p_book_product_id, p_legal_owner, p_foundation_lifecycle,
      p_foundation_identity_revision, v_next_revision, 'accepted', p_evidence_digest,
      p_successor_foundation_product_id
    );
  end if;

  insert into foundation_product_mapping_private.mapping_events (
    event_kind, foundation_product_id, book_product_id, legal_owner,
    foundation_lifecycle, foundation_identity_revision, mapping_revision,
    confirmer_user_id, dealer_tenant_context, authority_source, capability_snapshot,
    request_id, evidence_digest, review_snapshot, successor_foundation_product_id
  ) values (
    p_event_kind, p_foundation_product_id, p_book_product_id, p_legal_owner,
    p_foundation_lifecycle, p_foundation_identity_revision, v_next_revision,
    p_confirmer_user_id, p_dealer_tenant_context, p_authority_source, p_capability_snapshot,
    p_request_id, p_evidence_digest, p_review_snapshot, p_successor_foundation_product_id
  );

  return jsonb_build_object('tag', 'accepted', 'revision', v_next_revision);
exception when unique_violation then
  return jsonb_build_object('tag', 'duplicate');
when others then
  return jsonb_build_object('tag', 'error');
end;
$$;

create or replace function foundation_product_mapping_private.record_mapping_event(
  p_event_kind text,
  p_foundation_product_id text,
  p_book_product_id uuid,
  p_legal_owner text,
  p_foundation_lifecycle text,
  p_foundation_identity_revision bigint,
  p_mapping_revision bigint,
  p_confirmer_user_id text,
  p_dealer_tenant_context text,
  p_authority_source text,
  p_capability_snapshot text,
  p_request_id text,
  p_evidence_digest text,
  p_review_snapshot jsonb,
  p_successor_foundation_product_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_kind not in ('candidate', 'rejection', 'suspend', 'retire', 'supersede') then
    return jsonb_build_object('tag', 'denied');
  end if;
  if p_foundation_product_id is null
     or p_foundation_product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_book_product_id is null
     or p_legal_owner not in ('OFFICE_AZ', 'ATTRACTION')
     or p_foundation_lifecycle not in ('active', 'suspended', 'retired', 'superseded')
     or p_foundation_identity_revision is null or p_foundation_identity_revision < 1
     or p_mapping_revision is null or p_mapping_revision < 0
     or p_confirmer_user_id is null or p_confirmer_user_id <> btrim(p_confirmer_user_id)
     or char_length(p_confirmer_user_id) not between 1 and 512
     or p_dealer_tenant_context is null or p_dealer_tenant_context <> btrim(p_dealer_tenant_context)
     or char_length(p_dealer_tenant_context) not between 1 and 512
     or p_authority_source is null or p_authority_source <> btrim(p_authority_source)
     or char_length(p_authority_source) not between 1 and 512
     or p_capability_snapshot is null or p_capability_snapshot <> btrim(p_capability_snapshot)
     or char_length(p_capability_snapshot) not between 1 and 512
     or p_request_id is null or p_request_id <> btrim(p_request_id)
     or char_length(p_request_id) not between 1 and 512
     or p_evidence_digest is null or p_evidence_digest !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_review_snapshot) is distinct from 'object' then
    return jsonb_build_object('tag', 'denied');
  end if;

  if p_event_kind in ('suspend', 'retire', 'supersede') then
    update foundation_product_mapping_private.current_mappings
       set foundation_lifecycle = p_foundation_lifecycle,
           foundation_identity_revision = p_foundation_identity_revision,
           successor_foundation_product_id = p_successor_foundation_product_id,
           evidence_reference = p_evidence_digest,
           updated_at = statement_timestamp()
     where foundation_product_id = p_foundation_product_id
       and book_product_id = p_book_product_id
       and mapping_revision = p_mapping_revision;
    if not found then
      return jsonb_build_object('tag', 'stale');
    end if;
  end if;

  insert into foundation_product_mapping_private.mapping_events (
    event_kind, foundation_product_id, book_product_id, legal_owner,
    foundation_lifecycle, foundation_identity_revision, mapping_revision,
    confirmer_user_id, dealer_tenant_context, authority_source, capability_snapshot,
    request_id, evidence_digest, review_snapshot, successor_foundation_product_id
  ) values (
    p_event_kind, p_foundation_product_id, p_book_product_id, p_legal_owner,
    p_foundation_lifecycle, p_foundation_identity_revision, p_mapping_revision,
    p_confirmer_user_id, p_dealer_tenant_context, p_authority_source, p_capability_snapshot,
    p_request_id, p_evidence_digest, p_review_snapshot, p_successor_foundation_product_id
  );

  return jsonb_build_object('tag', 'recorded');
exception when others then
  return jsonb_build_object('tag', 'error');
end;
$$;

revoke all on function foundation_product_mapping_private.deny_history_mutation()
  from public, anon, authenticated;
revoke all on function foundation_product_mapping_private.apply_confirmed_mapping(
  text, text, uuid, text, text, bigint, bigint, text, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function foundation_product_mapping_private.record_mapping_event(
  text, text, uuid, text, text, bigint, bigint, text, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;

grant usage on schema foundation_product_mapping_private to service_role;
grant execute on function foundation_product_mapping_private.apply_confirmed_mapping(
  text, text, uuid, text, text, bigint, bigint, text, text, text, text, text, text, jsonb, text
) to service_role;
grant execute on function foundation_product_mapping_private.record_mapping_event(
  text, text, uuid, text, text, bigint, bigint, text, text, text, text, text, text, jsonb, text
) to service_role;

comment on schema foundation_product_mapping_private is
  'Private Book one-to-one Foundation product identity mapping; never a second product master.';
comment on table foundation_product_mapping_private.mapping_events is
  'Append-only mapping evidence. Application roles have no UPDATE or DELETE privilege.';
