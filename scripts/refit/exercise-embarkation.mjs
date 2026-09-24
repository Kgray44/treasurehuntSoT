import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:3138",
  dir = ".runtime/embarkation/verification";
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=d3d11"] });
const proof = {};
const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } }),
  page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(`${base}/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC`);
await page.waitForFunction(
  () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
  null,
  { timeout: 60000 },
);
const initialPrefs = await (await page.request.get(`${base}/api/passport/preferences`)).json();
const room = await (await page.request.get(`${base}/api/voyages/muster-all-ready/muster`)).json();
try {
  await page.goto(`${base}/account/preferences`);
  await page.getByLabel("Experience quality", { exact: true }).selectOption("CINEMATIC");
  await page.getByLabel("Experience Audio", { exact: true }).selectOption("true");
  await page.getByRole("slider", { name: /Experience Volume/ }).fill("35");
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/api/passport/preferences") && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page.reload();
  assert.equal(await page.getByLabel("Experience quality", { exact: true }).inputValue(), "CINEMATIC");
  assert.equal(await page.getByLabel("Experience Audio", { exact: true }).inputValue(), "true");
  assert.equal(await page.getByRole("slider", { name: /Experience Volume/ }).inputValue(), "35");
  proof.preferences = { persisted: true, quality: "CINEMATIC", audio: true, volume: 35 };
  await page.goto(`${base}/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1`);
  await page.waitForFunction(
    () => window.__embarkation && !document.querySelector(".embarkation-begin button")?.disabled,
    null,
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  await page.getByRole("button", { name: "JOIN THE ADVENTURE", exact: true }).click();
  await page.waitForFunction(
    () => window.__embarkation.diagnostics().audio.clock > 0 && window.__embarkation.snapshot().time > 0,
  );
  proof.audio = [];
  for (const t of [6.3, 9.05, 10.0, 23.15]) {
    await page.evaluate((time) => {
      window.__embarkation.seek(time);
      window.__embarkation.play();
    }, t);
    await page.waitForTimeout(80);
    proof.audio.push(
      await page.evaluate(() => ({
        time: window.__embarkation.snapshot().time,
        ...window.__embarkation.diagnostics().audio,
      })),
    );
  }
  await page.evaluate(() => window.__embarkation.pause());
  await page.waitForTimeout(600);
  assert.ok(await page.evaluate(() => window.__embarkation.diagnostics().audio.gain < 0.001));
  assert.ok(proof.audio.every((a) => a.state === "running" && a.gain > 0));
  assert.ok(proof.audio[0].voices.find((v) => v.kind === "gust").gain > 0.1);
  assert.ok(proof.audio[1].voices.find((v) => v.kind === "pass").gain > 0.4);
  assert.ok(proof.audio[2].voices.find((v) => v.kind === "rope").gain > 0.2);
  assert.ok(proof.audio[3].voices.find((v) => v.kind === "resolve").gain > 0.01);
  // Synthetic local Crew message: tests live canonical reconciliation while the
  // cinematic is paused, without replacing the destination node or its state.
  await page.evaluate(() => window.__embarkation.seek(32.3));
  const originalChat = await page.locator(".muster-chat").elementHandle();
  const sent = await page.request.post(`${base}/api/voyages/muster-all-ready/muster/chat`, {
    headers: { "x-csrf-token": room.csrfToken },
    data: {
      body: "The charts are ready. See you at the horizon.",
      clientMessageId: "67b67c1f-1111-4111-8111-111111111111",
    },
  });
  assert.equal(sent.status(), 200);
  await page.waitForFunction(
    () => document.querySelector(".muster-chat")?.textContent.includes("The charts are ready."),
    null,
    { timeout: 12000 },
  );
  assert.equal(await originalChat.evaluate((n) => n.isConnected && n === document.querySelector(".muster-chat")), true);
  assert.equal(await page.evaluate(() => window.__embarkation.snapshot().time), 32.3);
  proof.liveChat = { sameNode: true, pausedClockPreserved: true };
  // Ordinary navigation captures the actual platform before Next commits.
  await page.goto(`${base}/captain/library`);
  const link = page.locator('a[href^="/captain/voyages/"][href$="/muster"]').first();
  await link.waitFor({ timeout: 60000 });
  await link.scrollIntoViewIfNeeded();
  const destination = await link.getAttribute("href");
  await link.click();
  await page.waitForSelector(".embarkation-retained-source", { state: "attached", timeout: 60000 });
  await page.waitForFunction(() => window.__embarkation?.snapshot().time > 0, null, { timeout: 60000 });
  await page.evaluate(() => window.__embarkation.pause());
  proof.source = {
    destination,
    fragments: await page.locator(".embarkation-retained-source > [data-departure]").count(),
    genericHidden: await page.locator(".embarkation-source").evaluate((n) => getComputedStyle(n).display === "none"),
  };
  assert.ok(proof.source.fragments >= 2);
  assert.equal(proof.source.genericHidden, true);
  await page.screenshot({ path: `${dir}/ordinary-platform-source.png` });
  await page.goBack();
  await page.locator(".embarkation-retained-source").waitFor({ state: "detached", timeout: 5000 });
  assert.equal(await page.locator(".embarkation-retained-source").count(), 0);
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  proof.back = { cleaned: true };
  assert.deepEqual(errors, []);
  proof.status = "passed";
} catch (error) {
  proof.status = "failed";
  proof.error = error.stack;
  proof.errors = errors;
  await page.screenshot({ path: `${dir}/exercise-failure.png` });
  process.exitCode = 1;
} finally {
  const restored = await page.request.put(`${base}/api/passport/preferences`, {
    headers: { "x-csrf-token": room.csrfToken },
    data: { preferences: initialPrefs.preferences },
  });
  proof.preferencesRestored = restored.status() === 200;
  await writeFile(`${dir}/exercise.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
  await browser.close();
}
