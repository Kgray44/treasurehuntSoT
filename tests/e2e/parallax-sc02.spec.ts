import { saveCurrentWorkingDraft } from "./fixtures/parallax-current-library";
import { test, expect, type Locator, type Page } from "@playwright/test";
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

test.describe.configure({ mode: "default", timeout: 240000 });
test.use({ video: { mode: "on", size: { width: 1440, height: 900 } } });
test.afterAll(() => db.$disconnect());

const presetKind = (name: string) =>
  name.startsWith("Ghostly Presence")
    ? "Compositions"
    : ["Point light", "Spatial ambience"].includes(name)
      ? "Effects"
      : "Assets";

async function openCurrentLibrary(page: Page, kind: string) {
  const open = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await open.getAttribute("aria-pressed")) !== "true") await open.click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: kind, exact: true }).click();
  return library;
}

async function addCurrentPreset(page: Page, name: string) {
  const library = await openCurrentLibrary(page, presetKind(name));
  await library.getByRole("searchbox").fill(name);
  await library.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
  const details = library.getByRole("complementary", { name: `${name} details`, exact: true });
  await details.getByRole("button", { name: "Add to active Scene", exact: true }).click();
}

async function reuseCurrentComposition(page: Page) {
  const name = "Ghostly Presence";
  const library = await openCurrentLibrary(page, "Compositions");
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await library.getByRole("searchbox").fill(name);
  await library.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
  await library
    .getByRole("complementary", { name: `${name} details`, exact: true })
    .getByRole("button", { name: "Add saved composition", exact: true })
    .click();
}
const evidence =
  process.env.SC02_EVIDENCE_DIR ??
  `artifacts/parallax-a1/sc02/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

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
  await expect(page.getByRole("heading", { name: "Parallax", level: 1 })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Environment and Scene", exact: true })
      .locator("div")
      .filter({ has: page.getByText("EDITING SCENE", { exact: true }) })
      .locator("strong"),
  ).toHaveText("Desk Map");
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("CONSTRUCTION");
  const canvas = page.locator('[data-renderer="READY"] canvas'),
    instrument = page.locator('[data-renderer="READY"]');
  await expect(canvas).toBeVisible();
  const add = (name: string) => addCurrentPreset(page, name);
  await add("Treasure chest");
  await page.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.screenshot({ path: `${evidence}/treasure-chest-desktop.png`, fullPage: true });
  await add("Point light");
  await page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true }).fill("35");
  await page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true }).blur();
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
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await page.getByRole("button", { name: "Save selected composition", exact: true }).click();
  await expect
    .poll(async () => (await listSpatialItems(account.id)).filter((i) => i.draft.tags.includes("composition")).length)
    .toBe(1);
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await page
    .getByRole("region", { name: "Scene graph", exact: true })
    .locator("button[data-graph-entity]")
    .filter({ hasText: "Ghostly Presence · Point light" })
    .click({ position: { x: 8, y: 8 } });
  await page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true }).fill("22");
  await page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true }).blur();
  await reuseCurrentComposition(page);
  await saveCurrentWorkingDraft(page);
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
  await page.getByRole("button", { name: "Disable preview audio", exact: true }).click();
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
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("SPATIAL");
  const resetLayout = page.getByRole("button", { name: "Reset Workspace Layout", exact: true });
  const resetBox = await resetLayout.boundingBox();
  expect(resetBox!.x + resetBox!.width).toBeLessThanOrEqual(390);
  const constrained = {
    canvas: await canvas.boundingBox(),
    document: await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
    })),
  };
  await writeFile(`${evidence}/constrained-layout.json`, JSON.stringify(constrained, null, 2) + "\n");
  expect(constrained.canvas!.width).toBeGreaterThan(250);
  expect(constrained.canvas!.height).toBeGreaterThan(300);
  expect(constrained.document.width).toBeLessThanOrEqual(390);
  expect(constrained.document.height).toBeLessThanOrEqual(constrained.document.viewportHeight + 2);
  const viewDisclosure = page.getByText("View & audio", { exact: true });
  await viewDisclosure.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Enable preview audio", exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/constrained-view-controls.png`, fullPage: true });
  await viewDisclosure.focus();
  await page.keyboard.press("Enter");
  expect(await canvas.boundingBox()).toEqual(constrained.canvas);
  const tools = page.getByRole("toolbar", { name: "Spatial editing tools" });
  const disclosureBox = (await viewDisclosure.boundingBox())!;
  const toolBox = (await tools.boundingBox())!;
  expect(disclosureBox.y + disclosureBox.height).toBeLessThanOrEqual(toolBox.y);
  for (const name of ["Select", "Move", "Rotate", "Scale", "Select"]) {
    const button = tools.getByRole("button", { name: `${name} tool`, exact: true });
    await button.click({ timeout: 5000 });
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  const snapping = tools.getByRole("button", { name: "Toggle snapping", exact: true });
  const wasSnapping = await snapping.getAttribute("aria-pressed");
  await snapping.click({ timeout: 5000 });
  await expect(snapping).toHaveAttribute("aria-pressed", String(wasSnapping !== "true"));
  await snapping.click({ timeout: 5000 });
  await expect(snapping).toHaveAttribute("aria-pressed", wasSnapping!);
  await writeFile(
    `${evidence}/constrained-controls.json`,
    JSON.stringify({ disclosureBox, toolBox, pointerTools: ["Select", "Move", "Rotate", "Scale", "Snap"] }, null, 2) +
      "\n",
  );
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
  for (const [i, id] of [
    "symbol",
    "footprints",
    "writing",
    "portal",
    "spot-light",
    "ambient-light",
    "mist",
  ].entries()) {
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
    if (id === "mist") entity.transform.position = { x: 0, y: 0.65, z: 0.5 };
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
    // Use an intentionally visible configured fill/density for causal comparison;
    // the gentle defaults are not intended to overpower the Gallery's sunlight.
    if (id === "ambient-light") {
      const intensity = page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true });
      await intensity.fill("2");
      await intensity.blur();
    }
    if (id === "mist") {
      const density = page.getByRole("spinbutton", { name: "Mist density numeric value", exact: true });
      await density.fill("0.06");
      await density.blur();
    }
    await page.screenshot({ path: `${evidence}/effect-${id}.png`, fullPage: true });
    const metrics = JSON.parse((await instrument.getAttribute("data-performance"))!);
    let parameterChangedPixels: number | null = null;
    if (id.endsWith("light") || id === "mist") {
      const canvas = instrument.locator("canvas");
      const on = await sharp(await canvas.screenshot({ path: `${evidence}/effect-${id}-on-canvas.png` }))
        .ensureAlpha()
        .raw()
        .toBuffer();
      // Keep the element enabled and its selection bounds unchanged while setting only
      // the actual light intensity or mist density to zero.
      const parameter = page.getByRole("spinbutton", {
        name: `${id === "mist" ? "Mist density" : "Light intensity"} numeric value`,
        exact: true,
      });
      await parameter.fill("0");
      await parameter.blur();
      await page.screenshot({ path: `${evidence}/effect-${id}-zero.png`, fullPage: true });
      const off = await sharp(await canvas.screenshot({ path: `${evidence}/effect-${id}-off-canvas.png` }))
        .ensureAlpha()
        .raw()
        .toBuffer();
      parameterChangedPixels = 0;
      for (let p = 0; p < on.length; p += 4)
        if (Math.abs(on[p] - off[p]) + Math.abs(on[p + 1] - off[p + 1]) + Math.abs(on[p + 2] - off[p + 2]) > 30)
          parameterChangedPixels++;
      expect(parameterChangedPixels).toBeGreaterThan(20);
    }
    observations.push({
      id,
      metrics,
      parameterChangedPixels,
      comparisonSetting:
        id === "ambient-light"
          ? { intensity: 2 }
          : id === "mist"
            ? { density: 0.06 }
            : id === "spot-light"
              ? { intensity: 18 }
              : null,
    });
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

