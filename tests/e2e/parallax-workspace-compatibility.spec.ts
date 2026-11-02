import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("PARALLAX_WORKSPACE_OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

async function workspaces(page: Page, ownerName: string) {
  await page.getByRole("button", { name: ownerName, exact: true }).click();
  await page.locator("#shell-account-disclosure").getByRole("link", { name: "All Workspaces", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Workspaces", exact: true })).toBeVisible();
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`Creator, Captain and Player retain one account and private content · ${viewport.name} · ${reducedMotion}`, async ({
      page,
      context,
      baseURL,
    }) => {
      const ownerName = "Synthetic Parallax workspace owner";
      const owner = await closureAccount(ownerName);
      const foreign = await closureAccount("Synthetic other workspace owner");
      for (const capability of ["CREATOR", "CAPTAIN"] as const) await activateWorkspaceCapability(owner.id, capability);
      const suffix = randomUUID();
      const owned = await db.chronicle.create({
        data: {
          slug: `compat-owner-${suffix}`,
          title: "Synthetic owner-only Chronicle",
          creatorId: owner.profileId,
          creatorAccountId: owner.id,
          status: "DRAFT",
          visibility: "PRIVATE",
        },
      });
      const hidden = await db.chronicle.create({
        data: {
          slug: `compat-other-${suffix}`,
          title: `PRIVATE-FOREIGN-CHRONICLE-${suffix}`,
          creatorId: foreign.profileId,
          creatorAccountId: foreign.id,
          status: "DRAFT",
          visibility: "PRIVATE",
        },
      });
      await authenticateClosure(context, owner, baseURL!);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/");
      await workspaces(page, ownerName);
      const identityBefore = await page.request.get("/api/auth/context").then((response) => response.json());
      expect(identityBefore.status).toBe("authenticated");
      expect(identityBefore.user.accountId).toBe(owner.id);
      expect(identityBefore.user.profileId).toBe(owner.profileId);
      await page.getByRole("link", { name: "Enter Creator", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: owned.title, exact: true })).toBeVisible();
      const projection = await page.request.get(`/api/studio/tales?accountId=${encodeURIComponent(foreign.id)}`);
      expect(projection.status()).toBe(200);
      const body = await projection.json();
      expect(body.tales.map((tale: { id: string }) => tale.id)).toContain(owned.id);
      expect(body.tales.map((tale: { id: string }) => tale.id)).not.toContain(hidden.id);
      await expect(page.locator("body")).not.toContainText(hidden.title);
      const denied = await page.request.get(`/api/studio/tales/${hidden.id}`);
      expect(denied.status()).toBe(404);
      expect(await denied.text()).not.toContain(hidden.title);
      const countBefore = await db.chronicle.count({ where: { creatorAccountId: owner.id } });
      await page.getByRole("link", { name: "Create Chronicle", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Create a Chronicle", exact: true })).toBeVisible();
      for (const name of ["Create Manually", "Create with AI", "Adapt a Story", "Start from a Template"]) {
        const choice = page.getByRole("button", { name: new RegExp(`^${name} `) });
        await expect(choice).toBeVisible();
        if (name !== "Create Manually") {
          await expect(choice).toBeDisabled();
          await expect(choice).toContainText("Coming soon");
        }
      }
      await page.getByRole("link", { name: "← Your Chronicles", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
      expect(await db.chronicle.count({ where: { creatorAccountId: owner.id } })).toBe(countBefore);
      await workspaces(page, ownerName);
      await page.getByRole("link", { name: "Enter Captain", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Published Chronicles", exact: true }).click();
      await expect(page.getByRole("button", { name: "Published Chronicles", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await workspaces(page, ownerName);
      await page.getByRole("link", { name: "Enter Player", exact: true }).click();
      await expect(page.getByRole("heading", { name: "My Chronicle Library", exact: true })).toBeVisible();
      await workspaces(page, ownerName);
      const identity = await page.request.get("/api/auth/context");
      expect(identity.status()).toBe(200);
      const current = await identity.json();
      expect(current.status).toBe("authenticated");
      expect(current.user.accountId).toBe(owner.id);
      expect(current.user.profileId).toBe(owner.profileId);
      expect(current.capabilities).toEqual(identityBefore.capabilities);
      expect(current.capabilities.canUseCreator).toBe(true);
      expect(current.capabilities.canUseCaptain).toBe(true);
      expect(current.capabilities.canUsePlayer).toBe(true);
      expect(current.capabilities.isAdministrator).toBe(false);
    });
  }

  test(`Unclaimed guests and anonymous accounts retain Creator access boundaries · ${viewport.name}`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const ordinary = await closureAccount("Synthetic unclaimed compatibility guest");
    await db.userAccount.update({
      where: { id: ordinary.id },
      data: { status: "GUEST_UNCLAIMED", claimedAt: null, ordinaryWorkspaceEntryAt: null },
    });
    await db.playerProfile.update({ where: { id: ordinary.profileId }, data: { claimedAt: null } });
    await authenticateClosure(context, ordinary, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const guestContext = await page.request.get("/api/auth/context").then((response) => response.json());
    expect(guestContext.status).toBe("authenticated");
    expect(guestContext.capabilities.canUsePlayer).toBe(true);
    expect(guestContext.capabilities.canUseCreator).toBe(false);
    await page.goto("/studio/library");
    await expect(page.getByRole("heading", { name: "Permission required", exact: true })).toBeVisible();
    expect((await page.request.get("/api/studio/tales")).status()).toBe(401);
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      expect((await anonymous.request.get(new URL("/api/studio/tales", baseURL!).href)).status()).toBe(401);
      const signedOut = await anonymous.newPage();
      await signedOut.goto(new URL("/studio/library", baseURL!).href);
      await expect(signedOut).toHaveURL(/\/sign-in(?:\?|$)/);
      await expect(signedOut.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    } finally {
      await anonymous.close();
    }
  });
}
