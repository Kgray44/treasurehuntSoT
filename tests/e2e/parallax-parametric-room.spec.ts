import { openOwnedSceneFromCurrentLibrary } from "./fixtures/parallax-current-library";
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

test("Creator adds and rebuilds actual furniture, protects a bound desk, corrects scale and retains the room through reload and phone edits", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic parametric room Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("parametric-room");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: "window",
  });
  draft.content.title = "Parametric working Scene";
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await openOwnedSceneFromCurrentLibrary(page, {
    definitionId: draft.content.definitionId,
    title: draft.content.title,
    state: "WORKING",
  });
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  const receipt = async () =>
    JSON.parse((await host.getAttribute("data-room-receipt"))!) as {
      id: string;
      partIds: string[];
      min: number[];
      max: number[];
    }[];
  const entityY = async () =>
    (JSON.parse((await host.getAttribute("data-scene-receipt"))!) as { position: number[] }[])[0].position[1];
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
  await editor.getByText("Add room features", { exact: true }).click();
  await editor.getByLabel("New room feature type", { exact: true }).selectOption("CHAIR");
  await editor.getByRole("button", { name: "Add room feature", exact: true }).click();
  const featureId = await editor.getByLabel("Room feature", { exact: true }).inputValue();
  const partCount = async () => (await receipt()).find((r) => r.id === featureId)?.partIds.length ?? 0;
  await expect.poll(partCount).toBe(6);
  await editor.getByLabel("Feature x (m)", { exact: true }).fill("1.25");
  await editor.getByLabel("Feature x (m)", { exact: true }).press("Tab");
  await editor.getByLabel("Feature z (m)", { exact: true }).fill("0.75");
  await editor.getByLabel("Feature z (m)", { exact: true }).press("Tab");
  await editor.getByLabel("Feature name", { exact: true }).fill("Reading seat");
  await editor.getByLabel("Feature name", { exact: true }).press("Tab");
  await editor.getByLabel("Room feature classification", { exact: true }).selectOption("SOFA");
  await editor.getByText("Correct or remove this feature", { exact: true }).click();
  await editor.getByRole("button", { name: "Rebuild generic feature shape", exact: true }).click();
  await expect.poll(partCount).toBe(9);
  await editor.getByLabel("Feature width (m)", { exact: true }).fill("1.5");
  await editor.getByLabel("Feature width (m)", { exact: true }).press("Tab");
  await mkdir(root, { recursive: true });
  await editor.getByRole("button", { name: "Rebuild generic feature shape", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/parametric-rebuilt-sofa.png` });
  await editor.getByRole("button", { name: "Remove room feature", exact: true }).click();
  await expect.poll(partCount).toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect.poll(partCount).toBe(9);
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await expect.poll(partCount).toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect.poll(partCount).toBe(9);
  await editor.getByLabel("Room feature", { exact: true }).selectOption("reference-desk");
  const boundDesk = (await receipt()).find((r) => r.id === "reference-desk");
  const boundClue = await host.getAttribute("data-scene-receipt");
  await editor.getByRole("button", { name: "Remove room feature", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("attached");
  await expect.poll(async () => (await receipt()).some((r) => r.id === "reference-desk")).toBe(true);
  await editor.getByRole("alert").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/parametric-bound-support-protected.png` });
  await editor.getByRole("button", { name: "Rebuild generic feature shape", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("attached");
  expect((await receipt()).find((r) => r.id === "reference-desk")).toEqual(boundDesk);
  expect(await host.getAttribute("data-scene-receipt")).toBe(boundClue);
  await editor.getByRole("alert").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/parametric-bound-rebuild-protected.png` });
  await editor.getByText("Scale room from a known measurement", { exact: true }).click();
  await editor.getByLabel("Known measurement (m)", { exact: true }).fill("1.95");
  await editor.getByRole("button", { name: "Apply known measurement", exact: true }).click();
  await expect(editor.getByRole("alert")).toHaveCount(0);
  await expect.poll(entityY).toBeCloseTo(1.135);
  await expect(editor).toContainText("width 1.95 m");
  await editor.getByText(/Scale reference:/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/parametric-known-measurement.png` });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.environment!.width).toBeCloseTo(6);
  expect(saved.content.studio!.environment!.scaleReference).toEqual({
    featureId: "reference-desk",
    axis: "WIDTH",
    measuredMeters: 1.95,
  });
  expect(saved.content.studio!.environment!.features.find((f) => f.id === featureId)!.classification).toBe("SOFA");
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  await expect.poll(entityY).toBeCloseTo(1.135);
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.getByRole("button", { name: "Collapse Inspector", exact: true }).click();
  await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({ path: `${root}/parametric-restored-room.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await editor.getByLabel("Room feature", { exact: true }).selectOption(featureId);
  await editor.getByLabel("Feature name", { exact: true }).focus();
  await page.screenshot({ path: `${root}/parametric-phone-feature.png` });
  await editor.getByLabel("Feature name", { exact: true }).fill("Window reading sofa");
  await editor.getByLabel("Feature name", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const phoneSaved = (await listSpatialItems(account.id))[0].draft;
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(phoneSaved);
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await editor.getByLabel("Room feature", { exact: true }).selectOption(featureId);
  await expect(editor.getByLabel("Feature name", { exact: true })).toHaveValue("Window reading sofa");
  await editor.getByLabel("Feature name", { exact: true }).focus();
  await page.screenshot({ path: `${root}/parametric-phone-reloaded.png` });
});
