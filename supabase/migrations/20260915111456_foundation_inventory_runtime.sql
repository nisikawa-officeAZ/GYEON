-- INV001-P24 Book D3A: durable persistence for the sealed Foundation runtime.
-- Source-only in B1. Applying this migration requires a later disposable-DB gate.
-- Foundation remains the business-rule authority; these objects persist opaque
-- validated snapshots, idempotency outcomes, and append-only audit evidence.

create schema if not exists foundation_inventory_private;

revoke all on schema foundation_inventory_private from public, anon, authenticated;

create table foundation_inventory_private.runtime_aggregates (
  owner text not null,
  location_id text not null,
  product_id text not null,
  revision bigint not null,
  snapshot_contract text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (owner, location_id, product_id),
  constraint runtime_aggregates_owner_check
    check (owner in ('OFFICE_AZ', 'ATTRACTION')),
  constraint runtime_aggregates_location_check
    check (location_id = btrim(location_id) and char_length(location_id) between 1 and 512),
  constraint runtime_aggregates_product_check
    check (product_id = btrim(product_id) and char_length(product_id) between 1 and 512),
  constraint runtime_aggregates_revision_check check (revision >= 0),
  constraint runtime_aggregates_snapshot_contract_check
    check (snapshot_contract in (
      'INV001-P12_RUNTIME_SNAPSHOT_V1',
      'INV001-P17_RUNTIME_SNAPSHOT_V2',
      'INV001-P18_RUNTIME_SNAPSHOT_V3'
    )),
  constraint runtime_aggregates_snapshot_object_check
    check (jsonb_typeof(snapshot) = 'object'),
  constraint runtime_aggregates_snapshot_revision_check
    check (
      jsonb_typeof(snapshot -> 'revision') = 'number'
      and (snapshot ->> 'revision')::numeric = revision
      and (snapshot ->> 'revision')::numeric = trunc((snapshot ->> 'revision')::numeric)
    )
);

create table foundation_inventory_private.runtime_idempotency (
  owner text not null,
  location_id text not null,
  product_id text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  request_id text not null,
  actor text not null,
  operator text not null,
  aggregate_revision bigint not null,
  result_tag text not null,
  outcome jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (owner, location_id, product_id, idempotency_key),
  constraint runtime_idempotency_owner_check
    check (owner in ('OFFICE_AZ', 'ATTRACTION')),
  constraint runtime_idempotency_identity_check
    check (
      location_id = btrim(location_id) and char_length(location_id) between 1 and 512
      and product_id = btrim(product_id) and char_length(product_id) between 1 and 512
      and idempotency_key = btrim(idempotency_key) and char_length(idempotency_key) between 1 and 512
      and request_id = btrim(request_id) and char_length(request_id) between 1 and 512
      and actor = btrim(actor) and char_length(actor) between 1 and 512
      and operator = btrim(operator) and char_length(operator) between 1 and 512
    ),
  constraint runtime_idempotency_fingerprint_check
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint runtime_idempotency_revision_check check (aggregate_revision >= 0),
  constraint runtime_idempotency_result_tag_check
    check (result_tag in ('committed', 'recorded', 'stale')),
  constraint runtime_idempotency_outcome_check check (jsonb_typeof(outcome) is not null)
);

create index runtime_idempotency_request_idx
  on foundation_inventory_private.runtime_idempotency
  (owner, request_id);

create table foundation_inventory_private.runtime_audit (
  sequence bigint generated always as identity primary key,
  owner text not null,
  location_id text not null,
  product_id text not null,
  request_id text not null,
  idempotency_key text,
  actor text not null,
  operator text not null,
  outcome_type text not null,
  outcome_code text,
  revision_before bigint not null,
  revision_after bigint not null,
  evidence jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint runtime_audit_owner_check check (owner in ('OFFICE_AZ', 'ATTRACTION')),
  constraint runtime_audit_identity_check
    check (
      location_id = btrim(location_id) and char_length(location_id) between 1 and 512
      and product_id = btrim(product_id) and char_length(product_id) between 1 and 512
      and request_id = btrim(request_id) and char_length(request_id) between 1 and 512
      and actor = btrim(actor) and char_length(actor) between 1 and 512
      and operator = btrim(operator) and char_length(operator) between 1 and 512
      and (idempotency_key is null or (
        idempotency_key = btrim(idempotency_key)
        and char_length(idempotency_key) between 1 and 512
      ))
    ),
  constraint runtime_audit_outcome_check
    check (outcome_type in ('initialized', 'accepted', 'recorded', 'replay_conflict', 'stale')),
  constraint runtime_audit_revision_check
    check (revision_before >= 0 and revision_after >= 0),
  constraint runtime_audit_evidence_check check (jsonb_typeof(evidence) = 'object')
);

