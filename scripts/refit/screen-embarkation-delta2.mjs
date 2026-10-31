import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import assert from "node:assert/strict";
const root = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/delta2/screening";
const [width, height] = (process.env.EMBARKATION_VIEWPORT ?? "1536,1024").split(",").map(Number);
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:3138/dev/embarkation/enter?role=${process.env.EMBARKATION_ROLE ?? "captain"}&arrival=first&quality=CINEMATIC&inspector=1`,
  );
  await page.waitForFunction(
    () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
    null,
    { timeout: 60000 },
  );
  assert.equal(await page.evaluate(() => window.__embarkation.snapshot().duration), 35.8);
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  const times = process.env.EMBARKATION_TIMES?.split(",").map(Number) ?? [
    0, 0.45, 1.5, 3, 4.5, 5.5, 6.5, 7.2, 8.5, 10, 11.45, 12.15, 14, 15, 16, 18, 19, 21.5, 22.5, 23.5, 24.25, 25, 26, 27,
    28, 28.6, 29.3, 30, 30.6, 31, 31.6, 32.3, 33, 33.6, 34.2, 34.7, 35.8,
  ];
  for (const t of times) {
    await page.evaluate((t) => window.__embarkation.seek(t), t);
    await page.screenshot({ path: `${root}/${t}.png` });
  }
  for (let i = 0; i < times.length; i += 6) {
    const composites = [];
    for (const [j, t] of times.slice(i, i + 6).entries()) {
      composites.push({
        input: await sharp(`${root}/${t}.png`).resize(512, 341).toBuffer(),
        left: (j % 2) * 512,
        top: Math.floor(j / 2) * 365 + 24,
      });
      composites.push({
        input: Buffer.from(
          `<svg width="512" height="24"><text x="12" y="18" fill="white" font-family="Arial">${t}s</text></svg>`,
        ),
        left: (j % 2) * 512,
        top: Math.floor(j / 2) * 365,
      });
    }
    await sharp({ create: { width: 1024, height: 1095, channels: 3, background: "#082129" } })
      .composite(composites)
      .png()
      .toFile(`${root}/contact-${i / 6}.png`);
  }
  await writeFile(
    `${root}/diagnostics.json`,
    JSON.stringify({ errors, diagnostics: await page.evaluate(() => window.__embarkation.diagnostics()) }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(`Screened ${times.length} director timecodes without browser errors.`);
} finally {
  await browser.close();
}
