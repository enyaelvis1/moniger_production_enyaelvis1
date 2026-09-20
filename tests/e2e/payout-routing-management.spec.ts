import type { Page } from "@playwright/test";
import { expect, test } from "../../playwright-fixture";

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const memberEmail = process.env.PLAYWRIGHT_NON_ADMIN_EMAIL;
const memberPassword = process.env.PLAYWRIGHT_NON_ADMIN_PASSWORD;
const memberBusinessName = process.env.PLAYWRIGHT_NON_ADMIN_BUSINESS_NAME || "Moniger Member QA";

const login = async (page: Page, email: string, password: string) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
};

const waitForDashboardShell = async (page: Page) => {
  await page.waitForURL(/\/dashboard|\/settings|\/notifications|\/security|\/team/);
  await expect(page.getByText(/loading page\.\.\./i)).toHaveCount(0, { timeout: 20_000 });
};

const waitForAdminShell = async (page: Page) => {
  await expect(page.getByText(/loading page\.\.\./i)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /view admin notifications/i })).toBeVisible({ timeout: 20_000 });
};

const expectToast = async (page: Page, pattern: RegExp) => {
  await expect(page.getByRole("status").filter({ hasText: pattern })).toBeVisible({ timeout: 10_000 });
};

const clickVisibleButton = async (page: Page, name: RegExp) => {
  const button = page.getByRole("button", { name });
  await button.scrollIntoViewIfNeeded();
  await button.click();
};

test.describe("payout routing management", () => {
  test("keeps Moniger fee rules out of workspace settings and validates payout setup basics", async ({ page }) => {
    test.skip(!memberEmail || !memberPassword, "Set PLAYWRIGHT_NON_ADMIN_EMAIL and PLAYWRIGHT_NON_ADMIN_PASSWORD to verify workspace payout routing management.");

    await login(page, memberEmail!, memberPassword!);
    await waitForDashboardShell(page);

    await page.goto("/settings?tab=business");

    await expect(page.getByRole("heading", { name: /business information/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/marketplace payout routing/i)).toBeVisible();
    await expect(page.getByText(/^moniger fee rule$/i)).toHaveCount(0);

    await clickVisibleButton(page, /save & sync paystack/i);
    await expectToast(page, /choose a bank/i);

    await clickVisibleButton(page, /save draft/i);
    await expectToast(page, /choose a bank/i);
  });

  test("lets admins manage fee rules from the business payout tab only", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to verify admin payout routing management.");

    await page.goto("/login?next=%2Fadmin%2Fbusinesses");
    await page.getByLabel(/email/i).fill(adminEmail!);
    await page.locator("#password").fill(adminPassword!);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.waitForURL(/\/admin\/businesses/);
    await waitForAdminShell(page);

    await page.getByPlaceholder(/search business name, owner email, or id/i).fill(memberBusinessName);

    const row = page.getByRole("row").filter({ hasText: memberBusinessName }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.locator("button").first().click();

    await expect(page.getByRole("tab", { name: /payout/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: /payout/i }).click();

    await expect(page.getByText(/^moniger fee rule$/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/routing currency/i)).toBeVisible();

    await page.getByLabel(/routing currency/i).fill("N");
    await clickVisibleButton(page, /^save draft$/i);
    await expectToast(page, /invalid routing currency/i);

    await page.getByLabel(/routing currency/i).fill("NGN");
    await page.getByLabel(/moniger fee percentage/i).fill("12.5");
    await clickVisibleButton(page, /save & sync paystack/i);
    await expectToast(page, /whole percentages required for paystack sync/i);
  });
});
