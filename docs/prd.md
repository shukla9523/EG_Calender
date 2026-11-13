# PRD · EG-Calendar (Enterprise SaaS Scheduler) · v3.0

## 1. Problem and users
### 1.1 Problem Statement
Enterprise professionals, managers, and recruitment teams manage appointments across disparate platforms—primarily Google Workspace and Zoho Calendar. Disconnected calendars cause blind spots, double-bookings, manual copy-pasting of interview slots, and lack of unified task-to-event synchronization. 

Existing solutions lack:
1. Strict two-owner administrative governance with protected accounts and privacy barriers.
2. Controlled registration where new accounts must be approved by platform owners before gaining tenant access.
3. True two-way synchronization between Google Calendar, Zoho Calendar, and Zoho Tasks.
4. Zero-conflict unified availability combining real-time Google & Zoho busy intervals with atomic PostgreSQL booking locks.
5. Flexible scheduling profiles with distinct working hours vs interview booking windows and universal link expiration.
6. Public scheduling API and database-backed webhook delivery for external platforms (e.g. interview portals).

### 1.2 User Types and Roles
- **Protected Owners (Owner 1 & Owner 2):** Exactly two system owners initialized atomically via one-time bootstrap. Shared Owner Administration Workspace. Can approve/reject user registrations, manage roles, and review audit/API logs. Cannot delete or demote each other or themselves. Do not have unrestricted access to private tenant calendar event contents.
- **Organization Admin:** Manages organization members, department links, and integrations.
- **Host / Member:** Approved user with an isolated tenant workspace. Connects multiple Google and Zoho accounts, configures scheduling profiles, sets availability, and manages booking links.
- **External Invitee / Candidate:** Accesses public booking pages (`/book/:slug`) or links generated via Public API, selects available slots, and receives confirmations.
- **External API Consumer:** Third-party portal integrating scheduling via scoped API keys and webhooks.

---

## 2. Goals and success metrics
| Goal | Metric | Target | Measured in |
| :--- | :--- | :--- | :--- |
| Zero Double-Bookings | Collision rate across Google + Zoho + EG | 0.00% | Database conflict logs & client reports |
| Sub-300ms Availability | p95 slot calculation response time | < 300 ms | Supabase Edge Function & Vercel Edge logs |
| Atomic Booking Reservation | p95 booking commit latency | < 800 ms | PostgreSQL transaction logs |
| Complete Two-Way Sync | Provider sync fidelity & loop avoidance | 100% loop-free | Event mapping logs & sync reconciliation |
| Robust Task Integration | Zoho Task <-> Google Event sync accuracy | > 99.5% | Task-to-event job logs |
| Two Protected Owners | Enforced 2-owner limit & undeletability | Exactly 2 | PostgreSQL trigger & bootstrap audit |
| Safe Multi-Tenancy | Cross-tenant data leakage incidents | 0 incidents | PostgreSQL RLS test suite |
| Mobile Performance | Lighthouse Performance score | >= 90 | Lighthouse CI on every build |

---

## 3. Features (user stories)

### F1. Two Protected Owner Accounts & Admin Console
- **Story:** As a platform owner, I log in to the shared Owner Administration Workspace to approve new user sign-ups and manage the platform, knowing that exactly two owner accounts exist and neither can be deleted or demoted.
- **Acceptance Criteria:**
  - Given the system bootstrap, exactly two Owner accounts (Owner 1 and Owner 2) are created atomically with independent emails/passwords.
  - When any request attempts to create a 3rd owner, delete an owner, or demote an owner, the database trigger rejects it with an error.
  - Owners can approve, reject, suspend, activate, or delete normal users from `/platform-admin/users`.
  - Owners cannot inspect private calendar event titles/descriptions of other tenants without auditable explicit permission.
  - Owner password updates require an identity-verified email workflow instead of standard user settings.
  - *Empty State:* "No user registration requests pending."
  - *Error State:* "Operation denied: Protected owner accounts cannot be modified or deleted."
  - *Loading State:* Shimmer table skeleton for user management.
- **Priority:** Must

### F2. User Registration & Approval System
- **Story:** As a new user, I register for an account and wait for Owner approval before accessing my personal workspace.
- **Acceptance Criteria:**
  - Given a visitor on `/register`, they register with email/password or Google authentication.
  - Account status is set to `pending_approval`; user sees the `/approval-pending` screen.
  - Both Owners receive visibility in the Owner console; either Owner can approve or reject.
  - When approved, user status transitions to `approved` and an isolated workspace is provisioned.
  - Rejected, suspended, or disabled users are redirected to access-denied screens.
  - *Empty State:* "Registration submitted. Your account is currently pending owner approval."
  - *Error State:* "Account suspended or rejected. Contact system administrator."
  - *Loading State:* Registration submission spinner.
