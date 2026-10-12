import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { syntheticEnvironmentEvidence } from "../../src/parallax/adaptive-authoring";
import { createPresetConstruction } from "../../src/parallax/preset-construction";
import { syntheticRoomGeometry } from "../../src/parallax/room-geometry";
import { verifyConstructedEnvironment } from "../../src/parallax/construction-verification";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());

test("Creator explores ten furnished environments in both appearances without changing the scene", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic named rooms Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
  await mkdir(root, { recursive: true });
  const costs: {
    room: string;
    theme: string;
    viewport: string;
    samples: unknown[];
    construction: unknown;
    renderedBounds: unknown;
  }[] = [];
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
    const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
    await expect(canvas.locator('[data-renderer="READY"] canvas')).toBeVisible();
    await expect(canvas.locator('[data-renderer="READY"]')).toHaveAttribute("data-appearance", theme.toLowerCase());
    for (const room of simulationEnvironments) {
      await page.getByLabel("Environment", { exact: true }).selectOption(room.id);
      await expect(canvas).toContainText(room.name);
      await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
      const host = canvas.locator('[data-renderer="READY"]');
      await expect(host).toHaveAttribute("data-render-costs", /.+/);
      const spec = createPresetConstruction(room),
        constructed = syntheticRoomGeometry({ ...spec, horizontal: true, vertical: true });
      const verification = verifyConstructedEnvironment(spec, constructed);
      expect(verification.status).toBe("CHECKS_PASSED");
      const samples: unknown[] = [];
      for (let sample = 0; sample < 3; sample++) {
        await page.getByRole("button", { name: "Reset view", exact: true }).click();
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );
        samples.push(JSON.parse((await host.getAttribute("data-render-costs"))!));
      }
      const bounds = JSON.parse((await host.getAttribute("data-room-receipt"))!);
      expect(new Set(bounds.map((part: { id: string }) => part.id)).size).toBe(spec.features.length);
      for (const cost of samples as { calls: number; geometries: number; triangles: number }[]) {
        expect(cost.calls).toBeLessThan(120);
        expect(cost.geometries).toBeLessThan(80);
        expect(cost.triangles).toBeLessThan(60000);
      }
      costs.push({
        room: room.id,
        theme,
        viewport: "1440x1000",
        samples,
        construction: verification,
        renderedBounds: bounds,
      });
      const planes = syntheticEnvironmentEvidence(room).candidates.filter(
        (c) => c.surface !== "OPEN_SPACE" && c.id !== "unsafe-walkway",
      );
      await expect(canvas.getByText(/Room surfaces/)).toContainText(String(planes.length));
      await expect(canvas.getByRole("button", { name: "Entire floor", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Toggle spatial overlays", exact: true }).click();
      await page.screenshot({ path: `${root}/room-${room.id}-${theme.toLowerCase()}.png` });
      await expect(page.getByRole("heading", { level: 1, name: "Desk Map", exact: true })).toBeVisible();
    }
    for (const room of simulationEnvironments.map((room) => room.id)) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByLabel("Environment", { exact: true }).selectOption(room);
      await expect(canvas.locator('[data-renderer="READY"] canvas')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `${root}/room-${room}-${theme.toLowerCase()}-phone.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  expect(await db.aIUsageLedger.count({ where: { accountId: account.id } })).toBe(0);
  await writeFile(
    `${root}/room-render-costs.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: "ISOLATED_SYNTHETIC_UNPAID",
        note: "Actual renderer counters and CPU submission duration; not a GPU frame-time benchmark. Three view-reset samples per desktop room/appearance.",
        costs,
      },
      null,
      2,
    ) + "\n",
  );
});
