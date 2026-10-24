import {
  closeCurrentLibrary,
  currentStudioStatus,
  openCurrentLibraryCategory,
  openCurrentScenePublication,
  openOwnedSceneFromCurrentLibrary,
  saveCurrentWorkingDraft,
} from "./fixtures/parallax-current-library";
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
    await openOwnedSceneFromCurrentLibrary(page, {
      definitionId: draft.content.definitionId,
      title: draft.content.title,
      state: "WORKING",
    });
    await closeCurrentLibrary(page);
    await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
    const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
    const host = canvas.locator('[data-renderer="READY"]');
    await expect(host).toHaveAttribute("data-appearance", theme.toLowerCase());
    await expect(host).toHaveAttribute("data-rendered", "true");
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

test("Creator duplicates and reuses a right boot without changing its rendered handedness", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic right boot reuse Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const source = createSpatialDraft("right-boot-source", "Ghost Footprint Trail");
  source.content.title = "Right boot source";
  const rightId = source.content.entities[1].id;
  await saveSpatialDraft(account.id, source, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await openOwnedSceneFromCurrentLibrary(page, {
    definitionId: source.content.definitionId,
    title: source.content.title,
    state: "WORKING",
  });
  await closeCurrentLibrary(page);
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  const receipt = async (id: string) =>
    (JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[]).find((row) => row.id === id)!;
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.locator(`[data-graph-entity="${rightId}"]`).click();
  await expect.poll(async () => (await receipt(rightId))?.status).toBe("IN_VIEW");
  const original = await receipt(rightId);
  await graph
    .getByRole("toolbar", { name: "Scene graph object actions" })
    .getByRole("button", { name: "Duplicate object", exact: true })
    .click();
  await saveCurrentWorkingDraft(page);
  await expect(currentStudioStatus(page)).toHaveText("Working draft saved");
  const records = async () => listSpatialItems(account.id);
  const current = async () => (await records()).find((item) => item.id === source.content.definitionId)!.draft;
  const duplicated = await current();
  const clone = duplicated.content.entities.at(-1)!;
  expect(clone.id).not.toBe(rightId);
  expect(clone.footprintSide).toBe("RIGHT");
  const copy = await receipt(clone.id);
  const relativeX = (row: RendererReceipt) => [
    row.bounds.min[0] - row.position[0],
    row.bounds.max[0] - row.position[0],
  ];
  relativeX(copy).forEach((value, index) => expect(value).toBeCloseTo(relativeX(original)[index], 5));
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/asset-quality-right-boot-duplicated.png` });
  await canvas.getByRole("button", { name: "Edit selected object", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Spatial inspector", exact: true });
  await openCurrentScenePublication(page);
  await inspector.getByLabel("Asset name", { exact: true }).fill("Reusable right boot");
  await inspector.getByLabel("Asset description", { exact: true }).fill("A right boot retaining its silhouette.");
  await inspector.getByLabel("Asset classification", { exact: true }).fill("Footprint");
  await inspector.getByRole("button", { name: "Save selected object as reusable asset", exact: true }).click();
  await expect(currentStudioStatus(page)).toHaveText(
    "Reusable asset definition and immutable version saved; source scene unchanged",
  );
  expect(await current()).toEqual(duplicated);
  const definition = (await records()).find((item) => item.draft.content.studio?.libraryDefinition)!;
  const releaseChecksum = definition.releases[0].checksum;
  const assetLibrary = await openCurrentLibraryCategory(page, "Assets", "MY_CREATIONS", "SAVED");
  await assetLibrary.getByRole("searchbox").fill("Reusable right boot");
  await assetLibrary.getByRole("button", { name: "Inspect Reusable right boot", exact: true }).click();
  await assetLibrary
    .getByRole("complementary", { name: "Reusable right boot details", exact: true })
    .getByRole("button", { name: "Place in Scene", exact: true })
    .click();
  const placement = page.getByLabel("Place Reusable right boot in Scene");
  await expect(placement).toBeVisible();
  expect(await current()).toEqual(duplicated);
  await placement.getByRole("button", { name: "Floor", exact: true }).first().click();
  await expect(placement).toBeHidden();
  await expect(currentStudioStatus(page)).toHaveText("Independent released copy added");
  const inserted = await current();
  const instance = inserted.content.entities.at(-1)!;
  expect(instance.footprintSide).toBe("RIGHT");
  await expect.poll(async () => (await receipt(instance.id))?.position).toBeTruthy();
  const renderedInstance = await receipt(instance.id);
  relativeX(renderedInstance).forEach((value, index) => expect(value).toBeCloseTo(relativeX(original)[index], 5));
  await page.screenshot({ path: `${root}/asset-quality-right-boot-reused.png` });
  await page.reload();
  await expect.poll(async () => (await receipt(instance.id))?.position).toBeTruthy();
  relativeX(await receipt(instance.id)).forEach((value, index) =>
    expect(value).toBeCloseTo(relativeX(original)[index], 5),
  );
  expect(await current()).toEqual(inserted);
  expect((await records()).find((item) => item.id === definition.id)!.releases[0].checksum).toBe(releaseChecksum);
  await writeFile(
    `${root}/asset-quality-right-boot-proof.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME,
        original,
        duplicate: copy,
        instance: renderedInstance,
        relativeBoundsX: relativeX(original),
        side: instance.footprintSide,
        sourceUnchangedByDefinitionSave: true,
        instanceAndDefinitionPreservedThroughReload: true,
        releaseChecksum,
      },
      null,
      2,
    ),
  );
});

