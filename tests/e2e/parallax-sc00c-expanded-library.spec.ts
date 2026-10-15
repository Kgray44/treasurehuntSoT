import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { listSpatialItems, saveSpatialDraft } from "../../src/parallax/library-service";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import {
  releaseEnvironmentVersion,
  saveDefinitionToLibrary,
  saveEnvironmentDraft,
  useEnvironmentDefinition as bindEnvironmentDefinition,
} from "../../src/parallax/library-lifecycle-service";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
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
  const viewportCanvas = page.getByRole("region", { name: "Spatial canvas" }).locator("canvas").first();
  const renderer = page.getByRole("region", { name: "Spatial canvas" }).locator('[data-renderer="READY"]');
  await expect(renderer.locator("canvas")).toBeVisible();
  await expect(renderer).toHaveAttribute("data-projected-scene", /"camera"/);
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
  await expect.poll(async () => JSON.parse((await renderer.getAttribute("data-projected-scene"))!).camera[1]).toBeGreaterThan(8);
  const cameraBeforeLibrary = JSON.parse((await renderer.getAttribute("data-projected-scene"))!).camera as number[];
  await viewportCanvas.evaluate((canvas) => { canvas.dataset.libraryMountProbe = "original"; });
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
  expect(Math.max(sourceBounds!.y, showBounds!.y, sortBounds!.y) - Math.min(sourceBounds!.y, showBounds!.y, sortBounds!.y)).toBeLessThan(12);
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
  await expect(compact.getByRole("complementary", { name: `${environment.name} details` })).toBeVisible();
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
  await sceneDetails.evaluate((element) => { element.scrollTop = element.scrollHeight; });
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
  expect(items.find((item) => item.draft.content.title === "Expanded Library Scene Copy")?.draft.content.environment?.versionId).toBe(
    released.versionId,
  );
  await manager.getByRole("button", { name: "Close Scene Manager" }).click();
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog.getByRole("tab", { name: "Scenes", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("button", { name: "Inspect Expanded Library Scene Copy" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Environment and Scene" })).toContainText("Expanded Library Scene Copy");
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/expanded-scene-relationships.png`, fullPage: true });
});
