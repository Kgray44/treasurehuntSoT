import {
  closeCurrentLibrary,
  openOwnedSceneFromCurrentLibrary,
  saveCurrentWorkingDraft,
} from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { placeOnRoomFeature } from "../../src/parallax/room-placement";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

test("Creator renames, drags and resizes a real animated clip, observes motion and recovers hidden or tiny assets through saved replay", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic authoring refinement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("refinement-scene");
  const entityId = draft.content.entities[0].id;
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, entityId, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: "window",
  });
  draft.content.studio!.behaviors = [
    {
      id: "inspect-hide",
      trigger: "INSPECT",
      sourceEntityId: entityId,
      targetEntityId: entityId,
      action: "HIDE",
      delayMs: 0,
    },
  ];
  draft.content.title = "Refinement " + draft.content.definitionId;
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
  const receipt = async () =>
    (JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[]).find(
      (item) => item.id === entityId,
    )!;
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.locator("li button").first().press("F2");
  await graph.getByRole("textbox", { name: "Rename Desk Map" }).fill("North clue");
  await graph.getByRole("textbox", { name: "Rename Desk Map" }).press("Enter");
  await expect(graph).toContainText("North clue");
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/refinement-renamed-graph.png` });
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Add position animation · 2 s", exact: true }).click();
  await page.getByLabel("Timeline visible duration", { exact: true }).selectOption("10000");
  const clip = page.getByRole("button", { name: "Move North clue position animation", exact: true });
  const end = page.getByRole("button", { name: "Resize North clue position animation end", exact: true });
  const drag = async (target: typeof clip, dx: number, liveCheck: () => Promise<void>) => {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 12 });
    await liveCheck();
    await page.mouse.up();
  };
  const laneWidth = await clip.evaluate((element) => element.parentElement!.parentElement!.clientWidth);
  const originalBox = (await clip.boundingBox())!;
  await drag(clip, laneWidth / 10, async () => {
    expect((await clip.boundingBox())!.x).toBeGreaterThan(originalBox.x + laneWidth / 12);
    await page.screenshot({ path: `${root}/refinement-live-clip-drag.png` });
  });
  await drag(end, laneWidth / 5, async () => {
    await expect(clip).toHaveText("4.0s");
    await page.screenshot({ path: `${root}/refinement-live-duration-resize.png` });
  });
  await clip.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Animate linearly", exact: true })).toBeVisible();
  await page.screenshot({ path: `${root}/refinement-timeline-context-menu.png` });
  await page.getByRole("menuitem", { name: "Animate linearly", exact: true }).click();
  await clip.focus();
  await clip.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Preview animation start", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("IN_VIEW");
  const startX = (await receipt()).position[0];
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  const samples = await host.evaluate(async (element) => {
    const result: { elapsedMs: number; x: number; costs: unknown }[] = [];
    const began = performance.now();
    while (performance.now() - began < 1250) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const rendered = JSON.parse(element.getAttribute("data-scene-receipt")!)[0];
      result.push({
        elapsedMs: performance.now() - began,
        x: rendered.position[0],
        costs: JSON.parse(element.getAttribute("data-render-costs")!),
      });
    }
    return result;
  });
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await writeFile(
    `${root}/refinement-motion-samples.json`,
    JSON.stringify(
      {
        classification: "engineering-evidence",
        runtime: process.env.PARALLAX_BROWSER_RUNTIME ?? "UNSPECIFIED",
        samples,
        limits: "Current software-rendered submission samples; no before/after or hardware FPS claim.",
      },
      null,
      2,
    ),
  );
  expect(new Set(samples.map((sample) => sample.x.toFixed(4))).size).toBeGreaterThan(5);
  expect(samples.at(-1)!.x).toBeGreaterThan(startX + 0.02);
  expect(samples.at(-1)!.x).toBeLessThan(startX + 0.24);
  await page.screenshot({ path: `${root}/refinement-interpolated-object.png` });
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.animationTracks![0].keyframes.map((frame) => frame.atMs)).toEqual([1000, 5000]);
  expect(saved.content.studio!.surfacePreviewFrames![0].surfaceId).toBe("reference-desk");
  await page.getByRole("tab", { name: "Simulation", exact: true }).click();
  await page.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await page.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("HIDDEN");
  await canvas.getByRole("button", { name: "Reveal in editor", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("IN_VIEW");
  await expect(canvas.getByRole("button", { name: "Use authored visibility", exact: true })).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.screenshot({ path: `${root}/refinement-hidden-editing-recovery.png` });
  await canvas.getByRole("button", { name: "Use authored visibility", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("HIDDEN");
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-scene-receipt")) ?? "[]").length)
    .toBeGreaterThan(0);
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame animation", exact: true }).click();
  await clip.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Preview animation start", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("IN_VIEW");
  const restoredStartX = (await receipt()).position[0];
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  const restoredSamples = await host.evaluate(async (element) => {
    const result: { elapsedMs: number; x: number }[] = [];
    const began = performance.now();
    while (performance.now() - began < 1250) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const rendered = JSON.parse(element.getAttribute("data-scene-receipt")!)[0];
      result.push({ elapsedMs: performance.now() - began, x: rendered.position[0] });
    }
    return result;
  });
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await writeFile(
    `${root}/refinement-saved-replay-motion.json`,
    JSON.stringify(
      {
        classification: "engineering-evidence",
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME ?? "UNSPECIFIED",
        restoredStartX,
        restoredSamples,
        savedKeyframes: saved.content.studio!.animationTracks![0].keyframes,
        limits: "Actual software-rendered object positions after reload; no hardware FPS claim.",
      },
      null,
      2,
    ),
  );
  expect(new Set(restoredSamples.map((sample) => sample.x.toFixed(4))).size).toBeGreaterThan(5);
  expect(restoredSamples.at(-1)!.x).toBeGreaterThan(restoredStartX + 0.02);
  expect(restoredSamples.at(-1)!.x).toBeLessThan(restoredStartX + 0.24);
  await page.screenshot({ path: `${root}/refinement-saved-replay-motion.png` });
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.getByRole("tab", { name: "Simulation", exact: true }).click();
  await page.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await page.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("HIDDEN");
  await canvas.getByRole("button", { name: "Reveal in editor", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("IN_VIEW");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Edit selected object", exact: true }).click();
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await page.getByLabel("Object width in meters", { exact: true }).fill("0.01");
  await page.getByLabel("Position x", { exact: true }).fill("50");
  await expect.poll(async () => (await receipt()).status).not.toBe("IN_VIEW");
  await canvas.getByRole("button", { name: "Find object", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("IN_VIEW");
  await expect.poll(async () => (await receipt()).position[0]).toBeGreaterThan(49);
  await page.screenshot({ path: `${root}/refinement-small-distant-object-recovery.png` });
  expect(errors).toEqual([]);
});

test("Renaming one footprint preserves its shape and rebuilds only that prop", async ({ page, context, baseURL }) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic footprint rename Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("footprint-rename", "Ghost Footprint Trail");
  draft.content.title = "Refinement " + draft.content.definitionId;
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
  await closeCurrentLibrary(page);
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  const builds = Number(await host.getAttribute("data-object-build-count"));
  const costs = JSON.parse((await host.getAttribute("data-render-costs"))!);
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.locator("li button").first().dblclick();
  await graph.getByRole("textbox", { name: "Rename Footprint 1" }).fill("Luminous trail clue");
  await graph.getByRole("textbox", { name: "Rename Footprint 1" }).press("Enter");
  await expect.poll(async () => Number(await host.getAttribute("data-object-build-count"))).toBe(builds + 1);
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-render-costs"))!).triangles)
    .toBe(costs.triangles);
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/refinement-footprint-identity.png` });
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.entities[0].propStyle).toBe("FOOTPRINT");
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await writeFile(
    `${root}/refinement-prop-builds.json`,
    JSON.stringify(
      {
        documentClassification: "engineering-evidence",
        props: 5,
        rebuildsForOneRename: 1,
        triangles: costs.triangles,
        preservedStyle: "FOOTPRINT",
        source: process.env.PARALLAX_A1_SOURCE_SHA,
      },
      null,
      2,
    ),
  );
});

