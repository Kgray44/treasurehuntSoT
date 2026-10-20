// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.invitation-guest-recovery
import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import {
  createSextantInvitationExperience,
  type SextantInvitationCase,
} from "../../.agents/scripts/sextant-invitation-fixture";
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
      test("actual code/link invitations, PIN rejection, guest claim and existing-account merge preserve Voyage progress", async ({
        page,
        baseURL,
      }, info) => {
        if (!baseURL) throw new Error("SEXTANT_INVITATION_BASE_URL_REQUIRED");
        const fixture = await createSextantInvitationExperience(
          `invitation-${viewport.width}-${reducedMotion}` as Exclude<SextantInvitationCase, "invitation-default">,
          baseURL,
        );
        const ids = [fixture.voyageId, fixture.playerVoyageId];
        const readBaselines = () =>
          db.taleSession.findMany({
            where: { id: { in: ids } },
            orderBy: { id: "asc" },
            select: { id: true, status: true, currentSequence: true, currentBlockId: true, publishedVersionId: true },
          });
        const baseline = await readBaselines();
        expect(baseline).toHaveLength(2);
        const versionIds = baseline.map((row) => row.publishedVersionId!);
        const readEditions = () =>
          db.publishedTaleVersion.findMany({
            where: { id: { in: versionIds } },
            orderBy: { id: "asc" },
            select: { id: true, checksum: true, contentSnapshot: true },
          });
        const editions = await readEditions();
        const readOriginalMemberships = () =>
          db.playthroughMembership.findMany({
            where: { playthroughId: { in: ids } },
            orderBy: { id: "asc" },
            select: { id: true, playthroughId: true, playerProfileId: true, status: true },
          });
        const originalMemberships = await readOriginalMemberships();
        const invitedId = fixture.invited.playthroughId;
        const readInvitedProgress = () =>
          db.taleSession.findUniqueOrThrow({
            where: { id: invitedId },
            select: { id: true, currentSequence: true, currentBlockId: true, publishedVersionId: true },
          });
        const invitedProgress = await readInvitedProgress();
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const began = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - began;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const main = page.getByRole("main");
        const heading = (name: string) => page.getByRole("heading", { name, exact: true, level: 1 });
        const owner = (name: string) => page.getByRole("button", { name, exact: true });
        const capture = async (name: string, target: Locator, scope: string) => {
          expect((await new AxeBuilder({ page }).include(scope).analyze()).violations).toEqual([]);
          await target.scrollIntoViewIfNeeded();
          await expect(target).toBeInViewport({ ratio: 1 });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        const accountDestination = async (name: string, destination: "Personal Harbor" | "Player") => {
          await owner(name).click();
          await page
            .getByRole("dialog", { name: "Account navigation", exact: true })
            .getByRole("link", { name: destination, exact: true })
            .click();
          await expect(heading(destination === "Player" ? "My Chronicle Library" : "Overview")).toBeVisible();
        };
        const openRecovery = async (name: string) => {
          await accountDestination(name, "Personal Harbor");
          // The Overview offers this ordinary destination on both presentations.
          await main
            .locator(".harbor-identity-hero__actions")
            .getByRole("link", { name: "Personal Information", exact: true })
            .click();
          await expect(heading("Personal Information")).toBeVisible();
          await expect(page.getByRole("heading", { name: "Keep your guest Voyage", exact: true })).toBeVisible();
          await capture(
            `invitation-guest-recovery-${name === fixture.claimName ? "claim" : "merge"}`,
            page.getByRole("link", { name: "Claim this guest Voyage", exact: true }),
            ".personal-harbor",
          );
        };
        const openFromLibrary = async (name: string) => {
          await accountDestination(name, "Player");
          const link = main.locator(`a[href="/player/playthroughs/${invitedId}"]`);
          await expect(link).toHaveCount(1);
          await measure(
            "Actual prepared Voyage Library reopen",
            () => link.click(),
            async () => {
              await expect(page).toHaveURL(new RegExp(`/player/playthroughs/${invitedId}$`));
              await expect(main).toHaveClass(/muster-scene/u);
              await expect(heading(fixture.title)).toBeVisible();
            },
          );
          await expect(owner(name)).toBeVisible();
        };
        const invitationRows = await db.invitation.findMany({
          where: { id: { in: fixture.invited.invitations.map((i) => i.id) } },
          orderBy: { id: "asc" },
          select: { id: true, intendedPlayerId: true, status: true, redemptionCount: true },
        });
        expect(invitationRows).toHaveLength(2);
        const claimInvitation = fixture.invited.invitations[0],
          mergeInvitation = fixture.invited.invitations[1];
        const claimProfileId = invitationRows.find((row) => row.id === claimInvitation.id)!.intendedPlayerId!;
        const mergeProfileId = invitationRows.find((row) => row.id === mergeInvitation.id)!.intendedPlayerId!;
        expect((await db.playerProfile.findUniqueOrThrow({ where: { id: claimProfileId } })).accountId).toBeNull();
        expect((await db.playerProfile.findUniqueOrThrow({ where: { id: mergeProfileId } })).accountId).toBeNull();

        await page.goto("/player/sign-in");
        await expect(heading("Open your Chronicle Library")).toBeVisible();
        await page.getByRole("tab", { name: "Invitation code", exact: true }).click();
        await expect(page.getByLabel("Short code", { exact: true })).toBeVisible();
        await capture("invitation-code-entry", heading("Open your Chronicle Library"), ".player-auth-page");
        await page.getByLabel("Short code", { exact: true }).fill(claimInvitation.shortCode);
        await measure(
          "Actual issued short-code lookup",
          () => page.getByRole("button", { name: "Find my invitation", exact: true }).click(),
          async () => {
            await expect(page).toHaveURL(/\/player\/invitation$/u);
            await expect(heading(fixture.title)).toBeVisible();
          },
        );
        await expect(page.getByLabel("Your display name", { exact: true })).toHaveValue(fixture.claimName);
        await capture("invitation-claim-prepared", heading(fixture.title), ".invitation-page");
        await page.getByLabel("Invitation PIN", { exact: true }).fill("1111");
        // Opening the actual ceremony legitimately marks its invitation VIEWED.
        // Compare rejection against this immediate boundary, retaining the untouched initial rows above.
        const beforeWrongInvitations = await db.invitation.findMany({
          where: { id: { in: invitationRows.map((i) => i.id) } },
          orderBy: { id: "asc" },
          select: { id: true, intendedPlayerId: true, status: true, redemptionCount: true },
        });
        expect(beforeWrongInvitations.find((row) => row.id === claimInvitation.id)).toMatchObject({
          status: "VIEWED",
          redemptionCount: 0,
        });
        const readInvitedMemberships = () =>
          db.playthroughMembership.findMany({
            where: { playthroughId: invitedId },
            orderBy: { id: "asc" },
            select: {
              id: true,
              playthroughId: true,
              playerProfileId: true,
              status: true,
              joinedAt: true,
              removedAt: true,
            },
          });
        const beforeWrongMemberships = await readInvitedMemberships();
        expect(beforeWrongMemberships).toHaveLength(2);
        expect(
          beforeWrongMemberships.every(
            (row) => row.status === "INVITED" && row.joinedAt === null && row.removedAt === null,
          ),
        ).toBe(true);
        const rejected = page.waitForResponse(
          (r) => new URL(r.url()).pathname === "/api/invitations/accept" && r.request().method() === "POST",
        );
        await measure(
          "Actual wrong invitation PIN rejection",
          () => page.getByRole("button", { name: "Accept and Join Voyage", exact: true }).click(),
          () =>
            expect(page.locator("main.invitation-page").getByRole("alert")).toHaveText(
              "The invitation PIN was not accepted.",
            ),
        );
        expect((await rejected).status()).toBe(400);
        expect(
          await db.invitation.findMany({
            where: { id: { in: invitationRows.map((i) => i.id) } },
            orderBy: { id: "asc" },
            select: { id: true, intendedPlayerId: true, status: true, redemptionCount: true },
          }),
        ).toEqual(beforeWrongInvitations);
        expect(await readInvitedMemberships()).toEqual(beforeWrongMemberships);
        expect((await db.playerProfile.findUniqueOrThrow({ where: { id: claimProfileId } })).accountId).toBeNull();
        await capture(
          "invitation-pin-rejected",
          page.locator("main.invitation-page").getByRole("alert"),
          ".invitation-page",
        );
        const accept = async (name: string) => {
          await page.getByLabel("Invitation PIN", { exact: true }).fill("4826");
          const response = page.waitForResponse(
            (r) => new URL(r.url()).pathname === "/api/invitations/accept" && r.request().method() === "POST",
          );
          await measure(
            "Actual invitation acceptance to waiting room",
            () => page.getByRole("button", { name: "Accept and Join Voyage", exact: true }).click(),
            async () => {
              await expect(page).toHaveURL(new RegExp(`/player/playthroughs/${invitedId}$`));
              await expect(main).toHaveClass(/muster-scene/u);
              await expect(heading(fixture.title)).toBeVisible();
            },
          );
          expect((await response).status()).toBe(200);
          await expect(owner(name)).toBeVisible();
        };
        await accept(fixture.claimName);
        const claimGuestId = (await db.playerProfile.findUniqueOrThrow({ where: { id: claimProfileId } })).accountId!;
        expect((await db.userAccount.findUniqueOrThrow({ where: { id: claimGuestId } })).status).toBe(
          "GUEST_UNCLAIMED",
        );
        expect(
          await db.playthroughMembership.findUniqueOrThrow({
            where: { playthroughId_playerProfileId: { playthroughId: invitedId, playerProfileId: claimProfileId } },
          }),
        ).toMatchObject({ status: "READY" });
        await capture("invitation-claim-waiting-room", heading(fixture.title), ".muster-scene");
        await openRecovery(fixture.claimName);
        await page.getByRole("link", { name: "Claim this guest Voyage", exact: true }).click();
        await expect(heading("Claim your guest voyage")).toBeVisible();
        await capture("invitation-claim-form", heading("Claim your guest voyage"), ".account-flow-page");
        await page.getByLabel("Email", { exact: true }).fill(fixture.claimEmail);
        await page.getByLabel("Password", { exact: true }).fill("Copper-Orbit-Quasar-2026!");
        await measure(
          "Actual guest account claim",
          () => page.getByRole("button", { name: "Claim voyage", exact: true }).click(),
          () => expect(heading("Verify email")).toBeVisible(),
        );
        expect((await db.userAccount.findUniqueOrThrow({ where: { id: claimGuestId } })).status).toBe(
          "PENDING_VERIFICATION",
        );
        type Delivery = { purpose: string; email: string; accountId: string; token?: string };
        let challenge: Delivery | undefined;
        await expect
          .poll(
            () => {
              const rows: Delivery[] = existsSync(fixture.outboxPath)
                ? readFileSync(fixture.outboxPath, "utf8")
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => JSON.parse(line))
                : [];
              challenge = rows
                .reverse()
                .find(
                  (row) =>
                    row.purpose === "VERIFY_EMAIL" &&
                    row.accountId === claimGuestId &&
                    row.email === fixture.claimEmail,
                );
              return Boolean(challenge?.token);
            },
            { message: "Current guest's owned synthetic verification delivery is available" },
          )
          .toBe(true);
        await page.getByLabel("Code", { exact: true }).fill(challenge!.token!);
        await measure(
          "Actual claimed guest email verification",
          () => page.getByRole("button", { name: "Verify email", exact: true }).click(),
          () => expect(owner(fixture.claimName)).toBeVisible(),
        );
        expect((await db.userAccount.findUniqueOrThrow({ where: { id: claimGuestId } })).status).toBe("ACTIVE");
        expect((await db.playerProfile.findUniqueOrThrow({ where: { id: claimProfileId } })).accountId).toBe(
          claimGuestId,
        );
        await openFromLibrary(fixture.claimName);
        await capture("invitation-claimed-same-voyage", heading(fixture.title), ".muster-scene");
        await owner(fixture.claimName).click();
        await page
          .getByRole("dialog", { name: "Account navigation", exact: true })
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(owner("Account")).toBeVisible();
        await expect(page).toHaveURL(new URL("/", baseURL).toString());

        // Follow the second actually issued secure link; no cookie or session is fabricated.
        await page.goto(new URL(mergeInvitation.link).pathname);
        await expect(page).toHaveURL(/\/player\/invitation$/u);
        await expect(heading(fixture.title)).toBeVisible();
        await expect(page.getByLabel("Your display name", { exact: true })).toHaveValue(fixture.mergeName);
        await capture("invitation-secure-link-prepared", heading(fixture.title), ".invitation-page");
        await accept(fixture.mergeName);
        const mergeGuestId = (await db.playerProfile.findUniqueOrThrow({ where: { id: mergeProfileId } })).accountId!;
        expect((await db.userAccount.findUniqueOrThrow({ where: { id: mergeGuestId } })).status).toBe(
          "GUEST_UNCLAIMED",
        );
        await openRecovery(fixture.mergeName);
        await page.getByRole("link", { name: "Use an existing account", exact: true }).click();
        await expect(heading("Use an existing account")).toBeVisible();
        await capture("invitation-merge-form", heading("Use an existing account"), ".account-flow-page");
        await page.getByLabel("Email or Player name", { exact: true }).fill(fixture.crewEmail!);
        await page.getByLabel("Password", { exact: true }).fill("Synthetic-Sextant-Crew-2026!");
        await measure(
          "Actual explicit guest merge into claimed Crew account",
          () => page.getByRole("button", { name: "Use this account", exact: true }).click(),
          () => expect(owner(fixture.crewDisplayName)).toBeVisible(),
        );
        const merged = await db.userAccount.findUniqueOrThrow({ where: { id: mergeGuestId } });
        expect(merged).toMatchObject({ status: "MERGED", mergedIntoAccountId: fixture.crewAccountId });
        expect(await db.accountSession.count({ where: { accountId: mergeGuestId, revokedAt: null } })).toBe(0);
        const target = await db.playerProfile.findUniqueOrThrow({ where: { accountId: fixture.crewAccountId } });
        expect((await db.invitation.findUniqueOrThrow({ where: { id: mergeInvitation.id } })).intendedPlayerId).toBe(
          target.id,
        );
        expect(
          await db.playthroughMembership.count({
            where: { playthroughId: invitedId, playerProfileId: mergeProfileId },
          }),
        ).toBe(0);
        expect(
          await db.playthroughMembership.findUniqueOrThrow({
            where: { playthroughId_playerProfileId: { playthroughId: invitedId, playerProfileId: target.id } },
          }),
        ).toMatchObject({ status: "READY" });
        await openFromLibrary(fixture.crewDisplayName);
        await capture("invitation-merged-same-voyage", heading(fixture.title), ".muster-scene");
        await accountDestination(fixture.crewDisplayName, "Personal Harbor");
        await capture("invitation-final-claimed-account-return", heading("Overview"), ".personal-harbor");
        expect(await readInvitedProgress()).toEqual(invitedProgress);
        expect((await db.taleSession.findUniqueOrThrow({ where: { id: invitedId } })).status).toBe("READY");
        expect(await readBaselines()).toEqual(baseline);
        expect(await readEditions()).toEqual(editions);
        expect(await readOriginalMemberships()).toEqual(originalMemberships);
        expect(
          await db.invitation.findMany({
            where: { id: { in: invitationRows.map((i) => i.id) } },
            select: { status: true, redemptionCount: true },
          }),
        ).toEqual([
          expect.objectContaining({ status: "READY", redemptionCount: 1 }),
          expect.objectContaining({ status: "READY", redemptionCount: 1 }),
        ]);
        await writeFile(
          info.outputPath("invitation-journey-receipt.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              classification: "ENGINEERING_SYNTHETIC_INVITATION_GUEST_RECOVERY_DEVELOPMENT_NOT_ACCEPTANCE",
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-invitation-journeys.spec.ts",
                ".agents/scripts/sextant-invitation-fixture.ts",
                ".agents/scripts/sextant-account-recovery-fixture.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              baseline,
              invitedProgress,
              feedback,
              claimGuestId,
              mergeGuestId,
              targetAccountId: fixture.crewAccountId,
              actualShortCodeAndSecureLink: true,
              wrongPinPreservesInvitationMembershipAndGuestAbsence: true,
              actualGuestClaimVerificationAndExplicitMerge: true,
              sameActualVoyageReopenedThroughLibrary: true,
              unchangedActiveProgressOriginalMembershipsAndExactEditionBytes: true,
              noVoyageLaunchOrProgression: true,
              syntheticEmailOnly: true,
              challengeOrInvitationCredentialsPublishedInReceipt: false,
              formalPositiveInvitationOrGuestMutationCovered: false,
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
