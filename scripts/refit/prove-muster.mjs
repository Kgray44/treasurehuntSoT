import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
const taskRoot = path.resolve(".runtime/muster");
if (process.env.DATABASE_URL !== "file:" + path.join(taskRoot, "muster.sqlite").replaceAll("\\", "/"))
  throw new Error("MUSTER_TASK_DATABASE_REQUIRED");
const fixture = JSON.parse(await readFile(path.join(taskRoot, "fixture.json"), "utf8"));
const output = path.join(taskRoot, "proof");
await mkdir(output, { recursive: true });
const db = new PrismaClient();
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [],
  contexts = {};
const cookie = (key) => [{ name: "wayfarer_account", value: fixture.profiles[key].token, url: fixture.origin }];
async function context(key, options = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
    baseURL: fixture.origin,
    ...options,
  });
  await ctx.addCookies(cookie(key));
  return ctx;
}
async function pageFor(key, route) {
  const ctx = (contexts[key] ??= await context(key));
  const page = await ctx.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 120000 });
  await expect(page.locator(".muster-scene[data-viewer-role]")).toBeVisible({ timeout: 60000 });
  return page;
}
async function get(key, id) {
  return (await contexts[key].request.get(`/api/voyages/${id}/muster`)).json();
}
async function send(key, id, body, extra = {}) {
  return contexts[key].request.post(`/api/voyages/${id}/muster/chat`, {
    data: { body, clientMessageId: randomUUID(), ...extra },
    headers: { "x-csrf-token": fixture.profiles[key].csrfToken },
  });
}
async function copyVoyage(key, members = ["captain", "sera"]) {
  const original = await db.taleSession.findUniqueOrThrow({ where: { id: "muster-all-ready" } });
  const id = `muster-proof-${key}-${randomUUID().slice(0, 8)}`;
  await db.taleSession.create({
    data: {
      id,
      taleId: original.taleId,
      publishedVersionId: original.publishedVersionId,
      captainAccountId: fixture.profiles.captain.accountId,
      voyageName: "Muster focused proof",
      status: "READY",
      accessTokenHash: createHash("sha256").update(id).digest("hex"),
      memberships: {
        create: members.map((m) => ({
          playerProfileId: fixture.profiles[m].profileId,
          status: "READY",
          joinedAt: new Date(),
        })),
      },
    },
  });
  return id;
}
async function noOverflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label);
  const overlaps = await page.evaluate(() => {
    const selectors = [".muster-gathering", ".muster-parchment", ".muster-chat", ".muster-quote"];
    const rects = selectors.map((s) => ({ s, r: document.querySelector(s).getBoundingClientRect() }));
    return rects.flatMap((a, i) =>
      rects
        .slice(i + 1)
        .filter(
          (b) =>
            Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 2 &&
            Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 2,
        )
        .map((b) => a.s + " / " + b.s),
    );
  });
  assert.deepEqual(overlaps, [], label + " overlapping panels");
  checks.push(label);
}
try {
  for (const key of ["captain", "sera", "northwind", "tidewalker", "outsider"]) contexts[key] = await context(key);
  const captain = await pageFor("captain", "/captain/voyages/muster-all-ready/muster");
  await expect(captain.locator(".muster-scene")).toHaveAttribute("data-viewer-role", "captain-player");
  await expect(captain.getByText("All set. Begin the Voyage when you're ready.", { exact: true })).toBeVisible();
  assert.deepEqual((await get("captain", "muster-all-ready")).readiness, { ready: 4, total: 4, allReady: true });
  await noOverflow(captain, "desktop 1536x1024");
  const player = await pageFor("sera", "/player/playthroughs/muster-all-ready");
  await expect(player.locator(".muster-scene")).toHaveAttribute("data-viewer-role", "player");
  await expect(player.getByText("All set. Waiting for the Captain to begin.", { exact: true })).toBeVisible();
  assert.equal(await player.getByRole("button", { name: "Relinquish Captaincy", exact: true }).count(), 0);
  assert.equal(await player.getByRole("button", { name: "Cancel Voyage for Everyone", exact: true }).count(), 0);
  assert.equal(await player.getByRole("button", { name: "Begin the Voyage", exact: true }).count(), 0);
  checks.push("Player-only authority and copy; Captain+Player counts 4/4");
  const only = await pageFor("captain", "/captain/voyages/muster-captain-only/muster");
  assert.deepEqual((await get("captain", "muster-captain-only")).readiness, { ready: 3, total: 3, allReady: true });
  assert.equal(await only.locator(".muster-crew-card").count(), 4);
  await expect(only.locator(".muster-scene")).toHaveAttribute("data-viewer-role", "captain-only");
  assert.equal(
    (await send("captain", "muster-captain-only", "Captain here. The Crew can gather in this room.")).status(),
    200,
  );
  await only.screenshot({ path: output + "/captain-only.png", fullPage: true });
  await only.close();
  const empty = await get("captain", "muster-captain-empty");
  assert.equal(empty.viewer.canLaunch, true);
  assert.equal(empty.readiness.total, 0);
  checks.push("Captain-only chat and 3 Players / 4 cards; empty Captain-only launch gate");
  const preparing = await pageFor("captain", "/captain/voyages/muster-preparing/muster");
  await expect(preparing.getByText("2 crew members are still preparing.")).toBeVisible();
  assert.equal((await get("captain", "muster-preparing")).viewer.canLaunch, true);
  await preparing.screenshot({ path: output + "/not-all-ready.png", fullPage: true });
  await preparing.close();
  checks.push("Not-all-ready 2/4 with preserved canonical launch rule");
  const specific = await contexts.captain.request.get("/api/voyages/muster-all-ready/muster/cover");
  assert.equal(specific.status(), 200);
  assert.equal(specific.headers()["content-type"], "image/png");
  const fallback = await pageFor("captain", "/captain/voyages/muster-fallback/muster");
  await expect(fallback.locator(".muster-cover img")).toHaveAttribute("src", "/images/muster/moonlit-island.png");
  await fallback.close();
  checks.push("Canonical Chronicle-specific cover and no-image fallback");

  const anonymous = await browser.newContext({ baseURL: fixture.origin });
  assert.equal((await anonymous.request.get("/api/voyages/muster-all-ready/muster/chat")).status(), 401);
  assert.equal((await contexts.outsider.request.get("/api/voyages/muster-all-ready/muster/chat")).status(), 403);
  assert.equal((await send("outsider", "muster-all-ready", "Not authorized")).status(), 403);
  assert.equal(
    (
      await contexts.captain.request.post("/api/voyages/muster-all-ready/muster/chat", {
        data: { body: "No CSRF", clientMessageId: randomUUID() },
      })
    ).status(),
    403,
  );
  await anonymous.close();
  checks.push("Anonymous, outsider read/send and missing-CSRF rejected");

  // Populate the owner preview only through real authenticated message sends.
  const existing = await db.voyageCrewMessage.count({ where: { voyageId: "muster-all-ready" } });
  if (!existing) {
    for (const [key, text] of [
      ["sera", "Ready when you are! ⛵"],
      ["northwind", "Can’t wait for this one!"],
      ["tidewalker", "The maps look incredible."],
    ])
      assert.equal((await send(key, "muster-all-ready", text)).status(), 200);
    await captain.getByLabel("Message the crew").fill("Let’s make it a great voyage! ⚓");
    await captain.getByLabel("Message the crew").press("Enter");
  }
  await expect(player.getByText("Let’s make it a great voyage! ⚓", { exact: true })).toBeVisible({ timeout: 20000 });
  await player.reload();
  await expect(player.getByText("Let’s make it a great voyage! ⚓", { exact: true })).toBeVisible({ timeout: 30000 });
  checks.push("Real UI Enter send, cross-client receive, reload persistence");
  await player.screenshot({ path: output + "/player.png", fullPage: true });
  await captain.screenshot({ path: output + "/desktop.png", fullPage: true });

  const chatVoyage = await copyVoyage("chat", ["captain", "sera", "northwind", "tidewalker"]);
  const chatPage = await pageFor("captain", `/captain/voyages/${chatVoyage}/muster`);
  await expect(chatPage.getByText("A good Voyage starts with hello.")).toBeVisible();
  const clientMessageId = randomUUID(),
    literal = '<img src=x onerror="window.chatInjected=true"> Hello & welcome';
  assert.equal((await send("sera", chatVoyage, literal, { clientMessageId })).status(), 200);
  assert.equal((await send("sera", chatVoyage, literal, { clientMessageId })).status(), 200);
  assert.equal(await db.voyageCrewMessage.count({ where: { voyageId: chatVoyage, clientMessageId } }), 1);
  assert.equal((await send("sera", chatVoyage, "x".repeat(1001))).status(), 400);
  assert.equal((await send("sera", chatVoyage, "   ")).status(), 400);
  await expect(chatPage.getByText(literal, { exact: true })).toBeVisible({ timeout: 15000 });
  assert.equal(await chatPage.evaluate(() => window.chatInjected), undefined);
  assert.equal(await chatPage.locator(".muster-message p img").count(), 0);
  const input = chatPage.getByLabel("Message the crew");
  await input.fill("First line");
  await input.press("Shift+Enter");
  await input.pressSequentially("Second line");
  await expect(input).toHaveValue("First line\nSecond line");
  await input.press("Enter");
  await expect(chatPage.getByText("First line\nSecond line", { exact: true })).toBeVisible();
  checks.push("Empty chat, Shift+Enter, safe plain text, length limits, retry idempotency");
  for (let i = 0; i < 18; i++)
    assert.equal((await send(i % 2 ? "northwind" : "tidewalker", chatVoyage, `History check ${i + 1}`)).status(), 200);
  await expect(chatPage.getByText("History check 18", { exact: true })).toBeVisible({ timeout: 20000 });
  await chatPage.locator(".muster-chat-history").evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event("scroll"));
  });
  assert.equal((await send("sera", chatVoyage, "A new message while reading history")).status(), 200);
  await expect(chatPage.getByRole("button", { name: /new message/ })).toBeVisible({ timeout: 15000 });
  assert.equal(await chatPage.locator(".muster-chat-history").evaluate((n) => n.scrollTop), 0);
  await chatPage.getByRole("button", { name: /new message/ }).click();
  assert.ok(await chatPage.locator(".muster-chat-history").evaluate((n) => n.scrollTop > 0));
  await contexts.captain.setOffline(true);
  await expect(chatPage.locator(".chat-connection")).toContainText("Offline");
  await contexts.captain.setOffline(false);
  await expect(chatPage.locator(".chat-connection")).toContainText("Live", { timeout: 30000 });
  checks.push("Older-message scroll preserved, unread indicator, reconnect");
  let rateLimited = false;
  for (let i = 0; i < 15; i++) {
    const result = await send("sera", chatVoyage, `Rate check ${i}`);
    if (result.status() === 429) {
      rateLimited = true;
      break;
    }
    assert.equal(result.status(), 200);
  }
  assert.equal(rateLimited, true);
  checks.push("Durable per-Voyage sender rate limit");
  const revokedMembership = await db.playthroughMembership.findUniqueOrThrow({
    where: {
      playthroughId_playerProfileId: {
        playthroughId: chatVoyage,
        playerProfileId: fixture.profiles.tidewalker.profileId,
      },
    },
  });
  await db.playthroughMembership.update({ where: { id: revokedMembership.id }, data: { status: "LEFT" } });
  assert.equal((await contexts.tidewalker.request.get(`/api/voyages/${chatVoyage}/muster/chat`)).status(), 403);
  assert.equal((await send("tidewalker", chatVoyage, "No access after departure")).status(), 403);
  checks.push("Departed member chat access rejected");
  await chatPage.close();

  const launchId = await copyVoyage("launch");
  const launchPage = await pageFor("captain", `/captain/voyages/${launchId}/muster`);
  await launchPage.getByRole("button", { name: "Begin the Voyage", exact: true }).click();
  await launchPage.getByRole("dialog").getByRole("button", { name: "Begin the Voyage", exact: true }).click();
  await expect(launchPage.getByRole("link", { name: "Open Voyage", exact: true })).toBeVisible({ timeout: 20000 });
  assert.equal((await db.taleSession.findUniqueOrThrow({ where: { id: launchId } })).status, "ACTIVE");
  await launchPage.close();
  checks.push("Canonical launch action and confirmation");
  const relinquishId = await copyVoyage("relinquish");
  const relinquish = await pageFor("captain", `/captain/voyages/${relinquishId}/muster`);
  await relinquish.getByText("Captain & Voyage options", { exact: true }).click();
  await relinquish.getByRole("button", { name: "Relinquish Captaincy", exact: true }).click();
  await relinquish.getByRole("dialog").getByRole("button", { name: "Relinquish Captaincy", exact: true }).click();
  await expect(relinquish.locator(".muster-scene")).toHaveAttribute("data-viewer-role", "player", { timeout: 30000 });
  assert.equal(
    (await db.taleSession.findUniqueOrThrow({ where: { id: relinquishId } })).captainAuthorityState,
    "VACANT",
  );
  await relinquish.close();
  checks.push("Canonical relinquishment to Succession Hold and role re-projection");
  // Finish the authority fixture without leaving an active foreign-Captain lock.
  await db.taleSession.updateMany({ where: { id: { in: [launchId, relinquishId] } }, data: { status: "CANCELLED" } });

  await captain.setViewportSize({ width: 1024, height: 900 });
  await noOverflow(captain, "tablet 1024x900");
  await captain.screenshot({ path: output + "/tablet.png", fullPage: true });
  await captain.setViewportSize({ width: 390, height: 844 });
  await noOverflow(captain, "mobile 390x844");
  await captain.screenshot({ path: output + "/mobile.png", fullPage: true });
  await captain.setViewportSize({ width: 1536, height: 1024 });
  await captain.emulateMedia({ reducedMotion: "reduce" });
  await expect(captain.locator(".muster-scene")).toHaveAttribute("data-motion", "reduced", { timeout: 10000 });
  const motion = await captain.locator(".muster-lantern-glow").evaluate((node) => getComputedStyle(node).animationName);
  assert.equal(motion, "none");
  await captain.screenshot({ path: output + "/reduced-motion.png", fullPage: true });
  checks.push("Browser reduced motion and static composition");
  assert.deepEqual(errors, []);
  checks.push("Zero browser runtime errors");
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await writeFile(
    output + "/focused-proof.json",
    JSON.stringify({ date: new Date().toISOString(), checks, errors }, null, 2),
  );
  await browser.close();
  await db.$disconnect();
}
