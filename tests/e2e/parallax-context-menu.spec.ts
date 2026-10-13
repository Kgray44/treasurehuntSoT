import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
test("Creator uses one graph toolbar, right-click object commands and keyboard menus across saved scenes and phone", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic context-menu Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const draft = createSpatialDraft("context-scene");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Desk Map.*My Library/ }).click();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  await expect(host.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  const toolbar = graph.getByRole("toolbar", { name: "Scene graph object actions" });
  await graph.locator("li button").first().click();
  await expect(toolbar.getByRole("button", { name: "Remove object", exact: true })).toBeDisabled();
  await toolbar.getByRole("button", { name: "Duplicate object", exact: true }).click();
  await expect(graph.locator("li")).toHaveCount(2);
  for (const row of await graph.locator("li").all()) await expect(row.getByRole("button")).toHaveCount(1);
  await toolbar.getByRole("button", { name: "Lock object", exact: true }).click();
  await expect(toolbar.getByRole("button", { name: "Duplicate object", exact: true })).toBeDisabled();
  await toolbar.getByRole("button", { name: "Unlock object", exact: true }).click();
  await graph.locator("li button").last().click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Hide object", exact: true })).toBeVisible();
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/graph-object-context-dark.png` });
  await menu.getByRole("menuitem", { name: "Hide object", exact: true }).click();
  await expect(toolbar.getByRole("button", { name: "Show object", exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        JSON.parse((await host.getAttribute("data-scene-receipt"))!).filter(
          (receipt: { status: string }) => receipt.status === "HIDDEN",
        ).length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(toolbar.getByRole("button", { name: "Hide object", exact: true })).toBeVisible();
  await toolbar.getByRole("button", { name: "Remove object", exact: true }).click();
  await expect(graph.locator("li")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(graph.locator("li")).toHaveCount(2);
  const selected = graph.locator("li button").last();
  await selected.focus();
  await selected.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(selected).toBeFocused();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0].draft;
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await expect(host).toHaveAttribute("data-projected-scene", /.+/);
  const projected = JSON.parse((await host.getAttribute("data-projected-scene"))!);
  const area = (await host.locator("canvas").boundingBox())!;
  await page.mouse.click(area.x + area.width * projected.objects[0].x, area.y + area.height * projected.objects[0].y, {
    button: "right",
  });
  await expect(menu.getByRole("menuitem", { name: "Inspect object", exact: true })).toBeVisible();
  await page.screenshot({ path: `${root}/viewport-object-context-dark.png` });
  await page.keyboard.press("Escape");
  await host.locator("canvas").focus();
  await host.locator("canvas").press("Shift+F10");
  await expect(menu.getByRole("menuitem", { name: "Edit placement", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(host.locator("canvas")).toBeFocused();

  await page.getByRole("button", { name: "Open asset Library", exact: true }).click();
  const asset = page.getByRole("button", { name: /Peeking Letter.*Writing/ });
  await asset.click({ button: "right" });
  await expect(menu.getByRole("menuitem", { name: "Add to scene", exact: true })).toBeVisible();
  await page.screenshot({ path: `${root}/asset-context-dark.png` });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: "Actions for Desk Map", exact: true }).click();
  await expect(menu.getByRole("menuitem", { name: "Archive", exact: true })).toBeDisabled();
  await page.screenshot({ path: `${root}/saved-scene-context-dark.png` });
  await page.keyboard.press("Escape");
  await page.evaluate(() => (document.documentElement.dataset.voyageTheme = "light"));
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await graph.locator("li button").first().click();
  await page.screenshot({ path: `${root}/graph-toolbar-light.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  if (!(await graph.isVisible())) await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await graph.locator("li button").first().click({ button: "right" });
  await expect(menu).toBeVisible();
  const bounds = (await menu.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: `${root}/graph-context-light-phone.png` });
  const accessibility = await new AxeBuilder({ page }).include('[role="menu"]').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.keyboard.press("Escape");
});
