import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

let syntheticPng: Buffer;
test.beforeAll(async () => {
  syntheticPng = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#234" } })
    .png()
    .toBuffer();
});

test("Wayfarer Passport directs account changes to the current Personal Harbor surfaces", async ({ page }) => {
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
  await expect(page).toHaveURL(/\/verify-email/u);
  await page.getByLabel("Code").fill(await verificationCodeFor(email));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/passport/u);

  await page.goto("/passport");
  await expect(page.getByRole("heading", { name: "Chronicle Passport" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit public Profile" })).toHaveAttribute("href", "/account/profile");

  await page.goto("/account/personal-information");
  await page.getByLabel("Display name").fill("Isolated Captain");
  await page.getByRole("button", { name: "Save display name" }).click();
  await expect(page.getByText("Personal information saved.")).toBeVisible();

  await page.goto("/account/profile");
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Biography", { exact: true }).fill("A private voyage biography.");
  await page.getByLabel("Default visibility").selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();

  await page
    .getByLabel("Avatar image")
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: syntheticPng });
  await page.getByRole("button", { name: "Use this crop" }).click();
  await page.getByRole("button", { name: "Save avatar image" }).click();
  await expect(page.getByText("Image normalized and stored. The public projection has been refreshed.")).toBeVisible();
  await page
    .getByLabel("Banner image")
    .setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: syntheticPng });
  await page.getByRole("button", { name: "Use this crop" }).click();
  await page.getByRole("button", { name: "Save banner image" }).click();
  await expect(page.getByText("Image normalized and stored. The public projection has been refreshed.")).toBeVisible();

  await page.goto(`/profile/${handle}`);
  await expect(page.getByRole("heading", { name: "Isolated Captain" })).toBeVisible();
  await expect(page.getByText("A private voyage biography.")).toBeVisible();

  await page.goto("/account/profile");
  await page.getByLabel("Handle").fill(nextHandle);
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();
  await page.goto(`/profile/${handle}`);
  await expect(page).toHaveURL(new RegExp(`/profile/${nextHandle}$`));

  await page.goto("/account/accessibility");
  await page.waitForLoadState("networkidle");
  const accessibility = page.getByRole("region", { name: "Accessibility content" });
  const preferenceSelects = accessibility.getByRole("combobox");
  await preferenceSelects.nth(0).selectOption("HIGH_CONTRAST");
  await expect(preferenceSelects.nth(0)).toHaveValue("HIGH_CONTRAST");
  await preferenceSelects.nth(2).selectOption("HIGH");
  await expect(preferenceSelects.nth(2)).toHaveValue("HIGH");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved and applied.")).toBeVisible();
  await page.reload();
  await expect(accessibility.getByRole("combobox").nth(0)).toHaveValue("HIGH_CONTRAST");
  await expect(accessibility.getByRole("combobox").nth(2)).toHaveValue("HIGH");

  await page.goto("/account/privacy");
  await page.getByLabel("biography").selectOption("ONLY_ME");
  await page.getByRole("button", { name: "Save privacy rules" }).click();
  await expect(page.getByText("Privacy rules saved and enforced by public projections.")).toBeVisible();

  await page.goto("/account/linked-identities");
  await expect(page.getByRole("heading", { name: "Linked Identities" })).toBeVisible();
  await expect(
    page.getByText("No external identities are linked. Your account credential remains the login authority."),
  ).toBeVisible();
  await expect(page.getByLabel("Discord simulator code")).toHaveCount(0);
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

async function verificationCodeFor(email: string) {
  const outboxPath = process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
  let code: string | undefined;
  await expect
    .poll(
      () => {
        if (!outboxPath || !existsSync(outboxPath)) return null;
        const delivery = readFileSync(outboxPath, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { purpose?: string; email?: string; token?: string })
          .find((entry) => entry.purpose === "VERIFY_EMAIL" && entry.email === email.toLocaleLowerCase("en-US"));
        code = delivery?.token;
        return code ?? null;
      },
      { timeout: 20_000, message: `verification delivery for ${email}` },
    )
    .not.toBeNull();
  return code!;
}
