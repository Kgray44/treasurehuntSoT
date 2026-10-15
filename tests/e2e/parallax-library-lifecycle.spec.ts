import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { saveSpatialDraft, releaseSpatialVersion } from "../../src/parallax/library-service";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import { saveEnvironmentDraft, saveDefinitionToLibrary } from "../../src/parallax/library-lifecycle-service";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { defaultPreferences, updatePreferences } from "../../src/wayfarer/profile";
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const evidence =
  process.env.PARALLAX_BROWSER_RUNTIME === "PRODUCTION"
    ? `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12)}`
    : "artifacts/parallax-a1/library-development";

test("durable working scene, explicit saved membership, named Save As, metadata and version history", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(240000);
  const account = await closureAccount("Synthetic Library Lifecycle Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft(crypto.randomUUID(), "Working scene");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.getByRole("heading", { name: "Parallax", exact: true })).toBeVisible();
  await expect(page.getByLabel("Object name", { exact: true })).toBeVisible();
  for (let n = 0; n < 20; n++) {
    await page.getByLabel("Object name", { exact: true }).fill(`Working edit ${n}`);
    await page.getByLabel("Object name", { exact: true }).press("Tab");
  }
  await expect(page.getByRole("status").filter({ hasText: "Working draft saved" }).first()).toBeVisible();
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(1);
  expect((await db.reusableAuthoringItem.findUnique({ where: { id: draft.content.definitionId } }))!.status).toBe(
    "WORKING",
  );
  await page.getByRole("button", { name: "Save to Library", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved to Library" }).first()).toBeVisible();
  for (let n = 0; n < 10; n++) {
    await page.getByLabel("Object name", { exact: true }).fill(`Saved edit ${n}`);
    await page.getByLabel("Object name", { exact: true }).press("Tab");
  }
  await page.getByRole("button", { name: "Save as new…", exact: true }).click();
  const copy = page.getByRole("dialog", { name: "Save as new definition" });
  await copy.getByLabel("Name", { exact: true }).fill("Independent voyage scene");
  await copy.getByRole("button", { name: "Create independent definition", exact: true }).click();
  await expect(page.getByRole("region", { name: "Environment and Scene", exact: true })).toContainText(
    "Independent voyage scene",
  );
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(2);
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  const history = page.getByRole("dialog", { name: "Version history", exact: true });
  await history.getByLabel("Version notes").fill("Synthetic first release");
  await history.getByRole("button", { name: "Create immutable version" }).click();
  await expect(history).not.toBeVisible();
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  await expect(history).toContainText("Synthetic first release");
  await history.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(history.getByRole("heading", { name: /read only/ })).toBeVisible();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/version-preview-desktop.png`, fullPage: true });
  await history.getByRole("button", { name: "Close Library dialog" }).click();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: "Scenes", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(2);
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("WORKING");
  await expect(library.getByRole("article")).toHaveCount(0);
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("SAVED");
  await library.getByRole("button", { name: "Inspect Working scene", exact: true }).click();
  await library.getByRole("button", { name: "Organize / rename", exact: true }).click();
  const organize = page.getByRole("dialog", { name: "Organize definition", exact: true });
  await organize.getByLabel("Collection", { exact: true }).fill("Ghost stories");
  await organize.getByLabel("Tags · comma separated").fill("Pirates, Laboratory");
  await organize.getByLabel("Favorite", { exact: true }).check();
  await organize.getByRole("button", { name: "Save details" }).click();
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("FAVORITES");
  await library.getByRole("searchbox").fill("Ghost stories");
  await expect(library.getByRole("article")).toHaveCount(1);
  await page.screenshot({ path: `${evidence}/collection-library.png`, fullPage: true });
});

test("independent environment creation, editing and reuse do not manufacture scene definitions", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(240000);
  const account = await closureAccount("Synthetic Independent Environment Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(crypto.randomUUID(), "Scene for room use");
  await saveSpatialDraft(account.id, scene, 0);
  const document = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  document.name = "Reusable bedroom";
  await saveEnvironmentDraft(account.id, document, 0);
  await saveDefinitionToLibrary(account.id, document.id, 1);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await expect(page.getByRole("heading", { name: "Parallax", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await expect(library.getByRole("article")).toHaveCount(1);
  await library.getByRole("button", { name: "Inspect Reusable bedroom", exact: true }).click();
  await library.getByRole("button", { name: "Use in current Scene", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "snapshot applied" }).first()).toBeVisible();
  const applied = await db.reusableAuthoringItemVersion.findUnique({
    where: { itemId_versionNumber: { itemId: scene.content.definitionId, versionNumber: 0 } },
  });
  const pinned = JSON.parse(applied!.envelope).content.studio.environment;
  await library.getByRole("button", { name: "Inspect Reusable bedroom", exact: true }).click();
  await library.getByRole("button", { name: "Edit original", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reusable bedroom", level: 1 })).toBeVisible();
  const roomCanvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const roomCanvasBounds = await roomCanvas.boundingBox();
  expect(roomCanvasBounds!.height).toBeGreaterThan(570);
  for (const name of [
    "Select tool",
    "Move tool",
    "Rotate tool",
    "Scale tool",
    "Toggle snapping",
    "Auto surface clamping",
    "Toggle spatial overlays",
  ]) {
    const control = roomCanvas.getByRole("button", { name, exact: true });
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThan(roomCanvasBounds!.y + roomCanvasBounds!.height);
  }
  await page.getByLabel("Name", { exact: true }).fill("Bedroom original edited");
  await page.getByLabel("Name", { exact: true }).press("Tab");
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("Control+z");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Reusable bedroom");
  await page.keyboard.press("Control+y");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Bedroom original edited");
  await page.getByRole("button", { name: "Save to Library", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "one environment" }).first()).toBeVisible();
  expect(
    JSON.parse(
      (await db.reusableAuthoringItemVersion.findUnique({
        where: { itemId_versionNumber: { itemId: scene.content.definitionId, versionNumber: 0 } },
      }))!.envelope,
    ).content.studio.environment,
  ).toEqual(pinned);
  await page.screenshot({ path: `${evidence}/environment-definition-laptop.png`, fullPage: true });
  await page.getByRole("button", { name: "Back to scene" }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await db.reusableAuthoringItemVersion.findUnique({
            where: { itemId_versionNumber: { itemId: scene.content.definitionId, versionNumber: 0 } },
          }))!.envelope,
        ).content.studio.environment,
    )
    .toEqual(pinned);
  await page.getByRole("button", { name: "Create Environment", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "Create an environment", exact: true });
  await setup.getByRole("button", { name: /Empty environment/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Empty environment" })).toBeVisible();
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(3);
  const rows = await db.reusableAuthoringItem.findMany({
    where: { ownerAccountId: account.id },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  expect(rows.filter((r) => JSON.parse(r.versions[0].envelope).format !== "PARALLAX_ENVIRONMENT_DRAFT_1")).toHaveLength(
    1,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidence}/environment-definition-phone.png`, fullPage: true });
});

