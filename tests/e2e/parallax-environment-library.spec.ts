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
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
test("Creator discovers, renames, edits, applies and deletes saved environments without removing scene geometry", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic Environment Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const drafts = ["A", "B"].map((suffix, index) => {
    const draft = createSpatialDraft(`environment-library-${suffix}`);
    draft.content.title = `Room source ${suffix}`;
    draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[index]);
    draft.content.studio!.environment!.name = `Workshop ${suffix}`;
    return draft;
  });
  for (const draft of drafts) await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Room source A.*My Library/ }).click();
  await expect(page.getByRole("heading", { name: "Parallax", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Current scene", { exact: true })).toContainText("Room source A");
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  const library = page.getByRole("region", { name: "Environment Library", exact: true });
  await expect(library.getByRole("article")).toHaveCount(2);
  const roomA = () => library.getByRole("article").filter({ hasText: "Scene: Room source A" });
  await roomA().getByRole("button", { name: "Workshop A", exact: true }).click();
  await roomA().getByRole("textbox", { name: "Rename Workshop A", exact: true }).fill("Teaching Lab");
  await roomA().getByRole("textbox", { name: "Rename Workshop A", exact: true }).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Environment renamed");
  await expect(roomA().getByRole("button", { name: "Teaching Lab", exact: true })).toBeVisible();
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/environment-library-renamed.png` });
  const roomB = library.getByRole("article").filter({ hasText: "Scene: Room source B" });
  await roomB.getByRole("button", { name: "Edit environment", exact: true }).click();
  await expect(page.getByLabel("Current scene", { exact: true })).toContainText("Room source B");
  await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
  await roomA().getByRole("button", { name: "Use environment", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Environment applied to this scene. Review object placements.");
  const savedB = (await listSpatialItems(account.id)).find((item) => item.id === drafts[1].content.definitionId)!;
  expect(savedB.draft.content.studio!.environment!.name).toBe("Teaching Lab");
  expect(savedB.draft.content.entities).toEqual(drafts[1].content.entities);
  await roomA().getByRole("button", { name: "Delete from Library", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(1);
  const savedA = (await listSpatialItems(account.id)).find((item) => item.id === drafts[0].content.definitionId)!;
  expect(savedA.draft.content.studio!.environmentLibraryArchived).toBe(true);
  expect(savedA.draft.content.studio!.environment!.features).toEqual(drafts[0].content.studio!.environment!.features);
  await page.screenshot({ path: `${root}/environment-library-deleted-preserved-scene.png` });
  await page.reload();
  if ((await page.getByRole("button", { name: "Open Library", exact: true }).getAttribute("aria-pressed")) !== "true")
    await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(library).toContainText("Teaching Lab");
  await page.setViewportSize({ width: 390, height: 844 });
  await library.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/environment-library-phone.png` });
});
