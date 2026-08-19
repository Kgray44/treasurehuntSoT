import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { emailVerificationCodeHash } from "../../src/wayfarer/verification-policy";

test("Wayfarer Passport routes account lifecycle through current profile, preferences, and privacy controls", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${suffix}@example.test`;
  const handle = `wayfarer-${suffix}`;
  const nextHandle = `voyager-${suffix}`;
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Isolated Wayfarer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("A secure test password 42!");
  await page.getByLabel("Confirm password", { exact: true }).fill("A secure test password 42!");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/verify-email(?:[?#]|$)/u);
  const account = await db.userAccount.findFirstOrThrow({
    where: { emails: { some: { normalizedEmail: email } } },
    select: { id: true },
  });
  const verificationCode = "123456";
  await db.accountToken.updateMany({
    where: { accountId: account.id, purpose: "VERIFY_EMAIL", consumedAt: null },
    data: { tokenHash: emailVerificationCodeHash(account.id, email, verificationCode) },
  });
  await page.getByLabel("Code").fill(verificationCode);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/passport(?:[?#]|$)/u);
  await expect(page.getByRole("heading", { name: "Chronicle Passport", level: 1 })).toBeVisible();

  await page.goto("/account/personal-information");
  await page.getByLabel("Display name").fill("Isolated Captain");
  await page.getByRole("button", { name: "Save display name" }).click();
  await expect(page.getByText("Personal information saved.")).toBeVisible();

  await page.goto("/account/profile");
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Biography").fill("A profile written in an isolated browser journey.");
  await page.getByLabel("Default visibility").selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();

  await page.goto(`/profile/${handle}`);
  await expect(page.getByRole("heading", { name: "Isolated Captain", level: 1 })).toBeVisible();
  await expect(page.getByText("A profile written in an isolated browser journey.")).toBeVisible();

  await page.goto("/account/profile");
  await page.getByLabel("Handle").fill(nextHandle);
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();
  await page.goto(`/profile/${handle}`);
  await expect(page).toHaveURL(new RegExp(`/profile/${nextHandle}(?:[?#]|$)`, "u"));

  await page.goto("/account/preferences");
  const preferences = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Experience preferences", level: 2 }),
  });
  const allowPreferenceDraftCommit = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
  await preferences.getByLabel("Theme").selectOption("LIGHT");
  await allowPreferenceDraftCommit();
  await expect(preferences.getByLabel("Theme")).toHaveValue("LIGHT");
  await preferences.getByLabel("Motion").selectOption("REDUCED");
  await allowPreferenceDraftCommit();
  await expect(preferences.getByLabel("Motion")).toHaveValue("REDUCED");
  await preferences.getByRole("slider").fill("1.4");
  await allowPreferenceDraftCommit();
  const contrast = preferences.locator("label").filter({ hasText: /^Contrast/u }).locator("select");
  await contrast.selectOption("HIGH");
  await allowPreferenceDraftCommit();
  await preferences.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved and applied.")).toBeVisible();
  await page.reload();
  await expect(preferences.getByLabel("Theme")).toHaveValue("LIGHT");
  await expect(preferences.getByLabel("Motion")).toHaveValue("REDUCED");
  await expect(preferences.getByRole("slider")).toHaveValue("1.4");
  await expect(contrast).toHaveValue("HIGH");

  await page.goto("/account/privacy");
  await page.getByLabel("biography").selectOption("ONLY_ME");
  await page.getByRole("button", { name: "Save privacy rules" }).click();
  await expect(page.getByText("Privacy rules saved and enforced by public projections.")).toBeVisible();

  await page.goto("/account/linked-identities");
  await expect(page.getByRole("heading", { name: "Connected identities", level: 2 })).toBeVisible();
  await expect(
    page.getByText("No external identities are linked. Your account credential remains the login authority."),
  ).toBeVisible();
});

test("Wayfarer Passport remains operable at required responsive viewports", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
});
