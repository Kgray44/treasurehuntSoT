import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { CurrentUserContext } from "../../src/homeport/current-user";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("PARALLAX_SHARED_CONSUMER_OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});

test.afterAll(() => db.$disconnect());

async function compatibilityIdentity(page: Page) {
  const response = await page.request.get("/api/auth/context");
  expect(response.status()).toBe(200);
  const current = (await response.json()) as CurrentUserContext;
  if (current.status !== "authenticated") throw new Error("Compatibility owner lost authentication");
  return {
    accountId: current.user.accountId,
    profileId: current.user.profileId ?? null,
    displayName: current.user.displayName,
    capabilities: current.capabilities,
  };
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`Personal Harbor preserves private owner reads and Home return · ${viewport.name} · ${reducedMotion}`, async ({
      page,
      context,
      baseURL,
    }) => {
      const ownerName = "Synthetic Parallax compatibility owner";
      const owner = await closureAccount(ownerName);
      const other = await closureAccount("Synthetic unrelated private owner");
      await activateWorkspaceCapability(owner.id, "CREATOR");
      await authenticateClosure(context, owner, baseURL!);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/account");
      await expect(page.getByRole("heading", { name: ownerName, exact: true })).toBeVisible();
      const identityBefore = await compatibilityIdentity(page);
      expect(identityBefore.accountId).toBe(owner.id);
      expect(identityBefore.profileId).toBe(owner.profileId);
      expect(identityBefore.capabilities.canUseCreator).toBe(true);
      expect(identityBefore.capabilities.isAdministrator).toBe(false);
      expect(identityBefore.capabilities.canModerate).toBe(false);

      // The expanded shared-content model must not let a supplied identity
      // replace the account selected by the real authenticated session.
      const projection = await page.request.get(`/api/account/overview?accountId=${encodeURIComponent(other.id)}`);
      expect(projection.status()).toBe(200);
      const body = (await projection.json()) as { profile: { displayName: string } };
      expect(body.profile.displayName).toBe(ownerName);
      await expect(page.getByText("Synthetic unrelated private owner", { exact: true })).toHaveCount(0);

      const personalInformation = page.getByRole("link", { name: "Profile Personal Information", exact: true });
      if (viewport.name === "desktop") {
        await personalInformation.focus();
        await expect(personalInformation).toBeFocused();
        await personalInformation.press("Enter");
      } else {
        await personalInformation.click();
      }
      await expect(page.getByRole("heading", { name: "Personal Information", exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/account\/personal-information$/);
      await page.getByRole("link", { name: "Return to Home", exact: true }).click();
      await expect(page).toHaveURL(new URL("/", baseURL!).href);
      await expect(page.getByRole("button", { name: ownerName, exact: true })).toBeVisible();
      expect(await compatibilityIdentity(page)).toEqual(identityBefore);

      const persisted = await db.userAccount.findUniqueOrThrow({ where: { id: owner.id }, include: { profile: true } });
      expect(persisted.status).toBe("ACTIVE");
      expect(persisted.profile?.id).toBe(owner.profileId);
      expect(persisted.profile?.displayName).toBe(ownerName);
    });
  }

  test(`Changing system motion preserves an unsaved account draft and focus · ${viewport.name}`, async ({
    page,
    context,
    baseURL,
  }) => {
    const ownerName = "Synthetic Parallax motion owner";
    const owner = await closureAccount(ownerName);
    await activateWorkspaceCapability(owner.id, "CREATOR");
    await authenticateClosure(context, owner, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/account/personal-information");
    await expect(page.getByRole("heading", { name: "Personal Information", exact: true })).toBeVisible();
    const field = page.getByRole("textbox", { name: "Display name", exact: true });
    const draft = "Unsaved shared-consumer draft";
    await field.fill(draft);
    await field.focus();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
    await expect(field).toHaveValue(draft);
    await expect(field).toBeFocused();

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("html")).not.toHaveAttribute("data-motion-level", "reduced");
    await expect(field).toHaveValue(draft);
    await expect(field).toBeFocused();
    const persisted = await db.playerProfile.findUniqueOrThrow({ where: { id: owner.profileId } });
    expect(persisted.displayName).toBe(ownerName);
  });
}

test("An anonymous account projection and account page retain their real access boundary", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    const response = await context.request.get(new URL("/api/account/overview", baseURL!).href);
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain("Synthetic Parallax compatibility owner");
    await page.goto(new URL("/account", baseURL!).href);
    await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Synthetic Parallax compatibility owner", exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
