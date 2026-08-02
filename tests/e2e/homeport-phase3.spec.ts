import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { createAccountSession, registerAccount } from "../../src/wayfarer/accounts";

const password = "Homeport-phase3-synthetic-passphrase-2026";
const fixtureVersion = "homeport-phase3-personal-harbor-v1";
const fixtureChecksum = createHash("sha256").update(`${fixtureVersion}:reserved-synthetic-no-private-content`).digest("hex");
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
const evidenceRoot = path.resolve(process.env.HOMEPORT_PHASE3_EVIDENCE_ROOT!);
const manifestRows: Array<Record<string, unknown>> = [];

type AccountFixture = { accountId: string; profileId: string; email: string; displayName: string; handle?: string };
let full: AccountFixture;
let empty: AccountFixture;
let historyId: string;
let artifactId: string;

async function account(label: string, handle = false): Promise<AccountFixture> {
  const suffix = randomUUID().slice(0, 6);
  const slug = `homeport-p3-${label.toLowerCase()}-${suffix}`;
  const result = await registerAccount({ email: `${slug}@example.invalid`, password, displayName: `Homeport ${label}`, deviceLabel: "Homeport Phase 3 synthetic browser" });
  await db.userAccount.update({ where: { id: result.account.id }, data: { status: "ACTIVE" } });
  if (handle) await db.playerProfile.update({ where: { id: result.account.profile.id }, data: { handle: slug, normalizedHandle: slug, biography: "Synthetic harbor cartographer. No real person or Voyage is represented.", defaultVisibility: "PUBLIC" } });
  return { accountId: result.account.id, profileId: result.account.profile.id, email: `${slug}@example.invalid`, displayName: `Homeport ${label}`, ...(handle ? { handle: slug } : {}) };
}

test.beforeAll(async () => {
  if (!process.env.HOMEPORT_PHASE3_DATABASE_PATH) throw new Error("HOMEPORT_PHASE3_REQUIRES_DEDICATED_RUNTIME");
  await mkdir(evidenceRoot, { recursive: true });
  full = await account("Cartographer", true);
  empty = await account("Newcomer", false);
  await db.profilePrivacyRule.createMany({ data: ["HEADER", "BIOGRAPHY", "PROVIDERS", "CHRONICLE_SUMMARY", "CREWS", "COMMUNITY"].map((section) => ({ playerProfileId: full.profileId, section, visibility: section === "HEADER" || section === "BIOGRAPHY" ? "PUBLIC" : "ONLY_ME" })) });
  await db.externalIdentity.create({ data: { accountId: full.accountId, provider: "DISCORD", providerAccountId: `synthetic-${randomUUID()}`, providerDisplayName: "Synthetic Harbor Discord", allowedScopes: '["synthetic-never-returned"]', useForLogin: false, visibility: "ONLY_ME", status: "LINKED" } });
  await createAccountSession(full.accountId, "Synthetic chart-table browser");
  const version = await db.publishedTaleVersion.findFirst({ select: { id: true, checksum: true } });
  if (!version) throw new Error("Homeport Phase 3 fixture requires one copied published Chronicle version.");
  historyId = `homeport_p3_history_${randomUUID().replaceAll("-", "")}`;
  await db.playerChronicleRecord.create({ data: { id: historyId, playerProfileId: full.profileId, sourcePlaythroughId: `homeport-p3-playthrough-${randomUUID()}`, publishedVersionId: version.id, publishedVersionChecksum: version.checksum, chronicleTitleSnapshot: "The Synthetic Lantern Atlas", playerNameSnapshot: full.displayName, participationRole: "PLAYER", crewRoleSnapshot: "Navigator", lifecycleStatus: "COMPLETED", outcome: "COMPLETED:synthetic-final", startedAt: new Date("2026-01-02T18:00:00.000Z"), joinedAt: new Date("2026-01-02T18:02:00.000Z"), completedAt: new Date("2026-01-02T19:24:00.000Z"), wallClockSeconds: 4920, wallClockAccuracy: "EXACT", completedChapters: JSON.stringify([{ schemaVersion: 1, blockId: "synthetic-block", chapterId: "synthetic-chapter", title: "A Chart Without Coordinates", completedAt: "2026-01-02T19:20:00.000Z", sourceSequence: 4, accuracy: "EXACT" }]), optionalObjectives: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: synthetic fixture has no optional-objective authority." }]), choiceSummary: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: selected choice identity is not retained." }]), artifactSummary: "[]", sourceFingerprint: fixtureChecksum } });
  await db.chronicleMemory.create({ data: { playerChronicleRecordId: historyId, playerProfileId: full.profileId, title: "A synthetic harbor light", body: "Reserved fixture prose with no real place, person, or event.", referenceType: "MOMENT", referenceId: "synthetic-moment", visibility: "ONLY_ME" } });
  artifactId = `homeport_p3_artifact_${randomUUID().replaceAll("-", "")}`;
  await db.playerArtifactRecord.create({ data: { id: artifactId, playerProfileId: full.profileId, sourcePlaythroughId: `homeport-p3-artifact-playthrough-${randomUUID()}`, sourceGrantEventId: `homeport-p3-grant-${randomUUID()}`, sourceGrantSequence: 7, sourceBlockId: "synthetic-artifact-block", publishedVersionId: version.id, publishedVersionChecksum: version.checksum, chronicleTitleSnapshot: "The Synthetic Lantern Atlas", artifactDefinitionId: "synthetic-brass-compass", artifactNameSnapshot: "Compass of Invented Tides", artifactTypeSnapshot: "RELIC", representationSnapshot: "FALLBACK", recipientPolicy: "EXPLICIT_RECIPIENTS", recipientEvidence: JSON.stringify({ schemaVersion: 1, synthetic: true }), ownershipState: "OWNED", custody: "PERSONAL", recordStatus: "ACTIVE", grantedAt: new Date("2026-01-02T19:10:00.000Z"), sourceFingerprint: fixtureChecksum } });
  const community = await db.communityProfile.create({ data: { accountId: full.accountId, normalizedHandle: `community-${full.handle}`, handle: `community-${full.handle}`, displayName: "Synthetic Harbor Press", biography: "Reserved fixture Creator.", visibility: "COMMUNITY", creatorStatus: "ACTIVE", moderationStatus: "ACTIVE" } });
  const listing = await db.communityListing.create({ data: { slug: `synthetic-harbor-chart-${randomUUID().slice(0, 8)}`, itemType: "GUIDE", ownerProfileId: community.id, title: "Synthetic Harbor Chart", shortDescription: "A reserved public fixture used to verify saved-content projection.", visibility: "COMMUNITY", publicationStatus: "PUBLISHED", moderationStatus: "ACTIVE", spoilerLevel: "PREVIEW_SAFE", locationClass: "FICTIONAL" } });
  await db.communitySave.create({ data: { accountId: full.accountId, subjectType: "LISTING", subjectId: listing.id, kind: "SAVE" } });
});

