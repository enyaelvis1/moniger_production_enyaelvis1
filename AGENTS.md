# AGENTS.md

## Purpose

This file is the operating guide for any AI agent or automated coding assistant working in this repository.

Use it to avoid product misunderstandings, workflow mistakes, unsafe edits, and misleading claims about what Moniger does today.

If this file conflicts with older docs, prefer the docs listed in **Source Of Truth Order** below.

## Project Summary

Moniger is a Supabase-backed finance operations platform for Nigerian businesses. The codebase contains:

- a public marketing site
- an authenticated business workspace
- public invoice payment collection with Paystack
- workspace subscription billing with Paystack
- an internal admin console
- Supabase migrations and edge functions

## Source Of Truth Order

Read these first before making material product, billing, payout, or release changes:

1. [docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md](./docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md)
2. [README.md](./README.md)
3. [docs/BRANCHING_STRATEGY.md](./docs/BRANCHING_STRATEGY.md)
4. [docs/OWASP_SECURITY_REVIEW_CHECKLIST.md](./docs/OWASP_SECURITY_REVIEW_CHECKLIST.md)
5. [docs/CLIENT_FEEDBACK_CHECKLIST.md](./docs/CLIENT_FEEDBACK_CHECKLIST.md)
6. [docs/CLIENT_UAT_TESTING_GUIDE.md](./docs/CLIENT_UAT_TESTING_GUIDE.md)
7. [docs/payouts/OUTGOING_PAYOUTS_IMPLEMENTATION_CHECKLIST.md](./docs/payouts/OUTGOING_PAYOUTS_IMPLEMENTATION_CHECKLIST.md)
8. The current release notes in [docs/releases](./docs/releases)

When updating behavior, also update the relevant doc above.

## Non-Negotiable Product Truths

Agents must not misstate any of the following:

### 1. Workspace billing

- `Starter` can activate without paid checkout.
- Paid workspace plans (`Growth`, `Business`) use Paystack recurring checkout.
- Subscription confirmation happens at `/pricing/confirmed`.

### 2. Customer invoice collection

- Public invoice payment links are implemented.
- Paystack initialize, callback verification, webhook settlement, and receipt delivery are implemented.

### 3. Marketplace routing

- Marketplace routing currently refers to **incoming customer payment routing** using Paystack subaccounts and split configuration.
- Workspace users manage payout destination details.
- Platform admins manage Moniger fee-rule / split configuration.
- This is **not** the same thing as outgoing vendor payouts.

### 4. Outgoing payables are not yet real money movement

This is one of the most important repo truths:

- `Bills -> Pay now` currently marks a bill as paid internally and creates a completed payable payment record.
- `Schedule Payment` currently tracks a scheduled payable state internally.
- There is **no workspace wallet yet**.
- There is **no real outgoing vendor bank transfer engine yet**.
- Do not describe outgoing bill payments as provider-executed disbursements unless that capability is actually built.

Use [docs/payouts/OUTGOING_PAYOUTS_IMPLEMENTATION_CHECKLIST.md](./docs/payouts/OUTGOING_PAYOUTS_IMPLEMENTATION_CHECKLIST.md) for the future real payout engine.

### 5. Live billing status

- Production-domain Paystack flows work.
- The repo docs currently state that true live-money cutover is still pending final live-key rollout and verification.
- Do not claim full live-money verification is complete unless the source-of-truth doc has been updated accordingly.

## Branch Workflow

This repo uses:

- `main`: production-ready branch
- `develop`: integration branch
- `feature/*`: new features
- `fix/*`: non-production fixes
- `hotfix/*`: urgent production fixes from `main`

Rules:

- New work should start from `develop`.
- New work should merge into `develop` first.
- Do not commit feature work directly to `main`.
- Treat direct commits to `develop` as exceptional and usually limited to release or coordination work.

See [docs/BRANCHING_STRATEGY.md](./docs/BRANCHING_STRATEGY.md).

## Release Rules

When creating a release:

- create a release branch like `release/vX.Y.Z-rc.N`
- add a release note markdown file in [docs/releases](./docs/releases)
- always include:
  - release title
  - release description
  - included changes
  - verification performed
  - known notes
- create an annotated git tag with a meaningful title and description

Do not create bare or undocumented release tags.

## Security Rules

These are already enforced or intentionally designed into the project. Do not undo them casually:

- `APP_BASE_URL` is required for security-sensitive link generation.
- Do not reintroduce request `Origin` fallback for reset, invite, or billing links.
- Supabase auth session persistence has been moved from `localStorage` to per-tab `sessionStorage`.
- Reset tokens must be scrubbed from the browser URL after session setup.
- Public subscription confirmation is intentionally minimal and read-only for signed-out users.
- Browser security headers are configured through `vercel.json`.

