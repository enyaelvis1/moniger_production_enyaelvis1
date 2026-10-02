# Moniger Whole-Application Security and Engineering Audit

**Date:** 2026-10-02  
**Scope:** React/Vite frontend, Supabase migrations/RLS, Edge Functions, billing/payment flows, wallet/payout code, storage/upload paths, deployment headers, dependencies, and automated checks.  
**Mode:** Read-only audit. No application code, database schema, deployed function, or environment variable was changed.

## Executive summary

The application has several good security controls already in place: Supabase RLS is broadly enabled, service-role clients are kept in Edge Functions, payment callbacks use server-side verification, security headers are configured in `vercel.json`, auth recovery URLs are scrubbed, and the test/build baseline is green.

The most important findings are:

1. **High:** The payout execution function loads bills and payouts by ID without consistently binding them to the authenticated workspace. Because that function uses a service-role client, RLS cannot compensate for the missing workspace checks.
2. **High:** Authenticated finance roles can directly insert wallet-ledger rows and update wallet rows through client-visible table grants. This leaves balance and ledger integrity dependent on the client and bypasses the intended server-side state machine.
3. **High/Medium:** `signup-alert` is publicly callable while using the service role to read an arbitrary auth user and create an alert/email side effect.
4. **Medium:** Login `next` handling accepts protocol-relative paths such as `//attacker.example`, and the installed React Router range contains known redirect vulnerabilities.
5. **Medium:** Two public functions fall back to the request `Origin` when `APP_BASE_URL` is missing, allowing environment/link misrouting and violating the repository’s fail-closed URL policy.
6. **High dependency exposure:** The current npm-resolved graph reports one critical and eight high vulnerabilities in the full graph; the production-only graph reports two high, three moderate, and one low. The repository also tracks four lockfiles, which makes the authoritative dependency graph unclear.

These findings should be addressed before treating the payout/wallet path as production-ready. The report does not assert that outgoing vendor payments are currently live money movement; it identifies authorization and ledger-integrity risks in the code that manages that state.

## Findings

### MON-SEC-001 — Cross-workspace payout authorization / IDOR

**Severity:** High (P1)  
**Category:** Broken access control, CWE-639 / CWE-862  
**Locations:**

- `supabase/functions/workspace-payout-execution/index.ts:412-423`
- `supabase/functions/workspace-payout-execution/index.ts:492-505`
- `supabase/functions/workspace-payout-execution/index.ts:1842-1866`
- `supabase/functions/workspace-payout-execution/index.ts:1910-1968`

**Evidence:** `loadBill` queries `bills` only with `.eq("id", billId)`. `loadPayout` queries `workspace_payouts` only with `.eq("id", payoutId)`. The request handler validates that the caller can manage the supplied `businessId`, but then passes an independently supplied bill/payout ID to service-role handlers without checking `bill.business_id === business.id` or `payout.business_id === business.id`.

**Impact:** A user who can obtain a bill or payout UUID from another workspace could potentially request/schedule a payout, cancel/reschedule a payout, release a payout, or approve a payout while authenticated as a member of a different workspace. The exact impact depends on the downstream handler and current provider configuration, but the missing tenant binding is a direct authorization defect in a financial workflow.

**Recommended fix:** Make every loader accept and enforce `businessId`, for example `.eq("id", id).eq("business_id", businessId)`. For payout actions, perform a second explicit invariant check before any mutation: `payout.business_id === business.id`. Add negative tests using two workspaces for every action (`request`, `schedule`, `cancel`, `reschedule`, `approve`, and `release`).

**Mitigation:** Until fixed, disable payout execution actions or restrict the Edge Function to a controlled test environment. Do not rely on client-side workspace IDs or RLS because the function intentionally uses the service-role client.

### MON-SEC-002 — Client-direct wallet and ledger mutation

**Severity:** High (P1)  
**Category:** Authorization and financial-integrity failure, CWE-602 / CWE-639  
**Locations:**

- `supabase/migrations/20260528120000_add_workspace_wallet_and_ledger.sql:123-164`
- `supabase/migrations/20260925150000_gate_wallet_access_by_subscription.sql:3-35`

**Evidence:** `workspace_wallets` grants `select, insert, update` to `authenticated` and defines an `for all` policy for owner/admin/accountant roles. `wallet_ledger_entries` grants `select, insert` to `authenticated` and permits finance roles to insert rows when the wallet belongs to the same workspace. The policies check workspace membership and role, but do not restrict sensitive columns such as `balance`, `reserved_balance`, `entry_type`, `balance_before`, or `balance_after` to server-maintained transitions.

**Impact:** A permitted client can attempt to credit/debit a wallet, alter reserved amounts, or create ledger entries that do not represent a verified funding or payout transition. This can corrupt balances, break reconciliation, and undermine the audit trail even without bypassing RLS.

