import { expect, test, type APIResponse, type BrowserContext, type Page } from "@playwright/test";

type JournalProbe = {
  documentToken: string;
  activeAnimationListeners: number;
  activeJournalKeydownListeners: number;
  activeEventSources: number;
  activeRequests: number;
  peakAnimationListeners: number;
  peakEventSources: number;
  journalDisconnectedAt: number | null;
  lifecycleCleanupMs: number | null;
};

type CaptainLibrary = {
  publishedTales: Array<{
    id: string;
    title: string;
    versions: Array<{ id: string; label: string }>;
  }>;
};

type CreatedVoyage = {
  playthroughId: string;
  invitations: Array<{ link: string }>;
};

type PlayerCookies = Awaited<ReturnType<BrowserContext["cookies"]>>;

let journalPath = "";
let journalUrl = "";
let playerCookies: PlayerCookies = [];

async function expectOk(response: APIResponse) {
  const body = await response.text();
  expect(response.ok(), `${response.url()} returned ${response.status()}: ${body}`).toBeTruthy();
  return body;
}

async function expectValidationIsolation(response: APIResponse) {
  const body = await response.text();
  expect(
    response.status(),
    `Refusing database mutation because ${response.url()} returned ${response.status()}: ${body}`,
  ).toBe(200);
  expect(JSON.parse(body)).toEqual({ validationDatabase: true, nonceMatch: true });
}

