import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Enums } from "@/integrations/supabase/types";
import { invitationPreviewQueryOptions, teamQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

type TeamMemberRpcRow = {
  avatar_url: string | null;
  business_id: string;
  created_at: string;
  email: string;
  full_name: string;
  invited_by: string | null;
  joined_at: string;
  membership_id: string;
  role: Enums<"business_role">;
  status: Enums<"business_member_status">;
  updated_at: string;
  user_id: string;
};

type WorkspaceInvitationRpcRow = {
  accepted_at: string | null;
  accepted_user_id: string | null;
  business_id: string;
  created_at: string;
  expires_at: string;
  invitation_id: string;
  invited_by: string;
  invited_by_name: string;
  invited_email: string;
  role: Enums<"business_role">;
  status: "accepted" | "expired" | "pending" | "revoked";
  updated_at: string;
};

type InviteTeamMemberRpcResult = {
  expires_at?: string | null;
  invitation_id?: string;
  invitation_token?: string;
  member_id?: string;
  mode?: "existing_account" | "invitation_created";
  recipient_email?: string;
  role?: Enums<"business_role">;
  status?: string;
  user_id?: string;
};

type WorkspaceInvitationPreviewRpcRow = {
  business_id: string;
  business_name: string;
  expires_at: string;
  invitation_id: string;
  invited_by_name: string;
  invited_email: string;
  role: Enums<"business_role">;
  status: "accepted" | "expired" | "pending" | "revoked";
};

type AcceptWorkspaceInvitationRpcRow = {
  business_id: string;
  business_name: string;
  membership_id: string;
  role: Enums<"business_role">;
};

export type TeamMemberItem = {
  avatarUrl: string | null;
  businessId: string;
  createdAt: string;
  email: string;
  fullName: string;
  invitedBy: string | null;
  isCurrentUser: boolean;
  joinedAt: string;
  membershipId: string;
  role: Enums<"business_role">;
  status: Enums<"business_member_status">;
  updatedAt: string;
  userId: string;
};

export type InviteTeamMemberInput = {
  email: string;
  role: Enums<"business_role">;
};

export type InviteTeamMemberResult = {
  expiresAt: string | null;
  invitationId: string | null;
  invitationToken: string | null;
  memberId: string | null;
  mode: "existing_account" | "invitation_created";
  recipientEmail: string;
  role: Enums<"business_role">;
  status: string;
  userId: string | null;
};

export type WorkspaceInvitationItem = {
  acceptedAt: string | null;
  acceptedUserId: string | null;
  businessId: string;
  createdAt: string;
  expiresAt: string;
  invitationId: string;
  invitedBy: string;
  invitedByName: string;
  invitedEmail: string;
  role: Enums<"business_role">;
  status: "accepted" | "expired" | "pending" | "revoked";
  updatedAt: string;
};

export type WorkspaceInvitationPreview = {
  businessId: string;
  businessName: string;
  expiresAt: string;
  invitationId: string;
  invitedByName: string;
  invitedEmail: string;
  role: Enums<"business_role">;
  status: "accepted" | "expired" | "pending" | "revoked";
};

export type AcceptedWorkspaceInvitation = {
  businessId: string;
  businessName: string;
  membershipId: string;
  role: Enums<"business_role">;
};

const teamMembersQueryKey = (businessId: string) => ["team-members", businessId] as const;
const workspaceInvitationsQueryKey = (businessId: string) => ["workspace-invitations", businessId] as const;
const workspaceInvitationPreviewQueryKey = (token: string) => ["workspace-invitation", token] as const;

const fetchTeamMembers = async (businessId: string, currentUserId?: string): Promise<TeamMemberItem[]> => {
  const { data, error } = await supabase.rpc("list_business_members", {
    p_business_id: businessId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TeamMemberRpcRow[]).map((member) => ({
    avatarUrl: member.avatar_url,
    businessId: member.business_id,
    createdAt: member.created_at,
    email: member.email,
    fullName: member.full_name,
    invitedBy: member.invited_by,
    isCurrentUser: member.user_id === currentUserId,
    joinedAt: member.joined_at,
    membershipId: member.membership_id,
    role: member.role,
    status: member.status,
    updatedAt: member.updated_at,
    userId: member.user_id,
  }));
};

const fetchWorkspaceInvitations = async (businessId: string): Promise<WorkspaceInvitationItem[]> => {
  const { data, error } = await supabase.rpc("list_workspace_invitations", {
    p_business_id: businessId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as WorkspaceInvitationRpcRow[]).map((invitation) => ({
    acceptedAt: invitation.accepted_at,
    acceptedUserId: invitation.accepted_user_id,
    businessId: invitation.business_id,
    createdAt: invitation.created_at,
    expiresAt: invitation.expires_at,
    invitationId: invitation.invitation_id,
    invitedBy: invitation.invited_by,
    invitedByName: invitation.invited_by_name,
    invitedEmail: invitation.invited_email,
    role: invitation.role,
    status: invitation.status,
    updatedAt: invitation.updated_at,
  }));
};

const inviteTeamMember = async (businessId: string, values: InviteTeamMemberInput): Promise<InviteTeamMemberResult> => {
  const { data, error } = await supabase.rpc("invite_business_member", {
    p_business_id: businessId,
    p_email: values.email,
    p_role: values.role,
  });

  if (error) {
    throw error;
  }

  const result = (Array.isArray(data) ? data[0] : data) as InviteTeamMemberRpcResult | null;

  if (!result?.mode || !result.recipient_email || !result.role || !result.status) {
    throw new Error("The team invitation service returned an unexpected response.");
  }

  return {
    expiresAt: typeof result.expires_at === "string" ? result.expires_at : null,
    invitationId: typeof result.invitation_id === "string" ? result.invitation_id : null,
    invitationToken: typeof result.invitation_token === "string" ? result.invitation_token : null,
    memberId: typeof result.member_id === "string" ? result.member_id : null,
    mode: result.mode,
    recipientEmail: result.recipient_email,
    role: result.role,
    status: result.status,
    userId: typeof result.user_id === "string" ? result.user_id : null,
  };
};

const fetchWorkspaceInvitation = async (token: string): Promise<WorkspaceInvitationPreview | null> => {
  const { data, error } = await supabase.rpc("get_workspace_invitation", {
    p_token: token,
  });

  if (error) {
    throw error;
  }

  const invitation = (Array.isArray(data) ? data[0] : data) as WorkspaceInvitationPreviewRpcRow | null;

  if (!invitation?.invitation_id) {
    return null;
  }

  return {
    businessId: invitation.business_id,
    businessName: invitation.business_name,
    expiresAt: invitation.expires_at,
    invitationId: invitation.invitation_id,
    invitedByName: invitation.invited_by_name,
    invitedEmail: invitation.invited_email,
    role: invitation.role,
    status: invitation.status,
  };
};

const acceptWorkspaceInvitation = async (token: string): Promise<AcceptedWorkspaceInvitation> => {
  const { data, error } = await supabase.rpc("accept_workspace_invitation", {
    p_token: token,
  });

  if (error) {
    throw error;
  }

  const result = (Array.isArray(data) ? data[0] : data) as AcceptWorkspaceInvitationRpcRow | null;

  if (!result?.business_id || !result.business_name || !result.membership_id || !result.role) {
    throw new Error("The invitation acceptance flow returned an unexpected response.");
  }

  return {
    businessId: result.business_id,
    businessName: result.business_name,
    membershipId: result.membership_id,
    role: result.role,
  };
};

export const useTeamMembersData = (businessId?: string, currentUserId?: string) =>
  useQuery({
    queryKey: businessId ? teamMembersQueryKey(businessId) : ["team-members", "missing-context"],
    queryFn: () => fetchTeamMembers(businessId!, currentUserId),
    enabled: Boolean(businessId),
    ...teamQueryOptions,
  });

export const useWorkspaceInvitationsData = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? workspaceInvitationsQueryKey(businessId) : ["workspace-invitations", "missing-context"],
    queryFn: () => fetchWorkspaceInvitations(businessId!),
    enabled: Boolean(businessId),
    ...teamQueryOptions,
  });

export const useWorkspaceInvitationData = (token?: string) =>
  useQuery({
    queryKey: token ? workspaceInvitationPreviewQueryKey(token) : ["workspace-invitation", "missing-token"],
    queryFn: () => fetchWorkspaceInvitation(token!),
    enabled: Boolean(token),
    ...invitationPreviewQueryOptions,
  });

export const useAcceptWorkspaceInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => acceptWorkspaceInvitation(token),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceInvitationsQueryKey(result.businessId) }),
        queryClient.invalidateQueries({ queryKey: teamMembersQueryKey(result.businessId) }),
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
      ]);
    },
  });
};

