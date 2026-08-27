import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { hash } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { resolveArtifactGrantReceipt, type EventMembership } from "../../src/chronicle/artifact-grant";
import { revokeCaptainAuthority } from "../../src/helm/captain-participation";
import { db } from "../../src/lib/db";
import { materializeChronicleHistory } from "../../src/wayfarer/chronicle-history";

type CreatedVoyage = {
  playthroughId: string;
  invitations: Array<{ link: string }>;
  participation: {
    participationMode: "CAPTAIN_ONLY" | "CAPTAIN_AND_PLAYER";
    hasPlayerMembership: boolean;
  };
};

type BrowserJsonResult<T> = { status: number; body: T };

const password = "Project-Helm-browser-passphrase-2026";
const suffix = randomUUID().slice(0, 8);
const email = `project-helm-${suffix}@example.invalid`;
const displayName = `Helm Captain ${suffix}`;
let accountId = "";
let playerProfileId = "";
let accountSessionId = "";
let signInClientOrdinal = 0;

test.describe.configure({ mode: "serial", timeout: 600_000 });

async function prewarmHelmRoutes(request: APIRequestContext) {
  const routes: ReadonlyArray<{ method: "GET" | "POST"; path: string }> = [
    { method: "GET", path: "/" },
    { method: "GET", path: "/sign-in" },
    { method: "GET", path: "/account/roles" },
    { method: "GET", path: "/captain/library" },
    { method: "GET", path: "/player/invitation?token=helm-prewarm" },
    { method: "GET", path: "/player/playthroughs/helm-prewarm" },
    { method: "GET", path: "/player/playthroughs/helm-prewarm/journal" },
    { method: "GET", path: "/api/auth/context" },
    { method: "POST", path: "/api/auth/sign-in" },
    { method: "GET", path: "/api/captain/playthroughs" },
    { method: "POST", path: "/api/captain/playthroughs" },
    { method: "POST", path: "/api/invitations/accept" },
    { method: "GET", path: "/api/player/playthroughs/helm-prewarm" },
    { method: "POST", path: "/api/player/playthroughs/helm-prewarm/presence" },
    { method: "GET", path: "/api/captain/voyages/helm-prewarm" },
    { method: "GET", path: "/api/play/sessions/helm-prewarm" },
    { method: "POST", path: "/api/captain/playthroughs/helm-prewarm/launch" },
  ];
  for (const route of routes) {
    await request.fetch(route.path, {
      method: route.method,
      failOnStatusCode: false,
      ...(route.method === "POST" ? { data: {} } : {}),
    });
  }
}

async function seedPlayableChronicle() {
  const taleId = `helm-browser-tale-${suffix}`;
  const chapterId = `${taleId}-chapter`;
  const blockId = `${chapterId}-block`;
  const publishedAt = new Date("2026-08-26T00:00:00.000Z");
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: taleId,
      slug: taleId,
      title: "Helm browser Chronicle",
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PUBLIC",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: [
      {
        id: chapterId,
        title: "Ready to sail",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: blockId,
        completionBlockId: blockId,
        blocks: [
          {
            id: blockId,
            chapterId,
            blockType: "NARRATIVE",
            title: "Cast off",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 0,
            isEnabled: true,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: publishedAt.toISOString(),
  };
  const contentSnapshot = JSON.stringify(snapshot);
  const chronicle = await db.chronicle.create({
    data: {
      slug: taleId,
      title: snapshot.tale.title,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      creatorId: playerProfileId,
      creatorAccountId: accountId,
    },
  });
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: chronicle.id,
      versionNumber: 1,
      versionLabel: "Helm browser v1",
      publishedBy: accountId,
      publishedByAccountId: accountId,
      checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
      contentSnapshot,
      publishedAt,
      isCurrent: true,
    },
  });
  await db.chronicle.update({ where: { id: chronicle.id }, data: { latestPublishedVersionId: version.id } });
}

test.beforeAll(async ({ request }) => {
  await prewarmHelmRoutes(request);
  const now = new Date();
  const account = await db.userAccount.create({
    data: {
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      emails: {
        create: {
          normalizedEmail: email,
          displayEmail: email,
          verificationState: "VERIFIED",
          verifiedAt: now,
        },
      },
      credential: { create: { passwordHash: await hash(password, 4) } },
      profile: {
        create: {
          displayName,
          normalizedDisplayName: displayName.toLocaleLowerCase("en-US"),
          status: "ACTIVE",
          claimedAt: now,
        },
      },
      roles: { create: { role: "PLAYER" } },
    },
    include: { profile: true },
  });
  accountId = account.id;
  playerProfileId = account.profile!.id;
  await seedPlayableChronicle();
  expect(await db.publishedTaleVersion.count()).toBeGreaterThan(0);
});

test.afterAll(async () => db.$disconnect());

