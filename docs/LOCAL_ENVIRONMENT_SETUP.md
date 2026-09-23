# Local and production environment setup

This project uses a production Supabase project for the deployed application. Local payment testing must not use the production frontend configuration, because the hosted Edge Function uses its configured `APP_BASE_URL` to build Paystack callbacks.

## Local Supabase

Use the local Supabase CLI stack for isolated development data and local callbacks:

```bash
supabase start
cp .env.example .env.local
cp supabase/functions/.env.example supabase/functions/.env
```

Copy the local publishable key printed by `supabase start` into `.env.local`. Keep the local function secret as:

```text
APP_BASE_URL=http://localhost:8080
PAYSTACK_SECRET_KEY=sk_test_...
```

Start the frontend and serve the subscription function locally when testing the checkout flow:

```bash
npm run dev
supabase functions serve workspace-subscriptions --env-file supabase/functions/.env
```

The local frontend should use `http://127.0.0.1:54321` and the local publishable key. Do not point `.env.local` at the production Supabase URL for payment testing.

## Production

Production keeps its own values in the deployed Vercel and Supabase settings:

```text
VITE_PUBLIC_APP_URL=https://www.moniger.net
VITE_APP_BASE_URL=https://www.moniger.net
APP_BASE_URL=https://www.moniger.net
```

Production Edge Functions must continue using the production Paystack configuration. Never replace the production `APP_BASE_URL` with localhost.

## Paystack verification behavior

Paystack can report a successful charge before its recurring subscription record is available. The subscription verification endpoint now keeps that checkout initialized, retries automatically three times, and exposes a manual **Retry verification** action for signed-in users. A successful verification updates `business_subscriptions` to the selected plan and returns the user to the dashboard.

For a failed or delayed checkout, use the reference from `/pricing/confirmed?reference=SUB-...` and inspect:

```sql
select reference, status, plan, business_id, last_error, created_at, verified_at
from subscription_checkout_sessions
where reference = 'SUB-...';

select business_id, plan, status, provider, last_payment_reference, updated_at
from business_subscriptions
where business_id = '...';
```
