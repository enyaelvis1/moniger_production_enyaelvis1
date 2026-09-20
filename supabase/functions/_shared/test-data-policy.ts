export const safeToDeletePayoutStatuses = ["failed", "reversed", "cancelled"] as const;
export const maxTestDataDeletionBatch = 500;
export const buildBulkTestDataConfirmation = (count: number) => `DELETE ${count} RECORDS`;

export const canManageTestData = (role: unknown) => role === "super_admin";

const asString = (value: unknown) => typeof value === "string" ? value : "";
const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {};

export const isMarkedTestData = (row: Record<string, unknown>) => {
  if (row.is_test_data === true) {
    return true;
  }

  const metadata = asRecord(row.metadata ?? row.provider_metadata);
  return metadata.test_data === true || [
    asString(metadata.environment),
    asString(metadata.provider_mode),
  ].some((value) => ["test", "sandbox"].includes(value.toLowerCase()));
};

export const isSafeToDeletePayout = (status: unknown) =>
  safeToDeletePayoutStatuses.includes(asString(status) as (typeof safeToDeletePayoutStatuses)[number]);

export const isSafeToDeletePayment = (row: Record<string, unknown>) => {
  if (!isMarkedTestData(row)) {
    return false;
  }

  const gateway = asString(row.gateway).toLowerCase();
  const metadata = asRecord(row.metadata);
  const providerMode = [asString(metadata.provider_mode), asString(metadata.environment)]
    .map((value) => value.toLowerCase())
    .find((value) => value.length > 0);

  return gateway !== "paystack" || providerMode === "test" || providerMode === "sandbox";
};

export const validateTestDataDeletionBatch = (count: number) => {
  if (count > maxTestDataDeletionBatch) {
    throw new Error(`Test data cleanup is limited to ${maxTestDataDeletionBatch} records per batch.`);
  }
};
