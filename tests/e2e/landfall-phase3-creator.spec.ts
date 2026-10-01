import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { compactSiteFixture } from "../../src/landfall/compact-fixtures";
import { createLandfallWaypoint, createLandfallWorldspace } from "../../src/landfall/authoring";
import type { LandfallDefinition } from "../../src/landfall/schema";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import {
  auditNativeGeolocation,
  authenticateClosure,
  closureAccount,
  geoAudit,
  type ClosureAccount,
} from "./fixtures/landfall-closure";

let owner: ClosureAccount;
test.describe.configure({ timeout: 150_000 });
test.use({ actionTimeout: 15_000 });
test.skip(({ browserName }) => browserName !== "chromium", "Synthetic mutable Creator fixtures run once.");
test.beforeAll(async () => {
  ensureGenericSoundingLineIsolation();
  owner = await closureAccount("Synthetic Phase 3 Creator");
});
test.afterAll(async () => db.$disconnect());

async function draftFixture() {
  const tale = await db.chronicle.create({
    data: {
      slug: `landfall-phase3-creator-${randomUUID()}`,
      title: "Synthetic Phase 3 Creator museum",
      creatorId: owner.profileId,
      creatorAccountId: owner.id,
      status: "DRAFT",
      visibility: "PRIVATE",
    },
  });
  const definition = compactSiteFixture("MUSEUM");
  definition.taleId = tale.id;
  // Upload the real synthetic references through ordinary Studio controls below.
  definition.context!.landmarks = [];
  for (const waypoint of definition.waypoints) delete waypoint.landmarkId;
  const draft = await db.taleDraft.create({
    data: {
      taleId: tale.id,
      createdBy: owner.profileId,
      createdByAccountId: owner.id,
      landfallDefinition: JSON.stringify(definition),
    },
  });
  return { tale, draft };
}
async function stored(taleId: string) {
  const draft = await db.taleDraft.findFirstOrThrow({ where: { taleId }, orderBy: { revisionNumber: "desc" } });
  return { ...draft, definition: JSON.parse(draft.landfallDefinition!) as LandfallDefinition };
}
async function open(page: Page, taleId: string) {
  await page.goto(`/studio/tales/${taleId}/landfall`);
  await expect(page.getByRole("region", { name: "Landfall authoring workspace" })).toBeVisible({ timeout: 45_000 });
}
async function image(name: string, background: string) {
  const drawing = name.includes("floor")
    ? '<rect x="25" y="25" width="350" height="250" fill="none" stroke="white" stroke-width="6"/><path d="M25 145H375M190 25V145M300 145V275" fill="none" stroke="white" stroke-width="4"/>'
    : name.includes("positive")
      ? '<path d="M200 40L340 250H60Z" fill="white"/>'
      : '<circle cx="200" cy="150" r="105" fill="white"/>';
  const buffer = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${background}"/>${drawing}</svg>`,
    ),
  )
    .png()
    .toBuffer();
  return { name: `${name}.png`, mimeType: "image/png", buffer };
}

