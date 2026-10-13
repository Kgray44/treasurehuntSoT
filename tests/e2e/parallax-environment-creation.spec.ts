import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
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

test("Environment plus opens keyboard-friendly choices, duplicates a source and starts an empty shell", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic environment setup Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const source = createSpatialDraft(`environment-setup-${account.id}`);
  source.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  source.content.studio!.environment!.name = "Source bedroom";
  await saveSpatialDraft(account.id, source, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${source.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  const plus = page.getByRole("button", { name: "Add environment", exact: true });
  await plus.focus();
  await plus.press("Enter");
  const setup = page.getByRole("dialog", { name: "Create an environment", exact: true });
  await expect(setup).toBeVisible();
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/environment-setup-choices.png` });
  await setup.getByRole("button", { name: /Existing environment/ }).click();
  await page.getByLabel("Find existing environment", { exact: true }).fill("Source bedroom");
  await page.getByRole("button", { name: /Source bedroom.*Library/ }).click();
  await expect(page.getByLabel("Current scene", { exact: true })).toContainText("Source bedroom copy");
  await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
  const items = await listSpatialItems(account.id);
  const copy = items.find((item) => item.id !== source.content.definitionId)!;
  expect(copy.draft.content.studio!.environment!.id).not.toBe(source.content.studio!.environment!.id);
  expect(copy.draft.content.studio!.environment!.features).toEqual(source.content.studio!.environment!.features);
  expect(items.find((item) => item.id === source.content.definitionId)!.draft).toEqual(source);
  const libraryToggle = page.getByRole("button", { name: "Open Library", exact: true });
  if ((await libraryToggle.getAttribute("aria-pressed")) !== "true") await libraryToggle.click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  await plus.click();
  await setup.getByRole("button", { name: /Empty environment/ }).click();
  await expect(page.getByLabel("Current scene", { exact: true })).toContainText("Empty environment");
  await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
  const saved = (await listSpatialItems(account.id)).find((item) => item.draft.content.title === "Empty environment")!;
  expect(
    saved.draft.content.studio!.environment!.features.every((feature) =>
      ["FLOOR", "WALL", "CEILING"].includes(feature.classification),
    ),
  ).toBe(true);
  await page.screenshot({ path: `${root}/environment-setup-empty-editor.png` });
  await page.reload();
  await expect(page.getByLabel("Current scene", { exact: true })).toContainText("Empty environment");
});

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
    await expect(photo).toContainText("Protected photo import and room inference are ready.");
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
    await photo.getByRole("button", { name: "Reconstruct room from photograph", exact: true }).click();
    await expect(photo.getByRole("button", { name: "Cancel photo processing", exact: true })).toBeVisible();
    if (count === 2) await page.screenshot({ path: `${root}/environment-photo-processing.png` });
    await expect(photo.getByRole("region", { name: "Proposed room", exact: true })).toBeVisible({ timeout: 60000 });
    const demo = dialog.getByRole("region", { name: "Reconstructed room preview", exact: true });
    await expect(demo.locator('[data-renderer="READY"] canvas')).toBeVisible({ timeout: 30000 });
    await expect(photo).toContainText("Scale is estimated automatically");
    expect((await listSpatialItems(account.id)).find((item) => item.id === source.content.definitionId)!.draft).toEqual(
      source,
    );
    await mkdir(root, { recursive: true });
    await demo.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/environment-photo-${count}-view-demo.png` });
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
