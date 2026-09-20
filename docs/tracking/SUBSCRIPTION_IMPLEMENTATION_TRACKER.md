# Subscription Implementation Tracker

Last updated: 2026-04-22
Current working branch: `feature/subscriptions-paystack-billing`
Based on: `dev` at commit `e1bb175`

## Purpose

Use this document as the source of truth for the end-user workspace subscription rollout.

For cross-platform implementation status and the consolidated remaining-work checklist, use `docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md`.

Track:

- what has been implemented for self-serve subscriptions
- what is still left before release
- how each slice should be tested
- which branch workflow is expected for future subscription work

This document should be updated whenever subscription implementation changes.

Related docs:

- `docs/BRANCHING_STRATEGY.md`
- `docs/admin-console/STATUS_TRACKER.md`
- `docs/IMPLEMENTATION_STATUS_SUMMARY.md`

## Required Update Rule

For every subscription implementation change:

1. Update this document first or in the same change.
2. Record what was implemented and what is still left.
3. Add exact test steps for the changed behavior.
4. Record the verification result for `npm run lint`, `npm run test`, and `npm run build`, or explain why a check was deferred.
5. Update any related status docs that mention subscriptions if their status changed.

Do not mark a slice complete unless the implementation exists in code and the matching verification has been run or explicitly deferred with a reason.

## Branching Rules

These rules come from `docs/BRANCHING_STRATEGY.md` and apply here:

- New feature work starts from `dev`.
- Feature branches merge back into `dev` first.
- Do not start new work from the stale `develop` branch.
- Only production hotfixes branch from `main`.

Standard feature flow:

```bash
git switch dev
git pull origin dev
git switch -c feature/<scope>-<short-name>
```

Current note:

- This branch was created from a worktree state whose `HEAD`, `dev`, and `origin/dev` all pointed to commit `e1bb175`, so it remains aligned with the documented `dev` base.

## Current Snapshot

Overall status as of 2026-04-22:

- Public pricing intent flow exists in the client.
- Starter activation now works as a direct workspace-record update.
- Paid workspace plans now initialize a real Paystack recurring checkout flow.
- Callback verification and provider-driven webhook sync now update `business_subscriptions`.
- Live environment rollout is still required before this can be called released.

## Implementation Slices

### Slice 1: Tracking And Branch Alignment

Status: Complete

Scope:

- create a dedicated tracker for end-user subscriptions
- record branch provenance against `dev`
- define the implementation slices and verification expectations

What is left:

- keep this tracker updated as future billing changes land

### Slice 2: Paystack Subscription Checkout

Status: Complete

Scope:

- create or reuse Paystack plans for paid workspace tiers
- initialize a recurring Paystack checkout for workspace subscriptions
- persist local checkout-session context so the callback and webhook can reconcile safely

What was implemented:

- Added a dedicated `subscription_checkout_sessions` table for reconciliation across callback and webhook paths.
- Added Paystack plan caching and on-demand plan creation inside the workspace subscription service.
- Added a real `self.initialize-checkout` action that starts Paystack recurring checkout for paid workspace tiers.
- Updated the public pricing and landing pricing CTAs to use the real paid checkout path.

What is left:

- confirm the required Paystack secrets and redirects are present in the target Supabase environment

### Slice 3: Provider Sync And Confirmation

Status: Complete

Scope:

- verify the returned Paystack transaction from the app
- sync the canonical Paystack subscription record into `business_subscriptions`
- handle relevant webhook events so renewal and cancellation states stay in sync

What was implemented:

- Added a public `/pricing/confirmed` page that verifies the returned Paystack reference against the signed-in workspace manager.
- Added a `self.verify-checkout` action that verifies the transaction and syncs the canonical Paystack subscription back into `business_subscriptions`.
- Extended `paystack-webhook` to handle workspace-subscription charge success, subscription lifecycle events, and invoice renewal status updates for recurring billing.

What is left:

