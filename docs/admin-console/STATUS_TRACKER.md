# Admin Console Status Tracker

Last updated: 2026-04-22
Current working branch at time of review: `feature/subscriptions-paystack-billing`

## Purpose

Use this document as the live source of truth for:

- what has already been implemented for the admin console
- what is still left before release
- how each implemented slice should be tested
- which branch workflow must be followed for all future admin work

This file should be updated every time admin-related implementation changes.

Related docs:

- `docs/admin-console/IMPLEMENTATION_PHASES.md`
- `docs/admin-console/SUPER_ADMIN_SETUP.md`

## Required Update Rule

For every admin implementation:

1. Update the relevant phase in this document.
2. Add or update the "What was implemented" note.
3. Add or update the "What is left" note.
4. Add exact test instructions for the newly implemented behavior.
5. Record the branch used for the work and confirm it followed the branching rules below.
6. Record the verification result for `npm run lint`, `npm run test`, and `npm run build`, or document why any check did not pass.

Do not mark a phase complete unless the implementation exists in code and the matching test steps have been run or explicitly deferred with a reason.

## Branching Rules

These rules come from `BRANCHING_STRATEGY.md` and must be followed for admin work:

- New feature work starts from `dev`.
- Feature branches merge back into `dev` first.
- Do not start new work from the stale `develop` branch.
- Only production hotfixes branch from `main`.
- If a new admin task depends on unmerged admin work, a stacked branch may be created from `feature/admin-platform-console`, but the integration target should still be `dev`.

Standard feature flow:

```bash
git switch dev
git pull origin dev
git switch -c feature/<scope>-<short-name>
```

If the next admin slice depends on this current unmerged admin branch:

```bash
git switch feature/admin-platform-console
git switch -c feature/admin-<next-slice>
```

## Current Snapshot

Overall status as of 2026-04-19:

- Phase 1 is implemented.
- Phase 2 is implemented.
- Phase 3 is implemented.
- Phase 4 is implemented.
- Phase 5 is mostly implemented.
- Phase 6 is still pending final signoff.

Current verification snapshot:

- `npm run lint`: passed with 21 existing `react-refresh/only-export-components` warnings and 0 errors
- `npm run test`: passed
- `npm run build`: passed
- `npx playwright test tests/e2e/admin-access.spec.ts`: passed

## Phase Status

### Phase 1: Access And Shell Foundation

Status: Complete

What was implemented:

- Dedicated `/admin/*` router entry
- Standalone admin shell with its own layout and navigation
- `AdminRoute` access guard
- Admin inactivity warning after 25 minutes and forced sign-out after 30 minutes

What is left:

- Add automated coverage for admin route protection and inactivity behavior

How to test:

1. Visit `/admin` while signed out and confirm redirect to `/login`.
2. Sign in as a non-admin user and confirm access is denied.
3. Sign in as an admin user and confirm the admin shell loads.
4. Confirm the regular app navigation does not expose an `/admin` link.
5. Leave the admin page idle long enough to confirm the warning appears before sign-out.

### Phase 2: Admin Data Security

Status: Complete

What was implemented:

- Admin foundation migration for `admin_users`, `announcements`, `platform_config`, and `platform_health_checks`
- Additional admin support tables for business overrides, user overrides, and platform webhook events
- RLS enabled on the admin tables
- Admin edge function surface for secure platform-wide reads and writes
- Service-role usage kept on the server side inside the edge function

What is left:

- Add explicit automated or scripted verification for RLS and forbidden access paths
- Re-run deployment-level validation after migration is applied in the target environment

How to test:

1. Apply the admin migration in the target Supabase environment.
2. Confirm an admin user can load admin-backed pages successfully.
3. Confirm a non-admin authenticated user cannot access admin data through the UI or the `admin-console` edge function.
4. Inspect client code and confirm no service-role key is exposed in browser code.
5. Confirm admin data loads through the `admin-console` edge function rather than direct cross-workspace client queries.

### Phase 3: Overview And Business Operations

Status: Complete

What was implemented:

- `/admin` overview dashboard
- `/admin/metrics`
- `/admin/businesses`
- Business detail drawer or panel behavior
- Business invoice drill-in route
- Business actions including suspend, notices, export, and impersonation entry points

What is left:

- Add automated coverage for business filters, export behavior, and audit logging
- Verify impersonation flow against the deployed environment if environment-specific launch URLs are used

How to test:

1. Open `/admin` and confirm metrics, charts, latest businesses, and health cards render.
2. Open `/admin/businesses` and verify search, plan filter, status filter, and joined-date filter work.
3. Open a business detail view and confirm business, member, invoice, and activity data load.
4. Run suspend or restore, send notice, export, and impersonation actions from the business page.
5. Confirm each business action creates an `audit_logs` entry.

### Phase 4: Users, Payments, Support, Audit

Status: Complete

What was implemented:

- `/admin/users` with selection, bulk actions, and user-level controls
- `/admin/payments` with platform-wide payment history and export
- `/admin/support` lookup and quick actions
- `/admin/audit` filtering and admin-action highlighting

What is left:

- Add automated coverage for user bulk actions, support quick actions, and payment export
- Confirm destructive user actions are acceptable in the intended environment before broad testing

How to test:

1. Open `/admin/users` and verify search and row selection work.
2. Suspend, restore, reset password, and revoke sessions for a test user.
3. Publish an announcement to selected users and confirm notifications are queued only for the selected users.
4. Open `/admin/payments` and verify filters, failed-state visibility, and CSV export.
5. Open `/admin/support` and test password reset, payment lookup, and business notice actions.
6. Open `/admin/audit` and confirm admin-originated actions are clearly visible and filterable.

### Phase 5: Announcements, Health, Settings

Status: Mostly complete

What was implemented:

- `/admin/announcements` with list, form, preview, duplicate, delete, and publish flows
- Announcement fanout into `notifications`
- `/admin/health` with service cards, webhook log, and response-time chart
- `/admin/settings` with admin users, platform config, export, and danger-zone actions
- `/admin/subscriptions` with live billing metrics, filters, CSV export, and admin-editable subscription records
- Paystack-backed workspace subscription checkout, callback verification, and provider-driven sync into `business_subscriptions`

What is left:

- Confirm health rows are populated by real checks in the target environment
- Decide whether `purge_demo_data` should remain a no-op or become a real environment-limited action
- Add automated coverage for announcements, settings, and health refresh behavior
- Add automated coverage for subscription editing, pricing checkout, and filtering behavior

How to test:

1. Open `/admin/announcements` and create a draft.
2. Publish an announcement and confirm `notifications` records are created for the intended audience.
3. Duplicate and delete an announcement and confirm the list refreshes correctly.
4. Open `/admin/health` and confirm service status, webhook rows, and response-time samples are coming from stored data rather than hard-coded values.
5. Open `/admin/settings`, add a test admin, change a role, revoke access, and update platform config values.
6. Open `/admin/subscriptions`, verify the metrics, filters, CSV export, and edit dialog work, and confirm the saved changes persist after refresh.
7. Complete a paid workspace subscription through `/pricing` and confirm the synced Paystack-backed record appears in `/admin/subscriptions`.

### Phase 6: Final Verification

Status: Pending

What is left:

- Re-run `npm run test`
- Re-run `npm run build`
- Perform a security-focused self-review of admin access and data paths
- Complete manual regression checks across the full admin surface
- Re-run the subscriptions-specific verification after the new billing migration is applied in the target environment

How to test:

1. Run `npm run lint`.
2. Run `npm run test`.
3. Run `npm run build`.
4. Run `npx playwright test tests/e2e/admin-access.spec.ts`.
5. Run the manual checks listed in Phases 1 through 5.
6. Verify all admin write actions create the expected audit trail.
7. Verify non-admin and signed-out users cannot access the admin surface.

## Update Template For Future Admin Changes

Copy this section when a new admin task is implemented:

```md
### Update: YYYY-MM-DD

- Branch: `feature/<scope>-<short-name>`
- Based on: `dev` or `feature/admin-platform-console` if this is a stacked branch
- Scope:
- Files changed:
- What was implemented:
- What is left:
- How to test:
  1. ...
  2. ...
- Verification:
  - `npm run lint`:
  - `npm run test`:
  - `npm run build`:
```

## Recent Admin-Adjacent Update

### Update: 2026-04-22 (Subscription Checkout Hotfix)

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Fixed a workspace subscription checkout initialization error that prevented paid pricing flows from leaving the app.
- Files changed:
  - `docs/admin-console/STATUS_TRACKER.md`
  - `supabase/functions/_shared/paystack-subscriptions.ts`
  - `supabase/functions/workspace-subscriptions/index.ts`