async function signInThroughProduct(page: Page) {
  // The suite exercises distinct browser contexts as distinct devices. Give each
  // context a documentation-reserved test-network address so the interactive
  // login guard observes the same client boundary it would behind a proxy.
  signInClientOrdinal += 1;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.18.0.${signInClientOrdinal}` });
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email or legacy Player name")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email or legacy Player name").fill(email);
  await page.getByLabel("Password").fill(password);
  const signInResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/sign-in") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue" }).click({ noWaitAfter: true });
  expect((await signInResponse).status()).toBe(200);
  await expect(page).toHaveURL((url) => url.pathname === "/" && url.search === "", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: displayName, exact: true })).toBeVisible({ timeout: 30_000 });
  const context = await browserJson<{
    user: { accountId: string };
    session: { id: string };
    capabilities: { canUsePlayer: boolean; canUseCaptain: boolean };
  }>(page, "/api/auth/context");
  expect(context.status).toBe(200);
  expect(context.body.user.accountId).toBe(accountId);
  expect(context.body.capabilities).toMatchObject({ canUsePlayer: true, canUseCaptain: true });
  accountSessionId = context.body.session.id;
  await enterCaptain(page);
}

async function accountMenu(page: Page, label = displayName) {
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible({ timeout: 60_000 });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  const menu = page.locator("#shell-account-disclosure");
  await expect(menu).toBeVisible();
  return menu;
}

async function enterCaptain(page: Page) {
  const menu = await accountMenu(page);
  await Promise.all([
    page.waitForURL(/\/account\/roles$/u, { timeout: 30_000 }),
    menu.getByRole("link", { name: "All Workspaces", exact: true }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "All Workspaces" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Enter Captain" }).click();
  await expect(page).toHaveURL(/\/captain\/library$/u, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible({ timeout: 30_000 });
}

function voyageCard(
  page: Page,
  voyageName: string,
  group: "Needs Attention" | "Active Voyages" | "Ready to Launch" | "Voyage Records",
) {
  return page
    .locator(`.captain-voyage-card[data-voyage-group="${group}"]`)
    .filter({ has: page.getByRole("heading", { name: voyageName, exact: true }) });
}

async function createVoyage(
  page: Page,
  input: { voyageName: string; crewName: string | string[]; participation: "CAPTAIN_ONLY" | "CAPTAIN_AND_PLAYER" },
) {
  await page.getByRole("button", { name: "Create a Voyage" }).first().click();
  await expect(page.getByRole("dialog", { name: "Select Chronicle" })).toBeVisible();
  const wizard = page.locator(".voyage-wizard");
  await wizard.locator(".wizard-choice-grid > button").first().click();
  await wizard.getByRole("button", { name: "Continue to Configure Voyage" }).click();
  const captainOnly = wizard.getByRole("radio", { name: /Captain only/u });
  const captainPlayer = wizard.getByRole("radio", { name: /Captain \+ Player/u });
  await expect(captainOnly).toBeChecked();
  if (input.participation === "CAPTAIN_AND_PLAYER") {
    await captainPlayer.check();
    await expect(captainPlayer).toBeChecked();
  }
  await wizard.getByLabel("Voyage name").fill(input.voyageName);
  await wizard.getByRole("button", { name: "Continue to Add Crew" }).click();
  const crewNames = Array.isArray(input.crewName) ? input.crewName : [input.crewName];
  for (const [index, crewName] of crewNames.entries()) {
    if ((await wizard.getByLabel("Crew member name").count()) <= index)
      await wizard.getByRole("button", { name: "Add another Crew member" }).click();
    await wizard.getByLabel("Crew member name").nth(index).fill(crewName);
  }
  await wizard.getByRole("button", { name: "Continue to Invitation access" }).click();
  await wizard.getByRole("button", { name: "Continue to Delivery" }).click();
  await wizard.getByRole("button", { name: "Continue to Review" }).click();
  await expect(wizard.getByRole("heading", { name: "Review" })).toBeVisible();
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/captain/playthroughs") && response.request().method() === "POST",
  );
  await wizard.getByRole("button", { name: "Create Voyage and invitations" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const created = (await response.json()) as CreatedVoyage;
  expect(created.participation.participationMode).toBe(input.participation);
  expect(created.participation.hasPlayerMembership).toBe(input.participation === "CAPTAIN_AND_PLAYER");
  if (crewNames.length) await expect(wizard.getByRole("heading", { name: crewNames[0]! })).toBeVisible();
  else await expect(wizard.getByText(/No Crew invitations were created/u)).toBeVisible();
  await wizard.getByRole("button", { name: "Done" }).click();
  await expect(voyageCard(page, input.voyageName, "Ready to Launch")).toBeVisible();
  return created;
}

async function acceptGuestInvitation(browser: Browser, link: string, playthroughId: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  const unavailable = page.getByRole("heading", { name: "The invitation could not be reached" });
  if (await unavailable.isVisible().catch(() => false)) await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("main.invitation-page")).toHaveAttribute("data-invitation-state", "valid", {
    timeout: 30_000,
  });
  const accept = page.getByRole("button", { name: /Accept and Join Voyage/iu });
  await expect(accept).toBeEnabled();
  // Warm the authenticated destination before the visible acceptance handoff.
  // The request carries no invitation credential and therefore cannot mutate
  // membership; it prevents a first compile/refresh from aborting the
  // canonical browser submission in long-lived isolated servers.
  const destinationWarmup = await page.request.get(`/player/playthroughs/${playthroughId}`);
  expect([200, 302, 303, 307, 308]).toContain(destinationWarmup.status());
  const response = page.waitForResponse(
    (candidate) => candidate.url().endsWith("/api/invitations/accept") && candidate.request().method() === "POST",
  );
  // Invitation acceptance owns an animated route handoff after its authoritative
  // mutation. Waiting for the whole client navigation here can hide a completed
  // membership transaction behind an optional presentation runtime.
  await accept.click({ noWaitAfter: true });
  const acceptedResponse = await response;
  expect(acceptedResponse.status(), await acceptedResponse.text()).toBe(200);
  await expect(page).toHaveURL(/\/player\/playthroughs\//u, { timeout: 30_000 });
  return { context, page };
}

async function beginVoyage(page: Page, voyageName: string) {
  const card = voyageCard(page, voyageName, "Ready to Launch");
  await card.getByRole("button", { name: "Begin Voyage" }).click();
  const dialog = page.getByRole("dialog");
  const responsePromise = page.waitForResponse(
    (response) =>
      /\/api\/captain\/playthroughs\/[^/]+\/launch$/u.test(response.url()) && response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Begin Voyage" }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  await expect(voyageCard(page, voyageName, "Active Voyages")).toBeVisible();
}

async function browserJson<T>(
  page: Page,
  url: string,
  init?: { method?: "GET" | "POST"; body?: unknown; csrf?: string },
) {
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const response = await fetch(requestUrl, {
        method: requestInit?.method,
        credentials: "same-origin",
        headers: {
          ...(requestInit?.body === undefined ? {} : { "content-type": "application/json" }),
          ...(requestInit?.csrf ? { "x-csrf-token": requestInit.csrf } : {}),
        },
        body: requestInit?.body === undefined ? undefined : JSON.stringify(requestInit.body),
      });
      const text = await response.text();
      return {
        status: response.status,
        body: text ? (JSON.parse(text) as unknown) : null,
      };
    },
    { requestUrl: url, requestInit: init },
  ) as Promise<BrowserJsonResult<T>>;
}

function jsonShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? [jsonShape(value[0])] : [];
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "csrfToken")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, jsonShape(child)]),
    );
  return typeof value;
}

function forbiddenProjectionKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(forbiddenProjectionKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/giu, "");
    const forbidden =
      /^(?:captain(?:instruction|answer|secret|control|annotation)s?|acceptedanswers?|unreleasedhints?|future(?:branch|chroniclecontent)|rawverification(?:evidence|media)|privateassets?|revealstate|audit(?:event|data)s?|command(?:availability|control)s?|provider(?:secret|token|state)s?|security(?:event|data)s?|accountemail|sessiontokens?|ipaddress|devicefingerprint|creatordraft(?:information)?|private(?:memory|reflection|note)s?|unsharedanswertext)$/iu;
    return forbidden.test(normalizedKey) || forbiddenProjectionKey(child);
  });
}

async function currentMembership(playthroughId: string) {
  return db.playthroughMembership.findUniqueOrThrow({
    where: { playthroughId_playerProfileId: { playthroughId, playerProfileId } },
  });
}

function asArtifactMembership(member: Awaited<ReturnType<typeof currentMembership>>): EventMembership {
  return {
    id: member.id,
    playerProfileId: member.playerProfileId,
    status: member.status,
    crewRole: member.crewRole,
    joinedAt: member.joinedAt,
    removedAt: member.removedAt,
  };
}

async function assertOneAccountSession(context: BrowserContext, page: Page) {
  const cookies = await context.cookies();
  expect(cookies.filter((cookie) => cookie.name === "wayfarer_account")).toHaveLength(1);
  expect(cookies.some((cookie) => ["forever_gm", "chronicle_player"].includes(cookie.name))).toBe(false);
  const auth = await browserJson<{ session: { id: string } }>(page, "/api/auth/context");
  expect(auth.status).toBe(200);
  expect(auth.body.session.id).toBe(accountSessionId);
}

test("Captain authority and ordinary Player membership remain independent through the visible product journey", async ({
  browser,
  page,
}) => {
  test.setTimeout(600_000);
  await signInThroughProduct(page);
  await assertOneAccountSession(page.context(), page);

  const captainOnlyName = `Helm Captain only ${suffix}`;
  const captainOnly = await createVoyage(page, {
    voyageName: captainOnlyName,
    crewName: `Helm Observer ${suffix}`,
    participation: "CAPTAIN_ONLY",
  });
  const captainOnlyRow = await db.taleSession.findUniqueOrThrow({ where: { id: captainOnly.playthroughId } });
  expect(captainOnlyRow.captainAccountId).toBe(accountId);
  expect(
    await db.playthroughMembership.count({
      where: { playthroughId: captainOnly.playthroughId, playerProfileId },
    }),
  ).toBe(0);
  const captainOnlyCard = voyageCard(page, captainOnlyName, "Ready to Launch");
  await expect(captainOnlyCard.getByText("Captain only", { exact: true })).toBeVisible();
  await expect(captainOnlyCard.getByRole("link", { name: "Open Player View" })).toHaveCount(0);
  expect((await browserJson(page, `/api/play/sessions/${captainOnly.playthroughId}`)).status).toBe(401);
  expect((await browserJson(page, `/api/captain/sessions/${captainOnly.playthroughId}`)).status).toBe(200);
  expect(
    await db.playerChronicleRecord.count({
      where: { playerProfileId, sourcePlaythroughId: captainOnly.playthroughId },
    }),
  ).toBe(0);

  const participatingName = `Helm participating ${suffix}`;
  const participating = await createVoyage(page, {
    voyageName: participatingName,
    crewName: `Helm Navigator ${suffix}`,
    participation: "CAPTAIN_AND_PLAYER",
  });
  let selfMembership = await currentMembership(participating.playthroughId);
  expect(selfMembership.status).toBe("READY");
  expect(
    await db.playthroughMembership.count({
      where: { playthroughId: participating.playthroughId, playerProfileId },
    }),
  ).toBe(1);
  const participatingCard = voyageCard(page, participatingName, "Ready to Launch");
  await expect(participatingCard.getByText("Captain + Player", { exact: true })).toBeVisible();
  const playerHref = await participatingCard.getByRole("link", { name: "Open Player View" }).getAttribute("href");
  expect(playerHref).toBe(`/player/playthroughs/${participating.playthroughId}`);
  const playerTab = await page.context().newPage();
  await playerTab.goto(playerHref!);
  await expect(playerTab).toHaveURL(new RegExp(`/player/playthroughs/${participating.playthroughId}$`, "u"));
  await assertOneAccountSession(page.context(), playerTab);

  const guest = await acceptGuestInvitation(browser, participating.invitations[0]!.link, participating.playthroughId);
  try {
    await page.reload();
    await beginVoyage(page, participatingName);
    await expect.poll(async () => (await currentMembership(participating.playthroughId)).status).toBe("ACTIVE_MEMBER");
    await playerTab.bringToFront();
    await expect(playerTab).toHaveURL(new RegExp(`/player/playthroughs/${participating.playthroughId}/journal$`, "u"), {
      timeout: 30_000,
    });
    await guest.page.bringToFront();
    await expect(guest.page).toHaveURL(
      new RegExp(`/player/playthroughs/${participating.playthroughId}/journal$`, "u"),
      {
        timeout: 30_000,
      },
    );
    await page.bringToFront();

    const [captainPlayerState, guestPlayerState] = await Promise.all([
      browserJson(playerTab, `/api/play/sessions/${participating.playthroughId}`),
      browserJson(guest.page, `/api/play/sessions/${participating.playthroughId}`),
    ]);
    expect(captainPlayerState.status).toBe(200);
    expect(guestPlayerState.status).toBe(200);
    expect(jsonShape(captainPlayerState.body)).toEqual(jsonShape(guestPlayerState.body));
    expect(forbiddenProjectionKey(captainPlayerState.body)).toBe(false);
    expect(forbiddenProjectionKey(guestPlayerState.body)).toBe(false);

    await expect(
      voyageCard(page, participatingName, "Active Voyages").getByRole("link", { name: /Open Captain/u }),
    ).toBeVisible();
    await expect(playerTab.getByRole("link", { name: /Open Captain/u })).toHaveCount(0);
    await assertOneAccountSession(page.context(), page);
    await assertOneAccountSession(page.context(), playerTab);

    const beforeRemoval = new Date();
    const card = voyageCard(page, participatingName, "Active Voyages");
    await card.getByRole("button", { name: "Stop Player participation" }).click();
    const participationResponse = page.waitForResponse(
      (response) =>
        /\/api\/captain\/playthroughs\/[^/]+\/participation$/u.test(response.url()) &&
        response.request().method() === "POST",
    );
    await page.getByRole("dialog").getByRole("button", { name: "Stop Player participation" }).click();
    expect((await participationResponse).status()).toBe(200);
    await expect(
      voyageCard(page, participatingName, "Active Voyages").getByRole("button", { name: "Join as Player" }),
    ).toBeVisible({ timeout: 30_000 });
    selfMembership = await currentMembership(participating.playthroughId);
    expect(selfMembership.status).toBe("REMOVED");
    expect(selfMembership.removedAt).not.toBeNull();
    expect(
      (await db.taleSession.findUniqueOrThrow({ where: { id: participating.playthroughId } })).captainAccountId,
    ).toBe(accountId);
    expect((await browserJson(playerTab, `/api/play/sessions/${participating.playthroughId}`)).status).toBe(401);
    expect((await browserJson(page, `/api/captain/sessions/${participating.playthroughId}`)).status).toBe(200);

    const materialized = await materializeChronicleHistory(playerProfileId);
    expect(materialized.projectionFailures).toBe(0);
    const record = await db.playerChronicleRecord.findUniqueOrThrow({
      where: {
        playerProfileId_sourcePlaythroughId: {
          playerProfileId,
          sourcePlaythroughId: participating.playthroughId,
        },
      },
    });
    expect(record.lifecycleStatus).toBe("REMOVED");
    expect(record.completedAt).toBeNull();
    expect(
      await db.playerChronicleRecord.count({
        where: { playerProfileId, sourcePlaythroughId: captainOnly.playthroughId },
      }),
    ).toBe(0);

    const artifactSource = await db.taleSession.findUniqueOrThrow({
      where: { id: participating.playthroughId },
      select: { publishedVersionId: true },
    });
    const eligibleReceipt = resolveArtifactGrantReceipt({
      artifactDefinitionId: "helm-browser-artifact",
      playthroughId: participating.playthroughId,
      publishedVersionId: artifactSource.publishedVersionId!,
      sourceEventId: "helm-before-removal",
      sourceBlockId: null,
      occurredAt: beforeRemoval,
      configuration: { recipientPolicy: "ALL_ACTIVE_PLAYERS" },
      memberships: [asArtifactMembership(selfMembership)],
    });
    const afterRemovalReceipt = resolveArtifactGrantReceipt({
      artifactDefinitionId: "helm-browser-artifact",
      playthroughId: participating.playthroughId,
      publishedVersionId: artifactSource.publishedVersionId!,
      sourceEventId: "helm-after-removal",
      sourceBlockId: null,
      occurredAt: new Date(selfMembership.removedAt!.getTime() + 1),
      configuration: { recipientPolicy: "ALL_ACTIVE_PLAYERS" },
      memberships: [asArtifactMembership(selfMembership)],
    });
    expect(eligibleReceipt.resolvedRecipientProfileIds).toEqual([playerProfileId]);
    expect(afterRemovalReceipt.resolvedRecipientProfileIds).toEqual([]);
  } finally {
    await guest.context.close();
    await playerTab.close();
  }

  const revokedName = `Helm revoked ${suffix}`;
  const revoked = await createVoyage(page, {
    voyageName: revokedName,
    crewName: `Helm Lookout ${suffix}`,
    participation: "CAPTAIN_AND_PLAYER",
  });
  const membershipBeforeRevocation = await currentMembership(revoked.playthroughId);
  await revokeCaptainAuthority({
    voyageId: revoked.playthroughId,
    captain: { accountId, legacyGameMasterId: null },
    authorizedByAccountId: accountId,
    correlationId: `helm-browser-revoke-${suffix}`,
  });
  const membershipAfterRevocation = await currentMembership(revoked.playthroughId);
  expect(membershipAfterRevocation.id).toBe(membershipBeforeRevocation.id);
  expect(membershipAfterRevocation.status).toBe("READY");
  const revokedVoyage = await db.taleSession.findUniqueOrThrow({ where: { id: revoked.playthroughId } });
  expect(revokedVoyage.captainAccountId).toBeNull();
  expect(revokedVoyage.captainId).toBeNull();
  expect((await browserJson(page, `/api/captain/sessions/${revoked.playthroughId}`)).status).toBe(403);
  expect((await browserJson(page, `/api/play/sessions/${revoked.playthroughId}`)).status).toBe(200);
  await assertOneAccountSession(page.context(), page);

  const audits = await db.platformAuditEvent.findMany({
    where: {
      resourceId: {
        in: [
          captainOnly.playthroughId,
          participating.playthroughId,
          revoked.playthroughId,
          selfMembership.id,
          membershipBeforeRevocation.id,
        ],
      },
    },
    select: { action: true, resourceId: true },
  });
  expect(audits.some((event) => event.action === "CAPTAIN_AUTHORITY_ASSIGNED")).toBe(true);
  expect(audits.some((event) => event.action === "PLAYER_MEMBERSHIP_ADDED")).toBe(true);
  expect(audits.some((event) => event.action === "PLAYER_MEMBERSHIP_REMOVED")).toBe(true);
  expect(audits.some((event) => event.action === "CAPTAIN_AUTHORITY_REVOKED")).toBe(true);
});

test("Pass the Helm keeps authority, membership, lineage, and Player privacy distinct through the product", async ({
  browser,
  page,
}) => {
  test.setTimeout(600_000);
  await signInThroughProduct(page);

  const transferName = `Helm A2 transfer ${suffix}`;
  const holdName = `Helm A2 succession ${suffix}`;
  const direct = await createVoyage(page, {
    voyageName: transferName,
    crewName: `Helm A2 successor ${suffix}`,
    participation: "CAPTAIN_AND_PLAYER",
  });
  const held = await createVoyage(page, {
    voyageName: holdName,
    crewName: [`Helm A2 takeover one ${suffix}`, `Helm A2 takeover two ${suffix}`],
    participation: "CAPTAIN_AND_PLAYER",
  });
  const directCaptainMembership = await currentMembership(direct.playthroughId);
  const heldCaptainMembership = await currentMembership(held.playthroughId);
  const [directGuest, heldGuest, heldSecondGuest] = await Promise.all([
    acceptGuestInvitation(browser, direct.invitations[0]!.link, direct.playthroughId),
    acceptGuestInvitation(browser, held.invitations[0]!.link, held.playthroughId),
    acceptGuestInvitation(browser, held.invitations[1]!.link, held.playthroughId),
  ]);

  try {
    await test.step("A2-1 direct transfer retains the former Captain as a Player", async () => {
      await page.goto(`/captain/sessions/${direct.playthroughId}`);
      await expect(page.getByRole("heading", { name: transferName })).toBeVisible({ timeout: 30_000 });
      const transferResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/captain/playthroughs/${direct.playthroughId}/captain/transfer`) &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Transfer Captaincy" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Transfer Captaincy" }).click();
      expect((await transferResponse).status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`/player/playthroughs/${direct.playthroughId}$`, "u"), {
        timeout: 30_000,
      });

      const [source, formerCaptain, successor, receipts] = await Promise.all([
        db.taleSession.findUniqueOrThrow({ where: { id: direct.playthroughId } }),
        currentMembership(direct.playthroughId),
        db.playthroughMembership.findFirstOrThrow({
          where: { playthroughId: direct.playthroughId, id: { not: directCaptainMembership.id } },
          include: { player: true },
        }),
        db.voyageCaptainAuthorityReceipt.findMany({ where: { voyageId: direct.playthroughId } }),
      ]);
      expect(source.captainAccountId).toBe(successor.player.accountId);
      expect(formerCaptain).toMatchObject({ id: directCaptainMembership.id, status: directCaptainMembership.status });
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({ action: "CAPTAIN_TRANSFERRED", authorityState: "ASSIGNED" });
      expect((await browserJson(page, `/api/captain/sessions/${direct.playthroughId}`)).status).toBe(403);
    });

    await test.step("A2-2 relinquishment enters Succession Hold instead of cancellation", async () => {
      await page.goto(`/captain/sessions/${held.playthroughId}`);
      await expect(page.getByRole("heading", { name: holdName })).toBeVisible({ timeout: 30_000 });
      const relinquishResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/captain/playthroughs/${held.playthroughId}/captain/relinquish`) &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Relinquish Captaincy" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Relinquish Captaincy" }).click();
      expect((await relinquishResponse).status()).toBe(200);
      await expect(page.getByRole("heading", { name: "This Voyage needs a Captain" })).toBeVisible({ timeout: 30_000 });
      const source = await db.taleSession.findUniqueOrThrow({ where: { id: held.playthroughId } });
      expect(source).toMatchObject({ status: "READY", captainAccountId: null, captainAuthorityState: "VACANT" });
    });

    await test.step("A2-3 refresh restores the vacant candidate and simultaneous takeover has exactly one winner", async () => {
      const vacancy = await db.taleSession.findUniqueOrThrow({ where: { id: held.playthroughId } });
      await Promise.all([
        heldGuest.page.reload({ waitUntil: "domcontentloaded" }),
        heldSecondGuest.page.reload({ waitUntil: "domcontentloaded" }),
      ]);
      await Promise.all(
        [heldGuest.page, heldSecondGuest.page].map(async (guestPage) => {
          await expect(guestPage.getByRole("heading", { name: "This Voyage needs a Captain" })).toBeVisible({
            timeout: 30_000,
          });
          await expect(guestPage.getByRole("button", { name: "Take Captaincy" })).toBeVisible();
          await expect(guestPage.getByRole("button", { name: "Continue Solo" })).toBeVisible();
          await expect(guestPage.getByRole("button", { name: "Leave Voyage" })).toBeVisible();
          const projection = await browserJson<{
            playthrough: { captainAuthorityState: string; concurrencyVersion: number; canTakeCaptaincy: boolean };
          }>(guestPage, `/api/player/playthroughs/${held.playthroughId}`);
          expect(projection.status).toBe(200);
          expect(projection.body.playthrough).toMatchObject({
            captainAuthorityState: "VACANT",
            concurrencyVersion: vacancy.concurrencyVersion,
            canTakeCaptaincy: true,
          });
        }),
      );

      const guestPages = [heldGuest.page, heldSecondGuest.page] as const;
      const responses = guestPages.map((guestPage) =>
        guestPage.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/player/playthroughs/${held.playthroughId}/captain/takeover`) &&
            response.request().method() === "POST",
          { timeout: 30_000 },
        ),
      );
      await Promise.all(
        guestPages.map((guestPage) =>
          guestPage.getByRole("button", { name: "Take Captaincy" }).click({ noWaitAfter: true, timeout: 30_000 }),
        ),
      );
      await Promise.all(
        guestPages.map((guestPage) =>
          expect(guestPage.getByRole("dialog", { name: /Take Captaincy for/u })).toBeVisible({ timeout: 30_000 }),
        ),
      );
      await Promise.all(
        guestPages.map((guestPage) =>
          guestPage
            .getByRole("dialog", { name: /Take Captaincy for/u })
            .getByRole("button", { name: "Take Captaincy" })
            .click({ noWaitAfter: true, timeout: 30_000 }),
        ),
      );
      const outcomes = await Promise.all(responses);
      expect(outcomes.map((response) => response.status()).sort((left, right) => left - right)).toEqual([200, 409]);

      const source = await db.taleSession.findUniqueOrThrow({ where: { id: held.playthroughId } });
      const candidates = await db.playthroughMembership.findMany({
        where: { playthroughId: held.playthroughId, id: { not: heldCaptainMembership.id } },
        include: { player: true },
      });
      const takeoverReceipts = await db.voyageCaptainAuthorityReceipt.findMany({
        where: { voyageId: held.playthroughId, action: "CAPTAIN_TAKEN" },
      });
      expect(source).toMatchObject({ captainAuthorityState: "ASSIGNED" });
      expect(candidates.map((candidate) => candidate.player.accountId)).toContain(source.captainAccountId);
      expect(takeoverReceipts).toHaveLength(1);
      expect(takeoverReceipts[0]).toMatchObject({
        authorityState: "ASSIGNED",
        nextCaptainAccountId: source.captainAccountId,
      });

      const losingPage = outcomes[0]!.status() === 409 ? heldGuest.page : heldSecondGuest.page;
      await expect
        .poll(async () => {
          const refreshed = await browserJson<{
            playthrough: { captainAuthorityState: string; canTakeCaptaincy: boolean };
          }>(losingPage, `/api/player/playthroughs/${held.playthroughId}`);
          return refreshed.body.playthrough;
        })
        .toMatchObject({ captainAuthorityState: "ASSIGNED", canTakeCaptaincy: false });
      expect(await currentMembership(held.playthroughId)).toMatchObject({
        id: heldCaptainMembership.id,
        status: heldCaptainMembership.status,
      });
    });

    await test.step("A2-4 Continue Solo creates a same-edition child without changing the parent", async () => {
      await page.goto(`/player/playthroughs/${held.playthroughId}`);
      await expect(page.getByRole("button", { name: "Continue Solo" })).toBeVisible({ timeout: 30_000 });
      const before = await db.taleSession.findUniqueOrThrow({ where: { id: held.playthroughId } });
      const forkResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/player/playthroughs/${held.playthroughId}/continue-solo`) &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Continue Solo" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Create Solo Voyage" }).click();
      const response = await forkResponse;
      expect(response.status()).toBe(200);
      const result = (await response.json()) as { voyageId: string };
      const [after, child, lineage] = await Promise.all([
        db.taleSession.findUniqueOrThrow({ where: { id: held.playthroughId } }),
        db.taleSession.findUniqueOrThrow({ where: { id: result.voyageId } }),
        db.voyageForkLineage.findUniqueOrThrow({ where: { childVoyageId: result.voyageId } }),
      ]);
      expect(after).toMatchObject({
        id: before.id,
        publishedVersionId: before.publishedVersionId,
        currentSequence: before.currentSequence,
        concurrencyVersion: before.concurrencyVersion,
      });
      expect(child).toMatchObject({
        publishedVersionId: before.publishedVersionId,
        currentSequence: before.currentSequence,
        currentBlockId: before.currentBlockId,
      });
      expect(lineage).toMatchObject({ parentVoyageId: held.playthroughId, childVoyageId: result.voyageId });
    });

    await test.step("A2-5 two joined Players can fork the same committed shared Voyage independently", async () => {
      await db.taleSessionEvent.create({
        data: {
          sessionId: held.playthroughId,
          publishedVersionId: (await db.taleSession.findUniqueOrThrow({ where: { id: held.playthroughId } }))
            .publishedVersionId!,
          blockId: null,
          eventType: "privateReflection",
          sourceType: "synthetic-private-fixture",
          idempotencyKey: `helm-a2-private-${suffix}`,
          payload: "HELM_A2_PRIVATE_CANARY",
          sequence: 9_001,
        },
      });
      const [formerDetails, successorDetails] = await Promise.all([
        browserJson<{ playthrough: { concurrencyVersion: number }; csrfToken: string }>(
          page,
          `/api/player/playthroughs/${held.playthroughId}`,
        ),
        browserJson<{ playthrough: { concurrencyVersion: number }; csrfToken: string }>(
          heldGuest.page,
          `/api/player/playthroughs/${held.playthroughId}`,
        ),
      ]);
      expect(formerDetails.status).toBe(200);
      expect(successorDetails.status).toBe(200);
      const [first, second] = await Promise.all([
        browserJson<{ voyageId: string }>(page, `/api/player/playthroughs/${held.playthroughId}/continue-solo`, {
          method: "POST",
          csrf: formerDetails.body.csrfToken,
          body: {
            expectedVersion: formerDetails.body.playthrough.concurrencyVersion,
            idempotencyKey: `helm-a2-fork-a-${suffix}`,
          },
        }),
        browserJson<{ voyageId: string }>(
          heldGuest.page,
          `/api/player/playthroughs/${held.playthroughId}/continue-solo`,
          {
            method: "POST",
            csrf: successorDetails.body.csrfToken,
            body: {
              expectedVersion: successorDetails.body.playthrough.concurrencyVersion,
              idempotencyKey: `helm-a2-fork-b-${suffix}`,
            },
          },
        ),
      ]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.voyageId).not.toBe(second.body.voyageId);
      const children = await db.taleSession.findMany({
        where: { id: { in: [first.body.voyageId, second.body.voyageId] } },
      });
      expect(children).toHaveLength(2);
      const childEvents = await db.taleSessionEvent.findMany({
        where: { sessionId: { in: children.map((child) => child.id) } },
      });
      expect(JSON.stringify(childEvents)).not.toContain("HELM_A2_PRIVATE_CANARY");
    });

    await test.step("A2-6 anonymous authority, fork, and receipt access stay denied", async () => {
      const anonymous = await browser.newContext();
      try {
        const result = await anonymous.request.post(`/api/player/playthroughs/${held.playthroughId}/continue-solo`, {
          data: { expectedVersion: 0, idempotencyKey: `helm-a2-intruder-${suffix}` },
        });
        expect(result.status()).toBe(401);
        expect((await anonymous.request.get(`/api/captain/voyages/${held.playthroughId}`)).status()).toBe(403);
      } finally {
        await anonymous.close();
      }
    });
  } finally {
    await Promise.all([directGuest.context.close(), heldGuest.context.close(), heldSecondGuest.context.close()]);
  }
});

test("Captain plus Player can create and begin a zero-invite Voyage without a blank Crew record", async ({ page }) => {
  test.setTimeout(600_000);
  await signInThroughProduct(page);
  const voyageName = `Helm zero-invite ${suffix}`;
  const created = await createVoyage(page, {
    voyageName,
    crewName: [],
    participation: "CAPTAIN_AND_PLAYER",
  });

  expect(created.invitations).toEqual([]);
  expect(created.participation).toMatchObject({ participationMode: "CAPTAIN_AND_PLAYER", hasPlayerMembership: true });
  expect(
    await db.playthroughMembership.count({ where: { playthroughId: created.playthroughId, playerProfileId } }),
  ).toBe(1);
  await expect(
    voyageCard(page, voyageName, "Ready to Launch").getByText("Captain + Player", { exact: true }),
  ).toBeVisible();
});

test("authenticated membership heartbeats are independently visible in the Captain operational projection", async ({
  browser,
  page,
}) => {
  test.setTimeout(600_000);
  await signInThroughProduct(page);
  const voyageName = `Helm presence ${suffix}`;
  const created = await createVoyage(page, {
    voyageName,
    crewName: [`Helm Presence Crew A ${suffix}`, `Helm Presence Crew B ${suffix}`, `Helm Presence Crew C ${suffix}`],
    participation: "CAPTAIN_AND_PLAYER",
  });
  const captainPlayer = await page.context().newPage();
  expect(created.invitations).toHaveLength(3);
  const guests = await Promise.all(
    created.invitations.map((invitation) => acceptGuestInvitation(browser, invitation.link, created.playthroughId)),
  );
  try {
    await page.reload();
    await beginVoyage(page, voyageName);
    await captainPlayer.goto(`/player/playthroughs/${created.playthroughId}/journal`);
    await expect(captainPlayer.getByRole("main")).toBeVisible({ timeout: 30_000 });
    await Promise.all(
      guests.map((guest) =>
        expect(guest.page).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}/journal$`, "u"), {
          timeout: 30_000,
        }),
      ),
    );

    const playerPages = [captainPlayer, ...guests.map((guest) => guest.page)];
    const playerDetails = await Promise.all(
      playerPages.map((playerPage) =>
        browserJson<{ playthrough: { membershipId: string }; csrfToken: string }>(
          playerPage,
          `/api/player/playthroughs/${created.playthroughId}`,
        ),
      ),
    );
    const playerStates = await Promise.all(
      playerPages.map((playerPage) =>
        browserJson<{ session: { currentSequence: number } }>(
          playerPage,
          `/api/play/sessions/${created.playthroughId}`,
        ),
      ),
    );
    for (const details of playerDetails) expect(details.status).toBe(200);
    for (const state of playerStates) expect(state.status).toBe(200);

    const deviceIds = playerPages.map(() => randomUUID());
    const heartbeats = await Promise.all(
      playerPages.map((playerPage, index) =>
        browserJson(playerPage, `/api/player/playthroughs/${created.playthroughId}/presence`, {
          method: "POST",
          csrf: playerDetails[index]!.body.csrfToken,
          body: {
            membershipId: playerDetails[index]!.body.playthrough.membershipId,
            deviceInstanceId: deviceIds[index]!,
            acknowledgedSequence: playerStates[index]!.body.session.currentSequence,
            safeActivity: "JOURNAL",
          },
        }),
      ),
    );
    for (const heartbeat of heartbeats) expect(heartbeat.status).toBe(200);

    await expect
      .poll(
        async () => {
          const projection = await browserJson<{
            crew: Array<{ presence: { state: string }; synchronization: { state: string } }>;
          }>(page, `/api/captain/voyages/${created.playthroughId}`);
          expect(projection.status).toBe(200);
          return projection.body.crew
            .map((member) => `${member.presence.state}:${member.synchronization.state}`)
            .sort();
        },
        { timeout: 60_000 },
      )
      .toEqual([
        "CONNECTED_SYNCED:SYNCHRONIZED",
        "CONNECTED_SYNCED:SYNCHRONIZED",
        "CONNECTED_SYNCED:SYNCHRONIZED",
        "CONNECTED_SYNCED:SYNCHRONIZED",
      ]);

    const projection = await browserJson<Record<string, unknown>>(
      page,
      `/api/captain/voyages/${created.playthroughId}`,
    );
    expect(forbiddenProjectionKey(projection.body)).toBe(false);
    for (const deviceId of deviceIds) expect(JSON.stringify(projection.body)).not.toContain(deviceId);
  } finally {
    await Promise.all(guests.map((guest) => guest.context.close()));
    await captainPlayer.close();
  }
});

