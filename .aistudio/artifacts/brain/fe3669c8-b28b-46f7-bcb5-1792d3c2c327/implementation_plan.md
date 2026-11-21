# AH Task Pay Landing Page Redesign

Redesign the public landing page to match the deep royal-blue and vibrant orange visual language of your reference design, pairing an overlapping live-statistics bar and custom freelancer hero illustration with real-time Bangladeshi Taka (`৳`) tasks, interactive walkthroughs, and adaptive light/dark sections.

## User Review & Critical Decisions

> [!IMPORTANT]
> All four core design decisions from your Phase 1 selections are locked into this blueprint. Please review the layout, visual asset plan, and interactive behavior below before we begin implementation.

- **Confirmed Hero & Layout Style**: Top deep royal-blue hero banner with an overlapping 3-column floating statistics bar directly bridging the hero and the white/dark-adaptive task showcase below.
- **Confirmed Language & Live Data**: Crisp English headings and navigation paired with real-time Bangladeshi Taka (`৳`) values fetched dynamically from the live database (with graceful fallback display when counts are zero or loading).
- **Confirmed Hero Visual**: Custom-generated photorealistic freelancer illustration matching the reference composition (smiling South Asian freelancer with laptop and subtle golden Taka/growth accents seamlessly integrated into the deep blue backdrop).
- **Confirmed Theme Strategy**: Permanent deep royal-blue hero canvas (`#06256D` to `#0B3596`) with full light/dark adaptive sections (`#F8FAFC` / `#0F172A`) and a theme switch accessible without disrupting the hero contrast.

---

## 1. Overview & Core Concept

- **What It Does**: Serves as the high-conversion public storefront for AH Task Pay, introducing both micro-workers (looking to earn daily via simple verified tasks) and advertisers/employers (looking for real human engagement) before guiding them into registration or login.
- **Target Audience**: Freelancers, students, and everyday earners across Bangladesh seeking trusted mobile payouts (bKash, Nagad, Mobile Recharge), alongside business owners and creators promoting channels, apps, or websites.
- **Key Value**: Replaces generic text-heavy stacks with an authoritative, trustworthy marketplace aesthetic—immediately demonstrating live platform scale, real available Taka (`৳`) tasks, transparent payout channels, and a frictionless onboarding flow.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **First-Impression & Hero Orientation**: Visitor lands on the deep royal-blue header and hero. They immediately see the official AH Task Pay brand mark, concise single-line navigation links (`Home`, `Tasks`, `How It Works`, `FAQ`, `Contact`), a bold headline (*"The Trusted Microjob Platform for Skilled Workers"*), a warm high-contrast *"Get Started Free"* CTA button, and a secondary *"How it Works"* button that smoothly scrolls to the interactive walkthrough.
2. **Instant Proof via Overlapping Stats Bar**: Immediately overlapping the bottom edge of the hero banner sits an elevated 3-column stats strip showing live **Happy Members**, **Total Paid Out (`৳`)**, and **Completed Tasks** with smooth count-up tabular numbers.
3. **Popular Tasks Discovery**: Directly below the stats bar, visitors browse live open tasks (`Popular Tasks` / `Top Live Opportunities`) displaying task category icon, clean title, Taka reward (`৳`), slot progress indicator, and an orange *"Apply Now"* action button routing into authentication.
4. **Interactive Role Walkthrough & Trust Verification**: Visitors can switch between *"For Workers (Earn Money)"* and *"For Advertisers (Post Jobs)"* in the How It Works section, inspect supported local payout methods (bKash, Nagad, Mobile Recharge logos), expand interactive FAQ items, and access WhatsApp/Telegram/Email support links in the contact & footer bands.

### Visual Identity & Theme

