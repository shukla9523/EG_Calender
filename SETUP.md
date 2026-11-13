# EG-Calendar · Complete Setup & Operations Guide (v3.0)

This guide walks you through setting up and operating **EG-Calendar** with zero local data persistence. All data, credentials, sessions, and environment variables are securely managed in **Supabase Cloud**.

---

## 1. Architecture & Storage Invariants

* **Single Source of Truth:** All user profiles, bookings, two-way sync mappings, and encrypted tokens live exclusively in **Supabase Cloud** (PostgreSQL + RLS + Edge Functions).
* **Zero Local Persistence:** No local database (no SQLite/Redis/local PostgreSQL). The client runtime is completely stateless.
* **Token Vault:** Provider OAuth tokens (Google & Zoho) are encrypted at rest via **AES-GCM-256** inside Supabase and never exposed to browser bundles.
* **Two Protected Owners:** Exactly two Owner accounts initialized atomically. DB-level triggers permanently block deletion, demotion, or registration of a 3rd owner.
* **Controlled User Registration:** User registrations enter `pending_approval` status until approved by either Owner.

---

## 2. Prerequisites

1. **Node.js**: v20+ with `npm`.
2. **Supabase Cloud Account**: [supabase.com](https://supabase.com) (Active project).
3. **Google Cloud Console**: OAuth 2.0 Web Application client.
4. **Zoho Developer Console**: Server-based OAuth application.
5. **Vercel Account** (for production hosting) or local Node runtime (for development).

---

## 3. Step-by-Step Setup Instructions

### Step 1: Supabase Database Provisioning

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** &rarr; **New Query**.
3. Deploy the consolidated migrations in order:
   * First execute: `supabase/deploy_all_migrations.sql` (Creates core schemas, tables, RLS policies, and triggers).
   * Then execute: `supabase/final_missing_tables.sql` (Ensures all auxiliary tables `calendar_connections`, `bookings`, `webhook_endpoints`, etc. are initialized).
4. Verify all tables in **Table Editor**:
   * `organizations`, `owner_accounts`, `user_profiles`, `scheduling_profiles`, `booking_links`, `calendar_connections`, `calendars`, `bookings`, `webhook_endpoints`, `cache_entries`, `audit_logs`.

---

### Step 2: Initialize Two Protected Owners

The system automatically initializes and protects the two Owner accounts through database triggers:
* **Owner 1:** `sharmasaurabh2604@gmail.com`
* **Owner 2:** `saurabh.electroglobal@gmail.com`

**To activate them:**
1. In **Supabase Dashboard &rarr; Authentication &rarr; Users**, invite or register both email addresses with confirmed email status.
2. The trigger `handle_owner_registration` automatically promotes them to `role: 'owner'`, `status: 'approved'`, and `is_protected: true`.
3. Database trigger `check_owner_limits` prevents deletion, demotion, or registration of a 3rd owner.

---

### Step 3: Configure Cloud Secrets in Supabase

Navigate to **Supabase Dashboard &rarr; Project Settings &rarr; Edge Functions &rarr; Secrets** (or use Supabase CLI):

```bash
# Push secrets directly to Supabase Cloud Vault
npx supabase secrets set --project-ref <YOUR_PROJECT_REF> \
  ENCRYPTION_KEY="<64_character_hex_key>" \
  GOOGLE_CLIENT_ID="<your_google_client_id>" \
  GOOGLE_CLIENT_SECRET="<your_google_client_secret>" \
  GOOGLE_REDIRECT_URI="https://<your-domain>/api/auth/callback/google" \
  ZOHO_CLIENT_ID="<your_zoho_client_id>" \
  ZOHO_CLIENT_SECRET="<your_zoho_client_secret>" \
  ZOHO_REDIRECT_URI="https://<your-domain>/api/auth/callback/zoho" \
  ZOHO_REGION="in"
```

> **Note on `ENCRYPTION_KEY`:** Generate a cryptographically secure 32-byte hex key using `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

### Step 4: Environment Configuration (Local & Vercel)

#### For Local Development (`src/.env.local`):
```env
# Supabase Cloud Project Connection
NEXT_PUBLIC_SUPABASE_URL="https://<YOUR_PROJECT_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<YOUR_ANON_KEY>"
SUPABASE_SERVICE_ROLE_KEY="<YOUR_SERVICE_ROLE_KEY>"

# Application Host URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# OAuth Secrets (Mirrored from Supabase Secrets)
ENCRYPTION_KEY="<64_character_hex_key>"
GOOGLE_CLIENT_ID="<your_google_client_id>"
GOOGLE_CLIENT_SECRET="<your_google_client_secret>"
ZOHO_CLIENT_ID="<your_zoho_client_id>"
ZOHO_CLIENT_SECRET="<your_zoho_client_secret>"
ZOHO_REGION="in"
```

#### For Production (Vercel Project Settings &rarr; Environment Variables):
Configure the same variables with `NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"`.

---

### Step 5: Verification & Quality Gates

Run the automated verification suite:

```bash
# 1. Run unit test suite (18/18 passing)
npm test

# 2. Run code quality & lint check (0 errors)
npm run lint

# 3. Compile optimized production build
npm run build
```

---

## 4. Operating the Application

Start the local development server:
```bash
npm run dev
```

Visit the core workflows:
* **Owner Administration & Approvals:** [`/requests`](http://localhost:3000/requests)
* **Calendar View:** [`/calendar`](http://localhost:3000/calendar)
* **Scheduling Profiles & Working Hours:** [`/availability`](http://localhost:3000/availability)
* **Booking Links & Universal Expiration:** [`/links`](http://localhost:3000/links)
* **Connect Google & Zoho:** [`/integrations`](http://localhost:3000/integrations)
* **Public Booking Link:** [`/book/quick-consultation`](http://localhost:3000/book/quick-consultation)
* **Public OpenAPI Specification:** [`/api/v1/openapi`](http://localhost:3000/api/v1/openapi)

