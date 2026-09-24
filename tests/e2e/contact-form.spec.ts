import { expect, test } from "@playwright/test";

const contactForm = {
  email: "visitor@example.com",
  fullName: "Test Visitor",
  message: "I would like to learn more about Moniger.",
  subject: "Product question",
};

test.describe("Contact form", () => {
  test("shows a success state and clears the form after delivery", async ({ page }) => {
    await page.route("**/functions/v1/contact-message", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ message: "Your message was sent. We will respond within 24 hours." }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/contact");
    await page.getByLabel("Full name").fill(contactForm.fullName);
    await page.getByLabel("Email address").fill(contactForm.email);
    await page.getByLabel("Subject").fill(contactForm.subject);
    await page.getByLabel("Your message").fill(contactForm.message);
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByRole("status")).toHaveText("Your message was sent. We will respond within 24 hours.");
    await expect(page.getByLabel("Full name")).toHaveValue("");
    await expect(page.getByLabel("Email address")).toHaveValue("");
  });

  test("shows an actionable error state when delivery fails", async ({ page }) => {
    await page.route("**/functions/v1/contact-message", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "Unable to deliver your message right now." }),
        contentType: "application/json",
        status: 500,
      });
    });

    await page.goto("/contact");
    await page.getByLabel("Full name").fill(contactForm.fullName);
    await page.getByLabel("Email address").fill(contactForm.email);
    await page.getByLabel("Subject").fill(contactForm.subject);
    await page.getByLabel("Your message").fill(contactForm.message);
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("We couldn't send your message right now. Please try again or email admin@moniger.net.");
  });

  test("blocks incomplete and invalid submissions before delivery", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/functions/v1/contact-message", async (route) => {
      requestCount += 1;
      await route.fulfill({ body: JSON.stringify({ message: "Sent" }), contentType: "application/json", status: 200 });
    });

    await page.goto("/contact");
    await page.getByRole("button", { name: "Send Message" }).click();
    await expect(page.getByLabel("Full name")).toBeFocused();

    await page.getByLabel("Full name").fill(contactForm.fullName);
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Subject").fill(contactForm.subject);
    await page.getByLabel("Your message").fill(contactForm.message);
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page).toHaveURL(/\/contact$/);
    expect(requestCount).toBe(0);
  });
});
