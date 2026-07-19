import type { Page } from "@playwright/test";
import { policyForProgressionEvent } from "../../src/components/player/progression/event-policy";
import {
  PHASE3_EVENT_CASES,
  PHASE3_MOTION_MODES,
  PHASE3_PLAYER_SECTIONS,
  capturePhase3DbTruth,
  expect,
  navigatePhase3Section,
  observeUnsafePhase3Requests,
  openPhase3Player,
  phase3Test,
  readPhase3Evidence,
  setPhase3Motion,
  waitForPhase3Acknowledgment,
  waitForPhase3Receipt,
  type Phase3CaseFixture,
  type Phase3EventType,
  type Phase3FixtureManager,
  type Phase3PlayerSection,
  type Phase3ReceiptEvidence,
  type Phase3StateEvidence,
  type UnsafePhase3RequestMonitor,
} from "./fixtures/lanternwake-phase3";

type PresentationHistoryEvent = Readonly<{
  id: string;
  type: Phase3EventType;
  sequence: number;
  payload: Readonly<Record<string, unknown>>;
  releaseAt: string;
}>;

type SemanticFingerprint = Readonly<{
  heading: string;
  summary: string;
  actions: readonly string[];
  replayAvailable: boolean;
}>;

async function readHistoryEvent(page: Page, fixture: Phase3CaseFixture, eventId: string) {
  const response = await page.request.get(`/api/player/${fixture.slug}/snapshot`);
  expect(response.status()).toBe(200);
  const snapshot = (await response.json()) as { presentationHistory?: PresentationHistoryEvent[] };
  const event = snapshot.presentationHistory?.find((candidate) => candidate.id === eventId);
  expect(event, `Authorized Player-safe history omitted ${eventId}.`).toBeDefined();
  return structuredClone(event!);
}

function expectPlayerSafeHistory(event: PresentationHistoryEvent) {
  expect(event.id).toMatch(/\S/u);
  expect(event.sequence).toBeGreaterThan(0);
  expect(event.releaseAt).toMatch(/\S/u);
  const forbiddenKey = /(?:access.?code|campaign.?id|player.?access|token|hash|password|secret|username|email)/iu;
  const inspect = (value: unknown, path: string) => {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
    expect(Array.isArray(value), `${path} must be a bounded Player-safe primitive or record.`).toBe(false);
    expect(typeof value, `${path} must be a Player-safe record.`).toBe("object");
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      expect(key, `${path}.${key} exposes a forbidden private-key class.`).not.toMatch(forbiddenKey);
      inspect(child, `${path}.${key}`);
    }
  };
  inspect(event.payload, "payload");
}

async function readSemanticFingerprint(page: Page, eventId: string): Promise<SemanticFingerprint> {
  const notice = page.locator(`.progression-settled-notice[data-progress-event-id="${eventId}"]`);
  await expect(notice).toBeVisible();
  return notice.evaluate((element) => {
    const heading = element.querySelector("h2")?.textContent?.trim() ?? "";
    const summary = element.querySelector("p")?.textContent?.trim() ?? "";
    const actions = [...element.querySelectorAll("button")]
      .map((button) => button.textContent?.trim() ?? "")
      .filter(Boolean)
      .map((label) => (/^(?:Open |Return to )/u.test(label) ? "Destination" : label))
      .sort();
    return {
      heading,
      summary,
      actions,
      replayAvailable: actions.includes("Replay presentation"),
    };
  });
}

function expectPresentedReceipt(
  receipt: Phase3ReceiptEvidence,
  eventType: Phase3EventType,
  source: "live" | "reconnect" | "replay",
) {
  expect(receipt).toMatchObject({
    eventType,
    source,
    status: "presented",
    fallbackResult: "not-used",
    finalStateResult: expect.stringMatching(/^(committed|reconciled)$/u),
    restorationResult: expect.stringMatching(/^(exact-target|destination-control|section-heading|section-only)$/u),
    targetReport: { requiredSatisfied: true, failures: [] },
    scene: { outcome: "presented" },
  });
  expect(receipt.scene, `${eventType} ${source} lacks Director receipt evidence.`).not.toBeNull();
  expect(receipt.targetReport, `${eventType} ${source} lacks preflight evidence.`).not.toBeNull();
  expect(receipt.scene?.cleanup).toMatch(/^completed/u);
  expect(receipt.semanticLabels).toContain("scene-complete");
  if (source === "replay") {
    expect(receipt.acknowledgmentEligible).toBe(false);
    expect(receipt.acknowledgmentAttempted).toBe(false);
    expect(receipt.acknowledged).toBe(false);
  }
}

function activeRequestSegments(states: readonly Phase3StateEvidence[]) {
  const segments: string[] = [];
  let previous: string | null = null;
  for (const state of states) {
    const active = state.queue.activeRequestId;
    if (active !== previous && active !== null) segments.push(active);
    previous = active;
  }
  return segments;
}