async function installJournalProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: JournalProbe = {
      documentToken: crypto.randomUUID(),
      activeAnimationListeners: 0,
      activeJournalKeydownListeners: 0,
      activeEventSources: 0,
      activeRequests: 0,
      peakAnimationListeners: 0,
      peakEventSources: 0,
      journalDisconnectedAt: null,
      lifecycleCleanupMs: null,
    };
    Object.defineProperty(window, "__lanternwakeJournalProbe", { value: probe, configurable: true });

    type TrackedListenerType = "animation" | "journal-keydown";
    type TrackedRegistration = {
      kind: TrackedListenerType;
      wrapped: EventListener;
      removed: boolean;
      signal: AbortSignal | null;
      abortHandler: EventListener | null;
    };
    const registrations = new WeakMap<
      EventTarget,
      Map<string, Map<EventListenerOrEventListenerObject, Map<boolean, TrackedRegistration>>>
    >();
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    let journalUnmountObserver: MutationObserver | null = null;

    const trackedType = (target: EventTarget, type: string): TrackedListenerType | null => {
      if ((type === "finish" || type === "cancel") && target instanceof Animation) {
        const effect = target.effect as (AnimationEffect & { target?: Element | null }) | null;
        const effectTarget = effect && "target" in effect ? effect.target : null;
        if (effectTarget instanceof Element && effectTarget.closest(".tall-tale-journal-shell")) return "animation";
      }
      if (type === "keydown" && target instanceof Element && target.closest(".tall-tale-journal-shell")) {
        return "journal-keydown";
      }
      return null;
    };
    const invalidateLifecycleCleanup = () => {
      if (probe.journalDisconnectedAt !== null) probe.lifecycleCleanupMs = null;
    };
    const maybeRecordLifecycleCleanup = () => {
      if (
        probe.journalDisconnectedAt !== null &&
        probe.activeAnimationListeners === 0 &&
        probe.activeJournalKeydownListeners === 0 &&
        probe.activeEventSources === 0 &&
        probe.activeRequests === 0 &&
        probe.lifecycleCleanupMs === null
      ) {
        probe.lifecycleCleanupMs = performance.now() - probe.journalDisconnectedAt;
      }
    };
    Object.defineProperty(window, "__armLanternwakeJournalUnmountProbe", {
      configurable: true,
      value: () => {
        const capturedRoot = document.querySelector(".tall-tale-journal-shell");
        if (!(capturedRoot instanceof Element) || !capturedRoot.isConnected) {
          throw new Error("Cannot arm Journal unmount measurement without a connected Journal root.");
        }
        journalUnmountObserver?.disconnect();
        probe.journalDisconnectedAt = null;
        probe.lifecycleCleanupMs = null;
        journalUnmountObserver = new MutationObserver(() => {
          if (capturedRoot.isConnected) return;
          journalUnmountObserver?.disconnect();
          journalUnmountObserver = null;
          probe.journalDisconnectedAt = performance.now();
          maybeRecordLifecycleCleanup();
        });
        journalUnmountObserver.observe(document.documentElement, { childList: true, subtree: true });
      },
    });
    const changeListenerCount = (kind: TrackedListenerType, delta: number) => {
      if (delta > 0) invalidateLifecycleCleanup();
      if (kind === "animation") {
        probe.activeAnimationListeners = Math.max(0, probe.activeAnimationListeners + delta);
        probe.peakAnimationListeners = Math.max(probe.peakAnimationListeners, probe.activeAnimationListeners);
      } else {
        probe.activeJournalKeydownListeners = Math.max(0, probe.activeJournalKeydownListeners + delta);
      }
      maybeRecordLifecycleCleanup();
    };

    const captureOf = (options?: boolean | AddEventListenerOptions | EventListenerOptions) =>
      typeof options === "boolean" ? options : Boolean(options?.capture);

    const findRegistration = (
      target: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      capture: boolean,
    ) => registrations.get(target)?.get(type)?.get(listener)?.get(capture);

    const releaseRegistration = (
      target: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      capture: boolean,
    ) => {
      const byType = registrations.get(target);
      const byListener = byType?.get(type);
      const byCapture = byListener?.get(listener);
      const registration = byCapture?.get(capture);
      if (!registration || registration.removed) return null;

      registration.removed = true;
      byCapture!.delete(capture);
      if (byCapture!.size === 0) byListener!.delete(listener);
      if (byListener!.size === 0) byType!.delete(type);
      if (registration.signal && registration.abortHandler) {
        nativeRemove.call(registration.signal, "abort", registration.abortHandler);
      }
      changeListenerCount(registration.kind, -1);
      return registration;
    };

    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      const kind = trackedType(this, type);
      if (kind && listener && !(typeof options === "object" && options.signal?.aborted)) {
        const capture = captureOf(options);
        const existing = findRegistration(this, type, listener, capture);
        if (existing) {
          nativeAdd.call(this, type, existing.wrapped, options);
          return;
        }

        let byType = registrations.get(this);
        if (!byType) {
          byType = new Map();
          registrations.set(this, byType);
        }
        let byListener = byType.get(type);
        if (!byListener) {
          byListener = new Map();
          byType.set(type, byListener);
        }
        let byCapture = byListener.get(listener);
        if (!byCapture) {
          byCapture = new Map();
          byListener.set(listener, byCapture);
        }

        const once = typeof options === "object" && Boolean(options.once);
        const signal = typeof options === "object" ? (options.signal ?? null) : null;
        const wrapped: EventListener = (event) => {
          try {
            if (typeof listener === "function") listener.call(this, event);
            else listener.handleEvent(event);
          } finally {
            if (once) releaseRegistration(this, type, listener, capture);
          }
        };
        const registration: TrackedRegistration = {
          kind,
          wrapped,
          removed: false,
          signal,
          abortHandler: null,
        };
        byCapture.set(capture, registration);
        changeListenerCount(kind, 1);

        try {
          nativeAdd.call(this, type, wrapped, options);
          if (signal) {
            const abortHandler: EventListener = () => {
              releaseRegistration(this, type, listener, capture);
            };
            registration.abortHandler = abortHandler;
            nativeAdd.call(signal, "abort", abortHandler, { once: true });
          }
        } catch (cause) {
          releaseRegistration(this, type, listener, capture);
          throw cause;
        }
        return;
      }
      nativeAdd.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      const kind = trackedType(this, type);
      if (kind && listener) {
        const registration = releaseRegistration(this, type, listener, captureOf(options));
        if (registration) {
          nativeRemove.call(this, type, registration.wrapped, options);
          return;
        }
      }
      nativeRemove.call(this, type, listener, options);
    };

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (...args: Parameters<typeof fetch>) => {
      probe.activeRequests += 1;
      invalidateLifecycleCleanup();
      const releaseRequest = () => {
        probe.activeRequests = Math.max(0, probe.activeRequests - 1);
        maybeRecordLifecycleCleanup();
      };
      try {
        return nativeFetch(...args).finally(releaseRequest);
      } catch (cause) {
        releaseRequest();
        throw cause;
      }
    };

    const NativeEventSource = window.EventSource;
    window.EventSource = new Proxy(NativeEventSource, {
      construct(target, args) {
        const source = Reflect.construct(target, args) as EventSource;
        const nativeClose = source.close.bind(source);
        let closed = false;
        probe.activeEventSources += 1;
        invalidateLifecycleCleanup();
        probe.peakEventSources = Math.max(probe.peakEventSources, probe.activeEventSources);
        Object.defineProperty(source, "close", {
          value: () => {
            if (!closed) {
              closed = true;
              probe.activeEventSources = Math.max(0, probe.activeEventSources - 1);
              maybeRecordLifecycleCleanup();
            }
            nativeClose();
          },
        });
        return source;
      },
    });
  });
}

