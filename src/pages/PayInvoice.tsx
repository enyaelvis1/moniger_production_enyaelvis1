import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchPublicInvoicePaymentDetails,
  initializeInvoicePayment,
  type PublicInvoicePaymentDetails,
} from "@/lib/paystack-payments";

const formatCurrencyAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-NG", {
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const formatDateLabel = (value: string | null) => {
  if (!value) {
    return "Not set";
  }

  try {
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const isSettledInvoice = (invoice: PublicInvoicePaymentDetails | null) =>
  Boolean(invoice && (invoice.status === "paid" || invoice.balanceDue <= 0));

const PayInvoicePage = () => {
  const { paymentToken } = useParams<{ paymentToken: string }>();
  const [invoice, setInvoice] = useState<PublicInvoicePaymentDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payerEmail, setPayerEmail] = useState("");
  const [payerName, setPayerName] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadInvoice = async () => {
      if (!paymentToken) {
        if (isMounted) {
          setErrorMessage("This payment link is incomplete.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const invoiceDetails = await fetchPublicInvoicePaymentDetails(paymentToken);

        if (!isMounted) {
          return;
        }

        setInvoice(invoiceDetails);
        setPayerEmail(invoiceDetails.customerEmail ?? "");
        setPayerName(invoiceDetails.customerName ?? "");
        setErrorMessage(null);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "We could not load this invoice.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInvoice();

    return () => {
      isMounted = false;
    };
  }, [paymentToken]);

  const amountLabel = useMemo(
    () => formatCurrencyAmount(invoice?.balanceDue ?? 0, invoice?.currency ?? "NGN"),
    [invoice?.balanceDue, invoice?.currency],
  );

  const handleStartPayment = async () => {
    if (!paymentToken) {
      return;
    }

    const normalizedEmail = payerEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Enter an email address before continuing to payment.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await initializeInvoicePayment({
        payerEmail: normalizedEmail,
        payerName: payerName.trim() || undefined,
        paymentToken,
      });

      window.location.assign(response.authorizationUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We could not start the payment right now.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-10 text-[#10203F] sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="space-y-3">
            <Link to="/" className="inline-flex text-sm font-medium text-[#5B67F7] hover:text-[#3E49D6]">
              moniger.net
            </Link>
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#5B67F7]">Invoice Payment</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Pay your invoice securely with Paystack.
              </h1>
              <p className="max-w-2xl text-base text-[#52607A]">
                Review the invoice details below, confirm your email, and continue to a secure Paystack checkout.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#D8DDF0] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Invoice</p>
              <p className="mt-2 text-lg font-semibold">{invoice?.invoiceNumber ?? "Loading..."}</p>
            </div>
            <div className="rounded-3xl border border-[#D8DDF0] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Due</p>
              <p className="mt-2 text-lg font-semibold">{formatDateLabel(invoice?.dueDate ?? null)}</p>
            </div>
            <div className="rounded-3xl border border-[#D8DDF0] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Balance Due</p>
              <p className="mt-2 text-lg font-semibold">{amountLabel}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D8DDF0] bg-white p-6 shadow-sm">
            {isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-[#52607A]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading invoice...
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-4 text-sm text-[#B42318]">
                {errorMessage}
              </div>
            ) : invoice ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="paystack-payer-name" className="text-sm font-medium text-[#10203F]">
                      Your name
                    </label>
                    <Input
                      id="paystack-payer-name"
                      value={payerName}
                      onChange={(event) => setPayerName(event.target.value)}
                      className="h-12 rounded-2xl border-[#D8DDF0]"
                      placeholder="Customer name"
                      disabled={isSubmitting || isSettledInvoice(invoice)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="paystack-payer-email" className="text-sm font-medium text-[#10203F]">
                      Receipt email
                    </label>
                    <Input
                      id="paystack-payer-email"
                      type="email"
                      value={payerEmail}
                      onChange={(event) => setPayerEmail(event.target.value)}
                      className="h-12 rounded-2xl border-[#D8DDF0]"
                      placeholder="name@example.com"
                      disabled={isSubmitting || isSettledInvoice(invoice)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E8E4DF] bg-[#FBFBF8] p-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Workspace</p>
                      <p className="mt-1 font-medium">{invoice.businessName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Customer</p>
                      <p className="mt-1 font-medium">{invoice.customerName}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Issue date</p>
                      <p className="mt-1 font-medium">{formatDateLabel(invoice.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Status</p>
                      <p className="mt-1 font-medium capitalize">{invoice.status}</p>
                    </div>
                  </div>
                  {invoice.notes ? (
                    <div className="mt-4 border-t border-[#E8E4DF] pt-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Notes</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-[#52607A]">{invoice.notes}</p>
                    </div>
                  ) : null}
                </div>

                {isSettledInvoice(invoice) ? (
                  <div className="rounded-2xl border border-[#B7E1C2] bg-[#F2FBF4] px-4 py-4 text-sm text-[#166534]">
                    This invoice has already been settled. If you need a payment reference, ask the sender to share the
                    confirmation details with you.
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="h-12 flex-1 rounded-2xl bg-[#17324D] text-white hover:bg-[#10263A]"
                    onClick={() => void handleStartPayment()}
                    disabled={isSubmitting || isSettledInvoice(invoice)}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Pay {amountLabel}
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-2xl border-[#D8DDF0]">
                    <Link to="/">Back to moniger.net</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="rounded-[28px] border border-[#D8DDF0] bg-[#17324D] p-6 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Secure checkout</p>
                <p className="text-lg font-semibold">Protected by Paystack</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-white/80">
              <p>We redirect you to Paystack to complete your payment with a secure card or bank transfer flow.</p>
              <p>Once payment is confirmed, Moniger updates the invoice record and marks it as paid automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayInvoicePage;