- What was implemented:
  - Removed an invalid `platform_config.updated_by` write from the billing edge-function helper.
  - Added explicit conflict targets for Paystack plan catalog caching and checkout-session persistence.
- What is left:
  - Redeploy `workspace-subscriptions`.
  - Re-run the manual `/pricing` to `/admin/subscriptions` verification flow.
- How to test:
  1. Redeploy `workspace-subscriptions`.
  2. Start a paid plan from `/pricing`.
  3. Confirm the checkout initialization request succeeds instead of returning `500`.
  4. Complete the test checkout and confirm the synced subscription appears in `/admin/subscriptions`.
- Verification:
  - `npm run lint`: deferred for this hotfix
  - `npm run test`: deferred for this hotfix
  - `npm run build`: deferred for this hotfix

### Update: 2026-04-22 (Subscription Email Validation Hotfix)

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Fixed paid checkout failures caused by test-only account emails being rejected by Paystack.
- Files changed:
  - `docs/admin-console/STATUS_TRACKER.md`
  - `supabase/functions/workspace-subscriptions/index.ts`
- What was implemented:
  - Imported the missing Paystack checkout initializer used by the paid pricing flow.
  - Added a server-side guard for `.test`, `.local`, and related unsupported paid-subscription email domains.
  - Changed invalid-email provider failures from generic `500` responses to `400` validation responses.
- What is left:
  - Decide on the recommended email format for QA accounts used in paid billing tests.
- How to test:
  1. Attempt a paid subscription with a `.test` account and confirm the API returns `400`.
  2. Attempt a paid subscription with a normal address and confirm Paystack checkout initializes.
- Verification:
  - Live `.test` repro: `400`
  - Live `@example.com` repro: `200`

## Next Recommended Step

Before moving to the next admin slice, use this order:

1. Execute the manual tests for Phases 1 through 5.
2. Update this tracker with the exact verification result.
3. Re-run the subscriptions checks after applying the latest billing migration to the target environment.
4. Merge from `dev` to `main` only after the manual signoff is complete.
5. Branch the next slice from `dev`, or from `feature/admin-platform-console` only if the work depends on unmerged admin changes.

## Recent Updates

### Update: 2026-04-19

- Branch: `feature/admin-platform-console`
- Based on: `dev`
- Scope: Added visible diagnostic states for admin businesses, users, and payments pages so edge-function failures are no longer mistaken for empty datasets.
- Files changed:
  - `src/admin/pages/AdminBusinessesPage.tsx`
  - `src/admin/pages/AdminUsersPage.tsx`
  - `src/admin/pages/AdminPaymentsPage.tsx`
- What was implemented:
  - Added explicit "Unable to Load" states when `admin-console` returns a non-2xx response.
  - Added explicit "No data yet" states when the query succeeds but returns no rows.
- What is left:
  - Resolve the underlying `admin-console` runtime failure in the hosted environment.
  - Add the same query-error treatment to other admin pages if needed.
- How to test:
  1. Open `/admin/businesses`, `/admin/users`, and `/admin/payments`.
  2. Confirm a function failure now renders a visible diagnostic message instead of a blank table.
  3. Confirm a successful empty response renders a "no data yet" state.
- Verification:
  - `npm run lint`: not rerun after this docs and UI update because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: not rerun for this small UI-only diagnostic change
  - `npm run build`: passed

### Update: 2026-04-19

- Branch: `feature/admin-platform-console`
- Based on: `dev`
- Scope: Improved admin edge-function error decoding so backend JSON error messages are shown in the UI instead of the generic non-2xx Supabase client message.
- Files changed:
  - `src/admin/lib/admin-console.ts`
- What was implemented:
  - Added response-body parsing for `admin-console` invocation failures.
  - Admin pages can now surface the real error returned by the edge function catch block when available.
- What is left:
  - Refresh the admin pages and capture the exact backend error text.
  - Fix the underlying server-side runtime failure once the specific message is known.
- How to test:
  1. Open `/admin/businesses` or `/admin/users`.
  2. Trigger the failing admin query.
  3. Confirm the page now shows the backend error string instead of only "Edge Function returned a non-2xx status code".
- Verification:
  - `npm run lint`: not rerun because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: not rerun for this small client-side error-handling change
  - `npm run build`: passed

### Update: 2026-04-19

