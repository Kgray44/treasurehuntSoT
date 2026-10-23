import { addCurrentBuiltinAsset, saveCurrentWorkingDraft } from "./fixtures/parallax-current-library";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { listSpatialItems, saveSpatialDraft } from "../../src/parallax/library-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import { mkdir, writeFile } from "node:fs/promises";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: { mode: "on", size: { width: 1280, height: 800 } } });
test.afterAll(() => db.$disconnect());

test("Assistant docking labels remain visible and reachable across viewport sizes", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Assistant docking labels");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Ask Parallax", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Ask Parallax workspace", exact: true });
  await expect(workspace.getByRole("region", { name: "Spatial Assistant", exact: true })).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const docked of [true, false]) {
      await workspace
        .getByRole("button", { name: docked ? "Dock assistance" : "Float assistance", exact: true })
        .click();
      await expect(workspace).toHaveAttribute("data-docked", String(docked));
      const label = docked ? "Float assistance" : "Dock assistance";
      const toggle = workspace.getByRole("button", { name: label, exact: true });
      await expect(toggle).toHaveText(label);
      for (const control of [toggle, workspace.getByRole("button", { name: "Close assistance", exact: true })]) {
        await expect(control).toBeInViewport({ ratio: 1 });
        const bounds = await control.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(element);
          const labelBounds = text.getBoundingClientRect();
          return {
            labelInside:
              !element.textContent?.trim() ||
              (labelBounds.left >= rect.left - 1 && labelBounds.right <= rect.right + 1),
            hit: element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
          };
        });
        expect(bounds.labelInside, `${viewport.width} px ${label}: visible control content fits`).toBe(true);
        expect(bounds.hit, `${viewport.width} px ${label}: control can be clicked`).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await workspace.getByRole("button", { name: "Close assistance", exact: true }).click();
  await expect(workspace).toBeHidden();
  await page.getByRole("link", { name: "← Creator Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
});

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
  await expect(page.getByRole("heading", { name: "Parallax", level: 1 })).toBeVisible();
  const canvas = page.locator('[data-renderer="READY"] canvas');
  await expect(canvas).toBeVisible();
  const renderer = await canvas.elementHandle();
  await expect(page.getByLabel("Workspace layout", { exact: true })).toHaveValue("SPATIAL");
  await expect(page.getByRole("complementary", { name: "Spatial Library" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand bottom dock" })).toBeVisible();
  const root = `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation`;
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/default-spatial-editing.png`, fullPage: true });
  const defaultBounds = (await canvas.boundingBox())!;
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("CONSTRUCTION");
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  await library.getByRole("tab", { name: "Assets", exact: true }).click();
  await library.getByRole("searchbox").fill("Peeking Letter");
  const asset = library
    .getByRole("article")
    .filter({ has: page.getByRole("button", { name: "Inspect Peeking Letter", exact: true }) });
  await asset.dragTo(canvas, { targetPosition: { x: 250, y: 180 } });
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  await expect(inspector.getByRole("heading", { name: "Peeking Letter", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Scene graph" }).getByRole("button", { name: /^Peeking Letter parchment$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await library.getByRole("searchbox").fill("Letter");
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await expect(library.getByRole("searchbox")).toHaveValue("Letter");
  await page.getByLabel("Authoring mode").selectOption("ENGINEERING");
  await page.getByLabel("Position x", { exact: true }).fill("0.2");
  const editedX = await page.getByLabel("Position x", { exact: true }).inputValue();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("separator", { name: "Resize library panel" }).press("ArrowRight");
    await page.getByRole("separator", { name: "Resize inspector panel" }).press("ArrowLeft");
  }
  await expect(page.getByLabel("Position x", { exact: true })).toHaveValue(editedX);
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Library", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("button", { name: "Collapse Inspector", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open object properties", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await page.screenshot({ path: `${root}/construction-layout.png`, fullPage: true });
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("BEHAVIOR");
  await page.getByRole("button", { name: "Add spatial behavior", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Behavior 1 delay milliseconds").fill("1200");
  await page.getByRole("separator", { name: "Resize bottom dock" }).press("ArrowUp");
  await page.getByRole("separator", { name: "Resize bottom dock" }).press("ArrowUp");
  await page.screenshot({ path: `${root}/behavior-authoring.png`, fullPage: true });
  await page.getByRole("button", { name: "Collapse bottom dock" }).click();
  await saveCurrentWorkingDraft(page);
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
      await page.getByLabel("Workspace layout", { exact: true }).selectOption(layout);
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
  expect(focus.canvas.height).toBeGreaterThanOrEqual(defaultBounds.height);
  expect(focus.canvas.area).toBeGreaterThan(defaultBounds.width * defaultBounds.height);
  await writeFile(
    `${root}/viewport-measurements.json`,
    JSON.stringify({ artifactRoot: process.env.VALIDATION_ARTIFACTS, measures }, null, 2),
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("SPATIAL");
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  await page.screenshot({ path: `${root}/constrained-desktop-guided.png`, fullPage: true });
  await page.getByLabel("Authoring mode").selectOption("ENGINEERING");
  await page.screenshot({ path: `${root}/constrained-desktop-engineering.png`, fullPage: true });
  await canvas.focus();
  await page.keyboard.press("/");
  await expect(page.getByLabel("Describe your spatial idea")).toBeFocused();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  const prompt = assistant.getByLabel("Describe your spatial idea", { exact: true });
  await prompt.focus();
  await expect(prompt).toBeFocused();
  await prompt.fill("Place the selected letter on a table near the entrance");
  const { aiUsage } = await (await page.request.get("/api/studio/parallax")).json();
  const send = assistant.getByRole("button", { name: "Send idea", exact: true });
  if (aiUsage.enabled && aiUsage.remaining > 0) await expect(send).toBeEnabled();
  else {
    await expect(send).toBeDisabled();
    await expect(assistant).toContainText(
      aiUsage.enabled ? "Monthly allowance reached" : "Spatial Assistant is unavailable",
    );
  }
  await page.getByRole("button", { name: "Dock assistance" }).click();
  await page.getByRole("button", { name: "Float assistance" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Ask Parallax/ })).toBeFocused();
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("CONSTRUCTION");
  await page.goto(`/studio/parallax?definition=${saved.id}`);
  await expect(page.getByRole("heading", { name: "Parallax", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Workspace layout", { exact: true })).toHaveValue("CONSTRUCTION");
  expect(JSON.stringify((await listSpatialItems(account.id)).find((item) => item.id === saved.id)!.draft)).toBe(
    authoritative,
  );
  await page.getByRole("button", { name: "Reset Workspace Layout" }).click();
  await expect(page.getByLabel("Workspace layout", { exact: true })).toHaveValue("SPATIAL");
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
  if (process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1") throw new Error("Guarded unpaid Assistant fixture required");
  const account = await closureAccount("Synthetic Parallax workstation review");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  const source = createSpatialDraft(`workstation-${account.id}`);
  source.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  await saveSpatialDraft(account.id, source, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1680, height: 1050 });
  await page.goto(`/studio/parallax?definition=${source.content.definitionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Parallax" })).toBeVisible();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("CONSTRUCTION");
  await page.getByLabel("Authoring mode").selectOption("ENGINEERING");
  await addCurrentBuiltinAsset(page, "Peeking Letter");
  await page.getByLabel("Position x", { exact: true }).fill("-0.55");
  await page.getByLabel("Position y", { exact: true }).fill("0.18");
  await addCurrentBuiltinAsset(page, "Floating Compass");
  await page.getByLabel("Position x", { exact: true }).fill("0.8");
  await addCurrentBuiltinAsset(page, "Hidden Wall Message");
  await page.getByLabel("Position x", { exact: true }).fill("-1.2");
  await page.getByLabel("Position z", { exact: true }).fill("-1.4");
  await page.getByRole("button", { name: "Open scene settings", exact: true }).click();
  await page.getByLabel("Experience title").fill("The observatory / spatial sequence");
  await page.getByRole("button", { name: "Open object properties", exact: true }).click();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  await page
    .getByRole("region", { name: "Scene graph" })
    .getByRole("button", { name: /^Desk Map parchment$/ })
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
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("SPATIAL");
  await page.screenshot({
    path: `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation/desktop-primary.png`,
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
  await page.screenshot({
    path: `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation/plan-view.png`,
    fullPage: true,
  });
  await page.getByLabel("Camera perspective").selectOption("perspective");
  await page.getByRole("button", { name: "Toggle spatial overlays" }).click();
  await page.screenshot({
    path: `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation/surface-overlays.png`,
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
  await saveCurrentWorkingDraft(page);
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0];
  const storedBefore = JSON.stringify(saved.draft);
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  await assistant
    .getByLabel("Describe your spatial idea", { exact: true })
    .fill("Create a pirate map on a desk with a readable clue and a guided alternative.");
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  await expect(assistant.getByRole("heading", { name: "A pirate map for your desk", exact: true })).toBeVisible();
  await assistant.getByRole("button", { name: "Proposed scene", exact: true }).click();
  const proposedMap = page
    .getByRole("region", { name: "Spatial canvas", exact: true })
    .getByRole("button", { name: /^Pirate map\./ });
  await expect(proposedMap).toBeVisible();
  expect(JSON.stringify((await listSpatialItems(account.id)).find((i) => i.id === saved.id)!.draft)).toBe(storedBefore);
  await page.screenshot({
    path: `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation/proposal-preview.png`,
    fullPage: true,
  });
  await assistant.getByRole("button", { name: "Current scene", exact: true }).click();
  await expect(proposedMap).toHaveCount(0);
  expect(JSON.stringify((await listSpatialItems(account.id)).find((i) => i.id === saved.id)!.draft)).toBe(storedBefore);
  await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("FOCUS");
  await page.screenshot({
    path: `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation/immersive-viewport.png`,
    fullPage: true,
  });
  await page.getByLabel("Workspace layout", { exact: true }).selectOption("CONSTRUCTION");
  for (const mode of ["DETAILED", "ENGINEERING"]) {
    await page.getByLabel("Authoring mode").selectOption(mode);
    await page.screenshot({
      path: `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation/desktop-${mode}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  const desktopAxe = await new AxeBuilder({ page }).analyze();
  expect(desktopAxe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `artifacts/parallax-integration-browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/workstation/constrained-viewport.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobileAxe = await new AxeBuilder({ page }).analyze();
  expect(mobileAxe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
});
