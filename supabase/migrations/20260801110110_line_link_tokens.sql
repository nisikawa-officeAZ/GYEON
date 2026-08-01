-- GYEON-LINE-SETUP-F2 — dealer-scoped LIFF customer-link tokens.
--
-- Why this exists
-- ---------------
-- The previous LIFF flow put a raw customer identifier in the URL and resolved
-- the dealer from the operator's DealerOS session. A real customer opening the
-- LIFF app inside LINE has no DealerOS cookie, so linking always failed; and
-- dropping the session check would have made the browser-supplied identifier the
-- only thing selecting a row — an insecure direct object reference letting anyone
-- bind their own LINE account to a guessed customer.
--
-- This table replaces both halves: the URL carries ONLY an opaque token, and the
-- server resolves dealer, customer and the expected LINE Login audience from the
-- token row. Nothing the browser sends selects a row.
--
-- Server-only by construction: RLS is enabled with ZERO policies, and every
-- privilege is revoked from anon/authenticated/PUBLIC. Only service_role reaches
-- it, exactly like public.gyeon_dealer_provisioning.

create table if not exists public.line_link_tokens (
  id                uuid        primary key default gen_random_uuid(),
  dealer_id         uuid        not null references public.dealers(id)   on delete cascade,
  customer_id       uuid        not null references public.customers(id) on delete cascade,

  -- SHA-256 of the raw token, lowercase hex. The raw token is returned to the
  -- minting caller exactly once and is never stored.
  token_hash        text        not null,

  -- Snapshot of the dealer's LIFF configuration at mint time. The audience used
  -- to verify the LINE ID token comes from here, never from the browser and
  -- never from the Messaging API channel id.
  liff_id           text        not null,
  login_channel_id  text        not null,

  expires_at        timestamptz not null,
  used_at           timestamptz,
  revoked_at        timestamptz,
  created_by        uuid        not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default now(),

  constraint line_link_tokens_token_hash_unique unique (token_hash),
  constraint line_link_tokens_token_hash_sha256 check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint line_link_tokens_login_channel_numeric check (login_channel_id ~ '^[0-9]{6,}$')
);

create index if not exists line_link_tokens_dealer_idx
  on public.line_link_tokens (dealer_id);

create index if not exists line_link_tokens_open_idx
  on public.line_link_tokens (expires_at)
  where used_at is null and revoked_at is null;

alter table public.line_link_tokens enable row level security;

-- No policies are created on purpose: RLS with zero policies denies every
-- anon/authenticated request even if a grant is ever added by mistake.

revoke all on table public.line_link_tokens from public;
revoke all on table public.line_link_tokens from anon;
revoke all on table public.line_link_tokens from authenticated;
grant select, insert, update on table public.line_link_tokens to service_role;

-- ---------------------------------------------------------------------------
-- Bidirectional linking uniqueness (F2-F1-03, F2-F2-01).
--
-- line_customers already guarantees one LINE account per dealer
-- (line_customers_dealer_line_unique). Two mirror guarantees were missing:
--   1. one customer must not accumulate several LINE accounts within a dealer;
--   2. customers.line_user_id is written by paths that do not always create a
--      line_customers row (webhook follow handling, legacy data), so the same
--      LINE identity could still land on two customers of one dealer.
-- With all three in place, a concurrent racer that slips past the explicit
-- checks can only fail on a unique index, which the consume function converts
-- into a typed conflict and rolls back.
--
-- APPLY PRECONDITION — these indexes are created CONCURRENTLY-free and will fail
-- if duplicates already exist. The disposable verification phase and the Dev-Next
-- apply audit MUST first check for pre-existing duplicates in BOTH tables, e.g.
--   select dealer_id, customer_id, count(*) from public.line_customers
--    where customer_id is not null group by 1,2 having count(*) > 1;
--   select dealer_id, line_user_id, count(*) from public.customers
--    where line_user_id is not null and btrim(line_user_id) <> ''
--    group by 1,2 having count(*) > 1;
-- This migration deliberately deletes, merges and rewrites nothing: a duplicate
-- must be resolved by an explicit, separately authorized data decision.
-- ---------------------------------------------------------------------------
create unique index if not exists line_customers_dealer_customer_unique
  on public.line_customers (dealer_id, customer_id)
  where customer_id is not null;

create unique index if not exists customers_dealer_line_user_unique
  on public.customers (dealer_id, line_user_id)
  where line_user_id is not null and btrim(line_user_id) <> '';

