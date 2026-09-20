import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

const hasFlag = (flag) => process.argv.includes(flag);

const readEnvValue = (envContents, key) => {
  const match = envContents.match(new RegExp(`^${key}="([^"]*)"$`, "m"));
  return match?.[1] ?? "";
};

const envContents = readFileSync(".env", "utf8");
const projectRef = readEnvValue(envContents, "VITE_SUPABASE_PROJECT_ID");
const supabaseUrl = readEnvValue(envContents, "VITE_SUPABASE_URL");
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  readEnvValue(envContents, "VITE_SUPABASE_PUBLISHABLE_KEY");
const baseUrl = (process.env.PLAYWRIGHT_BASE_URL?.trim() || "https://moniger.net").replace(/\/$/, "");
const workspaceEmail = process.env.PLAYWRIGHT_E2E_EMAIL?.trim().toLowerCase() || "";
const workspacePassword = process.env.PLAYWRIGHT_E2E_PASSWORD?.trim() || "";
const payerEmail = workspaceEmail;
const completeTestMode = hasFlag("--complete-test-mode");

if (!projectRef || !supabaseUrl || !publishableKey) {
  console.error("Missing Supabase project connection values.");
  process.exit(1);
}

if (!workspaceEmail || !workspacePassword) {
  console.error("Missing PLAYWRIGHT_E2E_EMAIL or PLAYWRIGHT_E2E_PASSWORD.");
  process.exit(1);
}

let serviceRoleKey = "";

