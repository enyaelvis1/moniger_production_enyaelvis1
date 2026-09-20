import { expect, test } from "@playwright/test";

test.describe("responsive pricing", () => {
  for (const viewport of [
    { height: 844, name: "mobile", width: 390 },
    { height: 900, name: "desktop", width: 1440 },
  ]) {
    test(`shows all plans at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await page.goto("/pricing");

      await expect(page.getByText("Starter", { exact: true })).toBeVisible();
      await expect(page.getByText("Growth", { exact: true })).toBeVisible();
      await expect(page.getByText("Business", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start free" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Subscribe now" }).first()).toBeVisible();
    });
  }
});
