import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft, editSpatialDraft, previewEntityTransform } from "../../src/parallax/authoring";
import {
  createRoomEnvironment,
  authoredPreviewEnvironment,
  resolveRoomFeature,
} from "../../src/parallax/environment-authoring";
import { createGenericRoomFeature } from "../../src/parallax/room-feature-construction";
import { syntheticEnvironmentEvidence } from "../../src/parallax/adaptive-authoring";
import { placeOnSurface } from "../../src/parallax/surface-placement";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import type { RendererReceipt } from "../../src/components/studio/parallax/spatial-workstation";

test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ video: "on", actionTimeout: 30000 });
test.skip(process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1", "Requires the guarded unpaid upstream fixture.");
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
const noteId = "synthetic-window-note";
function roomDraft(id: string, ambiguous = false) {
  let draft = createSpatialDraft(id);
  draft.content.title = ambiguous ? "Two plausible tables" : "Table beside the window";
  const room = createRoomEnvironment(simulationEnvironments.find((environment) => environment.id === "empty")!);
  const provenance = { basis: "SIMULATED" as const, confidence: 1, sourceMediaIds: [] };
  room.features.push(
    createGenericRoomFeature({
      id: "room-window",
      name: "Room window",
      classification: "WINDOW",
      position: { x: 0, y: 1.8, z: -room.depth / 2 },
      provenance,
    }),
    createGenericRoomFeature({
      id: "window-table",
      name: ambiguous ? "Left table" : "Window table",
      classification: "TABLE",
      position: { x: ambiguous ? -0.9 : 0, y: 0.375, z: -0.8 },
      provenance,
    }),
    createGenericRoomFeature({
      id: "reading-table",
      name: ambiguous ? "Right table" : "Reading table",
      classification: "TABLE",
      position: { x: ambiguous ? 0.9 : 0, y: 0.375, z: ambiguous ? -0.8 : 0.8 },
      provenance,
    }),
  );
  room.origin = "MANUAL";
  draft.content.studio!.environment = room;
  const idEntity = draft.content.entities[0].id;
  draft = editSpatialDraft(draft, { type: "PLACEMENT", entityId: idEntity, placement: "WALL" });
  draft.content.entities[0].transform.position.x = -0.9;
  return draft;
}
async function enableAssistance() {
  const policy = JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true, defaultUserRequests: 12 });
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy },
    update: { policy },
  });
}
async function openScene(page: Page, title: string) {
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`${title}.*My Library`) }).click();
  await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
}
async function observeActivity(page: Page) {
  await page.evaluate(() => {
    const records: { elapsedMs: number; text: string; working: string | null }[] = [];
    const started = performance.now();
    const capture = () => {
      const activity = document.querySelector('[aria-label="Spatial Assistant"] [data-working]');
      const text = activity?.textContent?.replace(/[◌✓✦]/g, "").trim() ?? "";
      if (text && text !== records.at(-1)?.text)
        records.push({ elapsedMs: performance.now() - started, text, working: activity!.getAttribute("data-working") });
    };
    capture();
    new MutationObserver(capture).observe(document.querySelector('[aria-label="Spatial Assistant"]')!, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-working"],
    });
    (window as Window & { parallaxActivity?: typeof records }).parallaxActivity = records;
  });
}
async function activity(page: Page) {
  return page.evaluate(() => (window as Window & { parallaxActivity?: unknown }).parallaxActivity);
}
async function snap(page: Page, name: string) {
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/semantic-${name}.png` });
}
const savedDraft = async (accountId: string, definitionId: string) =>
  (await listSpatialItems(accountId)).find((item) => item.draft.content.definitionId === definitionId)!.draft;

test("Assistant places a real note on the correct table near the window with truthful renderer confirmation, identity and saved restore", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic semantic placement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await enableAssistance();
  const draft = roomDraft("semantic-window-scene");
  expect(resolveRoomFeature(draft.content.studio!.environment!, "TABLE", "room-window")).toMatchObject({
    status: "RESOLVED",
    feature: { id: "window-table" },
  });
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openScene(page, draft.content.title);
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const host = canvas.locator('[data-renderer="READY"]');
  const receipt = async () =>
    (JSON.parse((await host.getAttribute("data-scene-receipt")) ?? "[]") as RendererReceipt[]).find(
      (item) => item.id === noteId,
    );
  await observeActivity(page);
  await assistant.getByLabel("Describe your spatial idea").fill("Place a note on the table near the window.");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/studio/parallax") && r.request().postDataJSON()?.kind === "ASSISTANT",
  );
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  await expect(assistant.locator("[data-working]")).toContainText("Interpreting your idea…");
  await snap(page, "interpreting");
  const returned = await response,
    reply = await returned.json();
  expect(returned.ok(), JSON.stringify(reply)).toBe(true);
  expect(reply.status).toBe("PROPOSED");
  expect(reply.proposal.operations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "CREATE", entityId: noteId }),
      expect.objectContaining({
        type: "ROOM_PLACEMENT",
        entityId: noteId,
        classification: "TABLE",
        targetFeatureId: "window-table",
        nearFeatureId: "room-window",
      }),
    ]),
  );
  await expect(assistant).toContainText("Use Window table, the table nearest Room window");
  await assistant.getByRole("button", { name: "Proposed scene", exact: true }).click();
  await assistant.getByRole("button", { name: "Locate object", exact: true }).first().click();
  await assistant.getByRole("button", { name: "View canvas", exact: true }).click();
  const previewSelection = page.getByRole("region", { name: "Preview selection", exact: true });
  for (const [mode, name] of [
    ["GUIDED", "guided"],
    ["DETAILED", "standard"],
    ["ENGINEERING", "engineering"],
  ] as const) {
    await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption(mode);
    await expect(previewSelection.getByRole("heading", { name: "Review this proposal" })).toBeVisible();
    await expect(previewSelection.getByRole("button", { name: "Review placement preview" })).toBeVisible();
    await expect(previewSelection.getByRole("button", { name: "Open scene settings" })).toBeVisible();
    expect((await savedDraft(account.id, draft.content.definitionId)).content.entities).toHaveLength(1);
    await snap(page, `assistant-preview-${name}`);
  }
  await previewSelection.getByRole("button", { name: "Review placement preview" }).click();
  await expect(assistant).toBeVisible();
  await assistant.getByRole("button", { name: "View canvas", exact: true }).click();
  await expect(previewSelection).toBeVisible();
  await canvas.getByRole("button", { name: "Frame selection", exact: true }).click();
  await expect.poll(async () => (await receipt())?.status).toBe("IN_VIEW");
  expect((await savedDraft(account.id, draft.content.definitionId)).content.entities).toHaveLength(1);
  await snap(page, "proposed-note-in-view");
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  const applying = page.waitForResponse(
    (r) => r.url().endsWith("/api/studio/parallax") && r.request().postDataJSON()?.action === "ASSISTANT_APPLY",
  );
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  expect((await applying).ok()).toBe(true);
  await expect(assistant.getByRole("region", { name: "Saved scene canvas check", exact: true })).toContainText(
    "rendered in the current view",
  );
  await snap(page, "applied-renderer-confirmation");
  const saved = await savedDraft(account.id, draft.content.definitionId);
  expect(saved.content.entities.map((entity) => entity.id)).toContain(noteId);
  expect(saved.content.entities.find((entity) => entity.id === draft.content.entities[0].id)).toEqual(
    draft.content.entities[0],
  );
  const room = authoredPreviewEnvironment(saved.content, {
    ...simulationEnvironments[0],
    id: saved.content.studio!.environment!.id,
  });
  const pose = previewEntityTransform(saved.content, noteId, room.id, room);
  const table = syntheticEnvironmentEvidence(room).candidates.find((candidate) => candidate.id === "window-table:top")!;
  expect(placeOnSurface(pose, table, 0.22)).not.toBeNull();
  expect(pose.position.y).toBeCloseTo(0.76);
  expect((await receipt())!.position).toEqual([pose.position.x, pose.position.y, pose.position.z]);
  await assistant.getByRole("button", { name: "View canvas", exact: true }).click();
  await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph", exact: true });
  await expect(graph.locator(`[data-graph-entity="${noteId}"]`)).toHaveAttribute("aria-pressed", "true");
  await canvas.getByRole("button", { name: "Edit selected object", exact: true }).click();
  const overview = page.getByText("Overview / Identity", { exact: true });
  if ((await overview.locator("..").getAttribute("open")) === null) await overview.click();
  await expect(page.getByRole("textbox", { name: "Object name", exact: true })).toHaveValue("Folded window note");
  for (const mode of ["GUIDED", "DETAILED", "ENGINEERING"]) {
    await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption(mode);
    await expect.poll(async () => (await receipt())?.status).toBe("IN_VIEW");
    await snap(page, `selected-${mode.toLowerCase()}`);
  }
  const observed = await activity(page);
  await page.reload();
  await expect.poll(async () => (await receipt())?.position).toBeTruthy();
  expect(await savedDraft(account.id, draft.content.definitionId)).toEqual(saved);
  await writeFile(
    `${root}/semantic-placement-proof.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME ?? "UNSPECIFIED",
        provider: "SYNTHETIC_UNPAID",
        targetFeatureId: table.id,
        pose,
        rendered: await receipt(),
        observed,
        errors,
        limits:
          "Real application/backend/renderer and persisted synthetic geometry; not live model interpretation or physical room accuracy.",
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});

