# Local UAT UI/UX Observations — 2026-09-24

This record covers the mandatory visual and interaction review performed during local UAT. Testing used the local Vite app with the disposable Business account and local-only workspace fixtures. No production data or credentials are recorded here.

## Review matrix

- Viewports reviewed: 1440×900, 768×1024, and 390×844.
- Browser: Chromium through the repository Playwright CLI wrapper.
- Roles/plans: authenticated workspace member on Business; the existing local UAT report covers fresh Starter/Business signup and subscription flows.
- Routes reviewed in this pass: `/dashboard`, `/settings`, and `/pricing/confirmed`.
- Console: no runtime errors during the final pass. The only entries were React DevTools information and existing React Router v7 future-flag warnings.

## Observations

### UI-001 — Settings tabs clipped on narrow mobile screens

- Date: 2026-09-24
- Route/component: `/settings`, Settings tabs
- Role/plan/workspace: authenticated member / Business / `UAT Business 20260924`
- Viewport/browser: 390×844 / Chromium
- Type: Responsive, accessibility, navigation
- Severity: Medium
- Before: the tab list used a fixed-height inline flex layout. Its measured scroll width was 423px inside a 375px client area, so the Notifications tab was partially clipped and there was no clear indication that more tabs were available.
- Expected: every settings destination should be visible and keyboard/touch discoverable at the mobile breakpoint.
- Root cause: confirmed in the shared TabsList classes (`inline-flex h-10`) combined with non-wrapping tab triggers.
- Fix: Settings now uses a two-column responsive grid below `sm` and keeps the original inline layout on larger screens.
- Retest: passed. Final tab-list scroll width and client width were both 349px at 390px viewport; all four tabs were visible in the screenshot.
- Evidence: [before](../output/playwright/uat-2026-09-24/UI-001-settings-mobile-before.png), [after](../output/playwright/uat-2026-09-24/UI-001-settings-mobile-after.png)
- Status: Fixed and retested.

### UI-002 — Workspace selector unavailable in mobile navigation

- Date: 2026-09-24
- Route/component: authenticated AppHeader/AppSidebar workspace navigation
- Role/plan/workspace: authenticated member / Business and Growth fixtures
- Viewport/browser: 390×844 / Chromium
- Type: Navigation, responsive, workspace isolation
- Severity: Medium
- Before: the desktop sidebar, which contains the workspace selector, is hidden below `md`; the mobile navigation did not expose workspace switching. The mobile `More` action routed to Settings but did not provide a workspace control.
- Expected: a member with multiple workspaces should be able to change workspace context on mobile without switching to a desktop viewport.
- Root cause: confirmed in the layout: AppSidebar is hidden on mobile and AppHeader had no equivalent selector.
- Fix: added an accessible, mobile-only workspace selector to AppHeader. The funding chip is hidden at very narrow widths to preserve title and selector space.
- Retest: passed. Selecting `UAT Business 20260924` showed Business; selecting `UAT Growth 20260923 D` changed the selected option and Settings plan card to Growth. No stale subscription or workspace data appeared after the switch.
- Evidence: [mobile selector](../output/playwright/uat-2026-09-24/UI-002-workspace-selector-mobile.png)
- Status: Fixed and retested.

### UI-003 — Tablet header created horizontal overflow

- Date: 2026-09-24
- Route/component: shared AppHeader
- Role/plan/workspace: authenticated member / Growth fixture
- Viewport/browser: 768×1024 / Chromium
- Type: Responsive, layout
- Severity: Medium
- Before: the persistent search control was displayed at the tablet breakpoint alongside the sidebar and action controls. The document measured 958px wide in a 753px client area, producing a horizontal scrollbar and clipping header content.
- Expected: the application shell should fit the viewport at tablet width without horizontal scrolling.
- Root cause: confirmed: SearchBar was enabled from `md`, and the header action group could not fit beside the fixed sidebar.
- Fix: SearchBar now begins at `lg`; the header and action group also use `min-w-0`/overflow constraints. Search remains available on full desktop.
- Retest: passed. At 768×1024, body and document scroll width both measured 753px, matching the client width; no horizontal scrollbar remained.
- Evidence: [dashboard tablet](../output/playwright/uat-2026-09-24/dashboard-tablet-768x1024.png), [settings tablet](../output/playwright/uat-2026-09-24/settings-tablet-768x1024.png)
- Status: Fixed and retested.

### UI-004 — Payments table needed a mobile scroll affordance

- Date: 2026-09-24
- Route/component: `/payments`, Payments table
- Role/plan/workspace: authenticated member / Growth / `UAT Growth 20260923 D`
- Viewport/browser: 390×844 / Chromium
- Type: Responsive, tables, discoverability
- Severity: Medium
- Before: the table was 685px wide inside a 375px viewport. The page correctly contained the overflow, but the right-side columns were clipped from the initial view and there was no visible instruction that the table could be swiped horizontally.
- Expected: critical payment columns remain accessible, with a clear mobile scroll affordance when a full responsive card transformation is not necessary.
- Root cause: confirmed in `Payments.tsx`: the table was wrapped in `overflow-x-auto` without mobile guidance.
- Fix: added a mobile-only “Swipe horizontally to view all payment columns” affordance while preserving the existing accessible table and horizontal scroll behavior.
- Retest: passed. The affordance is visible above the table, the document remains 375px wide, and the table remains available through its horizontal scroll container.
- Evidence: [before](../output/playwright/uat-2026-09-24/UI-004-payments-mobile-before.png), [after](../output/playwright/uat-2026-09-24/UI-004-payments-mobile-after.png)
- Status: Fixed and retested.

### UI-005 — Contact Us secondary text failed contrast audit

- Date: 2026-09-24
- Route/component: `/contact`, public contact content
- Role/plan/workspace: signed-out visitor / not applicable
- Viewport/browser: 1440×900 / Chromium + axe contrast audit
- Type: Accessibility, visual design
- Severity: Medium
- Before: axe reported the muted `#64748B` body/contact text as insufficiently contrasted against the page and card backgrounds.
- Expected: secondary copy, contact details, and the message counter should meet the project’s automated contrast check.
- Root cause: confirmed in `Contact.tsx`: several secondary-text elements used the lighter `#64748B` token on the public light surfaces.
- Fix: changed those secondary-text instances to the darker existing `#52607A` tone.
- Retest: targeted public contrast audit passed for `/contact`; the full E2E suite passed after the change.
- Evidence: the public Contact Us screenshot remains in the local Playwright artifact set; no user data is present.
- Status: Fixed and retested.

## Screens reviewed with no remaining visual defect observed

- Desktop Dashboard and Settings at 1440×900: cards, navigation, settings content, and action controls fit without overlap or clipping.
- Mobile Dashboard at 390×844: cards, quick-action FAB, and bottom navigation fit within the viewport.
- Mobile `/pricing/confirmed` at 390×844: confirmation state and actions fit without overlap.
- Tablet Dashboard and Settings at 768×1024 after the header fix: no horizontal document overflow.
- Mobile Payments empty state at 390×844: the table’s horizontal-scroll guidance is visible and the empty state remains readable.

## Follow-up

- The React Router future-flag warnings are existing non-blocking development warnings, not runtime failures introduced by this pass.
- Continue using sanitized local-only screenshots for subsequent UAT; do not record passwords, payment credentials, or production customer data.
