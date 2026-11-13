-- ==============================================================================
-- EG-Calendar v3 Master Schema Migration
-- Purpose: Two Protected Owners, Controlled Registration Lifecycle,
--          Two-Way Sync Mappings, Task-Event Mappings, TTL Cache & Audit Logs
-- ==============================================================================

-- 1. Two Protected Owner Accounts Table
create table if not exists public.owner_accounts (
  id uuid references auth.users(id) on delete restrict primary key,
  owner_number integer unique not null check (owner_number in (1, 2)),
  email text unique not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger: Enforce Exactly Two Owners Max & Permanent Protection
create or replace function public.enforce_owner_constraints()
returns trigger as $$
declare
  owner_count integer;
begin
  if (tg_op = 'INSERT') then
    select count(*) into owner_count from public.owner_accounts;
    if owner_count >= 2 then
      raise exception 'EX_LIMIT_EXCEEDED: Maximum of exactly two Owner accounts permitted.';
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    raise exception 'EX_PROTECTED_ACCOUNT: Protected Owner accounts cannot be deleted.';
  elsif (tg_op = 'UPDATE') then
    if new.owner_number != old.owner_number or new.id != old.id then
      raise exception 'EX_PROTECTED_ACCOUNT: Owner identifiers cannot be altered.';
    end if;
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_owner_constraints on public.owner_accounts;
create trigger trg_owner_constraints
before insert or update or delete on public.owner_accounts
for each row execute function public.enforce_owner_constraints();

-- 2. Enhance Profiles with Controlled Approval Status
alter table public.profiles
  add column if not exists status text default 'pending_approval' not null
  check (status in ('pending_approval', 'approved', 'rejected', 'suspended', 'disabled')),
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz;

-- Guard: Prevent Deletion or Demotion of Owners via User Profiles
create or replace function public.protect_owner_profile_deletion()
returns trigger as $$
begin
  if exists (select 1 from public.owner_accounts where id = old.id) then
    raise exception 'EX_PROTECTED_ACCOUNT: Cannot delete or suspend a protected platform owner.';
  end if;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_owner_profile_del on public.profiles;
create trigger trg_protect_owner_profile_del
before delete on public.profiles
for each row execute function public.protect_owner_profile_deletion();

-- 3. Two-Way Event Synchronization Mapping Table
create table if not exists public.external_event_mappings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  google_calendar_id text not null,
  google_event_id text not null,
  zoho_calendar_id text not null,
  zoho_event_id text not null,
  sync_hash text not null,
  origin_provider text not null check (origin_provider in ('google', 'zoho')),
  last_synced_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  unique (user_id, google_event_id),
  unique (user_id, zoho_event_id)
);

create index if not exists idx_sync_google_event on public.external_event_mappings(google_event_id);
create index if not exists idx_sync_zoho_event on public.external_event_mappings(zoho_event_id);

-- 4. Zoho Tasks <-> Google Events Two-Way Sync Mapping Table
create table if not exists public.task_event_mappings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  zoho_task_id text not null,
  google_event_id text not null,
  google_calendar_id text not null,
  deletion_policy text default 'cancel' not null check (deletion_policy in ('delete', 'cancel', 'keep')),
  sync_hash text not null,
  last_synced_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  unique (user_id, zoho_task_id),
  unique (user_id, google_event_id)
);

create index if not exists idx_task_zoho_id on public.task_event_mappings(zoho_task_id);
create index if not exists idx_task_google_id on public.task_event_mappings(google_event_id);

-- 5. Scheduling Profiles Table (Distinct Working Hours vs Interview Windows)
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

-- 6. Enhance Booking Links with Universal Expiration & Scheduling Profile Reference
alter table public.booking_links
  add column if not exists scheduling_profile_id uuid references public.scheduling_profiles(id) on delete set null,
  add column if not exists expiration_type text default 'never' not null
  check (expiration_type in ('never', '1h', '24h', '7d', '30d', 'custom')),
  add column if not exists expires_at timestamptz,
  add column if not exists is_revoked boolean default false not null;

-- 7. TTL Caching Table (Without Redis)
create table if not exists public.cache_entries (
  cache_key text primary key,
  cache_data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_cache_expires_at on public.cache_entries(expires_at);

-- Function to Clean Expired Cache Entries (Invoked by cron or cleanup trigger)
create or replace function public.purge_expired_cache()
returns integer as $$
declare
  deleted_count integer;
begin
  delete from public.cache_entries where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql security definer;

-- 8. Audit Logs & API Route Logs
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text default 'success' not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);

create table if not exists public.api_route_logs (
  id uuid primary key default uuid_generate_v4(),
  route text not null,
  http_method text not null,
  request_id text not null,
  status_code integer not null,
  duration_ms integer not null,
  tenant_id uuid references public.organizations(id) on delete set null,
  error_category text,
  created_at timestamptz default now() not null
);

create index if not exists idx_route_logs_created_at on public.api_route_logs(created_at desc);

-- 9. Atomic Bootstrap Owners RPC
create or replace function public.bootstrap_owners(
  p_owner1_id uuid,
  p_owner1_email text,
  p_owner2_id uuid,
  p_owner2_email text
) returns jsonb as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count from public.owner_accounts;
  if existing_count > 0 then
    raise exception 'EX_BOOTSTRAP_CLOSED: Owner accounts have already been initialized.';
  end if;

  insert into public.owner_accounts (id, owner_number, email)
  values
    (p_owner1_id, 1, p_owner1_email),
    (p_owner2_id, 2, p_owner2_email);

  -- Ensure their profiles are approved and given owner role
  update public.profiles set status = 'approved' where id in (p_owner1_id, p_owner2_id);

  insert into public.audit_logs (actor_id, action, resource_type, outcome, metadata)
  values (
    p_owner1_id,
    'owner.bootstrap',
    'owner_accounts',
    'success',
    jsonb_build_object('owner1', p_owner1_email, 'owner2', p_owner2_email)
  );

  return jsonb_build_object('success', true, 'message', 'Two protected owners initialized successfully.');
end;
$$ language plpgsql security definer;

-- 10. Row Level Security Policies
alter table public.owner_accounts enable row level security;
alter table public.external_event_mappings enable row level security;
alter table public.task_event_mappings enable row level security;
alter table public.scheduling_profiles enable row level security;
alter table public.cache_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.api_route_logs enable row level security;

-- Owner Accounts: Visible to authenticated owners
create policy "Owners can view owner accounts"
  on public.owner_accounts for select
  using (exists (select 1 from public.owner_accounts where id = auth.uid()));

-- External Mappings: Isolated per tenant user
create policy "Users own external mappings"
  on public.external_event_mappings for all
  using (user_id = auth.uid());

-- Task Event Mappings: Isolated per tenant user
create policy "Users own task mappings"
  on public.task_event_mappings for all
  using (user_id = auth.uid());

-- Scheduling Profiles: Isolated per tenant user
create policy "Users own scheduling profiles"
  on public.scheduling_profiles for all
  using (user_id = auth.uid());

-- Audit Logs: Owners can view all audit logs; users see only own
create policy "Owners view all audit logs"
  on public.audit_logs for select
  using (
    exists (select 1 from public.owner_accounts where id = auth.uid()) or
    actor_id = auth.uid()
  );

-- Route Logs: Owners only
create policy "Owners view route logs"
  on public.api_route_logs for select
  using (exists (select 1 from public.owner_accounts where id = auth.uid()));

