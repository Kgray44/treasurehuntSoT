import {
  closeCurrentLibrary,
  openOwnedSceneFromCurrentLibrary,
  saveCurrentWorkingDraft,
} from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createSpatialDraft, previewEntityTransform } from "../../src/parallax/authoring";
import { syntheticEnvironmentEvidence } from "../../src/parallax/adaptive-authoring";
import { resolveAdaptiveScene } from "../../src/parallax/adaptive";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { composeTransform } from "../../src/parallax/transforms";
import { identityTransform } from "../../src/parallax/contracts";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
const normal = (rotation: ReturnType<typeof identityTransform>["rotation"]) =>
  composeTransform({ ...identityTransform(), rotation }, { ...identityTransform(), position: { x: 0, y: 0, z: 1 } })
    .position;

test("Creator snaps a clue to both walls, table and entire floor with orientation, Undo and persisted restore", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic surface snapping Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  let paidRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/studio/parallax") && request.postDataJSON()?.action === "AI") paidRequests++;
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  await expect(canvas.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
  await expect(canvas.getByText(/Room surfaces/)).toContainText(
    String(
      syntheticEnvironmentEvidence(simulationEnvironments[0]).candidates.filter(
        (c) => c.surface !== "OPEN_SPACE" && c.id !== "unsafe-walkway",
      ).length,
    ),
  );
  await expect(canvas.getByRole("button", { name: "bed · blocked", exact: true })).toBeDisabled();
  await mkdir(root, { recursive: true });
  for (const [label, axis] of [
    ["wall window", "z"],
    ["wall left", "x"],
    ["table left", "y"],
    ["Entire floor", "y"],
  ] as const) {
    await canvas.getByRole("button", { name: label, exact: true }).click();
    await expect(canvas).toContainText("snapped and aligned");
    await saveCurrentWorkingDraft(page);
    await expect(page.getByRole("status")).toHaveText("Working draft saved");
    const current = (await listSpatialItems(account.id))[0].draft;
    const pose = previewEntityTransform(current.content, current.content.entities[0].id);
    expect(normal(pose.rotation)[axis]).toBeCloseTo(1);
    expect(current.content.anchors[0]).toMatchObject({ alignment: axis === "y" ? "HORIZONTAL" : "VERTICAL" });
    expect(current.content.entities[0].transform.position.z).toBeCloseTo(0);
    await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
    await page.screenshot({ path: `${root}/surface-${label.replaceAll(" ", "-")}.png` });
    await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
  }
  const saved = (await listSpatialItems(account.id))[0];
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved.draft);
  await page.reload();
  await expect(canvas.locator('[data-renderer="READY"] canvas')).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved.draft);
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas.locator('[data-renderer="READY"] canvas')).toBeVisible();
    await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
    await page.screenshot({ path: `${root}/surface-picker-${size.width}x${size.height}.png` });
    await canvas.getByRole("button", { name: "wall left", exact: true }).click();
    await expect(canvas).toContainText("snapped and aligned to wall left");
    const rendered = canvas.locator('[data-renderer="READY"] canvas');
    await rendered.scrollIntoViewIfNeeded();
    expect((await rendered.boundingBox())!.height).toBeGreaterThan(240);
    await page.screenshot({ path: `${root}/surfaces-${size.width}x${size.height}.png` });
    await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
    await page.screenshot({ path: `${root}/surfaces-framed-${size.width}x${size.height}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const toggle = page.getByRole("button", { name: "Toggle spatial overlays", exact: true });
    if ((await toggle.getAttribute("aria-pressed")) === "true")
      await page.getByRole("button", { name: "Close room surfaces", exact: true }).click();
  }
  const axe = await new AxeBuilder({ page }).include("main").analyze();
  expect(axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
  expect(paidRequests).toBe(0);
});

test("Hidden Wall Message retains wall intent when automatic placement is enabled and aligns when switched to table", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic wall placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("surface-wall-note", "Hidden Wall Message");
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
  await closeCurrentLibrary(page);
  await expect(page.getByRole("region", { name: "Environment and Scene", exact: true })).toContainText(
    "Hidden Wall Message",
  );
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Manual placement", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Author remotely", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Automatic placement", exact: true })).toBeVisible();
  await expect(page.getByLabel("Semantic surface")).toHaveValue("WALL");
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const wall = (await listSpatialItems(account.id))[0].draft;
  expect(
    Object.values(
      resolveAdaptiveScene(wall.content, syntheticEnvironmentEvidence(simulationEnvironments[0]), "proof").placements,
    )[0].surface,
  ).toBe("WALL");
  await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
  await page
    .getByRole("region", { name: "Spatial canvas", exact: true })
    .getByRole("button", { name: "table left", exact: true })
    .click();
  await expect(page.getByLabel("Semantic surface")).toHaveValue("TABLE");
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const table = (await listSpatialItems(account.id))[0].draft;
  const resolved = Object.values(
    resolveAdaptiveScene(table.content, syntheticEnvironmentEvidence(simulationEnvironments[0]), "proof").placements,
  )[0];
  expect(resolved.surface).toBe("TABLE");
  expect(normal(resolved.transform.rotation).y).toBeCloseTo(1);
  await page.screenshot({ path: `${root}/automatic-wall-to-table.png` });
});
