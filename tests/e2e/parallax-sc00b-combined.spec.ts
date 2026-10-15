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

test("SC-00B combined Inspector covers twelve selection contexts and room recovery at each depth", async ({
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
  room = addRoomFeature(room, "OTHER", "free-feature");
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
  const inspectorHandle = inspector.getByRole("separator", { name: "Resize inspector panel" });
  const initialWidth = Number(await inspectorHandle.getAttribute("aria-valuenow"));
  await inspectorHandle.press("ArrowLeft");
  await expect(inspectorHandle).toHaveAttribute("aria-valuenow", String(initialWidth - 16));
  const handleBox = await inspectorHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 60);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 - 32, handleBox!.y + 60, { steps: 4 });
  await page.mouse.up();
  await expect(inspectorHandle).toHaveAttribute("aria-valuenow", String(initialWidth + 16));
  const lightFalloff = inspector.getByRole("spinbutton", { name: "Light falloff" });
  await lightFalloff.scrollIntoViewIfNeeded();
  await expect(lightFalloff).toBeInViewport();
  await page.screenshot({ path: `${artifactRoot}/light-engineering-scrolled-resized.png`, fullPage: true });
  await asset("audio");
  await depth("timeline-audio");
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Edit selected object timeline" })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Duplicate", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Duplicate", exact: true })).toBeVisible();
  await asset("trigger");
  await depth("interaction-trigger");

  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Room feature editor" })).toBeVisible();
  await expect(inspector.getByLabel("Selected object quick actions")).toHaveCount(0);
  await expect(inspector.getByRole("group", { name: "Selected spatial object" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await page.screenshot({ path: `${artifactRoot}/environment-from-asset-guided.png`, fullPage: true });
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Room feature editor" })).toBeVisible();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await expect(inspector.getByRole("textbox", { name: "Feature name", exact: true })).toHaveCount(0);
  await expect(inspector.getByRole("combobox", { name: "Room feature", exact: true })).toHaveValue("");
  await expect(inspector.getByText("Select a room feature to adjust it. Open Spatial context for room tools and relationships.")).toBeVisible();
  await depth("environment");
  const feature = async (id: string) => {
    const row = graph.locator(`[data-graph-feature="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click({ position: { x: 8, y: 8 } });
    await expect(row).toHaveAttribute("aria-pressed", "true");
  };
  await feature("floor-furniture");
  await expect(inspector.getByRole("region", { name: "Inspector context" })).toContainText("Support surface");
  await expect(inspector.getByRole("combobox", { name: "Room feature classification" })).toBeDisabled();
  await expect(inspector.getByRole("button", { name: "Correct or remove this feature" })).toHaveCount(0);
  await depth("support-surface");
  await feature("work-table");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Room spatial context" })).toBeVisible();
  const roomRelationships = inspector.getByRole("region", { name: "Room feature relationships" });
  await expect(roomRelationships).toContainText("Support and nearby features");
  await expect(roomRelationships.getByRole("button", { name: /exclusion zone/i })).toHaveCount(0);
  await expect(roomRelationships.getByRole("button", { name: /wall/i }).first()).toBeVisible();
  await expect(inspector.getByRole("region", { name: "Add room features" })).toBeVisible();
  await expect(inspector.getByRole("textbox", { name: "Feature name", exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${artifactRoot}/room-feature-context-guided.png`, fullPage: true });
  await inspector.getByRole("button", { name: "Room dimensions", exact: true }).click();
  const contextRoomWidth = inspector.getByRole("spinbutton", { name: "Room width (m)" });
  await contextRoomWidth.scrollIntoViewIfNeeded();
  await expect(contextRoomWidth).toBeInViewport();
  await page.screenshot({ path: `${artifactRoot}/room-feature-context-dimensions-guided-scrolled.png`, fullPage: true });
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Room feature editor" })).toBeVisible();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await expect(inspector.getByRole("group", { name: "Room feature canvas tools" })).toBeVisible();
  await inspector.getByRole("button", { name: "Move in scene", exact: true }).click();
  const moveTool = page.getByRole("toolbar", { name: "Spatial editing tools" }).getByRole("button", { name: "Move tool" });
  await expect(moveTool).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByRole("spinbutton", { name: "Feature x (m)" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("DETAILED");
  await expect(inspector.getByRole("spinbutton", { name: "Feature width (m)" })).toBeVisible();
  await expect(inspector.getByRole("spinbutton", { name: "Feature x (m)" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await expect(inspector.getByRole("spinbutton", { name: "Feature x (m)" })).toBeVisible();
  await expect(inspector.getByRole("textbox", { name: "Feature name", exact: true })).toBeInViewport();
  await depth("room-feature");
  await inspector.getByRole("button", { name: "Remove room feature", exact: true }).click();
  await expect(inspector.getByRole("alert")).toContainText("attached to this feature");
  await feature("free-feature");
  await inspector.getByRole("button", { name: "Remove room feature", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Unavailable selection" })).toContainText("selected room feature");
  await expect(inspector.getByRole("region", { name: "Room feature editor" })).toHaveCount(0);
  const missingRoomDetails = page.getByRole("button", { name: "Open selection details", exact: true });
  await expect(missingRoomDetails).toBeEnabled();
  await expect(missingRoomDetails).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Open spatial context", exact: true })).toBeDisabled();
  await page.locator('button[aria-label="Open scene settings"]').click();
  await expect(inspector.getByRole("heading", { name: "Scene settings", exact: true })).toBeVisible();
  await expect(inspector.getByRole("region", { name: "Library, reuse & publication" })).toBeVisible();
  await page.screenshot({ path: `${artifactRoot}/removed-room-feature-scene.png`, fullPage: true });
  await missingRoomDetails.click();
  await expect(inspector.getByRole("region", { name: "Unavailable selection" })).toBeVisible();
  await depth("removed-room-feature");
  await asset(draft.content.entities[0].id);
  await expect(inspector.getByRole("region", { name: "Unavailable selection" })).toHaveCount(0);
  await expect(inspector.getByRole("region", { name: "Inspector context", exact: true })).toContainText(
    draft.content.entities[0].name,
  );
  await expect(inspector.getByLabel("Accessible description")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await feature("free-feature");
  await expect(inspector.getByRole("textbox", { name: "Feature name", exact: true })).toHaveValue("New other");
  await feature("reserved-area");
  await expect(inspector.getByRole("textbox", { name: "Feature name", exact: true })).toBeInViewport();
  await depth("exclusion-zone");
  const timelineTab = page.getByRole("tablist", { name: "Bottom dock tools" }).getByRole("tab", {
    name: "Timeline",
    exact: true,
  });
  if ((await timelineTab.getAttribute("aria-selected")) !== "true") await timelineTab.click();
  await page.locator('[aria-label="Spatial sequence tracks"]').getByRole("button", {
    name: draft.content.entities[0].name,
    exact: true,
  }).click();
  await expect(inspector.getByRole("region", { name: "Room feature editor" })).toHaveCount(0);
  await expect(inspector.getByRole("region", { name: "Inspector context", exact: true })).toContainText(
    draft.content.entities[0].name,
  );
  await expect(inspector.getByLabel("Accessible description")).toBeVisible();
  await timelineTab.click();
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  const group = graph.locator('[data-graph-group="inspection-group"]');
  await group.click({ position: { x: 8, y: 8 } });
  await expect(inspector.getByRole("region", { name: "Group inspector" })).toBeVisible();
  await expect(inspector.getByLabel("Accessible description")).toHaveCount(0);
  await depth("group");
  await page.locator('button[aria-label="Open scene settings"]').click();
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
  await page.locator('button[aria-label="Open scene settings"]').click();
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
  await page.locator('button[aria-label="Open scene settings"]').click();
  await expect(phoneTitle).toHaveValue("Inspector phone edit");
  const violations = (await new AxeBuilder({ page }).include('[aria-label="Spatial inspector"]').analyze()).violations;
  expect(violations.filter((issue) => ["critical", "serious"].includes(issue.impact ?? ""))).toEqual([]);
  expect(errors).toEqual([]);
  expect(captures).toHaveLength(39);
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
  draft = insertSpatialElement(draft, "spot-light", "light-edit");
  draft = insertSpatialElement(draft, "ambient-light", "ambient-edit");
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
  await expect(number).toHaveValue("18");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(number).toHaveValue("35");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await expect(number).toHaveValue("35");
  const pitch = page.getByRole("spinbutton", { name: "Object pitch in degrees", exact: true });
  const roll = page.getByRole("spinbutton", { name: "Object roll in degrees", exact: true });
  await pitch.fill("25");
  await pitch.blur();
  await roll.fill("12");
  await roll.blur();
  await expect(pitch).toHaveValue("25");
  await expect(roll).toHaveValue("12");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(roll).toHaveValue("0");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(roll).toHaveValue("12");
  await mkdir("artifacts/parallax-sc00b-integration/browser", { recursive: true });
  await page.screenshot({ path: "artifacts/parallax-sc00b-integration/browser/spot-direction-engineering.png", fullPage: true });
  await expect
    .poll(async () => {
      const saved = (await listSpatialItems(account.id)).find((item) => item.id === draft.content.definitionId);
      const element = saved?.draft.content.entities.find((entity) => entity.id === "light-edit")?.element;
      const rotation = saved?.draft.content.entities.find((entity) => entity.id === "light-edit")?.transform.rotation;
      return element?.kind === "LIGHT" && element.intensity === 35 && rotation &&
        Math.abs(rotation.x) > 0.1 && Math.abs(rotation.z) > 0.04;
    })
    .toBe(true);
  await page.reload();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await openHierarchy();
  await expect(graph.locator('[data-graph-entity="light-edit"]')).toBeVisible();
  await graph.locator('[data-graph-entity="light-edit"]').click({ position: { x: 8, y: 8 } });
  await expect(number).toHaveValue("35");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await expect(pitch).toHaveValue("25");
  await expect(roll).toHaveValue("12");

  await graph.locator('[data-graph-entity="ambient-edit"]').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole("slider", { name: "Light intensity" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Object width in meters" })).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: "Object pitch in degrees" })).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: "Position x" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open spatial context" }).click();
  await expect(page.getByLabel("Semantic placement")).toHaveCount(0);
  await expect(page.getByText(/Ambient light fills the whole scene/)).toBeVisible();
  await page.screenshot({ path: "artifacts/parallax-sc00b-integration/browser/ambient-context-engineering.png", fullPage: true });

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
  const sceneRail = page.locator('button[aria-label="Open scene settings"]');
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
  const artifactRoot = "artifacts/parallax-sc00b-integration/browser";
  await mkdir(artifactRoot, { recursive: true });
  const missingObjectDetails = page.getByRole("button", { name: "Open selection details", exact: true });
  await expect(missingObjectDetails).toBeEnabled();
  await expect(missingObjectDetails).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Open spatial context", exact: true })).toBeDisabled();
  await page.locator('button[aria-label="Open scene settings"]').click();
  await expect(inspector.getByRole("region", { name: "Scene overview", exact: true })).toBeVisible();
  await page.screenshot({ path: `${artifactRoot}/removed-selection-scene.png`, fullPage: true });
  await missingObjectDetails.click();
  await expect(inspector.getByRole("region", { name: "Unavailable selection" })).toBeVisible();
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
for (const viewport of [
  { label: "desktop", width: 1440, height: 1000 },
  { label: "phone", width: 390, height: 844 },
] as const) {
  test(`SC-00B natural Creator Library entry and Inspector return on ${viewport.label}`, async ({
    page,
    context,
    baseURL,
  }) => {
    ensureGenericSoundingLineIsolation();
    test.setTimeout(120000);
    const accountLabel = `Synthetic SC-00B ${viewport.label} Entry Creator`;
    const account = await closureAccount(accountLabel);
    await activateWorkspaceCapability(account.id, "CREATOR");
    await authenticateClosure(context, account, baseURL!);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/studio/library");
    const openStudio = page.getByRole("link", { name: "Spatial Studio", exact: true });
    await openStudio.click();
    await expect(page.getByRole("heading", { name: "Parallax", exact: true })).toBeVisible();
    await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
    const hierarchy = page.getByRole("button", { name: "Open Scene Hierarchy", exact: true });
    if ((await hierarchy.getAttribute("aria-pressed")) !== "true") await hierarchy.click();
    const graph = page.getByRole("region", { name: "Scene graph", exact: true });
    const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
    await graph.getByRole("button", { name: "Desk Map parchment", exact: true }).click({ position: { x: 8, y: 8 } });
    await page.locator('button[aria-label="Open scene settings"]').click();
    await expect(inspector.getByRole("heading", { name: "Scene settings", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open object properties", exact: true }).click();
    await expect(inspector).toContainText("Edit what this item is");
    await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
    await expect(inspector.getByRole("heading", { name: "Spatial context", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "← Creator Studio", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/library$/);
    await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();

    await openStudio.click();
    await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
    if ((await hierarchy.getAttribute("aria-pressed")) !== "true") await hierarchy.click();
    await graph.getByRole("button", { name: "Desk Map parchment", exact: true }).click({ position: { x: 8, y: 8 } });
    await page.getByRole("button", { name: "Open object properties", exact: true }).click();
    await inspector.getByRole("button", { name: "Duplicate", exact: true }).click();
    await inspector.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(inspector.getByRole("region", { name: "Unavailable selection", exact: true })).toContainText(
      "Selection unavailable",
    );
    await inspector.getByRole("button", { name: "Undo last edit", exact: true }).click();
    await expect(inspector).toContainText("Edit what this item is");
    await page.getByRole("link", { name: "← Creator Studio", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/library$/);
    await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Checking account", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: accountLabel, exact: true })).toBeVisible();
    const libraryEmptyState = page.locator('.ui-empty-state[data-async-state="empty"]');
    await expect(libraryEmptyState.getByRole("heading", { name: "No Chronicles yet", exact: true })).toBeVisible();
    await expect(libraryEmptyState).toHaveCSS("opacity", "1");
    await mkdir("artifacts/parallax-sc00b-integration/browser", { recursive: true });
    await page.screenshot({
      path: `artifacts/parallax-sc00b-integration/browser/library-return-${viewport.label}.png`,
      fullPage: true,
    });
  });
}
