import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:3138";
const output = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/verification";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const results = [];
async function scenario(name, query, exercise, viewport = { width: 1536, height: 1024 }) {
  if (
    process.env.EMBARKATION_SCENARIO &&
    !process.env.EMBARKATION_SCENARIO.split(",").some((part) => name.includes(part))
  )
    return;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/dev/embarkation/enter?${query}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !!window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
      null,
      { timeout: 60000 },
    );
    const proof = await exercise(page);
    assert.deepEqual(errors, [], "No uncaught browser errors");
    results.push({ name, status: "passed", ...proof, errors });
    console.log(`${name}: passed`);
  } catch (error) {
    results.push({ name, status: "failed", error: error.stack, errors });
    await page.screenshot({ path: `${output}/${name}-failure.png` });
    console.log(`${name}: FAILED: ${error.message}`);
  } finally {
    await context.close();
    await writeFile(
      `${output}/${process.env.EMBARKATION_SCENARIO ? "targeted-results" : "results"}.json`,
      JSON.stringify(results, null, 2),
    );
  }
}
const first = "role=captain&arrival=first&quality=CINEMATIC";
async function resourcesAtReady(page) {
  return page.evaluate(() => {
    const r = window.__embarkation.diagnostics().renderer;
    return { textureBytes: r?.textureBytes, assetBytes: r?.assetBytes, gpu: r?.gpu };
  });
}
async function begin(page) {
  await page.getByRole("button", { name: "JOIN THE ADVENTURE", exact: true }).click();
}
async function arrived(page) {
  await page.waitForFunction(
    () => !!window.__embarkationLast && !document.querySelector('[data-testid="embarkation-film"]'),
    null,
    { timeout: 50000 },
  );
  const final = await page.evaluate(() => ({
    diagnostics: window.__embarkationLast,
    inert: document.querySelector(".muster-scene").inert,
    focus: document.activeElement?.id,
    overflow: document.body.style.overflow,
    targets: [
      ...document.querySelectorAll(
        ".muster-title-group,.muster-parchment,.muster-crew-card,.muster-chat,.muster-quote",
      ),
    ].map((n) => ({ name: n.className, inlineTransform: n.style.transform, rect: n.getBoundingClientRect().toJSON() })),
  }));
  assert.equal(final.inert, false);
  assert.equal(final.focus, "muster-title");
  assert.ok(
    final.targets.every((t) => !t.inlineTransform),
    "No residual cinematic transforms",
  );
  assert.equal(final.diagnostics.receipt.handoffCompleted, true);
  assert.equal(final.diagnostics.receipt.finalStateCommitted, true);
  return final;
}
await scenario("cinematic-full", first, async (page) => {
  const prepared = await resourcesAtReady(page);
  assert.equal(await page.locator(".muster-scene").evaluate((n) => n.inert), true);
  const persisted = page.waitForResponse(
    (r) => r.url().endsWith("/muster/arrival") && r.request().method() === "POST",
    { timeout: 60000 },
  );
  await begin(page);
  const final = await arrived(page);
  final.resourcesAtReady = prepared;
  await writeFile(
    `${output}/cinematic-performance.json`,
    JSON.stringify({ ...final.diagnostics, resourcesAtReady: prepared }, null, 2),
  );
  assert.equal(final.diagnostics.duration, 35.8);
  assert.equal(final.diagnostics.reason, "completed");
  await page.screenshot({ path: `${output}/final-captain.png` });
  assert.equal((await persisted).status(), 200);
  const api = await page.request.get(`${base}/api/voyages/muster-all-ready/muster`);
  const data = await api.json();
  assert.equal(data.arrival.seen, true);
  return final;
});
await scenario("short-return-and-replay", "role=captain&arrival=return&quality=CINEMATIC", async (page) => {
  const before = await page.evaluate(() => window.__embarkation.snapshot());
  assert.equal(before.duration, 2);
  const final = await arrived(page);
  await page.getByRole("button", { name: "Replay Arrival", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__embarkation?.snapshot().duration === 35.8 &&
      !document.querySelector(".embarkation-begin button")?.disabled,
  );
  assert.equal(await page.evaluate(() => window.__embarkation.snapshot().time), 0);
  return {
    returnReceipt: final.diagnostics.receipt,
    replay: await page.evaluate(() => window.__embarkation.snapshot()),
  };
});
await scenario("skip-hold-cancel", first, async (page) => {
  await begin(page);
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("Space");
  assert.equal(await page.locator('[data-testid="embarkation-film"]').count(), 1);
  const t = Date.now();
  await page.keyboard.down("Space");
  const final = await arrived(page);
  await page.keyboard.up("Space");
  assert.ok(Date.now() - t >= 2900);
  assert.equal(final.diagnostics.reason, "skipped");
  return { elapsedHoldMs: Date.now() - t, receipt: final.diagnostics.receipt };
});
await scenario("reduced-motion", "role=player&arrival=first&motion=reduced", async (page) => {
  assert.equal(await page.evaluate(() => window.__embarkation.snapshot().duration), 1.8);
  await begin(page);
  return await arrived(page);
});
await scenario("renderer-unavailable", `${first}&failure=renderer`, async (page) => {
  await begin(page);
  const final = await arrived(page);
  assert.equal(final.diagnostics.reason, "fallback");
  return final;
});
await scenario("context-loss", first, async (page) => {
  await begin(page);
  await page.evaluate(() => {
    const gl = [...document.querySelectorAll("canvas")].map((c) => c.getContext("webgl2")).find(Boolean);
    gl.getExtension("WEBGL_lose_context").loseContext();
  });
  const final = await arrived(page);
  assert.equal(final.diagnostics.reason, "fallback");
  return final;
});
await scenario("optional-material-absent", `${first}&missing=optional`, async (page) => {
  const diagnostic = await page.evaluate(() => window.__embarkation.diagnostics());
  await page.evaluate(() => {
    window.__embarkation.seek(7.2);
  });
  await page.screenshot({ path: `${output}/optional-absent.png` });
  assert.equal(await page.evaluate(() => window.__embarkation.snapshot().reduced), false);
  return diagnostic;
});
await scenario(
  "guest-mobile",
  "role=guest&arrival=first&quality=CINEMATIC",
  async (page) => {
    await page.screenshot({ path: `${output}/mobile-stage.png` });
    await page.evaluate(() => window.__embarkation.seek(12));
    for(const navigation of await page.locator(".shell-contextual-navigation").all()){
      assert.equal(await navigation.evaluate(n=>n.inert),true);
      assert.equal(await navigation.evaluate(n=>getComputedStyle(n).visibility),"hidden");
    }
    await page.evaluate(() => window.__embarkation.seek(33.75));
    assert.equal(await page.locator(".embarkation-welcome h2").textContent(), "WELCOME ABOARD");
    assert.equal(
      await page.locator(".embarkation-welcome [data-captain]").evaluate((n) => getComputedStyle(n).display),
      "none",
    );
    await page.screenshot({ path: `${output}/mobile-welcome.png` });
    await page.evaluate(() => {
      window.__embarkation.seek(35.6);
      window.__embarkation.play();
    });
    return await arrived(page);
  },
  { width: 390, height: 844 },
);
await scenario("landing-convergence", first, async (page) => {
  const boxes = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".muster-title-group,.muster-parchment,.muster-crew-card,.muster-chat,.muster-quote",
        ),
      ].map((n) => n.getBoundingClientRect().toJSON()),
    );
  await page.evaluate(() => window.__embarkation.seek(34.7));
  const prior = await boxes();
  await page.evaluate(() => {
    window.__embarkation.seek(35.75);
    window.__embarkation.play();
  });
  await arrived(page);
  const after = await boxes();
  const maximumDelta = Math.max(
    ...prior.flatMap((r, i) => ["x", "y", "width", "height"].map((k) => Math.abs(r[k] - after[i][k]))),
  );
  assert.ok(maximumDelta <= 0.5, `Landing moved ${maximumDelta}px at handoff`);
  return { maximumDelta, prior, after };
});
for (const tier of ["BALANCED", "PERFORMANCE"])
  await scenario(`tier-${tier}`, `role=captain&arrival=first&quality=${tier}`, async (page) => {
    const prepared = await resourcesAtReady(page);
    await begin(page);
    const final = await arrived(page);
    final.resourcesAtReady = prepared;
    assert.equal(final.diagnostics.duration, 35.8);
    assert.equal(final.diagnostics.tier, tier);
    return final;
  });
await browser.close();
if (results.some((r) => r.status !== "passed")) process.exitCode = 1;