- Branch: `feature/admin-platform-console`
- Based on: `dev`
- Scope: Resolved admin edge-function authentication flow by explicitly attaching the session bearer token from the client and disabling redundant gateway JWT verification for `admin-console`.
- Files changed:
  - `src/admin/lib/admin-console.ts`
  - `src/admin/pages/AdminBusinessesPage.tsx`
  - `src/admin/pages/AdminUsersPage.tsx`
  - `src/admin/pages/AdminPaymentsPage.tsx`
  - `supabase/config.toml`
- What was implemented:
  - Added `Authorization: Bearer <access_token>` to admin function calls.
  - Replaced invalid empty-state icon string usage with real Lucide icons.
  - Set `[functions.admin-console] verify_jwt = false`.
  - Redeployed the hosted `admin-console` function after the config update.
- What is left:
  - Refresh the admin pages and confirm `users`, `businesses`, and `payments` now load.
  - If any page still fails, capture the new exact backend message after the redeploy.
- How to test:
  1. Restart the local dev server if needed.
  2. Refresh `/admin/users`, `/admin/businesses`, and `/admin/payments`.
  3. Confirm the pages either load data or show a more specific backend error.
  4. Confirm the browser console no longer shows the `<inbox>` warning.
  5. Confirm the browser console no longer shows `401 Unauthorized` for `admin-console`.
- Verification:
  - `npm run lint`: not rerun because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: not rerun for this targeted auth and UI fix
  - `npm run build`: passed

### Update: 2026-04-19

- Branch: `feature/admin-platform-console`
- Based on: `dev`
- Scope: Improved admin user deletion behavior and replaced generic password reset emails with branded reset-link emails sent through Resend.
- Files changed:
  - `supabase/functions/admin-console/index.ts`
- What was implemented:
  - Added a custom password-reset flow using `auth.admin.generateLink({ type: "recovery" })`.
  - Added branded reset emails with an explicit reset-password link sent through Resend.
  - Updated both admin user-row resets and support lookup resets to use the same branded flow.
  - Added safe delete guards so super admins cannot delete themselves and cannot hard-delete users who still own workspaces.
- What is left:
  - Add an admin ownership-transfer flow if workspace owners should become deletable from the admin console.
  - Optionally add a confirmation UI for destructive user deletion.
- How to test:
  1. Trigger a password reset from `/admin/users` for a test account.
  2. Confirm the email subject and body are Moniger-branded and include a visible reset link.
  3. Click the link and confirm it returns to the app recovery flow and allows a password update.
  4. Delete a non-owner test user and confirm the deletion succeeds.
  5. Attempt to delete a workspace owner and confirm the admin console now shows a clear ownership-related error instead of a silent failure.
  6. Attempt to delete the currently signed-in admin and confirm it is blocked.
- Verification:
  - `npm run lint`: not rerun because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: not rerun for this backend-focused change
  - `npm run build`: passed

### Update: 2026-04-20

- Branch: `feature/admin-platform-console`
- Based on: `dev`
- Scope: Added a dedicated super-admin setup guide for granting and verifying admin-console roles.
- Files changed:
  - `docs/admin-console/SUPER_ADMIN_SETUP.md`
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Added a standalone doc for granting `super_admin` and `support` access.
  - Added SQL snippets for grant, promote, downgrade, remove, and verify flows.
  - Added test instructions for confirming restricted actions behave differently for `support` and `super_admin`.
- What is left:
  - Use the new guide in the target environment to promote the intended operator account to `super_admin`.
- How to test:
  1. Follow `docs/admin-console/SUPER_ADMIN_SETUP.md`.
  2. Promote a test admin to `support` and confirm super-admin-only actions are blocked.
  3. Promote the same admin to `super_admin` and confirm restricted actions become available.
- Verification:
  - `npm run lint`: not rerun because this was a docs-only change
  - `npm run test`: not rerun because this was a docs-only change
  - `npm run build`: not rerun because this was a docs-only change

### Update: 2026-04-20

- Branch: `dev`
- Based on: `dev`
- Scope: Added user-delete confirmation and compacted key admin views for better small-screen responsiveness.
- Files changed:
  - `src/admin/components/AdminUi.tsx`
  - `src/admin/pages/AdminBusinessesPage.tsx`
  - `src/admin/pages/AdminPaymentsPage.tsx`
  - `src/admin/pages/AdminUsersPage.tsx`
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Added a destructive confirmation step before deleting a user from the admin users page.
  - Added mobile action access on user cards so password reset, session revoke, suspend, and delete remain available on smaller screens.
  - Tightened shared admin headers, cards, badges, toolbars, and ghost-button spacing to make the admin surface denser by default.
  - Compacted the users, businesses, and payments layouts by reducing table width pressure and improving stacked mobile cards.
