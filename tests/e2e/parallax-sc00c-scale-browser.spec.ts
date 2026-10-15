import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { db } from "../../src/lib/db";
import { canonicalChecksum } from "../../src/drydock/canonical";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { materializeLibraryMoment, spatialItemKind } from "../../src/parallax/library-service";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";

test.use({ video: "on", actionTimeout: 30000 });
test.skip(process.env.SC00C_SCALE_BROWSER !== "1", "Run only with a fresh task-owned scale database.");
test.afterAll(() => db.$disconnect());

test("a thousand saved Scenes remain searchable and paged in the actual Studio", async ({ page, context, baseURL }) => {
  test.setTimeout(300000);
  expect(process.env.DATABASE_URL?.replaceAll("\\", "/")).toContain("/artifacts/sc00c/scale-browser/");
  expect(await db.reusableAuthoringItem.count()).toBe(0);
  const account = await closureAccount("Synthetic SC-00C scale Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let firstId = "";
  for (let offset = 0; offset < 1000; offset += 100) {
    const items = [];
    const versions = [];
    for (let index = offset; index < offset + 100; index++) {
      const id = randomUUID();
      if (!firstId) firstId = id;
      const draft = createSpatialDraft(id);
      draft.content.title = `Synthetic Scale Scene ${String(index).padStart(4, "0")}`;
      items.push({
        id,
        ownerAccountId: account.id,
        kind: spatialItemKind,
        name: draft.content.title,
        status: "SAVED" as const,
        currentVersionNumber: 1,
      });
      versions.push({
        id: `${id}:working`,
        itemId: id,
        versionNumber: 0,
        envelope: JSON.stringify(draft),
        checksum: canonicalChecksum(draft),
      });
      for (let releaseNumber = 1; releaseNumber <= 5; releaseNumber++) {
        const moment = materializeLibraryMoment(draft, account.id, releaseNumber);
        versions.push({
          id: moment.version.id,
          itemId: id,
          versionNumber: releaseNumber,
          envelope: JSON.stringify(moment),
          checksum: moment.version.checksum,
        });
      }
    }
    await db.reusableAuthoringItem.createMany({ data: items });
    for (let index = 0; index < versions.length; index += 100)
      await db.reusableAuthoringItemVersion.createMany({ data: versions.slice(index, index + 100) });
  }
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const start = performance.now();
  const bootstrapResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/studio/parallax" &&
      !new URL(response.url()).searchParams.has("view") &&
      response.request().method() === "GET",
  );
  await page.goto(`/studio/parallax?definition=${firstId}`);
  await expect(page.getByRole("heading", { name: "Parallax", exact: true })).toBeVisible();
  const bootstrap = await bootstrapResponse;
  expect(bootstrap.ok()).toBe(true);
  const bootstrapBytes = (await bootstrap.body()).byteLength;
  const bootstrapReadyMs = Math.round(performance.now() - start);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  const firstPageResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).searchParams.get("view") === "library-catalog" &&
      new URL(response.url()).searchParams.get("kind") === "SCENES" &&
      !new URL(response.url()).searchParams.has("cursor"),
  );
  await library.getByRole("tab", { name: "Scenes", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(48);
  const firstPage = await firstPageResponse;
  const firstPageBytes = (await firstPage.body()).byteLength;
  const searchStart = performance.now();
  await library.getByRole("searchbox").fill("Synthetic Scale Scene 0999");
  await expect(library.getByRole("button", { name: "Inspect Synthetic Scale Scene 0999" })).toBeVisible();
  const farSearchMs = Math.round(performance.now() - searchStart);
  await expect(library.getByRole("article")).toHaveCount(1);
  await library.getByRole("searchbox").fill("");
  await expect(library.getByRole("article")).toHaveCount(48);
  await library.getByRole("button", { name: /Show more/ }).click();
  await expect(library.getByRole("article")).toHaveCount(96);
  const evidence = "artifacts/sc00c/scale-browser";
  await mkdir(evidence, { recursive: true });
  await library.getByRole("heading", { name: "Spatial content" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/thousand-scenes-desktop.png`, fullPage: true });
  const desktopDomCards = await library.getByRole("article").count();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await expect(library).toBeVisible();
  await expect(library.getByRole("article")).toHaveCount(96);
  await library.getByRole("heading", { name: "Spatial content" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/thousand-scenes-phone.png`, fullPage: true });
  const phoneDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const report = {
    source: process.env.SC00C_SCALE_SOURCE ?? "unbound",
    fixture: { savedScenes: 1000, releasesPerScene: 5, content: "synthetic minimal scenes" },
    bootstrap: { bytes: bootstrapBytes, readyMs: bootstrapReadyMs },
    firstPage: { bytes: firstPageBytes, count: 48 },
    farSearch: { ms: farSearchMs, matches: 1 },
    afterShowMore: { domCards: desktopDomCards },
    phone: { viewportWidth: 390, documentWidth: phoneDocumentWidth },
  };
  await writeFile(`${evidence}/browser-scale.json`, JSON.stringify(report, null, 2) + "\n");
  expect(desktopDomCards).toBe(96);
  expect(phoneDocumentWidth).toBeLessThanOrEqual(390);
});
