import { expect, test } from "@playwright/test";
import sharp from "sharp";

let syntheticPng: Buffer;
test.beforeAll(async () => {
  syntheticPng = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#234" } })
    .png()
    .toBuffer();
});

test("Wayfarer Passport persists a private profile, preferences, media, and a simulator identity", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const handle = `wayfarer-${suffix}`;
  const nextHandle = `voyager-${suffix}`;
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Isolated Wayfarer");
  await page.getByLabel("Email").fill(`${suffix}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("A secure test password 42!");
  await page.getByLabel("Confirm password", { exact: true }).fill("A secure test password 42!");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Your account request was completed.")).toBeVisible();

  await page.goto("/passport");
  await expect(page.getByRole("heading", { name: "Chronicle Passport" })).toBeVisible();
  await page.getByLabel("Display name").fill("Isolated Captain");
  await page.getByLabel("Public handle").fill(handle);
  await page.getByLabel("Biography", { exact: true }).fill("A private voyage biography.");
  await page.getByLabel("Default profile visibility").selectOption("PUBLIC");
  await page.getByLabel("Avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: syntheticPng });
  await expect(page.getByText("Avatar saved.")).toBeVisible();
  await page.getByLabel("Banner").setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: syntheticPng });
  await expect(page.getByText("Banner saved.")).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.goto(`/profile/${handle}`);
  await expect(page.getByRole("heading", { name: "Isolated Captain" })).toBeVisible();
  await expect(page.getByText("A private voyage biography.")).toBeVisible();

  await page.goto("/passport");
  await page.getByLabel("Public handle").fill(nextHandle);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.goto(`/profile/${handle}`);
  await expect(page).toHaveURL(new RegExp(`/profile/${nextHandle}$`));

  await page.goto("/passport");
  await page.getByLabel("Motion").selectOption("REDUCED");
  await page.getByLabel("Text scale").fill("1.4");
  await page.getByLabel("Theme").selectOption("HIGH_CONTRAST");
  await page.getByLabel("Captions").check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved for this account.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Motion")).toHaveValue("REDUCED");
  await expect(page.getByLabel("Text scale")).toHaveValue("1.4");

  await page.locator('select[name="BIOGRAPHY"]').selectOption("ONLY_ME");
  await page.getByRole("button", { name: "Save privacy controls" }).click();
  await expect(page.getByText("Privacy rules saved.")).toBeVisible();
  await page.getByRole("button", { name: "Link Discord simulator" }).click();
  await expect(page.getByText("Discord simulator identity linked privately.")).toBeVisible();
  const linkedProvider = page.locator("#providers li").filter({ hasText: "DISCORD_SIMULATOR" });
  const providerPatch = () =>
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/passport/providers" &&
        response.request().method() === "PATCH" &&
        response.status() === 200,
    );
  let providerUpdate = providerPatch();
  await linkedProvider.getByRole("combobox").selectOption("PUBLIC");
  await providerUpdate;
  providerUpdate = providerPatch();
  await linkedProvider.getByRole("checkbox").click();
  await providerUpdate;
  await expect(linkedProvider.getByRole("checkbox")).toBeChecked();
  await page.locator('select[name="PROVIDERS"]').selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save privacy controls" }).click();
  await expect(linkedProvider.getByRole("combobox")).toHaveValue("PUBLIC");
  await page.getByRole("button", { name: "Unlink identity" }).click();
  await expect(page.getByText("Remove this linked identity?")).toBeVisible();
  await page.getByRole("button", { name: "Confirm unlink identity" }).click();
  await expect(page.getByText("Linked identity removed and its token material cleared.")).toBeVisible();
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
