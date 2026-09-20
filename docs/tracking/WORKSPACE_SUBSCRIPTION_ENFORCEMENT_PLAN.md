# Workspace Subscription Enforcement Checklist

## Why this doc exists

The subscription checkout flow is already implemented, but the app still does not use subscription state to control workspace access or feature availability.

This checklist turns the enforcement gap into a build plan we can work through and adjust as the admin pricing rules evolve.

## Pricing / plan source of truth

These plan definitions should stay aligned everywhere they are shown:

- landing page pricing
- `/pricing`
- admin subscription controls
- entitlement checks

Canonical plan copy to keep in sync:

- Starter
  - Free
  - Up to 10 invoices/month
  - 1 team member
  - Basic payment tracking
  - Email support
- Growth
  - NGN 29,000/mo
  - Unlimited invoices
  - 5 team members
  - Approval workflows
  - Priority support
- Business
  - NGN 89,000/mo
  - Advanced permissions
  - Unlimited team members
  - CSV and PDF exports
  - Dedicated onboarding

## Checklist

### 1. Define the entitlement model

- [ ] Confirm which pages and features stay available on Starter.
- [ ] Confirm which pages and features require an active paid subscription.
- [ ] Decide whether expired or cancelled workspaces keep read-only access.
- [ ] Decide whether a grace period applies after payment failure.
- [ ] Confirm whether the dashboard stays visible for unpaid workspaces.

### 2. Make pricing admin-adjustable

- [x] Centralize plan names, prices, and benefit copy in one shared source.
- [x] Add admin controls for editing plan price text and feature bullets.
- [x] Make the landing pricing page and `/pricing` read from the same source.
- [x] Keep the public copy aligned with what admins can change.

### 3. Add a workspace subscription query

- [x] Load the active workspace subscription in a shared hook or workspace context.
- [x] Derive helper flags like `isActive`, `isPaidPlan`, `isGracePeriod`, and `isCancelled`.
- [x] Keep the subscription record as the source of truth for access decisions.

### 4. Add entitlement gates

- [x] Add a reusable gate for paid-plan-only workspace pages.
- [x] Gate premium features individually instead of blocking the whole app.
- [x] Keep sign-in, MFA, starter access, subscription pages, and admin tools available.
- [x] Show plan options before checkout from the workspace profile upgrade path.

### 5. Add user-facing status messaging

- [x] Show a clear banner when a workspace is inactive, unpaid, or in grace period.
- [x] Explain why the feature is unavailable.
- [x] Show the current subscription status and next action.

### 6. Test the enforcement paths

- [ ] Starter workspace can sign in and use the base app.
- [ ] Active paid workspace can access gated features.
- [ ] Paused or cancelled workspace sees the correct message.
- [ ] Subscription confirmation still syncs the database record.
- [ ] Admin edits still update the underlying status correctly.

## Recommended hook points

The most useful places to enforce this are:

- a shared workspace subscription query
- the workspace shell/header
- route-level guards for premium pages
- feature-level checks for tools that should be plan-aware

## Notes

- The current app only protects routes with sign-in and MFA.
- The subscription flow records and syncs state, but it does not yet enforce access in the workspace shell.
- The public pricing cards now read from one shared catalog, so landing page and `/pricing` stay aligned.
- The landing CTA now says `Subscribe now` to keep the public pricing copy neutral.
- The pricing catalog is now editable in admin settings and published through the public site config endpoint.
- The workspace shell now shows a subscription status banner, and `/reports` plus `/audit-trail` now show an in-app workspace upgrade page with direct checkout and a highlighted current-plan summary when the plan is not active.
- The workspace profile upgrade action now opens a plan comparison dialog first, so users can review the available plans before starting checkout.
- If the admin changes pricing, the landing page should be updated from the same source so the public copy stays honest.
