import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import {
  formatTemplateCurrency,
  formatTemplateDate,
  normalizeTemplateLanguage,
  normalizeTemplateLocale,
  translateTemplate,
} from "./localization.ts";
import { escapeHtml, renderBrandedEmail } from "./branded-email.ts";

type AdminClient = ReturnType<typeof createClient>;

type ReceiptBusinessRow = {
  default_language: string | null;
  default_locale: string | null;
  name: string;
};

type ReceiptInvoiceRow = {
  currency: string;
  customer_id: string;
  due_date: string | null;
  id: string;
  invoice_number: string;
  issue_date: string;
  payment_public_token: string;
  total_amount: number | string;
};

type ReceiptCustomerRow = {
  email: string | null;
  name: string | null;
};

type ReceiptPaymentRow = {
  amount: number | string;
  business_id: string;
  counterparty_name: string | null;
  currency: string;
  gateway: string;
  id: string;
  invoice_id: string | null;
  metadata: Record<string, unknown> | null;
  paid_on: string;
  payment_reference: string;
  status: string;
};

type ReceiptEmailPayload = {
  html: string;
  subject: string;
  text: string;
};

const normalizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "receipt";

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

const readMetadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const value = metadata[key];
  return typeof value === "string" ? value : "";
};

const buildReceiptEmail = ({
  amountLabel,
  businessName,
  customerName,
  invoiceNumber,
  language,
  locale,
  paidAt,
  paymentReference,
}: {
  amountLabel: string;
  businessName: string;
  customerName: string;
  invoiceNumber: string;
  language: string | null | undefined;
  locale: string | null | undefined;
  paidAt: string;
  paymentReference: string;
}): ReceiptEmailPayload => {
  const normalizedLanguage = normalizeTemplateLanguage(language);
  const normalizedLocale = normalizeTemplateLocale(locale);
  const subject = `Payment receipt for ${invoiceNumber}`;
  const greeting = translateTemplate(normalizedLanguage, "email.invoice.greeting", { name: customerName });
  const paidDate = formatTemplateDate(paidAt, normalizedLocale);
  const bodyHtml = `
    <p>${escapeHtml(greeting)}</p>
    <p>We have received your payment for invoice <strong>${escapeHtml(invoiceNumber)}</strong>.</p>
    <div style="margin: 18px 0; padding: 16px; border: 1px solid #DCE2F2; border-radius: 16px; background: #F8F9FD;">
      <p style="margin: 0 0 8px;"><strong>Amount:</strong> ${escapeHtml(amountLabel)}</p>
      <p style="margin: 0 0 8px;"><strong>Paid on:</strong> ${escapeHtml(paidDate)}</p>
      <p style="margin: 0;"><strong>Receipt reference:</strong> ${escapeHtml(paymentReference)}</p>
    </div>
    <p>A PDF copy of your receipt is attached to this email.</p>
  `;

  const email = renderBrandedEmail({
    subject,
    preheader: `Receipt for ${invoiceNumber}.`,
    heading: "Payment receipt",
    bodyHtml,
    footerText: businessName,
    logoUrl: "https://moniger.net/logo.png",
    logoAlt: "Moniger",
    brandHref: "https://moniger.net",
  });
  const text = [
    greeting,
    "",
    `We have received your payment for invoice ${invoiceNumber}.`,
    `Amount: ${amountLabel}`,
    `Paid on: ${paidDate}`,
    `Receipt reference: ${paymentReference}`,
    "",
    "A PDF copy of your receipt is attached to this email.",
    businessName,
  ].join("\n");

  return {
    ...email,
    text,
  };
};

const buildReceiptPdf = async ({
  amountLabel,
  businessName,
  customerName,
  invoiceNumber,
  paidAt,
  paymentReference,
}: {
  amountLabel: string;
  businessName: string;
  customerName: string;
  invoiceNumber: string;
  paidAt: string;
  paymentReference: string;
}) => {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const titleFont = await document.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await document.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();
  let y = height - 72;

  page.drawText("Payment Receipt", {
    color: rgb(0.08, 0.13, 0.24),
    font: titleFont,
    size: 24,
    x: 50,
    y,
  });

  y -= 34;
  page.drawText(businessName, {
    color: rgb(0.19, 0.28, 0.42),
    font: bodyFont,
    size: 12,
    x: 50,
    y,
  });

  y -= 42;
  const rows = [
    ["Customer", customerName],
    ["Invoice", invoiceNumber],
    ["Amount", amountLabel],
    ["Paid on", paidAt],
    ["Receipt reference", paymentReference],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, {
      color: rgb(0.39, 0.45, 0.55),
      font: titleFont,
      size: 11,
      x: 50,
      y,
    });
    page.drawText(value, {
      color: rgb(0.08, 0.13, 0.24),
      font: bodyFont,
      size: 12,
      x: 190,
      y,
    });
    y -= 26;
  }

  return toBase64(await document.save());
};

