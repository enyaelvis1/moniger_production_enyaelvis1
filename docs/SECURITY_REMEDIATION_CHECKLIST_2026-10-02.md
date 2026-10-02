# Moniger Security Remediation Checklist

**Created:** 2026-10-02  
**Source audit:** [`security_best_practices_report.md`](../security_best_practices_report.md)  
**Status:** Remediation implemented on `fix/security-remediation-2026-10-02`; linked Supabase migrations/functions are deployed and local verification is green. Remaining unchecked items require disposable multi-workspace/provider UAT or additional production-safe fixtures; they are not silently assumed complete.

## Release rule

Do not promote payout/wallet changes to production until the P1 items are complete, the negative authorization tests pass, and the relevant Supabase migrations/functions have been applied and deployed successfully.

## P1 — Fix before enabling sensitive financial workflows

### MON-SEC-001 — Bind every payout object to the authenticated workspace

- [x] Update `loadBill` to require and query by both `billId` and `businessId`.
- [x] Update `loadPayout` to require and query by both `payoutId` and `businessId`.
- [x] Add explicit invariant checks before each mutation: bill/payout, wallet, vendor, and business IDs must all belong to the same workspace.
- [x] Apply the checks to request, schedule, cancel, reschedule, approve, release, retry, and process-due-payout actions.
- [x] Return a generic not-found/forbidden response that does not reveal whether another workspace owns the supplied ID.
- [ ] Add two-workspace negative tests for every payout action (requires disposable authenticated workspaces).
- [ ] Add tests proving a valid user cannot use a bill ID, payout ID, wallet ID, vendor ID, or bank ID from another workspace (requires disposable authenticated workspaces).
- [ ] Review the admin payout path separately; admin-only access must be intentional and audited.
- [x] Run targeted security tests, `npm test`, and the previously recorded release-security verification.

**Acceptance criteria:** A workspace member can manage only records whose `business_id` matches the workspace they are authorized to manage. Cross-workspace IDs always fail without side effects.

### MON-SEC-002 — Make wallet and ledger mutations server-owned

- [x] Revoke `insert/update` grants on `workspace_wallets` from `authenticated`.
- [x] Revoke direct `insert` grants on `wallet_ledger_entries` from `authenticated`.
- [x] Change wallet RLS to read-only for eligible workspace members.
- [x] Change ledger RLS to read-only for eligible workspace members.
- [x] Audit frontend queries: wallet/ledger usage is read-only; mutations remain in trusted Edge Functions.
- [x] Keep funding, reservation, settlement, cancellation, and release mutations inside narrowly scoped `security definer` functions; database mutation triggers now enforce the same boundary for every write path.
- [x] Add explicit database-enforced checks for actor role, workspace, amount, currency, idempotency key, source event, and legal payout status transition.
- [x] Add/enforce constraints preventing negative balances and invalid reserved balances.
- [x] Add immutable ledger protections: no client update/delete; corrections must be compensating entries with an audit event.
- [ ] Add direct Supabase API tests proving authenticated clients cannot insert or update wallet/ledger state (requires disposable authenticated fixtures).
- [x] Apply the migration to the linked project and verify the live migration/function deployment.

**Acceptance criteria:** The browser can view authorized balances and ledger history, but cannot directly alter financial state.

## P1/P2 — Close privileged public endpoints

### MON-SEC-003 — Secure `signup-alert`

- [x] Remove the browser-triggered privileged call, or replace it with a trusted server-side signup event.
- [x] Preferred option: emit the alert from a trusted auth/database event after account creation.
- [x] If the Edge Function remains public, require a server-only shared secret; the database trigger is the only configured caller.
- [x] Require a server-only secret and make signup-event insertion duplicate-safe through the trusted database trigger path.
- [x] Add per-IP and per-user rate limiting for the public Edge Function boundary.
- [x] Avoid returning user-existence details to unauthenticated callers; invalid requests receive the same generic accepted response.
- [x] Add unit coverage for missing/invalid/expired signatures, malformed user IDs, and replay-safe nonce/duplicate defenses; full HTTP abuse testing remains a staging fixture check.
- [x] Review service-role use: it remains required for trusted user lookup and email delivery; no browser caller is allowed.

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
- [x] Validate the configured URL scheme and origin for each environment.
- [x] Allow HTTP only for explicitly approved local development origins.
- [x] Add execution-time configuration checks that fail when the variable is missing.
- [x] Add tests for missing, malformed, local, and production values.
- [ ] Verify Paystack callback URLs and renewal links in a staging checkout before production rollout.

**Acceptance criteria:** Billing and account-security links are generated only from an approved configured origin, never from request-controlled headers.

### MON-SEC-006 — Validate notification destinations

- [ ] Replace arbitrary notification URL strings with typed internal route keys where practical; write-time validation is the current compatibility layer.
- [x] Validate notification links at write time in the client helper and database trigger.
- [x] Validate again in `NotificationCenter` before calling `navigate`.
- [x] Reject `//`, backslashes, schemes, control characters, and external origins.
- [x] Add a test for a malicious stored notification link.
- [x] Review admin/content notification writes; invalid external, protocol-relative, backslash, and control-character links are rejected by the database trigger.

**Acceptance criteria:** Notification clicks can only navigate within the Moniger application.