test("virtual Creator configures a Watchglass landmark and versioned independent evidence policy without physical acquisition", async ({
  browser,
  baseURL,
}, testInfo) => {
  const tale = await db.chronicle.create({
    data: {
      slug: `landfall-v11-creator-${randomUUID()}`,
      title: "Synthetic v1.1 island",
      creatorId: owner.profileId,
      creatorAccountId: owner.id,
      status: "DRAFT",
      visibility: "PRIVATE",
    },
  });
  const definition = createLandfallWorldspace({ taleId: tale.id, name: "Synthetic island", kind: "VIRTUAL" });
  const waypoint = createLandfallWaypoint(
    definition.worldspaces[0],
    definition.maps[0],
    definition.maps[0].camera.center,
    "Synthetic arch",
  );
  waypoint.regionId = "synthetic-island-region";
  definition.waypoints = [waypoint];
  definition.context = {
    regions: [
      {
        id: waypoint.regionId,
        worldspaceId: waypoint.worldspaceId,
        mapId: waypoint.mapId,
        name: "Synthetic island region",
        kind: "SITE",
        geometry: { type: "POINT_RADIUS", center: definition.maps[0].camera.center, radius: 100 },
        hiddenUntilRevealed: false,
        privacyClassification: "FICTIONAL",
      },
    ],
    landmarks: [],
  };
  await db.taleDraft.create({
    data: {
      taleId: tale.id,
      createdBy: owner.profileId,
      createdByAccountId: owner.id,
      landfallDefinition: JSON.stringify(definition),
    },
  });
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  await authenticateClosure(context, owner, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await page.goto(`/studio/tales/${tale.id}/assets`);
  await page.getByRole("button", { name: "Upload media", exact: true }).click();
  await page
    .getByRole("complementary", { name: "Asset drawer" })
    .locator('input[type="file"]')
    .setInputFiles(await image("synthetic-virtual-positive", "#305060"));
  await expect
    .poll(
      async () =>
        (await db.taleAsset.findMany({ where: { taleId: tale.id }, include: { variants: true } })).filter((item) =>
          item.variants.some((variant) => variant.processingState === "READY"),
        ).length,
    )
    .toBe(1);
  const reference = await db.taleAsset.findFirstOrThrow({ where: { taleId: tale.id } });
  await open(page, tale.id);
  const workspace = page.getByRole("region", { name: "Landfall authoring workspace" });
  await workspace
    .locator(".landfall-object-list")
    .getByRole("button", { name: /Synthetic arch/ })
    .click();
  const editor = workspace.getByRole("region", { name: "Floors, regions and landmarks" });
  await expect(editor).toContainText("configured certified Watchglass provider");
  await editor.getByLabel("First positive reference", { exact: true }).selectOption(reference.id);
  await editor.getByRole("button", { name: "Add natural landmark" }).click();
  await workspace.getByLabel("Independent evidence sources", { exact: true }).selectOption("2");
  await expect
    .poll(async () => (await stored(tale.id)).definition.waypoints[0].evidenceProfile.fusionPolicy)
    .toEqual({ version: 1, minimumIndependentSources: 2 });
  const authored = (await stored(tale.id)).definition;
  expect(authored.waypoints[0].evidenceProfile.acceptedSources).toContain("WATCHGLASS");
  expect(authored.waypoints[0].evidenceProfile.acceptedSources).not.toContain("VISION_WAYPOINT");
  expect(authored.context?.landmarks[0].fallback).toEqual({ mode: "PLAYER" });
  expect(authored.worldspaces[0].observationPolicy.allowedSources).toContain("WATCHGLASS");
  await page.reload();
  await workspace
    .locator(".landfall-object-list")
    .getByRole("button", { name: /Synthetic arch/ })
    .click();
  await expect(workspace.getByLabel("Independent evidence sources", { exact: true })).toHaveValue("2");
  expect((await geoAudit(page)).calls).toBe(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[aria-label="Landfall authoring workspace"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const capture = testInfo.outputPath("virtual-creator-policy.png");
  await page.screenshot({ path: capture, fullPage: false });
  await testInfo.attach("virtual-creator-policy", { path: capture, contentType: "image/png" });
  await context.close();
});

test("Creator uploads and aligns a floor, draws regions, configures natural references and saves a sanitized field receipt", async ({
  browser,
  baseURL,
}, testInfo) => {
  const fixture = await draftFixture();
  const context = await browser.newContext({
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: { latitude: 44, longitude: -72, accuracy: 5 },
  });
  await authenticateClosure(context, owner, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await page.goto(`/studio/tales/${fixture.tale.id}/assets`);
  await page.getByRole("button", { name: "Upload media", exact: true }).click();
  const upload = page.getByRole("complementary", { name: "Asset drawer" }).locator('input[type="file"]');
  await expect(upload).toBeAttached({ timeout: 45_000 });
  await upload.setInputFiles(
    await Promise.all([
      image("synthetic-floor-plan", "#24465a"),
      image("synthetic-mural-positive", "#cda646"),
      image("synthetic-mural-negative", "#874244"),
    ]),
  );
  await expect
    .poll(
      async () =>
        (await db.taleAsset.findMany({ where: { taleId: fixture.tale.id }, include: { variants: true } })).filter(
          (asset) => asset.variants.some((variant) => variant.processingState === "READY"),
        ).length,
    )
    .toBe(3);
  const assets = await db.taleAsset.findMany({ where: { taleId: fixture.tale.id } });
  const floorImage = assets.find((asset) => asset.displayName === "synthetic-floor-plan")!;
  const positive = assets.find((asset) => asset.displayName === "synthetic-mural-positive")!;
  const negative = assets.find((asset) => asset.displayName === "synthetic-mural-negative")!;
  await open(page, fixture.tale.id);
  const workspace = page.getByRole("region", { name: "Landfall authoring workspace" });
  const editor = workspace.getByRole("region", { name: "Floors, regions and landmarks" });
  await editor.getByLabel("Floor label", { exact: true }).fill("Synthetic mezzanine");
  await editor.getByRole("button", { name: "Add floor chart" }).click();
  const overlay = workspace.getByRole("group", { name: "Georeferenced image overlays" });
  await overlay.getByRole("combobox", { name: "Image", exact: true }).selectOption(floorImage.id);
  for (const [edge, value] of Object.entries({ west: -72.0005, east: -71.9995, south: 43.9995, north: 44.0005 }))
    await overlay.getByLabel(edge, { exact: true }).fill(String(value));
  await overlay.getByLabel("Image credit", { exact: true }).fill("Synthetic test floor drawing");
  await overlay.getByLabel("Credit URL", { exact: true }).fill("https://example.invalid/synthetic-floor");
  await overlay.getByRole("button", { name: "Add image overlay" }).click();
  await editor.getByLabel("Region name", { exact: true }).fill("Synthetic mezzanine gallery");
  await editor.getByRole("combobox", { name: "Region kind", exact: true }).selectOption("GALLERY");
  await editor.getByRole("button", { name: "Add region", exact: true }).click();
  const region = editor.getByRole("group", { name: "Synthetic mezzanine gallery", exact: true });
  await region.getByRole("combobox", { name: "Parent region", exact: true }).selectOption("compact-building");
  await region.getByRole("button", { name: "Draw region boundary" }).focus();
  await page.keyboard.press("Enter");
  for (const [longitude, latitude] of [
    [-72.0003, 43.9998],
    [-71.9997, 43.9998],
    [-72, 44.0003],
  ]) {
    await workspace.getByLabel("Longitude", { exact: true }).fill(String(longitude));
    await workspace.getByLabel("Latitude", { exact: true }).fill(String(latitude));
    await workspace.getByRole("button", { name: "Add region point at coordinates" }).focus();
    await page.keyboard.press("Enter");
  }
  await workspace.getByRole("button", { name: "Finish shape" }).focus();
  await page.keyboard.press("Enter");
  await workspace.getByLabel("Longitude", { exact: true }).fill("-72");
  await workspace.getByLabel("Latitude", { exact: true }).fill("44");
  await workspace.getByRole("button", { name: "Place at coordinates" }).click();
  await editor
    .getByRole("combobox", { name: "Context region", exact: true })
    .selectOption({ label: "Synthetic mezzanine gallery" });
  await editor.getByRole("combobox", { name: "First positive reference", exact: true }).selectOption(positive.id);
  await editor.getByRole("button", { name: "Add natural landmark" }).click();
  const landmark = editor.getByRole("group", { name: /^Natural landmark ·/u });
  await landmark
    .getByRole("textbox", { name: "Guidance", exact: true })
    .fill("Synthetic mural: compare its triangular form; ask the Captain if recognition is unavailable.");
  await landmark
    .getByRole("group", { name: "Similar things to exclude (up to 8)" })
    .getByLabel("synthetic-mural-negative", { exact: true })
    .check();
  await landmark.getByLabel("Consistent frames needed", { exact: true }).fill("3");
  await landmark.getByRole("combobox", { name: "Landmark fallback", exact: true }).selectOption("CAPTAIN");
  await expect
    .poll(async () => (await stored(fixture.tale.id)).definition.context?.landmarks[0])
    .toMatchObject({
      referenceAssetIds: [positive.id],
      negativeReferenceAssetIds: [negative.id],
      minimumFrames: 3,
      fallback: { mode: "CAPTAIN" },
    });
  const authored = await stored(fixture.tale.id);
  const authoredFloor = authored.definition.maps.find((map) => map.level === "Synthetic mezzanine")!;
  expect(authoredFloor.overlays?.[0]).toMatchObject({
    assetId: floorImage.id,
    bounds: { west: -72.0005, east: -71.9995, south: 43.9995, north: 44.0005 },
  });
  const authoredRegion = authored.definition.context!.regions.find(
    (item) => item.name === "Synthetic mezzanine gallery",
  )!;
  expect(authoredRegion).toMatchObject({
    kind: "GALLERY",
    parentId: "compact-building",
    mapId: authoredFloor.id,
    level: "Synthetic mezzanine",
    geometry: { type: "POLYGON" },
  });
  expect(authored.definition.context!.landmarks[0]).toMatchObject({
    referenceAssetIds: [positive.id],
    negativeReferenceAssetIds: [negative.id],
    minimumFrames: 3,
    fallback: { mode: "CAPTAIN" },
  });
  const field = workspace.getByRole("region", { name: "Creator field test" });
  await expect(field.getByRole("button", { name: "Start test walk" })).toBeEnabled();
  expect((await geoAudit(page)).calls).toBe(0);
  await field.getByLabel("Allow optional foreground heading and motion hints for this test").check();
  await field.getByRole("button", { name: "Start test walk" }).click();
  await expect.poll(async () => (await geoAudit(page)).nativeSamples).toBeGreaterThan(0);
  await expect(field).toContainText("granted; elevation unavailable");
  // A synthetic browser event exercises the production foreground provider, not hardware motion.
  await page.evaluate(() => {
    const event = new Event("devicemotion");
    Object.defineProperty(event, "acceleration", { value: { x: 1, y: 0, z: 0 } });
    window.dispatchEvent(event);
  });
  await expect(field.getByText(/position, motion|motion, position/u)).toBeVisible();
  await field.getByRole("button", { name: "Save walk receipt" }).click();
  await expect(field.getByText(/Sanitized .* receipt saved/u)).toBeVisible();
  expect((await geoAudit(page)).active).toHaveLength(0);
  const receipts = await db.landfallFieldTestReceipt.findMany({ where: { draftId: fixture.draft.id } });
  expect(receipts).toHaveLength(1);
  expect(receipts[0].sourceVersion).toBe(authored.autosaveVersion);
  expect(receipts[0].warnings).toContain("motion");
  expect(JSON.stringify(receipts[0])).not.toMatch(
    /latitude|longitude|acceleration|degrees|referenceAssetIds|rawTrail/u,
  );
  await page.screenshot({ path: testInfo.outputPath("creator-authored-floor-and-references.png"), fullPage: true });
  await region.getByLabel("Region name", { exact: true }).fill("Synthetic renamed mezzanine");
  await region.getByLabel("Region name", { exact: true }).press("Tab");
  await expect(field.getByText(/stale after draft edits/u)).toBeVisible();
  await page.goto(`/studio/tales/${fixture.tale.id}/settings`);
  await page.getByRole("combobox", { name: "Visibility", exact: true }).selectOption("PUBLIC");
  const validation = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/studio/tales/${fixture.tale.id}/validate`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Validate Chronicle", exact: true }).click();
  const response = await validation;
  expect(response.ok()).toBe(true);
  expect(JSON.stringify(await response.json())).toContain("LANDFALL_PUBLIC_PRIVATE_CONTEXT");
  expect(await db.publishedTaleVersion.count({ where: { taleId: fixture.tale.id } })).toBe(0);
  await context.close();
});

test("Creator regional controls reflow at narrow width and 200 percent text with keyboard and scoped accessibility", async ({
  browser,
  baseURL,
}, testInfo) => {
  const fixture = await draftFixture();
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  await authenticateClosure(context, owner, baseURL!);
  const page = await context.newPage();
  await open(page, fixture.tale.id);
  const editor = page.getByRole("region", { name: "Floors, regions and landmarks" });
  await editor.getByRole("combobox", { name: "Inspect region", exact: true }).selectOption("compact-corridor");
  await editor.getByRole("button", { name: "Draw region corridor" }).focus();
  await expect(editor.getByRole("button", { name: "Draw region corridor" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Add region point at coordinates" })).toBeVisible();
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    const { width, height } = viewport;
    await page.setViewportSize(viewport);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect(editor.getByRole("combobox", { name: "Inspect region", exact: true })).toBeVisible();
    const bounds = await editor.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Floors, regions and landmarks"]')
          .include('[aria-label="Chart tools"]')
          .include(".landfall-field-test")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`creator-${width}x${height}-200-percent-text.png`),
      fullPage: true,
    });
  }
  await context.close();
});
