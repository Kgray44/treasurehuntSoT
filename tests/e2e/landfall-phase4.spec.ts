import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";
import { db } from "../../src/lib/db";
import { writeFile } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import { LandfallInstallationSigner } from "../../src/landfall/installation-token-server";
import { landfallFixture } from "../../src/landfall/fixtures";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import {
  authenticateClosure,
  auditNativeGeolocation,
  closureAccount,
  closureVoyage,
  geoAudit,
  openClosureJournal,
  openClosureMap,
  type ClosureAccount,
} from "./fixtures/landfall-closure";

let owner: ClosureAccount, player: ClosureAccount;
test.describe.configure({ timeout: 180_000 });
test.skip(({ browserName }) => browserName !== "chromium", "Owned mutable fixtures run once.");
// Pairing payloads and short-lived codes must not enter traces or automatic media.
// Playwright requires these worker-affecting settings at file scope.
test.use({ trace: "off", video: "off", screenshot: "off", actionTimeout: 15000, navigationTimeout: 45000 });
test.beforeAll(async () => {
  ensureGenericSoundingLineIsolation();
  owner = await closureAccount("Phase4 synthetic Creator");
  player = await closureAccount("Phase4 synthetic Player");
});
test.afterAll(async () => db.$disconnect());

test("measures cold, warm and offline chart readiness with a large released waypoint set", async ({
  browser,
  baseURL,
}, testInfo) => {
  const definition = structuredClone(landfallFixture);
  const first = definition.waypoints[0];
  definition.waypoints = [
    ...definition.waypoints,
    ...Array.from({ length: 255 }, (_, index) => ({
      ...structuredClone(first),
      id: `synthetic-scale-${index}`,
      name: `Synthetic visible location ${index}`,
      visibility: { hiddenUntilRevealed: false },
      sequence: { afterWaypointIds: [], optional: false },
    })),
  ];
  const voyage = await closureVoyage(owner, player, "livingChart", { authoredDefinition: definition });
  const before = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: "reduce" });
  const measures: Record<string, number> = {};
  try {
    await authenticateClosure(context, player, baseURL!);
    await auditNativeGeolocation(context);
    const page = await context.newPage();
    const chart = page.locator("[data-landfall-player-chart]:visible");
    let startedAt = performance.now();
    await openClosureJournal(page, voyage.id);
    await openClosureMap(page);
    await expect(chart.getByRole("list", { name: "Visible map locations" })).toContainText(
      "Synthetic visible location 254",
    );
    measures.coldJournalAndMapMs = performance.now() - startedAt;
    await expect(chart).toContainText("Offline chart: saved", { timeout: 30000 });
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30000 })
      .toBe(true);
    startedAt = performance.now();
    await page.reload();
    await openClosureMap(page);
    await expect(chart.getByRole("list", { name: "Visible map locations" })).toContainText(
      "Synthetic visible location 254",
    );
    measures.warmJournalAndMapMs = performance.now() - startedAt;
    await context.setOffline(true);
    startedAt = performance.now();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Offline Voyage Journal" })).toBeVisible();
    await expect(chart).toContainText("Offline chart restored");
    await expect(chart.getByRole("list", { name: "Visible map locations" })).toContainText(
      "Synthetic visible location 254",
    );
    measures.offlineJournalAndMapMs = performance.now() - startedAt;
    expect((await geoAudit(page)).calls).toBe(0);
    expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
    for (const value of Object.values(measures)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeLessThan(30000);
    }
    const storage = await page.evaluate(async () => {
      const estimate = await navigator.storage.estimate();
      return { usageBytes: estimate.usage ?? null, quotaBytes: estimate.quota ?? null };
    });
    await writeFile(
      testInfo.outputPath("landfall-chart-performance.json"),
      JSON.stringify(
        {
          version: 1,
          evidenceClass: "SHARED_WEB_CONTRACT",
          environment: "OPTIMIZED_ISOLATED_CHROMIUM",
          sampleCount: 1,
          releasedWaypoints: 256,
          viewportWidth: 375,
          reducedMotion: true,
          budgets: { coldJournalAndMapMs: 30000, warmJournalAndMapMs: 30000, offlineJournalAndMapMs: 30000 },
          measurements: measures,
          storage,
          canonicalProgressionEvents: 0,
          limits: [
            "Whole Journal readiness includes navigation and hydration; not renderer-only timing.",
            "Origin storage estimate includes the fixture shell and encrypted records; not process memory.",
            "No physical CPU, battery, location or sensor performance is inferred.",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
  }
});

for (const width of [375, 1280]) {
  test(`optional Bluetooth absence keeps readable fallback at ${width}px`, async ({ browser, baseURL }, testInfo) => {
    const voyage = await closureVoyage(owner, player, "livingChart");
    const before = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    try {
      await authenticateClosure(context, player, baseURL!);
      await auditNativeGeolocation(context);
      const page = await context.newPage();
      await openClosureJournal(page, voyage.id);
      await openClosureMap(page);
      const panel = page.locator(".journal-objects-drawer.open .landfall-ble-panel");
      await panel.locator("summary").click();
      await expect(panel.getByRole("button", { name: "Scan optional Bluetooth" })).toBeDisabled();
      await expect(panel.getByRole("status")).toContainText("scanning is off");
      await expect(panel).toContainText("cannot identify a waypoint, measure distance or record a visit");
      expect((await geoAudit(page)).calls).toBe(0);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".journal-objects-drawer.open .landfall-ble-panel")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const shot = testInfo.outputPath("bluetooth-absent-readable-fallback.png");
      await page.screenshot({ path: shot, fullPage: true });
      await testInfo.attach("bluetooth-absent-readable-fallback", { path: shot, contentType: "image/png" });
      expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
      await writeFile(
        testInfo.outputPath("bluetooth-evidence-class.json"),
        JSON.stringify({
          evidenceClass: "SHARED_WEB_CONTRACT",
          nativeRadio: "NOT_EXERCISED",
          hardwareAbsentFallback: "REAL_OPTIMIZED_APPLICATION",
          canonicalProgressionEvents: 0,
        }),
      );
    } finally {
      await context.close();
    }
  });
}

