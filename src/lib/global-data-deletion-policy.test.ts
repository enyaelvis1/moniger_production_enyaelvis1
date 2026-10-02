import { describe, expect, it } from "vitest";
import {
  buildGlobalDataDeletionBulkConfirmation,
  canManageGlobalDataDeletion,
  globalDataDeletionConfirmation,
  selectNonSuperAdminUserIds,
} from "../../supabase/functions/_shared/global-data-deletion-policy";

describe("global data deletion policy", () => {
  it("requires a super admin", () => {
    expect(canManageGlobalDataDeletion("super_admin")).toBe(true);
    expect(canManageGlobalDataDeletion("support")).toBe(false);
    expect(canManageGlobalDataDeletion(undefined)).toBe(false);
  });

  it("preserves every super admin user id", () => {
    expect(selectNonSuperAdminUserIds(
      ["super-1", "member-1", "super-2", "member-2"],
      ["super-1", "super-2"],
    )).toEqual(["member-1", "member-2"]);
  });

  it("builds exact destructive confirmations", () => {
    expect(globalDataDeletionConfirmation).toBe("DELETE ALL NON-SUPER-ADMIN DATA");
    expect(buildGlobalDataDeletionBulkConfirmation(4, 3)).toBe("DELETE 4 USERS AND 3 WORKSPACES");
  });
});
