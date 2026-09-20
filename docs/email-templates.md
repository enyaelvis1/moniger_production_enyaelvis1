# Email templates (Moniger)

This project sends branded emails from Supabase Edge Functions via Resend.

## Shared template

All branded emails are wrapped by `supabase/functions/_shared/branded-email.ts`:

- `renderBrandedEmail(...)`: Moniger header, card layout, button CTA, footer, and a standard “ignore if you didn’t request” note.
- `escapeHtml(...)`: safe HTML escaping helper for template interpolation.
- The header uses `https://<app>/logo.png` (`public/logo.png`) for email-safe rendering.

## Templates using the shared wrapper

- Password reset (admin-triggered): `supabase/functions/admin-console/index.ts`
- Workspace emails (invites, invoice delivery, digest preview): `supabase/functions/workspace-email-delivery/index.ts`
- Payment receipt (with PDF attachment): `supabase/functions/_shared/payment-receipts.ts`

## Static HTML previews

See `docs/email-templates/password-reset.html`, `docs/email-templates/invoice.html`, `docs/email-templates/invite.html`,
`docs/email-templates/digest.html`, `docs/email-templates/receipt.html`.

## Links / redirects

Make sure the following are allowlisted wherever redirect URLs are restricted (e.g. Supabase Auth):

- `https://moniger.net/reset-password`
- `https://www.moniger.net/reset-password`
- `http://localhost:8080/reset-password` (and any other local ports you use)
