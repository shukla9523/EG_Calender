# Performance, Caching and Scalability Guide · EG-Calendar · v1.0

**Product:** EG-Calendar (Unified Multi-Tenant Calendar & Scheduling Platform)  
**Document owner:** CTO  
**Approval:** Saurabh Sharma (CEO)  
**Status:** Approved Engineering Baseline (Gate 2 Passed)  
**Version:** 1.0  
**Last updated:** 2026-11-06  

---

## 1. Budgets (Starting Targets; Evaluated Quarterly)

| Measure | Target | Evaluated & Checked By |
| :--- | :--- | :--- |
| **Largest Contentful Paint (LCP) — Mobile** | < 2.0 s (Target: < 1.2 s on Public Booking) | Lighthouse CI & Real-User Web Vitals |
| **Cumulative Layout Shift (CLS)** | < 0.05 (Strict budget: < 0.1) | Lighthouse CI on every build |
| **Interaction to Next Paint (INP)** | < 150 ms | Chrome UX Report / Field Telemetry |
| **Lighthouse Performance Score** | >= 90 (Mobile), >= 98 (Desktop) | Automated CI on every PR |
| **API Response Time (p95) — Availability** | < 300 ms | Supabase Edge Function Observability |
| **API Response Time (p95) — Booking Confirm**| < 800 ms (including destination event write) | PostgreSQL transaction logs |
| **JavaScript per Page (First Load Gzipped)** | < 150 KB | Next.js Build Analyzer (`@next/bundle-analyzer`) |
| **API Calls on First Load of any Screen** | <= 3 network calls | PR Network Profiling Review |

---

## 2. The 20-Point Performance Checklist

| # | Optimization Item | Layer | How We Do It in EG-Calendar | How It Is Verified |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Compress all images** | Frontend + Upload | `next/image` converts user avatars and logos to WebP/AVIF on demand with explicit `width`/`height`. | Lighthouse "properly size images" audit; zero raw PNGs in bundle. |
| **2** | **Lazy loading** | Frontend | Below-the-fold content, modal dialogs, and non-immediate UI components are lazy-loaded via `next/dynamic`. | Lighthouse "offscreen images" and dynamic import chunk inspection. |
| **3** | **Split code into chunks** | Frontend | Native Next.js 16.4 App Router route-based splitting; heavy date-fns and calendar modules isolated to `/calendar`. | Build output route chunk report (< 150 KB parsed per route). |
| **4** | **Cache API responses** | Frontend + Edge | React Query caches client data; HTTP `Cache-Control` headers applied to public non-sensitive GET requests. | Browser Network tab shows zero redundant calls on navigation. |
| **5** | **Add a CDN** | Infrastructure | All static JS, CSS, and optimized assets are served via Vercel Global Edge CDN across 100+ points of presence. | Response headers show `x-vercel-cache: HIT`. |
| **6** | **Minify JS and CSS** | Build | Next.js Turbopack production compiler performs aggressive dead-code elimination, tree-shaking, and minification. | Production asset inspection; zero unminified source code served. |
| **7** | **Index the database** | Database | B-Tree indexes created on `(organization_id, user_id)`, `(host_user_id, start_time, end_time)`, and `management_token`. | PostgreSQL `EXPLAIN ANALYZE` demonstrates index scans on hot paths. |
| **8** | **Reduce unnecessary re-renders** | Frontend | Component state kept local; date navigation stabilized via `useCallback`; slot items wrapped in memoized selectors. | React DevTools Profiler confirms zero render cascades on slot click. |
| **9** | **Debounce input handlers** | Frontend | Search filters on `/links`, `/requests`, and `/team` debounced by 300 ms using `useDebounce`. | Network monitor confirms exactly one request per user typing pause. |
| **10** | **Paginate large lists** | API + Frontend | PostgREST endpoints enforce `limit` (max 50) and `offset` / cursor pagination on bookings, audit logs, and members. | Request payload review; no unbounded `SELECT *` without limits. |
| **11** | **Remove unused dependencies** | Build | Automated `npx depcheck` run monthly; new npm packages require justification in PR description. | Bundle visualizer audit; zero unused packages in `package.json`. |
| **12** | **Defer non-critical scripts** | Frontend | Analytics and error tracking initialized using `next/script` with `strategy="afterInteractive"`. | Lighthouse confirms zero render-blocking third-party scripts. |
| **13** | **Loading skeletons** | Frontend | Dedicated `Skeleton` primitives match the exact layout of the 7-day calendar grid, request list, and time slots. | Visual inspection during network throttling (Fast 3G); CLS < 0.05. |
| **14** | **Load balancer** | Infrastructure | Managed edge routing and load balancing provided automatically by Vercel Edge Network and Supabase Gateway. | Zero self-managed load balancer needed; proven 99.99% uptime. |
| **15** | **Compress API payloads** | API / Edge | Edge Functions and PostgREST responses compressed with Brotli/Gzip; explicit field selection (`select=id,name`). | Response header `content-encoding: br`; network transfer size review. |
| **16** | **Database connection pooling**| API + DB | Application routes connect via Supabase Supavisor connection pooler on port 6543 (transaction pooling mode). | Postgres connection pool monitoring stays flat under high concurrency. |
| **17** | **Cache expensive computed results** | API / DB | TTL caching in PostgreSQL `cache_entries` table with auto-expiration trigger; FreeBusy intervals cached for 15s; cleared on new booking. | Cache hit rate in Edge Function logs; zero Redis dependency. |
| **18** | **Fix N+1 database queries** | API + DB | Single query fetches booking link with host profile, working hours, and calendar connections via relational joins. | PostgREST query logs confirm exactly 1 database roundtrip per view. |
| **19** | **Server-side caching** | Framework | Next.js Server Components use `unstable_cache` for public booking link configurations with tag-based revalidation. | Fast TTFB (< 80 ms) on `/book/:slug` initial page loads. |
| **20** | **Run a Lighthouse audit** | CI / Automation | Automated GitHub Action runs Lighthouse CI on every pull request against desktop and mobile profiles. | CI gate fails if Performance drops below 90 or Accessibility below 95. |

