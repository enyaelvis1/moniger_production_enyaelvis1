# Moniger Security Remediation Checklist

**Created:** 2026-10-02  
**Source audit:** [`security_best_practices_report.md`](../security_best_practices_report.md)  
**Status:** Remediation implemented on `fix/security-remediation-2026-10-02`; deployment and verification evidence is recorded below. Remaining unchecked items are follow-up coverage or release-process work, not silently assumed complete.

## Release rule

Do not promote payout/wallet changes to production until the P1 items are complete, the negative authorization tests pass, and the relevant Supabase migrations/functions have been applied and deployed successfully.

## P1 — Fix before enabling sensitive financial workflows

### MON-SEC-001 — Bind every payout object to the authenticated workspace

- [x] Update `loadBill` to require and query by both `billId` and `businessId`.
- [x] Update `loadPayout` to require and query by both `payoutId` and `businessId`.
- [x] Add explicit invariant checks before each mutation: bill/payout, wallet, vendor, and business IDs must all belong to the same workspace.
- [x] Apply the checks to request, schedule, cancel, reschedule, approve, release, retry, and process-due-payout actions.
- [x] Return a generic not-found/forbidden response that does not reveal whether another workspace owns the supplied ID.
- [ ] Add two-workspace negative tests for every payout action.
- [ ] Add tests proving a valid user cannot use a bill ID, payout ID, wallet ID, vendor ID, or bank ID from another workspace.
- [ ] Review the admin payout path separately; admin-only access must be intentional and audited.
- [ ] Run targeted Edge Function tests, `npm test`, and `npm run verify:release:security`.

**Acceptance criteria:** A workspace member can manage only records whose `business_id` matches the workspace they are authorized to manage. Cross-workspace IDs always fail without side effects.

### MON-SEC-002 — Make wallet and ledger mutations server-owned

- [x] Revoke `insert/update` grants on `workspace_wallets` from `authenticated`.
- [x] Revoke direct `insert` grants on `wallet_ledger_entries` from `authenticated`.
- [x] Change wallet RLS to read-only for eligible workspace members.
- [x] Change ledger RLS to read-only for eligible workspace members.
- [ ] Audit all frontend queries to confirm they only read these tables.
- [ ] Keep funding, reservation, settlement, cancellation, and release mutations inside narrowly scoped `security definer` functions.
- [ ] Add explicit function checks for actor role, workspace, amount, currency, idempotency key, source event, and legal status transition.
- [ ] Add constraints preventing negative balances and invalid reserved balances.
- [ ] Add immutable ledger protections: no client update/delete; corrections must be compensating entries with an audit event.
- [ ] Add direct Supabase API tests proving authenticated clients cannot insert or update wallet/ledger state.
- [ ] Apply the migration to the linked project and verify the live grants/policies after deployment.

**Acceptance criteria:** The browser can view authorized balances and ledger history, but cannot directly alter financial state.

## P1/P2 — Close privileged public endpoints

### MON-SEC-003 — Secure `signup-alert`

- [x] Remove the browser-triggered privileged call, or replace it with a trusted server-side signup event.
- [x] Preferred option: emit the alert from a trusted auth/database event after account creation.
- [x] If the Edge Function remains public, require a server-only shared secret; the database trigger is the only configured caller.
- [ ] Verify the signature and consume the nonce atomically before reading the user or sending email.
- [ ] Add per-IP and per-user rate limiting.
- [ ] Avoid returning user-existence details to unauthenticated callers.
- [ ] Add tests for missing/invalid/expired/replayed signatures and unauthorized user IDs.
- [ ] Review whether the function still needs service-role access after the redesign.

**Acceptance criteria:** An unauthenticated caller cannot cause arbitrary privileged user lookups, signup records, or emails.

## P2 — Correct redirect and URL trust boundaries

### MON-SEC-004 — Centralize safe internal navigation

- [x] Create one shared `getSafeInternalPath` helper for login, registration, password reset, notification, and subscription continuation flows.
- [x] Reject empty/invalid values, `//host`, backslash variants, control characters, encoded protocol-relative paths, schemes, and absolute URLs.
- [ ] Allow only known internal paths and query parameters where possible.
- [ ] Apply validation both when reading query parameters and immediately before navigation.
- [x] Upgrade `react-router` and `react-router-dom` to `7.18.4`.
- [x] Add regression tests for `//evil.example`, `/\\evil.example`, encoded variants, `javascript:`, `https://evil.example`, and valid nested internal routes.
- [ ] Test password-reset and invite links independently; they have different token and redirect behavior.

**Acceptance criteria:** No crafted public URL can send a user to an external origin through login, registration, password-reset, invite, MFA, or notification navigation.

### MON-SEC-005 — Fail closed on `APP_BASE_URL`

- [x] Remove request `Origin` fallbacks from `paystack-payments` and `workspace-digest-automation`.
- [x] Remove the production-domain fallback from `subscription-renewal-automation`.
- [x] Require a valid `APP_BASE_URL` in every billing/security-sensitive Edge Function.
- [ ] Validate the configured URL scheme and origin for each environment.
- [ ] Allow HTTP only for explicitly approved local development origins.
- [ ] Add startup/configuration checks that fail deployment or function execution when the variable is missing.
- [ ] Add tests for missing, malformed, staging, local, and production values.
- [ ] Verify Paystack callback URLs and renewal links in a staging checkout before production rollout.

**Acceptance criteria:** Billing and account-security links are generated only from an approved configured origin, never from request-controlled headers.

### MON-SEC-006 — Validate notification destinations

