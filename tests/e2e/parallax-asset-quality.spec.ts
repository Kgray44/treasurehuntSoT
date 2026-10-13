import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft, editSpatialDraft, presetNames } from "../../src/parallax/authoring";
import { insertSpatialPreset } from "../../src/parallax/editor-assets";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { placeOnRoomFeature } from "../../src/parallax/room-placement";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { spatialPropStyle } from "../../src/parallax/prop-style";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("Creator inspects representative actual asset materials at useful distances in both appearances without altering the saved scene", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180000);
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic asset quality Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("asset-quality-map");
  for (const [index, name] of presetNames.entries()) {
    if (name !== "Desk Map") draft = insertSpatialPreset(draft, name, `asset-quality-${index}`);
  }
  draft.content.title = "Asset material study";
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: null,
  });
  const assets = presetNames.map(
    (preset) =>
      draft.content.entities.find((entity) =>
        preset === "Ghost Footprint Trail" ? entity.name === "Footprint 1" : entity.name === preset,
      )!,
  );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  const observations: unknown[] = [];
  for (const theme of ["DARK", "LIGHT"] as const) {
    await page.goto("/studio/library");
    const preferences = await (await context.request.get("/api/passport/preferences")).json();
    const loaded = await (await context.request.get("/api/studio/parallax")).json();
    const response = await context.request.put("/api/passport/preferences", {
      headers: { "x-csrf-token": loaded.csrfToken },
      data: {
        preferences: {
          ...preferences.preferences,
          experience: { ...preferences.preferences.experience, theme, motion: "REDUCED" },
        },
      },
    });
    expect(response.ok()).toBe(true);
    await page.reload();
    await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
    await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
    await page.getByRole("button", { name: /Asset material study.*My Library/ }).click();
    await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
    const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
    const host = canvas.locator('[data-renderer="READY"]');
    await expect(host).toHaveAttribute("data-appearance", theme.toLowerCase());
    await expect(host).toHaveAttribute("data-rendered", "true");
    await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
    await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
    await page.screenshot({ path: `${root}/asset-quality-room-${theme.toLowerCase()}.png` });
    const receipts = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[];
    for (const asset of assets) {
      const hierarchy = page.getByRole("button", { name: "Open Scene Hierarchy", exact: true });
      if ((await hierarchy.getAttribute("aria-pressed")) !== "true") await hierarchy.click();
      const graph = page.getByRole("region", { name: "Scene graph", exact: true });
      await graph.locator(`[data-graph-entity="${asset.id}"]`).click();
      await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
      if (!(await canvas.getByRole("button", { name: "Show room", exact: true }).isVisible()))
        await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
      await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
      await expect.poll(async () => (await receipts()).find((row) => row.id === asset.id)?.status).toBe("IN_VIEW");
      if (spatialPropStyle(asset) === "FOOTPRINT") {
        const foot = (await receipts()).find((row) => row.id === asset.id)!;
        expect(foot.bounds.min[1]).toBeCloseTo(0.02);
        expect(foot.bounds.max[1] - foot.bounds.min[1]).toBeLessThan(0.01);
        expect(foot.bounds.max[2] - foot.bounds.min[2]).toBeGreaterThan(0.25);
      }
      const slug = spatialPropStyle(asset).toLowerCase();
      const rendererCanvas = host.locator("canvas");
      await page.screenshot({ path: `${root}/asset-quality-${slug}-${theme.toLowerCase()}.png` });
      await rendererCanvas.screenshot({ path: `${root}/asset-quality-${slug}-${theme.toLowerCase()}-canvas.png` });
      const costs = JSON.parse((await host.getAttribute("data-render-costs"))!);
      expect(costs.calls).toBeGreaterThan(0);
      expect(costs.triangles).toBeGreaterThan(0);
      observations.push({
        asset: asset.name,
        style: spatialPropStyle(asset),
        authoredWidthMeters: asset.widthMeters,
        theme,
        renderer: (await receipts()).find((row) => row.id === asset.id),
        costs,
        objectBuildCount: await host.getAttribute("data-object-build-count"),
      });
      if (spatialPropStyle(asset) === "FOOTPRINT") {
        await canvas.getByRole("button", { name: "Show room", exact: true }).click();
        await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
        const trailIds = draft.content.entities
          .filter((entity) => spatialPropStyle(entity) === "FOOTPRINT")
          .map((entity) => entity.id);
        await expect
          .poll(
            async () =>
              (await receipts()).filter((row) => trailIds.includes(row.id) && row.status === "IN_VIEW").length,
          )
          .toBe(5);
        await page.screenshot({ path: `${root}/asset-quality-trail-${theme.toLowerCase()}-room.png` });
      }
      expect(
        (await listSpatialItems(account.id)).find(
          (item) => item.draft.content.definitionId === draft.content.definitionId,
        )!.draft,
      ).toEqual(draft);
    }
  }
  expect(errors).toEqual([]);
  await writeFile(
    `${root}/asset-quality-observations.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME,
        observations,
        errors,
        limitations:
          "Actual software-rendered fixtures and renderer counters; isolated prop closeups do not demonstrate contact shadows. Room context captures show the actual light/shadow environment. CPU submission is not GPU frame-time or physical/native performance proof. Visual acceptance requires independent pixel and recording review.",
      },
      null,
      2,
    ),
  );
});

test("Creator edits a full scene during actual playback while unrelated prop resources stay stable", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic full-scene responsiveness Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("full-footprint-scene", "Ghost Footprint Trail");
  const id = draft.content.entities[0].id;
  while (draft.content.entities.length < 32)
    draft = editSpatialDraft(draft, {
      type: "DUPLICATE",
      entityId: id,
      newId: `full-footprint-${draft.content.entities.length}`,
    });
  draft.content.title = "Full footprint scene";
  draft.content.anchors[0].transform.position = { x: 0, y: 0, z: 0 };
  draft.content.entities.forEach((entity, index) => {
    entity.name = `Footprint study ${index}`;
    entity.transform.position = { x: ((index % 6) - 2.5) * 0.5, y: 0.02, z: (Math.floor(index / 6) - 2.5) * 0.5 };
  });
  draft.content.studio!.environment = createRoomEnvironment(
    simulationEnvironments.find((room) => room.id === "empty-room")!,
  );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Full footprint scene.*My Library/ }).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host).toHaveAttribute("data-rendered", "true");
  const receipts = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[];
  await expect.poll(async () => (await receipts()).length).toBe(32);
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const row = graph.locator(`[data-graph-entity="${id}"]`);
  await row.click();
  const beforeBuilds = Number(await host.getAttribute("data-object-build-count"));
  const beforeCosts = JSON.parse((await host.getAttribute("data-render-costs"))!);
  const startRename = Date.now();
  await row.press("F2");
  await graph.getByRole("textbox", { name: "Rename Footprint study 0", exact: true }).fill("First trail clue");
  await graph.getByRole("textbox", { name: "Rename Footprint study 0", exact: true }).press("Enter");
  await expect(row).toContainText("First trail clue");
  const renameMs = Date.now() - startRename;
  await expect.poll(async () => Number(await host.getAttribute("data-object-build-count"))).toBe(beforeBuilds + 1);
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Add position animation · 2 s", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  const builds = Number(await host.getAttribute("data-object-build-count"));
  const start = (await receipts()).find((item) => item.id === id)!.position;
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect
    .poll(async () => (await receipts()).find((item) => item.id === id)!.position[0])
    .toBeGreaterThan(start[0] + 0.01);
  const intervals = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const values: number[] = [];
        let previous = performance.now();
        const sample = (now: number) => {
          values.push(now - previous);
          previous = now;
          if (values.length < 60) requestAnimationFrame(sample);
          else resolve(values);
        };
        requestAnimationFrame(sample);
      }),
  );
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  expect(Number(await host.getAttribute("data-object-build-count"))).toBe(builds);
  expect(
    (await listSpatialItems(account.id)).find((item) => item.draft.content.definitionId === draft.content.definitionId)!
      .draft,
  ).toEqual(saved);
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/asset-quality-full-scene-playback.png` });
  await page.reload();
  await expect.poll(async () => (await receipts()).length).toBe(32);
  expect(
    (await listSpatialItems(account.id)).find((item) => item.draft.content.definitionId === draft.content.definitionId)!
      .draft,
  ).toEqual(saved);
  expect(errors).toEqual([]);
  await writeFile(
    `${root}/asset-quality-responsiveness.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME,
        entities: 32,
        renameMs,
        initialCosts: beforeCosts,
        finalCosts: JSON.parse((await host.getAttribute("data-render-costs"))!),
        animationFrameIntervalsMs: intervals,
        geometryBuildsDuringPlayback: 0,
        errors,
        limitation:
          "Synthetic software browser observation and actual full-scene editing/replay. These frame intervals include browser/CPU scheduling and are not GPU frame times, an idle baseline comparison or representative hardware certification.",
      },
      null,
      2,
    ),
  );
});
