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
import { saveEditingGroup } from "../../src/parallax/editing-groups";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "../../src/parallax/room-geometry";
import { placeOnSurface } from "../../src/parallax/surface-placement";
import { previewEntityTransform } from "../../src/parallax/authoring";

test.describe.configure({ timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
const capture = async (page: Page, name: string) => {
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/groups-${name}.png` });
};

test("single name clicks rename assets and groups, and Library exclusion tools use the current room controls", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Exclusion Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("library-exclusions", "Ghost Footprint Trail");
  draft.content.title = "Exclusion library workshop";
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments.find((p) => p.id === "bedroom")!);
  draft = saveEditingGroup(
    draft,
    {
      id: "trail-group",
      name: "Footprint group",
      members: draft.content.entities.map((entity) => ({ kind: "ASSET", id: entity.id })),
    },
    true,
  );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await open(page, draft.content.title);
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  for (const name of ["North step", "Arrival step", "First step"]) {
    const row = graph.locator(`[data-graph-entity="${draft.content.entities[0].id}"]`);
    await row.locator('[title="Click to rename; F2 also renames"]').click();
    const input = graph.getByRole("textbox", { name: /^Rename / });
    await expect(input).toBeFocused();
    await input.fill(name);
    await input.press("Enter");
    await expect(row).toContainText(name);
  }
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  for (const name of ["Arrival trail", "Named trail"]) {
    const row = graph.locator('[data-graph-group="trail-group"]');
    await row.locator('[title="Click to rename; F2 also renames"]').click();
    const input = graph.getByRole("textbox", { name: /^Rename / });
    await expect(input).toBeFocused();
    await input.fill(name);
    await input.press("Enter");
    await expect(row).toContainText(name);
  }
  await capture(page, "first-click-group-rename");
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await capture(page, "exclusion-library-card");
  await page.getByRole("button", { name: /^Exclusion Zone/ }).click();
  await expect(page.getByRole("button", { name: "Finish environment editing", exact: true })).toBeVisible();
  const editor = page.getByRole("region", { name: "Room feature editor" });
  const select = editor.getByRole("combobox", { name: "Room feature", exact: true });
  const id = await select.inputValue();
  expect(id).toMatch(/^zone-/);
  await editor.getByRole("textbox", { name: "Feature name", exact: true }).fill("Reserved arrival area");
  await editor.getByRole("textbox", { name: "Feature name", exact: true }).press("Tab");
  await capture(page, "exclusion-selected-controls");
  await persist(page);
  const saved = (await listSpatialItems(account.id)).find((item) => item.id === draft.content.definitionId)!.draft;
  expect(saved.content.entities).toHaveLength(5);
  expect(saved.content.entities[0].name).toBe("First step");
  expect(saved.content.studio!.editingGroups![0].name).toBe("Named trail");
  expect(saved.content.studio!.environment!.features.find((feature) => feature.id === id)!.name).toBe(
    "Reserved arrival area",
  );
  await page.reload();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Environment", exact: true })).toHaveValue(
    saved.content.studio!.environment!.id,
  );
});
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

test("Visible Bedroom geometry reaches the Assistant and a retained real response animates into clear entrance placement", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Room-Aware Assistant Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("room-aware", "Desk Map");
  draft.content.title = "Current Bedroom entrance";
  expect(draft.content.studio!.environment).toBeUndefined();
  await saveSpatialDraft(account.id, draft, 0);
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  await authenticateClosure(context, account, baseURL!);
  await open(page, draft.content.title);
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  await assistant
    .getByRole("textbox", { name: "Describe your spatial idea", exact: true })
    .fill("Place a readable old pirate note on a wall near the entrance.");
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  await expect(assistant.locator('[aria-label="Assistant thinking"]')).toBeVisible();
  await capture(page, "assistant-thinking");
  await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toBeVisible();
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  await expect(assistant).toContainText("Your changes are saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  const room = saved.content.studio!.environment!;
  expect(room.id).toBe("editable-bedroom");
  const note = saved.content.entities.find((e) => e.id !== draft.content.entities[0].id)!;
  const frame = saved.content.studio!.surfacePreviewFrames!.find((f) => f.anchorId === note.anchorId)!;
  expect(frame.surfaceId).toBe("wall-front");
  const preview = { ...simulationEnvironments[0], ...room };
  const pose = previewEntityTransform(saved.content, note.id, room.id, preview);
  const door = room.features.find((f) => f.classification === "DOOR")!;
  expect(Math.hypot(pose.position.x - door.position.x, pose.position.z - door.position.z)).toBeLessThan(1.3);
  const wall = discoverRoomSurfaces(syntheticRoomGeometry(preview), preview).find((s) => s.id === frame.surfaceId)!;
  expect(placeOnSurface(pose, wall, note.widthMeters)).not.toBeNull();
  await capture(page, "entrance-note-applied");
  await assistant.getByRole("button", { name: "View canvas", exact: true }).click();
  await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
  await capture(page, "continuous-bedroom-floor");
  await page
    .getByRole("region", { name: "Scene graph", exact: true })
    .locator(`[data-graph-entity="${draft.content.entities[0].id}"]`)
    .click({ position: { x: 12, y: 20 } });
  const originalId = draft.content.entities[0].id;
  const before = (await positions(page)).find((e) => e.id === originalId)!;
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  await assistant
    .getByRole("textbox", { name: "Describe your spatial idea", exact: true })
    .fill(
      "Make the selected map 15% smaller and move it 0.1 meters to the left. Preserve its clue text, height and support.",
    );
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toBeVisible();
  await expect(
    assistant.getByText("Place a readable old pirate note on a wall near the entrance.", { exact: true }),
  ).toBeVisible();
  await capture(page, "assistant-chat-proposal");
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  await expect(assistant).toContainText("Your changes are saved");
  await expect
    .poll(async () => (await positions(page)).find((e) => e.id === originalId)!.position[0])
    .toBeCloseTo(before.position[0] - 0.1);
  const after = (await positions(page)).find((e) => e.id === originalId)!;
  expect(after.position[1]).toBeCloseTo(before.position[1]);
  expect(after.position[2]).toBeCloseTo(before.position[2]);
  await assistant.getByRole("button", { name: "Start new task", exact: true }).click();
  await expect(
    assistant.getByText("Place a readable old pirate note on a wall near the entrance.", { exact: true }),
  ).toHaveCount(0);
  await capture(page, "assistant-new-task");
  const currentPose = await positions(page);
  await assistant.getByRole("textbox", { name: "Describe your spatial idea", exact: true }).fill("What is 5 times 5?");
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  await expect(assistant.getByRole("textbox", { name: "Describe your spatial idea", exact: true })).toHaveValue("");
  await expect(
    assistant.getByRole("heading", { name: /I can help you build and edit your spatial scene/ }),
  ).toBeVisible();
  await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toHaveCount(0);
  await expect(
    assistant.getByText("This unrelated model answer must be replaced by the server.", { exact: true }),
  ).toHaveCount(0);
  expect(await positions(page)).toEqual(currentPose);
  await capture(page, "assistant-scope-redirect");
});

test("Inspector text preserves spaces and newlines, and room membership requires the viewport edit toggle", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Text and Environment Mode Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("text-mode");
  draft.content.title = "Text and room edit controls";
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments.find((p) => p.id === "bedroom")!);
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await open(page, draft.content.title);
  await page.getByText("Overview / Identity", { exact: true }).click();
  const message = page.getByRole("textbox", { name: "Clue or message", exact: true });
  await message.fill("");
  await message.pressSequentially("Find the old pirate note ");
  await expect(message).toHaveValue("Find the old pirate note ");
  await message.press("Enter");
  await message.pressSequentially("Beside the doorway.");
  await expect(message).toHaveValue("Find the old pirate note \nBeside the doorway.");
  await capture(page, "multiline-message-editing");
  await persist(page);
  const saved = (await listSpatialItems(account.id)).find((item) => item.id === draft.content.definitionId)!;
  expect(saved.draft.content.entities[0].content).toBe("Find the old pirate note \nBeside the doorway.");
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.getByRole("button", { name: "Group selected items", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const features = dialog.getByRole("group", { name: "Room features", exact: true });
  await expect(features.getByRole("checkbox").first()).toBeDisabled();
  await expect(features.getByRole("button", { name: "Select all room features", exact: true })).toBeDisabled();
  await capture(page, "room-membership-readonly");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const toggle = page.getByRole("button", { name: "Edit room features", exact: true });
  await expect(
    page
      .getByRole("region", { name: "Spatial canvas", exact: true })
      .getByRole("button", { name: "Edit room features", exact: true }),
  ).toBeVisible();
  await expect(toggle).toHaveAttribute("title", "Edit environment");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Finish environment editing", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await graph.getByRole("button", { name: "Group selected items", exact: true }).click();
  await expect(features.getByRole("checkbox").first()).toBeEnabled();
  await capture(page, "room-membership-editing");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await persist(page);
  await page.reload();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await expect(message).toHaveValue("Find the old pirate note \nBeside the doorway.");
});

test("Scene Graph reorders live without moving assets, and a floor click places the whole selected footprint group", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Graph Order Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("order-groups", "Ghost Footprint Trail");
  draft = insertSpatialPreset(draft, "Ghost Footprint Trail", "other-trail");
  draft.content.title = "Ordered footprint groups";
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments.find((p) => p.id === "empty")!);
  draft.content.entities.forEach((e, i) => {
    e.transform.position = { x: -1 + (i % 5) * 0.15, y: 0.02, z: i < 5 ? -0.7 : 0.7 };
  });
  for (const [id, name, offset] of [
    ["first", "First trail", 0],
    ["second", "Second trail", 5],
  ] as const)
    draft = saveEditingGroup(
      draft,
      { id, name, members: draft.content.entities.slice(offset, offset + 5).map((e) => ({ kind: "ASSET", id: e.id })) },
      true,
    );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await open(page, draft.content.title);
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const rows = graph.locator("[data-graph-entity]");
  await expect(graph.getByRole("button", { name: "Group selected items", exact: true })).toBeEnabled();
  const savedScene = async () => {
    const item = (await listSpatialItems(account.id)).find((item) => item.id === draft.content.definitionId);
    if (!item) throw new Error("Owned order fixture is missing");
    return item;
  };
  const firstId = draft.content.entities[0].id;
  const oldPositions = await positions(page);
  const origin = (await rows.first().boundingBox())!,
    target = (await rows.nth(3).boundingBox())!;
  await page.mouse.move(origin.x + 15, origin.y + origin.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 15, target.y + target.height - 2, { steps: 12 });
  await expect(rows.nth(3)).toHaveAttribute("data-graph-entity", firstId);
  await expect(
    page.locator('[aria-hidden="true"]').filter({ hasText: draft.content.entities[0].name }).last(),
  ).toBeVisible();
  expect((await savedScene()).draft.content.entities[0].id).toBe(firstId);
  await capture(page, "live-reorder");
  await page.mouse.up();
  await persist(page);
  expect((await savedScene()).draft.content.entities[3].id).toBe(firstId);
  expect((await positions(page)).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    oldPositions.sort((a, b) => a.id.localeCompare(b.id)),
  );
  await rows.nth(3).press("Alt+ArrowUp");
  await persist(page);
  expect((await savedScene()).draft.content.entities[2].id).toBe(firstId);
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  const groups = graph.locator("[data-graph-group]");
  await groups.first().press("Alt+ArrowDown");
  await persist(page);
  expect((await savedScene()).draft.content.studio!.editingGroups![1].id).toBe("first");
  await groups.filter({ hasText: "First trail" }).click({ position: { x: 12, y: 20 } });
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
  await page.getByRole("button", { name: "Select tool", exact: true }).click();
  const host = page.locator('[data-renderer="READY"]');
  const rectangle = (await host.boundingBox())!;
  const projected = JSON.parse((await host.getAttribute("data-projected-scene"))!);
  const point = projected.surfaces.find((s: { surface: string }) => s.surface === "FLOOR").samples[1];
  await page.mouse.click(rectangle.x + point.x * rectangle.width, rectangle.y + point.y * rectangle.height);
  await expect
    .poll(async () => (await positions(page)).find((e) => e.id === firstId)!.position[0])
    .not.toBeCloseTo(oldPositions.find((e) => e.id === firstId)!.position[0]);
  const moved = await positions(page);
  const first = moved.find((e) => e.id === firstId)!,
    original = oldPositions.find((e) => e.id === firstId)!;
  for (const member of draft.content.studio!.editingGroups![0].members) {
    const current = moved.find((e) => e.id === member.id)!,
      before = oldPositions.find((e) => e.id === member.id)!;
    expect(current.position[0] - before.position[0]).toBeCloseTo(first.position[0] - original.position[0]);
    expect(current.position[2] - before.position[2]).toBeCloseTo(first.position[2] - original.position[2]);
  }
  for (const member of draft.content.studio!.editingGroups![1].members)
    expect(moved.find((e) => e.id === member.id)).toEqual(oldPositions.find((e) => e.id === member.id));
  await capture(page, "five-floor-placement");
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect
    .poll(async () => (await positions(page)).find((e) => e.id === firstId)!.position)
    .toEqual(original.position);
  await persist(page);
  await page.reload();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
});

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
  await page
    .getByRole("region", { name: "Scene graph", exact: true })
    .locator("[data-graph-entity]")
    .first()
    .press("Control+a");
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  const send = async (request: string) => {
    await assistant.getByRole("textbox", { name: "Describe your spatial idea", exact: true }).fill(request);
    await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
    await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toBeVisible();
  };
  await send("Group selected footprints as Ghost route.");
  await capture(page, "assistant-group-proposal");
  expect((await listSpatialItems(account.id))[0].draft.content.studio).not.toHaveProperty("editingGroups");
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  await expect
    .poll(async () => (await listSpatialItems(account.id))[0].draft.content.studio?.editingGroups?.length)
    .toBe(1);
  await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  await graph.locator("[data-graph-group]").click({ position: { x: 12, y: 20 } });
  const before = await positions(page);
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  await send("Move this group half a meter to the right.");
  await expect(assistant).toContainText("move by X 0.5 m, Y 0 m, Z 0 m (world axes)");
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
  draft.content.entities.forEach((entity, index) => {
    entity.transform.position = { x: ((index % 4) - 1.5) * 0.32, y: 0.02, z: 0.8 - Math.floor(index / 4) * 0.4 };
  });
  draft.content.title = "Grouped footprints";
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await open(page, "Grouped footprints");
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const assets = graph.locator("[data-graph-entity]");
  await expect(assets).toHaveCount(20);
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
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
  await graph.getByRole("tab", { name: "Assets", exact: true }).click();
  await assets.first().click({ position: { x: 12, y: 20 } });
  await expect(graph).toContainText("1 selected");
  await expect(page.getByRole("region", { name: "Group inspector", exact: true })).toHaveCount(0);
  await expect(graph.getByRole("button", { name: "Group selected items", exact: true })).toHaveAttribute(
    "title",
    "Group",
  );
  await expect(graph.getByRole("tooltip")).toHaveCount(0);
  await assets.first().press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Rename object", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Move group", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await capture(page, "individual-group-member");
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  await group.click({ position: { x: 12, y: 20 } });
  await expect(graph).toContainText("20 selected");
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
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  await graph.locator("[data-graph-group]").click({ position: { x: 12, y: 20 } });
  await graph.locator("[data-graph-group]").press("Shift+F10");
  await page.getByRole("menuitem", { name: "Edit group members", exact: true }).click();
  await dialog.getByRole("checkbox").last().uncheck();
  await dialog.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(inspector).toContainText("19 items selected");
  await persist(page);
  await capture(page, "membership");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await graph.scrollIntoViewIfNeeded();
  await capture(page, "phone");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const loaded = await (await page.request.get("/api/studio/parallax")).json();
  const preferences = await (await page.request.get("/api/passport/preferences")).json();
  const changed = await page.request.put("/api/passport/preferences", {
    headers: { "x-csrf-token": loaded.csrfToken },
    data: {
      preferences: {
        ...preferences.preferences,
        experience: { ...preferences.preferences.experience, theme: "LIGHT", motion: "REDUCED" },
      },
    },
  });
  expect(changed.ok()).toBe(true);
  await page.reload();
  await expect(page.locator('[data-renderer="READY"]')).toHaveAttribute("data-appearance", "light");
  if (
    (await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).getAttribute("aria-pressed")) !==
    "true"
  )
    await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  await graph.locator("[data-graph-group]").click({ position: { x: 12, y: 20 } });
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

test("Assistant retains general follow-up intent, removes a reviewed asset and edits the actual scene", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Advanced Assistant Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("advanced-browser", "Ghost Footprint Trail");
  draft.content.title = "Advanced Assistant route";
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await open(page, draft.content.title);
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  const send = async (text: string) => {
    await assistant.getByRole("textbox", { name: "Describe your spatial idea", exact: true }).fill(text);
    await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
    await expect(assistant.getByRole("textbox", { name: "Describe your spatial idea", exact: true })).toHaveValue("");
    await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toBeEnabled();
  };
  const apply = async () => {
    await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
    await expect(assistant).toContainText("Your changes are saved");
  };
  await send("Rename the second footprint to Moonlit step.");
  await apply();
  const firstBefore = draft.content.entities[0].transform;
  await send("It would fit better slightly left, please.");
  await capture(page, "follow-up-reference-proposal");
  await apply();
  let saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  expect(saved.content.entities[0].transform).toEqual(firstBefore);
  expect(saved.content.entities[1].name).toBe("Moonlit step");
  expect(saved.content.entities[1].transform.position.x).not.toBe(draft.content.entities[1].transform.position.x);
  await send("Remove that same footprint from the scene.");
  expect(
    (await listSpatialItems(account.id)).find((item) => item.draft.content.definitionId === draft.content.definitionId)!
      .draft.content.entities,
  ).toHaveLength(5);
  await capture(page, "reviewed-asset-removal");
  await apply();
  saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  expect(saved.content.entities).toHaveLength(4);
  expect(saved.content.entities.some((e) => e.id === draft.content.entities[1].id)).toBe(false);
  await send("Rename this scene to Moonlit journey.");
  await apply();
  await capture(page, "advanced-scene-edit");
  saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  expect(saved.content.title).toBe("Moonlit journey");
  expect(saved.content.entities).toHaveLength(4);
});
