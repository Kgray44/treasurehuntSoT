import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createEnvironmentScene, environmentFromBaseline } from "../../src/parallax/environment-authoring";
import { saveEnvironment } from "../../src/parallax/environment-service";
import { extractComposition } from "../../src/parallax/element-authoring";
import { saveSpatialDraft } from "../../src/parallax/library-service";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.afterAll(() => db.$disconnect());
const evidence = "Development_Docs/Projects/Project_Parallax/evidence/sc-00c/20261015-final";

test("Library discovers, previews, inserts, reuses and manages owned spatial content", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC-00C Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  const environment = await saveEnvironment(
    account.id,
    environmentFromBaseline(`sc00c-environment-${account.id}`, "bedroom", "SC00C Studio Bedroom"),
    0,
  );
  const first = createEnvironmentScene(`sc00c-scene-a-${account.id}`, "Library Scene", environment);
  first.content.sceneDescription = "A saved private clue Scene in the Studio Bedroom.";
  await saveSpatialDraft(account.id, first, 0);
  await saveSpatialDraft(
    account.id,
    createEnvironmentScene(`sc00c-scene-b-${account.id}`, "Another Scene", environment),
    0,
  );
  const source = createSpatialDraft(`sc00c-source-${account.id}`, "Desk Map");
  const composition = extractComposition(source, source.content.entities[0].id, `sc00c-composition-${account.id}`);
  composition.content.title = "Saved map clue";
  await saveSpatialDraft(account.id, composition, 0);
  for (let index = 0; index < 54; index++) {
    const draft = createSpatialDraft(`sc00c-archive-${index}-${account.id}`, "Desk Map");
    draft.content.title = `Archive Scene ${String(index).padStart(2, "0")}`;
    await saveSpatialDraft(account.id, draft, 0);
  }
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/parallax");
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  const rail = page.getByRole("navigation", { name: "Studio left navigation" });
  await expect(rail.getByRole("button")).toHaveCount(2);
  const library = page.getByRole("region", { name: "Spatial content library" });
  await expect(library).toBeVisible();
  await library.getByLabel("Search assets").fill("Treasure chest");
  const chest = library.getByRole("button", { name: "Inspect Treasure chest", exact: true });
  await expect(chest).toBeVisible();
  await expect(chest.locator("img[src*='treasure-chest.png']")).toBeVisible();
  await chest.click();
  await expect(library.getByText(/wooden|chest|brass/i).first()).toBeVisible();
  await page.screenshot({ path: `${evidence}/asset-detail-desktop.png`, fullPage: true });
  await library.getByRole("button", { name: "Add to active Scene", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  await expect(inspector.getByRole("heading", { name: "Treasure chest", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Treasure chest", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Treasure chest", exact: true })).toBeVisible();
  await library.getByRole("tab", { name: "Effects", exact: true }).click();
  await library.getByLabel("Search effects").fill("Point light");
  const viewport = page.getByRole("region", { name: "Spatial canvas" }).locator('[data-renderer="READY"]');
  await expect(viewport).toBeVisible();
  await library
    .locator("article", { has: page.getByRole("button", { name: "Inspect Point light" }) })
    .dragTo(viewport, { timeout: 15000 });
  await expect(inspector.getByRole("heading", { name: "Point light", exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/effect-added-desktop.png`, fullPage: true });
  await library.getByRole("tab", { name: "Environments", exact: true }).click();
  await library.getByRole("combobox", { name: "Source" }).selectOption("MY_CREATIONS");
  await library.getByLabel("Search environments").fill("SC00C Studio Bedroom");
  await library.getByRole("button", { name: "Inspect SC00C Studio Bedroom", exact: true }).click();
  await expect(library.getByText(/fixtures · revision 1/)).toBeVisible();
  const before = await (await page.request.get("/api/studio/parallax")).json();
  await page.screenshot({ path: `${evidence}/environment-detail-desktop.png`, fullPage: true });
  await library.getByRole("button", { name: "View associated Scenes", exact: true }).click();
  await expect(library.getByRole("tab", { name: "Scenes", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(library.getByRole("combobox", { name: "Environment" })).toHaveValue(environment.reference.environmentId);
  await library.getByRole("button", { name: "Inspect Library Scene", exact: true }).click();
  await expect(library.getByText("A saved private clue Scene in the Studio Bedroom.")).toBeVisible();
  await library.getByRole("button", { name: "View Environment", exact: true }).click();
  await expect(library.getByRole("tab", { name: "Environments", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(library.getByRole("complementary", { name: "SC00C Studio Bedroom details" })).toBeVisible();
  await library.getByRole("button", { name: "View associated Scenes", exact: true }).click();
  await library.getByRole("button", { name: "Inspect Library Scene", exact: true }).click();
  const after = await (await page.request.get("/api/studio/parallax")).json();
  expect(after.environments.find((item: { id: string }) => item.id === environment.reference.environmentId)).toEqual(
    before.environments.find((item: { id: string }) => item.id === environment.reference.environmentId),
  );
  await library.getByRole("button", { name: "Open Scene", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Library Scene", level: 1 })).toBeVisible();
  await expect(library).toBeVisible();
  await library.getByRole("textbox", { name: "Scene name" }).fill("Library Scene renamed");
  await library.getByRole("textbox", { name: "Collection" }).fill("Bedroom clues");
  await library.getByRole("button", { name: "Save name & collection", exact: true }).click();
  await expect(library.getByRole("button", { name: "Inspect Library Scene renamed", exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Add to favorites", exact: true }).click();
  await library.getByRole("combobox", { name: "Source" }).selectOption("FAVORITES");
  await expect(library.getByRole("button", { name: "Inspect Library Scene renamed", exact: true })).toBeVisible();
  await library.getByRole("combobox", { name: "Source" }).selectOption("ALL");
  await library.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Library Scene renamed copy", level: 1 })).toBeVisible();
  await page.screenshot({ path: `${evidence}/saved-scene-desktop.png`, fullPage: true });
  await library.getByRole("tab", { name: "Assets", exact: true }).click();
  await library.getByLabel("Search assets").fill("Treasure chest");
  const chestCard = library.locator("article", { has: page.getByRole("button", { name: "Inspect Treasure chest" }) });
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("Spatial viewport geometry unavailable.");
  await chestCard.dragTo(viewport, {
    targetPosition: { x: Math.round(bounds.width * 0.5), y: Math.round(bounds.height * 0.08) },
    timeout: 15000,
  });
  await expect(
    page.getByRole("region", { name: "Spatial canvas" }).getByText("Choose a clear floor surface"),
  ).toBeVisible();
  let physicalDropPlaced = false;
  for (const [x, y] of [
    [0.5, 0.8],
    [0.35, 0.78],
    [0.65, 0.82],
  ]) {
    await chestCard.dragTo(viewport, {
      targetPosition: { x: Math.round(bounds.width * x), y: Math.round(bounds.height * y) },
      timeout: 15000,
    });
    physicalDropPlaced = await inspector.getByRole("heading", { name: "Treasure chest", exact: true }).isVisible();
    if (physicalDropPlaced) break;
  }
  expect(physicalDropPlaced).toBe(true);
  await page.screenshot({ path: `${evidence}/physical-drop-desktop.png`, fullPage: true });
  await library.getByRole("tab", { name: "Compositions", exact: true }).click();
  await library.getByRole("combobox", { name: "Source" }).selectOption("MY_CREATIONS");
  await library.getByLabel("Search compositions").fill("Saved map clue");
  await library.getByRole("button", { name: "Inspect Saved map clue", exact: true }).click();
  await library.getByRole("button", { name: "Add composition", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Desk Map", exact: true })).toBeVisible();
  await library.getByRole("tab", { name: "Scenes", exact: true }).click();
  await library.getByLabel("Search scenes").fill("");
  await expect(library.locator("article")).toHaveCount(48);
  await expect(library.getByRole("button", { name: /Show more/ })).toBeVisible();
  const start = await page.evaluate(() => performance.now());
  await library.getByLabel("Search scenes").fill("Archive Scene 53");
  await expect(library.getByRole("button", { name: "Inspect Archive Scene 53", exact: true })).toBeVisible();
  const filterMs = (await page.evaluate(() => performance.now())) - start;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Workspace layout").selectOption("SPATIAL");
  await rail.getByRole("button", { name: "Open Spatial Library", exact: true }).click();
  await expect(library).toBeVisible();
  const mobileWidth = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  expect(mobileWidth.page).toBeLessThanOrEqual(mobileWidth.viewport + 1);
  await page.screenshot({ path: `${evidence}/library-mobile.png`, fullPage: true });
  const accessibility = await new AxeBuilder({ page }).include('[aria-label="Spatial content library"]').analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  await writeFile(
    `${evidence}/observations.json`,
    JSON.stringify(
      {
        catalogCardsBeforePagination: 48,
        seededScenes: 56,
        filterMs,
        viewport: { width: 390, height: 844 },
        mobilePageWidth: mobileWidth.page,
        seriousOrCriticalAccessibilityFindings: 0,
        physicalDropPlaced,
      },
      null,
      2,
    ) + "\n",
  );
});
