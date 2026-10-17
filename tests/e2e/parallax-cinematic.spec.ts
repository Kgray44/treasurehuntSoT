import { openOwnedSceneFromCurrentLibrary } from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
test("Creator clicks a graph title, edits a selected pose, resizes unobstructed handles and watches two cinematic takes", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic cinematic Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("cinematic-preview");
  draft.content.title = "Cinematic working Scene";
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await openOwnedSceneFromCurrentLibrary(page, {
    definitionId: draft.content.definitionId,
    title: draft.content.title,
    state: "WORKING",
  });
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true }),
    host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await graph.getByText("Desk Map", { exact: true }).click();
  const rename = graph.getByRole("textbox", { name: "Rename Desk Map" });
  await expect(rename).toBeFocused();
  await rename.fill("Magic letter");
  await rename.press("Enter");
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Add position animation · 2 s", exact: true }).click();
  const end = page.getByRole("button", { name: "Resize Magic letter position animation end", exact: true });
  const clip = page.getByRole("button", { name: "Move Magic letter position animation", exact: true });
  const key = page.getByRole("button", { name: "Magic letter: position keyframe at 2.0 seconds", exact: true });
  await key.click();
  const editor = page.getByRole("region", { name: "Object animation editor", exact: true });
  await expect(editor.getByLabel("POSITION keyframe 2 x", { exact: true })).toBeVisible();
  await editor.getByLabel("POSITION interpolation", { exact: true }).selectOption("CINEMATIC");
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/cinematic-selected-keyframe-settings.png` });
  await end.scrollIntoViewIfNeeded();
  const bounds = (await end.boundingBox())!;
  const lane = await end.evaluate((e) => e.parentElement!.parentElement!.clientWidth);
  const unobstructed = await end.evaluate((e) => {
    const b = e.getBoundingClientRect();
    return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === e;
  });
  expect(unobstructed).toBe(true);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + lane / 5, bounds.y + bounds.height / 2, { steps: 12 });
  await expect(clip).toHaveText("4.0s");
  await page.screenshot({ path: `${root}/cinematic-live-duration-resize.png` });
  await page.mouse.up();
  const read = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!)[0] as RendererReceipt;
  await page.getByRole("button", { name: "Stop timeline", exact: true }).click();
  const start = await read();
  const scanner = page.getByRole("slider", { name: "Scene timeline playhead", exact: true });
  const rulerBounds = (await scanner.locator("..").boundingBox())!;
  const dragScanner = async (fraction: number) => {
    const handle = (await scanner.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(rulerBounds.x + rulerBounds.width * fraction, handle.y + handle.height / 2, { steps: 12 });
  };
  await dragScanner(0.3);
  await expect(scanner).toHaveAttribute("aria-valuenow", "3000");
  const scannerAlignmentError = await scanner.evaluate((e) => {
    const line = e.parentElement!.parentElement!.parentElement!.querySelector('[aria-hidden="true"] > span')!;
    const handle = e.getBoundingClientRect(),
      bar = line.getBoundingClientRect();
    return Math.abs(handle.x + handle.width / 2 - bar.x - bar.width / 2);
  });
  expect(scannerAlignmentError).toBeLessThanOrEqual(1);
  const scrubbed = await read();
  expect(scrubbed.position[0]).toBeGreaterThan(start.position[0]);
  expect(scrubbed.position[0]).toBeLessThan(start.position[0] + 0.35);
  await page.screenshot({ path: `${root}/timeline-live-playhead-scrub.png` });
  await page.mouse.up();
  await scanner.press("ArrowLeft");
  await expect(scanner).toHaveAttribute("aria-valuenow", "2900");
  await scanner.press("Home");
  await expect(scanner).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(async () => Number(await scanner.getAttribute("aria-valuenow"))).toBeGreaterThan(100);
  await dragScanner(0.1);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Play timeline", exact: true })).toBeVisible();
  await expect(scanner).toHaveAttribute("aria-valuenow", "1000");
  await scanner.press("Home");
  const sample = () =>
    host.evaluate(async (e) => {
      const samples: unknown[] = [];
      const began = performance.now();
      while (performance.now() - began < 1500) {
        await new Promise((r) => setTimeout(r, 60));
        samples.push({
          elapsedMs: performance.now() - began,
          rendered: JSON.parse(e.getAttribute("data-scene-receipt")!)[0],
          costs: JSON.parse(e.getAttribute("data-render-costs")!),
        });
      }
      return samples;
    });
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  const first = await sample();
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const middle = await read();
  expect(middle.position[0]).toBeGreaterThan(start.position[0]);
  expect(middle.position[1]).toBeGreaterThan(start.position[1]);
  expect(middle.rotation).not.toEqual(start.rotation);
  await page.screenshot({ path: `${root}/cinematic-first-take.png` });
  await page.getByRole("button", { name: "Restart timeline", exact: true }).click();
  const second = await sample();
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await page.screenshot({ path: `${root}/cinematic-second-take.png` });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.animationTracks![0].interpolation).toBe("CINEMATIC");
  expect(saved.content.studio!.animationTracks![0].keyframes.map((f) => f.atMs)).toEqual([0, 4000]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Restart timeline", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const reduced = await read();
  expect(reduced.position[1]).toBeCloseTo(start.position[1], 6);
  expect(reduced.rotation).toEqual(start.rotation);
  await page.screenshot({ path: `${root}/cinematic-reduced-motion.png` });
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const room = page.getByRole("region", { name: "Room feature editor", exact: true });
  await expect(room.getByLabel("Room feature", { exact: true })).toBeFocused();
  await room.getByLabel("Feature x (m)", { exact: true }).fill("0.4");
  await room.getByLabel("Feature x (m)", { exact: true }).press("Tab");
  await page.screenshot({ path: `${root}/room-edit-controls-open-after-click.png` });
  await writeFile(
    `${root}/cinematic-renderer-proof.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        first,
        second,
        start,
        middle,
        reduced,
        scrubbed,
        scannerAlignmentError,
        unobstructed,
        limits: "Actual submitted scene transforms and renderer costs; no GPU hardware or owner acceptance claim.",
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});
