# Task Register · EG-Calendar · v3.0

**Product:** EG-Calendar (Enterprise Multi-Tenant SaaS Calendar & Scheduling Platform)  
**Document owner:** Developer / Tech Lead  
**Approval:** CTO  
**Status:** Active Sprint Register (Gate 3 Ready)  
**Version:** 3.0  
**Last updated:** 2026-11-06  

---

## Active Task Plans

## NTF-101 · Database Schema & Triggers for Two Protected Owners & Approval Lifecycle · owner @lead · due 2026-11-07

### 1. Problem and objective
Master Implementation Prompt V3 requires exactly two protected Owner accounts with independent authentication credentials, initialized atomically via a secure bootstrap RPC. Neither owner may be deleted, demoted, or suspended. A third owner must be permanently blocked at the database level. Normal user registrations must enter `pending_approval` status until approved by either owner.

### 2. Acceptance criteria (from `prd.md` F1, F2)
- [ ] Create `owner_accounts` table referencing `auth.users(id)` with `owner_number IN (1, 2)` unique constraint.
- [ ] Implement database trigger `check_owner_limits()`:
  - Blocks any `INSERT` if table already contains 2 owners.
  - Blocks any `DELETE` operation on `owner_accounts`.
  - Blocks changing `role` of either owner.
- [ ] Add `status` column to `user_profiles` with check `status IN ('pending_approval', 'approved', 'rejected', 'suspended', 'disabled')`.
- [ ] Implement atomic PostgreSQL RPC `bootstrap_owners(owner1_email, owner1_pass, owner2_email, owner2_pass)` with secret gate check.
- [ ] Implement RLS policies ensuring owners have access to user management but cannot view private calendar contents of other tenants.

### 3. Where the logic lives
- **Backend (PostgreSQL Migration & Functions):** `supabase/migrations/20261106000000_v3_master_schema.sql`.
- **Frontend:** N/A for this database foundation card.

### 4. Routes and objects
- **Models:** `owner_accounts`, `user_profiles`, `audit_logs`.
- **RPC:** `bootstrap_owners`.

### 5. Files to create / change; existing code reused
- **Files to create:** `supabase/migrations/20261106000000_v3_master_schema.sql` (< 350 lines).
- **Files to change:** `supabase/seed.sql`.

### 6. Edge and failure cases
- Attempting to register a 3rd owner throws SQL exception `EX_LIMIT_EXCEEDED: Exactly two owners permitted`.
- Attempting to delete either owner throws SQL exception `EX_PROTECTED_ACCOUNT: Protected owner accounts cannot be deleted`.
- Unapproved user queries receive empty rows or 403 via RLS.

### 7. Impact check + memory.md checked
- Checked `docs/memory.md`: Adheres to Two Protected Owners Decision and Tenant Privacy Barrier.

### 8. Security, performance and SEO
- **Inputs validated:** Checked via PostgreSQL constraints and typed PL/pgSQL function parameters.
- **Auth:** Checked via `SECURITY DEFINER` with strict service key / bootstrap secret check.
- **Performance items applied:** #7 (Indexed owner lookups), #16 (Connection pooling).
- **SEO:** N/A (Database layer).

### 9. AI
- Not applicable (Deterministic database schema).

### 10. Test plan
- Run migration and execute SQL test script verifying:
  1. Bootstrapping 2 owners succeeds.
  2. Inserting 3rd owner fails with error.
  3. Deleting an owner fails with error.
  4. Updating owner status fails with error.

### 11. Daily deliverables
| Day | Deliverable by 6:30 PM | Done when |
| :--- | :--- | :--- |
| Day 1 | `20261106000000_v3_master_schema.sql` migration with triggers & RPC | Migration applies cleanly; SQL constraint tests pass 100% |

### 12. Better way? (one line)
Database-level triggers guarantee undeletability and the 2-owner limit regardless of frontend or API bugs.

---

## Sprint Task Index & Complete Master Roadmap (Under 400 LOC Each)

| Phase | Task ID | Task Description | Scope / Deliverable | Status |
| :---: | :---: | :--- | :--- | :---: |
| **1** | **NTF-101** | Database Schema for Two Protected Owners & Approval Lifecycle | Migration SQL with triggers, RLS, and bootstrap RPC (< 400 lines) | **Done** |
| **1** | **NTF-102** | Owner Administration Console & User Approval API | User list, approve/reject endpoints, owner protection guards (< 400 lines) | **Done** |
| **1** | **NTF-103** | Controlled User Registration & Pending Approval UI Flow | Signup page, pending approval screen, separate Google Auth (< 400 lines) | **Done** |
| **2** | **NTF-104** | Independent Google & Zoho Calendar Integrations | OAuth exchange edge functions with regional endpoints (< 400 lines) | **Done** |
| **3** | **NTF-105** | Two-Way Google & Zoho Calendar Synchronization Engine | Event mapping table, webhook handler, loop prevention (< 400 lines) | **Done** |
| **3** | **NTF-106** | Zoho Tasks & Google Calendar Two-Way Sync Engine | Task-to-event mappings, sync handler, deletion policy (< 400 lines) | **Done** |
| **4** | **NTF-107** | Dynamic Scheduling Profiles & Universal Link Expiration | Profile editor, working hours vs interview window, expiration (< 400 lines) | **Done** |
| **4** | **NTF-108** | Zero-Conflict Availability Engine & Atomic Booking Lock | Edge function multi-calendar FreeBusy merge & advisory locks (< 400 lines) | **Done** |
| **5** | **NTF-109** | Public Scheduling API & Webhook Queue Infrastructure | External `/api/v1/public/...`, scoped API keys & webhook dispatcher (< 400 lines) | **Done** |
| **6** | **NTF-110** | PostgreSQL TTL Caching Without Redis & Monitoring Dashboard | `cache_entries` table, TTL trigger, API monitoring view (< 400 lines) | **Done** |
| **7** | **NTF-111** | QA Concurrency Verification, Lint Fixes & Final SOP Audit | Frontend ESLint fixes, booking concurrency tests, docs check (< 400 lines) | **Done** |

---

## Archive (Previously Completed Foundation)
- **NTF-001** Confirm Supabase project and environment configuration (@lead) — **Done**
- **NTF-002** Verify Google Cloud Console & Zoho OAuth credentials (@lead) — **Done**
- **NTF-003** Initialize Next.js 16.4 App Router frontend repository (@dev) — **Done**
- **NTF-006** Implement `tokens.css` design system and executive green palette (@ui) — **Done**
- **NTF-007** Build reusable UI primitives (`Button`, `Card`, `Badge`, `Skeleton`) (@ui) — **Done**
