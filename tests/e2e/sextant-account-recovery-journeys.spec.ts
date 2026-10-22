// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.account-recovery
import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { compare } from "bcryptjs";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import {
  seedSextantAccountRecoveryExperience,
  type SextantAccountRecoveryCase,
} from "../../.agents/scripts/sextant-account-recovery-fixture";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ video: "on", trace: "retain-on-failure", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
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
      test("ordinary registration, synthetic email verification, password/email recovery and reversible lifecycle", async ({
        page,
      }, info) => {
        const fixture = await seedSextantAccountRecoveryExperience(
          `account-recovery-${viewport.width}-${reducedMotion}` as SextantAccountRecoveryCase,
        );
        const { email, nextEmail, displayName } = fixture.registration;
        const initialPassword = "Copper-Orbit-Quasar-2026!";
        const nextPassword = "Velvet-Quartz-Turbine-2026!";
        const ids = [fixture.voyageId, fixture.playerVoyageId];
        const readBaselines = () =>
          db.taleSession.findMany({
            where: { id: { in: ids } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              status: true,
              currentSequence: true,
              currentBlockId: true,
              publishedVersionId: true,
            },
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
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const heading = (name: string) => page.getByRole("heading", { name, exact: true });
        const owner = page.getByRole("button", { name: displayName, exact: true });
        const currentMain = page.getByRole("main");
        const accountStatus = currentMain.locator("#account-status");
        const measure = async (
          task: string,
          activate: () => Promise<unknown>,
          ready: () => Promise<unknown>,
        ) => {
          const began = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - began;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const capture = async (name: string, target: Locator, selector = ".account-flow-page") => {
          expect((await new AxeBuilder({ page }).include(selector).analyze()).violations).toEqual([]);
          await target.scrollIntoViewIfNeeded();
          await expect(target).toBeInViewport();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        type Delivery = { purpose: string; email: string; token?: string; accountId: string };
        const delivery = async (purpose: string, address: string, accountId: string) => {
          let found: Delivery | undefined;
          await expect
            .poll(
              () => {
                const rows: Delivery[] = existsSync(fixture.outboxPath)
                  ? readFileSync(fixture.outboxPath, "utf8")
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => JSON.parse(line))
                  : [];
                found = rows
                  .reverse()
                  .find(
                    (row) => row.purpose === purpose && row.email === address && row.accountId === accountId,
                  );
                // Report only presence; challenge values never enter this assertion or the journey receipt.
                return Boolean(found?.token);
              },
              { message: `Owned synthetic ${purpose} delivery is available` },
            )
            .toBe(true);
          return found!;
        };
        const signOut = async () => {
          await owner.click();
          await page
            .getByRole("dialog", { name: "Account navigation", exact: true })
            .getByRole("button", { name: "Sign out", exact: true })
            .click();
          await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
        };
        const returnToAccount = async () => {
          await owner.click();
          await page
            .getByRole("dialog", { name: "Account navigation", exact: true })
            .getByRole("link", { name: "Personal Harbor", exact: true })
            .click();
          await expect(heading("Overview")).toBeVisible();
          await expect(owner).toBeVisible();
        };
        const navigateSection = async (name: "Personal Information" | "Data & Account") => {
          const mobile = currentMain.locator("details.personal-harbor__mobile-sections");
          const container = (await mobile.isVisible())
            ? mobile
            : currentMain.locator(".personal-harbor__rail");
          if ((await mobile.isVisible()) && (await mobile.getAttribute("open")) === null)
            await mobile.locator("summary").click();
          await measure(
            `Ordinary ${name} section entry`,
            () =>
              container
                .getByRole("navigation", { name: "Personal Harbor sections", exact: true })
                .getByRole("link", { name, exact: true })
                .click(),
            () => expect(heading(name)).toBeVisible(),
          );
        };

        await page.goto("/sign-in?returnTo=%2Faccount");
        await measure(
          "Ordinary Create Account entry",
          () => page.getByRole("link", { name: "Create Account", exact: true }).click(),
          () => expect(heading("Create your account")).toBeVisible(),
        );
        await capture("account-register-prepared", heading("Create your account"));
        await page.getByLabel("Display name", { exact: true }).fill(displayName);
        await page.getByLabel("Email", { exact: true }).fill(email);
        await page.getByLabel("Password", { exact: true }).fill(initialPassword);
        await page.getByLabel("Confirm password", { exact: true }).fill(initialPassword);
        const registered = page.waitForResponse(
          (r) => r.url().endsWith("/api/auth/register") && r.request().method() === "POST",
        );
        await measure(
          "Actual reserved account registration",
          () => page.getByRole("button", { name: "Create account", exact: true }).click(),
          () => expect(heading("Verify email")).toBeVisible(),
        );
        expect((await registered).status()).toBe(201);
        const accountId = (await db.accountEmail.findUniqueOrThrow({ where: { normalizedEmail: email } }))
          .accountId;
        const verification = await delivery("VERIFY_EMAIL", email, accountId);
        expect(
          await db.userAccount.findUnique({
            where: { id: verification.accountId },
            select: { status: true },
          }),
        ).toEqual({ status: "PENDING_VERIFICATION" });
        await capture("account-verification-prepared", heading("Verify email"));
        await page
          .getByLabel("Code", { exact: true })
          .fill(verification.token === "000000" ? "111111" : "000000");
        await page.getByRole("button", { name: "Verify email", exact: true }).click();
        await expect(accountStatus).toContainText(/invalid|incorrect|expired/iu);
        expect(
          await db.userAccount.findUnique({
            where: { id: verification.accountId },
            select: { status: true },
          }),
        ).toEqual({ status: "PENDING_VERIFICATION" });
        await capture("account-verification-rejected", heading("Verify email"));
        await page.getByLabel("Code", { exact: true }).fill(verification.token!);
        await measure(
          "Actual synthetic email verification",
          () => page.getByRole("button", { name: "Verify email", exact: true }).click(),
          () => expect(owner).toBeVisible(),
        );
        await expect(heading("Overview")).toBeVisible();
        const readAccount = () =>
          db.userAccount.findUniqueOrThrow({
            where: { id: accountId },
            include: { profile: true, emails: true },
          });
        expect((await readAccount()).status).toBe("ACTIVE");
        expect((await readAccount()).emails).toEqual([
          expect.objectContaining({ normalizedEmail: email, isPrimary: true, verificationState: "VERIFIED" }),
        ]);
        await capture("account-first-overview", heading("Overview"), ".personal-harbor");

        await signOut();
        await page.goto("/sign-in?returnTo=%2Faccount");
        await page.getByRole("link", { name: "Forgot Password", exact: true }).click();
        await expect(heading("Forgot password")).toBeVisible();
        await page.getByLabel("Email", { exact: true }).fill(email);
        await measure(
          "Actual synthetic password reset request",
          () => page.getByRole("button", { name: "Send reset instructions", exact: true }).click(),
          () =>
            expect(accountStatus).toHaveText("If that email can reset an account, we sent a recovery link."),
        );
        const reset = await delivery("PASSWORD_RESET", email, accountId);
        expect(reset.accountId).toBe(accountId);
        await capture("account-password-requested", heading("Forgot password"));
        // The canonical email action is a token-bearing reset route; follow that synthetic delivery in this browser.
        await page.goto(`/reset-password?token=${encodeURIComponent(reset.token!)}`);
        await expect(heading("Reset password")).toBeVisible();
        await capture("account-reset-prepared", heading("Reset password"));
        await page.getByLabel("Password", { exact: true }).fill(nextPassword);
        await page.getByLabel("Confirm password", { exact: true }).fill(nextPassword);
        await measure(
          "Actual password replacement",
          () => page.getByRole("button", { name: "Reset password", exact: true }).click(),
          () => expect(owner).toBeVisible(),
        );
        const credential = await db.accountCredential.findUniqueOrThrow({ where: { accountId } });
        expect(await compare(nextPassword, credential.passwordHash)).toBe(true);
        expect(await compare(initialPassword, credential.passwordHash)).toBe(false);
        expect(
          await db.accountToken.count({ where: { accountId, purpose: "PASSWORD_RESET", consumedAt: null } }),
        ).toBe(0);
        await returnToAccount();

        await navigateSection("Personal Information");
        await expect(heading("Personal Information")).toBeVisible();
        await page.getByLabel("New email address", { exact: true }).fill(nextEmail);
        await page.getByLabel("Current password", { exact: true }).fill(nextPassword);
        await measure(
          "Actual synthetic primary email request",
          () => page.getByRole("button", { name: "Send verification link", exact: true }).click(),
          () =>
            expect(
              page.getByText("Check the new address to verify this email change.", { exact: true }),
            ).toBeVisible(),
        );
        const change = await delivery("EMAIL_CHANGE", nextEmail, accountId);
        expect(change.accountId).toBe(accountId);
        await page.goto(`/account/email-change?token=${encodeURIComponent(change.token!)}`);
        await expect(heading("Confirm email change")).toBeVisible();
        await capture("account-email-change-prepared", heading("Confirm email change"));
        await measure(
          "Actual primary email confirmation",
          () => page.getByRole("button", { name: "Confirm email change", exact: true }).click(),
          () =>
            expect(page.getByRole("link", { name: "Sign in with the new email", exact: true })).toBeVisible(),
        );
        await expect(accountStatus).toHaveText(
          "Your primary email was changed and existing sessions were ended. Sign in with the new address.",
        );
        await expect(page.getByRole("button", { name: "Confirm email change", exact: true })).toBeDisabled();
        expect((await readAccount()).emails).toEqual([
          expect.objectContaining({
            normalizedEmail: nextEmail,
            isPrimary: true,
            verificationState: "VERIFIED",
          }),
        ]);
        expect(await db.accountSession.count({ where: { accountId, revokedAt: null } })).toBe(0);
        await capture("account-email-change-confirmed", heading("Confirm email change"));
        await page.getByRole("link", { name: "Sign in with the new email", exact: true }).click();
        await page.getByLabel("Email or Player name", { exact: true }).fill(nextEmail);
        await page.getByLabel("Password", { exact: true }).fill(nextPassword);
        await measure(
          "Same canonical account with replacement credentials",
          () => page.getByRole("button", { name: "Sign in", exact: true }).click(),
          () => expect(owner).toBeVisible(),
        );
        await returnToAccount();

        await navigateSection("Data & Account");
        await expect(heading("Data & Account")).toBeVisible();
        const deactivate = currentMain
          .locator("section.harbor-danger-zone")
          .filter({ has: page.getByRole("heading", { name: "Deactivate account", exact: true, level: 2 }) });
        await deactivate.getByLabel("Current password", { exact: true }).fill(nextPassword);
        await deactivate.getByLabel("Type DEACTIVATE", { exact: true }).fill("DEACTIVATE");
        await capture(
          "account-deactivation-prepared",
          deactivate.getByRole("button", { name: "Deactivate account", exact: true }),
          ".personal-harbor",
        );
        await measure(
          "Actual reversible deactivation",
          () => deactivate.getByRole("button", { name: "Deactivate account", exact: true }).click(),
          () => expect(heading("Reactivate your account")).toBeVisible(),
        );
        expect((await readAccount()).status).toBe("DEACTIVATED");
        expect(await db.accountSession.count({ where: { accountId, revokedAt: null } })).toBe(0);
        await capture("account-reactivation-prepared", heading("Reactivate your account"));
        await page.getByLabel("Primary email", { exact: true }).fill(nextEmail);
        await page.getByLabel("Password", { exact: true }).fill(nextPassword);
        await measure(
          "Actual account reactivation",
          () => page.getByRole("button", { name: "Reactivate account", exact: true }).click(),
          () => expect(heading("Overview")).toBeVisible(),
        );
        await expect(owner).toBeVisible();
        expect((await readAccount()).status).toBe("ACTIVE");

        await navigateSection("Data & Account");
        const deletion = currentMain
          .locator("section.harbor-danger-zone")
          .filter({ has: page.getByRole("heading", { name: "Delete account", exact: true, level: 2 }) });
        await deletion.getByLabel("Current password", { exact: true }).fill(nextPassword);
        await deletion.getByLabel("Type DELETE ACCOUNT", { exact: true }).fill("DELETE ACCOUNT");
        await capture(
          "account-deletion-prepared",
          deletion.getByRole("button", { name: "Schedule account deletion", exact: true }),
          ".personal-harbor",
        );
        await measure(
          "Actual delayed deletion request",
          () => deletion.getByRole("button", { name: "Schedule account deletion", exact: true }).click(),
          () => expect(heading("Cancel account deletion")).toBeVisible(),
        );
        expect((await readAccount()).status).toBe("DELETION_SCHEDULED");
        expect(await db.accountSession.count({ where: { accountId, revokedAt: null } })).toBe(0);
        await capture("account-cancel-deletion-prepared", heading("Cancel account deletion"));
        await page.getByLabel("Primary email", { exact: true }).fill(nextEmail);
        await page.getByLabel("Password", { exact: true }).fill(nextPassword);
        await page.getByLabel("Type CANCEL DELETION", { exact: true }).fill("CANCEL DELETION");
        await measure(
          "Actual scheduled deletion cancellation",
          () => page.getByRole("button", { name: "Cancel deletion", exact: true }).click(),
          () => expect(heading("Overview")).toBeVisible(),
        );
        await expect(owner).toBeVisible();
        const finalAccount = await readAccount();
        expect(finalAccount.status).toBe("ACTIVE");
        expect(finalAccount.profile?.displayName).toBe(displayName);
        expect(finalAccount.profile?.status).toBe("ACTIVE");
        expect(
          await db.accountLifecycleRequest.findMany({
            where: { accountId },
            orderBy: { requestedAt: "asc" },
            select: { kind: true, state: true },
          }),
        ).toEqual([
          { kind: "DEACTIVATION", state: "REACTIVATED" },
          { kind: "DELETION", state: "CANCELED" },
        ]);
        expect(await db.chronicle.count({ where: { creatorAccountId: accountId } })).toBe(0);
        expect(
          await db.playthroughMembership.count({ where: { playerProfileId: finalAccount.profile!.id } }),
        ).toBe(0);
        expect(await readBaselines()).toEqual(baseline);
        expect(await readEditions()).toEqual(editions);
        await capture("account-final-same-owner-return", heading("Overview"), ".personal-harbor");
        await writeFile(
          info.outputPath("account-recovery-journey-receipt.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              classification: "ENGINEERING_SYNTHETIC_ACCOUNT_RECOVERY_DEVELOPMENT_NOT_ACCEPTANCE",
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-account-recovery-journeys.spec.ts",
                ".agents/scripts/sextant-account-recovery-fixture.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                ".agents/scripts/sextant-chronicle-choice.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              accountId,
              baseline,
              feedback,
              actualProductionRegistrationVerificationPasswordResetAndEmailChange: true,
              actualDeactivationReactivationAndScheduledDeletionCancellation: true,
              finalSameAccountActiveWithNoChronicleOrMembership: true,
              unchangedActiveProgressAndEditionBytes: true,
              syntheticEmailOnly: true,
              challengeValuesPublishedInReceipt: false,
              guestClaimOrMergeCovered: false,
              formalPositiveMutationCovered: false,
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
