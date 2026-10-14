import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createEnvironmentDraft } from "../../src/parallax/library-lifecycle-contracts";
import {
  saveEnvironmentDraft,
  saveDefinitionToLibrary,
  listEnvironmentDefinitions,
} from "../../src/parallax/library-lifecycle-service";
test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
test("Environment plus opens keyboard-friendly choices, duplicates a source and starts an empty shell", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Environment Setup Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const scene = createSpatialDraft(crypto.randomUUID());
  await saveSpatialDraft(account.id, scene, 0);
  const source = createEnvironmentDraft(crypto.randomUUID(), createRoomEnvironment(simulationEnvironments[0]));
  source.name = "Source bedroom";
  source.room!.name = source.name;
  await saveEnvironmentDraft(account.id, source, 0);
  await saveDefinitionToLibrary(account.id, source.id, 1);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/parallax?definition=${scene.content.definitionId}`);
  await page.getByRole("button", { name: "Open Library", exact: true }).click();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  const plus = page.getByRole("button", { name: "Create environment", exact: true });
  await plus.focus();
  await plus.press("Enter");
  const setup = page.getByRole("dialog", { name: "Create an environment", exact: true });
  await expect(setup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(setup).toHaveCount(0);
  await expect(plus).toBeFocused();
  await plus.press("Enter");
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/environment-setup-choices.png` });
  await setup.getByRole("button", { name: /Existing environment/ }).click();
  await page.getByLabel("Find existing environment", { exact: true }).fill("Source bedroom");
  await page.getByRole("button", { name: /Source bedroom.*Library/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Source bedroom copy" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
  const copy = (await listEnvironmentDefinitions(account.id)).find((e) => e.id !== source.id)!;
  expect(copy.draft.room!.id).not.toBe(source.room!.id);
  expect(copy.draft.room!.features).toEqual(source.room!.features);
  expect(await listSpatialItems(account.id)).toHaveLength(1);
  expect((await listEnvironmentDefinitions(account.id)).find((e) => e.id === source.id)!.draft).toEqual(source);
  await page.getByRole("button", { name: "Back to scene" }).click();
  await plus.click();
  await setup.getByRole("button", { name: /Empty environment/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Empty environment" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
  const empty = (await listEnvironmentDefinitions(account.id)).find((e) => e.draft.name === "Empty environment")!;
  expect(empty.draft.room!.features.every((f) => ["FLOOR", "WALL", "CEILING"].includes(f.classification))).toBe(true);
  expect(empty.saveState).toBe("WORKING");
  await page.screenshot({ path: `${root}/environment-setup-empty-editor.png` });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Empty environment" })).toBeVisible();
  expect(await listSpatialItems(account.id)).toHaveLength(1);
  await page.getByRole("button", { name: "Reconstruct or start from a room…" }).click();
  await setup.getByRole("button", { name: /From photos/ }).click();
  const photo = page
    .getByRole("dialog", { name: "Build a room from photos", exact: true })
    .getByRole("region", { name: "Room photograph reconstruction", exact: true });
  await expect(photo.getByRole("button", { name: /(?:Reconstruct|Refine) room from photograph/ })).toBeDisabled();
  await page.getByRole("button", { name: "Close environment setup", exact: true }).click();
  await expect(page.getByRole("region", { name: "Room feature editor", exact: true })).toBeVisible();
});