- **Aesthetic Direction**: High-trust financial & microjob marketplace—combining a commanding corporate royal-blue hero stage with crisp, airy content sections and energetic warm-orange conversion triggers.
- **Color Palette & Mood**:
  - *Hero Canvas*: Deep Royal Blue gradient (`#041B52` → `#0A348F` → `#0F46B8`) with crisp `#FFFFFF` primary typography and warm amber-orange (`#FB923C` / `#F97316`) headline emphasis.
  - *Adaptive Page Canvas (60%)*: `#F8FAFC` (Light) / `#0B1120` (Dark) for clean breathing room below the hero.
  - *Structural Surfaces (30%)*: `#FFFFFF` (Light) / `#1E293B` (Dark) cards with subtle hairline borders (`border-slate-200` / `border-slate-800`) and single-level elevation.
  - *Primary Action Accent (10%)*: High-contrast Sunset Orange (`#F97316`, hover `#EA580C`) for primary CTAs (*"Register"*, *"Get Started Free"*, *"Apply Now"*), paired with Emerald (`#10B981`) strictly for verified/completed indicators.
- **Typography & Hierarchy**:
  - *Display & Headings*: `Plus Jakarta Sans` (weights 700–800, tight tracking, `text-wrap: balance` to prevent single-word orphan lines; hero headline sized `clamp(2.25rem, 4vw, 3.75rem)`).
  - *Body & Navigation*: `DM Sans` (15px–16px readable body prose, 1.6 line-height, clean single-line `whitespace-nowrap` navigation).
  - *Financial Figures & Counters*: `tabular-nums` on all `৳` reward amounts, progress percentages, and stat counters so digits align cleanly.
- **Top Bar Contract & Component Styling**:
  - Clean 3-zone header: Left official `BrandLogo` inside a crisp white rounded container (matching the top-left tab/pill silhouette in the reference), Center 5 single-line text links (`Home`, `Tasks`, `How It Works`, `FAQ`, `Contact`) with subtle active underline, Right `Login` (outlined) + `Register` (solid orange) action buttons plus mobile hamburger menu drawer on smaller screens.
  - Clean unboxed metadata (no pill badge sandwiches or decorative pulsing dots on static labels).
  - Promotional banner support preserved seamlessly if configured via `systemConfig.loginBannerUrl`.
- **Interactive Feedback & Motion**:
  - Sub-200ms hover transitions on buttons and task cards (`transform` and `opacity` only, respecting `prefers-reduced-motion`).
  - Smooth scroll navigation for header links and the *"How it Works"* CTA.
  - Interactive accordion transitions for FAQs and tabbed switcher for Worker vs. Advertiser steps.

---

## 3. Key Product Decisions & Trade-Offs

1. **Overlapping Stats Strip Using Live Database Metrics**
   - *Chosen Approach*: Map the floating 3-column strip directly to `/api/landing/stats` (`totalUsers`, `totalWithdraw` in `৳`, `completedTasks`), plus show `totalJobs` context cleanly without cluttering the 3-slot reference rhythm.
   - *Why*: Preserves the exact clean 3-column proportion of your reference image while keeping 100% authentic live numbers from your platform rather than hardcoded mock `$1M+` / `5M+` text.
   - *Alternatives Considered*: A 4-column crowded strip or static marketing numbers; rejected because it breaks the clean 3-column reference balance and misleads visitors.

2. **Custom Generated Freelancer Hero Asset vs. Stock/Empty Graphics**
   - *Chosen Approach*: Generate a bespoke hero illustration featuring a smiling young South Asian freelancer working on a modern laptop with subtle orange growth arrow and coin motifs on a matching deep royal-blue studio backdrop, with a graceful gradient/SVG fallback container.
   - *Why*: Matches the warmth and visual weight of the reference mockup while eliminating fragile external image URLs.
   - *Alternatives Considered*: Pure CSS cards on the right side; rejected per your confirmed choice for a custom freelancer photo.

3. **Adaptive Light/Dark Sections Below a Permanent Deep-Blue Hero**
   - *Chosen Approach*: Keep the hero banner locked to its deep royal-blue palette (so white text, orange highlights, and the freelancer visual always retain ≥ 4.5:1 WCAG AA contrast) while adapting the overlapping stats card, Popular Tasks, Features, Payout Methods, FAQ, and Footer cleanly between Light and Dark themes.
   - *Why*: Satisfies both the iconic visual identity of your reference and the site's existing Light/Dark preference without "split-brain" contrast issues.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          Public Landing Experience                        │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Sticky/Top Royal-Blue Header                                        │  │
