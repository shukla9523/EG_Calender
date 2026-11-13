# Design · EG-Calendar · v1.0

**Product:** EG-Calendar (Unified Multi-Tenant Calendar & Scheduling Platform)  
**Document owners:** CTO + UI Owner  
**Approval:** Saurabh Sharma (CEO)  
**Status:** Approved (Gate 2 Passed)  
**Version:** 1.0  
**Last updated:** 2026-11-06  

---

## 1. Tokens (`tokens.css`)

### 1.1 Color Tokens
EG-Calendar uses a minimalist, executive green palette engineered for clarity and high contrast.

| Token | Light Value | Dark Value | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `--color-primary` | `#147D52` | `#1AA36B` | Primary CTAs, active tab indicators, selected radio buttons |
| `--color-primary-hover` | `#106744` | `#158C5A` | Hover & pressed states for primary buttons |
| `--color-primary-soft` | `#DDF3E7` | `#0C2B1D` | Selected slot pills, highlight backgrounds, subtle badges |
| `--color-highlight` | `#17231D` | `#F1F5F2` | High-contrast headings, KPI numbers, focused elements |
| `--color-bg` | `#F7F9F7` | `#0D1310` | Global application canvas background |
| `--color-surface` | `#FFFFFF` | `#131B16` | Cards, dialog panels, dropdown menus, table rows |
| `--color-surface-muted` | `#F1F5F2` | `#1A241F` | Secondary panels, calendar header bars, hover backgrounds |
| `--color-border` | `#E5EAE6` | `#26332C` | Dividers, card borders, calendar time-grid lines |
| `--color-text` | `#17231D` | `#ECF1ED` | Primary readable body text (contrast >= 10:1) |
| `--color-text-muted` | `#68756D` | `#94A39A` | Secondary descriptions, timestamps, helper text |
| `--color-danger` | `#C64747` | `#E05A5A` | Error messages, cancel buttons, disconnection warnings |
| `--color-warning` | `#A96A16` | `#C98222` | Stale sync indicators, pending approval badges |
| `--color-info` | `#386D9A` | `#4B8EC7` | Informational callouts, link copy notifications |

### 1.2 Spacing & Layout Tokens (4px Scale)
| Token | Value | Intended Usage |
| :--- | :--- | :--- |
| `--space-1` | `4px` | Fine-grain gaps, badge internal padding |
| `--space-2` | `8px` | Icon-to-text spacing, compact button padding |
| `--space-3` | `12px` | Input field vertical padding, list item gaps |
| `--space-4` | `16px` | Standard card internal padding, layout gutters |
| `--space-5` | `20px` | Section margins, grid row gaps |
| `--space-6` | `24px` | Page container padding, modal header padding |
| `--space-8` | `32px` | Major section separators, landing section margins |

### 1.3 Typography Tokens
- **Font Families:** `--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;`  
  `--font-mono: 'JetBrains Mono', 'Fira Code', monospace;`
- **Type Scale:**
  - `--text-xs`: `12px` (Line height: `16px`, weight: 400/500) — Captions, tags, status pills.
  - `--text-sm`: `14px` (Line height: `20px`, weight: 400/500) — Standard body text, form inputs, table data.
  - `--text-base`: `16px` (Line height: `24px`, weight: 400/500/600) — Section headings, prominent buttons.
  - `--text-lg`: `18px` (Line height: `28px`, weight: 600) — Card titles, drawer headers.
  - `--text-xl`: `20px` (Line height: `28px`, weight: 600) — Sub-page titles.
  - `--text-2xl`: `24px` (Line height: `32px`, weight: 700) — Main page titles (`/calendar`, `/requests`).
  - `--text-3xl`: `30px` (Line height: `36px`, weight: 700) — Public booking hero headline.

### 1.4 Shape, Elevation & Border Radius
- `--radius-sm`: `6px` — Small badges, checkbox corners, tag pills.
- `--radius-md`: `10px` — Form inputs, standard buttons, time slot chips.
- `--radius-lg`: `14px` — Cards, modals, slide-over sheets, calendar containers.
- `--shadow-sm`: `0 1px 2px rgba(23, 35, 29, 0.04)` — Table rows, resting cards.
- `--shadow-md`: `0 8px 24px rgba(23, 35, 29, 0.08)` — Popovers, dropdown menus, modals.

---

## 2. Global Helpers (`global.css`)

```css
/* Stack & Row Flex Helpers */
.stack { display: flex; flex-direction: column; gap: var(--space-4); }
.stack-sm { display: flex; flex-direction: column; gap: var(--space-2); }
.row { display: flex; align-items: center; gap: var(--space-3); }
.row-between { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }

/* Card & Surface Primitives */
.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

/* Button Helpers */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
  min-height: 44px;
}
.btn-primary {
  background-color: var(--color-primary);
  color: #FFFFFF;
}
.btn-primary:hover {
  background-color: var(--color-primary-hover);
}
.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}
.btn-secondary:hover {
  background-color: var(--color-surface-muted);
}
.btn-ghost {
  background-color: transparent;
  color: var(--color-text-muted);
}
.btn-ghost:hover {
  color: var(--color-text);
  background-color: var(--color-surface-muted);
}
```

