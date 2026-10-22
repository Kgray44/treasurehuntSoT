// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.display-entry,sextant.shared-consumers.pilot-entry
import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import {
  seedSextantEntryExperience,
  type SextantEntryCase,
} from "../../.agents/scripts/sextant-entry-fixture";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { enterClosureJournal } from "./fixtures/landfall-closure";
import { observeSextantSignIn } from "./fixtures/sextant-consumer-diagnostics";
import { observeNoSextantPairing, openSextantDevicePreferences } from "./fixtures/sextant-device-journey";

test.describe.configure({ mode: "default", timeout: 180000 });
// No pairing code or installation credential is issued. Network traces stay off.
test.use({ video: "on", trace: "off", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("SEXTANT_OWNED_ENTRY_REQUIRED");
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
      test("ordinary connected-empty Display and unprepared pilot return preserve the actual Voyages", async ({
        page,
      }, info) => {
        const fixture = await seedSextantEntryExperience(
          `${viewport.width}-${reducedMotion}` as SextantEntryCase,
        );
        const pairing = observeNoSextantPairing(page);
        const voyageIds = [fixture.voyageId, fixture.playerVoyageId];
        const readProgress = () =>
          db.taleSession.findMany({
            where: { id: { in: voyageIds } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              status: true,
              currentSequence: true,
              currentBlockId: true,
              publishedVersionId: true,
            },
          });
        const progress = await readProgress();
        expect(progress).toHaveLength(2);
        expect(progress.every((row) => row.status === "ACTIVE")).toBe(true);
        const readEditions = () =>
          db.publishedTaleVersion.findMany({
            where: { id: { in: progress.map((row) => row.publishedVersionId!) } },
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
        const feedback: Array<{ task: string; elapsedMs: number; budgetMs: number }> = [];
        const measure = async (
          task: string,
          activate: () => Promise<unknown>,
          ready: () => Promise<unknown>,
        ) => {
          const began = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - began;
          feedback.push({ task, elapsedMs, budgetMs: 3000 });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const heading = (name: string) => page.getByRole("heading", { name, exact: true });
        const menu = (name: string) => page.getByRole("button", { name, exact: true });
        const accountDestination = async (name: string, destination: string) => {
          await menu(name).click();
          await page
            .getByRole("dialog", { name: "Account navigation", exact: true })
            .getByRole("link", { name: destination, exact: true })
            .click();
        };
        const capture = async (name: string, target: Locator, scope = "main") => {
          pairing.assertNone();
          expect((await new AxeBuilder({ page }).include(scope).analyze()).violations).toEqual([]);
          await target.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
          await expect(target).toBeInViewport({ ratio: 1 });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: info.outputPath(`entry-${name}.png`) });
        };
        const signIn = async (
          email: string,
          password: string,
          accountId: string,
          destination: string,
          ready: () => Promise<unknown>,
        ) => {
          await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
          await observeSextantSignIn(page, accountId, async () => {
            await page.getByLabel("Email or Player name", { exact: true }).fill(email);
            await page.getByLabel("Password", { exact: true }).fill(password);
            await measure("Ordinary sign-in to " + destination, () => menu("Sign in").click(), ready);
          });
        };
        const crewName = fixture.crewDisplayName;
        await signIn(
          fixture.crewEmail!,
          "Synthetic-Sextant-Crew-2026!",
          fixture.crewAccountId,
          "/account",
          () => expect(heading("Overview")).toBeVisible(),
        );
        await accountDestination(crewName, "Player");
        await expect(heading("My Chronicle Library")).toBeVisible();
        const voyageCard = page.locator("article.player-tale-card").filter({ has: heading(fixture.title) });
        const voyageEntry = voyageCard.locator(".card-actions > a.brass-button");
        await expect(voyageEntry).toHaveAttribute("href", `/player/playthroughs/${fixture.voyageId}/journal`);
        const journalResponse = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `/api/play/sessions/${fixture.voyageId}` &&
            response.request().method() === "GET" &&
            response.status() === 200,
        );
        await voyageEntry.click();
        await enterClosureJournal(page);
        const journalBody = await (await journalResponse).json();
        expect(journalBody.session.versionId).toBe(fixture.versionId);
        const journal = page.getByRole("main", { name: "", exact: true });
        await expect(journal).toHaveAttribute("data-voyage-id", fixture.voyageId);
        await page.getByRole("button", { name: "Replay full opening", exact: true }).click();
        await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY", { timeout: 15000 });
        const preferenceEntry = await openSextantDevicePreferences(page, crewName, fixture.voyageId);
        feedback.push(...preferenceEntry.feedback);
        const devices = preferenceEntry.devices;
        const display = page.locator("main[data-crossdeck-crew-display]");
        await expect(devices).toBeVisible();
        await expect(devices.getByRole("combobox", { name: "Chronicle", exact: true })).toHaveValue(
          fixture.voyageId,
        );
        // An incoming bookmarked display has no tab-owned surface yet. Exercise
        // its real fallback and ordinary Manage return before registering here.
        await measure(
          "Incoming disconnected Crew display fallback",
          () => page.goto(`/devices/display?voyage=${encodeURIComponent(fixture.voyageId)}`),
          async () => {
            await expect(display.getByRole("status")).toHaveText("Display disconnected");
            await expect(
              display.getByRole("heading", { name: "Reconnect this display", exact: true }),
            ).toBeVisible();
            await expect(display).toContainText(
              "Connect this device as a crew display from your Chronicle to receive a shared view.",
            );
          },
        );
        await expect(page.getByRole("region", { name: "Send to your devices", exact: true })).toHaveCount(0);
        await capture(
          "disconnected-display",
          display.getByRole("heading", { name: "Reconnect this display", exact: true }),
          "main[data-crossdeck-crew-display]",
        );
        await measure(
          "Disconnected display Manage return",
          () => page.getByRole("link", { name: "Manage this display", exact: true }).click(),
          () => expect(devices).toBeVisible(),
        );
        // Manage binds the real Chronicle chooser through its exact Voyage URL.
        await expect(page).toHaveURL(new URL(`/account/devices?voyage=${fixture.voyageId}`, page.url()).href);
        await expect(devices.getByRole("combobox", { name: "Chronicle", exact: true })).toHaveValue(
          fixture.voyageId,
        );
        const label = `Synthetic crew screen ${viewport.width} ${reducedMotion}`;
        await expect(devices.getByRole("heading", { name: label, exact: true })).toHaveCount(0);
        await expect(
          devices.getByRole("heading", { name: `${label} · This screen`, exact: true }),
        ).toHaveCount(0);
        await devices.getByLabel("Device name", { exact: true }).fill(label);
        const row = devices
          .locator("li")
          .filter({ has: page.getByRole("heading", { name: `${label} · This screen`, exact: true }) });
        await measure(
          "Register current ordinary Crew device",
          () => devices.getByRole("button", { name: "Use this device", exact: true }).click(),
          () => expect(row).toBeVisible(),
        );
        await measure(
          "Open this screen's device options",
          () => row.locator("summary").click(),
          () => expect(row.getByRole("combobox", { name: "Device purpose", exact: true })).toBeVisible(),
        );
        await measure(
          "Assign existing Crew display role",
          () =>
            row
              .getByRole("combobox", { name: "Device purpose", exact: true })
              .selectOption("SHARED_CREW_DISPLAY"),
          () =>
            expect(row.getByRole("combobox", { name: "Device purpose", exact: true })).toHaveValue(
              "SHARED_CREW_DISPLAY",
            ),
        );
        const surface = await db.crossdeckSurfaceSession.findFirstOrThrow({
          where: { label, revokedAt: null, accountSession: { accountId: fixture.crewAccountId } },
        });
        expect(surface.role).toBe("SHARED_CREW_DISPLAY");
        expect(surface.voyageId).toBe(fixture.voyageId);
        await expect(row.getByRole("link", { name: "Open on this device", exact: true })).toHaveAttribute(
          "href",
          `/devices/display?voyage=${fixture.voyageId}`,
        );
        await capture("connected-role", row, '[aria-label="Connected devices"]');
        await measure(
          "Open actual connected empty Crew display",
          () => row.getByRole("link", { name: "Open on this device", exact: true }).click(),
          async () => {
            await expect(heading("Crew display")).toBeVisible();
            await expect(
              page.getByRole("region", { name: "Send to your devices", exact: true }),
            ).toBeVisible();
          },
        );
        await expect(display.getByRole("alert")).toHaveCount(0);
        await expect(page.getByRole("article", { name: "Shared crew view", exact: true })).toHaveCount(0);
        await expect(page.getByRole("main")).toContainText(
          "Only views deliberately shared with the crew appear here. Personal notes stay private.",
        );
        await capture("connected-empty-display", heading("Crew display"));
        await measure(
          "Manage the same Crew display",
          () => page.getByRole("link", { name: "Manage this display", exact: true }).click(),
          async () => {
            await expect(row).toBeVisible();
            await row.locator("summary").click();
            await expect(row.getByRole("combobox", { name: "Device purpose", exact: true })).toHaveValue(
              "SHARED_CREW_DISPLAY",
            );
          },
        );
        await measure(
          "Remove the owned Crew display",
          () => row.getByRole("button", { name: `Disconnect ${label}`, exact: true }).click(),
          () => expect(row).toHaveCount(0),
        );
        expect(
          (await db.crossdeckSurfaceSession.findUniqueOrThrow({ where: { id: surface.id } })).revokedAt,
        ).not.toBeNull();
        await expect(devices.getByRole("status")).toHaveText("Device disconnected. Its access has ended.");
        await capture("removed-display", devices.getByRole("status"), '[aria-label="Connected devices"]');
        await accountDestination(crewName, "Personal Harbor");
        await expect(heading("Overview")).toBeVisible();
        await expect(menu(crewName)).toBeVisible();
        await capture("crew-return", heading("Overview"));
        await menu(crewName).click();
        await page
          .getByRole("dialog", { name: "Account navigation", exact: true })
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(page).toHaveURL(/\/$/u);

        let pilotProvisionPosts = 0;
        page.on("request", (request) => {
          if (new URL(request.url()).pathname === "/api/dev/spatial-pilot" && request.method() === "POST")
            pilotProvisionPosts++;
        });
        await signIn(
          fixture.pilot.email,
          fixture.pilot.password,
          fixture.pilot.id,
          "/dev/spatial-pilot",
          () => expect(heading("The Lost Navigator’s Chart")).toBeVisible(),
        );
        await expect(menu("Prepare the adventure")).toBeEnabled();
        await expect(menu("Start a fresh Voyage")).toHaveCount(0);
        const preparation = page.getByRole("region", { name: "Session preparation", exact: true });
        await expect(preparation).toContainText(
          "OWNER_ACCEPTANCE_PENDING · OWNER_PHYSICAL_ACCEPTANCE_PENDING",
        );
        await capture("pilot-unprepared", heading("The Lost Navigator’s Chart"));
        await capture(
          "pilot-pending-hardware",
          preparation.getByText("OWNER_ACCEPTANCE_PENDING · OWNER_PHYSICAL_ACCEPTANCE_PENDING", {
            exact: true,
          }),
        );
        const firstTrial = page.getByRole("main").locator("ol > li").first();
        await firstTrial.locator("summary").click();
        const syntheticNote = "Synthetic software note only; no hardware trial or owner judgment.";
        await firstTrial.getByLabel("What happened?", { exact: true }).fill(syntheticNote);
        await measure(
          "Restore explicitly synthetic local feedback",
          () => page.reload(),
          async () => {
            await expect(firstTrial.getByLabel("Trial status", { exact: true })).toHaveValue("Not started");
            await firstTrial.locator("summary").click();
            await expect(firstTrial.getByLabel("What happened?", { exact: true })).toHaveValue(syntheticNote);
          },
        );
        const downloadPending = page.waitForEvent("download");
        await menu("Export one feedback report").click();
        const download = await downloadPending;
        const reportBytes = await readFile((await download.path())!);
        const report = JSON.parse(reportBytes.toString("utf8"));
        expect(report.kind).toBe("SPATIAL_PILOT_OWNER_FEEDBACK");
        expect(report.pilot).toBeNull();
        expect(report.cameraImageryIncluded).toBe(false);
        expect(report.activities[0]).toMatchObject({ state: "Not started", happened: syntheticNote });
        await capture("pilot-synthetic-feedback", firstTrial.getByLabel("What happened?", { exact: true }));
        await measure(
          "Return from unprepared pilot to Player Library",
          () =>
            page
              .getByRole("main")
              .locator("footer")
              .getByRole("link", { name: "Player Library", exact: true })
              .click(),
          () => expect(heading("My Chronicle Library")).toBeVisible(),
        );
        await accountDestination(fixture.pilot.name, "Personal Harbor");
        await expect(heading("Overview")).toBeVisible();
        await expect(menu(fixture.pilot.name)).toBeVisible();
        await capture("pilot-account-return", heading("Overview"));
        expect(pilotProvisionPosts).toBe(0);
        expect(await db.chronicle.count({ where: { creatorAccountId: fixture.pilot.id } })).toBe(0);
        expect(await db.taleSession.count({ where: { captainAccountId: fixture.pilot.id } })).toBe(0);
        expect(await readProgress()).toEqual(progress);
        expect(await readEditions()).toEqual(editions);
        expect(await readEvents()).toEqual(events);
        expect(await readMemberships()).toEqual(memberships);
        pairing.assertNone();
        pairing.dispose();
        await writeFile(
          info.outputPath("entry-receipt.json"),
          JSON.stringify(
            {
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-entry-journeys.spec.ts",
                "tests/e2e/fixtures/sextant-consumer-diagnostics.ts",
                "tests/e2e/fixtures/sextant-device-journey.ts",
                ".agents/scripts/sextant-entry-fixture.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                ".agents/scripts/sextant-account-recovery-fixture.ts",
                "tests/e2e/fixtures/landfall-closure.ts",
                "tests/e2e/fixtures/sounding-line-isolation.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              feedback,
              qualification: false,
              pairingChallengesOrClaims: 0,
              display: {
                ordinaryClaimedCrew: true,
                registeredViaActualUi: true,
                role: "SHARED_CREW_DISPLAY",
                connectedEmpty: true,
                sharedContentReceived: false,
                removedViaActualUi: true,
                sameCrewReturn: true,
              },
              pilot: {
                ordinaryReservedSyntheticOwner: true,
                unprepared: true,
                provisionPosts: pilotProvisionPosts,
                syntheticLocalFeedbackOnly: true,
                reportSha256: createHash("sha256").update(reportBytes).digest("hex"),
                noHardwareOrOwnerJudgment: true,
                sameOwnerReturn: true,
              },
              unchanged: {
                activeVoyages: 2,
                progress: true,
                events: true,
                memberships: true,
                exactEditionBytes: true,
              },
            },
            null,
            2,
          ) + "\n",
        );
      });
    });
  }
}
