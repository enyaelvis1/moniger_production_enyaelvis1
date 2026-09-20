# moniger.net Implementation Gap Analysis

## Purpose

This document reviews the current root docs against the actual codebase and recommends the next implementation steps for moniger.net.

Reviewed sources:

- `ENTERPRISE_DESIGN_GUIDE.md`
- `docs/IMPLEMENTATION_ROADMAP.md`
- current application code in `src/`

---

## Executive Summary

moniger.net is no longer just a design mockup. The project already has:

- a polished landing page and authenticated shell
- Supabase authentication wiring
- page structure for invoices, bills, vendors, customers, payments, reports, audit trail, and settings
- dark mode support
- basic accessibility utilities
- error handling primitives
- skeleton and empty state components

However, the product is still mostly a front-end prototype for the business workflows.

The biggest implementation gap is not styling, accessibility polish, or analytics. The biggest gap is that the core business modules still run on local seed data and component state instead of a real backend data model.

## Recommended next step

The next implementation phase should be:

**Build the real application data foundation and connect the core modules to Supabase.**

That means:

1. define the production database schema
2. add Supabase migrations and typed tables
3. create query/mutation hooks for core entities
4. replace local seed arrays with persisted data
5. wire audit logging, settings persistence, and reports to real records

Until that foundation exists, later roadmap items like advanced filters, notifications, analytics, and performance optimization will sit on top of mock workflows.

---

## What The Current Docs Get Right

Both root docs correctly identify important areas:

- accessibility and WCAG hardening
- better error handling and validation
- loading and empty states
- notification center
- advanced search/filter UX
- i18n and currency formatting
- performance work such as code splitting
- monitoring and analytics

These are still valid goals.

---

## Where The Current Docs Are Stale

### 1. Product naming is outdated

Both docs still use an outdated product name instead of `moniger.net`.

### 2. Some roadmap items are already implemented

These are already present in the codebase in some form:

- `ErrorProvider`, `ErrorBoundary`, and `ErrorList`
- dark mode toggle and persistence
- skeleton loading component
- empty state component
- keyboard-friendly sidebar navigation
- Playwright and Vitest setup scaffolding

### 3. The docs over-focus on UX polish before data foundations

The roadmap assumes the app is ready for enhancement work like advanced filtering and analytics, but the business modules are still mostly local-state demos.

### 4. The roadmap does not reflect the current backend reality

Current backend state:

- Supabase auth is wired
- Supabase database types contain no tables
- `supabase/config.toml` exists, but there are no actual migrations for domain entities
- no CRUD repository layer exists for invoices, bills, vendors, customers, payments, notifications, or audit logs

---

## Current Implementation Status

## Done Or Mostly Done

### Application shell

- routing and protected routes
- authenticated app layout
- landing page and marketing pages
- header, sidebar, settings shell, reports shell

### Auth foundation

- sign up
- sign in
- sign out
- session listener via Supabase auth

### UI system

- reusable UI primitives
- empty state component
- skeleton component
- theme provider and dark mode toggle
- animation and responsive design groundwork

### Error and accessibility utilities

- error boundary component
- toast-based error list
- validation utilities
- accessibility helpers and ARIA helpers

---

## Partially Implemented

### Accessibility

There is good groundwork, but not full compliance:

- many icon buttons have `aria-label`
- sidebar supports arrow navigation
- form accessibility helpers exist
- not all forms are wired to field-level error messaging
- no evidence of a completed WCAG audit
- no screen-reader or axe automation coverage

### Loading and empty states

- dashboard uses skeleton states
- `DataPage` uses empty states
- most pages still do not fetch real async data, so loading behavior is simulated rather than real

### Settings

- profile, business, team, and notification tabs exist
- settings are local state only
- no persistence to backend
- no session management
- no 2FA/MFA setup
- no export/privacy tools

### Reporting

- report UI and charts exist
- report data is static
- exports are placeholders

### Testing

- Playwright config exists
- Vitest config exists
- only a trivial example unit test is present
- no real E2E coverage for core workflows

---

## Not Implemented Yet

### Core domain persistence

Not implemented for:

- businesses/workspaces
- user profiles
- customers
- vendors
- invoices
- invoice line items
- bills
- payments
- reports
- audit trail persistence
- notifications

### Data access layer

Missing or not yet used:

- React Query hooks for entities
- mutation flows
- query invalidation strategy
- optimistic updates
- server error recovery patterns on real network requests

### Enterprise workflow features

Still missing:

- advanced filters
- saved filter presets
- command palette or global search
- bulk actions
- notification center
- downloadable reports
- payment scheduling workflow backed by persisted data
- invoice send/delivery workflow
- file export/PDF generation

### Internationalization and formatting architecture

Still missing:

- i18n package setup
- translation files
- locale-aware date formatting layer
- centralized currency formatting utility adoption

