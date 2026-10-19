// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.public-chronicle
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantCatalogExperience } from "../../.agents/scripts/sextant-catalog-fixture";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { enterClosureJournal } from "./fixtures/landfall-closure";

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
      test("ordinary public catalog, exact editions, preparation, guest Journal and same-Voyage return", async ({
        page,
      }, info) => {
        const key = `catalog-${viewport.width}-${reducedMotion}` as
          | "catalog-1280-no-preference"
          | "catalog-1280-reduce"
          | "catalog-390-no-preference"
          | "catalog-390-reduce";
        const fixture = await seedSextantCatalogExperience(key);
        expect(await seedSextantCatalogExperience(key)).toEqual(fixture);
        const ids = [fixture.playerVoyageId, fixture.voyageId];
        const baseline = await db.taleSession.findMany({
          where: { id: { in: ids } },
          orderBy: { id: "asc" },
          select: { id: true, currentBlockId: true, currentSequence: true, status: true, publishedVersionId: true },
        });
        const editions = await db.publishedTaleVersion.findMany({
          where: { taleId: fixture.publicTaleId },
          orderBy: { versionNumber: "asc" },
          select: { id: true, checksum: true, contentSnapshot: true },
        });
        expect(editions.map((e) => e.checksum)).toEqual(fixture.publicChecksums);
        expect(await db.taleSession.count({ where: { taleId: fixture.publicTaleId } })).toBe(0);
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const start = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - start;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const capture = async (name: string, selector: string, target = page.getByRole("heading", { level: 1 })) => {
          expect((await new AxeBuilder({ page }).include(selector).analyze()).violations).toEqual([]);
          await target.scrollIntoViewIfNeeded();
          await expect(target).toBeInViewport();
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        const globalNavigation = page.getByRole("navigation", { name: "Global navigation", exact: true });
        const openCatalog = async () => {
          await page.getByRole("button", { name: "Open navigation", exact: true }).click();
          await globalNavigation.getByRole("link", { name: "Explore Chronicles", exact: true }).click();
          await expect(page.getByRole("heading", { name: "Choose a Chronicle", exact: true })).toBeVisible();
        };
        await page.goto("/");
        await measure("Ordinary catalog entry", openCatalog, () =>
          expect(page.getByRole("heading", { level: 2, name: fixture.publicTitle, exact: true })).toBeVisible(),
        );
        const card = page
          .locator(".catalog-grid article")
          .filter({ has: page.getByRole("heading", { level: 2, name: fixture.publicTitle, exact: true }) });
        await expect(card).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 2, name: fixture.title, exact: true })).toHaveCount(0);
        const search = page.getByRole("searchbox", { name: "Search", exact: true });
        await search.fill("sextant-no-public-course-20261019");
        const empty = page.locator(".ui-empty-state");
        await expect(
          page.getByRole("heading", { name: "No Chronicles match these filters", exact: true }),
        ).toBeVisible();
        await capture(
          "catalog-empty-filter",
          ".tale-catalog",
          page.getByRole("heading", { name: "No Chronicles match these filters", exact: true }),
        );
        await empty.getByRole("button", { name: "Clear Filters", exact: true }).click();
        await expect(search).toHaveValue("");
        await search.fill(fixture.publicTitle);
        await page.getByRole("combobox", { name: "Duration", exact: true }).selectOption("30");
        await page.getByRole("combobox", { name: "Group size", exact: true }).selectOption("1");
        await expect(page.locator(".catalog-grid article")).toHaveCount(1);
        await capture("catalog-public-course", ".tale-catalog", card.getByRole("heading", { level: 2 }));
        await measure(
          "Public immutable preview",
          () => card.getByRole("link", { name: "Preview Chronicle", exact: true }).click(),
          () => expect(page.getByRole("heading", { level: 1, name: fixture.publicTitle, exact: true })).toBeVisible(),
        );
        await expect(page).toHaveURL(new RegExp(`/chronicles/${fixture.publicSlug}$`));
        await capture("catalog-public-preview", ".community-harbor");
        await expect(page.getByRole("heading", { name: "Start Chronicle", exact: true })).toBeVisible();
        expect(await db.taleSession.count({ where: { taleId: fixture.publicTaleId } })).toBe(0);
        await measure(
          "Actual Tideglass entry",
          () => page.getByRole("link", { name: "See what changed", exact: true }).click(),
          () => expect(page.getByRole("combobox", { name: "Played or starting edition", exact: true })).toBeVisible(),
        );
        await page
          .getByRole("combobox", { name: "Played or starting edition", exact: true })
          .selectOption(fixture.publicVersionIds[0]);
        await page
          .getByRole("combobox", { name: "Edition to review", exact: true })
          .selectOption(fixture.publicVersionIds[1]);
        await measure(
          "Exact public edition comparison",
          () => page.getByRole("button", { name: "Compare editions", exact: true }).click(),
          () =>
            expect(page.getByRole("region", { name: "Edition comparison result", exact: true })).toContainText(
              "Edition 1.0.0 to Edition 2.0.0",
            ),
        );
        await expect(page.getByRole("region", { name: "Selected edition context", exact: true })).toContainText(
          "1.0.0",
        );
        await expect(page.getByRole("region", { name: "Selected edition context", exact: true })).toContainText(
          "2.0.0",
        );
        await capture(
          "catalog-tideglass",
          ".community-harbor",
          page.getByRole("heading", { name: "What changed?", exact: true }),
        );
        await page.getByRole("button", { name: "Show detailed comparison", exact: true }).click();
        await expect(page.getByRole("list", { name: "Semantic changes", exact: true }).first()).toBeVisible();
        await capture(
          "catalog-tideglass-details",
          ".community-harbor",
          page.getByRole("region", { name: "Comparison details", exact: true }),
        );
        await page.getByRole("link", { name: "Return to Chronicle", exact: true }).click();
        await measure(
          "Ordinary Voyage preparation",
          () => page.getByRole("link", { name: "Start Chronicle", exact: true }).click(),
          () => expect(page.getByRole("textbox", { name: "Guest player name", exact: true })).toBeVisible(),
        );
        await capture("catalog-voyage-preparation", ".tale-start");
        await page.getByRole("link", { name: "View this browser's Voyage History", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "No Voyage History in this browser", exact: true }),
        ).toBeVisible();
        await capture("catalog-no-cookie-history", ".tale-history");
        await page.getByRole("link", { name: "Choose a Chronicle", exact: true }).click();
        await card.getByRole("link", { name: "Preview Chronicle", exact: true }).click();
        await page.getByRole("link", { name: "Start Chronicle", exact: true }).click();
        const guestName = `Synthetic Sextant guest ${viewport.width} ${reducedMotion}`;
        await page.getByRole("textbox", { name: "Guest player name", exact: true }).fill(guestName);
        const startResponse = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `/api/tales/${fixture.publicSlug}/start` &&
            response.request().method() === "POST",
        );
        const openingStarted = performance.now();
        let created: { sessionId: string; url: string } | undefined;
        await measure(
          "Canonical guest start acknowledged",
          () => page.getByRole("button", { name: "Begin Voyage", exact: true }).click(),
          async () => {
            const response = await startResponse;
            expect(response.status()).toBe(201);
            created = await response.json();
          },
        );
        if (!created) throw new Error("SEXTANT_CATALOG_START_RECEIPT_MISSING");
        await enterClosureJournal(page);
        const journalOpeningMs = performance.now() - openingStarted;
        const journal = page.getByRole("main", { name: "Voyage Journal", exact: true });
        await expect(journal).toHaveAttribute("data-voyage-id", created.sessionId);
        await expect(journal.getByRole("button", { name: "Continue Voyage", exact: true })).toBeVisible();
        await capture(
          "catalog-actual-guest-journal",
          'main[aria-label="Voyage Journal"]',
          journal.getByRole("heading", { level: 1, name: fixture.publicTitle, exact: true }),
        );
        const progress = await db.taleSession.findUniqueOrThrow({
          where: { id: created.sessionId },
          select: {
            taleId: true,
            publishedVersionId: true,
            currentBlockId: true,
            currentSequence: true,
            status: true,
            ownerLabel: true,
          },
        });
        expect(progress).toMatchObject({
          taleId: fixture.publicTaleId,
          publishedVersionId: fixture.publicVersionIds[1],
          status: "ACTIVE",
          ownerLabel: guestName,
        });
        const membership = await db.playthroughMembership.findFirstOrThrow({
          where: { playthroughId: created.sessionId },
          include: { player: true },
        });
        expect(membership.status).toBe("ACTIVE_MEMBER");
        expect(membership.player.accountId).toBeNull();
        expect(await db.taleSession.count({ where: { taleId: fixture.publicTaleId } })).toBe(1);
        await page.getByRole("link", { name: "Voyagewright home", exact: true }).click();
        await expect(page).toHaveURL(/\/$/u);
        await openCatalog();
        await expect(card.getByRole("link", { name: "Continue Voyage", exact: true })).toHaveAttribute(
          "href",
          created.url,
        );
        await capture("catalog-same-guest-voyage", ".tale-catalog", card.getByRole("heading", { level: 2 }));
        await page.getByRole("link", { name: "Voyagewright home", exact: true }).click();
        await expect(page).toHaveURL(/\/$/u);
        expect(
          await db.taleSession.findUniqueOrThrow({
            where: { id: created.sessionId },
            select: {
              taleId: true,
              publishedVersionId: true,
              currentBlockId: true,
              currentSequence: true,
              status: true,
              ownerLabel: true,
            },
          }),
        ).toEqual(progress);
        expect(
          await db.taleSession.findMany({
            where: { id: { in: ids } },
            orderBy: { id: "asc" },
            select: { id: true, currentBlockId: true, currentSequence: true, status: true, publishedVersionId: true },
          }),
        ).toEqual(baseline);
        expect(
          await db.publishedTaleVersion.findMany({
            where: { taleId: fixture.publicTaleId },
            orderBy: { versionNumber: "asc" },
            select: { id: true, checksum: true, contentSnapshot: true },
          }),
        ).toEqual(editions);
        await writeFile(
          info.outputPath("catalog-journey-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-catalog-journeys.spec.ts",
                ".agents/scripts/sextant-catalog-fixture.ts",
              ]),
              viewport,
              reducedMotion,
              feedback,
              journalOpeningMs,
              actualGuestSessionId: created.sessionId,
              actualPublicEdition: fixture.publicVersionIds[1],
              guestCreationThroughOrdinaryControls: true,
              privateBaselinesAndPublicEditionsUnchanged: true,
              existingPublicComparisonServices: true,
              realPublishingReadinessProved: false,
              populatedCookieHistoryCovered: false,
              protectedQualification: false,
            },
            null,
            2,
          ) + "\n",
        );
      });
    });
  }
}