test.afterAll(async () => {
  await writeFile(path.join(evidenceRoot, "manifest.json"), `${JSON.stringify({ schemaVersion: 1, project: "Project Homeport Phase 3", sourceSha, branch: "codex/project-homeport-product-reality-recovery", runId: `homeport-phase3-${sourceSha.slice(0, 12)}`, fixtureVersion, fixtureChecksum, evidence: manifestRows }, null, 2)}\n`, "utf8");
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

async function capture(page: Page, evidenceId: string, viewport: string, zoom = 100) {
  await expect(page.locator(".personal-harbor")).toBeVisible();
  await expect.poll(() => page.locator(".harbor-state--loading").count()).toBe(0);
  const buffer = await page.screenshot({ path: path.join(evidenceRoot, `${evidenceId}.png`), fullPage: true });
  manifestRows.push({ evidenceId, file: `${evidenceId}.png`, sha256: createHash("sha256").update(buffer).digest("hex"), sourceSha, fixtureVersion, fixtureChecksum, browser: "chromium", viewport, zoom, route: new URL(page.url()).pathname, capturedAt: new Date().toISOString() });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

test("Homeport Phase 3 A-AE Personal Harbor product journeys and required evidence", async ({ page }) => {
  await signIn(page, full);
  await capture(page, "HP-P3-EV-A-profile-overview-desktop", "1440x1000");

  await page.goto("/account/profile");
  await expect(page.getByRole("heading", { name: "Edit public Profile" })).toBeVisible();
  await capture(page, "HP-P3-EV-C-profile-editor", "1440x1000");
  await expect(page.getByRole("heading", { name: "What another visitor can see" })).toBeVisible();
  await capture(page, "HP-P3-EV-D-public-profile-preview", "1440x1000");
  const image = await sharp({ create: { width: 96, height: 96, channels: 4, background: { r: 28, g: 86, b: 84, alpha: 1 } } }).png().toBuffer();
  await page.getByLabel("Avatar image").setInputFiles({ name: "synthetic-avatar.png", mimeType: "image/png", buffer: image });
  await expect(page.getByText("Image normalized and stored. The public projection has been refreshed.")).toBeVisible();
  await capture(page, "HP-P3-EV-E-profile-media", "1440x1000");

  await page.goto("/account/personal-information"); await capture(page, "HP-P3-EV-F-personal-information", "1440x1000");
  await page.goto("/account/preferences"); await capture(page, "HP-P3-EV-G-preferences", "1440x1000");
  await page.goto("/account/accessibility"); await capture(page, "HP-P3-EV-H-accessibility", "1440x1000");
  await page.goto("/account/notifications"); await capture(page, "HP-P3-EV-I-notifications", "1440x1000");
  await page.goto("/account/privacy"); await capture(page, "HP-P3-EV-J-privacy", "1440x1000");
  await page.goto("/account/linked-identities");
  await expect(page.getByText("Synthetic Harbor Discord")).toBeVisible();
  await expect(page.getByText(/simulator adapter/iu)).toHaveCount(1);
  await expect(page.getByText("synthetic-never-returned")).toHaveCount(0);
  await capture(page, "HP-P3-EV-K-linked-identities", "1440x1000");

  await page.goto("/passport"); await capture(page, "HP-P3-EV-L-passport-populated", "1440x1000");
  await page.goto("/passport/history"); await capture(page, "HP-P3-EV-N-history-list", "1440x1000");
  await page.getByRole("link", { name: "Open record" }).click(); await capture(page, "HP-P3-EV-O-history-detail", "1440x1000");
  await expect(page.getByRole("heading", { name: "Private Keepsake" })).toBeVisible(); await capture(page, "HP-P3-EV-P-memory-keepsake", "1440x1000");
  await page.goto("/passport/artifacts"); await capture(page, "HP-P3-EV-Q-artifact-cabinet", "1440x1000");
  await page.goto(`/passport/artifacts/${encodeURIComponent(artifactId)}`); await expect(page.getByText("EXPLICIT_RECIPIENTS")).toBeVisible();
  await page.goto("/passport/saved"); await capture(page, "HP-P3-EV-S-saved-content", "1440x1000");
  await page.goto("/account/security"); await capture(page, "HP-P3-EV-T-security", "1440x1000");
  await page.goto("/account/sessions"); await expect(page.getByRole("heading", { name: "Other sessions" })).toBeVisible(); await capture(page, "HP-P3-EV-U-sessions", "1440x1000");
  await page.goto("/account/data"); await capture(page, "HP-P3-EV-V-data-account", "1440x1000");

  await signIn(page, empty);
  await page.goto("/passport"); await capture(page, "HP-P3-EV-M-passport-empty", "1440x1000");
  await page.goto("/passport/artifacts"); await capture(page, "HP-P3-EV-R-artifact-empty", "1440x1000");

  await signIn(page, full);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account"); await noOverflow(page); await capture(page, "HP-P3-EV-B-profile-overview-mobile", "390x844");
  await page.getByText("Personal Harbor sections", { exact: true }).click();
  await expect(page.locator(".personal-harbor__mobile-sections").getByRole("link", { name: "Sessions & Devices", exact: true })).toBeVisible(); await capture(page, "HP-P3-EV-W-mobile-section-nav", "390x844");
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto("/account/profile");
  await page.getByLabel("Biography").fill("Unsaved synthetic draft for warning evidence.");
  await page.getByRole("link", { name: "Preferences" }).last().click();
  await expect(page.getByRole("dialog", { name: "Leave this section?" })).toBeVisible(); await capture(page, "HP-P3-EV-X-unsaved-warning", "1440x1000");
  await page.getByRole("button", { name: "Stay" }).click();

  await db.playerProfile.update({ where: { id: full.profileId }, data: { biography: "Synthetic update from another window." } });
  await page.getByLabel("Display name").fill("Homeport Cartographer Draft");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText(/changed in another window/iu)).toBeVisible(); await capture(page, "HP-P3-EV-Y-stale-conflict", "1440x1000");

  await page.route("**/api/account/overview", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic dependency unavailable." }) }));
  await page.goto("/account"); await expect(page.getByRole("heading", { name: "This section is unavailable" })).toBeVisible(); await capture(page, "HP-P3-EV-Z-dependency-unavailable", "1440x1000"); await page.unroute("**/api/account/overview");

  await page.goto("/account/profile"); await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); await noOverflow(page); await capture(page, "HP-P3-EV-AA-zoom-profile", "1440x1000", 200); await page.evaluate(() => { document.documentElement.style.zoom = ""; });
  await page.goto("/passport"); await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); await noOverflow(page); await capture(page, "HP-P3-EV-AB-zoom-passport", "1440x1000", 200); await page.evaluate(() => { document.documentElement.style.zoom = ""; });
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/account/accessibility"); await expect(page.getByText(/semantic final state immediately/iu)).toBeVisible(); await capture(page, "HP-P3-EV-AC-reduced-motion", "1440x1000");

  expect(manifestRows).toHaveLength(29);
});