## P2 — Dependency and supply-chain cleanup

### MON-SEC-007 — Normalize and remediate dependencies

- [x] Choose pnpm as the sole supported package manager, matching `package.json`.
- [x] Confirm the extra lockfiles were unused and remove `package-lock.json`, `bun.lock`, and `bun.lockb` from version control.
- [x] Pin CI/install instructions to `pnpm install --frozen-lockfile`.
- [x] Regenerate the authoritative lockfile from the current package manifest.
- [x] Upgrade `react-router-dom`/`react-router` first because it overlaps with MON-SEC-004.
- [x] Upgrade direct `postcss`, `vite`, and `vitest` dependencies to fixed versions.
- [x] Re-run production and full dependency audits against the authoritative lockfile.
- [x] Review transitive fixes for the audited dependency set; the production audit now reports no known vulnerabilities.
- [x] Ensure local dev servers and Vitest UI are bound to localhost and are never exposed publicly.
- [x] Add a CI dependency-audit gate. No exception is currently required because the production audit is clean.

**Acceptance criteria:** The supported lockfile has no unresolved high/critical production vulnerabilities, and any remaining dev-only exception is documented with an owner and expiry.

## P2 — Frontend hardening

### MON-SEC-008 — Remove or constrain dynamic CSS HTML injection

- [x] Replace `dangerouslySetInnerHTML` in `ChartStyle` with a text style element.
- [x] If raw CSS must remain, allowlist color formats and escape CSS identifiers/attribute selectors.
- [x] Restrict chart IDs to a safe identifier pattern.
- [x] Add tests using hostile keys, IDs, and color values to prove the style element cannot be escaped.
- [x] Re-run the frontend XSS sink scan after the change.

**Acceptance criteria:** Untrusted chart configuration cannot create executable markup or escape the generated style block.

## Cross-cutting verification checklist

- [ ] Add negative authorization tests for two workspaces and at least three roles: owner/admin/accountant/member (requires disposable fixtures).
- [ ] Add service-role bypass tests proving every service-role query still enforces the application’s tenant invariant (requires disposable fixtures).
- [ ] Add public Edge Function abuse tests for missing auth, forged headers, replayed tokens, malformed JSON, oversized payloads, and rate limits (requires a non-production abuse harness).
- [ ] Add storage tests for cross-workspace download, replacement, deletion, and signed URL access (requires disposable storage fixtures).
- [ ] Add billing tests for callback URL origin, duplicate checkout, replayed webhook, and wrong-workspace references (requires staging payment fixtures).
- [x] Run `npm run lint` and resolve errors introduced by remediation; 33 pre-existing warnings remain.
- [x] Run `npm test` — 49 files and 187 tests passed.
- [x] Run `npm run build`.
- [x] Run `npm run verify:release:security -- --project-ref qfhjlqskucabzxepqbpl --expected-app-url https://moniger.net`.
- [ ] Run the relevant production route, webhook, and checkout verification scripts only against disposable/staging fixtures; these scripts create records and payment side effects.
- [x] Apply required migrations to the linked Supabase project.
- [x] Deploy changed Edge Functions and verify the linked project function list.
- [x] Configure and verify the server-only `SIGNUP_ALERT_INTERNAL_SECRET` in Edge Function secrets and Vault.
- [ ] Perform a staging UAT pass before production rollout.
- [x] Update `docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md`, the OWASP checklist, and this checklist with completed remediation and residual risks.

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
| MON-SEC-001 | Codex | Implemented; disposable two-workspace negative matrix remains | `workspace-payout-execution`, linked deploy | 2026-10-02 |
| MON-SEC-002 | Codex | Implemented and migrated; immutable-ledger and financial invariant triggers deployed; disposable direct API fixture remains | `20261002130000_lock_wallet_and_payout_mutations.sql`, `20261002140000_immutable_wallet_ledger.sql`, `20261002150000_harden_trusted_alerts_and_financial_invariants.sql` | 2026-10-02 |
| MON-SEC-003 | Codex | Implemented with signed five-minute requests, one-time nonces, per-IP/per-user limits, generic responses, and unit coverage | `20261002132000_enqueue_signup_alerts_trusted.sql`, `20261002150000_harden_trusted_alerts_and_financial_invariants.sql`, `signup-alert` | 2026-10-02 |
| MON-SEC-004 | Codex | Implemented and unit-tested; invite/MFA-specific cases remain | `safe-navigation.test.ts`, `app-base-url.test.ts`, router 7.18.4 | 2026-10-02 |
| MON-SEC-005 | Codex | Implemented, tested, and deployed; staging checkout verification remains | shared URL validator, billing/digest/renewal functions | 2026-10-02 |
| MON-SEC-006 | Codex | Implemented at client and database write boundaries; typed route keys remain optional hardening | `notifications.ts`, `notifications.test.ts`, linked migration | 2026-10-02 |
| MON-SEC-007 | Codex | Implemented; CI gate added and production audit reports no known vulnerabilities | `pnpm-lock.yaml`, `.github/workflows/security-audit.yml` | 2026-10-02 |
| MON-SEC-008 | Codex | Implemented and hostile chart tests pass | `chart.tsx`, `chart.security.test.tsx` | 2026-10-02 |
