import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import assert from "node:assert/strict";
const root = ".runtime/embarkation/environment-correction";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1");
await page.waitForFunction(
  () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
  null,
  { timeout: 60000 },
);
await page.getByRole("button", { name: "Collapse", exact: true }).click();
assert.equal(
  await page.evaluate(() => window.__embarkation.snapshot().duration),
  25,
  JSON.stringify(await page.evaluate(() => window.__embarkation.diagnostics())),
);
const times = [
  0, 1.5, 3, 4.5, 5.5, 6.5, 7.2, 8.03, 9.1, 11.1, 12.8, 14.5, 15.5, 16.5, 17.2, 17.8, 18.5, 19.2, 20, 21, 22.5, 23.2,
  24, 25,
];
for (const t of times) {
  await page.evaluate((t) => window.__embarkation.seek(t), t);
  await page.screenshot({ path: `${root}/${t}.png` });
}
await writeFile(
  `${root}/diagnostics.json`,
  JSON.stringify({ errors, diagnostics: await page.evaluate(() => window.__embarkation.diagnostics()) }, null, 2),
);
for (let part = 0; part < 4; part++) {
  const composites = [];
  for (const [i, t] of times.slice(part * 6, part * 6 + 6).entries()) {
    composites.push({
      input: await sharp(`${root}/${t}.png`).resize(512, 341).png().toBuffer(),
      left: (i % 2) * 512,
      top: Math.floor(i / 2) * 369 + 28,
    });
    composites.push({
      input: Buffer.from(
        `<svg width="512" height="28"><text x="10" y="20" fill="white" font-family="Arial" font-size="17">${t}s</text></svg>`,
      ),
      left: (i % 2) * 512,
      top: Math.floor(i / 2) * 369,
    });
  }
  await sharp({ create: { width: 1024, height: 1107, channels: 3, background: "#061f23" } })
    .composite(composites)
    .png()
    .toFile(`${root}/contact-${part}.png`);
}
await browser.close();
console.log(JSON.stringify({ errors }));
