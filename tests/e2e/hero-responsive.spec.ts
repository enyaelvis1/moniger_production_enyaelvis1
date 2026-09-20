import { expect, test } from "@playwright/test";

const viewports = [
  { height: 720, name: "small mobile", width: 320 },
  { height: 844, name: "mobile", width: 390 },
  { height: 900, name: "tablet", width: 768 },
  { height: 900, name: "desktop", width: 1024 },
  { height: 900, name: "wide desktop", width: 1440 },
];

test.describe("landing hero", () => {
  for (const viewport of viewports) {
    test(`remains usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await expect(page.getByRole("heading", { name: /Finance operations your team can trust/i })).toBeVisible();
      await expect(page.getByLabel("Work email")).toBeVisible();
      await expect(page.getByRole("button", { name: viewport.width < 768 ? "Get Started" : "Get Started Free" })).toBeVisible();
      await expect(page.locator("body")).toHaveCSS("overflow-x", "visible");

      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(horizontalOverflow).toBe(false);
    });
  }

  test("requires a valid work email before continuing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const email = page.getByLabel("Work email");
    await page.getByRole("button", { name: "Get Started" }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("required", "");

    await email.fill("not-an-email");
    await page.getByRole("button", { name: "Get Started" }).click();
    await expect(page).toHaveURL(/\/$/);

    await email.fill("qa@example.com");
    await page.getByRole("button", { name: "Get Started" }).click();
    await expect(page).toHaveURL(/\/register\?email=qa%40example\.com$/);
  });

  test("respects reduced-motion preferences", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const heading = page.getByRole("heading", { name: /Finance operations your team can trust/i });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveCSS("animation-name", "none");
  });
});
