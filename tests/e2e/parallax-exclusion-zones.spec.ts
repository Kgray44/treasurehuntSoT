import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { createGenericRoomFeature } from "../../src/parallax/parametric-room";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
test("Environment zones use real gizmos, retain edits and deletion, and disappear from ordinary scene rendering", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180000);
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Exclusion Zone Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("exclusion-journey", "Desk Map");
  draft.content.title = "Synthetic exclusion zones";
  const room = createRoomEnvironment(simulationEnvironments.find((entry) => entry.id === "empty")!);
  room.features.push(
    createGenericRoomFeature({
      id: "work-table",
      classification: "TABLE",
      name: "Work table",
      dimensions: [2, 0.8, 1.2],
    }),
    createGenericRoomFeature({
      id: "test-instrument",
      classification: "APPLIANCE",
      name: "Instrument",
      applianceShape: "GENERIC_BOX",
      dimensions: [0.4, 0.3, 0.4],
      position: { x: 0, y: 0.95, z: 0 },
    }),
  );
  draft.content.studio!.environment = room;
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Synthetic exclusion zones.*My Library/ }).click();
  const host = page.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
  await editor.getByRole("button", { name: /Exclusion zones ·/ }).click();
  const receipt = async () =>
    JSON.parse((await host.getAttribute("data-room-receipt"))!) as { id: string; min: number[]; max: number[] }[];
  const save = async () => {
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Working draft saved");
  };
  const currentRoom = async () =>
    (await listSpatialItems(account.id)).find((item) => item.draft.content.title === draft.content.title)!.draft.content
      .studio!.environment!;
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await save();
  const automatic = (await currentRoom()).features.find(
    (feature) =>
      feature.exclusion?.sourceFeatureId === "test-instrument" && feature.exclusion.surfaceId === "work-table:top",
  )!;
  expect(automatic).toBeDefined();
  await expect.poll(async () => (await receipt()).some((entry) => entry.id === automatic.id)).toBe(true);
  await page.screenshot({ path: `${root}/exclusion-automatic.png` });

  await editor.getByRole("button", { name: "Add exclusion zone", exact: true }).click();
  await editor.getByRole("textbox", { name: "Feature name", exact: true }).fill("Reserved workspace");
  await editor.getByRole("textbox", { name: "Feature name", exact: true }).press("Tab");
  const change = async (name: string, value: string) => {
    const field = editor.getByRole("spinbutton", { name, exact: true });
    await field.fill(value);
    await field.press("Tab");
  };
  await change("Feature x (m)", "-0.6");
  await change("Feature y (m)", "0.95");
  await change("Feature width (m)", "0.5");
  await change("Feature height (m)", "0.3");
  await change("Feature depth (m)", "0.5");
  await editor
    .getByRole("combobox", { name: "Exclusion reserved surface", exact: true })
    .selectOption("work-table:top");
  await save();
  const manual = (await currentRoom()).features.find((feature) => feature.name === "Reserved workspace")!;
  await page.getByRole("button", { name: "Move tool", exact: true }).click();
  await expect
    .poll(async () => Boolean(JSON.parse((await host.getAttribute("data-projected-scene"))!).handles.X))
    .toBe(true);
  const projected = JSON.parse((await host.getAttribute("data-projected-scene"))!).handles.X;
  const rect = (await host.boundingBox())!;
  const x = rect.x + projected.x * rect.width,
    y = rect.y + projected.y * rect.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y, { steps: 15 });
  await expect
    .poll(async () => (await receipt()).find((entry) => entry.id === manual.id)!.min[0])
    .not.toBeCloseTo(-0.85);
  await page.screenshot({ path: `${root}/exclusion-live-move.png` });
  await page.mouse.up();
  await save();
  const moved = (await currentRoom()).features.find((feature) => feature.id === manual.id)!;
  expect(moved.position.x).not.toBeCloseTo(manual.position.x);
  await change("Feature rotation (degrees)", "35");
  await change("Feature width (m)", "0.7");
  await save();
  await page.screenshot({ path: `${root}/exclusion-edited.png` });
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await expect.poll(async () => (await receipt()).some((entry) => entry.id === manual.id)).toBe(false);
  await page.screenshot({ path: `${root}/exclusion-normal-scene.png` });
  await page.reload();
  await expect.poll(async () => (await receipt()).some((entry) => entry.id === "work-table")).toBe(true);
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await editor.getByRole("combobox", { name: "Room feature", exact: true }).selectOption(manual.id);
  await expect(editor.getByRole("spinbutton", { name: "Feature width (m)", exact: true })).toHaveValue("0.7");
  await expect(editor.getByRole("spinbutton", { name: "Feature rotation (degrees)", exact: true })).toHaveValue("35");
  await editor.getByRole("combobox", { name: "Room feature", exact: true }).selectOption(automatic.id);
  await editor.getByRole("button", { name: "Correct or remove this feature", exact: true }).click();
  await editor.getByRole("button", { name: "Remove room feature", exact: true }).click();
  await save();
  expect((await currentRoom()).features.some((feature) => feature.id === automatic.id)).toBe(false);
  await expect.poll(async () => (await receipt()).some((entry) => entry.id === automatic.id)).toBe(false);
  await page.screenshot({ path: `${root}/exclusion-deleted.png` });
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
  await expect(host).toHaveAttribute("data-appearance", "light");
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await editor.getByRole("combobox", { name: "Room feature", exact: true }).selectOption(manual.id);
  await expect.poll(async () => (await receipt()).some((entry) => entry.id === manual.id)).toBe(true);
  await page.screenshot({ path: `${root}/exclusion-light-reduced-motion.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(editor.getByRole("textbox", { name: "Feature name", exact: true })).toBeVisible();
  await change("Feature width (m)", "0.8");
  await save();
  expect((await currentRoom()).features.find((feature) => feature.id === manual.id)!.dimensions[0]).toBe(0.8);
  await page.screenshot({ path: `${root}/exclusion-phone-edited.png` });
  expect(errors).toEqual([]);
});
