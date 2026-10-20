// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.admiralty-dossier
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantAdmiraltyExperience } from "../../.agents/scripts/sextant-admiralty-fixture";
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
      test("ordinary Admiralty entry, bounded dossier and ungranted support return", async ({ page }, info) => {
        const key = `admiralty-${viewport.width}-${reducedMotion}` as
          | "admiralty-1280-no-preference"
          | "admiralty-1280-reduce"
          | "admiralty-390-no-preference"
          | "admiralty-390-reduce";
        const fixture = await seedSextantAdmiraltyExperience(key);
        expect(await seedSextantAdmiraltyExperience(key)).toEqual(fixture);
        const ids = [fixture.voyageId, fixture.playerVoyageId];
        const baseline = await db.taleSession.findMany({
          where: { id: { in: ids } },
          orderBy: { id: "asc" },
          select: { id: true, status: true, currentBlockId: true, currentSequence: true, publishedVersionId: true },
        });
        expect(baseline).toHaveLength(2);
        const versionIds = baseline.map((row) => row.publishedVersionId!);
        const editions = await db.publishedTaleVersion.findMany({
          where: { id: { in: versionIds } },
          orderBy: { id: "asc" },
          select: { id: true, checksum: true, contentSnapshot: true },
        });
        const privilegedCounts = async () => ({
          requests: await db.supportAccessRequest.count(),
          grants: await db.supportAccessGrant.count(),
          assurance: await db.privilegedAssurance.count(),
        });
        const privilegedBefore = await privilegedCounts();
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const began = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - began;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const heading = (name: string) => page.getByRole("heading", { name, exact: true });
        const capture = async (name: string, target = page.getByRole("heading", { level: 1 })) => {
          expect((await new AxeBuilder({ page }).include(".chartroom").analyze()).violations).toEqual([]);
          await target.scrollIntoViewIfNeeded();
          await expect(target).toBeInViewport();
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        await page.goto("/sign-in?returnTo=%2Faccount");
        await page.getByRole("textbox", { name: "Email or Player name", exact: true }).fill(fixture.email);
        await page.getByRole("textbox", { name: "Password", exact: true }).fill("Synthetic-Sextant-Resources-2026!");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(heading("Overview")).toBeVisible();
        await page.getByRole("button", { name: fixture.displayName, exact: true }).click();
        await measure(
          "Ordinary Admiralty entry",
          () => page.getByRole("link", { name: "Admiralty", exact: true }).click(),
          () => expect(heading("Platform Overview")).toBeVisible(),
        );
        await expect(page.locator(".chartroom-operator")).toContainText(fixture.displayName);
        await expect(page.getByRole("group", { name: fixture.displayName, exact: true })).toContainText(
          "ADMINISTRATOR",
        );
        await capture("admiralty-overview");
        const navigation = page.getByRole("navigation", { name: "Admiralty navigation", exact: true });
        await measure(
          "Bounded People station",
          () => navigation.getByRole("link", { name: "People", exact: true }).click(),
          () => expect(heading("Start with a known clue")).toBeVisible(),
        );
        await capture("admiralty-known-clue", heading("Start with a known clue"));
        const search = page.locator(".chartroom-search").getByRole("textbox", { name: "Search", exact: true });
        const submit = page.locator(".chartroom-search").getByRole("button", { name: "Search", exact: true });
        await search.fill("sextant-no-such-person-20261019");
        await measure(
          "Actual empty account search",
          () => submit.click(),
          () => expect(heading("No matching account")).toBeVisible(),
        );
        await capture("admiralty-empty-people", heading("No matching account"));
        await search.fill(fixture.targetAccountId);
        const target = page.getByRole("link", { name: fixture.targetDisplayName, exact: true });
        await measure(
          "Actual synthetic Crew search",
          () => submit.click(),
          () => expect(target).toBeVisible(),
        );
        await capture("admiralty-target-search", target);
        await measure(
          "Actual authorized account dossier",
          () => target.click(),
          () => expect(heading(fixture.targetDisplayName)).toBeVisible(),
        );
        await expect(page).toHaveURL(new RegExp(`/admin/people/${fixture.targetAccountId}$`));
        await capture("admiralty-dossier");
        const support = page.locator(".chartroom-panel").filter({ has: heading("Support access") });
        await expect(support).toHaveCount(1);
        await expect(support).toContainText("Verification required");
        await expect(support.getByRole("button", { name: "Verify for privileged work", exact: true })).toBeDisabled();
        await expect(support.getByRole("textbox", { name: "Grant ID", exact: true })).toHaveValue("");
        await capture("admiralty-ungranted-support", heading("Support access"));
        await measure(
          "Actual conditional Tideglass fields",
          () =>
            support
              .getByRole("combobox", { name: "Scoped category", exact: true })
              .selectOption("TIDEGLASS_DIAGNOSTICS"),
          () =>
            expect(support.getByRole("group", { name: "Exact immutable comparison pair", exact: true })).toBeVisible(),
        );
        await capture(
          "admiralty-ungranted-tideglass",
          support.getByRole("group", { name: "Exact immutable comparison pair", exact: true }),
        );
        await support.getByRole("combobox", { name: "Scoped category", exact: true }).selectOption("ACCOUNT_STATE");
        await measure(
          "Ordinary Admiralty account return",
          () => page.getByRole("link", { name: "Return to account", exact: true }).click(),
          () => expect(heading("Overview")).toBeVisible(),
        );
        await expect(page.getByRole("button", { name: fixture.displayName, exact: true })).toBeVisible();
        expect((await new AxeBuilder({ page }).include(".personal-harbor").analyze()).violations).toEqual([]);
        await heading("Overview").scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("admiralty-account-return.png") });
        expect(await privilegedCounts()).toEqual(privilegedBefore);
        expect(
          await db.taleSession.findMany({
            where: { id: { in: ids } },
            orderBy: { id: "asc" },
            select: { id: true, status: true, currentBlockId: true, currentSequence: true, publishedVersionId: true },
          }),
        ).toEqual(baseline);
        expect(
          await db.publishedTaleVersion.findMany({
            where: { id: { in: versionIds } },
            orderBy: { id: "asc" },
            select: { id: true, checksum: true, contentSnapshot: true },
          }),
        ).toEqual(editions);
        await writeFile(
          info.outputPath("admiralty-journey-receipt.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              classification: "ENGINEERING_SYNTHETIC_ADMIRALTY_DEVELOPMENT_NOT_ACCEPTANCE",
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-admiralty-journeys.spec.ts",
                ".agents/scripts/sextant-admiralty-fixture.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              baseline,
              feedback,
              privilegedBefore,
              privilegedAfter: await privilegedCounts(),
              ordinaryCanonicalOperatorEntry: true,
              unchangedCanonicalProgressAndEditionBytes: true,
              noConsentRequestAssuranceApprovedReadOrCommand: true,
              readAuditMetadataMayBeAppended: true,
              consentedSupportReadCovered: false,
              legacyAdmiraltyConsoleHostCovered: false,
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
