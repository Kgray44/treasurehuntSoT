import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("player gate stays private and accessible across supported browsers", async ({ page }) => {
  const response = await page.goto("/tale/development-forever-treasure");
  expect(response?.status()).toBe(200);
  const markup = await response!.text();
  for (const secret of ["The First Seal", "Where weary crews return", "Discover where the first seal was hidden"]) {
    expect(markup).not.toContain(secret);
  }
  await expect(page.getByRole("heading", { name: "The journal knows its sailor" })).toBeVisible();
  await expect(page.getByLabel("Invitation phrase")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual(
    [],
  );
});

test("quartermaster remains protected across supported browsers", async ({ page }) => {
  await page.goto("/quartermaster");
  await expect(page.getByRole("heading", { name: "Quartermaster’s Log" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter the chart room" })).toBeVisible();
  const status = await page.request.get("/api/gm/status");
  expect(status.status()).toBe(401);
});