try {
  const keys = JSON.parse(
    execSync(`supabase projects api-keys --project-ref ${projectRef} --output json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );

  serviceRoleKey = keys.find((key) => key.id === "service_role")?.api_key ?? "";
} catch {
  console.error("Unable to retrieve the service role key from the Supabase CLI.");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("No service role key was returned for the linked Supabase project.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const browserSnapshot = async (url) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3_000);

    const title = await page.title();
    const bodyText = (await page.locator("body").innerText()).slice(0, 1500);

    return {
      finalUrl: page.url(),
      title,
      bodyText,
    };
  } finally {
    await browser.close();
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runTestModeCheckout = async ({ expectedUrlPattern, url }) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  try {
    await page.goto(url, {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3_000);

    const bodyText = await page.locator("body").innerText();
    if (!bodyText.includes("TEST")) {
      throw new Error("Refusing to complete checkout because the provider page is not marked as TEST.");
    }

    const testCard = page.locator('[data-testid="testCard-0"]');
    if (await testCard.count()) {
      await testCard.click();
    } else {
      await page.getByText(/^Success$/).click();
    }

    await page.getByRole("button", { name: /pay ngn/i }).click();
    await page.waitForURL(expectedUrlPattern, {
      timeout: 90_000,
    });
    await page.waitForTimeout(12_000);

    return {
      finalUrl: page.url(),
      title: await page.title(),
      bodyText: (await page.locator("body").innerText()).slice(0, 3000),
    };
  } finally {
    await browser.close();
  }
};

const listAllUsers = async () => {
  const users = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    users.push(...(data?.users ?? []));
    hasNextPage = Boolean(data?.users?.length) && (data?.users?.length ?? 0) === 200;
    page += 1;
  }

  return users;
};

const findWorkspaceContext = async () => {
  const users = await listAllUsers();
  const authUser = users.find((user) => user.email?.trim().toLowerCase() === workspaceEmail);

  if (!authUser?.id) {
    throw new Error(`No auth user found for ${workspaceEmail}.`);
  }

  const businessResponse = await adminClient
    .from("businesses")
    .select("id, name, owner_user_id")
    .eq("owner_user_id", authUser.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessResponse.error) {
    throw businessResponse.error;
  }

  if (!businessResponse.data?.id) {
    throw new Error(`No workspace found for ${workspaceEmail}.`);
  }

  return {
    businessId: businessResponse.data.id,
    businessName: businessResponse.data.name,
    userId: authUser.id,
  };
};

const ensureCustomer = async ({ businessId, userId }) => {
  const customerEmail = "qa-customer@moniger.net";
  const existingResponse = await adminClient
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("email", customerEmail)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingResponse.error) {
    throw existingResponse.error;
  }

  if (existingResponse.data?.id) {
    return existingResponse.data.id;
  }

  const createResponse = await adminClient
    .from("customers")
    .insert({
      business_id: businessId,
      created_by: userId,
      email: customerEmail,
      name: "Production QA Customer",
      notes: "Created by verify-production-live-checkout-init.mjs",
    })
    .select("id")
    .single();

  if (createResponse.error) {
    throw createResponse.error;
  }

  return createResponse.data.id;
};

const createQaInvoice = async ({ businessId, customerId, userId }) => {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const invoiceNumber = `LIVE-QA-${stamp}`;
  const invoiceResponse = await adminClient
    .from("invoices")
    .insert({
      amount_paid: 0,
      business_id: businessId,
      created_by: userId,
      currency: "NGN",
      customer_id: customerId,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      invoice_number: invoiceNumber,
      notes: "Production QA invoice for live checkout initialization only. Do not settle unless explicitly approved.",
      payment_link_enabled: true,
      status: "sent",
      subtotal: 100,
      tax_total: 0,
      total_amount: 100,
      updated_by: userId,
    })
    .select("id, invoice_number, payment_public_token, total_amount, currency")
    .single();

  if (invoiceResponse.error) {
    throw invoiceResponse.error;
  }

  return invoiceResponse.data;
};

const initializeInvoiceCheckout = async ({ paymentToken }) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/paystack-payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "initialize-payment",
      payerEmail,
      payerName: "Production QA Workspace User",
      paymentToken,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Invoice checkout initialization failed.");
  }

  return payload;
};

const initializeSubscriptionCheckout = async ({ businessId }) => {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const signInResponse = await client.auth.signInWithPassword({
    email: workspaceEmail,
    password: workspacePassword,
  });

  if (signInResponse.error || !signInResponse.data.session?.access_token) {
    throw signInResponse.error || new Error("Unable to create a workspace session.");
  }

  const { data, error } = await client.functions.invoke("workspace-subscriptions", {
    body: {
      action: "self.initialize-checkout",
      billingCycle: "monthly",
      businessId,
      plan: "growth",
    },
    headers: {
      Authorization: `Bearer ${signInResponse.data.session.access_token}`,
    },
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== "object" || typeof data.authorizationUrl !== "string" || typeof data.reference !== "string") {
    throw new Error("Unexpected workspace subscription checkout response.");
  }

  return {
    checkoutUrl: data.authorizationUrl,
    reference: data.reference,
  };
};

const waitForInvoiceSettlement = async ({ invoiceId, reference }) => {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    const [invoiceResponse, paymentResponse] = await Promise.all([
      adminClient
        .from("invoices")
        .select("id, status, amount_paid, balance_due, paid_at, updated_at")
        .eq("id", invoiceId)
        .single(),
      adminClient
        .from("payments")
        .select("id, payment_reference, status, gateway_response, metadata, updated_at")
        .eq("invoice_id", invoiceId)
        .eq("payment_reference", reference)
        .maybeSingle(),
    ]);

    if (invoiceResponse.error) throw invoiceResponse.error;
    if (paymentResponse.error) throw paymentResponse.error;

    const invoice = invoiceResponse.data;
    const payment = paymentResponse.data;

    if (invoice?.status === "paid" && payment?.status === "completed") {
      return { invoice, payment };
    }

    await sleep(3000);
  }

  throw new Error("Timed out waiting for invoice settlement after test-mode checkout.");
};

const waitForSubscriptionSettlement = async ({ businessId, reference }) => {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    const [sessionResponse, subscriptionResponse] = await Promise.all([
      adminClient
        .from("subscription_checkout_sessions")
        .select("reference, status, checkout_url, provider_subscription_id, provider_customer_id, verified_at, updated_at")
        .eq("business_id", businessId)
        .eq("reference", reference)
        .single(),
      adminClient
        .from("business_subscriptions")
        .select("business_id, plan, billing_cycle, status, provider, provider_plan_code, provider_subscription_id, last_payment_reference, next_renewal_at, updated_at")
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (sessionResponse.error) throw sessionResponse.error;
    if (subscriptionResponse.error) throw subscriptionResponse.error;

    const checkoutSession = sessionResponse.data;
    const subscription = subscriptionResponse.data;

    if (
      checkoutSession?.status === "completed" &&
      subscription?.status === "active" &&
      subscription?.last_payment_reference === reference
    ) {
      return { checkoutSession, subscription };
    }

    await sleep(3000);
  }

  throw new Error("Timed out waiting for workspace subscription settlement after test-mode checkout.");
};

const main = async () => {
  const workspace = await findWorkspaceContext();
  const customerId = await ensureCustomer({
    businessId: workspace.businessId,
    userId: workspace.userId,
  });
  const invoice = await createQaInvoice({
    businessId: workspace.businessId,
    customerId,
    userId: workspace.userId,
  });
  const invoicePaymentPath = `/pay/${invoice.payment_public_token}`;
  const invoicePage = await browserSnapshot(`${baseUrl}${invoicePaymentPath}`);
  const invoiceCheckout = await initializeInvoiceCheckout({
    paymentToken: invoice.payment_public_token,
  });
  const invoiceProviderPage = await browserSnapshot(invoiceCheckout.authorizationUrl);
  const invoiceCompletion = completeTestMode
    ? await runTestModeCheckout({
      expectedUrlPattern: new RegExp(`/pay/${invoice.payment_public_token}/confirmed\\?`),
      url: invoiceCheckout.authorizationUrl,
    })
    : null;
  const invoiceSettlement = completeTestMode
    ? await waitForInvoiceSettlement({
      invoiceId: invoice.id,
      reference: invoiceCheckout.reference,
    })
    : null;

  const subscriptionCheckout = await initializeSubscriptionCheckout({
    businessId: workspace.businessId,
  });
  const subscriptionProviderPage = await browserSnapshot(subscriptionCheckout.checkoutUrl);
  const subscriptionCompletion = completeTestMode
    ? await runTestModeCheckout({
      expectedUrlPattern: /\/pricing\/confirmed\?/,
      url: subscriptionCheckout.checkoutUrl,
    })
    : null;
  const subscriptionSettlement = completeTestMode
    ? await waitForSubscriptionSettlement({
      businessId: workspace.businessId,
      reference: subscriptionCheckout.reference,
    })
    : null;

  console.log(
    JSON.stringify(
      {
        baseUrl,
        completeTestMode,
        invoice: {
          amount: invoice.total_amount,
          currency: invoice.currency,
          completion: invoiceCompletion,
          initializationReference: invoiceCheckout.reference,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          settled: invoiceSettlement,
          paymentPath: invoicePaymentPath,
          paymentToken: invoice.payment_public_token,
          providerPage: invoiceProviderPage,
          providerUrl: invoiceCheckout.authorizationUrl,
          publicPage: invoicePage,
        },
        note: completeTestMode
          ? "This verification completed production-domain Paystack TEST-mode checkouts end-to-end without charging real money."
          : "This verification stops at live checkout initialization. No payment was completed.",
        subscription: {
          businessId: workspace.businessId,
          businessName: workspace.businessName,
          completion: subscriptionCompletion,
          providerPage: subscriptionProviderPage,
          providerUrl: subscriptionCheckout.checkoutUrl,
          reference: subscriptionCheckout.reference,
          settled: subscriptionSettlement,
        },
      },
      null,
      2,
    ),
  );
};

await main();