for (const width of [375, 1280]) {
  test(`optional signed installation identity and accessible fallback at ${width}px`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const definition = structuredClone(landfallFixture);
    definition.waypoints[0].installations = [
      {
        id: "synthetic-qr-installation",
        medium: "QR",
        label: "Synthetic optional tag",
        accessibilityAlternative: "Use the separate readable confirmation or ask your Captain.",
      },
    ];
    const voyage = await closureVoyage(owner, player, "livingChart", { authoredDefinition: definition });
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    try {
      await authenticateClosure(context, player, baseURL!);
      await auditNativeGeolocation(context);
      const page = await context.newPage();
      await openClosureJournal(page, voyage.id);
      await openClosureMap(page);
      const panel = page.locator(".journal-objects-drawer.open .landfall-installation-panel");
      await panel.locator("summary").click();
      const before = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } }),
        events = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
      // Actual default first-party API: no operator key and no invented trust.
      await panel.getByRole("button", { name: "Check installation availability" }).click();
      await expect(panel.getByRole("status")).toContainText("unavailable on this deployment");
      await expect(panel.getByLabel("Signed text alternative")).toHaveCount(0);
      // Configured browser verification is explicitly a synthetic trust transport.
      const pair = generateKeyPairSync("ed25519");
      const scope = {
        taleId: voyage.taleId,
        publishedVersionId: voyage.versionId,
        worldspaceId: definition.worldspaces[0].id,
        waypointId: definition.waypoints[0].id,
      };
      const signer = new LandfallInstallationSigner({
        keyId: "synthetic-lab-key",
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
      });
      let metadataRequests = 0;
      await context.route(`**/api/player/playthroughs/${voyage.id}/landfall/interaction`, async (route) => {
        expect(route.request().postDataJSON()).toEqual({ operation: "STATUS" });
        metadataRequests++;
        await route.fulfill({
          json: { ...signer.status(), scope, installations: definition.waypoints[0].installations },
        });
      });
      await panel.getByRole("button", { name: "Check installation availability" }).click();
      const text = panel.getByLabel("Signed text alternative");
      await expect(text).toBeVisible();
      await expect(panel.getByRole("button", { name: "Scan optional QR" })).toBeDisabled();
      await text.fill(signer.issue({ ...scope, id: "synthetic-qr-installation", medium: "QR" }).token);
      await panel.getByRole("button", { name: "Check signed text" }).click();
      await expect(panel.getByRole("status")).toContainText("verified locally");
      await expect(panel.getByRole("status")).toContainText("Copies do not prove presence");
      await expect(text).toHaveValue("");
      await text.fill("https://untrusted.example.test/do-not-open");
      await panel.getByRole("button", { name: "Check signed text" }).click();
      await expect(panel.getByRole("status")).toContainText("invalid");
      expect(metadataRequests).toBe(1);
      expect((await geoAudit(page)).calls).toBe(0);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".journal-objects-drawer.open .landfall-installation-panel")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const shot = testInfo.outputPath("signed-installation-cleared.png");
      await page.screenshot({ path: shot, fullPage: true });
      await testInfo.attach("signed-installation-cleared", { path: shot, contentType: "image/png" });
      await panel.getByRole("button", { name: "Stop scan and clear token" }).click();
      await expect(text).toHaveCount(0);
      const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      expect(after.currentSequence).toBe(before.currentSequence);
      expect(after.currentBlockId).toBe(before.currentBlockId);
      expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(events);
      await writeFile(
        testInfo.outputPath("signed-installation-evidence-class.json"),
        JSON.stringify({
          evidenceClass: "SHARED_WEB_CONTRACT",
          nativeCamera: "NOT_EXERCISED",
          firstPartyAbsentConfiguration: "REAL_OPTIMIZED_APPLICATION",
          configuredTrustTransport: "SYNTHETIC",
          cryptoVerification: "REAL_CHROMIUM_WEB_CRYPTO",
          physicalPresence: "NOT_PROVEN",
          canonicalProgressionEvents: 0,
        }),
      );
    } finally {
      await context.close();
    }
  });
}

