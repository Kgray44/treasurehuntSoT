import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { syntheticEnvironmentEvidence } from "../../src/parallax/adaptive-authoring";

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
});