test("participation choice remains usable at desktop, tablet, phone, 200% zoom, keyboard, and reduced motion", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    await signInThroughProduct(page);
    await page.getByRole("button", { name: "Create a Voyage" }).first().click();
    await expect(page.getByRole("dialog", { name: "Select Chronicle" })).toBeVisible();
    const wizard = page.locator(".voyage-wizard");
    await wizard.locator(".wizard-choice-grid > button").first().click();
    await wizard.getByRole("button", { name: "Continue to Configure Voyage" }).click();
    const configurations = [
      { name: "desktop", viewport: { width: 1440, height: 1000 }, zoom: 1 },
      { name: "tablet", viewport: { width: 820, height: 1000 }, zoom: 1 },
      { name: "phone", viewport: { width: 390, height: 844 }, zoom: 1 },
      { name: "zoom", viewport: { width: 1280, height: 900 }, zoom: 2 },
    ];
    for (const configuration of configurations) {
      await test.step(configuration.name, async () => {
        await page.setViewportSize(configuration.viewport);
        await page
          .locator("html")
          .evaluate((node, zoom) => ((node as HTMLElement).style.zoom = String(zoom)), configuration.zoom);
        const captainOnly = wizard.getByRole("radio", { name: /Captain only/u });
        const captainPlayer = wizard.getByRole("radio", { name: /Captain \+ Player/u });
        await expect(wizard).toBeVisible();
        if (configuration.name === "desktop") {
          await expect(captainOnly).toBeChecked();
          await captainOnly.focus();
          await captainOnly.press("ArrowRight");
          await expect(captainPlayer).toBeChecked();
          await expect(captainPlayer).toBeFocused();
        }
        if (["desktop", "tablet", "phone"].includes(configuration.name)) {
          const touchTargets = await Promise.all([
            captainOnly.locator("xpath=..").boundingBox(),
            captainPlayer.locator("xpath=..").boundingBox(),
          ]);
          expect(touchTargets.every((box) => box && box.height >= 44 && box.width >= 44)).toBe(true);
        }
        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          const viewportWidth = root.clientWidth;
          const candidates = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
            .map((node) => {
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return {
                tag: node.tagName.toLowerCase(),
                id: node.id || null,
                className: node.className || null,
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                display: style.display,
                minWidth: style.minWidth,
                gridTemplateColumns: style.gridTemplateColumns,
              };
            })
            .filter((node) => node.right > viewportWidth + 1)
            .sort((left, right) => right.right - left.right)
            .slice(0, 12);
          return { amount: root.scrollWidth - viewportWidth, viewportWidth, scrollWidth: root.scrollWidth, candidates };
        });
        expect(overflow.amount, JSON.stringify(overflow)).toBeLessThanOrEqual(1);
        if (["desktop", "phone"].includes(configuration.name)) {
          const axe = await new AxeBuilder({ page }).analyze();
          expect(
            axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")),
          ).toEqual([]);
        }
      });
    }
  } finally {
    await context.close();
  }

  await test.step("reduced", async () => {
    const reducedContext = await browser.newContext({
      viewport: { width: 820, height: 1000 },
      reducedMotion: "reduce",
    });
    const reducedPage = await reducedContext.newPage();
    try {
      await signInThroughProduct(reducedPage);
      await reducedPage.getByRole("button", { name: "Create a Voyage" }).first().click();
      await expect(reducedPage.getByRole("dialog", { name: "Select Chronicle" })).toBeVisible();
      const reducedWizard = reducedPage.locator(".voyage-wizard");
      await reducedWizard.locator(".wizard-choice-grid > button").first().click();
      await reducedWizard.getByRole("button", { name: "Continue to Configure Voyage" }).click();
      await expect(reducedPage.locator("html")).toHaveAttribute("data-motion-level", "reduced");
      await expect(reducedWizard.locator(".wizard-step-panel")).toHaveCSS("opacity", "1");
    } finally {
      await reducedContext.close();
    }
  });
});

