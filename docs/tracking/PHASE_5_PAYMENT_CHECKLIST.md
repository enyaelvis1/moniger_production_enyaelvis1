# Phase 5 Payment Checklist

Last updated: 2026-04-14

## Goal

Ship real invoice payment collection through Paystack, then layer in receipts, webhook automation, reporting updates, and later payout research.

For the current cross-platform remaining-work view, especially after the May 20, 2026 Paystack marketplace clarification, use `docs/tracking/IMPLEMENTATION_SOURCE_OF_TRUTH.md`.

## Status Snapshot

| Feature | Status | Scope | Notes |
| --- | --- | --- | --- |
| Public invoice payment page | Done | `/pay/:paymentToken` and `/pay/:paymentToken/confirmed` | Customers can open a secure public invoice link, review the invoice, continue to Paystack, and return to a confirmation page |
| Secure payment-link tokens | Done | `invoices.payment_public_token`, `payment_link_enabled` | Public invoice access now uses random payment tokens instead of raw invoice IDs |
| Paystack checkout initialize flow | Done | `supabase/functions/paystack-payments` | The backend now initializes hosted Paystack checkout using the official transaction initialize API |
| Paystack callback verification flow | Done | `verify-payment` action in `paystack-payments` | The confirmation page verifies the reference server-side and marks the invoice paid immediately |
| Invoice-side payment-link sharing | Done | Invoices list and invoice detail drawer | Users can copy, open, and WhatsApp-share invoice payment links from the app |
| Payment record sync for Paystack collections | Done | Existing linked invoice payment row | The current invoice-linked payment row is upgraded to Paystack pending/completed states instead of creating a duplicate record |
| Paystack webhook handling | Done | Webhook-triggered confirmation | A dedicated `paystack-webhook` Edge Function now validates Paystack signatures, verifies transactions server-side, and marks invoices paid idempotently from `charge.success` events |
| Payment receipt PDF + email delivery | Done | Receipt generation + backend email | Successful Paystack settlements now generate a PDF receipt, email it automatically through Resend, and log the delivery outcome for retries |
| Dashboard/report live updates from webhook events | Remaining | Metrics, reports, notifications | Still needed once webhook confirmation is in place |
| Flutterwave payouts research | Remaining | Vendor payout future phase | Still a later-scoping item, not part of the current receiving-payments slice |

## Current Build Result

This phase is now in progress, not blocked:

- public payment link flow is implemented
- Paystack checkout initialize flow is implemented
- Paystack callback verification flow is implemented
- invoice payment link sharing inside the app is implemented

The remaining work is mainly reporting polish and later payout research.

## Remaining Work

1. Update dashboard/reporting metrics from confirmed Paystack payments.
2. Document Flutterwave payout requirements for the later vendor-payout phase.

## Exit Criteria

- a test invoice can be paid end to end through Paystack on the live domain
- webhook confirmation updates the invoice to `paid` even if the customer closes the callback tab
- a payment receipt PDF is generated and emailed automatically
- the dashboard and payments views reflect the confirmed payment correctly
- payment links work when copied, opened in a new browser, and shared via WhatsApp
