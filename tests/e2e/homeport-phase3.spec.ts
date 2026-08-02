import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "bcryptjs";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { createAccountSession, registerAccount } from "../../src/wayfarer/accounts";

const password = "Homeport-phase3-synthetic-passphrase-2026";
const fixtureVersion = "homeport-phase3-personal-harbor-v1";
const fixtureChecksum = createHash("sha256")
  .update(`${fixtureVersion}:reserved-synthetic-no-private-content`)
  .digest("hex");
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE3_EVIDENCE_ROOT ??
    path.join(process.cwd(), "artifacts", "validation", "homeport-phase3", "evidence"),
);
const manifestRows: Array<Record<string, unknown>> = [];

type AccountFixture = { accountId: string; profileId: string; email: string; displayName: string; handle?: string };
let full: AccountFixture;
let empty: AccountFixture;
let historyId: string;
let artifactId: string;

async function account(label: string, handle = false): Promise<AccountFixture> {
  const suffix = randomUUID().slice(0, 6);
  const slug = `homeport-p3-${label.toLowerCase()}-${suffix}`;
  const result = await registerAccount({
    email: `${slug}@example.invalid`,
    password,
    displayName: `Homeport ${label}`,
    deviceLabel: "Homeport Phase 3 synthetic browser",
  });
  await db.userAccount.update({ where: { id: result.account.id }, data: { status: "ACTIVE" } });
  if (handle)
    await db.playerProfile.update({
      where: { id: result.account.profile.id },
      data: {
        handle: slug,
        normalizedHandle: slug,
        biography: "Synthetic harbor cartographer. No real person or Voyage is represented.",
        defaultVisibility: "PUBLIC",
      },
    });
  return {
    accountId: result.account.id,
    profileId: result.account.profile.id,
    email: `${slug}@example.invalid`,
    displayName: `Homeport ${label}`,
    ...(handle ? { handle: slug } : {}),
  };
}