test("Record captures edited poses and motion stays clear across modes and renderer recovery", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic recorded pose Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("recorded-motion", "Floating Compass");
  draft.content.title = "Refinement " + draft.content.definitionId;
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
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
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  const editor = page.getByRole("region", { name: "Object animation editor", exact: true });
  await editor.getByRole("button", { name: /Record keyframe at 0.0 s/ }).click();
  await expect(editor.getByText(/One keyframe holds a pose/)).toBeVisible();
  await page.getByRole("button", { name: "Seek to 10 seconds", exact: true }).click();
  await page.getByLabel("Preview", { exact: true }).selectOption("EDITOR");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await canvas.getByRole("button", { name: "Edit selected object", exact: true }).click();
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await page.getByLabel("Position x", { exact: true }).fill("0.5");
  await editor.getByRole("button", { name: /Record keyframe at 10.0 s/ }).click();
  await expect(editor.getByLabel("POSITION keyframe 2 x", { exact: true })).toHaveValue("0.5000");
  await editor.getByLabel("POSITION interpolation", { exact: true }).selectOption("STEP");
  await expect(editor.getByText(/Step changes instantly/)).toBeVisible();
  await mkdir(root, { recursive: true });
  await editor.getByText(/Step changes instantly/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/refinement-instant-step-explanation.png` });
  await editor.getByLabel("POSITION interpolation", { exact: true }).selectOption("LINEAR");
  await canvas.getByRole("button", { name: "Frame animation", exact: true }).click();
  await page.getByRole("button", { name: "Seek to 0 seconds", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const rendered = JSON.parse((await host.getAttribute("data-scene-receipt"))!)[0];
  expect(rendered.position[0]).toBeGreaterThan(0.02);
  expect(rendered.position[0]).toBeLessThan(0.49);
  for (const mode of ["GUIDED", "DETAILED", "ENGINEERING"] as const) {
    await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption(mode);
    await expect(page.getByRole("combobox", { name: "Authoring mode", exact: true })).toHaveValue(mode);
    await expect
      .poll(async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!)[0].status)
      .toBe("IN_VIEW");
    await page.screenshot({ path: `${root}/refinement-motion-${mode.toLowerCase()}.png` });
  }
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.animationTracks![0].keyframes[1].value).toMatchObject({ x: 0.5 });
  await host
    .locator("canvas")
    .evaluate((element) => element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await expect(canvas.getByRole("button", { name: "Retry 3D renderer", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Authoring mode", exact: true })).toHaveValue("ENGINEERING");
  await page.screenshot({ path: `${root}/refinement-renderer-failure-engineering.png` });
  await canvas.getByRole("button", { name: "Retry 3D renderer", exact: true }).click();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.dataset.voyageTheme = "light";
  });
  await page.getByLabel("Preview", { exact: true }).selectOption("FALLBACK");
  await expect(canvas.getByText(/Guided/).first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Authoring mode", exact: true })).toHaveValue("ENGINEERING");
  await canvas.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/refinement-phone-requested-fallback.png` });
  await page.getByLabel("Preview", { exact: true }).selectOption("EDITOR");
  await expect(host.locator("canvas")).toBeVisible();
  await canvas.getByText("View & audio", { exact: true }).click();
  await canvas.getByRole("button", { name: "Frame animation", exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => JSON.parse((await host.getAttribute("data-scene-receipt")) ?? "[]")[0]?.status)
    .toBe("IN_VIEW");
  await page.screenshot({ path: `${root}/refinement-phone-restored-motion.png` });
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
});
