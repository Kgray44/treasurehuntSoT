import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createCrossdeckRefitFixture, removeCrossdeckRefitFixture } from "./fixtures/crossdeck-refit";
import { authenticateClosure } from "./fixtures/landfall-closure";
import { PHASE3_MOTION_MODES, setPhase3Motion } from "./fixtures/lanternwake-phase3";

test.afterAll(() => db.$disconnect());
const openingSelectors = [
  ".open-page-stage", ".page-flip-runtime", ".ft-page", ".book-shadow", ".rear-book-cover",
  ".page-stack", ".book-binding", ".closed-book", ".closed-page-block", ".cover-front",
  ".cover-inside", ".opening-sealed-page", ".opening-wax-seal", ".journal-opening-status",
  ".chronicle-journal-workspace", ".chronicle-session-header", ".product-shell-header",
];

async function readStyles(page: Page) {
  return page.evaluate(selectors => {
    const shell = document.querySelector(".chronicle-journal-shell");
    if (!shell) throw new Error("Journal shell is required");
    const animationTargets = new Set(
      document.getAnimations().filter(animation => animation.pending || animation.playState === "running")
        .map(animation => (animation.effect as KeyframeEffect | null)?.target),
    );
    function summarize(element: Element) {
      const own = getComputedStyle(element);
      const ancestors: Element[] = [];
      for (let parent: Element | null = element; parent; parent = parent.parentElement) ancestors.push(parent);
      const area = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(area.right, innerWidth) - Math.max(0, area.left));
      const visibleHeight = Math.max(0, Math.min(area.bottom, innerHeight) - Math.max(0, area.top));
      return {
        className: [...element.classList].join(" ").slice(0, 160),
        visibility: own.visibility, display: own.display, opacity: Number(own.opacity),
        effectiveOpacity: ancestors.reduce((total, parent) => total * Number(getComputedStyle(parent).opacity), 1),
        contentVisibility: own.contentVisibility, backfaceVisibility: own.backfaceVisibility,
        ancestorHidesDisplay: ancestors.some(parent => getComputedStyle(parent).display === "none"),
        viewportArea: Math.round(visibleWidth * visibleHeight),
        ownAnimation: animationTargets.has(element),
      };
    }
    return {
      phase: shell.getAttribute("data-journal-phase"),
      opening: shell.getAttribute("data-journal-opening-outcome"),
      surfaces: Object.fromEntries(selectors.map(selector => [
        selector, Array.from(document.querySelectorAll(selector)).slice(0, 6).map(summarize),
      ])),
    };
  }, openingSelectors);
}

