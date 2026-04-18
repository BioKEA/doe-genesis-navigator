import { test, expect } from "@playwright/test";

test("load → filter → open profile → compare", async ({ page }) => {
  await page.goto("/");

  // Results load
  await expect(page.getByText(/\d+\s+results/)).toBeVisible();

  // Pick the first visible challenge filter and apply it
  const firstFilter = page.locator("fieldset").first().locator("input[type=checkbox]").first();
  await firstFilter.click();

  // Open the first card
  const firstCard = page.locator("a[href*='#/profile/']").first();
  const name = (await firstCard.locator(".font-medium").first().textContent())?.trim();
  await firstCard.click();

  await expect(page.locator("h1")).toContainText(name ?? "");

  // Pin to compare from the profile page
  await page.getByLabel("Add to compare").click();

  // Navigate to compare
  await page.getByRole("link", { name: "Compare" }).click();
  await expect(page.getByText("1 / 5 pinned")).toBeVisible();
});