for (const width of [375, 1280]) {
  test(`optional online place consent and no progression at ${width}px`, async ({ browser, baseURL }, testInfo) => {
    const definition = structuredClone(landfallFixture);
    definition.worldspaces[0].privacyPolicy.classification = "PUBLIC_REAL_WORLD";
    const voyage = await closureVoyage(owner, player, "livingChart", { authoredDefinition: definition });
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const operations: { operation: string; consent?: boolean; query?: string; recipient?: string }[] = [];
    try {
      await authenticateClosure(context, player, baseURL!);
      await auditNativeGeolocation(context);
      const page = await context.newPage();
      await openClosureJournal(page, voyage.id);
      await openClosureMap(page);
      const panel = page.locator(".landfall-online-data-panel:visible");
      await panel.locator("summary").click();
      await expect(panel).toHaveAttribute("open", "");
      const baseline = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      const events = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
      // The deployment's actual first-party route must truthfully report absence.
      await panel.getByRole("button", { name: "Check online data options" }).click();
      await expect(panel.getByRole("status", { name: "Online data status" })).toContainText(
        "No online data services are configured",
      );
      await expect(panel.getByRole("checkbox")).toHaveCount(0);
      const service = {
        id: "configured-geocoder",
        family: "GEOCODING",
        state: "CONFIGURED",
        recipient: "geo.example.test",
        attributionLabel: "Synthetic geography",
        attributionUrl: "https://geo.example.test/license",
        license: "Synthetic license",
        cacheRights: "PROHIBITED",
        offlineRights: "PROHIBITED",
        authoringRights: "PROHIBITED",
      };
      await context.route(`**/api/player/playthroughs/${voyage.id}/landfall/data`, async (route) => {
        const body = route.request().postDataJSON();
        operations.push({ ...body, recipient: route.request().headers()["x-landfall-recipient"] });
        await route.fulfill({
          json:
            body.operation === "STATUS"
              ? { state: "STATUS", services: [service] }
              : {
                  state: "RESULT",
                  service,
                  canComplete: false,
                  places: [
                    {
                      id: "synthetic-square",
                      label: "Synthetic Square",
                      point: { latitude: 40, longitude: -75 },
                      source: "EXTERNAL",
                      authoritative: false,
                      accuracy: "UNKNOWN",
                    },
                  ],
                },
        });
      });
      await panel.getByRole("button", { name: "Check online data options" }).click();
      await expect(panel.getByRole("checkbox")).toBeVisible();
      expect(operations).toEqual([{ operation: "STATUS", recipient: undefined }]);
      await expect(panel.getByRole("button", { name: "Search online places" })).toBeDisabled();
      await panel.getByRole("checkbox").check();
      await panel.getByRole("searchbox", { name: "Online place search" }).fill("Synthetic Square");
      expect(operations).toHaveLength(1);
      await panel.getByRole("button", { name: "Search online places" }).click();
      await panel.getByRole("button", { name: "Synthetic Square", exact: true }).click();
      expect(operations).toEqual([
        { operation: "STATUS", recipient: undefined },
        { operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5, recipient: "geo.example.test" },
      ]);
      expect((await geoAudit(page)).calls).toBe(0);
      await expect(panel.getByRole("button", { name: "Look up my current location online" })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".journal-objects-drawer .landfall-online-data-panel")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await panel.getByRole("button", { name: "Clear online suggestions" }).click();
      await expect(panel.getByRole("checkbox")).toHaveCount(0);
      await expect(panel.getByRole("button", { name: "Synthetic Square", exact: true })).toHaveCount(0);
      expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(events);
      const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      expect(after.currentSequence).toBe(baseline.currentSequence);
      expect(after.currentBlockId).toBe(baseline.currentBlockId);
      await panel.scrollIntoViewIfNeeded();
      const shot = testInfo.outputPath("online-data-cleared.png");
      await page.screenshot({ path: shot });
      await testInfo.attach("online-data-cleared", { path: shot, contentType: "image/png" });
      await testInfo.attach("online-data-evidence-class", {
        contentType: "application/json",
        body: JSON.stringify({
          evidenceClass: "SHARED_WEB_CONTRACT",
          defaultFirstPartyStatus: "REAL_OPTIMIZED_APPLICATION",
          configuredProviderTransport: "SYNTHETIC",
          canonicalProgressionEvents: 0,
          actualExternalRequests: 0,
        }),
      });
    } finally {
      await context.close().catch(() => undefined);
    }
  });
}

