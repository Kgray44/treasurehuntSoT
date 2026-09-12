import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";

const root = path.resolve(".runtime/muster-final");
if (process.env.DATABASE_URL !== `file:${path.join(root, "validation.sqlite").replaceAll("\\", "/")}`)
  throw new Error("ISOLATED_FINAL_DATABASE_REQUIRED");
const fixture = JSON.parse(await readFile(path.join(root, "fixture.json"), "utf8"));
assert.equal(fixture.origin, "http://127.0.0.1:3130");
const output = path.join(root, "proof");
await mkdir(output, { recursive: true });
const db = new PrismaClient(),
  browser = await chromium.launch();
const checks = [],
  failures = [],
  pageErrors = [],
  contexts = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const route = (id) => `/captain/voyages/${id}/muster`;
const liveStates = ["INVITED", "ACCEPTED", "READY", "ACTIVE_MEMBER"];
async function check(name, fn) {
  if (process.env.MUSTER_FINAL_CHECKS && !new RegExp(process.env.MUSTER_FINAL_CHECKS).test(name)) return;
  try {
    const details = await fn();
    checks.push({ name, details });
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error: error.message });
    console.log(`FAIL ${name}: ${error.message.slice(0, 600)}`);
  }
}
async function newPage(key = "captain", width = 1536, height = 1024, options = {}) {
  const context = await browser.newContext({ baseURL: fixture.origin, viewport: { width, height }, ...options });
  contexts.push(context);
  if (key)
    await context.addCookies([{ name: "wayfarer_account", value: fixture.profiles[key].token, url: fixture.origin }]);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => pageErrors.push(e.message));
  return page;
}
async function visit(page, id = "muster-all-ready", player = false) {
  await page.goto(player ? `/player/playthroughs/${id}` : route(id));
  await expect(page.locator(".muster-scene[data-viewer-role]")).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
async function projection(page, id) {
  const res = await page.request.get(`/api/voyages/${id}/muster`);
  assert.equal(res.status(), 200);
  return res.json();
}
async function send(page, id, body, extra = {}) {
  const p = await projection(page, id);
  return page.request.post(`/api/voyages/${id}/muster/chat`, {
    data: { body, clientMessageId: randomUUID(), ...extra },
    headers: { "x-csrf-token": p.csrfToken },
  });
}
async function copyVoyage(label, members = ["captain", "sera"]) {
  const source = await db.taleSession.findUniqueOrThrow({ where: { id: "muster-all-ready" } });
  const id = `muster-final-${label}-${randomUUID().slice(0, 8)}`;
  await db.taleSession.create({
    data: {
      id,
      taleId: source.taleId,
      publishedVersionId: source.publishedVersionId,
      captainAccountId: fixture.profiles.captain.accountId,
      voyageName: `Synthetic final ${label}`,
      status: "READY",
      accessTokenHash: hash(id),
      memberships: {
        create: members.map((key) => ({
          playerProfileId: fixture.profiles[key].profileId,
          status: "READY",
          joinedAt: new Date(),
        })),
      },
    },
  });
  return id;
}
async function geometry(page) {
  return page.evaluate(() =>
    Object.fromEntries(
      [".muster-environment", ".muster-chat", ".muster-quote"].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return [s, { x: r.x, y: r.y + (s === ".muster-environment" ? 0 : scrollY), w: r.width, h: r.height }];
      }),
    ),
  );
}
async function layout(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    `${label}: horizontal overflow`,
  );
  const overlaps = await page.evaluate(() => {
    const rects = [".muster-gathering", ".muster-parchment", ".muster-chat", ".muster-quote"].map((s) => ({
      s,
      r: document.querySelector(s).getBoundingClientRect(),
    }));
    return rects.flatMap((a, i) =>
      rects
        .slice(i + 1)
        .filter(
          (b) =>
            Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 2 &&
            Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 2,
        )
        .map((b) => `${a.s} overlaps ${b.s}`),
    );
  });
  assert.deepEqual(overlaps, [], label);
}