test.beforeAll(async () => {
  if (!process.env.HOMEPORT_PHASE3_DATABASE_PATH) throw new Error("HOMEPORT_PHASE3_REQUIRES_DEDICATED_RUNTIME");
  await mkdir(evidenceRoot, { recursive: true });
  full = await account("Cartographer", true);
  empty = await account("Newcomer", false);
  await db.accountRoleAssignment.createMany({
    data: [
      { accountId: full.accountId, role: "CAPTAIN" },
      { accountId: full.accountId, role: "CREATOR" },
    ],
  });
  const gameMaster = await db.gameMasterUser.create({
    data: {
      username: full.handle!,
      passwordHash: await hash(password, 4),
    },
  });
  await db.userAccount.update({
    where: { id: full.accountId },
    data: { legacyGameMasterId: gameMaster.id },
  });
  await db.profilePrivacyRule.createMany({
    data: ["HEADER", "BIOGRAPHY", "PROVIDERS", "CHRONICLE_SUMMARY", "CREWS", "COMMUNITY"].map((section) => ({
      playerProfileId: full.profileId,
      section,
      visibility: section === "HEADER" || section === "BIOGRAPHY" ? "PUBLIC" : "ONLY_ME",
    })),
  });
  await db.externalIdentity.create({
    data: {
      accountId: full.accountId,
      provider: "DISCORD",
      providerAccountId: `synthetic-${randomUUID()}`,
      providerDisplayName: "Synthetic Harbor Discord",
      allowedScopes: '["synthetic-never-returned"]',
      useForLogin: false,
      visibility: "ONLY_ME",
      status: "LINKED",
    },
  });
  await createAccountSession(full.accountId, "Synthetic chart-table browser");
  const version = await db.publishedTaleVersion.findFirst({ select: { id: true, checksum: true } });
  if (!version) throw new Error("Homeport Phase 3 fixture requires one copied published Chronicle version.");
  historyId = `homeport_p3_history_${randomUUID().replaceAll("-", "")}`;
  await db.playerChronicleRecord.create({
    data: {
      id: historyId,
      playerProfileId: full.profileId,
      sourcePlaythroughId: `homeport-p3-playthrough-${randomUUID()}`,
      publishedVersionId: version.id,
      publishedVersionChecksum: version.checksum,
      chronicleTitleSnapshot: "The Synthetic Lantern Atlas",
      playerNameSnapshot: full.displayName,
      participationRole: "PLAYER",
      crewRoleSnapshot: "Navigator",
      lifecycleStatus: "COMPLETED",
      outcome: "COMPLETED:synthetic-final",
      startedAt: new Date("2026-01-02T18:00:00.000Z"),
      joinedAt: new Date("2026-01-02T18:02:00.000Z"),
      completedAt: new Date("2026-01-02T19:24:00.000Z"),
      wallClockSeconds: 4920,
      wallClockAccuracy: "EXACT",
      completedChapters: JSON.stringify([
        {
          schemaVersion: 1,
          blockId: "synthetic-block",
          chapterId: "synthetic-chapter",
          title: "A Chart Without Coordinates",
          completedAt: "2026-01-02T19:20:00.000Z",
          sourceSequence: 4,
          accuracy: "EXACT",
        },
      ]),
      optionalObjectives: JSON.stringify([
        { schemaVersion: 1, reason: "UNAVAILABLE: synthetic fixture has no optional-objective authority." },
      ]),
      choiceSummary: JSON.stringify([
        { schemaVersion: 1, reason: "UNAVAILABLE: selected choice identity is not retained." },
      ]),
      artifactSummary: "[]",
      sourceFingerprint: fixtureChecksum,
    },
  });
  await db.chronicleMemory.create({
    data: {
      playerChronicleRecordId: historyId,
      playerProfileId: full.profileId,
      title: "A synthetic harbor light",
      body: "Reserved fixture prose with no real place, person, or event.",
      referenceType: "MOMENT",
      referenceId: "synthetic-moment",
      visibility: "ONLY_ME",
    },
  });
  artifactId = `homeport_p3_artifact_${randomUUID().replaceAll("-", "")}`;
  await db.playerArtifactRecord.create({
    data: {
      id: artifactId,
      playerProfileId: full.profileId,
      sourcePlaythroughId: `homeport-p3-artifact-playthrough-${randomUUID()}`,
      sourceGrantEventId: `homeport-p3-grant-${randomUUID()}`,
      sourceGrantSequence: 7,
      sourceBlockId: "synthetic-artifact-block",
      publishedVersionId: version.id,
      publishedVersionChecksum: version.checksum,
      chronicleTitleSnapshot: "The Synthetic Lantern Atlas",
      artifactDefinitionId: "synthetic-brass-compass",
      artifactNameSnapshot: "Compass of Invented Tides",
      artifactTypeSnapshot: "RELIC",
      representationSnapshot: "FALLBACK",
      recipientPolicy: "EXPLICIT_RECIPIENTS",
      recipientEvidence: JSON.stringify({ schemaVersion: 1, synthetic: true }),
      ownershipState: "OWNED",
      custody: "PERSONAL",
      recordStatus: "ACTIVE",
      grantedAt: new Date("2026-01-02T19:10:00.000Z"),
      sourceFingerprint: fixtureChecksum,
    },
  });
  const community = await db.communityProfile.create({
    data: {
      accountId: full.accountId,
      normalizedHandle: `community-${full.handle}`,
      handle: `community-${full.handle}`,
      displayName: "Synthetic Harbor Press",
      biography: "Reserved fixture Creator.",
      visibility: "COMMUNITY",
      creatorStatus: "ACTIVE",
      moderationStatus: "ACTIVE",
    },
  });
  const listing = await db.communityListing.create({
    data: {
      slug: `synthetic-harbor-chart-${randomUUID().slice(0, 8)}`,
      itemType: "GUIDE",
      ownerProfileId: community.id,
      title: "Synthetic Harbor Chart",
      shortDescription: "A reserved public fixture used to verify saved-content projection.",
      visibility: "COMMUNITY",
      publicationStatus: "PUBLISHED",
      moderationStatus: "ACTIVE",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: "FICTIONAL",
    },
  });
  await db.communitySave.create({
    data: { accountId: full.accountId, subjectType: "LISTING", subjectId: listing.id, kind: "SAVE" },
  });
});

test.afterAll(async () => {
  if (manifestRows.length > 0) {
    expect(manifestRows).toHaveLength(29);
    await writeFile(
      path.join(evidenceRoot, "manifest.json"),
      `${JSON.stringify({ schemaVersion: 1, project: "Project Homeport Phase 3", sourceSha, branch: "codex/project-homeport-product-reality-recovery", runId: `homeport-phase3-${sourceSha.slice(0, 12)}`, fixtureVersion, fixtureChecksum, evidence: manifestRows }, null, 2)}\n`,
      "utf8",
    );
  }
  await db.$disconnect();
});