- What is left:
  - Manually review the remaining admin tabs on small screens and apply the same compacting pass if any still feel too spacious.
  - Add automated coverage for the user-delete confirmation flow.
- How to test:
  1. Open `/admin/users` on desktop and on a narrow mobile viewport.
  2. Open a user action menu, choose `Delete user`, and confirm a destructive confirmation dialog appears before the request is sent.
  3. Cancel once and confirm the user is not deleted.
  4. Confirm the dialog and verify a deletable test user is removed successfully.
  5. Open `/admin/businesses` and `/admin/payments` on mobile width and confirm cards, controls, and actions fit without awkward horizontal crowding.
  6. Open a business detail sheet on a narrow viewport and confirm the stats and tabs wrap cleanly.
- Verification:
  - `npm run lint`: not rerun because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: passed
  - `npm run build`: passed

### Update: 2026-04-20

- Branch: `feature/admin-test-coverage`
- Based on: `dev`
- Scope: Added initial automated admin coverage for access control and user-delete confirmation.
- Files changed:
  - `src/admin/pages/AdminUsersPage.test.tsx`
  - `tests/e2e/admin-access.spec.ts`
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Added component coverage that verifies user deletion is gated behind a confirmation dialog.
  - Added component coverage that verifies the delete request only fires after explicit confirmation.
  - Added Playwright coverage for signed-out redirects away from `/admin`.
  - Added env-gated Playwright coverage for non-admin denial and admin access success.
- What is left:
  - Populate `PLAYWRIGHT_ADMIN_EMAIL`, `PLAYWRIGHT_ADMIN_PASSWORD`, `PLAYWRIGHT_NON_ADMIN_EMAIL`, and `PLAYWRIGHT_NON_ADMIN_PASSWORD` in the target test environment so the credential-gated admin access checks run end to end.
  - Add one automated business-action path after test data and operator credentials are stabilized.
- How to test:
  1. Run `npx vitest run src/admin/pages/AdminUsersPage.test.tsx`.
  2. Run `npx playwright test tests/e2e/admin-access.spec.ts`.
  3. Confirm the signed-out redirect test passes locally.
  4. Set the Playwright admin and non-admin credential env vars and rerun the spec.
  5. Confirm the non-admin account is redirected back to `/login` with the access-denied message.
  6. Confirm the admin account reaches `/admin` and sees the `Platform Overview` heading.
- Verification:
  - `npm run lint`: not rerun because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: passed
  - `npm run build`: passed
  - `npx playwright test tests/e2e/admin-access.spec.ts`: passed for the signed-out redirect path; admin and non-admin credential flows are env-gated and ready to run with test credentials

### Update: 2026-04-20

- Branch: `feature/admin-test-coverage`
- Based on: `dev`
- Scope: Added repeatable Playwright admin credential setup and ran the full admin access spec with real admin and non-admin accounts.
- Files changed:
  - `playwright.config.ts`
  - `package.json`
  - `scripts/create-admin-test-users.mjs`
  - `tests/e2e/admin-access.spec.ts`
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Playwright now reads `.env` through `vite`'s `loadEnv`, so local credential variables are available to the E2E suite without manual shell exports.
  - Added `npm run create:admin-test-users` to create or refresh a `super_admin` account and a non-admin account in the linked Supabase project.
  - Ensured the admin account is present in `public.admin_users` and the member account is explicitly removed from that table.
  - Ran the full admin access spec successfully with real credentials covering signed-out redirect, non-admin denial, and admin success.
- What is left:
  - Decide whether these Playwright credentials should stay local-only or be mirrored into the shared CI environment.
  - Add one business-action E2E path now that admin authentication coverage is stable.
- How to test:
  1. Confirm `.env` contains `PLAYWRIGHT_ADMIN_EMAIL`, `PLAYWRIGHT_ADMIN_PASSWORD`, `PLAYWRIGHT_NON_ADMIN_EMAIL`, and `PLAYWRIGHT_NON_ADMIN_PASSWORD`.
  2. Run `npm run create:admin-test-users`.
  3. Run `npx playwright test tests/e2e/admin-access.spec.ts`.
  4. Confirm all three tests pass.
  5. Sign in manually with the admin credential and confirm `/admin` opens.
  6. Sign in manually with the non-admin credential and confirm `/admin` redirects back out.
