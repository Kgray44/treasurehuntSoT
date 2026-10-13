import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft, editSpatialDraft, previewEntityTransform } from "../../src/parallax/authoring";
import { createRoomEnvironment, authoredPreviewEnvironment } from "../../src/parallax/environment-authoring";
import { placeOnRoomFeature } from "../../src/parallax/room-placement";
import { syntheticEnvironmentEvidence } from "../../src/parallax/adaptive-authoring";
import { placeOnSurface } from "../../src/parallax/surface-placement";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

test("Creator sees a receiving surface during real dragging, clamps on release, freely positions with clamping off and selects directly in the viewport", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic direct placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("direct-placement");
  const id = draft.content.entities[0].id;
  draft.content.entities[0].name = "Table clue";
  draft.content.entities[0].widthMeters = 0.18;
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, id, {
    classification: "TABLE",
    targetFeatureId: "table-left",
    nearFeatureId: null,
  });
  const otherId = "direct-placement:second-clue";
  draft = editSpatialDraft(draft, { type: "DUPLICATE", entityId: id, newId: otherId });
  draft.content.entities[1].name = "Second clue";
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Desk Map.*My Library/ }).click();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const graphEntity = (entityId: string) => graph.locator(`[data-graph-entity="${entityId}"]`);
  await graphEntity(id).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  const receipts = async () => JSON.parse((await host.getAttribute("data-scene-receipt")) ?? "[]") as RendererReceipt[];
  const selectedReceipt = async () => (await receipts()).find((item) => item.id === id)!;
  await expect.poll(async () => (await selectedReceipt())?.position).toBeTruthy();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await canvas.getByRole("button", { name: "Move tool", exact: true }).click();
  await canvas.getByRole("button", { name: "Toggle snapping", exact: true }).click();
  const start = await selectedReceipt();
  const lift = async () => {
    await expect
      .poll(async () => JSON.parse((await host.getAttribute("data-projected-scene")) ?? "{}").handles?.Y)
      .toBeTruthy();
    const projected = JSON.parse((await host.getAttribute("data-projected-scene"))!);
    const handle = projected.handles.Y;
    const box = (await host.locator("canvas").boundingBox())!;
    await page.mouse.move(box.x + handle.x * box.width, box.y + handle.y * box.height);
    await page.mouse.down();
    await page.mouse.move(box.x + handle.x * box.width, box.y + handle.y * box.height - 50, { steps: 12 });
  };
  await mkdir(root, { recursive: true });
  await lift();
  await expect(canvas.getByText(/Release to attach to table left/)).toBeVisible();
  expect(JSON.parse((await host.getAttribute("data-drag-placement"))!).surfaceId).toBe("table-left");
  expect((await selectedReceipt()).position[1]).toBeGreaterThan(start.position[1] + 0.01);
  expect(
    (await listSpatialItems(account.id)).find((item) => item.draft.content.definitionId === draft.content.definitionId)!
      .draft,
  ).toEqual(draft);
  await page.screenshot({ path: `${root}/direct-clamp-held-preview.png` });
  await page.mouse.up();
  await expect(canvas).toContainText("snapped and aligned to table left");
  await expect.poll(async () => (await selectedReceipt()).position[1]).toBeCloseTo(start.position[1], 4);
  await expect(host).not.toHaveAttribute("data-drag-placement");
  await page.screenshot({ path: `${root}/direct-clamped-release.png` });
  await canvas.getByRole("button", { name: "Auto surface clamping", exact: true }).click();
  await lift();
  await expect(canvas.getByText("Free placement · surface clamping is off", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${root}/direct-free-held-preview.png` });
  await page.mouse.up();
  await expect.poll(async () => (await selectedReceipt()).position[1]).toBeGreaterThan(start.position[1] + 0.01);
  const free = await selectedReceipt();
  await page.screenshot({ path: `${root}/direct-free-release.png` });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await selectedReceipt()).position[1]).toBeCloseTo(start.position[1], 4);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await selectedReceipt()).position[1]).toBeCloseTo(free.position[1], 4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  const room = authoredPreviewEnvironment(saved.content, {
    ...simulationEnvironments[0],
    id: saved.content.studio!.environment!.id,
  });
  const pose = previewEntityTransform(saved.content, id, room.id, room);
  const table = syntheticEnvironmentEvidence(room).candidates.find((c) => c.id === "table-left")!;
  expect(placeOnSurface(pose, table, saved.content.entities[0].widthMeters)).not.toBeNull();
  // Graph selection and direct raycast must select the same real entity and Inspector.
  await canvas.getByRole("button", { name: "Select tool", exact: true }).click();
  await graphEntity(otherId).click();
  await expect(graphEntity(otherId)).toHaveAttribute("aria-pressed", "true");
  await canvas.getByRole("button", { name: "Edit selected object", exact: true }).click();
  const overview = page.getByText("Overview / Identity", { exact: true });
  if ((await overview.locator("..").getAttribute("open")) === null) await overview.click();
  await expect(page.getByRole("textbox", { name: "Object name", exact: true })).toHaveValue("Second clue");
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await graphEntity(id).click();
  const projected = JSON.parse((await host.getAttribute("data-projected-scene"))!);
  const target = projected.objects.find((item: { id: string }) => item.id === otherId);
  const box = (await host.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + target.x * box.width, box.y + target.y * box.height);
  await expect(graphEntity(otherId)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Object name", exact: true })).toHaveValue("Second clue");
  await page.screenshot({ path: `${root}/direct-viewport-selection.png` });
  await page.reload();
  await expect.poll(async () => (await selectedReceipt())?.position).toBeTruthy();
  expect(
    (await listSpatialItems(account.id)).find((item) => item.draft.content.definitionId === draft.content.definitionId)!
      .draft,
  ).toEqual(saved);
  await writeFile(
    `${root}/direct-placement-proof.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME ?? "UNSPECIFIED",
        start,
        free,
        savedPose: pose,
        surfaceId: table.id,
        errors,
        limits:
          "Actual pointer gestures in a synthetic software-rendered room; no physical surface tracking or hardware performance claim.",
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});
