import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

let syntheticAvatar: Buffer;
let syntheticBanner: Buffer;
test.beforeAll(async () => {
  syntheticAvatar = await sharp({ create: { width: 768, height: 768, channels: 4, background: "#234" } })
    .png()
    .toBuffer();
  syntheticBanner = await sharp({ create: { width: 1600, height: 640, channels: 4, background: "#234" } })
    .png()
    .toBuffer();
});

async function waitForHarbor(page: Page) {
  await expect(page.locator(".personal-harbor")).toBeVisible();
  await expect.poll(() => page.locator(".harbor-state--loading").count()).toBe(0);
}

test("Wayfarer Personal Harbor loads preferences and persists a profile, privacy rules, and media", async ({ page }) => {
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
  await page.getByLabel("Code").fill(await waitForVerificationCode(email));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/passport$/u, { timeout: 15_000 });

  const passportBootstrap = await page.evaluate(async () => {
    const [profile, providers, sessions, context] = await Promise.all([
      fetch("/api/passport/profile"),
      fetch("/api/passport/providers"),
      fetch("/api/auth/sessions"),
      fetch("/api/auth/context"),
    ]);
    const profileBody = (await profile.json()) as { preferences?: unknown };
    const contextBody = (await context.json()) as { status?: unknown };
    return {
      profileStatus: profile.status,
      profileHasPreferences: typeof profileBody.preferences === "object" && profileBody.preferences !== null,
      providersStatus: providers.status,
      sessionsStatus: sessions.status,
      contextStatus: context.status,
      contextAccountState: contextBody.status,
    };
  });
  expect(passportBootstrap).toEqual({
    profileStatus: 200,
    profileHasPreferences: true,
    providersStatus: 200,
    sessionsStatus: 200,
    contextStatus: 200,
    contextAccountState: "authenticated",
  });

  await expect(page.getByRole("heading", { name: "Chronicle Passport", level: 1 })).toBeVisible();
  await page.goto("/account/personal-information");
  await waitForHarbor(page);
  await expect(page.getByRole("heading", { name: "Personal Information", level: 1 })).toBeVisible();
  await page.getByLabel("Display name").fill("Isolated Captain");
  await page.getByRole("button", { name: "Save display name" }).click();
  await expect(page.getByText("Personal information saved.")).toBeVisible();

  await page.goto("/account/profile");
  await waitForHarbor(page);
  await expect(page.getByRole("heading", { name: "Public Profile", level: 1 })).toBeVisible();
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Biography", { exact: true }).fill("A private voyage biography.");
  await page.getByLabel("Default visibility").selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();
  await page.locator("#profile-avatar-file").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: syntheticAvatar });
  await expect(page.getByRole("dialog", { name: "Position your avatar" })).toBeVisible();
  await page.getByRole("button", { name: "Use this crop" }).click();
  await page.getByRole("button", { name: "Save avatar image" }).click();
  await expect(page.getByText("Image normalized and stored. The public projection has been refreshed.")).toBeVisible();
  await expect(page.getByText("A stored avatar is ready. Choose a file to replace it.")).toBeVisible();
  await page.locator("#profile-banner-file").setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: syntheticBanner });
  await expect(page.getByRole("dialog", { name: "Position your banner" })).toBeVisible();
  await page.getByRole("button", { name: "Use this crop" }).click();
  await page.getByRole("button", { name: "Save banner image" }).click();
  await expect(page.getByText("Image normalized and stored. The public projection has been refreshed.")).toBeVisible();

  await page.goto("/account/privacy");
  await waitForHarbor(page);
  await page.getByLabel("header").selectOption("PUBLIC");
  await page.getByLabel("biography").selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save privacy rules" }).click();
  await expect(page.getByText("Privacy rules saved and enforced by public projections.")).toBeVisible();

  const ownerProfile = await page.request.get("/api/passport/profile");
  expect(await ownerProfile.json()).toMatchObject({
    handle,
    displayName: "Isolated Captain",
    biography: "A private voyage biography.",
  });
  const publicProjection = await page.request.get(`/api/profile/${handle}?viewer=public`);
  expect({ status: publicProjection.status(), body: await publicProjection.json() }).toMatchObject({
    status: 200,
    body: {
      handle,
      displayName: "Isolated Captain",
      biography: "A private voyage biography.",
      private: false,
    },
  });

  await page.goto(`/profile/${handle}`);
  await expect(page.getByRole("heading", { name: "Isolated Captain" })).toBeVisible();
  await expect(page.getByText("A private voyage biography.")).toBeVisible();

  await page.goto("/account/profile");
  await waitForHarbor(page);
  await page.getByLabel("Handle").fill(nextHandle);
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();
  await page.goto(`/profile/${handle}`);
  await expect(page).toHaveURL(new RegExp(`/profile/${nextHandle}$`));

  await page.goto("/account/preferences");
  await waitForHarbor(page);
  await expect(page.getByLabel("Motion")).toBeVisible();

  await page.goto("/account/privacy");
  await waitForHarbor(page);
  await page.getByLabel("biography").selectOption("ONLY_ME");
  await page.getByRole("button", { name: "Save privacy rules" }).click();
  await expect(page.getByText("Privacy rules saved and enforced by public projections.")).toBeVisible();
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

async function waitForVerificationCode(email: string) {
  const outboxPath = process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
  if (!outboxPath) throw new Error("WAYFARER_PHASE2_SYNTHETIC_OUTBOX_MISSING");
  const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
  let code: string | null = null;
  await expect
    .poll(
      () => {
        if (!existsSync(outboxPath)) return null;
        const deliveries = readFileSync(outboxPath, "utf8")
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { purpose?: string; email?: string; token?: string });
        code =
          deliveries.findLast(
            (delivery) =>
              delivery.purpose === "VERIFY_EMAIL" &&
              delivery.email?.trim().toLocaleLowerCase("en-US") === normalizedEmail,
          )?.token ?? null;
        return code;
      },
      { timeout: 15_000 },
    )
    .toMatch(/^\d{6}$/u);
  return code!;
}
