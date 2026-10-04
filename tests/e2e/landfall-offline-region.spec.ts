import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import {
  authenticateClosure,
  auditNativeGeolocation,
  closureAccount,
  closureVoyage,
  geoAudit,
  openClosureJournal,
  openClosureMap,
} from "./fixtures/landfall-closure";

test.describe.configure({ timeout: 180000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(process.env.LANDFALL_LAB_SYNTHETIC_PACKAGES !== "1", "Requires the owned ephemeral signing wrapper.");
test.skip(({ browserName }) => browserName !== "chromium", "Mutate synthetic fixtures once.");
test.afterAll(async () => db.$disconnect());

test("previews, interrupts, verifies, restores and removes a real signed released region", async ({
  browser,
  baseURL,
}, testInfo) => {
  ensureGenericSoundingLineIsolation();
  const owner = await closureAccount("Synthetic region Creator"),
    player = await closureAccount("Synthetic region Player");
  const voyage = await closureVoyage(owner, player, "livingChart", { virtual: true, image: true, offlineRegion: true });
  const before = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
  const context = await browser.newContext({ viewport: { width: 375, height: 1000 }, reducedMotion: "reduce" });
  const measurements: Record<string, number> = {};
  let originUsageBefore = 0,
    originUsageReady = 0,
    verifiedResourceBytes = 0;
  let resources = 0;
  try {
    await authenticateClosure(context, player, baseURL!);
    await auditNativeGeolocation(context);
    const page = await context.newPage();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/landfall/package") && url.searchParams.has("resource")) resources++;
    });
    await openClosureJournal(page, voyage.id);
    await openClosureMap(page);
    await expect(page.locator("[data-landfall-player-chart]:visible")).toContainText("Offline chart: saved");
    const panel = page.getByRole("region", { name: "Offline region" });
    const progress = panel.getByRole("progressbar", { name: "Verified offline download" });
    originUsageBefore = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
    let startedAt = performance.now();
    await panel.getByRole("button", { name: "Prepare offline region" }).click();
    await expect(panel.getByRole("button", { name: "Download offline region" })).toBeVisible();
    measurements.preparationMs = performance.now() - startedAt;
    expect(resources).toBe(0);
    await expect(panel).toContainText("1 authorized first-party images");
    await expect(progress).toHaveAttribute("value", "0");
    await expect(panel).toContainText("Authorization expires");
    await expect(panel).toContainText("preserves your saved Chronicle history");

    let interrupted = false;
    await page.route("**/landfall/package?**", async (route) => {
      if (!interrupted && new URL(route.request().url()).searchParams.get("resource") === "released-routes") {
        interrupted = true;
        await route.abort("failed");
      } else await route.continue();
    });
    await panel.getByRole("button", { name: "Download offline region" }).click();
    await expect(panel.getByRole("status")).toContainText("Offline region: partial");
    expect(interrupted).toBe(true);
    await expect.poll(async () => Number(await progress.getAttribute("value"))).toBeGreaterThan(0);
    const partialRequests = resources;
    await page.unroute("**/landfall/package?**");
    await panel.getByRole("button", { name: "Refresh or resume offline region" }).click();
    await expect(panel.getByRole("button", { name: "Download offline region" })).toBeVisible();
    startedAt = performance.now();
    await panel.getByRole("button", { name: "Download offline region" }).click();
    await expect(panel.getByRole("status")).toContainText("Offline region: ready");
    measurements.verifiedResumeMs = performance.now() - startedAt;
    expect(resources - partialRequests).toBe(2); // route + image; the verified chart is reused.
    const resumedResourceRequests = resources - partialRequests;
    expect(await progress.getAttribute("value")).toBe(await progress.getAttribute("max"));
    verifiedResourceBytes = Number(await progress.getAttribute("max"));
    expect(verifiedResourceBytes).toBeGreaterThan(0);
    expect(verifiedResourceBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    originUsageReady = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
    expect(originUsageReady - originUsageBefore).toBeLessThan(64 * 1024 * 1024);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    // This exclusively owned synthetic context also has the ordinary chart
    // cache. Remove it so the real offline shell must restore the signed region.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase("landfall-offline-v2");
          request.onsuccess = () => resolve();
          request.onerror = request.onblocked = () => reject(new Error("SYNTHETIC_CHART_CACHE_REMOVAL_FAILED"));
        }),
    );

    await context.setOffline(true);
    startedAt = performance.now();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Offline Voyage Journal" })).toBeVisible();
    await expect(page.locator("[data-landfall-player-chart]:visible")).toContainText("Offline chart restored");
    const cachedImage = page.getByRole("img", { name: "Virtual Landfall chart" }).locator("image");
    await expect(cachedImage).toHaveAttribute("href", /^blob:/);
    expect(
      await cachedImage.evaluate(async (element) => {
        const response = await fetch(element.getAttribute("href")!);
        const bitmap = await createImageBitmap(await response.blob());
        const dimensions = [bitmap.width, bitmap.height];
        bitmap.close();
        return dimensions;
      }),
    ).toEqual([400, 300]);
    measurements.offlineRestoreMs = performance.now() - startedAt;
    await context.setOffline(false);
    // The service worker navigated to the offline shell. Reopen the online
    // Journal explicitly rather than reloading that shell with a connection.
    await openClosureJournal(page, voyage.id);
    await openClosureMap(page);
    const restored = page.getByRole("region", { name: "Offline region" });
    await expect(restored.getByRole("status")).toContainText("Offline region: ready");
    await restored.getByRole("button", { name: "Remove offline region" }).click();
    await expect(restored.getByRole("status")).toContainText("removed from this device");
    await expect(restored.getByRole("button", { name: "Remove offline region" })).toHaveCount(0);
    let corrupted = false;
    await page.route("**/landfall/package?**", async (route) => {
      if (!corrupted && new URL(route.request().url()).searchParams.get("resource") === "released-routes") {
        const response = await route.fetch();
        const bytes = await response.body();
        bytes[0] ^= 1;
        corrupted = true;
        await route.fulfill({ response, body: bytes });
      } else await route.continue();
    });
    await restored.getByRole("button", { name: "Prepare offline region" }).click();
    startedAt = performance.now();
    await restored.getByRole("button", { name: "Download offline region" }).click();
    await expect(restored.getByRole("status")).toContainText("Offline region: corrupt");
    measurements.corruptResourceRejectionMs = performance.now() - startedAt;
    expect(corrupted).toBe(true);
    await page.unroute("**/landfall/package?**");
    await page.reload();
    await openClosureMap(page);
    const rejected = page.getByRole("region", { name: "Offline region" });
    await expect(rejected.getByRole("status")).toContainText("Offline region: corrupt");
    await rejected.getByRole("button", { name: "Remove offline region" }).click();
    await expect(rejected.getByRole("status")).toContainText("removed from this device");
    await rejected.getByRole("button", { name: "Prepare offline region" }).click();
    await expect(rejected.getByRole("button", { name: "Download offline region" })).toBeVisible();
    const beforeFresh = resources;
    startedAt = performance.now();
    await rejected.getByRole("button", { name: "Download offline region" }).click();
    await expect(rejected.getByRole("status")).toContainText("Offline region: ready");
    measurements.freshVerifiedInstallationMs = performance.now() - startedAt;
    expect(resources - beforeFresh).toBe(3);
    startedAt = performance.now();
    await rejected.getByRole("button", { name: "Remove offline region" }).click();
    await expect(rejected.getByRole("status")).toContainText("removed from this device");
    measurements.removalMs = performance.now() - startedAt;
    expect((await geoAudit(page)).calls).toBe(0);
    expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
    for (const value of Object.values(measurements)) expect(value).toBeLessThan(15000);
    await writeFile(
      testInfo.outputPath("offline-region-performance.json"),
      JSON.stringify(
        {
          version: 1,
          sourceClass: "OPTIMIZED_FIRST_PARTY_CHROMIUM",
          syntheticSigning: true,
          canonicalProgressionEvents: 0,
          measurements,
          preliminaryLatencyBudgetMs: 15000,
          originUsageBefore,
          originUsageReady,
          verifiedResourceBytes,
          originGrowthBudgetBytes: 64 * 1024 * 1024,
          verifiedResources: 3,
          resumedResourceRequests,
          cachedImageDecoded: true,
          corruptResourceRejectedAfterReload: true,
          physicalRestartProven: false,
        },
        null,
        2,
      ),
    );
    await testInfo.attach("offline-region-performance", {
      path: testInfo.outputPath("offline-region-performance.json"),
      contentType: "application/json",
    });
    const shot = testInfo.outputPath("offline-region-removed.png");
    await rejected.screenshot({ path: shot });
    await testInfo.attach("offline-region-removed", { path: shot, contentType: "image/png" });
  } finally {
    await context.close();
  }
});
