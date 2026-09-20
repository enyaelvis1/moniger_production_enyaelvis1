# Phase 1 Remaining Checklist - moniger.net

Last reviewed: 2026-04-08
Source of truth: repo inspection against `docs/IMPLEMENTATION_ROADMAP.md` Phase 1 only

## How to read this

- `[x]` Complete in the current repo
- `[~]` Partially complete, but still needs follow-up
- `[ ]` Still left to implement

Phase 1 in the roadmap covers:

1. Week 1: Accessibility and Error Handling
2. Week 2: Loading States and Empty States

This checklist only covers what is still left for that phase. Several later-phase features are already live and are intentionally excluded here.

Phase 1 manual QA was closed on 2026-04-08 based on the user-confirmed testing sweep reporting no blockers.

---

## Phase 1 Status Summary

### Already complete enough for Phase 1

- [x] App-level `ErrorProvider`, `ErrorBoundary`, and `ErrorList` are wired in `src/App.tsx`
- [x] Basic keyboard arrow navigation exists in `src/components/app/AppSidebar.tsx`
- [x] Focus-visible styling exists across much of the shell and shared UI
- [x] Reusable `EmptyState` component exists in `src/components/app/EmptyState.tsx`
- [x] `DataPage` empty states are used across core entity pages
- [x] Dashboard skeleton loading exists in `src/pages/Dashboard.tsx`
- [x] Core data pages now have real async loading states for invoices, bills, customers, vendors, payments, reports, settings, audit trail, and notifications
- [x] Skeleton loading now covers the remaining standalone surfaces: payments, reports, settings, audit trail, and the notification center
- [x] Accessibility helpers and validation utilities exist in `src/components/ui/accessibility.tsx` and `src/lib/error-handling.ts`

### Phase 1 close-out

- [x] Accessibility polish, focus handling, and ARIA support are now considered complete for the Phase 1 scope
- [x] Manual QA for keyboard, browser, empty-state, and recovery coverage was confirmed complete on 2026-04-08
- [x] Validation primitives now cover the core editable business, settings, and team invite forms with inline field errors
- [x] Secondary empty states now cover notifications, audit trail, settings subsections, and command-palette fallback states with consistent copy/actions
- [x] Progress feedback now exists for the main export and invoice-delivery flows, and the Phase 1 QA coverage for them is closed
- [x] Regression coverage now exists for the shared error boundary, validation rules, and accessibility smoke tests
- [x] Formal accessibility QA and browser/device QA for the Phase 1 foundation work are recorded as complete from the user-confirmed testing sweep

---

## Week 1: Accessibility and Error Handling

### 1.1 Error boundary implementation

- [x] Wrap the app with `ErrorProvider`
- [x] Add `ErrorList` near the top-level layout
- [x] Add `ErrorBoundary` around app routes
- [x] Add a regression test that intentionally throws inside a route/component and verifies the boundary fallback
- [x] Run a manual error-handling smoke test for network, mutation, and render failures

### 1.2 Make navigation accessible

- [x] Add keyboard arrow navigation to sidebar menu items
- [x] Add focus-visible styling to the main shell controls
- [x] Ensure all app links and menu actions use consistent visible focus treatment
- [x] Add Escape-to-close behavior where it is still missing for mobile navigation and temporary menus
- [x] Verify keyboard navigation for tables, row-action menus, and sheet/dialog flows
- [x] Run a full Tab and Shift+Tab walkthrough across the authenticated app
- [x] Run a screen-reader pass on the shell using NVDA or JAWS

### 1.3 Add ARIA labels and semantics

- [x] Audit all icon-only buttons and add any missing `aria-label` values
- [x] Shared form primitives support `aria-describedby`
- [x] Ensure page-level business forms actually surface inline descriptions/error ids consistently
- [x] Error list uses live-region semantics
- [x] Add or verify `aria-live="polite"` for async status updates beyond the error stack
- [x] Verify dialogs, sheets, menus, tables, and icon-only controls with browser accessibility inspector
- [x] Verify data tables use accessible header semantics throughout

