import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsQueryOptions } from "@/lib/query";
import {
  getAdminWorkspacePayoutRoutingConfig,
  getAdminGlobalMarketplaceFee,
  getWorkspacePayoutRoutingConfig,
  refreshWorkspacePayoutVerification,
  saveAdminGlobalMarketplaceFee,
  upsertAdminWorkspaceSplitConfig,
  upsertWorkspacePayoutAccount,
  upsertWorkspaceSplitConfig,
  type WorkspacePayoutAccountInput,
  type WorkspacePayoutRoutingConfigResult,
  type WorkspaceSplitConfigInput,
} from "@/lib/workspace-payout-routing";

const workspacePayoutRoutingQueryKey = (businessId: string) => ["workspace-payout-routing", businessId] as const;

export const useWorkspacePayoutRoutingConfig = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? workspacePayoutRoutingQueryKey(businessId) : ["workspace-payout-routing", "missing-business"],
    queryFn: () => getWorkspacePayoutRoutingConfig(businessId),
    enabled: Boolean(businessId),
    ...settingsQueryOptions,
  });

export const useAdminGlobalMarketplaceFee = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-global-marketplace-fee"],
    queryFn: getAdminGlobalMarketplaceFee,
    ...settingsQueryOptions,
  });
  const mutation = useMutation({
    mutationFn: saveAdminGlobalMarketplaceFee,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-global-marketplace-fee"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-workspace-payout-routing"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-payout-routing"] }),
      ]);
    },
  });
  return { query, mutation };
};

export const useAdminWorkspacePayoutRoutingConfig = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? ["admin-workspace-payout-routing", businessId] : ["admin-workspace-payout-routing", "missing-business"],
    queryFn: () => getAdminWorkspacePayoutRoutingConfig(businessId!),
    enabled: Boolean(businessId),
    ...settingsQueryOptions,
  });

export const useWorkspacePayoutRoutingMutations = (businessId?: string) => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!businessId) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: workspacePayoutRoutingQueryKey(businessId),
    });
  };

  return {
    refreshVerification: useMutation({
      mutationFn: () => {
        if (!businessId) throw new Error("A business workspace is required before checking payout verification.");
        return refreshWorkspacePayoutVerification(businessId);
      },
      onSuccess: invalidate,
    }),
    upsertPayoutAccount: useMutation({
      mutationFn: (values: WorkspacePayoutAccountInput) => {
        if (!businessId) {
          throw new Error("A business workspace is required before payout routing can be updated.");
        }

        return upsertWorkspacePayoutAccount(businessId, values);
      },
      onSuccess: invalidate,
    }),
    upsertSplitConfig: useMutation({
      mutationFn: (values: WorkspaceSplitConfigInput) => {
        if (!businessId) {
          throw new Error("A business workspace is required before payout routing can be updated.");
        }

        return upsertWorkspaceSplitConfig(businessId, values);
      },
      onSuccess: invalidate,
    }),
  };
};

export const useAdminWorkspacePayoutRoutingMutations = (businessId?: string) => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!businessId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin-workspace-payout-routing", businessId],
      }),
      queryClient.invalidateQueries({
        queryKey: workspacePayoutRoutingQueryKey(businessId),
      }),
    ]);
  };

  return {
    upsertSplitConfig: useMutation({
      mutationFn: (values: WorkspaceSplitConfigInput) => {
        if (!businessId) {
          throw new Error("A business workspace is required before payout routing can be updated.");
        }

        return upsertAdminWorkspaceSplitConfig(businessId, values);
      },
      onSuccess: invalidate,
    }),
  };
};

export type { WorkspacePayoutRoutingConfigResult };
