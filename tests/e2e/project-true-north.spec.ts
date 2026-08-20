import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public shell keeps a stable menu, profile access, and keyboard dismissal", async ({ page }) => {
  await page.route("**/api/tales", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ tales: [] }) }),
  );
  await page.goto("/tales");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.locator(".product-menu-button");
  await expect(menu).toBeVisible();
  await menu.click();
  const workspaceNavigation = page.getByRole("navigation", { name: "Global navigation" });
  await expect(workspaceNavigation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();

  const account = page.getByRole("button", { name: "Account" });
  await account.click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual(
    [],
  );
});