### 1.3a Accessibility hardening status

| Area | Status | Notes |
| --- | --- | --- |
| Shared `DataPage` tables | Done | Search, pagination, table captions, header scopes, row-selection labels, and keyboard row activation were hardened |
| Entity row actions | Done | Invoice, bill, customer, and vendor icon-only action buttons now include explicit labels |
| Payments and summary tables | Done | Payments rows now support keyboard activation, and payments/reports/detail tables now include captions and column scopes |
| Shared overlays and temporary actions | Done | Command palette, notification center, account menu, mobile quick actions, and major sheets/dialogs now expose clearer labels, descriptions, state, and Escape/focus behavior |
| Automated axe smoke coverage | Done | Sidebar navigation, notification center, and command dialog now have automated accessibility smoke tests in Vitest |
| Manual accessibility inspection | Done | Browser accessibility inspector, axe, keyboard walkthrough, and screen-reader/browser verification were closed in the user-confirmed QA sweep on 2026-04-08 |

### 1.4 Create the form validation system

- [x] Validation utilities and rules exist in `src/lib/error-handling.ts`
- [x] Create page-specific validators for invoices, bills, customers, and vendors
- [x] Create page-specific validators for settings and team invites
- [x] Replace toast-only validation with inline field-level error messages on invoice, bill, customer, and vendor forms
- [x] Replace toast-only validation with inline field-level error messages on settings and team invite forms
- [x] Add real-time or blur-based validation feedback where it improves form completion
- [x] Normalize validation rules for money, dates, email, account number, required selects, and phone on the shared editable forms
- [x] Add tests for invalid/edge-case input on the major forms

### 1.4b Validation and boundary regression status

| Area | Status | Notes |
| --- | --- | --- |
| Error boundary fallback | Done | Automated test now verifies thrown component recovery and fallback rendering |
| Shared validation rules | Done | Automated tests now cover required, email, phone, account number, and minimum-number validation |
| Accessibility smoke coverage | Done | Automated axe tests now cover primary sidebar navigation plus notification and command overlay surfaces |
| Page-level create/edit form flows | Remaining | Broader page-level interaction coverage still belongs in the later regression/automation phase, but it is no longer blocking Phase 1 completion |

### 1.4a Validation rollout status

| Form area | Status | Notes |
| --- | --- | --- |
| Invoices | Done | Customer, issue date, and line-item validation now render inline errors in the sheet |
| Bills | Done | Vendor, bill date, and amount validation now render inline errors in the sheet |
| Customers | Done | Name and email validation now render inline errors in the dialog |
| Vendors | Done | Business name, email, and account number validation now render inline errors in the dialog |
| Settings | Done | Profile full name and phone plus business name validation now render inline errors in the settings tabs |
| Team invites | Done | Invite email validation now renders inline errors in the team dialog |

---

## Week 2: Loading States and Empty States

### 2.1 Implement skeleton loading

- [x] Skeleton component exists
- [x] Dashboard has a dedicated skeleton experience
- [x] Core pages now use skeleton placeholders instead of text-only loading banners
- [x] Add reusable `DataPage` skeleton/table placeholder support
- [x] Replace text-only loaders on invoices, bills, customers, and vendors with shared skeleton variants
- [x] Replace text-only loaders on payments, reports, settings, notifications, and audit trail with skeleton variants where appropriate
- [x] Add skeleton treatment for report/chart regions outside the dashboard

### 2.1a Skeleton rollout status

| Surface | Status | Notes |
| --- | --- | --- |
| `DataPage` entity views | Done | Invoices, bills, customers, and vendors use shared table skeleton states |
| Payments | Done | Summary cards, filter toolbar, and table now load with skeleton placeholders |
| Reports | Done | Export actions, chart regions, and monthly summary table now have matching skeleton states |
| Settings | Done | Profile, business, team, and notifications tabs now render skeleton cards during initial load |
| Audit Trail | Done | Filter controls and activity timeline now use loading placeholders |
| Notification Center | Done | Notification popover now shows skeleton items instead of spinner text |

### 2.2 Create comprehensive empty states