Before release-sensitive changes, review:

- [docs/OWASP_SECURITY_REVIEW_CHECKLIST.md](./docs/OWASP_SECURITY_REVIEW_CHECKLIST.md)

## Required Verification Habits

At minimum, agents should run the smallest relevant checks for the area they changed.

After every non-trivial implementation:

- run the smallest relevant verification before handing work back
- prefer a targeted check first, then widen only if needed
- if the change touches migrations, payouts, billing, security, or release behavior, include the relevant domain check in the same pass when possible
- if a check cannot be run, say so clearly and explain the gap
- if schema or edge-function changes are part of the task, apply the migration and deploy the function when needed, assuming Supabase access is already available
- always include a short "how to test" handoff so the next step is clear

### Always prefer these

- `npm run build`
- targeted `npm run test -- <files>` for touched units

### Security / release-sensitive changes

- `npm run verify:release:security`

### Payment route / hosted app checks

- `npm run verify:production:routes`

### Routed webhook verification

- `npm run verify:webhook:routed`

### Production-domain checkout initialization checks

- `npm run verify:production:live-init`

If you cannot run a relevant check, say so clearly.

## Git Handoff And Pushing

- Do not push changes unless the user asks for it or the current task explicitly needs a shared branch handoff.
- When a push is needed, verify the work first, then push the current working branch rather than `main`.
- Keep branch workflow aligned with `develop` unless the user explicitly requests a different target.
- If the branch or remote target is unclear, pause and confirm before pushing.

## Supabase Apply And Deploy

- If you are already logged into Supabase and the task changes a migration, apply it with the appropriate Supabase CLI workflow before handing the work back.
- If you change an edge function, deploy that function with the appropriate Supabase CLI workflow when the task requires the change to be live.
- Prefer the narrowest apply/deploy command that matches the change instead of re-running unrelated database or function operations.

## Documentation Maintenance Rules

When you change behavior, update docs in the same work when practical.

### Update these when relevant

- implementation status or delivery state:
  - [docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md](./docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md)
- client-visible completed fixes:
  - [docs/CLIENT_FEEDBACK_CHECKLIST.md](./docs/CLIENT_FEEDBACK_CHECKLIST.md)
- client test steps:
  - [docs/CLIENT_UAT_TESTING_GUIDE.md](./docs/CLIENT_UAT_TESTING_GUIDE.md)
- security changes:
  - [docs/OWASP_SECURITY_REVIEW_CHECKLIST.md](./docs/OWASP_SECURITY_REVIEW_CHECKLIST.md)
- outgoing payout architecture:
  - [docs/payouts/OUTGOING_PAYOUTS_IMPLEMENTATION_CHECKLIST.md](./docs/payouts/OUTGOING_PAYOUTS_IMPLEMENTATION_CHECKLIST.md)
- release scope:
  - add or update a file in [docs/releases](./docs/releases)

## Terminology Rules

Use these terms carefully:

- `workspace subscription`: the company paying Moniger for access to the product
- `public invoice payment`: a customer paying an invoice through Paystack
- `marketplace routing`: routing incoming customer funds to a workspace payout destination with Moniger fee retention
- `outgoing payout`: a real vendor/bill disbursement from workspace funds
- `wallet`: not implemented yet for outgoing payouts

Do not mix these up in code comments, docs, UI copy, or status updates.

## High-Risk Mistakes To Avoid

- Do not describe current `Pay now` bills flow as a real bank payout.
- Do not expose Moniger fee-rule editing to normal workspace users.
- Do not bypass signed-in verification paths for private subscription details.
- Do not claim production is on Paystack live keys unless the source-of-truth doc confirms it.
- Do not reintroduce broad persistent auth storage in `localStorage`.
- Do not create release tags without release notes and annotated tag messages.

## Infrastructure Notes

Current important webhook:

- Paystack webhook:
  - `https://qfhjlqskucabzxepqbpl.supabase.co/functions/v1/paystack-webhook`

Current important project scripts are documented in [README.md](./README.md).

## How To Approach Work Safely

1. Read the source-of-truth docs first.
2. Confirm whether the requested behavior already exists.
3. Avoid changing product semantics casually, especially around billing, payouts, and status labels.
4. Keep branch workflow aligned with `develop`.
5. Run the narrowest meaningful verification.
6. Update docs alongside implementation.
7. Be explicit about what is implemented, what is simulated, and what is still pending.

## If You Are Unsure

When uncertain:

- trust the code and the source-of-truth docs over assumptions
- prefer conservative language in docs and UI
- do not imply real money movement where only internal bookkeeping exists
- leave a clear note in docs if the product state changed materially
