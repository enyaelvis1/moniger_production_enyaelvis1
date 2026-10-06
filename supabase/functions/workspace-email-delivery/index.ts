import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  formatTemplateCurrency,
  formatTemplateDate,
  normalizeTemplateLanguage,
  normalizeTemplateLocale,
  translateTemplate,
} from "../_shared/localization.ts";
import { renderBrandedEmail } from "../_shared/branded-email.ts";

type DeliveryAction = "digest-preview" | "invoice-delivery" | "bill-delivery" | "team-invite";

type TeamInviteRequest = {
  action: "team-invite";
  businessId: string;
  inviteeEmail: string;
  invitationToken?: string | null;
  role: string;
};

type DigestPreviewRequest = {
  action: "digest-preview";
  businessId: string;
};

type InvoiceDeliveryRequest = {
  action: "invoice-delivery";
  businessId: string;
  email: string;
  invoiceId: string;
  message?: string | null;
  subject: string;
};
type BillDeliveryRequest = {
  action: "bill-delivery";
  businessId: string;
  billId: string;
  email: string;
};

type DeliveryRequest = DigestPreviewRequest | InvoiceDeliveryRequest | BillDeliveryRequest | TeamInviteRequest;

type NotificationRow = {
  body: string;
  created_at: string;
  title: string;
};

type InvoiceRow = {
  currency: string;
  customer_id: string;
  delivery_attempt_count: number | null;
  due_date: string | null;
  id: string;
  invoice_number: string;
  issue_date: string;
  payment_link_enabled: boolean;
  payment_public_token: string;
  sent_at: string | null;
  status: string;
  total_amount: number | string;
};
type InvoiceItemEmailRow = { description: string; quantity: number | string; unit_price: number | string };

type CustomerRow = {
  email: string | null;
  name: string | null;
};
type BillEmailRow = {
  bill_date: string;
  bill_number: string;
  category: string | null;
  currency: string;
  due_date: string | null;
  id: string;
  notes: string | null;
  status: string;
  subtotal: number | string;
  tax_total: number | string;
  total_amount: number | string;
  vendor_id: string;
};
type VendorEmailRow = { business_name: string; email: string | null };
type BillItemEmailRow = { description: string; quantity: number | string; unit_price: number | string };

type BusinessRow = {
  default_language: string | null;
  default_locale: string | null;
  name: string;
};

type ProfileRow = {
  full_name: string | null;
  language: string | null;
  locale: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatRoleLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const escapeMultilineHtml = (value: string) => escapeHtml(value).replace(/\n/g, "<br />");

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeGreetingLine = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

const stripDuplicateInvoiceGreeting = ({
  customerName,
  greeting,
  message,
  recipientEmail,
}: {
  customerName: string;
  greeting: string;
  message: string;
  recipientEmail: string;
}) => {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return message;
  }

  const lines = trimmedMessage.split(/\r?\n/);
  const firstNonEmptyLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstNonEmptyLineIndex === -1) {
    return message;
  }

  const firstLine = lines[firstNonEmptyLineIndex].trim();
  const comparableGreetingLines = new Set([
    greeting,
    `Hello ${customerName},`,
    `Hello ${recipientEmail},`,
  ].map(normalizeGreetingLine));

  if (!comparableGreetingLines.has(normalizeGreetingLine(firstLine))) {
    return message;
  }

  const remainingLines = lines.slice(firstNonEmptyLineIndex + 1);

  while (remainingLines.length > 0 && remainingLines[0].trim().length === 0) {
    remainingLines.shift();
  }

  return remainingLines.join("\n").trim();
};