test("Ready the Room keeps the Captain-only, participating-Captain, and ordinary Player waiting rooms distinct", async ({
  browser,
  page,
}) => {
  test.setTimeout(600_000);
  await signInThroughProduct(page);

  const captainOnlyName = `Helm A3 captain-only ${suffix}`;
  const captainOnly = await createVoyage(page, {
    voyageName: captainOnlyName,
    crewName: [],
    participation: "CAPTAIN_ONLY",
  });
  const captainOnlyCard = voyageCard(page, captainOnlyName, "Ready to Launch");
  await Promise.all([
    page.waitForURL(new RegExp(`/captain/voyages/${captainOnly.playthroughId}/muster$`, "u")),
    captainOnlyCard.getByRole("link", { name: "Open Muster Room" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Captain-only Voyage" })).toBeVisible();
  await expect(page.getByText(/No Player membership exists yet/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "Begin Voyage" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leave Waiting Room" })).toHaveAttribute("href", "/captain/library");
  await expect(page.getByRole("button", { name: "Leave Voyage" })).toHaveCount(0);

  const captainLaunch = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/captain/playthroughs/${captainOnly.playthroughId}/launch`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Begin Voyage" }).click();
  await page
    .getByRole("dialog", { name: /Begin “Helm A3 captain-only/u })
    .getByRole("button", { name: "Begin Voyage" })
    .click();
  expect((await captainLaunch).status()).toBe(200);

  await page.goto("/captain/library");
  const sharedName = `Helm A3 shared ${suffix}`;
  const shared = await createVoyage(page, {
    voyageName: sharedName,
    crewName: [`Helm A3 guest ${suffix}`, `Helm A3 reserve ${suffix}`],
    participation: "CAPTAIN_AND_PLAYER",
  });
  await page.goto(`/player/playthroughs/${shared.playthroughId}`);
  await expect(page.getByRole("heading", { name: sharedName })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Captain review in progress")).toBeVisible();
  await expect(page.getByText("Awaiting Captain")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Begin Voyage" })).toHaveCount(0);
  await expect(page.locator('[data-captain="true"] .muster-badge-captain')).toHaveText("Captain");
  await expect(page.getByRole("button", { name: "Resend invitation" })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Leave Waiting Room" })).toHaveAttribute("href", "/player/library");
  await expect(page.getByRole("button", { name: "Leave Voyage" })).toBeVisible();

  const guests = await Promise.all(
    shared.invitations.map((invitation) => acceptGuestInvitation(browser, invitation.link, shared.playthroughId)),
  );
  try {
    const guest = guests[0]!;
    await expect(guest.page.getByRole("heading", { name: sharedName })).toBeVisible({ timeout: 30_000 });
    await expect(guest.page.getByRole("button", { name: "Leave Voyage" })).toBeVisible();
    await expect(guest.page.getByRole("link", { name: "Leave Waiting Room" })).toHaveAttribute(
      "href",
      "/player/library",
    );
    await expect(guest.page.getByRole("button", { name: "Begin Voyage" })).toHaveCount(0);

    await page.getByRole("button", { name: "Reconnect and Refresh" }).click();
    await expect(page.locator('[data-membership-status="READY"]')).toHaveCount(3, { timeout: 30_000 });
    await expect(page.getByText("Captain launch available")).toBeVisible();
    await expect(page.getByRole("button", { name: "Begin Voyage" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Transfer Captaincy" })).toHaveCount(2);

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  } finally {
    await Promise.all(guests.map((guest) => guest.context.close()));
  }
});
