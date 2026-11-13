# EG-Calendar · v3.0

Enterprise Multi-Tenant SaaS Calendar, Scheduling, Synchronization & Public API Platform.

---

## Architecture Overview

- **Frontend & App Shell:** Next.js 16.4.3 (App Router, React 19, Turbopack, Tailwind CSS v4).
- **Theme Tokens:** Executive Green palette (`--color-primary: #147D52`).
- **Database & Auth:** Supabase PostgreSQL Managed Platform (Row Level Security, triggers, stored procedures, connection pooler).
- **Serverless Operations:** Supabase Edge Functions (Deno) for OAuth handshakes, two-way sync, conflict-free availability merge, and webhook dispatch.
- **Service Workers:** Browser-side only for offline app shell and static asset caching (`/sw.js`). No custom Node/Express/Nest backend and no Redis cluster.

---

## Core Invariants

1. **Two Protected Owners:** Exactly two protected Owner accounts initialized via secure bootstrap. Database triggers prevent deletion, demotion, or registration of a third owner. Centralized Owner Workspace at `/platform-admin/users`. Owner identities are never exposed in client bundles.
2. **Controlled Registration:** User signups enter `pending_approval` until reviewed by either Owner.
3. **Independent Integrations:** Minimal Google OAuth (`openid email profile`) for login; separate explicit OAuth flows for Google Calendar, Zoho Calendar, and Zoho Tasks.
4. **Two-Way Sync Engine:** Bidirectional sync between Google and Zoho Calendars, and Zoho Tasks to Google Calendar events with SHA-256 hash idempotency preventing recursive infinite loops.
5. **Zero-Conflict Booking:** Multi-calendar FreeBusy check across all accounts, normalized timezones, PostgreSQL advisory/row-level lock reservations, and atomic destination write ("Check Many, Write One").
6. **Dynamic Scheduling Profiles & Universal Expiration:** Profiles with independent working hours vs booking windows (e.g., 12 PM – 4 PM), buffers, notice, horizon, and daily limits. Universal link expiration (`never`, `1h`, `24h`, `7d`, `30d`, `custom`) serving HTTP 410 on expired links.
7. **PostgreSQL TTL Caching:** `cache_entries` table with automated purge triggers in PostgreSQL, completely eliminating Redis.
8. **Public API & Webhooks:** Scoped API keys, OpenAPI 3.0 specification (`/api/v1/openapi`), and signed HMAC-SHA256 webhook dispatcher with delivery logs.

---

## System Design Documentation (Strict SOP Set)

All core architecture and engineering specifications live in `docs/`:
- [`docs/prd.md`](docs/prd.md) — Product requirements, user stories, acceptance criteria, DPDP compliance.
- [`docs/architecture.md`](docs/architecture.md) — System map, data models, API route maps, sequence diagrams.
- [`docs/rules.md`](docs/rules.md) — Engineering invariants, code limits (< 400 LOC/file, < 50 LOC/function).
- [`docs/design.md`](docs/design.md) — Design tokens, executive green palette, UI components.
- [`docs/performance.md`](docs/performance.md) — 20-point checklist, PostgreSQL caching table, Web Vitals budgets.
- [`docs/task.md`](docs/task.md) — Active sprint task register (NTF-101 through NTF-111).
- [`docs/memory.md`](docs/memory.md) — Living engineering memory, decisions, gotchas, patterns.
- [`SETUP.md`](SETUP.md) — Complete setup and operations guide with zero local persistence.

---

## Local Development & Testing

### 1. Install Dependencies
```bash
npm install
npm --prefix src install
```

### 2. Environment Configuration
Copy `.env.example` to `src/.env.local` and configure your Supabase URL, anon key, and OAuth client credentials:
```bash
cp .env.example src/.env.local
```

### 3. Run Automated Tests
```bash
npm test
```
*Executes all Vitest unit tests covering booking concurrency, two-way sync hash idempotency, public API authentication, link expiration, and HMAC webhooks.*

### 4. Run Code Quality & Linting
```bash
npm run lint
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 6. Production Turbopack Build
```bash
npm run build
```

---

## Supabase Database & Migration Commands

```bash
# Push database migrations to remote Supabase project
npm run supabase:push

# Reset local database and seed baseline data
npm run supabase:reset

# Deploy Supabase Edge Functions
npm run supabase:deploy-functions
```
