import { expect, test } from "../../playwright-fixture";

test.describe("public payment confirmation placeholder", () => {
  test("shows the invalid confirmation state for placeholder references", async ({ page }) => {
    await page.goto("/pay/test-token/confirmed?reference=demo&trxref=demo", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: /we couldn't confirm this payment yet/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /return to payment page/i })).toBeVisible({ timeout: 15_000 });
  });
});
