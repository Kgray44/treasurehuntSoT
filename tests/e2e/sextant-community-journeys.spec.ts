// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.public-community
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantCommunityExperience } from "../../.agents/scripts/sextant-community-fixture";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ video: "on", trace: "retain-on-failure", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

const districts = [
  ["Featured", "Featured at the Harbor", "The Lantern Coast"],
  ["Chronicles", "Chronicles", "Paper Stars at First Bell"],
  ["Artifacts", "Artifacts", "Signal Flag Worksheet"],
  ["Templates", "Templates", "Quiet Watch Template"],
  ["Maps", "Maps and location packs", "Fictional Crescent Map Pack"],
  ["Audio and reveals", "Audio and reveal assets", "Harbor Bell Audio Cues"],
  ["Creators", "Creators", "Captain Almanac"],
  ["Collections", "Collections", "Harbor Starter Charts"],
  ["Guides", "Guides and the Shipwright's Workshop", "Reading the Weathered Chart"],
  ["Voyage Logs", "Voyage Logs", "Fictional Lantern Voyage Log"],
] as const;

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test.describe(`${viewport.width}px ${reducedMotion}`, () => {
      test.use({ viewport, contextOptions: { reducedMotion } });
      test("anonymous ordinary Harbor entry, public districts, real details, honest empty search and return", async ({
        page,
      }, info) => {
        const fixture = await seedSextantCommunityExperience();
        expect(await seedSextantCommunityExperience()).toEqual(fixture);
        const baseline = await db.taleSession.findUniqueOrThrow({
          where: { id: fixture.playerVoyageId },
          select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
        });
        const edition = await db.publishedTaleVersion.findUniqueOrThrow({
          where: { id: fixture.playerVersionId },
          select: { checksum: true, contentSnapshot: true },
        });
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const started = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - started;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const heading = (name: string) => page.getByRole("heading", { level: 1, name, exact: true });
        const navigation = page.getByRole("navigation", { name: "Community Harbor districts", exact: true });
        const checkPublic = async () => {
          for (const slug of [...fixture.ineligibleSlugs, "private-curator-notes"])
            await expect(page.locator(`a[href$="/${slug}"]`)).toHaveCount(0);
          expect((await new AxeBuilder({ page }).include(".community-harbor").analyze()).violations).toEqual([]);
        };
        const capture = async (name: string) => {
          // Make each actual task heading visible only after its readiness
          // measurement and accessibility assertions have completed.
          await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
          await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        await page.goto("/");
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await measure(
          "Ordinary Community entry",
          () =>
            page
              .getByRole("navigation", { name: "Global navigation", exact: true })
              .getByRole("link", { name: "Community Harbor", exact: true })
              .click(),
          () => expect(heading("Find your next bearing")).toBeVisible(),
        );
        await expect(page.getByRole("heading", { name: "Featured at the Harbor", exact: true })).toBeVisible();
        await checkPublic();
        await capture("community-harbor");
        for (const [label, title, card] of districts) {
          await measure(
            `${label} district`,
            () => navigation.getByRole("link", { name: label, exact: true }).click(),
            async () => {
              await expect(heading(title)).toBeVisible();
              await expect(page.getByRole("heading", { level: 3, name: card, exact: true })).toBeVisible();
            },
          );
          await checkPublic();
          await capture(`district-${label.toLowerCase().replaceAll(" ", "-")}`);
        }
        const details = [
          { district: "Chronicles", card: "The Lantern Coast", outcome: "Chronicle preview" },
          { district: "Artifacts", card: "Glass Beacon Model", outcome: "Install or remix unavailable" },
          { district: "Creators", card: "Captain Almanac", outcome: "Creator Profile" },
          { district: "Creators", card: "Maker Lumen", outcome: "No public work yet" },
          { district: "Collections", card: "Harbor Starter Charts", outcome: "2 eligible entries" },
          { district: "Collections", card: "Empty Chart Case", outcome: "This public collection is empty" },
          { district: "Guides", card: "Reading the Weathered Chart", outcome: "Practical guidance" },
          { district: "Voyage Logs", card: "Fictional Lantern Voyage Log", outcome: "Voyage Record" },
        ];
        for (const detail of details) {
          await navigation.getByRole("link", { name: detail.district, exact: true }).click();
          const card = page
            .locator("article.community-card")
            .filter({ has: page.getByRole("heading", { level: 3, name: detail.card, exact: true }) });
          await expect(card).toHaveCount(1);
          await measure(
            `${detail.card} detail`,
            () => card.getByRole("heading", { level: 3 }).getByRole("link", { name: detail.card, exact: true }).click(),
            async () => {
              await expect(heading(detail.card)).toBeVisible();
              await expect(page.getByRole("heading", { name: detail.outcome, exact: true })).toBeVisible();
            },
          );
          if (detail.card === "The Lantern Coast") {
            const comments = page.getByRole("region", { name: "Comments", exact: true });
            await expect(comments).toContainText("No public comments yet.");
            await expect(comments.getByRole("link", { name: "Sign in to comment", exact: true })).toBeVisible();
            await expect(comments.getByRole("textbox")).toHaveCount(0);
          }
          await checkPublic();
          await capture(`detail-${detail.card.toLowerCase().replaceAll(" ", "-")}`);
          await measure(
            `${detail.card} return`,
            () => navigation.getByRole("link", { name: "Community Harbor", exact: true }).click(),
            () => expect(heading("Find your next bearing")).toBeVisible(),
          );
        }
        const search = page.getByRole("searchbox", { name: "Search public Community Harbor", exact: true });
        await search.fill("sextant-no-public-chart-20261019");
        await measure(
          "Actual empty public search",
          () => page.getByRole("button", { name: "Search Community Harbor", exact: true }).click(),
          () =>
            expect(
              page.getByRole("heading", { name: "No public charts match these criteria", exact: true }),
            ).toBeVisible(),
        );
        await checkPublic();
        await search.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("community-empty-search.png") });
        // There are two legitimate clear controls (active chips and empty state).
        const empty = page.locator(".community-state--empty");
        await empty.getByRole("button", { name: "Clear search and filters", exact: true }).click();
        await expect(search).toHaveValue("");
        await expect(
          page.getByRole("heading", { name: "No public charts match these criteria", exact: true }),
        ).toHaveCount(0);
        await page.getByRole("link", { name: "Voyagewright home", exact: true }).click();
        await expect(page).toHaveURL(/\/$/u);
        await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeVisible();
        expect(
          await db.taleSession.findUniqueOrThrow({
            where: { id: fixture.playerVoyageId },
            select: { currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
          }),
        ).toEqual(baseline);
        expect(
          await db.publishedTaleVersion.findUniqueOrThrow({
            where: { id: fixture.playerVersionId },
            select: { checksum: true, contentSnapshot: true },
          }),
        ).toEqual(edition);
        await writeFile(
          info.outputPath("community-journey-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-community-journeys.spec.ts",
                ".agents/scripts/sextant-community-fixture.ts",
                "scripts/homeport/seed-phase4-fixture.mjs",
              ]),
              fixture,
              viewport,
              reducedMotion,
              feedback,
              anonymous: true,
              ordinaryEntryAndReturn: true,
              publicDistricts: districts.length,
              publicDetails: details.length,
              actualEmptySearch: true,
              hiddenLinksAbsent: true,
              unchangedCanonicalProgress: true,
              unchangedPublishedEdition: true,
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
