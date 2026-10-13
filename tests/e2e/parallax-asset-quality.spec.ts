import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft, presetNames } from "../../src/parallax/authoring";
import { insertSpatialPreset } from "../../src/parallax/editor-assets";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { placeOnRoomFeature } from "../../src/parallax/room-placement";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { spatialPropStyle } from "../../src/parallax/prop-style";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("Creator inspects representative actual asset materials at useful distances in both appearances without altering the saved scene", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180000);
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic asset quality Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  let draft = createSpatialDraft("asset-quality-map");
  for (const [index, name] of presetNames.entries()) {
    if (name !== "Desk Map") draft = insertSpatialPreset(draft, name, `asset-quality-${index}`);
  }
  draft.content.title = "Asset material study";
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: null,
  });
  const assets = presetNames.map(
    (preset) =>
      draft.content.entities.find((entity) =>
        preset === "Ghost Footprint Trail" ? entity.name === "Footprint 1" : entity.name === preset,
      )!,
  );
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  const observations: unknown[] = [];
  for (const theme of ["DARK", "LIGHT"] as const) {
    await page.goto("/studio/library");
    const preferences = await (await context.request.get("/api/passport/preferences")).json();
    const loaded = await (await context.request.get("/api/studio/parallax")).json();
    const response = await context.request.put("/api/passport/preferences", {
      headers: { "x-csrf-token": loaded.csrfToken },
      data: {
        preferences: {
          ...preferences.preferences,
          experience: { ...preferences.preferences.experience, theme, motion: "REDUCED" },
        },
      },
    });
    expect(response.ok()).toBe(true);
    await page.reload();
    await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
    await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
    await page.getByRole("button", { name: /Asset material study.*My Library/ }).click();
    await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
    const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
    const host = canvas.locator('[data-renderer="READY"]');
    await expect(host).toHaveAttribute("data-appearance", theme.toLowerCase());
    await expect(host).toHaveAttribute("data-rendered", "true");
    await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
    await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
    await page.screenshot({ path: `${root}/asset-quality-room-${theme.toLowerCase()}.png` });
    const receipts = async () => JSON.parse((await host.getAttribute("data-scene-receipt"))!) as RendererReceipt[];
    for (const asset of assets) {
      const hierarchy = page.getByRole("button", { name: "Open Scene Hierarchy", exact: true });
      if ((await hierarchy.getAttribute("aria-pressed")) !== "true") await hierarchy.click();
      const graph = page.getByRole("region", { name: "Scene graph", exact: true });
      await graph.locator(`[data-graph-entity="${asset.id}"]`).click();
      await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
      if (!(await canvas.getByRole("button", { name: "Show room", exact: true }).isVisible()))
        await canvas.getByRole("button", { name: "Isolate selected object", exact: true }).click();
      await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
      await expect.poll(async () => (await receipts()).find((row) => row.id === asset.id)?.status).toBe("IN_VIEW");
      const slug = spatialPropStyle(asset).toLowerCase();
      const rendererCanvas = host.locator("canvas");
      await page.screenshot({ path: `${root}/asset-quality-${slug}-${theme.toLowerCase()}.png` });
      await rendererCanvas.screenshot({ path: `${root}/asset-quality-${slug}-${theme.toLowerCase()}-canvas.png` });
      const costs = JSON.parse((await host.getAttribute("data-render-costs"))!);
      expect(costs.calls).toBeGreaterThan(0);
      expect(costs.triangles).toBeGreaterThan(0);
      observations.push({
        asset: asset.name,
        style: spatialPropStyle(asset),
        authoredWidthMeters: asset.widthMeters,
        theme,
        renderer: (await receipts()).find((row) => row.id === asset.id),
        costs,
        objectBuildCount: await host.getAttribute("data-object-build-count"),
      });
      expect(
        (await listSpatialItems(account.id)).find(
          (item) => item.draft.content.definitionId === draft.content.definitionId,
        )!.draft,
      ).toEqual(draft);
    }
  }
  expect(errors).toEqual([]);
  await writeFile(
    `${root}/asset-quality-observations.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME,
        observations,
        errors,
        limitations:
          "Actual software-rendered fixtures and renderer counters; isolated prop closeups do not demonstrate contact shadows. Room context captures show the actual light/shadow environment. CPU submission is not GPU frame-time or physical/native performance proof. Visual acceptance requires independent pixel and recording review.",
      },
      null,
      2,
    ),
  );
});
