import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";

const taskRoot = path.resolve(".runtime/muster");
if (process.env.DATABASE_URL !== `file:${path.join(taskRoot, "muster.sqlite").replaceAll("\\", "/")}`)
  throw new Error("MUSTER_TASK_DATABASE_REQUIRED");
const fixture = JSON.parse(await readFile(path.join(taskRoot, "fixture.json"), "utf8"));
const output = path.join(taskRoot, "delta2");
await mkdir(output, { recursive: true });
const db = new PrismaClient();
const browser = await chromium.launch({ headless: true });
const checks = [],
  errors = [],
  measurements = [];
const contexts = [];
async function pageFor(key = "captain", viewport = { width: 1536, height: 1024 }, reducedMotion = "no-preference") {
  const context = await browser.newContext({ baseURL: fixture.origin, viewport, reducedMotion });
  contexts.push(context);
  await context.addCookies([{ name: "wayfarer_account", value: fixture.profiles[key].token, url: fixture.origin }]);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
const route = (id) => `/captain/voyages/${id}/muster`;
async function visit(page, id) {
  await page.goto(route(id), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".muster-scene[data-viewer-role]")).toBeVisible({ timeout: 60000 });
  // Pause only the intentionally changing ambient luminance for exact artwork pixel comparisons.
  await page.addStyleTag({ content: ".muster-lantern-glow { animation: none !important; opacity: .6 !important; }" });
  await page.locator(".muster-cover img").evaluate((img) => img.decode());
}
async function anchor(page) {
  return page.locator(".muster-environment").evaluate((el) => {
    const r = el.getBoundingClientRect(),
      s = getComputedStyle(el);
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      position: s.position,
      image: s.backgroundImage,
      size: s.backgroundSize,
      crop: s.backgroundPosition,
    };
  });
}
async function pixels(page, isolateArtwork = false) {
  // Responsive panel shadows reach the side strip. Hide only their paint, keeping
  // the real layout/scroll unchanged, to compare the artwork itself in those views.
  const mask = isolateArtwork
    ? await page.addStyleTag({
        content: ".muster-scene > :not(.muster-environment) { visibility: hidden !important; }",
      })
    : null;
  const screenshot = await page.screenshot();
  await mask?.evaluate((el) => el.remove());
  return createHash("sha256")
    .update(await sharp(screenshot).extract({ left: 2, top: 150, width: 8, height: 300 }).raw().toBuffer())
    .digest("hex");
}
async function sample(page, action, label) {
  const sampling = page.evaluate(async () => {
    const frames = [],
      start = performance.now();
    do {
      const panel = document.querySelector(".muster-options-panel"),
        content = document.querySelector(".muster-options-content"),
        indicator = document.querySelector(".muster-options-trigger svg");
      frames.push({
        t: performance.now() - start,
        height: panel.getBoundingClientRect().height,
        content: content.getBoundingClientRect().height,
        indicator: getComputedStyle(indicator).transform,
        overflow: getComputedStyle(panel).overflow,
      });
      await new Promise(requestAnimationFrame);
    } while (performance.now() - start < 480);
    return frames;
  });
  await action();
  const frames = await sampling;
  measurements.push({ label, frames });
  assert.ok(new Set(frames.map((frame) => Math.round(frame.height))).size > 4, `${label}: intermediate heights`);
  if (/^(open|close)-/.test(label))
    assert.ok(new Set(frames.map((frame) => frame.indicator)).size > 4, `${label}: smoothly rotating indicator`);
  assert.ok(
    frames.every((frame) => frame.overflow === "hidden"),
    `${label}: no overflow flash`,
  );
  return frames;
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}