test("Assistant asks about two plausible tables, cancels an actual request and reports provider failure without changing the scene", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic ambiguous recovery Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await enableAssistance();
  const draft = roomDraft("semantic-ambiguous-scene", true);
  expect(resolveRoomFeature(draft.content.studio!.environment!, "TABLE", "room-window").status).toBe("AMBIGUOUS");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openScene(page, draft.content.title);
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  await observeActivity(page);
  const send = async (request: string) => {
    await assistant.getByLabel("Describe your spatial idea").fill(request);
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/studio/parallax") && r.request().postDataJSON()?.kind === "ASSISTANT",
    );
    await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
    return (await response).json();
  };
  const clarification = await send("Place a note on either of the two tables near the window.");
  expect(clarification.status).toBe("PROPOSED");
  expect(clarification.proposal.operations).toEqual([]);
  await expect(assistant).toContainText("Which table should receive the note: Left table or Right table?");
  await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toHaveCount(0);
  expect(await savedDraft(account.id, draft.content.definitionId)).toEqual(draft);
  await snap(page, "ambiguous-target-question");
  await assistant.getByRole("button", { name: "Start new task", exact: true }).click();
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("ENGINEERING");
  await assistant
    .getByLabel("Describe your spatial idea")
    .fill("Synthetic delayed note creation for cancellation review.");
  let cancelledRequestDispatches = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/studio/parallax") &&
      request.method() === "POST" &&
      request.postDataJSON()?.kind === "ASSISTANT" &&
      request.postDataJSON()?.request === "Synthetic delayed note creation for cancellation review."
    )
      cancelledRequestDispatches++;
  });
  const dispatched = page.waitForRequest(
    (request) => request.url().endsWith("/api/studio/parallax") && request.postDataJSON()?.kind === "ASSISTANT",
  );
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  await dispatched;
  await expect(assistant.locator("[data-working]")).toContainText("Interpreting your idea…");
  await snap(page, "cancellable-request");
  await assistant.getByRole("button", { name: "Cancel request", exact: true }).click();
  const cancellationNotice = assistant.getByText("Assistance cancelled. Your scene is unchanged.", { exact: true });
  await expect(cancellationNotice).toBeInViewport();
  await expect(assistant.locator("[data-working]")).toContainText("Request cancelled");
  await expect(assistant.getByLabel("Describe your spatial idea")).toBeFocused();
  await snap(page, "cancelled");
  await page.waitForTimeout(5500);
  expect(cancelledRequestDispatches).toBe(1);
  await expect(cancellationNotice).toBeInViewport();
  await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toHaveCount(0);
  expect(await savedDraft(account.id, draft.content.definitionId)).toEqual(draft);
  await assistant.getByRole("button", { name: "Start new task", exact: true }).click();
  const failure = await send("Synthetic provider failure for recovery review.");
  expect(failure.status).toBe("FAILED");
  await expect(assistant.locator("[data-working]")).toContainText("Assistance is unavailable");
  await expect(assistant).toContainText("Your local scene is unchanged");
  await expect(page.getByRole("combobox", { name: "Authoring mode", exact: true })).toHaveValue("ENGINEERING");
  await expect(page.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await expect(assistant.getByRole("button", { name: "Apply all changes", exact: true })).toHaveCount(0);
  expect(await savedDraft(account.id, draft.content.definitionId)).toEqual(draft);
  await snap(page, "provider-failure");
  await assistant.getByRole("button", { name: "Start new task", exact: true }).click();
  await assistant.getByLabel("Describe your spatial idea").fill("Unsent idea kept while changing motion preferences");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("combobox", { name: "Authoring mode", exact: true }).selectOption("GUIDED");
  await expect(assistant).toHaveAttribute("data-motion", /reduced|off/);
  await expect(assistant.getByLabel("Describe your spatial idea")).toHaveValue(
    "Unsent idea kept while changing motion preferences",
  );
  await expect(page.getByRole("heading", { name: draft.content.title, level: 1, exact: true })).toBeVisible();
  await snap(page, "motion-switch-preserved-composer");
  await send("Place a note on either of the two tables near the window.");
  await expect(assistant).toContainText("A little clarification will help");
  await snap(page, "reduced-motion-clarification");
  await writeFile(
    `${root}/semantic-recovery-proof.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME ?? "UNSPECIFIED",
        provider: "SYNTHETIC_UNPAID",
        observed: await activity(page),
        lateReplyWaitMs: 5500,
        cancelledRequestDispatches,
        savedDataUnchanged: true,
        limits:
          "Deterministic upstream fixtures exercise real API/UI stages, not live semantic model quality or representative motion smoothness.",
      },
      null,
      2,
    ),
  );
});

test("Public sign-in input and focus survive switching motion preferences in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/sign-in");
  const field = page.getByLabel("Email or Player name", { exact: true });
  await field.fill("synthetic-motion-switch@example.test");
  await field.focus();
  const originalField = await field.elementHandle();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
  await expect(field).toHaveValue("synthetic-motion-switch@example.test");
  await expect(field).toBeFocused();
  await snap(page, "public-sign-in-reduced-motion");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).toHaveAttribute("data-motion-level", "full");
  await expect(field).toHaveValue("synthetic-motion-switch@example.test");
  await expect(field).toBeFocused();
  expect(await field.evaluate((current, original) => current === original, originalField)).toBe(true);
  await snap(page, "public-sign-in-restored-motion");
  await writeFile(
    `${root}/semantic-public-motion-proof.json`,
    JSON.stringify(
      {
        source: process.env.PARALLAX_A1_SOURCE_SHA,
        runtime: process.env.PARALLAX_BROWSER_RUNTIME ?? "UNSPECIFIED",
        reducedThenFullConfirmed: true,
        retainedDOMNode: true,
        value: await field.inputValue(),
        focusRetained: true,
        limits: "One public sign-in form and the Studio fixture; no full product-route matrix acceptance.",
      },
      null,
      2,
    ),
  );
});
