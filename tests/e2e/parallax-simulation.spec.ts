import { openOwnedSceneFromCurrentLibrary, saveCurrentWorkingDraft } from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
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
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

test("Creator authors a delayed interaction, sees matching and unmatched outcomes, resets and replays saved simulation", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic simulation Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("simulation-scene", "Floating Compass");
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
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  const receipt = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[];
  await expect(host.locator("canvas")).toBeVisible();
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await page.getByRole("tab", { name: "Simulation", exact: true }).click();
  const simulation = page.getByRole("tabpanel", { name: "Simulation", exact: true });
  await simulation.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await expect(simulation).toContainText("has no matching behavior");
  await expect.poll(async () => (await receipt())[0].status).toBe("IN_VIEW");
  await mkdir(root, { recursive: true });
  await simulation.locator('[aria-live="polite"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/simulation-no-effect.png` });
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Add spatial behavior", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Behavior 1 trigger", { exact: true }).selectOption("INSPECT");
  await page.getByLabel("Behavior 1 action", { exact: true }).selectOption("HIDE");
  await page.getByLabel("Behavior 1 delay milliseconds", { exact: true }).fill("1000");
  await page.getByRole("tab", { name: "Simulation", exact: true }).click();
  await simulation.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await simulation.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await expect(simulation).toContainText("waiting 1.0 s");
  await expect.poll(async () => (await receipt())[0].status).toBe("IN_VIEW");
  await page.screenshot({ path: `${root}/simulation-delayed-action.png` });
  await simulation
    .locator("li")
    .filter({ hasText: /Hide Floating Compass at 1\.0 s/ })
    .last()
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/simulation-delayed-evidence.png` });
  await simulation.getByRole("button", { name: "Preview next delayed action", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].status).toBe("HIDDEN");
  await expect(simulation).toContainText("evaluated · renderer: hidden");
  await page.screenshot({ path: `${root}/simulation-hidden-result.png` });
  await simulation
    .locator("li")
    .filter({ hasText: /Hide Floating Compass at 1\.0 s/ })
    .last()
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/simulation-hidden-evidence.png` });
  await simulation.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].status).toBe("IN_VIEW");
  await page.screenshot({ path: `${root}/simulation-reset.png` });
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  expect(saved.content.studio!.behaviors[0]).toMatchObject({ trigger: "INSPECT", action: "HIDE", delayMs: 1000 });
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].status).toBe("IN_VIEW");
  if (await simulation.isHidden()) await page.getByRole("tab", { name: "Simulation", exact: true }).click();
  await simulation.getByRole("button", { name: "Simulate inspect", exact: true }).click();
  await simulation.getByRole("button", { name: "Run simulation", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].status).toBe("HIDDEN");
  await simulation.getByRole("button", { name: "Pause simulation", exact: true }).click();
  await expect(simulation).toContainText("Paused");
  await simulation.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await expect.poll(async () => (await receipt())[0].status).not.toBe("HIDDEN");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  const coordinates = simulation.getByText(/local position/);
  await coordinates.scrollIntoViewIfNeeded();
  await expect(coordinates).toBeVisible();
  await page.screenshot({ path: `${root}/simulation-engineering-replay.png` });
});
