import {
  openOwnedSceneFromCurrentLibrary,
  closeCurrentLibrary,
  saveCurrentWorkingDraft,
} from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { rotationFromDegrees } from "../../src/parallax/animation-authoring";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

test("Creator edits, renders, scrubs, plays and reloads real object keyframes, then resets triggered simulation", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic animation Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("animated-compass", "Floating Compass"),
    entityId = draft.content.entities[0].id;
  draft.content.studio!.animationTracks = [
    {
      id: "move",
      entityId,
      enabled: true,
      property: "POSITION",
      interpolation: "LINEAR",
      keyframes: [
        { id: "p0", atMs: 0, value: { x: 0, y: 1.3, z: 0 } },
        { id: "p1", atMs: 2000, value: { x: 1, y: 1.3, z: 0 } },
      ],
    },
    {
      id: "turn",
      entityId,
      enabled: true,
      property: "ROTATION",
      interpolation: "LINEAR",
      keyframes: [
        { id: "r0", atMs: 0, value: rotationFromDegrees({ x: 0, y: 0, z: 0 }) },
        { id: "r1", atMs: 2000, value: rotationFromDegrees({ x: 0, y: 180, z: 0 }) },
      ],
    },
  ];
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
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await openOwnedSceneFromCurrentLibrary(page, {
    definitionId: draft.content.definitionId,
    title: draft.content.title,
    state: "WORKING",
  });
  const host = page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await closeCurrentLibrary(page);
  await page
    .getByRole("region", { name: "Spatial canvas", exact: true })
    .getByRole("button", { name: "Isolate selected object", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Spatial canvas", exact: true })
    .getByRole("button", { name: "Frame selection", exact: true })
    .click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  const editor = page.getByRole("region", { name: "Object animation editor" });
  await expect(editor).toBeVisible();
  const receipt = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[];
  await page.getByRole("button", { name: "Seek to 0 seconds", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].position[0]).toBeCloseTo(0);
  await mkdir(root, { recursive: true });
  await page
    .getByRole("region", { name: "Spatial canvas", exact: true })
    .getByRole("button", { name: "Reset view", exact: true })
    .click();
  await expect.poll(async () => (await receipt())[0].status).toBe("IN_VIEW");
  await page.screenshot({ path: `${root}/animation-start.png` });
  await editor.getByRole("button", { name: "Preview POSITION keyframe 2", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].position[0]).toBeCloseTo(1);
  await expect.poll(async () => Math.abs((await receipt())[0].rotation[1])).toBeCloseTo(1);
  await expect.poll(async () => (await receipt())[0].status).toBe("IN_VIEW");
  await page.screenshot({ path: `${root}/animation-end.png` });
  await editor.getByLabel("POSITION keyframe 2 x", { exact: true }).fill("1.2");
  await editor.getByLabel("POSITION keyframe 2 x", { exact: true }).press("Tab");
  await expect.poll(async () => (await receipt())[0].position[0]).toBeCloseTo(1.2);
  await page.getByRole("button", { name: "Stop timeline", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].position[0]).toBeGreaterThan(0.15);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const paused = (await receipt())[0].position[0];
  await page.waitForTimeout(200);
  expect((await receipt())[0].position[0]).toBeCloseTo(paused);
  await page.getByRole("button", { name: "Restart timeline", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].position[0]).toBeLessThan(paused);
  await page.getByRole("button", { name: "Stop timeline", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].position[0]).toBeCloseTo(0);
  await page.getByRole("tab", { name: "Simulation", exact: true }).click();
  await page.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].status).toBe("HIDDEN");
  await page.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].status).not.toBe("HIDDEN");
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.animationTracks![0].keyframes[1].value).toMatchObject({ x: 1.2 });
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByLabel("Timeline visible duration").selectOption("10000");
  await page.screenshot({ path: `${root}/animation-reloaded-zoom.png` });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const canvasRegion = page.getByRole("region", { name: "Spatial canvas", exact: true });
    await canvasRegion.scrollIntoViewIfNeeded();
    const controls = canvasRegion
      .getByRole("toolbar", { name: "Spatial editing tools", exact: true })
      .getByRole("button");
    await expect(controls).toHaveCount(7);
    const regionBounds = (await canvasRegion.boundingBox())!;
    const rendererBounds = (await host.locator("canvas").boundingBox())!;
    const selectedItem = canvasRegion
      .getByRole("button", { name: "Isolate selected object", exact: true })
      .locator("..");
    const selectionBounds = (await selectedItem.boundingBox())!;
    expect(selectionBounds.y).toBeGreaterThanOrEqual(regionBounds.y);
    expect(selectionBounds.y + selectionBounds.height).toBeLessThanOrEqual(regionBounds.y + regionBounds.height);

    for (const button of await controls.all()) {
      await expect(button).toBeInViewport();
      const bounds = (await button.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(regionBounds.x);
      expect(bounds.y).toBeGreaterThanOrEqual(regionBounds.y);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(regionBounds.x + regionBounds.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(rendererBounds.y + rendererBounds.height);
    }
    await page.screenshot({ path: `${root}/toolbar-expanded-desktop-${viewport.width}x${viewport.height}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { timeout: 3000 })
    .toBe(true);
  expect((await host.locator("canvas").boundingBox())!.height).toBeGreaterThanOrEqual(370);
  const selectionCard = page.getByRole("button", { name: "Isolate selected object", exact: true }).locator("..");
  expect((await selectionCard.boundingBox())!.height).toBeLessThan(90);
  await page.screenshot({ path: `${root}/animation-phone.png`, fullPage: true });
  await host.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/animation-phone-viewport.png`, fullPage: true });
  await page.getByRole("button", { name: "Stop timeline", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/animation-phone-timeline-controls.png`, fullPage: true });
  await writeFile(
    `${root}/animation-phone-layout.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        viewport: page.viewportSize(),
        canvas: await host.locator("canvas").boundingBox(),
        selectionCard: await selectionCard.boundingBox(),
        horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        sceneScrollers: await host.evaluate((element) => {
          const scrollers = [];
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (["auto", "scroll"].includes(getComputedStyle(parent).overflowY))
              scrollers.push({
                height: parent.clientHeight,
                contentHeight: parent.scrollHeight,
                scrollTop: parent.scrollTop,
              });
          }
          return scrollers;
        }),
      },
      null,
      2,
    ),
  );
});