async function signIn(page: Page, fixture: AccountFixture) {
  await page.context().clearCookies();
  await page.goto("/sign-in?returnTo=%2Faccount");
  await page.getByLabel("Email or legacy Player name").fill(fixture.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/account$/u);
  await expect(page.locator(".personal-harbor")).toBeVisible();
}

const accountDisclosure = (page: Page) => page.locator("#shell-account-disclosure");

async function openAccountMenu(page: Page, label: string) {
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(accountDisclosure(page)).toBeVisible();
  return accountDisclosure(page);
}

async function signInFromGateway(page: Page, fixture: AccountFixture) {
  await page.context().clearCookies();
  await page.goto("/");
  const menu = await openAccountMenu(page, "Account");
  await menu.getByRole("link", { name: "Sign In", exact: true }).click();
  await page.getByLabel("Email or legacy Player name").fill(fixture.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("button", { name: fixture.displayName, exact: true })).toBeVisible();
}

async function waitForHarbor(page: Page) {
  await expect(page.locator(".personal-harbor")).toBeVisible();
  await expect.poll(() => page.locator(".harbor-state--loading").count()).toBe(0);
}

async function capture(page: Page, evidenceId: string, viewport: string, zoom = 100, expectPersonalHarbor = true) {
  if (expectPersonalHarbor) {
    await expect(page.locator(".personal-harbor")).toBeVisible();
    await expect.poll(() => page.locator(".harbor-state--loading").count()).toBe(0);
  }
  const buffer = await page.screenshot({ path: path.join(evidenceRoot, `${evidenceId}.png`), fullPage: true });
  manifestRows.push({
    evidenceId,
    file: `${evidenceId}.png`,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    sourceSha,
    fixtureVersion,
    fixtureChecksum,
    browser: "chromium",
    viewport,
    zoom,
    route: new URL(page.url()).pathname,
    capturedAt: new Date().toISOString(),
  });
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  ).toBe(true);
}

