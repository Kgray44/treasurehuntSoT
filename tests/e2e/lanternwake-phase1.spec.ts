import { expect, test, type Page, type Request } from "@playwright/test";
import { db } from "../../src/lib/db";

const campaignSlug = "development-forever-treasure";
const playerPath = `/tale/${campaignSlug}`;
const clientUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GmStatus = {
  csrfToken: string;
  campaign: { slug: string; status: string; sequence: number };
  chapter: { state: string };
};

type CommandName = "PREPARE_CHAPTER" | "RELEASE_CHAPTER" | "RESUME" | "UNDO_LAST";

type CommandResult = {
  event: {
    id: string;
    type: string;
    sequence: number;
    payload: Record<string, unknown>;
  };
  persistence: string;
  delivery: string;
};

type ReplaySnapshot = {
  unseen?: { journal: number };
  latestChapterReleasePresentation?: {
    eventId: string;
    eventType: string;
    sequence: number;
    occurredAt: string;
    sceneName: string;
    payloadVersion: number;
    payload: {
      ordinal: number;
      title: string;
      narrative: string;
      objective: string;
      riddle: string;
    };
    replayPolicy: string;
  };
};

let releasedEvent: CommandResult["event"] | undefined;

type UnsafeApiRequest = {
  method: string;
  pathname: string;
};

type UnsafeApiMonitor = {
  inFlight: Set<Request>;
  begin: (label: string) => void;
  end: (label: string) => UnsafeApiRequest[];
  dispose: () => void;
};

async function requireValidationIsolation(page: Page) {
  const response = await page.request.get("/api/dev/validation/database-identity");
  const body = (await response.json().catch(() => null)) as unknown;
  expect(response.status(), `Unsafe test mutation refused: ${JSON.stringify(body)}`).toBe(200);
  expect(body).toEqual({ validationDatabase: true, nonceMatch: true });
}

async function signInGm(page: Page) {
  await page.goto("/quartermaster");
  await page.getByLabel("Captain's name").fill(process.env.GM_USERNAME!);
  await page.getByLabel("Passphrase").fill(process.env.GM_PASSWORD!);
  await page.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(page.getByRole("heading", { name: "The Forever Treasure" })).toBeVisible();
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
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const status = await gmStatus(page);
    if (["LOCKED", "TEASER"].includes(status.chapter.state)) {
      if (status.campaign.status === "PAUSED") await gmCommand(page, "RESUME");
      return;
    }
    await gmCommand(page, "UNDO_LAST");
  }
  throw new Error("The isolated validation campaign could not be restored to a locked chapter.");
}

async function signInPlayer(page: Page) {
  await page.goto(playerPath);
  await page.getByLabel("Invitation phrase").fill(process.env.PLAYER_ACCESS_CODE!);
  await page.getByRole("button", { name: "Open the journal" }).click();
  await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible({ timeout: 15_000 });
}

