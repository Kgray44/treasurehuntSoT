import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { saveSpatialDraft } from "../../src/parallax/library-service";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const evidence = `artifacts/sc00c/expanded-library/${process.env.SC00C_LIBRARY_SOURCE?.slice(0, 12) ?? "local"}`;

test("compact to expanded Library stages a surface placement and returns to the same content", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Expanded Library Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(randomUUID(), "Expanded Library journey");
  await saveSpatialDraft(account.id, scene, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  const compact = page.getByRole("region", { name: "Spatial content library", exact: true });
  await compact.getByRole("searchbox").fill("Writing desk");
  await expect(compact.getByRole("button", { name: "Inspect Writing desk" })).toBeVisible();
  await compact.getByRole("button", { name: "Expand Spatial Library" }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded Spatial Library" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("searchbox")).toHaveValue("Writing desk");
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeGreaterThan(1200);
  expect(bounds!.height).toBeGreaterThan(780);
  await dialog.getByRole("button", { name: "Inspect Writing desk" }).click();
  const details = dialog.getByRole("complementary", { name: "Writing desk details" });
  await expect(details).toContainText("Built-in");
  await expect(details.getByLabel(/3D preview of Writing desk/)).toBeVisible();
  expect(await dialog.locator("canvas").count()).toBeLessThanOrEqual(1);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/expanded-desktop.png`, fullPage: true });
  await details.getByRole("button", { name: "Place in Scene" }).click();
  await expect(dialog).toBeHidden();
  const placement = page.getByLabel("Place Writing desk in Scene");
  await expect(placement).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeDisabled();
  await page.screenshot({ path: `${evidence}/placement-preview.png`, fullPage: true });
  await placement.getByRole("button", { name: "Floor", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  await expect(placement).toBeHidden();
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue("Writing desk");
  await page.screenshot({ path: `${evidence}/placed-selected.png`, fullPage: true });
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog.getByRole("searchbox")).toHaveValue("Writing desk");
  await expect(dialog.getByRole("complementary", { name: "Writing desk details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand Spatial Library" })).toBeFocused();
});

test("expanded Library adapts to narrow and phone layouts, themes, reduced motion, and catalog errors", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  test.setTimeout(180000);
  const account = await closureAccount("Synthetic SC-00C Expanded Library Layout Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(randomUUID(), "Expanded Library layout journey");
  await saveSpatialDraft(account.id, scene, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded Spatial Library" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const searchBounds = await dialog.getByRole("searchbox").boundingBox();
  const firstCardBounds = await dialog.getByRole("article").first().boundingBox();
  const sourceBounds = await dialog.getByLabel("Source", { exact: true }).boundingBox();
  expect(sourceBounds!.y).toBeLessThan(firstCardBounds!.y);
  expect(firstCardBounds!.y - searchBounds!.y).toBeLessThan(190);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/expanded-narrow.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.evaluate(() => {
    document.documentElement.dataset.voyageTheme = "light";
  });
  await page.screenshot({ path: `${evidence}/expanded-light-reduced.png`, fullPage: true });
  await page.getByRole("button", { name: "Close expanded Spatial Library" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const openLibrary = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await openLibrary.getAttribute("aria-pressed")) !== "true") await openLibrary.click();
  await page.getByRole("button", { name: "Expand Spatial Library" }).click();
  await expect(dialog).toBeVisible();
  const phone = await dialog.boundingBox();
  expect(phone!.width).toBeGreaterThanOrEqual(389);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(dialog.getByLabel("Library item details")).toBeHidden();
  await page.screenshot({ path: `${evidence}/expanded-phone.png`, fullPage: true });
  await dialog.getByRole("button", { name: "Inspect Antique book" }).click();
  await expect(dialog.getByRole("complementary", { name: "Antique book details" })).toBeVisible();
  await page.screenshot({ path: `${evidence}/expanded-phone-selected.png`, fullPage: true });
  await page.route("**/api/studio/parallax?*view=library-catalog*", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await dialog.getByRole("searchbox").fill("temporary error");
  await expect(dialog.getByRole("alert")).toContainText("Library results could not load");
  await page.unroute("**/api/studio/parallax?*view=library-catalog*");
  await dialog.getByRole("button", { name: "Refresh results" }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
