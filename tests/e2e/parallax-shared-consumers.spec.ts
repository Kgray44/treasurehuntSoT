import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createCrossdeckRefitFixture, removeCrossdeckRefitFixture } from "./fixtures/crossdeck-refit";
import { authenticateClosure } from "./fixtures/landfall-closure";
import { PHASE3_MOTION_MODES, setPhase3Motion } from "./fixtures/lanternwake-phase3";

test.afterAll(() => db.$disconnect());
for (const [profile, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]] as const) {
  test("returning Journal finishes normal-motion settling · " + profile, async ({ page, context, baseURL }) => {
    test.setTimeout(75_000);
    const fixture = await createCrossdeckRefitFixture();
    try {
      await page.setViewportSize({ width, height });
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await authenticateClosure(context, fixture.account, baseURL!);
      await page.goto("/player/playthroughs/" + fixture.voyage.id + "/journal");
      const journal = page.locator(".chronicle-journal-shell[data-journal-phase]");
      await expect(journal).toHaveAttribute("data-motion-mode", "full");
      await page.getByRole("button", { name: "Open the journal" }).click();
      await page.getByRole("button", { name: "Skip ceremony" }).click();
      await expect(journal).toHaveAttribute("data-journal-ready-reason", "skipped");
      await page.addInitScript(() => {
        const output: Array<Record<string, unknown>> = [];
        const scoped = window as Window & { settlingEvidence?: typeof output };
        scoped.settlingEvidence = output;
        let previous = "";
        const observer = new MutationObserver(() => {
          const shell = document.querySelector<HTMLElement>(".chronicle-journal-shell[data-journal-phase]");
          if (!shell) return;
          const phase = shell.dataset.journalPhase;
          const outcome = shell.dataset.journalOpeningOutcome;
          const reason = shell.dataset.journalReadyReason;
          const state = [phase, outcome, reason].join("|");
          if (state === previous) return;
          previous = state;
          output.push({ at: performance.now(), phase, outcome, reason });
          if (phase === "BOOK_SETTLING") {
            requestAnimationFrame(() => {
              const cover = shell.querySelector<HTMLElement>(".front-cover");
              const work = cover?.getAnimations().map((animation) => ({
                transition: (animation as CSSTransition).transitionProperty,
                endTime: animation.effect?.getComputedTiming().endTime,
              }));
              output.push({ at: performance.now(), coverDuration: cover && getComputedStyle(cover).transitionDuration, work });
            });
          }
        });
        observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: [
          "data-journal-phase", "data-journal-opening-outcome", "data-journal-ready-reason",
        ] });
      });
      await page.reload();
      await expect(journal).toHaveAttribute("data-motion-mode", "full");
      await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY", { timeout: 20_000 });
      await expect(page.getByRole("navigation", { name: "Journal tools" })).toBeVisible();
      const evidence = await page.evaluate(() => (window as Window & { settlingEvidence?: unknown[] }).settlingEvidence);
      const reason = await journal.getAttribute("data-journal-ready-reason");
      const record = { profile, lane: process.env.HOME_PRODUCT_ROLE, reason, evidence };
      console.log("JOURNAL_SETTLING_PROOF " + JSON.stringify(record));
      const directory = "artifacts/sounding-line/journal-906-settling-proof";
      await mkdir(directory, { recursive: true });
      await writeFile(directory + "/" + profile + ".json", JSON.stringify(record, null, 2) + "\n");
      expect(evidence).toContainEqual(expect.objectContaining({ phase: "BOOK_SETTLING", outcome: "running" }));
      expect(reason).toBe("completed");
      await expect(page.getByText(/animated opening could not finish/i)).toHaveCount(0);
    } finally {
      await page.close();
      await removeCrossdeckRefitFixture(fixture);
    }
  });
}
