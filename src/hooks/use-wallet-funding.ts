import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsQueryOptions } from "@/lib/query";
import {
  fetchWorkspaceWalletFundingSessions,
  initializeWorkspaceWalletFunding,
  verifyWorkspaceWalletFunding,
  type WorkspaceWalletFundingInitializationInput,
} from "@/lib/workspace-wallet-funding";

const workspaceWalletFundingQueryKey = (businessId: string) => ["workspace-wallet-funding", businessId] as const;

export const useWorkspaceWalletFundingSessions = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? workspaceWalletFundingQueryKey(businessId) : ["workspace-wallet-funding", "missing-business"],
    queryFn: () => fetchWorkspaceWalletFundingSessions(businessId!),
    enabled: Boolean(businessId),
    ...settingsQueryOptions,
  });

export const useWorkspaceWalletFundingMutations = (businessId?: string) => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!businessId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: workspaceWalletFundingQueryKey(businessId),
      }),
      queryClient.invalidateQueries({
        queryKey: ["workspace-wallet", businessId],
      }),
    ]);
  };

  const initializeFunding = useMutation({
    mutationFn: (values: WorkspaceWalletFundingInitializationInput) => {
      if (!businessId) {
        throw new Error("A workspace is required before funding can be initialized.");
      }

      return initializeWorkspaceWalletFunding({
        ...values,
        businessId,
      });
    },
    onSuccess: invalidate,
  });

  const verifyFunding = useMutation({
    mutationFn: (reference: string) => verifyWorkspaceWalletFunding(reference),
    onSuccess: invalidate,
  });

  return useMemo(
    () => ({
      initializeFunding,
      verifyFunding,
    }),
    [initializeFunding, verifyFunding],
  );
};
