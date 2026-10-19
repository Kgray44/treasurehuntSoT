// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.captain-resources,sextant.shared-consumers.creator-draft
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantResourceExperiences } from "../../.agents/scripts/sextant-resource-fixtures";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ video: "on", trace: "retain-on-failure", screenshot: "only-on-failure" });

test.beforeAll(async () => {
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
      test("ordinary Captain resources, active crew roster, safe preview and Creator draft save/reopen", async ({
        page,
      }, info) => {
        // Each variant owns its mutable draft. A failed autosave is preserved
        // without contaminating another variant or resetting a failed receipt.
        const resourceCase = `${viewport.width}-${reducedMotion}` as
          | "1280-no-preference"
          | "1280-reduce"
          | "390-no-preference"
          | "390-reduce";
        const fixture = await seedSextantResourceExperiences(resourceCase);
        expect(await seedSextantResourceExperiences(resourceCase)).toEqual(fixture);
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const start = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - start;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const baseline = await db.taleSession.findMany({
          where: { id: { in: [fixture.voyageId, fixture.playerVoyageId] } },
          orderBy: { id: "asc" },
          select: {
            id: true,
            currentBlockId: true,
            currentSequence: true,
            publishedVersionId: true,
            status: true,
            captainAccountId: true,
          },
        });
        expect(baseline).toHaveLength(2);
        const editionIds = baseline.map((row) => row.publishedVersionId!);
        const editions = await db.publishedTaleVersion.findMany({
          where: { id: { in: editionIds } },
          orderBy: { id: "asc" },
          select: { id: true, checksum: true },
        });
        await page.goto("/sign-in?returnTo=%2Faccount");
        await page.getByRole("textbox", { name: "Email or Player name", exact: true }).fill(fixture.email);
        await page.getByRole("textbox", { name: "Password", exact: true }).fill("Synthetic-Sextant-Resources-2026!");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        const accountMenu = page.getByRole("button", { name: fixture.displayName, exact: true });
        await accountMenu.click();
        await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
        await measure(
          "Captain library",
          () => page.getByRole("link", { name: "Enter Captain", exact: true }).click(),
          () => expect(page.getByRole("main")).toContainText(fixture.title),
        );
        const roster = page.getByRole("list", { name: "Voyage crew", exact: true });
        await measure(
          "Muster roster",
          () => page.getByRole("link", { name: "Open Muster Room", exact: true }).click(),
          () => expect(roster).toContainText("Synthetic Sextant Crew"),
        );
        const chat = page.getByRole("region", { name: "Crew Chat", exact: true });
        await expect(chat.getByRole("textbox", { name: "Message the crew", exact: true })).toBeDisabled();
        await expect(chat.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
        expect((await new AxeBuilder({ page }).include(".muster-scene").analyze()).violations).toEqual([]);
        await page.screenshot({ path: info.outputPath("captain-muster.png") });
        const console = page.getByRole("main", { name: "Captain command console", exact: true });
        await measure(
          "Captain console",
          () => page.getByRole("link", { name: "Open Captain’s Console", exact: true }).click(),
          () => expect(console).toContainText(fixture.title),
        );
        const pause = console.getByRole("button").filter({ has: page.getByText("Pause Voyage", { exact: true }) });
        await pause.click();
        const command = page.getByRole("dialog", { name: "Pause Voyage?", exact: true });
        await expect(command).toContainText("The Voyage pauses until a Captain resumes it.");
        await command.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(command).toBeHidden();
        await page.screenshot({ path: info.outputPath("captain-console.png") });
        await console.getByRole("link", { name: "Captain library", exact: true }).click();
        await page.getByRole("button", { name: "Published Chronicles", exact: true }).click();
        const published = page.locator(".published-tale-grid article").filter({
          has: page.getByRole("heading", { level: 2, name: fixture.title, exact: true }),
        });
        await expect(published).toHaveCount(1);
        const dashboard = page.locator("main.captain-dashboard");
        await measure(
          "Published Chronicle dashboard",
          () => published.getByRole("link", { name: "Open Chronicle", exact: true }).click(),
          async () => {
            await expect(
              dashboard.getByRole("heading", { level: 1, name: "Captain’s Console", exact: true }),
            ).toBeVisible();
            await expect(dashboard.getByRole("heading", { level: 2, name: fixture.title, exact: true })).toBeVisible();
            await expect(dashboard.locator(".captain-session-card")).toHaveCount(1);
          },
        );
        await expect(dashboard.getByRole("link", { name: "Open Voyage controls", exact: true })).toHaveAttribute(
          "href",
          `/captain/sessions/${fixture.voyageId}`,
        );
        await expect(dashboard.locator(".captain-session-card")).toContainText("Voyage crew");
        await expect(dashboard.locator(".captain-session-card")).not.toContainText("Guest Crew");
        expect((await new AxeBuilder({ page }).include(".captain-dashboard").analyze()).violations).toEqual([]);
        await dashboard.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("captain-chronicle-dashboard.png") });
        await measure(
          "Same Voyage controls return",
          () => dashboard.getByRole("link", { name: "Open Voyage controls", exact: true }).click(),
          () => expect(console).toContainText(fixture.title),
        );
        await console.getByRole("link", { name: "Captain library", exact: true }).click();
        await measure(
          "Player-safe projection",
          () => page.getByRole("link", { name: "Preview Crew view", exact: true }).click(),
          () => expect(page.getByRole("main")).toContainText("PREVIEW · NO LIVE MUTATIONS"),
        );
        await expect(page.getByRole("heading", { level: 1, name: fixture.title, exact: true })).toBeVisible();
        expect((await new AxeBuilder({ page }).include(".player-safe-preview").analyze()).violations).toEqual([]);
        await page.screenshot({ path: info.outputPath("captain-safe-preview.png") });
        await page.getByRole("link", { name: "Back to Captain’s Command", exact: true }).click();
        await accountMenu.click();
        await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
        await measure(
          "Creator library",
          () => page.getByRole("link", { name: "Enter Creator", exact: true }).click(),
          () => expect(page.getByRole("main")).toContainText(fixture.title),
        );
        await page.getByRole("link", { name: "Edit Chronicle", exact: true }).click();
        await page
          .getByRole("navigation", { name: "Chronicle authoring sections", exact: true })
          .getByRole("link", { name: "Chronicle", exact: true })
          .click();
        const title = page.getByRole("textbox", { name: "Title", exact: true });
        const originalTitle = await title.inputValue();
        expect(originalTitle).toBe(fixture.title);
        const editedTitle = `${originalTitle} draft ${viewport.width} ${reducedMotion}`;
        const save = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `/api/studio/tales/${fixture.taleId}/draft` &&
            response.request().method() === "PATCH",
        );
        await title.fill(editedTitle);
        expect((await save).status()).toBe(200);
        await expect(page.locator('.save-state[data-save-state="saved"]')).toContainText("Saved at");
        await page.getByRole("link", { name: "← Studio", exact: true }).click();
        await page.getByRole("link", { name: "Edit Chronicle", exact: true }).click();
        await page
          .getByRole("navigation", { name: "Chronicle authoring sections", exact: true })
          .getByRole("link", { name: "Chronicle", exact: true })
          .click();
        await expect(title).toHaveValue(editedTitle);
        const shellHeader = await page.locator(".product-shell-header").boundingBox();
        const authoringRail = await page
          .getByRole("navigation", { name: "Chronicle authoring sections", exact: true })
          .boundingBox();
        expect(shellHeader).not.toBeNull();
        expect(authoringRail).not.toBeNull();
        expect(authoringRail!.y, "Authoring navigation stays below the application masthead").toBeGreaterThanOrEqual(
          shellHeader!.y + shellHeader!.height - 1,
        );
        if (viewport.width > 760) {
          const topbar = await page.locator(".editor-topbar").boundingBox();
          expect(topbar).not.toBeNull();
          expect(topbar!.y, "Editor actions stay below the application masthead").toBeGreaterThanOrEqual(
            shellHeader!.y + shellHeader!.height - 1,
          );
          expect(authoringRail!.y, "Authoring sections stay below editor actions").toBeGreaterThanOrEqual(
            topbar!.y + topbar!.height - 1,
          );
        }
        const mastheadIsExposed = await page.locator(".product-shell-header").evaluate((header) => {
          const box = header.getBoundingClientRect();
          return Boolean(
            document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest(".product-shell-header"),
          );
        });
        expect(mastheadIsExposed, "The masthead remains above editor chrome after autosave scroll").toBe(true);
        const more = page.getByRole("button", { name: "More", exact: true });
        await more.click();
        const moreSettings = page
          .locator("#studio-more-actions")
          .getByRole("link", { name: "Chronicle settings", exact: true });
        await expect(moreSettings).toBeVisible();
        expect(
          await moreSettings.evaluate((link) => {
            const box = link.getBoundingClientRect();
            const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return target === link || Boolean(target && link.contains(target));
          }),
          "More actions stay exposed above the section rail",
        ).toBe(true);
        await page.screenshot({ path: info.outputPath("creator-more-actions.png") });
        await more.press("Escape");
        await expect(page.locator("#studio-more-actions")).toBeHidden();
        await title.scrollIntoViewIfNeeded();
        expect((await new AxeBuilder({ page }).include(".tale-editor").analyze()).violations).toEqual([]);
        await page.screenshot({ path: info.outputPath("creator-draft-reopened.png") });
        const restore = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `/api/studio/tales/${fixture.taleId}/draft` &&
            response.request().method() === "PATCH",
        );
        await title.fill(originalTitle);
        expect((await restore).status()).toBe(200);
        await expect(page.locator('.save-state[data-save-state="saved"]')).toContainText("Saved at");
        await page.getByRole("link", { name: "← Studio", exact: true }).click();
        await expect(page.getByRole("main")).toContainText(fixture.title);
        await accountMenu.click();
        await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        expect(
          await db.taleSession.findMany({
            where: { id: { in: baseline.map((row) => row.id) } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              currentBlockId: true,
              currentSequence: true,
              publishedVersionId: true,
              status: true,
              captainAccountId: true,
            },
          }),
        ).toEqual(baseline);
        expect(
          await db.publishedTaleVersion.findMany({
            where: { id: { in: editionIds } },
            orderBy: { id: "asc" },
            select: { id: true, checksum: true },
          }),
        ).toEqual(editions);
        await writeFile(
          info.outputPath("resource-consumer-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                "tests/e2e/sextant-resource-journeys.spec.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              feedback,
              ordinarySignIn: true,
              actualCaptainAuthority: fixture.voyageId,
              separatePlayerBaseline: fixture.playerVoyageId,
              crewChat: "ACTIVE_VOYAGE_DISABLED_NO_MESSAGE_SENT",
              cancelledCommandReview: true,
              playerSafePreview: true,
              creatorDraftSavedReopenedRestored: true,
              unchangedCanonicalProgress: true,
              unchangedPublishedEditions: true,
              qualification: false,
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