**Recommended fix:** Revoke direct `insert/update` grants from `authenticated` on wallet and ledger tables. Permit read-only access through carefully scoped views or read policies. Keep all balance/ledger mutations inside `security definer` functions that validate state transitions, idempotency, amount/currency, source event, and actor. Add database constraints preventing negative balances, invalid transitions, and arbitrary balance snapshots.

**Mitigation:** Monitor these tables for direct client-originated writes and compare ledger totals against provider-confirmed funding and payout events. Treat any unexpected row as an integrity incident.

### MON-SEC-003 — Unauthenticated service-role signup alert endpoint

**Severity:** High (P1) pending confirmation of network exposure; Medium (P2) if gateway access is separately restricted  
**Category:** Missing function-level authorization, abuse of privileged backend, CWE-862 / CWE-250  
**Locations:**

- `supabase/config.toml:30-31` (`verify_jwt = false`)
- `supabase/functions/signup-alert/index.ts:5-6, 17-50`

**Evidence:** The function is deployed without platform JWT verification, accepts arbitrary `userId` and `plan` values, creates a service-role client, calls `auth.admin.getUserById(userId)`, inserts a privileged signup event, and sends email. There is no authenticated caller check, signed event token, webhook secret, or rate limit in the function.

**Impact:** Anyone able to call the public function can cause privileged user lookups and email/DB side effects for known UUIDs. Repeated requests with different accounts can create alert/email abuse and operational cost. A valid user UUID can also become an account-existence oracle.

**Recommended fix:** Remove the browser-to-function invocation and emit the alert from a trusted server-side registration/auth hook, or require a short-lived signed one-time token generated by the registration backend. Add rate limiting and ensure the event is bound to the signup transaction, not an arbitrary caller-supplied plan/user pair.

**Mitigation:** Disable the function endpoint until the trusted event path is in place, or require a secret header unavailable to browsers. Do not expose the service role key as a workaround.

### MON-SEC-004 — Open redirect through `next` plus vulnerable React Router range

**Severity:** Medium (P2)  
**Category:** Open redirect, CWE-601  
**Locations:**

- `src/pages/Login.tsx:20-25`
- `src/pages/ForgotPassword.tsx:47-55`
- `src/pages/ForgotPasswordConfirmed.tsx:10-12`
- `package.json` (`react-router-dom: ^6.30.1`)

**Evidence:** `getSafeNextPath` accepts any string beginning with `/`, including `//attacker.example` and backslash variants. That value is passed to `navigate`. The forgot-password pages preserve an unvalidated `next` value and feed it back into login links. `npm audit` also reports the installed React Router range as affected by known protocol-relative/backslash redirect issues.

**Impact:** A crafted login or password-recovery URL may redirect a user to an attacker-controlled origin after authentication or after clicking a trusted recovery-page link. This is useful for phishing and can become more serious when tokens or sensitive query parameters are carried in the URL.

**Recommended fix:** Centralize a strict internal-path validator that rejects `//`, `\\`, control characters, absolute URLs, and non-allowlisted routes. Apply it at every ingress and before every navigation. Upgrade React Router to a fixed version and add regression tests for `//evil.example`, `/\\evil`, encoded variants, and normal nested query paths.

### MON-SEC-005 — Request-Origin fallback for application links

**Severity:** Medium (P2)  
**Category:** Configuration failure / link injection, CWE-20 / CWE-601  
**Locations:**

- `supabase/functions/paystack-payments/index.ts:71-82`
- `supabase/functions/workspace-digest-automation/index.ts:58-69`
- `supabase/functions/subscription-renewal-automation/index.ts:117`

**Evidence:** The payment and digest functions use `APP_BASE_URL` when present, otherwise trust the request `Origin`, then fall back to `https://moniger.net`. Renewal automation silently falls back to the production domain. The repository security rules state that `APP_BASE_URL` is required and request-origin fallback must not be used for billing or security-sensitive links.

**Impact:** A missing or misconfigured environment variable can produce callbacks, payment links, digest links, or renewal links pointing at an attacker-controlled origin or the wrong environment. This can misroute a user after payment or place sensitive workflow links in the wrong deployment.

**Recommended fix:** Fail closed when `APP_BASE_URL` is missing or invalid. Parse it as a URL, require `https:` outside an explicitly approved local environment, and allow only the configured production/staging origins. Add deployment checks that fail if the variable is absent or does not match the environment.

### MON-SEC-006 — Notification links are trusted without route validation

**Severity:** Low/Medium (P2 hardening)  
**Category:** Stored navigation injection, CWE-601  
**Locations:**

- `src/components/app/NotificationCenter.tsx:53-54`
- Producers currently write internal values such as `/wallet`, `/invoices`, and `/payments` in `supabase/functions/_shared/finance-notifications.ts` and related functions.

