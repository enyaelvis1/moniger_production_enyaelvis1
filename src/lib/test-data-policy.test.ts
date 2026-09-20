import { describe, expect, it } from "vitest";
import { buildBulkTestDataConfirmation, canManageTestData, isMarkedTestData, isSafeToDeletePayment, isSafeToDeletePayout, maxTestDataDeletionBatch, validateTestDataDeletionBatch } from "../../supabase/functions/_shared/test-data-policy";

describe("test data cleanup policy", () => {
  it.each([
    [{ is_test_data: true }, true],
    [{ metadata: { test_data: true } }, true],
    [{ metadata: { environment: "sandbox" } }, true],
    [{ provider_metadata: { provider_mode: "test" } }, true],
    [{ metadata: { environment: "production" } }, false],
    [{}, false],
  ])("identifies explicit QA markers safely", (row, expected) => {
    expect(isMarkedTestData(row)).toBe(expected);
  });

  it.each([
    ["failed", true],
    ["reversed", true],
    ["cancelled", true],
    ["pending", false],
    ["submitted", false],
    ["completed", false],
  ])("only allows non-live payout status %s to be deleted", (status, expected) => {
    expect(isSafeToDeletePayout(status)).toBe(expected);
  });

  it.each([
    [{ is_test_data: true, gateway: "manual" }, true],
    [{ is_test_data: true, gateway: "paystack", metadata: { provider_mode: "test" } }, true],
    [{ is_test_data: true, gateway: "paystack", metadata: { environment: "sandbox" } }, true],
    [{ is_test_data: true, gateway: "paystack", metadata: { environment: "production" } }, false],
    [{ is_test_data: true, gateway: "paystack" }, false],
    [{ gateway: "manual" }, false],
  ])("only allows explicitly safe payment provider states", (row, expected) => {
    expect(isSafeToDeletePayment(row)).toBe(expected);
  });

  it("limits cleanup batches", () => {
    expect(() => validateTestDataDeletionBatch(maxTestDataDeletionBatch)).not.toThrow();
    expect(() => validateTestDataDeletionBatch(maxTestDataDeletionBatch + 1)).toThrow(/limited to 500 records/);
  });

  it("builds an exact count-specific confirmation for bulk cleanup", () => {
    expect(buildBulkTestDataConfirmation(2)).toBe("DELETE 2 RECORDS");
    expect(buildBulkTestDataConfirmation(500)).toBe("DELETE 500 RECORDS");
  });

  it("allows cleanup only for super admins", () => {
    expect(canManageTestData("super_admin")).toBe(true);
    expect(canManageTestData("support")).toBe(false);
    expect(canManageTestData("owner")).toBe(false);
    expect(canManageTestData(undefined)).toBe(false);
  });
});
