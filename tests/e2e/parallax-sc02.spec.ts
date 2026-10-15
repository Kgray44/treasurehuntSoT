import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { listSpatialItems, saveSpatialDraft } from "../../src/parallax/library-service";
import { createAssetShowcase, insertSpatialElement } from "../../src/parallax/element-authoring";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { physicalAssets } from "../../src/parallax/asset-catalog";
import sharp from "sharp";
import { execFileSync } from "node:child_process";

test.describe.configure({ mode: "serial", timeout: 240000 });
test.use({ video: { mode: "on", size: { width: 1440, height: 900 } } });
test.afterAll(() => db.$disconnect());
const evidence = "Development_Docs/Projects/Project_Parallax/evidence/sc02/product";

test("SC-02 Creator places real assets, edits a light, saves and reuses a composition, then reloads the same Scene", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC02 Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  const canvas = page.locator('[data-renderer="READY"] canvas'),
    instrument = page.locator('[data-renderer="READY"]');
  await expect(canvas).toBeVisible();
  const library = page.getByRole("region", { name: "Spatial asset browser" });
  const add = async (name: string) => {
    await page.getByLabel("Search spatial assets").fill(name);
    await library.getByRole("button", { name: `Add ${name}`, exact: true }).click();
  };
  await add("Treasure chest");
  await page.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.screenshot({ path: `${evidence}/treasure-chest-desktop.png`, fullPage: true });
  await add("Point light");
  await page.getByLabel("Light intensity", { exact: true }).fill("35");
  await page.getByLabel("Element color", { exact: true }).fill("#3e84ff");
  await page.screenshot({ path: `${evidence}/real-point-light-enabled.png`, fullPage: true });
  const lightOn = await canvas.screenshot({ path: `${evidence}/light-on-canvas.png` });
  await page.getByLabel("Element enabled", { exact: true }).uncheck();
  await page.screenshot({ path: `${evidence}/real-point-light-disabled.png`, fullPage: true });
  const lightOff = await canvas.screenshot({ path: `${evidence}/light-off-canvas.png` });
  const on = await sharp(lightOn).ensureAlpha().raw().toBuffer(),
    off = await sharp(lightOff).ensureAlpha().raw().toBuffer();
  let lightChangedPixels = 0;
  for (let i = 0; i < on.length; i += 4)
    if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 30)
      lightChangedPixels++;
  expect(lightChangedPixels).toBeGreaterThan(500);
  await page.getByLabel("Element enabled", { exact: true }).check();
  await add("Ghostly Presence");
  await page.getByRole("button", { name: "Save selected composition", exact: true }).click();
  await expect
    .poll(async () => (await listSpatialItems(account.id)).filter((i) => i.draft.tags.includes("composition")).length)
    .toBe(1);
  await page.getByRole("tab", { name: "Hierarchy", exact: true }).click();
  await page
    .getByRole("region", { name: "Scene graph" })
    .getByRole("button", { name: "↳ Ghostly Presence · Point light", exact: true })
    .click();
  await page.getByLabel("Light intensity", { exact: true }).fill("22");
  await page.getByRole("tab", { name: "Saved", exact: true }).click();
  await page.getByRole("button", { name: "Insert Ghostly Presence composition", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const definition = new URL(page.url()).searchParams.get("definition")!;
  const saved = (await listSpatialItems(account.id)).find((i) => i.id === definition)!.draft;
  expect(saved.content.entities.filter((e) => e.name === "Ghostly Presence")).toHaveLength(2);
  await page.reload();
  await expect(canvas).toBeVisible();
  expect((await listSpatialItems(account.id)).find((i) => i.id === definition)!.draft).toEqual(saved);
  await page.getByRole("button", { name: "Enable preview audio", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).audioSources).toBe(2);
  await page.waitForTimeout(2200); // Observe the authored two-second entrance, not only the first fade frame.
  await page.screenshot({ path: `${evidence}/composition-simulation.png`, fullPage: true });
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).audioSources).toBe(0);
  await page.getByRole("button", { name: "Mute preview audio", exact: true }).click();
  const metrics = JSON.parse((await instrument.getAttribute("data-performance"))!);
  expect(metrics.geometries).toBeGreaterThan(0);
  const setup = await (await page.request.get("/api/studio/parallax")).json(),
    preferences = await (await page.request.get("/api/passport/preferences")).json();
  for (const theme of ["DARK", "LIGHT"]) {
    const response = await page.request.put("/api/passport/preferences", {
      headers: { "x-csrf-token": setup.csrfToken },
      data: {
        preferences: {
          ...preferences.preferences,
          experience: { ...preferences.preferences.experience, theme, motion: "REDUCED" },
        },
      },
    });
    expect(response.ok()).toBe(true);
    await page.reload();
    await expect(instrument).toHaveAttribute("data-appearance", theme.toLowerCase());
    await page.getByRole("button", { name: "Frame scene", exact: true }).click();
    await page.screenshot({ path: `${evidence}/composition-${theme.toLowerCase()}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Workspace layout").selectOption("SPATIAL");
  const resetLayout = page.getByRole("button", { name: "Reset Workspace Layout", exact: true });
  const resetBox = await resetLayout.boundingBox();
  expect(resetBox!.x + resetBox!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${evidence}/composition-constrained.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(
    (
      await page.request.put("/api/passport/preferences", {
        headers: { "x-csrf-token": setup.csrfToken },
        data: {
          preferences: {
            ...preferences.preferences,
            experience: { ...preferences.preferences.experience, theme: "LIGHT", motion: "FULL" },
          },
        },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await page.screenshot({ path: `${evidence}/composition-normal-motion.png`, fullPage: true });
  await writeFile(
    `${evidence}/creator-journey.json`,
    JSON.stringify(
      {
        source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        definitionId: definition,
        entities: saved.content.entities.length,
        metrics,
        lightChangedPixels,
        errors,
        limits: ["Synthetic browser, not physical or native proof", "No owner acceptance"],
      },
      null,
      2,
    ) + "\n",
  );
  expect(errors).toEqual([]);
  await page.getByRole("link", { name: "← Creator Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
});

test("SC-02 actual Studio renders every model family and three composed scenes with finite instrumentation", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC02 Showcase");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const observations = [];
  for (const [i, family] of [...new Set(physicalAssets.map((a) => a.family))].entries()) {
    const draft = createAssetShowcase(`sc02-${account.id.slice(0, 20)}-${i}`, family);
    await saveSpatialDraft(account.id, draft, 0);
    await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
    const canvas = page.locator('[data-renderer="READY"] canvas');
    await expect(canvas).toBeVisible();
    const instrument = page.locator('[data-renderer="READY"]');
    await expect(instrument).toHaveAttribute("data-rendered", "true");
    await page.getByLabel("Environment", { exact: true }).selectOption("gallery");
    await page.getByRole("button", { name: "Frame scene", exact: true }).click();
    const metrics = JSON.parse((await instrument.getAttribute("data-performance"))!);
    expect(metrics.triangles).toBeGreaterThan(1000);
    observations.push({ family, metrics });
    await page.screenshot({ path: `${evidence}/family-${i}.png`, fullPage: true });
    for (const asset of physicalAssets.filter((a) => a.family === family)) {
      const selection = page.getByRole("button", { name: `${asset.name}. ${asset.description}`, exact: true });
      await selection.focus();
      await selection.press("Enter");
      await page.getByRole("button", { name: "Frame selection", exact: true }).click();
      await page.screenshot({ path: `${evidence}/model-${asset.id}.png`, fullPage: true });
    }
  }
  for (const [i, id] of ["ghostly-presence", "haunted-treasure", "lantern-embers"].entries()) {
    const draft = insertSpatialElement(
      createSpatialDraft(`sc02-composed-${account.id.slice(0, 16)}-${i}`),
      id,
      `root-${i}`,
    );
    await saveSpatialDraft(account.id, draft, 0);
    await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
    await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
    await page.getByLabel("Environment", { exact: true }).selectOption("gallery");
    await page.getByRole("button", { name: "Frame scene", exact: true }).click();
    await page.screenshot({ path: `${evidence}/composed-${id}.png`, fullPage: true });
  }
  await writeFile(
    `${evidence}/showcase-observations.json`,
    JSON.stringify({ observations, proof: "ACTUAL_AUTHENTICATED_STUDIO_SYNTHETIC_SCENES" }, null, 2) + "\n",
  );
});

test("SC-02 Studio visibly executes projected effects, a portal and additional light types", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC02 Effects");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const observations = [];
  for (const [i, id] of ["symbol", "footprints", "writing", "portal", "spot-light", "ambient-light"].entries()) {
    let draft = createSpatialDraft(`sc02-effects-${account.id.slice(0, 16)}-${i}`);
    draft.content.entities = [];
    draft.content.anchors = [];
    draft.content.studio!.layers = [];
    if (id.endsWith("light")) {
      draft = insertSpatialElement(draft, "treasure-chest", `chest-${i}`);
      draft.content.entities.at(-1)!.transform.position = { x: 0, y: 0, z: 0 };
    }
    draft = insertSpatialElement(draft, id, `effect-${i}`);
    const entity = draft.content.entities.at(-1)!;
    if (id === "symbol" || id === "writing") entity.transform.position = { x: -2.85, y: 1.2, z: -3.86 };
    if (id === "portal") entity.transform.position = { x: 0, y: 1, z: 0 };
    if (id.endsWith("light")) entity.transform.position = { x: 0, y: 1.7, z: 1.5 };
    if (id === "spot-light")
      entity.transform.rotation = { x: Math.sin(-Math.PI / 8), y: 0, z: 0, w: Math.cos(-Math.PI / 8) };
    draft.content.title = entity.name;
    await saveSpatialDraft(account.id, draft, 0);
    await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
    const instrument = page.locator('[data-renderer="READY"]');
    await expect(instrument.locator("canvas")).toBeVisible();
    await page.getByLabel("Environment", { exact: true }).selectOption("gallery");
    const selection = page.getByRole("button", { name: `${entity.name}. ${entity.alternativeText}`, exact: true });
    await selection.focus();
    await selection.press("Enter");
    await page
      .getByRole("button", { name: id.endsWith("light") ? "Frame scene" : "Frame selection", exact: true })
      .click();
    await page.screenshot({ path: `${evidence}/effect-${id}.png`, fullPage: true });
    observations.push({ id, metrics: JSON.parse((await instrument.getAttribute("data-performance"))!) });
  }
  await writeFile(
    `${evidence}/effect-observations.json`,
    JSON.stringify(
      {
        source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        observations,
        limits: ["Rendered local software-WebGL views; no physical, native or owner acceptance"],
      },
      null,
      2,
    ) + "\n",
  );
});
