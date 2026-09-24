import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/delta2/threshold-motion";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
try {
  for (const rate of [1, 0.5, 0.25]) {
    const context = await browser.newContext({
      viewport: { width: 1536, height: 1024 },
      recordVideo: { dir: root, size: { width: 1536, height: 1024 } },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1",
    );
    await page.waitForFunction(
      () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
      null,
      { timeout: 60000 },
    );
    await page.getByRole("button", { name: "Collapse", exact: true }).click();
    await page.evaluate((rate) => {
      window.__embarkation.seek(21.5);
      window.__embarkation.speed(rate);
      window.__embarkation.play();
    }, rate);
    const start = Date.now();
    await page.waitForFunction(() => window.__embarkation.snapshot().time >= 31.1, null, { timeout: 60000 });
    const elapsed = Date.now() - start;
    await page.evaluate(() => window.__embarkation.pause());
    assert.deepEqual(errors, []);
    await context.close();
    await page.video().saveAs(`${root}/${rate}x.webm`);
    await writeFile(`${root}/${rate}x.json`, JSON.stringify({ rate, from: 21.5, to: 31.1, elapsed, errors }, null, 2));
    console.log(`${rate}x fog and threshold continuous playback recorded`);
  }
} finally {
  await browser.close();
}
