-- ==============================================================================
-- EG-Calendar v3.0 · Complete Master Database Migration & Two-Owner Bootstrap
-- Execute this script in: https://supabase.com/dashboard/project/uguuxgtzzljxwdyhczcs/sql/new
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Organizations Table
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  timezone text default 'Asia/Kolkata' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. User Profiles & Approval Lifecycle
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  status text default 'pending_approval' not null check (status in ('pending_approval', 'approved', 'rejected', 'suspended', 'disabled')),
  role text default 'member' not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. Organization Memberships
create table if not exists public.organization_memberships (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'member' not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now() not null,
  unique (organization_id, user_id)
);

-- 5. Protected Owner Accounts Table
create table if not exists public.owner_accounts (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  owner_number integer not null check (owner_number in (1, 2)),
  is_protected boolean default true not null,
  created_at timestamptz default now() not null,
  unique (email),
  unique (owner_number)
);

-- 6. Trigger: Strict Database-Level Owner Invariant
create or replace function public.trg_owner_constraints()
returns trigger
language plpgsql
security definer
as $$
declare
  owner_count integer;
begin
  if TG_OP = 'INSERT' then
    select count(*) into owner_count from public.owner_accounts;
    if owner_count >= 2 then
      raise exception 'SECURITY_VIOLATION: Exactly two owner accounts are allowed. Registration of a third owner is permanently blocked.';
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    raise exception 'SECURITY_VIOLATION: Protected owner accounts cannot be deleted from the database.';
  elsif TG_OP = 'UPDATE' then
    if OLD.is_protected = true and NEW.is_protected = false then
      raise exception 'SECURITY_VIOLATION: Protected status cannot be removed from an owner account.';
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists check_owner_limits on public.owner_accounts;
create trigger check_owner_limits
  before insert or update or delete on public.owner_accounts
  for each row execute function public.trg_owner_constraints();

-- 7. Trigger: Protect Owner User Profiles From Deletion
create or replace function public.trg_protect_owner_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  if exists (select 1 from public.owner_accounts where id = OLD.id) then
    raise exception 'SECURITY_VIOLATION: User profiles associated with protected owner accounts cannot be deleted.';
  end if;
  return OLD;
end;
$$;

drop trigger if exists check_owner_profile_deletion on public.user_profiles;
create trigger check_owner_profile_deletion
  before delete on public.user_profiles
  for each row execute function public.trg_protect_owner_profile();

-- 8. Scheduling Profiles (Working Hours vs Booking Windows)
create table if not exists public.scheduling_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  profile_type text default 'general' not null check (profile_type in ('general', 'technical_interview', 'hr_interview', 'client_meeting', 'personal', 'custom')),
  duration_minutes integer default 30 not null,
  buffer_before_minutes integer default 0 not null,
  buffer_after_minutes integer default 15 not null,
  minimum_notice_hours integer default 24 not null,
  booking_horizon_days integer default 60 not null,
  max_bookings_per_day integer default 8 not null,
  working_hours jsonb not null default '[{"day":"monday","start":"09:00","end":"17:00"},{"day":"tuesday","start":"09:00","end":"17:00"},{"day":"wednesday","start":"09:00","end":"17:00"},{"day":"thursday","start":"09:00","end":"17:00"},{"day":"friday","start":"09:00","end":"17:00"}]',
  booking_window jsonb not null default '[{"day":"monday","start":"12:00","end":"16:00"},{"day":"tuesday","start":"12:00","end":"16:00"},{"day":"wednesday","start":"12:00","end":"16:00"},{"day":"thursday","start":"12:00","end":"16:00"},{"day":"friday","start":"12:00","end":"16:00"}]',
  timezone text default 'UTC' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 9. Booking Links & Universal Expiration
create table if not exists public.booking_links (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  scheduling_profile_id uuid references public.scheduling_profiles(id) on delete set null,
  slug text unique not null,
  title text not null,
  duration_minutes integer default 30 not null,
  buffer_before_minutes integer default 0 not null,
  buffer_after_minutes integer default 15 not null,
  expiration_type text default 'never' not null check (expiration_type in ('never', '1h', '24h', '7d', '30d', 'custom')),
  expires_at timestamptz,
  is_revoked boolean default false not null,
  status text default 'published' not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 10. Working Hours Baseline
create table if not exists public.working_hours (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- 11. Two-Way Sync Mapping Tables
create table if not exists public.external_event_mappings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('google', 'zoho')),
  external_event_id text not null,
  internal_booking_id uuid references public.booking_links(id) on delete cascade,
  sync_hash text not null,
  last_synced_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  unique (user_id, provider, external_event_id)
);

create table if not exists public.task_event_mappings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  zoho_task_id text not null,
  google_event_id text not null,
  sync_hash text not null,
  last_synced_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  unique (user_id, zoho_task_id)
);

-- 12. TTL Caching Table (Without Redis)
create table if not exists public.cache_entries (
  cache_key text primary key,
  cache_data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);
create index if not exists idx_cache_expires_at on public.cache_entries(expires_at);

-- 13. Audit & Monitoring Logs
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb default '{}'::jsonb not null,
  outcome text default 'success' not null,
  created_at timestamptz default now() not null
);

create table if not exists public.api_route_logs (
  id uuid primary key default uuid_generate_v4(),
  route text not null,
  method text not null,
  status_code integer not null,
  duration_ms integer not null,
  ip_address text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 14. Two Protected Owners Auto-Recognition Trigger
create or replace function public.handle_owner_registration()
returns trigger
language plpgsql
security definer
as $$
declare
  owner1_email constant text := 'sharmasaurabh2604@gmail.com';
  owner2_email constant text := 'saurabh.electroglobal@gmail.com';
  target_owner_number integer;
begin
  if lower(trim(NEW.email)) = lower(owner1_email) then
    target_owner_number := 1;
  elsif lower(trim(NEW.email)) = lower(owner2_email) then
    target_owner_number := 2;
  else
    target_owner_number := null;
  end if;

  if target_owner_number is not null then
    insert into public.owner_accounts (id, email, owner_number, is_protected)
    values (NEW.id, lower(trim(NEW.email)), target_owner_number, true)
    on conflict (email) do update
      set id = NEW.id;

    insert into public.user_profiles (id, email, full_name, status, role)
    values (
      NEW.id,
      lower(trim(NEW.email)),
      coalesce(NEW.raw_user_meta_data->>'full_name', 'System Owner ' || target_owner_number),
      'approved',
      'owner'
    )
    on conflict (id) do update
      set status = 'approved',
          role = 'owner';
  else
    insert into public.user_profiles (id, email, full_name, status, role)
    values (
      NEW.id,
      lower(trim(NEW.email)),
      coalesce(NEW.raw_user_meta_data->>'full_name', 'Team Member'),
      'pending_approval',
      'member'
    )
    on conflict (id) do nothing;
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created_owner on auth.users;
create trigger on_auth_user_created_owner
  after insert on auth.users
  for each row execute function public.handle_owner_registration();

-- 15. Base Seed Data
insert into public.organizations (id, name, slug, timezone)
values ('00000000-0000-0000-0000-000000000001', 'EG-Calendar Enterprise Workspace', 'eg-calendar', 'Asia/Kolkata')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  timezone = excluded.timezone;

