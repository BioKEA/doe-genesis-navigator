import { test, expect } from "@playwright/test";

test("canvas loads and renders a partner card on deep-link", async ({ page }) => {
  await page.goto("/");
  // Sigma renders to a <canvas> element inside the GraphCanvas container.
  await page.waitForSelector("canvas", { timeout: 20_000 });

  // Deep-link to a known partner; right pane should anchor on them.
  await page.goto("/#/profile/biokea");
  await expect(page.getByText(/biokea/i).first()).toBeVisible({ timeout: 10_000 });

  // RightPane shows the top-matches section with at least one numeric score.
  const scoreInAside = page.locator("aside").filter({ hasText: /\d\.\d{2}/ }).first();
  await expect(scoreInAside).toBeVisible({ timeout: 10_000 });
});
