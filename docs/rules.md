# Rules · EG-Calendar · v3.0

## 1. Company Core Rules
1. **Plan first:** No code without an approved plan in `docs/task.md`.
2. **Business logic only in backend services:** All calculations, availability merges, row locks, sync reconciliation, and permissions reside exclusively in Supabase Edge Functions and PostgreSQL functions/triggers; never in the frontend.
3. **No hardcoding:** Environmental values in `.env`, text in constants, styles in tokens (`tokens.css`), SEO values from `seo_meta`.
4. **Short code:** Reuse first; files < 400 lines, functions < 50; a one-line change stays one line.
5. **Naming conventions:**
   - PascalCase for React components (`CalendarGrid`, `BookingCard`).
   - camelCase for functions and variables (`fetchAvailability`, `selectedSlot`).
   - UPPER_SNAKE for constants (`DEFAULT_BOOKING_DURATION`).
   - kebab-case for folders/routes (`booking-links`, `platform-admin`).
   - snake_case for PostgreSQL plural tables and columns (`booking_links`, `external_event_mappings`).
   - `is_`, `has_`, `can_` for booleans (`is_active`, `can_manage`).
6. **Errors:** Strongly typed errors, one central handler, user-friendly messages ("what happened + what to do"), error boundary per page, no empty catch blocks.
7. **API standard:** Envelope response (`{ success, data, error: { code, message }, meta }`), strict Zod validation on inputs, pagination on lists, versioned under `/api/v1/`.
8. **State:** Server data via TanStack React Query / Supabase hooks; UI-only state in local store/context.
9. **CSS:** Strictly `tokens.css` variables and `global.css` classes/helpers; no inline hex codes or arbitrary utilities.
10. **Comments:** Single purpose line per file; why-comment per service function.
11. **Security:** Validate input, parameterized queries, rate limits on auth/slots, CORS allowlist, security headers, RBAC & RLS enforced in backend, zero secrets/tokens in code or client logs, DPDP Act 2023 compliance.
12. **Performance:** Strict adherence to `docs/performance.md` budgets.
13. **Clean code:** No dead code, commented-out blocks, or `console.log` statements in production code.
14. **AI coding tool discipline:** Follow `gemini.md`, plan before executing, review every line, and maintain architectural boundaries.
15. **AI features:** None. No AI models or `ai-setup-guide.md` used.
16. **Documentation synchronization:** Any change to routes, models, tokens, or rules updates the matching `docs/*.md` file in the same PR.

---

## 2. Stack Add-On: Next.js 16.4 + Supabase Platform
1. **Server Components by Default:** Client components used strictly for interactive form inputs and event listeners.
2. **Supabase Central Backend Architecture:**
   - No separate custom Express, Nest, or Node backend server.
   - All privileged operations run via Supabase Edge Functions or PostgreSQL stored procedures/triggers.
   - Service Workers are strictly browser-side for PWA installation, offline shell, and static asset caching.
3. **Two Protected Owner Accounts:**
   - Exactly two Owner accounts initialized atomically through secure bootstrap.
   - Database triggers enforce: maximum 2 owners, no deletion of either owner, no demotion to member, and no public owner signup.
   - Shared centralized Owner Administration Workspace.
   - Tenant privacy barrier: Owners cannot access private calendar event contents without explicit auditable permission.
4. **Controlled Registration & Approval:**
   - New accounts require Owner approval (`pending_approval` -> `approved`).
   - Approved users receive an independent, isolated workspace.
5. **Two-Way Synchronization & Conflict Prevention:**
   - Two-way sync engine for Google & Zoho Calendars and Zoho Tasks <-> Google Events.
   - Persistent mapping in `external_event_mappings` and `task_event_mappings` with idempotency hashes to eliminate infinite loops.
   - Zero-conflict booking engine: Check all selected calendars for conflict intervals; write confirmed events ONLY to the single designated destination calendar.
   - Race-safe booking locks: Atomic PostgreSQL advisory or row-level locks prevent concurrent double-booking.
6. **No Redis:**
   - Redis is strictly prohibited. TTL caching implemented via PostgreSQL `cache_entries` and HTTP caching.
7. **OAuth Token Isolation:**
   - Google Sign-In and Google Calendar OAuth are separate permissions.
   - All provider access/refresh tokens encrypted at rest via AES-GCM-256 in Supabase Vault / PostgreSQL and never sent to browser.

---

## 3. How Each Rule is Checked
| Rule | Verification Mechanism |
| :--- | :--- |
| **2, 3, 4, 9, 13** | Automated ESLint + build scripts + code review |
| **5, 6, 7** | TypeScript compiler + ESLint + Zod schemas |
| **11** | Supabase RLS test suite + security review |
| **12** | Lighthouse CI + performance review |
| **1, 14, 16** | Human review & CTO approval gate |
