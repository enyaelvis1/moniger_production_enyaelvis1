# Client Feedback Local UAT — 2026-09-23

Local acceptance evidence for `fix/moniger-client-feedback-22`. This is not production approval. All fixtures below were created against the local Supabase instance at `127.0.0.1:54321`; credentials are intentionally excluded.

## Environment

- Frontend: `http://127.0.0.1:8081`
- Supabase API: local `127.0.0.1:54321`
- Mail capture: local Mailpit, no external delivery used
- Branch: `fix/moniger-client-feedback-22`
- Base: `develop`
- Viewports inspected: 1440×900, 768×1024, 390×844
- Provider checkout: not run; local seeded subscriptions are not provider verification

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
| 22C UI workspace switching | Not run / product gap | No workspace selector is currently exposed; `useSettingsData` selects one active membership. A multi-workspace selector is required before this case can be accepted. |
| 22D Starter access gating | Pass locally | Starter Reports displayed the upgrade prompt and did not render paid reports. |
| 22D Growth/Business access | Pass locally | Growth and Business rendered their protected workspace pages with their seeded active subscriptions. |
| 22E loading/error recovery | Pass locally | Dashboard, Payments, Reports, Audit Trail rendered data or an explicit state; no permanent spinner was observed. |
| Default timeout | Pass after fix | Fresh browser with no stored preference displayed `20 minutes`; the missing-value bug was fixed and unit-tested. |
| Admin access | Pass locally | Local Super Admin opened `/admin/settings`; ordinary User A was redirected to `/dashboard`. |
| Visual inspection | Pass with notes | Mobile 390×844 layout showed usable bottom navigation and no clipped primary content. Desktop and tablet states were inspected; console only had existing React Router warnings after fixes. |
| Provider checkout | Blocked | No isolated local Paystack TEST checkout credentials/callback configuration were used. Seeded subscriptions are not checkout evidence. |
| Cleanup/deletion | Not run | No broad cleanup and no existing business/account deletion was authorized or performed. |

## Observation register

| ID | Screen/case | Observation | Severity | Status / retest |
|---|---|---|---|---|
| OBS-001 | Settings → Business Phone | Chromium rejected `[+0-9 ()-]+` as an invalid Unicode-regex pattern. | Medium | Fixed in `Settings.tsx` and `Vendors.tsx` by escaping `-`; reload produced 0 console errors. |
| OBS-002 | Settings → Security | Missing local timeout storage was converted with `Number(null)` and clamped to 1 minute. | High | Fixed in `SessionTimeoutContext.tsx`; fresh browser and unit test now show 20 minutes. |
| OBS-003 | Multi-workspace User C | The app has no visible workspace selector and settings chooses one membership. | High / product capability | Open; do not claim workspace-switch acceptance. |
| OBS-004 | Browser console | React Router future-flag warnings remain. | Low / baseline | Not introduced by this task; no application errors remained in retested flows. |

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

- `npm run test -- --run` — 36 files, 138 tests passed.
- Focused phone/subscription/timeout tests — 13 tests passed after the final fixes.
- `npm run build` — passed.
- `npm run lint` — passed with 0 errors and 27 existing warnings.
- `npm run verify:release:security` — passed.
- `supabase db lint --local` — two pre-existing ambiguous-column errors remain in unrelated functions.
- `git diff --check` — passed.

## Remaining gates

1. Add or document an approved workspace selector before User C workspace-switch acceptance.
2. Run authenticated browser checks for all intended workspace switching and server-side feature limits after that selector exists.
3. Run Paystack TEST checkout only with isolated approved credentials and local callback configuration.
4. Review and commit locally; do not push, merge, deploy, apply remote migrations, or delete accounts/data under the current approval boundary.
