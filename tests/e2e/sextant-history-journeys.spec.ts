// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.completed-history
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantResourceExperiences } from "../../.agents/scripts/sextant-resource-fixtures";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { enterClosureJournal } from "./fixtures/landfall-closure";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ video: "on", trace: "retain-on-failure", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
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
      test("ordinary canonical completion, personal grant, Passport detail/book/replay and provenance return", async ({
        page,
      }, info) => {
        const key = `history-${viewport.width}-${reducedMotion}` as
          | "history-1280-no-preference"
          | "history-1280-reduce"
          | "history-390-no-preference"
          | "history-390-reduce";
        const fixture = await seedSextantResourceExperiences(key);
        expect(await seedSextantResourceExperiences(key)).toEqual(fixture);
        const crew = await db.playerProfile.findFirstOrThrow({ where: { accountId: fixture.crewAccountId } });
        expect(await db.playerChronicleRecord.count({ where: { playerProfileId: crew.id } })).toBe(0);
        expect(await db.artifactGrantReceipt.count({ where: { sessionId: fixture.voyageId } })).toBe(0);
        const activeBaseline = await db.taleSession.findUniqueOrThrow({
          where: { id: fixture.playerVoyageId },
          select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
        });
        const edition = await db.publishedTaleVersion.findUniqueOrThrow({
          where: { id: fixture.versionId },
          select: { checksum: true, contentSnapshot: true },
        });
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (
          task: string,
          activate: () => Promise<unknown>,
          ready: () => Promise<unknown>,
        ) => {
          const started = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - started;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const passport = page.locator(".passport-shell");
        const passportCapture = async (name: string) => {
          expect((await new AxeBuilder({ page }).include(".passport-shell").analyze()).violations).toEqual(
            [],
          );
          await passport.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: info.outputPath(`${name}-heading.png`) });
          await passport
            .getByRole("heading", { level: 2, name: fixture.title, exact: true })
            .scrollIntoViewIfNeeded();
          await page.screenshot({ path: info.outputPath(`${name}-content.png`) });
        };
        await page.goto("/sign-in?returnTo=%2Faccount");
        await page
          .getByRole("textbox", { name: "Email or Player name", exact: true })
          .fill(fixture.crewEmail!);
        await page
          .getByRole("textbox", { name: "Password", exact: true })
          .fill("Synthetic-Sextant-Crew-2026!");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        const accountMenu = page.getByRole("button", { name: fixture.crewDisplayName, exact: true });
        await accountMenu.click();
        await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
        await page.getByRole("link", { name: "Return to Chronicle", exact: true }).click();
        await enterClosureJournal(page);
        const journal = page.getByRole("main", { name: "", exact: true });
        await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
        const advance = async (task: string, ready: () => Promise<unknown>) => {
          await measure(
            task,
            async () => {
              const response = page.waitForResponse(
                (r) =>
                  new URL(r.url()).pathname === `/api/play/sessions/${fixture.voyageId}` &&
                  r.request().method() === "POST",
              );
              await journal.getByRole("button", { name: "Continue Voyage", exact: true }).click();
              expect((await response).status()).toBe(200);
            },
            ready,
          );
        };
        const currentPassageIs = async (id: string) => {
          await expect
            .poll(
              async () =>
                (await db.taleSession.findUniqueOrThrow({ where: { id: fixture.voyageId } })).currentBlockId,
            )
            .toBe(id);
          await expect(journal.getByRole("button", { name: "Continue Voyage", exact: true })).toBeEnabled();
        };
        await advance("Narrative response and next action", () =>
          currentPassageIs(`sextant-history-grant-${key}`),
        );
        await advance("Personal grant response and next action", () =>
          currentPassageIs(`sextant-resource-ending-${key}`),
        );
        const historical = page.getByRole("region", { name: "Historical volume information", exact: true });
        await advance("Canonical Voyage completion and read-only feedback", () =>
          expect(historical).toContainText("read-only"),
        );
        const completed = await db.taleSession.findUniqueOrThrow({ where: { id: fixture.voyageId } });
        expect(completed.status).toBe("COMPLETED");
        expect(completed.completedAt).not.toBeNull();
        expect(
          (
            await db.playthroughMembership.findFirstOrThrow({
              where: { playthroughId: fixture.voyageId, playerProfileId: crew.id },
            })
          ).status,
        ).toBe("COMPLETED_MEMBER");
        const grants = await db.artifactGrantReceipt.findMany({ where: { sessionId: fixture.voyageId } });
        expect(grants).toHaveLength(1);
        expect(grants[0]).toMatchObject({
          recipientPolicy: "ALL_ACTIVE_PLAYERS",
          receiptState: "ACTIVE",
          personalGrantState: "COLLECTED",
          custodyKind: "PERSONAL",
          publishedVersionId: fixture.versionId,
        });
        expect(JSON.parse(grants[0].resolvedRecipientProfileIds)).toEqual([crew.id]);
        expect(
          await db.taleSessionEvent.count({
            where: { sessionId: fixture.voyageId, eventType: "sessionCompleted" },
          }),
        ).toBe(1);
        expect(
          (await db.taleSessionEvent.findUniqueOrThrow({ where: { id: grants[0].sourceEventId } })).eventType,
        ).toBe("artifactGranted");
        const completedProgress = {
          status: completed.status,
          currentBlockId: completed.currentBlockId,
          currentSequence: completed.currentSequence,
          publishedVersionId: completed.publishedVersionId,
        };
        const completedEventCount = await db.taleSessionEvent.count({
          where: { sessionId: fixture.voyageId },
        });
        const enterPassport = async () => {
          await accountMenu.click();
          await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
          await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
          await page.getByRole("link", { name: "Open Chronicle Passport", exact: true }).click();
        };
        await enterPassport();
        const sections = page.getByRole("navigation", { name: "Chronicle Passport sections", exact: true });
        const archiveCard = page
          .locator("article.wakebook-voyage-card")
          .filter({ has: page.getByRole("heading", { level: 3, name: fixture.title, exact: true }) });
        await measure(
          "Completed Your Voyages",
          () => sections.getByRole("link", { name: "Your Voyages", exact: true }).click(),
          () => expect(archiveCard).toContainText("Completed"),
        );
        const record = await db.playerChronicleRecord.findUniqueOrThrow({
          where: {
            playerProfileId_sourcePlaythroughId: {
              playerProfileId: crew.id,
              sourcePlaythroughId: fixture.voyageId,
            },
          },
        });
        expect(record).toMatchObject({
          lifecycleStatus: "COMPLETED",
          publishedVersionId: fixture.versionId,
          publishedVersionChecksum: edition.checksum,
        });
        await measure(
          "Actual completed Voyage Detail",
          () => archiveCard.getByRole("link", { name: `Open ${fixture.title} Voyage`, exact: true }).click(),
          () =>
            expect(
              passport.getByRole("heading", { level: 2, name: fixture.title, exact: true }),
            ).toBeVisible(),
        );
        await expect(page).toHaveURL(new RegExp(`/passport/history/${record.id}$`));
        await passportCapture("history-detail");
        const bookEntry = page.getByRole("link", { name: "Open private Voyage Book", exact: true });
        await bookEntry.scrollIntoViewIfNeeded();
        await expect(bookEntry).toBeInViewport();
        await page.screenshot({ path: info.outputPath("history-detail-actions.png") });
        await measure(
          "Actual private Voyage Book",
          () => page.getByRole("link", { name: "Open private Voyage Book", exact: true }).click(),
          () => expect(page.locator(".wakebook-voyage-book")).toContainText("Source-bound history"),
        );
        await expect(
          passport.getByRole("button", { name: "Print this private Voyage Book", exact: true }),
        ).toBeVisible();
        await passportCapture("history-book");
        for (const title of ["The journey you completed", "The people on this Voyage"]) {
          const sectionHeading = page.getByRole("heading", { level: 3, name: title, exact: true });
          await sectionHeading.scrollIntoViewIfNeeded();
          await expect(sectionHeading).toBeInViewport();
          await page.screenshot({
            path: info.outputPath(
              `history-book-${title === "The journey you completed" ? "source-history" : "crew"}.png`,
            ),
          });
        }
        await page.getByRole("link", { name: "Back to Voyage Detail", exact: true }).click();
        const replayStarted = performance.now();
        await page.getByRole("link", { name: "Replay this Journey", exact: true }).click();
        await enterClosureJournal(page);
        await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
        await expect(historical).toContainText("read-only");
        const replayOpeningMs = performance.now() - replayStarted;
        await expect(journal.getByRole("button", { name: "Continue Voyage", exact: true })).toHaveCount(0);
        expect(
          (await new AxeBuilder({ page }).include("main[data-experience-voyage]").analyze()).violations,
        ).toEqual([]);
        await historical.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("history-read-only-replay.png") });
        await enterPassport();
        await measure(
          "Actual personal Artifact Cabinet",
          () => sections.getByRole("link", { name: "Artifacts", exact: true }).click(),
          () =>
            expect(
              page.getByRole("heading", { level: 2, name: "Synthetic Sextant Compass", exact: true }),
            ).toBeVisible(),
        );
        const artifact = page
          .locator("article.artifact-card")
          .filter({
            has: page.getByRole("heading", { level: 2, name: "Synthetic Sextant Compass", exact: true }),
          });
        await expect(artifact).toContainText("Backed by an authoritative grant record.");
        await measure(
          "Actual personal provenance",
          () => artifact.getByRole("link", { name: "View provenance", exact: true }).click(),
          async () => {
            await expect(page.locator(".artifact-detail-hero")).toContainText("Synthetic Sextant Compass");
            await expect(
              page.locator("section.harbor-panel").filter({
                has: page.getByRole("heading", { level: 2, name: "Provenance", exact: true }),
              }),
            ).toContainText("Authoritative grant evidence is on file");
          },
        );
        const artifactRecord = await db.playerArtifactRecord.findUniqueOrThrow({
          where: {
            playerProfileId_sourceGrantEventId: {
              playerProfileId: crew.id,
              sourceGrantEventId: grants[0].sourceEventId,
            },
          },
        });
        await expect(page).toHaveURL(new RegExp(`/passport/artifacts/${artifactRecord.id}$`));
        expect((await new AxeBuilder({ page }).include(".passport-shell").analyze()).violations).toEqual([]);
        await passport
          .getByRole("heading", { level: 1, name: "Artifact Provenance", exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("history-artifact-provenance.png") });
        const authority = page.getByText(
          "Authoritative grant evidence is on file for this personal record.",
          {
            exact: true,
          },
        );
        await authority.scrollIntoViewIfNeeded();
        await expect(authority).toBeInViewport();
        await page.screenshot({ path: info.outputPath("history-artifact-authority.png") });
        await page.getByRole("link", { name: "← Artifact Cabinet", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Artifact Cabinet", exact: true })).toBeVisible();
        await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        expect(
          await db.taleSession.findUniqueOrThrow({
            where: { id: fixture.voyageId },
            select: { status: true, currentBlockId: true, currentSequence: true, publishedVersionId: true },
          }),
        ).toEqual(completedProgress);
        expect(await db.taleSessionEvent.count({ where: { sessionId: fixture.voyageId } })).toBe(
          completedEventCount,
        );
        expect(await db.artifactGrantReceipt.findMany({ where: { sessionId: fixture.voyageId } })).toEqual(
          grants,
        );
        expect(
          await db.publishedTaleVersion.findUniqueOrThrow({
            where: { id: fixture.versionId },
            select: { checksum: true, contentSnapshot: true },
          }),
        ).toEqual(edition);
        expect(
          await db.taleSession.findUniqueOrThrow({
            where: { id: fixture.playerVoyageId },
            select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
          }),
        ).toEqual(activeBaseline);
        await writeFile(
          info.outputPath("history-journey-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-history-journeys.spec.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-chronicle-choice.ts",
              ]),
              fixture,
              viewport,
              reducedMotion,
              feedback,
              replayOpeningMs,
              completion: {
                sessionId: completed.id,
                eventCount: completedEventCount,
                actualPlayerPostAndCanonicalCompletion: true,
              },
              provenance: {
                historyRecordId: record.id,
                artifactRecordId: artifactRecord.id,
                grantId: grants[0].grantId,
                recipientPolicy: grants[0].recipientPolicy,
              },
              noSeededHistoryCompletionOrReceipt: true,
              unchangedCompletedProgressAndEdition: true,
              unchangedIndependentActiveVoyage: true,
              protectedQualification: false,
              physicalEvidence: false,
            },
            null,
            2,
          ),
        );
      });
    });
  }
}