**Evidence:** The UI calls `navigate(notification.link)` directly. Current producers appear to use static internal paths, so this is not presently confirmed exploitable from the UI alone; however, the database value is the trust boundary and there is no validation before navigation.

**Impact:** A future admin/content path, compromised service-role writer, or imported notification could introduce an external/protocol-relative route and turn the notification bell into a phishing redirect.

**Recommended fix:** Validate notification links at write time and read time. Permit only an internal path beginning with one `/`, reject `//`, backslashes, control characters, and schemes, and optionally use a typed route key rather than storing arbitrary URLs.

### MON-SEC-007 — Dependency graph contains known vulnerabilities and multiple lockfiles

**Severity:** High for release hygiene (P1 for affected tooling); Medium for production runtime until the authoritative graph is normalized  
**Category:** Vulnerable dependencies / supply-chain drift

**Evidence:** `npm audit --omit=dev --json` reported **6 vulnerabilities**: 2 high, 3 moderate, and 1 low. The full npm graph reported **16 vulnerabilities**: 1 critical, 8 high, 5 moderate, and 2 low. The affected direct packages include `postcss`, `react-router-dom`, `vite`, and `vitest`; transitive findings include `nanoid`, `@remix-run/router`, `postcss-selector-parser`, `ws`, `form-data`, `js-yaml`, `browserslist`, and related tooling. The repository tracks `package-lock.json`, `pnpm-lock.yaml`, `bun.lock`, and `bun.lockb` while `package.json` declares pnpm as the package manager.

**Impact:** Production and CI can resolve different dependency graphs. The React Router findings overlap with MON-SEC-004. Dev-server/test vulnerabilities can expose local source or execute files if a vulnerable tool is bound beyond localhost or used in CI services.

**Recommended fix:** Choose pnpm as the single supported package manager, remove or formally exclude the other lockfiles, regenerate the authoritative lockfile, update direct dependencies, and run both production and full audits against that graph. Pin CI to the same package manager and use `pnpm install --frozen-lockfile`.

### MON-SEC-008 — Dynamic CSS is built with `dangerouslySetInnerHTML`

**Severity:** Low (P2 hardening; Medium if chart config becomes user-controlled)  
**Category:** DOM XSS defense-in-depth, CWE-79  
**Location:** `src/components/ui/chart.tsx:61-82`

**Evidence:** Chart IDs, config keys, and colors are interpolated into a `<style>` block through `dangerouslySetInnerHTML` without CSS identifier/value escaping. Current chart callers appear to use trusted static configuration, so exploitability is not confirmed today.

**Impact:** If chart config or ID later incorporates imported/customer/admin content, an attacker may break out of the CSS declaration or selector and execute markup/script in the page context.

**Recommended fix:** Prefer React/CSS custom-property style objects or a stylesheet API. If raw CSS remains necessary, allowlist color formats, escape CSS identifiers, constrain chart IDs, and add a test proving untrusted values cannot close the style block.

## Positive controls observed

- RLS is enabled across the primary workspace tables and includes workspace membership checks.
- Payment verification and settlement are server-side rather than trusting browser success callbacks.
- The service-role key is used in Edge Functions rather than shipped in frontend bundles.
- `vercel.json` provides CSP, HSTS, `frame-ancestors`, `nosniff`, referrer, permissions, and cache headers.
- Auth uses per-tab session storage rather than persistent local storage for the Supabase session.
- Export HTML escapes user-visible values before writing the print document.
- The current automated test suite covers 45 files and 169 tests, all passing.

## Verification performed

| Check | Result |
|---|---|
| `npm run lint` | Passes with 33 existing warnings; no errors |
| `npm test -- --reporter=dot` | 45 test files passed; 169 tests passed |
| `npm run build` | Passed |
| `npm run verify:release:security` | Passed |
| `npm audit --omit=dev --json` | Fails due to 6 known vulnerabilities |
| Full `npm audit --json` | Fails due to 16 known vulnerabilities, including 1 critical |

The `npm audit` results should be rerun after lockfile normalization because the repository currently contains multiple lockfiles. No Supabase migration was applied and no Edge Function was deployed as part of this read-only audit.

## Recommended remediation order

1. Fix MON-SEC-001 and MON-SEC-002; add cross-workspace and direct-client mutation tests before enabling payout/wallet functionality broadly.
2. Close MON-SEC-003 and enforce fail-closed application URLs for MON-SEC-005.
3. Upgrade React Router and centralize safe internal navigation for MON-SEC-004 and MON-SEC-006.
4. Normalize the package manager/lockfile and remediate dependency findings in MON-SEC-007.
5. Remove the raw style sink or harden it as described in MON-SEC-008.

