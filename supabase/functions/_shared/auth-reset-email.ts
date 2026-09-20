import { renderBrandedEmail } from "./branded-email.ts";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const deriveNameFromEmail = (email: string) => {
  const localPart = email.split("@")[0] ?? "";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();

  if (!normalized) {
    return "there";
  }

  return toTitleCase(normalized);
};

const getGreetingName = (recipientName: string | null | undefined, recipientEmail: string) => {
  const normalizedName = recipientName?.trim();
  if (normalizedName) {
    return normalizedName;
  }

  return deriveNameFromEmail(recipientEmail);
};

export const buildPasswordResetEmail = ({
  actionLink,
  appBaseUrl,
  recipientEmail,
  recipientName,
  requestedByAdmin = false,
}: {
  actionLink: string;
  appBaseUrl: string;
  recipientEmail: string;
  recipientName?: string | null;
  requestedByAdmin?: boolean;
}) => {
  const greetingName = getGreetingName(recipientName, recipientEmail);
  const subject = "Reset your Moniger password";
  const heading = "Reset your password";
  const requestLine = requestedByAdmin
    ? "A Moniger administrator requested a password reset for your account."
    : "We received a request to reset the password for your account.";
  const bodyHtml = `
    <p style="margin: 0 0 14px; color:#26314F;">Hi ${escapeHtml(greetingName)},</p>
    <p style="margin: 0 0 14px; color:#4A5675;">${requestLine}</p>
    <p style="margin: 0 0 14px; color:#4A5675;">Use the button below to securely choose a new password for <strong>${escapeHtml(recipientEmail)}</strong>.</p>
    <div style="margin: 18px 0 0; border: 1px solid #D8DDF0; background:#F8F9FD; border-radius:18px; padding:14px 16px; color:#4A5675; font-size:14px; line-height:1.6;">
      This link is single-use and time-sensitive. If you didn’t ask to reset your password, you can safely ignore this email.
    </div>
  `;

  const email = renderBrandedEmail({
    subject,
    preheader: "Use this secure link to reset your Moniger password.",
    heading,
    bodyHtml,
    cta: { href: actionLink, label: "Reset password" },
    footerText: "Moniger · Secure account access",
    brandHref: appBaseUrl,
    theme: "auth",
  });

  const text = [
    heading,
    "",
    `Hi ${greetingName},`,
    "",
    requestLine,
    `Use this link to reset the password for ${recipientEmail}:`,
    actionLink,
    "",
    "This link is single-use and time-sensitive.",
    "If you didn’t ask to reset your password, you can ignore this email.",
  ].join("\n");

  return { ...email, text };
};