### Monitoring and analytics

Still missing:

- Sentry
- Mixpanel or Amplitude
- web vitals tracking
- usage event tracking

### Performance architecture

Still missing:

- route-based code splitting
- bundle splitting strategy
- image optimization plan
- caching layer for server data

---

## Why The Data Layer Should Be Next

At the moment, the business pages look finished but behave like isolated local demos:

- invoices are created only in component state
- bills are created only in component state
- vendors and customers are stored only in memory
- reports and payments are static arrays
- audit trail is static text
- settings changes do not persist

This means the app cannot yet support:

- multi-device continuity
- real user workspaces
- auditability
- reporting accuracy
- notifications
- export correctness
- realistic QA

Because of that, the next implementation phase should focus on turning moniger.net into a real data-backed application before adding more enhancement layers.

---

## Recommended Implementation Sequence

## Phase A: Data Foundation

### Goal

Create the minimum production data model for the authenticated app.

### Deliverables

- Supabase migrations for core tables
- generated Supabase types with real tables
- row-level security policies
- base seed/dev fixtures for local testing

### Suggested tables

- `profiles`
- `businesses`
- `business_members`
- `customers`
- `vendors`
- `invoices`
- `invoice_items`
- `bills`
- `payments`
- `audit_logs`
- `notification_preferences`
- `notifications`

### Notes

- decide whether moniger.net is single-business-per-user or multi-workspace
- add ownership and membership rules before CRUD work begins

---

## Phase B: App Data Access Layer

### Goal

Move all business pages from local state to shared data services.

### Deliverables

- entity-level query hooks
- entity-level mutation hooks
- reusable error handling wrappers for network operations
- invalidation strategy for related records

### Suggested structure

- `src/features/invoices/api/*`
- `src/features/bills/api/*`
- `src/features/vendors/api/*`
- `src/features/customers/api/*`
- `src/features/payments/api/*`
- `src/features/settings/api/*`

### First entities to wire

1. customers
2. vendors
3. invoices
4. bills
5. payments

This order reduces blockers because invoices and bills depend on customers and vendors.

---

## Phase C: Replace Seed-Driven Screens

### Goal

Convert current pages into real CRUD workflows.

### Deliverables

- list pages backed by queries
- create/edit/delete flows
- loading states driven by real requests
- empty states driven by real zero-data scenarios
- form validation connected to actual submission logic

### Priority order

1. Vendors
2. Customers
3. Invoices
4. Bills
5. Payments
6. Reports
7. Audit Trail

---

## Phase D: Persistence For Settings And Business Identity

### Goal

Make profile and business settings real.

### Deliverables

- profile persistence
- business metadata persistence
- invite/member management persistence
- notification preference persistence

### After this phase

The app begins to behave like a real workspace product rather than a front-end shell.

---

## Phase E: Workflow Enhancements

Only after Phases A-D are in place should the roadmap continue heavily into:

- advanced filters
- bulk actions
- command/search UX
- notification center
- export features
- report generation
- analytics
- performance optimization

---

## Suggested Immediate Sprint Plan

## Sprint 1

- rename docs from outdated product references to `moniger.net`
- document the actual architecture in `README.md`
- design and implement Supabase schema
- generate typed database definitions
- create `profiles`, `businesses`, `customers`, and `vendors`
- connect settings/profile/business pages to backend

## Sprint 2

- implement customer and vendor list/create/update/delete with React Query
- replace seed data usage in customer and vendor pages
- add form validation using existing validation utilities
- add real error recovery to mutations

## Sprint 3

- implement invoices and invoice items
- implement bills
- connect reports and dashboard summaries to real queries
- persist audit log events for key actions

---

## Documented Risks

### 1. False sense of completeness

The UI looks much more finished than the underlying product behavior actually is.

### 2. Roadmap sequencing risk

If the team spends the next cycle on accessibility polish, analytics, or advanced filters before the domain data layer exists, velocity may feel high but production value will remain low.

### 3. Testing risk

Meaningful E2E and integration testing will remain weak until core modules use real backend data.

### 4. Schema risk

If business/workspace ownership is not defined early, later entity work will be harder to secure with RLS.

---

## Recommended Source Of Truth Going Forward

Use this document as the current implementation reality check.

Keep the existing docs as reference material:

- `ENTERPRISE_DESIGN_GUIDE.md` for quality standards
- `docs/IMPLEMENTATION_ROADMAP.md` for enhancement ideas

But use a refreshed moniger.net roadmap for execution planning after the data foundation is in place.

---

## Final Recommendation

If only one thing is chosen next, it should be:

**Implement the real Supabase-backed domain model and migrate the core business pages off seed data.**

That is the highest-leverage step because it unlocks:

- real CRUD workflows
- trustworthy reports
- real audit trails
- notification infrastructure
- production QA
- analytics worth measuring
- performance work on real data flows