async function readProbe(page: Page) {
  return page.evaluate(() =>
    structuredClone(
      (
        window as unknown as Window & {
          __lanternwakeJournalProbe: JournalProbe;
        }
      ).__lanternwakeJournalProbe,
    ),
  );
}

async function armJournalUnmountProbe(page: Page) {
  await page.evaluate(() => {
    (
      window as unknown as Window & {
        __armLanternwakeJournalUnmountProbe: () => void;
      }
    ).__armLanternwakeJournalUnmountProbe();
  });
}

async function leaveJournalForLibrary(page: Page, documentToken: string) {
  await armJournalUnmountProbe(page);
  await page.getByRole("link", { name: /Tall Tale Library/ }).click();
  await expect(page).toHaveURL(/\/player\/library$/);
  await expect(page.getByRole("heading", { name: "My Tall Tale Library" })).toBeVisible();
  await expect
    .poll(async () => {
      const probe = await readProbe(page);
      return {
        listeners: probe.activeAnimationListeners + probe.activeJournalKeydownListeners,
        sources: probe.activeEventSources,
        requests: probe.activeRequests,
      };
    })
    .toEqual({ listeners: 0, sources: 0, requests: 0 });

  const released = await readProbe(page);
  expect(released.documentToken, "The Journal must unmount through same-document product navigation.").toBe(
    documentToken,
  );
  expect(released.journalDisconnectedAt).not.toBeNull();
  expect(released.lifecycleCleanupMs).not.toBeNull();
  expect(released.lifecycleCleanupMs!).toBeLessThan(250);
  return released;
}

async function returnToJournalFromLibrary(page: Page, documentToken: string) {
  const journalLink = page.locator(`a[href="${journalPath}"]`).first();
  await expect(journalLink).toBeVisible();
  await expect(journalLink).toHaveAccessibleName("Continue Adventure");
  await journalLink.click();
  await expect(page).toHaveURL(new RegExp(`${journalPath}$`));
  await expect(page.locator(".tall-tale-journal-shell")).toBeVisible();
  expect((await readProbe(page)).documentToken, "The Journal must remount without replacing the document.").toBe(
    documentToken,
  );
}

