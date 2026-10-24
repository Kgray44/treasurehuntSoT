import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { listSpatialItems } from "../../src/parallax/library-service";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("combined Library places typed elements, saves and independently reuses a composition with rendered playback", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic Combined Element Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const evidence = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Parallax", level: 1 })).toBeVisible();
  await page.getByRole("combobox", { name: "Workspace layout", exact: true }).selectOption("CONSTRUCTION");
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const renderer = canvas.locator("[data-performance]");
  await expect(renderer.locator("canvas")).toBeVisible();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  const add = async (kind: string, name: string) => {
    const open = page.getByRole("button", { name: "Open Library", exact: true });
    if (!(await library.isVisible())) await open.click();
    await library.getByRole("tab", { name: kind, exact: true }).click();
    await library.getByRole("searchbox").fill(name);
    await library.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
    await library.getByRole("button", { name: "Add to active Scene", exact: true }).click();
  };
  await add("Assets", "Treasure chest");
  await expect(page.getByRole("region", { name: "Spatial element properties" })).toContainText("PHYSICAL ASSET");
  await expect
    .poll(async () => JSON.parse((await renderer.getAttribute("data-performance"))!).triangles)
    .toBeGreaterThan(0);
  await page.screenshot({ path: `${evidence}/combined-chest-desktop.png`, fullPage: true });
  await add("Effects", "Point light");
  await page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true }).fill("35");
  await page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true }).blur();
  await expect(page.getByRole("spinbutton", { name: "Light intensity numeric value", exact: true })).toHaveValue("35");
  await add("Compositions", "Ghostly Presence");
  await page.getByRole("button", { name: "Open spatial context", exact: true }).click();
  await page.getByRole("button", { name: "Save selected composition", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await listSpatialItems(account.id)).filter(
          (item) => item.draft.tags.includes("composition") && item.saveState === "SAVED",
        ).length,
    )
    .toBe(1);
  await library.getByRole("tab", { name: "Compositions", exact: true }).click();
  await library.getByRole("searchbox").fill("Ghostly Presence");
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await expect(library.getByRole("button", { name: "Inspect Ghostly Presence", exact: true })).toHaveCount(1);
  await library.getByRole("button", { name: "Inspect Ghostly Presence", exact: true }).click();
  await library.getByRole("button", { name: "Add saved composition", exact: true }).click();
  await expect(page.getByRole("region", { name: "Inspector context" })).toContainText("Ghostly Presence");
  await expect
    .poll(async () => {
      const id = new URL(page.url()).searchParams.get("definition");
      return (await listSpatialItems(account.id))
        .find((item) => item.id === id)
        ?.draft.content.entities.filter((entity) => entity.name === "Ghostly Presence").length;
    })
    .toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => {
      const id = new URL(page.url()).searchParams.get("definition");
      return (await listSpatialItems(account.id))
        .find((item) => item.id === id)
        ?.draft.content.entities.filter((entity) => entity.name === "Ghostly Presence").length;
    })
    .toBe(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => {
      const id = new URL(page.url()).searchParams.get("definition");
      return (await listSpatialItems(account.id))
        .find((item) => item.id === id)
        ?.draft.content.entities.filter((entity) => entity.name === "Ghostly Presence").length;
    })
    .toBe(2);
  await page.reload();
  await expect(renderer.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Enable preview audio", exact: true }).click();
  await page.getByRole("button", { name: "Play timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await renderer.getAttribute("data-performance"))!).audioVoices).toBe(2);
  await page.waitForTimeout(2200); // Observe the authored fade, not just initial insertion.
  await page.screenshot({ path: `${evidence}/combined-composition-playing.png`, fullPage: true });
  await page.getByRole("button", { name: "Pause timeline", exact: true }).click();
  await expect.poll(async () => JSON.parse((await renderer.getAttribute("data-performance"))!).audioVoices).toBe(0);
  await page.getByRole("button", { name: "Disable preview audio", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await library.getByRole("tab", { name: "Assets", exact: true }).click();
  await expect(library.getByRole("button", { name: /Filters & view/ })).toHaveAttribute("aria-expanded", "false");
  await library.getByRole("heading", { name: "Spatial content", exact: true }).click();
  await page.screenshot({ path: `${evidence}/combined-library-phone.png`, fullPage: true });
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await canvas.locator("summary").filter({ hasText: "View & audio" }).click();
  const camera = page.getByRole("combobox", { name: "Camera perspective", exact: true });
  await expect(camera).toBeInViewport();
  await camera.click(); // Actionability also verifies the toolbar does not cover the first menu row.
  await camera.press("Escape");
  await camera.selectOption("plan");
  await camera.selectOption("perspective");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Frame scene", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Frame scene", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Frame scene", exact: true }).click();
  await page.screenshot({ path: `${evidence}/combined-view-controls-phone.png`, fullPage: true });
  await writeFile(
    `${evidence}/combined-element-observations.json`,
    JSON.stringify({ errors, synthetic: true, physicalAcceptance: false }, null, 2),
  );
  expect(errors).toEqual([]);
});

test("physical Library insertion uses Bedroom supports, preserves Undo and refuses an occupied room", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic Room Placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const evidence = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("combobox", { name: "Workspace layout", exact: true }).selectOption("CONSTRUCTION");
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  await expect(canvas.locator("[data-performance] canvas")).toBeVisible();
  const library = page.getByRole("region", { name: "Spatial content library", exact: true });
  const saved = async () => {
    const id = new URL(page.url()).searchParams.get("definition");
    return (await listSpatialItems(account.id)).find((item) => item.id === id);
  };
  await expect.poll(async () => Boolean(await saved())).toBe(true);
  const baseline = (await saved())!.draft.content.entities.length;
  const add = async (name: string) => {
    await library.getByRole("tab", { name: "Assets", exact: true }).click();
    await library.getByRole("searchbox").fill(name);
    await library.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
    await library.getByRole("button", { name: "Add to active Scene", exact: true }).click();
  };
  await add("Treasure chest");
  await expect.poll(async () => (await saved())?.draft.content.entities.length).toBe(baseline + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved())?.draft.content.entities.length).toBe(baseline);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await saved())?.draft.content.entities.length).toBe(baseline + 1);
  await add("Lantern");
  await expect.poll(async () => (await saved())?.draft.content.entities.length).toBe(baseline + 2);
  await add("Framed painting");
  await expect.poll(async () => (await saved())?.draft.content.entities.length).toBe(baseline + 3);
  await page.getByRole("button", { name: "Frame scene", exact: true }).click();
  await page.screenshot({ path: `${evidence}/room-aware-floor-table-wall.png`, fullPage: true });
  const beforeReload = (await saved())!.draft.content.entities;
  await page.reload();
  await expect(canvas.locator("[data-performance] canvas")).toBeVisible();
  expect((await saved())!.draft.content.entities).toEqual(beforeReload);
  let refused = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const before = (await saved())!;
    await add("Wardrobe");
    const noFit = page.getByRole("alert").filter({ hasText: /No clear .*No item was inserted/ });
    await expect
      .poll(
        async () =>
          (await noFit.isVisible()) ||
          (await saved())!.draft.content.entities.length > before.draft.content.entities.length,
      )
      .toBe(true);
    if (await noFit.isVisible()) {
      expect((await saved())!.draft.content).toEqual(before.draft.content);

      await expect(noFit.getByRole("button", { name: "Retry save", exact: true })).toHaveCount(0);
      await expect(noFit.getByRole("button", { name: "Review saved revision", exact: true })).toHaveCount(0);
      await expect(noFit.getByRole("button", { name: "Edit room layout", exact: true })).toBeEnabled();
      await page.screenshot({ path: `${evidence}/room-aware-no-fit-recovery.png`, fullPage: true });
      await noFit.getByRole("button", { name: "Edit room layout", exact: true }).click();
      await expect(noFit).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
      expect((await saved())!.draft.content.entities).toEqual(before.draft.content.entities);
      await page.screenshot({ path: `${evidence}/room-aware-no-fit-room-recovery.png`, fullPage: true });
      refused = true;
      break;
    }
  }
  expect(refused).toBe(true);
  expect(errors).toEqual([]);
});
