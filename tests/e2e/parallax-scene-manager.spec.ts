import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import type { SpatialLibraryRecord } from "../../src/parallax/library-service";
import type { EnvironmentLibraryRecord } from "../../src/parallax/library-lifecycle-contracts";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import { saveEnvironmentDraft, releaseEnvironmentVersion } from "../../src/parallax/library-lifecycle-service";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import type { CompatibleEnvironmentRecord } from "../../src/parallax/environment-library-compatibility";
import { sceneReference, validateSceneReference } from "../../src/parallax/scene-reference";
import type { SpatialMoment } from "../../src/parallax/contracts";
test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const evidence = "artifacts/parallax-a1/browser/" + (process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound");
async function read(page: Page) {
  const response = await page.request.get("/api/studio/parallax");
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    items: SpatialLibraryRecord[];
    environments: EnvironmentLibraryRecord[];
    csrfToken: string;
  };
}
async function catalog(page: Page) {
  const owner = await read(page);
  const response = await page.request.post("/api/studio/parallax", {
    headers: { "x-csrf-token": owner.csrfToken },
    data: { action: "ENVIRONMENT_CATALOG" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).catalog as CompatibleEnvironmentRecord[];
}
async function save(page: Page) {
  const manager = await manage(page);
  await manager.getByRole("button", { name: "Save Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Scene saved.");
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
}
async function manage(page: Page) {
  const button = page.getByRole("button", { name: "Manage Scenes", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  const manager = page.getByRole("dialog", { name: "Environments & Scenes", exact: true });
  await expect(manager).toBeVisible();
  return manager;
}
async function screenshot(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: evidence + "/" + name + ".png", fullPage: true });
}

test("Creator authors three independent Haunted Bedroom Scenes, reviews an explicit shared revision and retains immutable references", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC01 Integrated Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Parallax", level: 1 })).toBeVisible();
  let manager = await manage(page);
  await manager.getByRole("button", { name: "New Environment", exact: true }).click();
  let setup = page.getByRole("dialog", { name: "Create an environment", exact: true });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: /^Existing environment/ }).click();
  setup = page.getByRole("dialog", { name: "Start from an existing room", exact: true });
  await setup.getByRole("searchbox", { name: "Find existing environment", exact: true }).fill("Bedroom");
  await setup.getByRole("button", { name: "Start from Bedroom", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bedroom copy", level: 1 })).toBeVisible();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("The Haunted Bedroom");
  await page
    .getByRole("textbox", { name: "Environment description", exact: true })
    .fill("An invented bedroom shared by three independent Scenes.");
  await page.getByRole("button", { name: "Save to Library", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved to Library");
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Version history", exact: true })
    .getByRole("button", { name: "Create immutable version", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Version history", exact: true })).not.toBeVisible();
  await screenshot(page, "sc01-integrated-shared-environment");
  await page.getByRole("button", { name: "Back to scene", exact: true }).click();
  manager = page.getByRole("dialog", { name: "Environments & Scenes", exact: true });
  await expect(manager).toBeVisible();
  const create = async (name: string, description: string, preset = "BASELINE") => {
    await manager.getByRole("textbox", { name: "Scene name", exact: true }).fill(name);
    await manager.getByRole("textbox", { name: "Scene description", exact: true }).fill(description);
    await manager.getByRole("combobox", { name: "Scene starting content", exact: true }).selectOption(preset);
    await manager.getByRole("button", { name: "Create Scene from baseline", exact: true }).click();
    await expect(manager.getByRole("status")).toContainText(name + " created as an independent working Scene.");
  };
  await create("Ordinary Room", "The room without supernatural content.");
  await create("The Haunting", "Spectral footsteps cross the shared bedroom.", "Ghost Footprint Trail");
  await manager.getByRole("combobox", { name: "Scene preview lighting", exact: true }).selectOption("LOW");
  await manager.getByRole("button", { name: "Save Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Scene saved.");
  await create("The Hidden Letter", "An independent letter contains a hidden clue.", "Peeking Letter");
  await expect(manager.getByRole("region", { name: "Scene gallery", exact: true }).getByRole("article")).toHaveCount(3);
  await screenshot(page, "sc01-integrated-three-scenes");
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Clue or message", exact: true })
    .fill("The key is beneath the third floorboard.");
  await save(page);
  await screenshot(page, "sc01-integrated-letter-canvas");
  manager = await manage(page);
  await manager.getByRole("button", { name: "Open The Haunting", exact: true }).click();
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await library.getByRole("tab", { name: "Compositions", exact: true }).click();
  await library.getByRole("searchbox", { name: "Search compositions", exact: true }).fill("Ghostly Presence");
  await library.getByRole("button", { name: "Inspect Ghostly Presence", exact: true }).click();
  await library.getByRole("button", { name: "Add to Scene", exact: true }).click();
  await save(page);
  await expect(page.getByRole("region", { name: "Spatial canvas", exact: true }).locator("canvas")).toBeVisible();
  await screenshot(page, "sc01-integrated-haunting-canvas");
  const initial = await read(page),
    bedroom = initial.environments.find((environment) => environment.draft.name === "The Haunted Bedroom")!;
  expect(bedroom).toBeTruthy();
  expect(bedroom.draft.room!.features.some((feature) => feature.classification === "BED")).toBe(true);
  const scenes = initial.items.filter((item) => item.draft.content.environment?.environmentId === bedroom.id);
  expect(scenes).toHaveLength(3);
  expect(new Set(scenes.map((item) => item.id)).size).toBe(3);
  expect(scenes.every((item) => item.draft.content.environment?.revision === 1)).toBe(true);
  const ordinary = scenes.find((item) => item.draft.content.title === "Ordinary Room")!,
    haunting = scenes.find((item) => item.draft.content.title === "The Haunting")!,
    letter = scenes.find((item) => item.draft.content.title === "The Hidden Letter")!;
  expect(ordinary.draft.content.scenePresentation).toBeUndefined();
  expect(ordinary.draft.content.entities.every((entity) => !entity.element)).toBe(true);
  expect(haunting.draft.content.scenePresentation?.lighting).toBe("LOW");
  expect(haunting.draft.content.entities.some((entity) => entity.element?.kind === "LIGHT")).toBe(true);
  expect(letter.draft.content.entities[0].content).toContain("third floorboard");
  manager = await manage(page);
  await manager.getByRole("button", { name: "Duplicate active Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Independent Scene copy created");
  await manager.getByRole("textbox", { name: "Rename active Scene", exact: true }).fill("Haunting study");
  await manager.getByRole("button", { name: "Rename Scene", exact: true }).click();
  await expect(manager.getByRole("region", { name: "Active Scene information", exact: true })).toContainText(
    "Unsaved changes",
  );
  await manager.getByRole("button", { name: "Save Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Scene saved.");
  const copy = (await read(page)).items.find((item) => item.draft.content.title === "Haunting study")!;
  expect(copy.id).not.toBe(haunting.id);
  await manager.getByRole("button", { name: "Scene identity & immutable versions", exact: true }).press("Enter");
  await expect(manager.getByRole("region", { name: "Active Scene information", exact: true })).toContainText(copy.id);
  await screenshot(page, "sc01-integrated-scene-information");
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.getByText("Scene actions", { exact: true }).click();
  await page.getByRole("button", { name: "Create immutable version", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Immutable version created" })).toBeVisible();
  const published = await db.reusableAuthoringItemVersion.findFirstOrThrow({
    where: { itemId: copy.id, versionNumber: { gt: 0 } },
  });
  const moment = JSON.parse(published.envelope) as SpatialMoment,
    reference = sceneReference(moment, "PRESERVE_ENVIRONMENT");
  expect(validateSceneReference(reference, moment)).toEqual(reference);
  expect(reference.environment.revision).toBe(1);
  await writeFile(evidence + "/chronicle-scene-reference-example.json", JSON.stringify(reference, null, 2));
  manager = await manage(page);
  await manager.getByRole("button", { name: "Edit shared Environment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The Haunted Bedroom", level: 1 })).toBeVisible();
  await page.getByRole("combobox", { name: "Base preview lighting", exact: true }).selectOption("LOW");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Base preview lighting", exact: true })).toHaveValue("NORMAL");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Version history", exact: true })
    .getByRole("button", { name: "Create immutable version", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Version history", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Back to scene", exact: true }).click();
  manager = page.getByRole("dialog", { name: "Environments & Scenes", exact: true });
  await expect(manager).toBeVisible();
  await manager.getByRole("button", { name: "Review Environment impact", exact: true }).click();
  await expect(manager.getByRole("region", { name: "Environment impact review", exact: true })).toContainText(
    "base lighting changed",
  );
  expect(
    (await read(page)).items
      .filter((item) => item.draft.content.environment?.environmentId === bedroom.id)
      .every((item) => item.draft.content.environment?.revision === 1),
  ).toBe(true);
  await screenshot(page, "sc01-integrated-environment-impact");
  await manager.getByRole("button", { name: "Update and revalidate Haunting study", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Environment update saved");
  expect((await read(page)).items.find((item) => item.id === copy.id)!.draft.content.environment?.revision).toBe(2);
  await manager.getByRole("combobox", { name: "Compare active Scene with", exact: true }).selectOption(haunting.id);
  await manager.getByRole("button", { name: "Compare Scenes", exact: true }).click();
  await expect(manager.getByRole("region", { name: "Scene comparison results", exact: true })).toContainText(
    "ENVIRONMENT REFERENCE",
  );
  await screenshot(page, "sc01-integrated-comparison");
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await save(page);
  expect((await read(page)).items.find((item) => item.id === copy.id)!.draft.content.environment?.revision).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await save(page);
  expect((await read(page)).items.find((item) => item.id === copy.id)!.draft.content.title).toBe("The Haunting copy");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await save(page);
  manager = await manage(page);
  await manager.getByRole("button", { name: "Review Environment impact", exact: true }).click();
  await manager.getByRole("button", { name: "Update and revalidate Ordinary Room", exact: true }).click();
  await expect(manager.getByRole("textbox", { name: "Rename active Scene", exact: true })).toHaveValue("Ordinary Room");
  expect((await read(page)).items.find((item) => item.id === haunting.id)!.draft.content.environment?.revision).toBe(1);
  expect((await read(page)).items.find((item) => item.id === letter.id)!.draft.content.environment?.revision).toBe(1);
  const conflict = await page.request.post("/api/studio/parallax", {
    headers: { "x-csrf-token": initial.csrfToken },
    data: { action: "SAVE", draft: ordinary.draft, revision: ordinary.revision },
  });
  expect(conflict.status()).toBe(409);
  expect((await db.reusableAuthoringItemVersion.findUniqueOrThrow({ where: { id: published.id } })).envelope).toBe(
    published.envelope,
  );
  expect(validateSceneReference(reference, moment)).toEqual(reference);
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Environment and Scene", exact: true })).toContainText("Ordinary Room");
  manager = await manage(page);
  await manager.getByRole("button", { name: "Open The Hidden Letter", exact: true }).click();
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  manager = await manage(page);
  await screenshot(page, "sc01-integrated-manager-phone");
  const axe = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  expect(axe.violations.filter((issue) => ["critical", "serious"].includes(issue.impact ?? ""))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(manager).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Manage Scenes", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Manage Scenes", exact: true }).press("Enter");
  await expect(manager).toBeVisible();
  const card = manager
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Haunting study", exact: true }) });
  await card.getByRole("button", { name: "Archive Haunting study", exact: true }).click();
  await manager.getByRole("button", { name: "Confirm archive", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Scene archived");
  expect((await db.reusableAuthoringItemVersion.findUniqueOrThrow({ where: { id: published.id } })).envelope).toBe(
    published.envelope,
  );
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.getByRole("link", { name: "← Creator Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("built-in copies use a distinct legacy working editor and explicit release before independent Scene reuse", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC01 Legacy Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await save(page);
  const returnId = new URL(page.url()).searchParams.get("definition");
  let manager = await manage(page);
  const builtin = (await catalog(page)).find((record) => record.builtin)!;
  expect(builtin.representation).toBe("SC01_SCHEMA1");
  const builtinBefore = JSON.stringify(builtin);
  await manager.getByRole("combobox", { name: "Browse Environment", exact: true }).selectOption(builtin.id);
  await manager.getByRole("button", { name: "Edit an owned copy", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Environment name", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Environment name", exact: true }).fill("Owned preset study");
  const originalWidth = (builtin.representation === "SC01_SCHEMA1" ? builtin.versions[0].content.width : 4).toString();
  await page.getByRole("spinbutton", { name: "Environment width (m)", exact: true }).fill("2");
  await page.getByRole("button", { name: "Save working Environment", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "outside the Environment" })).toBeVisible();
  await screenshot(page, "sc01-integrated-invalid-legacy-geometry");
  await page.getByRole("spinbutton", { name: "Environment width (m)", exact: true }).fill(originalWidth);

  await page.getByRole("button", { name: "Save working Environment", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Working Environment saved");
  const owned = (await catalog(page)).find(
    (record) => record.representation === "SC01_SCHEMA1" && record.working?.content.name === "Owned preset study",
  )!;
  expect(owned).toBeTruthy();
  expect(owned.versions).toHaveLength(0);
  expect(owned.saveState).toBe("WORKING");
  expect(owned.id).not.toBe(builtin.id);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Environment name", exact: true })).toHaveValue("Owned preset study");
  await page.getByRole("button", { name: "Save Environment to Library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create immutable Environment version", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Create immutable Environment version", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("version 1 created");
  await screenshot(page, "sc01-integrated-legacy-working");
  await page.getByRole("button", { name: "Back to Scene", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("definition")).toBe(returnId);
  manager = await manage(page);
  await manager.getByRole("combobox", { name: "Browse Environment", exact: true }).selectOption(owned.id);
  await manager.getByRole("textbox", { name: "Scene name", exact: true }).fill("Owned preset Scene");
  await manager.getByRole("button", { name: "Create Scene from baseline", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("created as an independent");

  const releasedOwned = (await catalog(page)).find((record) => record.id === owned.id)!;
  if (releasedOwned.representation !== "SC01_SCHEMA1") throw new Error("Expected schema-one source");
  const feature = releasedOwned.versions[0].content.evidence.candidates.find(
    (feature) => feature.safe && !feature.occluded,
  )!;
  await manager.getByRole("button", { name: "Scene semantic references", exact: true }).press("Enter");
  await manager
    .getByRole("combobox", { name: "Semantic reference for Room description", exact: true })
    .selectOption(feature.id);
  await manager.getByRole("button", { name: "Save Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Scene saved.");
  await manager.getByRole("button", { name: "Edit shared Environment", exact: true }).click();
  await page.getByRole("button", { name: "Shared semantic features & constraints", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Remove feature " + feature.id, exact: true }).click();
  await page.getByRole("button", { name: "Save working Environment", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Working Environment saved");
  await expect(page.getByRole("button", { name: "Create immutable Environment version", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Create immutable Environment version", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("version 2 created");
  await expect(page.getByRole("button", { name: "Back to Scene", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Back to Scene", exact: true }).click();
  manager = page.getByRole("dialog", { name: "Environments & Scenes", exact: true });
  await expect(manager).toBeVisible();
  await manager.getByRole("button", { name: "Review Environment impact", exact: true }).click();
  await expect(manager.getByRole("region", { name: "Environment impact review", exact: true })).toContainText(
    "missing or unsafe",
  );
  await expect(
    manager.getByRole("button", { name: "Update and revalidate Owned preset Scene", exact: true }),
  ).toBeDisabled();
  await screenshot(page, "sc01-integrated-invalid-semantic-reference");
  await manager.getByRole("button", { name: "Scene semantic references", exact: true }).press("Enter");
  await manager
    .getByRole("combobox", { name: "Semantic reference for Room description", exact: true })
    .selectOption("");
  await manager.getByRole("button", { name: "Save Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Scene saved.");
  await manager.getByRole("button", { name: "Update and revalidate Owned preset Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Environment update saved");
  expect(JSON.stringify((await catalog(page)).find((record) => record.id === builtin.id))).toBe(builtinBefore);
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await expect(page.getByRole("region", { name: "Spatial canvas", exact: true }).locator("canvas")).toBeVisible();
  await screenshot(page, "sc01-integrated-legacy-scene");
});

test("a reviewed synthetic reconstructed Environment is selectable and another Scene duplicates without changing its pin", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC01 Reconstruction Consumer");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  const document = createEnvironmentDraft(
    "sc01-reviewed-reconstruction-" + account.id,
    createRoomEnvironment(simulationEnvironments[0]),
  );
  document.name = "Reviewed synthetic reconstruction";
  document.category = "RECONSTRUCTED";
  document.room!.name = document.name;
  document.room!.origin = "PHOTO_RECONSTRUCTION";
  document.description = "Invented reviewed geometry metadata; no room images or physical accuracy evidence.";
  await saveEnvironmentDraft(account.id, document, 0);
  await releaseEnvironmentVersion(account.id, document.id, 1, "Synthetic reviewed metadata");
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  const manager = await manage(page);
  await manager.getByRole("combobox", { name: "Browse Environment", exact: true }).selectOption(document.id);
  await manager.getByRole("textbox", { name: "Scene name", exact: true }).fill("Reconstructed room Scene");
  await manager.getByRole("button", { name: "Create Scene from baseline", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("created as an independent");
  const source = (await read(page)).items.find((item) => item.draft.content.title === "Reconstructed room Scene")!;
  await manager.getByRole("combobox", { name: "Scene source", exact: true }).selectOption(source.id);
  await manager.getByRole("textbox", { name: "Scene name", exact: true }).fill("Reconstructed room copy");
  await manager.getByRole("button", { name: "Duplicate Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("created as an independent");
  const copy = (await read(page)).items.find((item) => item.draft.content.title === "Reconstructed room copy")!;
  expect(copy.id).not.toBe(source.id);
  expect(copy.draft.content.environment).toEqual(source.draft.content.environment);
  await screenshot(page, "sc01-integrated-reconstructed-source");
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Environment and Scene", exact: true })).toContainText(
    "Reconstructed room copy",
  );
});
