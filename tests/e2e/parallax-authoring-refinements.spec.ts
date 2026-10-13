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
  const samples: { x: number; costs: unknown }[] = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(100);
    samples.push({
      x: (await receipt()).position[0],
      costs: JSON.parse((await host.getAttribute("data-render-costs"))!),
    });
  }
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  expect(new Set(samples.map((sample) => sample.x.toFixed(4))).size).toBeGreaterThan(5);
  expect(samples.at(-1)!.x).toBeGreaterThan(startX + 0.02);
  expect(samples.at(-1)!.x).toBeLessThan(startX + 0.24);
  await writeFile(
    `${root}/refinement-motion-samples.json`,
    JSON.stringify(
      {
        classification: "engineering-evidence",
        runtime: "DEVELOPMENT",
        samples,
        limits: "Current software-rendered submission samples; no before/after or hardware FPS claim.",
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: `${root}/refinement-interpolated-object.png` });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
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
  await page.getByRole("tab", { name: "Simulation", exact: true }).click();
  await page.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("HIDDEN");
  await canvas.getByRole("button", { name: "Reveal in editor", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("IN_VIEW");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await page.getByRole("button", { name: "Edit selected object", exact: true }).click();
  const transform = page.getByText("Transform", { exact: true });
  if ((await transform.locator("..").getAttribute("open")) === null) await transform.click();
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
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Ghost Footprint Trail.*My Library/ }).click();
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
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
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
