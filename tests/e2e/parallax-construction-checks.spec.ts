import { openOwnedSceneFromCurrentLibrary, saveCurrentWorkingDraft } from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

test("Creator follows exact construction findings, corrects wall orientation and reviews miniature scale through save and reload", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic construction findings Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("construction-findings-fixture");
  const room = createRoomEnvironment(simulationEnvironments[0]);
  const wall = room.features.find((feature) => feature.classification === "WALL" && feature.yawDegrees === 180)!;
  wall.yawDegrees = 0;
  const desk = room.features.find((feature) => feature.id === "reference-desk")!;
  const originalHeight = desk.dimensions[1];
  const originalY = desk.position.y;
  desk.dimensions[1] *= 0.1;
  desk.position.y *= 0.1;
  draft.content.studio!.environment = room;
  draft.content.title = "Construction findings working Scene";
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
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  const host = page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
  const checks = editor.getByLabel("Construction checks", { exact: true });
  await checks.getByRole("button", { name: /Construction checks/ }).click();
  await expect(checks).toContainText("points outside this room");
  await expect(checks).toContainText("outside the broad");
  await mkdir(root, { recursive: true });
  await checks.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/construction-wall-and-scale-findings.png` });
  await checks.getByRole("button", { name: wall.name, exact: true }).click();
  await expect(editor.getByLabel("Room feature", { exact: true })).toHaveValue(wall.id);
  await editor.getByLabel("Feature rotation (degrees)", { exact: true }).fill("180");
  await editor.getByLabel("Feature rotation (degrees)", { exact: true }).press("Tab");
  await expect(checks).not.toContainText("points outside this room");
  await checks.getByRole("button", { name: desk.name, exact: true }).first().click();
  await expect(editor.getByLabel("Room feature", { exact: true })).toHaveValue(desk.id);
  await page.setViewportSize({ width: 390, height: 844 });
  // Phone layout folds the Inspector; reopen it through the normal room command.
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  if ((await checks.getAttribute("open")) === null)
    await checks.getByRole("button", { name: /Construction checks/ }).click();
  await checks.scrollIntoViewIfNeeded();
  await expect(checks.getByText(/Check units or confirm the intended size/)).toBeVisible();
  await page.screenshot({ path: `${root}/construction-scale-review-phone.png` });
  for (const [label, value] of [
    ["Feature height (m)", originalHeight],
    ["Feature y (m)", originalY],
  ] as const) {
    await editor.getByLabel(label, { exact: true }).fill(String(value));
    await editor.getByLabel(label, { exact: true }).press("Tab");
  }
  await expect(checks).toContainText("No findings within these checks");
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.environment!.features.find((feature) => feature.id === wall.id)!.yawDegrees).toBe(180);
  expect(saved.content.studio!.environment!.features.find((feature) => feature.id === desk.id)!.dimensions[1]).toBe(
    originalHeight,
  );
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await checks.getByRole("button", { name: /Construction checks/ }).click();
  await expect(checks).toContainText("No findings within these checks");
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await checks.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/construction-corrected-reloaded-phone.png` });
  expect(errors).toEqual([]);
});