async function expectMutationFreeReplay(
  page: Page,
  phase3: Phase3FixtureManager,
  fixture: Phase3CaseFixture,
  eventId: string,
  eventType: Phase3EventType,
  immutableHistory: PresentationHistoryEvent,
  semantic: SemanticFingerprint,
  monitor: UnsafePhase3RequestMonitor,
  label: string,
) {
  const before = await capturePhase3DbTruth(fixture);
  monitor.begin(label);
  const receipt = await phase3.replay(page, eventId);
  const unsafe = monitor.end(label);
  await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
  const after = await capturePhase3DbTruth(fixture);

  expect(unsafe, `${label} issued a mutating API request.`).toEqual([]);
  expect(after, `${label} mutated story, command, audit, event, or viewed truth.`).toEqual(before);
  expectPresentedReceipt(receipt, eventType, "replay");
  expect(receipt.playbackIdentity).not.toBe(receipt.requestId);
  expect(await readHistoryEvent(page, fixture, eventId)).toEqual(immutableHistory);
  expect(await readSemanticFingerprint(page, eventId)).toEqual(semantic);
  expect(after.viewed.filter((viewed) => viewed.eventId === eventId)).toEqual([
    { eventId, deviceId: fixture.deviceId },
  ]);
  return receipt;
}

function followUpEvent(eventType: Phase3EventType): Phase3EventType {
  return eventType === "CAMPAIGN_PAUSED" ? "CAMPAIGN_RESUMED" : "CAMPAIGN_PAUSED";
}

async function expectReadyAfterReturn(page: Page, fixture: Phase3CaseFixture, section: Phase3PlayerSection) {
  const hostId = await openPhase3Player(page, fixture, section);
  await expect(page.locator("[data-presentation-history]")).toBeVisible();
  await expect(page.locator(`[data-replay-event-id="${fixture.prerequisiteEventId ?? ""}"]`)).toHaveCount(
    fixture.prerequisiteEventId ? 1 : 0,
  );
  return hostId;
}