- **Priority:** Must

### F3. Independent Google & Zoho Account Integrations
- **Story:** As a host, I connect multiple Google and Zoho accounts independently of my login authentication.
- **Acceptance Criteria:**
  - Google Sign-In and Google Calendar authorization are separate OAuth flows.
  - Users can connect multiple Google accounts and multiple Zoho accounts on `/integrations`.
  - Sensitive tokens are stored encrypted (AES-GCM-256) in Supabase Vault / PostgreSQL; never sent to browser.
  - System handles Zoho regional domains (`zoho.com`, `zoho.in`, `zoho.eu`).
  - Disconnecting an account revokes tokens and updates dependent links.
  - *Empty State:* "No calendar accounts connected."
  - *Error State:* "OAuth authorization expired. Click Reconnect to renew credentials."
  - *Loading State:* Skeleton cards with connecting spinners.
- **Priority:** Must

### F4. Two-Way Google & Zoho Calendar Synchronization
- **Story:** As a host, events created or modified in Google Calendar sync to Zoho Calendar, and vice versa, without infinite loops.
- **Acceptance Criteria:**
  - When an event is created in Google Calendar, it is mirrored to the mapped Zoho Calendar.
  - When an event is created in Zoho Calendar, it is mirrored to the mapped Google Calendar.
  - Updates and deletions in either provider sync to the other according to configured deletion policy.
  - Persistent mappings in `external_event_mappings` ensure idempotency and prevent duplicate/loop sync.
  - Scheduled background reconciliation catches missed webhook deliveries with exponential backoff.
  - *Empty State:* "No synchronization activity recorded."
  - *Error State:* "Sync failed: Rate limit exceeded. Automatic retry scheduled."
  - *Loading State:* Sync status pulse indicator.
- **Priority:** Must

### F5. Zero-Conflict Booking Engine
- **Story:** As an invitee, I only see booking slots that are genuinely free across all of the host's connected Google and Zoho calendars.
- **Acceptance Criteria:**
  - Availability engine queries all connected calendars, normalizes intervals to UTC, and merges overlaps.
  - Host working hours, buffer times, minimum notices, and profile restrictions are applied.
  - Slot reservation acquires a PostgreSQL advisory/row-level lock to prevent concurrent double-booking.
  - Booking confirmation writes to the designated destination calendar and commits the booking atomically.
  - If external provider write fails, temporary reservation is rolled back or scheduled for retry.
  - *Empty State:* "No available slots on this date. Please choose another date."
  - *Error State:* "This time slot was just booked by another attendee. Please select an alternate time."
  - *Loading State:* Pulsing slot button grid skeleton.
- **Priority:** Must

### F6. Dynamic Scheduling Profiles & Universal Link Expiration
- **Story:** As a host, I configure distinct profiles (e.g., Interview window 12 PM–4 PM within 9 AM–5 PM working hours) and generate links with customizable expiration.
- **Acceptance Criteria:**
  - Profiles support custom durations, before/after buffers, booking windows, days of week, max bookings per day, and date overrides.
  - Link expiration options: Never Expire, 1 hour, 24 hours, 7 days, 30 days, or Custom date/time.
  - Server-side validation rejects expired or revoked links with a clear 410 Gone message.
  - *Empty State:* "No scheduling profiles created. Click 'Create Profile' to start."
  - *Error State:* "Invalid expiration date: Expiration must be in the future."
  - *Loading State:* Profile configuration skeleton.
- **Priority:** Must

### F7. Zoho Tasks & Google Calendar Two-Way Sync Engine
- **Story:** As a host, my tasks in Zoho sync to Google Calendar events and vice versa.
- **Acceptance Criteria:**
  - Zoho Task creation creates a Google Calendar event using mapped fields (Title, Description, Due Date/Time).
  - Google Calendar event creation creates a corresponding Zoho Task.
  - Updates synchronize bidirectionally; deletions follow configured policy (delete, cancel, or leave).
  - Infinite loops prevented via `task_event_mappings` and idempotency keys.
  - *Empty State:* "No task sync mappings active."
  - *Error State:* "Task sync error: Target calendar is read-only."
  - *Loading State:* Mapping table skeleton.
- **Priority:** Must

