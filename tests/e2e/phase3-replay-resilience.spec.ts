import { db } from "../../src/lib/db";
import {
  expect,
  openPhase3Player,
  phase3Test,
  setPhase3Motion,
  PHASE3_MOTION_MODES,
} from "./fixtures/lanternwake-phase3";

phase3Test.describe("Lanternwake canonical journal replay resilience", () => {
  phase3Test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Canonical replay persistence runs in the declared Chromium progression project.",
  );

  phase3Test(
    "P3-REPLAY-001 reentry and refresh preserve one canonical presentation event",
    async ({ page, phase3 }) => {
      phase3Test.setTimeout(45_000);
      await setPhase3Motion(page, PHASE3_MOTION_MODES[2]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("canonical-replay", "CHAPTER_RELEASED");
      await openPhase3Player(page, fixture, "journal");
      const action = await phase3.canonicalCaptainAction(fixture, "presentation");
      const beforeReplay = await db.taleSession.findUniqueOrThrow({
        where: { id: action.sessionId },
        select: { currentSequence: true, events: { orderBy: { sequence: "asc" } } },
      });
      expect(beforeReplay.events.at(-1)).toMatchObject({ eventType: "presentationTriggered" });

      // Journal reentry is the canonical replay-safe presentation path. It
      // restores a readable journal without issuing another progression command.
      await page.reload();
      const journal = page.locator(".chronicle-journal-shell");
      await expect(journal).toBeVisible();
      await expect(journal).toHaveAttribute("data-motion-level", "reduced");
      const heading = journal.getByRole("heading", { level: 2 });
      await heading.focus();
      await expect(heading).toBeFocused();
      const afterReplay = await db.taleSession.findUniqueOrThrow({
        where: { id: action.sessionId },
        select: { currentSequence: true, events: { orderBy: { sequence: "asc" } } },
      });
      expect(afterReplay.currentSequence).toBe(beforeReplay.currentSequence);
      expect(afterReplay.events).toEqual(beforeReplay.events);
      await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(0);
    },
  );
});