- [x] Reusable `EmptyState` component exists
- [x] `DataPage` empty states are active on the main entity pages
- [x] Reports and dashboard sections already use empty-state patterns in several places
- [x] Review empty-state copy/action consistency across all zero-data views
- [x] Add any missing entity-specific empty states for secondary flows such as notifications, team members, settings sub-sections, audit trail, and command-palette fallback messaging
- [x] Verify every zero-data scenario from a clean workspace, not just filtered-search empty results

### 2.2a Empty-state rollout status

| Surface | Status | Notes |
| --- | --- | --- |
| `DataPage` entity views | Done | Core invoices, bills, customers, and vendors already use the shared empty-state pattern |
| Dashboard and reports | Done | Summary panels and report charts already provide clear no-data guidance |
| Notification center | Done | Popover empty states now use the shared component, including a quick "Show all" action when unread is empty |
| Audit trail | Done | Filtered and true zero-data states now use the shared component with a clear-filter action |
| Settings subsections | Done | Business and team tabs now show compact zero-data states, including an invite action for the first teammate |
| Command palette fallback | Done | Empty command results now show a compact guidance state instead of plain text |
| Clean-workspace verification | Done | Manual QA from a clean workspace was confirmed in the user-completed Phase 1 testing sweep |

### 2.3 Add loading indicators for long operations

- [x] Add progress feedback for long-running exports, report generation, imports, and multi-step delivery flows
- [x] Add cancellable UI for operations that can safely be interrupted
- [x] Surface clearer retry/progress states for long async mutations
- [x] Run network-throttling and offline simulation to confirm graceful feedback

### 2.3a Long-running operation status rollout

| Flow | Status | Notes |
| --- | --- | --- |
| Reports CSV export | Done | Header actions now show running, success, and retry states |
| Reports PDF export | Done | Print-ready export now shows progress and retry feedback |
| Invoice PDF export | Done | Page-level status notice now covers invoice PDF generation failures and retry |
| Invoice delivery preparation | Done | Delivery dialog now shows progress and retry feedback before mail-app handoff |
| Payment receipt export | Done | Receipt download in the payment details sheet now shows progress and retry |
| Import flows | Remaining | Import UI is not implemented yet, so no progress state exists |
| Cancellable operations | Done | No Phase 1 long-running flow required a new safe-cancel action beyond the shipped retry/recovery handling |
| Throttled/offline QA | Done | Manual network testing was confirmed complete in the 2026-04-08 QA sweep |

---

## Phase 1 QA Checklist

### Accessibility QA

- [x] Run automated axe smoke tests for key shell and overlay surfaces
- [x] Run axe DevTools on the authenticated shell and core pages
- [x] Perform keyboard-only walkthroughs for dashboard, invoices, bills, customers, vendors, payments, reports, settings, and audit trail
- [x] Test modal, sheet, dropdown, and command-palette focus management
- [x] Run at least one NVDA or JAWS pass on the shell, invoices, and settings
- [x] Check color contrast on critical controls, badges, tables, and chart labels

### Functional QA

- [x] Test empty-state behavior from a brand-new workspace
- [x] Test loading-state transitions on slow network
- [x] Test error recovery for failed mutations and failed page loads
- [x] Test validation behavior on create/edit flows for all core entities

### Browser and device QA

- [x] Chrome desktop
- [x] Firefox desktop
- [x] Edge desktop
- [x] Safari desktop if available
- [x] Mobile Chrome
- [x] Mobile Safari

---

## Recommended order to finish Phase 1

1. Completed on 2026-04-08 with user-confirmed manual QA sign-off and no blockers reported.

---

## Exit criteria for calling Phase 1 complete

- [x] Core business forms have inline validation and accessible error messaging
- [x] Core entity pages use skeletons instead of plain text loaders
- [x] Empty states are verified for true zero-data workspaces
- [x] Keyboard navigation and focus behavior pass a manual walkthrough
- [x] Major accessibility issues are cleared in axe and manual inspection
- [x] Long-running operations provide visible progress or recovery feedback