### F8. Public API & Webhook Infrastructure
- **Story:** As a developer, I integrate EG-Calendar into an external portal using scoped API keys and receive webhook notifications for booking events.
- **Acceptance Criteria:**
  - Secure `/api/v1/public/...` endpoints for availability queries, booking creation, rescheduling, and cancellation.
  - Scoped API key authentication with rate limiting and rotation.
  - Database-backed webhook job queue dispatching signed payloads (`booking.created`, `booking.cancelled`, `calendar.sync.*`, `task.sync.*`) with exponential backoff retries.
  - Owner API Monitoring Dashboard displaying requests, response times, error rates, and delivery logs.
  - *Empty State:* "No API keys or webhook subscriptions created."
  - *Error State:* "401 Unauthorized: Invalid or revoked API key."
  - *Loading State:* API monitoring chart skeletons.
- **Priority:** Must

---

## 4. Out of scope (this version)
- Native mobile applications for iOS/Android (responsive web application used).
- Payment collection / paid appointment checkouts (Stripe/Razorpay deferred to P2).
- AI agent features / LLM integrations (explicitly out of scope per user specification).
- Redis caching cluster (strictly prohibited; PostgreSQL cache tables used).
- Backup and disaster recovery automated module (outside current scope).

---

## 5. Roles and permissions
| Action | Unauthenticated / Invitee | Pending User | Approved Member | Admin | Protected Owner (1 & 2) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Sign up / Verify email | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Public Booking Page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit Booking Request | ✅ | ❌ | ✅ | ✅ | ✅ |
| View Private Workspace | ❌ | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) |
| Connect Google / Zoho | ❌ | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) |
| Manage Profiles & Links | ❌ | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) |
| Manage Two-Way Sync | ❌ | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) |
| Approve/Reject User Signups| ❌ | ❌ | ❌ | ❌ | ✅ |
| Suspend / Activate Users | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete Normal Users | ❌ | ❌ | ❌ | ❌ | ✅ |
| View System Audit Logs | ❌ | ❌ | ❌ | ❌ | ✅ |
| View API Monitoring | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete / Demote Owner | ❌ | ❌ | ❌ | ❌ | ❌ (Strictly Prohibited) |

---

## 6. SEO goals (public sites)
- **Indexable Pages:** Public booking pages (`/book/:slug`) where enabled by host settings.
- **Target Keywords:** Host name, scheduling link, appointment booking, Electro Global.
- **Admin-Editable SEO Fields:** Title, Meta Description, Custom OG Image (1200×630), Canonical URL.
- **Noindex Pages:** All authenticated workspace pages (`/calendar`, `/requests`, `/links`, `/availability`, `/integrations`, `/platform-admin`), expired links, and approval pending screens.
- **Structured Data:** JSON-LD schema (`ScheduleAction`, `Person`) rendered on public pages.

---

## 7. AI use
**None.** Per user requirement, no AI models or `ai-setup-guide.md` are used. All logic is deterministic backend code and PostgreSQL operations.

---

## 8. Performance expectations
- **Public Booking Page LCP:** < 1.5 s on mobile, < 1.0 s on desktop.
- **CLS:** < 0.05 across all viewports.
- **INP:** < 150 ms.
- **Availability Query (p95):** < 300 ms.
- **Booking Commitment (p95):** < 800 ms.
- **First Load JavaScript Bundle:** < 150 KB gzipped.

---

## 9. Integrations
1. **Google Calendar API v3:** OAuth 2.0, FreeBusy queries, Events CRUD, push notifications.
2. **Zoho Calendar API:** Regional OAuth 2.0, availability, events CRUD.
3. **Zoho Tasks API:** Task fetch, create, update, delete for two-way task sync.
4. **Google Tasks API:** Task fetch, create, update, delete for mapped task sync.
5. **Supabase Managed Platform:** Auth (JWT, Argon2id/bcrypt), PostgreSQL Database, RLS, Edge Functions, Realtime.
6. **Transactional Email:** Resend / SMTP for notifications, approvals, and owner password requests.

---

## 10. Data and compliance
- **DPDP Act 2023 & GDPR:** Invitee data minimized to name, email, topic, and timezone. Right to be forgotten supported.
- **Credential Hygiene:** Tokens encrypted with AES-GCM-256 in Supabase Vault / PostgreSQL. Never sent to browser.
- **Owner Privacy Barrier:** Private event descriptions and calendar data remain isolated per tenant; Owners manage accounts without unrestricted snooping.

---

## 11. Constraints
- **Stack:** Next.js 16.4 App Router + Supabase Managed Services. No custom Express/Nest backend. No Redis.
- **Service Workers:** Browser-side only for PWA / offline caching.
- **Code Limits:** Maximum 400 lines of code per file / development card; maximum 50 lines per function.
- **Two Owners:** Exactly two protected owner accounts. Public owner signup permanently disabled.

---

## 12. Open questions
*(None remaining. All requirements, user roles, integrations, and architectural constraints are approved.)*
