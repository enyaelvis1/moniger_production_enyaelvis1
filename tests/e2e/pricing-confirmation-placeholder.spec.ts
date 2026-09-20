import { expect, test } from "../../playwright-fixture";

test.describe("pricing confirmation placeholder", () => {
  test("shows the missing-reference state when no paystack reference is present", async ({ page }) => {
    await page.goto("/pricing/confirmed", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText(/workspace subscription confirmation/i)).toBeVisible();
    await expect(page.getByText(/we could not find the paystack subscription reference/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /back to pricing/i }).first()).toBeVisible();
  });
});