const sendViaResend = async ({
  attachmentBase64,
  attachmentFileName,
  fromAddress,
  html,
  recipientEmail,
  resendApiKey,
  subject,
  text,
}: {
  attachmentBase64: string;
  attachmentFileName: string;
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
      attachments: [
        {
          content: attachmentBase64,
          filename: attachmentFileName,
        },
      ],
      from: fromAddress,
      html,
      subject,
      text,
      to: [recipientEmail],
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

const recordReceiptDelivery = async ({
  adminClient,
  businessId,
  errorMessage = null,
  metadata,
  recipientEmail,
  status,
  subject,
}: {
  adminClient: AdminClient;
  businessId: string;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  recipientEmail: string;
  status: "failed" | "sent";
  subject: string;
}) => {
  const { data } = await adminClient
    .from("email_deliveries")
    .insert({
      business_id: businessId,
      error_message: errorMessage,
      metadata,
      provider: "resend",
      recipient_email: recipientEmail,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      status,
      subject,
      template_key: "payment-receipt",
    })
    .select("id")
    .single();

  return data?.id ?? null;
};

const updatePaymentReceiptMetadata = async ({
  adminClient,
  deliveryId,
  payment,
  sentAt,
}: {
  adminClient: AdminClient;
  deliveryId: string | null;
  payment: ReceiptPaymentRow;
  sentAt: string;
}) => {
  const metadata = {
    ...(payment.metadata ?? {}),
    receipt_delivery_id: deliveryId,
    receipt_sent_at: sentAt,
  };

  await adminClient.from("payments").update({ metadata }).eq("id", payment.id);
};

export const deliverPaymentReceipt = async ({
  adminClient,
  fallbackRecipientEmail,
  paymentId,
  paystackPayload,
}: {
  adminClient: AdminClient;
  fallbackRecipientEmail?: string | null;
  paymentId: string;
  paystackPayload?: Record<string, unknown>;
}) => {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ?? "";

  const { data: paymentData } = await adminClient
    .from("payments")
    .select("id, business_id, invoice_id, payment_reference, amount, currency, paid_on, counterparty_name, gateway, status, metadata")
    .eq("id", paymentId)
    .maybeSingle();

  const payment = (paymentData as ReceiptPaymentRow | null) ?? null;
  if (!payment?.invoice_id || payment.status !== "completed") {
    return { delivered: false, reason: "payment-not-eligible" as const };
  }

  const { data: existingDelivery } = await adminClient
    .from("email_deliveries")
    .select("id")
    .eq("business_id", payment.business_id)
    .eq("template_key", "payment-receipt")
    .eq("status", "sent")
    .contains("metadata", { payment_id: payment.id })
    .maybeSingle();

  if (existingDelivery) {
    return {
      delivered: false,
      deliveryId: (existingDelivery as { id?: string }).id ?? null,
      reason: "already-sent" as const,
    };
  }

  const [{ data: invoiceData }, { data: businessData }] = await Promise.all([
    adminClient
      .from("invoices")
      .select("id, customer_id, invoice_number, issue_date, due_date, total_amount, currency, payment_public_token")
      .eq("id", payment.invoice_id)
      .maybeSingle(),
    adminClient
      .from("businesses")
      .select("name, default_language, default_locale")
      .eq("id", payment.business_id)
      .maybeSingle(),
  ]);

  const invoice = (invoiceData as ReceiptInvoiceRow | null) ?? null;
  const business = (businessData as ReceiptBusinessRow | null) ?? null;

  if (!invoice || !business?.name) {
    return { delivered: false, reason: "missing-context" as const };
  }

  const { data: customerData } = await adminClient
    .from("customers")
    .select("name, email")
    .eq("id", invoice.customer_id)
    .maybeSingle();

  const customer = (customerData as ReceiptCustomerRow | null) ?? null;
  const paystackCustomer =
    paystackPayload?.customer && typeof paystackPayload.customer === "object"
      ? (paystackPayload.customer as Record<string, unknown>)
      : {};
  const recipientEmail =
    fallbackRecipientEmail?.trim().toLowerCase() ||
    customer?.email?.trim().toLowerCase() ||
    readMetadataString(payment.metadata, "paystack_customer_email").trim().toLowerCase() ||
    (typeof paystackCustomer.email === "string" ? paystackCustomer.email.trim().toLowerCase() : "");

  if (!recipientEmail) {
    return { delivered: false, reason: "missing-recipient" as const };
  }

  const customerName = customer?.name?.trim() || payment.counterparty_name?.trim() || "Customer";
  const paidAt = formatTemplateDate(payment.paid_on, business.default_locale);
  const amountLabel = formatTemplateCurrency(payment.amount, payment.currency, business.default_locale);
  const email = buildReceiptEmail({
    amountLabel,
    businessName: business.name,
    customerName,
    invoiceNumber: invoice.invoice_number,
    language: business.default_language,
    locale: business.default_locale,
    paidAt: payment.paid_on,
    paymentReference: payment.payment_reference,
  });
  const pdfBase64 = await buildReceiptPdf({
    amountLabel,
    businessName: business.name,
    customerName,
    invoiceNumber: invoice.invoice_number,
    paidAt,
    paymentReference: payment.payment_reference,
  });
  const attachmentFileName = `${normalizeFileName(payment.payment_reference)}-receipt.pdf`;

  if (!resendApiKey || !fromAddress) {
    const deliveryId = await recordReceiptDelivery({
      adminClient,
      businessId: payment.business_id,
      errorMessage: "Missing RESEND_API_KEY or EMAIL_FROM_ADDRESS environment configuration.",
      metadata: {
        configured: false,
        invoice_id: invoice.id,
        payment_id: payment.id,
        payment_reference: payment.payment_reference,
      },
      recipientEmail,
      status: "failed",
      subject: email.subject,
    });

    await adminClient.from("audit_logs").insert({
      action: "payment.receipt_email.failed",
      actor_user_id: null,
      business_id: payment.business_id,
      detail: {
        description: "Payment receipt email delivery is not configured.",
        payment_id: payment.id,
        payment_reference: payment.payment_reference,
        recipient_email: recipientEmail,
      },
      entity_id: deliveryId,
      entity_type: "email_delivery",
      summary: "Payment receipt email failed",
    });

    return { delivered: false, deliveryId, reason: "missing-config" as const };
  }

  try {
    const providerResponse = await sendViaResend({
      attachmentBase64: pdfBase64,
      attachmentFileName,
      fromAddress,
      html: email.html,
      recipientEmail,
      resendApiKey,
      subject: email.subject,
      text: email.text,
    });
    const sentAt = new Date().toISOString();
    const deliveryId = await recordReceiptDelivery({
      adminClient,
      businessId: payment.business_id,
      metadata: {
        auto_sent: true,
        invoice_id: invoice.id,
        payment_id: payment.id,
        payment_reference: payment.payment_reference,
        provider_id: providerResponse.id ?? null,
        recipient_source: fallbackRecipientEmail ? "fallback" : customer?.email ? "customer" : "paystack",
      },
      recipientEmail,
      status: "sent",
      subject: email.subject,
    });

    await updatePaymentReceiptMetadata({
      adminClient,
      deliveryId,
      payment,
      sentAt,
    });

    await adminClient.from("audit_logs").insert({
      action: "payment.receipt_email.sent",
      actor_user_id: null,
      business_id: payment.business_id,
      detail: {
        description: `Payment receipt emailed to ${recipientEmail}.`,
        payment_id: payment.id,
        payment_reference: payment.payment_reference,
        provider: "resend",
      },
      entity_id: deliveryId,
      entity_type: "email_delivery",
      summary: "Payment receipt email sent",
    });

    return { delivered: true, deliveryId, reason: "sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment receipt email could not be sent.";
    const deliveryId = await recordReceiptDelivery({
      adminClient,
      businessId: payment.business_id,
      errorMessage: message,
      metadata: {
        invoice_id: invoice.id,
        payment_id: payment.id,
        payment_reference: payment.payment_reference,
      },
      recipientEmail,
      status: "failed",
      subject: email.subject,
    });

    await adminClient.from("audit_logs").insert({
      action: "payment.receipt_email.failed",
      actor_user_id: null,
      business_id: payment.business_id,
      detail: {
        description: message,
        payment_id: payment.id,
        payment_reference: payment.payment_reference,
        recipient_email: recipientEmail,
      },
      entity_id: deliveryId,
      entity_type: "email_delivery",
      summary: "Payment receipt email failed",
    });

    return { delivered: false, deliveryId, reason: "send-failed" as const };
  }
};
