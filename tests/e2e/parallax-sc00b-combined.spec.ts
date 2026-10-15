import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { addRoomFeature } from "../../src/parallax/parametric-room";
import { insertSpatialElement } from "../../src/parallax/element-authoring";
import { saveEditingGroup } from "../../src/parallax/editing-groups";
import { saveSpatialDraft } from "../../src/parallax/library-service";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("SC-00B combined Inspector covers eleven selection contexts at each authoring depth", async ({ page, context, baseURL }) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(300000);
  const account = await closureAccount("Synthetic SC-00B Combined Inspector Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("sc00b-combined", "Desk Map");
  draft.content.title = "Inspector acceptance workshop";
  draft = insertSpatialElement(draft, "articulated-chest", "furniture");
  draft = insertSpatialElement(draft, "point-light", "light");
  draft = insertSpatialElement(draft, "spatial-ambience", "audio");
  draft = insertSpatialElement(draft, "interaction-region", "trigger");
  draft.content.entities.find((entity) => entity.id === "audio")!.element!.playback = {
    startMs: 0, durationMs: 60000, fadeInMs: 2000, fadeOutMs: 1000, loop: false,
  };
  let room = createRoomEnvironment(simulationEnvironments.find((entry) => entry.id === "empty")!);
  room = addRoomFeature(room, "TABLE", "work-table");
  room = addRoomFeature(room, "EXCLUSION_ZONE", "reserved-area");
  draft.content.studio!.environment = room;
  draft = saveEditingGroup(draft, {
    id: "inspection-group",
    name: "Map and chest",
    members: [
      { kind: "ASSET", id: draft.content.entities[0].id },
      { kind: "ASSET", id: "furniture" },
    ],
  }, true);
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/studio/parallax?definition=${draft.content.definitionId}`);
  await expect(page.getByLabel("Current scene").getByText(draft.content.title, { exact: true })).toBeVisible();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  const artifactRoot = "artifacts/parallax-sc00b-integration/browser";
  await mkdir(artifactRoot, { recursive: true });
  const captures: { selection: string; mode: string; path: string }[] = [];
  const depth = async (selection: string) => {
    for (const [mode, label] of [["GUIDED", "guided"], ["DETAILED", "standard"], ["ENGINEERING", "engineering"]] as const) {
      await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption(mode);
      await expect(inspector).toBeVisible();
      const path = `${artifactRoot}/${selection}-${label}.png`;
      await page.screenshot({ path, fullPage: true });
      captures.push({ selection, mode, path });
    }
  };
  const asset = async (id: string) => {
    await graph.getByRole("tab", { name: "Assets", exact: true }).click();
    const row = graph.locator(`[data-graph-entity="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click({ position: { x: 8, y: 8 } });
    await expect(row).toHaveAttribute("aria-pressed", "true");
  };
  await asset(draft.content.entities[0].id);
  await depth("parchment");
  await asset("furniture");
  await expect(inspector.getByRole("region", { name: "Spatial element properties" })).toContainText("PHYSICAL ASSET");
  await depth("furniture");
  await asset("light");
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await expect(inspector.getByRole("slider", { name: "Light intensity" })).toBeVisible();
  await expect(inspector.getByRole("spinbutton", { name: "Light falloff" })).toHaveCount(0);
  await depth("light");
  await asset("audio");
  await depth("timeline-audio");
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Edit selected object timeline" })).toBeVisible();
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await asset("trigger");
  await depth("interaction-trigger");

  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Room feature editor" })).toBeVisible();
  await depth("environment");
  const feature = async (id: string) => {
    const row = graph.locator(`[data-graph-feature="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click({ position: { x: 8, y: 8 } });
    await expect(row).toHaveAttribute("aria-pressed", "true");
  };
  await feature("work-table");
  await depth("room-feature");
  await feature("reserved-area");
  await depth("exclusion-zone");
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await graph.getByRole("tab", { name: "Groups", exact: true }).click();
  const group = graph.locator('[data-graph-group="inspection-group"]');
  await group.click({ position: { x: 8, y: 8 } });
  await expect(inspector.getByRole("region", { name: "Group inspector" })).toBeVisible();
  await expect(inspector.getByLabel("Accessible description")).toHaveCount(0);
  await depth("group");
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Scene settings" })).toBeVisible();
  await depth("scene");
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  await page.getByRole("button", { name: "Finish environment editing", exact: true }).click();
  await expect(inspector.getByRole("region", { name: "Scene overview" })).toBeVisible();
  await depth("empty-selection");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Scene settings" })).toBeVisible();
  await page.screenshot({ path: `${artifactRoot}/scene-phone.png`, fullPage: true });
  const violations = (await new AxeBuilder({ page }).include('[aria-label="Spatial inspector"]').analyze()).violations;
  expect(violations.filter((issue) => ["critical", "serious"].includes(issue.impact ?? ""))).toEqual([]);
  expect(errors).toEqual([]);
  expect(captures).toHaveLength(33);
  await writeFile(`${artifactRoot}/observations.json`, JSON.stringify({ captures, errors, synthetic: true, ownerAccepted: false }, null, 2));
});
