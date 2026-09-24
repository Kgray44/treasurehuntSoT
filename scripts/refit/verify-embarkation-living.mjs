import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const output = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/verification";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const results = [];
try {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      window.__testContexts = [];
      HTMLCanvasElement.prototype.getContext = function (...args) {
        const gl = original.apply(this, args);
        if (args[0] === "webgl2" && gl && !window.__testContexts.includes(gl)) window.__testContexts.push(gl);
        return gl;
      };
    });
    await page.goto(
      `http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC${reduced ? "&motion=reduced" : ""}`,
    );
    await page.waitForFunction(
      () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
      null,
      { timeout: 60000 },
    );
    if (reduced) await page.getByRole("button", { name: "JOIN THE ADVENTURE", exact: true }).click();
    else
      await page.evaluate(() => {
        window.__embarkation.seek(35.79);
        window.__embarkation.play();
      });
    await page.waitForFunction(() => window.__musterLiving?.rendering && !window.__embarkation, null, {
      timeout: 30000,
    });
    assert.equal(await page.evaluate(() => window.__musterLiving.reduced), reduced);
    const before = await page.evaluate(() => ({
      time: window.__musterLiving.time,
      camera: window.__musterLiving.camera,
      diagnostics: window.__musterLiving.diagnostics(),
    }));
    await page.waitForTimeout(350);
    assert.ok(await page.evaluate((t) => window.__musterLiving.time > t, before.time));
    assert.deepEqual(before.camera, [0, 0, 0]);
    for (const tier of ["BALANCED", "PERFORMANCE", "CINEMATIC"]) {
      await page.evaluate((tier) => {
        document.documentElement.dataset.experienceQuality = tier;
        window.dispatchEvent(new CustomEvent("voyagewright-preferences-changed"));
      }, tier);
      await page.waitForFunction((tier) => window.__musterLiving.tier === tier, tier);
    }
    // A suspended tab must resume from its existing phase, not absorb the
    // hidden wall-clock interval into a flame/suspension jump.
    const hiddenAt = await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      return window.__musterLiving.time;
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const resumed = await page.evaluate(() => window.__musterLiving.time);
    assert.ok(resumed - hiddenAt < 0.15);
    await page.evaluate(() =>
      window.__testContexts
        .findLast((gl) => !gl.isContextLost())
        .getExtension("WEBGL_lose_context")
        .loseContext(),
    );
    await page.waitForFunction(() => !window.__musterLiving.rendering);
    assert.equal(await page.locator(".muster-scene").evaluate((n) => n.inert), false);
    assert.equal(await page.locator(".embarkation-world").evaluate((n) => getComputedStyle(n).visibility), "hidden");
    await page.getByRole("button", { name: "Replay Arrival", exact: true }).click();
    await page.waitForFunction(
      () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
    );
    assert.equal(await page.evaluate(() => Boolean(window.__musterLiving)), false);
    await page.goto("http://127.0.0.1:3138/dev/embarkation");
    assert.equal(await page.evaluate(() => Boolean(window.__musterLiving || window.__embarkation)), false);
    assert.deepEqual(errors, []);
    results.push({
      reduced,
      status: "passed",
      continuousClock: true,
      stationaryCamera: true,
      liveQualityChanges: true,
      hiddenClockDelta: resumed - hiddenAt,
      ambientContextLossRestoresCSS: true,
      replayAndNavigationDispose: true,
      initialTextureBytes: before.diagnostics.textureBytes,
    });
    await context.close();
  }
  const pendingContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const pendingPage = await pendingContext.newPage(),
    pendingErrors = [];
  pendingPage.on("pageerror", (e) => pendingErrors.push(e.message));
  let releaseAssets;
  const assetsHeld = new Promise((resolve) => {
    releaseAssets = resolve;
  });
  await pendingPage.route("**/images/embarkation/**", async (route) => {
    await assetsHeld;
    await route.abort().catch(() => {});
  });
  await pendingPage.goto("http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC");
  await pendingPage.waitForFunction(() => window.__embarkation);
  assert.equal(await pendingPage.getByRole("button", { name: "JOIN THE ADVENTURE", exact: true }).isDisabled(), true);
  const heldAt = Date.now();
  await pendingPage.keyboard.down("Space");
  await pendingPage.waitForFunction(
    () => window.__embarkationLast?.reason === "skipped" && !window.__embarkation,
    null,
    { timeout: 10000 },
  );
  await pendingPage.keyboard.up("Space");
  assert.ok(Date.now() - heldAt >= 2900);
  assert.equal(await pendingPage.locator(".muster-scene").evaluate((n) => n.inert), false);
  releaseAssets();
  await pendingPage.goto("http://127.0.0.1:3138/dev/embarkation");
  assert.deepEqual(pendingErrors, []);
  results.push({ status: "passed", preparationHoldSkip: true, incompleteCompositorDisposed: true });
  await pendingContext.close();
  await writeFile(`${output}/living-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
