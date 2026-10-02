export const globalDataDeletionConfirmation = "DELETE ALL NON-SUPER-ADMIN DATA";

export const buildGlobalDataDeletionBulkConfirmation = (userCount: number, businessCount: number) =>
  `DELETE ${userCount} USERS AND ${businessCount} WORKSPACES`;

export const canManageGlobalDataDeletion = (role: unknown) => role === "super_admin";

export const selectNonSuperAdminUserIds = (
  userIds: string[],
  superAdminUserIds: Iterable<string>,
) => {
  const protectedIds = new Set(superAdminUserIds);
  return userIds.filter((userId) => !protectedIds.has(userId));
};
