import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
for (const scenario of ["timeout-dark", "clarification-phone-light", "network-desktop-light"] as const)
  test(`Photo setup ${scenario} keeps processing and recovery visible without modifying the source`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(180000);
    ensureGenericSoundingLineIsolation();
    if (process.env.PARALLAX_ROOM_PHOTO_RUNTIME !== "SYNTHETIC_DEVELOPMENT")
      throw new Error("Unpaid isolated photo runtime required");
    const account = await closureAccount(`Synthetic photo feedback ${scenario}`);
    await activateWorkspaceCapability(account.id, "CREATOR");
    await db.aIQuotaControl.upsert({
      where: { id: AI_CONTROL_ID },
      update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
      create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    });
    const source = createSpatialDraft(`photo-feedback-${account.id}`);
    source.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
    await saveSpatialDraft(account.id, source, 0);
    await authenticateClosure(context, account, baseURL!);
    await page.setViewportSize({
      width: scenario.includes("phone") ? 390 : 1440,
      height: scenario.includes("phone") ? 844 : 1000,
    });
    if (scenario.includes("light")) {
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      const loaded = await (await page.request.get("/api/studio/parallax")).json();
      const preferences = await (await page.request.get("/api/passport/preferences")).json();
      const changed = await page.request.put("/api/passport/preferences", {
        headers: { "x-csrf-token": loaded.csrfToken },
        data: {
          preferences: {
            ...preferences.preferences,
            experience: { ...preferences.preferences.experience, theme: "LIGHT", motion: "REDUCED" },
          },
        },
      });
      expect(changed.ok()).toBe(true);
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/studio/parallax?definition=${source.content.definitionId}`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-voyage-theme",
      scenario.includes("light") ? "light" : "dark",
    );
    const sourceCanvas = page
      .getByRole("region", { name: "Spatial canvas", exact: true })
      .locator('[data-renderer="READY"] canvas');
    await expect(sourceCanvas).toBeVisible();
    // Use an actual rendered synthetic room as the upload fixture, never owner photographs.
    const image = await sourceCanvas.screenshot();
    await page.getByRole("button", { name: "Open Library", exact: true }).click();
    await page.getByRole("tab", { name: "Environments", exact: true }).click();
    await page.getByRole("button", { name: "Add environment", exact: true }).click();
    await page.getByRole("button", { name: /From photos/ }).click();
    const dialog = page.getByRole("dialog", { name: "Build a room from photos", exact: true });
    const photo = dialog.getByRole("region", { name: "Room photograph reconstruction", exact: true });
    await expect(photo).toContainText("Local development photo import and room inference are ready.");
    await photo
      .getByLabel("Room photograph", { exact: true })
      .setInputFiles([{ name: "synthetic-room.png", mimeType: "image/png", buffer: image }]);
    const reconstruct = photo.getByRole("button", { name: "Reconstruct room from photograph", exact: true });
    await expect(reconstruct).toBeDisabled();
    await photo.getByRole("checkbox").check();
    await expect(reconstruct).toBeInViewport();
    await mkdir(root, { recursive: true });
    await page.screenshot({ path: `${root}/photo-${scenario}-setup.png` });
    let release!: () => void;
    let requests = 0;
    await page.route("**/api/studio/parallax/room-photo", async (route) => {
      if (
        !route.request().headers()["content-type"]?.includes("application/json") ||
        route.request().postDataJSON().action !== "RECONSTRUCT"
      )
        return route.continue();
      requests++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      if (scenario.startsWith("timeout"))
        await route.fulfill({
          status: 503,
          json: { error: "Spatial Assistant took too long. Your scene is unchanged." },
        });
      else if (scenario.startsWith("clarification"))
        await route.fulfill({
          json: {
            status: "CLARIFICATION",
            message: "An estimated wall panel overlaps another feature. Try another angle.",
          },
        });
      else await route.abort("failed");
    });
    await reconstruct.click();
    await expect(photo.getByRole("heading", { name: "I’m building your room" })).toBeVisible();
    await expect.poll(() => !!release).toBe(true);
    await expect(reconstruct).not.toBeVisible();
    if (scenario.startsWith("timeout")) {
      await expect(photo.getByText(/Still working · 2\ds elapsed/)).toBeVisible({ timeout: 30000 });
    }
    await page.screenshot({ path: `${root}/photo-${scenario}-thinking.png` });
    release();
    const feedback = photo.locator("[data-outcome]");
    await expect(feedback).toBeVisible();
    await expect(feedback).toBeFocused();
    await expect(feedback.getByRole("button", { name: "Try again", exact: true })).toBeInViewport();
    await expect(photo.getByRole("heading", { name: "I’m building your room" })).toHaveCount(0);
    if (scenario.startsWith("timeout")) await expect(feedback).toContainText("The reconstruction request timed out.");
    if (scenario.startsWith("clarification"))
      await expect(feedback.getByRole("heading", { name: "I need a clearer view" })).toBeVisible();
    if (scenario.startsWith("network")) await expect(feedback).toContainText("I couldn’t reach the server.");
    await expect(reconstruct).toBeEnabled();
    await expect(feedback).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `${root}/photo-${scenario}-recovery.png` });
    await feedback.getByText("What happened").click();
    await expect(feedback.locator("details")).toHaveAttribute("open", "");
    expect(requests).toBe(1);
    if (scenario.startsWith("timeout")) {
      await feedback.getByRole("button", { name: "Try again", exact: true }).click();
      await expect.poll(() => requests).toBe(2);
      await expect(photo.getByRole("heading", { name: "I’m building your room" })).toBeVisible();
      release();
      await expect(feedback).toBeVisible();
      await expect(feedback).toBeFocused();
      expect(requests).toBe(2);
    }
    await photo.getByText(/Manage photo permissions/).click();
    await expect(photo.getByRole("button", { name: "Withdraw photo 1 processing permission" })).toBeVisible();
    await photo.getByRole("button", { name: "Withdraw photo 1 processing permission" }).click();
    await expect(photo).toContainText("Future photo processing permission withdrawn.");
    if (scenario.startsWith("timeout")) {
      await expect(photo.getByRole("button", { name: "Withdraw photo 1 processing permission" })).toBeVisible();
      await photo.getByRole("button", { name: "Withdraw photo 1 processing permission" }).click();
      await expect(photo.getByRole("button", { name: /Withdraw photo .* processing permission/ })).toHaveCount(0);
    }
    expect((await listSpatialItems(account.id)).find((item) => item.id === source.content.definitionId)!.draft).toEqual(
      source,
    );
    expect(errors).toEqual([]);
    await dialog.getByRole("button", { name: "Close environment setup" }).click();
    await expect(dialog).toHaveCount(0);
  });