try {
  const page = await pageFor();
  await visit(page, "muster-all-ready");
  await expect(page.locator(".muster-scene")).not.toHaveAttribute("data-motion", "reduced");
  const trigger = page.getByRole("button", { name: "Captain & Voyage options" });
  const originalAnchor = await anchor(page),
    originalPixels = await pixels(page);
  assert.equal(originalAnchor.position, "fixed");
  await page.screenshot({ path: path.join(output, "desktop-closed.png"), fullPage: true });
  for (let round = 0; round < 3; round++) {
    await sample(page, () => trigger.click(), `open-${round}`);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const sizes = await page.locator(".muster-options-panel").evaluate((panel) => ({
      outer: panel.getBoundingClientRect().height,
      inner: panel.firstElementChild.getBoundingClientRect().height,
    }));
    assert.ok(Math.abs(sizes.outer - sizes.inner) <= 1, "Full contents fit the expanded panel");
    assert.deepEqual(await anchor(page), originalAnchor);
    assert.equal(await pixels(page), originalPixels);
    if (!round) await page.screenshot({ path: path.join(output, "desktop-open.png"), fullPage: true });
    await sample(page, () => trigger.click(), `close-${round}`);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    assert.equal(await page.locator(".muster-options-panel").evaluate((el) => el.getBoundingClientRect().height), 0);
    assert.deepEqual(await anchor(page), originalAnchor);
    assert.equal(await pixels(page), originalPixels);
  }
  checks.push(
    "Three open/close cycles: intermediate heights, smooth indicator, no clipping/overflow, exact artwork pixels stable",
  );

  await trigger.focus();
  await trigger.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(320);
  await trigger.press("Tab");
  assert.equal(
    await page.getByRole("button", { name: "Relinquish Captaincy" }).evaluate((el) => el === document.activeElement),
    true,
  );
  await trigger.focus();
  await trigger.press("Space");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".muster-options-panel")).toHaveAttribute("inert", "");
  checks.push("Keyboard Enter/Space, aria-expanded/controls, visible controls focusable and collapsed panel inert");

  await trigger.click();
  await page.waitForTimeout(320);
  await sample(
    page,
    () =>
      page.locator(".muster-option-buttons").evaluate((el) => {
        const note = document.createElement("p");
        note.id = "delta2-height-probe";
        note.textContent = "Temporary browser-only content resize probe. ".repeat(20);
        el.append(note);
      }),
    "content-height-growth",
  );
  assert.deepEqual(await anchor(page), originalAnchor);
  assert.equal(await pixels(page), originalPixels);
  await sample(page, () => page.locator("#delta2-height-probe").evaluate((el) => el.remove()), "content-height-shrink");
  checks.push("ResizeObserver retargets growing/shrinking live contents while artwork stays fixed");

  await page.getByRole("button", { name: "Cancel Voyage for Everyone" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  assert.deepEqual(await anchor(page), originalAnchor);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await pixels(page), originalPixels);
  await page.getByRole("button", { name: "Manage Sera" }).click();
  assert.deepEqual(await anchor(page), originalAnchor);
  await page.getByRole("button", { name: "Manage Sera" }).click();
  await trigger.click();
  await page.waitForTimeout(320);
  checks.push("Dialog scroll locking and crew menus do not recrop or reposition the environment");

  await expect(page.getByRole("link", { name: "Invite Crew", exact: true })).toBeVisible();
  await expect(page.locator(".muster-open-card")).not.toContainText("Waiting");
  await expect(page.locator(".muster-open-card")).toContainText("Send another");
  const first = await (await page.request.get("/api/voyages/muster-all-ready/muster")).json();
  await visit(page, "muster-tidal-observatory");
  const second = await (await page.request.get("/api/voyages/muster-tidal-observatory/muster")).json();
  const canonical = await db.taleSession.findUniqueOrThrow({
    where: { id: "muster-tidal-observatory" },
    include: { tale: true, version: true, captainAccount: { include: { profile: true } } },
  });
  const published = JSON.parse(canonical.version.contentSnapshot).tale;
  assert.notEqual(published.title, canonical.tale.title);
  assert.notEqual(published.coverAssetId, canonical.tale.coverAssetId);
  for (const [key, source] of Object.entries({
    title: "title",
    subtitle: "subtitle",
    description: "shortDescription",
    duration: "estimatedDuration",
  }))
    assert.equal(second.voyage[key], published[source]);
  assert.equal(second.voyage.edition, canonical.version.versionLabel);
  assert.equal(second.voyage.status, canonical.status);
  assert.equal(second.voyage.captainName, canonical.captainAccount.profile.displayName);
  assert.deepEqual(second.readiness, { ready: 1, total: 3, allReady: false });
  assert.equal(second.viewer.canInvite, true);
  const servedCover = await page.request.get(second.voyage.coverUrl);
  const expectedCover = await readFile("public/images/muster/lantern-room.png");
  assert.equal(
    createHash("sha256")
      .update(await servedCover.body())
      .digest("hex"),
    createHash("sha256").update(expectedCover).digest("hex"),
  );
  for (const key of ["title", "subtitle", "description", "duration", "edition"])
    assert.notEqual(first.voyage[key], second.voyage[key]);
  await expect(page.locator(".muster-parchment h2")).toHaveText(published.title);
  await expect(page.locator(".muster-parchment")).toContainText("2 crew members are still preparing.");
  await expect(page.locator(".muster-crew-card[data-invited=true]")).toContainText("Sera");
  await expect(page.locator(".muster-crew-card[data-invited=true]")).toContainText("Invited");
  await page.screenshot({ path: path.join(output, "observatory-invited.png"), fullPage: true });
  await writeFile(
    path.join(output, "parchment-source-proof.json"),
    JSON.stringify(
      {
        first: first.voyage,
        second: second.voyage,
        published,
        draft: {
          title: canonical.tale.title,
          coverAssetId: canonical.tale.coverAssetId,
          estimatedDuration: canonical.tale.estimatedDuration,
        },
        readiness: second.readiness,
      },
      null,
      2,
    ),
  );
  checks.push(
    "Different Chronicle/edition projection and cover bytes match the selected snapshot despite contradictory newer draft data; real invited member card preserved",
  );

  const player = await pageFor("sera");
  await player.goto("/player/playthroughs/muster-all-ready");
  await expect(player.locator(".muster-scene")).toHaveAttribute("data-viewer-role", "player");
  await expect(player.locator(".muster-open-card")).toHaveCount(0);
  await expect(player.getByRole("link", { name: "Invite Crew" })).toHaveCount(0);
  const terminal = await db.taleSession.findFirstOrThrow({
    where: { id: { startsWith: "muster-" }, captainAccountId: fixture.profiles.captain.accountId, status: "CANCELLED" },
  });
  await visit(page, terminal.id);
  await expect(page.locator(".muster-readiness")).toContainText("This Voyage has ended.");
  await expect(page.locator(".muster-open-card")).toHaveCount(0);
  checks.push("Invitation action absent for ordinary Players and terminal Voyages; terminal readiness truthful");

  for (const [label, viewport] of [
    ["tablet", { width: 1024, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const responsive = await pageFor("captain", viewport);
    await visit(responsive, "muster-all-ready");
    const anchored = await anchor(responsive);
    const toggle = responsive.getByRole("button", { name: "Captain & Voyage options" });
    await toggle.scrollIntoViewIfNeeded();
    const stablePixels = await pixels(responsive, true);
    await responsive.screenshot({ path: path.join(output, `${label}-before-viewport.png`) });
    await toggle.click();
    await responsive.waitForTimeout(340);
    assert.deepEqual(await anchor(responsive), anchored);
    await responsive.screenshot({ path: path.join(output, `${label}-after-viewport.png`) });
    assert.equal(await pixels(responsive, true), stablePixels);
    await noOverflow(responsive);
    await responsive.screenshot({ path: path.join(output, `${label}-open.png`), fullPage: true });
    await toggle.click();
    await responsive.waitForTimeout(340);
    assert.deepEqual(await anchor(responsive), anchored);
    assert.equal(await pixels(responsive, true), stablePixels);
    checks.push(`${label}: anchored crop while scrolling/toggling and no horizontal overflow`);
  }

  const reduced = await pageFor("captain", { width: 1536, height: 1024 }, "reduce");
  await visit(reduced, "muster-all-ready");
  await expect(reduced.locator(".muster-scene")).toHaveAttribute("data-motion", "reduced");
  const reducedToggle = reduced.getByRole("button", { name: "Captain & Voyage options" });
  await reducedToggle.click();
  await expect(reduced.getByRole("button", { name: "Relinquish Captaincy" })).toBeVisible();
  assert.equal(
    await reduced.locator(".muster-options-content").evaluate((el) => getComputedStyle(el).transform),
    "none",
  );
  assert.equal(await reduced.locator(".muster-options-panel").evaluate((el) => el.style.height), "auto");
  await reducedToggle.click();
  await expect(reduced.locator(".muster-options-panel")).toHaveAttribute("aria-hidden", "true");
  checks.push("Reduced motion uses immediate intrinsic height, no spatial movement and a short opacity change");
  assert.deepEqual(errors, []);
  checks.push("Zero browser runtime errors");
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await writeFile(
    path.join(output, "focused-proof.json"),
    JSON.stringify({ date: new Date().toISOString(), checks, errors, measurements }, null, 2),
  );
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
  await db.$disconnect();
}
