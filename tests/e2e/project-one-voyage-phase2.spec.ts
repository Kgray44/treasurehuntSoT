import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test, type Page, type Request } from "@playwright/test";
import { db } from "../../src/lib/db";
import { migrateLegacyCompanion } from "../../src/chronicle/legacy-companion-migration";

const campaignSlug = "phase2-legacy-compatibility-voyage";
const listingSlug = "phase2-route-proof-listing";
const credential = process.env.PHASE2_LEGACY_ACCESS_CODE;

type Fixture = {
  campaignId: string;
  sessionId: string;
  currentBlockId: string;
  membershipId?: string;
  playerProfileId?: string;
};

let fixture: Fixture;

async function requireValidationIsolation(page: Page) {
  const response = await page.request.get("/api/dev/validation/database-identity");
  expect(response.status(), await response.text()).toBe(200);
  expect(await response.json()).toEqual({ validationDatabase: true, nonceMatch: true });
}

async function legacyWriteSnapshot() {
  const [campaign, progressEvents, audits, accesses, identitySessions] = await Promise.all([
    db.campaign.findUniqueOrThrow({
      where: { id: fixture.campaignId },
      select: { currentSequence: true, updatedAt: true },
    }),
    db.progressEvent.count({ where: { campaignId: fixture.campaignId } }),
    db.adminAuditLog.count({ where: { campaignId: fixture.campaignId } }),
    db.playerAccess.count({ where: { campaignId: fixture.campaignId } }),
    db.playerIdentitySession.count(),
  ]);
  return { campaign, progressEvents, audits, accesses, identitySessions };
}

function captureWrites(page: Page) {
  const writes: Array<{ method: string; path: string }> = [];
  const listener = (request: Request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      writes.push({ method: request.method(), path: new URL(request.url()).pathname });
  };
  page.on("request", listener);
  return {
    writes,
    dispose: () => page.off("request", listener),
  };
}