test("pending save retry and reload retain one stable definition and visible failure", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Save Failure Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft(crypto.randomUUID(), "Retry scene");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.getByLabel("Object name", { exact: true })).toBeVisible();
  let fail = true;
  await page.route("**/api/studio/parallax", async (route) => {
    if (fail && route.request().method() === "POST" && route.request().postDataJSON().action === "SAVE")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic unavailable save. Your work is retained." }),
      });
    else await route.continue();
  });
  await page.getByLabel("Object name", { exact: true }).fill("Recover this edit");
  await page.getByLabel("Object name", { exact: true }).press("Tab");
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic unavailable save" })).toBeVisible();
  await page.reload();
  const recovery = page.getByRole("dialog", { name: "Working draft recovery", exact: true });
  await expect(recovery).toBeVisible();
  fail = false;
  await recovery.getByRole("button", { name: "Review retained edits" }).click();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Recover this edit");
  await expect(page.getByRole("status").filter({ hasText: "Working draft saved" }).first()).toBeVisible();
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(1);
});

test("lost Save As response replays one copy and two tabs preserve conflicting edits deliberately", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic Concurrency Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft(crypto.randomUUID(), "Concurrent scene");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.getByLabel("Object name", { exact: true })).toBeVisible();
  let dropped = false;
  await page.route("**/api/studio/parallax", async (route) => {
    if (!dropped && route.request().method() === "POST" && route.request().postDataJSON().action === "SAVE_AS") {
      dropped = true;
      await route.fetch();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic lost acknowledgment. Retry the same copy." }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save as new…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save as new definition" });
  await dialog.getByLabel("Name", { exact: true }).fill("Single retried copy");
  await dialog.getByRole("button", { name: "Create independent definition" }).click();
  await expect(dialog.getByRole("alert")).toContainText("lost acknowledgment");
  await dialog.getByRole("button", { name: "Create independent definition" }).click();
  await expect(dialog).not.toBeVisible();
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(2);
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  const second = await context.newPage();
  await second.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(second.getByLabel("Object name", { exact: true })).toBeVisible();
  await page.getByLabel("Object name", { exact: true }).fill("Newer first-tab name");
  await page.getByLabel("Object name", { exact: true }).press("Tab");
  await expect(page.getByRole("status").filter({ hasText: "Working draft saved" }).first()).toBeVisible();
  await second.getByLabel("Object name", { exact: true }).fill("Retained second-tab name");
  await second.getByLabel("Object name", { exact: true }).press("Tab");
  await expect(second.getByRole("alert").filter({ hasText: /changed|Conflict/i })).toBeVisible();
  await second.getByRole("button", { name: "Review saved revision" }).click();
  const recovery = second.getByRole("dialog", { name: "Working draft recovery" });
  await recovery.getByRole("button", { name: "Preserve retained edits as new…" }).click();
  const salvage = second.getByRole("dialog", { name: "Save as new definition" });
  await salvage.getByLabel("Name", { exact: true }).fill("Retained edit copy");
  await salvage.getByRole("button", { name: "Create independent definition" }).click();
  await expect(salvage).not.toBeVisible();
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(3);
  const original = await db.reusableAuthoringItemVersion.findUnique({
    where: { itemId_versionNumber: { itemId: draft.content.definitionId, versionNumber: 0 } },
  });
  expect(JSON.parse(original!.envelope).content.entities[0].name).toBe("Newer first-tab name");
  await expect(second.getByLabel("Object name", { exact: true })).toHaveValue("Retained second-tab name");
  await second.close();
});