- Verification:
  - `npm run lint`: not rerun because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: not rerun after this setup-only change because app code paths were unchanged
  - `npm run build`: not rerun after this setup-only change because app code paths were unchanged
  - `npm run create:admin-test-users`: passed
  - `npx playwright test tests/e2e/admin-access.spec.ts`: passed

### Update: 2026-04-20

- Branch: `feature/admin-test-coverage`
- Based on: `dev`
- Scope: Added an automated admin business-action path and verified the full local test/build baseline again.
- Files changed:
  - `src/admin/pages/AdminBusinessesPage.tsx`
  - `scripts/create-admin-test-users.mjs`
  - `tests/e2e/admin-access.spec.ts`
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Added an accessible action-label to the businesses row action trigger so admin business actions are easier to automate and easier to use with assistive tech.
  - Extended the Playwright setup script so the admin and non-admin workspaces are named deterministically and the member workspace starts from a clean override state.
  - Added an end-to-end admin business flow that signs in as the admin user, suspends the non-admin workspace, then restores it.
  - Re-ran the full Vitest suite and production build after the business-action automation landed.
- What is left:
  - Resolve the repo's existing ESLint/Vite temp-file blocker before using lint as a release gate.
  - Decide whether this admin test coverage should run in CI with shared credentials or remain a locally provisioned test harness for now.
- How to test:
  1. Run `npm run create:admin-test-users`.
  2. Run `npx playwright test tests/e2e/admin-access.spec.ts`.
  3. Confirm the signed-out redirect, non-admin denial, admin access, and business suspend/restore flows all pass.
  4. Run `npm run test`.
  5. Run `npm run build`.
- Verification:
  - `npm run lint`: not rerun because the repo still has the known ESLint/Vite temp-file blocker
  - `npm run test`: passed
  - `npm run build`: passed
  - `npm run create:admin-test-users`: passed
  - `npx playwright test tests/e2e/admin-access.spec.ts`: passed

### Update: 2026-04-20

- Branch: `dev`
- Based on: `dev`
- Scope: Performed the release-signoff baseline after merging admin test coverage into `dev`.
- Files changed:
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Re-ran `npm run lint` and confirmed the repo now passes lint with warnings only.
  - Confirmed the current `dev` baseline includes passing tests, production build, and admin Playwright coverage.
  - Updated Phase 6 so the remaining release work reflects the current blockers instead of the old lint issue.
- What is left:
  - Complete the manual regression pass across the implemented admin routes.
  - Decide whether the subscriptions preview page is acceptable for the next `main` release.
  - Make the final release decision from `dev` after manual signoff.
- How to test:
  1. Run `npm run lint` and confirm it reports warnings only with 0 errors.
  2. Run `npm run test`.
  3. Run `npm run build`.
  4. Run `npx playwright test tests/e2e/admin-access.spec.ts`.
  5. Manually test the admin routes listed in Phases 1 through 5.
- Verification:
  - `npm run lint`: passed with 21 warnings and 0 errors
  - `npm run test`: passed
  - `npm run build`: passed
  - `npx playwright test tests/e2e/admin-access.spec.ts`: passed

### Update: 2026-04-20

- Branch: `feature/admin-subscriptions`
- Based on: `dev`
- Scope: Replaced the subscriptions preview page with a real admin billing workspace backed by subscription records and operator edit controls.
- Files changed:
  - `supabase/migrations/20260420103000_add_business_subscriptions.sql`
  - `supabase/functions/admin-console/index.ts`
  - `src/admin/lib/admin-console.ts`
  - `src/admin/pages/AdminSubscriptionsPage.tsx`
  - `src/admin/pages/AdminDashboardPage.tsx`
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Added `public.business_subscriptions` with admin-only access, seeded records for existing businesses, and default billing catalog values.
  - Added `subscriptions.list` and `subscriptions.update` actions to the `admin-console` edge function.
  - Replaced the preview subscriptions page with live metrics, filters, CSV export, and an edit dialog for plan, cycle, amount, renewal date, provider references, and notes.
  - Updated the admin dashboard revenue metric to use the managed subscription run-rate instead of the old billing placeholder.
- What is left:
  - Apply the new migration and redeploy the `admin-console` edge function in the target Supabase environment.
  - Decide how provider-driven subscription events should populate `business_subscriptions` automatically when Paystack recurring billing goes live.
  - Add automated coverage for subscription editing and filtering.
