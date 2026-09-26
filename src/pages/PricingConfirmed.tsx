import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import PublicPageShell from "@/components/public/PublicPageShell";
import { Button } from "@/components/ui/button";
import { useSupabaseSession } from "@/hooks/use-supabase-session";
import {
  getWorkspaceSubscriptionConfirmationStatus,
  verifyWorkspaceSubscriptionCheckout,
} from "@/lib/workspace-subscriptions";
import { useWorkspaceSelection } from "@/contexts/WorkspaceSelectionContext";
import type { WorkspaceSubscriptionActionResult } from "@/lib/subscriptions";

const formatCurrencyAmount = (amount: number) => {
  try {
    return new Intl.NumberFormat("en-NG", {
      currency: "NGN",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `NGN ${amount.toFixed(2)}`;
  }
};

const formatDateLabel = (value: string | null) => {
  if (!value) {
    return "Not scheduled";
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

const waitForVerificationRetry = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

const PricingConfirmedPage = () => {
  const { isSessionLoading, session } = useSupabaseSession();
  const { selectedBusinessId } = useWorkspaceSelection();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<WorkspaceSubscriptionActionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [canRetryVerification, setCanRetryVerification] = useState(false);

  const reference = useMemo(
    () => searchParams.get("reference")?.trim() || searchParams.get("trxref")?.trim() || "",
    [searchParams],
  );
  const loginPath = useMemo(
    () => `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
    [location.pathname, location.search],
  );

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    if (!reference) {
      setErrorMessage("We could not find the Paystack subscription reference for this checkout.");
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const runVerification = async () => {
      setIsLoading(true);
      setCanRetryVerification(false);

      for (let attempt = 0; attempt < (session ? 3 : 1); attempt += 1) {
        try {
          const verification = session
            ? await verifyWorkspaceSubscriptionCheckout({
              businessId: selectedBusinessId ?? undefined,
              reference,
            })
            : await getWorkspaceSubscriptionConfirmationStatus({
              reference,
            });

          if (isMounted) {
            setResult(verification);
            setErrorMessage(null);
          }

          return;
        } catch (error) {
          const subscriptionError =
            typeof error === "object" && error !== null && "retryable" in error
              ? (error as { retryable?: boolean })
              : null;
          const message = error instanceof Error ? error.message : "We could not confirm this workspace subscription.";
          const retryable = Boolean(subscriptionError?.retryable);

          if (!session || !retryable || attempt === 2) {
            if (isMounted) {
              setErrorMessage(message);
              setCanRetryVerification(Boolean(session && retryable));
            }

            return;
          }

          await waitForVerificationRetry(2000);
        }
      }

      if (isMounted) {
        setErrorMessage("We could not confirm this workspace subscription.");
      }
    };

    void runVerification().finally(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isSessionLoading, reference, selectedBusinessId, session, verificationAttempt]);

  useEffect(() => {
    if (!session || !result || (result.kind !== "verified" && result.kind !== "activated")) {
      return;
    }

    let active = true;
    const completeNavigation = async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-subscription", result.subscription.businessId], refetchType: "none" });
      queryClient.removeQueries({ queryKey: ["workspace-subscription", result.subscription.businessId] });
      if (active) navigate("/dashboard", { replace: true });
    };
    void completeNavigation();
    return () => { active = false; };
  }, [navigate, queryClient, result, session]);

  useEffect(() => {
    if (session || !result || result.kind !== "public_status" || result.confirmation.status !== "completed") {
      return;
    }

    navigate("/dashboard", { replace: true });
  }, [navigate, result, session]);

  const verifiedSubscription =
    result && (result.kind === "verified" || result.kind === "activated") ? result.subscription : null;
  const publicConfirmation = result?.kind === "public_status" ? result.confirmation : null;

  return (
    <PublicPageShell
      eyebrow="Billing"
      title="Workspace subscription confirmation"
      description="We confirm the returned Paystack reference here and, when you are signed in, sync the final workspace billing state securely."
      highlights={[
        { label: "Provider", value: "Paystack" },
        { label: "Verification", value: "Server-side" },
        { label: "Destination", value: "Workspace billing" },
      ]}
      cta={{ label: "Back to pricing", to: "/pricing" }}
      accent={(
        <div className="rounded-[30px] border border-[#DCE2F2] bg-[#10203F] p-6 text-white shadow-[0_28px_80px_rgba(16,32,63,0.18)]">
          <CheckCircle2 size={28} className="text-[#86EFAC]" aria-hidden="true" />
          <p className="mt-5 text-xl font-bold">Secure checkout complete</p>
          <p className="mt-2 text-sm leading-[1.7] text-white/70">
            Your payment is being reconciled before your workspace dashboard is unlocked.
          </p>
        </div>
      )}
    >
      <section className="mx-auto max-w-3xl rounded-[28px] border border-[#DCE2F2] bg-white p-8 shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
        {isLoading ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
            <Loader2 size={28} className="animate-spin text-[#5B67F7]" />
            <p className="mt-5 text-lg font-semibold text-[#10203F]">Confirming your subscription</p>
            <p className="mt-2 max-w-md text-sm leading-[1.8] text-[#5F6A88]">
              We&apos;re verifying the Paystack checkout and syncing your workspace billing record now.
            </p>
          </div>
        ) : errorMessage ? (
          <div className="space-y-5">
            <div className="rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-5 text-sm leading-[1.8] text-[#991B1B]">
              {errorMessage}
            </div>
            <div className="flex flex-wrap gap-3">
              {session && canRetryVerification ? (
                <Button type="button" onClick={() => setVerificationAttempt((attempt) => attempt + 1)} disabled={isLoading}>
                  {isLoading ? "Retrying verification…" : "Retry verification"}
                </Button>
              ) : !session ? (
                <Button asChild>
                  <Link to={loginPath}>Sign in to continue</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/pricing">Back to pricing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            </div>
          </div>
        ) : verifiedSubscription ? (
          <div className="space-y-6">
            <div className="flex items-start gap-4 rounded-[20px] border border-[#D1FAE5] bg-[#ECFDF5] px-5 py-5">
              <CheckCircle2 size={26} className="mt-0.5 shrink-0 text-[#15803D]" />
              <div>
                <p className="text-lg font-semibold text-[#14532D]">Subscription confirmed</p>
                <p className="mt-2 text-sm leading-[1.8] text-[#166534]">
                  {verifiedSubscription.plan.charAt(0).toUpperCase()}
                  {verifiedSubscription.plan.slice(1)} is now active for {verifiedSubscription.businessName}.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Plan</p>
                <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#10203F]">
                  {verifiedSubscription.plan.charAt(0).toUpperCase()}
                  {verifiedSubscription.plan.slice(1)}
                </p>
                <p className="mt-2 text-sm text-[#5F6A88]">{verifiedSubscription.billingCycle} billing</p>
              </div>
              <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Recurring amount</p>
                <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#10203F]">
                  {formatCurrencyAmount(verifiedSubscription.amount)}
                </p>
                <p className="mt-2 text-sm text-[#5F6A88]">Provider: {verifiedSubscription.provider}</p>
              </div>
              <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Next renewal</p>
                <p className="mt-3 text-lg font-semibold text-[#10203F]">{formatDateLabel(verifiedSubscription.nextRenewalAt)}</p>
              </div>
              <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Reference</p>
                <p className="mt-3 break-all text-sm font-medium text-[#10203F]">{verifiedSubscription.reference ?? reference}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/admin/subscriptions">Open admin subscriptions</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/pricing">Back to pricing</Link>
              </Button>
            </div>
          </div>
        ) : publicConfirmation ? (
          <div className="space-y-6">
            {publicConfirmation.status === "completed" ? (
              <>
                <div className="flex items-start gap-4 rounded-[20px] border border-[#D1FAE5] bg-[#ECFDF5] px-5 py-5">
                  <CheckCircle2 size={26} className="mt-0.5 shrink-0 text-[#15803D]" />
                  <div>
                    <p className="text-lg font-semibold text-[#14532D]">Checkout received</p>
                    <p className="mt-2 text-sm leading-[1.8] text-[#166534]">
                      Your Paystack checkout for the {publicConfirmation.plan} plan was recorded. Check your inbox and
                      confirm your email to finish activating access to the workspace dashboard.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Plan</p>
                    <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#10203F]">
                      {publicConfirmation.plan.charAt(0).toUpperCase()}
                      {publicConfirmation.plan.slice(1)}
                    </p>
                    <p className="mt-2 text-sm text-[#5F6A88]">{publicConfirmation.billingCycle} billing</p>
                  </div>
                  <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Reference</p>
                    <p className="mt-3 break-all text-sm font-medium text-[#10203F]">{publicConfirmation.reference}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to={loginPath}>Sign in after email confirmation</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/pricing">Back to pricing</Link>
                  </Button>
                </div>
              </>
            ) : publicConfirmation.status === "initialized" ? (
              <>
                <div className="rounded-[18px] border border-[#DBEAFE] bg-[#EFF6FF] px-5 py-5 text-sm leading-[1.8] text-[#1D4ED8]">
                  We have your Paystack checkout reference, but the workspace subscription is still waiting for final
                  confirmation. Check your inbox first, then sign in after confirming your email so we can finish
                  activating the workspace.
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Plan</p>
                    <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#10203F]">
                      {publicConfirmation.plan.charAt(0).toUpperCase()}
                      {publicConfirmation.plan.slice(1)}
                    </p>
                    <p className="mt-2 text-sm text-[#5F6A88]">{publicConfirmation.billingCycle} billing</p>
                  </div>
                  <div className="rounded-[18px] border border-[#E6EAF6] bg-[#FBFCFF] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Reference</p>
                    <p className="mt-3 break-all text-sm font-medium text-[#10203F]">{publicConfirmation.reference}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to={loginPath}>Sign in after email confirmation</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/pricing">Back to pricing</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-5 text-sm leading-[1.8] text-[#991B1B]">
                  This checkout reference is marked failed. Sign in to review the subscription attempt or start a fresh
                  checkout.
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to={loginPath}>Sign in to review</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/pricing">Back to pricing</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[18px] border border-[#FEE2E2] bg-[#FFF7F7] px-5 py-5 text-sm leading-[1.8] text-[#991B1B]">
            We could not confirm this workspace subscription.
          </div>
        )}
      </section>
    </PublicPageShell>
  );
};

export default PricingConfirmedPage;
