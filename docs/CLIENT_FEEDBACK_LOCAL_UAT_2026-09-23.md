# Client Feedback Local UAT — 2026-09-24

Local acceptance evidence for `fix/moniger-client-feedback-22`. This is not production approval. All fixtures below were created against the local Supabase instance at `127.0.0.1:54321`; credentials are intentionally excluded.

## Environment

- Frontend: `http://localhost:8080`
- Supabase API: local `127.0.0.1:54321`
- Mail capture: local Mailpit, no external delivery used
- Branch: `fix/moniger-client-feedback-22`
- Base: `develop`
- Viewports inspected: 1440×900, 768×1024, 390×844
- Provider checkout: Paystack TEST checkout completed for fresh Business registration; Starter control completed without checkout

## Disposable fixture manifest

These fixtures are synthetic, marked local test data, and remain available for review. The three existing named Moniger businesses were not changed.

| Fixture | User ID | Business ID | Plan | Purpose |
|---|---|---|---|---|
| Company A / Starter | `0a3e7a98-d3ac-4646-a9e8-9442b6d6dc7c` | `67074531-1fc9-4bab-b7b7-6b814a7efdba` | Starter | ordinary member isolation and Starter gating |
| Company B / Growth | `3f5561df-2092-4028-8d82-ec6547fa5a2a` | `204be282-dd48-4d31-ae16-7cd1287b6597` | Growth | ordinary member isolation and paid-plan rendering |
| Company C / Business | `d6e831de-6038-4cae-944c-3ecd1a1e3082` | `074d6d7e-bd1d-490b-b49e-c46d79ef34b9` | Business | Business rendering and multi-membership authorization |
| Local admin | `9bf165bf-fe96-4130-aa9b-b0cc5a44d656` | `50e355a2-84a1-4412-9a71-7b5d910f9434` | Starter | explicit admin access check |

User C was added as a viewer to Companies A and B. Each plan workspace received synthetic customers, vendors, invoices, bills, a pending receivable payment, and an active seeded subscription.

## Case matrix

| Case | Result | Evidence |
|---|---|---|
| 22A Vendor/Business phone UI filtering | Pass | Browser input removed letters and `/`; database rejected malformed direct writes with `22023`; formatted `0801 234 5678` persisted as `+2348012345678`. |
| 22B Growth status display | Pass locally | Growth browser session showed `Workspace plan: Growth` after refresh on Settings; Payments and Reports rendered populated content. |
| 22B Business status display | Pass locally | Business browser session showed `Workspace plan: Business`; Dashboard, Payments, Reports, and Audit Trail rendered. |
| 22C A→B reads | Pass | User A saw only Company A rows; direct foreign detail reads returned no rows. |
| 22C B→A reads | Pass | User B saw only Company B rows; direct foreign detail reads returned no rows. |
| 22C forged writes | Pass | Foreign workspace inserts returned `42501`; parent workspace changes and foreign linked invoice inserts returned `23514`; no unauthorized rows were created. |
| 22C legitimate write/delete | Pass | A and B created and deleted a synthetic same-workspace customer; post-delete lookup returned no row. |
| 22C User C authorized membership | Pass | User C could read rows from Companies A, B, and C through the real local API session. |
| 22C UI workspace switching | Pass locally | Fresh Business user was given a second local-only Growth membership. Sidebar selector switched Business ↔ Growth repeatedly, changed the dashboard activity/plan context, survived refresh, and restored the selected workspace after sign-out/sign-in. |
| 22D Starter access gating | Pass locally | Starter Reports displayed the upgrade prompt and did not render paid reports. |
| 22D Growth/Business access | Pass locally | Growth and Business rendered their protected workspace pages with their seeded active subscriptions. |
| 22E loading/error recovery | Pass locally | Dashboard, Payments, Reports, Audit Trail rendered data or an explicit state; no permanent spinner was observed. |
| Default timeout | Pass after fix | Fresh browser with no stored preference displayed `20 minutes`; the missing-value bug was fixed and unit-tested. |
| Admin access | Pass locally | Local Super Admin opened `/admin/settings`; ordinary User A was redirected to `/dashboard`. |
| Visual inspection | Pass with notes | Desktop, tablet, and mobile states were inspected. Settings tabs, mobile workspace switching, and tablet header overflow were fixed and retested; console only had existing React Router warnings after fixes. See the dated UI observation register. |
| Provider checkout | Pass locally | Fresh Business registration opened Paystack TEST automatically at NGN 89,000, returned directly to `/dashboard`, and Settings showed Business after refresh and re-login. |
| Cleanup/deletion | Not run | No broad cleanup and no existing business/account deletion was authorized or performed. |