async function expectReadyFinalPose(page: Page) {
  const shell = page.locator(".tall-tale-journal-shell");
  await expect(shell).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
  await expect(page.locator(".open-page-stage")).toBeVisible();
  await expect(page.locator(".closed-book")).toBeHidden();
  await expect(page.locator(".main-journal-book")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next journal page" })).toBeEnabled();
}

async function startOpeningAtFinitePhase(page: Page) {
  await page.getByRole("button", { name: "Open the journal" }).click();
  await expect(page.locator(".tall-tale-journal-shell")).toHaveAttribute("data-journal-phase", "CLOSED_BOOK_REVEAL");
  await expect.poll(async () => (await readProbe(page)).activeAnimationListeners).toBeGreaterThan(0);
}

test.describe.serial("Project Lanternwake Journal browser lifecycle", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The unique voyage fixture mutates the isolated validation database once in Chromium; WebKit is explicitly skipped.",
  );

  test.beforeAll(async ({ browser, browserName, baseURL }) => {
    if (browserName !== "chromium") return;
    expect(baseURL, "Playwright must provide its isolated base URL.").toBeTruthy();
    const captainContext = await browser.newContext({ baseURL });
    const playerContext = await browser.newContext({ baseURL });
    const captain = captainContext.request;
    const playerPage = await playerContext.newPage();

    try {
      await expectValidationIsolation(await captain.get("/api/dev/validation/database-identity"));

      const loginBody = await expectOk(
        await captain.post("/api/gm/login", {
          data: {
            username: process.env.GM_USERNAME ?? "kato",
            password: process.env.GM_PASSWORD ?? "development-captain-only",
          },
        }),
      );
      const { csrfToken } = JSON.parse(loginBody) as { csrfToken: string };
      const libraryBody = await expectOk(await captain.get("/api/captain/library"));
      const library = JSON.parse(libraryBody) as CaptainLibrary;
      const tale = library.publishedTales.find((item) => item.title.includes("Studio Development Voyage"));
      expect(tale?.versions[0], "The isolated preset must expose the published development Tall Tale.").toBeTruthy();

      const createdBody = await expectOk(
        await captain.post("/api/captain/playthroughs", {
          headers: { "x-csrf-token": csrfToken },
          data: {
            taleId: tale!.id,
            versionId: tale!.versions[0].id,
            voyageName: `Lanternwake Journal ${crypto.randomUUID().slice(0, 8)}`,
            captainMode: "CAPTAIN_CONTROLLED",
            hints: "ON_REQUEST",
            sideQuests: true,
            scheduleTimezone: "America/New_York",
            accessibilityDefaults: { motion: "SYSTEM" },
            expiresInHours: 24,
            accountRequired: false,
            maxRedemptions: 1,
            players: [{ displayName: "Lanternwake Reader", crewRole: "Navigator" }],
          },
        }),
      );
      const created = JSON.parse(createdBody) as CreatedVoyage;
      const invitation = created.invitations[0];
      expect(invitation).toBeTruthy();

      await playerPage.goto(invitation.link);
      await expect(playerPage).toHaveURL(/\/player\/invitation$/);
      await expect(playerPage.getByRole("heading", { name: /Studio Development Voyage/ })).toBeVisible();
      await playerPage.getByRole("button", { name: "Accept and join voyage" }).click();
      await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}$`));
      await expectOk(
        await captain.post(`/api/captain/playthroughs/${created.playthroughId}/launch`, {
          headers: { "x-csrf-token": csrfToken },
          data: {},
        }),
      );

      journalPath = `/player/playthroughs/${created.playthroughId}/journal`;
      journalUrl = new URL(journalPath, invitation.link).href;
      playerCookies = await playerContext.cookies();
      expect(playerCookies.some((cookie) => cookie.name === "tall_tale_player")).toBe(true);
    } finally {
      await Promise.all([playerContext.close(), captainContext.close()]);
    }
  });

  test.beforeEach(async ({ page, browserName }) => {
    if (browserName !== "chromium") return;
    await installJournalProbe(page);
    await page.context().addCookies(playerCookies);
  });

  test("an active Journal opening releases listeners and requests within the browser unmount budget", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(journalUrl);
    await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible();
    await expect.poll(async () => (await readProbe(page)).activeEventSources).toBe(1);
    const documentToken = (await readProbe(page)).documentToken;
    await startOpeningAtFinitePhase(page);

    const released = await leaveJournalForLibrary(page, documentToken);
    expect(released.peakAnimationListeners).toBeGreaterThan(0);
    expect(released.peakEventSources).toBe(1);
  });

  test("mode change and skip both reconcile the Journal to a readable final pose", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(journalUrl);
    await expect(page.locator(".tall-tale-journal-shell")).toHaveAttribute("data-motion-mode", "full");
    const documentToken = (await readProbe(page)).documentToken;
    await startOpeningAtFinitePhase(page);
    await page.getByRole("button", { name: "Motion: full", exact: true }).click();
    await expect(page.locator(".tall-tale-journal-shell")).toHaveAttribute("data-journal-opening-outcome", "aborted");
    await expectReadyFinalPose(page);

    await leaveJournalForLibrary(page, documentToken);
    await returnToJournalFromLibrary(page, documentToken);
    await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible();
    await startOpeningAtFinitePhase(page);
    const persisted = page.waitForResponse(
      (response) =>
        response.url().endsWith(`${journalPath.replace("/player", "/api/player")}-state`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Skip ceremony" }).click();
    await persisted;
    await expect(page.locator(".tall-tale-journal-shell")).toHaveAttribute("data-journal-opening-outcome", "skipped");
    await expectReadyFinalPose(page);
  });

  test("browser reduced motion reaches deterministic JOURNAL_READY with the static readable book", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(journalUrl);
    const shell = page.locator(".tall-tale-journal-shell");
    await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
    await expect(shell).toHaveAttribute("data-motion-mode", "reduced");
    await expect(shell).toHaveAttribute("data-journal-opening-outcome", "completed-fallback");
    await expectReadyFinalPose(page);
    await expect(page.locator(".main-journal-book")).toHaveAttribute("data-pageflip-status", "reduced");
    await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);

    const pose = await page.locator(".tall-tale-journal-shell").evaluate((root) => {
      const closed = getComputedStyle(root.querySelector<HTMLElement>(".closed-book")!);
      const open = getComputedStyle(root.querySelector<HTMLElement>(".open-page-stage")!);
      return {
        closedDisplay: closed.display,
        openVisibility: open.visibility,
        openOpacity: open.opacity,
      };
    });
    expect(pose).toEqual({ closedDisplay: "none", openVisibility: "visible", openOpacity: "1" });
  });

  test("repeated returning-opening replays do not accumulate observable listeners, sources, or requests", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const postUnmountBalances: Array<{ listeners: number; sources: number; requests: number }> = [];
    await page.goto(journalUrl);
    const documentToken = (await readProbe(page)).documentToken;

    for (let cycle = 0; cycle < 3; cycle += 1) {
      if (cycle > 0) await returnToJournalFromLibrary(page, documentToken);
      const shell = page.locator(".tall-tale-journal-shell");
      await expect(shell).toHaveAttribute("data-journal-phase", "BOOK_SETTLING");
      await expect.poll(async () => (await readProbe(page)).activeAnimationListeners).toBeGreaterThan(0);
      await expectReadyFinalPose(page);
      await expect.poll(async () => (await readProbe(page)).activeRequests).toBe(0);
      const mounted = await readProbe(page);
      expect(mounted.activeAnimationListeners).toBe(0);
      expect(mounted.activeJournalKeydownListeners).toBe(1);
      expect(mounted.activeEventSources).toBe(1);
      expect(mounted.peakEventSources).toBe(1);

      const released = await leaveJournalForLibrary(page, documentToken);
      postUnmountBalances.push({
        listeners: released.activeAnimationListeners + released.activeJournalKeydownListeners,
        sources: released.activeEventSources,
        requests: released.activeRequests,
      });
    }

    expect(postUnmountBalances).toEqual([
      { listeners: 0, sources: 0, requests: 0 },
      { listeners: 0, sources: 0, requests: 0 },
      { listeners: 0, sources: 0, requests: 0 },
    ]);
  });
});
