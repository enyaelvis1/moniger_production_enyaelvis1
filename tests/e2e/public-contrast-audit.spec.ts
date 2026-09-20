import { expect, test } from "@playwright/test";
import axe from "axe-core";

const { source } = axe;

for (const path of ["/pricing", "/contact", "/about", "/privacy", "/terms", "/changelog"]) {
  test(`has no public contrast violations on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    await page.addScriptTag({ content: source });

    const violations = await page.evaluate(async () => {
      const results = await (window as Window & { axe: { run: () => Promise<{ violations: Array<{ id: string; nodes: Array<{ html: string }> }> }> } }).axe.run();
      return results.violations
        .filter((violation) => violation.id === "color-contrast")
        .map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.html) }));
    });

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}