---

## 3. UI Component Inventory (`components/ui`)

| Component | Variants | States | Implementation Notes |
| :--- | :--- | :--- | :--- |
| **Button** | `primary`, `secondary`, `ghost`, `destructive` | Default, Hover, Focused, Disabled, Loading | Minimum 44px touch target; accessible focus ring |
| **Input / Textarea** | `default`, `error`, `with-icon` | Default, Focused, Disabled, Error, Filled | Uses `--color-border`; red border on error |
| **Badge** | `success` (green), `warning` (amber), `danger` (red), `neutral` | Default, Interactive | Pill-shaped with semantic icon |
| **TimeSlotChip** | `available`, `selected`, `disabled` | Default, Hover, Selected, Loading | Green fill on selection; keyboard tab-navigable |
| **CalendarGrid** | `week`, `day`, `month` | Loading Skeleton, Loaded, Syncing, Empty Day | 7-column time matrix; sticky date header |
| **RequestCard** | `pending`, `confirmed`, `rejected` | Default, Approving, Approved | Displays 1-click "Approve" and "Approve & Gmail" |
| **Skeleton** | `text`, `avatar`, `card`, `grid-cell` | Pulsing animation | Mimics exact layout to eliminate layout shifts (CLS < 0.05) |
| **EmptyState** | `calendar`, `requests`, `links`, `members` | Default | Explanatory message + single clear primary action CTA |

---

## 4. Layout and Responsive Specifications

### 4.1 Breakpoints
- **Mobile (`sm`):** `375px` — Single column layout; compact topbar; full-width stacked forms; calendar defaults to Agenda/Day view.
- **Tablet (`md`):** `768px` — Collapsible icon sidebar; 2-column forms; 3-day calendar view.
- **Desktop (`lg`):** `1024px` — Full sidebar navigation (248px width); 7-day interactive availability grid; split booking link builder.
- **Wide (`xl`):** `1440px` — Maximum reading container; expansive dashboard analytics view.

### 4.2 Core Viewport Constraints
- **Zero Horizontal Scrolling:** No horizontal scrollbars allowed at `375px` viewport.
- **Touch Targets:** All interactive buttons, chips, and toggles must be at least `44×44px`.
- **Keyboard Trapping:** Modal dialogs and flyout drawers trap focus and dismiss on `Escape`.

---

## 5. Accessibility (WCAG 2.2 AA)

- **Contrast Ratios:** Text color `--color-text` on `--color-surface` yields `11.2:1`; `--color-primary` on white yields `4.8:1` (surpassing WCAG AA 4.5:1 requirement).
- **Non-Color Indicators:** Status indicators combine color with explicit text labels and SVG icons.
- **Screen Reader Announcements:** Dynamic slot loading states and booking submission confirmations utilize `aria-live="polite"` regions.
- **Visible Focus State:** Standard 2px solid `--color-primary` ring with 2px offset (`outline: 2px solid var(--color-primary); outline-offset: 2px;`).

---

## 6. Images and Media

- **Formats:** Strictly modern WebP and AVIF formats with compressed fallback.
- **Avatar & Logo Sizing:** Workspace logos constrained to `40×40px`; host profile avatars constrained to `64×64px` or `96×96px`.
- **Open Graph (OG) Social Image:** Dynamic SVG/PNG template generated at `1200×630px` displaying the Host Avatar, Meeting Title, Duration Pill, and Organization Badge.

---

## 7. Admin-Editable Settings

| Setting | Stored Location | Who Can Edit | Default Value | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Name & Slug** | `organizations` table | Organization Owner | `"EG-Calendar"` (`eg-calendar`) | Invalidation re-renders header |
| **Default Working Hours** | `working_hours` table | Owner / Admin / Host | Mon–Fri `09:00` to `18:00` | Configured at `/availability` |
| **Workspace Timezone** | `organizations.default_timezone` | Owner / Admin | `'Asia/Kolkata'` | Global fallback |
| **Primary Brand Color** | `organizations.brand_color` | Owner | `#147D52` | Overrides `--color-primary` dynamically |
| **Booking SEO Metadata** | `booking_links.seo_meta` | Link Host / Admin | Dynamic template | Title, description, OG |

---

## 8. Content and Tone

- **Voice:** Calm, professional, concise, and executive. Avoid technical jargon or generic filler.
- **Button Microcopy:** Action-oriented and explicit (e.g., "Confirm Meeting", "Approve & Gmail", "Connect Google Calendar").
- **Error Messages:** Structured as **What Happened + What To Do**:
  - *Example:* "Selected slot was just booked by another attendee. Please choose an alternate time from the updated list."
  - *Example:* "Google Calendar credentials expired. Please click Reconnect to refresh your account access."

---

**Gate 2 Sign-Off:**  
- **Design Reviewer:** CTO  
- **UI Approval:** Kuldeep (Product)  
- **Date:** 2026-11-02  