export const useTeamMemberMutations = (businessId?: string) => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!businessId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: teamMembersQueryKey(businessId) }),
      queryClient.invalidateQueries({ queryKey: workspaceInvitationsQueryKey(businessId) }),
    ]);
  };

  return {
    inviteMember: useMutation({
      mutationFn: (values: InviteTeamMemberInput) => {
        if (!businessId) {
          throw new Error("A business workspace is required before team members can be invited.");
        }

        return inviteTeamMember(businessId, values);
      },
      onSuccess: invalidate,
    }),
    updateMemberRole: useMutation({
      mutationFn: ({ membershipId, role }: { membershipId: string; role: Enums<"business_role"> }) =>
        updateTeamMemberRole(membershipId, role),
      onSuccess: invalidate,
    }),
    updateMemberStatus: useMutation({
      mutationFn: ({ membershipId, status }: { membershipId: string; status: Enums<"business_member_status"> }) =>
        updateTeamMemberStatus(membershipId, status),
      onSuccess: invalidate,
    }),
  };
};

const updateTeamMemberRole = async (membershipId: string, role: Enums<"business_role">) => {
  const { error } = await supabase.rpc("update_business_member_role", {
    p_membership_id: membershipId,
    p_role: role,
  });

  if (error) {
    throw error;
  }
};

const updateTeamMemberStatus = async (membershipId: string, status: Enums<"business_member_status">) => {
  const { error } = await supabase.rpc("update_business_member_status", {
    p_membership_id: membershipId,
    p_status: status,
  });

  if (error) {
    throw error;
  }
};
