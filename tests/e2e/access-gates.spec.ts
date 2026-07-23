import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Player sign-in remains public, accessible, and does not grant a Chronicle session", async ({ page }) => {
  const response = await page.goto("/player/sign-in#invitation-code");
  expect(response?.status()).toBe(200);
  const markup = await response!.text();
  for (const secret of ["The Lantern Test", "Where painted waves meet borrowed light", "Captain instruction"]) {
    expect(markup).not.toContain(secret);
  }
  await expect(page.getByRole("heading", { name: "Open your Chronicle Library" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Invitation code" })).toBeVisible();
  expect((await page.request.get("/api/player/library")).status()).toBe(401);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual(
    [],
  );
});

test("Quartermaster bookmarks redirect to canonical Captain sign-in across supported browsers", async ({ page }) => {
  await page.goto("/quartermaster");
  await expect(page).toHaveURL(/\/captain\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Enter Captain's Console" })).toBeVisible();
  expect((await page.request.get("/api/captain/library")).status()).toBe(401);
});

test("published Chronicle catalog is public while Studio remains protected", async ({ page }) => {
  await page.goto("/tales");
  await expect(page.getByRole("heading", { name: "Choose a Chronicle" })).toBeVisible();
  await expect(page.getByRole("article").first().getByRole("link", { name: "Preview Chronicle" })).toBeVisible();
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Creator access is required." })).toBeVisible();
  expect((await page.request.get("/api/studio/tales")).status()).toBe(401);
});
