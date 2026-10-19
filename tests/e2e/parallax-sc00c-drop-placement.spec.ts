import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft } from "../../src/parallax/library-service";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("Library physical drag uses the pointed support and selects the inserted instance", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC-00C drag placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft(crypto.randomUUID(), "Library drop scene");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.getByRole("heading", { name: "Parallax", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  const card = library
    .getByRole("article")
    .filter({ has: page.getByRole("button", { name: "Inspect Treasure chest" }) });
  await expect(card).toBeVisible();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-projected-scene"))!).camera[1])
    .toBeGreaterThan(8);
  const projected = JSON.parse((await host.getAttribute("data-projected-scene"))!);
  const floor = projected.surfaces.find((surface: { surface: string }) => surface.surface === "FLOOR");
  expect(floor).toBeTruthy();
  const bounds = (await host.locator("canvas").boundingBox())!;
  const point = floor.samples[0];
  await card.scrollIntoViewIfNeeded();
  const source = (await card.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2 + 12, { steps: 4 });
  await page.mouse.move(bounds.x + point.x * bounds.width, bounds.y + point.y * bounds.height, { steps: 12 });
  await expect(host).toHaveAttribute("data-drag-placement", /"surfaceId"/);
  const evidence = "artifacts/sc00c/drag-placement";
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/pointed-floor-preview.png`, fullPage: true });
  await page.mouse.up();
  await expect(host).not.toHaveAttribute("data-drag-placement");
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!).length)
    .toBe(draft.content.entities.length + 1);
  const receipts = JSON.parse((await host.getAttribute("data-scene-receipt"))!);
  const inserted = receipts.find(
    (receipt: { id: string }) => !draft.content.entities.some((entity) => entity.id === receipt.id),
  );
  expect(inserted).toBeTruthy();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Treasure chest");
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!).length)
    .toBe(draft.content.entities.length);
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!).length)
    .toBe(draft.content.entities.length + 1);
  await card.dragTo(host.locator("canvas"), {
    targetPosition: { x: bounds.width * 0.15, y: bounds.height * 0.5 },
  });
  await expect(canvas).toContainText("No clear floor support at the drop point. Nothing was inserted.");
  expect(JSON.parse((await host.getAttribute("data-scene-receipt"))!).length).toBe(draft.content.entities.length + 1);
  await page.screenshot({ path: `${evidence}/pointed-floor-insertion.png`, fullPage: true });
});
