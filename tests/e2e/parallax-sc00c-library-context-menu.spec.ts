import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { saveSpatialDraft } from "../../src/parallax/library-service";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { defaultPreferences, updatePreferences } from "../../src/wayfarer/profile";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const evidence = `artifacts/sc00c/library-context-menu/${process.env.SC00C_LIBRARY_SOURCE?.slice(0, 12) ?? "unbound"}`;

test("Library card menus preserve insertion, current-Scene protection, keyboard focus and phone bounds", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Library menu Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(randomUUID(), "Floating Compass");
  scene.content.title = "Context menu working Scene";
  await saveSpatialDraft(account.id, scene, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  const renderer = page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"]');
  await expect(renderer.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: "Assets", exact: true }).click();
  await library.getByRole("searchbox").fill("Peeking Letter");
  const asset = library.getByRole("button", { name: "Inspect Peeking Letter", exact: true });
  await expect(asset).toBeVisible();
  await asset.click({ button: "right" });
  const assetMenu = page.getByRole("menu", { name: "Peeking Letter actions", exact: true });
  await expect(assetMenu.getByRole("menuitem", { name: "Add to scene", exact: true })).toBeVisible();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/built-in-context-desktop.png`, fullPage: true });
  await assetMenu.getByRole("menuitem", { name: "Add to scene", exact: true }).click();
  await expect.poll(async () => JSON.parse((await renderer.getAttribute("data-scene-receipt"))!).length).toBe(2);
  await expect(page.getByRole("region", { name: "Inspector context" })).toContainText("Peeking Letter");
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect.poll(async () => JSON.parse((await renderer.getAttribute("data-scene-receipt"))!).length).toBe(1);

  await library.getByRole("tab", { name: "Scenes", exact: true }).click();
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await library.getByRole("combobox", { name: "Show", exact: true }).selectOption("WORKING");
  await library.getByRole("searchbox").fill(scene.content.title);
  const currentScene = library.getByRole("button", { name: `Inspect ${scene.content.title}`, exact: true });
  await expect(currentScene).toBeVisible();
  await currentScene.click({ button: "right" });
  const sceneMenu = page.getByRole("menu", { name: `${scene.content.title} actions`, exact: true });
  await expect(sceneMenu.getByRole("menuitem", { name: "Archive", exact: true })).toBeDisabled();
  await page.screenshot({ path: `${evidence}/current-scene-context-desktop.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await expect(currentScene).toBeFocused();
  await currentScene.press("Shift+F10");
  await expect(sceneMenu).toBeVisible();
  await expect(sceneMenu.getByRole("menuitem", { name: "Archive", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(currentScene).toBeFocused();
  await currentScene.press("Shift+F10");
  await expect(sceneMenu).toBeVisible();
  const moved = await library.evaluate((section) => {
    const pane = section.closest<HTMLElement>('[class*="leftPane"]');
    if (!pane) return false;
    const before = pane.scrollTop;
    pane.scrollTop = before > 0 ? 0 : Math.min(40, pane.scrollHeight - pane.clientHeight);
    return pane.scrollTop !== before;
  });
  expect(moved).toBe(true);
  await expect(sceneMenu).toBeHidden();

  await updatePreferences(account.profileId, {
    ...defaultPreferences,
    experience: { ...defaultPreferences.experience, theme: "LIGHT", motion: "REDUCED" },
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await page.setViewportSize({ width: 390, height: 844 });
  const openLibrary = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await openLibrary.getAttribute("aria-pressed")) !== "true") await openLibrary.click();
  const phoneLibrary = page.getByRole("region", { name: "Spatial content library", exact: true });
  await phoneLibrary.getByRole("tab", { name: "Assets", exact: true }).click();
  await phoneLibrary.getByRole("searchbox").fill("Writing desk");
  await phoneLibrary.getByRole("button", { name: "Expand Spatial Library", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded Spatial Library", exact: true });
  const desk = dialog.getByRole("button", { name: "Inspect Writing desk", exact: true });
  await expect(desk).toBeVisible();
  await desk.focus();
  await desk.press("Shift+F10");
  const deskMenu = page.getByRole("menu", { name: "Writing desk actions", exact: true });
  await expect(deskMenu.getByRole("menuitem", { name: "Place in Scene", exact: true })).toBeVisible();
  const bounds = (await deskMenu.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: `${evidence}/expanded-phone-context-light-reduced.png`, fullPage: true });
  await deskMenu.getByRole("menuitem", { name: "Place in Scene", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Place Writing desk in Scene")).toBeVisible();
  await expect(page.getByLabel("Place Writing desk in Scene")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeDisabled();
  await page.screenshot({ path: `${evidence}/context-placement-preview-phone.png`, fullPage: true });
});
