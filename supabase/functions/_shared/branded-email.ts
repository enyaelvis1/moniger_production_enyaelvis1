export type BrandedEmailPayload = {
  html: string;
  subject: string;
  text: string;
};

type BrandedEmailTheme = "default" | "auth";

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeUrl = (value: string) => value.trim().replace(/\s+/g, "");

const renderButton = ({
  href,
  label,
  theme,
}: {
  href: string;
  label: string;
  theme: BrandedEmailTheme;
}) => `
  <a
    href="${escapeHtml(normalizeUrl(href))}"
    style="
      display: inline-block;
      background: ${theme === "auth" ? "#5B67F7" : "#15203B"};
      color: #ffffff;
      padding: ${theme === "auth" ? "16px 26px" : "12px 18px"};
      text-decoration: none;
      border-radius: ${theme === "auth" ? "999px" : "12px"};
      font-weight: 700;
      letter-spacing: -0.01em;
      box-shadow: ${theme === "auth" ? "0 8px 24px rgba(91,103,247,0.25)" : "none"};
    "
  >
    ${escapeHtml(label)}
  </a>
`;

export const renderBrandedEmail = ({
  subject,
  preheader,
  heading,
  bodyHtml,
  cta,
  footerText,
  logoUrl,
  logoAlt,
  brandHref,
  theme: themeOverride,
}: {
  subject: string;
  preheader?: string | null;
  heading: string;
  bodyHtml: string;
  cta?: { href: string; label: string } | null;
  footerText?: string | null;
  logoUrl?: string | null;
  logoAlt?: string | null;
  brandHref?: string | null;
  theme?: BrandedEmailTheme;
}): BrandedEmailPayload => {
  const safePreheader = preheader?.trim() ? preheader.trim() : "";
  const safeFooter = footerText?.trim() ? footerText.trim() : "Moniger";
  const theme = themeOverride ?? "default";
  const ctaMarkup = cta ? `<div style="margin: 22px 0 6px;">${renderButton({ ...cta, theme })}</div>` : "";
  const normalizedLogoUrl = logoUrl?.trim() ? normalizeUrl(logoUrl) : "";
  const normalizedBrandHref = brandHref?.trim() ? normalizeUrl(brandHref) : "";
  const safeLogoAlt = logoAlt?.trim() ? logoAlt.trim() : "Moniger";
  const brandStart = normalizedBrandHref ? `<a href="${escapeHtml(normalizedBrandHref)}" style="text-decoration:none; color:inherit;">` : "";
  const brandEnd = normalizedBrandHref ? "</a>" : "";
  const defaultBrandMark = normalizedLogoUrl
    ? `${brandStart}<img src="${escapeHtml(normalizedLogoUrl)}" width="132" alt="${escapeHtml(safeLogoAlt)}" style="display:block; height:auto; border:0; outline:none; text-decoration:none; margin: 0 auto;" />${brandEnd}`
    : `${brandStart}<span style="display:block; text-align:center; color:#15203B; font-weight:800; font-size:18px; letter-spacing:-0.02em;">Moniger</span>${brandEnd}`;
  const authBrandMark = `
    <div style="text-align:center;">
      ${brandStart}
      <span style="display:inline-block; vertical-align:middle; width:40px; height:40px; line-height:40px; border-radius:12px; background:#5B67F7; color:#FFFFFF; font-weight:900; font-size:18px; box-shadow:0 4px 12px rgba(91,103,247,0.3); text-align:center;">M</span>
      <span style="display:inline-block; vertical-align:middle; margin-left:12px; color:#10203F; font-weight:700; font-size:20px; letter-spacing:-0.03em;">moniger.net</span>
      ${brandEnd}
    </div>
  `;
  const brandMark = theme === "auth" ? authBrandMark : defaultBrandMark;
  const shellBackground = theme === "auth" ? "#F3F4FB" : "#F7F6F3";
  const cardBorder = theme === "auth" ? "#D8DDF0" : "#DCE2F2";
  const cardShadow = theme === "auth"
    ? "0 0 0 1px rgba(91,103,247,0.04),0 12px 32px rgba(91,103,247,0.08),0 32px 64px rgba(91,103,247,0.06)"
    : "0 24px 70px rgba(16,32,63,0.10)";
  const headerBackground = theme === "auth"
    ? "linear-gradient(180deg, #F8FAFF 0%, #FFFFFF 60%)"
    : "linear-gradient(180deg, #F8FAFF 0%, #FFFFFF 60%)";
  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${escapeHtml(safePreheader)}
    </div>
    <div style="font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:${shellBackground}; padding: 34px 16px;">
      <div style="max-width: 640px; margin: 0 auto;">
        <div style="background:#ffffff; border: 1px solid ${cardBorder}; border-radius: 24px; box-shadow:${cardShadow}; color:#0f172a; line-height:1.65; overflow:hidden;">
          <div style="padding: 18px 22px 0; background:${headerBackground};">
            <div style="padding: 10px 0 14px;">
              ${brandMark}
            </div>
          </div>
          <div style="padding: 6px 28px 28px;">
            <h2 style="margin: 0 0 12px; font-size: 22px; letter-spacing:-0.02em;">${escapeHtml(heading)}</h2>
            ${bodyHtml}
            ${ctaMarkup}
            <div style="margin-top: 22px; border-top: 1px solid #EEF2FF; padding-top: 16px; color:#475569; font-size: 13px;">
              ${escapeHtml(safeFooter)}
            </div>
          </div>
        </div>
        <div style="padding: 14px 6px 0; color:#64748b; font-size: 12px; text-align:center;">
          If you didn’t request this email, you can ignore it.
        </div>
      </div>
    </div>
  `;

  const text = [
    heading,
    "",
    safePreheader ? safePreheader : "",
    safePreheader ? "" : "",
    "—",
    "",
    safeFooter,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    html,
    subject: subject.trim(),
    text,
  };
};
