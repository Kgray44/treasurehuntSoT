import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

for (const count of [1, 2])
  test(`Environment photo setup imports ${count} views, renders the proposal and saves an independent editable room`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(240000);
    if (
      process.env.PARALLAX_ROOM_PHOTO_RUNTIME !== "SYNTHETIC_DEVELOPMENT" ||
      process.env.OPENAI_API_KEY !== "parallax-a1-synthetic-provider-only"
    )
      throw new Error("Isolated unpaid photo provider required");
    ensureGenericSoundingLineIsolation();
    const account = await closureAccount(`Synthetic ${count}-view environment setup Creator`);
    await activateWorkspaceCapability(account.id, "CREATOR");
    await db.aIQuotaControl.upsert({
      where: { id: AI_CONTROL_ID },
      update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
      create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    });
    const source = createSpatialDraft(`photo-setup-source-${account.id}`);
    source.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
    await saveSpatialDraft(account.id, source, 0);
    await authenticateClosure(context, account, baseURL!);
    await page.setViewportSize({ width: count === 1 ? 390 : 1440, height: count === 1 ? 844 : 1000 });
    await page.goto(`/studio/parallax?definition=${source.content.definitionId}`);
    await page.getByRole("button", { name: "Open Library", exact: true }).click();
    await page.getByRole("tab", { name: "Environments", exact: true }).click();
    await page.getByRole("button", { name: "Add environment", exact: true }).click();
    await page.getByRole("button", { name: /From photos/ }).click();
    const dialog = page.getByRole("dialog", { name: "Build a room from photos", exact: true });
    const photo = dialog.getByRole("region", { name: "Room photograph reconstruction", exact: true });
    await expect(photo).toContainText("Local development photo import and room inference are ready.");
    await expect(photo.getByLabel("Shared room feature", { exact: true })).toHaveCount(0);
    const buffer = await sharp({ create: { width: 620, height: 400, channels: 3, background: "#9cb4c5" } })
      .png()
      .toBuffer();
    await photo.getByLabel("Room photograph", { exact: true }).setInputFiles(
      Array.from({ length: count }, (_, i) => ({
        name: `synthetic-room-view-${i + 1}.png`,
        mimeType: "image/png",
        buffer,
      })),
    );
    await expect(photo.getByRole("img")).toHaveCount(count);
    await photo.getByRole("checkbox").check();
    if (count === 1) {
      await photo.getByRole("button", { name: "Reconstruct room from photograph", exact: true }).click();
      await photo.getByRole("button", { name: "Cancel photo processing", exact: true }).click();
      await expect(photo).toContainText("Cancelled. Your authored scene is unchanged.");
      await expect(photo.getByRole("region", { name: "Proposed room", exact: true })).toHaveCount(0);
      expect(
        (await listSpatialItems(account.id)).find((item) => item.id === source.content.definitionId)!.draft,
      ).toEqual(source);
      await mkdir(root, { recursive: true });
      await page.screenshot({ path: `${root}/environment-photo-cancelled.png` });
    }
    await photo.getByRole("button", { name: "Reconstruct room from photograph", exact: true }).click();
    await expect(photo.getByRole("button", { name: "Cancel photo processing", exact: true })).toBeVisible();
    if (count === 2) await page.screenshot({ path: `${root}/environment-photo-processing.png` });
    await expect(photo.getByRole("region", { name: "Proposed room", exact: true })).toBeVisible({ timeout: 60000 });
    const demo = dialog.getByRole("region", { name: "Reconstructed room preview", exact: true });
    const canvas = demo.locator('[data-renderer="READY"] canvas');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await expect(photo).toContainText("Scale is estimated automatically");
    expect((await listSpatialItems(account.id)).find((item) => item.id === source.content.definitionId)!.draft).toEqual(
      source,
    );
    await mkdir(root, { recursive: true });
    await demo.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/environment-photo-${count}-view-demo.png` });
    const pixelDigest = async () =>
      createHash("sha256")
        .update(await canvas.screenshot())
        .digest("hex");
    const beforeOrbit = await pixelDigest();
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.45, { steps: 16 });
    await page.mouse.up();
    await expect.poll(pixelDigest).not.toBe(beforeOrbit);
    await canvas.screenshot({ path: `${root}/environment-photo-${count}-view-orbited.png` });
    const beforeZoom = await pixelDigest();
    await page.mouse.wheel(0, -240);
    await expect.poll(pixelDigest).not.toBe(beforeZoom);
    await canvas.screenshot({ path: `${root}/environment-photo-${count}-view-zoomed.png` });
    await demo.getByLabel("Camera perspective", { exact: true }).selectOption("plan");
    await expect(demo.getByLabel("Camera perspective", { exact: true })).toHaveValue("plan");
    await canvas.screenshot({ path: `${root}/environment-photo-${count}-view-plan.png` });
    await demo.getByRole("button", { name: "Frame room", exact: true }).click();
    await demo.getByRole("button", { name: "Reset view", exact: true }).click();
    expect((await listSpatialItems(account.id)).find((item) => item.id === source.content.definitionId)!.draft).toEqual(
      source,
    );
    await photo.getByRole("button", { name: "Apply and save room", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
    const rooms = (await listSpatialItems(account.id)).filter(
      (item) => item.draft.content.studio?.environment?.origin === "PHOTO_RECONSTRUCTION",
    );
    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).not.toBe(source.content.definitionId);
    await page.reload();
    await expect(page.getByLabel("Current scene", { exact: true })).toContainText("Photo environment");
  });
