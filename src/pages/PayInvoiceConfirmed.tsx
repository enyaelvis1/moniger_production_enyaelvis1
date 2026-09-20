import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyInvoicePayment, type VerifyInvoicePaymentResponse } from "@/lib/paystack-payments";

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
    return "Not available";
  }

  try {
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const PayInvoiceConfirmedPage = () => {
  const { paymentToken } = useParams<{ paymentToken: string }>();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<VerifyInvoicePaymentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const runVerification = async () => {
      const reference = searchParams.get("reference")?.trim() || searchParams.get("trxref")?.trim() || "";

      if (!paymentToken || !reference) {
        if (isMounted) {
          setErrorMessage("We could not find the Paystack payment reference for this invoice.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const verification = await verifyInvoicePayment({
          paymentToken,
          reference,
        });

        if (isMounted) {
          setResult(verification);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "We could not confirm this payment.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void runVerification();

    return () => {
      isMounted = false;
    };
  }, [paymentToken, searchParams]);

  return (
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-10 text-[#10203F] sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-[#D8DDF0] bg-white p-6 shadow-sm sm:p-8">
        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-[#52607A]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Confirming your payment...
          </div>
        ) : errorMessage ? (
          <div className="space-y-5">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#B42318]">Payment confirmation</p>
            <h1 className="text-3xl font-semibold tracking-tight">We couldn&apos;t confirm this payment yet.</h1>
            <div className="rounded-2xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-4 text-sm text-[#B42318]">
              {errorMessage}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {paymentToken ? (
                <Button asChild className="rounded-2xl bg-[#17324D] text-white hover:bg-[#10263A]">
                  <Link to={`/pay/${encodeURIComponent(paymentToken)}`}>Return to payment page</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="rounded-2xl border-[#D8DDF0]">
                <Link to="/">Back to moniger.net</Link>
              </Button>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-[#E8F7EE] p-3 text-[#15803D]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#5B67F7]">Payment confirmed</p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {result.alreadyProcessed ? "This invoice was already settled." : "Your payment was successful."}
                </h1>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D8DDF0] bg-[#FBFBF8] p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Invoice</p>
                  <p className="mt-1 font-semibold">{result.invoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Reference</p>
                  <p className="mt-1 font-semibold">{result.payment.reference}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Amount</p>
                  <p className="mt-1 font-semibold">
                    {formatCurrencyAmount(result.payment.amount, result.invoice.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#677391]">Paid at</p>
                  <p className="mt-1 font-semibold">{formatDateLabel(result.payment.paidAt)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-2xl bg-[#17324D] text-white hover:bg-[#10263A]">
                <Link to="/">Back to moniger.net</Link>
              </Button>
              {paymentToken ? (
                <Button asChild variant="outline" className="rounded-2xl border-[#D8DDF0]">
                  <Link to={`/pay/${encodeURIComponent(paymentToken)}`}>View invoice link</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PayInvoiceConfirmedPage;