- verify the full webhook event set against a deployed Supabase function URL with real Paystack test events

### Slice 4: Verification And Status Updates

Status: Complete

Scope:

- run the relevant checks
- update this tracker
- update related status docs that mention subscription readiness

What was implemented:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npx vitest run src/lib/subscriptions.test.ts`

What is left:

- `deno check` could not be run in this environment because `deno` is not installed locally

## Test Plan

Manual verification target for this rollout:

1. Open `/pricing` while signed out and choose `Growth` or `Business`.
2. Confirm the app routes through registration or login with the intended subscription preserved in `next`.
3. Complete sign-up or sign-in and confirm the paid flow redirects to Paystack checkout.
4. Complete the Paystack test payment and confirm the callback reaches the subscription confirmation page.
5. Confirm `business_subscriptions` stores Paystack provider data, plan, amount, and next renewal date.
6. Confirm `/admin/subscriptions` reflects the synced provider-backed record after refresh.
7. Trigger a relevant subscription webhook in the target environment and confirm the record stays in sync.

## Recent Update

### Update: 2026-04-22 (Checkout Initialization Hotfix)

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Fixed a deployed `workspace-subscriptions` checkout initialization failure that produced `500` responses before Paystack checkout could open.
- Files changed:
<<<<<<<< HEAD:docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md
  - `docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
========
  - `docs/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
>>>>>>>> main:docs/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md
  - `docs/admin-console/STATUS_TRACKER.md`
  - `supabase/functions/_shared/paystack-subscriptions.ts`
  - `supabase/functions/workspace-subscriptions/index.ts`
- What was implemented:
  - Removed an invalid `updated_by` write from the `platform_config` upsert used to cache Paystack plan metadata.
  - Added an explicit `onConflict: "key"` target for the `platform_config` upsert.
  - Added an explicit `onConflict: "reference"` target for `subscription_checkout_sessions` so checkout retries update the same session safely.
- What is left:
  - Redeploy `workspace-subscriptions` so the hotfix is live.
  - Re-run the paid checkout flow from `/pricing`.
- How to test:
  1. Redeploy `workspace-subscriptions`.
  2. Sign in as a workspace owner or admin.
  3. Open `/pricing` and choose `Growth` or `Business`.
  4. Confirm the network request to `functions/v1/workspace-subscriptions` returns `200` with a checkout payload instead of `500`.
  5. Confirm the browser redirects to Paystack checkout.
  6. Complete the Paystack test payment and confirm `/pricing/confirmed` verifies the reference successfully.
- Verification:
  - `npm run lint`: deferred for this hotfix
  - `npm run test`: deferred for this hotfix
  - `npm run build`: deferred for this hotfix

### Update: 2026-04-22 (Paid Signup Email Validation Hotfix)

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Fixed the remaining paid-plan checkout failure for new users signing up with test-only email domains.
- Files changed:
<<<<<<<< HEAD:docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md
  - `docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
========
  - `docs/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
>>>>>>>> main:docs/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md
  - `docs/admin-console/STATUS_TRACKER.md`
  - `supabase/functions/workspace-subscriptions/index.ts`
- What was implemented:
  - Imported the missing `initializePaystackSubscriptionCheckout` helper so paid plan checkout can actually call Paystack.
  - Added validation that blocks paid checkout for test-only domains like `.test` and `.local` before calling Paystack.
  - Mapped Paystack invalid-email failures to `400` responses instead of generic `500` errors.
- What is left:
  - If you want fake-address QA flows for paid subscriptions, create a documented testing convention that uses syntactically valid domains accepted by Paystack.
- How to test:
  1. Sign up with a `.test` email and attempt `Growth` or `Business`.
  2. Confirm the request returns `400` with the validation message instead of `500`.
  3. Sign up with a normal email address such as `name@example.com`.
  4. Attempt `Growth` or `Business` again and confirm the request returns `200` with an `authorizationUrl`.
- Verification:
  - Live function reproduction with `.test` email: returned `400` with the expected validation message
  - Live function reproduction with `@example.com` email: returned `200` with a Paystack checkout URL

### Update: 2026-04-22

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Implemented real Paystack-backed workspace subscription checkout, callback verification, webhook sync, and pricing-page wiring.
- Files changed:
<<<<<<<< HEAD:docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md
  - `docs/tracking/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
