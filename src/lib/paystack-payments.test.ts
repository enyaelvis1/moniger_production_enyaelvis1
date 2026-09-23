import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("paystack payment helpers", () => {
  it("builds a public invoice payment url from an explicit base url", async () => {
    vi.resetModules();
    const { buildInvoicePaymentUrl } = await import("@/lib/paystack-payments");

    expect(buildInvoicePaymentUrl("token-123", "https://www.moniger.net/")).toBe(
      "https://www.moniger.net/pay/token-123",
    );
  });

  it("falls back to the configured public app url when no base url is supplied", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_PUBLIC_APP_URL", "https://moniger.net");
    vi.stubGlobal("window", {
      location: {
        origin: "https://app.moniger.net",
      },
    });

    const { buildInvoicePaymentUrl } = await import("@/lib/paystack-payments");

    expect(buildInvoicePaymentUrl("token 123")).toBe("https://moniger.net/pay/token%20123");
  });

  it("builds the expected whatsapp share url", async () => {
    vi.resetModules();
    const { buildInvoicePaymentWhatsAppUrl } = await import("@/lib/paystack-payments");

    expect(
      buildInvoicePaymentWhatsAppUrl({
        amountLabel: "NGN 1,250.00",
        invoiceNumber: "INV-2026-001",
        paymentUrl: "https://www.moniger.net/pay/token-123",
      }),
    ).toBe(
      "https://wa.me/?text=Pay%20invoice%20INV-2026-001%20securely%20here%3A%20https%3A%2F%2Fwww.moniger.net%2Fpay%2Ftoken-123%0AAmount%20due%3A%20NGN%201%2C250.00",
    );
  });
});
