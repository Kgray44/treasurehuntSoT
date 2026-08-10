import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
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
  expect(await db.publishedTaleVersion.count()).toBeGreaterThan(0);
});

test.afterAll(async () => db.$disconnect());

async function signInThroughProduct(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip opening presentation" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const menu = await accountMenu(page, "Account");
  const signIn = menu.getByRole("link", { name: "Sign In", exact: true });
  if (await signIn.isVisible().catch(() => false)) await signIn.click();
  else await page.goto("/sign-in");
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
  await menu.getByRole("link", { name: "All Workspaces", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Workspaces" })).toBeVisible();
  await page.getByRole("link", { name: "Enter Captain" }).click();
  await expect(page).toHaveURL(/\/captain\/library$/u);
  await expect(page.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible();
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
  input: { voyageName: string; crewName: string; participation: "CAPTAIN_ONLY" | "CAPTAIN_AND_PLAYER" },
) {
  await page.getByRole("button", { name: "Create a Voyage" }).first().click();
  await expect(page.getByRole("dialog", { name: "Select Chronicle" })).toBeVisible();
  const wizard = page.locator(".voyage-wizard");
  await wizard.locator(".wizard-choice-grid > button").first().click();
  await wizard.getByRole("button", { name: "Continue to Configure Voyage" }).click();
  const captainOnly = wizard.getByRole("radio", { name: /Captain only/u });
  const captainPlayer = wizard.getByRole("radio", { name: /Captain \+ Player/u });
  await expect(captainOnly).toBeChecked();
  if (input.participation === "CAPTAIN_AND_PLAYER") await captainPlayer.check();
  await wizard.getByLabel("Voyage name").fill(input.voyageName);
  await wizard.getByRole("button", { name: "Continue to Add Crew" }).click();
  await wizard.getByLabel("Crew member name").fill(input.crewName);
  await wizard.getByRole("button", { name: "Continue to Invitation access" }).click();
  await wizard.getByRole("button", { name: "Continue to Delivery" }).click();
  await wizard.getByRole("button", { name: "Continue to Review" }).click();
  await expect(
    wizard.getByText(input.participation === "CAPTAIN_AND_PLAYER" ? "Captain + Player" : "Captain only", {
      exact: true,
    }),
  ).toBeVisible();
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/captain/playthroughs") && response.request().method() === "POST",
  );
  await wizard.getByRole("button", { name: "Create Voyage and invitations" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const created = (await response.json()) as CreatedVoyage;
  expect(created.participation.participationMode).toBe(input.participation);
  expect(created.participation.hasPlayerMembership).toBe(input.participation === "CAPTAIN_AND_PLAYER");
  await expect(wizard.getByRole("heading", { name: input.crewName })).toBeVisible();
  await wizard.getByRole("button", { name: "Done" }).click();
  await expect(voyageCard(page, input.voyageName, "Ready to Launch")).toBeVisible();
  return created;
}

async function acceptGuestInvitation(browser: Browser, link: string) {
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
  const response = page.waitForResponse(
    (candidate) => candidate.url().endsWith("/api/invitations/accept") && candidate.request().method() === "POST",
  );
  await accept.click({ noWaitAfter: true });
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/player\/playthroughs\//u);
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
  expect((await responsePromise).status()).toBe(200);
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

  const guest = await acceptGuestInvitation(browser, participating.invitations[0]!.link);
  try {
    await page.reload();
    await beginVoyage(page, participatingName);
    await expect.poll(async () => (await currentMembership(participating.playthroughId)).status).toBe("ACTIVE_MEMBER");
    await playerTab.bringToFront();
    await expect(playerTab).toHaveURL(new RegExp(`/player/playthroughs/${participating.playthroughId}/journal$`, "u"));
    await guest.page.bringToFront();
    await expect(guest.page).toHaveURL(new RegExp(`/player/playthroughs/${participating.playthroughId}/journal$`, "u"));
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
    await page.getByRole("dialog").getByRole("button", { name: "Stop Player participation" }).click();
    await expect(page.getByText("Player participation ended. Your Captain authority remains active.")).toBeVisible();
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

test("participation choice remains usable at desktop, tablet, phone, 200% zoom, keyboard, and reduced motion", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email or legacy Player name").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: displayName, exact: true })).toBeVisible();
    await enterCaptain(page);
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
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
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
      await reducedPage.goto("/sign-in");
      await reducedPage.getByLabel("Email or legacy Player name").fill(email);
      await reducedPage.getByLabel("Password").fill(password);
      await reducedPage.getByRole("button", { name: "Continue" }).click();
      await expect(reducedPage.getByRole("button", { name: displayName, exact: true })).toBeVisible();
      await enterCaptain(reducedPage);
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
