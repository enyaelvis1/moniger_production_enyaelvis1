import { expect, test } from "../../playwright-fixture";

const authEmail = process.env.PLAYWRIGHT_E2E_EMAIL;
const authPassword = process.env.PLAYWRIGHT_E2E_PASSWORD;

test.describe("authenticated finance journeys", () => {
  test.skip(!authEmail || !authPassword, "Set PLAYWRIGHT_E2E_EMAIL and PLAYWRIGHT_E2E_PASSWORD to run authenticated E2E coverage.");

  test("opens core finance surfaces after login", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(authEmail!);
    await page.locator("#password").fill(authPassword!);
    await page.getByRole("button", { name: /log in/i }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    await page.getByRole("link", { name: /invoices/i }).click();
    await page.waitForURL(/\/invoices/);
    await expect(page.getByRole("heading", { name: /^invoices$/i }).first()).toBeVisible();

    await page.getByRole("link", { name: /payments/i }).click();
    await page.waitForURL(/\/payments/);
    await expect(page.getByRole("heading", { name: /^payments$/i }).first()).toBeVisible();

    await page.getByRole("link", { name: /reports/i }).click();
    await page.waitForURL(/\/reports/);
    await expect(page.getByRole("heading", { name: /^reports$/i }).first()).toBeVisible();

    await page.getByRole("link", { name: /audit trail/i }).click();
    await page.waitForURL(/\/audit-trail/);
    await expect(page.getByRole("heading", { name: /^audit trail$/i }).first()).toBeVisible();

    await page.getByRole("link", { name: /go to home page/i }).click();
    await page.waitForURL(/\/$/);
  });
});
