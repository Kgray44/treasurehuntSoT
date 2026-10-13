import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
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
  await page.keyboard.press("Escape");
  await expect(setup).toHaveCount(0);
  await expect(plus).toBeFocused();
  await plus.press("Enter");
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
  if (process.env.PARALLAX_ROOM_PHOTO_RUNTIME !== "SYNTHETIC_DEVELOPMENT") {
    if ((await libraryToggle.getAttribute("aria-pressed")) !== "true") await libraryToggle.click();
    await page.getByRole("tab", { name: "Environments", exact: true }).click();
    await plus.click();
    await setup.getByRole("button", { name: /From photos/ }).click();
    const photo = page
      .getByRole("dialog", { name: "Build a room from photos", exact: true })
      .getByRole("region", { name: "Room photograph reconstruction", exact: true });
    await expect(photo).toContainText(/manual room editing is available/i);
    await expect(photo.getByRole("button", { name: "Reconstruct room from photograph", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Close environment setup", exact: true }).click();
    await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
  }
});
