# Admin Console Implementation Phases

This document breaks the standalone Moniger operator console into delivery phases so the work stays reviewable, secure, and isolated from the regular business-user app.

Use `docs/admin-console/STATUS_TRACKER.md` as the live implementation tracker for current status, remaining work, test instructions, and branch workflow requirements. This phases document remains the delivery outline.

## Guardrails

- Build on `feature/admin-platform-console`, based on `dev`.
- Keep `/admin/*` separate from the regular app shell and navigation.
- Do not expose the Supabase service role key in client code.
- Route all cross-workspace admin reads and writes through Edge Functions.
- Extend the existing `audit_logs` table usage instead of changing its schema.

## Phase 1: Access And Shell Foundation

Deliverables:

- Add a dedicated `/admin/*` app entry in the router.
- Create a standalone admin shell with its own sidebar, header, breadcrumbs, and mobile drawer.
- Create `AdminRoute` to block unauthenticated and non-admin users.
- Add admin inactivity tracking with a warning before forced sign-out.

Validation:

- `/admin` is never linked from the regular app.
- A signed-out visitor is redirected to `/login`.
- A non-admin user is blocked from admin pages.

## Phase 2: Admin Data Security

Deliverables:

- Create `admin_users`, `announcements`, `platform_config`, and `platform_health_checks`.
- Enable RLS and restrict direct reads and writes to admin users only.
- Add admin helper SQL functions and audit helpers where needed.
- Create a secure admin Edge Function surface for platform-wide reads and writes.

Validation:

- No client-side code uses service-role credentials.
- Platform-wide admin data loads through Edge Functions only.

## Phase 3: Overview And Business Operations

Deliverables:

- Build `/admin` dashboard metrics, charts, signups, and health cards.
- Build `/admin/businesses` with search, filters, table, mobile cards, and detail panel.
- Add business actions such as suspend, notice, export, and impersonation entry points.

Validation:

- Demo business data loads into the detail panel.
- Business actions insert audit log entries.

## Phase 4: Users, Payments, Support, Audit

Deliverables:

- Build `/admin/users` with bulk actions and user controls.
- Build `/admin/payments` with platform-wide payment history and CSV export.
- Build `/admin/support` fast lookup and quick actions.
- Build `/admin/audit` with platform-wide filtering and admin-action highlighting.

Validation:

- Filters behave in real time.
- Failed payment and admin-action states are clearly visible.

## Phase 5: Announcements, Health, Settings

Deliverables:

- Build `/admin/announcements` with list, form, preview, and publish flows.
- Fan out published announcements to `notifications` for target users.
- Build `/admin/health` with live service checks, webhook log, and response-time chart.
- Build `/admin/settings` with admin users, platform config, and danger-zone actions.
- Add the `/admin/subscriptions` placeholder page with preview state.

Validation:

- Published announcements create notification records for the selected audience.
- Health data reflects real checks rather than hard-coded values.

## Phase 6: Final Verification

Checks:

- Run `npm run lint`
- Run `npm run test`
- Run `npm run build`
- Perform a security-focused self-review against the admin checklist in the task brief.

## Notes

- Where the brief contains conflicting redirect behavior for authenticated non-admin users, prefer keeping signed-out users on `/login` and redirecting authenticated non-admin users away from admin pages without exposing the admin shell.
- If a backend platform limitation blocks a requested behavior, keep the client contract secure first and document the gap explicitly before release.
