import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { listSpatialItems } from "../../src/parallax/library-service";
import { mkdir, writeFile } from "node:fs/promises";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: { mode: "on", size: { width: 1280, height: 800 } } });
test.afterAll(() => db.$disconnect());

test("Adaptive workspace docks reclaim viewport area and preserve editing across layouts and reload", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Parallax dock ergonomics");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/studio/parallax");
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  const canvas = page.locator('[data-renderer="READY"] canvas');
  await expect(canvas).toBeVisible();
  const renderer = await canvas.elementHandle();
  await expect(page.getByLabel("Workspace layout")).toHaveValue("SPATIAL");
  await expect(page.getByRole("complementary", { name: "Spatial Library" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand bottom dock" })).toBeVisible();
  const root = "artifacts/parallax-phase3/workstation-refinement";
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/default-spatial-editing.png`, fullPage: true });
  const defaultBounds = (await canvas.boundingBox())!;
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  const asset = page
    .getByRole("region", { name: "Spatial asset browser" })
    .getByRole("button", { name: "Peeking Letter", exact: false });
  await asset.dragTo(canvas, { targetPosition: { x: 250, y: 180 } });
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  await expect(inspector.getByText("Peeking Letter", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Hierarchy", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Scene graph" }).getByRole("button", { name: "◇ Peeking Letter", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Library", exact: true }).click();
  await page.getByLabel("Search spatial assets").fill("Letter");
  await page.getByRole("tab", { name: "Hierarchy", exact: true }).click();
  await page.getByRole("tab", { name: "Library", exact: true }).click();
  await expect(page.getByLabel("Search spatial assets")).toHaveValue("Letter");
  await page.getByLabel("Authoring mode").selectOption("ENGINEERING");
  await page.getByLabel("Position x", { exact: true }).fill("0.2");
  const editedX = await page.getByLabel("Position x", { exact: true }).inputValue();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("separator", { name: "Resize library panel" }).press("ArrowRight");
    await page.getByRole("separator", { name: "Resize inspector panel" }).press("ArrowLeft");
  }
  await expect(page.getByLabel("Position x", { exact: true })).toHaveValue(editedX);
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open asset Library", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Open asset Library", exact: true }).click();
  await page.getByRole("button", { name: "Collapse Inspector", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open object properties", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await page.screenshot({ path: `${root}/construction-layout.png`, fullPage: true });
  await page.getByLabel("Workspace layout").selectOption("BEHAVIOR");
  await page.getByRole("button", { name: "Add spatial behavior", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Behavior 1 delay milliseconds").fill("1200");
  await page.getByRole("separator", { name: "Resize bottom dock" }).press("ArrowUp");
  await page.getByRole("separator", { name: "Resize bottom dock" }).press("ArrowUp");
  await page.screenshot({ path: `${root}/behavior-authoring.png`, fullPage: true });
  await page.getByRole("button", { name: "Collapse bottom dock" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0];
  const authoritative = JSON.stringify(saved.draft);
  const measures = [];
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const layout of ["CONSTRUCTION", "SPATIAL", "FOCUS"] as const) {
      await page.getByLabel("Workspace layout").selectOption(layout);
      await expect(canvas).toBeVisible();
      const bounds = (await canvas.boundingBox())!;
      expect(bounds.width).toBeGreaterThan(viewport.width < 700 ? 250 : 500);
      expect(bounds.height).toBeGreaterThan(viewport.width < 700 ? 300 : 350);
      measures.push({
        viewport,
        layout,
        canvas: { width: bounds.width, height: bounds.height, area: bounds.width * bounds.height },
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2)).toBe(true);
      expect(await canvas.evaluate((current, original) => current === original, renderer)).toBe(true);
    }
    await page.screenshot({ path: `${root}/focus-${viewport.width}x${viewport.height}.png`, fullPage: true });
  }
  const focus = measures.find((m) => m.viewport.width === 1920 && m.layout === "FOCUS")!;
  expect(focus.canvas.width).toBeGreaterThan(defaultBounds.width + 200);
  expect(focus.canvas.height).toBeGreaterThan(750);
  await writeFile(
    `${root}/viewport-measurements.json`,
    JSON.stringify({ artifactRoot: process.env.VALIDATION_ARTIFACTS, measures }, null, 2),
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByLabel("Workspace layout").selectOption("SPATIAL");
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  await page.screenshot({ path: `${root}/constrained-desktop-guided.png`, fullPage: true });
  await page.getByLabel("Authoring mode").selectOption("ENGINEERING");
  await page.screenshot({ path: `${root}/constrained-desktop-engineering.png`, fullPage: true });
  await canvas.focus();
  await page.keyboard.press("/");
  await expect(page.getByLabel("Describe your spatial idea")).toBeFocused();
  await page.getByText("Guided placement controls", { exact: true }).click();
  await page.getByLabel("Spatial placement instruction").focus();
  await expect(page.getByLabel("Spatial placement instruction")).toBeFocused();
  const { aiAvailable } = await (await page.request.get("/api/studio/parallax")).json();
  await expect(page.getByRole("region", { name: "Contextual spatial assistance" })).toContainText(
    aiAvailable ? "Configured provider available in AI assistance" : "AI provider unavailable",
  );
  await page.getByRole("button", { name: "Dock assistance" }).click();
  await page.getByRole("button", { name: "Float assistance" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Ask Parallax/ })).toBeFocused();
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  await page.goto(`/studio/parallax?definition=${saved.id}`);
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Workspace layout")).toHaveValue("CONSTRUCTION");
  expect(JSON.stringify((await listSpatialItems(account.id)).find((item) => item.id === saved.id)!.draft)).toBe(
    authoritative,
  );
  await page.getByRole("button", { name: "Reset Workspace Layout" }).click();
  await expect(page.getByLabel("Workspace layout")).toHaveValue("SPATIAL");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
});
test("Creator edits a populated 3D workstation, previews intent, and retains canonical history", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Parallax workstation review");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1680, height: 1050 });
  await page.goto("/studio/parallax");
  await expect(page.getByRole("heading", { level: 1, name: "Desk Map" })).toBeVisible();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  await page.getByLabel("Authoring mode").selectOption("ENGINEERING");
  await page
    .getByRole("region", { name: "Spatial asset browser" })
    .getByRole("button", { name: "Peeking Letter", exact: false })
    .click();
  await page.getByLabel("Position x", { exact: true }).fill("-0.55");
  await page.getByLabel("Position y", { exact: true }).fill("0.18");
  await page
    .getByRole("region", { name: "Spatial asset browser" })
    .getByRole("button", { name: "Floating Compass", exact: false })
    .click();
  await page.getByLabel("Position x", { exact: true }).fill("0.8");
  await page
    .getByRole("region", { name: "Spatial asset browser" })
    .getByRole("button", { name: "Hidden Wall Message", exact: false })
    .click();
  await page.getByLabel("Position x", { exact: true }).fill("-1.2");
  await page.getByLabel("Position z", { exact: true }).fill("-1.4");
  await page.getByRole("button", { name: "Open scene settings" }).click();
  await page.getByLabel("Experience title").fill("The observatory / spatial sequence");
  await page.getByRole("button", { name: "Open object properties" }).click();
  await page.getByRole("tab", { name: "Hierarchy", exact: true }).click();
  await page
    .getByRole("region", { name: "Scene graph" })
    .getByRole("button", { name: "◇ Desk Map", exact: true })
    .click();
  await page.getByRole("button", { name: "Move tool", exact: true }).click();
  const engineHost = page.locator('[data-renderer="READY"]');
  await expect
    .poll(async () => JSON.parse((await engineHost.getAttribute("data-projected-scene")) ?? "{}").handles?.X)
    .toBeTruthy();
  const handle = JSON.parse((await engineHost.getAttribute("data-projected-scene"))!).handles.X as {
    x: number;
    y: number;
  };
  const handleBounds = (await engineHost.locator("canvas").boundingBox())!;
  const originalX = await page.getByLabel("Position x", { exact: true }).inputValue();
  await page.mouse.move(
    handleBounds.x + handle.x * handleBounds.width,
    handleBounds.y + handle.y * handleBounds.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBounds.x + handle.x * handleBounds.width + 45,
    handleBounds.y + handle.y * handleBounds.height - 15,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("Position x", { exact: true })).not.toHaveValue(originalX);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Position x", { exact: true })).toHaveValue(originalX);
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Add spatial behavior", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Behavior 1 delay milliseconds").fill("2000");
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  await page.getByRole("button", { name: "Rotate tool", exact: true }).click();
  await page.getByLabel("Workspace layout").selectOption("SPATIAL");
  await page.screenshot({
    path: "artifacts/parallax-phase3/workstation-refinement/desktop-primary.png",
    fullPage: true,
  });
  const canvas = page.locator('[data-renderer="READY"] canvas');
  const bounds = (await canvas.boundingBox())!;
  const before = await canvas.screenshot();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.66, { steps: 12 });
  await page.mouse.up();
  const after = await canvas.screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByLabel("Camera perspective").selectOption("plan");
  await page.screenshot({ path: "artifacts/parallax-phase3/workstation-refinement/plan-view.png", fullPage: true });
  await page.getByLabel("Camera perspective").selectOption("perspective");
  await page.getByRole("button", { name: "Toggle spatial overlays" }).click();
  await page.screenshot({
    path: "artifacts/parallax-phase3/workstation-refinement/surface-overlays.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause timeline", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bottom workstation dock" })).not.toContainText("0.0 / 60.0 s");
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Preview", { exact: true }).selectOption("EDITOR");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0];
  const storedBefore = JSON.stringify(saved.draft);
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  await page.getByText("Guided placement controls", { exact: true }).click();
  await page.getByLabel("Spatial placement instruction").fill("Place the map on a table near the entrance");
  await page.getByRole("button", { name: "Preview placement", exact: true }).click();
  await expect(page.getByRole("region", { name: "Contextual spatial assistance" })).toContainText("draft unchanged");
  expect(JSON.stringify((await listSpatialItems(account.id)).find((i) => i.id === saved.id)!.draft)).toBe(storedBefore);
  await page.screenshot({
    path: "artifacts/parallax-phase3/workstation-refinement/proposal-preview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Discard preview", exact: true }).click();
  await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  await page.getByLabel("Workspace layout").selectOption("FOCUS");
  await page.screenshot({
    path: "artifacts/parallax-phase3/workstation-refinement/immersive-viewport.png",
    fullPage: true,
  });
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  for (const mode of ["DETAILED", "ENGINEERING"]) {
    await page.getByLabel("Authoring mode").selectOption(mode);
    await page.screenshot({
      path: `artifacts/parallax-phase3/workstation-refinement/desktop-${mode}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  const desktopAxe = await new AxeBuilder({ page }).analyze();
  expect(desktopAxe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/parallax-phase3/workstation-refinement/constrained-viewport.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobileAxe = await new AxeBuilder({ page }).analyze();
  expect(mobileAxe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
});
