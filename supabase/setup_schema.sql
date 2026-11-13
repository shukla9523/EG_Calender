-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  first_name text,
  last_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  timezone text default 'UTC' not null,
  status text default 'active' not null check (status in ('active', 'suspended', 'pending')),
  plan text default 'free' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ORGANIZATION MEMBERSHIPS
create table public.organization_memberships (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'member' not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(organization_id, user_id)
);

-- ACCESS REQUESTS
create table public.access_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade, -- null means request to create new org
  status text default 'pending' not null check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- INVITATIONS
create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  email text not null,
  role text default 'member' not null check (role in ('owner', 'admin', 'member')),
  token_hash text unique not null,
  invited_by uuid references auth.users(id) on delete cascade not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now() not null
);

-- RLS setup (Policies will be added in task 2.4, just enabling for now)
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.access_requests enable row level security;
alter table public.invitations enable row level security;
-- RLS Policies for Profiles
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- RLS Policies for Organizations
-- Users can view organizations they are members of
create policy "Users can view organizations they belong to"
  on public.organizations
  for select
  using (
    exists (
      select 1
      from public.organization_memberships
      where organization_id = public.organizations.id
      and user_id = auth.uid()
    )
  );

-- Only members with 'owner' or 'admin' role can update the organization
create policy "Owners and admins can update their organization"
  on public.organizations
  for update
  using (
    exists (
      select 1
      from public.organization_memberships
      where organization_id = public.organizations.id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- RLS Policies for Organization Memberships
-- Users can view memberships for organizations they belong to.
-- We must avoid querying public.organization_memberships recursively.
-- Instead, we just check if the user is viewing their OWN membership row,
-- OR we use a security definer function/separate table to avoid recursion.
-- The simplest way without recursion is to allow users to read ANY membership
-- for an org ID they are a part of, but doing that purely via the table
-- causes infinite recursion.
-- For now, the most secure non-recursive policy is: A user can see their own membership.
-- (To see other team members, they join through organizations or we create a materialized view/function).
-- To support team viewing safely:
-- To support team viewing safely without recursion in a pure RLS check,
-- you can just let the user read their own row, and then use a helper function
-- for org-wide checks. However, Postgres 15+ allows `organization_id IN (SELECT ...)`
-- safely without recursion if we are careful, but the safest way to avoid all recursion
-- issues for reading the entire team list is to use a SECURITY DEFINER helper function.
-- For this baseline, we will only allow users to see their OWN membership.
-- In phase 7 (Admin), we will add the team-level function.

create policy "Users can view their own memberships"
  on public.organization_memberships
  for select
  using (user_id = auth.uid());

-- Access Requests Policies
create policy "Users can view their own access requests"
  on public.access_requests
  for select
  using (user_id = auth.uid());

create policy "Users can insert their own access requests"
  on public.access_requests
  for insert
  with check (user_id = auth.uid());

-- Organization admins can view access requests for their organization
create policy "Admins can view access requests for their org"
  on public.access_requests
  for select
  using (
    exists (
      select 1
      from public.organization_memberships
      where organization_id = public.access_requests.organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Invitations Policies
create policy "Admins can insert invitations"
  on public.invitations
  for insert
  with check (
    exists (
      select 1
      from public.organization_memberships
      where organization_id = public.invitations.organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
    )
    and invited_by = auth.uid()
  );

create policy "Admins can view invitations"
  on public.invitations
  for select
  using (
    exists (
      select 1
      from public.organization_memberships
      where organization_id = public.invitations.organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );
-- CALENDAR CONNECTIONS
create table public.calendar_connections (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('google', 'zoho')),
  provider_account_id text not null,
  provider_email text not null,
  status text default 'connected' not null check (status in ('connected', 'error', 'revoked', 'disconnected')),
  last_sync_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, provider, provider_account_id)
);

-- CALENDARS
create table public.calendars (
  id uuid primary key default uuid_generate_v4(),
  connection_id uuid references public.calendar_connections(id) on delete cascade not null,
  provider_calendar_id text not null,
  name text not null,
  is_primary boolean default false not null,
  is_read_only boolean default false not null,
  timezone text default 'UTC' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(connection_id, provider_calendar_id)
);

-- BOOKING LINKS (Stubbed for FK reference, full schema in Phase 5)
create table public.booking_links (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  slug text unique not null,
  created_at timestamptz default now() not null
);

-- BOOKING LINK CALENDARS
create table public.booking_link_calendars (
  id uuid primary key default uuid_generate_v4(),
  booking_link_id uuid references public.booking_links(id) on delete cascade not null,
  calendar_id uuid references public.calendars(id) on delete cascade not null,
  selection_type text not null check (selection_type in ('conflict_check', 'destination')),
  created_at timestamptz default now() not null,
  unique(booking_link_id, calendar_id, selection_type)
);

-- Enable RLS
alter table public.calendar_connections enable row level security;
alter table public.calendars enable row level security;
alter table public.booking_links enable row level security;
alter table public.booking_link_calendars enable row level security;

-- Calendar Connections Policies
create policy "Users can view their own connections"
  on public.calendar_connections
  for select
  using (user_id = auth.uid());

create policy "Users can update their own connections"
  on public.calendar_connections
  for update
  using (user_id = auth.uid());

create policy "Users can delete their own connections"
  on public.calendar_connections
  for delete
  using (user_id = auth.uid());

-- Calendars Policies
create policy "Users can view calendars for their connections"
  on public.calendars
  for select
  using (
    exists (
      select 1
      from public.calendar_connections
      where id = public.calendars.connection_id
      and user_id = auth.uid()
    )
  );

create policy "Users can update calendars for their connections"
  on public.calendars
  for update
  using (
    exists (
      select 1
      from public.calendar_connections
      where id = public.calendars.connection_id
      and user_id = auth.uid()
    )
  );

-- Booking Link Calendars Policies
create policy "Users can view their own booking link calendars"
  on public.booking_link_calendars
  for select
  using (
    exists (
      select 1
      from public.booking_links
      where id = public.booking_link_calendars.booking_link_id
      and user_id = auth.uid()
    )
  );
-- WORKING HOURS
create table public.working_hours (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  timezone text default 'UTC' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, day_of_week)
);

-- AVAILABILITY OVERRIDES
create table public.availability_overrides (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  override_date date not null,
  is_available boolean not null,
  start_time time, -- null if is_available is false (full day blocked)
  end_time time,
  timezone text default 'UTC' not null,
  created_at timestamptz default now() not null,
  unique(user_id, override_date)
);

alter table public.working_hours enable row level security;
alter table public.availability_overrides enable row level security;

-- Working Hours Policies
create policy "Users can view their own working hours"
  on public.working_hours
  for select
  using (user_id = auth.uid());

create policy "Users can manage their own working hours"
  on public.working_hours
  for all
  using (user_id = auth.uid());

-- Availability Overrides Policies
create policy "Users can view their own overrides"
  on public.availability_overrides
  for select
  using (user_id = auth.uid());

create policy "Users can manage their own overrides"
  on public.availability_overrides
  for all
  using (user_id = auth.uid());
-- Drop the stubbed booking_links table and its dependents from Task 3.1
-- FULL BOOKING LINKS SCHEMA (alter existing tables instead of drop)
alter table public.booking_links
  add column title text not null default 'Untitled',
  add column duration_minutes integer not null default 30,
  add column buffer_before_minutes integer not null default 0,
  add column buffer_after_minutes integer not null default 0,
  add column minimum_notice_hours integer not null default 24,
  add column booking_horizon_days integer not null default 60,
  add column status text default 'published' not null check (status in ('published', 'draft', 'archived')),
  add column updated_at timestamptz default now() not null;

-- BOOKINGS
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  booking_link_id uuid references public.booking_links(id) on delete cascade not null,
  invitee_email text not null,
  invitee_name text not null,
  invitee_notes text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  invitee_timezone text not null,
  destination_calendar_id uuid references public.calendars(id) on delete cascade not null,
  provider_event_id text, -- ID returned by Google/Zoho
  status text default 'pending' not null check (status in ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  idempotency_key text unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- BOOKING AUDIT EVENTS
create table public.booking_audit_events (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references public.bookings(id) on delete cascade not null,
  actor_type text not null check (actor_type in ('invitee', 'host', 'system')),
  action text not null,
  previous_status text,
  new_status text,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.booking_links enable row level security;
alter table public.booking_link_calendars enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_audit_events enable row level security;

-- Booking Links Policies
create policy "Users can view links for their orgs"
  on public.booking_links for select using (
    organization_id in (select organization_id from public.organization_memberships where user_id = auth.uid())
  );
create policy "Users can update links for their orgs"
  on public.booking_links for update using (
    organization_id in (select organization_id from public.organization_memberships where user_id = auth.uid())
  );
create policy "Users can insert links for their orgs"
  on public.booking_links for insert with check (
    organization_id in (select organization_id from public.organization_memberships where user_id = auth.uid())
  );

-- Booking Link Calendars Policies
create policy "Users can view calendars for their links"
  on public.booking_link_calendars for select using (
    exists (select 1 from public.booking_links where id = booking_link_id and organization_id in (
      select organization_id from public.organization_memberships where user_id = auth.uid()
    ))
  );

-- Bookings Policies (Basic host access, public access would use secure Edge Functions or signed tokens, not naked RLS reads)
create policy "Hosts can view bookings for their links"
  on public.bookings for select using (
    exists (select 1 from public.booking_links where id = booking_link_id and organization_id in (
      select organization_id from public.organization_memberships where user_id = auth.uid()
    ))
  );
-- NOTE: Supabase uses pg_cron to schedule repeating database tasks.
-- In a real setup, pg_cron extension needs to be enabled by a superuser, which Supabase allows on their platform.
create extension if not exists pg_cron;

-- Create a generic function that makes an HTTP request to our Edge Function for provider reconciliation
-- This requires pg_net extension on Supabase
create extension if not exists pg_net;

-- Mock SQL block describing how the cron job would be defined
/*
select cron.schedule(
  'provider-reconciliation',
  '*/15 * * * *', -- Every 15 minutes
  $$
  select net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/provider-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
      body:='{"source": "pg_cron"}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'send-upcoming-reminders',
  '*/5 * * * *', -- Every 5 minutes
  $$
  select net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/process-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb
  ) as request_id;
  $$
);
*/
-- API KEYS
create table public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete cascade not null,
  name text not null,
  key_hint text not null, -- First/last few characters to identify it
  key_hash text unique not null, -- Hashed secret
  scopes text[] default array['read', 'write'] not null,
  last_used_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- WEBHOOK ENDPOINTS
create table public.webhook_endpoints (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete cascade not null,
  url text not null,
  description text,
  signing_secret_hash text not null,
  events text[] default array['booking.created', 'booking.updated', 'booking.cancelled'] not null,
  status text default 'active' not null check (status in ('active', 'inactive', 'failing')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- WEBHOOK DELIVERIES
create table public.webhook_deliveries (
  id uuid primary key default uuid_generate_v4(),
  endpoint_id uuid references public.webhook_endpoints(id) on delete cascade not null,
  event_type text not null,
  payload jsonb not null,
  request_headers jsonb,
  response_status integer,
  response_body text,
  duration_ms integer,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.api_keys enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

-- Policies for API Keys
create policy "Admins can manage API keys for their orgs"
  on public.api_keys for all using (
    organization_id in (
      select organization_id from public.organization_memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Admins can manage Webhooks for their orgs"
  on public.webhook_endpoints for all using (
    organization_id in (
      select organization_id from public.organization_memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Admins can view Webhook deliveries for their orgs"
  on public.webhook_deliveries for select using (
    exists (
      select 1 from public.webhook_endpoints
      where id = endpoint_id and organization_id in (
        select organization_id from public.organization_memberships
        where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );
-- Create indexes to optimize hot query paths, specifically foreign keys heavily used in RLS policies

-- Optimize profile looks up by email
create index if not exists idx_profiles_email on public.profiles(email);

-- Optimize organization membership checks (critical for most RLS policies)
create index if not exists idx_org_members_user on public.organization_memberships(user_id);
create index if not exists idx_org_members_org on public.organization_memberships(organization_id);

-- Optimize connection and calendar lookups
create index if not exists idx_calendar_connections_user on public.calendar_connections(user_id);
create index if not exists idx_calendars_connection on public.calendars(connection_id);

-- Optimize booking link lookups
create index if not exists idx_booking_links_org on public.booking_links(organization_id);
create index if not exists idx_booking_links_slug on public.booking_links(slug);

-- Optimize bookings lookups
create index if not exists idx_bookings_link on public.bookings(booking_link_id);
create index if not exists idx_bookings_destination on public.bookings(destination_calendar_id);
create index if not exists idx_bookings_status on public.bookings(status);

-- Optimize webhook deliveries lookup by endpoint
create index if not exists idx_webhook_deliveries_endpoint on public.webhook_deliveries(endpoint_id);