test("Homeport Phase 3 A-AE Personal Harbor product journeys and required evidence", async ({ page }) => {
  await signIn(page, full);
  await capture(page, "HP-P3-EV-A-profile-overview-desktop", "1440x1000");

  await page.goto("/account/profile");
  await expect(page.getByRole("heading", { name: "Edit public Profile" })).toBeVisible();
  await capture(page, "HP-P3-EV-C-profile-editor", "1440x1000");
  await expect(page.getByRole("heading", { name: "What another visitor can see" })).toBeVisible();
  await page.goto(`/profile/${encodeURIComponent(full.handle!)}`);
  await expect(page.getByRole("heading", { name: full.displayName })).toBeVisible();
  await expect(page.getByText(full.email)).toHaveCount(0);
  await capture(page, "HP-P3-EV-D-public-profile-preview", "1440x1000", 100, false);
  await page.goto("/account/profile");
  await expect(page.getByRole("heading", { name: "Edit public Profile" })).toBeVisible();
  const image = await sharp({
    create: { width: 96, height: 96, channels: 4, background: { r: 28, g: 86, b: 84, alpha: 1 } },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Avatar image")
    .setInputFiles({ name: "synthetic-avatar.png", mimeType: "image/png", buffer: image });
  await expect(page.getByText("Image normalized and stored. The public projection has been refreshed.")).toBeVisible();
  await capture(page, "HP-P3-EV-E-profile-media", "1440x1000");

  await page.goto("/account/personal-information");
  await capture(page, "HP-P3-EV-F-personal-information", "1440x1000");
  await page.goto("/account/preferences");
  await capture(page, "HP-P3-EV-G-preferences", "1440x1000");
  await page.goto("/account/accessibility");
  await capture(page, "HP-P3-EV-H-accessibility", "1440x1000");
  await page.goto("/account/notifications");
  await capture(page, "HP-P3-EV-I-notifications", "1440x1000");
  await page.goto("/account/privacy");
  await capture(page, "HP-P3-EV-J-privacy", "1440x1000");
  await page.goto("/account/linked-identities");
  await expect(page.getByText("Synthetic Harbor Discord")).toBeVisible();
  await expect(page.getByText(/simulator adapter/iu)).toHaveCount(1);
  await expect(page.getByText("synthetic-never-returned")).toHaveCount(0);
  await capture(page, "HP-P3-EV-K-linked-identities", "1440x1000");

  await page.goto("/passport");
  await capture(page, "HP-P3-EV-L-passport-populated", "1440x1000");
  await page.goto("/passport/history");
  await capture(page, "HP-P3-EV-N-history-list", "1440x1000");
  await page.getByRole("link", { name: "Open record" }).click();
  await expect(page).toHaveURL(new RegExp(`/passport/history/${historyId}$`, "u"));
  await expect(page.getByRole("heading", { name: "Chronicle Record" })).toBeVisible();
  await capture(page, "HP-P3-EV-O-history-detail", "1440x1000");
  await expect(page.getByRole("heading", { name: "Private Keepsake" })).toBeVisible();
  await capture(page, "HP-P3-EV-P-memory-keepsake", "1440x1000");
  await page.goto("/passport/artifacts");
  await capture(page, "HP-P3-EV-Q-artifact-cabinet", "1440x1000");
  await page.goto(`/passport/artifacts/${encodeURIComponent(artifactId)}`);
  await expect(page.getByText("EXPLICIT_RECIPIENTS")).toBeVisible();
  await page.goto("/passport/saved");
  await capture(page, "HP-P3-EV-S-saved-content", "1440x1000");
  await page.goto("/account/security");
  await capture(page, "HP-P3-EV-T-security", "1440x1000");
  await page.goto("/account/sessions");
  await expect(page.getByRole("heading", { name: "Other sessions" })).toBeVisible();
  await capture(page, "HP-P3-EV-U-sessions", "1440x1000");
  await page.goto("/account/data");
  await capture(page, "HP-P3-EV-V-data-account", "1440x1000");

  await signIn(page, empty);
  await page.goto("/passport");
  await capture(page, "HP-P3-EV-M-passport-empty", "1440x1000");
  await page.goto("/passport/artifacts");
  await capture(page, "HP-P3-EV-R-artifact-empty", "1440x1000");

  await signIn(page, full);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account");
  await noOverflow(page);
  await capture(page, "HP-P3-EV-B-profile-overview-mobile", "390x844");
  await page.getByText("Personal Harbor sections", { exact: true }).click();
  await expect(
    page.locator(".personal-harbor__mobile-sections").getByRole("link", { name: "Sessions & Devices", exact: true }),
  ).toBeVisible();
  await capture(page, "HP-P3-EV-W-mobile-section-nav", "390x844");
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto("/account/profile");
  await page.getByLabel("Biography").fill("Unsaved synthetic draft for warning evidence.");
  await page.getByRole("link", { name: "Preferences" }).last().click();
  await expect(page.getByRole("dialog", { name: "Leave this section?" })).toBeVisible();
  await capture(page, "HP-P3-EV-X-unsaved-warning", "1440x1000");
  await page.getByRole("button", { name: "Stay" }).click();

  await db.playerProfile.update({
    where: { id: full.profileId },
    data: { biography: "Synthetic update from another window." },
  });
  await page.getByLabel("Display name").fill("Homeport Cartographer Draft");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText(/changed in another window/iu)).toBeVisible();
  await capture(page, "HP-P3-EV-Y-stale-conflict", "1440x1000");

  await page.route("**/api/account/overview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic dependency unavailable." }),
    }),
  );
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "This section is unavailable" })).toBeVisible();
  await capture(page, "HP-P3-EV-Z-dependency-unavailable", "1440x1000");
  await page.unroute("**/api/account/overview");

  await page.goto("/account/profile");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await noOverflow(page);
  await capture(page, "HP-P3-EV-AA-zoom-profile", "1440x1000", 200);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.goto("/passport");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await noOverflow(page);
  await capture(page, "HP-P3-EV-AB-zoom-passport", "1440x1000", 200);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/account/accessibility");
  await expect(page.getByText(/semantic final state immediately/iu)).toBeVisible();
  await capture(page, "HP-P3-EV-AC-reduced-motion", "1440x1000");

  expect(manifestRows).toHaveLength(29);
});

