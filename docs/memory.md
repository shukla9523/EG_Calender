# Memory · EG-Calendar · v3.0

**Product:** EG-Calendar (Enterprise Multi-Tenant SaaS Calendar & Scheduling Platform)  
**Document owner:** Engineering Lead / CTO  
**Status:** Living Engineering Memory  
**Version:** 3.0  
**Last updated:** 2026-11-06  

---

## Decisions

- **2026-11-06 · Two Protected Owner Accounts Architecture · why:** Enforces centralized governance while strictly isolating tenant workspaces. Database triggers guarantee exactly two owners, preventing creation of a third owner or deletion/demotion of either owner · **by:** CTO & CEO
- **2026-11-06 · Two-Way Sync Engine for Google & Zoho + Zoho Tasks · why:** Solves enterprise multi-calendar friction where meetings and tasks created in Zoho must be reflected in Google Calendar and vice versa; persistent mapping hashes eliminate infinite loops · **by:** CTO
- **2026-11-06 · "Check Many, Write One" Destination Booking Invariant · why:** Full multi-calendar conflict checking guarantees zero double-bookings, while writing confirmed bookings strictly to the single designated destination calendar prevents event duplication storms · **by:** CTO
- **2026-11-06 · PostgreSQL TTL Cache Table (`cache_entries`) Without Redis · why:** Redis is strictly forbidden; a dedicated PostgreSQL cache table with timestamped expiration and automatic eviction triggers provides fast, dependency-free TTL caching · **by:** Database Architect
- **2026-11-06 · Next.js 16.4 + Supabase Edge Functions with Service Workers for Browser Only · why:** Eliminates separate custom backend maintenance; all privileged logic executes in Supabase Deno Edge Functions and PostgreSQL RPCs; service workers are restricted to browser-side PWA and offline asset caching · **by:** CTO
- **2026-11-06 · 400 Lines of Code Limit per File & Development Card · why:** Guarantees strict modularity, high maintainability, and clean reviewability across all components and edge functions · **by:** Engineering Lead
- **2026-11-05 · 1-Click "Approve & Gmail" Compose Integration · why:** Provides instantaneous host approvals without requiring a self-managed transactional email server, allowing the host to add personal touches before sending · **by:** CTO
- **2026-10-31 · AES-GCM-256 Encryption in Supabase Vault for OAuth Tokens · why:** Exposing refresh tokens in client bundles or unencrypted database rows risks complete calendar account takeover; tokens must remain in secure serverless memory · **by:** Security Lead

---

## Known Issues and Gotchas

- **2026-11-06 · Zoho API Regional Datacenter Endpoints · fix:** Regional domain switching must dynamically select `accounts.zoho.in`, `accounts.zoho.com`, or `accounts.zoho.eu` based on the user's datacenter location · **test:** `test/integration/zoho-regions.spec.ts`
- **2026-11-06 · Synchronous setState inside useEffect in Date Formatters · fix:** Derived state or memoized formatters must be computed directly during render to prevent cascading renders and ESLint errors · **test:** `npm --prefix src run lint`
- **2026-11-04 · Google Calendar FreeBusy UTC Normalization · fix:** Normalize all incoming FreeBusy blocks to UTC milliseconds internally and format with IANA timezone strings (`Intl.DateTimeFormat`) on the client · **test:** `test/unit/timezone-dst.spec.ts`
- **2026-11-01 · Rapid Double-Clicking on Public Booking Submission · fix:** Applied PostgreSQL transaction with row lock and unique index constraint on `(host_user_id, start_time, end_time)` where `status != 'cancelled'` · **test:** `test/unit/booking-concurrency.test.ts`

---

## Patterns to Follow

- **Any List Page:** Always combine `usePaginatedQuery` with `Skeleton` primitives, debounced search (300 ms), and explicit `EmptyState` component.
- **Provider API Calls:** Never invoke Google or Zoho APIs from browser components; always route through authenticated Supabase Edge Functions with a 20-second timeout and 2 retries.
- **Tenant Authorization:** Derive tenant authorization strictly from `auth.uid()` and verified `user_profiles.status = 'approved'`; never trust tenant IDs from client headers or payloads.
- **Owner Account Guards:** Protected owner accounts cannot be modified or deleted via user management endpoints; guarded by PostgreSQL triggers.
- **Styling Rules:** Use exclusively `tokens.css` variables and `global.css` utility classes (`.card`, `.btn-primary`, `.stack`, `.row-between`); avoid raw Tailwind colors outside the token palette.
- **Error Messages:** Format user feedback as **What Happened + What To Do** (e.g., "Calendar sync expired. Please click Reconnect to refresh credentials.").

---

## Change Log

- **v3.3.0 · 2026-11-07:** Replaced legacy `profiles` table references with live Supabase `user_profiles` schema across auth, team API (`/api/team`), user session (`/api/user/me`), and owner user management (`/api/owner/users`). Completely eliminated dummy fallback emails (`member@workspace.local`) and placeholder names (`Team Member`), dynamically binding to live Supabase protected owner accounts (`Saurabh Sharma (Owner 1)` and `Saurabh Sharma (Owner 2)`).
- **v3.2.0 · 2026-11-07:** Complete elimination of hardcoded references across entire codebase (fallback UUIDs, hardcoded slugs, hardcoded domains replaced with dynamic Supabase organization and environment resolution). Verified zero exposure of protected owner identities (`sharmasaurabh2604@gmail.com` and `saurabh.electroglobal@gmail.com`) in any client bundles. Live Supabase database fully connected with migrations, triggers, RLS, and owner protection triggers actively verified. All 18 unit tests passing, ESLint 0 errors, dev server running cleanly.
- **v3.1.0 · 2026-11-07:** Completed dynamic scheduling profile manager UI (`/availability` & `/api/profiles`), universal expiration selector on link builder (`/links/new`), centralized expiration utilities (`src/lib/expiration.ts`), HMAC-SHA256 webhook signing & timing-safe verification (`src/lib/webhooks/hmac.ts`), PWA Web App Manifest, browser-side service worker (`/sw.js`) for static caching & offline application shell, local Supabase seed data (`supabase/seed.sql`), dynamic robots handler (`/robots.txt`) with staging noindex enforcement, auto-generated XML sitemap (`/sitemap.xml`), complete production deployment runbook (`docs/deployment-runbook.md`), Zoho multi-region datacenter selector (`in`, `com`, `eu`), and instant manual "Sync Now" API (`/api/integrations/sync`). All 42 static & dynamic Next.js routes compiled cleanly via Turbopack. 100% Vitest unit tests passing (18/18 tests across 5 test suites).
- **v3.0.0 · 2026-11-06:** Updated to Master Implementation Prompt V3; added two protected owner accounts, controlled user registration approval lifecycle, two-way sync engine for Google & Zoho, Zoho Tasks-to-Google Events sync, public scheduling API, webhooks queue, and PostgreSQL TTL caching without Redis.
- **v1.0.0 · 2026-11-05:** Production deployment baseline on Vercel; verified Google Cloud OAuth, live availability calendar, public booking link, and 1-click Gmail compose approval workflow.
