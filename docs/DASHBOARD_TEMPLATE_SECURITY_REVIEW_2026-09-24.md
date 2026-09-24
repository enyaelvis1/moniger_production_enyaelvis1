# Dashboard Template Security Review — 2026-09-24

## Scope

Two public shadcn/ui dashboard repositories were cloned into a temporary directory for review only. No template source, authentication code, database adapter, or environment file was copied into Moniger.

Moniger is a Vite + React 18 + React Router 6 + Tailwind 3 + Supabase application. The review therefore treats these repositories as visual/component references, not drop-in application replacements.

## Candidates

### [`satnaing/shadcn-admin`](https://github.com/satnaing/shadcn-admin)

- License: MIT; retain the copyright/license notice if source code is copied.
- Strengths: mature responsive shell, collapsible sidebar, accessible navigation patterns, dashboard cards, tables, command palette, and settings layouts.
- Compatibility concerns: React 19, Vite, Tailwind 4, TanStack Router, Zustand, and Clerk are materially different from Moniger.
- Security finding: its demo auth store persists a demo access token in a cookie (`src/stores/auth-store.ts`). This must not be copied into Moniger. Moniger must continue using Supabase Auth and per-tab session storage.
- Data behavior: dashboard data is demo/application-local; it does not prove Supabase RLS or workspace isolation.

### [`SmitParekh84/shadcn-dashboard`](https://github.com/SmitParekh84/shadcn-dashboard)

- License: no license file was present in the shallow clone; do not copy source code until licensing is confirmed upstream.
- Strengths: finance-oriented KPI cards, charts, activity feed, responsive sidebar, and a clean shadcn visual language.
- Compatibility concerns: Next.js 15, React 19, Tailwind 4, and a server-oriented data-provider abstraction do not match Moniger’s Vite client architecture.
- Security finding: the README documents a `SUPABASE_SERVICE_ROLE_KEY` for a server adapter. That key must never be exposed in a Vite browser bundle or copied into Moniger’s client environment.
- Data behavior: mock data is the default and analytics adapters contain sample-data fallbacks; this cannot be used as evidence for real workspace-scoped reporting.

## Decision

Use the mature `satnaing/shadcn-admin` patterns for the admin shell and the finance-oriented KPI/chart composition from `SmitParekh84/shadcn-dashboard` as design inspiration only. Implement the visual layer with Moniger’s existing shadcn primitives, Supabase hooks, React Router routes, and authorization boundaries.

Do not clone either application into the production source tree. Do not import their auth stores, route definitions, mock providers, server adapters, service-role configuration, or persisted demo tokens.

## Required integration safeguards

- Preserve existing Supabase Auth, RLS, workspace selection, subscription gates, request timeouts, and admin Edge Function authorization.
- Keep all dashboard queries keyed and scoped by the selected workspace/business ID.
- Keep admin data behind the existing admin route and Edge Function authorization; visual changes must not broaden access.
- Use existing chart/table/card components or copy only isolated presentational markup after license review.
- Run typecheck, lint, build, unit tests, and browser smoke checks after integration.
