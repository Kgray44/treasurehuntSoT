import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { prepareParallaxCompatibilityArchive } from "./fixtures/parallax-compatibility-archive";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("PARALLAX_PASSPORT_OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

const pinnedRecordSelect = {
  publishedVersionId: true,
  publishedVersionChecksum: true,
  sourceFingerprint: true,
  lifecycleStatus: true,
  outcome: true,
  completedChapters: true,
  optionalObjectives: true,
  choiceSummary: true,
  artifactSummary: true,
} as const;

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`Passport keeps the historical edition and private Home return · ${viewport.name} · ${reducedMotion}`, async ({
      page,
      context,
      baseURL,
    }) => {
      const owner = await closureAccount("Synthetic Parallax Archive Player");
      const recordId = await prepareParallaxCompatibilityArchive(db, owner.profileId);
      const before = await db.playerChronicleRecord.findUniqueOrThrow({
        where: { id: recordId },
        select: pinnedRecordSelect,
      });
      await authenticateClosure(context, owner, baseURL!);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/passport");
      await expect(page.getByRole("heading", { name: "Chronicle Passport", exact: true })).toBeVisible();
      const history = page
        .getByRole("navigation", { name: "Chronicle Passport sections", exact: true })
        .getByRole("link", { name: "Your Voyages", exact: true });
      if (viewport.name === "desktop") {
        await history.focus();
        await history.press("Enter");
      } else await history.click();
      await expect(page).toHaveURL(/\/passport\/history$/);
      const voyage = page.getByRole("link", { name: "Open Synthetic Parallax pinned Voyage Voyage", exact: true });
      await expect(voyage).toBeVisible();
      await voyage.click();
      await expect(page).toHaveURL(new URL(`/passport/history/${encodeURIComponent(recordId)}`, baseURL!).href);
      await expect(page.getByRole("heading", { name: "Synthetic Parallax pinned Voyage", exact: true })).toBeVisible();
      const detail = page.locator(".wakebook-detail");
      await expect(detail.locator(".wakebook-detail-hero .wakebook-edition")).toContainText("Preserved edition");
      const response = await page.request.get(`/api/passport/voyages/${encodeURIComponent(recordId)}`);
      expect(response.status()).toBe(200);
      const projection = await response.json();
      expect(projection.chronicle.publishedVersionId).toBe(before.publishedVersionId);
      expect(projection.chronicle.publishedVersionChecksum).toBe(before.publishedVersionChecksum);
      expect(projection.chronicle.publishedVersionLabel).toBe("Preserved edition");
      expect(JSON.stringify(projection.memories)).toContain("PRIVATE-PARALLAX-COMPATIBILITY-MEMORY-CANARY");
      await expect(detail).not.toContainText("Synthetic later live title");
      await expect(detail).not.toContainText("internal-ending-id");
      await page.getByRole("link", { name: "Back to Your Voyages", exact: true }).click();
      await expect(page).toHaveURL(/\/passport\/history$/);
      await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Synthetic Parallax Archive Player", exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Return to Home", exact: true }).click();
      await expect(page).toHaveURL(new URL("/", baseURL!).href);
      await expect(page.getByRole("button", { name: "Synthetic Parallax Archive Player", exact: true })).toBeVisible();
      expect(
        await db.playerChronicleRecord.findUniqueOrThrow({ where: { id: recordId }, select: pinnedRecordSelect }),
      ).toEqual(before);
    });
  }

  test(`Passport denies another owner's history and recovers an empty archive · ${viewport.name}`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const owner = await closureAccount("Synthetic private archive owner");
    const other = await closureAccount("Synthetic empty archive owner");
    const recordId = await prepareParallaxCompatibilityArchive(db, owner.profileId);
    const apiPath = `/api/passport/voyages/${encodeURIComponent(recordId)}`;
    const recordPath = `/passport/history/${encodeURIComponent(recordId)}`;
    const before = await db.playerChronicleRecord.findUniqueOrThrow({
      where: { id: recordId },
      select: pinnedRecordSelect,
    });
    const ownerContext = await browser.newContext();
    try {
      await authenticateClosure(ownerContext, owner, baseURL!);
      const authorized = await ownerContext.request.get(new URL(apiPath, baseURL!).href);
      expect(authorized.status()).toBe(200);
      expect(JSON.stringify((await authorized.json()).memories)).toContain(
        "PRIVATE-PARALLAX-COMPATIBILITY-MEMORY-CANARY",
      );
    } finally {
      await ownerContext.close();
    }
    await authenticateClosure(context, other, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/passport/history");
    await expect(page.getByRole("heading", { name: "Every Voyage leaves a wake", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Synthetic Parallax pinned Voyage Voyage", exact: true }),
    ).toHaveCount(0);
    const denied = await page.request.get(apiPath);
    expect(denied.status()).toBe(404);
    const wire = await denied.text();
    expect(wire).not.toContain("Synthetic Parallax pinned Voyage");
    expect(wire).not.toContain("PRIVATE-PARALLAX-COMPATIBILITY-MEMORY-CANARY");
    await page.goto(recordPath);
    await expect(page.getByRole("heading", { name: "The archive could not be opened", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try the archive again", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Synthetic Parallax pinned Voyage", exact: true })).toHaveCount(0);
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const response = await anonymous.request.get(new URL(apiPath, baseURL!).href);
      expect(response.status()).toBe(401);
      expect(await response.text()).not.toContain("PRIVATE-PARALLAX-COMPATIBILITY-MEMORY-CANARY");
      const signedOut = await anonymous.newPage();
      await signedOut.goto(new URL(recordPath, baseURL!).href);
      await expect(signedOut).toHaveURL(/\/sign-in(?:\?|$)/);
      await expect(signedOut.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    } finally {
      await anonymous.close();
    }
    expect(
      await db.playerChronicleRecord.findUniqueOrThrow({ where: { id: recordId }, select: pinnedRecordSelect }),
    ).toEqual(before);
  });
}