## Observation register

| ID | Screen/case | Observation | Severity | Status / retest |
|---|---|---|---|---|
| OBS-001 | Settings → Business Phone | Chromium rejected `[+0-9 ()-]+` as an invalid Unicode-regex pattern. | Medium | Fixed in `Settings.tsx` and `Vendors.tsx` by escaping `-`; reload produced 0 console errors. |
| OBS-002 | Settings → Security | Missing local timeout storage was converted with `Number(null)` and clamped to 1 minute. | High | Fixed in `SessionTimeoutContext.tsx`; fresh browser and unit test now show 20 minutes. |
| OBS-003 | Multi-workspace User C | The app previously had no visible workspace selector and settings chose one membership. | High / product capability | Fixed locally with a user-scoped selector, settings query scoping, persistence, and regression tests. |
| OBS-004 | Browser console | React Router future-flag warnings remain. | Low / baseline | Not introduced by this task; no application errors remained in retested flows. |
| OBS-005 | Route transitions | Suspense and protected-route transitions used different full-page loader implementations, creating a visible loader handoff risk. | Medium | Fixed in `App.tsx` by using the shared `RouteLoadingScreen` for both transitions; landing-page `fetchPriority` warning also removed from `HeroSection.tsx`. |

### Follow-up browser UAT — 2026-09-23

- Paid Growth registration was completed through the real local UI using a disposable `example.com` address and Paystack TEST checkout.
- Checkout opened automatically after account/workspace creation for `Growth` at `NGN 29,000`.
- On the configured `http://localhost:8080` origin, the successful Paystack return went directly to `/dashboard` with no pricing detour.
- Dashboard showed the new workspace and subscription activity; Settings → Personal Information showed `Growth`, `Active`, monthly billing, and a renewal date.
- Payments, Reports, Audit Trail, and Workspace Settings rendered successfully after navigation; no application console errors were observed. Existing React Router future-flag warnings remain.
- A separate run from `127.0.0.1:8080` correctly exposed a local-origin mismatch: the callback is configured for `localhost:8080`, so per-tab session storage was not available on the different host. Local UAT must use the configured host.
- The `.test` paid-signup attempt was rejected by the intended Paystack email-domain guard before checkout; it did not create a paid checkout.
- The UI-created disposable signup accounts/workspaces remain only in local Supabase for review; no production accounts or data were changed.
- Screenshots are retained as ignored local artifacts under `output/playwright/phase2-local/`; no credentials or tokens are stored in the repository.

### Final pre-PR browser UAT — 2026-09-24

- Fresh Business registration selected Business, opened Paystack TEST automatically, completed the NGN 89,000 success flow, returned directly to `/dashboard`, and showed Business/active in Settings. Hard refresh and sign-out/sign-in preserved Business. The account was not an admin, so Admin subscription UI was not exercised in this browser account; local database state and dashboard subscription activity matched Business.
- Fresh Starter registration selected Starter, did not open Paystack, redirected directly to `/dashboard`, remained Starter after refresh and sign-out/sign-in, and showed the Reports upgrade gate.
- Multi-workspace selector: the Business disposable user received a second local-only viewer membership in `UAT Growth 20260923 D`. The sidebar selector showed both workspaces; switching changed the selected workspace and Growth/Business subscription context without stale dashboard activity. The selection survived refresh and re-login.
- Delayed provider response: added a regression test covering two retryable provider responses followed by successful verification; the page remained in a retryable verification state and redirected only after the successful result.
- Signed-out confirmation: `/pricing/confirmed` exposed only public checkout status/reference messaging and sign-in/pricing actions; no workspace name or private billing details were exposed. An invalid reference produced a safe non-private error state.
- Loading behavior: Dashboard, Payments, Reports, Audit Trail, and Settings resolved during the Business, Starter, and workspace-switch flows. No duplicate full-page spinner or redirect loop was observed. Local browser console contained only existing React Router warnings plus transient local Supabase signup-alert/registration service errors during the Starter run; the account creation and dashboard flow still completed.

