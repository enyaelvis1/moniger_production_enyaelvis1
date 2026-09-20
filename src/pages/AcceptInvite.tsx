import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Shield, Users } from "lucide-react";
import AuthShell, { AuthCardHeader, authPrimaryButtonClassName, authSecondaryButtonClassName } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { useAcceptWorkspaceInvitation, useWorkspaceInvitationData } from "@/hooks/use-team-data";

const formatRoleLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const AcceptInvitePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const { formatDateTime, t } = useLocalization();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const invitationQuery = useWorkspaceInvitationData(token || undefined);
  const acceptInvitationMutation = useAcceptWorkspaceInvitation();

  const invitation = invitationQuery.data;
  const currentEmail = user?.email?.trim().toLowerCase() ?? "";
  const invitedEmail = invitation?.invitedEmail?.trim().toLowerCase() ?? "";
  const emailMatches = Boolean(currentEmail && invitedEmail && currentEmail === invitedEmail);
  const nextPath = token ? `/accept-invite?token=${encodeURIComponent(token)}` : "/accept-invite";

  const statusTone = useMemo(() => {
    if (invitation?.status === "pending") {
      return {
        badge: t("auth.acceptInvite.status.pending"),
        className: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
      };
    }

    if (invitation?.status === "accepted") {
      return {
        badge: t("auth.acceptInvite.status.accepted"),
        className: "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]",
      };
    }

    return {
      badge: invitation?.status ? invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1) : t("auth.acceptInvite.status.unavailable"),
      className: "border-[#F8C9C9] bg-[#FEF2F2] text-[#B42318]",
    };
  }, [invitation?.status, t]);

  const handleAcceptInvitation = async () => {
    if (!token) {
      return;
    }

    try {
      const acceptedInvitation = await acceptInvitationMutation.mutateAsync(token);
      toast({
        title: t("auth.acceptInvite.toastAccepted"),
        description: t("auth.acceptInvite.toastAcceptedDescription", {
          businessName: acceptedInvitation.businessName,
          role: formatRoleLabel(acceptedInvitation.role),
        }),
      });
      navigate("/team", { replace: true });
    } catch (error) {
      toast({
        title: t("auth.acceptInvite.unableToAccept"),
        description: error instanceof Error ? error.message : t("auth.acceptInvite.tryAgain"),
        variant: "destructive",
      });
    }
  };

  const handleUseAnotherAccount = async () => {
    try {
      await signOut("local");
      navigate(`/login?email=${encodeURIComponent(invitedEmail)}&next=${encodeURIComponent(nextPath)}`, { replace: true });
    } catch (error) {
      toast({
        title: t("auth.acceptInvite.switchAccountError"),
        description: error instanceof Error ? error.message : t("auth.acceptInvite.tryAgain"),
        variant: "destructive",
      });
    }
  };

  return (
    <AuthShell
      topActionLabel={t("auth.acceptInvite.backToHome")}
      topActionTo="/"
      cardHeader={
        <AuthCardHeader
          title={t("auth.acceptInvite.title")}
          subtitle={t("auth.acceptInvite.subtitle")}
        />
      }
    >
      {!token ? (
        <div className="rounded-[18px] border border-[#F8C9C9] bg-[#FEF2F2] px-5 py-5 text-sm text-[#B42318]">
          {t("auth.acceptInvite.missingToken")}
        </div>
      ) : invitationQuery.isLoading ? (
        <div className="flex items-center justify-center rounded-[18px] border border-[#D8DDF0] bg-[#F8F9FD] px-5 py-8 text-sm text-[#4A5675]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("auth.acceptInvite.loading")}
        </div>
      ) : !invitation ? (
        <div className="rounded-[18px] border border-[#F8C9C9] bg-[#FEF2F2] px-5 py-5 text-sm text-[#B42318]">
          {t("auth.acceptInvite.notFound")}
        </div>
      ) : (
        <div className="space-y-6">
          <div className={`rounded-[18px] border px-5 py-5 text-sm ${statusTone.className}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">{statusTone.badge}</Badge>
              <span>{invitation.businessName}</span>
            </div>
          </div>

          <div className="space-y-4 rounded-[18px] border border-[#D8DDF0] bg-white px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF2FF] text-[#3B4CC4]">
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[18px] font-semibold text-[#15203B]">{invitation.businessName}</p>
                <p className="text-sm text-[#5F6A88]">
                  {t("auth.acceptInvite.roleDescription", {
                    inviterName: invitation.invitedByName,
                    role: formatRoleLabel(invitation.role),
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-[#E1E5F0] bg-[#F8F9FD] px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-[#7D8090]">{t("auth.acceptInvite.invitedEmail")}</p>
                <p className="mt-1 text-sm font-medium text-[#15203B]">{invitation.invitedEmail}</p>
              </div>
              <div className="rounded-[14px] border border-[#E1E5F0] bg-[#F8F9FD] px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-[#7D8090]">{t("auth.acceptInvite.expires")}</p>
                <p className="mt-1 text-sm font-medium text-[#15203B]">{formatDateTime(invitation.expiresAt)}</p>
              </div>
            </div>

            {invitation.status === "pending" ? (
              <>
                {!user ? (
                  <div className="space-y-4">
                    <div className="rounded-[14px] border border-[#D8DDF0] bg-[#F8F9FD] px-4 py-4 text-sm text-[#4A5675]">
                      {t("auth.acceptInvite.pendingSignInPrompt", { email: invitation.invitedEmail })}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/login?email=${encodeURIComponent(invitation.invitedEmail)}&next=${encodeURIComponent(nextPath)}`)
                        }
                        className={`${authPrimaryButtonClassName} w-full sm:flex-1`}
                      >
                        {t("auth.acceptInvite.signInToAccept")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/register?email=${encodeURIComponent(invitation.invitedEmail)}&next=${encodeURIComponent(nextPath)}`)
                        }
                        className={`${authSecondaryButtonClassName} w-full sm:flex-1`}
                      >
                        {t("auth.acceptInvite.createAccount")}
                      </button>
                    </div>
                  </div>
                ) : emailMatches ? (
                  <div className="space-y-4">
                    <div className="rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4 text-sm text-[#1D4ED8]">
                      {t("auth.acceptInvite.pendingSignedInAs", { email: currentEmail })}
                    </div>

                    <Button
                      type="button"
                      onClick={() => void handleAcceptInvitation()}
                      disabled={acceptInvitationMutation.isPending}
                      className="w-full bg-[#15203B] text-white hover:bg-[#0F172A]"
                    >
                      {acceptInvitationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      {t("auth.acceptInvite.acceptInvitation")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-4 text-sm text-[#92400E]">
                      {t("auth.acceptInvite.useDifferentAccountMessage", {
                        currentEmail,
                        invitedEmail: invitation.invitedEmail,
                      })}
                    </div>

                    <Button type="button" variant="outline" onClick={() => void handleUseAnotherAccount()} className="w-full">
                      <Mail className="h-4 w-4" />
                      {t("auth.acceptInvite.switchAccount")}
                    </Button>
                  </div>
                )}
              </>
            ) : invitation.status === "accepted" ? (
              <div className="rounded-[14px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-4 text-sm text-[#15803D]">
                {t("auth.acceptInvite.acceptedMessage")}
              </div>
            ) : (
              <div className="rounded-[14px] border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-4 text-sm text-[#B42318]">
                {t("auth.acceptInvite.inactiveMessage")}
              </div>
            )}
          </div>
        </div>
      )}
    </AuthShell>
  );
};

export default AcceptInvitePage;
