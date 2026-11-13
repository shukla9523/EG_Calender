-- ==============================================================================
-- EG-Calendar v3.0 · Integrations, Bookings & Webhook Tables
-- Execute this script in: https://supabase.com/dashboard/project/snxulfckseifghgflaaf/sql/new
-- ==============================================================================

-- 1. Calendar Connections
create table if not exists public.calendar_connections (
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

-- 2. Calendars
create table if not exists public.calendars (
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

-- 3. Booking Link Calendars (Conflict detection vs Destination)
create table if not exists public.booking_link_calendars (
  id uuid primary key default uuid_generate_v4(),
  booking_link_id uuid references public.booking_links(id) on delete cascade not null,
  calendar_id uuid references public.calendars(id) on delete cascade not null,
  selection_type text not null check (selection_type in ('conflict_check', 'destination')),
  created_at timestamptz default now() not null,
  unique(booking_link_id, calendar_id, selection_type)
);

-- 4. Bookings
create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  booking_link_id uuid references public.booking_links(id) on delete cascade not null,
  invitee_email text not null,
  invitee_name text not null,
  invitee_notes text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  invitee_timezone text not null,
  destination_calendar_id uuid references public.calendars(id) on delete set null,
  provider_event_id text,
  status text default 'pending' not null check (status in ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  idempotency_key text unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 5. Booking Audit Events
create table if not exists public.booking_audit_events (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references public.bookings(id) on delete cascade not null,
  event_type text not null,
  details jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

-- 6. Webhook Endpoints & Deliveries
create table if not exists public.webhook_endpoints (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  url text not null,
  events text[] not null,
  signing_secret_hash text not null,
  status text default 'active' not null check (status in ('active', 'disabled')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default uuid_generate_v4(),
  endpoint_id uuid references public.webhook_endpoints(id) on delete cascade not null,
  event_type text not null,
  payload jsonb not null,
  request_headers jsonb,
  response_status integer,
  response_body text,
  duration_ms integer,
  attempt_count integer default 1 not null,
  status text default 'pending' not null,
  next_retry_at timestamptz,
  created_at timestamptz default now() not null
);

-- 7. Public API Keys
create table if not exists public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null,
  status text default 'active' not null check (status in ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz default now() not null
);

-- 8. Enable RLS
alter table public.calendar_connections enable row level security;
alter table public.calendars enable row level security;
alter table public.booking_link_calendars enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_audit_events enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.api_keys enable row level security;

-- 9. Base RLS Policies
create policy "Users manage own calendar connections"
  on public.calendar_connections for all
  using (user_id = auth.uid());

create policy "Users manage own calendars"
  on public.calendars for all
  using (
    exists (
      select 1 from public.calendar_connections
      where id = calendars.connection_id
      and user_id = auth.uid()
    )
  );

create policy "Org members manage webhooks"
  on public.webhook_endpoints for all
  using (
    exists (
      select 1 from public.organization_memberships
      where organization_id = webhook_endpoints.organization_id
      and user_id = auth.uid()
    )
  );

create policy "Org members view webhook deliveries"
  on public.webhook_deliveries for select
  using (
    exists (
      select 1 from public.webhook_endpoints we
      join public.organization_memberships om on om.organization_id = we.organization_id
      where we.id = webhook_deliveries.endpoint_id
      and om.user_id = auth.uid()
    )
  );

create policy "Org members manage api keys"
  on public.api_keys for all
  using (
    exists (
      select 1 from public.organization_memberships
      where organization_id = api_keys.organization_id
      and user_id = auth.uid()
    )
  );

