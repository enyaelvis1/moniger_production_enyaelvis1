import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../playwright-fixture";

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const memberEmail = process.env.PLAYWRIGHT_NON_ADMIN_EMAIL;
const memberPassword = process.env.PLAYWRIGHT_NON_ADMIN_PASSWORD;
const memberBusinessName = process.env.PLAYWRIGHT_NON_ADMIN_BUSINESS_NAME || "Moniger Member QA";

const login = async (page: Page, email: string, password: string) => {
  await page.getByLabel(/email/i).fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
};

const waitForAdminShell = async (page: Page) => {
  await expect(page.getByText(/loading page\.\.\./i)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /view admin notifications/i })).toBeVisible({ timeout: 20_000 });
};

const setBusinessStatus = async (page: Page, row: Locator, targetStatus: "active" | "suspended") => {
  const actionButton = row.getByRole("button", { name: new RegExp(`Actions for ${memberBusinessName}`, "i") });
  const activeBadge = row.getByText(/^active$/i);
  const suspendedBadge = row.getByText(/^suspended$/i);

  if (targetStatus === "active" && await activeBadge.count()) {
    return;
  }

  if (targetStatus === "suspended" && await suspendedBadge.count()) {
    return;
  }

  await actionButton.click();
  await page.getByRole("menuitem", { name: targetStatus === "active" ? /unsuspend account/i : /suspend account/i }).click();
  await expect(targetStatus === "active" ? activeBadge : suspendedBadge).toBeVisible({ timeout: 15_000 });
};

test.describe("admin access", () => {
  test("redirects signed-out visitors away from /admin", async ({ page }) => {
    await page.goto("/admin");

    await page.waitForURL(/\/login\?next=%2Fadmin/);
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });

  test("blocks non-admin users from the admin console", async ({ page }) => {
    test.skip(!memberEmail || !memberPassword, "Set PLAYWRIGHT_NON_ADMIN_EMAIL and PLAYWRIGHT_NON_ADMIN_PASSWORD to verify non-admin admin-console denial.");

    await page.goto("/login?next=%2Fadmin");
    await login(page, memberEmail!, memberPassword!);

    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { name: /log in|verify your sign in/i })).toBeVisible({ timeout: 15_000 });
  });

  test("allows admin users into the admin console", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to verify admin-console access.");

    await page.goto("/login?next=%2Fadmin");
    await login(page, adminEmail!, adminPassword!);

    await page.waitForURL(/\/admin/);
    await waitForAdminShell(page);
    await expect(page.getByRole("heading", { name: /platform overview/i })).toBeVisible({ timeout: 15_000 });
  });

  test("allows admins to suspend and restore a workspace", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to verify admin business actions.");

    await page.goto("/login?next=%2Fadmin%2Fbusinesses");
    await login(page, adminEmail!, adminPassword!);

    await page.waitForURL(/\/admin\/businesses/);
    await waitForAdminShell(page);
    await page.getByPlaceholder(/search business name, owner email, or id/i).fill(memberBusinessName);

    const row = page.getByRole("row").filter({ hasText: memberBusinessName }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    await setBusinessStatus(page, row, "active");
    await setBusinessStatus(page, row, "suspended");
    await expect(row.getByText(/suspended/i)).toBeVisible();

    await setBusinessStatus(page, row, "active");
    await expect(row.getByText(/active/i)).toBeVisible();
  });
});
