import { supabase } from "@/lib/supabase";

export type PublicInvoicePaymentDetails = {
  amountPaid: number;
  balanceDue: number;
  businessName: string;
  currency: string;
  customerEmail: string | null;
  customerName: string;
  dueDate: string | null;
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  notes: string | null;
  paymentLinkEnabled: boolean;
  paymentToken: string;
  status: string;
  totalAmount: number;
};

export type InitializeInvoicePaymentResponse = {
  authorizationUrl: string;
  reference: string;
};

export type VerifyInvoicePaymentResponse = {
  alreadyProcessed: boolean;
  invoice: {
    amountPaid: number;
    balanceDue: number;
    currency: string;
    invoiceId: string;
    invoiceNumber: string;
    paidAt: string | null;
    status: string;
    totalAmount: number;
  };
  payment: {
    amount: number;
    paidAt: string | null;
    provider: string;
    reference: string;
    status: string;
  };
};

type PaystackPaymentAction = "invoice-details" | "initialize-payment" | "verify-payment";

type ResponseLike = {
  clone: () => ResponseLike;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

const isResponseLike = (value: unknown): value is ResponseLike =>
  typeof value === "object" &&
  value !== null &&
  "clone" in value &&
  typeof value.clone === "function" &&
  "json" in value &&
  typeof value.json === "function" &&
  "text" in value &&
  typeof value.text === "function";

const getResponseErrorMessage = async (response: ResponseLike | undefined) => {
  if (!response) {
    return null;
  }

  try {
    const payload = await response.clone().json();

    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    try {
      const text = await response.clone().text();

      if (text.trim()) {
        return text.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
};

const getFunctionErrorMessage = async (error: unknown) => {
  if (typeof error === "object" && error && "context" in error) {
    const context = (error as { context?: unknown }).context;
    const responseMessage = await getResponseErrorMessage(isResponseLike(context) ? context : undefined);

    if (responseMessage) {
      return responseMessage;
    }
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "The payment service could not be reached.";
};

const invokePaystackPayments = async <TResponse>(action: PaystackPaymentAction, body: Record<string, unknown>) => {
  const { data, error, response } = await supabase.functions.invoke("paystack-payments", {
    body: {
      action,
      ...body,
    },
  });

  if (error) {
    const responseMessage = await getResponseErrorMessage(isResponseLike(response) ? response : undefined);
    throw new Error(responseMessage ?? (await getFunctionErrorMessage(error)));
  }

  if (!data || typeof data !== "object") {
    throw new Error("The payment service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as TResponse;
};

export const fetchPublicInvoicePaymentDetails = (paymentToken: string) =>
  invokePaystackPayments<{ invoice: PublicInvoicePaymentDetails }>("invoice-details", {
    paymentToken,
  }).then((response) => response.invoice);

export const initializeInvoicePayment = ({
  payerEmail,
  payerName,
  paymentToken,
}: {
  payerEmail: string;
  payerName?: string | null;
  paymentToken: string;
}) =>
  invokePaystackPayments<InitializeInvoicePaymentResponse>("initialize-payment", {
    payerEmail,
    payerName,
    paymentToken,
  });

export const verifyInvoicePayment = ({
  paymentToken,
  reference,
}: {
  paymentToken: string;
  reference: string;
}) =>
  invokePaystackPayments<VerifyInvoicePaymentResponse>("verify-payment", {
    paymentToken,
    reference,
  });

export const buildInvoicePaymentUrl = (paymentToken: string, baseUrl?: string) => {
  const configuredBaseUrl =
    import.meta.env.VITE_PUBLIC_APP_URL?.trim() ||
    import.meta.env.VITE_APP_BASE_URL?.trim() ||
    "";
  const origin =
    baseUrl?.trim().replace(/\/$/, "") ||
    configuredBaseUrl.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "");

  return `${origin}/pay/${encodeURIComponent(paymentToken)}`;
};

export const buildInvoicePaymentWhatsAppUrl = ({
  amountLabel,
  invoiceNumber,
  paymentUrl,
}: {
  amountLabel: string;
  invoiceNumber: string;
  paymentUrl: string;
}) => {
  const message = `Pay invoice ${invoiceNumber} securely here: ${paymentUrl}\nAmount due: ${amountLabel}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};
