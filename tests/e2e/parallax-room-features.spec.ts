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
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Library & hierarchy", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Desk Map.*My Library/ }).click();
  const host = page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  const photo = page.getByRole("region", { name: "Room photograph reconstruction", exact: true });
  await expect(photo).toContainText("manual room editing is available.");
  await expect(photo.getByLabel("Room photograph", { exact: true })).toBeDisabled();
  await mkdir(root, { recursive: true });
  await photo.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/photo-room-unavailable-manual.png` });
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Environment", exact: true })).toHaveValue("editable-bedroom");
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
  await expect(editor).toBeVisible();
  const roomReceipt = async () =>
    JSON.parse((await host.getAttribute("data-room-receipt"))!) as { id: string; min: number[]; max: number[] }[];
  const center = async () => {
    const desk = (await roomReceipt()).find((f) => f.id === "reference-desk")!;
    return (desk.min[0] + desk.max[0]) / 2;
  };
  await expect.poll(center).toBeCloseTo(0.25);
  const entityX = async () =>
    (JSON.parse((await host.getAttribute("data-scene-receipt"))!) as { position: number[] }[])[0].position[0];
  await editor.getByLabel("Feature depth (m)", { exact: true }).focus();
  await expect(editor.getByLabel("Feature depth (m)", { exact: true })).toHaveValue("0.9");
  await editor.getByLabel("Feature x (m)", { exact: true }).fill("0.6");
  await editor.getByLabel("Feature x (m)", { exact: true }).press("Tab");
  await expect.poll(center).toBeCloseTo(0.6);
  await expect.poll(entityX).toBeCloseTo(0.6);
  await editor.getByLabel("Feature rotation (degrees)", { exact: true }).fill("45");
  await editor.getByLabel("Feature rotation (degrees)", { exact: true }).press("Tab");
  await editor.getByLabel("Feature name", { exact: true }).fill("Window writing table");
  await editor.getByLabel("Feature name", { exact: true }).press("Tab");
  await editor.getByLabel("Room feature classification", { exact: true }).selectOption("TABLE");
  await expect(editor.getByLabel("Room feature", { exact: true })).toHaveValue("reference-desk");
  await editor.getByLabel("Room width (m)", { exact: true }).fill("-1");
  await editor.getByLabel("Room width (m)", { exact: true }).press("Tab");
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(editor.getByRole("alert")).toContainText("between 1 and 100 metres");
  await expect
    .poll(() =>
      editor.getByRole("alert").evaluate((alert) => {
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
  await editor.getByLabel("Room width (m)", { exact: true }).fill("5");
  await editor.getByLabel("Room width (m)", { exact: true }).press("Tab");
  await expect(editor.getByRole("alert")).toHaveCount(0);
  await expect.poll(center).toBeCloseTo(0.75);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
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
  await expect.poll(entityX).toBeCloseTo(0.75);
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.screenshot({ path: `${root}/room-feature-restored.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
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
  await expect.poll(entityX).toBeCloseTo(0.65);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  await page.getByRole("button", { name: "Collapse Inspector", exact: true }).click();
  await host.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/room-feature-phone-edited.png` });
});