async function openJournal(page: Page) {
  await page.getByRole("button", { name: "Open the journal" }).click();
  const skip = page.getByRole("button", { name: "Skip ceremony" });
  await skip.waitFor({ state: "visible", timeout: 4_000 }).catch(() => undefined);
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByRole("heading", { name: "The Voyage Journal" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Tide connected")).toBeVisible({ timeout: 20_000 });
}

async function waitForJournalViewedState(page: Page) {
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/player/${campaignSlug}/snapshot`);
      if (!response.ok()) return undefined;
      return ((await response.json()) as ReplaySnapshot).unseen?.journal;
    })
    .toBe(0);
}

async function persistedMutationState() {
  const campaign = await db.campaign.findUnique({ where: { slug: campaignSlug }, select: { id: true } });
  expect(campaign, "The validation campaign must exist before replay evidence is collected.").not.toBeNull();
  const campaignId = campaign!.id;
  const [
    progressEvents,
    campaignSnapshots,
    viewedCeremonies,
    viewedContent,
    commandExecutions,
    adminAuditLogs,
    taleSessionEvents,
    playerAccesses,
    playerPresences,
    audioPreferences,
  ] = await Promise.all([
    db.progressEvent.findMany({ where: { campaignId }, orderBy: { id: "asc" } }),
    db.campaignSnapshot.findMany({ where: { campaignId }, orderBy: { id: "asc" } }),
    db.viewedCeremony.findMany({ where: { campaignId }, orderBy: { id: "asc" } }),
    db.viewedContent.findMany({
      where: { playerAccess: { campaignId } },
      orderBy: { id: "asc" },
    }),
    db.commandExecution.findMany({ where: { campaignId }, orderBy: { id: "asc" } }),
    db.adminAuditLog.findMany({ where: { campaignId }, orderBy: { id: "asc" } }),
    db.taleSessionEvent.findMany({ orderBy: { id: "asc" } }),
    db.playerAccess.findMany({
      where: { campaignId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        campaignId: true,
        label: true,
        expiresAt: true,
        lastSeenAt: true,
        createdAt: true,
      },
    }),
    db.playerPresence.findMany({ where: { campaignId }, orderBy: { id: "asc" } }),
    db.audioPreference.findMany({
      where: { playerAccess: { campaignId } },
      orderBy: { id: "asc" },
    }),
  ]);
  return JSON.parse(
    JSON.stringify({
      progressEvents,
      campaignSnapshots,
      viewedCeremonies,
      viewedContent,
      commandExecutions,
      adminAuditLogs,
      taleSessionEvents,
      playerAccesses,
      playerPresences,
      audioPreferences,
    }),
  ) as Record<string, unknown>;
}

function unsafeApiRequest(request: Request): UnsafeApiRequest | undefined {
  const method = request.method().toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  const { pathname } = new URL(request.url());
  if (!pathname.startsWith("/api/")) return undefined;
  return { method, pathname };
}

function observeUnsafeApiRequests(page: Page): UnsafeApiMonitor {
  const inFlight = new Set<Request>();
  const requestsByLabel = new Map<string, UnsafeApiRequest[]>();
  let activeLabel: string | undefined;
  const onRequest = (request: Request) => {
    const unsafe = unsafeApiRequest(request);
    if (!unsafe) return;
    inFlight.add(request);
    if (activeLabel) requestsByLabel.get(activeLabel)?.push(unsafe);
  };
  const onSettled = (request: Request) => inFlight.delete(request);
  page.on("request", onRequest);
  page.on("requestfinished", onSettled);
  page.on("requestfailed", onSettled);
  return {
    inFlight,
    begin(label) {
      expect(activeLabel, "Replay mutation-capture windows must not overlap.").toBeUndefined();
      expect(inFlight.size, "Replay must begin without an earlier unsafe API request in flight.").toBe(0);
      requestsByLabel.set(label, []);
      activeLabel = label;
    },
    end(label) {
      expect(activeLabel).toBe(label);
      activeLabel = undefined;
      return requestsByLabel.get(label) ?? [];
    },
    dispose() {
      page.off("request", onRequest);
      page.off("requestfinished", onSettled);
      page.off("requestfailed", onSettled);
    },
  };
}

async function waitForUnsafeApiQuiescence(page: Page, monitor: UnsafeApiMonitor) {
  await expect
    .poll(async () => {
      if (monitor.inFlight.size > 0) return monitor.inFlight.size;
      await page.waitForTimeout(125);
      return monitor.inFlight.size;
    })
    .toBe(0);
}

async function installReplayObserver(page: Page) {
  await page.evaluate(() => {
    type ReplayTestWindow = Window & {
      __lanternwakeReplayClasses?: string[];
      __lanternwakeReplayObserver?: MutationObserver;
    };
    const state = window as ReplayTestWindow;
    state.__lanternwakeReplayObserver?.disconnect();
    const host = document.querySelector<HTMLElement>(".voyage-shell");
    state.__lanternwakeReplayClasses = [];
    const observer = new MutationObserver(() => {
      if (host) state.__lanternwakeReplayClasses?.push(host.className);
    });
    if (host) observer.observe(host, { attributes: true, attributeFilter: ["class"] });
    state.__lanternwakeReplayObserver = observer;
  });
}

async function replayStartCount(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & { __lanternwakeReplayClasses?: string[] }).__lanternwakeReplayClasses?.filter((value) =>
        value.includes("stage-scene-start"),
      ).length ?? 0,
  );
}

async function expectMutationFreeReplay(page: Page, monitor: UnsafeApiMonitor, label: string) {
  await waitForUnsafeApiQuiescence(page, monitor);
  const beforeState = await persistedMutationState();
  const startsBefore = await replayStartCount(page);
  const replay = page.getByRole("button", { name: "Replay ceremony" });
  await expect(replay).toBeVisible();

  monitor.begin(label);
  await replay.click();
  await expect.poll(() => replayStartCount(page)).toBeGreaterThan(startsBefore);
  await expect(page.locator(".voyage-shell")).toHaveClass(/stage-idle/);
  await expect(replay).toBeVisible();
  await waitForUnsafeApiQuiescence(page, monitor);
  const unsafeRequests = monitor.end(label);
  const afterState = await persistedMutationState();

  expect(unsafeRequests, `${label} issued an unsafe API request.`).toEqual([]);
  expect(afterState, `${label} changed persisted presentation, presence, access, or session truth.`).toEqual(
    beforeState,
  );
}

function isCeremonyAcknowledgment(request: Request, eventId: string) {
  if (request.method() !== "POST" || !request.url().endsWith(`/api/player/${campaignSlug}/viewed`)) return false;
  try {
    const payload = request.postDataJSON() as { eventId?: unknown };
    return payload.eventId === eventId;
  } catch {
    return false;
  }
}

test.describe.serial("Project Lanternwake Phase 1 presentation truth", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The isolated campaign mutation workflow runs once in Chromium; WebKit remains read-only.",
  );

  test("missing required chapter target remains unviewed and retryable; reduced readable fallback views once", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
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
      await player.evaluate(() => {
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
      await expect(
        db.progressEvent.findUnique({ where: { id: eventId }, select: { id: true, type: true, sequence: true } }),
      ).resolves.toEqual({ id: eventId, type: "CHAPTER_RELEASED", sequence: release.event.sequence });
      expect(
        await db.adminAuditLog.count({
          where: { action: "RELEASE_CHAPTER", metadata: { contains: eventId } },
        }),
      ).toBe(1);
      const acknowledgmentRequests: string[] = [];
      player.on("request", (request) => {
        if (isCeremonyAcknowledgment(request, eventId)) acknowledgmentRequests.push(eventId);
      });

      const retry = player.getByRole("button", { name: "Retry ceremony" });
      const retryAlert = player.getByRole("alert").filter({ has: retry });
      await expect(retry).toBeVisible({ timeout: 15_000 });
      await expect(retryAlert).toHaveCount(1);
      await expect(retryAlert).toContainText("could not be completed");
      await expect(retryAlert.locator("code")).toContainText("outcome=missing-required-target");
      expect(
        await player.evaluate(
          () => (window as Window & { __lanternwakeTargetRemovals?: number }).__lanternwakeTargetRemovals,
        ),
      ).toBeGreaterThan(0);
      expect(acknowledgmentRequests).toHaveLength(0);
      expect(await db.viewedCeremony.count({ where: { eventId } })).toBe(0);

      await player.emulateMedia({ reducedMotion: "reduce" });
      await expect(player.locator("html")).toHaveAttribute("data-motion-level", "reduced");
      const snapshotResponse = await player.request.get(`/api/player/${campaignSlug}/snapshot`);
      expect(snapshotResponse.ok()).toBeTruthy();
      const presentation = ((await snapshotResponse.json()) as ReplaySnapshot).latestChapterReleasePresentation;
      expect(presentation).toMatchObject({
        eventId,
        eventType: "CHAPTER_RELEASED",
        sceneName: "chapter-release",
        replayPolicy: "presentation-only",
      });
      await retry.click();
      const fallback = player.locator("[data-chapter-readable-fallback]");
      await expect(fallback).toHaveAttribute("data-event-id", eventId);
      await expect(fallback).toContainText(presentation!.payload.title);
      await expect(fallback).toContainText(presentation!.payload.objective);
      await expect(retry).toBeHidden();
      await expect(player.getByRole("button", { name: "Replay ceremony" })).toBeVisible();
      expect(acknowledgmentRequests).toEqual([eventId]);
      expect(await db.viewedCeremony.count({ where: { eventId } })).toBe(1);
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

  test("persisted chapter replay survives refresh and performs no unsafe API or persisted mutation", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(releasedEvent, "The serial presentation-truth case must publish the release first.").toBeDefined();
    const event = releasedEvent!;

    await requireValidationIsolation(page);
    const unsafeApiMonitor = observeUnsafeApiRequests(page);

    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await signInPlayer(page);
      await openJournal(page);
      await waitForJournalViewedState(page);
      await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
      const replayDeviceId = await page.evaluate(() => localStorage.getItem("forever-device"));
      expect(replayDeviceId).toMatch(clientUuidPattern);
      await expect
        .poll(() =>
          db.viewedCeremony.count({
            where: { eventId: event.id, deviceId: replayDeviceId! },
          }),
        )
        .toBe(1);
      const viewedCeremoniesBeforeReplay = await db.viewedCeremony.findMany({
        where: { eventId: event.id },
        orderBy: { id: "asc" },
      });
      expect(viewedCeremoniesBeforeReplay.length).toBeGreaterThan(0);

      const beforeSnapshotResponse = await page.request.get(`/api/player/${campaignSlug}/snapshot`);
      expect(beforeSnapshotResponse.ok()).toBeTruthy();
      const beforeSnapshot = (await beforeSnapshotResponse.json()) as ReplaySnapshot;
      expect(beforeSnapshot.latestChapterReleasePresentation).toMatchObject({
        eventId: event.id,
        eventType: "CHAPTER_RELEASED",
        sceneName: "chapter-release",
        replayPolicy: "presentation-only",
      });
      const immutablePresentation = structuredClone(beforeSnapshot.latestChapterReleasePresentation);

      await installReplayObserver(page);
      await expectMutationFreeReplay(page, unsafeApiMonitor, "initial replay");

      await page.reload();
      await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible();
      await openJournal(page);
      await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
      await installReplayObserver(page);
      await expectMutationFreeReplay(page, unsafeApiMonitor, "replay after refresh");
      await expectMutationFreeReplay(page, unsafeApiMonitor, "second replay after refresh");

      const resolvedMotionBefore = await page.locator("html").getAttribute("data-motion-level");
      expect(resolvedMotionBefore).toBe("reduced");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect(page.locator("html")).toHaveAttribute("data-motion-level", "full");
      expect(await page.locator("html").getAttribute("data-motion-level")).not.toBe(resolvedMotionBefore);
      await expectMutationFreeReplay(page, unsafeApiMonitor, "replay after resolved motion change");

      expect(await db.viewedCeremony.findMany({ where: { eventId: event.id }, orderBy: { id: "asc" } })).toEqual(
        viewedCeremoniesBeforeReplay,
      );

      const afterSnapshotResponse = await page.request.get(`/api/player/${campaignSlug}/snapshot`);
      expect(afterSnapshotResponse.ok()).toBeTruthy();
      const afterSnapshot = (await afterSnapshotResponse.json()) as ReplaySnapshot;
      expect(afterSnapshot.latestChapterReleasePresentation).toEqual(immutablePresentation);
      await expect(page.getByRole("heading", { name: immutablePresentation!.payload.title }).first()).toBeVisible();
    } finally {
      unsafeApiMonitor.dispose();
      await page
        .evaluate(() => {
          (
            window as Window & { __lanternwakeReplayObserver?: MutationObserver }
          ).__lanternwakeReplayObserver?.disconnect();
        })
        .catch(() => undefined);
    }
  });
});
