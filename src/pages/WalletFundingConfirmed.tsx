import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useWorkspaceWalletFundingMutations } from "@/hooks/use-wallet-funding";
import { useToast } from "@/hooks/use-toast";
import { getWorkspaceWalletFundingErrorMessage } from "@/lib/workspace-wallet-funding";

const WalletFundingConfirmedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const reference = useMemo(() => searchParams.get("reference")?.trim() ?? "", [searchParams]);
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const walletFundingMutations = useWorkspaceWalletFundingMutations(businessId);
  const hasRequestedVerificationRef = useRef(false);
  const verificationTimeoutRef = useRef<number | null>(null);
  const fallbackReturnTimeoutRef = useRef<number | null>(null);
  const returnCountdownRef = useRef<number | null>(null);
  const [verificationState, setVerificationState] = useState<"loading" | "pending" | "complete" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("Verifying your workspace funding session...");
  const [redirectSecondsRemaining, setRedirectSecondsRemaining] = useState(2);
  const [shouldAutoReturn, setShouldAutoReturn] = useState(false);

  useEffect(() => {
    if (!reference) {
      setVerificationState("error");
      setStatusMessage("Missing funding reference.");
      return;
    }

    if (!businessId) {
      setVerificationState("loading");
      setStatusMessage("Loading your workspace...");
      return;
    }

    if (hasRequestedVerificationRef.current) {
      return;
    }

    hasRequestedVerificationRef.current = true;

    let isMounted = true;
    setVerificationState("loading");
    setStatusMessage("Verifying your workspace funding session...");
    setShouldAutoReturn(true);
    setRedirectSecondsRemaining(6);

    if (typeof window !== "undefined") {
      if (verificationTimeoutRef.current) {
        window.clearTimeout(verificationTimeoutRef.current);
      }

      verificationTimeoutRef.current = window.setTimeout(() => {
        if (!isMounted) {
          return;
        }

        setVerificationState("pending");
        setStatusMessage("We’re still confirming this top-up. Returning you to your wallet now.");
      }, 4_000);

      if (fallbackReturnTimeoutRef.current) {
        window.clearTimeout(fallbackReturnTimeoutRef.current);
      }

      fallbackReturnTimeoutRef.current = window.setTimeout(() => {
        if (!isMounted) {
          return;
        }

        setVerificationState((currentState) => (currentState === "complete" ? currentState : "pending"));
        setStatusMessage("We’re taking you back to your wallet now. If the top-up succeeded, your balance will already be updated there.");
      }, 8_000);
    }

    void walletFundingMutations.verifyFunding
      .mutateAsync(reference)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        if (result.applied || result.status === "completed") {
          if (verificationTimeoutRef.current && typeof window !== "undefined") {
            window.clearTimeout(verificationTimeoutRef.current);
            verificationTimeoutRef.current = null;
          }
          if (fallbackReturnTimeoutRef.current && typeof window !== "undefined") {
            window.clearTimeout(fallbackReturnTimeoutRef.current);
            fallbackReturnTimeoutRef.current = null;
          }

          setVerificationState("complete");
          setRedirectSecondsRemaining(1);
          setStatusMessage(result.message ?? "Workspace funding confirmed.");
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(
              "walletFundingSuccess",
              JSON.stringify({
                amount: result.fundingSession.amount,
                currency: result.fundingSession.currency,
                reference,
                statusMessage: result.message ?? "Workspace funding confirmed.",
              }),
            );
          }
          toast({
            title: "Workspace funding confirmed",
            description: "Your workspace funding balance has been updated after provider verification.",
          });
          return;
        }

        setVerificationState("pending");
        setShouldAutoReturn(true);
        setRedirectSecondsRemaining(3);
        setStatusMessage(result.message ?? "Paystack has not confirmed this top-up yet.");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        if (verificationTimeoutRef.current && typeof window !== "undefined") {
          window.clearTimeout(verificationTimeoutRef.current);
          verificationTimeoutRef.current = null;
        }
        if (fallbackReturnTimeoutRef.current && typeof window !== "undefined") {
          window.clearTimeout(fallbackReturnTimeoutRef.current);
          fallbackReturnTimeoutRef.current = null;
        }

        setVerificationState("error");
        setShouldAutoReturn(true);
        setRedirectSecondsRemaining(3);
        setStatusMessage(
          getWorkspaceWalletFundingErrorMessage(
            error,
            "We could not verify the workspace funding session. Please try again.",
          ),
        );
      });

    return () => {
      isMounted = false;
      if (verificationTimeoutRef.current && typeof window !== "undefined") {
        window.clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }
      if (fallbackReturnTimeoutRef.current && typeof window !== "undefined") {
        window.clearTimeout(fallbackReturnTimeoutRef.current);
        fallbackReturnTimeoutRef.current = null;
      }
    };
  }, [businessId, reference, toast, walletFundingMutations.verifyFunding]);

  useEffect(() => {
    if (!shouldAutoReturn) {
      setRedirectSecondsRemaining(2);
      return;
    }

    if (returnCountdownRef.current) {
      window.clearInterval(returnCountdownRef.current);
    }

    returnCountdownRef.current = window.setInterval(() => {
      setRedirectSecondsRemaining((currentValue) => {
        if (currentValue <= 1) {
          if (returnCountdownRef.current) {
            window.clearInterval(returnCountdownRef.current);
            returnCountdownRef.current = null;
          }
          navigate("/wallet");
          return 0;
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => {
      if (returnCountdownRef.current) {
        window.clearInterval(returnCountdownRef.current);
        returnCountdownRef.current = null;
      }
    };
  }, [navigate, shouldAutoReturn, verificationState]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-start gap-3">
            {verificationState === "error" ? (
              <TriangleAlert className="mt-1 h-6 w-6 text-destructive" />
            ) : verificationState === "complete" ? (
              <CheckCircle2 className="mt-1 h-6 w-6 text-[hsl(var(--success))]" />
            ) : (
              <Loader2 className="mt-1 h-6 w-6 animate-spin text-primary" />
            )}
            <div className="space-y-2">
              <Badge variant="outline">
                {verificationState === "error"
                  ? "Verification issue"
                  : verificationState === "complete"
                    ? "Confirmed"
                    : verificationState === "pending"
                      ? "Pending confirmation"
                      : "Verifying"}
              </Badge>
              <h2 className="text-2xl font-semibold text-foreground">Workspace funding status</h2>
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Reference: <span className="font-medium text-foreground">{reference || "Missing"}</span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/wallet")} className="w-full sm:w-auto">
              Back to funding
              </Button>
          </div>

          {shouldAutoReturn ? (
            <p className="mt-3 text-xs text-muted-foreground">
              You’ll be returned to your wallet in {redirectSecondsRemaining} second{redirectSecondsRemaining === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
};

export default WalletFundingConfirmedPage;