phase3Test.describe("Lanternwake Phase 3 exact twelve-step replay protocol", () => {
  phase3Test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The exact live-once replay protocol mutates only the harness-owned isolated database in Chromium.",
  );

  for (const [eventIndex, eventCase] of PHASE3_EVENT_CASES.entries()) {
    const caseId = `P3-REPLAY-${String(eventIndex + 1).padStart(3, "0")}`;
    phase3Test(`${caseId} ${eventCase.eventType} passes all twelve replay steps`, async ({ page, phase3 }) => {
      phase3Test.setTimeout(600_000);
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase(caseId, eventCase.eventType);
      const startingSection = eventCase.relevantSection ?? "journal";
      let persistentHostId = await openPhase3Player(page, fixture, startingSection);
      const monitor = observeUnsafePhase3Requests(page);

      try {
        // 1. Play live once.
        const liveCommand = await phase3.publish(fixture);
        const liveReceipt = await waitForPhase3Receipt(page, liveCommand.event.id, { source: "live" });
        expectPresentedReceipt(liveReceipt, eventCase.eventType, "live");
        await waitForPhase3Acknowledgment(page, fixture, liveCommand.event.id);
        const immutableHistory = await readHistoryEvent(page, fixture, liveCommand.event.id);
        expectPlayerSafeHistory(immutableHistory);
        const semantic = await readSemanticFingerprint(page, liveCommand.event.id);
        expect(semantic).toMatchObject({
          heading: policyForProgressionEvent(eventCase.eventType).globalPresentation.heading,
          summary: expect.stringMatching(/\S/u),
          replayAvailable: true,
        });
        const liveTruth = await capturePhase3DbTruth(fixture);
        expect(liveTruth.viewed.filter((viewed) => viewed.eventId === liveCommand.event.id)).toHaveLength(1);

        // 2. Replay immediately. 3. Replay again.
        const immediate = await expectMutationFreeReplay(
          page,
          phase3,
          fixture,
          liveCommand.event.id,
          eventCase.eventType,
          immutableHistory,
          semantic,
          monitor,
          `${caseId}-immediate`,
        );
        const repeated = await expectMutationFreeReplay(
          page,
          phase3,
          fixture,
          liveCommand.event.id,
          eventCase.eventType,
          immutableHistory,
          semantic,
          monitor,
          `${caseId}-repeated`,
        );
        expect(repeated.requestId).not.toBe(immediate.requestId);
        expect(repeated.playbackIdentity).not.toBe(immediate.playbackIdentity);

        // 4. Change section and replay. Exercise every section so "any section"
        // is browser evidence, not an inference from the six-section live matrix.
        for (const section of PHASE3_PLAYER_SECTIONS) {
          await navigatePhase3Section(page, section);
          const sectionReplay = await expectMutationFreeReplay(
            page,
            phase3,
            fixture,
            liveCommand.event.id,
            eventCase.eventType,
            immutableHistory,
            semantic,
            monitor,
            `${caseId}-section-${section}`,
          );
          expect(sectionReplay.currentSection).toBe(section);
          expect(sectionReplay.returnSection).toBe(section);
        }

        // 5. Navigate away and return.
        await page.goto("/");
        persistentHostId = await expectReadyAfterReturn(page, fixture, startingSection);
        await expectMutationFreeReplay(
          page,
          phase3,
          fixture,
          liveCommand.event.id,
          eventCase.eventType,
          immutableHistory,
          semantic,
          monitor,
          `${caseId}-route-return`,
        );

        // 6. Refresh and replay.
        await page.reload();
        persistentHostId = await expectReadyAfterReturn(page, fixture, startingSection);
        await expectMutationFreeReplay(
          page,
          phase3,
          fixture,
          liveCommand.event.id,
          eventCase.eventType,
          immutableHistory,
          semantic,
          monitor,
          `${caseId}-refresh`,
        );

        // 7. Change motion mode and replay.
        await setPhase3Motion(page, PHASE3_MOTION_MODES[2]);
        persistentHostId = await expectReadyAfterReturn(page, fixture, startingSection);
        await expect(page.locator("html")).toHaveAttribute("data-motion-level", "reduced");
        const reducedReplay = await expectMutationFreeReplay(
          page,
          phase3,
          fixture,
          liveCommand.event.id,
          eventCase.eventType,
          immutableHistory,
          semantic,
          monitor,
          `${caseId}-reduced`,
        );
        expect(reducedReplay.motionPolicy).toMatchObject({
          level: "reduced",
          source: { productSetting: "reduced", browserPrefersReduced: false },
        });

        // 8. Skip midway and replay. A missing active Skip control fails closed.
        await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
        persistentHostId = await expectReadyAfterReturn(page, fixture, startingSection);
        const beforeSkip = await capturePhase3DbTruth(fixture);
        monitor.begin(`${caseId}-skip`);
        const skipReplayPromise = phase3.replay(page, liveCommand.event.id);
        const skip = page.getByRole("button", { name: "Reveal readable result" });
        await expect(skip).toBeVisible();
        await skip.click();
        const skippedReceipt = await skipReplayPromise;
        expect(monitor.end(`${caseId}-skip`)).toEqual([]);
        expect(skippedReceipt).toMatchObject({
          source: "replay",
          status: "skipped",
          fallbackResult: "not-used",
          acknowledgmentEligible: false,
          scene: { outcome: "skipped-by-user" },
        });
        expect(await capturePhase3DbTruth(fixture)).toEqual(beforeSkip);
        expect(await readSemanticFingerprint(page, liveCommand.event.id)).toEqual(semantic);
        await expectMutationFreeReplay(
          page,
          phase3,
          fixture,
          liveCommand.event.id,
          eventCase.eventType,
          immutableHistory,
          semantic,
          monitor,
          `${caseId}-after-skip`,
        );

        // 9. Interrupt with live authoritative work. Completion at a declared
        // non-interruptible boundary is allowed; overlap and false replay ack are not.
        const replayBeforeAuthoritative = phase3.replay(page, liveCommand.event.id);
        await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "active");
        const authoritative = await phase3.publish(fixture, followUpEvent(eventCase.eventType));
        const interruptedOrBoundaryReceipt = await replayBeforeAuthoritative;
        expect(interruptedOrBoundaryReceipt.status).toMatch(/^(interrupted|presented)$/u);
        expect(interruptedOrBoundaryReceipt.fallbackResult).toBe("not-used");
        expect(interruptedOrBoundaryReceipt.acknowledgmentEligible).toBe(false);
        const authoritativeReceipt = await waitForPhase3Receipt(page, authoritative.event.id, { source: "live" });
        expectPresentedReceipt(authoritativeReceipt, authoritative.event.type, "live");
        await waitForPhase3Acknowledgment(page, fixture, authoritative.event.id);
        const afterAuthoritative = await capturePhase3DbTruth(fixture);
        expect(afterAuthoritative.viewed.filter((viewed) => viewed.eventId === liveCommand.event.id)).toHaveLength(1);
        await expectMutationFreeReplay(
          page,
          phase3,
          fixture,
          liveCommand.event.id,
          eventCase.eventType,
          immutableHistory,
          semantic,
          monitor,
          `${caseId}-after-authoritative`,
        );

        // 10. Network and database checks ran around every replay above.
        // 11. Runtime cleanup must return to the sole persistent idle host.
        const evidence = await readPhase3Evidence(page);
        const finalState = evidence.states.at(-1);
        expect(finalState?.queue).toEqual({ activeRequestId: null, pendingCount: 0 });
        await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(1);
        await expect(page.locator("[data-testid='progression-scene-host']")).toHaveAttribute(
          "data-scene-host-id",
          persistentHostId!,
        );
        await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
        await expect(page.locator("[data-animation-claim-id]")).toHaveCount(0);

        // 12. Final readable semantics and immutable safe payload equal live.
        expect(await readSemanticFingerprint(page, liveCommand.event.id)).toEqual(semantic);
        expect(await readHistoryEvent(page, fixture, liveCommand.event.id)).toEqual(immutableHistory);
      } finally {
        monitor.dispose();
      }
    });
  }
});

