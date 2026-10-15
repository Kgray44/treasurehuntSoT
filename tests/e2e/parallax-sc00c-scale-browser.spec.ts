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

test("a large saved-Scene catalog remains searchable and paged in the actual Studio", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(300000);
  const databaseUrl = process.env.DATABASE_URL?.replaceAll("\\", "/") ?? "";
  const source = process.env.SC00C_SCALE_SOURCE ?? "";
  const canonicalIsolation =
    process.env.SOUNDING_LINE_SUITE_PROFILE === "generic" &&
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP === "1" &&
    /^[a-f0-9]{40}$/.test(source) &&
    databaseUrl.includes(`/artifacts/sounding-line/generic-${source.slice(0, 12)}/validation-isolated-`) &&
    /validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(databaseUrl);
  expect(
    databaseUrl.startsWith("file:") && (databaseUrl.includes("/artifacts/sc00c/scale-browser/") || canonicalIsolation),
  ).toBe(true);
  expect(await db.reusableAuthoringItem.count()).toBe(0);
  const total = Number(process.env.SC00C_SCALE_ITEM_COUNT ?? "1000");
  expect([1000, 2000]).toContain(total);
  const account = await closureAccount("Synthetic SC-00C scale Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let firstId = "";
  for (let offset = 0; offset < total; offset += 100) {
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
  const selectedReads: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/studio/parallax" && url.searchParams.get("view") === "library-item")
      selectedReads.push(url.searchParams.get("entryId") ?? "");
  });
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
  const bootstrapReadyMs = Math.round(performance.now() - start);
  const bootstrap = await bootstrapResponse;
  expect(bootstrap.ok()).toBe(true);
  const contentLength = Number(bootstrap.headers()["content-length"]);
  const repeatedBootstrap = await page.request.get("/api/studio/parallax");
  expect(repeatedBootstrap.ok()).toBe(true);
  const indexed = await repeatedBootstrap.json();
  expect(indexed.items).toHaveLength(total);
  for (const item of indexed.items) {
    expect(item.releasesState).toBe("INDEX_ONLY");
    expect(item.releases).toEqual([]);
    expect(item.releaseIndex).toHaveLength(5);
  }
  expect(selectedReads).toEqual([`saved:${firstId}`]);
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  const historicalVersion = page.getByRole("button", { name: "v1.0.0 · 1 objects", exact: true });
  await historicalVersion.click();
  await expect(historicalVersion).toHaveAttribute("aria-pressed", "true");
  const bootstrapBytes =
    Number.isFinite(contentLength) && contentLength > 0 ? contentLength : (await repeatedBootstrap.body()).byteLength;
  const bootstrapByteSource =
    Number.isFinite(contentLength) && contentLength > 0 ? "response-header" : "repeat-authenticated-read";
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
  const farName = `Synthetic Scale Scene ${String(total - 1).padStart(4, "0")}`;
  await library.getByRole("searchbox").fill(farName);
  await expect(library.getByRole("button", { name: `Inspect ${farName}` })).toBeVisible();
  const farSearchMs = Math.round(performance.now() - searchStart);
  await expect(library.getByRole("article")).toHaveCount(1);
  await library.getByRole("searchbox").fill("");
  await expect(library.getByRole("article")).toHaveCount(48);
  await library.getByRole("button", { name: /Show more/ }).click();
  await expect(library.getByRole("article")).toHaveCount(96);
  const evidence = total === 1000 ? "artifacts/sc00c/scale-browser" : `artifacts/sc00c/scale-browser-${total}`;
  const imageLabel = total === 1000 ? "thousand-scenes" : `${total}-scenes`;
  await mkdir(evidence, { recursive: true });
  const firstCard = library.getByRole("button", { name: "Inspect Synthetic Scale Scene 0000" });
  await firstCard.focus();
  await page.keyboard.press("Enter");
  await expect(library.getByRole("complementary", { name: "Synthetic Scale Scene 0000 details" })).toBeVisible();
  await library.getByRole("button", { name: "Close item details" }).click();
  const panelResize = page.getByRole("separator", { name: "Resize library panel" });
  for (let index = 0; index < 20; index++) await panelResize.press("ArrowLeft");
  await expect(panelResize).toHaveAttribute("aria-valuenow", "210");
  await page.screenshot({ path: `${evidence}/${imageLabel}-narrow-panel.png`, fullPage: true });
  for (let index = 0; index < 20; index++) await panelResize.press("ArrowRight");
  await expect(panelResize).toHaveAttribute("aria-valuenow", "420");
  await page.screenshot({ path: `${evidence}/${imageLabel}-wide-panel.png`, fullPage: true });
  await library.getByRole("heading", { name: "Spatial content" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/${imageLabel}-desktop.png`, fullPage: true });
  const desktopDomCards = await library.getByRole("article").count();
  const readsBeforeExpansion = selectedReads.length;
  const expandedStart = performance.now();
  await library.getByRole("button", { name: "Expand Spatial Library" }).click();
  const expanded = page.getByRole("dialog", { name: "Expanded Spatial Library" });
  await expect(expanded).toBeVisible();
  await expect(expanded.getByRole("article")).toHaveCount(96);
  const expandedOpenMs = Math.round(performance.now() - expandedStart);
  const expandedFirstCard = expanded.getByRole("article").first();
  const expandedSource = expanded.getByRole("combobox", { name: "Source", exact: true });
  expect((await expandedSource.boundingBox())!.y).toBeLessThan((await expandedFirstCard.boundingBox())!.y);
  await expanded.getByRole("button", { name: "Inspect Synthetic Scale Scene 0000" }).click();
  await expect(expanded.getByRole("complementary", { name: "Synthetic Scale Scene 0000 details" })).toBeVisible();
  expect(selectedReads.length - readsBeforeExpansion).toBeLessThanOrEqual(1);
  expect(await expanded.locator("canvas").count()).toBe(0);
  const expandedSearchStart = performance.now();
  await expanded.getByRole("searchbox").fill(farName);
  await expect(expanded.getByRole("article")).toHaveCount(1);
  const expandedFarSearchMs = Math.round(performance.now() - expandedSearchStart);
  await expanded.getByRole("searchbox").fill("");
  await expect(expanded.getByRole("article")).toHaveCount(96);
  await page.screenshot({ path: `${evidence}/${imageLabel}-expanded-desktop.png`, fullPage: true });
  await expanded.getByRole("button", { name: "Close expanded Spatial Library" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await expect(library).toBeVisible();
  await expect(library.getByRole("article")).toHaveCount(96);
  await library.getByRole("heading", { name: "Spatial content" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/${imageLabel}-phone.png`, fullPage: true });
  const phoneDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  await library.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(expanded).toBeVisible();
  await expect(expanded.getByRole("article")).toHaveCount(96);
  const expandedPhoneBounds = await expanded.boundingBox();
  expect(expandedPhoneBounds!.width).toBeGreaterThanOrEqual(389);
  const expandedPhoneDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.screenshot({ path: `${evidence}/${imageLabel}-expanded-phone.png`, fullPage: true });
  const report = {
    source: process.env.SC00C_SCALE_SOURCE ?? "unbound",
    fixture: { savedScenes: total, releasesPerScene: 5, content: "synthetic minimal scenes" },
    bootstrap: {
      bytes: bootstrapBytes,
      byteSource: bootstrapByteSource,
      readyMs: bootstrapReadyMs,
      fullReleaseBodies: 0,
      indexedReleases: total * 5,
      initialSelectedReads: 1,
      historicalVersionSelected: true,
    },
    firstPage: { bytes: firstPageBytes, count: 48 },
    farSearch: { ms: farSearchMs, matches: 1 },
    afterShowMore: { domCards: desktopDomCards },
    expanded: {
      openMs: expandedOpenMs,
      domCards: 96,
      exactDetailReadsAfterOpening: selectedReads.length - readsBeforeExpansion,
      galleryCanvases: 0,
      farSearchMs: expandedFarSearchMs,
      farSearchMatches: 1,
      phoneViewportWidth: 390,
      phoneDocumentWidth: expandedPhoneDocumentWidth,
    },
    keyboardAndPanel: { inspectedFirstCard: true, narrowWidth: 210, wideWidth: 420 },
    phone: { viewportWidth: 390, documentWidth: phoneDocumentWidth },
  };
  await writeFile(`${evidence}/browser-scale.json`, JSON.stringify(report, null, 2) + "\n");
  expect(desktopDomCards).toBe(96);
  expect(phoneDocumentWidth).toBeLessThanOrEqual(390);
  expect(expandedPhoneDocumentWidth).toBeLessThanOrEqual(390);
});
