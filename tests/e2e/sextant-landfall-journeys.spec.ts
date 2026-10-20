// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.landfall
import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { seedSextantLandfallExperience } from "../../.agents/scripts/sextant-landfall-fixture";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { auditNativeGeolocation, geoAudit, enterClosureJournal, openClosureMap } from "./fixtures/landfall-closure";

test.describe.configure({ mode: "default", timeout: 180000 });
// Offline authorization and installation/pairing credentials must never enter traces.
// This journey never issues installation tokens or opens native pairing controls.
test.use({ video: "on", trace: "off", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" || process.env.LANDFALL_LAB_SYNTHETIC_PACKAGES !== "1")
    throw new Error("SEXTANT_OWNED_SIGNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    for (const kind of ["physical", "virtual"] as const) {
      test.describe(`${kind} ${viewport.width}px ${reducedMotion}`, () => {
        test.use({ viewport, contextOptions: { reducedMotion } });
        test("ordinary populated authoring, readable Player Chart and same-owner return preserve progression", async ({
          page,
          context,
        }, info) => {
          const fixture = await seedSextantLandfallExperience(
            kind,
            `${viewport.width}-${reducedMotion}` as
              | "1280-no-preference"
              | "1280-reduce"
              | "390-no-preference"
              | "390-reduce",
          );
          await auditNativeGeolocation(context);
          const voyageIds = [fixture.voyageId, fixture.playerVoyageId, fixture.landfallVoyageId];
          const readProgress = () =>
            db.taleSession.findMany({
              where: { id: { in: voyageIds } },
              orderBy: { id: "asc" },
              select: { id: true, status: true, currentSequence: true, currentBlockId: true, publishedVersionId: true },
            });
          const progress = await readProgress();
          expect(progress).toHaveLength(3);
          expect(progress.every((row) => row.status === "ACTIVE")).toBe(true);
          const versionIds = progress.map((row) => row.publishedVersionId!);
          const readEditions = () =>
            db.publishedTaleVersion.findMany({
              where: { id: { in: versionIds } },
              orderBy: { id: "asc" },
              select: { id: true, checksum: true, contentSnapshot: true },
            });
          const editions = await readEditions();
          const readEvents = () =>
            db.taleSessionEvent.findMany({
              where: { sessionId: { in: voyageIds } },
              orderBy: { id: "asc" },
              select: { id: true, sessionId: true, sequence: true, eventType: true, payload: true },
            });
          const events = await readEvents();
          const readMemberships = () =>
            db.playthroughMembership.findMany({
              where: { playthroughId: { in: voyageIds } },
              orderBy: { id: "asc" },
              select: { id: true, playthroughId: true, playerProfileId: true, status: true },
            });
          const memberships = await readMemberships();
          const draft = await db.taleDraft.findFirstOrThrow({
            where: { taleId: fixture.landfallTaleId },
            orderBy: { revisionNumber: "desc" },
          });
          const feedback: Array<{ task: string; elapsedMs: number; budgetMs: number }> = [];
          const measure = async (
            task: string,
            activate: () => Promise<unknown>,
            ready: () => Promise<unknown>,
            budgetMs = 3000,
          ) => {
            const began = performance.now();
            await activate();
            await ready();
            const elapsedMs = performance.now() - began;
            feedback.push({ task, elapsedMs, budgetMs });
            expect(elapsedMs, task).toBeLessThanOrEqual(budgetMs);
          };
          const heading = (name: string, level: 1 | 2 = 1) => page.getByRole("heading", { name, level, exact: true });
          const menu = (name: string) => page.getByRole("button", { name, exact: true });
          const accountDestination = async (name: string, destination: string) => {
            await menu(name).click();
            await page
              .getByRole("dialog", { name: "Account navigation", exact: true })
              .getByRole("link", { name: destination, exact: true })
              .click();
          };
          const capture = async (name: string, target: Locator, scope: string) => {
            expect((await new AxeBuilder({ page }).include(scope).analyze()).violations).toEqual([]);
            await target.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
            await expect(target).toBeInViewport({ ratio: 1 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.screenshot({ path: info.outputPath(`landfall-${kind}-${name}.png`) });
          };
          const signIn = async (email: string, password: string, name: string) => {
            await page.goto("/sign-in?returnTo=%2Faccount");
            await page.getByLabel("Email or Player name", { exact: true }).fill(email);
            await page.getByLabel("Password", { exact: true }).fill(password);
            await page.getByRole("button", { name: "Sign in", exact: true }).click();
            await expect(heading("Overview")).toBeVisible();
            await expect(menu(name)).toBeVisible();
          };

          await signIn(fixture.email, "Synthetic-Sextant-Resources-2026!", fixture.displayName);
          await accountDestination(fixture.displayName, "All Workspaces");
          await page.getByRole("link", { name: "Enter Creator", exact: true }).click();
          const card = page.locator("article.tale-studio-card").filter({ has: heading(fixture.landfallTitle, 2) });
          await card.getByRole("link", { name: "Edit Chronicle", exact: true }).click();
          await measure(
            "Ordinary populated Living Chart authoring",
            () =>
              page
                .getByRole("navigation", { name: "Chronicle authoring sections", exact: true })
                .getByRole("link", { name: "Living Chart", exact: true })
                .click(),
            () => expect(page.getByRole("region", { name: "Landfall authoring workspace", exact: true })).toBeVisible(),
          );
          const workspace = page.getByRole("region", { name: "Landfall authoring workspace", exact: true });
          const waypointName = kind === "physical" ? "Town arrival" : "Secret Isle";
          await workspace
            .locator(".landfall-object-list")
            .getByRole("button", { name: `Inspect waypoint ${waypointName}`, exact: true })
            .click();
          await capture("authoring-workspace", heading("Landfall", 2), ".landfall-workspace");
          if (kind === "physical") {
            const online = workspace.locator(".landfall-online-data-panel");
            await online.locator("summary").click();
            await measure(
              "Actual Studio unconfigured online services",
              () => online.getByRole("button", { name: "Check online data options", exact: true }).click(),
              () =>
                expect(online.getByRole("status", { name: "Online data status", exact: true })).toContainText(
                  "No online data services are configured",
                ),
            );
            await capture(
              "authoring-online-unavailable",
              online.getByRole("status", { name: "Online data status", exact: true }),
              ".landfall-workspace",
            );
            const installations = workspace.getByRole("group", {
              name: "Optional QR and NFC installations",
              exact: true,
            });
            await expect(installations.getByLabel("Installation label", { exact: true })).toHaveValue(
              "Synthetic optional tag",
            );
            await measure(
              "Actual Studio unconfigured installation signing",
              () => installations.getByRole("button", { name: "Check published installations", exact: true }).click(),
              () => expect(installations.getByRole("status")).toContainText("Installation signing is not configured"),
            );
            await capture("authoring-installation-fallback", installations.getByRole("status"), ".landfall-workspace");
          }
          const field = workspace.getByRole("region", { name: "Creator field test", exact: true });
          await expect(field).toContainText("0 of 20 retained in memory");
          expect(await db.landfallFieldTestReceipt.count({ where: { draftId: draft.id } })).toBe(0);
          await measure(
            "Actual explicit draft fallback preview receipt",
            () => field.getByRole("button", { name: "Save fallback preview receipt", exact: true }).click(),
            () => expect(field.getByRole("status")).toContainText("Sanitized incomplete receipt saved."),
          );
          const fieldReceipts = await db.landfallFieldTestReceipt.findMany({ where: { draftId: draft.id } });
          expect(fieldReceipts).toHaveLength(1);
          expect(fieldReceipts[0]).toMatchObject({
            providerClass: "FALLBACK_PREVIEW",
            result: "INCOMPLETE",
            sampleCount: 0,
            sourceVersion: draft.autosaveVersion,
          });
          await capture("authoring-fallback-receipt", field.getByRole("status"), ".landfall-workspace");
          expect((await geoAudit(page)).calls).toBe(0);
          await menu(fixture.displayName).click();
          await page
            .getByRole("dialog", { name: "Account navigation", exact: true })
            .getByRole("button", { name: "Sign out", exact: true })
            .click();
          await expect(page).toHaveURL(/\/$/u);

          await signIn(fixture.crewEmail!, "Synthetic-Sextant-Crew-2026!", fixture.crewDisplayName);
          await accountDestination(fixture.crewDisplayName, "Player");
          await expect(heading("My Chronicle Library")).toBeVisible();
          const actualVoyage = page
            .getByRole("main")
            .locator(`a[href="/player/playthroughs/${fixture.landfallVoyageId}/journal"]`);
          await expect(actualVoyage).toHaveCount(1);
          // Existing Landfall whole-Journal cold readiness budget is30s; optional-control feedback remains3s.
          await measure(
            "Ordinary Library to whole Landfall Journal",
            () => actualVoyage.click(),
            () => enterClosureJournal(page),
            30000,
          );
          await expect(page.getByRole("main", { name: "Voyage Journal", exact: true })).toHaveAttribute(
            "data-voyage-id",
            fixture.landfallVoyageId,
          );
          await openClosureMap(page);
          const drawer = page.locator(".journal-objects-drawer.open");
          const chart = drawer.locator("[data-landfall-player-chart]:visible");
          await expect(chart).toHaveAttribute("data-worldspace-kind", kind.toUpperCase());
          await expect(chart.getByRole("region", { name: "Context and floor guidance", exact: true })).toContainText(
            kind === "physical"
              ? "Rooms, floors and exact objects need independent evidence"
              : "No live game position is assumed",
          );
          await expect(chart.locator(".landfall-presentation").getByRole("status")).toHaveText(
            new RegExp(
              `^(The Living Chart is ready\\.|Route revealed: ${kind === "physical" ? "Town walk" : "Isle crossing"})$`,
              "u",
            ),
          );
          await capture(
            "player-context",
            chart.getByRole("region", { name: "Context and floor guidance", exact: true }).getByRole("status"),
            ".journal-objects-drawer.open",
          );
          const search = chart.getByRole("region", { name: "Search released places", exact: true });
          await search.getByRole("searchbox").fill("sextant-no-released-place-2026");
          await expect(search.getByRole("status")).toHaveText("No released places match.");
          await capture("released-search-empty", search.getByRole("status"), ".journal-objects-drawer.open");
          await search.getByRole("searchbox").fill(waypointName);
          const place = search.getByRole("button", { name: new RegExp(`^View ${waypointName} ·`, "u") });
          await expect(place).toHaveCount(1);
          await place.click();
          await capture("released-search-result", place, ".journal-objects-drawer.open");
          await search.getByRole("button", { name: "Clear place search", exact: true }).click();
          await expect(search.getByRole("searchbox")).toHaveValue("");
          if (kind === "physical") {
            // The actual browser host has no companion. Neither hidden native-only panel is fabricated.
            await expect(chart.getByRole("region", { name: "Optional background reminders", exact: true })).toHaveCount(
              0,
            );
            await expect(chart.locator(".landfall-nearby-panel")).toHaveCount(0);
            const ble = chart.locator(".landfall-ble-panel");
            await ble.locator("summary").click();
            await expect(ble.getByRole("button", { name: "Scan optional Bluetooth", exact: true })).toBeDisabled();
            await expect(ble.getByRole("status")).toContainText("scanning is off");
            await capture(
              "bluetooth-browser-absence",
              ble.getByRole("button", { name: "Scan optional Bluetooth", exact: true }),
              ".journal-objects-drawer.open",
            );
            const installation = chart.locator(".landfall-installation-panel");
            await installation.locator("summary").click();
            await measure(
              "Actual Player unconfigured installation signing",
              () => installation.getByRole("button", { name: "Check installation availability", exact: true }).click(),
              () => expect(installation.getByRole("status")).toContainText("unavailable on this deployment"),
            );
            await capture(
              "player-installation-unavailable",
              installation.getByRole("status"),
              ".journal-objects-drawer.open",
            );
            const online = chart.locator(".landfall-online-data-panel");
            await online.locator("summary").click();
            await measure(
              "Actual Player unconfigured online services",
              () => online.getByRole("button", { name: "Check online data options", exact: true }).click(),
              () =>
                expect(online.getByRole("status", { name: "Online data status", exact: true })).toContainText(
                  "No online data services are configured",
                ),
            );
            await capture(
              "player-online-unavailable",
              online.getByRole("status", { name: "Online data status", exact: true }),
              ".journal-objects-drawer.open",
            );
            const landmark = chart.getByRole("region", { name: "Natural landmark", exact: true });
            await expect(landmark.getByRole("button", { name: "Open landmark camera", exact: true })).toBeDisabled();
            await expect(landmark.getByRole("status")).toContainText("Reach the surrounding area before comparing");
            await capture(
              "landmark-prerequisite",
              landmark.getByRole("button", { name: "Open landmark camera", exact: true }),
              ".journal-objects-drawer.open",
            );
          } else {
            await expect(chart.getByRole("button", { name: "Use my location", exact: true })).toHaveCount(0);
            const region = chart.getByRole("region", { name: "Offline region", exact: true });
            await measure(
              "Actual signed offline region preparation",
              () => region.getByRole("button", { name: "Prepare offline region", exact: true }).click(),
              () => expect(region.getByRole("button", { name: "Download offline region", exact: true })).toBeVisible(),
              15000,
            );
            await expect(region).toContainText("1 authorized first-party images");
            await capture(
              "offline-region-prepared",
              region.getByRole("button", { name: "Download offline region", exact: true }),
              ".journal-objects-drawer.open",
            );
            await measure(
              "Actual signed offline region download",
              () => region.getByRole("button", { name: "Download offline region", exact: true }).click(),
              () => expect(region.getByRole("status")).toContainText("Offline region: ready"),
              15000,
            );
            await expect(
              region.getByRole("progressbar", { name: "Verified offline download", exact: true }),
            ).toHaveAttribute(
              "value",
              (await region
                .getByRole("progressbar", { name: "Verified offline download", exact: true })
                .getAttribute("max")) as string,
            );
            await capture("offline-region-ready", region.getByRole("status"), ".journal-objects-drawer.open");
            await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
            await context.setOffline(true);
            try {
              await measure(
                "Actual offline reload of previously authorized Journal",
                () => page.reload(),
                async () => {
                  await expect(heading("Offline Voyage Journal")).toBeVisible();
                  await expect(page.locator("[data-landfall-player-chart]:visible")).toContainText(
                    "Offline chart restored",
                  );
                },
                15000,
              );
              await capture("offline-journal-restored", heading("Offline Voyage Journal"), ".landfall-offline-journal");
            } finally {
              await context.setOffline(false);
            }
            await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
            await page.getByRole("link", { name: "Return to the online Journal", exact: true }).click();
            await enterClosureJournal(page);
            await openClosureMap(page);
            const restored = page
              .locator(".journal-objects-drawer.open")
              .getByRole("region", { name: "Offline region", exact: true });
            await expect(restored.getByRole("status")).toContainText("Offline region: ready");
            await measure(
              "Actual owned offline region removal",
              () => restored.getByRole("button", { name: "Remove offline region", exact: true }).click(),
              () => expect(restored.getByRole("status")).toContainText("removed from this device"),
              15000,
            );
            await capture("offline-region-removed", restored.getByRole("status"), ".journal-objects-drawer.open");
          }
          expect((await geoAudit(page)).calls).toBe(0);
          await page.getByRole("button", { name: "Close journal tool drawer", exact: true }).click();
          await measure(
            "Actual unavailable incoming notification return",
            () => page.goto("/player/landfall-return?handle=sextant-invalid-native-return-2026"),
            () => expect(heading("My Chronicle Library")).toBeVisible(),
          );
          await expect(menu(fixture.crewDisplayName)).toBeVisible();
          await capture("invalid-notification-safe-return", heading("My Chronicle Library"), "main");
          await accountDestination(fixture.crewDisplayName, "Personal Harbor");
          await expect(heading("Overview")).toBeVisible();
          await expect(menu(fixture.crewDisplayName)).toBeVisible();
          await capture("same-crew-account-return", heading("Overview"), ".personal-harbor");
          expect(await readProgress()).toEqual(progress);
          expect(await readEditions()).toEqual(editions);
          expect(await readEvents()).toEqual(events);
          expect(await readMemberships()).toEqual(memberships);
          const afterDraft = await db.taleDraft.findUniqueOrThrow({ where: { id: draft.id } });
          expect(afterDraft.autosaveVersion).toBe(draft.autosaveVersion);
          expect(afterDraft.landfallDefinition).toBe(draft.landfallDefinition);
          await writeFile(
            info.outputPath("landfall-journey-receipt.json"),
            JSON.stringify(
              {
                schemaVersion: 1,
                classification: "ENGINEERING_SYNTHETIC_LANDFALL_DEVELOPMENT_NOT_ACCEPTANCE",
                source: await deviceLabSourceIdentity([
                  "tests/e2e/sextant-landfall-journeys.spec.ts",
                  ".agents/scripts/sextant-landfall-fixture.ts",
                  ".agents/scripts/sextant-resource-fixtures.ts",
                  ".agents/scripts/sextant-experience-fixture.ts",
                  ".agents/scripts/sextant-account-recovery-fixture.ts",
                  "tests/e2e/fixtures/landfall-closure.ts",
                  "tests/e2e/fixtures/sounding-line-isolation.ts",
                  "testing/contracts.json",
                ]),
                viewport,
                reducedMotion,
                kind,
                feedback,
                baseline: progress,
                ordinaryDistinctOwnerCrewSignIn: true,
                unchangedProgressEventsMembershipsAndExactEditionBytes: true,
                draftMutation: "ONE_EXPLICIT_INCOMPLETE_FALLBACK_PREVIEW_RECEIPT_WITH_ZERO_SAMPLES",
                browserGeolocationStarts: 0,
                installationCredentialsIssued: false,
                nativeHostFabricated: false,
                offlineRestoration:
                  kind === "virtual"
                    ? "PREVIOUSLY_AUTHORIZED_JOURNAL_WITH_VERIFIED_REGION_PRESENT_NO_CACHE_PURGE_OR_ROUTE_INTERCEPTION"
                    : "NOT_EXERCISED",
                nativeBackgroundNearbyAndNotificationReturn: "SEPARATE_NATIVE_HOST_OBLIGATION",
                invalidNotificationReturn: "ACTUAL_SAFE_PLAYER_ENTRY_WITH_SAME_CREW_ACCOUNT",
                physicalPresenceSensorAccuracyAndOwnerAcceptance: false,
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
}
