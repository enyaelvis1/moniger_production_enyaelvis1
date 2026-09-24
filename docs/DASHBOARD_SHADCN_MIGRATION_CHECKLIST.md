# Dashboard shadcn/ui Modernization Checklist

Working checklist for improving the Moniger workspace and admin dashboards with shadcn/ui patterns while preserving Supabase security, workspace isolation, billing behavior, and existing routes.

Reference audit: [Dashboard Template Security Review](./DASHBOARD_TEMPLATE_SECURITY_REVIEW_2026-09-24.md)

## Status key

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked or requires a decision

## Guardrails

- [x] Keep Moniger’s existing Supabase Auth and per-tab session storage.
- [x] Keep all workspace queries scoped to the selected workspace/business.
- [x] Keep admin authorization enforced by the existing admin route and Edge Function.
- [x] Do not copy demo auth stores, mock providers, service-role keys, or template routing.
- [ ] Do not change billing, entitlement, RLS, or payment callback behavior as part of visual work.
- [ ] Keep the implementation compatible with Vite, React 18, React Router 6, and Tailwind 3.

## 1. Design direction

- [x] Review relevant GitHub shadcn dashboard templates.
- [x] Scan candidate templates for licenses, secrets, demo authentication, mock data, and unsafe persistence.
- [x] Choose the admin visual reference: mature shadcn admin shell patterns.
- [x] Choose the workspace visual reference: finance KPI, chart, activity, and responsive card patterns.
- [x] Confirm Moniger brand tokens: primary blue, dark admin palette, spacing, radii, typography, and status colors already used by the existing shells.
- [ ] Decide whether the final dashboards should support light mode, dark mode, or both.
- [ ] Define the minimum dashboard information architecture before adding new widgets.

## 2. Shared shadcn foundation

- [x] Use the existing shadcn `Card` primitives for initial user and admin dashboard cards.
- [~] Standardize dashboard card composition with shadcn `Card` primitives; admin sections use `CardHeader`/`CardTitle`/`CardContent`, while user metric and workspace panels now share the same card surface language.
- [x] Standardize loading states with shadcn `Skeleton` components.
- [~] Standardize status labels with existing admin badges and workspace status treatments; a single cross-shell variant set remains to be completed.
- [ ] Standardize chart containers, tooltips, legends, and empty states.
- [ ] Confirm all interactive controls have keyboard focus states and accessible names.
- [ ] Confirm charts have nearby text summaries so information is not visual-only.

## 3. Workspace user dashboard

- [x] Preserve the current workspace-scoped dashboard data hooks.
- [x] Preserve existing onboarding, subscription, wallet, invoice, bill, activity, and collection data.
- [x] Convert summary metric cards to shadcn card primitives.
- [x] Refine the desktop dashboard hierarchy around:
  - [ ] workspace summary and plan state
  - [ ] receivables/payables KPIs
  - [ ] funding balance
  - [ ] due-this-week work queue
  - [ ] recent activity
  - [ ] confirmed collections
  - [ ] quick actions
- [ ] Add or refine a finance trend chart only when backed by real workspace-scoped data.
- [ ] Ensure empty, loading, error, and retry states are visually consistent.
- [ ] Ensure Starter users see useful upgrade messaging without paid data appearing.
- [ ] Ensure Growth and Business users see only the selected workspace’s data.
- [ ] Ensure workspace switching invalidates and refreshes all dashboard data.

## 4. Admin dashboard

- [x] Preserve the existing admin Edge Function data source and authorization.
- [x] Convert admin metric cards to shadcn card primitives.
- [x] Convert admin section cards to shadcn card primitives.
- [x] Refine the admin dashboard hierarchy around:
  - [ ] platform overview metrics
  - [ ] registrations trend
  - [ ] latest businesses
  - [ ] invoice volume
  - [ ] confirmed payments
  - [ ] failed webhook events
  - [ ] system health
- [ ] Add explicit test/live data labels wherever a chart or count can include test fixtures.
- [ ] Confirm admin tables and charts remain usable at tablet and mobile widths.
- [ ] Confirm admin pages never expose private workspace data to non-admin users.
- [ ] Confirm admin refresh and error states do not leave stale metrics presented as current.

## 5. Responsive and accessibility review

