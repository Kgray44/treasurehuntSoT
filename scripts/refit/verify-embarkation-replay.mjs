import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const output = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/verification";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const results = [];
try {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const ready = () =>
      page.waitForFunction(
        () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
        null,
        { timeout: 60000 },
      );
    const finish = async () => {
      await page.evaluate(() => {
        window.__embarkation.seek(35.799);
        window.__embarkation.play();
      });
      await page.waitForFunction(() => !window.__embarkation && window.__musterLiving?.rendering);
    };
    await page.goto("http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC");
    await ready();
    await finish();
    await page.getByRole("button", { name: "Replay Arrival", exact: true }).scrollIntoViewIfNeeded();
    const scrolledFrom = await page.evaluate(() => scrollY);
    assert.ok(scrolledFrom > 0, "Exercise Replay from below the initial room framing");
    await page.getByRole("button", { name: "Replay Arrival", exact: true }).click();
    await ready();
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.equal(await page.evaluate(() => window.__embarkation.snapshot().duration), 35.8);
    await page.evaluate(() => window.__embarkation.seek(34.7));
    const before = await page.locator("#muster-title").boundingBox();
    assert.ok(before.y >= 0 && before.y < viewport.height, "Muster title must land within the frame");
    await finish();
    const after = await page.locator("#muster-title").boundingBox();
    assert.deepEqual(after, before);
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${output}/replay-${viewport.width}.png` });
    results.push({ status: "passed", viewport, scrolledFrom, finalScroll: 0, titleHandoffDelta: 0, errors });
    await page.close();
  }
  await writeFile(`${output}/replay-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
