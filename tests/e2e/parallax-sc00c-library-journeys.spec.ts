import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import {
  releaseEnvironmentVersion,
  saveDefinitionToLibrary,
  saveEnvironmentDraft,
  useEnvironmentDefinition as bindEnvironmentDefinition,
} from "../../src/parallax/library-lifecycle-service";
import { listSpatialItems, saveSpatialDraft } from "../../src/parallax/library-service";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const evidence = `artifacts/sc00c/library-journeys/${process.env.SC00C_LIBRARY_SOURCE?.slice(0, 12) ?? "unbound"}`;

test("Creator searches, previews and inserts a built-in asset with immediate selection", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(120000);
  const account = await closureAccount("Synthetic SC-00C Asset Browser Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(randomUUID(), "Library asset journey");
  await saveSpatialDraft(account.id, scene, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: "Assets", exact: true }).click();
  await library.getByRole("searchbox").fill("Peeking Letter");
  await expect(library.getByRole("button", { name: "Inspect Peeking Letter", exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Inspect Peeking Letter", exact: true }).click();
  await expect(library.getByRole("complementary", { name: "Peeking Letter details" })).toBeVisible();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/built-in-asset-preview.png`, fullPage: true });
  await library.getByRole("button", { name: "Add to active Scene", exact: true }).click();
  await expect(page.getByRole("region", { name: "Inspector context" })).toContainText("Peeking Letter");
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await expect(page.getByRole("region", { name: "Scene graph" })).toContainText("Peeking Letter");
  await page.screenshot({ path: `${evidence}/built-in-asset-selected.png`, fullPage: true });
});

test("Creator follows a saved Environment to two Scenes, opens one, returns and renames it", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Scene Browser Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const environment = createEnvironmentDraft(randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  environment.name = "Library Shared Room";
  environment.room!.name = environment.name;
  await saveEnvironmentDraft(account.id, environment, 0);
  const release = await releaseEnvironmentVersion(account.id, environment.id, 1);
  const ids: string[] = [];
  for (const title of ["Library Scene Alpha", "Library Scene Beta"]) {
    const scene = createSpatialDraft(randomUUID(), title);
    ids.push(scene.content.definitionId);
    await saveSpatialDraft(account.id, scene, 0);
    const bound = await bindEnvironmentDefinition(account.id, {
      draft: scene,
      revision: 1,
      definitionId: environment.id,
      versionId: release.versionId,
    });
    await saveDefinitionToLibrary(account.id, scene.content.definitionId, bound.revision);
  }
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${ids[0]}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: "Environments", exact: true }).click();
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await library.getByRole("searchbox").fill(environment.name);
  await library.getByRole("button", { name: `Inspect ${environment.name}`, exact: true }).click();
  await expect(library.getByRole("complementary", { name: `${environment.name} details` })).toContainText(
    "immutable versions",
  );
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/saved-environment-preview.png`, fullPage: true });
  await library.getByRole("button", { name: "View associated Scenes", exact: true }).click();
  await expect(library.getByRole("tab", { name: "Scenes", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(library.getByRole("combobox", { name: "Environment", exact: true })).toHaveValue(environment.id);
  await expect(library.getByRole("article")).toHaveCount(2);
  await library.getByRole("button", { name: "Inspect Library Scene Beta", exact: true }).click();
  await expect(library.getByRole("complementary", { name: "Library Scene Beta details" })).toContainText(
    environment.name,
  );
  await page.screenshot({ path: `${evidence}/associated-scenes.png`, fullPage: true });
  await library.getByRole("button", { name: "View Environment", exact: true }).click();
  await expect(library.getByRole("complementary", { name: `${environment.name} details` })).toBeVisible();
  await library.getByRole("button", { name: "View associated Scenes", exact: true }).click();
  await library.getByRole("button", { name: "Inspect Library Scene Beta", exact: true }).click();
  await library.getByRole("button", { name: "Open original", exact: true }).click();
  await expect(page.getByRole("region", { name: "Environment and Scene", exact: true })).toContainText(
    "Library Scene Beta",
  );
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await expect(library.getByRole("tab", { name: "Scenes", exact: true })).toHaveAttribute("aria-selected", "true");
  await library.getByRole("button", { name: "Inspect Library Scene Beta", exact: true }).click();
  await library.getByRole("button", { name: "Organize / rename", exact: true }).click();
  const organize = page.getByRole("dialog", { name: "Organize definition" });
  await organize.getByRole("textbox", { name: "Name", exact: true }).fill("Library Scene Beta Renamed");
  await organize.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(library.getByRole("button", { name: "Inspect Library Scene Beta Renamed", exact: true })).toBeVisible();
  const saved = await listSpatialItems(account.id);
  expect(saved.find((item) => item.id === ids[0])?.draft.content.title).toBe("Library Scene Alpha");
  expect(saved.find((item) => item.id === ids[1])?.draft.content.title).toBe("Library Scene Beta Renamed");
  expect(saved.every((item) => item.draft.content.environment?.versionId === release.versionId)).toBe(true);
  await page.screenshot({ path: `${evidence}/scene-renamed-with-environment-pin.png`, fullPage: true });
});
