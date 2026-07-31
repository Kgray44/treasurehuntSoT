import { errors, expect, test, type Page } from "@playwright/test";
import { resolveLegacyCampaign } from "../../src/compatibility/legacy-companion";
import { db } from "../../src/lib/db";

const campaignSlug = "development-forever-treasure";
const playerPath = `/tale/${campaignSlug}`;
type GmStatus = {
  csrfToken: string;
  campaign: { slug: string; status: string; sequence: number };
  chapter: { state: string };
};

type CommandName = "PREPARE_CHAPTER" | "RELEASE_CHAPTER" | "RESUME";

type CommandResult = {
  event: {
    id: string;
    type: string;
    sequence: number;
    payload: Record<string, unknown>;
  };
  persistence: string;
  delivery: string;
  correlationId: string;
};

let releasedEvent: CommandResult["event"] | undefined;

async function requireValidationIsolation(page: Page) {
  const response = await page.request.get("/api/dev/validation/database-identity");
  const body = (await response.json().catch(() => null)) as unknown;
  expect(response.status(), `Unsafe test mutation refused: ${JSON.stringify(body)}`).toBe(200);
  expect(body).toEqual({ validationDatabase: true, nonceMatch: true });
}

async function signInGm(page: Page) {
  await page.goto("/captain/sign-in");
  await page.getByLabel("Username").fill(process.env.GM_USERNAME!);
  await page.getByLabel("Password").fill(process.env.GM_PASSWORD!);
  await page.getByRole("button", { name: "Enter Captain's Console" }).click();
  await expect(page).toHaveURL(/\/captain\/library(?:\?.*)?$/u);
  await expect(page.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible();
}

async function gmStatus(page: Page) {
  const response = await page.request.get("/api/gm/status");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as GmStatus;
}

async function gmCommand(page: Page, command: CommandName) {
  const status = await gmStatus(page);
  const response = await page.request.post("/api/gm/commands", {
    headers: { "x-csrf-token": status.csrfToken },
    data: {
      command,
      campaignSlug: status.campaign.slug,
      expectedSequence: status.campaign.sequence,
      idempotencyKey: crypto.randomUUID(),
      payload: {},
      confirmation: true,
    },
  });
  const body = (await response.json()) as CommandResult & { error?: string; code?: string };
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body.persistence).toBe("COMMITTED");
  expect(body.delivery).toBe("PUBLISHED");
  return body;
}

async function restoreLockedChapter(page: Page) {
  const status = await gmStatus(page);
  if (status.campaign.status === "PAUSED") await gmCommand(page, "RESUME");
}

async function signInPlayer(page: Page) {
  await page.goto(playerPath);
  await page.getByLabel("Invitation phrase").fill(process.env.PLAYER_ACCESS_CODE!);
  const accessResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/player/access" && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirm invitation" }).click();
  const accessResponse = await accessResponsePromise;
  expect(accessResponse.status()).toBe(200);
  expect((await accessResponse.json()) as { ok?: unknown }).toEqual(expect.objectContaining({ ok: true }));
  await expect(page.locator(".voyage-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible({ timeout: 15_000 });
}

async function openJournal(page: Page, { skipOpening = true }: { skipOpening?: boolean } = {}) {
  const journal = page.locator(".chronicle-journal-shell");
  const open = page.getByRole("button", { name: "Open the journal" });
  if (await open.isVisible().catch(() => false)) await open.click();
  const skip = page.getByRole("button", { name: "Skip ceremony" });
  if (skipOpening) {
    try {
      await skip.click({ timeout: 4_000 });
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) throw error;
      if ((await skip.count()) > 0 && (await skip.isVisible())) throw error;
    }
  }
  await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: /Voyage Journal$/ })).toBeVisible({ timeout: 20_000 });
}

async function persistedMutationState() {
  const resolved = await resolveLegacyCampaign(campaignSlug);
  expect(resolved, "The validation Voyage must have a canonical TaleSession mapping.").not.toBeNull();
  const sessionId = resolved!.sessionId;
  const [session, taleSessionEvents, revealStates, platformAuditEvents] = await Promise.all([
    db.taleSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        currentSequence: true,
        currentChapterId: true,
        currentBlockId: true,
        variables: true,
        inventory: true,
        concurrencyVersion: true,
        completedAt: true,
        cancelledAt: true,
        abandonedAt: true,
      },
    }),
    db.taleSessionEvent.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        publishedVersionId: true,
        blockId: true,
        eventType: true,
        sourceType: true,
        sourceId: true,
        idempotencyKey: true,
        payload: true,
        sequence: true,
        correlationId: true,
        verificationRequestId: true,
      },
    }),
    db.revealState.findMany({
      where: { playthroughId: sessionId },
      orderBy: [{ contentType: "asc" }, { contentKey: "asc" }],
      select: {
        contentType: true,
        contentKey: true,
        status: true,
        revealedBy: true,
        revealedByAccountId: true,
      },
    }),
    db.platformAuditEvent.findMany({
      where: { resourceType: "CHRONICLE_SESSION", resourceId: sessionId },
      orderBy: { id: "asc" },
      select: {
        actorType: true,
        actorId: true,
        actorAccountId: true,
        action: true,
        outcome: true,
        correlationId: true,
        metadata: true,
      },
    }),
  ]);
  return JSON.parse(
    JSON.stringify({
      session,
      taleSessionEvents,
      revealStates,
      platformAuditEvents,
    }),
  ) as Record<string, unknown>;
}

