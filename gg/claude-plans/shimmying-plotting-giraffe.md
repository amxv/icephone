# IcePhone Landing Page — Implementation Plan

## Context

IcePhone currently redirects all unauthenticated visitors from `/` to `/sign-in`. We want a public-facing landing page at the root route that showcases the platform's capabilities with a "Sign In" CTA. The copy and feature list have already been written in two reference documents.

---

## Routing Changes

### 1. Move Dashboard from `/` to `/dashboard`

The dashboard currently lives at `src/app/(pages)/page.tsx` which maps to `/`. We need to move it so the landing page can own `/`.

- **Move** `src/app/(pages)/page.tsx` → `src/app/(pages)/dashboard/page.tsx`
- No code changes needed inside the file — it already imports `getDashboardData` and renders `DashboardClient`

### 2. Update All `/` References to `/dashboard`

| File | Change |
|------|--------|
| `src/components/sidebar-nav.tsx:31` | `href: "/"` → `href: "/dashboard"` |
| `src/components/auth/sign-in-form.tsx:41` | `router.push("/")` → `router.push("/dashboard")` |
| `src/components/auth/sign-up-form.tsx:43` | `router.push("/")` → `router.push("/dashboard")` |
| `src/app/example-table-page/layout.tsx:9` | `redirect("/")` → `redirect("/dashboard")` |

### 3. Make Root Route Public

In `src/proxy.ts`, add the root path to `PUBLIC_ROUTES`:

```ts
const PUBLIC_ROUTES = [
  /^\/$/,  // Landing page
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/test-rag(\/.*)?$/,
  /^\/api\/call-queue(\/.*)?$/,
]
```

---

## Landing Page Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Root route — thin server component that renders the landing page |
| `src/components/landing-page.tsx` | Full landing page client component with all sections and animations |

### Design Direction: Dark Luxury Command Center

**Aesthetic:** Dark-mode-first with warm amber/gold accents. Premium, editorial feel — not cold SaaS blue. The amber (`#ffca80` / `hsl(35, 100%, 75%)`) against deep dark backgrounds creates a command-center warmth.

**Typography:**
- Headlines: Import a distinctive display font via `next/font/google` — **Instrument Serif** (elegant editorial serif that contrasts with the tech Geist body font)
- Body: Use existing Geist Sans (already loaded in root layout)
- The serif + sans contrast creates a memorable, premium feel

**Color Palette (from existing theme):**
- Background: Deep dark — `#0c0013` to near-black
- Primary accent: Amber/gold — `#ffca80` / `hsl(35, 100%, 75%)`
- Text: White/cream for headings, muted gray for body
- Cards/surfaces: Subtle white-on-dark with low opacity borders

**Motion (using installed `motion` package):**
- Staggered fade-up reveals on scroll (IntersectionObserver-based)
- Smooth entrance animations for hero elements
- Subtle hover states on cards and CTAs

**Visual Texture:**
- Subtle radial gradient glows behind key sections (amber-tinted)
- Fine noise/grain overlay for depth
- Thin amber-glowing borders on feature cards

### Page Structure (top to bottom)

1. **Sticky Nav** — Logo (existing `<Logo>` component) + "Sign In" button, transparent bg that gains backdrop-blur on scroll
2. **Hero** — Large Instrument Serif headline "Your AI workforce for the phones." + subheadline + two CTAs (Sign In primary amber, See IcePhone in Action secondary outline)
3. **Integration Trust Bar** — "Works with the tools you already use" + logos/names: Twilio, Telnyx, Vonage, HubSpot, Salesforce, GoHighLevel, Pipedrive, Cal.com
4. **Problem Section** — "Phones are still where deals happen. But nobody wants to work them." with supporting copy
5. **How It Works** — 3 numbered steps with icons: Build → Connect → Launch
6. **Key Benefits** — 5 benefit cards in a grid: Scale, Searchable Data, Knowledge Base, Pipeline Automation, One Dashboard
7. **Use Cases** — 6 cards: Sales, Appointments, Support, Collections, Onboarding, Retention
8. **Feature Highlights** — Compact grid of 9 specific capabilities (role templates, 10 languages, campaigns, CRM, browser testing, webhooks, call transfer, business hours, audit logging)
9. **Integrations Detail** — Three columns: Telephony, CRMs, Calendar
10. **Analytics** — Scannable list of analytics capabilities
11. **FAQ** — 8 questions in expandable accordion (use existing shadcn Collapsible or custom)
12. **Final CTA** — Closing headline + both CTAs repeated
13. **Footer** — Minimal: logo, copyright, link to sign in

### Copy Source

All copy comes directly from `/gg/agent-outputs/codebase-researcher/landing-page-copy.md`. No backend service names (OpenAI, Deepgram, Voyage, Cloudflare, etc.) will appear anywhere.

### Integration Logos

Use logo.dev API to fetch logos for: Twilio, Telnyx, Vonage, HubSpot, Salesforce, GoHighLevel, Pipedrive, Cal.com. Fall back to styled text if any fail.

### Font Loading

Add Instrument Serif to `src/app/page.tsx` (or a layout for the landing page) using `next/font/google`. This keeps it scoped to the landing page without affecting the rest of the app.

---

## Reuse from Existing Codebase

| What | From |
|------|------|
| `<Logo>` component | `src/components/logo.tsx` |
| `<Button>` component | `src/components/ui/button.tsx` |
| CSS theme variables | `src/app/globals.css` (amber/gold primary) |
| `motion` library | Already installed (`motion@^12.18.1`) |
| Geist fonts | Already loaded in `src/app/layout.tsx` |

---

## Verification

1. Run `bun run dev` and visit `http://localhost:3000/` — landing page should render (no auth redirect)
2. Click "Sign In" → should navigate to `/sign-in`
3. Sign in → should redirect to `/dashboard` (not `/`)
4. Sidebar "Dashboard" link → should navigate to `/dashboard`
5. Run `bun run typecheck` — no TypeScript errors
6. Test on mobile viewport — page should be responsive