/** Browser-contract substitute only: the hosted radio corpus owns native OS proof. */
async function syntheticCompanion(context: BrowserContext, address: string) {
  await context.addInitScript(
    ({ address }) => {
      const operations: string[] = [];
      let configuration: { peerId: string; sessionKey: string; sessionId: number; peerAddress: string } | null = null;
      Object.assign(window, {
        __nearbyContract: {
          operations,
          signature: async () =>
            configuration && {
              sessionId: configuration.sessionId,
              peerAddress: configuration.peerAddress,
              keyHash: Array.from(
                new Uint8Array(
                  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(configuration.sessionKey)),
                ),
              )
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join(""),
            },
        },
        LandfallNative: {
          version: 1,
          platform: "ANDROID",
          request: async (message: string) => {
            const { operation, payload } = JSON.parse(message);
            operations.push(operation);
            if (operation === "UWB_PREPARE")
              return {
                state: "READY",
                role: payload.role,
                address,
                security: "PROVISIONED_STS",
                ...(payload.role === "CONTROLLER" ? { channel: 9, preamble: 9 } : {}),
              };
            if (operation === "UWB_START") {
              configuration = payload;
              const peerId = payload.peerId;
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent("landfall-native-event", {
                      detail: {
                        type: "nearby",
                        family: "UWB",
                        id: crypto.randomUUID(),
                        peerId,
                        observedAt: Date.now(),
                        distanceMeters: 1,
                        uncertaintyMeters: null,
                        authenticated: false,
                        sessionProtected: true,
                      },
                    }),
                  ),
                50,
              );
              return { state: "INITIALIZING" };
            }
            if (operation === "UWB_STOP") {
              configuration = null;
              return { state: "UNAVAILABLE" };
            }
            if (operation === "POWER_STATE")
              return {
                state: "READY",
                lowPower: false,
                thermalPressure: false,
                critical: false,
                observedAt: Date.now(),
              };
            return { state: "UNAVAILABLE", accepted: false };
          },
        },
      });
    },
    { address },
  );
}

