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
    await library.getByRole("textbox", { name: "Search Library", exact: true }).fill(name);
    await library.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
    await library.getByRole("button", { name: "Add to Scene", exact: true }).click();
  };
  await add("Assets", "Treasure chest");
  await expect(page.getByRole("region", { name: "Spatial element properties" })).toContainText("PHYSICAL ASSET");
  await expect
    .poll(async () => JSON.parse((await renderer.getAttribute("data-performance"))!).triangles)
    .toBeGreaterThan(0);
  await page.screenshot({ path: `${evidence}/combined-chest-desktop.png`, fullPage: true });
  await add("Effects", "Point light");
  await page.getByRole("spinbutton", { name: "Light intensity", exact: true }).fill("35");
  await expect(page.getByRole("spinbutton", { name: "Light intensity", exact: true })).toHaveValue("35");
  await add("Compositions", "Ghostly Presence");
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
  await library.getByRole("textbox", { name: "Search Library", exact: true }).fill("Ghostly Presence");
  await library.getByRole("combobox", { name: "Source", exact: true }).selectOption("MY_CREATIONS");
  await library.getByRole("button", { name: "Inspect Ghostly Presence", exact: true }).click();
  await library.getByRole("button", { name: "Add saved composition", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
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
  await page.screenshot({ path: `${evidence}/combined-library-phone.png`, fullPage: true });
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await canvas.locator("summary").filter({ hasText: "View & audio" }).click();
  await expect(page.getByRole("button", { name: "Frame scene", exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/combined-view-controls-phone.png`, fullPage: true });
  await writeFile(
    `${evidence}/combined-element-observations.json`,
    JSON.stringify({ errors, synthetic: true, physicalAcceptance: false }, null, 2),
  );
  expect(errors).toEqual([]);
});
