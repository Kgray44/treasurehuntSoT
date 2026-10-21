// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.creator-entry
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { getStudioTale } from "../../src/chronicle/studio-service";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantResourceExperiences } from "../../.agents/scripts/sextant-resource-fixtures";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ video: "on", trace: "retain-on-failure", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test.describe(`${viewport.width}px ${reducedMotion}`, () => {
      test.use({ viewport, contextOptions: { reducedMotion } });
      test("ordinary Creator entry, cancel, actual private draft creation and library reopen", async ({
        page,
      }, info) => {
        const key = `creator-entry-${viewport.width}-${reducedMotion}` as
          | "creator-entry-1280-no-preference"
          | "creator-entry-1280-reduce"
          | "creator-entry-390-no-preference"
          | "creator-entry-390-reduce";
        const fixture = await seedSextantResourceExperiences(key);
        expect(await seedSextantResourceExperiences(key)).toEqual(fixture);
        const title = `Synthetic Sextant created course ${key}`;
        const slug = `sextant-created-${key}`;
        const voyageIds = [fixture.voyageId, fixture.playerVoyageId];
        const baseline = await db.taleSession.findMany({
          where: { id: { in: voyageIds } },
          orderBy: { id: "asc" },
          select: { id: true, status: true, currentSequence: true, currentBlockId: true, publishedVersionId: true },
        });
        expect(baseline).toHaveLength(2);
        const editionIds = baseline.map((row) => row.publishedVersionId!);
        const editions = await db.publishedTaleVersion.findMany({
          where: { id: { in: editionIds } },
          orderBy: { id: "asc" },
          select: { id: true, checksum: true, contentSnapshot: true },
        });
        const countBefore = await db.chronicle.count({ where: { creatorAccountId: fixture.ownerId } });
        expect(await db.chronicle.findUnique({ where: { slug } })).toBeNull();
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const began = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - began;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const capture = async (name: string, selector: string, target = page.getByRole("heading", { level: 1 })) => {
          expect((await new AxeBuilder({ page }).include(selector).analyze()).violations).toEqual([]);
          await target.scrollIntoViewIfNeeded();
          await expect(target).toBeInViewport();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        await page.goto("/sign-in?returnTo=%2Faccount");
        await page.getByRole("textbox", { name: "Email or Player name", exact: true }).fill(fixture.email);
        await page.getByRole("textbox", { name: "Password", exact: true }).fill("Synthetic-Sextant-Resources-2026!");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        await page.getByRole("button", { name: fixture.displayName, exact: true }).click();
        await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
        await measure(
          "Ordinary Creator workspace entry",
          () => page.getByRole("link", { name: "Enter Creator", exact: true }).click(),
          () => expect(page.getByRole("heading", { level: 1, name: "Voyagewright Studio", exact: true })).toBeVisible(),
        );
        const create = page.getByRole("link", { name: "Create Chronicle", exact: true });
        const submit = page.getByRole("button", { name: "Create and open Chronicle", exact: true });
        await measure(
          "Prepared new Chronicle form",
          () => create.click(),
          () => expect(submit).toBeEnabled(),
        );
        await capture("creator-entry-form", ".new-tale-page");
        await page.getByRole("textbox", { name: "Title", exact: true }).fill("Synthetic cancelled course");
        await page.getByRole("link", { name: "Cancel", exact: true }).click();
        await expect(page.getByRole("heading", { level: 1, name: "Voyagewright Studio", exact: true })).toBeVisible();
        expect(await db.chronicle.count({ where: { creatorAccountId: fixture.ownerId } })).toBe(countBefore);
        await measure(
          "Reopen secure creation form",
          () => create.click(),
          () => expect(submit).toBeEnabled(),
        );
        await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
        await page.getByRole("textbox", { name: "Address /play/", exact: true }).fill(slug);
        await page
          .getByRole("textbox", { name: "Short description", exact: true })
          .fill("Reserved synthetic course for owned Creator entry verification.");
        await page.getByRole("textbox", { name: "Initial chapter title", exact: true }).fill("A synthetic opening");
        await page.getByRole("combobox", { name: "Visibility", exact: true }).selectOption("PRIVATE");
        await capture("creator-entry-confirm", ".new-tale-page", submit);
        let created: { id: string; slug: string; draftId: string } | undefined;
        await measure(
          "Actual private Chronicle creation",
          async () => {
            const response = page.waitForResponse(
              (r) => new URL(r.url()).pathname === "/api/studio/tales" && r.request().method() === "POST",
            );
            await submit.click();
            const result = await response;
            expect(result.status()).toBe(201);
            created = await result.json();
          },
          () => expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible(),
        );
        if (!created?.id || created.slug !== slug) throw new Error("SEXTANT_CREATED_DRAFT_IDENTITY_MISSING");
        await expect(page).toHaveURL(new RegExp(`/studio/tales/${created.id}$`));
        const draft = await getStudioTale(created.id);
        expect(draft.tale).toMatchObject({
          title,
          slug,
          status: "DRAFT",
          visibility: "PRIVATE",
        });
        expect(
          await db.chronicle.findUniqueOrThrow({ where: { id: created.id }, select: { creatorAccountId: true } }),
        ).toEqual({ creatorAccountId: fixture.ownerId });
        expect(draft.draft.id).toBe(created.draftId);
        expect(draft.draft.chapters).toHaveLength(1);
        expect(draft.draft.chapters[0]).toMatchObject({ title: "A synthetic opening", blocks: [] });
        expect(draft.versions).toHaveLength(0);
        expect(await db.taleSession.count({ where: { taleId: created.id } })).toBe(0);
        expect(await db.chronicle.count({ where: { creatorAccountId: fixture.ownerId } })).toBe(countBefore + 1);
        await capture("creator-entry-draft", ".tale-editor");
        const chapterTitle = page.getByRole("textbox", { name: "Chapter 1 title", exact: true });
        await expect(chapterTitle).toHaveValue("A synthetic opening");
        await capture("creator-entry-chapter", ".tale-editor", chapterTitle);
        const emptyInspector = page.locator(".block-inspector");
        await expect(emptyInspector).toHaveAttribute("data-inspector-state", "closed");
        if (viewport.width <= 760) await expect(emptyInspector).toBeHidden();
        else
          await capture(
            "creator-entry-inspector",
            ".tale-editor",
            page.getByRole("region", { name: "Passage Inspector", exact: true }),
          );
        await page.getByRole("link", { name: "← Studio", exact: true }).click();
        const card = page
          .locator(".tale-studio-card")
          .filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });
        await expect(card).toHaveCount(1);
        await expect(card).toContainText("Not published");
        await capture("creator-entry-library", ".studio-home", card.getByRole("heading", { level: 2 }));
        await capture(
          "creator-entry-library-edit",
          ".studio-home",
          card.getByRole("link", { name: "Edit Chronicle", exact: true }),
        );
        await measure(
          "Reopen actual new draft",
          () => card.getByRole("link", { name: "Edit Chronicle", exact: true }).click(),
          () => expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible(),
        );
        await page.getByRole("link", { name: "← Studio", exact: true }).click();
        await measure(
          "Ordinary Personal Harbor return",
          async () => {
            await page.getByRole("button", { name: fixture.displayName, exact: true }).click();
            await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
          },
          () => expect(page.getByRole("heading", { level: 1, name: "Overview", exact: true })).toBeVisible(),
        );
        await expect(page.getByRole("button", { name: fixture.displayName, exact: true })).toBeVisible();
        await capture("creator-entry-account-return", ".personal-harbor");
        expect(
          await db.taleSession.findMany({
            where: { id: { in: voyageIds } },
            orderBy: { id: "asc" },
            select: { id: true, status: true, currentSequence: true, currentBlockId: true, publishedVersionId: true },
          }),
        ).toEqual(baseline);
        expect(
          await db.publishedTaleVersion.findMany({
            where: { id: { in: editionIds } },
            orderBy: { id: "asc" },
            select: { id: true, checksum: true, contentSnapshot: true },
          }),
        ).toEqual(editions);
        expect(await db.publishedTaleVersion.count({ where: { taleId: created.id } })).toBe(0);
        expect(await db.taleSession.count({ where: { taleId: created.id } })).toBe(0);
        await writeFile(
          info.outputPath("creator-entry-journey-receipt.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              classification: "ENGINEERING_SYNTHETIC_CREATOR_ENTRY_DEVELOPMENT_NOT_ACCEPTANCE",
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-creator-entry-journeys.spec.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              baseline,
              feedback,
              created: {
                taleId: created.id,
                draftId: created.draftId,
                status: "DRAFT",
                visibility: "PRIVATE",
                versions: 0,
                sessions: 0,
              },
              cancellationCreatedNothing: true,
              ordinaryAccountReturn: true,
              exactReleasedBytesUnchanged: true,
              coverUploadCovered: false,
              privatePackageWorkflowCovered: false,
              publishingReadinessProved: false,
              protectedAcceptance: false,
            },
            null,
            2,
          ) + "\n",
        );
      });
    });
  }
}
