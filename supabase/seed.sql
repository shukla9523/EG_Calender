-- ==============================================================================
-- Supabase Local Seed Data · EG-Calendar v3.0
-- ==============================================================================

-- 1. Base Organization
insert into public.organizations (id, name, slug, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'EG-Calendar Enterprise Workspace',
  'eg-calendar',
  'Asia/Kolkata'
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  timezone = excluded.timezone;

-- 2. Default Working Hours (Monday through Friday, 09:00 - 18:00)
insert into public.working_hours (id, organization_id, day_of_week, start_time, end_time, is_active)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 1, '09:00:00', '18:00:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 2, '09:00:00', '18:00:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 3, '09:00:00', '18:00:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 4, '09:00:00', '18:00:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 5, '09:00:00', '18:00:00', true)
on conflict do nothing;
