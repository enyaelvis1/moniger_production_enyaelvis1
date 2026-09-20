import { useQuery } from "@tanstack/react-query";
import { settingsQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

export type WorkspacePayoutHistoryItem = {
  amount: number;
  billDate: string | null;
  billNumber: string | null;
  completedAt: string | null;
  createdAt: string;
  currency: string;
  failureReason: string | null;
  id: string;
  providerReference: string | null;
  providerTransferCode: string | null;
  recipientBankCode: string | null;
  recipientBankName: string | null;
  reservedAt: string | null;
  reversedAt: string | null;
  cancelledAt: string | null;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  retryCount: number;
  scheduledFor: string | null;
  status: string;
  submittedAt: string | null;
  vendorName: string | null;
};

const workspacePayoutsQueryKey = (businessId: string) => ["workspace-payouts", businessId] as const;

const fetchWorkspacePayoutHistory = async (businessId: string): Promise<WorkspacePayoutHistoryItem[]> => {
  const { data, error } = await supabase
    .from("workspace_payouts")
    .select(
      `
        id,
        amount,
        currency,
        status,
        failure_reason,
        provider_reference,
        provider_transfer_code,
        reserved_at,
        scheduled_for,
        cancelled_at,
        last_attempt_at,
        next_retry_at,
        retry_count,
        submitted_at,
        completed_at,
        reversed_at,
        created_at,
        bill:bills (
          bill_number,
          bill_date
        ),
        vendor:vendors (
          business_name
        ),
        bank:banks (
          name,
          bank_code
        )
      `,
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const bill = Array.isArray(row.bill) ? row.bill[0] : row.bill;
    const vendor = Array.isArray(row.vendor) ? row.vendor[0] : row.vendor;
    const bank = Array.isArray(row.bank) ? row.bank[0] : row.bank;

    return {
      amount: Number(row.amount ?? 0),
      billDate: bill?.bill_date ?? null,
      billNumber: bill?.bill_number ?? null,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
      currency: row.currency,
      failureReason: row.failure_reason ?? null,
      id: row.id,
      providerReference: row.provider_reference ?? null,
      providerTransferCode: row.provider_transfer_code ?? null,
      recipientBankCode: bank?.bank_code ?? null,
      recipientBankName: bank?.name ?? null,
      reservedAt: row.reserved_at ?? null,
      reversedAt: row.reversed_at ?? null,
      cancelledAt: row.cancelled_at ?? null,
      lastAttemptAt: row.last_attempt_at ?? null,
      nextRetryAt: row.next_retry_at ?? null,
      retryCount: Number(row.retry_count ?? 0),
      scheduledFor: row.scheduled_for ?? null,
      status: row.status,
      submittedAt: row.submitted_at ?? null,
      vendorName: vendor?.business_name ?? null,
    };
  });
};

export const useWorkspacePayoutHistory = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? workspacePayoutsQueryKey(businessId) : ["workspace-payouts", "missing-business"],
    queryFn: () => fetchWorkspacePayoutHistory(businessId!),
    enabled: Boolean(businessId),
    ...settingsQueryOptions,
  });
