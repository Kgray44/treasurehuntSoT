import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { addRoomFeature } from "../../src/parallax/parametric-room";
import { insertSpatialElement } from "../../src/parallax/element-authoring";
import { saveEditingGroup } from "../../src/parallax/editing-groups";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("SC-00B combined Inspector covers eleven selection contexts at each authoring depth", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(300000);
  const account = await closureAccount("Synthetic SC-00B Combined Inspector Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("sc00b-combined", "Desk Map");
  draft.content.title = "Inspector acceptance workshop";
  draft = insertSpatialElement(draft, "articulated-chest", "furniture");
  draft = insertSpatialElement(draft, "point-light", "light");
  draft = insertSpatialElement(draft, "spatial-ambience", "audio");
  draft = insertSpatialElement(draft, "interaction-region", "trigger");
  draft.content.entities.find((entity) => entity.id === "audio")!.element!.playback = {
    startMs: 0,
    durationMs: 60000,
    fadeInMs: 2000,
    fadeOutMs: 1000,
    loop: false,
  };
  let room = createRoomEnvironment(simulationEnvironments.find((entry) => entry.id === "empty")!);
  room = addRoomFeature(room, "TABLE", "work-table");
  room = addRoomFeature(room, "EXCLUSION_ZONE", "reserved-area");
  draft.content.studio!.environment = room;
  draft = saveEditingGroup(
    draft,
    {
      id: "inspection-group",
      name: "Map and chest",
      members: [
        { kind: "ASSET", id: draft.content.entities[0].id },
        { kind: "ASSET", id: "furniture" },
      ],
    },
    true,
  );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(
    page
      .getByRole("region", { name: "Environment and Scene", exact: true })
      .getByText(draft.content.title, { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  const artifactRoot = "artifacts/parallax-sc00b-integration/browser";
  await mkdir(artifactRoot, { recursive: true });
  const captures: { selection: string; mode: string; path: string }[] = [];
  const depth = async (selection: string) => {
    for (const [mode, label] of [
      ["GUIDED", "guided"],
      ["DETAILED", "standard"],
      ["ENGINEERING", "engineering"],
    ] as const) {
      await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption(mode);
      await expect(inspector).toBeVisible();
      const path = `${artifactRoot}/${selection}-${label}.png`;
      await page.screenshot({ path, fullPage: true });
      captures.push({ selection, mode, path });
    }
  };
  const asset = async (id: string) => {
    await graph.getByRole("tab", { name: "Assets", exact: true }).click();
    const row = graph.locator(`[data-graph-entity="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click({ position: { x: 8, y: 8 } });
    await expect(row).toHaveAttribute("aria-pressed", "true");
  };
  await asset(draft.content.entities[0].id);
  await depth("parchment");
  await asset("furniture");
  await expect(inspector.getByRole("region", { name: "Spatial element properties" })).toContainText("PHYSICAL ASSET");
  await depth("furniture");
  await asset("light");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await expect(inspector.getByRole("slider", { name: "Light intensity" })).toBeVisible();
  await expect(inspector.getByRole("spinbutton", { name: "Light falloff" })).toHaveCount(0);
  await depth("light");
  await asset("audio");
  await depth("timeline-audio");
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Edit selected object timeline" })).toBeVisible();
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await asset("trigger");
  await depth("interaction-trigger");

  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Room feature editor" })).toBeVisible();
  await depth("environment");
  const feature = async (id: string) => {
    const row = graph.locator(`[data-graph-feature="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click({ position: { x: 8, y: 8 } });
    await expect(row).toHaveAttribute("aria-pressed", "true");
  };
  await feature("work-table");
  await expect(inspector.getByRole("textbox", { name: "Feature name", exact: true })).toBeInViewport();
  await depth("room-feature");
  await feature("reserved-area");
  await expect(inspector.getByRole("textbox", { name: "Feature name", exact: true })).toBeInViewport();
  await depth("exclusion-zone");
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  const group = graph.locator('[data-graph-group="inspection-group"]');
  await group.click({ position: { x: 8, y: 8 } });
  await expect(inspector.getByRole("region", { name: "Group inspector" })).toBeVisible();
  await expect(inspector.getByLabel("Accessible description")).toHaveCount(0);
  await depth("group");
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Scene settings" })).toBeVisible();
  await expect(inspector.getByRole("region", { name: "Inspector context", exact: true })).toContainText(
    draft.content.title,
  );
  await expect(inspector.getByRole("region", { name: "Inspector context", exact: true })).not.toContainText(
    "Map and chest",
  );
  await depth("scene");
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Scene overview" })).toBeVisible();
  await depth("empty-selection");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Scene settings" })).toBeVisible();
  await page.screenshot({ path: `${artifactRoot}/scene-phone.png`, fullPage: true });
  const phoneTitle = inspector.getByRole("textbox", { name: "Experience title", exact: true });
  await phoneTitle.click();
  await phoneTitle.fill("Inspector phone edit");
  await expect
    .poll(
      async () =>
        (await listSpatialItems(account.id)).find((item) => item.id === draft.content.definitionId)?.draft.content
          .title,
    )
    .toBe("Inspector phone edit");
  await inspector.getByRole("button", { name: "Collapse Inspector", exact: true }).click();
  await expect(inspector).toBeHidden();
  const canvas = page.locator('[data-renderer="READY"] canvas');
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeInViewport();
  await page.screenshot({ path: `${artifactRoot}/phone-edit-return.png`, fullPage: true });
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await expect(phoneTitle).toHaveValue("Inspector phone edit");
  const violations = (await new AxeBuilder({ page }).include('[aria-label="Spatial inspector"]').analyze()).violations;
  expect(violations.filter((issue) => ["critical", "serious"].includes(issue.impact ?? ""))).toEqual([]);
  expect(errors).toEqual([]);
  expect(captures).toHaveLength(33);
  await writeFile(
    `${artifactRoot}/observations.json`,
    JSON.stringify({ captures, errors, synthetic: true, ownerAccepted: false }, null, 2),
  );
});

test("SC-00B typed light and room feature edits survive undo, mode travel, and saved reload", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00B Canonical Edit Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("sc00b-edits", "Desk Map");
  draft.content.title = "Inspector edit persistence";
  draft = insertSpatialElement(draft, "point-light", "light-edit");
  draft.content.studio!.environment = addRoomFeature(
    createRoomEnvironment(simulationEnvironments.find((entry) => entry.id === "empty")!),
    "TABLE",
    "room-table",
  );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  const hierarchyToggle = page.getByRole("button", { name: "Open Scene Hierarchy", exact: true });
  const openHierarchy = async () => {
    if ((await hierarchyToggle.getAttribute("aria-pressed")) !== "true") await hierarchyToggle.click();
    await expect(hierarchyToggle).toHaveAttribute("aria-pressed", "true");
  };
  await openHierarchy();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.locator('[data-graph-entity="light-edit"]').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  const number = page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true });
  await number.fill("35");
  await number.blur();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(number).toHaveValue("12");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(number).toHaveValue("35");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await expect(number).toHaveValue("35");
  await expect
    .poll(async () => {
      const saved = (await listSpatialItems(account.id)).find((item) => item.id === draft.content.definitionId);
      const element = saved?.draft.content.entities.find((entity) => entity.id === "light-edit")?.element;
      return element?.kind === "LIGHT" ? element.intensity : null;
    })
    .toBe(35);
  await page.reload();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await openHierarchy();
  await expect(graph.locator('[data-graph-entity="light-edit"]')).toBeVisible();
  await graph.locator('[data-graph-entity="light-edit"]').click({ position: { x: 8, y: 8 } });
  await expect(number).toHaveValue("35");

  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await graph.locator('[data-graph-feature="room-table"]').click({ position: { x: 8, y: 8 } });
  const featureName = page
    .getByRole("region", { name: "Room feature editor" })
    .getByRole("textbox", { name: "Feature name" });
  await featureName.fill("Review table");
  await featureName.blur();
  await expect
    .poll(async () => {
      const saved = (await listSpatialItems(account.id)).find((item) => item.id === draft.content.definitionId);
      return saved?.draft.content.studio?.environment?.features.find((feature) => feature.id === "room-table")?.name;
    })
    .toBe("Review table");
  await page.reload();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await openHierarchy();
  await expect(graph.locator('[data-graph-feature="room-table"]')).toBeVisible();
  await graph.locator('[data-graph-feature="room-table"]').click({ position: { x: 8, y: 8 } });
  await expect(featureName).toHaveValue("Review table");
});

test("SC-00B scale drag previews on the combined canvas before one history commit", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(120000);
  const account = await closureAccount("Synthetic SC-00B Live Scale Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("sc00b-scale", "Desk Map");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  const host = page.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("DETAILED");
  const slider = page.getByRole("slider", { name: "Object scale", exact: true });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  if (!box) throw new Error("SC00B_SCALE_SLIDER_MISSING");
  const scale = async () => {
    const receipt = JSON.parse((await host.getAttribute("data-scene-receipt"))!) as { id: string; scale: number[] }[];
    return receipt.find((entity) => entity.id === draft.content.entities[0].id)?.scale[0];
  };
  await expect.poll(scale).toBe(1);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.62, y, { steps: 8 });
  await expect.poll(scale).toBeGreaterThan(1.2);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await mkdir("artifacts/parallax-sc00b-integration/browser", { recursive: true });
  await page.screenshot({
    path: "artifacts/parallax-sc00b-integration/browser/scale-live-preview.png",
    fullPage: true,
  });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(scale).toBe(1);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("SC-00B typed effects retain three depths, light theme, and keyboard rail navigation", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00B Effect Inspector Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("sc00b-effects", "Desk Map");
  for (const [preset, id] of [
    ["mist", "mist"],
    ["magic", "particles"],
    ["symbol", "projection"],
    ["portal", "phenomenon"],
  ] as const) {
    draft = insertSpatialElement(draft, preset, id);
  }
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  const setup = await (await page.request.get("/api/studio/parallax")).json();
  const preferences = await (await page.request.get("/api/passport/preferences")).json();
  const response = await page.request.put("/api/passport/preferences", {
    headers: { "x-csrf-token": setup.csrfToken },
    data: {
      preferences: {
        ...preferences.preferences,
        experience: { ...preferences.preferences.experience, theme: "LIGHT", motion: "REDUCED" },
      },
    },
  });
  expect(response.ok()).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  const artifactRoot = "artifacts/parallax-sc00b-integration/browser";
  await mkdir(artifactRoot, { recursive: true });
  const captures: { selection: string; mode: string; path: string }[] = [];
  const cases = [
    { id: "mist", kind: "ATMOSPHERE", guided: "Mist density", engineering: "No volumetric light scattering" },
    { id: "particles", kind: "PARTICLES", guided: "Particle count", engineering: "Particle seed" },
    {
      id: "projection",
      kind: "PROJECTED_EFFECT",
      guided: "Projection opacity",
      engineering: "Occlusion-aware projection is unavailable",
    },
    { id: "phenomenon", kind: "SPATIAL_PHENOMENON", guided: "Phenomenon style", engineering: "Phenomenon speed" },
  ] as const;
  for (const effect of cases) {
    const row = graph.locator(`[data-graph-entity="${effect.id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click({ position: { x: 8, y: 8 } });
    await expect(row).toHaveAttribute("aria-pressed", "true");
    for (const [mode, label] of [
      ["GUIDED", "guided"],
      ["DETAILED", "standard"],
      ["ENGINEERING", "engineering"],
    ] as const) {
      await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption(mode);
      await expect(inspector.getByRole("region", { name: "Spatial element properties" })).toContainText(
        effect.kind.replaceAll("_", " "),
      );
      if (effect.id === "phenomenon") {
        await expect(inspector.getByRole("combobox", { name: effect.guided, exact: true })).toBeVisible();
      } else {
        await expect(inspector.getByRole("slider", { name: effect.guided, exact: true })).toBeVisible();
      }
      if (effect.id === "particles" && mode === "GUIDED") {
        const count = inspector.getByRole("spinbutton", { name: "Particle count numeric value", exact: true });
        await count.fill("10.5");
        await count.blur();
        await expect(count).toHaveValue("11");
        await expect
          .poll(async () => {
            const element = (await listSpatialItems(account.id))
              .find((item) => item.id === draft.content.definitionId)
              ?.draft.content.entities.find((entity) => entity.id === "particles")?.element;
            return element?.kind === "PARTICLES" ? element.count : null;
          })
          .toBe(11);
      }
      if (mode === "ENGINEERING") {
        if (effect.id === "particles" || effect.id === "phenomenon") {
          await expect(inspector.getByRole("spinbutton", { name: effect.engineering, exact: true })).toBeVisible();
        } else {
          await expect(inspector.getByText(effect.engineering, { exact: false })).toBeVisible();
        }
      }
      const path = `${artifactRoot}/${effect.id}-${label}-light.png`;
      await page.screenshot({ path, fullPage: true });
      captures.push({ selection: effect.id, mode, path });
    }
  }
  const propertiesRail = page.getByRole("button", { name: "Open object properties", exact: true });
  const contextRail = page.getByRole("button", { name: "Open spatial context", exact: true });
  const sceneRail = page.getByRole("button", { name: "Open scene settings", exact: true });
  await propertiesRail.focus();
  await propertiesRail.press("Enter");
  await expect(propertiesRail).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await expect(contextRail).toBeFocused();
  await contextRail.press("Enter");
  await expect(contextRail).toHaveAttribute("aria-pressed", "true");
  await expect(inspector).toContainText("Portal phenomenon");
  await page.keyboard.press("Tab");
  await expect(sceneRail).toBeFocused();
  await sceneRail.press("Enter");
  await expect(sceneRail).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByRole("heading", { name: "Scene settings" })).toBeVisible();
  const violations = (await new AxeBuilder({ page }).include('[aria-label="Spatial inspector"]').analyze()).violations;
  expect(violations.filter((issue) => ["critical", "serious"].includes(issue.impact ?? ""))).toEqual([]);
  expect(errors).toEqual([]);
  expect(captures).toHaveLength(12);
  await writeFile(
    `${artifactRoot}/effects-observations.json`,
    JSON.stringify({ captures, errors, theme: "LIGHT", motion: "REDUCED", ownerAccepted: false }, null, 2),
  );
});

test("SC-00B combined Inspector handles removed and mixed selections at every depth", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(120000);
  const account = await closureAccount("Synthetic SC-00B Selection Edge Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("sc00b-selection-edges", "Desk Map");
  draft = insertSpatialElement(draft, "articulated-chest", "edge-furniture");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  const furniture = graph.locator('[data-graph-entity="edge-furniture"]');
  await furniture.click({ position: { x: 8, y: 8 } });
  await inspector.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Unavailable selection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open object properties", exact: true })).toBeDisabled();
  const artifactRoot = "artifacts/parallax-sc00b-integration/browser";
  await mkdir(artifactRoot, { recursive: true });
  const captures: { selection: string; mode: string; path: string }[] = [];
  const depth = async (selection: string) => {
    for (const [mode, label] of [
      ["GUIDED", "guided"],
      ["DETAILED", "standard"],
      ["ENGINEERING", "engineering"],
    ] as const) {
      await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption(mode);
      const path = `${artifactRoot}/${selection}-${label}.png`;
      await page.screenshot({ path, fullPage: true });
      captures.push({ selection, mode, path });
    }
  };
  await depth("removed-selection");
  await inspector.getByRole("button", { name: "Undo last edit", exact: true }).click();
  await expect(furniture).toBeVisible();
  await expect(inspector.getByRole("region", { name: "Spatial element properties" })).toBeVisible();
  const parchment = graph.locator(`[data-graph-entity="${draft.content.entities[0].id}"]`);
  await parchment.click({ position: { x: 8, y: 8 }, modifiers: ["Control"] });
  await expect(inspector.getByRole("region", { name: "Group inspector" })).toContainText("2 items selected");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await expect(inspector.getByRole("button", { name: "Move selection" })).toBeVisible();
  await expect(inspector.getByRole("spinbutton", { name: "Group X" })).toHaveCount(0);
  await depth("mixed-selection");
  await expect(inspector.getByRole("spinbutton", { name: "Group X" })).toBeVisible();
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Group selection" })).toBeVisible();
  await expect(inspector.getByRole("region", { name: "Group inspector" })).toContainText("2 items selected");
  expect(errors).toEqual([]);
  expect(captures).toHaveLength(6);
  await writeFile(
    `${artifactRoot}/selection-edges-observations.json`,
    JSON.stringify({ captures, errors, synthetic: true, ownerAccepted: false }, null, 2),
  );
});
