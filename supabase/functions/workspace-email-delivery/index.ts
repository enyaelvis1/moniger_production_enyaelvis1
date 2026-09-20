import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  formatTemplateCurrency,
  formatTemplateDate,
  normalizeTemplateLanguage,
  normalizeTemplateLocale,
  translateTemplate,
} from "../_shared/localization.ts";
import { renderBrandedEmail } from "../_shared/branded-email.ts";

type DeliveryAction = "digest-preview" | "invoice-delivery" | "team-invite";

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

type DeliveryRequest = DigestPreviewRequest | InvoiceDeliveryRequest | TeamInviteRequest;

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
  sent_at: string | null;
  status: string;
  total_amount: number | string;
};

type CustomerRow = {
  email: string | null;
  name: string | null;
};

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
  dueDate,
  invoiceNumber,
  issueDate,
  language,
  locale,
  message,
  recipientEmail,
  subject,
  totalAmount,
  workspaceSlug,
}: {
  appBaseUrl: string;
  businessName: string;
  customerName: string;
  dueDate: string | null;
  invoiceNumber: string;
  issueDate: string;
  language: string | null | undefined;
  locale: string | null | undefined;
  message: string;
  recipientEmail: string;
  subject: string;
  totalAmount: string;
  workspaceSlug?: string | null;
}) => {
  const invoicesUrl = `${appBaseUrl}/invoices`;
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
  const openAppLabel = translateTemplate(language, "email.invoice.openApp");
  const bodyHtml = `
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeMultilineHtml(sanitizedMessage)}</p>
    <div style="margin: 18px 0; padding: 16px; border: 1px solid #DCE2F2; border-radius: 16px; background: #F8F9FD;">
      <p style="margin: 0 0 8px;"><strong>${escapeHtml(invoiceLabel)}:</strong> ${escapeHtml(invoiceNumber)}</p>
      <p style="margin: 0 0 8px;"><strong>${escapeHtml(totalLabel)}:</strong> ${escapeHtml(totalAmount)}</p>
      ${formattedIssueDate ? `<p style="margin: 0 0 8px;"><strong>${escapeHtml(issuedLabel)}:</strong> ${escapeHtml(formattedIssueDate)}</p>` : ""}
      ${formattedDueDate ? `<p style="margin: 0;"><strong>${escapeHtml(dueLabel)}:</strong> ${escapeHtml(formattedDueDate)}</p>` : ""}
    </div>
  `;

  const email = renderBrandedEmail({
    subject,
    preheader: `${invoiceLabel} ${invoiceNumber} · ${totalAmount}`,
    heading,
    bodyHtml,
    cta: { href: invoicesUrl, label: openAppLabel },
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
    `${invoiceLabel}: ${invoiceNumber}`,
    `${totalLabel}: ${totalAmount}`,
    ...(formattedIssueDate ? [`${issuedLabel}: ${formattedIssueDate}`] : []),
    ...(formattedDueDate ? [`${dueLabel}: ${formattedDueDate}`] : []),
    "",
    `${openAppLabel}: ${invoicesUrl}`,
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
          : senderEmail;
    const subject =
      payload.action === "team-invite"
        ? translateTemplate(templateLanguage, "email.invite.subjectGranted", { businessName: businessRecord.name })
        : payload.action === "invoice-delivery"
          ? payload.subject.trim()
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
        .select("id, customer_id, invoice_number, issue_date, due_date, status, total_amount, currency, sent_at, delivery_attempt_count")
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
      const now = new Date().toISOString();
      const nextInvoiceStatus = invoiceRecord.status === "draft" ? "sent" : invoiceRecord.status;
      const isResend =
        (invoiceRecord.delivery_attempt_count ?? 0) > 0 || invoiceRecord.status === "sent" || invoiceRecord.status === "overdue";
      const invoiceEmail = buildInvoiceEmail({
        appBaseUrl,
        businessName: businessRecord.name,
        customerName,
        dueDate: invoiceRecord.due_date,
        invoiceNumber: invoiceRecord.invoice_number,
        issueDate: invoiceRecord.issue_date,
        language: templateLanguage,
        locale: templateLocale,
        message,
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
          : senderEmail;
    const subject =
      payload.action === "team-invite"
        ? translateTemplate(templateLanguage, "email.invite.subjectGranted", { businessName: businessRecord.name })
        : payload.action === "invoice-delivery"
          ? payload.subject.trim()
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