---

## 3. Caching Policy Matrix

| Data Category | Cache Layer | TTL | Scope | Invalidation Event |
| :--- | :--- | :--- | :--- | :--- |
| **Static JS/CSS Bundles** | Vercel Edge CDN | 1 Year (`immutable`) | Global / Public | Automatic on new production deployment git commit |
| **Public Booking Link Meta**| Next.js ISR / CDN | 1 Hour | Public | On host booking link update / slug change |
| **Free/Busy Calendar Intervals**| Edge Function Cache | 15 Seconds | Host + Date Range | Invalidated immediately when a booking is confirmed |
| **Booking Slots Calculation**| Client React Query | 15 Seconds | Browser session | Refetched upon user date change or manual refresh |
| **Pending Requests (`/requests`)**| Client React Query | 30 Seconds | Host authenticated | Realtime Supabase Postgres change event or approval click |
| **Host Working Hours** | Client React Query | 5 Minutes | Host authenticated | On update at `/availability` |
| **Authenticated Private Events**| **NEVER CACHED** | 0 Seconds | Private / Strict | Always fetched live with verified session |
| **OAuth Access & Refresh Tokens**| **NEVER CACHED** | 0 Seconds | Secure Vault | Decrypted strictly within Deno Edge Functions |

---

## 4. Third-Party Scripts & Bundle Impact

| Script / Library | Minified + Gzipped Size | Loading Strategy | Purpose |
| :--- | :--- | :--- | :--- |
| `@supabase/supabase-js` | ~18 KB | Core App Bundle | Authenticated client for database & sessions |
| `lucide-react` (Tree-shaken) | ~8 KB | Shared UI Bundle | Lightweight outline UI icons |
| `date-fns` (Modular imports) | ~6 KB | On-Demand Dynamic Import | Timezone & date arithmetic for availability |
| `zod` | ~12 KB | Shared Validation | Request and form schema validation |

*Total external third-party footprint in initial bundle is strictly capped under 50 KB.*

---

## 5. Load Testing & High Concurrency Verification

- **Load Simulation Profile:** Executed via `k6` script targeting the public booking endpoint `/book/meeting` and slot calculation API.
  - **Virtual Users (VUs):** 500 concurrent virtual users ramped over 3 minutes.
  - **Sustained Duration:** 5 minutes at peak load.
  - **Scenario:** 80% availability slot polling, 20% booking request submissions.
- **Pass Criteria:**
  - Zero 5xx server errors.
  - Availability p95 latency remains < 350 ms.
  - Concurrency booking locks prevent 100% of double-booking attempts; conflicting concurrent requests return clean `409 Conflict` responses without database deadlocks.

---

**Gate 2 Sign-Off:**  
- **CTO Approval:** Performance Baseline & Budgets Verified  
- **Date:** 2026-11-02  