const buildInvoiceEmail = ({
  appBaseUrl,
  businessName,
  customerName,
  currency,
  dueDate,
  invoiceNumber,
  items,
  issueDate,
  language,
  locale,
  message,
  paymentUrl,
  paymentStatus,
  recipientEmail,
  subject,
  totalAmount,
  workspaceSlug,
}: {
  appBaseUrl: string;
  businessName: string;
  customerName: string;
  currency: string;
  dueDate: string | null;
  invoiceNumber: string;
  items: InvoiceItemEmailRow[];
  issueDate: string;
  language: string | null | undefined;
  locale: string | null | undefined;
  message: string;
  paymentUrl: string;
  paymentStatus: string;
  recipientEmail: string;
  subject: string;
  totalAmount: string;
  workspaceSlug?: string | null;
}) => {
  const formattedIssueDate = formatTemplateDate(issueDate, locale);
  const formattedDueDate = dueDate ? formatTemplateDate(dueDate, locale) : null;
  const workspaceLine = workspaceSlug ? `Workspace: ${workspaceSlug}` : businessName;
  const heading = translateTemplate(language, "email.invoice.heading", { invoiceNumber });
  const greeting = translateTemplate(language, "email.invoice.greeting", { name: customerName || recipientEmail });
  const sanitizedMessage = stripDuplicateInvoiceGreeting({
    customerName,
    greeting,
    message,
    recipientEmail,
  });
  const invoiceLabel = translateTemplate(language, "email.invoice.invoice");
  const totalLabel = translateTemplate(language, "email.invoice.total");
  const issuedLabel = translateTemplate(language, "email.invoice.issued");
  const dueLabel = translateTemplate(language, "email.invoice.due");
  const payInvoiceLabel = translateTemplate(language, "email.invoice.payInvoice");
  const paymentInstructions = translateTemplate(language, "email.invoice.paymentInstructions");
  const paymentSafetyNote = translateTemplate(language, "email.invoice.paymentSafetyNote");
  const customerLabel = translateTemplate(language, "email.invoice.customer");
  const paymentStatusLabel = translateTemplate(language, "email.invoice.paymentStatus");
  const itemsLabel = translateTemplate(language, "email.invoice.items");
  const descriptionLabel = translateTemplate(language, "email.invoice.description");
  const quantityLabel = translateTemplate(language, "email.invoice.quantity");
  const unitPriceLabel = translateTemplate(language, "email.invoice.unitPrice");
  const lineTotalLabel = translateTemplate(language, "email.invoice.lineTotal");
  const itemRows = items.length
    ? items
        .map((item) => {
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unit_price);
          return `<tr><td style="padding: 9px 8px; border-bottom: 1px solid #E2E8F0; color: #1E293B;">${escapeHtml(item.description)}</td><td style="padding: 9px 8px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #475569;">${escapeHtml(String(quantity))}</td><td style="padding: 9px 8px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #475569;">${escapeHtml(formatTemplateCurrency(unitPrice, currency, locale))}</td><td style="padding: 9px 8px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 600;">${escapeHtml(formatTemplateCurrency(quantity * unitPrice, currency, locale))}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="4" style="padding: 10px 8px; color: #64748B;">No line-item breakdown was recorded.</td></tr>`;
  const itemLines = items.length
    ? items.map((item) => `${item.description} — ${item.quantity} × ${formatTemplateCurrency(Number(item.unit_price), currency, locale)} = ${formatTemplateCurrency(Number(item.quantity) * Number(item.unit_price), currency, locale)}`)
    : ["No line-item breakdown was recorded."];
  const itemsHtml = `<div style="margin: 18px 0;"><h3 style="margin: 0 0 8px; color: #172554; font-size: 16px;">${escapeHtml(itemsLabel)}</h3><table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #DCE2F2; border-radius: 12px; overflow: hidden; font-size: 14px;"><thead><tr style="background: #F8F9FD;"><th style="padding: 9px 8px; text-align: left; color: #475569;">${escapeHtml(descriptionLabel)}</th><th style="padding: 9px 8px; text-align: right; color: #475569;">${escapeHtml(quantityLabel)}</th><th style="padding: 9px 8px; text-align: right; color: #475569;">${escapeHtml(unitPriceLabel)}</th><th style="padding: 9px 8px; text-align: right; color: #475569;">${escapeHtml(lineTotalLabel)}</th></tr></thead><tbody>${itemRows}</tbody></table></div>`;
  const bodyHtml = `
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeMultilineHtml(sanitizedMessage)}</p>
    <div style="margin: 18px 0; padding: 16px; border: 1px solid #DCE2F2; border-radius: 16px; background: #F8F9FD;">
      <p style="margin: 0 0 8px;"><strong>${escapeHtml(customerLabel)}:</strong> ${escapeHtml(customerName)}</p>
      <p style="margin: 0 0 8px;"><strong>${escapeHtml(invoiceLabel)}:</strong> ${escapeHtml(invoiceNumber)}</p>
      <p style="margin: 0 0 8px;"><strong>${escapeHtml(totalLabel)}:</strong> ${escapeHtml(totalAmount)}</p>
      ${formattedIssueDate ? `<p style="margin: 0 0 8px;"><strong>${escapeHtml(issuedLabel)}:</strong> ${escapeHtml(formattedIssueDate)}</p>` : ""}
      ${formattedDueDate ? `<p style="margin: 0 0 8px;"><strong>${escapeHtml(dueLabel)}:</strong> ${escapeHtml(formattedDueDate)}</p>` : ""}
      <p style="margin: 0;"><strong>${escapeHtml(paymentStatusLabel)}:</strong> ${escapeHtml(paymentStatus)}</p>
    </div>
    ${itemsHtml}
    <p>${escapeHtml(paymentInstructions)}</p>
    <p style="font-size: 13px; color: #5B6478;">${escapeHtml(paymentSafetyNote)}</p>
  `;

  const email = renderBrandedEmail({
    subject,
    preheader: `${invoiceLabel} ${invoiceNumber} · ${totalAmount}`,
    heading,
    bodyHtml,
    cta: { href: paymentUrl, label: payInvoiceLabel },
    footerText: workspaceLine,
    logoUrl: `${appBaseUrl}/logo.png`,
    logoAlt: "Moniger",
    brandHref: appBaseUrl,
  });
  const text = [
    greeting,
    "",
    sanitizedMessage,
    "",
    `${customerLabel}: ${customerName}`,
    `${invoiceLabel}: ${invoiceNumber}`,
    `${totalLabel}: ${totalAmount}`,
    ...(formattedIssueDate ? [`${issuedLabel}: ${formattedIssueDate}`] : []),
    ...(formattedDueDate ? [`${dueLabel}: ${formattedDueDate}`] : []),
    `${paymentStatusLabel}: ${paymentStatus}`,
    "",
    `${itemsLabel}:`,
    ...itemLines,
    "",
    paymentInstructions,
    paymentSafetyNote,
    "",
    `${payInvoiceLabel}: ${paymentUrl}`,
    workspaceLine,
  ].join("\n");

  return { ...email, text };
};

const buildInviteEmail = ({
  acceptUrl,
  appBaseUrl,
  businessName,
  inviteeEmail,
  inviterName,
  isPendingInvitation,
  language,
  role,
}: {
  acceptUrl: string | null;
  appBaseUrl: string;
  businessName: string;
  inviteeEmail: string;
  inviterName: string;
  isPendingInvitation: boolean;
  language: string | null | undefined;
  role: string;
}) => {
  const loginUrl = `${appBaseUrl}/login`;
  const primaryUrl = acceptUrl ?? loginUrl;
  const roleLabel = formatRoleLabel(role);
  const subject = isPendingInvitation
    ? translateTemplate(language, "email.invite.subjectPending", { businessName })
    : translateTemplate(language, "email.invite.subjectGranted", { businessName });
  const heading = isPendingInvitation
    ? translateTemplate(language, "email.invite.headingPending")
    : translateTemplate(language, "email.invite.headingGranted");
  const greeting = translateTemplate(language, "email.invite.greeting", { email: inviteeEmail });
  const invitedAs = translateTemplate(language, "email.invite.invitedAs", {
    businessName,
    inviterName,
    roleLabel,
  });
  const instructions = isPendingInvitation
    ? translateTemplate(language, "email.invite.instructionsPending")
    : translateTemplate(language, "email.invite.instructionsGranted");
  const actionLabel = isPendingInvitation
    ? translateTemplate(language, "email.invite.actionPending")
    : translateTemplate(language, "email.invite.actionGranted");
  const footer = translateTemplate(language, "email.invite.footer");
  const bodyHtml = `
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(invitedAs)}</p>
    <p>${escapeHtml(instructions)}</p>
    <p style="margin: 10px 0 0; color:#475569; font-size: 14px;">${escapeHtml(footer)}</p>
  `;

  const email = renderBrandedEmail({
    subject,
    preheader: heading,
    heading,
    bodyHtml,
    cta: { href: primaryUrl, label: actionLabel },
    footerText: businessName,
    logoUrl: `${appBaseUrl}/logo.png`,
    logoAlt: "Moniger",
    brandHref: appBaseUrl,
  });
  const text = [
    greeting,
    "",
    invitedAs,
    instructions,
    primaryUrl,
  ].join("\n");

  return { ...email, text };
};

const buildBillEmail = ({
  appBaseUrl,
  attachmentCount,
  bill,
  businessName,
  items,
  recipientName,
  vendorName,
}: {
  appBaseUrl: string;
  attachmentCount: number;
  bill: BillEmailRow;
  businessName: string;
  items: BillItemEmailRow[];
  recipientName: string;
  vendorName: string;
}) => {
  const subject = `Bill ${bill.bill_number} from ${businessName}`;
  const itemRows = items.length
    ? items.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.description)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${Number(item.quantity)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${formatTemplateCurrency(Number(item.unit_price), bill.currency, "en-NG")}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${formatTemplateCurrency(Number(item.quantity) * Number(item.unit_price), bill.currency, "en-NG")}</td></tr>`).join("")
    : `<tr><td colspan="4" style="padding:8px;color:#64748b">No line-item breakdown was recorded.</td></tr>`;
  const attachmentText = attachmentCount > 0 ? `${attachmentCount} private attachment${attachmentCount === 1 ? "" : "s"} is available in Moniger.` : "No attachment was included with this bill.";
  const bodyHtml = `<p>Hello ${escapeHtml(recipientName)},</p><p>A bill has been recorded for ${escapeHtml(vendorName)} in ${escapeHtml(businessName)}.</p><div style="margin:18px 0;padding:16px;border:1px solid #dce2f2;border-radius:16px;background:#f8f9fd"><p><strong>Bill:</strong> ${escapeHtml(bill.bill_number)}</p><p><strong>Bill date:</strong> ${escapeHtml(bill.bill_date)}</p>${bill.due_date ? `<p><strong>Due date:</strong> ${escapeHtml(bill.due_date)}</p>` : ""}<p><strong>Status:</strong> ${escapeHtml(bill.status)}</p></div><h3>Breakdown</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Description</th><th style="text-align:right;padding:8px">Qty</th><th style="text-align:right;padding:8px">Unit price</th><th style="text-align:right;padding:8px">Line total</th></tr></thead><tbody>${itemRows}</tbody></table><p style="text-align:right"><strong>Subtotal:</strong> ${formatTemplateCurrency(Number(bill.subtotal), bill.currency, "en-NG")}<br /><strong>Tax / charges:</strong> ${formatTemplateCurrency(Number(bill.tax_total), bill.currency, "en-NG")}<br /><strong>Total:</strong> ${formatTemplateCurrency(Number(bill.total_amount), bill.currency, "en-NG")}</p><p style="color:#475569">${escapeHtml(attachmentText)} Private attachments are not exposed by email.</p>${bill.notes ? `<p><strong>Notes:</strong> ${escapeHtml(bill.notes)}</p>` : ""}`;
  const email = renderBrandedEmail({ subject, preheader: `${bill.bill_number} · ${formatTemplateCurrency(Number(bill.total_amount), bill.currency, "en-NG")}`, heading: "Bill breakdown", bodyHtml, footerText: businessName, logoUrl: `${appBaseUrl}/logo.png`, logoAlt: "Moniger", brandHref: appBaseUrl });
  const text = [`Hello ${recipientName},`, `Bill ${bill.bill_number} from ${businessName}`, `Vendor: ${vendorName}`, "", "Breakdown:", ...items.map((item) => `${item.description}: ${item.quantity} × ${formatTemplateCurrency(Number(item.unit_price), bill.currency, "en-NG")}`), "", `Subtotal: ${formatTemplateCurrency(Number(bill.subtotal), bill.currency, "en-NG")}`, `Tax / charges: ${formatTemplateCurrency(Number(bill.tax_total), bill.currency, "en-NG")}`, `Total: ${formatTemplateCurrency(Number(bill.total_amount), bill.currency, "en-NG")}`, attachmentText].join("\n");
  return { ...email, text };
};

const buildDigestEmail = ({
  appBaseUrl,
  businessName,
  language,
  locale,
  notifications,
  recipientName,
}: {
  appBaseUrl: string;
  businessName: string;
  language: string | null | undefined;
  locale: string | null | undefined;
  notifications: NotificationRow[];
  recipientName: string;
}) => {
  const settingsUrl = `${appBaseUrl}/settings?tab=notifications`;
  const digestDate = formatTemplateDate(new Date(), locale);
  const subject = translateTemplate(language, "email.digest.subjectPreview", {
    businessName,
    date: digestDate,
  });
  const heading = translateTemplate(language, "email.digest.headingPreview", { businessName });
  const greeting = translateTemplate(language, "email.digest.greeting", { name: recipientName });
  const intro = translateTemplate(language, "email.digest.introPreview");
  const manageSettingsLabel = translateTemplate(language, "email.digest.manageSettings");
  const emptyState = translateTemplate(language, "email.digest.noRecent");
  const itemsHtml =
    notifications.length > 0
      ? notifications
          .map(
            (item) => `
              <li style="margin-bottom: 12px;">
                <strong>${escapeHtml(item.title)}</strong><br />
                <span style="color: #475569;">${escapeHtml(item.body)}</span>
              </li>
            `,
          )
          .join("")
      : `<li style="margin-bottom: 12px;">${escapeHtml(emptyState)}</li>`;
  const itemsText =
    notifications.length > 0
      ? notifications.map((item) => `- ${item.title}: ${item.body}`).join("\n")
      : `- ${emptyState}`;
  const bodyHtml = `
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(intro)}</p>
    <ul style="padding-left: 20px;">${itemsHtml}</ul>
  `;

  const email = renderBrandedEmail({
    subject,
    preheader: `${businessName} · ${digestDate}`,
    heading,
    bodyHtml,
    cta: { href: settingsUrl, label: manageSettingsLabel },
    footerText: businessName,
    logoUrl: `${appBaseUrl}/logo.png`,
    logoAlt: "Moniger",
    brandHref: appBaseUrl,
  });
  const text = [
    greeting,
    "",
    intro,
    itemsText,
    "",
    `${manageSettingsLabel}: ${settingsUrl}`,
  ].join("\n");

  return { ...email, text };
};

const sendViaResend = async ({
  fromAddress,
  html,
  recipientEmail,
  resendApiKey,
  subject,
  text,
}: {
  fromAddress: string;
  html: string;
  recipientEmail: string;
  resendApiKey: string;
  subject: string;
  text: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [recipientEmail],
      subject,
      html,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof payload?.message === "string" ? payload.message : "The email provider rejected the delivery request.";
    throw new Error(errorMessage);
  }

  return payload as { id?: string };
};

const getAppBaseUrl = (_request: Request) => {
  const configuredUrl = Deno.env.get("APP_BASE_URL")?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  throw new Error("APP_BASE_URL is required for workspace email delivery links.");
};

const toDateOnly = (value?: string | null, fallback = new Date().toISOString().slice(0, 10)) =>
  value ? value.slice(0, 10) : fallback;

const syncInvoicePaymentRecord = async ({
  adminClient,
  amount,
  businessId,
  counterpartyName,
  currency,
  dueDate,
  invoiceId,
  invoiceNumber,
  issueDate,
  status,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  amount: number;
  businessId: string;
  counterpartyName: string;
  currency: string;
  dueDate: string | null;
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  status: string;
  userId: string;
}) => {
  const { data: existingPayment } = await adminClient
    .from("payments")
    .select("id")
    .eq("business_id", businessId)
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  const paymentValues = {
    amount,
    business_id: businessId,
    counterparty_name: counterpartyName,
    created_by: userId,
    currency,
    gateway: "manual",
    gateway_response: status === "overdue" ? "Customer payment is overdue." : "Awaiting customer payment.",
    invoice_id: invoiceId,
    metadata: {
      document_number: invoiceNumber,
      source: "invoices",
      synced_status: status,
    },
    paid_on: toDateOnly(dueDate, issueDate),
    payment_reference: existingPayment?.id ? undefined : `PAY-${Date.now()}-${invoiceNumber.replace(/[^A-Z0-9]/gi, "").slice(-6)}`,
    payment_type: "receivable",
    status: "pending",
  };

  if (existingPayment?.id) {
    await adminClient
      .from("payments")
      .update({
        amount: paymentValues.amount,
        counterparty_name: paymentValues.counterparty_name,
        currency: paymentValues.currency,
        gateway: paymentValues.gateway,
        gateway_response: paymentValues.gateway_response,
        metadata: paymentValues.metadata,
        paid_on: paymentValues.paid_on,
        status: paymentValues.status,
      })
      .eq("id", existingPayment.id);
    return;
  }

  await adminClient.from("payments").insert(paymentValues);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for email delivery." }, 500);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing authorization header." }, 401);
  }

  const requestClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "You need an active session before sending workspace emails." }, 401);
  }

  let payload: DeliveryRequest;
  try {
    payload = (await request.json()) as DeliveryRequest;
  } catch {
    return json({ error: "The email delivery request body is invalid." }, 400);
  }

  if (!payload.businessId || !payload.action) {
    return json({ error: "Missing delivery context." }, 400);
  }

  const { data: membership } = await adminClient
    .from("business_members")
    .select("role, status")
    .eq("business_id", payload.businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.status !== "active") {
    return json({ error: "You no longer have access to this workspace." }, 403);
  }

  const { data: business } = await adminClient
    .from("businesses")
    .select("name, default_language, default_locale")
    .eq("id", payload.businessId)
    .maybeSingle();

  const businessRecord = business as BusinessRow | null;

  if (!businessRecord?.name) {
    return json({ error: "Workspace not found." }, 404);
  }

  const { data: profile } = await adminClient.from("profiles").select("full_name, language, locale").eq("id", user.id).maybeSingle();
  const profileRecord = profile as ProfileRow | null;
  const { data: authUserData } = await adminClient.auth.admin.getUserById(user.id);
  const senderEmail = authUserData.user?.email?.trim().toLowerCase() ?? "";
  const senderName =
    profileRecord?.full_name?.trim() ||
    (typeof authUserData.user?.user_metadata?.name === "string" ? authUserData.user.user_metadata.name.trim() : "") ||
    senderEmail ||
    "A workspace admin";
  const templateLanguage = normalizeTemplateLanguage(profileRecord?.language ?? businessRecord?.default_language);
  const templateLocale = normalizeTemplateLocale(profileRecord?.locale ?? businessRecord?.default_locale);

  const recordDelivery = async ({
    errorMessage = null,
    metadata,
    recipientEmail,
    status,
    subject,
  }: {
    errorMessage?: string | null;
    metadata: Record<string, unknown>;
    recipientEmail: string;
    status: "failed" | "sent";
    subject: string;
  }) => {
    const { data } = await adminClient
      .from("email_deliveries")
      .insert({
        business_id: payload.businessId,
        error_message: errorMessage,
        metadata,
        provider: "resend",
        recipient_email: recipientEmail,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        status,
        subject,
        template_key: payload.action,
      })
      .select("id")
      .single();

    return data?.id ?? null;
  };

  const safeRecordDelivery = async (input: Parameters<typeof recordDelivery>[0]) => {
    try {
      return await recordDelivery(input);
    } catch (recordError) {
      console.error("Unable to record email delivery", recordError);
      return null;
    }
  };

  const safeInsertAuditLog = async (values: {
    action: string;
    detail: Record<string, unknown>;
    entityId: string | null;
    summary: string;
  }) => {
    try {
      await adminClient.from("audit_logs").insert({
        action: values.action,
        actor_user_id: user.id,
        business_id: payload.businessId,
        detail: values.detail,
        entity_id: values.entityId,
        entity_type: "email_delivery",
        summary: values.summary,
      });
    } catch (auditError) {
      console.error("Unable to record email delivery audit log", auditError);
    }
  };

  if (!resendApiKey || !fromAddress) {
    const recipientEmail =
      payload.action === "team-invite"
        ? payload.inviteeEmail.trim().toLowerCase()
        : payload.action === "invoice-delivery"
          ? payload.email.trim().toLowerCase()
          : payload.action === "bill-delivery"
            ? payload.email.trim().toLowerCase()
          : senderEmail;
    const subject =
      payload.action === "team-invite"
        ? translateTemplate(templateLanguage, "email.invite.subjectGranted", { businessName: businessRecord.name })
        : payload.action === "invoice-delivery"
          ? payload.subject.trim()
          : payload.action === "bill-delivery"
            ? "Bill breakdown"
          : translateTemplate(templateLanguage, "email.digest.subjectPreview", {
              businessName: businessRecord.name,
              date: formatTemplateDate(new Date(), templateLocale),
            });

    await safeRecordDelivery({
      errorMessage: "Missing RESEND_API_KEY or EMAIL_FROM_ADDRESS environment configuration.",
      metadata: {
        action: payload.action,
        configured: false,
      },
      recipientEmail,
      status: "failed",
      subject,
    });

    return json(
      {
        error:
          "Email delivery is not configured yet. Add RESEND_API_KEY and EMAIL_FROM_ADDRESS to your Supabase Edge Function secrets.",
      },
      500,
    );
  }

  const appBaseUrl = getAppBaseUrl(request);

  try {
    if (payload.action === "team-invite") {
      if (!["owner", "admin"].includes(membership.role)) {
        return json({ error: "Only owners and admins can send team invite emails." }, 403);
      }

      const inviteeEmail = payload.inviteeEmail.trim().toLowerCase();
      const acceptUrl =
        typeof payload.invitationToken === "string" && payload.invitationToken.trim()
          ? `${appBaseUrl}/accept-invite?token=${encodeURIComponent(payload.invitationToken.trim())}`
          : null;
      const email = buildInviteEmail({
        acceptUrl,
        appBaseUrl,
        businessName: businessRecord.name,
        inviteeEmail,
        inviterName: senderName,
        isPendingInvitation: Boolean(acceptUrl),
        language: templateLanguage,
        role: payload.role,
      });
      const providerResponse = await sendViaResend({
        fromAddress,
        html: email.html,
        recipientEmail: inviteeEmail,
        resendApiKey,
        subject: email.subject,
        text: email.text,
      });
      const deliveryId = await safeRecordDelivery({
        metadata: {
          business_name: businessRecord.name,
          invitation_token_present: Boolean(acceptUrl),
          provider_id: providerResponse.id ?? null,
          role: payload.role,
          sender_email: senderEmail,
          sender_name: senderName,
        },
        recipientEmail: inviteeEmail,
        status: "sent",
        subject: email.subject,
      });

      await safeInsertAuditLog({
        action: "team.invite_email.sent",
        detail: {
          description: `Workspace invite email sent to ${inviteeEmail}.`,
          provider: "resend",
          role: payload.role,
        },
        summary: "Team invite email sent",
        entityId: deliveryId,
      });

      return json({
        deliveryId,
        provider: "resend",
        recipientEmail: inviteeEmail,
        status: "sent",
        subject: email.subject,
      });
    }

    if (payload.action === "invoice-delivery") {
      const recipientEmail = payload.email.trim().toLowerCase();
      const subject = payload.subject.replace(/\s+/g, " ").trim();
      const message = payload.message?.replace(/\r\n/g, "\n").trim() ?? "";

      if (!payload.invoiceId || !recipientEmail || !subject || !message) {
        return json({ error: "Invoice email requires an invoice, recipient email, subject, and message." }, 400);
      }

      if (!isValidEmailAddress(recipientEmail)) {
        return json({ error: "Enter a valid recipient email before sending the invoice." }, 400);
      }

      const { data: invoice } = await adminClient
        .from("invoices")
        .select("id, customer_id, invoice_number, issue_date, due_date, status, total_amount, currency, sent_at, delivery_attempt_count, payment_public_token, payment_link_enabled")
        .eq("business_id", payload.businessId)
        .eq("id", payload.invoiceId)
        .maybeSingle();

      const invoiceRecord = invoice as InvoiceRow | null;

      if (!invoiceRecord) {
        return json({ error: "Invoice not found." }, 404);
      }

      if (invoiceRecord.status === "paid" || invoiceRecord.status === "cancelled") {
        return json({ error: "Paid or cancelled invoices cannot be sent again." }, 400);
      }

      const { data: customer } = await adminClient
        .from("customers")
        .select("name, email")
        .eq("id", invoiceRecord.customer_id)
        .maybeSingle();

      const customerRecord = customer as CustomerRow | null;
      const customerName = customerRecord?.name?.trim() || recipientEmail;
      const { data: invoiceItems, error: invoiceItemsError } = await adminClient
        .from("invoice_items")
        .select("description, quantity, unit_price")
        .eq("invoice_id", invoiceRecord.id)
        .order("line_number", { ascending: true });

      if (invoiceItemsError) {
        return json({ error: "Invoice items could not be loaded for email delivery." }, 500);
      }

      const now = new Date().toISOString();
      const paymentUrl = `${appBaseUrl.replace(/\/+$/, "")}/pay/${encodeURIComponent(invoiceRecord.payment_public_token)}`;
      const nextInvoiceStatus = invoiceRecord.status === "draft" ? "sent" : invoiceRecord.status;
      const isResend =
        (invoiceRecord.delivery_attempt_count ?? 0) > 0 || invoiceRecord.status === "sent" || invoiceRecord.status === "overdue";

      if (!invoiceRecord.payment_link_enabled) {
        const { error: paymentLinkError } = await adminClient
          .from("invoices")
          .update({
            payment_link_enabled: true,
            payment_link_last_shared_at: now,
            updated_by: user.id,
          })
          .eq("id", invoiceRecord.id);

        if (paymentLinkError) {
          return json({ error: "The invoice payment link could not be enabled." }, 500);
        }
      }

      const invoiceEmail = buildInvoiceEmail({
        appBaseUrl,
        businessName: businessRecord.name,
        customerName,
        currency: invoiceRecord.currency,
        dueDate: invoiceRecord.due_date,
        invoiceNumber: invoiceRecord.invoice_number,
        items: (invoiceItems ?? []) as InvoiceItemEmailRow[],
        issueDate: invoiceRecord.issue_date,
        language: templateLanguage,
        locale: templateLocale,
        message,
        paymentUrl,
        paymentStatus: nextInvoiceStatus,
        recipientEmail,
        subject,
        totalAmount: formatTemplateCurrency(invoiceRecord.total_amount, invoiceRecord.currency, templateLocale),
      });

      try {
        const providerResponse = await sendViaResend({
          fromAddress,
          html: invoiceEmail.html,
          recipientEmail,
          resendApiKey,
          subject: invoiceEmail.subject,
          text: invoiceEmail.text,
        });
        const deliveryId = await safeRecordDelivery({
          metadata: {
            business_name: businessRecord.name,
            customer_name: customerName,
            invoice_id: invoiceRecord.id,
            invoice_number: invoiceRecord.invoice_number,
            payment_link_enabled: true,
            provider_id: providerResponse.id ?? null,
            sender_email: senderEmail,
            sender_name: senderName,
          },
          recipientEmail,
          status: "sent",
          subject: invoiceEmail.subject,
        });

        await adminClient
          .from("invoices")
          .update({
            delivery_attempt_count: (invoiceRecord.delivery_attempt_count ?? 0) + 1,
            delivery_email: recipientEmail,
            delivery_last_attempt_at: now,
            delivery_last_error: null,
            delivery_message: message,
            delivery_method: "backend_email",
            delivery_status: "sent",
            delivery_subject: subject,
            sent_at: invoiceRecord.sent_at ?? now,
            status: nextInvoiceStatus,
            updated_by: user.id,
          })
          .eq("id", invoiceRecord.id);

        await syncInvoicePaymentRecord({
          adminClient,
          amount: Number(invoiceRecord.total_amount),
          businessId: payload.businessId,
          counterpartyName: customerName,
          currency: invoiceRecord.currency,
          dueDate: invoiceRecord.due_date,
          invoiceId: invoiceRecord.id,
          invoiceNumber: invoiceRecord.invoice_number,
          issueDate: invoiceRecord.issue_date,
          status: nextInvoiceStatus,
          userId: user.id,
        });

        await safeInsertAuditLog({
          action: isResend ? "invoice.delivery_sent_again" : "invoice.delivery_sent",
          detail: {
            description: `Invoice ${invoiceRecord.invoice_number} emailed to ${recipientEmail}.`,
            invoice_id: invoiceRecord.id,
            invoice_number: invoiceRecord.invoice_number,
            provider: "resend",
            recipient_email: recipientEmail,
          },
          summary: isResend ? "Invoice email resent" : "Invoice email sent",
          entityId: deliveryId,
        });

        await adminClient.from("notifications").insert({
          body: `${invoiceRecord.invoice_number} was emailed to ${recipientEmail} for ${formatTemplateCurrency(invoiceRecord.total_amount, invoiceRecord.currency, templateLocale)}.`,
          business_id: payload.businessId,
          link: "/invoices",
          recipient_user_id: user.id,
          title: isResend ? "Invoice emailed again" : "Invoice emailed",
          type: "invoice",
        });

        return json({
          deliveryId,
          provider: "resend",
          recipientEmail,
          status: "sent",
          subject: invoiceEmail.subject,
        });
      } catch (invoiceError) {
        const errorMessage = invoiceError instanceof Error ? invoiceError.message : "The invoice email could not be sent.";
        const failedDeliveryId = await safeRecordDelivery({
          errorMessage,
          metadata: {
            action: payload.action,
            business_name: businessRecord.name,
            invoice_id: invoiceRecord.id,
            invoice_number: invoiceRecord.invoice_number,
          },
          recipientEmail,
          status: "failed",
          subject,
        });

        await adminClient
          .from("invoices")
          .update({
            delivery_attempt_count: (invoiceRecord.delivery_attempt_count ?? 0) + 1,
            delivery_email: recipientEmail,
            delivery_last_attempt_at: now,
            delivery_last_error: errorMessage,
            delivery_message: message,
            delivery_method: "backend_email",
            delivery_status: "failed",
            delivery_subject: subject,
            updated_by: user.id,
          })
          .eq("id", invoiceRecord.id);

        await safeInsertAuditLog({
          action: "invoice.delivery_failed",
          detail: {
            description: errorMessage,
            invoice_id: invoiceRecord.id,
            invoice_number: invoiceRecord.invoice_number,
            recipient_email: recipientEmail,
          },
          summary: "Invoice email failed",
          entityId: failedDeliveryId,
        });

        return json({ error: errorMessage }, 500);
      }
    }

    if (payload.action === "bill-delivery") {
      const recipientEmail = payload.email.trim().toLowerCase();
      if (!payload.billId || !isValidEmailAddress(recipientEmail)) {
        return json({ error: "Bill email requires a valid vendor email and bill." }, 400);
      }

      const { data: bill } = await adminClient
        .from("bills")
        .select("id, vendor_id, bill_number, bill_date, due_date, status, subtotal, tax_total, total_amount, currency, category, notes")
        .eq("business_id", payload.businessId)
        .eq("id", payload.billId)
        .maybeSingle();
      const billRecord = bill as BillEmailRow | null;
      if (!billRecord) return json({ error: "Bill not found." }, 404);

      const [{ data: vendor }, { data: items }, { count: attachmentCount }] = await Promise.all([
        adminClient.from("vendors").select("business_name, email").eq("business_id", payload.businessId).eq("id", billRecord.vendor_id).maybeSingle(),
        adminClient.from("bill_items").select("description, quantity, unit_price").eq("business_id", payload.businessId).eq("bill_id", billRecord.id).order("line_number", { ascending: true }),
        adminClient.from("bill_attachments").select("id", { count: "exact", head: true }).eq("business_id", payload.businessId).eq("bill_id", billRecord.id),
      ]);
      const vendorRecord = vendor as VendorEmailRow | null;
      const billEmail = buildBillEmail({
        appBaseUrl,
        attachmentCount: attachmentCount ?? 0,
        bill: billRecord,
        businessName: businessRecord.name,
        items: (items ?? []) as BillItemEmailRow[],
        recipientName: vendorRecord?.business_name || recipientEmail,
        vendorName: vendorRecord?.business_name || "vendor",
      });
      const providerResponse = await sendViaResend({ fromAddress, html: billEmail.html, recipientEmail, resendApiKey, subject: billEmail.subject, text: billEmail.text });
      const deliveryId = await safeRecordDelivery({
        metadata: { attachment_count: attachmentCount ?? 0, bill_id: billRecord.id, business_name: businessRecord.name, provider_id: providerResponse.id ?? null },
        recipientEmail,
        status: "sent",
        subject: billEmail.subject,
      });
      await safeInsertAuditLog({
        action: "bill.delivery_email.sent",
        detail: { attachment_count: attachmentCount ?? 0, bill_id: billRecord.id, description: `Bill ${billRecord.bill_number} emailed to ${recipientEmail}.`, provider: "resend" },
        summary: "Bill breakdown email sent",
        entityId: billRecord.id,
      });
      return json({ deliveryId, provider: "resend", recipientEmail, status: "sent", subject: billEmail.subject });
    }

    const notificationPreference = await adminClient
      .from("notification_preferences")
      .select("email_digest")
      .eq("business_id", payload.businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (notificationPreference.data && notificationPreference.data.email_digest === false) {
      return json({ error: "Enable email digest notifications before sending a digest preview." }, 400);
    }

    const { data: notifications } = await adminClient
      .from("notifications")
      .select("title, body, created_at")
      .eq("business_id", payload.businessId)
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    const recipientEmail = senderEmail;
    if (!recipientEmail) {
      return json({ error: "We could not determine the email address for the current account." }, 400);
    }

    const digestEmail = buildDigestEmail({
      appBaseUrl,
      businessName: businessRecord.name,
      language: templateLanguage,
      locale: templateLocale,
      notifications: (notifications ?? []) as NotificationRow[],
      recipientName: senderName,
    });
    const providerResponse = await sendViaResend({
      fromAddress,
      html: digestEmail.html,
      recipientEmail,
      resendApiKey,
      subject: digestEmail.subject,
      text: digestEmail.text,
    });
    const deliveryId = await safeRecordDelivery({
      metadata: {
        business_name: businessRecord.name,
        item_count: notifications?.length ?? 0,
        provider_id: providerResponse.id ?? null,
        recipient_name: senderName,
      },
      recipientEmail,
      status: "sent",
      subject: digestEmail.subject,
    });

    await safeInsertAuditLog({
      action: "notification.digest_preview.sent",
      detail: {
        description: `Digest preview email sent to ${recipientEmail}.`,
        item_count: notifications?.length ?? 0,
        provider: "resend",
      },
      summary: "Digest preview email sent",
      entityId: deliveryId,
    });

    return json({
      deliveryId,
      provider: "resend",
      recipientEmail,
      status: "sent",
      subject: digestEmail.subject,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The email delivery request failed.";
    const recipientEmail =
      payload.action === "team-invite"
        ? payload.inviteeEmail.trim().toLowerCase()
        : payload.action === "invoice-delivery"
          ? payload.email.trim().toLowerCase()
          : payload.action === "bill-delivery"
            ? payload.email.trim().toLowerCase()
          : senderEmail;
    const subject =
      payload.action === "team-invite"
        ? translateTemplate(templateLanguage, "email.invite.subjectGranted", { businessName: businessRecord.name })
        : payload.action === "invoice-delivery"
          ? payload.subject.trim()
          : payload.action === "bill-delivery"
            ? "Bill breakdown"
          : translateTemplate(templateLanguage, "email.digest.subjectPreview", {
              businessName: businessRecord.name,
              date: formatTemplateDate(new Date(), templateLocale),
            });
    const deliveryId = await safeRecordDelivery({
      errorMessage: message,
      metadata: {
        action: payload.action,
        business_name: businessRecord.name,
      },
      recipientEmail,
      status: "failed",
      subject,
    });

    await safeInsertAuditLog({
      action: `${payload.action}.failed`,
      detail: {
        description: message,
        recipient_email: recipientEmail,
      },
      summary: "Email delivery failed",
      entityId: deliveryId,
    });

    return json({ error: message }, 500);
  }
});
