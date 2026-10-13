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
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Fading Compass.*My Library/ }).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  const receipt = async () =>
    (JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[]).find((item) => item.id === id)!;
  const alpha = async () => Math.max(...(await receipt()).materialOpacities);
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  const editor = page.getByRole("region", { name: "Object animation editor", exact: true });
  await editor.getByLabel("Animated property", { exact: true }).selectOption("OPACITY");
  await editor.getByRole("button", { name: "Add opacity animation · 2 s", exact: true }).click();
  await editor.getByLabel("OPACITY keyframe 2 seconds", { exact: true }).fill("4");
  await editor.getByLabel("OPACITY keyframe 2 seconds", { exact: true }).press("Tab");
  await expect(editor).toContainText("At zero it is transparent");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id)).find(
    (item) => item.draft.content.definitionId === draft.content.definitionId,
  )!.draft;
  const builds = Number(await host.getAttribute("data-object-build-count"));
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await expect.poll(alpha).toBeCloseTo(1);
  await expect(host).toHaveAttribute("data-appearance", "dark");
  await page.screenshot({ path: `${root}/opacity-full-material-dark.png` });
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(alpha).toBeLessThan(0.8);
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  const partial = await receipt();
  expect(Math.max(...partial.materialOpacities)).toBeGreaterThan(0);
  await page.screenshot({ path: `${root}/opacity-partial-material-dark.png` });
  await editor.getByRole("button", { name: "Preview OPACITY keyframe 2", exact: true }).click();
  await expect.poll(async () => (await receipt()).status).toBe("TRANSPARENT");
  await page.screenshot({ path: `${root}/opacity-zero-material-dark.png` });
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
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await editor.getByLabel("Animated property", { exact: true }).selectOption("OPACITY");
  await expect(editor.getByLabel("OPACITY keyframe 2 seconds", { exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(alpha).toBeLessThan(0.8);
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
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await expect(host).toHaveAttribute("data-appearance", "light");
  await page.screenshot({ path: `${root}/opacity-full-material-light.png` });
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
