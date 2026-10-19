// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.phase4.native-context,sextant.shared-consumers.workspace-capabilities
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { seedSextantExperience } from "../../.agents/scripts/sextant-experience-fixture";
import { db } from "../../src/lib/db";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { enterClosureJournal } from "./fixtures/landfall-closure";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
let fixture: Awaited<ReturnType<typeof seedSextantExperience>>;
test.beforeAll(async () => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  fixture = await seedSextantExperience();
  expect(await seedSextantExperience()).toEqual(fixture);
});
test.afterAll(() => db.$disconnect());

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`ordinary sign-in, workspaces, Journal, Devices and Guided Lens ${viewport.width}px ${reducedMotion}`, async ({
      browser,
      baseURL,
    }, info) => {
      const context = await browser.newContext({
        viewport,
        reducedMotion,
        recordVideo: { dir: info.outputPath("recording"), size: viewport },
      });
      const signInResponses: Array<{ path: string; status: number }> = [];
      let ownedPage: Page | undefined;
      let failed = false;
      const capture = async (name: string, action: () => Promise<unknown>) => {
        try {
          await action();
        } catch {
          console.warn(`SEXTANT_SYNTHETIC_DIAGNOSTIC_UNAVAILABLE:${name}`);
        }
      };
      try {
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage();
        ownedPage = page;
        page.on("response", (response) => {
          const path = new URL(response.url()).pathname;
          if (path === "/api/auth/sign-in" || path === "/api/auth/context")
            signInResponses.push({ path, status: response.status() });
        });
        const before = await db.taleSession.findUniqueOrThrow({
          where: { id: fixture.voyageId },
          select: { currentBlockId: true, currentSequence: true, publishedVersionId: true },
        });
        const version = await db.publishedTaleVersion.findUniqueOrThrow({
          where: { id: fixture.versionId },
          select: { checksum: true },
        });
        await page.goto(`${baseURL}/sign-in?returnTo=%2Faccount`);
        await page
          .getByRole("textbox", { name: "Email or Player name", exact: true })
          .fill("sextant.experience@example.test");
        await page.getByRole("textbox", { name: "Password", exact: true }).fill("Synthetic-Sextant-Review-2026!");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        const accountMenu = page.getByRole("button", { name: "Synthetic Sextant Navigator", exact: true });
        await accountMenu.click();
        await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
        await expect(page.getByRole("heading", { name: "All Workspaces", exact: true })).toBeVisible();
        await expect(page.getByRole("region", { name: "Account workspace capabilities" })).toContainText("Player");
        await expect(page.getByRole("main")).toContainText("Workspace activation never grants ownership");
        await page.getByRole("link", { name: "Enter Player", exact: true }).click();
        await expect(page.getByRole("heading", { name: "My Chronicle Library", exact: true })).toBeVisible();
        await expect(page.getByRole("main")).toContainText("Synthetic Sextant experience Voyage");
        await accountMenu.click();
        await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        await accountMenu.click();
        await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
        await page.getByRole("link", { name: "Return to Chronicle", exact: true }).click();
        await enterClosureJournal(page);
        const journal = page.getByRole("main", { name: "Voyage Journal", exact: true });
        await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
        await expect(page.getByRole("button", { name: "Replay full opening", exact: true })).toBeVisible();
        const start = await page.evaluate(() => performance.now());
        await page.getByRole("button", { name: "Replay full opening", exact: true }).click();
        await expect(page.getByRole("link", { name: "Devices", exact: true })).toBeVisible({ timeout: 15000 });
        const openingMs = (await page.evaluate(() => performance.now())) - start;
        await page.screenshot({ path: info.outputPath("journal-ready.png"), fullPage: true });
        await page.getByRole("link", { name: "Devices", exact: true }).click();
        const devices = page.getByRole("region", { name: "Voyage devices", exact: true });
        await expect(devices).toHaveAttribute("data-voyage-id", fixture.voyageId);
        await devices.getByRole("button", { name: "Use this device", exact: true }).click();
        const input = page.getByRole("region", { name: "Optional device input", exact: true });
        await input.getByRole("button", { name: "Continue with screen controls", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(input).toContainText("Screen controls are ready. Device input is optional.");
        expect(
          (await new AxeBuilder({ page }).include('[aria-label="Optional device input"]').analyze()).violations,
        ).toEqual([]);
        await page.screenshot({ path: info.outputPath("device-fallback.png"), fullPage: true });
        await devices.getByRole("link", { name: "Continue Voyage", exact: true }).click();
        await enterClosureJournal(page);
        await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
        await page.getByRole("button", { name: "Open Chronicle Lens", exact: true }).click();
        const lens = page.getByRole("dialog");
        await expect(lens).toContainText("Guided View");
        await expect(lens).toHaveAttribute("data-voyage-id", fixture.voyageId);
        const note = lens.getByRole("article", {
          name: "A parchment note bearing the Captain’s next clue.",
          exact: true,
        });
        await expect(note).toContainText("The next bearing is written in the stars. Look for the northern light.");
        await note.getByRole("button", { name: "Inspect", exact: true }).click();
        await expect(note).toContainText("You are inspecting The Captain’s note.");
        await page.screenshot({ path: info.outputPath("guided-clue.png"), fullPage: true });
        await page.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
        await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
        await accountMenu.click();
        await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        expect(
          await db.taleSession.findUniqueOrThrow({
            where: { id: fixture.voyageId },
            select: { currentBlockId: true, currentSequence: true, publishedVersionId: true },
          }),
        ).toEqual(before);
        expect(
          await db.publishedTaleVersion.findUniqueOrThrow({
            where: { id: fixture.versionId },
            select: { checksum: true },
          }),
        ).toEqual(version);
        await writeFile(
          info.outputPath("consumer-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-consumer-journeys.spec.ts",
                "tests/e2e/fixtures/landfall-closure.ts",
                "tests/e2e/fixtures/sounding-line-isolation.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              ordinarySignIn: true,
              naturalEntryAndReturn: true,
              sameVoyage: fixture.voyageId,
              openingMs,
              unchangedCanonicalProgress: true,
              unchangedPublishedEdition: true,
              evidence: "D1_REAL_BROWSER_SYNTHETIC_PERSISTED_VOYAGE",
              nativeExecution: false,
              physicalEvidence: false,
              qualification: false,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        failed = true;
        await capture("screenshot", async () => {
          if (!ownedPage) return;
          const screenshot = info.outputPath("failure-screenshot.png");
          await ownedPage.screenshot({ path: screenshot, fullPage: true });
          await info.attach("screenshot", { path: screenshot, contentType: "image/png" });
        });
        await capture("error-context", async () => {
          const errorContext = info.outputPath("error-context.md");
          await writeFile(
            errorContext,
            [
              "# Synthetic consumer failure context",
              `Route: ${ownedPage ? new URL(ownedPage.url()).pathname : "PAGE_UNAVAILABLE"}`,
              `Authentication responses: ${JSON.stringify(signInResponses)}`,
              "## Rendered synthetic page",
              (await ownedPage?.locator("body").innerText()) ?? "PAGE_UNAVAILABLE",
            ].join("\n\n"),
          );
          await info.attach("error-context", { path: errorContext, contentType: "text/markdown" });
        });
        throw error;
      } finally {
        try {
          await capture("trace", async () => {
            const trace = info.outputPath("failure-trace.zip");
            await context.tracing.stop(failed ? { path: trace } : {});
            if (failed) await info.attach("trace", { path: trace, contentType: "application/zip" });
          });
        } finally {
          try {
            await context.close();
          } catch (cleanupError) {
            console.warn("SEXTANT_BROWSER_CONTEXT_CLEANUP_FAILED");
            if (!failed) throw cleanupError;
          }
        }
        if (failed) {
          await capture("video", async () => {
            const video = await ownedPage?.video()?.path();
            if (video) await info.attach("video", { path: video, contentType: "video/webm" });
          });
        }
      }
    });
  }
}
