import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { syntheticSpatialMoment } from "../../src/parallax/fixtures";
import { materializeSpatialVersion } from "../../src/parallax/publication";
import { createPresetConstruction } from "../../src/parallax/preset-construction";
import { emptyStudioContent } from "../../src/parallax/studio-contracts";
import { closureAccount, closureVoyage, authenticateClosure, openClosureJournal } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

// Browser recovery proof only. The camera is Chromium's synthetic device; no live tracker is loaded.
test.use({
  video: "on",
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});
test.afterAll(() => db.$disconnect());

for (const scenario of ["startup-failure", "license-blocked"])
  for (const mobile of [false, true])
    test(`Chronicle Lens explains ${scenario} on ${mobile ? "phone" : "desktop"}`, async ({ browser, baseURL }) => {
      ensureGenericSoundingLineIsolation();
      const source = process.env.PARALLAX_A1_SOURCE_SHA;
      if (!source || !/^[a-f0-9]{40}$/.test(source)) throw new Error("EXACT_SOURCE_REQUIRED");
      const evidence = `artifacts/parallax-tracking-recovery/${source.slice(0, 12)}/${scenario}`;
      await mkdir(evidence, { recursive: true });
      const account = await closureAccount("Synthetic tracking recovery navigator");
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "reduce",
        permissions: ["camera", "clipboard-read", "clipboard-write"],
        recordVideo: { dir: `${evidence}/recordings` },
      });
      let taleId: string | undefined;
      try {
        const voyage = await closureVoyage(account, account, "narrative");
        taleId = voyage.taleId;
        const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
        const snapshot = JSON.parse(version.contentSnapshot);
        const block = snapshot.chapters[0].blocks[0];
        const moment = syntheticSpatialMoment(voyage.activeId);
        const { checksum: _checksum, ...content } = moment.version;
        void _checksum;
        content.studio = {
          ...emptyStudioContent(),
          environment: createPresetConstruction({
            id: "bedroom",
            name: "Synthetic Bedroom",
            width: 5,
            depth: 5,
            vertical: true,
          }),
        };
        moment.version = materializeSpatialVersion(content);
        moment.attachment.versionChecksum = moment.version.checksum;
        block.configuration = {
          heading: "Tracking recovery check",
          body: "Open this released scene through Chronicle Lens.",
        };
        block.presentation = { spatialMoment: moment };
        block.completion = { mode: "playerConfirmation" };
        const contentSnapshot = JSON.stringify(snapshot);
        await db.publishedTaleVersion.update({
          where: { id: voyage.versionId },
          data: { contentSnapshot, checksum: createHash("sha256").update(contentSnapshot).digest("hex") },
        });
        await context.addInitScript(() => {
          Object.defineProperty(window, "DeviceMotionEvent", {
            configurable: true,
            value: class {
              static requestPermission() {
                return Promise.resolve("granted");
              }
            },
          });
        });
        await context.route("**/api/dev/parallax-tracker/availability", (route) =>
          route.fulfill({
            json:
              scenario === "license-blocked"
                ? {
                    localPrototype: false,
                    engine: "ZAPPAR",
                    blockedReason:
                      "Zappar requires an active owner-authorized trial or commercial entitlement, an approved HTTPS origin, and the pinned SDK sidecar.",
                  }
                : { localPrototype: true, engine: "TINYVIO" },
          }),
        );
        await context.route("**/api/dev/parallax-tracker/tinyvio-slam.js", (route) => route.abort("failed"));
        await authenticateClosure(context, account, baseURL!);
        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await openClosureJournal(page, voyage.id, baseURL);
        await page.getByRole("button", { name: "Open Chronicle Lens", exact: true }).click();
        const lens = page.getByRole("dialog", { name: "A message between worlds", exact: true });
        const start = lens.getByRole("button", { name: "Start browser AR", exact: true });
        if (scenario === "license-blocked") {
          await expect(start).toBeDisabled();
          await expect(lens.getByText(/Zappar requires an active owner-authorized/)).toBeVisible();
          await expect(lens.getByText("Guided View", { exact: true })).toBeVisible();
          await expect(lens.getByRole("article").first()).toBeVisible();
          await page.screenshot({ path: `${evidence}/${mobile ? "phone" : "desktop"}-blocked.png`, fullPage: true });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          expect(pageErrors).toEqual([]);
          await writeFile(
            `${evidence}/${mobile ? "phone" : "desktop"}-result.json`,
            JSON.stringify(
              { source, scenario, physicalAcceptance: false, sdkLoaded: false, guidedAvailable: true, pageErrors },
              null,
              2,
            ),
          );
          await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
          return;
        }
        await expect(start).toBeEnabled();
        await page.screenshot({ path: `${evidence}/${mobile ? "phone" : "desktop"}-entry.png`, fullPage: true });
        await start.click();
        await expect(lens.getByRole("alert")).toContainText("tracking module could not load");
        await expect(lens.getByText(/Tracking: STOPPED/)).toBeVisible();
        await expect(lens.getByRole("button", { name: "Restart tracking / recalibrate" })).toBeEnabled();
        await lens.getByRole("button", { name: "Restart tracking / recalibrate" }).click();
        await expect(lens.getByRole("alert")).toContainText("tracking module could not load");
        await expect(lens.getByText(/Tracking: STOPPED/)).toBeVisible();
        await lens.getByText("Tracking details", { exact: true }).click();
        await expect(lens.getByRole("list", { name: "Recent tracking events" })).toContainText("Alignment failed");
        await lens.getByRole("button", { name: "Copy tracking details" }).click();
        await expect(lens.getByRole("button", { name: "Details copied" })).toBeVisible();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(
          JSON.parse(copied).events.filter((event: { step: string }) => event.step === "Starting tracking"),
        ).toHaveLength(2);
        expect(copied).not.toContain(account.id);
        expect(copied).not.toContain("Synthetic Bedroom");
        await page.screenshot({ path: `${evidence}/${mobile ? "phone" : "desktop"}-recovery.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await lens.getByRole("button", { name: "Use Guided View", exact: true }).click();
        await expect(lens.getByText("Guided View", { exact: true })).toBeVisible();
        const card = lens.getByRole("article").first();
        await expect(card).toBeVisible();
        const contrast = await card.evaluate((element) => {
          const rgb = (value: string) =>
            value
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number);
          const luminance = (values: number[]) =>
            values
              .map((v) => {
                const c = v / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          const backgrounds = [...getComputedStyle(element).backgroundImage.matchAll(/rgb\(([^)]+)\)/g)].map((match) =>
            luminance(rgb(match[0])),
          );
          const colors = [element.querySelector("h3")!, ...element.querySelectorAll(":scope > p")].map(
            (node) => getComputedStyle(node).color,
          );
          return {
            colors,
            ratios: colors.flatMap((color) =>
              backgrounds.map((background) => {
                const foreground = luminance(rgb(color));
                return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
              }),
            ),
          };
        });
        expect(contrast.ratios.length).toBeGreaterThanOrEqual(6);
        expect(Math.min(...contrast.ratios)).toBeGreaterThanOrEqual(4.5);
        await page.screenshot({
          path: `${evidence}/${mobile ? "phone" : "desktop"}-guided-return.png`,
          fullPage: true,
        });
        await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
        expect(pageErrors).toEqual([]);
        await writeFile(
          `${evidence}/${mobile ? "phone" : "desktop"}-result.json`,
          JSON.stringify(
            {
              source,
              camera: "CHROMIUM_SYNTHETIC_DEVICE",
              tracker: "SCRIPT_LOAD_FAILURE_INJECTED",
              visibleError: true,
              retryExecuted: true,
              clipboardReadBack: true,
              contrast,
              guidedReturn: true,
              pageErrors,
              physicalAcceptance: false,
            },
            null,
            2,
          ),
        );
      } finally {
        await context.close();
        if (taleId) await db.chronicle.delete({ where: { id: taleId } });
        await db.userAccount.delete({ where: { id: account.id } });
      }
    });
