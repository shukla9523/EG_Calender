# AGENTS.md · EG-Calendar Guidance

Before any change, read docs/rules.md, docs/architecture.md, docs/design.md, docs/performance.md. Check docs/memory.md. Work only from an approved plan in docs/task.md. Keep changes minimal.

## Key Project Rules
- **Stack:** Next.js 16.4 (App Router) + Supabase Managed Platform (PostgreSQL, Auth, RLS, Edge Functions). No separate custom Express/Nest backend or Redis cluster. Service workers are browser-side only (PWA/offline/static caching).
- **Two Protected Owners:** Exactly two Owner accounts initialized atomically via secure bootstrap. Centralized Owner Administration Workspace. DB-level protection prevents deletion, demotion, or registration of a third owner. Private tenant workspaces remain isolated.
- **Controlled User Registration & Approvals:** User registration enters 'Pending Approval' status until approved by either Owner. Statuses: Pending Approval, Approved, Rejected, Suspended, Disabled.
- **Two-Way Synchronization:** Two-way sync engine for Google & Zoho Calendars + Zoho Tasks to Google Events with persistent mappings, idempotency, duplicate prevention, and deletion handling.
- **Zero-Conflict Booking Engine:** Multi-calendar busy block retrieval across all accounts, normalized timezones, PostgreSQL advisory/row-level lock reservations, atomic confirm.
- **Dynamic Scheduling Profiles & Links:** Configurable profiles (working hours vs booking windows, buffers, notice, horizon, daily limits), universal link expiration (Never, 1h, 24h, 7d, 30d, custom).
- **Public API & Webhooks:** Scoped API keys, rate limits, OpenAPI documentation, database-backed webhook queue with exponential backoff.
- **Code Limits:** Maximum 400 lines per file/development card, maximum 50 lines per function.
- **Design Tokens:** Strict adherence to `docs/design.md` executive green palette (`--color-primary: #147D52`).