test.describe.serial("Project Lanternwake Phase 1 presentation truth", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The isolated campaign mutation workflow runs once in Chromium; WebKit remains read-only.",
  );

  test("a missing Journal opening target settles a readable fallback without changing canonical chapter truth", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();

    try {
      await requireValidationIsolation(gm);
      await signInGm(gm);
      await restoreLockedChapter(gm);
      await player.emulateMedia({ reducedMotion: "no-preference" });
      await signInPlayer(player);
      await openJournal(player);
      await expect(player.locator("html")).toHaveAttribute("data-motion-level", "full");

      await gmCommand(gm, "PREPARE_CHAPTER");
      await player.addInitScript(() => {
        type TargetTestWindow = Window & {
          __lanternwakeMissingTargetObserver?: MutationObserver;
          __lanternwakeTargetRemovals?: number;
        };
        const state = window as TargetTestWindow;
        const removeRequiredTarget = () => {
          const target = document.querySelector<HTMLElement>("[data-scene-part='ink-story']");
          if (!target) return;
          target.remove();
          state.__lanternwakeTargetRemovals = (state.__lanternwakeTargetRemovals ?? 0) + 1;
        };
        const observer = new MutationObserver(removeRequiredTarget);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        state.__lanternwakeMissingTargetObserver = observer;
        state.__lanternwakeTargetRemovals = 0;
        removeRequiredTarget();
      });

      const release = await gmCommand(gm, "RELEASE_CHAPTER");
      expect(release.event.type).toBe("CHAPTER_RELEASED");
      releasedEvent = release.event;
      const eventId = release.event.id;
      const resolved = await resolveLegacyCampaign(campaignSlug);
      expect(resolved).not.toBeNull();
      await expect(
        db.taleSessionEvent.findUnique({
          where: { id: eventId },
          select: { id: true, eventType: true, sequence: true },
        }),
      ).resolves.toEqual({ id: eventId, eventType: "CHAPTER_RELEASED", sequence: release.event.sequence });
      expect(
        await db.platformAuditEvent.count({
          where: {
            action: "LEGACY_QUARTERMASTER_RELEASE_CHAPTER",
            resourceType: "CHRONICLE_SESSION",
            resourceId: resolved!.sessionId,
            correlationId: release.correlationId,
          },
        }),
      ).toBe(1);
      // The canonical player reconciles authoritative event history on reload.
      // The probe removes the actual Journal opening target, rather than a
      // retired PlayerExperience ceremony target, so this exercises the
      // current readable opening fallback.
      await player.reload();
      await openJournal(player, { skipOpening: false });
      const journal = player.locator(".chronicle-journal-shell");
      await expect(journal).toHaveAttribute("data-journal-opening-outcome", "failure");
      await expect(player.getByText("The animated opening could not finish.")).toBeVisible();
      expect(await db.viewedCeremony.count({ where: { eventId } })).toBe(0);

      const replayShortOpening = player.getByRole("button", { name: "Replay short opening" });
      await expect(replayShortOpening).toBeVisible();
      await replayShortOpening.click();
      await openJournal(player, { skipOpening: false });
      await expect(journal).toHaveAttribute("data-journal-opening-outcome", "failure");
      await expect(replayShortOpening).toBeVisible();
      expect(await db.viewedCeremony.count({ where: { eventId } })).toBe(0);
    } finally {
      await player
        .evaluate(() => {
          (
            window as Window & { __lanternwakeMissingTargetObserver?: MutationObserver }
          ).__lanternwakeMissingTargetObserver?.disconnect();
        })
        .catch(() => undefined);
      await Promise.all([playerContext.close(), gmContext.close()]);
    }
  });

  test("canonical Journal opening replays and refreshes without mutating session or audit truth", async ({ page }) => {
    test.setTimeout(120_000);
    expect(releasedEvent, "The serial presentation-truth case must publish the release first.").toBeDefined();
    const event = releasedEvent!;

    await requireValidationIsolation(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInPlayer(page);
    await openJournal(page, { skipOpening: false });
    await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
    await expect(page.locator(".chronicle-journal-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");

    const beforeReplay = await persistedMutationState();
    const replayShortOpening = page.getByRole("button", { name: "Replay short opening" });
    await replayShortOpening.click();
    await openJournal(page, { skipOpening: false });
    expect(await persistedMutationState()).toEqual(beforeReplay);

    await page.reload();
    await openJournal(page, { skipOpening: false });
    await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
    await page.getByRole("button", { name: "Replay short opening" }).click();
    await openJournal(page, { skipOpening: false });
    expect(await persistedMutationState()).toEqual(beforeReplay);
    await expect(page.getByRole("heading", { name: /Voyage Journal$/ })).toBeVisible();
    expect(await db.taleSessionEvent.count({ where: { id: event.id, eventType: "CHAPTER_RELEASED" } })).toBe(1);
  });
});
