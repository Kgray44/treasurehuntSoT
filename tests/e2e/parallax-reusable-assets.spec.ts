import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { saveDefinitionToLibrary } from "../../src/parallax/library-lifecycle-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

test("Creator saves and reuses a versioned object, edits only its instance, reloads and archives the unchanged definition", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic reusable object Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const source = createSpatialDraft(`reusable-source-${account.id}`, "Floating Compass");
  source.content.title = "Compass source scene";
  await saveSpatialDraft(account.id, source, 0);
  await saveDefinitionToLibrary(account.id, source.content.definitionId, 1);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: "Compass source scene", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Spatial inspector", exact: true });
  if (await inspector.isHidden()) await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await inspector.getByText("Library, reuse & publication", { exact: true }).click();
  await inspector.getByLabel("Asset name", { exact: true }).fill("Captain navigation compass");
  await inspector
    .getByLabel("Asset description", { exact: true })
    .fill("A small reusable compass for navigation clues.");
  await inspector.getByLabel("Asset classification", { exact: true }).fill("Navigation clue");
  await inspector.getByRole("button", { name: "Save selected object as reusable asset", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Reusable asset definition and immutable version saved; source scene unchanged",
  );
  const records = await listSpatialItems(account.id),
    asset = records.find((i) => i.draft.content.studio?.libraryDefinition)!;
  expect(asset.releases).toHaveLength(1);
  expect(records.find((i) => i.id === source.content.definitionId)!.draft).toEqual(source);
  const pin = asset.releases[0].checksum;
  const card = page.getByRole("article", { name: "Asset: Captain navigation compass", exact: true });
  await expect(card).toContainText("Navigation clue");
  await expect(card.getByRole("img")).toBeVisible();
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/library-object-definition.png` });
  await page.getByRole("button", { name: "Actions for Compass source scene", exact: true }).click();
  await page.getByRole("menuitem", { name: "Save as new…", exact: true }).click();
  const copy = page.getByRole("dialog", { name: "Save as new definition", exact: true });
  await copy.getByLabel("Name", { exact: true }).fill("Compass source scene copy");
  await copy.getByRole("button", { name: "Create independent definition", exact: true }).click();
  await expect(copy).not.toBeVisible();
  await card.getByRole("button", { name: "Use in current scene", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Independent pinned copy added");
  const targetId = new URL(page.url()).searchParams.get("definition")!;
  const target = async () => (await listSpatialItems(account.id)).find((i) => i.id === targetId)!.draft;
  expect(targetId).not.toBe(source.content.definitionId);
  expect((await target()).content.entities).toHaveLength(2);
  const instanceId = (await target()).content.studio!.assetInstances![0].entityIds[0];
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Save to Library", exact: true }).click();
  await expect.poll(async () => (await target()).content.entities.length).toBe(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Save to Library", exact: true }).click();
  await expect.poll(async () => (await target()).content.entities.length).toBe(2);
  const overview = inspector
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^Overview \/ Identity$/ }) });
  if (!(await overview.evaluate((element) => (element as HTMLDetailsElement).open)))
    await overview.locator("summary").click();
  await inspector.getByLabel("Object name", { exact: true }).fill("Local navigation clue");
  await page.getByRole("button", { name: "Save to Library", exact: true }).click();
  await expect
    .poll(async () => (await target()).content.entities.find((e) => e.id === instanceId)!.name)
    .toBe("Local navigation clue");
  expect((await listSpatialItems(account.id)).find((i) => i.id === asset.id)!.releases[0].checksum).toBe(pin);
  expect((await listSpatialItems(account.id)).find((i) => i.id === asset.id)!.draft).toEqual(asset.draft);
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await page.getByRole("button", { name: "Collapse Inspector", exact: true }).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true }),
    host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  const receipt = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[];
  await expect.poll(async () => (await receipt()).find((r) => r.id === instanceId)?.status).toBe("IN_VIEW");
  await page.screenshot({ path: `${root}/library-placed-instance.png` });
  const saved = await target();
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect(await target()).toEqual(saved);
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByLabel("Library type", { exact: true }).selectOption("ASSET");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /^Captain navigation compass/ }).click();
  await expect
    .poll(async () => (await receipt()).find((r) => r.id === asset.draft.content.entities[0].id)?.status)
    .toBe("IN_VIEW");
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await page.screenshot({ path: `${root}/library-open-definition.png` });
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByLabel("Library type", { exact: true }).selectOption("SCENE");
  await page.getByRole("button", { name: /^Compass source scene copy/ }).click();
  await page.getByLabel("Library type", { exact: true }).selectOption("ASSET");
  await card.getByRole("button", { name: "Actions for Captain navigation compass", exact: true }).click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await listSpatialItems(account.id)).some((i) => i.id === asset.id)).toBe(false);
  expect((await listSpatialItems(account.id)).find((i) => i.id === targetId)!.draft).toEqual(saved);
  await expect.poll(async () => (await receipt()).every((object) => object.status === "IN_VIEW")).toBe(true);
  await page.screenshot({ path: `${root}/library-archived-definition.png` });
});
