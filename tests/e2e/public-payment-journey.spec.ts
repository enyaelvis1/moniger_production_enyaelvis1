import { expect, test } from "../../playwright-fixture";

const paymentPath = process.env.PLAYWRIGHT_PAYMENT_PATH;

test.describe("public payment journey", () => {
  test.skip(!paymentPath, "Set PLAYWRIGHT_PAYMENT_PATH to run the public invoice payment flow.");

  test("loads the hosted invoice payment page", async ({ page }) => {
    await page.goto(paymentPath!);

    await expect(page.getByRole("heading", { name: /pay your invoice securely with paystack/i })).toBeVisible();
    await expect(page.getByText(/review the invoice details below, confirm your email, and continue to a secure paystack checkout/i)).toBeVisible();
    await expect(page.getByText(/protected by paystack/i)).toBeVisible();
    await expect(page.getByText(/^moniger\.net$/i)).toBeVisible();
  });
});