test("Creator authors a full scene and navigates during interpolated playback without rebuilding props", async ({
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
    simulationEnvironments.find((room) => room.id === "empty")!,
  );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  const animation = page.getByRole("region", { name: "Object animation editor", exact: true });
  await animation.getByLabel("POSITION keyframe 2 seconds", { exact: true }).fill("8");
  await animation.getByLabel("POSITION keyframe 2 seconds", { exact: true }).press("Tab");
  await saveCurrentWorkingDraft(page);
  await expect(currentStudioStatus(page)).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  const builds = Number(await host.getAttribute("data-object-build-count"));
  const start = (await receipts()).find((item) => item.id === id)!.position;
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect
    .poll(async () => (await receipts()).find((item) => item.id === id)!.position[0])
    .toBeGreaterThan(start[0] + 0.01);
  // Playback enters Lens preview. Inspect/select/frame remain available there;
  // authored edits intentionally require returning to Editor.
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const otherId = draft.content.entities[1].id;
  const selectionStarted = Date.now();
  await graph.locator(`[data-graph-entity="${otherId}"]`).click();
  await expect(graph.locator(`[data-graph-entity="${otherId}"]`)).toHaveAttribute("aria-pressed", "true");
  const selectionDuringPlaybackMs = Date.now() - selectionStarted;
  await expect(graph.getByRole("button", { name: "Rename object", exact: true })).toBeDisabled();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause timeline", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const frameSamples = await page.evaluate(
    (entityId) =>
      new Promise<{ intervals: number[]; submitCosts: number[]; positions: number[] }>((resolve) => {
        const values: number[] = [];
        const submitCosts: number[] = [];
        const positions: number[] = [];
        let previous: number | null = null;
        const sample = (now: number) => {
          // rAF timestamps describe the start of their frame, which can precede
          // evaluate's performance.now(). Measure complete frame intervals only.
          if (previous !== null) {
            values.push(now - previous);
            const host = document.querySelector('[data-renderer="READY"]');
            const cost = JSON.parse(host?.getAttribute("data-render-costs") ?? "{}").cpuSubmitMs;
            if (typeof cost === "number") submitCosts.push(cost);
            const receipt = JSON.parse(host?.getAttribute("data-scene-receipt") ?? "[]") as RendererReceipt[];
            const position = receipt.find((item) => item.id === entityId)?.position[0];
            if (typeof position === "number") positions.push(position);
          }
          previous = now;
          if (values.length < 60) requestAnimationFrame(sample);
          else resolve({ intervals: values, submitCosts, positions });
        };
        requestAnimationFrame(sample);
      }),
    id,
  );
  expect(frameSamples.positions).toHaveLength(60);
  expect(new Set(frameSamples.positions).size).toBeGreaterThan(20);
  const positionTrack = saved.content.studio!.animationTracks!.find((track) => track.entityId === id)!;
  const endX = (positionTrack.keyframes.at(-1)!.value as { x: number }).x;
  expect(frameSamples.positions.every((x) => x > start[0] && x < endX)).toBe(true);
  expect(frameSamples.positions.every((x, index, all) => !index || x >= all[index - 1])).toBe(true);
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
        selectionDuringPlaybackMs,
        initialCosts: beforeCosts,
        finalCosts: JSON.parse((await host.getAttribute("data-render-costs"))!),
        animationFrameIntervalsMs: frameSamples.intervals,
        steadyCpuSubmitSamplesMs: frameSamples.submitCosts,
        interpolatedPositionSamplesX: frameSamples.positions,
        authoringDuringPlayback: "NOT_TESTED_OR_CLAIMED; Lens preview disables rename",
        geometryBuildsDuringPlayback: 0,
        errors,
        limitation:
          "Synthetic software browser observation: rename and track editing before Play, selection/framing during continuous playback, and saved replay. These frame intervals include browser/CPU scheduling and are not GPU frame times, an idle baseline comparison or representative hardware certification.",
      },
      null,
      2,
    ),
  );
});
