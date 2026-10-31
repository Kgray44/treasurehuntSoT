import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Record uninterrupted playback. Exact frame inspection is a separate scrubber
// pass; screenshot readbacks must not lengthen or mislabel the moving film.
const root = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/screening";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
try {
  for (const speed of process.env.EMBARKATION_SPEED ? [Number(process.env.EMBARKATION_SPEED)] : [1, 0.5, 0.25]) {
    const name = speed === 1 ? "normal" : speed === 0.5 ? "half" : "slow";
    const context = await browser.newContext({
      viewport: { width: 1536, height: 1024 },
      deviceScaleFactor: 1,
      recordVideo: { dir: root, size: { width: 1536, height: 1024 } },
    });
    const page = await context.newPage(),
      errors = [];
    await page.addInitScript(() => {
      window.__embarkationClockProof = [];
      let last = -1;
      const sample = (now) => {
        const state = window.__embarkation?.snapshot();
        if (state && state.time > 0 && now - last >= 100) {
          window.__embarkationClockProof.push({
            wallMs: now,
            time: state.time,
            filmTime: state.filmTime,
            hidden: document.hidden,
          });
          last = now;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1",
    );
    await page.waitForFunction(
      () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
      null,
      { timeout: 60000 },
    );
    assert.equal(await page.evaluate(() => window.__embarkation.snapshot().duration), 35.8);
    await page.getByRole("button", { name: "Collapse", exact: true }).click();
    await page.evaluate((rate) => window.__embarkation.speed(rate), speed);
    const began = Date.now();
    await page.getByRole("button", { name: "JOIN THE ADVENTURE", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="embarkation-film"]'), null, {
      timeout: 35800 / speed + 25000,
    });
    const filmElapsedMs = Date.now() - began;
    assert.equal(await page.evaluate(() => window.__embarkationLast.reason), "completed");
    await page.waitForFunction(() => window.__musterLiving?.rendering);
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${root}/${name}-ambient.png` });
    const living = await page.evaluate(() => ({
      time: window.__musterLiving.time,
      camera: window.__musterLiving.camera,
    }));
    assert.deepEqual(errors, []);
    const performance = await page.evaluate(() => window.__embarkationLast);
    const clockSamples = await page.evaluate(() => window.__embarkationClockProof);
    await context.close();
    await page.video().saveAs(`${root}/${name}.webm`);
    await writeFile(
      `${root}/${name}-playback.json`,
      JSON.stringify(
        { speed, authoredDuration: 35.8, filmElapsedMs, clockSamples, ambientSeconds: 8, living, errors, performance },
        null,
        2,
      ),
    );
    console.log(`${name}: uninterrupted full film plus eight seconds of living Muster recorded`);
  }
} finally {
  await browser.close();
}
