import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const proof = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [1536, 1024],
    [820, 1180],
    [390, 844],
    [2560, 1080],
  ]) {
    if (process.env.EMBARKATION_VIEWPORT && process.env.EMBARKATION_VIEWPORT !== `${width}x${height}`) continue;
    const dir = `.runtime/embarkation/threshold/${width}x${height}`;
    await mkdir(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1",
    );
    await page
      .waitForFunction(
        () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
        null,
        { timeout: 60000 },
      )
      .catch(async (error) => {
        console.log(
          JSON.stringify(
            await page.evaluate(() => ({
              last: window.__embarkationLast,
              current: window.__embarkation?.diagnostics(),
              body: document.body.innerText.slice(0, 3500),
            })),
          ),
        );
        await page.screenshot({ path: `${dir}/load-failure.png` });
        throw error;
      });
    assert.equal(await page.evaluate(() => window.__embarkation.snapshot().duration), 25);
    await page.getByRole("button", { name: "Collapse", exact: true }).click();
    const times = [14, 15.5, 16.3, 17.2, 18.4, 19.5, 20, 24],
      composites = [];
    const tileWidth = width < 600 ? 240 : 480,
      tileHeight = Math.round((height / width) * tileWidth);
    for (const [i, t] of times.entries()) {
      await page.evaluate((t) => window.__embarkation.seek(t), t);
      const path = `${dir}/${t}.png`;
      await page.screenshot({ path });
      composites.push({
        input: await sharp(path).resize(tileWidth, tileHeight).toBuffer(),
        left: (i % 2) * tileWidth,
        top: Math.floor(i / 2) * (tileHeight + 24) + 24,
      });
      composites.push({
        input: Buffer.from(
          `<svg width="${tileWidth}" height="24"><text x="8" y="18" fill="white" font-family="Arial" font-size="15">${width} x ${height} / ${t} s</text></svg>`,
        ),
        left: (i % 2) * tileWidth,
        top: Math.floor(i / 2) * (tileHeight + 24),
      });
    }
    await sharp({ create: { width: tileWidth * 2, height: (tileHeight + 24) * 4, channels: 3, background: "#0b2028" } })
      .composite(composites)
      .png()
      .toFile(`${dir}/contact.png`);
    assert.deepEqual(errors, []);
    proof.push({ width, height, times, errors });
    await page.close();
    console.log(`${width}x${height}: threshold and final composition captured`);
  }
  await writeFile(
    `.runtime/embarkation/threshold/${process.env.EMBARKATION_VIEWPORT ? "targeted-results" : "results"}.json`,
    JSON.stringify(proof, null, 2),
  );
} finally {
  await browser.close();
}