-- ---------------------------------------------------------------------------
-- consume_line_link_token
--
-- Atomically: winner-gate the token, then perform every linking write in the
-- same transaction. Exactly one concurrent caller can win because the UPDATE
-- claims the row with `used_at is null ... returning`.
--
-- Linking NEVER repoints an existing identifier in either direction. Any
-- conflict raises, and the raise rolls the whole block back — including the
-- claim — so a conflicting attempt cannot burn an otherwise valid token.
--
-- SECURITY INVOKER (prosecdef stays false) + EXECUTE restricted to service_role,
-- and search_path pinned empty with fully schema-qualified objects, matching the
-- hardened GYEON provisioning functions.
-- ---------------------------------------------------------------------------
create or replace function public.consume_line_link_token(
  p_token_hash   text,
  p_line_user_id text,
  p_display_name text,
  p_picture_url  text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_tok           public.line_link_tokens;
  v_now           timestamptz := now();
  v_customer_line text;
  v_rows          integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_line_user_id is null or btrim(p_line_user_id) = '' then
    return jsonb_build_object('outcome', 'invalid-token');
  end if;

  -- Winner-gated claim: unknown, expired, revoked and already-used tokens all
  -- fall through to the same opaque outcome, so nothing leaks about existence.
  update public.line_link_tokens t
     set used_at = v_now
   where t.token_hash = p_token_hash
     and t.used_at    is null
     and t.revoked_at is null
     and t.expires_at > v_now
  returning t.* into v_tok;

  if not found then
    return jsonb_build_object('outcome', 'invalid-token');
  end if;

  -- (F2-F2-03) Lock the target customer for the rest of the transaction and
  -- prove it still exists UNDER THE TOKEN'S DEALER. The lock serialises
  -- concurrent linking attempts against the same customer, and a deleted or
  -- reassigned customer can never be reported as linked.
  select c.line_user_id
    into v_customer_line
    from public.customers c
   where c.id        = v_tok.customer_id
     and c.dealer_id = v_tok.dealer_id
     for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'line_link_customer_missing';
  end if;

  -- (a) The target customer already points at a DIFFERENT LINE user.
  if v_customer_line is not null
     and btrim(v_customer_line) <> ''
     and v_customer_line is distinct from p_line_user_id then
    raise exception using errcode = 'P0001', message = 'line_link_account_conflict';
  end if;

  -- (b) This LINE account already belongs to a DIFFERENT customer of this dealer.
  perform 1
     from public.line_customers lc
    where lc.dealer_id    = v_tok.dealer_id
      and lc.line_user_id = p_line_user_id
      and lc.customer_id is distinct from v_tok.customer_id;
  if found then
    raise exception using errcode = 'P0001', message = 'line_link_account_conflict';
  end if;

  -- (c) This customer already holds a DIFFERENT LINE account with this dealer.
  perform 1
     from public.line_customers lc
    where lc.dealer_id   = v_tok.dealer_id
      and lc.customer_id = v_tok.customer_id
      and lc.line_user_id is distinct from p_line_user_id;
  if found then
    raise exception using errcode = 'P0001', message = 'line_link_account_conflict';
  end if;

  -- (d, F2-F2-02) LEGACY PATH: customers.line_user_id is also written by the
  -- webhook follow handler, which does not always create a line_customers row.
  -- Another customer of this dealer may therefore already carry this LINE
  -- identity with nothing in line_customers to show for it.
  perform 1
     from public.customers c
    where c.dealer_id    = v_tok.dealer_id
      and c.line_user_id = p_line_user_id
      and c.id is distinct from v_tok.customer_id;
  if found then
    raise exception using errcode = 'P0001', message = 'line_link_account_conflict';
  end if;

  -- Exact-pair write. The UPDATE matches only the identical
  -- (dealer, customer, line user) triple, so neither identifier can ever be
  -- repointed; a miss means the pair does not exist yet and is inserted.
  -- Replaying the same pair is idempotent.
  update public.line_customers lc
     set display_name = p_display_name,
         picture_url  = p_picture_url,
         is_friend    = true,
         linked_at    = coalesce(lc.linked_at, v_now),
         updated_at   = v_now
   where lc.dealer_id    = v_tok.dealer_id
     and lc.customer_id  = v_tok.customer_id
     and lc.line_user_id = p_line_user_id;

  if not found then
    insert into public.line_customers
      (dealer_id, customer_id, line_user_id, display_name, picture_url,
       is_friend, linked_at, updated_at)
    values
      (v_tok.dealer_id, v_tok.customer_id, p_line_user_id, p_display_name, p_picture_url,
       true, v_now, v_now);
  end if;

  -- Guarded by check (a): this can only fill a null/blank or rewrite the
  -- identical value, never replace a different LINE user.
  update public.customers c
     set line_connected    = true,
         line_user_id      = p_line_user_id,
         line_display_name = p_display_name,
         line_picture_url  = p_picture_url,
         updated_at        = v_now
   where c.id        = v_tok.customer_id
     and c.dealer_id = v_tok.dealer_id
     and (c.line_user_id is null or btrim(c.line_user_id) = '' or c.line_user_id = p_line_user_id);

  -- (F2-F2-03) The dealer-scoped update MUST have touched exactly the locked
  -- row. Anything else means the guard did not hold, so we refuse to report a
  -- link that did not happen; raising rolls the whole block back.
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'line_link_consistency_failure';
  end if;

  return jsonb_build_object('outcome', 'linked');
exception
  -- A concurrent racer that slipped past the checks above can only fail on a
  -- unique index. Every handler here rolls the claim back with the rest of the
  -- block, so used_at is restored and the token is never silently burned.
  when unique_violation then
    return jsonb_build_object('outcome', 'account-conflict');
  when sqlstate 'P0001' then
    if sqlerrm = 'line_link_account_conflict' then
      return jsonb_build_object('outcome', 'account-conflict');
    elsif sqlerrm in ('line_link_customer_missing', 'line_link_consistency_failure') then
      -- Never 'linked'. The caller maps any unknown outcome to the same opaque
      -- client failure, so this leaks nothing while staying honest in the log.
      return jsonb_build_object('outcome', 'consistency-failure');
    end if;
    raise;
end;
$$;

revoke all on function public.consume_line_link_token(text, text, text, text) from public;
revoke all on function public.consume_line_link_token(text, text, text, text) from anon;
revoke all on function public.consume_line_link_token(text, text, text, text) from authenticated;
grant execute on function public.consume_line_link_token(text, text, text, text) to service_role;