test.describe.serial("Project Homeport Phase 3 governed browser journeys A-AE", () => {
  test("Journey A: account menu to Personal Harbor", async ({ page }) => {
    await signInFromGateway(page, full);
    const menu = await openAccountMenu(page, full.displayName);
    await menu.getByRole("link", { name: "View My Profile", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/u);
    await waitForHarbor(page);
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  });

  test("Journey B: Profile overview connects the personal record", async ({ page }) => {
    await signIn(page, full);
    await expect(page.getByRole("heading", { name: full.displayName, exact: true })).toBeVisible();
    await expect(page.getByLabel("Overview content").getByText("@" + full.handle, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Passport Home", exact: true }).first().click();
    await expect(page).toHaveURL(/\/passport$/u);
    await waitForHarbor(page);
    await page.getByRole("link", { name: "Overview", exact: true }).first().click();
    await expect(page).toHaveURL(/\/account$/u);
  });

  test("Journey C: public Profile edit, shell refresh, and real public projection", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/profile");
    await waitForHarbor(page);
    const updatedName = full.displayName + " Updated";
    await page.getByLabel("Display name").fill(updatedName);
    await page.getByLabel("Biography").fill("Synthetic public projection journey. No real person is represented.");
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();
    await expect(page.getByRole("button", { name: updatedName, exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Open my Profile" }).click();
    await expect(page).toHaveURL(new RegExp("/profile/" + full.handle + "$", "u"));
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
    await page.goto("/account/profile");
    await waitForHarbor(page);
    await page.getByLabel("Display name").fill(full.displayName);
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText("Profile saved and public preview refreshed.")).toBeVisible();
  });

  test("Journey D: Profile media accepted, removed, and returned to fallback", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/profile");
    await waitForHarbor(page);
    const banner = await sharp({
      create: { width: 480, height: 180, channels: 4, background: { r: 15, g: 63, b: 61, alpha: 1 } },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel("Banner image")
      .setInputFiles({ name: "synthetic-banner.png", mimeType: "image/png", buffer: banner });
    await expect(
      page.getByText("Image normalized and stored. The public projection has been refreshed."),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove banner" }).click();
    await expect(page.getByText("Banner removed.")).toBeVisible();
  });

  test("Journey E: no-handle Profile remains deliberate and never links to null", async ({ page }) => {
    await signIn(page, empty);
    await page.goto("/account/profile");
    await waitForHarbor(page);
    await expect(page.getByText("Choose a handle to create a public Profile destination.")).toBeVisible();
    await expect(page.locator('a[href*="/profile/null"]')).toHaveCount(0);
  });

  test("Journey F: personal information is private and supported edits persist", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/personal-information");
    await waitForHarbor(page);
    await expect(page.getByText(full.email, { exact: true })).toBeVisible();
    await expect(page.getByText("Email changes are not currently supported.")).toBeVisible();
    await page.getByLabel("Display name").fill(full.displayName + " Private");
    await page.getByRole("button", { name: "Save display name" }).click();
    await expect(page.getByText("Personal information saved.")).toBeVisible();
    await page.getByLabel("Display name").fill(full.displayName);
    await page.getByRole("button", { name: "Save display name" }).click();
    await expect(page.getByText("Personal information saved.")).toBeVisible();
  });

  test("Journey G: typed experience preferences persist after reload", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/preferences");
    await waitForHarbor(page);
    await page.getByLabel("Theme").selectOption("DARK");
    await expect(page.getByLabel("Prefer low-bandwidth media")).toBeVisible();
    await page.getByLabel("Prefer low-bandwidth media").check();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved and applied.")).toBeVisible();
    await page.reload();
    await waitForHarbor(page);
    await expect(page.getByLabel("Theme")).toHaveValue("DARK");
    await expect(page.getByLabel("Prefer low-bandwidth media")).toBeChecked();
  });

  test("Journey H: accessibility preference updates its application consumer", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/accessibility");
    await waitForHarbor(page);
    await page.getByLabel("Motion").selectOption("REDUCED");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motionPreference)).toBe("reduced");
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved and applied.")).toBeVisible();
    await page.reload();
    await waitForHarbor(page);
    await expect(page.getByLabel("Motion")).toHaveValue("REDUCED");
  });

  test("Journey I: notification mutation reports success and persists", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/notifications");
    await waitForHarbor(page);
    const control = page.getByLabel("In-product updates");
    const initial = await control.isChecked();
    if (initial) await control.uncheck();
    else await control.check();
    await page.getByRole("button", { name: "Save notifications" }).click();
    await expect(page.getByText("Preferences saved and applied.")).toBeVisible();
    await page.reload();
    await waitForHarbor(page);
    if (initial) await expect(page.getByLabel("In-product updates")).not.toBeChecked();
    else await expect(page.getByLabel("In-product updates")).toBeChecked();
  });

  test("Journey J: privacy rules alter the anonymous public projection without leaking private fields", async ({
    page,
  }) => {
    await signIn(page, full);
    await page.goto("/account/privacy");
    await waitForHarbor(page);
    await page.getByLabel("biography").selectOption("ONLY_ME");
    await page.getByRole("button", { name: "Save privacy rules" }).click();
    await expect(page.getByText("Privacy rules saved and enforced by public projections.")).toBeVisible();
    await page.context().clearCookies();
    await page.goto("/profile/" + encodeURIComponent(full.handle!));
    await expect(page.getByText("Synthetic public projection journey. No real person is represented.")).toHaveCount(0);
    await expect(page.getByText(full.email)).toHaveCount(0);
  });

  test("Journey K: linked identities expose safe cards and support a protected unlink", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/linked-identities");
    await waitForHarbor(page);
    await expect(page.getByText("Synthetic Harbor Discord")).toBeVisible();
    await expect(page.getByText("synthetic-never-returned")).toHaveCount(0);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Unlink" }).click();
    await expect(page.getByText("Identity unlinked.")).toBeVisible();
    await expect(page.getByText("No external identities are linked.")).toBeVisible();
  });

  test("Journey L: populated Chronicle Passport reaches history, Memories, and artifacts", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/passport");
    await waitForHarbor(page);
    await expect(page.getByRole("heading", { name: "The Chronicle Passport" })).toBeVisible();
    const content = page.getByLabel("Chronicle Passport content");
    for (const name of ["Chronicle History", "Memories", "Artifact Cabinet", "Saved from Community"])
      await expect(content.getByRole("link", { name: new RegExp(name, "u") })).toBeVisible();
    await content.getByRole("link", { name: /Chronicle History/u }).click();
    await expect(page).toHaveURL(/\/passport\/history$/u);
    await expect(page.getByText("The Synthetic Lantern Atlas")).toBeVisible();
  });

  test("Journey M: empty Chronicle Passport is intentional and offers onward actions", async ({ page }) => {
    await signIn(page, empty);
    await page.goto("/passport");
    await waitForHarbor(page);
    await expect(page.getByRole("heading", { name: "The Chronicle Passport" })).toBeVisible();
    await expect(page.getByText("No completed or historical Voyages yet.")).toBeVisible();
    await expect(page.getByText("No private Chronicle Memories yet.")).toBeVisible();
  });

  test("Journey N: history search opens a version-pinned detail and returns", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/passport/history");
    await waitForHarbor(page);
    await page.getByLabel("Search your history").fill("Synthetic Lantern");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("The Synthetic Lantern Atlas")).toBeVisible();
    await page.getByRole("link", { name: "Open record" }).click();
    await expect(page).toHaveURL(new RegExp("/passport/history/" + historyId + "$", "u"));
    await expect(page.getByRole("heading", { name: "Version-pinned record" })).toBeVisible();
    await expect(page.getByText("A Chart Without Coordinates")).toBeVisible();
    await page.getByRole("link", { name: /Chronicle History/u }).click();
    await expect(page).toHaveURL(/\/passport\/history$/u);
  });

  test("Journey O: foreign history access is denied with the same safe record state", async ({ page }) => {
    await signIn(page, empty);
    await page.goto("/passport/history/" + encodeURIComponent(historyId));
    await waitForHarbor(page);
    await expect(page.getByRole("heading", { name: "This section is unavailable" })).toBeVisible();
    const actual = await page.locator(".harbor-state[role=alert]").textContent();
    await page.goto("/passport/history/synthetic-missing-record");
    await waitForHarbor(page);
    await expect(page.locator(".harbor-state[role=alert]")).toHaveText(actual ?? "");
  });

  test("Journey P: Artifact Cabinet opens provenance and saves owner personalization", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/passport/artifacts");
    await waitForHarbor(page);
    await page.getByLabel("Search artifacts").fill("Compass");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("link", { name: "View provenance" }).click();
    await expect(page).toHaveURL(new RegExp("/passport/artifacts/" + artifactId + "$", "u"));
    await expect(page.getByRole("heading", { name: "Provenance" })).toBeVisible();
    await expect(page.getByText("EXPLICIT_RECIPIENTS")).toBeVisible();
    await page.getByLabel("Mark as favorite").check();
    await page.getByRole("button", { name: "Save personalization" }).click();
    await expect(page.getByText("Artifact personalization saved.")).toBeVisible();
  });

  test("Journey Q: empty Artifact Cabinet has a designed owner-safe state", async ({ page }) => {
    await signIn(page, empty);
    await page.goto("/passport/artifacts");
    await waitForHarbor(page);
    await expect(page.getByRole("heading", { name: "No artifacts found" })).toBeVisible();
    await expect(page.getByText(/authoritative grant/iu)).toBeVisible();
  });

  test("Journey R: saved content unsaves and reconciles the Personal Harbor list", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/passport/saved");
    await waitForHarbor(page);
    await expect(page.getByText("Synthetic Harbor Chart")).toBeVisible();
    await page.getByRole("button", { name: "Remove saved item" }).click();
    await expect(page.getByText("Saved item removed.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No eligible saved items" })).toBeVisible();
  });

  test("Journey S: Security is ordinary-session accessible and delegates sensitive recovery", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/security");
    await waitForHarbor(page);
    await expect(page.getByRole("heading", { name: "Password & recovery" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start password reset" })).toHaveAttribute("href", "/forgot-password");
    await page.getByRole("link", { name: "Open Sessions & Devices" }).click();
    await expect(page).toHaveURL(/\/account\/sessions$/u);
  });

  test("Journey T: Sessions lists safe metadata and revokes an owned other session", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/sessions");
    await waitForHarbor(page);
    const others = page.getByRole("heading", { name: "Other sessions" }).locator("..");
    await expect(others.getByRole("button", { name: "Revoke" }).first()).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await others.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByText("Session revoked.")).toBeVisible();
  });

  test("Journey U: Sign Out Everywhere revokes the current browser without altering product records", async ({
    page,
  }) => {
    const revokeAll = await account("RevokeAll", false);
    await createAccountSession(revokeAll.accountId, "Synthetic second tab");
    await signIn(page, revokeAll);
    await page.goto("/account/sessions");
    await waitForHarbor(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Sign out all sessions" }).click();
    await expect(page).toHaveURL(/\/sign-in\?reason=revoked/iu);
    await expect(db.accountSession.count({ where: { accountId: revokeAll.accountId, revokedAt: null } })).resolves.toBe(
      0,
    );
  });

  test("Journey V: Data and Account distinguishes supported from unavailable operations", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/data");
    await waitForHarbor(page);
    await expect(page.getByRole("heading", { name: "Data & account operations" })).toBeVisible();
    await expect(page.getByText("NOT CURRENTLY SUPPORTED", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Open" })).toHaveCount(2);
  });

  test("Journey W: persistent desktop section navigation reaches every ordinary section", async ({ page }) => {
    await signIn(page, full);
    const destinations = [
      ["Overview", "/account"],
      ["Public Profile", "/account/profile"],
      ["Personal Information", "/account/personal-information"],
      ["Preferences", "/account/preferences"],
      ["Accessibility", "/account/accessibility"],
      ["Notifications", "/account/notifications"],
      ["Privacy & Safety", "/account/privacy"],
      ["Linked Identities", "/account/linked-identities"],
      ["Passport Home", "/passport"],
      ["History", "/passport/history"],
      ["Memories", "/passport/memories"],
      ["Artifacts", "/passport/artifacts"],
      ["Saved", "/passport/saved"],
      ["Security", "/account/security"],
      ["Sessions & Devices", "/account/sessions"],
      ["Data & Account", "/account/data"],
    ];
    for (const [label, route] of destinations) {
      const link = page.locator(".personal-harbor__rail").getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/") + "$", "u"));
      await waitForHarbor(page);
    }
  });

  test("Journey X: mobile section navigation has exact parity and reaches every section", async ({ page }) => {
    await signIn(page, full);
    await page.setViewportSize({ width: 390, height: 844 });
    const destinations = [
      ["Overview", "/account"],
      ["Public Profile", "/account/profile"],
      ["Personal Information", "/account/personal-information"],
      ["Preferences", "/account/preferences"],
      ["Accessibility", "/account/accessibility"],
      ["Notifications", "/account/notifications"],
      ["Privacy & Safety", "/account/privacy"],
      ["Linked Identities", "/account/linked-identities"],
      ["Passport Home", "/passport"],
      ["History", "/passport/history"],
      ["Memories", "/passport/memories"],
      ["Artifacts", "/passport/artifacts"],
      ["Saved", "/passport/saved"],
      ["Security", "/account/security"],
      ["Sessions & Devices", "/account/sessions"],
      ["Data & Account", "/account/data"],
    ];
    for (const [label, route] of destinations) {
      const mobile = page.locator(".personal-harbor__mobile-sections");
      if (!(await mobile.evaluate((element: HTMLDetailsElement) => element.open)))
        await page.getByText("Personal Harbor sections", { exact: true }).click();
      const link = mobile.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/") + "$", "u"));
      await waitForHarbor(page);
      await noOverflow(page);
    }
  });

  test("Journey Y: unsaved changes support Stay and Discard with correct destinations", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/profile");
    await waitForHarbor(page);
    await page.getByLabel("Biography").fill("Synthetic unsaved Journey Y draft.");
    await page.getByRole("link", { name: "Preferences", exact: true }).last().click();
    await expect(page.getByRole("dialog", { name: "Leave this section?" })).toBeVisible();
    await page.getByRole("button", { name: "Stay" }).click();
    await expect(page).toHaveURL(/\/account\/profile$/u);
    await page.getByRole("link", { name: "Preferences", exact: true }).last().click();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(/\/account\/preferences$/u);
  });

  test("Journey Z: stale revision conflict preserves the local draft and offers recovery", async ({ page }) => {
    await signIn(page, full);
    await page.goto("/account/profile");
    await waitForHarbor(page);
    await db.playerProfile.update({
      where: { id: full.profileId },
      data: { biography: "Synthetic newer Journey Z value." },
    });
    await page.getByLabel("Biography").fill("Synthetic older Journey Z draft.");
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText(/changed in another window/iu)).toBeVisible();
    await expect(page.getByLabel("Biography")).toHaveValue("Synthetic older Journey Z draft.");
    await expect(page.getByRole("button", { name: "Reload saved Profile" })).toBeVisible();
  });

  test("Journey AA: dependency unavailable is distinct, retryable, and recoverable", async ({ page }) => {
    await signIn(page, full);
    await page.route("**/api/account/overview", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic dependency unavailable." }),
      }),
    );
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "This section is unavailable" })).toBeVisible();
    await page.unroute("**/api/account/overview");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
  });

  test("Journey AB: critical Personal Harbor routes survive effective 200 percent zoom", async ({ page }) => {
    await signIn(page, full);
    for (const route of [
      "/account",
      "/account/profile",
      "/passport/history",
      "/passport/artifacts",
      "/account/sessions",
    ]) {
      await page.goto(route);
      await waitForHarbor(page);
      await page.evaluate(() => {
        document.documentElement.style.zoom = "2";
      });
      await noOverflow(page);
      await page.evaluate(() => {
        document.documentElement.style.zoom = "";
      });
    }
  });

  test("Journey AC: keyboard-only entry, section navigation, and unsaved dialog retain focus", async ({ page }) => {
    await signInFromGateway(page, full);
    const menu = await openAccountMenu(page, full.displayName);
    const profile = menu.getByRole("link", { name: "View My Profile", exact: true });
    await profile.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/account$/u);
    await waitForHarbor(page);
    const editor = page.locator(".personal-harbor__rail").getByRole("link", { name: "Public Profile", exact: true });
    await editor.focus();
    await page.keyboard.press("Enter");
    const biography = page.getByLabel("Biography");
    await biography.focus();
    await expect(biography).toBeFocused();
    await biography.pressSequentially(" Synthetic keyboard draft.");
    await expect(biography).toHaveValue(/Synthetic keyboard draft\./u);
    await expect(page.locator(".personal-harbor__draft-status")).toHaveText("Unsaved changes");
    const preferences = page.locator(".personal-harbor__rail").getByRole("link", { name: "Preferences", exact: true });
    await preferences.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Leave this section?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Stay" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(preferences).toBeFocused();
  });

  test("Journey AD: reduced motion preserves immediate semantic access", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page, full);
    await page.goto("/account/accessibility");
    await waitForHarbor(page);
    await expect(page.getByText(/semantic final state immediately/iu)).toBeVisible();
    await page.getByRole("link", { name: "Passport Home", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "The Chronicle Passport" })).toBeVisible();
  });

  test("Journey AE: Phase 1 identity and Phase 2 shell regression remains coherent", async ({ page }) => {
    await signInFromGateway(page, full);
    for (const [label, route] of [
      ["Player", "/player/library"],
      ["Captain", "/captain/library"],
      ["Creator Studio", "/studio/library"],
    ]) {
      const menu = await openAccountMenu(page, full.displayName);
      await menu.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/") + "$", "u"));
    }
    await page
      .getByRole("navigation", { name: "Global navigation" })
      .getByRole("link", { name: "Community Harbor", exact: true })
      .click();
    await expect(page).toHaveURL(/\/community$/u);
    let menu = await openAccountMenu(page, full.displayName);
    await menu.getByRole("link", { name: "View My Profile", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/u);
    menu = await openAccountMenu(page, full.displayName);
    await menu.getByRole("link", { name: "Chronicle Passport", exact: true }).click();
    await expect(page).toHaveURL(/\/passport$/u);
    menu = await openAccountMenu(page, full.displayName);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/u);
  });
});
