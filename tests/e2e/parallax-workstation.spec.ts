import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { listSpatialItems } from "../../src/parallax/library-service";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: { mode: "on", size: { width: 1280, height: 800 } } });
test.afterAll(() => db.$disconnect());
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
  await page.getByLabel("Experience title").fill("The observatory / spatial sequence");
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
  await expect(page.getByLabel("Position x", { exact: true })).toHaveValue(originalX);
  await page.getByRole("button", { name: "Add spatial behavior", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Behavior 1 delay milliseconds").fill("2000");
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  await page.getByRole("button", { name: "Rotate tool", exact: true }).click();
  await page.screenshot({ path: "artifacts/parallax-phase3/workstation/desktop-primary.png", fullPage: true });
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
  await page.screenshot({ path: "artifacts/parallax-phase3/workstation/plan-view.png", fullPage: true });
  await page.getByLabel("Camera perspective").selectOption("perspective");
  await page.getByRole("button", { name: "Toggle spatial overlays" }).click();
  await page.screenshot({ path: "artifacts/parallax-phase3/workstation/surface-overlays.png", fullPage: true });
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause timeline", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Behavior timeline" })).not.toContainText("0.0 / 60.0 s");
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByRole("button", { name: "Reset simulation", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Preview", { exact: true }).selectOption("EDITOR");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  const saved = (await listSpatialItems(account.id))[0];
  const storedBefore = JSON.stringify(saved.draft);
  await page.getByLabel("Spatial placement instruction").fill("Place the map on a table near the entrance");
  await page.getByRole("button", { name: "Preview placement", exact: true }).click();
  await expect(page.getByRole("region", { name: "Contextual spatial assistance" })).toContainText("draft unchanged");
  expect(JSON.stringify((await listSpatialItems(account.id)).find((i) => i.id === saved.id)!.draft)).toBe(storedBefore);
  await page.screenshot({ path: "artifacts/parallax-phase3/workstation/proposal-preview.png", fullPage: true });
  await page.getByRole("button", { name: "Discard preview", exact: true }).click();
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await page.getByRole("button", { name: "Library & hierarchy", exact: true }).click();
  await page.screenshot({ path: "artifacts/parallax-phase3/workstation/immersive-viewport.png", fullPage: true });
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await page.getByRole("button", { name: "Library & hierarchy", exact: true }).click();
  for (const mode of ["DETAILED", "ENGINEERING"]) {
    await page.getByLabel("Authoring mode").selectOption(mode);
    await page.screenshot({ path: `artifacts/parallax-phase3/workstation/desktop-${mode}.png`, fullPage: true });
  }
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  const desktopAxe = await new AxeBuilder({ page }).analyze();
  expect(desktopAxe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/parallax-phase3/workstation/constrained-viewport.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobileAxe = await new AxeBuilder({ page }).analyze();
  expect(mobileAxe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
});
