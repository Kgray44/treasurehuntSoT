import { openOwnedSceneFromCurrentLibrary } from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
test("Clicking visible room surfaces places the selected asset without opening Surfaces and preserves Undo", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic click placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("click-surface-fixture");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft.content.entities[0].widthMeters = 0.18;
  draft.content.title = "Click surface working Scene";
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
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await expect(canvas.getByRole("button", { name: "Toggle spatial overlays", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const pose = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!)[0];
  const initial = await pose();
  const click = async (id: string, sample?: number) => {
    const projected = JSON.parse((await host.getAttribute("data-projected-scene"))!);
    const target = projected.surfaces.find((surface: { id: string }) => surface.id === id);
    const point = sample === undefined ? target : target.samples[sample];
    const bounds = (await host.boundingBox())!;
    await page.mouse.click(bounds.x + point.x * bounds.width, bounds.y + point.y * bounds.height);
  };
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-projected-scene"))!).camera[1])
    .toBeGreaterThan(8);
  await click("table-left");
  await expect(canvas).toContainText("snapped and aligned to table left");
  const table = await pose();
  expect(table.position).not.toEqual(initial.position);
  await page.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("front");
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-projected-scene"))!).camera[0])
    .toBeCloseTo(0, 4);
  const surfaces = JSON.parse((await host.getAttribute("data-projected-scene"))!).surfaces;
  const wall = surfaces.find(
    (surface: { id: string; surface: string; normal: { z: number } }) =>
      surface.surface === "WALL" && surface.normal.z > 0.9,
  );
  await click(wall.id, 0);
  await expect.poll(async () => (await pose()).rotation).not.toEqual(table.rotation);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect.poll(async () => (await pose()).position).toEqual(table.position);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.surfacePreviewFrames!.some((frame) => frame.surfaceId === "table-left")).toBe(true);
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/click-surface-placed-and-restored.png` });
});
