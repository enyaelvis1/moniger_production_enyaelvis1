import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const readEnvValue = (envContents, key) => {
  const match = envContents.match(new RegExp(`^${key}="([^"]*)"$`, "m"));
  return match?.[1] ?? "";
};

const readArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
};

const hasFlag = (flag) => process.argv.includes(flag);

const envContents = readFileSync(".env", "utf8");
const projectRef = readEnvValue(envContents, "VITE_SUPABASE_PROJECT_ID");
const supabaseUrl = readEnvValue(envContents, "VITE_SUPABASE_URL");

if (!projectRef || !supabaseUrl) {
  console.error("Missing VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_URL in .env.");
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
  console.error("Unable to retrieve the service role key from the Supabase CLI. Make sure you are logged in with `supabase login`.");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("No service role key was returned for the linked Supabase project.");
  process.exit(1);
}

const businessId = readArgValue("--business-id") || "65c9462b-8f1c-4e14-a473-009981b8a9ab";
const ownerUserId = readArgValue("--owner-user-id") || "c14c5598-b34d-4be9-9f4e-996431ac28e6";
const amount = Number(readArgValue("--amount") || "2600");
const requireWebhook = hasFlag("--require-webhook");
const callbackWaitMs = Number(readArgValue("--callback-wait-ms") || "15000");
const webhookWaitMs = Number(readArgValue("--webhook-wait-ms") || "30000");
const generatedStamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const customerEmail = readArgValue("--customer-email") || `routing-proof-${generatedStamp}@example.com`;
const customerName = readArgValue("--customer-name") || "Routing Proof Customer";

if (!Number.isFinite(amount) || amount <= 0) {
  console.error("Use a positive number for --amount.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const startedAtIso = new Date().toISOString();
const invoiceNumber = `ROUTE-${generatedStamp}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createCustomer = async () => {
  const response = await adminClient
    .from("customers")
    .insert({
      business_id: businessId,
      created_by: ownerUserId,
      email: customerEmail,
      name: customerName,
    })
    .select("id")
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data.id;
};

const createInvoice = async (customerId) => {
  const today = new Date();
  const dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const response = await adminClient
    .from("invoices")
    .insert({
      amount_paid: 0,
      business_id: businessId,
      created_by: ownerUserId,
      currency: "NGN",
      customer_id: customerId,
      due_date: dueDate.toISOString().slice(0, 10),
      invoice_number: invoiceNumber,
      issue_date: today.toISOString().slice(0, 10),
      payment_link_enabled: true,
      sent_at: today.toISOString(),
      status: "sent",
      subtotal: amount,
      tax_total: 0,
      total_amount: amount,
      updated_by: ownerUserId,
    })
    .select("id, invoice_number, payment_public_token")
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const initializePayment = async (paymentToken) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/paystack-payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "initialize-payment",
      payerEmail: customerEmail,
      payerName: customerName,
      paymentToken,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Unable to initialize payment: ${JSON.stringify(payload)}`);
  }

  return payload;
};

const pollPaymentState = async (invoiceId, reference) => {
  const deadline = Date.now() + webhookWaitMs;
  let payment = null;
  let invoice = null;
  let webhookEvents = [];

  while (Date.now() < deadline) {
    const [paymentResponse, invoiceResponse, webhookResponse] = await Promise.all([
      adminClient
        .from("payments")
        .select("id, status, gateway_response, metadata, updated_at")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("invoices")
        .select("id, status, amount_paid, balance_due, paid_at, updated_at")
        .eq("id", invoiceId)
        .single(),
      adminClient
        .from("platform_webhook_events")
        .select("id, event_type, status, business_id, received_at, processed_at, error_message, payload")
        .gte("received_at", startedAtIso)
        .order("received_at", { ascending: false })
        .limit(50),
    ]);

    if (paymentResponse.error) throw paymentResponse.error;
    if (invoiceResponse.error) throw invoiceResponse.error;
    if (webhookResponse.error) throw webhookResponse.error;

    payment = paymentResponse.data;
    invoice = invoiceResponse.data;
    webhookEvents = (webhookResponse.data ?? []).filter((event) => JSON.stringify(event).includes(reference));

    const callbackSettled = payment?.status === "completed" || invoice?.status === "paid";
    const webhookSeen = webhookEvents.length > 0;

    if (callbackSettled && (!requireWebhook || webhookSeen)) {
      break;
    }

    await sleep(3000);
  }

  return {
    invoice,
    payment,
    webhookEvents,
  };
};

let verifyResponsePayload = null;
let verifyResponseStatus = null;

const runCheckout = async (authorizationUrl) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  page.on("response", async (response) => {
    if (!response.url().includes("functions/v1/paystack-payments")) {
      return;
    }

    try {
      verifyResponseStatus = response.status();
      verifyResponsePayload = await response.json();
    } catch {
      verifyResponsePayload = null;
    }
  });

  await page.goto(authorizationUrl, {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(3000);
  await page.locator('[data-testid="testCard-0"]').click();
  await page.getByRole("button", { name: /pay ngn/i }).click();
  await page.waitForURL(/\/pay\/.*\/confirmed\?/, {
    timeout: 60_000,
  });
  await page.waitForTimeout(callbackWaitMs);

  const finalUrl = page.url();
  const finalText = (await page.locator("body").innerText()).slice(0, 4000);

  await browser.close();

  return {
    finalText,
    finalUrl,
  };
};

try {
  const customerId = await createCustomer();
  const invoice = await createInvoice(customerId);
  const initialization = await initializePayment(invoice.payment_public_token);
  const checkout = await runCheckout(initialization.authorizationUrl);
  const state = await pollPaymentState(invoice.id, initialization.reference);
  const webhookReceived = state.webhookEvents.length > 0;
  const callbackSettled = state.payment?.status === "completed" && state.invoice?.status === "paid";

  const summary = {
    businessId,
    callbackSettled,
    callbackVerificationResponse: verifyResponsePayload,
    callbackVerificationStatus: verifyResponseStatus,
    checkout,
    customerEmail,
    invoice,
    paymentReference: initialization.reference,
    paymentRow: state.payment,
    webhookEventCount: state.webhookEvents.length,
    webhookEvents: state.webhookEvents.map((event) => ({
      errorMessage: event.error_message,
      eventType: event.event_type,
      id: event.id,
      processedAt: event.processed_at,
      receivedAt: event.received_at,
      status: event.status,
    })),
    webhookReceived,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!callbackSettled) {
    process.exit(1);
  }

  if (requireWebhook && !webhookReceived) {
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
