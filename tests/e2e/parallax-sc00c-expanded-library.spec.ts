import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createSpatialDraft, previewEntityTransforms } from "../../src/parallax/authoring";
import { listSpatialItems, saveReusableAsset, saveSpatialDraft } from "../../src/parallax/library-service";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import {
  releaseEnvironmentVersion,
  saveDefinitionToLibrary,
  saveEnvironmentDraft,
  useEnvironmentDefinition as bindEnvironmentDefinition,
} from "../../src/parallax/library-lifecycle-service";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { insertSpatialElement } from "../../src/parallax/element-authoring";
import { createGenericRoomFeature } from "../../src/parallax/room-feature-construction";
import { syntheticEnvironmentEvidence } from "../../src/parallax/adaptive-authoring";
import { evaluateSpatialScene } from "../../src/parallax/behavior";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const evidence = `artifacts/sc00c/expanded-library/${process.env.SC00C_LIBRARY_SOURCE?.slice(0, 12) ?? "local"}`;

test("compact to expanded Library stages a surface placement and returns to the same content", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Expanded Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(randomUUID(), "Expanded Library journey");
  await saveSpatialDraft(account.id, scene, 0);
  const savedBeforeLibrary = (await listSpatialItems(account.id))[0].draft;
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  const viewportCanvas = page.getByRole("region", { name: "Spatial canvas" }).locator("canvas").first();
  const renderer = page.getByRole("region", { name: "Spatial canvas" }).locator('[data-renderer="READY"]');
  await expect(renderer.locator("canvas")).toBeVisible();
  await expect(renderer).toHaveAttribute("data-projected-scene", /"camera"/);
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
  await expect
    .poll(async () => JSON.parse((await renderer.getAttribute("data-projected-scene"))!).camera[1])
    .toBeGreaterThan(8);
  const cameraBeforeLibrary = JSON.parse((await renderer.getAttribute("data-projected-scene"))!).camera as number[];
  await viewportCanvas.evaluate((canvas) => {
    canvas.dataset.libraryMountProbe = "original";
  });
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const compact = page.getByRole("region", { name: "Spatial content library", exact: true });
  await compact.getByRole("searchbox").fill("Writing desk");
  await expect(compact.getByRole("button", { name: "Inspect Writing desk" })).toBeVisible();
  await compact.getByRole("button", { name: "Expand Spatial Library" }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded Spatial Library" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("searchbox")).toHaveValue("Writing desk");
  expect(JSON.parse((await renderer.getAttribute("data-projected-scene"))!).camera).toEqual(cameraBeforeLibrary);
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeGreaterThan(1200);
  expect(bounds!.height).toBeGreaterThan(780);
  await dialog.getByRole("button", { name: "Inspect Writing desk" }).click();
  const details = dialog.getByRole("complementary", { name: "Writing desk details" });
  await expect(details).toContainText("Built-in");
  await expect(details.getByRole("button", { name: /Publish to Community/ })).toHaveCount(0);
  await expect(details.getByLabel(/3D preview of Writing desk/)).toBeVisible();
  expect(await dialog.locator("canvas").count()).toBeLessThanOrEqual(1);
  await dialog.getByRole("button", { name: "Close expanded Spatial Library" }).focus();
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/expanded-desktop.png`, fullPage: true });
  await details.getByRole("button", { name: "Place in Scene" }).click();
  await expect(dialog).toBeHidden();
  await expect(viewportCanvas).toHaveAttribute("data-library-mount-probe", "original");
  expect(JSON.parse((await renderer.getAttribute("data-projected-scene"))!).camera).toEqual(cameraBeforeLibrary);
  const placement = page.getByLabel("Place Writing desk in Scene");
  await expect(placement).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeDisabled();
  await page.screenshot({ path: `${evidence}/placement-preview.png`, fullPage: true });
  await placement.getByRole("button", { name: "Floor", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  await expect(placement).toBeHidden();
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Writing desk");
  await page.screenshot({ path: `${evidence}/placed-selected.png`, fullPage: true });
  await page.getByLabel("Object name", { exact: true }).fill("Writing desk unsaved edit");
  await page.getByLabel("Object name", { exact: true }).press("Tab");
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Writing desk unsaved edit");
  expect((await listSpatialItems(account.id))[0].draft).toEqual(savedBeforeLibrary);
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog.getByRole("searchbox")).toHaveValue("Writing desk");
  await expect(dialog.getByRole("complementary", { name: "Writing desk details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand Spatial Library" })).toBeFocused();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Writing desk unsaved edit");
  expect(JSON.parse((await renderer.getAttribute("data-projected-scene"))!).camera).toEqual(cameraBeforeLibrary);
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
});

test("saved assets use the shared Library and wait for an approved surface before creating a Scene copy", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Saved Asset Placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(randomUUID(), "Desk Map");
  await saveSpatialDraft(account.id, scene, 0);
  const asset = await saveReusableAsset(
    account.id,
    scene,
    1,
    scene.content.entities[0].id,
    { name: "Reusable review clue", description: "Synthetic private map", classification: "Map" },
    simulationEnvironments[0],
  );
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const compact = page.getByRole("region", { name: "Spatial content library", exact: true });
  await compact.getByRole("tab", { name: "Assets" }).click();
  await compact.getByRole("searchbox", { name: "Search assets" }).fill("Reusable review clue");
  await compact.getByRole("button", { name: "Inspect Reusable review clue" }).click();
  const details = compact.getByRole("complementary", { name: "Reusable review clue details" });
  await expect(details).toContainText("Private Library");
  await details.getByRole("button", { name: "Place in Scene" }).click();
  const placement = page.getByLabel("Place Reusable review clue in Scene");
  await expect(placement).toBeVisible();
  expect(
    (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!.draft.content.entities,
  ).toHaveLength(1);
  await placement.click({ position: { x: 5, y: 5 } });
  await expect(page.getByText("No clear floor support at that point. Nothing was inserted.")).toBeVisible();
  await expect(placement).toBeVisible();
  let releaseInsert = () => {};
  const delayedInsert = new Promise<void>((resolve) => {
    releaseInsert = resolve;
  });
  let signalInsert = () => {};
  const insertRequested = new Promise<void>((resolve) => {
    signalInsert = resolve;
  });
  let holdFirstInsert = true;
  const apiRoute = "**/api/studio/parallax";
  await page.route(apiRoute, async (route) => {
    const body = route.request().postData() ? (route.request().postDataJSON() as { action?: string }) : null;
    if (body?.action === "ASSET_INSERT" && holdFirstInsert) {
      holdFirstInsert = false;
      signalInsert();
      await delayedInsert;
    }
    await route.continue();
  });
  await placement.getByRole("button", { name: "Floor", exact: true }).first().click();
  await insertRequested;
  const lateResponse = page.waitForResponse((response) => {
    if (!response.url().endsWith("/api/studio/parallax") || !response.request().postData()) return false;
    return (response.request().postDataJSON() as { action?: string }).action === "ASSET_INSERT";
  });
  await placement.getByRole("button", { name: "Cancel placement" }).click();
  await expect(placement).toBeHidden();
  releaseInsert();
  await lateResponse;
  await expect(details.getByRole("button", { name: "Place in Scene" })).toBeEnabled();
  expect(
    (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!.draft.content.entities,
  ).toHaveLength(1);
  await page.unroute(apiRoute);
  await compact.getByRole("button", { name: "Expand Spatial Library" }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded Spatial Library" });
  await expect(dialog.getByRole("searchbox", { name: "Search assets" })).toHaveValue("Reusable review clue");
  await expect(dialog.getByRole("complementary", { name: "Reusable review clue details" })).toBeVisible();
  await dialog.getByRole("button", { name: "Place in Scene" }).click();
  await expect(dialog).toBeHidden();
  await expect(placement).toBeVisible();
  await placement.getByRole("button", { name: "Floor", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  await expect(placement).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Independent released copy added" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await expect
    .poll(async () => {
      const target = (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!;
      return target.draft.content.entities.length;
    })
    .toBe(2);
  const target = (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!;
  expect(target.draft.content.studio?.assetInstances?.[0]?.definitionId).toBe(asset.definitionId);
  expect(target.draft.content.studio?.assetInstances?.[0]?.versionId).toBe(asset.versionId);
  await expect(page.getByText(/2 objects \/ \d+ safe candidates/)).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(page.getByText(/1 objects \/ \d+ safe candidates/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo", exact: true }).first()).toBeEnabled();
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await expect(page.getByText(/2 objects \/ \d+ safe candidates/)).toBeVisible();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Desk Map");
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog.getByRole("searchbox", { name: "Search assets" })).toHaveValue("Reusable review clue");
  await expect(dialog.getByRole("complementary", { name: "Reusable review clue details" })).toBeVisible();
});

test("scaled physical saved asset keeps keyboard and pointer support with animated root", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Scaled Physical Placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const room = {
    ...simulationEnvironments[0],
    id: "saved-small-table-browser-room",
    name: "Small table browser room",
    width: 4,
    depth: 4,
    features: [
      createGenericRoomFeature({ id: "floor", classification: "FLOOR", dimensions: [4, 0.16, 4], position: { x: 0, y: -0.08, z: 0 } }),
      createGenericRoomFeature({ id: "small-table", classification: "TABLE", dimensions: [0.3, 0.8, 0.3], position: { x: 0, y: 0.4, z: 0 } }),
    ],
  };
  const source = insertSpatialElement(createSpatialDraft(randomUUID(), "Scaled model source"), "candelabra", "scaled-candelabra");
  const root = source.content.entities.at(-1)!;
  root.transform.scale = 0.25;
  source.content.studio!.animationTracks = [{
    id: "root-motion", entityId: root.id, property: "POSITION", enabled: true, interpolation: "LINEAR",
    keyframes: [
      { id: "start", atMs: 0, value: { ...root.transform.position } },
      { id: "end", atMs: 1000, value: { ...root.transform.position, x: root.transform.position.x + 0.1 } },
    ],
  }];
  await saveSpatialDraft(account.id, source, 0);
  const asset = await saveReusableAsset(account.id, source, 1, root.id, {
    name: "Scaled candelabra", description: "Synthetic scaled physical fixture", classification: "Fixture",
  }, room);
  const scene = createSpatialDraft(randomUUID(), "Scaled placement scene");
  scene.content.studio!.environment = createRoomEnvironment(room);
  await saveSpatialDraft(account.id, scene, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  const renderer = page.getByRole("region", { name: "Spatial canvas" }).locator('[data-renderer="READY"]');
  await expect(renderer.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const compact = page.getByRole("region", { name: "Spatial content library", exact: true });
  await compact.getByRole("tab", { name: "Assets" }).click();
  await compact.getByRole("searchbox", { name: "Search assets" }).fill("Scaled candelabra");
  await compact.getByRole("button", { name: "Inspect Scaled candelabra" }).click();
  const details = compact.getByRole("complementary", { name: "Scaled candelabra details" });
  const table = syntheticEnvironmentEvidence(room).candidates.find((candidate) => candidate.surface === "TABLE")!;
  const placement = page.getByLabel("Place Scaled candelabra in Scene");
  await details.getByRole("button", { name: "Place in Scene" }).click();
  await expect(placement).toBeVisible();
  await placement.getByRole("button", { name: table.id.replaceAll("-", " ") }).focus();
  await page.keyboard.press("Enter");
  await expect(placement).toBeHidden();
  await expect.poll(async () => (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!.draft.content.entities.length).toBe(2);
  const keyboardScene = (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!.draft;
  const keyboardEntity = keyboardScene.content.entities.at(-1)!;
  const keyboardPose = previewEntityTransforms(keyboardScene.content, room.id, room)[keyboardEntity.id];
  expect(keyboardPose.scale).toBeCloseTo(0.25);
  expect(keyboardScene.content.studio?.assetInstances?.[0]?.versionId).toBe(asset.versionId);
  const atStart = evaluateSpatialScene(keyboardScene.content, [], 0).states[keyboardEntity.id].transform;
  const atEnd = evaluateSpatialScene(keyboardScene.content, [], 1000).states[keyboardEntity.id].transform;
  expect(atStart.position.x).toBeCloseTo(keyboardEntity.transform.position.x);
  expect(Math.hypot(atEnd.position.x - atStart.position.x, atEnd.position.y - atStart.position.y, atEnd.position.z - atStart.position.z)).toBeCloseTo(0.1);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/scaled-keyboard-placed.png`, fullPage: true });
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(page.getByText(/1 objects \/ \d+ safe candidates/)).toBeVisible();
  await details.getByRole("button", { name: "Place in Scene" }).click();
  await expect(placement).toBeVisible();
  const projected = JSON.parse((await renderer.getAttribute("data-projected-scene"))!);
  const tablePoint = projected.surfaces.find((surface: { id: string }) => surface.id === table.id);
  expect(tablePoint).toBeTruthy();
  const bounds = await renderer.boundingBox();
  await page.mouse.click(bounds!.x + tablePoint.x * bounds!.width, bounds!.y + tablePoint.y * bounds!.height);
  await expect(placement).toBeHidden();
  await expect.poll(async () => (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!.draft.content.entities.length).toBe(2);
  const pointerScene = (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!.draft;
  const pointerEntity = pointerScene.content.entities.at(-1)!;
  const pointerPose = previewEntityTransforms(pointerScene.content, room.id, room)[pointerEntity.id];
  expect(pointerPose.scale).toBeCloseTo(0.25);
  expect(Math.hypot(pointerPose.position.x - keyboardPose.position.x, pointerPose.position.y - keyboardPose.position.y, pointerPose.position.z - keyboardPose.position.z)).toBeLessThan(0.03);
  await page.screenshot({ path: `${evidence}/scaled-pointer-placed.png`, fullPage: true });
});

