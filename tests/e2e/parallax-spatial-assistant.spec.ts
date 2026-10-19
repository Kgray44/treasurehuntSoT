import { openCurrentScenePublication, saveCurrentWorkingDraft } from "./fixtures/parallax-current-library";
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { hash } from "bcryptjs";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createStudioTale, getStudioTale, saveStudioDraft } from "../../src/chronicle/studio-service";
import { getBlockDefinition } from "../../src/chronicle/block-registry";
import { validateSpatialMoment } from "../../src/parallax/publication";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import { spatialItemKind } from "../../src/parallax/library-service";
import { materializeAssistantProposal, type AssistantProposal } from "../../src/parallax/spatial-assistant";
import type { SpatialDraft } from "../../src/parallax/authoring";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ actionTimeout: 30000, viewport: { width: 1440, height: 1000 }, video: "on" });
// The owned runner installs an upstream-only synthetic interceptor. A generic
// browser server has no such interception and must never turn this into a paid call.
test.skip(process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1", "Run the guarded unpaid Parallax browser fixture.");
test.afterAll(() => db.$disconnect());
const artifactRoot = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
const createRequest = "Create a pirate map on a desk with a readable clue and a guided alternative.";
const refineRequest = "Make that pirate map wider, keeping its clue and placement unchanged.";

async function capture(page: Page, name: string) {
  await mkdir(artifactRoot, { recursive: true });
  await page.screenshot({ path: `${artifactRoot}/${name}.png`, fullPage: true });
}
async function ownedWorking(accountId: string, definitionId: string) {
  const item = await db.reusableAuthoringItem.findFirstOrThrow({
    where: { id: definitionId, ownerAccountId: accountId, kind: spatialItemKind, archivedAt: null },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  return { draft: JSON.parse(item.versions[0].envelope) as SpatialDraft, revision: item.currentVersionNumber };
}
const assistantResponse = (page: Page, kind: string) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/studio/parallax") &&
      response.request().method() === "POST" &&
      (kind === "ASSISTANT_APPLY"
        ? response.request().postDataJSON()?.action === kind
        : response.request().postDataJSON()?.kind === kind),
  );

test("Creator signs in, reviews actual canvas proposals, saves once and reopens an exact Chronicle pin", async ({
  page,
}) => {
  ensureGenericSoundingLineIsolation();
  if (process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1")
    throw new Error("PARALLAX_A1_UNPAID_PROVIDER_FIXTURE_REQUIRED");
  const account = await closureAccount("Synthetic Spatial Assistant Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const email = await db.accountEmail.findFirstOrThrow({ where: { accountId: account.id, isPrimary: true } });
  const password = "Synthetic-Parallax-Browser-2026!";
  await db.accountCredential.create({ data: { accountId: account.id, passwordHash: await hash(password, 10) } });
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  const tale = await createStudioTale({
    title: "Synthetic Assistant Chronicle",
    slug: `a1-browser-${randomUUID()}`,
    creatorId: account.id,
  });
  const source = await getStudioTale(tale.id),
    blockId = randomUUID(),
    finaleId = randomUUID();
  await saveStudioDraft(
    tale.id,
    {
      ...source.draft,
      tale: source.tale,
      chapters: [
        {
          ...source.draft.chapters[0],
          blocks: [
            {
              id: blockId,
              blockType: "narrative",
              title: "Map passage",
              configuration: {
                ...getBlockDefinition("narrative")!.defaultConfiguration,
                heading: "A harbor clue",
                body: "Read the map, then continue.",
              },
              presentation: {},
              completion: { mode: "playerConfirmation" },
              nextBlockId: finaleId,
            },
            {
              id: finaleId,
              blockType: "taleComplete",
              title: "Voyage Complete",
              configuration: {
                ...getBlockDefinition("taleComplete")!.defaultConfiguration,
                finaleHeading: "The map is read",
                finaleContent: "The voyage is complete.",
              },
              presentation: {},
              completion: { mode: "playerConfirmation" },
            },
          ],
        },
      ],
    },
    account.id,
  );
  const progressionBefore = {
    sessions: await db.taleSession.count(),
    events: await db.taleSessionEvent.count(),
    progress: await db.progressEvent.count(),
  };
  const postBodies: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/studio/parallax") && request.method() === "POST")
      postBodies.push(request.postDataJSON());
  });
  await page.goto("/");
  await page.locator(".shell-profile-trigger").click();
  await page.getByRole("link", { name: "Sign In", exact: true }).click();
  await page.getByLabel("Email or Player name").fill(email.normalizedEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const signIn = page.waitForResponse((response) => response.url().endsWith("/api/auth/sign-in"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await signIn).ok()).toBe(true);
  await expect(page.locator(".shell-profile-trigger")).toContainText("Synthetic Spatial Assistant Creator");
  await page.locator(".shell-profile-trigger").click();
  await page.getByRole("link", { name: "Creator Studio", exact: true }).click();
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/parallax/);
  await page.goto(`/studio/parallax?chronicle=${tale.id}&block=${blockId}`);
  await expect(page.getByRole("heading", { name: "Parallax", level: 1 })).toBeVisible();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  await expect(canvas.locator('[data-renderer="READY"]')).toBeVisible();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
  await expect(assistant.getByRole("heading", { name: /What would you like/ })).toBeVisible();
  await capture(page, "welcome-guided-desktop");
  await assistant.getByLabel("Describe your spatial idea").fill(createRequest);
  const creating = assistantResponse(page, "ASSISTANT");
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  await expect(assistant.getByRole("button", { name: "Cancel request", exact: true })).toBeVisible();
  await capture(page, "active-inference");
  const createResponse = await creating,
    createdBody = await createResponse.json();
  expect(createResponse.ok(), JSON.stringify(createdBody)).toBe(true);
  const proposal = createdBody.proposal as AssistantProposal;
  const request = createResponse.request().postDataJSON();
  expect(request).toMatchObject({
    action: "AI",
    kind: "ASSISTANT",
    request: createRequest,
    mode: "STANDARD",
    revision: 1,
  });
  expect(Object.keys(request).sort()).toEqual(
    [
      "action",
      "draft",
      "editorGeneration",
      "idempotencyKey",
      "kind",
      "mode",
      "previousRequestId",
      "request",
      "requestId",
      "revision",
      "selectedEntityId",
    ].sort(),
  );
  const base = await ownedWorking(account.id, request.draft.content.definitionId);
  expect(base.draft.content.entities).toHaveLength(1);
  const expected = await materializeAssistantProposal(
    base.draft,
    base.revision,
    proposal,
    undefined,
    proposal.editorGeneration,
  );
  await expect(assistant.getByRole("heading", { name: "A pirate map for your desk" })).toBeVisible();
  await capture(page, "completed-proposal");
  await assistant.getByRole("button", { name: "Proposed scene", exact: true }).click();
  const mapButton = canvas.getByRole("button", { name: /^Pirate map\./ });
  await expect(mapButton).toBeVisible();
  await expect(canvas.locator("canvas")).toBeVisible();
  expect((await ownedWorking(account.id, request.draft.content.definitionId)).revision).toBe(base.revision);
  await capture(page, "proposed-canvas");
  await assistant.getByRole("button", { name: "Locate object", exact: true }).click();
  await expect(mapButton).toHaveAttribute("aria-pressed", "true");
  await capture(page, "object-highlight");
  await assistant.getByRole("button", { name: "Current scene", exact: true }).click();
  await expect(mapButton).toHaveCount(0);
  await capture(page, "current-scene-review");
  await assistant.getByRole("button", { name: "Proposed scene", exact: true }).click();
  const applying = assistantResponse(page, "ASSISTANT_APPLY");
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  const savedResponse = await applying,
    savedBody = await savedResponse.json();
  expect(savedResponse.ok(), JSON.stringify(savedBody)).toBe(true);
  expect(savedBody.draft).toEqual(expected);
  await expect(assistant).toContainText("Your changes are saved");
  const canvasCheck = assistant.getByRole("region", { name: "Saved scene canvas check", exact: true });
  await expect(canvasCheck).toBeVisible();
  await expect(canvasCheck).not.toContainText("Canvas confirmation is pending");
  await expect(canvasCheck).toContainText(/rendered in the current view|saved, but|saved hidden as authored/);
  const saved = await ownedWorking(account.id, request.draft.content.definitionId);
  expect(saved).toEqual({ draft: expected, revision: base.revision + 1 });
  const ledger = await db.aIUsageLedger.findFirstOrThrow({
    where: { accountId: account.id, requestId: request.requestId },
  });
  expect(ledger.status).toBe("SETTLED");
  expect(ledger.applicationRevision).toBe(saved.revision);
  expect(ledger.applicationKey).toBe(savedResponse.request().postDataJSON().idempotencyKey);
  expect(ledger.settledCostNano).toBe(BigInt(150000));
  await capture(page, "apply-confirmation");
  await assistant.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(mapButton).toHaveCount(0);
  await assistant.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(mapButton).toBeVisible();
  await saveCurrentWorkingDraft(page);
  await expect
    .poll(async () => (await ownedWorking(account.id, request.draft.content.definitionId)).draft)
    .toEqual(expected);
  await page.reload();
  await expect(canvas.locator('[data-renderer="READY"]')).toBeVisible();
  await expect(mapButton).toBeVisible();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  await assistant.getByLabel("Describe your spatial idea").fill(refineRequest);
  const refining = assistantResponse(page, "ASSISTANT");
  await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
  const refinedResponse = await refining,
    refinedBody = await refinedResponse.json();
  expect(refinedResponse.ok(), JSON.stringify(refinedBody)).toBe(true);
  expect(refinedResponse.request().postDataJSON().previousRequestId).toBe(request.requestId);
  expect(refinedBody.proposal.operations).toMatchObject([
    { type: "CONTENT", entityId: "synthetic-pirate-map", widthMeters: 0.45 },
  ]);
  await assistant.getByRole("button", { name: "Apply all changes", exact: true }).click();
  await expect(assistant).toContainText("Your changes are saved");
  const refined = await ownedWorking(account.id, request.draft.content.definitionId);
  expect(refined.draft.content.entities.find((entity) => entity.id === "synthetic-pirate-map")).toEqual({
    ...expected.content.entities[1],
    widthMeters: 0.45,
  });
  await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  await openCurrentScenePublication(page);
  await page.getByRole("button", { name: "Save to Spatial Library", exact: true }).click();
  await page.getByText("Scene actions", { exact: true }).click();
  await page.getByRole("button", { name: "Validate in Drydock", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Drydock spatial checks complete" })).toBeVisible();
  await page.getByText("Scene actions", { exact: true }).click();
  await page.getByRole("button", { name: "Create immutable version", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Immutable version created" })).toBeVisible();
  await page.getByRole("button", { name: "Attach exact version", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pinned spatial version attached" })).toBeVisible();
  const attached = await getStudioTale(tale.id);
  const capsule = validateSpatialMoment(attached.draft.chapters[0].blocks[0].presentation.spatialMoment, blockId);
  expect(capsule.version.entities.find((entity) => entity.id === "synthetic-pirate-map")?.widthMeters).toBe(0.45);
  const pin = capsule.version.checksum;
  await page.goto(
    `/studio/parallax?chronicle=${tale.id}&definition=${capsule.definition.id}&entity=synthetic-pirate-map&block=${blockId}`,
  );
  await expect(page.getByLabel("Clue or message")).toHaveValue("Follow the northern harbor bearing.");
  await page.getByRole("combobox", { name: "Workspace layout", exact: true }).selectOption("SPATIAL");
  await openCurrentScenePublication(page);
  await page.getByRole("button", { name: /v1.0.0 · 2 objects/ }).click();
  await expect(page.getByText(`Pinned ${pin.slice(0, 16)}…`, { exact: true })).toBeVisible();
  expect({
    sessions: await db.taleSession.count(),
    events: await db.taleSessionEvent.count(),
    progress: await db.progressEvent.count(),
  }).toEqual(progressionBefore);
  expect(await page.locator("body").textContent()).not.toContain("parallax-a1-synthetic-provider-only");
  const accessibility = await new AxeBuilder({ page }).include("#parallax-assistance").analyze();
  expect(accessibility.violations.filter((finding) => ["serious", "critical"].includes(finding.impact ?? ""))).toEqual(
    [],
  );
  await writeFile(
    `${artifactRoot}/creator-journey.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        steps: 28,
        provider: "SYNTHETIC_UNPAID",
        definitionId: capsule.definition.id,
        pinnedChecksum: pin,
        requestId: request.requestId,
        applicationRevision: saved.revision,
        progressionUnchanged: true,
        postActions: postBodies.map((body) => ({ action: body.action, kind: body.kind })),
      },
      null,
      2,
    ),
  );
});
