-- ==============================================================================
-- Migration: 20261107000000_bootstrap_two_owners.sql
-- Purpose: Backend-only configuration of the Two Protected Owner Accounts
--          (sharmasaurabh2604@gmail.com & saurabh.electroglobal@gmail.com)
--          NEVER exposed in client-side / frontend code.
-- ==============================================================================

-- 1. Automated Recognition Trigger for the Two Protected Owners
create or replace function public.handle_owner_registration()
returns trigger as $$
declare
  designated_owner_1 text := 'sharmasaurabh2604@gmail.com';
  designated_owner_2 text := 'saurabh.electroglobal@gmail.com';
  existing_count integer;
begin
  -- Check if user matches designated Owner 1
  if lower(new.email) = lower(designated_owner_1) then
    select count(*) into existing_count from public.owner_accounts where owner_number = 1;
    if existing_count = 0 then
      insert into public.owner_accounts (id, owner_number, email)
      values (new.id, 1, new.email)
      on conflict (owner_number) do nothing;

      -- Mark profile approved
      update public.profiles
      set status = 'approved', approved_at = now()
      where id = new.id;
    end if;

  -- Check if user matches designated Owner 2
  elsif lower(new.email) = lower(designated_owner_2) then
    select count(*) into existing_count from public.owner_accounts where owner_number = 2;
    if existing_count = 0 then
      insert into public.owner_accounts (id, owner_number, email)
      values (new.id, 2, new.email)
      on conflict (owner_number) do nothing;

      -- Mark profile approved
      update public.profiles
      set status = 'approved', approved_at = now()
      where id = new.id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger attaches to profiles on insert
drop trigger if exists trg_recognize_owners on public.profiles;
create trigger trg_recognize_owners
after insert or update of email on public.profiles
for each row execute function public.handle_owner_registration();

-- 2. Retroactive check: If users already exist in auth.users, register them immediately
do $$
declare
  u1_id uuid;
  u2_id uuid;
begin
  select id into u1_id from auth.users where lower(email) = 'sharmasaurabh2604@gmail.com' limit 1;
  select id into u2_id from auth.users where lower(email) = 'saurabh.electroglobal@gmail.com' limit 1;

  if u1_id is not null then
    insert into public.owner_accounts (id, owner_number, email)
    values (u1_id, 1, 'sharmasaurabh2604@gmail.com')
    on conflict (owner_number) do nothing;

    update public.profiles set status = 'approved', approved_at = now() where id = u1_id;
  end if;

  if u2_id is not null then
    insert into public.owner_accounts (id, owner_number, email)
    values (u2_id, 2, 'saurabh.electroglobal@gmail.com')
    on conflict (owner_number) do nothing;

    update public.profiles set status = 'approved', approved_at = now() where id = u2_id;
  end if;
end;
$$;

