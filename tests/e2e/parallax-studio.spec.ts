import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createStudioTale, getStudioTale, saveStudioDraft } from "../../src/chronicle/studio-service";
import { validateSpatialMoment } from "../../src/parallax/publication";
import { getBlockDefinition } from "../../src/chronicle/block-registry";
test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
test("Creator builds, versions, attaches, publishes and reopens a spatial moment in Guided mode", async ({
  page,
  context,
  baseURL,
}) => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("PARALLAX_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Parallax Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  const tale = await createStudioTale({
    title: "Synthetic Spatial Studio Chronicle",
    slug: `parallax-studio-${randomUUID()}`,
    creatorId: account.id,
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
    await page.goto(`/studio/parallax?chronicle=${tale.id}&block=${blockId}`);
    await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Authoring mode")).toHaveValue("GUIDED");
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
    await page.setViewportSize({ width: 390, height: 844 });
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
  } finally {
    // The guarded generic runner owns this disposable database. Keep immutable
    // publication and trial evidence together; its bound database is recreated
    // by the runner, rather than deleting a Chronicle with retained source pins.
    await db.$disconnect();
  }
});