========
  - `docs/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md`
>>>>>>>> main:docs/SUBSCRIPTION_IMPLEMENTATION_TRACKER.md
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
  - Added real paid-plan checkout initialization through Paystack recurring billing.
  - Added checkout-session persistence so callback verification and webhook sync can reconcile the same subscription safely.
  - Added a subscription confirmation page at `/pricing/confirmed`.
  - Synced Paystack lifecycle events back into `business_subscriptions`.
  - Updated public pricing copy to reflect real Starter versus paid-plan behavior.
- What is left:
  - Apply the new migration in the target Supabase project.
  - Redeploy `workspace-subscriptions` and `paystack-webhook`.
  - Run the end-to-end Paystack test flow in the target environment.
  - Decide how paid-to-paid plan switching should behave without creating overlapping recurring subscriptions.
- How to test:
  1. Apply `supabase/migrations/20260422113000_add_workspace_subscription_checkout.sql`.
  2. Redeploy `workspace-subscriptions` and `paystack-webhook`.
  3. Open `/pricing` while signed out, choose `Growth`, and confirm the app preserves the pricing intent through registration or login.
  4. Complete sign-in and confirm the app redirects to Paystack checkout.
  5. Complete the Paystack test payment and confirm the browser returns to `/pricing/confirmed`.
  6. Confirm the workspace subscription shows Paystack provider fields and a next renewal date in `business_subscriptions`.
  7. Refresh `/admin/subscriptions` and confirm the synced record is visible there.
  8. Trigger a supported Paystack subscription webhook event and confirm the subscription record stays in sync.
- Verification:
  - `npm run lint`: passed with 21 existing `react-refresh/only-export-components` warnings and 0 errors
  - `npm run test`: passed
  - `npm run build`: passed
  - `npx vitest run src/lib/subscriptions.test.ts`: passed
  - `deno check`: could not run because `deno` is not installed in this environment

### Update: 2026-04-22 (Deployment)

- Branch: `feature/subscriptions-paystack-billing`
- Based on: `dev` at commit `e1bb175`
- Scope: Applied the new subscription checkout migration to the linked Supabase project and deployed the updated billing edge functions.
- What was implemented:
  - Applied `supabase/migrations/20260422113000_add_workspace_subscription_checkout.sql` to project `qfhjlqskucabzxepqbpl`.
  - Deployed `workspace-subscriptions`.
  - Deployed `paystack-webhook`.
  - Confirmed the live endpoints respond from the project URL:
    - `workspace-subscriptions` returned `401 Missing authorization header`
    - `paystack-webhook` returned `401 Invalid Paystack signature`
- What is left:
  - Deploy the frontend from this branch so the browser-visible pricing flow uses the new code.
  - Run the full Paystack test subscription in a browser session.
- How to test:
  1. Start the app from this branch locally or deploy the frontend build from this branch.
  2. Sign out and open `/pricing`.
  3. Choose `Growth` or `Business` and complete the Paystack test checkout.
  4. Confirm the browser lands on `/pricing/confirmed`.
  5. Confirm the resulting record appears in `/admin/subscriptions`.
- Verification:
  - `supabase db push`: passed
  - `supabase functions deploy workspace-subscriptions`: passed
  - `supabase functions deploy paystack-webhook`: passed
  - direct HTTP probe of `workspace-subscriptions`: returned expected `401 Missing authorization header`
  - direct HTTP probe of `paystack-webhook`: returned expected `401 Invalid Paystack signature`

## Update Template

```md
### Update: YYYY-MM-DD

- Branch:
- Based on:
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