test("Middle and Ctrl drag use the same camera pan and renderer recovery retains the draft", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic camera Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true }),
    host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  const pan = async (button: "left" | "middle", ctrl: boolean) => {
    await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
    const bounds = (await host.locator("canvas").boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.55);
    if (ctrl) await page.keyboard.down("Control");
    await page.mouse.down({ button });
    await page.mouse.move(bounds.x + bounds.width * 0.5 + 80, bounds.y + bounds.height * 0.55 + 40, { steps: 12 });
    await page.mouse.up({ button });
    if (ctrl) await page.keyboard.up("Control");
    await page.waitForTimeout(100);
    return JSON.parse((await host.getAttribute("data-projected-scene"))!).camera as number[];
  };
  const ctrl = await pan("left", true),
    middle = await pan("middle", false);
  ctrl.forEach((value, i) => expect(middle[i]).toBeCloseTo(value, 4));
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await expect.poll(async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!)[0].status).toBe("IN_VIEW");
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/renderer-isolated-framed.png` });
  const cameraBeforeFailure = JSON.parse((await host.getAttribute("data-projected-scene"))!).camera;
  await host.locator("canvas").evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2")!;
    gl.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(canvas.getByRole("button", { name: "Retry 3D renderer", exact: true })).toBeVisible();
  await page.screenshot({ path: `${root}/renderer-context-loss.png` });
  await canvas.getByRole("button", { name: "Retry 3D renderer", exact: true }).click();
  await expect(host.locator("canvas")).toBeVisible();
  await expect(host).toHaveAttribute("data-rendered", "true");
  await expect
    .poll(async () => {
      const camera = JSON.parse((await host.getAttribute("data-projected-scene"))!).camera as number[];
      return Math.hypot(...camera.map((value, i) => value - cameraBeforeFailure[i]));
    })
    .toBeLessThan(1e-8);
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.screenshot({ path: `${root}/renderer-recovered.png` });
});
