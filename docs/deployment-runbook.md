# Deployment Runbook · EG-Calendar v3.0

This runbook provides step-by-step instructions to deploy EG-Calendar to Supabase and Vercel, initialize the Two Protected Owners, configure Google & Zoho integrations, and verify production operations.

---

## 1. Prerequisites & Environment Access

Ensure you have access to:
1. **Supabase Dashboard**: [supabase.com/dashboard](https://supabase.com/dashboard) (Project Ref: `uguuxgtzzljxwdyhczcs`).
2. **Vercel Dashboard**: [vercel.com](https://vercel.com) (Project: `eg-calendar`).
3. **Google Cloud Console**: OAuth 2.0 Web Application credentials.
4. **Zoho Developer Console**: OAuth 2.0 Server-based Application credentials.
5. **Node.js**: v20+ with npm.

---

## 2. Step 1 · Supabase Database & Migrations

### 2.1 Connect Supabase CLI to Your Project
```bash
# Login to Supabase CLI
npx supabase login

# Link your local repo to your remote project
npx supabase link --project-ref uguuxgtzzljxwdyhczcs
```

### 2.2 Push All Database Migrations
Deploy the database schema, two protected owner constraints, RLS policies, and cache table:
```bash
# Push pending migrations to remote PostgreSQL
npx supabase db push
```

The migrations applied include:
- `20261106000000_v3_master_schema.sql`: Schema, `owner_accounts`, `scheduling_profiles`, `cache_entries`, RLS policies, audit logs.
- `20261107000000_bootstrap_two_owners.sql`: Auto-recognition trigger `handle_owner_registration` for the two owner accounts.

### 2.3 Verify Owner Initialization
The database trigger automatically recognizes both owner emails:
- `sharmasaurabh2604@gmail.com` (Owner 1)
- `saurabh.electroglobal@gmail.com` (Owner 2)

When either owner creates their account or logs in via Supabase Auth, they are atomically granted the protected Owner role and auto-approved. A 3rd owner registration is permanently blocked by database constraints.

---

## 3. Step 2 · Supabase Edge Functions Deployment

Deploy serverless edge functions for OAuth handshakes, two-way calendar sync, and webhook dispatch:
```bash
# Deploy all Edge Functions
npx supabase functions deploy google-oauth-start
npx supabase functions deploy google-oauth-callback
npx supabase functions deploy zoho-oauth-start
npx supabase functions deploy zoho-oauth-callback
npx supabase functions deploy sync-engine
npx supabase functions deploy task-sync
npx supabase functions deploy calendar-busy
npx supabase functions deploy booking-slots
npx supabase functions deploy booking-confirm
npx supabase functions deploy webhook-dispatcher
```

### 3.1 Set Edge Function Secrets
Set the required server-side secrets in Supabase:
```bash
npx supabase secrets set \
  ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  GOOGLE_CLIENT_ID="your_google_client_id" \
  GOOGLE_CLIENT_SECRET="your_google_client_secret" \
  ZOHO_CLIENT_ID="your_zoho_client_id" \
  ZOHO_CLIENT_SECRET="your_zoho_client_secret"
```

---

## 4. Step 3 · Vercel Production Deployment

### 4.1 Configure Environment Variables in Vercel
In **Vercel Project Settings → Environment Variables**, configure:

| Variable Name | Environment | Value Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Production | `https://eg-calendar.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | All | `https://uguuxgtzzljxwdyhczcs.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase project Anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production / Preview | Supabase service_role secret key (Server-only) |
| `GOOGLE_CLIENT_ID` | Production | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Production | Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | Production | `https://eg-calendar.vercel.app/api/auth/callback/google` |
| `ZOHO_CLIENT_ID` | Production | Zoho OAuth Client ID |
| `ZOHO_CLIENT_SECRET` | Production | Zoho OAuth Client Secret |
| `ZOHO_REDIRECT_URI` | Production | `https://eg-calendar.vercel.app/api/auth/callback/zoho` |
| `ZOHO_REGION` | Production | `in` (or `com` / `eu` depending on datacenter) |
| `OWNER_1_EMAIL` | Production | Server-only secret for Owner 1 |
| `OWNER_2_EMAIL` | Production | Server-only secret for Owner 2 |

> [!CAUTION]
> Never prefix `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_1_EMAIL`, or `OWNER_2_EMAIL` with `NEXT_PUBLIC_`. They must remain strictly server-side.

### 4.2 Deploy to Vercel
```bash
# Build and deploy production release
vercel --prod
```
Or trigger automatic deployment via GitHub push to the `main` branch.

---

## 5. Step 4 · Third-Party OAuth Configuration

### 5.1 Google Cloud Console
1. Navigate to **APIs & Services → Credentials**.
2. Under **Authorized redirect URIs**, add:
   - `https://eg-calendar.vercel.app/api/auth/callback/google`
   - `https://eg-calendar.vercel.app/api/integrations/google/callback`
   - `http://localhost:3000/api/auth/callback/google` (for local development)
3. Ensure the **Google Calendar API** and **Google Tasks API** are enabled.

### 5.2 Zoho Developer Console
1. Open [api-console.zoho.in](https://api-console.zoho.in) (or `.com` / `.eu`).
2. Under **Authorized Redirect URIs**, add:
   - `https://eg-calendar.vercel.app/api/auth/callback/zoho`
   - `https://eg-calendar.vercel.app/api/integrations/zoho/callback`
   - `http://localhost:3000/api/auth/callback/zoho`
3. Scopes required: `ZohoCalendar.event.ALL`, `ZohoTasks.tasks.ALL`.

---

## 6. Step 5 · Post-Deployment Verification Checklist

Execute the following verification steps on production:

1. **Owner Governance Verification**:
   - Log in with `sharmasaurabh2604@gmail.com` or `saurabh.electroglobal@gmail.com`.
   - Confirm automatic redirect to `/platform-admin/users`.
   - Verify that owner accounts cannot be deleted, suspended, or demoted.
2. **Registration Approval Flow**:
   - Register a test user at `/register`.
   - Verify test user is routed to `/approval-pending`.
   - In Owner workspace (`/platform-admin/users`), click **Approve** and confirm user receives tenant access.
3. **Public Booking & Zero-Conflict Engine**:
   - Create a link at `/links/new` with a 30-minute duration.
   - Open `/book/<slug>` in an incognito window.
   - Submit a test booking and confirm that overlapping slots are locked and destination calendar receives the booking.
4. **Universal Expiration**:
   - Create a link with `1h` expiration. Confirm that after expiration the public endpoint returns HTTP `410 Gone`.
5. **SEO & PWA Assets**:
   - Verify `https://eg-calendar.vercel.app/robots.txt` loads.
   - Verify `https://eg-calendar.vercel.app/sitemap.xml` returns valid XML.
   - Verify Service Worker registers at `/sw.js` in browser devtools.

---

## 7. Rollback Plan

If a critical issue occurs post-deployment:
1. **Frontend Rollback**: In the Vercel Dashboard, select **Deployments → Instant Rollback** to revert to the previous stable deployment within 5 seconds.
2. **Database Rollback**: Revert specific schema changes using Supabase migration rollbacks or point-in-time recovery (PITR) from the Supabase dashboard.
3. **Owner Access**: Protected owner access remains guaranteed at the database level even during edge network failovers.