test.describe("private companion exchange", () => {
  test("first-party companion pairing preserves the current objective and cancels on background", async ({
    browser,
    baseURL,
  }, testInfo) => {
    const voyage = await closureVoyage(owner, player, "livingChart");
    const contexts = await Promise.all(
      [0, 1].map(() =>
        browser.newContext({
          viewport: { width: 375, height: 900 },
          reducedMotion: "reduce",
        }),
      ),
    );
    let stage = "OPEN_CURRENT_JOURNAL",
      deviceIndex = 0;
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    try {
      await Promise.all(
        contexts.map(async (context, index) => {
          await authenticateClosure(context, player, baseURL!);
          await auditNativeGeolocation(context);
          await syntheticCompanion(context, index === 0 ? "AQI=" : "AwQ=");
        }),
      );
      for (const page of pages) {
        deviceIndex = pages.indexOf(page);
        stage = "OPEN_CURRENT_JOURNAL";
        await openClosureJournal(page, voyage.id);
        stage = "OPEN_CURRENT_MAP";
        await openClosureMap(page);
        stage = "EXPAND_NEARBY_CONTROLS";
        const panel = page.locator(".journal-objects-drawer .landfall-nearby-panel");
        await panel.locator("summary").click();
        await expect(panel).toHaveAttribute("open", "");
      }
      const panels = pages.map((page) => page.locator(".landfall-nearby-panel:visible"));
      const baseline = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      const eventCount = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
      const operations = (index: number) =>
        pages[index].evaluate(
          () => (window as unknown as { __nearbyContract: { operations: string[] } }).__nearbyContract.operations,
        );
      expect((await operations(0)).filter((value) => value.startsWith("UWB_"))).toEqual([]);
      stage = "CREATE_SCOPED_EXCHANGE";
      await panels[0].getByRole("button", { name: "Create pairing code", exact: true }).click();
      if (process.env.LANDFALL_NEARBY_PAIRING_MODE !== "ephemeral-instance") {
        await expect(panels[0].getByRole("status", { name: "Nearby device hint status" })).toContainText(
          "unavailable on this deployment",
        );
        expect((await operations(0)).filter((value) => value.startsWith("UWB_"))).toEqual([]);
      } else {
        stage = "JOIN_SCOPED_EXCHANGE";
        const code = await panels[0].getByLabel("Pairing code", { exact: true }).textContent();
        expect(typeof code === "string" && /^[A-Za-z0-9_-]{43}$/.test(code)).toBe(true);
        await panels[1].getByLabel("Code from your other device").fill(code!);
        await panels[1].getByRole("button", { name: "Join my other device", exact: true }).click();
        await expect(panels[1].getByRole("status", { name: "Nearby device hint status" })).toContainText(
          "cannot confirm arrival",
        );
        stage = "START_AND_MATCH_CONFIGURATION";
        await panels[0].getByRole("button", { name: "Start hints", exact: true }).click();
        await expect(panels[0].getByRole("status", { name: "Nearby device hint status" })).toContainText(
          "cannot confirm arrival",
        );
        const signatures = await Promise.all(
          pages.map((page) =>
            page.evaluate(() =>
              (
                window as unknown as {
                  __nearbyContract: {
                    signature(): Promise<{
                      sessionId: number;
                      peerAddress: string;
                      keyHash: string;
                    } | null>;
                  };
                }
              ).__nearbyContract.signature(),
            ),
          ),
        );
        expect(signatures[0]?.sessionId).toBe(signatures[1]?.sessionId);
        expect(signatures[0]?.keyHash).toBe(signatures[1]?.keyHash);
        expect(signatures[0]?.peerAddress).toBe("AwQ=");
        expect(signatures[1]?.peerAddress).toBe("AQI=");
        // The test never serializes codes, handles, keys, or native payloads into artifacts.
        signatures.fill(null);
        for (const panel of panels) {
          await expect(panel.getByLabel("Pairing code", { exact: true })).toHaveCount(0);
          await expect(panel.getByLabel("Code from your other device")).toHaveValue("");
        }
        stage = "BACKGROUND_AND_STOP";
        await pages[0].evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("landfall-native-event", {
              detail: { type: "lifecycle", state: "BACKGROUND" },
            }),
          ),
        );
        await expect(panels[0].getByRole("status", { name: "Nearby device hint status" })).toContainText("paused");
        const starts = (await operations(0)).filter((value) => value === "UWB_START").length;
        await pages[0].evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("landfall-native-event", {
              detail: { type: "lifecycle", state: "FOREGROUND" },
            }),
          ),
        );
        expect((await operations(0)).filter((value) => value === "UWB_START")).toHaveLength(starts);
        await panels[1].getByRole("button", { name: "Stop nearby hints", exact: true }).click();
        await expect(panels[1].getByRole("status", { name: "Nearby device hint status" })).toContainText("stopped");
      }
      stage = "MOBILE_ACCESSIBILITY";
      expect(await pages[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(
        (
          await new AxeBuilder({ page: pages[0] })
            .include(".journal-objects-drawer .landfall-nearby-panel")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await panels[0].scrollIntoViewIfNeeded();
      const shot = testInfo.outputPath("nearby-companion-stopped.png");
      await pages[0].screenshot({ path: shot });
      await testInfo.attach("nearby-companion-stopped", { path: shot, contentType: "image/png" });
      stage = "CANONICAL_PROGRESSION_UNCHANGED";
      for (const page of pages) expect((await geoAudit(page)).calls).toBe(0);
      expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(eventCount);
      const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      expect(after.currentBlockId).toBe(baseline.currentBlockId);
      expect(after.currentSequence).toBe(baseline.currentSequence);
      await testInfo.attach("nearby-browser-evidence-class", {
        body: JSON.stringify({
          evidenceClass: "SHARED_WEB_CONTRACT",
          nativeBridge: "SYNTHETIC",
          firstPartyApi: "REAL_OPTIMIZED_APPLICATION",
          canonicalProgressionEvents: 0,
          pairingConfigured: process.env.LANDFALL_NEARBY_PAIRING_MODE === "ephemeral-instance",
        }),
        contentType: "application/json",
      });
    } catch (error) {
      if (["OPEN_CURRENT_JOURNAL", "OPEN_CURRENT_MAP", "EXPAND_NEARBY_CONTROLS"].includes(stage)) {
        // No pairing request has occurred in these stages, so this fake-account
        // fixture image cannot contain a pairing code or key.
        const shot = testInfo.outputPath("nearby-before-pairing-failure.png");
        await pages[deviceIndex].screenshot({ path: shot, timeout: 10000 }).catch(() => undefined);
        await writeFile(
          testInfo.outputPath("nearby-opening-error.json"),
          JSON.stringify({
            stage,
            deviceIndex,
            // Only opening-stage synthetic fixture selectors; no exchange has started.
            error: error instanceof Error ? error.message.slice(0, 4096) : "OPENING_FAILED",
          }),
        );
      }
      // Playwright action errors can include the argument passed to fill().
      // Preserve categorical failure without retaining the private pairing code.
      throw new Error(`LANDFALL_COMPANION_BROWSER_CONTRACT_FAILED:${stage}`);
    } finally {
      const receipt = testInfo.outputPath("nearby-browser-stage.json");
      await writeFile(receipt, JSON.stringify({ stage, deviceIndex }));
      await testInfo.attach("nearby-browser-stage", { path: receipt, contentType: "application/json" });
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
    }
  });
});