│  │ [BrandLogo] ─── [Home · Tasks · How It Works · FAQ · Contact]       │  │
│  │             ─── [Theme Toggle] [Login] [Register] / [Mobile Drawer] │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  ┌─────────────────────────────────▼───────────────────────────────────┐  │
│  │ Deep Royal-Blue Hero Split (16:9 / 2-Column Balanced)               │  │
│  │  Left: Headline + Value Copy + [Get Started Free] + [How it Works]  │  │
│  │  Right: Custom Generated Freelancer Visual + Optional Promo Banner  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │ (Overlapping -mt-12)                 │
│  ┌─────────────────────────────────▼───────────────────────────────────┐  │
│  │ Floating 3-Column Live Stats Bar                                    │  │
│  │  [Happy Members]  │  [Total Paid Out (৳)]  │  [Completed Tasks]     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                      │
│  ┌─────────────────────────────────▼───────────────────────────────────┐  │
│  │ Adaptive Light / Dark Content Sections                              │  │
│  │  1. Popular Tasks Grid (Live /api/landing/top-jobs + Apply Now CTA) │  │
│  │  2. Interactive "How It Works" (Worker / Advertiser Tab Switch)     │  │
│  │  3. Platform Highlights & Supported Payouts (bKash · Nagad · TopUp) │  │
│  │  4. Interactive FAQ Accordion + Direct Contact / Support Channels   │  │
│  │  5. Clean Branded Footer + Terms & Privacy Link                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ GET /api/landing/stats       │ GET /api/landing/top-jobs (15s poll)
         └──────────────┬───────────────┘
                        │
             ┌──────────┴──────────┐
             │  Express / Supabase │
             └─────────────────────┘
```

### Data Model & State

- **Auth & System Config (`useAuth`)**: Redirects authenticated users automatically (`/admin` or `/dashboard`), respects `systemConfig.loginTitle` (if customized by admin) and `systemConfig.loginBannerUrl`, and displays a clean loading state while `authLoading` resolves.
- **Live Platform Stats (`stats` state)**: Hydrated from `/api/landing/stats` (`totalUsers`, `totalJobs`, `completedTasks`, `totalWithdraw`) and rendered via `AnimatedNumber` with `tabular-nums`.
- **Live Popular Tasks (`topJobs` state)**: Hydrated from `/api/landing/top-jobs` every 15 seconds. Renders up to 4–6 top open tasks cleanly (with title, `৳` reward, filled/total slots bar, and *"Apply Now"* or *"Slot Full"* state). If zero open jobs exist momentarily, renders a clean empty-state prompt inviting users to register and check new postings.
- **Local Interactive UI State**:
  - `activeHowItWorksTab`: `'worker' | 'employer'` toggle for switching the 3-step guide.
  - `openFaqIndex`: `number | null` controlling accessible accordion expansion.
  - `mobileMenuOpen`: `boolean` toggling the responsive drawer on small viewports.

### Interactive Component & State Mapping

- **Header Navigation & Mobile Menu**: Clicking `Home`, `Tasks`, `How It Works`, `FAQ`, or `Contact` smoothly scrolls to the target section ID and closes the mobile drawer if open.
- **Hero CTAs**: *"Get Started Free"* navigates to `/register`; *"How it Works"* smoothly scrolls to `#how-it-works` and activates the walkthrough.
- **Task Cards**: Each live job card's *"Apply Now"* button navigates to `/login` (or `/register`), disabling interaction visually when `isFull` is true.
- **How It Works Tabs**: Clicking *"Earn as Worker"* or *"Promote Business"* switches the 3-step cards instantaneously with subtle CSS transition.
- **FAQ Accordion**: Clicking any question toggles `aria-expanded` and reveals the concise answer smoothly.
- **Theme Switch**: Connected to `useTheme()` so visitors can preview adaptive light/dark sections at any time.
