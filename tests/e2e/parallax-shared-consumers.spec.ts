import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createCrossdeckRefitFixture, removeCrossdeckRefitFixture } from "./fixtures/crossdeck-refit";
import { authenticateClosure } from "./fixtures/landfall-closure";
import { PHASE3_MOTION_MODES, setPhase3Motion } from "./fixtures/lanternwake-phase3";

type SkipSample = { elapsed: number; owners: Array<{ property: string; owner: string }> };

test.afterAll(() => db.$disconnect());
test("identify animations remaining after Skip during a real full Journal replay", async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const fixture = await createCrossdeckRefitFixture();
  try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
    await authenticateClosure(context, fixture.account, baseURL!);
    await page.goto("/player/playthroughs/" + fixture.voyage.id + "/journal");
    const journal = page.locator(".chronicle-journal-shell");
    await page.getByRole("button", { name: "Open the journal" }).click();
    await expect(journal).toHaveAttribute("data-journal-ready-reason", "completed", { timeout: 20_000 });
    await page.getByRole("button", { name: "Replay full opening" }).click();
    await expect(journal).toHaveAttribute("data-journal-opening-outcome", "running");
    const skip = page.getByRole("button", { name: "Skip ceremony" });
    await skip.evaluate((control) => {
      const scoped = window as Window & { journalSkipAttribution?: Promise<SkipSample[]> };
      scoped.journalSkipAttribution = new Promise((resolve) => {
        control.addEventListener("click", () => {
          const start = performance.now();
          const observations: SkipSample[] = [];
          let previous = "";
          const inspect = () => {
            const elapsed = performance.now() - start;
            const owners = document.getAnimations().filter(a => a.pending || a.playState === "running").map(a => {
              const effect = a.effect as KeyframeEffect | null;
              const target = effect?.target;
              const classes = target && "classList" in target ? Array.from(target.classList).join(" ") : "";
              return {
                property: a instanceof CSSTransition ? a.transitionProperty : a instanceof CSSAnimation ? a.animationName : "web-animation",
                owner: classes || target?.nodeName || "unbound",
                actor: target?.getAttribute("data-opening-actor"),
                end: effect?.getComputedTiming().endTime,
              };
            });
            const serialized = JSON.stringify(owners);
            if (serialized !== previous) {
              previous = serialized;
              observations.push({ elapsed, owners });
            }
            if (elapsed < 1800) requestAnimationFrame(inspect);
            else resolve(observations);
          };
          requestAnimationFrame(inspect);
        }, { once: true, capture: true });
      });
    });
    await skip.click();
    await expect(journal).toHaveAttribute("data-journal-ready-reason", "skipped");
    await expect(page.getByRole("navigation", { name: "Journal tools" })).toBeVisible();
    const observations = await page.evaluate(() => (window as Window & { journalSkipAttribution?: Promise<SkipSample[]> }).journalSkipAttribution);
    expect(observations).toBeTruthy();
    const ownsDecoration = (sample: SkipSample) =>
      sample.owners.some(({ owner }) => /(?:^|\s)(?:book-shadow|rear-book-cover|page-stack|book-binding)(?:\s|$)/.test(owner));
    const firstClean = observations!.find(sample => !ownsDecoration(sample));
    expect(firstClean).toBeDefined();
    if (process.env.SKIP_LANE === "patched") {
      expect(firstClean!.elapsed).toBeLessThan(250);
      expect(observations!.some(ownsDecoration)).toBe(false);
    } else {
      expect(observations!.some(ownsDecoration)).toBe(true);
      expect(firstClean!.elapsed).toBeGreaterThanOrEqual(250);
    }
    const decorations = journal.locator(".book-shadow, .rear-book-cover, .page-stack, .book-binding");
    await expect(decorations).toHaveCount(5);
    for (const decoration of await decorations.all()) {
      await expect(decoration).toHaveCSS("opacity", "1");
      await expect(decoration).toBeVisible();
    }
    await page.getByRole("button", { name: "Next journal page" }).click({ trial: true });
    console.log("JOURNAL_SKIP_DECORATIVE_MS " + JSON.stringify({lane:process.env.SKIP_LANE, elapsed:firstClean!.elapsed}));
    const directory = "artifacts/sounding-line/journal-skip-owners";
    await mkdir(directory, { recursive: true });
    await writeFile(directory + "/owners.json", JSON.stringify(observations, null, 2) + "\n");
    console.log("JOURNAL_SKIP_OWNERS " + JSON.stringify(observations));
  } finally {
    await page.close();
    await removeCrossdeckRefitFixture(fixture);
  }
});
