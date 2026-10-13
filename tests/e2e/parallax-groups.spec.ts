import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft, previewEntityTransforms } from "../../src/parallax/authoring";
import { insertSpatialPreset } from "../../src/parallax/editor-assets";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { placeOnRoomFeature } from "../../src/parallax/room-placement";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
const capture = async (page: Page, name: string) => {
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/groups-${name}.png` });
};
const open = async (page: Page, title: string) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`${title}.*My Library`) }).click();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
};
const persist = async (page: Page) => {
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
};
const positions = async (page: Page) =>
  JSON.parse((await page.locator('[data-renderer="READY"]').getAttribute("data-scene-receipt"))!) as {
    id: string;
    position: number[];
    scale: number[];
  }[];
const handle = async (page: Page, axis = "X") => {
  const host = page.locator('[data-renderer="READY"]');
  await expect
    .poll(async () => Boolean(JSON.parse((await host.getAttribute("data-projected-scene"))!).handles[axis]))
    .toBe(true);
  const p = JSON.parse((await host.getAttribute("data-projected-scene"))!).handles[axis],
    rect = (await host.boundingBox())!;
  return { x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height };
};

test("Assistant previews and applies grouping and whole-group motion through the server adapter without inference traffic", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  if (process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1") throw new Error("Unpaid synthetic provider required");
  const account = await closureAccount("Synthetic Assistant Groups Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("assistant-group", "Ghost Footprint Trail");
  draft.content.title = "Assistant grouped footprints";
  await saveSpatialDraft(account.id, draft, 0);
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  await authenticateClosure(context, account, baseURL!);
  await open(page, "Assistant grouped footprints");
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  const send = async (request: string) => {
    await assistant.getByRole("textbox", { name: "Describe your spatial idea", exact: true }).fill(request);
    await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
    await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toBeVisible();
  };
  await send("Group all footprints as Ghost route.");
  await capture(page, "assistant-group-proposal");
  expect((await listSpatialItems(account.id))[0].draft.content.studio).not.toHaveProperty("editingGroups");
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  await expect
    .poll(async () => (await listSpatialItems(account.id))[0].draft.content.studio?.editingGroups?.length)
    .toBe(1);
  await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.getByRole("tab", { name: "Groupings", exact: true }).click();
  await graph.locator("[data-graph-group]").click({ position: { x: 12, y: 20 } });
  const before = await positions(page);
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  await send("Move this group half a meter to the right.");
  await capture(page, "assistant-move-proposal");
  const savedBefore = (await listSpatialItems(account.id))[0].draft;
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  await expect
    .poll(async () => (await listSpatialItems(account.id))[0].draft.content.entities[0].transform.position.x)
    .not.toBe(savedBefore.content.entities[0].transform.position.x);
  await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  const after = await positions(page);
  for (const entity of after)
    expect(entity.position[0] - before.find((item) => item.id === entity.id)!.position[0]).toBeCloseTo(0.5);
  await capture(page, "assistant-group-applied");
});

test("Twenty footprints group through keyboard selection, move live together, cancel safely and retain editable membership", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Group Trail Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("group-trail", "Ghost Footprint Trail");
  for (let i = 1; i < 4; i++) draft = insertSpatialPreset(draft, "Ghost Footprint Trail", `trail-${i}`);
  draft.content.title = "Grouped footprints";
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await open(page, "Grouped footprints");
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const assets = graph.locator("[data-graph-entity]");
  await expect(assets).toHaveCount(20);
  await graph.getByRole("tab", { name: "Groupings", exact: true }).click();
  await expect(graph).toContainText("No groups yet");
  await capture(page, "empty");
  await graph.getByRole("tab", { name: "Assets", exact: true }).click();
  await graph.getByRole("button", { name: "Group selected items", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Group name", exact: true }).fill("Pair");
  const checks = dialog.getByRole("checkbox");
  await checks.nth(1).check();
  await dialog.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(graph.locator("[data-graph-group]")).toHaveCount(1);
  await page
    .getByRole("region", { name: "Group inspector", exact: true })
    .getByRole("button", { name: "Ungroup items", exact: true })
    .click();
  await graph.getByRole("tab", { name: "Assets", exact: true }).click();
  await assets.first().click({ position: { x: 12, y: 20 } });
  await assets.first().press("Control+a");
  await expect(graph).toContainText("20 selected");
  await assets.first().press("Control+g");
  const group = graph.locator("[data-graph-group]");
  await expect(group).toHaveCount(1);
  await group.press("F2");
  await graph.getByRole("textbox", { name: "Rename Group 1", exact: true }).fill("Ghost route");
  await graph.getByRole("textbox", { name: "Rename Group 1", exact: true }).press("Enter");
  await expect(page.getByRole("region", { name: "Group inspector", exact: true })).toContainText("Ghost route");
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
  await page.getByRole("button", { name: "Move tool", exact: true }).click();
  const before = await positions(page),
    grip = await handle(page);
  await persist(page);
  const revisionBefore = (await listSpatialItems(account.id))[0].revision;
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 45, grip.y, { steps: 12 });
  await expect.poll(async () => (await positions(page))[0].position[0]).not.toBeCloseTo(before[0].position[0]);
  const live = await positions(page),
    delta = live[0].position[0] - before[0].position[0];
  for (const item of live)
    expect(item.position[0] - before.find((old) => old.id === item.id)!.position[0]).toBeCloseTo(delta);
  expect((await listSpatialItems(account.id))[0].revision).toBe(revisionBefore);
  await capture(page, "twenty-live-move");
  await page.mouse.up();
  await expect.poll(async () => (await positions(page))[0].position[0]).toBeCloseTo(live[0].position[0]);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect.poll(async () => (await positions(page))[0].position[0]).toBeCloseTo(before[0].position[0]);
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await expect.poll(async () => (await positions(page))[0].position[0]).toBeCloseTo(live[0].position[0]);
  const cancelGrip = await handle(page);
  await page.mouse.move(cancelGrip.x, cancelGrip.y);
  await page.mouse.down();
  await page.mouse.move(cancelGrip.x + 35, cancelGrip.y, { steps: 10 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(async () => (await positions(page))[0].position[0]).toBeCloseTo(live[0].position[0]);
  await graph.getByRole("button", { name: "Lock selected assets", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Group inspector", exact: true });
  await expect(inspector.getByRole("spinbutton", { name: "Group X", exact: true })).toBeDisabled();
  await capture(page, "locked");
  await graph.getByRole("button", { name: "Unlock selected assets", exact: true }).click();
  await persist(page);
  await page.reload();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await expect.poll(async () => (await positions(page))[0].position[0]).toBeCloseTo(live[0].position[0]);
  if (
    (await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).getAttribute("aria-pressed")) !==
    "true"
  )
    await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await graph.getByRole("tab", { name: "Groupings", exact: true }).click();
  await graph.locator("[data-graph-group]").click({ position: { x: 12, y: 20 } });
  await graph.locator("[data-graph-group]").press("Shift+F10");
  await page.getByRole("menuitem", { name: "Edit group members", exact: true }).click();
  await dialog.getByRole("checkbox").last().uncheck();
  await dialog.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(inspector).toContainText("19 items selected");
  await capture(page, "membership");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await graph.scrollIntoViewIfNeeded();
  await capture(page, "phone");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await capture(page, "light-reduced-motion");
  await graph.locator("[data-graph-group]").press("Control+Shift+g");
  await persist(page);
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.entities).toHaveLength(20);
  expect(saved.content.studio!.editingGroups).toEqual([]);
  expect(saved.content.entities.map((e) => e.transform)).not.toEqual(draft.content.entities.map((e) => e.transform));
});

test("A mixed asset and room-feature group uses the same rotation/scale controls without double-moving its bound asset", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Mixed Group Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("mixed-group");
  draft.content.title = "Grouped workstation";
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: null,
  });
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await open(page, "Grouped workstation");
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.getByRole("button", { name: "Group selected items", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Group name", exact: true }).fill("Writing station");
  await dialog.getByRole("button", { name: "Select all assets", exact: true }).click();
  const deskName = draft.content.studio!.environment!.features.find((f) => f.id === "reference-desk")!.name;
  await dialog.getByRole("checkbox", { name: deskName, exact: true }).check();
  await dialog.getByRole("button", { name: "Save group", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Group inspector", exact: true });
  await expect(inspector).toContainText("2 items selected");
  await inspector.getByRole("spinbutton", { name: "Group rotation delta", exact: true }).fill("90");
  await inspector.getByRole("spinbutton", { name: "Group scale factor", exact: true }).fill("1.25");
  await inspector.getByRole("button", { name: "Apply rotation and scale", exact: true }).click();
  await persist(page);
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.environment!.features.find((f) => f.id === "reference-desk")!.yawDegrees).toBe(90);
  const poses = previewEntityTransforms(saved.content, saved.content.studio!.environment!.id, {
    ...saved.content.studio!.environment!,
    horizontal: true,
    vertical: true,
  });
  await expect
    .poll(async () => (await positions(page))[0].position[0])
    .toBeCloseTo(poses[saved.content.entities[0].id].position.x);
  await capture(page, "mixed-rotation-scale");
  await inspector.getByRole("spinbutton", { name: "Group scale factor", exact: true }).fill("0");
  await inspector.getByRole("button", { name: "Apply rotation and scale", exact: true }).click();
  await expect(inspector.getByRole("alert")).toContainText("between 0.01 and 10");
  await capture(page, "invalid-transform");
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
});