create index runtime_audit_aggregate_sequence_idx
  on foundation_inventory_private.runtime_audit
  (owner, location_id, product_id, sequence);

alter table foundation_inventory_private.runtime_aggregates enable row level security;
alter table foundation_inventory_private.runtime_aggregates force row level security;
alter table foundation_inventory_private.runtime_idempotency enable row level security;
alter table foundation_inventory_private.runtime_idempotency force row level security;
alter table foundation_inventory_private.runtime_audit enable row level security;
alter table foundation_inventory_private.runtime_audit force row level security;

-- No table policy is created. Raw Data API/browser access therefore remains
-- deny-all even if this private schema is exposed by a future configuration.
revoke all on all tables in schema foundation_inventory_private
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema foundation_inventory_private
  from public, anon, authenticated, service_role;

create or replace function foundation_inventory_private.load_runtime_aggregate(
  p_owner text,
  p_location_id text,
  p_product_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row foundation_inventory_private.runtime_aggregates%rowtype;
begin
  if p_owner is distinct from 'OFFICE_AZ'
     or p_location_id is null or p_location_id <> btrim(p_location_id)
     or char_length(p_location_id) not between 1 and 512
     or p_product_id is null or p_product_id <> btrim(p_product_id)
     or char_length(p_product_id) not between 1 and 512 then
    return jsonb_build_object('tag', 'denied');
  end if;

  select * into v_row
    from foundation_inventory_private.runtime_aggregates
   where owner = p_owner
     and location_id = p_location_id
     and product_id = p_product_id;

  if not found then
    return jsonb_build_object('tag', 'not_found');
  end if;

  return jsonb_build_object(
    'tag', 'found',
    'snapshotContract', v_row.snapshot_contract,
    'snapshot', v_row.snapshot,
    'revision', v_row.revision
  );
exception when others then
  return jsonb_build_object('tag', 'error');
end;
$$;

create or replace function foundation_inventory_private.initialize_runtime_aggregate(
  p_owner text,
  p_location_id text,
  p_product_id text,
  p_request_id text,
  p_actor text,
  p_operator text,
  p_snapshot_contract text,
  p_snapshot jsonb,
  p_evidence jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_revision bigint;
begin
  if p_owner is distinct from 'OFFICE_AZ'
     or p_location_id is null or p_location_id <> btrim(p_location_id)
     or char_length(p_location_id) not between 1 and 512
     or p_product_id is null or p_product_id <> btrim(p_product_id)
     or char_length(p_product_id) not between 1 and 512
     or p_request_id is null or p_request_id <> btrim(p_request_id)
     or char_length(p_request_id) not between 1 and 512
     or p_actor is null or p_actor <> btrim(p_actor)
     or char_length(p_actor) not between 1 and 512
     or p_operator is null or p_operator <> btrim(p_operator)
     or char_length(p_operator) not between 1 and 512
     or p_snapshot_contract is distinct from 'INV001-P18_RUNTIME_SNAPSHOT_V3'
     or jsonb_typeof(p_snapshot) is distinct from 'object'
     or jsonb_typeof(p_snapshot -> 'revision') is distinct from 'number'
     or (p_snapshot ->> 'revision')::numeric <> 0
     or (p_snapshot ->> 'revision')::numeric <> trunc((p_snapshot ->> 'revision')::numeric)
     or jsonb_typeof(p_evidence) is distinct from 'object'
     or p_evidence::text ~* '"[^"]*(authorization|cookie|password|secret|session|token|email|phone|address)[^"]*"[[:space:]]*:' then
    return jsonb_build_object('tag', 'denied');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner || E'\n' || p_location_id || E'\n' || p_product_id, 0)
  );

  select revision into v_existing_revision
    from foundation_inventory_private.runtime_aggregates
   where owner = p_owner
     and location_id = p_location_id
     and product_id = p_product_id
   for update;

  if found then
    return jsonb_build_object('tag', 'already_exists', 'revision', v_existing_revision);
  end if;

  insert into foundation_inventory_private.runtime_aggregates (
    owner, location_id, product_id, revision, snapshot_contract, snapshot
  ) values (
    p_owner, p_location_id, p_product_id, 0, p_snapshot_contract, p_snapshot
  );

  insert into foundation_inventory_private.runtime_audit (
    owner, location_id, product_id, request_id, idempotency_key,
    actor, operator, outcome_type, outcome_code,
    revision_before, revision_after, evidence
  ) values (
    p_owner, p_location_id, p_product_id, p_request_id, null,
    p_actor, p_operator, 'initialized', null, 0, 0, p_evidence
  );

  return jsonb_build_object('tag', 'initialized', 'revision', 0);
