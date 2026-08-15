-- Dealer self-registration concurrency guard.
--
-- DealerOS supports one user belonging to multiple dealers, so these indexes
-- deliberately do NOT make owner_user_id or email globally unique. They only
-- serialize self-applied dealer rows while approval_status is 'pending'.

-- Fail closed if the existing database already violates the exact pending
-- signup identities. The migration must stop for operator reconciliation; it
-- must never choose a winner or delete data automatically.
do $$
begin
  if exists (
    select 1
    from public.dealers
    where approval_status = 'pending'
      and owner_user_id is not null
    group by owner_user_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'dealer signup uniqueness preflight failed: duplicate pending owner_user_id';
  end if;

  if exists (
    select 1
    from public.dealers
    where approval_status = 'pending'
      and email is not null
      and btrim(email) <> ''
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'dealer signup uniqueness preflight failed: duplicate pending normalized email';
  end if;
end;
$$;

create unique index dealers_pending_owner_user_id_uidx
  on public.dealers (owner_user_id)
  where approval_status = 'pending'
    and owner_user_id is not null;

create unique index dealers_pending_email_normalized_uidx
  on public.dealers ((lower(btrim(email))))
  where approval_status = 'pending'
    and email is not null
    and btrim(email) <> '';
