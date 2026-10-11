import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure, openClosureJournal } from "./fixtures/landfall-closure";
import { startTaleSession } from "../../src/chronicle/progression";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createStudioTale, getStudioTale, saveStudioDraft } from "../../src/chronicle/studio-service";
import { validateSpatialMoment } from "../../src/parallax/publication";
import { getBlockDefinition } from "../../src/chronicle/block-registry";
test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
test("Remote Creator stages, publishes and reopens an adaptive multi-object Chronicle", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Parallax Creator");
  const player = await closureAccount("Synthetic Parallax field Player");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const tale = await createStudioTale({
    title: "Synthetic Spatial Studio Chronicle",
    slug: `parallax-studio-${randomUUID()}`,
    creatorId: account.id,
    visibility: "UNLISTED",
  });
  const source = await getStudioTale(tale.id);
  const blockId = randomUUID(),
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
              title: "Spatial passage",
              configuration: {
                ...getBlockDefinition("narrative")!.defaultConfiguration,
                heading: "A clue between worlds",
                body: "Inspect the map, then continue.",
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
                finaleHeading: "You found the clue",
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
  try {
    await authenticateClosure(context, account, baseURL!);
    await page.goto("/studio");
    await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/parallax/);
    await page.goto(`/studio/parallax?chronicle=${tale.id}&block=${blockId}`);
    await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Authoring mode")).toHaveValue("GUIDED");
    await mkdir("artifacts/parallax-phase3/browser", { recursive: true });
    await page.getByText("Spatial Placement & grouping", { exact: true }).click();
    await page.getByRole("button", { name: "Author remotely", exact: true }).click();
    await page
      .getByLabel("Semantic placement goal")
      .fill("Place a pirate map on a table near furniture away from the walkway");
    await page.getByRole("button", { name: "Interpret supported phrase" }).click();
    await expect(page.getByRole("region", { name: "Adaptive placement" })).toContainText("Surfaces: TABLE");
    await page.getByRole("button", { name: "Apply reviewed recipe" }).click();
    await page.getByLabel("Placement policy").selectOption("ADAPTIVE_PER_RUN");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await page.getByRole("button", { name: "Open Scene Hierarchy", exact: true }).click();
    await page
      .getByRole("region", { name: "Scene graph" })
      .getByRole("button", { name: "◇ Desk Map copy", exact: true })
      .click();
    await page.getByLabel("Object name", { exact: true }).fill("Captain's journal");
    await page.getByLabel("Semantic surface").selectOption("DESK");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await page
      .getByRole("region", { name: "Scene graph" })
      .getByRole("button", { name: "◇ Captain's journal copy", exact: true })
      .click();
    await page.getByLabel("Object name", { exact: true }).fill("Hidden writing");
    await page.getByLabel("Semantic surface").selectOption("WALL");
    await page.getByLabel("Nearby context").selectOption("ANY");
    for (const mode of ["GUIDED", "DETAILED", "ENGINEERING"]) {
      await page.getByLabel("Authoring mode").selectOption(mode);
      await page.screenshot({ path: `artifacts/parallax-phase3/browser/studio-desktop-${mode}.png`, fullPage: true });
    }
    await page.getByLabel("Authoring mode").selectOption("GUIDED");
    await page.getByText("Spatial Placement & grouping", { exact: true }).click();
    await page.getByLabel("Environment", { exact: true }).selectOption("living-room");
    await expect(page.getByRole("region", { name: "Spatial canvas" })).toContainText("Living room");
    await page.screenshot({ path: "artifacts/parallax-phase3/browser/living-room.png", fullPage: true });
    await page.getByLabel("Environment", { exact: true }).selectOption("empty");
    await expect(page.getByRole("region", { name: "Spatial canvas" })).toContainText("CAMERA FREE");
    await page.screenshot({ path: "artifacts/parallax-phase3/browser/no-safe-staging.png", fullPage: true });
    await page.getByLabel("Environment", { exact: true }).selectOption("bedroom");
    await page
      .getByRole("region", { name: "Scene graph" })
      .getByRole("button", { name: "◇ Desk Map", exact: true })
      .click();
    await page.getByText("Discovery assistance", { exact: true }).click();
    for (const i of [1, 2, 3]) await page.getByLabel(`Hint ${i} seconds`, { exact: true }).fill(String(i));
    await page.getByLabel("Expected search seconds").fill("1");
    await page.getByLabel("Maximum unguided seconds").fill("3");
    await page.getByText("Calibration and field quality", { exact: true }).click();
    await page.getByLabel("Offer optional metadata field observations").check();
    await page.getByText("Library, reuse & publication", { exact: true }).click();
    await page.getByLabel("Experience title").fill("Captain's reusable map");
    await page.getByLabel("Clue or message").fill("The northern harbor is your next bearing.");
    await page.getByRole("button", { name: "Save to Spatial Library", exact: true }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Working draft saved");
    await page.getByRole("combobox", { name: "Preview", exact: true }).selectOption("FALLBACK");
    await expect(page.getByRole("region", { name: "Spatial canvas" })).toContainText(
      "The northern harbor is your next bearing.",
    );
    await page.getByText("Scene actions", { exact: true }).click();
    await page.getByRole("button", { name: "Validate in Drydock" }).click();
    await expect(page.getByRole("status")).toContainText("Drydock spatial checks complete");
    await page.getByText("Scene actions", { exact: true }).click();
    await page.getByRole("button", { name: "Create immutable version" }).click();
    await expect(page.getByRole("status")).toContainText("Immutable version created");
    await page.getByRole("button", { name: "Attach exact version" }).click();
    await expect(page.getByRole("status")).toContainText("Pinned spatial version attached");
    await page.getByRole("button", { name: "Undo attachment", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Spatial attachment undone");
    expect((await getStudioTale(tale.id)).draft.chapters[0].blocks[0].presentation.spatialMoment).toBeUndefined();
    await page.getByRole("button", { name: "Redo attachment", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Spatial attachment redone");
    const saved = await getStudioTale(tale.id);
    const capsule = validateSpatialMoment(saved.draft.chapters[0].blocks[0].presentation.spatialMoment, blockId);
    expect(capsule.version.entities[0].content).toBe("The northern harbor is your next bearing.");
    expect(capsule.definition.libraryScope).toBe("MY_LIBRARY");
    expect(capsule.version.placementPolicy).toBe("ADAPTIVE_PER_RUN");
    expect(capsule.version.adaptive?.recipes).toHaveLength(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "artifacts/parallax-phase3/browser/studio-mobile-GUIDED.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: "artifacts/screenshots/parallax-studio-desktop.png", fullPage: true });
    await page.goto(`/studio/tales/${tale.id}`);
    const [validationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/studio/tales/${tale.id}/validate`) && response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Validate Chronicle", exact: true }).click(),
    ]);
    const validationResult = await validationResponse.json();
    expect(validationResponse.ok(), JSON.stringify(validationResult)).toBe(true);
    expect(validationResult.valid).toBe(true);
    await expect(page.locator(".save-state")).toContainText("Draft validation passed");
    await page.goto(`/studio/tales/${tale.id}/trials`);
    await page.getByLabel("Scenario title").fill("Spatial Studio pinned publication path");
    await page.getByRole("checkbox", { name: /Baseline successful path/i }).check();
    await page.getByRole("button", { name: "Add Continue", exact: true }).click();
    await page.getByRole("button", { name: "Add Continue", exact: true }).click();
    await page.getByRole("button", { name: "Save and run Sea Trial" }).click();
    await expect(page.getByRole("region", { name: "Sea Trial receipt" })).toContainText("COMPLETED");
    await page.getByRole("button", { name: "Save current revisions as Suite" }).click();
    await page.getByRole("button", { name: "Run Suite", exact: true }).click();
    await page.reload();
    await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible();
    await page.goto(`/studio/tales/${tale.id}/versions#publication-review`);
    await page.getByLabel("Creator release notes").fill("Synthetic local Spatial Studio qualification.");
    await page.getByRole("checkbox", { name: /publishing creates an immutable Version/i }).check();
    await page.getByRole("button", { name: "Publish immutable Version" }).click();
    await expect(page.getByRole("heading", { name: "Immutable publication committed" })).toBeVisible();
    const published = await db.publishedTaleVersion.findFirstOrThrow({
      where: { taleId: tale.id },
      orderBy: { versionNumber: "desc" },
    });
    const reopened = JSON.parse(published.contentSnapshot);
    expect(
      validateSpatialMoment(reopened.chapters[0].blocks[0].presentation.spatialMoment, blockId).version.checksum,
    ).toBe(capsule.version.checksum);
    await page.goto(
      `/studio/parallax?chronicle=${tale.id}&definition=${capsule.definition.id}&entity=${capsule.version.entities[0].id}&block=${blockId}`,
    );
    await expect(page.getByLabel("Clue or message")).toHaveValue("The northern harbor is your next bearing.");
    await page.getByLabel("Workspace layout").selectOption("SPATIAL");
    const publicationSection = page.getByText("Library, reuse & publication", { exact: true });
    if ((await publicationSection.locator("..").getAttribute("open")) === null) await publicationSection.click();
    await expect(page.getByRole("button", { name: /v1.0.0/ })).toBeVisible();
    const play = await startTaleSession(source.tale.slug, {
      accountId: player.id,
      profileId: player.profileId,
      canonicalDisplayName: "Synthetic Parallax field Player",
    });
    await authenticateClosure(context, player, baseURL!);
    const before = await db.taleSession.findUniqueOrThrow({ where: { id: play.sessionId } });
    await openClosureJournal(page, play.sessionId, baseURL);
    await page.getByRole("button", { name: "Open Chronicle Lens", exact: true }).click();
    const lens = page.getByRole("dialog", { name: "Captain's reusable map", exact: true });
    await expect(lens.getByText("Guided View", { exact: true })).toBeVisible();
    await expect(lens.getByRole("region", { name: "Discovery assistance" })).toContainText(
      "The clue is ready in Guided View",
      { timeout: 10000 },
    );
    await lens.getByRole("button", { name: "Show me", exact: true }).click();
    await lens.getByRole("button", { name: "Inspect", exact: true }).first().click();
    await expect(lens.getByRole("status")).toContainText("Interaction recorded");
    await lens.getByText("Optional field feedback", { exact: true }).click();
    await expect(lens.getByRole("button", { name: "Share optional feedback" })).toBeDisabled();
    await lens.getByLabel("I agree to share these categories").check();
    await page.route(`**/api/player/playthroughs/${play.sessionId}/parallax/field`, (route) => route.abort(), {
      times: 1,
    });
    await lens.getByRole("button", { name: "Share optional feedback" }).click();
    await expect(lens.getByRole("button", { name: "Share optional feedback" })).toBeEnabled();
    expect(await db.parallaxFieldObservation.count({ where: { sessionId: play.sessionId } })).toBe(0);
    await lens.getByRole("button", { name: "Share optional feedback" }).click();
    await expect(lens.getByText("Optional feedback shared. Chronicle completion is unaffected.")).toBeVisible();
    expect(
      (await db.parallaxFieldObservation.findFirstOrThrow({ where: { sessionId: play.sessionId } })).provenance,
    ).toBe("SIMULATED");
    const a11yLens = await new AxeBuilder({ page }).include("dialog[open]").analyze();
    expect(a11yLens.violations.filter((v) => ["critical", "serious"].includes(v.impact || ""))).toEqual([]);
    await page.screenshot({ path: "artifacts/parallax-phase3/browser/lens-desktop-consent.png", fullPage: true });
    await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open Chronicle Lens", exact: true }).click();
    await lens.getByText("Optional field feedback", { exact: true }).click();
    await expect(lens.getByRole("button", { name: "Withdraw feedback" })).toBeVisible();
    await page.screenshot({ path: "artifacts/parallax-phase3/browser/lens-mobile-feedback.png", fullPage: true });
    await lens.getByRole("button", { name: "Withdraw feedback" }).click();
    await expect(lens.getByText("Feedback withdrawn and deleted.")).toBeVisible();
    expect(await db.parallaxFieldObservation.count({ where: { sessionId: play.sessionId } })).toBe(0);
    await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
    const after = await db.taleSession.findUniqueOrThrow({ where: { id: play.sessionId } });
    expect(after.currentSequence).toBe(before.currentSequence);
    expect(after.currentBlockId).toBe(before.currentBlockId);
    expect(await db.parallaxResolutionDecision.count({ where: { versionId: capsule.version.id } })).toBe(1);
    // Exercise the self-report/review product contract with an invented attestation.
    // This fixture is software workflow proof, never physical AR qualification.
    await page.getByRole("button", { name: "Open Chronicle Lens", exact: true }).click();
    await lens.getByText("Optional field feedback", { exact: true }).click();
    await lens.getByLabel("I agree to share these categories").check();
    await lens.getByLabel("I personally tested the placement in a physical environment").check();
    await lens.getByLabel("The intended placement worked in my physical test").check();
    await lens.getByLabel("Confidence in your report").selectOption("HIGH");
    await lens.getByLabel("Observed surface").selectOption("TABLE");
    await lens.getByRole("button", { name: "Share optional feedback" }).click();
    await expect(lens.getByText("Optional feedback shared. Chronicle completion is unaffected.")).toBeVisible();
    const fixtureReport = await db.parallaxFieldObservation.findFirstOrThrow({ where: { sessionId: play.sessionId } });
    expect(fixtureReport.provenance).toBe("PLAYER_REPORTED_PHYSICAL");
    await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticateClosure(context, account, baseURL!);
    await page.goto(`/studio/parallax?chronicle=${tale.id}&definition=${capsule.definition.id}&block=${blockId}`);
    await page.getByLabel("Workspace layout").selectOption("SPATIAL");
    await page.getByText("Spatial Placement & grouping", { exact: true }).click();
    await page.getByLabel("Nearby context").selectOption("ANY");
    await page.getByText("Field quality and Creator calibration review", { exact: true }).click();
    await page.getByRole("button", { name: "Load field quality", exact: true }).click();
    await page.getByLabel("Consented observation").selectOption(fixtureReport.id);
    await page.getByRole("button", { name: "Approve Creator review", exact: true }).click();
    await expect(page.getByRole("button", { name: "Approve calibration refinement", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Approve calibration refinement", exact: true }).click();
    await expect(page.getByRole("button", { name: "Verify independent later encounters", exact: true })).toBeEnabled();
    await page.screenshot({ path: "artifacts/parallax-phase3/browser/creator-field-refinement.png", fullPage: true });
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Working draft saved");
    await page.getByText("Scene actions", { exact: true }).click();
    await page.getByRole("button", { name: "Create immutable version", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Immutable version created");
    await page.getByText("Library, reuse & publication", { exact: true }).click();
    await page.getByLabel("Attach to Passage").selectOption(blockId);
    await page.getByRole("button", { name: "Attach exact version", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Pinned spatial version attached");
    const refined = await getStudioTale(tale.id);
    const refinedCapsule = validateSpatialMoment(
      refined.draft.chapters[0].blocks[0].presentation.spatialMoment,
      blockId,
    );
    expect(refinedCapsule.version.id).not.toBe(capsule.version.id);
    expect(refinedCapsule.version.adaptive?.calibration.maturity).toBe("CALIBRATED");
    const retainedPublication = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: published.id } });
    expect(retainedPublication.contentSnapshot).toBe(published.contentSnapshot);
    expect(
      validateSpatialMoment(
        JSON.parse(retainedPublication.contentSnapshot).chapters[0].blocks[0].presentation.spatialMoment,
        blockId,
      ).version.checksum,
    ).toBe(capsule.version.checksum);
    await page.reload();
    await expect(page.getByLabel("Clue or message")).toHaveValue("The northern harbor is your next bearing.");
    const placementSection = page.getByText("Spatial Placement & grouping", { exact: true });
    if ((await placementSection.locator("..").getAttribute("open")) === null) await placementSection.click();
    await expect(page.getByLabel("Authoring approach")).toHaveValue("EVIDENCE_CALIBRATED");
    await page.goto(`/studio/tales/${tale.id}`);
    await page.getByRole("button", { name: "Validate Chronicle", exact: true }).click();
    await expect(page.locator(".save-state")).toContainText("Draft validation passed");
    await page.goto(`/studio/tales/${tale.id}/trials`);
    await page.getByLabel("Scenario title").fill("Synthetic calibrated refinement publication");
    await page.getByRole("checkbox", { name: /Baseline successful path/i }).check();
    await page.getByRole("button", { name: "Add Continue", exact: true }).click();
    await page.getByRole("button", { name: "Add Continue", exact: true }).click();
    await page.getByRole("button", { name: "Save and run Sea Trial" }).click();
    await expect(page.getByRole("region", { name: "Sea Trial receipt" })).toContainText("COMPLETED");
    await page.getByRole("button", { name: "Save current revisions as Suite" }).click();
    await page.getByRole("button", { name: "Run Suite", exact: true }).click();
    await page.reload();
    await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible();
    await page.goto(`/studio/tales/${tale.id}/versions#publication-review`);
    await page
      .getByLabel("Creator release notes")
      .fill("Invented self-report fixture: Creator-reviewed refinement; no physical certification.");
    await page.getByRole("checkbox", { name: /publishing creates an immutable Version/i }).check();
    await page.getByRole("button", { name: "Publish immutable Version" }).click();
    await expect(page.getByRole("heading", { name: "Immutable publication committed" })).toBeVisible();
    const republished = await db.publishedTaleVersion.findFirstOrThrow({
      where: { taleId: tale.id },
      orderBy: { versionNumber: "desc" },
    });
    expect(republished.versionNumber).toBe(published.versionNumber + 1);
    expect(
      validateSpatialMoment(
        JSON.parse(republished.contentSnapshot).chapters[0].blocks[0].presentation.spatialMoment,
        blockId,
      ).version.checksum,
    ).toBe(refinedCapsule.version.checksum);
    expect((await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: published.id } })).contentSnapshot).toBe(
      published.contentSnapshot,
    );
  } finally {
    // The guarded generic runner owns this disposable database. Keep immutable
    // publication and trial evidence together; its bound database is recreated
    // by the runner, rather than deleting a Chronicle with retained source pins.
    await db.$disconnect();
  }
});
