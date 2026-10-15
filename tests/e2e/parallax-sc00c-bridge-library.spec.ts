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
import { saveSpatialDraft } from "../../src/parallax/library-service";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import {
  listEnvironmentDefinitions,
  saveDefinitionToLibrary,
  saveEnvironmentDraft,
  useEnvironmentDefinition,
} from "../../src/parallax/library-lifecycle-service";

test.afterAll(() => db.$disconnect());

test("unified Library discovers owned working association and preserves Environment definitions", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Bridge Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const room = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  room.name = "SC00C Shared Study";
  room.room!.name = room.name;
  await saveEnvironmentDraft(account.id, room, 0);
  await saveDefinitionToLibrary(account.id, room.id, 1);
  const working = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[1]));
  working.name = "SC00C Unfiled Workshop";
  working.room!.name = working.name;
  await saveEnvironmentDraft(account.id, working, 0);
  const scene = createSpatialDraft(crypto.randomUUID(), "Desk Map");
  scene.content.title = "SC00C Bound Scene";
  await saveSpatialDraft(account.id, scene, 0);
  const bound = await useEnvironmentDefinition(account.id, {
    draft: scene,
    revision: 1,
    definitionId: room.id,
  });
  expect(bound.draft.content.environment).toBeUndefined();
  const originalEnvironments = await listEnvironmentDefinitions(account.id);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await expect(page.getByLabel("Current scene")).toContainText("SC00C Bound Scene");
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  const rail = page.getByRole("navigation", { name: "Library and hierarchy dock" });
  await expect(rail.getByRole("button")).toHaveCount(2);
  const library = page.getByRole("region", { name: "Spatial content library" });
  await expect(library).toBeVisible();
  await library.getByRole("tab", { name: "Environments", exact: true }).click();
  await library.getByLabel("Search environments").fill(room.name);
  await library.getByRole("button", { name: `Inspect ${room.name}` }).click();
  await expect(library.getByRole("complementary", { name: `${room.name} details` })).toContainText(
    "Used by 1 definition",
  );
  expect(await listEnvironmentDefinitions(account.id)).toEqual(originalEnvironments);
  await library.getByRole("combobox", { name: "Source" }).selectOption("IN_USE");
  await expect(library.getByRole("button", { name: `Inspect ${room.name}` })).toBeVisible();
  await library.getByRole("button", { name: "View associated Scenes" }).click();
  await expect(library.getByRole("combobox", { name: "Environment" })).toHaveValue(room.id);
  await library.getByRole("button", { name: "Inspect SC00C Bound Scene" }).click();
  await expect(library.getByRole("complementary", { name: "SC00C Bound Scene details" })).toContainText(room.name);
  await library.getByRole("button", { name: "View Environment" }).click();
  await expect(library.getByRole("complementary", { name: `${room.name} details` })).toBeVisible();
  await library.getByLabel("Search environments").fill(working.name);
  await library.getByRole("button", { name: `Inspect ${working.name}` }).click();
  await expect(library.getByRole("button", { name: "Use in current Scene" })).toBeDisabled();
  await expect(library.getByRole("button", { name: "Save Environment to private Library" })).toBeVisible();
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/sc00c-bridge-library-desktop.png`, fullPage: true });
  await library.getByRole("tab", { name: "Assets", exact: true }).click();
  await library.getByLabel("Search assets").fill("Peeking Letter");
  await library.getByRole("button", { name: "Inspect Peeking Letter" }).click();
  await library.getByRole("button", { name: "Add to active Scene" }).click();
  await expect(page.getByRole("complementary", { name: "Spatial inspector" })).toContainText("Peeking Letter");
  await page.setViewportSize({ width: 390, height: 844 });
  if (!(await library.isVisible())) await rail.getByRole("button", { name: "Open Library" }).click();
  await expect(library).toBeVisible();
  const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
  await page.screenshot({ path: `${root}/sc00c-bridge-library-phone.png`, fullPage: true });
  const accessibility = await new AxeBuilder({ page }).include('[aria-label="Spatial content library"]').analyze();
  const seriousOrCritical = accessibility.violations.filter((finding) =>
    ["serious", "critical"].includes(finding.impact ?? ""),
  );
  expect(seriousOrCritical).toEqual([]);
  await writeFile(
    `${root}/sc00c-bridge-observations.json`,
    JSON.stringify(
      {
        environmentWorkingSceneFound: true,
        ownerDefinitionPreservedOnPreview: true,
        savedOnlyUseGate: true,
        viewport: width,
        seriousOrCriticalAccessibilityFindings: seriousOrCritical.length,
      },
      null,
      2,
    ) + "\n",
  );
});