- [x] Review user dashboard at 1440×900 through the existing local UAT baseline.
- [x] Review user dashboard at 768×1024 through the existing local UAT baseline.
- [x] Review user dashboard at 390×844 through the existing local UAT baseline.
- [ ] Review admin dashboard at 1440×900 after the card integration.
- [ ] Review admin dashboard at 768×1024.
- [ ] Review admin dashboard at 390×844.
- [ ] Confirm no horizontal document overflow at any target viewport.
- [ ] Confirm sidebar collapse and mobile navigation remain usable.
- [ ] Confirm workspace selector remains visible and usable on mobile.
- [ ] Confirm tables use intentional horizontal scrolling where necessary.
- [ ] Run axe/accessibility smoke checks for both dashboard shells.
- [ ] Check color contrast, focus indicators, heading order, and button labels.

## 6. Security and data integrity

- [ ] Confirm no service-role key or private provider credential enters client code.
- [ ] Confirm no dashboard widget uses mock data in production mode.
- [ ] Confirm every user-dashboard query includes the selected workspace/business scope.
- [ ] Confirm every admin query remains behind admin authorization.
- [ ] Confirm changing a workspace ID in the browser cannot access another workspace’s data.
- [ ] Confirm dashboard caches are keyed by workspace/business ID and subscription context.
- [ ] Confirm delayed responses from a previous workspace cannot overwrite the current workspace.
- [ ] Confirm sign-out clears dashboard state and does not restore another user’s workspace.
- [ ] Run the release security verification before release consideration.

## 7. Regression tests

- [ ] Add user dashboard tests for loading, populated, empty, and error states.
- [ ] Add admin dashboard tests for loading, populated, empty, and error states.
- [ ] Add workspace-switch regression coverage for dashboard query invalidation.
- [ ] Add subscription-plan regression coverage for Starter, Growth, and Business display.
- [ ] Add a non-admin access regression test for admin dashboard routes.
- [ ] Add responsive browser coverage for overflow and mobile navigation.
- [ ] Add visual or screenshot evidence for the final dashboard layouts.

## 8. Verification before commit

- [ ] `npm run test -- --run`
- [ ] `npm run test:e2e`

## 9. Admin subscription cleanup

- [x] Add row selection and select-all-eligible controls to Admin → Management → Subscriptions.
- [x] Add a guarded Super Admin `Mark as test data` action for clearly identified QA/test workspaces and propagate the marker to linked cleanup records.
- [x] Add select-all-visible and bulk actions to Businesses, Banks, Categories, Public Content, and Announcements; Users, Payments, Receivables, and Payouts retain their existing bulk controls.
- [x] Label marked test subscriptions separately from protected live/provider-linked subscriptions.
- [x] Allow Super Admin bulk deletion only for marked, manual subscriptions without provider IDs.
- [x] Require a cleanup reason, exact typed confirmation, and an audit event.
- [x] Reset the related test workspace override after deletion; preserve live and provider-linked billing records.
- [ ] Run browser acceptance with a marked local test subscription and confirm protected rows cannot be selected or deleted.
- [!] Read-only operational views (Dashboard, Platform Metrics, Health Monitor, Support Lookup, Audit Log, and Signup Alerts) do not expose CRUD because their records are monitoring, evidence, or security history rather than editable business data.
- [ ] `npm exec tsc -- --noEmit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run verify:release:security`
- [ ] `git diff --check`
- [ ] Review changed files for accidental auth, billing, migration, or environment changes.

## 9. Documentation and release handoff

- [x] Record the template security findings in the dashboard template review.
- [ ] Add dated screenshots or browser evidence to the local UAT report.
- [ ] Update the client feedback checklist if dashboard behavior or navigation changes.
- [ ] Record known limitations and deferred widgets.
- [ ] Confirm the recommended branch base is `develop` before opening a PR.
- [ ] Do not push, deploy, apply remote migrations, or merge until review approval is obtained.

## Current starting point

- Initial shadcn card integration: complete.
- Template security audit: complete.
- User dashboard visual refinement: initial full visual pass complete; authenticated browser review pending.
- Admin dashboard visual refinement: initial full visual pass complete; authenticated browser review pending.
- Browser UAT for the new dashboard presentation: pending.

## Verification note — 2026-09-24

- Unit tests: 40 files / 154 tests passed.
- TypeScript check, lint, build, and `git diff --check` passed.
- Public responsive/smoke browser checks passed for the tested routes.
- The public contrast suite exposed existing animation-sensitive contrast findings on unrelated public pages; no dashboard-specific contrast failure was identified in this pass. Authenticated user/admin dashboard browser checks remain pending because Playwright credentials are not configured.
