import { openOwnedSceneFromCurrentLibrary, saveCurrentWorkingDraft } from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("Creator authors actual material fading, recovers a transparent object and replays its saved fade", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic opacity Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("opacity-compass", "Floating Compass"),
    id = draft.content.entities[0].id;
  draft.content.title = "Fading Compass";
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/THREE.WebGLProgram|GL_INVALID_OPERATION|shader error|ERROR: 0:/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await openOwnedSceneFromCurrentLibrary(page, {
    definitionId: draft.content.definitionId,
    title: draft.content.title,
    state: "WORKING",
  });
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  const receipt = async () =>
    (JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[]).find((item) => item.id === id)!;
  const alpha = async () => Math.max(...(await receipt()).materialOpacities);
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  if ((await page.getByRole("tab", { name: "Timeline", exact: true }).getAttribute("aria-selected")) !== "true")
    await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  const editor = page.getByRole("region", { name: "Object animation editor", exact: true });
  await editor.getByLabel("Animated property", { exact: true }).selectOption("OPACITY");
  await editor.getByRole("button", { name: "Add opacity animation · 2 s", exact: true }).click();
  await editor.getByLabel("OPACITY keyframe 2 seconds", { exact: true }).fill("4");
  await editor.getByLabel("OPACITY keyframe 2 seconds", { exact: true }).press("Tab");
  await expect(editor).toContainText("At zero it is transparent");
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  const builds = Number(await host.getAttribute("data-object-build-count"));
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await editor.getByLabel("OPACITY keyframe 1 value", { exact: true }).fill("");
  await editor.getByLabel("OPACITY keyframe 1 value", { exact: true }).press("Tab");
  await expect(editor.getByRole("alert")).toHaveText("Enter an opacity from 0 to 1. The previous value was restored.");
  await expect
    .poll(() =>
      editor.getByRole("alert").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        let top = 0,
          left = 0,
          bottom = innerHeight,
          right = innerWidth;
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          const box = parent.getBoundingClientRect(),
            css = getComputedStyle(parent);
          if (/auto|scroll|hidden|clip/.test(css.overflowY)) {
            top = Math.max(top, box.top + parent.clientTop);
            bottom = Math.min(bottom, box.top + parent.clientTop + parent.clientHeight);
          }
          if (/auto|scroll|hidden|clip/.test(css.overflowX)) {
            left = Math.max(left, box.left + parent.clientLeft);
            right = Math.min(right, box.left + parent.clientLeft + parent.clientWidth);
          }
        }
        return (
          rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5 && rect.left >= left - 0.5 && rect.right <= right + 0.5
        );
      }),
    )
    .toBe(true);
  await expect(editor.getByLabel("OPACITY keyframe 1 value", { exact: true })).toHaveValue("1");
  await expect.poll(alpha).toBeCloseTo(1);
  await page.screenshot({ path: `${root}/opacity-invalid-entry-restored.png` });
  await editor.getByLabel("OPACITY keyframe 1 value", { exact: true }).fill("1");
  await editor.getByLabel("OPACITY keyframe 1 value", { exact: true }).press("Tab");
  await expect(editor.getByRole("alert")).toHaveCount(0);
  await expect.poll(alpha).toBeCloseTo(1);
  await expect(host).toHaveAttribute("data-appearance", "dark");
  await page.screenshot({ path: `${root}/opacity-full-material-dark.png` });
  await canvas.getByRole("button", { name: "Show room", exact: true }).click();
  await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({ path: `${root}/opacity-room-full-dark.png` });
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(alpha).toBeLessThan(0.5);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const partial = await receipt();
  expect(Math.max(...partial.materialOpacities)).toBeGreaterThan(0);
  await page.screenshot({ path: `${root}/opacity-partial-material-dark.png` });
  await canvas.getByRole("button", { name: "Show room", exact: true }).click();
  await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({ path: `${root}/opacity-room-partial-dark.png` });
  await editor.getByRole("button", { name: "Preview OPACITY keyframe 2", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("TRANSPARENT");
  await page.screenshot({ path: `${root}/opacity-room-zero-dark.png` });
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.screenshot({ path: `${root}/opacity-zero-material-dark.png` });
  await editor.getByLabel("OPACITY keyframe 2 value", { exact: true }).fill("0.05");
  await editor.getByLabel("OPACITY keyframe 2 value", { exact: true }).press("Tab");
  await expect.poll(alpha).toBeCloseTo(0.05);
  await expect(canvas).toContainText("very faint material");
  await expect(canvas.getByRole("button", { name: "Reveal in editor", exact: true })).toBeVisible();
  await page.screenshot({ path: `${root}/opacity-faint-material-recovery-dark.png` });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(alpha).toBe(0);
  await canvas.getByRole("button", { name: "Reveal in editor", exact: true }).click();
  await expect.poll(alpha).toBeCloseTo(1);
  await expect(page.getByRole("combobox", { name: "Preview", exact: true })).toHaveValue("EDITOR");
  await page.screenshot({ path: `${root}/opacity-editor-recovery-dark.png` });
  expect(Number(await host.getAttribute("data-object-build-count"))).toBe(builds);
  expect(
    (await listSpatialItems(account.id)).find((item) => item.draft.content.definitionId === draft.content.definitionId)!
      .draft,
  ).toEqual(saved);
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  if ((await page.getByRole("tab", { name: "Timeline", exact: true }).getAttribute("aria-selected")) !== "true")
    await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await editor.getByLabel("Animated property", { exact: true }).selectOption("OPACITY");
  await expect(editor.getByLabel("OPACITY keyframe 2 seconds", { exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(alpha).toBeLessThan(0.5);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const replay = await receipt();
  expect(Math.max(...replay.materialOpacities)).toBeGreaterThan(0);
  await page.screenshot({ path: `${root}/opacity-saved-replay-dark.png` });
  await page.getByRole("button", { name: "Stop timeline", exact: true }).click();
  await expect.poll(alpha).toBeCloseTo(1);
  const loaded = await (await page.request.get("/api/studio/parallax")).json();
  const preferences = await (await page.request.get("/api/passport/preferences")).json();
  const themed = await page.request.put("/api/passport/preferences", {
    headers: { "x-csrf-token": loaded.csrfToken },
    data: {
      preferences: {
        ...preferences.preferences,
        experience: { ...preferences.preferences.experience, theme: "LIGHT", motion: "REDUCED" },
      },
    },
  });
  expect(themed.ok()).toBe(true);
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  if ((await page.getByRole("tab", { name: "Timeline", exact: true }).getAttribute("aria-selected")) !== "true")
    await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await expect(host).toHaveAttribute("data-appearance", "light");
  if (!(await canvas.getByRole("button", { name: "Show room", exact: true }).isVisible()))
    await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.screenshot({ path: `${root}/opacity-full-material-light.png` });
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(alpha).toBeLessThan(0.5);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await page.screenshot({ path: `${root}/opacity-partial-material-light.png` });
  await editor.getByRole("button", { name: "Preview OPACITY keyframe 2", exact: true }).click();
  await expect.poll(alpha).toBe(0);
  await page.screenshot({ path: `${root}/opacity-zero-material-light.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await canvas.getByRole("button", { name: "Reveal in editor", exact: true }).click();
  await expect.poll(alpha).toBeCloseTo(1);
  await page.screenshot({ path: `${root}/opacity-phone-editor-recovery.png`, fullPage: true });
  expect(
    (await listSpatialItems(account.id)).find((item) => item.draft.content.definitionId === draft.content.definitionId)!
      .draft,
  ).toEqual(saved);
  expect(errors).toEqual([]);
  await writeFile(
    `${root}/opacity-actual-material-proof.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME,
        partial,
        replay,
        geometryBuildsDuringSamplingAndRecovery: 0,
        savedContentUnchanged: true,
        errors,
        limitations:
          "Actual browser pixels and mesh material alpha, with live fade and postreload replay. Native parser/capability/shader source is separately checked; no physical native GPU or hardware timing certification.",
      },
      null,
      2,
    ),
  );
});
