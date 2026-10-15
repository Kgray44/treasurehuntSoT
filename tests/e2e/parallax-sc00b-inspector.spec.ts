import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";

test.describe.configure({ mode: "serial", timeout: 240000 });
test.afterAll(() => db.$disconnect());

test("SC-00B preserves editing across contextual views, three depths, grouping, and empty selection", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC-00B Inspector Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/studio/parallax");
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  const output = "artifacts/parallax-sc00b-inspector";
  await mkdir(output, { recursive: true });
  const captures: string[] = [];
  const capture = async (name: string) => {
    const path = `${output}/${name}.png`;
    await page.screenshot({ path, fullPage: true });
    captures.push(path);
  };
  const selectObject = async (name: string) => {
    await page.getByRole("button", { name: "Open scene settings" }).click();
    await page.getByRole("region", { name: "Scene overview" }).getByRole("button", { name, exact: true }).click();
    await expect(inspector.getByText(name, { exact: true })).toBeVisible();
  };
  const captureDepths = async (name: string, slug: string) => {
    await selectObject(name);
    for (const [mode, label] of [
      ["GUIDED", "guided"],
      ["DETAILED", "standard"],
      ["ENGINEERING", "engineering"],
    ] as const) {
      await page.getByLabel("Authoring mode").selectOption(mode);
      await expect(inspector.getByLabel("Object name")).toBeVisible();
      if (mode === "ENGINEERING") {
        await expect(inspector.getByLabel("Position x")).toBeVisible();
        await inspector.getByRole("button", { name: "Precision controls" }).click();
        await expect(inspector.getByRole("heading", { name: "Exact transform & anchor" })).toBeInViewport();
      } else await expect(inspector.getByText("Exact transform & anchor", { exact: true })).toBeHidden();
      await capture(`${slug}-${label}`);
      if (mode === "ENGINEERING") await inspector.evaluate((element) => (element.scrollTop = 0));
    }
  };

  await captureDepths("Desk Map", "parchment");
  await page.getByRole("button", { name: "Open asset Library" }).click();
  const assets = page.getByRole("region", { name: "Spatial asset browser" });
  await assets.getByRole("button", { name: "Floating Compass", exact: false }).click();
  await assets.getByRole("button", { name: "Hidden Wall Message", exact: false }).click();
  await captureDepths("Floating Compass", "marker");
  await captureDepths("Hidden Wall Message", "text");

  await page.getByRole("button", { name: "Open spatial context" }).click();
  await expect(inspector.getByRole("heading", { name: "Placement & relationships" })).toBeVisible();
  await capture("text-spatial-context");
  await page.getByRole("button", { name: "Open object properties" }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await selectObject("Hidden Wall Message copy");
  await page.getByRole("button", { name: "Open spatial context" }).click();
  await page.getByLabel("Group / parent").selectOption({ label: "Hidden Wall Message" });
  await expect(page.getByLabel("Group / parent")).not.toHaveValue("");
  await page.getByRole("button", { name: "Edit selected object timeline" }).click();
  await expect(page.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();
  await capture("group-and-timeline");

  await page.getByRole("button", { name: "Open object properties" }).click();
  await page.getByLabel("Object width in meters").fill("0.35");
  await page.getByLabel("Object width in meters").blur();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Working draft saved");
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByRole("region", { name: "Scene overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open spatial context" })).toBeDisabled();
  await capture("empty-selection");
  await selectObject("Hidden Wall Message copy");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "Selection unavailable" })).toBeVisible();
  await expect(inspector.getByRole("region", { name: "Unavailable selection" })).toBeVisible();
  await capture("invalid-selection");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(inspector.getByRole("heading", { name: "Properties" })).toBeVisible();
  await expect(inspector.getByLabel("Object width in meters")).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(inspector.getByRole("heading", { name: "Selection unavailable" })).toBeVisible();
  await inspector.getByRole("region", { name: "Unavailable selection" }).getByRole("button", { name: "Open scene settings" }).click();
  await expect(inspector.getByRole("region", { name: "Scene overview" })).toBeVisible();
  await page.getByRole("button", { name: "Open scene settings" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Open scene settings" })).toHaveAttribute("aria-pressed", "true");

  const loaded = await (await page.request.get("/api/studio/parallax")).json();
  const preferences = await (await page.request.get("/api/passport/preferences")).json();
  const response = await page.request.put("/api/passport/preferences", {
    headers: { "x-csrf-token": loaded.csrfToken },
    data: {
      preferences: {
        ...preferences.preferences,
        experience: { ...preferences.preferences.experience, theme: "LIGHT", motion: "REDUCED" },
      },
    },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await page.getByRole("button", { name: "Open scene settings" }).click();
  await capture("light-scene-settings-reduced-motion");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open scene settings" }).click();
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole("heading", { name: "Scene settings" })).toBeVisible();
  expect((await inspector.boundingBox())?.width).toBeGreaterThan(250);
  await expect(inspector.getByLabel("When AR is unavailable")).toBeVisible();
  await capture("light-mobile-scene-settings");
  const propertiesRail = page.getByRole("button", { name: "Open object properties" });
  let railFocused = await propertiesRail.evaluate((element) => element === document.activeElement);
  for (let attempt = 0; attempt < 128 && !railFocused; attempt++) {
    await page.keyboard.press("Tab");
    railFocused = await propertiesRail.evaluate((element) => element === document.activeElement);
  }
  expect(railFocused).toBe(true);
  await propertiesRail.press("Enter");
  await expect(inspector.getByRole("button", { name: "Frame", exact: true })).toBeInViewport();
  const contextRail = page.getByRole("button", { name: "Open spatial context" });
  await page.keyboard.press("Tab");
  expect(await contextRail.evaluate((element) => element === document.activeElement)).toBe(true);
  await contextRail.press("Enter");
  await expect(inspector.getByRole("button", { name: "Frame", exact: true })).toBeInViewport();
  const sceneRail = page.getByRole("button", { name: "Open scene settings" });
  await page.keyboard.press("Tab");
  expect(await sceneRail.evaluate((element) => element === document.activeElement)).toBe(true);
  await sceneRail.press("Enter");
  await expect(inspector.getByText("Spatial scene", { exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('[aria-label="Spatial inspector"]').analyze();
  expect(
    accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")),
  ).toEqual([]);
  await writeFile(
    `${output}/browser-observations.json`,
    JSON.stringify(
      {
        captures,
        selectionTypes: ["PARCHMENT", "MARKER", "TEXT", "GROUP_RELATION", "SCENE", "EMPTY", "INVALID"],
        depths: ["GUIDED", "DETAILED", "ENGINEERING"],
        accessibility: "NO_SERIOUS_OR_CRITICAL",
      },
      null,
      2,
    ),
  );
});

test("SC-00B keeps mobile rail identity visible after keyboard travel and accessibility inspection", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic SC-00B Rail Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio" }).click();
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  const rail = async (name: string) => {
    const target = page.getByRole("button", { name });
    let focused = await target.evaluate((element) => element === document.activeElement);
    for (let attempt = 0; attempt < 128 && !focused; attempt++) {
      await page.keyboard.press("Tab");
      focused = await target.evaluate((element) => element === document.activeElement);
    }
    expect(focused).toBe(true);
    await target.press("Enter");
  };
  await rail("Open scene settings");
  await expect(inspector.getByRole("heading", { name: "Scene settings" })).toBeVisible();
  await new AxeBuilder({ page }).analyze();
  await expect(inspector.getByText("Spatial scene", { exact: true })).toBeInViewport();
  await rail("Open object properties");
  await expect(inspector.getByRole("heading", { name: "Properties" })).toBeVisible();
  await new AxeBuilder({ page }).analyze();
  await expect(inspector.getByRole("button", { name: "Frame", exact: true })).toBeInViewport();
  await rail("Open spatial context");
  await expect(inspector.getByRole("heading", { name: "Spatial context" })).toBeVisible();
  await new AxeBuilder({ page }).analyze();
  await page.screenshot({ path: "artifacts/parallax-sc00b-inspector/mobile-normal-keyboard-context.png" });
  await expect(inspector.getByRole("button", { name: "Frame", exact: true })).toBeInViewport();
  await rail("Open scene settings");
  await new AxeBuilder({ page }).analyze();
  await expect(inspector.getByText("Spatial scene", { exact: true })).toBeInViewport();
});