test("expanded Library adapts to narrow and phone layouts, themes, reduced motion, and catalog errors", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Expanded Library Layout Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(randomUUID(), "Expanded Library layout journey");
  await saveSpatialDraft(account.id, scene, 0);
  const phoneAsset = createSpatialDraft(randomUUID(), "Phone filter asset");
  phoneAsset.library = { type: "ASSET", description: "Synthetic private phone-filter fixture" };
  await saveSpatialDraft(account.id, phoneAsset, 0);
  await saveDefinitionToLibrary(account.id, phoneAsset.content.definitionId, 1);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded Spatial Library" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const searchBounds = await dialog.getByRole("searchbox").boundingBox();
  const firstCardBounds = await dialog.getByRole("article").first().boundingBox();
  const sourceBounds = await dialog.getByRole("combobox", { name: "Source", exact: true }).boundingBox();
  const showBounds = await dialog.getByRole("combobox", { name: "Show", exact: true }).boundingBox();
  const sortBounds = await dialog.getByRole("combobox", { name: "Sort", exact: true }).boundingBox();
  expect(sourceBounds!.y).toBeLessThan(firstCardBounds!.y);
  expect(showBounds!.y).toBeLessThan(firstCardBounds!.y);
  expect(sortBounds!.y).toBeLessThan(firstCardBounds!.y);
  expect(
    Math.max(sourceBounds!.y, showBounds!.y, sortBounds!.y) - Math.min(sourceBounds!.y, showBounds!.y, sortBounds!.y),
  ).toBeLessThan(12);
  expect(sourceBounds!.x).toBeLessThan(showBounds!.x);
  expect(showBounds!.x).toBeLessThan(sortBounds!.x);
  expect(firstCardBounds!.y - searchBounds!.y).toBeLessThan(190);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/expanded-narrow.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.evaluate(() => {
    document.documentElement.dataset.voyageTheme = "light";
  });
  await page.screenshot({ path: `${evidence}/expanded-light-reduced.png`, fullPage: true });
  await page.getByRole("button", { name: "Close expanded Spatial Library" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const openLibrary = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await openLibrary.getAttribute("aria-pressed")) !== "true") await openLibrary.click();
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog).toBeVisible();
  const phone = await dialog.boundingBox();
  expect(phone!.width).toBeGreaterThanOrEqual(389);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(dialog.getByLabel("Library item details")).toBeHidden();
  await page.screenshot({ path: `${evidence}/expanded-phone.png`, fullPage: true });
  const filters = dialog.getByRole("button", { name: /Filters & view/ });
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  const phoneSource = dialog.getByRole("combobox", { name: "Source", exact: true });
  await phoneSource.selectOption("MY_CREATIONS");
  await expect(dialog.getByRole("button", { name: "Inspect Phone filter asset" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Inspect Antique book" })).toHaveCount(0);
  await expect(phoneSource).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${evidence}/expanded-phone-filters-private.png`, fullPage: true });
  await phoneSource.selectOption("BUILT_IN");
  await dialog.getByRole("combobox", { name: "Sort", exact: true }).selectOption("NAME");
  const phoneShow = dialog.getByRole("combobox", { name: "Show", exact: true });
  await phoneShow.selectOption("WORKING");
  await expect(dialog.getByRole("article")).toHaveCount(0);
  await expect(dialog.getByText("No items match these filters. Clear search or choose another source.")).toBeVisible();
  await phoneShow.selectOption("ACTIVE");
  await expect(dialog.getByRole("button", { name: "Inspect Antique book" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Inspect Phone filter asset" })).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/expanded-phone-filters-built-in.png`, fullPage: true });
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await expect(phoneSource).toBeHidden();
  await filters.click();
  await expect(phoneSource).toHaveValue("BUILT_IN");
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await dialog.getByRole("button", { name: "Inspect Antique book" }).click();
  await expect(dialog.getByRole("complementary", { name: "Antique book details" })).toBeVisible();
  await page.screenshot({ path: `${evidence}/expanded-phone-selected.png`, fullPage: true });
  await page.route("**/api/studio/parallax?*view=library-catalog*", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await dialog.getByRole("searchbox").fill("temporary error");
  await expect(dialog.getByRole("alert")).toContainText("Library results could not load");
  await page.unroute("**/api/studio/parallax?*view=library-catalog*");
  await dialog.getByRole("button", { name: "Refresh results" }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("expanded Environment and Scene actions use the same saved sources and Scene Manager", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Expanded Relationships Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const environment = createEnvironmentDraft(randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  environment.name = "Expanded Library shared room";
  environment.room!.name = environment.name;
  await saveEnvironmentDraft(account.id, environment, 0);
  const released = await releaseEnvironmentVersion(account.id, environment.id, 1);
  const sceneIds: string[] = [];
  for (const title of ["Expanded Library Scene Alpha", "Expanded Library Scene Beta"]) {
    const scene = createSpatialDraft(randomUUID(), title);
    sceneIds.push(scene.content.definitionId);
    await saveSpatialDraft(account.id, scene, 0);
    const bound = await bindEnvironmentDefinition(account.id, {
      draft: scene,
      revision: 1,
      definitionId: environment.id,
      versionId: released.versionId,
    });
    await saveDefinitionToLibrary(account.id, scene.content.definitionId, bound.revision);
  }
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/studio/parallax?definition=${sceneIds[0]}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const compact = page.getByRole("region", { name: "Spatial content library", exact: true });
  await compact.getByRole("tab", { name: "Environments", exact: true }).click();
  await compact.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await compact.getByRole("searchbox").fill(environment.name);
  await compact.getByRole("button", { name: `Inspect ${environment.name}` }).click();
  const compactDetails = compact.getByRole("complementary", { name: `${environment.name} details` });
  await expect(compactDetails).toBeVisible();
  await compactDetails.getByRole("combobox", { name: "Use version" }).selectOption(released.versionId);
  await expect(compactDetails).toContainText("Private creation · no Community listing");
  await compact.getByRole("button", { name: "Expand Spatial Library" }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded Spatial Library" });
  const details = dialog.getByRole("complementary", { name: `${environment.name} details` });
  await expect(details).toBeVisible();
  await expect(dialog.getByRole("searchbox")).toHaveValue(environment.name);
  await expect(dialog.getByRole("combobox", { name: "Source", exact: true })).toHaveValue("MY_CREATIONS");
  await expect(details.getByRole("button", { name: "Place in Scene" })).toHaveCount(0);
  await details.getByRole("combobox", { name: "Use version" }).selectOption(released.versionId);
  await expect(details.getByRole("button", { name: /Publish to Community|Review publishing limits/ })).toBeEnabled();
  await expect(details).toContainText("Private creation · no Community listing");

  await details.getByRole("button", { name: "Create Scene from Environment…" }).click();
  await expect(dialog).toBeHidden();
  const manager = page.getByRole("dialog", { name: "Environments & Scenes" });
  await expect(manager.getByRole("combobox", { name: "Browse Environment" })).toHaveValue(environment.id);
  expect(await listSpatialItems(account.id)).toHaveLength(2);
  await manager.getByRole("button", { name: "Close Scene Manager" }).click();

  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog.getByRole("complementary", { name: `${environment.name} details` })).toBeVisible();
  await dialog.getByRole("button", { name: "View associated Scenes" }).click();
  await expect(dialog.getByRole("tab", { name: "Scenes", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("combobox", { name: "Environment", exact: true })).toHaveValue(environment.id);
  await expect(dialog.getByRole("article")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Inspect Expanded Library Scene Beta" }).click();
  const sceneDetails = dialog.getByRole("complementary", { name: "Expanded Library Scene Beta details" });
  await expect(sceneDetails).toContainText(environment.name);
  await expect(sceneDetails.getByRole("button", { name: "Place in Scene" })).toHaveCount(0);
  const detailsOverflow = await sceneDetails.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(detailsOverflow).toBeGreaterThan(0);
  await sceneDetails.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(sceneDetails.getByRole("button", { name: "Duplicate Scene…" })).toBeInViewport();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/expanded-scene-actions.png`, fullPage: true });
  await sceneDetails.getByRole("button", { name: "Duplicate Scene…" }).click();
  await expect(dialog).toBeHidden();
  await expect(manager.getByRole("combobox", { name: "Scene source" })).toHaveValue(sceneIds[1]);
  expect(await listSpatialItems(account.id)).toHaveLength(2);
  await manager.getByRole("textbox", { name: "Scene name" }).fill("Expanded Library Scene Copy");
  await manager.getByRole("button", { name: "Duplicate Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("created as an independent");
  const items = await listSpatialItems(account.id);
  expect(items).toHaveLength(3);
  expect(
    items.find((item) => item.draft.content.title === "Expanded Library Scene Copy")?.draft.content.environment
      ?.versionId,
  ).toBe(released.versionId);
  await manager.getByRole("button", { name: "Close Scene Manager" }).click();
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog.getByRole("tab", { name: "Scenes", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("button", { name: "Inspect Expanded Library Scene Copy" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Environment and Scene" })).toContainText(
    "Expanded Library Scene Copy",
  );
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/expanded-scene-relationships.png`, fullPage: true });
});