exception when others then
  return jsonb_build_object('tag', 'error');
end;
$$;

create or replace function foundation_inventory_private.finalize_runtime_transition(
  p_owner text,
  p_location_id text,
  p_product_id text,
  p_request_id text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_actor text,
  p_operator text,
  p_expected_revision bigint,
  p_next_snapshot_contract text,
  p_next_snapshot jsonb,
  p_outcome jsonb,
  p_evidence jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_revision bigint;
  v_idempotency foundation_inventory_private.runtime_idempotency%rowtype;
begin
  if p_owner is distinct from 'OFFICE_AZ'
     or p_location_id is null or p_location_id <> btrim(p_location_id)
     or char_length(p_location_id) not between 1 and 512
     or p_product_id is null or p_product_id <> btrim(p_product_id)
     or char_length(p_product_id) not between 1 and 512
     or p_request_id is null or p_request_id <> btrim(p_request_id)
     or char_length(p_request_id) not between 1 and 512
     or p_idempotency_key is null or p_idempotency_key <> btrim(p_idempotency_key)
     or char_length(p_idempotency_key) not between 1 and 512
     or p_request_fingerprint is null
     or p_request_fingerprint !~ '^[a-f0-9]{64}$'
     or p_actor is null or p_actor <> btrim(p_actor)
     or char_length(p_actor) not between 1 and 512
     or p_operator is null or p_operator <> btrim(p_operator)
     or char_length(p_operator) not between 1 and 512
     or p_expected_revision is null or p_expected_revision < 0
     or jsonb_typeof(p_outcome) is null
     or jsonb_typeof(p_evidence) is distinct from 'object'
     or p_evidence::text ~* '"[^"]*(authorization|cookie|password|secret|session|token|email|phone|address)[^"]*"[[:space:]]*:'
     or ((p_next_snapshot is null) <> (p_next_snapshot_contract is null))
     or (
       p_next_snapshot is not null and (
         p_next_snapshot_contract is distinct from 'INV001-P18_RUNTIME_SNAPSHOT_V3'
         or jsonb_typeof(p_next_snapshot) is distinct from 'object'
         or jsonb_typeof(p_next_snapshot -> 'revision') is distinct from 'number'
         or (p_next_snapshot ->> 'revision')::numeric <> p_expected_revision + 1
         or (p_next_snapshot ->> 'revision')::numeric
              <> trunc((p_next_snapshot ->> 'revision')::numeric)
       )
     ) then
    return jsonb_build_object('tag', 'denied');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner || E'\n' || p_location_id || E'\n' || p_product_id, 0)
  );

  select * into v_idempotency
    from foundation_inventory_private.runtime_idempotency
   where owner = p_owner
     and location_id = p_location_id
     and product_id = p_product_id
     and idempotency_key = p_idempotency_key;

  if found then
    if v_idempotency.request_fingerprint = p_request_fingerprint then
      if v_idempotency.result_tag = 'stale' then
        return jsonb_build_object(
          'tag', 'stale',
          'revision', v_idempotency.aggregate_revision
        );
      end if;
      return jsonb_build_object(
        'tag', 'replayed',
        'revision', v_idempotency.aggregate_revision,
        'outcome', v_idempotency.outcome
      );
    end if;

    insert into foundation_inventory_private.runtime_audit (
      owner, location_id, product_id, request_id, idempotency_key,
      actor, operator, outcome_type, outcome_code,
      revision_before, revision_after, evidence
    ) values (
      p_owner, p_location_id, p_product_id, p_request_id, p_idempotency_key,
      p_actor, p_operator, 'replay_conflict', 'REPLAY_CONFLICT',
      v_idempotency.aggregate_revision, v_idempotency.aggregate_revision, p_evidence
    );
    return jsonb_build_object(
      'tag', 'replay_conflict',
      'revision', v_idempotency.aggregate_revision
    );
  end if;

  select revision into v_current_revision
    from foundation_inventory_private.runtime_aggregates
   where owner = p_owner
     and location_id = p_location_id
     and product_id = p_product_id
   for update;

  if not found then
    return jsonb_build_object('tag', 'not_found');
  end if;

  if v_current_revision <> p_expected_revision then
    insert into foundation_inventory_private.runtime_idempotency (
      owner, location_id, product_id, idempotency_key, request_fingerprint,
      request_id, actor, operator, aggregate_revision, result_tag, outcome
    ) values (
      p_owner, p_location_id, p_product_id, p_idempotency_key, p_request_fingerprint,
      p_request_id, p_actor, p_operator, v_current_revision, 'stale', p_outcome
    );
    insert into foundation_inventory_private.runtime_audit (
      owner, location_id, product_id, request_id, idempotency_key,
      actor, operator, outcome_type, outcome_code,
      revision_before, revision_after, evidence
    ) values (
      p_owner, p_location_id, p_product_id, p_request_id, p_idempotency_key,
      p_actor, p_operator, 'stale', 'STALE_REVISION',
      v_current_revision, v_current_revision, p_evidence
    );
    return jsonb_build_object('tag', 'stale', 'revision', v_current_revision);
  end if;

  if p_next_snapshot is null then
    insert into foundation_inventory_private.runtime_idempotency (
      owner, location_id, product_id, idempotency_key, request_fingerprint,
      request_id, actor, operator, aggregate_revision, result_tag, outcome
    ) values (
      p_owner, p_location_id, p_product_id, p_idempotency_key, p_request_fingerprint,
      p_request_id, p_actor, p_operator, v_current_revision, 'recorded', p_outcome
    );
    insert into foundation_inventory_private.runtime_audit (
      owner, location_id, product_id, request_id, idempotency_key,
      actor, operator, outcome_type, outcome_code,
      revision_before, revision_after, evidence
    ) values (
      p_owner, p_location_id, p_product_id, p_request_id, p_idempotency_key,
      p_actor, p_operator, 'recorded', null,
      v_current_revision, v_current_revision, p_evidence
    );
    return jsonb_build_object(
      'tag', 'recorded', 'revision', v_current_revision, 'outcome', p_outcome
    );
  end if;

  update foundation_inventory_private.runtime_aggregates
     set revision = p_expected_revision + 1,
         snapshot_contract = p_next_snapshot_contract,
         snapshot = p_next_snapshot,
         updated_at = statement_timestamp()
   where owner = p_owner
     and location_id = p_location_id
     and product_id = p_product_id
     and revision = p_expected_revision;

  if not found then
    return jsonb_build_object('tag', 'stale', 'revision', v_current_revision);
  end if;

  insert into foundation_inventory_private.runtime_idempotency (
    owner, location_id, product_id, idempotency_key, request_fingerprint,
    request_id, actor, operator, aggregate_revision, result_tag, outcome
  ) values (
    p_owner, p_location_id, p_product_id, p_idempotency_key, p_request_fingerprint,
    p_request_id, p_actor, p_operator, p_expected_revision + 1, 'committed', p_outcome
  );

  insert into foundation_inventory_private.runtime_audit (
    owner, location_id, product_id, request_id, idempotency_key,
    actor, operator, outcome_type, outcome_code,
    revision_before, revision_after, evidence
  ) values (
    p_owner, p_location_id, p_product_id, p_request_id, p_idempotency_key,
    p_actor, p_operator, 'accepted', null,
    p_expected_revision, p_expected_revision + 1, p_evidence
  );

  return jsonb_build_object(
    'tag', 'committed', 'revision', p_expected_revision + 1, 'outcome', p_outcome
  );
exception when others then
  return jsonb_build_object('tag', 'error');
end;
$$;

revoke all on function foundation_inventory_private.load_runtime_aggregate(text, text, text)
  from public, anon, authenticated;
revoke all on function foundation_inventory_private.initialize_runtime_aggregate(
  text, text, text, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function foundation_inventory_private.finalize_runtime_transition(
  text, text, text, text, text, text, text, text, bigint, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant usage on schema foundation_inventory_private to service_role;
grant execute on function foundation_inventory_private.load_runtime_aggregate(text, text, text)
  to service_role;
grant execute on function foundation_inventory_private.initialize_runtime_aggregate(
  text, text, text, text, text, text, text, jsonb, jsonb
) to service_role;
grant execute on function foundation_inventory_private.finalize_runtime_transition(
  text, text, text, text, text, text, text, text, bigint, text, jsonb, jsonb, jsonb
) to service_role;

comment on schema foundation_inventory_private is
  'Private Book persistence for the sealed Foundation inventory runtime; never a business-rule authority.';
comment on table foundation_inventory_private.runtime_audit is
  'Append-only Foundation runtime audit evidence. Application roles have no UPDATE or DELETE privilege.';
