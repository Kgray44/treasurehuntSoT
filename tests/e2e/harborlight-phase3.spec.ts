import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import bcrypt from "bcryptjs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { db } from "../../src/lib/db";

type SignedInActor = Readonly<{
  accountId: string;
  profileId: string;
  csrfToken: string;
  context: BrowserContext;
  page: Page;
}>;

type HarborFixture = Readonly<{
  owner: SignedInActor;
  crew: SignedInActor;
  foreign: SignedInActor;
  listing: { id: string; slug: string; title: string };
  guide: { slug: string; title: string };
  voyageLogs: { community: string; unlisted: string; crew: string; private: string; ownerId: string };
  privateCoordinate: string;
  privateStorageReference: string;
}>;

test.describe.serial("Harborlight Phase 3 persisted browser acceptance", () => {
  let fixture: HarborFixture;

  test.beforeAll(async ({ browser }) => {
    fixture = await createFixture(browser);
  });

  test.afterAll(async () => {
    await fixture.owner.context.close();
    await fixture.crew.context.close();
    await fixture.foreign.context.close();
  });

  test("public discovery, Guides, metadata, keyboard operation, mobile layout, and reduced motion remain safe", async () => {
    const page = fixture.owner.page;
    await page.goto(`/community?q=${encodeURIComponent(fixture.listing.title)}`);
    await expect(page.getByRole("heading", { name: "Find your next bearing" })).toBeVisible();
    // The content-first landing shelves can also surface a matching public chart.
    // Scope this assertion to the explicit query-results projection rather than
    // coupling the journey to how many editorial shelves also contain it.
    const publicResults = page.locator('[aria-label="Public Community Harbor results"]');
    await expect(publicResults.getByRole("link", { name: fixture.listing.title })).toBeVisible();
    await expect(page.getByText("Hidden unlisted listing")).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Search public Community Harbor" }).focus();
    await expect(page.getByRole("searchbox", { name: "Search public Community Harbor" })).toBeFocused();
    await page.getByRole("button", { name: "Clear search and filters" }).press("Enter");
    await expect(page).toHaveURL(/\/community$/u);
    await page.goBack();
    await expect(page).toHaveURL(/q=/u);

    await page.goto(`/community/guides/${fixture.guide.slug}`);
    await expect(page.getByRole("heading", { name: fixture.guide.title })).toBeVisible();
    const guideBody = await page.locator("article.community-guide-detail").innerHTML();
    expect(guideBody).not.toContain("<script>");
    expect(guideBody).not.toContain(fixture.privateCoordinate);

    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/community/guides");
    await expect(page.getByRole("heading", { name: "Shipwright's Workshop" })).toBeVisible();
    // Let the responsive headline settle after its web font resolves before
    // taking the layout measurement; the stable rendered document must never
    // create a horizontal viewport overflow.
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBeTruthy();
  });

  test("owner editor is private, revision-safe, and never reveals upstream source or storage identity", async () => {
    const { owner, foreign, voyageLogs, privateCoordinate, privateStorageReference } = fixture;
    const ownerResponse = await owner.context.request.get(`/api/community/voyage-logs/owner/${voyageLogs.ownerId}`);
    expect(ownerResponse.ok(), await ownerResponse.text()).toBeTruthy();
    const ownerWire = await ownerResponse.text();
    expect(ownerWire).not.toContain(privateStorageReference);
    expect(ownerWire).not.toContain("source-session-");

    const foreignResponse = await foreign.context.request.get(`/api/community/voyage-logs/owner/${voyageLogs.ownerId}`);
    expect(foreignResponse.status()).toBe(404);
    expect(await foreignResponse.text()).not.toContain(voyageLogs.ownerId);

    await owner.page.goto(`/community/voyage-logs/owner/${voyageLogs.ownerId}`);
    await expect(owner.page.getByRole("heading", { name: "Edit Voyage Log" })).toBeVisible();
    await owner.page.getByLabel("Approximate location").fill("Harbor district");
    await owner.page.getByRole("button", { name: "Save revision" }).click();
    await expect(
      owner.page.getByText("Draft saved. Publication eligibility is checked again when you publish."),
    ).toBeVisible();
    expect((await owner.page.content()).includes(privateCoordinate)).toBeFalsy();
  });

  test("visibility is authorization-derived, exact-link unlisted is governed, and public projections remain privacy safe", async ({
    browser,
  }) => {
    const { crew, foreign, voyageLogs, privateCoordinate, privateStorageReference } = fixture;
    const anonymous = await browser.newContext();
    try {
      const community = await anonymous.request.get(`/api/community/voyage-logs/${voyageLogs.community}`);
      expect(community.ok(), await community.text()).toBeTruthy();
      const publicWire = await community.text();
      for (const forbidden of [privateCoordinate, privateStorageReference, "source-session-", fixture.owner.accountId])
        expect(publicWire).not.toContain(forbidden);
      expect(publicWire).toContain('"verifiedCompletion":true');

      const privateLog = await anonymous.request.get(`/api/community/voyage-logs/${voyageLogs.private}`);
      expect(privateLog.status()).toBe(404);
      const crewDenied = await foreign.context.request.get(`/api/community/voyage-logs/${voyageLogs.crew}`);
      expect(crewDenied.status()).toBe(404);
      const crewAllowed = await crew.context.request.get(`/api/community/voyage-logs/${voyageLogs.crew}`);
      expect(crewAllowed.ok(), await crewAllowed.text()).toBeTruthy();

      const unlisted = await anonymous.request.get(`/community/voyage-logs/${voyageLogs.unlisted}`);
      expect(unlisted.ok(), await unlisted.text()).toBeTruthy();
      expect(await unlisted.text()).toMatch(/name="robots" content="noindex, nofollow, noarchive"/i);
      const discovery = await anonymous.request.get("/api/community/voyage-logs");
      expect(await discovery.text()).not.toContain(voyageLogs.unlisted);
    } finally {
      await anonymous.close();
    }
  });

  test("social and collection mutations are CSRF-bound, persisted, and deny a foreign owner", async () => {
    const { owner, foreign, listing } = fixture;
    const create = await owner.context.request.post("/api/community/collections", {
      headers: { "x-csrf-token": owner.csrfToken },
      data: {
        slug: `browser-collection-${randomUUID().slice(0, 12)}`,
        title: "Browser acceptance collection",
        visibility: "PRIVATE",
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    const collection = (await create.json()) as { value: { id: string; updatedAt: string } };
    const add = await owner.context.request.post(`/api/community/collections/${collection.value.id}/items`, {
      headers: { "x-csrf-token": owner.csrfToken },
      data: { subjectType: "LISTING", subjectId: listing.id },
    });
    expect(add.ok(), await add.text()).toBeTruthy();
    const denied = await foreign.context.request.patch(`/api/community/collections/${collection.value.id}`, {
      headers: { "x-csrf-token": foreign.csrfToken },
      data: { title: "Foreign overwrite", expectedUpdatedAt: collection.value.updatedAt },
    });
    expect(denied.status()).toBe(403);
    const missingCsrf = await owner.context.request.post("/api/community/social/save", {
      data: { subjectType: "LISTING", subjectId: listing.id, idempotencyKey: randomUUID() },
    });
    expect(missingCsrf.status()).toBe(403);
  });
});

async function createFixture(browser: Browser): Promise<HarborFixture> {
  const suffix = randomUUID().slice(0, 12);
  const owner = await createActor(browser, `owner-${suffix}`);
  const crew = await createActor(browser, `crew-${suffix}`);
  const foreign = await createActor(browser, `foreign-${suffix}`);
  const title = `Browser public chronicle ${suffix}`;
  const listing = await db.communityListing.create({
    data: {
      slug: `browser-public-${suffix}`,
      itemType: "CHRONICLE",
      ownerProfileId: owner.profileId,
      title,
      shortDescription: "Synthetic public Community content for browser acceptance.",
      visibility: "COMMUNITY",
      publicationStatus: "PUBLISHED",
      moderationStatus: "ACTIVE",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: "FICTIONAL",
      primaryCategory: "adventure",
    },
    select: { id: true, slug: true, title: true },
  });
  await Promise.all([
    db.communityListingDiscoveryMetadata.create({
      data: { listingId: listing.id, themes: '["adventure"]', languages: '["en"]' },
    }),
    db.communityListingAggregate.create({
      data: { listingId: listing.id, installCount: 2, reviewCount: 1, saveCount: 1 },
    }),
    db.communitySearchDocument.create({
      data: {
        listingId: listing.id,
        normalizedTitle: title.toLowerCase(),
        normalizedSummary: "synthetic public community content",
        normalizedCreator: `owner-${suffix}`,
        searchableText: title.toLowerCase(),
      },
    }),
  ]);
  await db.communityGuideContent.create({
    data: {
      ownerProfileId: owner.profileId,
      slug: `browser-guide-${suffix}`,
      title: `Safe browser Guide ${suffix}`,
      safeSummary: "A structured, public-safe Guide summary.",
      sanitizedBody: "Use the prepared materials and review accessibility needs before sailing.",
      category: "Preparation",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  const privateCoordinate = "44.123456,-72.654321";
  const privateStorageReference = `sealed-hold/private/${suffix}`;
  const community = await createVoyageLog(
    owner.accountId,
    `community-${suffix}`,
    "COMMUNITY",
    privateCoordinate,
    privateStorageReference,
  );
  const unlisted = await createVoyageLog(
    owner.accountId,
    `unlisted-${suffix}`,
    "UNLISTED",
    privateCoordinate,
    privateStorageReference,
  );
  const privateLog = await createVoyageLog(
    owner.accountId,
    `private-${suffix}`,
    "PRIVATE",
    privateCoordinate,
    privateStorageReference,
  );
  const crewLog = await createVoyageLog(
    owner.accountId,
    `crew-${suffix}`,
    "CREW_ONLY",
    privateCoordinate,
    privateStorageReference,
    crew.accountId,
  );
  return {
    owner,
    crew,
    foreign,
    listing,
    guide: { slug: `browser-guide-${suffix}`, title: `Safe browser Guide ${suffix}` },
    voyageLogs: {
      community: community.slug,
      unlisted: unlisted.slug,
      crew: crewLog.slug,
      private: privateLog.slug,
      ownerId: privateLog.id,
    },
    privateCoordinate,
    privateStorageReference,
  };
}

async function createActor(browser: Browser, handle: string): Promise<SignedInActor> {
  const password = `Harborlight-${randomUUID()}-safe`;
  const gm = await db.gameMasterUser.create({
    data: { username: handle, passwordHash: await bcrypt.hash(password, 10), role: "CAPTAIN_CREATOR" },
  });
  const account = await db.userAccount.create({ data: { status: "ACTIVE", legacyGameMasterId: gm.id } });
  await db.playerProfile.create({
    data: {
      accountId: account.id,
      displayName: handle,
      handle,
      normalizedHandle: handle,
      defaultVisibility: "PUBLIC",
      status: "ACTIVE",
      claimedAt: new Date(),
    },
  });
  const profile = await db.communityProfile.create({
    data: { accountId: account.id, handle, normalizedHandle: handle, displayName: handle, visibility: "COMMUNITY" },
  });
  const context = await browser.newContext();
  const login = await context.request.post("/api/gm/login", { data: { username: handle, password } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const payload = (await login.json()) as { csrfToken: string };
  return {
    accountId: account.id,
    profileId: profile.id,
    csrfToken: payload.csrfToken,
    context,
    page: await context.newPage(),
  };
}

async function createVoyageLog(
  ownerAccountId: string,
  slug: string,
  visibility: "PRIVATE" | "CREW_ONLY" | "UNLISTED" | "COMMUNITY",
  coordinate: string,
  storageReference: string,
  crewAccountId?: string,
) {
  const keepsake = await db.communityVoyageKeepsake.create({
    data: {
      ownerAccountId,
      wayfarerKeepsakeId: `opaque-keepsake-${slug}`,
      sourceWatermark: "source-watermark",
      sourceProjectionChecksum: "a".repeat(64),
      preparationState: "DRAFT_CREATED",
      safeSnapshot: '{"title":"Synthetic browser Voyage"}',
    },
  });
  const log = await db.communityVoyageLog.create({
    data: {
      keepsakeId: keepsake.id,
      ownerAccountId,
      slug,
      title: `Browser Voyage ${slug}`,
      safeSummary: "A public-safe browser Voyage summary.",
      visibility,
      spoilerLevel: "NONE",
      approximateLocation: coordinate,
      verifiedCompletion: true,
      lifecycleState: "PUBLISHED",
      projectionChecksum: "b".repeat(64),
      searchIndexedAt: visibility === "COMMUNITY" ? new Date() : null,
      publishedAt: new Date(),
    },
  });
  if (crewAccountId) {
    const participant = await db.communityVoyageLogParticipant.create({
      data: { voyageLogId: log.id, accountId: crewAccountId, displayNameSnapshot: "Synthetic crew member" },
    });
    await db.communityVoyageLogParticipantConsent.create({
      data: {
        voyageLogId: log.id,
        participantId: participant.id,
        purpose: "HARBORLIGHT_VOYAGE_LOG_PUBLICATION:DISPLAY_NAME",
        state: "APPROVED",
        requestedAt: new Date(),
        grantedAt: new Date(),
      },
    });
  }
  // This is intentionally only a private row; the public viewer select never projects it.
  const media = await db.communityVoyageLogMedia.create({
    data: {
      voyageLogId: log.id,
      privateMediaReference: storageReference,
      sourceChecksum: "c".repeat(64),
      detectedMediaType: "image/jpeg",
      derivativeChecksum: "d".repeat(64),
      derivativeStorageReference: `public-derivative-${slug}`,
      processingStatus: "READY",
      scanStatus: "CLEAN",
      exifGpsRemoved: true,
    },
  });
  await db.communityVoyageLogMediaConsent.create({
    data: {
      voyageLogMediaId: media.id,
      accountId: ownerAccountId,
      purpose: "PUBLIC_MEDIA",
      approvedOpaqueMediaId: `opaque-media-${slug}`,
      approvedSourceChecksum: "c".repeat(64),
      approvedDerivativeChecksum: "d".repeat(64),
      grantedAt: new Date(),
    },
  });
  return log;
}
