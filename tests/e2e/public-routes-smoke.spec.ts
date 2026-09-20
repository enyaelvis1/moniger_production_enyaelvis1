import { expect, test } from "@playwright/test";

const publicRoutes = [
  { path: "/pricing", text: "Business" },
  { path: "/register?plan=growth", text: "Get started" },
  { path: "/pricing/confirmed", text: "Workspace subscription confirmation" },
  { path: "/contact", text: "Contact Us" },
  { path: "/help-centre", text: "Help Centre" },
  { path: "/changelog", text: "Changelog" },
  { path: "/terms", text: "Terms of Service" },
  { path: "/privacy", text: "Privacy Policy" },
  { path: "/security", text: "Security" },
];

for (const viewport of [
  { height: 844, name: "mobile", width: 390 },
  { height: 900, name: "desktop", width: 1440 },
]) {
  test.describe(`public routes at ${viewport.name} width`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
    });

    for (const route of publicRoutes) {
      test(`${route.path} renders its page content`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page.locator("body")).toContainText(route.text);
        await expect(page.locator("body")).not.toContainText("Page not found");
      });
    }
  });
}

test("public pages expose skip navigation and a main landmark", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeAttached();
  await skipLink.focus();
  await skipLink.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
});
