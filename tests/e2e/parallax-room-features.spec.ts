import {
  closeCurrentLibrary,
  openOwnedSceneFromCurrentLibrary,
  saveCurrentWorkingDraft,
} from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { placeOnRoomFeature } from "../../src/parallax/room-placement";
import { simulationEnvironments } from "../../src/parallax/studio-validation";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
test("Environment editing selects rendered features and shares live transform gizmos, history and persistence", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic room gizmo Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("room-gizmo-fixture");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: "window",
  });
  draft.content.title = "Fixture " + draft.content.definitionId;
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await openOwnedSceneFromCurrentLibrary(page, {
    definitionId: draft.content.definitionId,
    title: draft.content.title,
    state: "WORKING",
  });
  await closeCurrentLibrary(page);
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
  await expect
    .poll(
      async () =>
        JSON.parse((await host.getAttribute("data-projected-scene"))!).features.filter((feature: { id: string }) =>
          draft.content.studio!.environment!.features.some((original) => original.id === feature.id),
        ).length,
    )
    .toBe(draft.content.studio!.environment!.features.length);
  const projected = async () => {
    const value = JSON.parse((await host.getAttribute("data-projected-scene"))!);
    const rect = (await host.boundingBox())!;
    const pixel = (point: { x: number; y: number }) => ({
      x: rect.x + point.x * rect.width,
      y: rect.y + point.y * rect.height,
    });
    return {
      features: value.features.map((feature: { id: string; x: number; y: number }) => ({
        ...feature,
        ...pixel(feature),
      })),
      handles: Object.fromEntries(
        Object.entries(value.handles).map(([id, point]) => [id, pixel(point as { x: number; y: number })]),
      ),
    };
  };
  const desk = (await projected()).features.find((feature: { id: string }) => feature.id === "reference-desk");
  await page.mouse.click(desk.x, desk.y);
  const featureSelect = canvas.getByRole("combobox", { name: "Viewport room feature", exact: true });
  await expect(featureSelect).toHaveValue("reference-desk");
  const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
  await expect(editor.getByRole("combobox", { name: "Room feature", exact: true })).toHaveValue("reference-desk");
  const bounds = async () =>
    JSON.parse((await host.getAttribute("data-room-receipt"))!).find(
      (feature: { id: string }) => feature.id === "reference-desk",
    ) as { min: number[]; max: number[] };
  const centerX = async () => {
    const feature = await bounds();
    return (feature.min[0] + feature.max[0]) / 2;
  };
  const initialX = await centerX();
  const clueX = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!)[0].position[0];
  const initialClueX = await clueX();
  expect(draft.content.studio!.surfacePreviewFrames![0].surfaceId).toBe("reference-desk");
  await canvas.getByRole("button", { name: "Move tool", exact: true }).click();
  await expect.poll(async () => Boolean((await projected()).handles.X)).toBe(true);
  const handle = (await projected()).handles.X;
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y, { steps: 12 });
  await expect.poll(centerX).not.toBeCloseTo(initialX);
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/room-feature-live-gizmo.png` });
  await page.mouse.up();
  const movedX = Number(await editor.getByLabel("Feature x (m)", { exact: true }).inputValue());
  expect(Math.abs(movedX - initialX)).toBeGreaterThan(0.05);
  await expect.poll(centerX).toBeCloseTo(movedX);
  await expect.poll(clueX).toBeCloseTo(initialClueX + movedX - initialX);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect.poll(centerX).toBeCloseTo(initialX);
  await expect.poll(clueX).toBeCloseTo(initialClueX);
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await expect.poll(centerX).toBeCloseTo(movedX);
  await expect.poll(clueX).toBeCloseTo(initialClueX + movedX - initialX);
  await canvas.getByRole("button", { name: "Scale tool", exact: true }).click();
  await expect.poll(async () => Boolean((await projected()).handles.X)).toBe(true);
  const originalWidth = Number(await editor.getByLabel("Feature width (m)", { exact: true }).inputValue());
  const scaleHandle = (await projected()).handles.X;
  await page.mouse.move(scaleHandle.x, scaleHandle.y);
  await page.mouse.down();
  await page.mouse.move(scaleHandle.x + 30, scaleHandle.y, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await editor.getByLabel("Feature width (m)", { exact: true }).inputValue()))
    .not.toBeCloseTo(originalWidth);
  await canvas.getByRole("button", { name: "Rotate tool", exact: true }).click();
  await expect.poll(async () => Object.keys((await projected()).handles)).toEqual(["Y"]);
  for (const feature of draft.content.studio!.environment!.features) {
    await featureSelect.selectOption(feature.id);
    await expect(editor.getByLabel("Room feature", { exact: true })).toHaveValue(feature.id);
  }
  await featureSelect.selectOption("reference-desk");
  await host.locator("canvas").focus();
  await host.locator("canvas").press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Move feature", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(
    saved.content.studio!.environment!.features.filter((feature) => feature.classification !== "EXCLUSION_ZONE"),
  ).toHaveLength(draft.content.studio!.environment!.features.length);
  expect(
    saved.content.studio!.environment!.features.find((feature) => feature.id === "reference-desk")!.position.x,
  ).toBeCloseTo(movedX);
  await page.screenshot({ path: `${root}/room-feature-gizmo-saved.png` });
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  await expect.poll(centerX).toBeCloseTo(movedX);
  await expect.poll(clueX).toBeCloseTo(initialClueX + movedX - initialX);
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.screenshot({ path: `${root}/room-feature-gizmo-reloaded.png` });
});
test("Creator edits semantic room dimensions and furniture while the actual rendered clue follows its desk across reload", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic editable room Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("editable-room-fixture");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: "window",
  });
  draft.content.title = "Fixture " + draft.content.definitionId;
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await openOwnedSceneFromCurrentLibrary(page, {
    definitionId: draft.content.definitionId,
    title: draft.content.title,
    state: "WORKING",
  });
  await closeCurrentLibrary(page);
  const host = page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  const photo = page.getByRole("region", { name: "Room photograph reconstruction", exact: true });
  await expect(photo).toContainText("manual room editing is available.");
  await expect(photo.getByLabel("Room photograph", { exact: true })).toBeDisabled();
  await mkdir(root, { recursive: true });
  await photo.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/photo-room-unavailable-manual.png` });
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Environment", exact: true })).toHaveValue("editable-bedroom");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Room feature", { exact: true }).selectOption("reference-desk");
  const roomContext = page.getByRole("region", { name: "Room spatial context", exact: true });
  const showProperties = () => page.getByRole("button", { name: "Open object properties", exact: true }).click();
  const showContext = () => page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  const roomReceipt = async () =>
    JSON.parse((await host.getAttribute("data-room-receipt"))!) as { id: string; min: number[]; max: number[] }[];
  const center = async () => {
    const desk = (await roomReceipt()).find((f) => f.id === "reference-desk")!;
    return (desk.min[0] + desk.max[0]) / 2;
  };
  await expect
    .poll(center)
    .toBeCloseTo(draft.content.studio!.environment!.features.find((f) => f.id === "reference-desk")!.position.x);
  await showContext();
  const checks = roomContext.getByLabel("Construction checks", { exact: true });
  const reviewConstruction = async () => {
    await showContext();
    if (!(await checks.evaluate((element) => (element as HTMLDetailsElement).open)))
      await checks.getByRole("button", { name: /Construction checks/ }).click();
  };
  await checks.getByRole("button", { name: /Construction checks · checks passed/ }).click();
  await expect(checks).toContainText("No findings within these checks");
  await showProperties();
  await editor.getByLabel("Feature x (m)", { exact: true }).fill("2");
  await editor.getByLabel("Feature x (m)", { exact: true }).press("Tab");
  await reviewConstruction();
  await expect(checks).toContainText("needs correction");
  await expect(checks).toContainText("extends outside");
  await checks.getByRole("button", { name: "reference desk", exact: true }).first().click();
  await page.screenshot({ path: `${root}/room-construction-finding.png` });
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await reviewConstruction();
  await expect(checks).toContainText("checks passed");
  await showProperties();
  const entityX = async () =>
    (JSON.parse((await host.getAttribute("data-scene-receipt"))!) as { position: number[] }[])[0].position[0];
  const initialPose = JSON.parse((await host.getAttribute("data-scene-receipt"))!)[0].position as number[];
  const initialDesk = draft.content.studio!.environment!.features.find((feature) => feature.id === "reference-desk")!;
  const offset = { x: initialPose[0] - initialDesk.position.x, z: initialPose[2] - initialDesk.position.z };
  const attachedX = (deskX: number, yaw: number) =>
    deskX + offset.x * Math.cos((yaw * Math.PI) / 180) + offset.z * Math.sin((yaw * Math.PI) / 180);
  expect(draft.content.studio!.surfacePreviewFrames![0].surfaceId).toBe("reference-desk");
  await editor.getByLabel("Feature depth (m)", { exact: true }).focus();
  await expect(editor.getByLabel("Feature depth (m)", { exact: true })).toHaveValue("0.9");
  await editor.getByLabel("Feature x (m)", { exact: true }).fill("0.6");
  await editor.getByLabel("Feature x (m)", { exact: true }).press("Tab");
  await expect.poll(center).toBeCloseTo(0.6);
  await expect.poll(entityX).toBeCloseTo(attachedX(0.6, 0));
  await editor.getByLabel("Feature z (m)", { exact: true }).fill("0.6");
  await editor.getByLabel("Feature z (m)", { exact: true }).press("Tab");
  await editor.getByLabel("Feature rotation (degrees)", { exact: true }).fill("45");
  await editor.getByLabel("Feature rotation (degrees)", { exact: true }).press("Tab");
  await editor.getByLabel("Feature name", { exact: true }).fill("Window writing table");
  await editor.getByLabel("Feature name", { exact: true }).press("Tab");
  await editor.getByLabel("Room feature classification", { exact: true }).selectOption("TABLE");
  await expect(editor.getByLabel("Room feature", { exact: true })).toHaveValue("reference-desk");
  await showContext();
  const dimensions = roomContext.getByLabel("Room dimensions", { exact: true });
  if (!(await dimensions.evaluate((element) => (element as HTMLDetailsElement).open)))
    await dimensions.locator("summary").click();
  await roomContext.getByLabel("Room width (m)", { exact: true }).fill("-1");
  await roomContext.getByLabel("Room width (m)", { exact: true }).press("Tab");
  await expect(roomContext.getByRole("alert")).toBeVisible();
  await expect(roomContext.getByRole("alert")).toContainText("between 1 and 100 metres");
  await expect
    .poll(() =>
      roomContext.getByRole("alert").evaluate((alert) => {
        const inspector = alert.closest("aside")!;
        const title = inspector.querySelector("h2")!;
        const bounds = alert.getBoundingClientRect(),
          panel = inspector.getBoundingClientRect();
        return bounds.top >= Math.max(panel.top, title.getBoundingClientRect().bottom) && bounds.bottom <= panel.bottom;
      }),
    )
    .toBe(true);
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/room-feature-invalid.png` });
  await expect.poll(center).toBeCloseTo(0.6);
  await roomContext.getByLabel("Room width (m)", { exact: true }).fill("5");
  await roomContext.getByLabel("Room width (m)", { exact: true }).press("Tab");
  await expect(roomContext.getByRole("alert")).toHaveCount(0);
  await expect.poll(center).toBeCloseTo(0.75);
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.environment!.width).toBe(5);
  expect(saved.content.studio!.environment!.features.find((f) => f.id === "reference-desk")!.yawDegrees).toBe(45);
  expect(saved.content.studio!.environment!.features.find((f) => f.id === "reference-desk")!.classification).toBe(
    "TABLE",
  );
  expect(saved.content.studio!.environment!.features.find((f) => f.id === "reference-desk")!.name).toBe(
    "Window writing table",
  );
  await page.screenshot({ path: `${root}/room-feature-correction.png` });
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  await expect.poll(center).toBeCloseTo(0.75);
  await expect.poll(entityX).toBeCloseTo(attachedX(0.75, 45));
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.screenshot({ path: `${root}/room-feature-restored.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("region", { name: "Spatial canvas", exact: true })
    .getByText("View & audio", { exact: true })
    .click();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await editor.getByLabel("Room feature", { exact: true }).selectOption("reference-desk");
  await expect(editor.getByLabel("Room feature classification", { exact: true })).toHaveValue("TABLE");
  await expect(editor.getByLabel("Feature name", { exact: true })).toHaveValue("Window writing table");
  await editor.getByLabel("Feature name", { exact: true }).focus();
  expect(
    (await page.getByRole("complementary", { name: "Spatial inspector", exact: true }).boundingBox())!.width,
  ).toBeGreaterThan(250);
  expect((await editor.getByLabel("Feature name", { exact: true }).boundingBox())!.width).toBeGreaterThan(200);
  await page.screenshot({ path: `${root}/room-feature-phone.png` });
  await editor.getByLabel("Feature x (m)", { exact: true }).fill("0.65");
  await editor.getByLabel("Feature x (m)", { exact: true }).press("Tab");
  await expect.poll(center).toBeCloseTo(0.65);
  await expect.poll(entityX).toBeCloseTo(attachedX(0.65, 45));
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  await page.getByRole("button", { name: "Collapse Inspector", exact: true }).click();
  await host.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/room-feature-phone-edited.png` });
});