try {
  const captain = await newPage(),
    player = await newPage("sera");
  await check("Canonical role/readiness and visible crew matrix", async () => {
    const results = [];
    for (const id of [
      "muster-all-ready",
      "muster-captain-only",
      "muster-captain-empty",
      "muster-preparing",
      "muster-tidal-observatory",
      "muster-proof-launch-0239777b",
    ]) {
      await visit(captain, id);
      const actual = await projection(captain, id),
        source = await db.taleSession.findUniqueOrThrow({
          where: { id },
          include: { memberships: true, version: true, captainAccount: { include: { profile: true } } },
        });
      const current = source.memberships.filter((m) => liveStates.includes(m.status)),
        ready = current.filter((m) => ["READY", "ACTIVE_MEMBER"].includes(m.status));
      assert.deepEqual(actual.readiness, {
        ready: ready.length,
        total: current.length,
        allReady: ready.length === current.length,
      });
      assert.equal(
        actual.crew.filter((m) => m.status === "INVITED").length,
        current.filter((m) => m.status === "INVITED").length,
      );
      const captainAuthority =
        source.captainAuthorityState === "ASSIGNED" && source.captainAccountId === fixture.profiles.captain.accountId;
      assert.equal(actual.viewer.isCaptain, captainAuthority);
      await expect(captain.locator(".muster-eyebrow")).toHaveText(
        captainAuthority ? "Captain Muster" : "Chronicle Muster",
      );
      const snapshot = JSON.parse(source.version.contentSnapshot).tale;
      for (const [field, key] of [
        ["title", "title"],
        ["subtitle", "subtitle"],
        ["description", "shortDescription"],
        ["duration", "estimatedDuration"],
      ])
        assert.equal(actual.voyage[field], snapshot[key] ?? null);
      assert.equal(actual.voyage.edition, source.version.versionLabel);
      assert.equal(actual.voyage.status, source.status);
      assert.equal(actual.voyage.captainName, source.captainAccount.profile.displayName);
      await expect(captain.locator(".muster-parchment h2")).toHaveText(snapshot.title);
      await expect(captain.locator(".muster-description")).toHaveText(snapshot.shortDescription);
      for (const member of actual.crew.filter((m) => m.isCaptain || liveStates.includes(m.status))) {
        const card = captain
          .locator(".muster-crew-card")
          .filter({ has: captain.getByText(member.displayName, { exact: true }) });
        await expect(card).toHaveAttribute("data-ready", String(member.ready));
        await expect(card).toHaveAttribute("data-invited", String(member.status === "INVITED"));
        await expect(card).toContainText(member.isCaptain ? "Captain" : "Crew");
      }
      results.push({
        id,
        role: actual.viewer.isCaptain ? (actual.viewer.participates ? "captain-player" : "captain-only") : "player",
        readiness: actual.readiness,
        canLaunch: actual.viewer.canLaunch,
      });
    }
    await visit(player, "muster-all-ready", true);
    await expect(player.locator(".muster-eyebrow")).toHaveText("Chronicle Muster");
    await expect(player.getByRole("button", { name: "Waiting for the Captain", exact: true })).toBeVisible();
    await player.getByRole("button", { name: "Your Voyage options" }).click();
    assert.equal(await player.getByRole("button", { name: "Relinquish Captaincy", exact: true }).count(), 0);
    assert.equal(await player.getByRole("button", { name: "Cancel Voyage for Everyone", exact: true }).count(), 0);
    assert.equal(await player.getByRole("link", { name: "Invite Crew", exact: true }).count(), 0);
    await expect(player.getByRole("button", { name: "Leave Voyage", exact: true })).toBeVisible();
    await visit(player, "muster-tidal-observatory", true);
    const invited = await projection(player, "muster-tidal-observatory");
    assert.equal(invited.viewer.participates, false);
    assert.equal(invited.viewer.ready, false);
    await expect(player.locator(".muster-crew-card[data-invited=true]")).toContainText("Sera");
    await expect(player.getByLabel("Message the crew")).toBeDisabled();
    return results;
  });
  await check("Exact published cover bytes and absent-cover fallback", async () => {
    for (const [id, file] of [
      ["muster-all-ready", "moonlit-island.png"],
      ["muster-tidal-observatory", "lantern-room.png"],
    ]) {
      const res = await captain.request.get(`/api/voyages/${id}/muster/cover`);
      assert.equal(res.status(), 200);
      assert.equal(hash(await res.body()), hash(await readFile(`public/images/muster/${file}`)));
    }
    await visit(captain, "muster-fallback");
    await expect(captain.locator(".muster-cover img")).toHaveAttribute("src", "/images/muster/moonlit-island.png");
  });
  await check("Failed selected cover does not masquerade as absent cover", async () => {
    const page = await newPage();
    await page.route("**/muster/cover", (r) => r.fulfill({ status: 503, body: "Unavailable" }));
    await visit(page);
    await page.waitForTimeout(250);
    await expect(page.getByText("Chronicle cover temporarily unavailable.")).toBeVisible();
    assert.equal(await page.locator('.muster-cover img[src="/images/muster/moonlit-island.png"]').count(), 0);
    await page.unroute("**/muster/cover");
    await page.getByRole("button", { name: "Retry cover" }).click();
    await expect(page.locator(".muster-cover img")).toHaveAttribute(
      "src",
      "/api/voyages/muster-all-ready/muster/cover",
    );
    await page.close();
  });
  await check("Disclosure frames, indicator, independent anchors and dialog", async () => {
    await visit(captain);
    const original = await geometry(captain);
    const samples = [];
    for (let i = 0; i < 4; i++) {
      const recording = captain.evaluate(async () => {
        const frames = [],
          start = performance.now();
        do {
          const panel = document.querySelector(".muster-options-panel"),
            icon = document.querySelector(".muster-options-trigger svg");
          frames.push({ height: panel.getBoundingClientRect().height, transform: getComputedStyle(icon).transform });
          await new Promise(requestAnimationFrame);
        } while (performance.now() - start < 440);
        return frames;
      });
      await captain.getByRole("button", { name: "Captain & Voyage options" }).click();
      const frames = await recording;
      assert.ok(new Set(frames.map((f) => Math.round(f.height))).size > 4);
      assert.ok(new Set(frames.map((f) => f.transform)).size > 4);
      assert.deepEqual(await geometry(captain), original);
      samples.push(frames.length);
    }
    await captain.getByRole("button", { name: "Captain & Voyage options" }).click();
    await captain.getByRole("button", { name: "Cancel Voyage for Everyone", exact: true }).click();
    await expect(captain.getByRole("dialog")).toBeVisible();
    assert.deepEqual((await geometry(captain))[".muster-environment"], original[".muster-environment"]);
    await captain.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await captain.getByLabel("Message the crew").fill("x".repeat(850));
    assert.deepEqual((await geometry(captain))[".muster-quote"], original[".muster-quote"]);
    await captain.getByLabel("Message the crew").fill("");
    return { cycles: 2, frameCounts: samples };
  });
  await check("Invite Crew reaches canonical invitation management", async () => {
    await visit(captain);
    await captain.getByRole("link", { name: "Invite Crew", exact: true }).click();
    await expect(captain).toHaveURL(/\/captain\/library/);
    await expect(captain.getByRole("button", { name: /^Invitations/ })).toBeVisible();
    await captain.getByRole("button", { name: /^Invitations/ }).click();
    await expect(captain.getByRole("button", { name: /^Invitations/ })).toHaveAttribute("aria-pressed", "true");
  });
  await check("Live chat, persistence, history, safe text, reconnect and protections", async () => {
    const id = await copyVoyage("chat", ["captain", "sera", "northwind", "tidewalker"]);
    await visit(captain, id);
    await visit(player, id, true);
    await expect(captain.getByText("A good Voyage starts with hello.")).toBeVisible();
    const literal = '<img src=x onerror="window.chatInjected=true"> & hello';
    await captain.getByLabel("Message the crew").fill(literal);
    await captain.getByLabel("Message the crew").press("Enter");
    await expect(player.getByText(literal, { exact: true })).toBeVisible({ timeout: 15000 });
    await player.reload();
    await expect(player.getByText(literal, { exact: true })).toBeVisible();
    assert.equal(await player.locator(".muster-message p img").count(), 0);
    const clientMessageId = randomUUID();
    assert.equal((await send(player, id, "Duplicate safe", { clientMessageId })).status(), 200);
    assert.equal((await send(player, id, "Duplicate safe", { clientMessageId })).status(), 200);
    assert.equal(await db.voyageCrewMessage.count({ where: { voyageId: id, clientMessageId } }), 1);
    assert.equal((await send(player, id, "x".repeat(1001))).status(), 400);
    assert.equal((await send(player, id, " ")).status(), 400);
    const now = new Date(Date.now() - 120000);
    await db.voyageCrewMessage.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        voyageId: id,
        senderAccountId: fixture.profiles.northwind.accountId,
        senderName: "Northwind",
        body: `Retained history ${i + 1}`,
        clientMessageId: randomUUID(),
        createdAt: now,
      })),
    });
    await captain.reload();
    await expect(captain.getByText("Retained history 120", { exact: true })).toBeVisible();
    await captain.locator(".muster-chat-history").evaluate((n) => {
      n.scrollTop = 0;
      n.dispatchEvent(new Event("scroll"));
    });
    const anchors = await geometry(captain);
    assert.equal((await send(player, id, "New while reading older history")).status(), 200);
    await expect(captain.getByRole("button", { name: /new message/ })).toBeVisible({ timeout: 15000 });
    assert.equal(await captain.locator(".muster-chat-history").evaluate((n) => n.scrollTop), 0);
    assert.deepEqual((await geometry(captain))[".muster-quote"], anchors[".muster-quote"]);
    assert.deepEqual((await geometry(captain))[".muster-environment"], anchors[".muster-environment"]);
    await captain.getByRole("button", { name: /new message/ }).click();
    assert.ok(await captain.locator(".muster-chat-history").evaluate((n) => n.scrollTop > 0));
    await captain.context().setOffline(true);
    await expect(captain.locator(".chat-connection")).toHaveText("Offline");
    await captain.context().setOffline(false);
    await expect(captain.locator(".chat-connection")).toHaveText("Live", { timeout: 30000 });
    let limited = false;
    for (let i = 0; i < 15; i++) {
      const r = await send(player, id, `Rate ${i}`);
      if (r.status() === 429) {
        limited = true;
        break;
      }
      assert.equal(r.status(), 200);
    }
    assert.ok(limited);
    const outsider = await newPage("outsider"),
      anonymous = await newPage(null);
    assert.equal((await outsider.request.get(`/api/voyages/${id}/muster/chat`)).status(), 403);
    assert.equal((await anonymous.request.get(`/api/voyages/${id}/muster/chat`)).status(), 401);
    assert.equal(
      (
        await captain.request.post(`/api/voyages/${id}/muster/chat`, {
          data: { body: "No CSRF", clientMessageId: randomUUID() },
        })
      ).status(),
      403,
    );
    await db.playthroughMembership.updateMany({
      where: { playthroughId: id, playerProfileId: fixture.profiles.sera.profileId },
      data: { status: "LEFT" },
    });
    assert.equal((await player.request.get(`/api/voyages/${id}/muster/chat`)).status(), 403);
    return { voyage: id, historyCount: await db.voyageCrewMessage.count({ where: { voyageId: id } }) };
  });
  await check("Canonical launch, relinquish, cancellation and Player leave", async () => {
    for (const action of ["launch", "relinquish", "cancel", "leave"]) {
      const id = await copyVoyage(action),
        page = await newPage(action === "leave" ? "sera" : "captain");
      await visit(page, id, action === "leave");
      const label = {
        launch: "Begin the Voyage",
        relinquish: "Relinquish Captaincy",
        cancel: "Cancel Voyage for Everyone",
        leave: "Leave Voyage",
      }[action];
      if (action !== "launch")
        await page
          .getByRole("button", { name: action === "leave" ? "Your Voyage options" : "Captain & Voyage options" })
          .click();
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
      await expect
        .poll(async () => {
          const row = await db.taleSession.findUniqueOrThrow({ where: { id }, include: { memberships: true } });
          return action === "launch"
            ? row.status
            : action === "relinquish"
              ? row.captainAuthorityState
              : action === "cancel"
                ? row.status
                : row.memberships.find((m) => m.playerProfileId === fixture.profiles.sera.profileId).status;
        })
        .toBe({ launch: "ACTIVE", relinquish: "VACANT", cancel: "CANCELLED", leave: "LEFT" }[action]);
      // Only this synthetic final-proof row is closed after its actual operation.
      if (action === "launch" || action === "relinquish")
        await db.taleSession.update({ where: { id }, data: { status: "CANCELLED" } });
      await page.close();
    }
  });
  await check("Responsive, themes, effective zoom, keyboard and accessibility", async () => {
    const results = [];
    const preferenceRow = await db.profilePreferenceSet.findUniqueOrThrow({
      where: { playerProfileId: fixture.profiles.captain.profileId },
    });
    const acceptedPreferences = JSON.parse(preferenceRow.payload);
    for (const [label, width, height, scheme] of [
      ["desktop-dark", 1536, 1024, "dark"],
      ["desktop-light", 1536, 1024, "light"],
      ["desktop-high-contrast", 1536, 1024, "dark"],
      ["tablet", 1024, 900, "dark"],
      ["mobile", 390, 844, "dark"],
      ["zoom-200", 768, 512, "dark"],
    ]) {
      const theme = label === "desktop-high-contrast" ? "HIGH_CONTRAST" : scheme.toUpperCase();
      await db.profilePreferenceSet.update({
        where: { id: preferenceRow.id },
        data: {
          payload: JSON.stringify({ ...acceptedPreferences, experience: { ...acceptedPreferences.experience, theme } }),
        },
      });
      const page = await newPage("captain", width, height, {
        colorScheme: scheme,
        deviceScaleFactor: label === "zoom-200" ? 2 : 1,
      });
      await visit(page);
      await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", theme.toLowerCase().replace("_", "-"));
      await layout(page, label);
      const materials = await page.evaluate(() =>
        Object.fromEntries(
          [".muster-voyage-name", ".muster-crew-card > strong", ".muster-launch"].map((selector) => {
            const style = getComputedStyle(document.querySelector(selector));
            return [selector, { color: style.color, background: style.backgroundImage }];
          }),
        ),
      );
      if (label === "desktop-light")
        assert.deepEqual(
          materials,
          results.find((result) => result.label === "desktop-dark").materials,
          "Room foregrounds and launch material retain the accepted dark-stage contrast in Light theme",
        );
      await page.getByRole("button", { name: "Captain & Voyage options" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".muster-options-trigger")).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Relinquish Captaincy", exact: true })).toBeFocused();
      const focus = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      assert.notEqual(focus, "none");
      const audit = await new AxeBuilder({ page })
        .include(".muster-scene")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const violations = audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }));
      await writeFile(path.join(output, `axe-${label}.json`), JSON.stringify(violations, null, 2));
      await page.screenshot({ path: path.join(output, `${label}.png`) });
      results.push({ label, violations, materials });
      await page.close();
    }
    await db.profilePreferenceSet.update({ where: { id: preferenceRow.id }, data: { payload: preferenceRow.payload } });
    const reduced = await newPage("captain", 1536, 1024, { reducedMotion: "reduce" });
    await visit(reduced);
    await expect(reduced.locator(".muster-scene")).toHaveAttribute("data-motion", "reduced");
    await reduced.getByRole("button", { name: "Captain & Voyage options" }).click();
    assert.equal(
      await reduced.locator(".muster-options-content").evaluate((n) => getComputedStyle(n).transform),
      "none",
    );
    await reduced.close();
    assert.ok(
      results.every((r) => r.violations.length === 0),
      JSON.stringify(results.map((r) => ({ label: r.label, violations: r.violations.map((v) => v.id) }))),
    );
    return results;
  });
  await check("Long Chronicle, maximum 20 invited crew and one-person layout", async () => {
    const source = await db.taleSession.findUniqueOrThrow({
        where: { id: "muster-all-ready" },
        include: { version: true },
      }),
      id = await copyVoyage("long", []);
    const snapshot = JSON.parse(source.version.contentSnapshot);
    snapshot.publishedAt = new Date().toISOString();
    snapshot.tale.title =
      "The Extraordinary Voyage Beyond the Last Lantern and Through the Forgotten Moonlit Harbors of the Northern Sea";
    snapshot.tale.shortDescription =
      "Follow the surviving charts across the archipelago, gather the scattered stories, and discover what the lighthouse keepers left behind. ".repeat(
        4,
      );
    snapshot.tale.playerCountMax = 20;
    const versionId = `${id}-edition`;
    await db.publishedTaleVersion.create({
      data: {
        id: versionId,
        taleId: source.taleId,
        versionLabel: `final-${id}`,
        versionNumber:
          (await db.publishedTaleVersion.aggregate({ where: { taleId: source.taleId }, _max: { versionNumber: true } }))
            ._max.versionNumber + 1,
        contentSnapshot: JSON.stringify(snapshot),
        checksum: hash(JSON.stringify(snapshot)),
        publishedBy: fixture.profiles.captain.accountId,
        publishedByAccountId: fixture.profiles.captain.accountId,
      },
    });
    await db.taleSession.update({ where: { id }, data: { publishedVersionId: versionId } });
    for (let i = 0; i < 20; i++) {
      const profileId = `${id}-crew-${i}`;
      await db.playerProfile.create({
        data: {
          id: profileId,
          displayName: `Invited Navigator ${i + 1} ${id.slice(-8)}`,
          normalizedDisplayName: `invited navigator ${i + 1} ${id.slice(-8)}`,
          handle: `final-${id.slice(-8)}-${i}`,
          normalizedHandle: `final-${id.slice(-8)}-${i}`,
          status: "ACTIVE",
        },
      });
      await db.playthroughMembership.create({
        data: { playthroughId: id, playerProfileId: profileId, status: "INVITED" },
      });
    }
    for (const [width, height] of [
      [1536, 1024],
      [1024, 900],
      [390, 844],
      [768, 512],
    ]) {
      const page = await newPage("captain", width, height);
      await visit(page, id);
      await layout(page, `long ${width}`);
      await page.screenshot({ path: path.join(output, `long-${width}.png`) });
      await page.close();
    }
    const solo = await newPage();
    await visit(solo, "muster-captain-empty");
    await layout(solo, "one-person");
    await solo.close();
    return { voyage: id, invited: 20 };
  });
  await check("Loading, request error and denied access", async () => {
    const loading = await newPage();
    let release;
    const held = new Promise((r) => (release = r));
    await loading.route("**/api/voyages/muster-all-ready/muster", async (r) => {
      await held;
      await r.continue();
    });
    await loading.goto(route("muster-all-ready"));
    await expect(loading.getByRole("heading", { name: "Gathering your Crew…" })).toBeVisible();
    release();
    await expect(loading.locator(".muster-scene[data-viewer-role]")).toBeVisible();
    await loading.close();
    const error = await newPage();
    await error.route("**/api/voyages/muster-all-ready/muster", (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic unavailable service" }),
      }),
    );
    await error.goto(route("muster-all-ready"));
    await expect(error.getByRole("heading", { name: "The harbor is out of reach" })).toBeVisible();
    await expect(error.getByRole("button", { name: "Refresh room" })).toBeVisible();
    await error.close();
    const denied = await newPage("outsider");
    await denied.goto(`/player/playthroughs/muster-all-ready`);
    await expect(denied.getByRole("heading", { name: "This room is unavailable" })).toBeVisible();
    await denied.close();
  });
  await check("No unexpected browser runtime errors", async () => assert.deepEqual(pageErrors, []));
} finally {
  await writeFile(
    path.join(
      output,
      process.env.MUSTER_FINAL_CHECKS
        ? `focused-${hash(process.env.MUSTER_FINAL_CHECKS).slice(0, 8)}.json`
        : "final-proof.json",
    ),
    JSON.stringify({ date: new Date().toISOString(), checks, failures, pageErrors }, null, 2),
  );
  await browser.close();
  await db.$disconnect();
}
console.log(JSON.stringify({ passed: checks.length, failed: failures.length }));
if (failures.length) process.exitCode = 1;
