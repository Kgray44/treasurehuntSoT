import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const root = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/environment-correction";
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
assert.equal(await page.evaluate(() => window.__embarkation.snapshot().duration), 35.8);
await page.getByRole("button", { name: "Collapse", exact: true }).click();
await page.evaluate(() => {
  window.__embarkation.seek(29.3);
  window.__embarkation.debug(true);
});
await page.screenshot({ path: root + "/camera-depth-inspector.png" });
await page.evaluate(() => {
  window.__embarkation.debug(false);
  window.__embarkation.layer("environment");
  window.__embarkation.freezeLiving(true);
});
await page.addStyleTag({
  content:
    ".muster-scene > :not(.muster-environment), .muster-scene > :not(.muster-environment) *, .embarkation-welcome, .embarkation-inspector, .embarkation-hold, .embarkation-replay, .product-shell-header {visibility:hidden!important}",
});
const capture = async (name) => {
  const path = root + "/" + name + ".png";
  await page.screenshot({ path });
  return path;
};
const diff = async (a, b, box = { left: 0, top: 90, width: 1536, height: 934 }) => {
  const images = await Promise.all([a, b].map((p) => sharp(p).extract(box).removeAlpha().raw().toBuffer()));
  let sum = 0,
    over20 = 0,
    over2 = 0,
    max = 0;
  for (let i = 0; i < images[0].length; i++) {
    const d = Math.abs(images[0][i] - images[1][i]);
    sum += d;
    if (d > 20) over20++;
    if (d > 2) over2++;
    max = Math.max(max, d);
  }
  return { mean: sum / images[0].length, over20: over20 / images[0].length, over2: over2 / images[0].length, max };
};
await page.evaluate(() => window.__embarkation.seek(30.999));
const threshold = await capture("threshold-final-projection");
await page.evaluate(() => window.__embarkation.seek(31));
const calibrated = await capture("room-calibrated");
await page.evaluate(() => window.__embarkation.seek(34.7));
assert.equal(await page.locator(".embarkation-welcome").evaluate((n) => Number(getComputedStyle(n).opacity)), 0);
const style = await page.addStyleTag({
  content: ".embarkation-world{visibility:hidden!important}.muster-environment{visibility:visible!important}",
});
const canonical = await capture("room-canonical-css");
await style.evaluate((n) => n.remove());
await page.evaluate(() => {
  window.__embarkation.freezeLiving(false);
  window.__embarkation.seek(35.8);
});
const pre = await capture("room-before-handoff");
await page.evaluate(() => {
  window.__embarkation.seek(35.799);
  window.__embarkation.play();
});
await page.waitForFunction(() => window.__musterLiving?.rendering && !window.__embarkation);
await page.evaluate(() => window.__musterLiving.seek(35.8));
await page.waitForFunction(() => window.__musterLiving.time === 35.8);
const post = await capture("room-after-handoff");
await page.evaluate(() => window.__musterLiving.seek(44.713));
await page.waitForFunction(() => window.__musterLiving.time === 44.713);
const later = await capture("room-living-34");
const state = await page.evaluate(() => ({
  time: window.__musterLiving.time,
  camera: window.__musterLiving.camera,
  rect: document.querySelector(".muster-environment").getBoundingClientRect().toJSON(),
}));
const scale = Math.max(state.rect.width / 1536, state.rect.height / 1024);
const box = (x, y, w, h) => ({
  left: Math.round(state.rect.x + (state.rect.width - 1536 * scale) / 2 + x * scale),
  top: Math.round(state.rect.y + (state.rect.height - 1024 * scale) / 2 + y * scale),
  width: Math.round(w * scale),
  height: Math.round(h * scale),
});
const proof = {
  thresholdConvergence: await diff(threshold, calibrated),
  canonicalRoom: await diff(calibrated, canonical),
  livingHandoff: await diff(pre, post),
  livingChange: await diff(post, later),
  fixedCushion: await diff(post, later, box(520, 580, 150, 65)),
  fixedSign: await diff(post, later, box(60, 245, 80, 70)),
  water: await diff(post, later, box(900, 328, 270, 60)),
  candle: await diff(post, later, box(1009, 612, 40, 66)),
  state,
  errors,
};
await writeFile(root + "/handoff-proof.json", JSON.stringify(proof, null, 2));
await browser.close();
console.log(JSON.stringify(proof));
assert.deepEqual(errors, []);
assert.ok(proof.thresholdConvergence.mean < 2, "Spatial projection must meet the calibrated original");
assert.ok(proof.canonicalRoom.mean < 2, "Final room must match owner-approved CSS composition");
assert.ok(proof.livingHandoff.mean < 0.5, "Continuous material clock must not restart");
assert.equal(proof.fixedCushion.max, 0, "Furniture must be completely stationary");
assert.equal(proof.fixedSign.max, 0, "Architecture must be completely stationary");
assert.ok(proof.water.mean > 0.03, "Existing water/reflections must remain alive");
assert.ok(proof.candle.mean > 0.1, "Wick-pinned flame must deform");
assert.deepEqual(state.camera, [0, 0, 0]);
