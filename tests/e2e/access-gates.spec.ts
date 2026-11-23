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
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fcaptain%2Flibrary$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByText("Use one account across Player, Captain, Creator, Community, and Chronicle Passport."),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect((await page.request.get("/api/captain/library")).status()).toBe(401);
});

test("published Chronicle catalog is public while Studio remains protected", async ({ page }) => {
  await page.goto("/tales");
  await expect(page.getByRole("heading", { name: "Choose a Chronicle" })).toBeVisible();
  await expect(page.getByRole("article").first().getByRole("link", { name: "Preview Chronicle" })).toBeVisible({
    timeout: 30_000,
  });
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fstudio%2Flibrary$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect((await page.request.get("/api/studio/tales")).status()).toBe(401);
});

test("the Player invitation form stays readable while it slides into view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/player/sign-in");
  const samples = await page.evaluateHandle(() => {
    const samples: { opacity: number; moving: boolean }[] = [];
    const observer = new MutationObserver(() => {
      const form = document.querySelector<HTMLElement>("#invitation-code");
      if (!form) return;
      const style = getComputedStyle(form);
      samples.push({ opacity: Number(style.opacity), moving: style.transform !== "none" });
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
    return { samples, stop: () => observer.disconnect() };
  });
  try {
    await page.getByRole("tab", { name: "Invitation code" }).focus();
    await page.keyboard.press("Enter");
    const form = page.locator("#invitation-code");
    await expect(form.getByRole("button", { name: "Find my invitation" })).toBeVisible();
    await expect(form).toHaveCSS("transform", "none");
    const frames = await samples.evaluate((record) => record.samples);
    expect(frames.some((frame) => frame.moving)).toBe(true);
    expect(
      frames.filter((frame) => frame.opacity < 1),
      "Invitation form opacity samples",
    ).toEqual([]);
    expect((await page.request.get("/api/player/library")).status()).toBe(401);
  } finally {
    await samples.evaluate((record) => record.stop());
    await samples.dispose();
  }
});

test("Player invitation instructions use readable parchment ink", async ({ page }) => {
  await page.goto("/player/sign-in#invitation-code");
  const helper = page.locator("#invitation-code").getByText("Invitation links open the same ceremony automatically.", {
    exact: false,
  });
  await expect(helper).toBeVisible();
  await expect(helper, "Invitation instructions use parchment ink").toHaveCSS("color", "rgb(43, 42, 34)");
});