test("SC-02 Creator authors and reuses elements with native keyboard navigation and returns from assistance", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC02 Keyboard");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const navigation: { target: string; tabs: number }[] = [];
  const tabTo = async (target: Locator, name: string) => {
    await expect(target).toHaveCount(1);
    for (let tabs = 0; tabs < 350; tabs++) {
      if (await target.evaluate((element) => element === document.activeElement)) {
        navigation.push({ target: name, tabs });
        return;
      }
      await page.keyboard.press("Tab");
    }
    throw new Error(`Native Tab navigation did not reach ${name}`);
  };
  const activate = async (target: Locator, name: string) => {
    await tabTo(target, name);
    await page.keyboard.press("Enter");
  };
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  const ensureLibrary = async () => {
    const open = page.getByRole("button", { name: "Open Library", exact: true });
    if ((await open.getAttribute("aria-pressed")) !== "true") await activate(open, "Open Library");
  };
  const search = async (text: string) => {
    await ensureLibrary();
    const kind = presetKind(text);
    await tabTo(library.getByRole("tab", { selected: true }), "Current Library category");
    for (
      let index = 0;
      index < 5 &&
      (await library.getByRole("tab", { name: kind, exact: true }).getAttribute("aria-selected")) !== "true";
      index++
    ) {
      await page.keyboard.press("ArrowRight");
    }
    await expect(library.getByRole("tab", { name: kind, exact: true })).toHaveAttribute("aria-selected", "true");
    await tabTo(library.getByRole("searchbox"), "Search Library");
    await page.keyboard.press("Control+A");
    await page.keyboard.type(text);
  };
  const preparePreset = async (name: string) => {
    await search(name);
    await activate(library.getByRole("button", { name: `Inspect ${name}`, exact: true }), `Inspect ${name}`);
    const add = library
      .getByRole("complementary", { name: `${name} details`, exact: true })
      .getByRole("button", { name: "Add to active Scene", exact: true });
    await tabTo(add, `Add ${name} to active Scene`);
  };
  await page.goto("/studio/library");
  await activate(page.getByRole("link", { name: "Spatial Studio", exact: true }), "Spatial Studio entry");
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await ensureLibrary();
  await search("zzzz-no-synthetic-match");
  await expect(
    library.getByText("No items match these filters. Clear search or choose another source.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/keyboard-empty-search.png`, fullPage: true });
  await preparePreset("Treasure chest");
  await page.keyboard.press("Enter");
  const chest = physicalAssets.find((a) => a.id === "treasure-chest")!;
  await activate(
    page.getByRole("button", { name: `${chest.name}. ${chest.description}`, exact: true }),
    "Keyboard spatial selection: Treasure chest",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#parallax-canvas-feedback")).toContainText("transform edited");
  const focus = await page.locator(":focus").evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: element.getAttribute("aria-label"), outline: style.outline, boxShadow: style.boxShadow };
  });
  await page.screenshot({ path: `${evidence}/keyboard-object-focus.png`, fullPage: true });
  await preparePreset("Point light");
  const feedbackStart = Date.now();
  await page.keyboard.press("Enter");
  const intensity = page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true });
  await expect(intensity).toBeVisible({ timeout: 3000 });
  const inspectorFeedbackMs = Date.now() - feedbackStart;
  await tabTo(intensity, "Light intensity");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("24");
  await expect(intensity).toHaveValue("24");
  await preparePreset("Ghostly Presence");
  await page.keyboard.press("Enter");
  await activate(page.getByRole("button", { name: "Open spatial context", exact: true }), "Open spatial context");
  await activate(
    page.getByRole("button", { name: "Save selected composition", exact: true }),
    "Save selected composition",
  );
  await expect
    .poll(async () => (await listSpatialItems(account.id)).filter((i) => i.draft.tags.includes("composition")).length)
    .toBe(1);
  await search("Ghostly Presence");
  const savedSource = library.getByRole("combobox", { name: "Source", exact: true });
  await tabTo(savedSource, "Saved composition source");
  await page.keyboard.press("Home");
  const sourceOptions = await savedSource.locator("option").count();
  for (let option = 0; option < sourceOptions && (await savedSource.inputValue()) !== "MY_CREATIONS"; option++) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(savedSource).toHaveValue("MY_CREATIONS");
  await activate(
    library.getByRole("button", { name: "Inspect Ghostly Presence", exact: true }),
    "Inspect saved composition",
  );
  await activate(
    library
      .getByRole("complementary", { name: "Ghostly Presence details", exact: true })
      .getByRole("button", { name: "Add saved composition", exact: true }),
    "Insert saved composition",
  );
  await tabTo(page.getByRole("button", { name: "Save to Library", exact: true }), "Scene header actions");
  await page.keyboard.press("Shift+F10");
  await activate(page.getByRole("menuitem", { name: "Save draft", exact: true }), "Save draft");
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const definition = new URL(page.url()).searchParams.get("definition")!;
  const saved = (await listSpatialItems(account.id)).find((i) => i.id === definition)!.draft;
  expect(saved.content.entities.filter((entity) => entity.name === "Ghostly Presence")).toHaveLength(2);
  expect(
    saved.content.entities.find((entity) => entity.element?.kind === "PHYSICAL_ASSET")!.transform.position.x,
  ).toBeCloseTo(0.05);
  expect(saved.content.entities.find((entity) => entity.element?.kind === "LIGHT")!.element).toMatchObject({
    intensity: 24,
  });
  await activate(page.getByRole("button", { name: "Frame scene", exact: true }), "Frame scene");
  const beforeAssistance = await page.locator('[data-renderer="READY"] canvas').boundingBox();
  await page.keyboard.press("/");
  const prompt = page.locator("#parallax-assistance textarea");
  await expect(prompt).toBeFocused();
  await page.screenshot({ path: `${evidence}/keyboard-assistance-focus.png`, fullPage: true });
  const withAssistance = await page.locator('[data-renderer="READY"] canvas').boundingBox();
  expect(Math.abs(beforeAssistance!.width - withAssistance!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(beforeAssistance!.height - withAssistance!.height)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Ask Parallax", exact: true })).toBeFocused();
  await expect(prompt).not.toBeVisible();
  await page.screenshot({ path: `${evidence}/keyboard-assistance-return.png`, fullPage: true });
  await activate(page.getByRole("link", { name: "← Creator Studio", exact: true }), "Return to Creator Studio");
  await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/keyboard-creator-return.png`, fullPage: true });
  expect((await listSpatialItems(account.id)).find((i) => i.id === definition)!.draft).toEqual(saved);
  await writeFile(
    `${evidence}/keyboard-journey.json`,
    JSON.stringify(
      {
        source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        navigation,
        focus,
        inspectorFeedbackMs,
        beforeAssistance,
        withAssistance,
        definitionId: definition,
        persistedEntities: saved.content.entities.length,
        proof:
          "Native Tab, Enter, arrows, text entry, slash and Escape; no locator focus or mouse calls in this journey",
        limits: ["Synthetic authenticated desktop Chromium; no assistive technology or physical device acceptance"],
      },
      null,
      2,
    ) + "\n",
  );
});

test("SC-02 preserves a failed save and recovers audio from unavailable and Guided preview states", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC02 Recovery");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const target = window as unknown as { AudioContext: typeof AudioContext; __sc02RestoreAudio?: () => void };
    const original = target.AudioContext;
    target.__sc02RestoreAudio = () => {
      target.AudioContext = original;
    };
    target.AudioContext = function () {
      throw new Error("Synthetic unavailable audio device");
    } as unknown as typeof AudioContext;
  });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  const instrument = page.locator('[data-renderer="READY"]');
  await expect(instrument.locator("canvas")).toBeVisible();
  let recoverSave = false;
  let failedSaves = 0;
  await page.route("**/api/studio/parallax", async (route) => {
    const request = route.request();
    const data = request.method() === "POST" ? request.postDataJSON() : null;
    if (
      !recoverSave &&
      data?.action === "SAVE" &&
      data.draft?.content.entities.some(
        (entity: { element?: { kind: string } }) => entity.element?.kind === "SPATIAL_AUDIO",
      )
    ) {
      failedSaves++;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic save unavailable. Your scene remains editable." }),
      });
    } else await route.continue();
  });
  await addCurrentPreset(page, "Spatial ambience");
  await saveCurrentWorkingDraft(page);
  const saveAlert = page.getByRole("main").getByRole("alert");
  await expect(saveAlert).toContainText("Synthetic save unavailable");
  await page.screenshot({ path: `${evidence}/recovery-save-unavailable.png`, fullPage: true });
  recoverSave = true;
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  await expect(saveAlert).toHaveCount(0);
  const definition = new URL(page.url()).searchParams.get("definition")!;
  const saved = (await listSpatialItems(account.id)).find((item) => item.id === definition)!.draft;
  expect(saved.content.entities.some((entity) => entity.element?.kind === "SPATIAL_AUDIO")).toBe(true);
  await page.screenshot({ path: `${evidence}/recovery-save-restored.png`, fullPage: true });
  const enable = page.getByRole("button", { name: "Enable preview audio", exact: true });
  const feedback = page.locator("#parallax-canvas-feedback");
  await enable.click();
  await expect(feedback).toContainText("Preview audio is unavailable");
  await expect(feedback).toHaveAttribute("aria-live", "polite");
  await expect(enable).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: `${evidence}/recovery-audio-unavailable.png`, fullPage: true });
  await page.evaluate(() => (window as unknown as { __sc02RestoreAudio: () => void }).__sc02RestoreAudio());
  await enable.click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).audioSources).toBe(1);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).audioSources).toBe(0);
  await page.getByLabel("Preview", { exact: true }).selectOption("FALLBACK");
  await expect(enable).toBeVisible();
  await enable.click();
  await expect(enable).toHaveAttribute("aria-pressed", "false");
  await expect(feedback).toContainText("Preview audio is unavailable");
  await expect(
    page
      .getByRole("region", { name: "Spatial canvas", exact: true })
      .getByRole("button", { name: "Spatial ambience", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/recovery-guided-text.png`, fullPage: true });
  await page.getByLabel("Preview", { exact: true }).selectOption("EDITOR");
  await expect(instrument.locator("canvas")).toBeVisible();
  await enable.click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).audioSources).toBe(1);
  await page.screenshot({ path: `${evidence}/recovery-audio-restored.png`, fullPage: true });
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).audioSources).toBe(0);
  await page.getByRole("button", { name: "Disable preview audio", exact: true }).click();
  await writeFile(
    `${evidence}/recovery-journey.json`,
    JSON.stringify(
      {
        source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        definitionId: definition,
        failedSaves,
        retainedEntities: saved.content.entities.length,
        observed: [
          "503 save visibly failed",
          "Retry saved canonical draft",
          "Unavailable audio remained disabled and announced feedback",
          "Restored AudioContext produced one source",
          "Guided preview preserved text and refused false audio activation",
          "Editor return resumed one source and pause reclaimed it",
        ],
        limits: [
          "Injected faults in actual app; no perceived sound, assistive technology, physical device or owner acceptance",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});

test("SC-02 measures a composed Scene and reclaims temporary model resources", async ({ page, context, baseURL }) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC02 Performance");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  let draft = createAssetShowcase(`sc02-perf-${account.id.slice(0, 16)}`, "Furniture");
  draft = insertSpatialElement(draft, "ghostly-presence", "performance-composition");
  await saveSpatialDraft(account.id, draft, 0);
  const started = Date.now();
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  const instrument = page.locator('[data-renderer="READY"]');
  await expect(instrument).toHaveAttribute("data-rendered", "true");
  const sceneReadyMs = Date.now() - started;
  await page.getByLabel("Environment", { exact: true }).selectOption("gallery");
  await page.getByRole("button", { name: "Frame scene", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  const observations = [];
  for (const quality of ["LOW", "MEDIUM", "HIGH"]) {
    await page.getByLabel("Preview quality", { exact: true }).selectOption(quality);
    await expect
      .poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).quality)
      .toBe(quality);
    const sample = await instrument.evaluate(async (element) => {
      const start = performance.now();
      const samples: {
        atMs: number;
        renderMs: number;
        calls: number;
        triangles: number;
        geometries: number;
        textures: number;
        quality: string;
      }[] = [];
      const heap = () =>
        (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
      const heapBefore = heap();
      await new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          samples.push({ atMs: performance.now() - start, ...JSON.parse(element.getAttribute("data-performance")!) });
        });
        observer.observe(element, { attributes: true, attributeFilter: ["data-performance"] });
        setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 4000);
      });
      return { elapsedMs: performance.now() - start, samples, heapBefore, heapAfter: heap() };
    });
    expect(sample.samples.length).toBeGreaterThan(10);
    expect(sample.samples.every((frame) => Number.isFinite(frame.renderMs) && frame.calls > 0)).toBe(true);
    observations.push({ quality, ...sample });
    await page.screenshot({ path: `${evidence}/performance-${quality.toLowerCase()}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const baseline = JSON.parse((await instrument.getAttribute("data-performance"))!);
  const resourceCycles = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    await addCurrentPreset(page, "Treasure chest");
    await expect
      .poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).geometries)
      .toBeGreaterThan(baseline.geometries);
    const added = JSON.parse((await instrument.getAttribute("data-performance"))!);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).geometries)
      .toBe(baseline.geometries);
    await expect
      .poll(async () => JSON.parse((await instrument.getAttribute("data-performance"))!).textures)
      .toBe(baseline.textures);
    resourceCycles.push({
      cycle: cycle + 1,
      added,
      reclaimed: JSON.parse((await instrument.getAttribute("data-performance"))!),
    });
  }
  await page.screenshot({ path: `${evidence}/performance-resources-reclaimed.png`, fullPage: true });
  await writeFile(
    `${evidence}/performance-observations.json`,
    JSON.stringify(
      {
        source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        sceneReadyMs,
        entities: draft.content.entities.length,
        baseline,
        observations,
        resourceCycles,
        limits: [
          "One synthetic software-WebGL desktop Scene and three four-second windows",
          "renderMs is CPU render submission time, not GPU completion or sustained device FPS",
          "Mutation intervals describe application renderer updates, not display refresh",
          "Heap samples are raw optional Chromium observations without forced GC; they do not establish leak freedom",
          "Three add/Undo cycles establish bounded geometry/texture reclamation only; no physical/native/owner acceptance",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});
