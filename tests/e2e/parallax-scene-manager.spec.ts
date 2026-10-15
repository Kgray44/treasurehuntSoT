import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import type { SpatialLibraryRecord } from "../../src/parallax/library-service";
import type { EnvironmentRecord } from "../../src/parallax/environment-contracts";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.afterAll(() => db.$disconnect());
test("Creator authors three independent Haunted Bedroom Scenes, reviews an Environment revision, and reopens saved work", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC-01 Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Desk Map", exact: true })).toBeVisible();
  const manager = page.getByRole("dialog", { name: "Environments & Scenes", exact: true });
  const manage = async () => {
    await page.getByRole("button", { name: "Manage Scenes", exact: true }).click();
    await expect(manager).toBeVisible();
  };
  await manage();
  await manager.getByRole("button", { name: "New Environment", exact: true }).click();
  await manager.getByLabel("Environment name", { exact: true }).fill("The Haunted Bedroom");
  await manager
    .getByLabel("Environment description", { exact: true })
    .fill("An invented bedroom with a shared bed, desk, walls and window. Scene clues are authored independently.");
  await manager.getByRole("button", { name: "Add shared furniture", exact: true }).click();
  await manager.getByRole("button", { name: "Save Environment revision", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Environment revision saved");
  const create = async (name: string, description: string, preset = "BASELINE") => {
    await manager.getByLabel("Scene name", { exact: true }).fill(name);
    await manager.getByLabel("Scene description", { exact: true }).fill(description);
    await manager.getByLabel("Scene starting content", { exact: true }).selectOption(preset);
    await manager.getByRole("button", { name: "Create Scene from baseline", exact: true }).click();
    await expect(manager.getByRole("status")).toContainText(`${name} created and saved independently.`);
  };
  await create("Ordinary Room", "The bedroom without supernatural content.");
  await create("The Haunting", "Spectral footsteps cross the room.", "Ghost Footprint Trail");
  await create("The Hidden Letter", "A letter contains an independent clue.", "Peeking Letter");
  await expect(manager.getByRole("region", { name: "Scene gallery" }).getByRole("article")).toHaveCount(3);
  await page.screenshot({ path: "artifacts/screenshots/sc01-three-scenes.png", fullPage: true });
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.getByLabel("Clue or message", { exact: true }).fill("The key is beneath the third floorboard.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await manage();
  await manager.getByRole("button", { name: "Open The Haunting", exact: true }).click();
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Add spatial behavior", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const read = async () => {
    const response = await page.request.get("/api/studio/parallax");
    expect(response.ok()).toBe(true);
    return (await response.json()) as {
      items: SpatialLibraryRecord[];
      environments: EnvironmentRecord[];
      csrfToken: string;
    };
  };
  const initial = await read();
  const bedroom = initial.environments.find((e) => e.current.content.name === "The Haunted Bedroom")!;
  const authored = initial.items.filter((i) => i.draft.content.environment?.environmentId === bedroom.id);
  expect(authored).toHaveLength(3);
  expect(new Set(authored.map((i) => i.id)).size).toBe(3);
  expect(authored.every((i) => i.draft.content.environment?.versionId === bedroom.current.reference.versionId)).toBe(
    true,
  );
  expect(authored.find((i) => i.draft.content.title === "Ordinary Room")!.draft.content.studio!.behaviors).toHaveLength(
    0,
  );
  expect(authored.find((i) => i.draft.content.title === "The Haunting")!.draft.content.studio!.behaviors).toHaveLength(
    1,
  );
  expect(
    authored.find((i) => i.draft.content.title === "The Hidden Letter")!.draft.content.entities[0].content,
  ).toContain("third floorboard");
  await manage();
  await manager.getByRole("button", { name: "Duplicate active Scene", exact: true }).click();
  await expect(manager.getByRole("status")).toContainText("Independent Scene copy created");
  await manager.getByLabel("Rename active Scene", { exact: true }).fill("Haunting study");
  await manager.getByRole("button", { name: "Rename Scene", exact: true }).click();
  await manager.getByRole("button", { name: "Save Scene", exact: true }).click();
  const duplicated = await read();
  const copy = duplicated.items.find((i) => i.draft.content.title === "Haunting study")!;
  const haunting = duplicated.items.find((i) => i.draft.content.title === "The Haunting")!;
  expect(copy.id).not.toBe(haunting.id);
  await manager.getByLabel("Compare active Scene with", { exact: true }).selectOption(haunting.id);
  await manager.getByRole("button", { name: "Compare Scenes", exact: true }).click();
  await expect(manager.getByRole("status").filter({ hasText: "Haunting study → The Haunting" })).toBeVisible();
  await manager.getByRole("button", { name: "Edit Environment", exact: true }).click();
  await manager.getByLabel("Room width (m)", { exact: true }).fill("6");
  await manager.getByRole("button", { name: "Undo Environment edit", exact: true }).click();
  await expect(manager.getByLabel("Room width (m)", { exact: true })).toHaveValue("4");
  await manager.getByRole("button", { name: "Redo Environment edit", exact: true }).click();
  await manager.getByRole("button", { name: "Save Environment revision", exact: true }).click();
  await expect(manager.getByRole("region", { name: "Environment impact review" })).toContainText("REVIEW REQUIRED");
  expect(
    (await read()).items
      .filter((i) => i.draft.content.environment?.environmentId === bedroom.id)
      .every((i) => i.draft.content.environment?.revision === 1),
  ).toBe(true);
  await manager.getByRole("button", { name: "Update and revalidate Haunting study", exact: true }).click();
  await manager.getByRole("button", { name: "Save Scene", exact: true }).click();
  await manager.getByRole("button", { name: "Preview Scene", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Preview", exact: true })).toHaveValue("LENS");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Haunting study", exact: true })).toBeVisible();
  const reloaded = await read();
  expect(reloaded.items.find((i) => i.id === copy.id)!.draft.content.environment?.revision).toBe(2);
  expect(reloaded.items.find((i) => i.id === haunting.id)!.draft.content.environment?.revision).toBe(1);
  await manage();
  await page.setViewportSize({ width: 390, height: 844 });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
  await page.screenshot({ path: "artifacts/screenshots/sc01-manager-mobile.png", fullPage: true });
  await manager.getByRole("button", { name: "Close Scene Manager", exact: true }).click();
  await page.getByRole("button", { name: "Manage Scenes", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(manager).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(manager).not.toBeVisible();
});
