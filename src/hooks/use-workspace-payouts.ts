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
    .select("id, amount, currency, status, failure_reason, provider_reference, provider_transfer_code, reserved_at, scheduled_for, cancelled_at, last_attempt_at, next_retry_at, retry_count, submitted_at, completed_at, reversed_at, created_at, bill_id, vendor_id, vendor_bank_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const billIds = [...new Set(rows.map((row) => row.bill_id).filter((id): id is string => Boolean(id)))];
  const vendorIds = [...new Set(rows.map((row) => row.vendor_id).filter((id): id is string => Boolean(id)))];
  const bankIds = [...new Set(rows.map((row) => row.vendor_bank_id).filter((id): id is string => Boolean(id)))];
  const [billsResponse, vendorsResponse, banksResponse] = await Promise.all([
    billIds.length ? supabase.from("bills").select("id, bill_number, bill_date").in("id", billIds) : Promise.resolve({ data: [], error: null }),
    vendorIds.length ? supabase.from("vendors").select("id, business_name").in("id", vendorIds) : Promise.resolve({ data: [], error: null }),
    bankIds.length ? supabase.from("banks").select("id, name, bank_code").in("id", bankIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = billsResponse.error ?? vendorsResponse.error ?? banksResponse.error;
  if (relatedError) {
    throw relatedError;
  }
  const billMap = new Map((billsResponse.data ?? []).map((bill) => [bill.id, bill]));
  const vendorMap = new Map((vendorsResponse.data ?? []).map((vendor) => [vendor.id, vendor]));
  const bankMap = new Map((banksResponse.data ?? []).map((bank) => [bank.id, bank]));

  return rows.map((row) => {
    const bill = row.bill_id ? billMap.get(row.bill_id) : undefined;
    const vendor = row.vendor_id ? vendorMap.get(row.vendor_id) : undefined;
    const bank = row.vendor_bank_id ? bankMap.get(row.vendor_bank_id) : undefined;

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
