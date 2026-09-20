import { expect, test } from "@playwright/test";

test.describe("landing navigation", () => {
  test("supports mobile menu focus, expansion, and Escape close", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const openButton = page.getByRole("button", { name: "Open navigation menu" });
    await openButton.focus();
    await openButton.press("Enter");

    const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(drawer).toBeVisible();
    await expect(page.getByRole("button", { name: "Close navigation menu" })).toBeFocused();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    await page.getByRole("button", { name: "Features" }).click();
    await expect(drawer.getByRole("button", { name: "Invoicing" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(openButton).toBeFocused();
  });

  test("supports desktop dropdown keyboard dismissal and route navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const features = page.getByRole("button", { name: "Features" });
    await features.focus();

    await expect(features).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Invoicing", { exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(features).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Invoicing", { exact: true })).toBeHidden();

    await page.getByRole("navigation").getByRole("link", { name: "Pricing", exact: true }).click();
    await expect(page).toHaveURL(/\/pricing$/);
  });
});