test("online background maps require a deliberate sharing choice and never write progression", async ({
  browser,
  baseURL,
}, testInfo) => {
  const definition = structuredClone(landfallFixture);
  definition.maps[0].source = { type: "BUILTIN_RASTER", providerId: "osm-standard", styleId: "standard" };
  const voyage = await closureVoyage(owner, player, "livingChart", { authoredDefinition: definition });
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: "reduce" });
  const external: string[] = [];
  try {
    await authenticateClosure(context, player, baseURL!);
    await auditNativeGeolocation(context);
    await context.route("**/api/landfall/map-data", (route) =>
      route.fulfill({
        json: {
          state: "CONFIGURED",
          id: "deployment-raster",
          tileTemplate: "https://maps.example.org/{z}/{x}/{y}.png",
          attributionLabel: "Synthetic map license",
          attributionUrl: "https://maps.example.org/license",
          maxZoom: 18,
          offlineRights: "PROHIBITED",
        },
      }),
    );
    // Actual external services are never contacted by this hosted/browser fixture.
    await context.route("https://maps.example.org/**", (route) => {
      external.push("TILE_REQUEST");
      return route.abort();
    });
    const page = await context.newPage();
    await openClosureJournal(page, voyage.id);
    await openClosureMap(page);
    const chart = page.locator(".journal-objects-drawer [data-landfall-player-chart]");
    const load = chart.getByRole("button", { name: "Load online background maps", exact: true });
    await expect(load).toBeVisible();
    await expect(chart).toContainText("share the displayed map area with maps.example.org");
    expect(external).toEqual([]);
    const events = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
    await load.click();
    await expect(chart.getByRole("link", { name: "Synthetic map license", exact: true })).toBeVisible();
    await chart.getByRole("button", { name: "Stop loading online background maps", exact: true }).click();
    await expect(load).toBeVisible();
    expect((await geoAudit(page)).calls).toBe(0);
    expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(events);
    const screenshot = testInfo.outputPath("online-map-sharing-choice.png");
    await load.scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshot });
    await testInfo.attach("online-map-sharing-choice", { path: screenshot, contentType: "image/png" });
  } finally {
    await context.close();
  }
});

