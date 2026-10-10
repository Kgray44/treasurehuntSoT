import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { syntheticSpatialMoment } from "../../src/parallax/fixtures";
import { closureAccount, closureVoyage, authenticateClosure, openClosureJournal } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "serial", timeout: 120_000 });
test.afterAll(() => db.$disconnect());
for (const mobile of [false, true])
  test(`Guided Lens preserves meaning and progression on ${mobile ? "mobile" : "desktop"}`, async ({
    browser,
    baseURL,
  }) => {
    if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
    ensureGenericSoundingLineIsolation();
    const account = await closureAccount("Synthetic Parallax navigator");
    let taleId: string | undefined;
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: "reduce",
    });
    try {
      const voyage = await closureVoyage(account, account, "narrative");
      taleId = voyage.taleId;
      const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
      const snapshot = JSON.parse(version.contentSnapshot);
      const block = snapshot.chapters[0].blocks[0];
      block.configuration = { heading: "The Captain’s note", body: "Open the Lens to read the released clue." };
      block.presentation = { spatialMoment: syntheticSpatialMoment(voyage.activeId) };
      block.completion = { mode: "playerConfirmation" };
      const contentSnapshot = JSON.stringify(snapshot);
      await db.publishedTaleVersion.update({
        where: { id: voyage.versionId },
        data: {
          contentSnapshot,
          checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
        },
      });
      const before = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      await authenticateClosure(context, account, baseURL!);
      const page = await context.newPage();
      await openClosureJournal(page, voyage.id, baseURL);
      const entry = page.getByRole("button", { name: "Open Chronicle Lens", exact: true });
      await entry.focus();
      await entry.press("Enter");
      const lens = page.getByRole("dialog", { name: "A message between worlds", exact: true });
      await expect(lens.getByText("Guided View", { exact: true })).toBeVisible();
      await expect(
        lens.getByText("The next bearing is written in the stars. Look for the northern light.", { exact: true }),
      ).toBeVisible();
      await expect(lens.getByRole("button", { name: "Use camera for local placement" })).toHaveCount(0);
      const choose = lens.getByRole("button", { name: "Choose", exact: true });
      await expect(choose).toBeEnabled();
      await choose.focus();
      await choose.press("Enter");
      await expect(lens.getByRole("status")).toHaveText(
        "Interaction recorded. Continue through the passage when you are ready.",
      );
      await lens.getByRole("button", { name: "Inspect", exact: true }).click();
      await expect(lens.getByText(/You are inspecting The Captain’s note/)).toBeVisible();
      const a11y = await new AxeBuilder({ page }).include("dialog[open]").analyze();
      expect(a11y.violations.filter((v) => ["critical", "serious"].includes(v.impact || ""))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
      await expect(lens).toHaveCount(0);
      await expect(entry).toBeFocused();
      await entry.press("Enter");
      await expect(lens.getByRole("button", { name: "Choose", exact: true })).toBeEnabled();
      await expect(lens.getByText(/You are inspecting The Captain’s note/)).toHaveCount(0);
      await lens.press("Escape");
      await expect(lens).toHaveCount(0);
      const observations = await db.parallaxObservation.findMany({ where: { sessionId: voyage.id } });
      expect(observations).toHaveLength(2);
      expect(observations.map((row) => JSON.parse(row.evidence).mode)).toEqual(["GUIDED", "GUIDED"]);
      const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      expect(after.currentBlockId).toBe(before.currentBlockId);
      expect(after.currentSequence).toBe(before.currentSequence);
    } finally {
      await context.close();
      if (taleId) await db.chronicle.delete({ where: { id: taleId } });
      await db.userAccount.delete({ where: { id: account.id } });
    }
  });