- [ ] Replace arbitrary notification URL strings with typed internal route keys where practical.
- [ ] Validate notification links at write time.
- [x] Validate again in `NotificationCenter` before calling `navigate`.
- [x] Reject `//`, backslashes, schemes, control characters, and external origins.
- [ ] Add a test for a malicious stored notification link.
- [ ] Review admin/content tools that can create notifications.

**Acceptance criteria:** Notification clicks can only navigate within the Moniger application.

## P2 — Dependency and supply-chain cleanup

### MON-SEC-007 — Normalize and remediate dependencies

- [x] Choose pnpm as the sole supported package manager, matching `package.json`.
- [x] Confirm the extra lockfiles were unused and remove `package-lock.json`, `bun.lock`, and `bun.lockb` from version control.
- [ ] Pin CI/install instructions to `pnpm install --frozen-lockfile`.
- [ ] Regenerate the authoritative lockfile from the current package manifest.
- [x] Upgrade `react-router-dom`/`react-router` first because it overlaps with MON-SEC-004.
- [x] Upgrade direct `postcss`, `vite`, and `vitest` dependencies to fixed versions.
- [x] Re-run production and full dependency audits against the authoritative lockfile.
- [ ] Review transitive fixes for `nanoid`, `postcss-selector-parser`, `ws`, `form-data`, `js-yaml`, `browserslist`, `brace-expansion`, and related packages.
- [x] Ensure local dev servers and Vitest UI are bound to localhost and are never exposed publicly.
- [ ] Add a CI dependency-audit gate with an approved exception process and expiry dates.

**Acceptance criteria:** The supported lockfile has no unresolved high/critical production vulnerabilities, and any remaining dev-only exception is documented with an owner and expiry.

## P2 — Frontend hardening

### MON-SEC-008 — Remove or constrain dynamic CSS HTML injection

- [x] Replace `dangerouslySetInnerHTML` in `ChartStyle` with a text style element.
- [x] If raw CSS must remain, allowlist color formats and escape CSS identifiers/attribute selectors.
- [x] Restrict chart IDs to a safe identifier pattern.
- [ ] Add tests using hostile keys, IDs, and color values to prove the style element cannot be escaped.
- [ ] Re-run the frontend XSS sink scan after the change.

**Acceptance criteria:** Untrusted chart configuration cannot create executable markup or escape the generated style block.

## Cross-cutting verification checklist

- [ ] Add negative authorization tests for two workspaces and at least three roles: owner/admin/accountant/member.
- [ ] Add service-role bypass tests proving every service-role query still enforces the application’s tenant invariant.
- [ ] Add public Edge Function abuse tests for missing auth, forged headers, replayed tokens, malformed JSON, oversized payloads, and rate limits.
- [ ] Add storage tests for cross-workspace download, replacement, deletion, and signed URL access.
- [ ] Add billing tests for callback URL origin, duplicate checkout, replayed webhook, and wrong-workspace references.
- [x] Run `npm run lint` and resolve errors introduced by remediation; 33 pre-existing warnings remain.
- [x] Run `npm test` — 46 files and 177 tests passed.
- [x] Run `npm run build`.
- [x] Run `npm run verify:release:security -- --project-ref qfhjlqskucabzxepqbpl --expected-app-url https://moniger.net`.
- [ ] Run the relevant production route, webhook, and checkout verification scripts.
- [x] Apply required migrations to the linked Supabase project.
- [x] Deploy changed Edge Functions and verify the linked project function list.
- [x] Configure and verify the server-only `SIGNUP_ALERT_INTERNAL_SECRET` in Edge Function secrets and Vault.
- [ ] Perform a staging UAT pass before production rollout.
- [ ] Update `docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md`, the OWASP checklist, and client UAT guidance with completed remediation and residual risks.

## Suggested implementation sequence

1. **P1 isolation:** MON-SEC-001 and MON-SEC-002.
2. **Privileged endpoint closure:** MON-SEC-003.
3. **URL and redirect boundary:** MON-SEC-004, MON-SEC-005, and MON-SEC-006.
4. **Dependency normalization:** MON-SEC-007.
5. **Frontend hardening:** MON-SEC-008.
6. **Full verification, migration application, function deployment, staging UAT, and documentation.**

## Completion record

| Finding | Owner | Status | Evidence / PR | Deployed date |
|---|---|---|---|---|
| MON-SEC-001 | Codex | Implemented; negative two-workspace test matrix remains | `workspace-payout-execution`, linked deploy | 2026-10-02 |
| MON-SEC-002 | Codex | Implemented and migrated; direct API regression tests remain | `20261002130000_lock_wallet_and_payout_mutations.sql`, linked migration | 2026-10-02 |
| MON-SEC-003 | Codex | Implemented with trusted DB trigger and secret; replay/rate-limit tests remain | `20261002132000_enqueue_signup_alerts_trusted.sql`, `signup-alert` | 2026-10-02 |
| MON-SEC-004 | Codex | Implemented and tested; invite/MFA-specific cases remain | `safe-navigation.test.ts`, router 7.18.4 | 2026-10-02 |
| MON-SEC-005 | Codex | Implemented and deployed; environment matrix tests remain | billing/digest/renewal functions | 2026-10-02 |
| MON-SEC-006 | Codex | Navigation-time validation implemented; write-time route typing remains | `NotificationCenter.tsx` | 2026-10-02 |
| MON-SEC-007 | Codex | Implemented; production audit has no high/critical, one low transitive finding remains | `pnpm-lock.yaml`, `pnpm audit --prod` | 2026-10-02 |
| MON-SEC-008 | Codex | Implemented; hostile chart configuration tests remain | `chart.tsx` | 2026-10-02 |