### Continuous UI/UX review — 2026-09-24

- Reviewed the required screens and states at 1440×900, 768×1024, and 390×844 using Chromium and sanitized local-only fixtures.
- Fixed UI-001 (Settings tab clipping on mobile), UI-002 (mobile workspace selector missing), and UI-003 (tablet header horizontal overflow).
- Final retests confirmed all Settings tabs are visible at 390×844, Business ↔ Growth switching updates the visible plan context, and 768×1024 has no document horizontal overflow.
- The expanded mobile table review found and fixed UI-004: Payments now explains how to swipe across its intentionally wide table on narrow screens; the document itself remains viewport-contained.
- Public contrast review found and fixed UI-005: Contact Us secondary text now uses the darker accessible tone, and the `/contact` axe audit passes.

### Expanded route and workflow review — 2026-09-24

- Public/auth routes reviewed at 390×844: Login, Signup, Pricing, Pricing confirmation, and Contact Us. The mobile layouts fit the viewport; Contact Us showed `admin@moniger.net` and the confirmation page remained read-only for the signed-out session.
- Workspace routes opened and interacted with locally: Dashboard, Customers, Vendors, Invoices, Bills, Payments, Reports, Audit Trail, Settings, Team, Funding, and Marketplace Routing.
- Business/Growth synthetic workflow: created and edited a customer with business name, street address, city/state, phone, and email; created and edited a vendor; verified the resulting mobile cards, search/filter controls, currency formatting, populated Audit Trail entries, and empty Payments/Reports states.
- Customer draft persistence passed: a partially completed Add Customer form survived navigation to Vendors and back to Customers before save.
- Vendor phone filtering passed: alphabetic and unsupported characters were removed in the UI; a valid international number saved and displayed consistently.
- Direct non-admin access to `/admin/subscriptions` redirected to `/dashboard`. Admin subscription pages were not fully verified in this pass because `PLAYWRIGHT_ADMIN_EMAIL` and `PLAYWRIGHT_ADMIN_PASSWORD` are not configured locally; the credential-gated admin E2E cases remain skipped.
- Full three-tier baseline create/edit workflows, admin subscription comparison, and real provider delayed/cancelled checkout variants remain open or blocked where the required separate fixture/credential is unavailable. Existing prior Business, Starter, workspace-switch, delayed-provider, and signed-out confirmation evidence remains valid and is not being overstated as a full tier matrix.
- Before/after screenshots and detailed reproduction data are in [CLIENT_FEEDBACK_UI_OBSERVATIONS_2026-09-24.md](CLIENT_FEEDBACK_UI_OBSERVATIONS_2026-09-24.md).

## Migration preflight

Read-only local preflight counts before release consideration:

- Invalid existing business phones: `0`
- Invalid existing vendor phones: `0`
- Invoice/customer cross-workspace links: `0`
- Bill/vendor cross-workspace links: `0`
- Payment/invoice cross-workspace links: `0`
- Payment/bill cross-workspace links: `0`
- Phone/link triggers present: `6`

The phone migration does not rewrite legacy rows; existing invalid values would remain until explicitly remediated. The relationship migration protects future inserts/updates and does not repair existing inconsistent links. Release preflight must stop if those counts are non-zero. Recovery is to restore the backup, remove the migration, or remediate records through an approved data migration; no automatic reassignment or deletion is performed here.

Migrations were applied to local Supabase only:

- `20260923190000_validate_business_vendor_phone_numbers.sql`
- `20260923191000_enforce_workspace_record_links.sql`

## Commands and results

- `npm run test -- --run` — 37 files, 141 tests passed.
- `npm run test:e2e` — 49 tests collected; 42 passed, 7 skipped.
- Focused phone/subscription/timeout tests — 13 tests passed after the final fixes.
- `npm run build` — passed.
- `npm run lint` — passed with 0 errors and 31 existing warnings.
- `npm run verify:release:security` — passed.
- `supabase db lint --local` — two pre-existing ambiguous-column errors remain in unrelated functions.
- `git diff --check` — passed.

## Remaining gates

1. Run authenticated browser checks for the full workspace switching and server-side feature-limit matrix across all three plan fixtures.
2. Run Paystack TEST checkout only with isolated approved credentials and local callback configuration.
3. Review and commit locally; do not push, merge, deploy, apply remote migrations, or delete accounts/data under the current approval boundary.