test("locate hidden draws and animation ownership on the exact protected Journal", async ({ page, context, browser, baseURL }) => {
  test.setTimeout(110_000);
  const fixture = await createCrossdeckRefitFixture();
  const target = await context.newCDPSession(page);
  const browserSession = await browser.newBrowserCDPSession();
  try {
    const { gpu } = await browserSession.send("SystemInfo.getInfo");
    const platform = {
      compositor: gpu.featureStatus?.gpu_compositing,
      rasterization: gpu.featureStatus?.rasterization,
      renderer: gpu.auxAttributes?.glRenderer,
    };
    let currentLayers: Array<{ layerId: string; backendNodeId?: number; width: number; height: number; paintCount: number; drawsContent: boolean }> = [];
    target.on("LayerTree.layerTreeDidChange", ({ layers }) => { if(layers) currentLayers = layers; });
    await target.send("DOM.enable");
    await target.send("LayerTree.enable");
    await page.setViewportSize({ width: 1440, height: 900 });
    await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
    await authenticateClosure(context, fixture.account, baseURL!);
    await page.goto("/player/playthroughs/" + fixture.voyage.id + "/journal");
    const journal = page.locator(".chronicle-journal-shell");
    const paths: Array<Awaited<ReturnType<typeof readStyles>> & { name: string; offsetMs: number; layers: object[]; drawingCount: number }> = [];
    async function sample(name: string, awaitedPhase: string, offsetMs: number) {
      await expect(journal).toHaveAttribute("data-journal-phase", awaitedPhase, { timeout: 15_000 });
      if(offsetMs) await page.evaluate(delay => new Promise(resolve => setTimeout(resolve, delay)), offsetMs);
      const draw = await readStyles(page);
      const reported = [...currentLayers].filter(layer => layer.drawsContent && layer.width > 0 && layer.height > 0)
        .sort((a, b) => b.width*b.height-a.width*a.height).slice(0, 48);
      const layers = await Promise.all(reported.map(async layer => {
        const node = layer.backendNodeId
          ? await target.send("DOM.describeNode", { backendNodeId: layer.backendNodeId }).then(({node}) => node).catch(() => null)
          : null;
        const attrs = node?.attributes ?? [];
        const classIndex = attrs.indexOf("class");
        return {
          layer: layer.layerId, node: node?.nodeName ?? null,
          className: classIndex >= 0 ? attrs[classIndex+1].slice(0,160) : null,
          width: layer.width, height: layer.height, paints: layer.paintCount,
        };
      }));
      expect(draw.phase, "A layer sample must retain the requested phase").toBe(awaitedPhase);
      const paper = draw.surfaces[".opening-sealed-page"][0];
      expect(paper).toBeDefined();
      if(awaitedPhase === "CLOSED_BOOK_REVEAL") {
        expect(paper.visibility).toBe("hidden");
        expect(paper.effectiveOpacity).toBe(0);
        expect(layers.some(layer => layer.className === paper.className)).toBe(false);
      }
      if(awaitedPhase === "SEALED_PAGE_REVEAL") {
        expect(paper.visibility).toBe("visible");
        expect(paper.effectiveOpacity).toBeGreaterThan(0.05);
      }
      paths.push({ name, offsetMs, ...draw, layers, drawingCount: currentLayers.filter(x => x.drawsContent).length });
    }

    await page.getByRole("button", { name: "Open the journal" }).click();
    await sample("cold-reveal", "CLOSED_BOOK_REVEAL", 180);
    await sample("cold-paper-visible", "SEALED_PAGE_REVEAL", 420);
    await sample("cold-settle", "BOOK_SETTLING", 380);
    await expect(journal).toHaveAttribute("data-journal-ready-reason", "completed", { timeout: 15_000 });

    for (let round = 1; round <= 2; round++) {
      await page.getByRole("button", { name: "Replay full opening" }).click();
      await sample("warm-"+round+"-reveal", "CLOSED_BOOK_REVEAL", round===1 ? 120 : 620);
      await sample("warm-"+round+"-settle", "BOOK_SETTLING", round===1 ? 260 : 790);
      await expect(journal).toHaveAttribute("data-journal-ready-reason", "completed", { timeout: 15_000 });
    }
    await sample("ready", "JOURNAL_READY", 0);
    await page.getByRole("button", { name: "Next journal page" }).click({ trial: true });

    const directory = "artifacts/sounding-line/journal-culled-sealed-page";
    await mkdir(directory, { recursive: true });
    await writeFile(directory + "/owners.json", JSON.stringify({
      purpose: "DEVELOPMENT_ONLY",
      sourceSha: process.env.FOREVER_VALIDATION_SOURCE_SHA,
      platform, viewport: { width: 1440, height: 900 }, paths,
    }, null, 2) + "\n");
    console.log("JOURNAL_HIDDEN_SURFACES " + JSON.stringify({
      platform, phases: paths.map(({name,phase,drawingCount,surfaces}) => ({
        name,phase,drawingCount,
        pageStage: surfaces[".open-page-stage"]?.[0],
        pageRuntime: surfaces[".page-flip-runtime"]?.[0],
      })),
    }));
  } finally {
    await target.detach().catch(() => null);
    await browserSession.detach().catch(() => null);
    await page.close();
    await removeCrossdeckRefitFixture(fixture);
  }
});
