import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { resolvePublicProfileProjection } from "../../src/community/public-profile";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { expectUnavailableHtml } from "./fixtures/parallax-unavailable-html";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("PARALLAX_COMMUNITY_OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`Community public profiles preserve the private boundary and district return · ${viewport.name} · ${reducedMotion}`, async ({
      page,
      context,
      browser,
      baseURL,
    }) => {
      const suffix = randomUUID().slice(0, 8);
      const publicName = `Synthetic public compatibility Creator ${suffix}`;
      const published = await closureAccount(publicName);
      const hidden = await closureAccount(`Synthetic private compatibility owner ${suffix}`);
      const viewer = await closureAccount(`Synthetic viewing Creator ${suffix}`);
      await activateWorkspaceCapability(viewer.id, "CREATOR");
      await authenticateClosure(context, viewer, baseURL!);
      const publicHandle = `compat-public-${suffix}`;
      const hiddenHandle = `compat-private-${suffix}`;
      const privateCanary = `PRIVATE-COMMUNITY-COMPATIBILITY-${suffix}`;
      await db.playerProfile.update({
        where: { id: published.profileId },
        data: { handle: publicHandle, normalizedHandle: publicHandle, defaultVisibility: "PUBLIC" },
      });
      await resolvePublicProfileProjection(db, published.id);
      await db.playerProfile.update({
        where: { id: hidden.profileId },
        data: {
          handle: hiddenHandle,
          normalizedHandle: hiddenHandle,
          defaultVisibility: "ONLY_ME",
          biography: privateCanary,
        },
      });
      expect((await db.playerProfile.findUniqueOrThrow({ where: { id: hidden.profileId } })).biography).toBe(
        privateCanary,
      );
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/community/creators");
      await expect(page.getByRole("heading", { name: "Creators", exact: true })).toBeVisible();
      const identityBefore = await page.request.get("/api/auth/context").then((response) => response.json());
      expect(identityBefore.status).toBe("authenticated");
      expect(identityBefore.user.accountId).toBe(viewer.id);
      expect(identityBefore.capabilities.canUseCreator).toBe(true);
      const creator = page.getByRole("link", { name: publicName, exact: true });
      if (viewport.name === "desktop") {
        await creator.focus();
        await creator.press("Enter");
      } else await creator.click();
      await expect(page).toHaveURL(new RegExp(`/community/creators/${publicHandle}$`));
      await expect(page.getByRole("heading", { name: publicName, exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(privateCanary);
      await expect(page.locator("body")).not.toContainText(hidden.id);
      await page.getByRole("link", { name: "Browse other Creators", exact: true }).click();
      await expect(page).toHaveURL(/\/community\/creators$/);
      await expect(
        page.getByRole("button", { name: `Synthetic viewing Creator ${suffix}`, exact: true }),
      ).toBeVisible();
      const identityAfter = await page.request.get("/api/auth/context").then((response) => response.json());
      expect(identityAfter.status).toBe("authenticated");
      expect(identityAfter.user.accountId).toBe(viewer.id);
      expect(identityAfter.user.profileId).toBe(viewer.profileId);
      expect(identityAfter.capabilities).toEqual(identityBefore.capabilities);
      const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        const publicResponse = await visitor.request.get(new URL(`/community/creators/${publicHandle}`, baseURL!).href);
        expect(publicResponse.status()).toBe(200);
        const publicWire = await publicResponse.text();
        expect(publicWire).toContain(publicName);
        expect(publicWire).not.toContain(privateCanary);
        expect(publicWire).not.toContain(hidden.id);
        const privateResponse = await visitor.request.get(
          new URL(`/community/creators/${hiddenHandle}`, baseURL!).href,
        );
        await expectUnavailableHtml(privateResponse, [
          privateCanary,
          hidden.id,
          `Synthetic private compatibility owner ${suffix}`,
          "creator-profile-title",
        ]);
      } finally {
        await visitor.close();
      }
      const denied = await page.goto(`/community/creators/${hiddenHandle}`);
      await expectUnavailableHtml(denied, [
        privateCanary,
        hidden.id,
        `Synthetic private compatibility owner ${suffix}`,
        "creator-profile-title",
      ]);
      await expect(page.getByRole("heading", { name: "This page could not be found.", exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(privateCanary);
      await expect(page.locator("body")).not.toContainText(hidden.id);
    });
  }

  test(`Private Voyage Log revision stays private and refuses another owner · ${viewport.name}`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const owner = await closureAccount("Synthetic private Voyage Log owner");
    const foreign = await closureAccount("Synthetic unrelated Voyage Log owner");
    const suffix = randomUUID();
    const log = await db.communityVoyageLog.create({
      data: {
        ownerAccountId: owner.id,
        keepsakeId: `compat-keepsake-${suffix}`,
        slug: `compat-log-${suffix}`,
        title: "Synthetic private compatibility log",
        visibility: "PRIVATE",
        lifecycleState: "DRAFT",
        verifiedCompletion: false,
      },
    });
    await authenticateClosure(context, owner, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/community/voyage-logs/owner/${log.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Prepare a Voyage Log", exact: true })).toBeVisible();
    await page.getByLabel("Approximate location", { exact: true }).fill("Synthetic fictional harbor");
    await page.getByRole("button", { name: "Save revision", exact: true }).click();
    await expect(
      page.getByText("Draft saved. Publication eligibility is checked again when you publish.", { exact: true }),
    ).toBeVisible();
    const persisted = await db.communityVoyageLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(persisted.approximateLocation).toBe("Synthetic fictional harbor");
    expect(persisted.visibility).toBe("PRIVATE");
    expect(persisted.lifecycleState).toBe("DRAFT");
    expect(persisted.verifiedCompletion).toBe(false);
    await page.getByRole("link", { name: "Your drafts", exact: true }).click();
    await expect(page).toHaveURL(/\/community\/voyage-logs\/owner$/);
    await expect(page.getByRole("heading", { level: 1, name: "Your Voyage Log drafts", exact: true })).toBeVisible();
    const foreignContext = await browser.newContext();
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      await authenticateClosure(foreignContext, foreign, baseURL!);
      const denied = await foreignContext.request.get(
        new URL(`/api/community/voyage-logs/owner/${log.id}`, baseURL!).href,
      );
      expect(denied.status()).toBe(404);
      expect(await denied.text()).not.toContain(log.title);
      const publicRead = await anonymous.request.get(new URL(`/api/community/voyage-logs/${log.slug}`, baseURL!).href);
      expect(publicRead.status()).toBe(404);
      expect(await publicRead.text()).not.toContain("Synthetic fictional harbor");
    } finally {
      await foreignContext.close();
      await anonymous.close();
    }
  });
}
