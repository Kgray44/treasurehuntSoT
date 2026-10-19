import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import {
  saveEnvironmentDraft,
  saveDefinitionToLibrary,
  listEnvironmentDefinitions,
  releaseEnvironmentVersion,
  useEnvironmentDefinition,
} from "../../src/parallax/library-lifecycle-service";
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("pinned room editing creates an explicit independent Environment copy and preserves the Scene release pin", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic Pinned Environment Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const document = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  document.name = "Released shared room";
  document.room!.name = document.name;
  await saveEnvironmentDraft(account.id, document, 0);
  const released = await releaseEnvironmentVersion(account.id, document.id, 1);
  const scene = createSpatialDraft(crypto.randomUUID(), "Pinned room Scene");
  await saveSpatialDraft(account.id, scene, 0);
  const bound = await useEnvironmentDefinition(account.id, {
    draft: scene,
    revision: 1,
    definitionId: document.id,
    versionId: released.versionId,
  });
  const originalWorking = await db.reusableAuthoringItemVersion.findUniqueOrThrow({
    where: { itemId_versionNumber: { itemId: scene.content.definitionId, versionNumber: 0 } },
  });
  const originalRelease = await db.reusableAuthoringItemVersion.findUniqueOrThrow({
    where: { id: released.versionId },
  });
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await expect(
    page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"] canvas'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit room features", exact: true }).click();
  const copy = page.getByRole("dialog", { name: "Save as new definition" });
  await expect(copy).toContainText("This Scene keeps its released Environment unchanged");
  await expect(copy.getByRole("combobox", { name: "Type", exact: true })).toHaveValue("ENVIRONMENT");
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/pinned-environment-copy-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${root}/pinned-environment-copy-phone.png`, fullPage: true });
  await copy.getByRole("textbox", { name: "Name", exact: true }).fill("Independent editable room");
  await copy.getByRole("button", { name: "Create independent definition", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Independent editable room", exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"] canvas'),
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).first().fill("Independent edited room");
  await expect
    .poll(async () => (await listEnvironmentDefinitions(account.id)).find((e) => e.id !== document.id)?.draft.name)
    .toBe("Independent edited room");
  await expect(page.getByRole("status").filter({ hasText: "Working draft saved" }).first()).toBeVisible();
  const environments = await listEnvironmentDefinitions(account.id);
  expect(environments).toHaveLength(2);
  const independent = environments.find((e) => e.id !== document.id)!;
  expect(independent.draft.name).toBe("Independent edited room");
  expect(independent.draft.room!.features).toEqual(document.room!.features);
  expect(independent.releases).toHaveLength(0);
  const unchanged = (await listSpatialItems(account.id)).find((item) => item.id === scene.content.definitionId)!;
  expect(unchanged.draft).toEqual(bound.draft);
  expect(
    (
      await db.reusableAuthoringItemVersion.findUniqueOrThrow({
        where: { itemId_versionNumber: { itemId: scene.content.definitionId, versionNumber: 0 } },
      })
    ).envelope,
  ).toBe(originalWorking.envelope);
  expect(
    (await db.reusableAuthoringItemVersion.findUniqueOrThrow({ where: { id: released.versionId } })).envelope,
  ).toBe(originalRelease.envelope);
  await page.screenshot({ path: `${root}/pinned-environment-independent-edit-phone.png`, fullPage: true });
  await page.getByRole("button", { name: "Back to scene", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"] canvas'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  await page
    .getByRole("region", { name: "Spatial content library", exact: true })
    .getByRole("button", { name: "Inspect Independent edited room", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit original", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Independent edited room", exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"] canvas'),
  ).toBeVisible();
  expect(
    (
      await db.reusableAuthoringItemVersion.findUniqueOrThrow({
        where: { itemId_versionNumber: { itemId: scene.content.definitionId, versionNumber: 0 } },
      })
    ).envelope,
  ).toBe(originalWorking.envelope);
  expect(
    (await db.reusableAuthoringItemVersion.findUniqueOrThrow({ where: { id: released.versionId } })).envelope,
  ).toBe(originalRelease.envelope);
  await page.screenshot({ path: `${root}/pinned-environment-copy-reopened-phone.png`, fullPage: true });
});
test("Creator discovers, renames, edits, applies and archives environments while preserving scene snapshots", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic Environment Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(crypto.randomUUID(), "Room snapshot scene");
  await saveSpatialDraft(account.id, scene, 0);
  const environments = ["A", "B"].map((suffix, index) => {
    const doc = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[index]));
    doc.name = `Workshop ${suffix}`;
    doc.room!.name = doc.name;
    return doc;
  });
  for (const doc of environments) {
    await saveEnvironmentDraft(account.id, doc, 0);
    await saveDefinitionToLibrary(account.id, doc.id, 1);
  }
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await expect(library.getByRole("article")).toHaveCount(2);
  await library.getByRole("button", { name: "Inspect Workshop A", exact: true }).click();
  await library.getByRole("button", { name: "Organize / rename", exact: true }).click();
  const organize = page.getByRole("dialog", { name: "Organize definition" });
  await organize.getByLabel("Name", { exact: true }).fill("Teaching Lab");
  await organize.getByRole("button", { name: "Save details" }).click();
  await expect(library).toContainText("Teaching Lab");
  expect((await listEnvironmentDefinitions(account.id)).find((e) => e.id === environments[0].id)!.draft.room!.id).toBe(
    environments[0].id,
  );
  await library.getByRole("button", { name: "Inspect Workshop B", exact: true }).click();
  await library.getByRole("button", { name: "Use in current Scene", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "snapshot applied" }).first()).toBeVisible();
  const snapshot = (await listSpatialItems(account.id)).find((e) => e.id === scene.content.definitionId)!.draft;
  await library.getByRole("button", { name: "Edit original", exact: true }).click();
  const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
  const furnishing = environments[1].room!.features.find((feature) => feature.name === "reference desk")!;
  expect(furnishing).toBeDefined();
  await editor.getByLabel("Room feature", { exact: true }).selectOption(furnishing.id);
  await editor.getByLabel("Feature name", { exact: true }).fill("Edited original furnishing");
  await editor.getByLabel("Feature name", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Save to Library", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await listEnvironmentDefinitions(account.id))
          .find((item) => item.id === environments[1].id)!
          .draft.room!.features.find((feature) => feature.id === furnishing.id)!.name,
    )
    .toBe("Edited original furnishing");
  await page.getByRole("button", { name: "Back to scene" }).click();
  await expect(library.getByRole("tab", { name: "Environments", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  expect((await listSpatialItems(account.id)).find((e) => e.id === scene.content.definitionId)!.draft).toEqual(
    snapshot,
  );
  await library.getByRole("button", { name: "Inspect Teaching Lab", exact: true }).click();
  await library.getByRole("button", { name: "Archive…", exact: true }).click();
  await library.getByRole("button", { name: "Archive item", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(1);
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("ARCHIVED");
  await expect(library).toContainText("Teaching Lab");
  await library.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(0);
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("SAVED");
  await expect(library.getByRole("article")).toHaveCount(2);
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/environment-library-restored-preserved-scene.png` });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"] canvas'),
  ).toBeVisible();
  expect((await listSpatialItems(account.id)).find((e) => e.id === scene.content.definitionId)!.draft).toEqual(
    snapshot,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  await page.screenshot({ path: `${root}/environment-library-phone.png` });
});