for (const virtual of [false, true])
  for (const width of [375, 1280]) {
    test(`released-place search only changes the view in ${virtual ? "VIRTUAL" : "PHYSICAL"} at ${width}px`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      const voyage = await closureVoyage(owner, player, "livingChart", { virtual });
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      try {
        await authenticateClosure(context, player, baseURL!);
        await auditNativeGeolocation(context);
        const page = await context.newPage();
        const mutations: string[] = [];
        page.on("request", (request) => {
          if (request.method() !== "GET" && /landfall/.test(new URL(request.url()).pathname))
            mutations.push(request.method());
        });
        await openClosureJournal(page, voyage.id);
        await openClosureMap(page);
        const chart = page.locator("[data-landfall-player-chart]:visible");
        const search = chart.getByRole("searchbox", { name: "Find a place on your released maps" });
        await expect(search).toBeVisible();
        expect((await search.boundingBox())?.height).toBeGreaterThanOrEqual(48);
        const baseline = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
        const eventCount = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
        const requestsBefore = mutations.length;
        await search.fill("Withheld destination");
        await expect(chart.getByRole("button", { name: /View Withheld destination/ })).toHaveCount(0);
        await search.fill(virtual ? "Secret Isle" : "Town arrival");
        const result = chart.getByRole("button", { name: virtual ? /View Secret Isle/ : /View Town arrival/ });
        await expect(result).toBeVisible();
        await result.focus();
        await page.keyboard.press("Enter");
        await expect(chart).toContainText("selected for viewing");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .include('[aria-label="Search released places"]')
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        const shot = testInfo.outputPath("released-place-selected.png");
        await page.screenshot({ path: shot, fullPage: false });
        await testInfo.attach("released-place-selected", { path: shot, contentType: "image/png" });
        const preview = chart.locator('[aria-label="Landfall map preview"]');
        const renderedMap = preview.locator(
          virtual ? '[aria-label="Virtual Landfall chart"]' : '[aria-label="Physical Landfall map"]',
        );
        await renderedMap.scrollIntoViewIfNeeded();
        await expect(renderedMap).toBeVisible();
        expect(
          await renderedMap.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return hit === element || (hit !== null && element.contains(hit));
          }),
        ).toBe(true);
        const mapShot = testInfo.outputPath("released-place-map.png");
        await page.screenshot({ path: mapShot, fullPage: false });
        await testInfo.attach("released-place-map", { path: mapShot, contentType: "image/png" });
        const selectedPlace = preview.locator('[aria-label="Visible map locations"] [data-selected="true"]');
        await selectedPlace.scrollIntoViewIfNeeded();
        await expect(selectedPlace).toContainText(virtual ? "Secret Isle" : "Town arrival");
        await expect(selectedPlace).toContainText("selected for viewing");
        await chart.getByRole("button", { name: "Clear place search" }).click();
        await expect(search).toHaveValue("");
        await expect(chart).not.toContainText("selected for viewing");
        expect((await geoAudit(page)).calls).toBe(0);
        expect(mutations.length).toBe(requestsBefore);
        expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(eventCount);
        const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
        expect(after.currentBlockId).toBe(baseline.currentBlockId);
        expect(after.currentSequence).toBe(baseline.currentSequence);
      } finally {
        await context.close();
      }
    });
  }