phase3Test.describe("Lanternwake Phase 3 delivery, interruption, and terminal resilience", () => {
  phase3Test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Resilience publication and revocation scenarios mutate only the harness-owned isolated database in Chromium.",
  );

  phase3Test(
    "P3-RESILIENCE-001 simultaneous authoritative events serialize by sequence and priority",
    async ({ page, phase3 }) => {
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-001", "PLAYER_LOG_ENTRY_ADDED");
      await openPhase3Player(page, fixture, "log");

      const traceStart = (await readPhase3Evidence(page)).states.length;
      const first = await phase3.publish(fixture, "PLAYER_LOG_ENTRY_ADDED");
      await expect
        .poll(async () => {
          const trace = (await readPhase3Evidence(page)).states.slice(traceStart);
          return trace.find(
            (state) =>
              state.eventId === first.event.id &&
              state.queue.activeRequestId !== null &&
              state.queue.pendingCount === 0,
          )?.queue;
        })
        .toEqual({ activeRequestId: expect.any(String), pendingCount: 0 });
      const firstActiveState = (await readPhase3Evidence(page)).states
        .slice(traceStart)
        .find(
          (state) =>
            state.eventId === first.event.id && state.queue.activeRequestId !== null && state.queue.pendingCount === 0,
        );
      expect(firstActiveState).toBeDefined();

      const secondPublication = phase3.publish(fixture, "CAMPAIGN_PAUSED");
      await expect
        .poll(async () => {
          const trace = (await readPhase3Evidence(page)).states.slice(traceStart);
          return trace.some(
            (state) =>
              state.eventId === first.event.id &&
              state.queue.activeRequestId === firstActiveState!.queue.activeRequestId &&
              state.queue.pendingCount === 1,
          );
        })
        .toBe(true);
      const second = await secondPublication;
      expect(second.event.sequence).toBe(first.event.sequence + 1);
      expect(policyForProgressionEvent("CAMPAIGN_PAUSED").priority).toBeGreaterThan(
        policyForProgressionEvent("PLAYER_LOG_ENTRY_ADDED").priority,
      );
      const [firstReceipt, secondReceipt] = await Promise.all([
        waitForPhase3Receipt(page, first.event.id, { source: "live" }),
        waitForPhase3Receipt(page, second.event.id, { source: "live" }),
      ]);
      expectPresentedReceipt(firstReceipt, "PLAYER_LOG_ENTRY_ADDED", "live");
      expectPresentedReceipt(secondReceipt, "CAMPAIGN_PAUSED", "live");
      expect(firstReceipt.eventSequence).toBeLessThan(secondReceipt.eventSequence);
      expect(firstReceipt.requestId).not.toBe(secondReceipt.requestId);
      expect(firstReceipt.scene?.sceneInstanceId).not.toBe(secondReceipt.scene?.sceneInstanceId);
      await Promise.all([
        waitForPhase3Acknowledgment(page, fixture, first.event.id),
        waitForPhase3Acknowledgment(page, fixture, second.event.id),
      ]);

      const evidence = await readPhase3Evidence(page);
      const trace = evidence.states.slice(traceStart);
      const firstActiveIndex = trace.findIndex(
        (state) => state.queue.activeRequestId === firstReceipt.requestId && state.queue.pendingCount === 0,
      );
      const queuedBehindFirstIndex = trace.findIndex(
        (state) => state.queue.activeRequestId === firstReceipt.requestId && state.queue.pendingCount === 1,
      );
      const firstSettledIndex = trace.findIndex(
        (state) => state.transition === "settled" && state.requestId === firstReceipt.requestId,
      );
      const secondActiveIndex = trace.findIndex((state) => state.queue.activeRequestId === secondReceipt.requestId);
      const secondSettledIndex = trace.findIndex(
        (state) => state.transition === "settled" && state.requestId === secondReceipt.requestId,
      );
      expect(firstActiveIndex).toBeGreaterThanOrEqual(0);
      expect(queuedBehindFirstIndex).toBeGreaterThan(firstActiveIndex);
      expect(firstSettledIndex).toBeGreaterThan(queuedBehindFirstIndex);
      expect(secondActiveIndex).toBeGreaterThan(firstSettledIndex);
      expect(secondSettledIndex).toBeGreaterThan(secondActiveIndex);
      expect(activeRequestSegments(trace)).toEqual([firstReceipt.requestId, secondReceipt.requestId]);
      expect(Math.max(...trace.map((state) => state.queue.pendingCount))).toBe(1);
      const receiptOrder = evidence.receipts
        .filter((receipt) => receipt.eventId === first.event.id || receipt.eventId === second.event.id)
        .map((receipt) => receipt.eventId);
      expect(receiptOrder).toEqual([first.event.id, second.event.id]);
      expect(evidence.states.at(-1)?.queue).toEqual({ activeRequestId: null, pendingCount: 0 });
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
    },
  );

  phase3Test(
    "P3-RESILIENCE-002 reconnect overlap, duplicate delivery, and stale history do not replay acknowledged work",
    async ({ page, phase3 }) => {
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-002", "PLAYER_LOG_ENTRY_ADDED");
      await openPhase3Player(page, fixture, "journal");
      const command = await phase3.publish(fixture);
      const receipt = await waitForPhase3Receipt(page, command.event.id, { source: "live" });
      expectPresentedReceipt(receipt, "PLAYER_LOG_ENTRY_ADDED", "live");
      await waitForPhase3Acknowledgment(page, fixture, command.event.id);
      const truth = await capturePhase3DbTruth(fixture);

      await page.context().setOffline(true);
      await expect(page.getByText("Signal adrift")).toBeVisible();
      await page.context().setOffline(false);
      await expect(page.getByText("Tide connected")).toBeVisible();
      await page.reload();
      await openPhase3Player(page, fixture, "journal");
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.getByText("Tide connected")).toBeVisible();

      const afterReconnect = await readPhase3Evidence(page);
      expect(afterReconnect.receipts.filter((receipt) => receipt.eventId === command.event.id)).toEqual([]);
      expect(await capturePhase3DbTruth(fixture)).toEqual(truth);
      await expect(page.locator(`[data-replay-event-id="${command.event.id}"]`)).toHaveCount(1);
    },
  );

  phase3Test("P3-RESILIENCE-003 offline publication catches up once as reconnect work", async ({ page, phase3 }) => {
    phase3Test.setTimeout(90_000);
    await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
    await phase3.proveIsolation();
    const fixture = await phase3.createCase("P3-RESILIENCE-003", "PLAYER_LOG_ENTRY_ADDED");
    await openPhase3Player(page, fixture, "log");
    await page.context().setOffline(true);
    await expect(page.getByText("Signal adrift")).toBeVisible();

    const command = await phase3.publish(fixture);
    expect((await readPhase3Evidence(page)).receipts.filter((receipt) => receipt.eventId === command.event.id)).toEqual(
      [],
    );
    await page.context().setOffline(false);
    const receipt = await waitForPhase3Receipt(page, command.event.id, { source: "reconnect" });
    expectPresentedReceipt(receipt, "PLAYER_LOG_ENTRY_ADDED", "reconnect");
    await waitForPhase3Acknowledgment(page, fixture, command.event.id);
    expect(
      (await readPhase3Evidence(page)).receipts.filter((candidate) => candidate.eventId === command.event.id),
    ).toHaveLength(1);
  });

  phase3Test(
    "P3-RESILIENCE-004 section navigation, back-forward, and route unmount preserve replay truth",
    async ({ page, phase3 }) => {
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-004", "PLAYER_LOG_ENTRY_ADDED");
      await openPhase3Player(page, fixture, "log");
      const command = await phase3.publish(fixture);
      const liveReceipt = await waitForPhase3Receipt(page, command.event.id, { source: "live" });
      expectPresentedReceipt(liveReceipt, "PLAYER_LOG_ENTRY_ADDED", "live");
      await waitForPhase3Acknowledgment(page, fixture, command.event.id);
      const immutableTruth = await capturePhase3DbTruth(fixture);

      const replayDuringNavigation = phase3.replay(page, command.event.id);
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "active");
      await page.evaluate(() => {
        const url = new URL(location.href);
        url.searchParams.set("section", "chart");
        history.pushState({}, "", url);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      const navigationReceipt = await replayDuringNavigation;
      expectPresentedReceipt(navigationReceipt, "PLAYER_LOG_ENTRY_ADDED", "replay");
      expect(navigationReceipt).toMatchObject({
        source: "replay",
        restorationResult: expect.stringMatching(/^(exact-target|destination-control|section-heading|section-only)$/u),
      });
      await expect(page.locator(".voyage-shell.view-chart")).toBeVisible();
      await expect(page.locator(".section-transition [data-section-heading]")).toBeFocused();

      const replayBeforeUnmount = phase3.replay(page, command.event.id);
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "active");
      await page.goto("/");
      await replayBeforeUnmount.catch(() => undefined);
      await page.goBack();
      await openPhase3Player(page, fixture, "chart");
      await page.goBack();
      await page.goForward();
      await openPhase3Player(page, fixture, "chart");
      const replayAfterRemount = await phase3.replay(page, command.event.id);
      expectPresentedReceipt(replayAfterRemount, "PLAYER_LOG_ENTRY_ADDED", "replay");
      expect(await capturePhase3DbTruth(fixture)).toEqual(immutableTruth);
      await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(1);
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
    },
  );

  phase3Test("P3-RESILIENCE-005 hidden-tab replay settles once without detached writes", async ({ page, phase3 }) => {
    await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
    await phase3.proveIsolation();
    const fixture = await phase3.createCase("P3-RESILIENCE-005", "CHAPTER_RELEASED");
    await openPhase3Player(page, fixture, "journal");
    const command = await phase3.publish(fixture);
    const liveReceipt = await waitForPhase3Receipt(page, command.event.id, { source: "live" });
    expectPresentedReceipt(liveReceipt, "CHAPTER_RELEASED", "live");
    await waitForPhase3Acknowledgment(page, fixture, command.event.id);
    const truth = await capturePhase3DbTruth(fixture);

    const replay = phase3.replay(page, command.event.id);
    const foreground = await page.context().newPage();
    await foreground.goto("about:blank");
    await foreground.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden");
    const receipt = await replay;
    await foreground.close();
    await page.bringToFront();
    expectPresentedReceipt(receipt, "CHAPTER_RELEASED", "replay");
    expect(await capturePhase3DbTruth(fixture)).toEqual(truth);
    await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
  });

  phase3Test(
    "P3-RESILIENCE-006 asset load failure remains readable and acknowledgment-truthful",
    async ({ page, phase3 }) => {
      const failedAssetRequests: string[] = [];
      await page.route("**/animations/lottie/rolling-fog.json", async (route) => {
        failedAssetRequests.push(new URL(route.request().url()).pathname);
        await route.abort("failed");
      });
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-006", "FINALE_TEASED");
      await openPhase3Player(page, fixture, "finale");
      const finaleFog = page.locator(".finale-fog[data-animation-owner='lottie']");
      await expect.poll(() => failedAssetRequests.length).toBeGreaterThan(0);
      expect(new Set(failedAssetRequests)).toEqual(new Set(["/animations/lottie/rolling-fog.json"]));
      await expect(finaleFog).toHaveAttribute("data-lottie-status", "failed");
      await expect(
        finaleFog.locator(
          "[data-fallback-active='true'][aria-label='Celestial fog around the dormant finale mechanism static fallback']",
        ),
      ).toBeVisible();

      const command = await phase3.publish(fixture);
      const receipt = await waitForPhase3Receipt(page, command.event.id, { source: "live" });
      expect(receipt).toMatchObject({
        eventId: command.event.id,
        eventType: "FINALE_TEASED",
        eventSequence: command.event.sequence,
        source: "live",
        status: "presented",
        fallbackResult: "not-used",
        finalStateResult: expect.stringMatching(/^(committed|reconciled)$/u),
        acknowledgmentEligible: true,
        scene: { sceneName: "finale-tease", outcome: "presented", cleanup: expect.stringMatching(/^completed/u) },
        targetReport: { requiredSatisfied: true, failures: [] },
        localEnhancement: {
          expected: true,
          section: "finale",
          status: "ran",
          targetKeys: ["finale-mechanism"],
        },
      });
      expect(receipt.semanticLabels).toContain("scene-complete");
      await waitForPhase3Acknowledgment(page, fixture, command.event.id);
      const settled = page.locator(`.progression-settled-notice[data-progress-event-id="${command.event.id}"]`);
      await expect(settled.getByRole("heading", { name: "The finale stirs" })).toBeVisible();
      expect((await settled.locator("p").innerText()).trim()).toMatch(/\S/u);
      await expect(settled.getByRole("button", { name: "Replay presentation" })).toBeEnabled();
      await expect(finaleFog).toHaveAttribute("data-lottie-status", "failed");
      expect(failedAssetRequests.length).toBeGreaterThan(0);
      expect(new Set(failedAssetRequests)).toEqual(new Set(["/animations/lottie/rolling-fog.json"]));
    },
  );

  phase3Test(
    "P3-RESILIENCE-007 acknowledgment failure never claims viewed and replay remains mutation-free",
    async ({ page, phase3 }) => {
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-007", "PLAYER_LOG_ENTRY_ADDED");
      await openPhase3Player(page, fixture, "log");
      await page.route(`**/api/player/${fixture.slug}/viewed`, async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        const body = route.request().postDataJSON() as { eventId?: unknown } | null;
        if (typeof body?.eventId === "string") {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Injected" }),
          });
        } else {
          await route.continue();
        }
      });

      const command = await phase3.publish(fixture);
      const receipt = await waitForPhase3Receipt(page, command.event.id, { source: "live" });
      expectPresentedReceipt(receipt, "PLAYER_LOG_ENTRY_ADDED", "live");
      expect(receipt).toMatchObject({ acknowledgmentAttempted: true, acknowledged: false });
      const afterFailure = await capturePhase3DbTruth(fixture);
      expect(afterFailure.viewed.filter((viewed) => viewed.eventId === command.event.id)).toEqual([]);
      await expect(page.getByRole("button", { name: "Replay presentation" })).toBeEnabled();

      const replay = await phase3.replay(page, command.event.id);
      expectPresentedReceipt(replay, "PLAYER_LOG_ENTRY_ADDED", "replay");
      expect(await capturePhase3DbTruth(fixture)).toEqual(afterFailure);
    },
  );

  phase3Test(
    "P3-RESILIENCE-008 motion changes do not replay one-shots and repeated controls remain serialized",
    async ({ page, phase3 }) => {
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-008", "PLAYER_LOG_ENTRY_ADDED");
      await openPhase3Player(page, fixture, "log");
      const command = await phase3.publish(fixture);
      const liveReceipt = await waitForPhase3Receipt(page, command.event.id, { source: "live" });
      expectPresentedReceipt(liveReceipt, "PLAYER_LOG_ENTRY_ADDED", "live");
      await waitForPhase3Acknowledgment(page, fixture, command.event.id);
      const before = await readPhase3Evidence(page);

      await page.getByRole("button", { name: "Motion: full. Change motion setting" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-motion-level", "gentle");
      expect((await readPhase3Evidence(page)).receipts).toEqual(before.receipts);

      const truth = await capturePhase3DbTruth(fixture);
      const traceStart = (await readPhase3Evidence(page)).states.length;
      const exactReplay = page.locator(`[data-progress-event-id="${command.event.id}"]`).getByRole("button", {
        name: "Replay presentation",
      });
      const enqueueOrder = await exactReplay.evaluate((element, eventId) => {
        const button = element as HTMLButtonElement;
        const originalDescriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
        const deterministicIdentities = [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000101",
          "00000000-0000-4000-8000-000000000003",
          "00000000-0000-4000-8000-000000000103",
          "00000000-0000-4000-8000-000000000002",
          "00000000-0000-4000-8000-000000000102",
        ] as const;
        const generated: string[] = [];
        Object.defineProperty(crypto, "randomUUID", {
          configurable: true,
          value: () => {
            const identity = deterministicIdentities[generated.length];
            if (!identity) throw new Error("Unexpected UUID request while enqueueing the triple replay.");
            generated.push(identity);
            return identity;
          },
        });
        try {
          button.click();
          button.click();
          button.click();
        } finally {
          if (originalDescriptor) Object.defineProperty(crypto, "randomUUID", originalDescriptor);
          else Reflect.deleteProperty(crypto, "randomUUID");
        }
        if (generated.length !== 6) {
          throw new Error(`Expected three request/playback identity pairs, received ${generated.length} UUIDs.`);
        }
        return generated
          .filter((_, index) => index % 2 === 0)
          .map((identity) => `request:replay:${eventId}:${identity}`);
      }, command.event.id);
      await expect
        .poll(
          async () =>
            (await readPhase3Evidence(page)).receipts.filter(
              (receipt) => receipt.eventId === command.event.id && receipt.source === "replay",
            ).length,
          { timeout: 30_000 },
        )
        .toBe(3);
      await expect
        .poll(async () => {
          const trace = (await readPhase3Evidence(page)).states.slice(traceStart);
          return {
            settled: trace.filter((state) => state.transition === "settled" && state.eventId === command.event.id)
              .length,
            queue: trace.at(-1)?.queue,
          };
        })
        .toEqual({ settled: 3, queue: { activeRequestId: null, pendingCount: 0 } });

      const replayEvidence = await readPhase3Evidence(page);
      const replayReceipts = replayEvidence.receipts.filter(
        (receipt) => receipt.eventId === command.event.id && receipt.source === "replay",
      );
      for (const receipt of replayReceipts) expectPresentedReceipt(receipt, "PLAYER_LOG_ENTRY_ADDED", "replay");
      expect(new Set(replayReceipts.map((receipt) => receipt.requestId)).size).toBe(3);
      expect(new Set(replayReceipts.map((receipt) => receipt.playbackIdentity)).size).toBe(3);
      expect(new Set(replayReceipts.map((receipt) => receipt.scene?.sceneInstanceId)).size).toBe(3);
      expect(replayReceipts.every((receipt) => receipt.acknowledgmentEligible === false)).toBe(true);

      const trace = replayEvidence.states.slice(traceStart);
      const requestIds = replayReceipts.map((receipt) => receipt.requestId);
      const activeOrder = activeRequestSegments(trace);
      expect(activeOrder).toHaveLength(3);
      expect(new Set(activeOrder).size).toBe(3);
      expect(
        trace.every(
          (state) => state.queue.activeRequestId === null || requestIds.includes(state.queue.activeRequestId),
        ),
      ).toBe(true);
      expect(Math.max(...trace.map((state) => state.queue.pendingCount))).toBe(2);
      expect(enqueueOrder).toHaveLength(3);
      expect(new Set(enqueueOrder).size).toBe(3);
      expect(enqueueOrder[1]! > enqueueOrder[2]!).toBe(true);
      const declaredOrder = [enqueueOrder[0]!, ...enqueueOrder.slice(1).sort()];
      expect(declaredOrder).toEqual([enqueueOrder[0], enqueueOrder[2], enqueueOrder[1]]);
      expect(activeOrder).toEqual(declaredOrder);
      expect(requestIds).toEqual(declaredOrder);
      for (const [index, requestId] of activeOrder.entries()) {
        const activeIndex = trace.findIndex((state) => state.queue.activeRequestId === requestId);
        const settledIndex = trace.findIndex(
          (state) => state.transition === "settled" && state.requestId === requestId,
        );
        expect(activeIndex).toBeGreaterThanOrEqual(0);
        expect(settledIndex).toBeGreaterThan(activeIndex);
        expect(trace.filter((state) => state.transition === "settled" && state.requestId === requestId)).toHaveLength(
          1,
        );
        if (index > 0) {
          const priorSettledIndex = trace.findIndex(
            (state) => state.transition === "settled" && state.requestId === activeOrder[index - 1],
          );
          expect(activeIndex).toBeGreaterThan(priorSettledIndex);
        }
      }
      expect(await capturePhase3DbTruth(fixture)).toEqual(truth);
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
    },
  );

  phase3Test(
    "P3-RESILIENCE-009 authoritative work interrupts replay and preserves exact historical replay",
    async ({ page, phase3 }) => {
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-009", "CHAPTER_RELEASED");
      await openPhase3Player(page, fixture, "journal");
      const chapter = await phase3.publish(fixture);
      const chapterReceipt = await waitForPhase3Receipt(page, chapter.event.id, { source: "live" });
      expectPresentedReceipt(chapterReceipt, "CHAPTER_RELEASED", "live");
      await waitForPhase3Acknowledgment(page, fixture, chapter.event.id);

      const replay = phase3.replay(page, chapter.event.id);
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "active");
      const pause = await phase3.publish(fixture, "CAMPAIGN_PAUSED");
      const replayReceipt = await replay;
      expect(replayReceipt).toMatchObject({
        eventId: chapter.event.id,
        source: "replay",
        status: "interrupted",
        fallbackResult: "not-used",
        acknowledgmentEligible: false,
        acknowledged: false,
      });
      const pauseReceipt = await waitForPhase3Receipt(page, pause.event.id, { source: "live" });
      expectPresentedReceipt(pauseReceipt, "CAMPAIGN_PAUSED", "live");
      await waitForPhase3Acknowledgment(page, fixture, pause.event.id);
      const viewedBeforeHistoricalReplay = (await capturePhase3DbTruth(fixture)).viewed;
      const historicalReplay = await phase3.replay(page, chapter.event.id);
      expectPresentedReceipt(historicalReplay, "CHAPTER_RELEASED", "replay");
      expect((await capturePhase3DbTruth(fixture)).viewed).toEqual(viewedBeforeHistoricalReplay);
    },
  );

  phase3Test(
    "P3-RESILIENCE-010 access revocation is terminal, clears history, and hides the workspace",
    async ({ page, phase3 }) => {
      phase3Test.setTimeout(60_000);
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await phase3.proveIsolation();
      const fixture = await phase3.createCase("P3-RESILIENCE-010", "PLAYER_LOG_ENTRY_ADDED");
      await openPhase3Player(page, fixture, "log");
      const command = await phase3.publish(fixture);
      const receipt = await waitForPhase3Receipt(page, command.event.id, { source: "live" });
      expectPresentedReceipt(receipt, "PLAYER_LOG_ENTRY_ADDED", "live");
      await waitForPhase3Acknowledgment(page, fixture, command.event.id);

      let eventRequestsAfterRevocation = 0;
      const countEventRequests = (request: { url(): string }) => {
        if (new URL(request.url()).pathname.endsWith(`/api/player/${fixture.slug}/events`)) {
          eventRequestsAfterRevocation += 1;
        }
      };
      await phase3.revokeAccess(fixture);
      await expect
        .poll(
          async () => (await readPhase3Evidence(page)).states.some((state) => state.transition === "access-revoked"),
          {
            timeout: 25_000,
          },
        )
        .toBe(true);
      await expect(page.getByRole("heading", { name: "Invitation no longer active" })).toBeVisible();
      await expect(page.locator("[data-player-experience-root]")).toHaveCount(0);
      await expect(page.locator("[data-presentation-history]")).toHaveCount(0);
      await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");

      page.on("request", countEventRequests);
      await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
        window.dispatchEvent(new Event("offline"));
        window.dispatchEvent(new Event("online"));
      });
      await page.waitForTimeout(1_000);
      page.off("request", countEventRequests);
      expect(eventRequestsAfterRevocation).toBe(0);
      const snapshot = await page.request.get(`/api/player/${fixture.slug}/snapshot`);
      expect(snapshot.status()).toBe(401);
    },
  );
});
