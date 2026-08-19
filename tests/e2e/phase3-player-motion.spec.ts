import { db } from "../../src/lib/db";
import {
  expect,
  openPhase3Player,
  PHASE3_MOTION_MODES,
  phase3Test,
  setPhase3Motion,
} from "./fixtures/lanternwake-phase3";

/**
 * The former 185 tuple suite multiplied retired Companion sections by legacy
 * events. The canonical Chronicle journal has one persistent surface, so the
 * governed browser cases are the five resolved motion authorities below.
 */
phase3Test.describe("Lanternwake canonical journal motion policy", () => {
  phase3Test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Canonical motion mutations run in the declared Chromium progression project.",
  );

  for (const motion of PHASE3_MOTION_MODES) {
    phase3Test(
      `P3-MOTION-${motion.id.slice(1).padStart(3, "0")} ${motion.id} canonical journal policy`,
      async ({ page, phase3 }) => {
        phase3Test.setTimeout(45_000);
        await page.setViewportSize({ width: 1_440, height: 900 });
        await setPhase3Motion(page, motion);
        await phase3.proveIsolation();
        const fixture = await phase3.createCase(`canonical-motion-${motion.id}`, "CHAPTER_RELEASED");
        await openPhase3Player(page, fixture, "journal");
        // The anonymous compatibility route resets its account preference bridge
        // to the safe default during hydration. Apply the declared product
        // preference only after that bridge is live, through its public runtime
        // notification, and retain the browser setting as the higher-priority
        // accessibility input.
        await setPhase3Motion(page, motion);
        await expect
          .poll(() => page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches))
          .toBe(motion.browserReduced);

        const journal = page.locator(".chronicle-journal-shell");
        await expect(journal).toHaveAttribute("data-motion-mode", motion.productMode);
        await expect(journal).toHaveAttribute("data-motion-level", motion.resolvedMode);
        const heading = journal.getByRole("heading", { level: 2 });
        await heading.focus();
        await expect(heading).toBeFocused();

        const action = await phase3.canonicalCaptainAction(fixture, "presentation");
        const session = await db.taleSession.findUniqueOrThrow({
          where: { id: action.sessionId },
          select: { events: { orderBy: { sequence: "asc" } }, currentSequence: true },
        });
        expect(session.events.at(-1)).toMatchObject({ eventType: "presentationTriggered" });
        expect(session.currentSequence).toBe(session.events.length);
        await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(0);
        await expect(journal.getByRole("button").first()).toBeVisible();
      },
    );
  }
});