test("light and dark Library views remain typed, responsive and keyboard reachable", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Themed Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(crypto.randomUUID(), "Saved exploration scene");
  scene.tags = ["Pirate"];
  scene.collection = "Voyage collection";
  scene.favorite = true;
  await saveSpatialDraft(account.id, scene, 0);
  await saveDefinitionToLibrary(account.id, scene.content.definitionId, 1);
  const room = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  room.name = "Saved shared room";
  await saveEnvironmentDraft(account.id, room, 0);
  await saveDefinitionToLibrary(account.id, room.id, 1);
  const working = createSpatialDraft(crypto.randomUUID(), "Working only");
  await saveSpatialDraft(account.id, working, 0);
  const legacy = createSpatialDraft(crypto.randomUUID(), "Recoverable legacy");
  await saveSpatialDraft(account.id, legacy, 0);
  await db.reusableAuthoringItem.update({ where: { id: legacy.content.definitionId }, data: { status: "ACTIVE" } });
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: "Scenes", exact: true }).click();
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("SAVED");
  await expect(library.getByRole("article")).toHaveCount(1);
  await library.getByRole("tab", { name: "Environments", exact: true }).click();
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await expect(library.getByRole("article")).toHaveCount(1);
  await library.getByRole("tab", { name: "Scenes", exact: true }).click();
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("ALL");
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("WORKING");
  await expect(library).toContainText("Working only");
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("ACTIVE");
  await library.getByRole("searchbox").fill("Recoverable legacy");
  await expect(library).toContainText("Recoverable legacy");
  await library.getByRole("searchbox").fill("");
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("SAVED");
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("FAVORITES");
  await expect(library.getByRole("article")).toHaveCount(1);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/typed-library-desktop-dark.png`, fullPage: true });
  const actions = library.locator('summary[aria-label="Actions for Saved exploration scene"]');
  await actions.focus();
  await actions.press("Enter");
  await expect(library.getByRole("button", { name: "Preview details", exact: true })).toBeVisible();
  await actions.press("Enter");
  await updatePreferences(account.profileId, {
    ...defaultPreferences,
    experience: { ...defaultPreferences.experience, theme: "LIGHT", motion: "REDUCED" },
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  if (await library.isHidden()) await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await expect(library).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: `${evidence}/typed-library-laptop-light.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await library.isHidden()) await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.screenshot({ path: `${evidence}/typed-library-phone-light.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("stale environment recovery keeps the original CAS base after reload", async ({ page, context, baseURL }) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Environment Recovery Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const document = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  await saveEnvironmentDraft(account.id, document, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.goto(`/studio/parallax?environment=${document.id}`);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await page.route("**/api/studio/parallax", async (route) => {
    if (route.request().method() === "POST" && route.request().postDataJSON().action === "ENVIRONMENT_SAVE")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic offline room save" }),
      });
    else await route.continue();
  });
  await page.getByLabel("Name", { exact: true }).fill("Retained room edit");
  await expect(page.getByRole("alert").filter({ hasText: "offline room save" })).toBeVisible();
  const newer = { ...document, name: "Another editor's room" };
  await saveEnvironmentDraft(account.id, newer, 1);
  await page.unroute("**/api/studio/parallax");
  await page.reload();
  const recovery = page.getByRole("region", { name: "Environment recovery", exact: true });
  await expect(recovery).toBeVisible();
  await recovery.getByRole("button", { name: "Review my retained edits" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /changed|Conflict/i })).toBeVisible();
  const saved = await db.reusableAuthoringItemVersion.findUnique({
    where: { itemId_versionNumber: { itemId: document.id, versionNumber: 0 } },
  });
  expect(JSON.parse(saved!.envelope).name).toBe("Another editor's room");
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(1);
});

test("failed historical copy cannot substitute an earlier version for a newly selected version", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Historical Copy Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft(crypto.randomUUID(), "Two historical versions");
  draft.content.entities[0].name = "Version one object";
  await saveSpatialDraft(account.id, draft, 0);
  const first = await releaseSpatialVersion(account.id, draft.content.definitionId, 1, "First pose");
  draft.content.entities[0].name = "Version two object";
  const revision = await saveSpatialDraft(account.id, draft, first.revision);
  await releaseSpatialVersion(account.id, draft.content.definitionId, revision, "Second pose");
  await authenticateClosure(context, account, baseURL!);
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  const history = page.getByRole("dialog", { name: "Version history", exact: true });
  const firstCard = history.getByRole("article").filter({ has: page.getByText("Version 1.0.0", { exact: true }) }),
    secondCard = history.getByRole("article").filter({ has: page.getByText("Version 2.0.0", { exact: true }) });
  let fail = true;
  const versions: string[] = [];
  await page.route("**/api/studio/parallax", async (route) => {
    const input = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (input?.action === "SAVE_AS") {
      versions.push(input.versionId);
      if (fail) {
        fail = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic failed first-version copy" }),
        });
        return;
      }
    }
    await route.continue();
  });
  await firstCard.getByRole("button", { name: "Copy this version" }).click();
  await firstCard.getByLabel("New definition name").fill("Chosen first copy");
  await firstCard.getByRole("button", { name: "Create version copy" }).click();
  await expect(history.getByRole("alert")).toContainText("failed first-version copy");
  await firstCard.getByRole("button", { name: "Cancel copy" }).click();
  await secondCard.getByRole("button", { name: "Copy this version" }).click();
  await secondCard.getByLabel("New definition name").fill("Chosen second copy");
  await secondCard.getByRole("button", { name: "Create version copy" }).click();
  await expect(history).not.toBeVisible();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Version two object");
  expect(versions).toEqual([`${draft.content.definitionId}:v1`, `${draft.content.definitionId}:v2`]);
  expect(await db.reusableAuthoringItem.count({ where: { ownerAccountId: account.id } })).toBe(2);
});