test.describe.serial("Project One Voyage Phase 2 compatibility acceptance", () => {
  test.beforeAll(async () => {
    expect(credential, "PHASE2_LEGACY_ACCESS_CODE must be supplied only to the isolated runtime.").toMatch(/\S{12,}/u);

    const chapterContent = await db.chapterContent.create({
      data: {
        title: "Phase 2 Compatibility Chapter",
        narrative: "A synthetic migration fixture used only for browser acceptance.",
        objective: "Prove canonical Chronicle state through the retained doorway.",
        developmentOnly: true,
      },
    });
    const campaign = await db.campaign.create({
      data: {
        slug: campaignSlug,
        title: "Phase 2 Legacy Compatibility Voyage",
        status: "ACTIVE",
        accessCodeHash: await bcrypt.hash(credential!, 12),
        chapters: {
          create: {
            ordinal: 1,
            state: "ACTIVE",
            contentId: chapterContent.id,
            safeTeaser: "A safe synthetic compatibility chapter.",
          },
        },
        playerAccesses: {
          create: {
            tokenHash: createHash("sha256").update(`phase2-player-${randomUUID()}`).digest("hex"),
            label: "Phase 2 synthetic Player",
          },
        },
      },
    });
    const migration = await migrateLegacyCompanion({ campaignSlug });
    expect(migration.failures).toEqual([]);
    expect(migration.checksumMismatches).toEqual([]);

    const sessionReference = await db.legacyEntityReference.findFirstOrThrow({
      where: { sourceModel: "Campaign", sourceId: campaign.id, canonicalModel: "TaleSession" },
    });
    const current = await db.taleSession.findUniqueOrThrow({
      where: { id: sessionReference.canonicalId },
      select: { id: true, currentBlockId: true },
    });
    fixture = {
      campaignId: campaign.id,
      sessionId: current.id,
      currentBlockId: current.currentBlockId!,
    };

    const captain = await db.gameMasterUser.findUniqueOrThrow({
      where: { username: process.env.GM_USERNAME ?? "kato" },
      select: { id: true, canonicalAccount: { select: { id: true } } },
    });
    const captainAccount =
      captain.canonicalAccount ??
      (await db.userAccount.create({ data: { status: "ACTIVE", legacyGameMasterId: captain.id } }));
    const captainRole = await db.accountRoleAssignment.findFirst({
      where: { accountId: captainAccount.id, role: "CAPTAIN", scopeType: "GLOBAL", scopeId: null },
    });
    if (captainRole)
      await db.accountRoleAssignment.update({ where: { id: captainRole.id }, data: { revokedAt: null } });
    else
      await db.accountRoleAssignment.create({
        data: { accountId: captainAccount.id, role: "CAPTAIN", scopeType: "GLOBAL", grantedBy: captainAccount.id },
      });
    const profile = await db.communityProfile.upsert({
      where: { accountId: captainAccount.id },
      update: {},
      create: {
        accountId: captainAccount.id,
        normalizedHandle: "phase2-captain-proof",
        handle: "phase2-captain-proof",
        displayName: "Phase 2 Captain proof",
      },
    });
    await db.communityListing.create({
      data: {
        slug: listingSlug,
        itemType: "CHRONICLE",
        ownerProfileId: profile.id,
        title: "Phase 2 Route Proof Listing",
        visibility: "COMMUNITY",
        publicationStatus: "PUBLISHED",
      },
    });
  });

  test("A: the historical Player doorway resolves canonical state without legacy writes or replay", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await requireValidationIsolation(page);
    const publicRoute = await page.request.get(`/api/community/listings/public/${listingSlug}`);
    expect(publicRoute.status(), await publicRoute.text()).toBe(200);

    const before = await legacyWriteSnapshot();
    const beforeEvents = await db.taleSessionEvent.count({ where: { sessionId: fixture.sessionId } });
    const beforeAudit = await db.platformAuditEvent.count({ where: { resourceId: fixture.sessionId } });
    const beforeExchangeObservations = await db.compatibilityObservation.count({
      where: { canonicalSessionId: fixture.sessionId, operation: "LEGACY_ACCESS_EXCHANGE" },
    });
    const monitor = captureWrites(page);
    try {
      const historical = await page.goto(`/tale/${campaignSlug}`);
      expect(historical?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Confirm your invitation" })).toBeVisible();

      const exchange = await page.evaluate(
        async ({ slug, accessCode }) => {
          const response = await fetch("/api/player/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignSlug: slug, accessCode }),
          });
          return { status: response.status, body: await response.json() };
        },
        { slug: campaignSlug, accessCode: credential! },
      );
      expect(exchange.status).toBe(200);
      expect(exchange.body).toMatchObject({ ok: true, sessionId: fixture.sessionId });
      const [membershipReference, playerReference] = await Promise.all([
        db.legacyEntityReference.findFirstOrThrow({
          where: {
            sourceModel: "LegacyAccessCode",
            sourceId: fixture.campaignId,
            canonicalModel: "PlaythroughMembership",
          },
        }),
        db.legacyEntityReference.findFirstOrThrow({
          where: { sourceModel: "LegacyAccessCode", sourceId: fixture.campaignId, canonicalModel: "PlayerProfile" },
        }),
      ]);
      fixture.membershipId = membershipReference.canonicalId;
      fixture.playerProfileId = playerReference.canonicalId;
      await page.goto(exchange.body.redirectTo as string);
      await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible({ timeout: 20_000 });

      const state = await page.request.get(`/api/play/sessions/${fixture.sessionId}`);
      expect(state.status(), await state.text()).toBe(200);
      const stateBody = (await state.json()) as { session: { id: string }; journal: { currentBlockId: string } };
      expect(stateBody.session.id).toBe(fixture.sessionId);
      expect(stateBody.journal.currentBlockId).toBe(fixture.currentBlockId);
      expect(JSON.stringify(stateBody)).not.toContain(credential!);
      expect(JSON.stringify(stateBody)).not.toMatch(/accountId|email|password|legacyCredential/i);

      await page.reload();
      await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible({ timeout: 20_000 });
      await page.goto(`/tale/${campaignSlug}`);
      await expect(page).toHaveURL(new RegExp(`/play/${campaignSlug}/session/${fixture.sessionId}$`));
    } finally {
      monitor.dispose();
    }

    expect(monitor.writes).toEqual([{ method: "POST", path: "/api/player/access" }]);
    expect(await db.taleSessionEvent.count({ where: { sessionId: fixture.sessionId } })).toBe(beforeEvents);
    expect(await db.platformAuditEvent.count({ where: { resourceId: fixture.sessionId } })).toBe(beforeAudit + 1);
    expect(
      await db.compatibilityObservation.count({
        where: { canonicalSessionId: fixture.sessionId, operation: "LEGACY_ACCESS_EXCHANGE", disposition: "ADAPTED" },
      }),
    ).toBe(beforeExchangeObservations + 1);
    expect(await legacyWriteSnapshot()).toEqual(before);
    expect(
      await db.playthroughMembership.count({
        where: { playthroughId: fixture.sessionId, playerProfileId: fixture.playerProfileId! },
      }),
    ).toBe(1);
  });

  test("B: revocation denies the retained credential without restoring membership or issuing a session", async ({
    page,
  }) => {
    await requireValidationIsolation(page);
    expect(fixture.membershipId).toBeTruthy();
    await db.playthroughMembership.update({
      where: { id: fixture.membershipId! },
      data: { status: "REVOKED", removedAt: new Date() },
    });
    await page.context().clearCookies();
    await page.goto(`/tale/${campaignSlug}`);
    await expect(page.getByRole("heading", { name: "Confirm your invitation" })).toBeVisible();
    const sessionsBefore = await db.accountSession.count();
    const profilesBefore = await db.playerProfile.count();
    const membershipsBefore = await db.playthroughMembership.count({ where: { playthroughId: fixture.sessionId } });
    const observationsBefore = await db.compatibilityObservation.count({
      where: { canonicalSessionId: fixture.sessionId, operation: "LEGACY_ACCESS_EXCHANGE", disposition: "DENIED" },
    });
    const legacyBefore = await legacyWriteSnapshot();

    const denial = await page.evaluate(
      async ({ slug, accessCode }) => {
        const response = await fetch("/api/player/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignSlug: slug, accessCode }),
        });
        return { status: response.status, body: await response.json() };
      },
      { slug: campaignSlug, accessCode: credential! },
    );
    expect(denial.status).toBe(401);
    expect(denial.body).toEqual({ error: "This invitation no longer grants access to this Voyage." });
    expect(JSON.stringify(denial.body)).not.toContain(credential!);
    expect(await db.accountSession.count()).toBe(sessionsBefore);
    expect(await db.playerProfile.count()).toBe(profilesBefore);
    expect(await db.playthroughMembership.count({ where: { playthroughId: fixture.sessionId } })).toBe(
      membershipsBefore,
    );
    expect(await db.playthroughMembership.findUniqueOrThrow({ where: { id: fixture.membershipId! } })).toMatchObject({
      status: "REVOKED",
    });
    expect(
      await db.compatibilityObservation.count({
        where: { canonicalSessionId: fixture.sessionId, operation: "LEGACY_ACCESS_EXCHANGE", disposition: "DENIED" },
      }),
    ).toBe(observationsBefore + 1);
    expect(await legacyWriteSnapshot()).toEqual(legacyBefore);
  });

  test("C: Quartermaster hands off to Captain and writes one canonical command receipt", async ({ page }) => {
    await requireValidationIsolation(page);
    const beforeSessionEvents = await db.taleSessionEvent.count({ where: { sessionId: fixture.sessionId } });
    const beforeAudit = await db.platformAuditEvent.count({ where: { resourceId: fixture.sessionId } });
    const beforeObservation = await db.compatibilityObservation.count({
      where: { canonicalSessionId: fixture.sessionId, operation: "LEGACY_QUARTERMASTER_COMMAND" },
    });
    const beforeLegacy = await legacyWriteSnapshot();
    const gameMasterSessions = await db.gameMasterSession.count();

    await page.goto("/quartermaster");
    await expect(page).toHaveURL(/\/captain\/sign-in$/);
    const login = await page.request.post("/api/gm/login", {
      data: {
        username: process.env.GM_USERNAME ?? "kato",
        password: process.env.GM_PASSWORD ?? "development-captain-only",
      },
    });
    expect(login.status(), await login.text()).toBe(200);
    const { csrfToken } = (await login.json()) as { csrfToken: string };
    await page.goto("/quartermaster");
    await expect(page).toHaveURL(/\/captain$/);

    const monitor = captureWrites(page);
    let command: { status: number; body: unknown };
    try {
      command = await page.evaluate(
        async ({ csrf, slug }) => {
          const response = await fetch("/api/gm/action", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
            body: JSON.stringify({
              action: "ADD_LOG_ENTRY",
              campaignSlug: slug,
              expectedSequence: 0,
              idempotencyKey: `phase2-quartermaster-${crypto.randomUUID()}`,
              payload: { value: "Synthetic acceptance command." },
              confirmation: true,
            }),
          });
          return { status: response.status, body: await response.json() };
        },
        { csrf: csrfToken, slug: campaignSlug },
      );
    } finally {
      monitor.dispose();
    }
    expect(command!.status).toBe(200);
    expect(command!.body).toMatchObject({ persistence: "COMMITTED", kind: "PROGRESSION_EVENT" });
    expect(monitor.writes).toEqual([{ method: "POST", path: "/api/gm/action" }]);
    expect(await db.gameMasterSession.count()).toBe(gameMasterSessions);
    expect(await db.taleSessionEvent.count({ where: { sessionId: fixture.sessionId } })).toBe(beforeSessionEvents + 1);
    expect(await db.platformAuditEvent.count({ where: { resourceId: fixture.sessionId } })).toBe(beforeAudit + 1);
    expect(
      await db.compatibilityObservation.count({
        where: { canonicalSessionId: fixture.sessionId, operation: "LEGACY_QUARTERMASTER_COMMAND" },
      }),
    ).toBe(beforeObservation + 1);
    expect(await legacyWriteSnapshot()).toEqual(beforeLegacy);
  });
});
