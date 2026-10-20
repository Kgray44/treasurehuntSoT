// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.creator-authoring-resources
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
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
      test("ordinary owned Creator libraries, empty Living Chart, current Drydock and publication review return", async ({
        page,
      }, info) => {
        const key = `${viewport.width}-${reducedMotion}` as
          | "1280-no-preference"
          | "1280-reduce"
          | "390-no-preference"
          | "390-reduce";
        const fixture = await seedSextantResourceExperiences(key);
        const diagnosticPaths = new Set([
          `/api/studio/tales/${fixture.taleId}/scenarios`,
          `/api/studio/tales/${fixture.taleId}/scenarios/suites`,
          `/api/studio/tales/${fixture.taleId}/simulation-runs`,
        ]);
        let diagnosticResponses = 0;
        page.on("response", (response) => {
          const pathname = new URL(response.url()).pathname;
          if (!diagnosticPaths.has(pathname) || diagnosticResponses++ >= 12) return;
          // Bounded responses from this task's fixed synthetic Chronicle only;
          // no authored source, cookies or private diagnostics are logged.
          void response
            .json()
            .then((body: { code?: string; error?: string; sourceChecksum?: string }) => {
              console.log(
                "SEXTANT_AUTHORING_TRIAL_RESPONSE",
                JSON.stringify({
                  pathname,
                  status: response.status(),
                  hasSourceChecksum: Boolean(body.sourceChecksum),
                  code: body.code?.slice(0, 80),
                  error: body.error?.slice(0, 256),
                }),
              );
            })
            .catch(() => console.warn("SEXTANT_AUTHORING_TRIAL_RESPONSE_UNAVAILABLE"));
        });
        const voyageIds = [fixture.voyageId, fixture.playerVoyageId];
        const baseline = await db.taleSession.findMany({
          where: { id: { in: voyageIds } },
          orderBy: { id: "asc" },
          select: { id: true, currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
        });
        expect(baseline).toHaveLength(2);
        const editionIds = baseline.map((row) => row.publishedVersionId!);
        const editions = await db.publishedTaleVersion.findMany({
          where: { id: { in: editionIds } },
          orderBy: { id: "asc" },
          select: { id: true, checksum: true, contentSnapshot: true },
        });
        const releaseCount = await db.publishedTaleVersion.count({ where: { taleId: fixture.taleId } });
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const started = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - started;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        await page.goto("/sign-in?returnTo=%2Faccount");
        await page.getByRole("textbox", { name: "Email or Player name", exact: true }).fill(fixture.email);
        await page.getByRole("textbox", { name: "Password", exact: true }).fill("Synthetic-Sextant-Resources-2026!");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        const accountMenu = page.getByRole("button", { name: fixture.displayName, exact: true });
        await accountMenu.click();
        await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
        await page.getByRole("link", { name: "Enter Creator", exact: true }).click();
        await page.getByRole("link", { name: "Edit Chronicle", exact: true }).click();
        const navigation = page.getByRole("navigation", { name: "Chronicle authoring sections", exact: true });
        const main = page.getByRole("main");
        for (const [label, heading] of [
          ["Assets", "Asset Library"],
          ["Waypoints", "Waypoints"],
          ["Artifacts", "Artifacts"],
          ["Living Chart", "Landfall"],
          ["Sea Trials", "Sea Trials"],
          ["Versions", "Version history"],
        ]) {
          await measure(
            `${label} response`,
            () => navigation.getByRole("link", { name: label, exact: true }).click(),
            async () => {
              await expect(page.getByRole("heading", { level: 2, name: heading, exact: true })).toBeVisible();
              if (label === "Sea Trials") {
                await expect(page.getByRole("region", { name: "Launch Gate", exact: true })).toContainText(
                  "Exact source checksum:",
                );
                await expect(page.getByRole("region", { name: "Compatibility", exact: true })).toContainText("Policy:");
              }
              if (label === "Versions")
                await expect(page.locator(".version-list [data-version-lock='immutable']")).toHaveCount(releaseCount);
            },
          );
          await expect(page.getByRole("heading", { level: 1, name: fixture.title, exact: true })).toBeVisible();
          if (label === "Assets") {
            await expect(page.locator(".asset-grid article")).toHaveCount(0);
            await expect(main).toContainText("0 assets");
            const drawer = page.getByRole("region", { name: "Asset drawer", exact: true });
            await measure(
              "Open actual Asset drawer",
              () => page.getByRole("button", { name: "Upload media", exact: true }).click(),
              async () => {
                await expect(drawer).toContainText("Upload and reuse assets");
                await expect(drawer).toHaveCSS("opacity", "1");
              },
            );
            expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
            await page.screenshot({ path: info.outputPath("authoring-asset-drawer.png") });
            await drawer.getByRole("button", { name: "Close asset drawer", exact: true }).click();
            await expect(drawer).toBeHidden();
          }
          if (label === "Waypoints" || label === "Artifacts")
            await expect(page.locator(".record-grid article")).toHaveCount(0);
          if (label === "Living Chart")
            await expect(main).toContainText("Add a real place or virtual world to begin the Living Chart.");
          const boundedPanels =
            label === "Sea Trials"
              ? [
                  page.getByRole("region", { name: "Saved Sea Trial Scenarios", exact: true }),
                  main.locator(".drydock-scenario-editor"),
                ]
              : label === "Versions"
                ? [page.getByRole("region", { name: "Review and publish", exact: true })]
                : [];
          for (const panel of boundedPanels) {
            await expect(panel).toBeVisible();
            const { observation, ...bounds } = await panel.evaluate((element) => {
              const box = element.getBoundingClientRect();
              const container = element.closest(".editor-single-panel")!.getBoundingClientRect();
              const offenders = [...element.querySelectorAll("*")].filter((child) => {
                const childBox = child.getBoundingClientRect();
                return childBox.width > 0 && (childBox.left < box.left - 1 || childBox.right > box.right + 1);
              });
              return {
                contained: box.left >= container.left - 1 && box.right <= container.right + 1,
                visibleOverflow: Math.max(0, element.scrollWidth - element.clientWidth),
                overflowingChildren: offenders.length,
                observation: {
                  panel: element.className,
                  width: Math.round(box.width),
                  nodes: offenders.slice(0, 8).map((child) => {
                    const childBox = child.getBoundingClientRect(),
                      style = getComputedStyle(child);
                    return {
                      tag: child.tagName,
                      class: child.className.toString().slice(0, 120),
                      label: child.getAttribute("aria-label")?.slice(0, 80),
                      section: child.closest("section[aria-label]")?.getAttribute("aria-label")?.slice(0, 80),
                      left: Math.round(childBox.left - box.left),
                      right: Math.round(childBox.right - box.right),
                      width: Math.round(childBox.width),
                      minWidth: style.minWidth,
                      fontSize: style.fontSize,
                    };
                  }),
                },
              };
            });
            if (!bounds.contained || bounds.visibleOverflow || bounds.overflowingChildren)
              console.log("SEXTANT_AUTHORING_BOUNDS", JSON.stringify({ label, ...bounds, observation }));
            expect(bounds, `${label} content stays within its card`).toEqual({
              contained: true,
              visibleOverflow: 0,
              overflowingChildren: 0,
            });
          }
          if (label === "Versions") {
            const review = page.getByRole("region", { name: "Review and publish", exact: true });
            await expect(review).toContainText("Drydock release decision");
            await expect(review.getByRole("checkbox")).not.toBeChecked();
            await expect(review.getByRole("button", { name: "Publish immutable Version", exact: true })).toBeDisabled();
          }
          expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
          await page.getByRole("heading", { level: 2, name: heading, exact: true }).scrollIntoViewIfNeeded();
          await expect(page.getByRole("heading", { level: 2, name: heading, exact: true })).toBeInViewport();
          await page.screenshot({ path: info.outputPath(`authoring-${label.toLowerCase().replaceAll(" ", "-")}.png`) });
          if (label === "Sea Trials") {
            const suite = page.getByRole("region", { name: "Scenario Suite controls", exact: true });
            await suite.scrollIntoViewIfNeeded();
            await expect(suite).toBeInViewport();
            await page.screenshot({ path: info.outputPath("authoring-scenario-suite.png") });
          }
          if (label === "Versions") {
            const confirmation = page
              .getByRole("region", { name: "Review and publish", exact: true })
              .getByRole("checkbox");
            await confirmation.scrollIntoViewIfNeeded();
            await expect(confirmation).toBeInViewport();
            await page.screenshot({ path: info.outputPath("authoring-publication-confirmation.png") });
            const badges = page.locator(".version-list article[data-version-lock='immutable'] > span");
            await expect(badges).toHaveCount(releaseCount);
            for (let index = 0; index < releaseCount; index++) {
              const badge = badges.nth(index);
              await badge.scrollIntoViewIfNeeded();
              await expect(badge).toBeInViewport();
              expect(
                await badge.evaluate((element) => {
                  const box = element.getBoundingClientRect();
                  const range = document.createRange();
                  range.selectNodeContents(element);
                  return [...range.getClientRects()].every(
                    (rect) =>
                      rect.left >= box.left - 1 &&
                      rect.right <= box.right + 1 &&
                      rect.top >= box.top - 1 &&
                      rect.bottom <= box.bottom + 1,
                  );
                }),
                "Entire immutable edition label remains inside its badge",
              ).toBe(true);
              await page.screenshot({ path: info.outputPath(`authoring-version-label-${index + 1}.png`) });
            }
          }
        }
        await page.getByRole("link", { name: "← Studio", exact: true }).click();
        await accountMenu.click();
        await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
        expect(
          await db.taleSession.findMany({
            where: { id: { in: voyageIds } },
            orderBy: { id: "asc" },
            select: { id: true, currentBlockId: true, currentSequence: true, publishedVersionId: true, status: true },
          }),
        ).toEqual(baseline);
        expect(
          await db.publishedTaleVersion.findMany({
            where: { id: { in: editionIds } },
            orderBy: { id: "asc" },
            select: { id: true, checksum: true, contentSnapshot: true },
          }),
        ).toEqual(editions);
        expect(await db.publishedTaleVersion.count({ where: { taleId: fixture.taleId } })).toBe(releaseCount);
        await writeFile(
          info.outputPath("authoring-resource-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-authoring-resource-journeys.spec.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
              ]),
              viewport,
              reducedMotion,
              feedback,
              ordinarySignInAndResourceOwnership: true,
              authoringSections: 6,
              noMediaUploaded: true,
              noWorldCreated: true,
              noTrialRun: true,
              noPublication: true,
              unchangedCanonicalProgress: true,
              unchangedPublishedEditions: true,
              populatedLibrariesAndChartToolsCovered: false,
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
