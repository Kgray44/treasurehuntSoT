// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.phase4.native-context
// Development-only two-persona comparison; does not amend the older single-persona capture contract.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { seedSextantResourceExperiences } from "../../.agents/scripts/sextant-resource-fixtures";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { enterClosureJournal } from "./fixtures/landfall-closure";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";

test.describe.configure({ mode: "default", timeout: 180000 });
// Closing the extra context before runner teardown collides with its automatic
// screenshot ordinals. Capture both personas explicitly under distinct paths.
test.use({ video: "on", trace: "retain-on-failure", screenshot: "off" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in?returnTo=%2Faccount");
  await page.getByRole("textbox", { name: "Email or Player name", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test.describe(`${viewport.width}px ${reducedMotion}`, () => {
      test.use({ viewport, contextOptions: { reducedMotion } });
      test("ordinary Creator working clue save/reopen compared with a distinct Crew Player's pinned clue", async ({
        page,
        browser,
        baseURL,
      }, info) => {
        const key = `paired-${viewport.width}-${reducedMotion}` as
          | "paired-1280-no-preference"
          | "paired-1280-reduce"
          | "paired-390-no-preference"
          | "paired-390-reduce";
        let fixture!: Awaited<ReturnType<typeof seedSextantResourceExperiences>>;
        let crewContext: BrowserContext | undefined;
        let primaryFailure: unknown;
        const cleanupFailures: unknown[] = [];
        let crew!: Page;
        let crewVideo: ReturnType<Page["video"]> = null;
        const clueText = "The next bearing is written in the stars. Look for the northern light.";
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const recordFeedback = (task: string, start: number) => {
          const elapsedMs = performance.now() - start;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const comparePublishedClue = async (stage: string) => {
          const start = performance.now();
          await crew.getByRole("button", { name: "Open Chronicle Lens", exact: true }).click();
          const lens = crew.getByRole("dialog");
          await expect(lens).toHaveAccessibleName("A message between worlds");
          await expect(lens).toHaveAttribute("data-voyage-id", fixture.voyageId);
          await expect(lens).toContainText("Guided View");
          const note = lens.getByRole("article", {
            name: "A parchment note bearing the Captain’s next clue.",
            exact: true,
          });
          await expect(note).toContainText(clueText);
          recordFeedback(`Published clue ${stage}`, start);
          await note.getByRole("button", { name: "Inspect", exact: true }).click();
          await expect(note).toContainText("You are inspecting The Captain’s note.");
          // Chronicle Lens is a native HTML dialog with an implicit role.
          // Audit that actual open dialog, not an absent explicit-role attribute.
          expect((await new AxeBuilder({ page: crew }).include("dialog[open]").analyze()).violations).toEqual([]);
          await crew.screenshot({ path: info.outputPath(`crew-${stage}-published-clue.png`) });
          await crew.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
        };
        try {
          fixture = await seedSextantResourceExperiences(key);
          expect(await seedSextantResourceExperiences(key)).toEqual(fixture);
          expect(fixture.crewEmail).toBeTruthy();
          const baseline = await db.taleSession.findUniqueOrThrow({
            where: { id: fixture.voyageId },
            select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
          });
          const edition = await db.publishedTaleVersion.findUniqueOrThrow({
            where: { id: fixture.versionId },
            select: { checksum: true, contentSnapshot: true },
          });
          crewContext = await browser.newContext({
            baseURL,
            viewport,
            reducedMotion,
            recordVideo: { dir: info.outputPath("crew-recording"), size: viewport },
          });
          crew = await crewContext.newPage();
          crewVideo = crew.video();
          // Playwright Test owns tracing for every browser.newContext() in this
          // test. Starting or stopping it here conflicts with its trace chunks.
          await signIn(crew, fixture.crewEmail!, "Synthetic-Sextant-Crew-2026!");
          const crewMenu = crew.getByRole("button", { name: `Synthetic Sextant Crew-${key}`, exact: true });
          await crewMenu.click();
          await crew.getByRole("link", { name: "All Workspaces", exact: true }).click();
          await expect(crew.getByText("Active Chronicle safety lock", { exact: true })).toBeVisible();
          await expect(crew.getByRole("link", { name: "Enter Creator", exact: true })).toHaveCount(0);
          await crew.getByRole("link", { name: "Enter Player", exact: true }).click();
          await expect(crew.getByRole("main")).toContainText(fixture.title);
          await crew.getByRole("link", { name: "Continue Adventure", exact: true }).click();
          await enterClosureJournal(crew);
          const journal = crew.getByRole("main", { name: "", exact: true });
          await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
          await comparePublishedClue("before");

          await signIn(page, fixture.email, "Synthetic-Sextant-Resources-2026!");
          const ownerMenu = page.getByRole("button", { name: fixture.displayName, exact: true });
          await ownerMenu.click();
          await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
          await page.getByRole("link", { name: "Enter Creator", exact: true }).click();
          await page.getByRole("link", { name: "Edit Chronicle", exact: true }).click();
          await page.getByRole("group", { name: "Passage: The Captain’s note", exact: true }).click();
          await page.getByRole("link", { name: "Edit in Parallax →", exact: true }).click();
          await expect(
            page.getByRole("heading", { name: "A message between worlds", level: 1, exact: true }),
          ).toBeVisible();
          await page.getByRole("button", { name: "Open object behavior", exact: true }).click();
          await page.getByText("Library, reuse & publication", { exact: true }).click();
          const editedTitle = `Sextant working clue ${key}`;
          await page.getByRole("textbox", { name: "Experience title", exact: true }).fill(editedTitle);
          const save = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/studio/parallax" &&
              r.request().method() === "POST" &&
              r.request().postDataJSON()?.action === "SAVE",
          );
          const saveStarted = performance.now();
          await page.getByRole("button", { name: "Save draft", exact: true }).click();
          expect((await save).status()).toBe(200);
          await expect(page.getByRole("status")).toHaveText("Working draft saved");
          recordFeedback("Creator working Save", saveStarted);
          // Refresh the URL bound by the actual Save action, never a manufactured definition URL.
          const reopenStarted = performance.now();
          await page.reload();
          await expect(page.getByRole("heading", { name: editedTitle, level: 1, exact: true })).toBeVisible();
          await expect(page.getByRole("status")).toHaveText("Working draft opened");
          recordFeedback("Creator working reopen", reopenStarted);
          expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
          await page.screenshot({ path: info.outputPath("creator-working-clue-reopened.png") });
          // Re-fetch the real Player projection while the distinguishing working
          // title is still edited; cached pre-save content is insufficient proof.
          await crew.reload();
          await enterClosureJournal(crew);
          await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
          await comparePublishedClue("after-working-save");
          await page.getByRole("button", { name: "Open object behavior", exact: true }).click();
          await page.getByText("Library, reuse & publication", { exact: true }).click();
          await page.getByRole("textbox", { name: "Experience title", exact: true }).fill("A message between worlds");
          const restore = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/studio/parallax" &&
              r.request().method() === "POST" &&
              r.request().postDataJSON()?.action === "SAVE",
          );
          await page.getByRole("button", { name: "Save draft", exact: true }).click();
          expect((await restore).status()).toBe(200);
          await expect(page.getByRole("status")).toHaveText("Working draft saved");
          await ownerMenu.click();
          await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
          await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
          await crewMenu.click();
          await crew.getByRole("link", { name: "Personal Harbor", exact: true }).click();
          await expect(crew.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
          expect(
            await db.taleSession.findUniqueOrThrow({
              where: { id: fixture.voyageId },
              select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
            }),
          ).toEqual(baseline);
          expect(
            await db.publishedTaleVersion.findUniqueOrThrow({
              where: { id: fixture.versionId },
              select: { checksum: true, contentSnapshot: true },
            }),
          ).toEqual(edition);
          await writeFile(
            info.outputPath("paired-creator-player-receipt.json"),
            JSON.stringify(
              {
                source: await deviceLabSourceIdentity([
                  "tests/e2e/sextant-parallax-paired-journeys.spec.ts",
                  ".agents/scripts/sextant-resource-fixtures.ts",
                ]),
                viewport,
                reducedMotion,
                feedback,
                crewCreatorSafetyLockPreserved: true,
                owner: fixture.ownerId,
                voyage: fixture.voyageId,
                ordinarySeparateSignIns: true,
                workingDraftSavedReopenedRestored: true,
                publishedClueComparedBeforeAndAfter: true,
                unchangedCanonicalProgress: true,
                unchangedPublishedEdition: true,
                olderSinglePersonaContractSatisfied: false,
                protectedQualification: false,
                nativeExecution: false,
                physicalEvidence: false,
              },
              null,
              2,
            ),
          );
        } catch (error) {
          primaryFailure = error;
        } finally {
          const cleanup = async (action: () => Promise<unknown>) => {
            try {
              await action();
            } catch (error) {
              cleanupFailures.push(error);
            }
          };
          const captureFailure = async () => {
            for (const [persona, failurePage] of [
              ["owner", page],
              ["crew", crew],
            ] as const) {
              if (!failurePage || failurePage.isClosed()) continue;
              await cleanup(async () => {
                const screenshot = info.outputPath(`${persona}-failure-screenshot.png`);
                await failurePage.screenshot({ path: screenshot });
                await info.attach("screenshot", { path: screenshot, contentType: "image/png" });
              });
              await cleanup(async () => {
                const context = info.outputPath(`${persona}-failure-error-context.md`);
                await writeFile(
                  context,
                  `# Synthetic ${persona} failure context\n\n${failurePage.url()}\n\n${await failurePage.locator("body").innerText({ timeout: 1000 })}\n`,
                );
                await info.attach("error-context", { path: context, contentType: "text/markdown" });
              });
            }
          };
          if (primaryFailure) await captureFailure();
          const ownedCrewContext = crewContext;
          if (ownedCrewContext) await cleanup(() => ownedCrewContext.close());
          const completedCrewVideo = crewVideo;
          if (completedCrewVideo)
            await cleanup(async () =>
              info.attach("video", { path: await completedCrewVideo.path(), contentType: "video/webm" }),
            );
          // A cleanup-only failure still needs the open owner's diagnostic
          // state before the runner tears down its page and seals the bundle.
          if (!primaryFailure && cleanupFailures.length) await captureFailure();
        }
        if (primaryFailure) throw primaryFailure;
        if (cleanupFailures.length) throw new AggregateError(cleanupFailures, "SEXTANT_PAIRED_CONTEXT_CLEANUP_FAILED");
      });
    });
  }
}