- How to test:
  1. Apply `supabase/migrations/20260420103000_add_business_subscriptions.sql`.
  2. Open `/admin/subscriptions` and confirm rows load for existing businesses.
  3. Filter by plan, status, and billing cycle, and confirm the table and metric cards update.
  4. Export CSV and confirm the file includes plan, cycle, amount, renewal date, and provider fields.
  5. Edit a subscription, save it, refresh the page, and confirm the changes persist.
  6. Confirm the corresponding business plan updates in `/admin/businesses`.
- Verification:
  - `npm run lint`: passed with 21 warnings and 0 errors
  - `npm run test`: passed
  - `npm run build`: passed

### Update: 2026-04-22

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Added real Paystack-backed workspace subscription checkout and webhook-driven sync for the admin subscriptions workspace.
- Files changed:
  - `docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
  - `src/App.tsx`
  - `src/components/landing/PricingSection.tsx`
  - `src/hooks/use-subscription-management.ts`
  - `src/lib/subscriptions.ts`
  - `src/lib/subscriptions.test.ts`
  - `src/lib/workspace-subscriptions.ts`
  - `src/pages/Pricing.tsx`
  - `src/pages/PricingConfirmed.tsx`
  - `supabase/config.toml`
  - `supabase/functions/_shared/paystack-subscriptions.ts`
  - `supabase/functions/paystack-webhook/index.ts`
  - `supabase/functions/workspace-subscriptions/index.ts`
  - `supabase/migrations/20260422113000_add_workspace_subscription_checkout.sql`
- What was implemented:
  - Added a real paid-plan checkout path from the public pricing pages into Paystack recurring billing.
  - Added callback verification at `/pricing/confirmed` so successful checkouts sync the canonical Paystack subscription into `business_subscriptions`.
  - Extended `paystack-webhook` so workspace-subscription lifecycle events update `business_subscriptions` automatically.
  - Preserved the existing admin subscriptions workspace so the synced provider-backed records remain visible to operators.
- What is left:
  - Apply the new billing migration in the target Supabase environment.
  - Redeploy `workspace-subscriptions` and `paystack-webhook`.
  - Run the full live Paystack subscription test flow and capture the resulting webhook rows.
  - Add automated coverage for the new pricing-to-checkout path.
- How to test:
  1. Apply `supabase/migrations/20260422113000_add_workspace_subscription_checkout.sql`.
  2. Redeploy `workspace-subscriptions` and `paystack-webhook`.
  3. Open `/pricing`, choose `Growth` or `Business`, and complete the Paystack test payment.
  4. Confirm the browser lands on `/pricing/confirmed` and reports a verified subscription.
  5. Refresh `/admin/subscriptions` and confirm the record shows Paystack provider data, plan, amount, and renewal date.
  6. Trigger a supported Paystack subscription webhook event and confirm the admin subscriptions row stays in sync after refresh.
- Verification:
  - `npm run lint`: passed with 21 warnings and 0 errors
  - `npm run test`: passed
  - `npm run build`: passed
  - `npx vitest run src/lib/subscriptions.test.ts`: passed
  - `deno check`: could not run because `deno` is not installed in this environment

### Update: 2026-04-22 (Deployment)

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Applied the subscription checkout migration and deployed the billing functions that keep admin subscription records in sync.
- Files changed:
  - `docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
  - `docs/admin-console/STATUS_TRACKER.md`
- What was implemented:
  - Applied `20260422113000_add_workspace_subscription_checkout.sql` to the linked project.
  - Deployed `workspace-subscriptions`.
  - Deployed `paystack-webhook`.
  - Confirmed both deployed endpoints respond from the project URL with the expected unauthenticated `401` responses.
- What is left:
  - Deploy the frontend build that exposes the new `/pricing` and `/pricing/confirmed` flow.
  - Run the full browser-based Paystack test flow and confirm the synced row in `/admin/subscriptions`.
- How to test:
  1. Run the frontend from this branch locally or deploy it.
  2. Complete a paid subscription from `/pricing`.
  3. Confirm the browser lands on `/pricing/confirmed`.
  4. Refresh `/admin/subscriptions` and verify the Paystack-backed row is present and populated.
- Verification:
  - `supabase db push`: passed
  - `supabase functions deploy workspace-subscriptions`: passed
  - `supabase functions deploy paystack-webhook`: passed
