import { getSceneDefinition } from "../../src/animation/director/scene-registry";
import { policyForProgressionEvent } from "../../src/components/player/progression/event-policy";
import {
  PHASE3_EVENT_CASES,
  PHASE3_MOTION_MODES,
  PHASE3_PLAYER_SECTIONS,
  capturePhase3DbTruth,
  expect,
  openPhase3Player,
  phase3Test,
  setPhase3Motion,
  waitForPhase3Acknowledgment,
  waitForPhase3Receipt,
  type Phase3EventType,
  type Phase3PlayerSection,
} from "./fixtures/lanternwake-phase3";

const allSectionEvents = new Set<Phase3EventType>([
  "CHAPTER_RELEASED",
  "CAMPAIGN_PAUSED",
  "CAMPAIGN_RESUMED",
  "STATE_REVERTED",
]);

type EventSectionPair = Readonly<{
  eventType: Phase3EventType;
  startingSection: Phase3PlayerSection;
}>;

const eventSectionPairs = (() => {
  const pairs = new Map<string, EventSectionPair>();
  const add = (eventType: Phase3EventType, startingSection: Phase3PlayerSection) => {
    pairs.set(`${eventType}:${startingSection}`, { eventType, startingSection });
  };

  for (const eventCase of PHASE3_EVENT_CASES) {
    // State-wide events have no local section. Journal is their canonical
    // baseline case before the required six-section expansion is deduplicated.
    add(eventCase.eventType, eventCase.relevantSection ?? "journal");
  }
  for (const eventType of allSectionEvents) {
    for (const startingSection of PHASE3_PLAYER_SECTIONS) add(eventType, startingSection);
  }
  return [...pairs.values()];
})();

const motionCases = eventSectionPairs.flatMap((eventSection) =>
  PHASE3_MOTION_MODES.map((motion) => ({ ...eventSection, motion })),
);

if (eventSectionPairs.length !== 37 || motionCases.length !== 185) {
  throw new Error(
    `Phase 3 motion generation drifted: expected 37 event/section pairs and 185 unique tuples, received ${eventSectionPairs.length} and ${motionCases.length}.`,
  );
}
if (new Set(motionCases.map((item) => `${item.eventType}:${item.startingSection}:${item.motion.id}`)).size !== 185) {
  throw new Error("Phase 3 motion generation contains a duplicate event/section/mode tuple.");
}

const relevantLocalEnhancementCases = motionCases.filter((motionCase) => {
  const localEnhancement = policyForProgressionEvent(motionCase.eventType).localEnhancement;
  return localEnhancement?.section === motionCase.startingSection;
});
const unavailableLocalEnhancementCases = motionCases.filter((motionCase) => {
  const localEnhancement = policyForProgressionEvent(motionCase.eventType).localEnhancement;
  return localEnhancement !== null && localEnhancement.section !== motionCase.startingSection;
});
if (
  relevantLocalEnhancementCases.length !== 70 ||
  unavailableLocalEnhancementCases.length !== 25 ||
  unavailableLocalEnhancementCases.some(
    (motionCase) => motionCase.eventType !== "CHAPTER_RELEASED" || motionCase.startingSection === "journal",
  )
) {
  throw new Error(
    "Phase 3 local-enhancement coverage drifted: expected 70 relevant-section runs and 25 off-Journal CHAPTER_RELEASED unavailable cases.",
  );
}

phase3Test.describe("Lanternwake Phase 3 governed motion semantic equivalence", () => {
  phase3Test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The 185 real-event motion tuples mutate only the harness-owned isolated database in Chromium.",
  );

  for (const [index, motionCase] of motionCases.entries()) {
    const caseId = `P3-MOTION-${String(index + 1).padStart(3, "0")}`;
    phase3Test(
      `${caseId} ${motionCase.eventType} @ ${motionCase.startingSection} ${motionCase.motion.id}`,
      async ({ page, phase3 }) => {
        phase3Test.setTimeout(60_000);
        await page.setViewportSize({ width: 1_440, height: 900 });
        await setPhase3Motion(page, motionCase.motion);
        await phase3.proveIsolation();
        const fixture = await phase3.createCase(caseId, motionCase.eventType);
        const persistentHostId = await openPhase3Player(page, fixture, motionCase.startingSection);
        expect(persistentHostId).toMatch(/\S/u);

        const focusTarget = page.locator(".section-transition [data-section-heading]");
        await focusTarget.focus();
        const before = await capturePhase3DbTruth(fixture);
        const command = await phase3.publish(fixture);
        const receipt = await waitForPhase3Receipt(page, command.event.id);
        const policy = policyForProgressionEvent(motionCase.eventType);
        const scene = getSceneDefinition(policy.sceneName);
        if (!receipt.scene || !receipt.targetReport) {
          throw new Error(`${caseId} lacks the Director scene or target evidence required for motion validation.`);
        }

        expect(receipt).toMatchObject({
          eventId: command.event.id,
          eventType: motionCase.eventType,
          eventSequence: command.event.sequence,
          source: "live",
          status: "presented",
          fallbackResult: "not-used",
          finalStateResult: expect.stringMatching(/^(committed|reconciled)$/u),
          restorationResult: expect.stringMatching(
            /^(exact-target|destination-control|section-heading|section-only)$/u,
          ),
          acknowledgmentEligible: true,
          scene: {
            sceneName: policy.sceneName,
            hostId: persistentHostId,
            hostKind: "player-progression",
            outcome: "presented",
            cleanup: expect.stringMatching(/^completed/u),
          },
          motionPolicy: {
            level: motionCase.motion.resolvedMode,
            source: {
              productSetting: motionCase.motion.productMode,
              browserPrefersReduced: motionCase.motion.browserReduced,
            },
          },
          targetReport: { requiredSatisfied: true, failures: [] },
        });
        expect(receipt.semanticLabels).toContain("scene-complete");
        expect(receipt.scene.finalization).toMatchObject({
          finalStateCommitted: true,
          handoffCompleted: true,
          cleanupStarted: true,
          cleanupCompleted: true,
        });

        const requiredParts =
          scene.contract.version === 2
            ? scene.contract.targets.filter((target) => target.required).map((target) => target.part)
            : scene.contract.requiredTargets.map((target) => target.part);
        for (const part of requiredParts) {
          expect(receipt.targetReport.observations.find((candidate) => candidate.part === part)).toMatchObject({
            required: true,
            candidateCount: 1,
            visibleCount: 1,
            duplicateCount: 0,
            ownershipRejectedCount: 0,
          });
        }

        if (policy.localEnhancement) {
          if (motionCase.startingSection === policy.localEnhancement.section) {
            expect(receipt.localEnhancement).toEqual({
              expected: true,
              section: policy.localEnhancement.section,
              status: "ran",
              targetKeys: [...policy.localEnhancement.requiredHandleKeys],
            });
          } else {
            expect(receipt.localEnhancement).toEqual({
              expected: true,
              section: policy.localEnhancement.section,
              status: "unavailable",
              targetKeys: [],
            });
          }
        } else {
          expect(receipt.localEnhancement).toEqual({
            expected: false,
            section: null,
            status: "not-applicable",
            targetKeys: [],
          });
        }

        const acknowledged = await waitForPhase3Acknowledgment(page, fixture, command.event.id);
        expect(acknowledged.cursors).toEqual({
          observed: command.event.sequence,
          queued: command.event.sequence,
          presented: command.event.sequence,
          acknowledged: command.event.sequence,
        });
        expect(acknowledged.queue).toEqual({ activeRequestId: null, pendingCount: 0 });

        const settled = page.locator(`.progression-settled-notice[data-progress-event-id="${command.event.id}"]`);
        await expect(settled).toBeVisible();
        await expect(settled.getByRole("heading", { name: policy.globalPresentation.heading })).toBeVisible();
        await expect(settled.getByRole("button", { name: "Replay presentation" })).toBeEnabled();
        if (policy.relevantSection) {
          await expect(settled.getByRole("button", { name: new RegExp(policy.relevantSection, "iu") })).toBeEnabled();
        }
        const readableSummary = (await settled.locator("p").innerText()).trim();
        expect(readableSummary).toMatch(/\S/u);
        await expect(page.locator(`.voyage-shell.view-${motionCase.startingSection}`)).toBeVisible();
        await expect(focusTarget).toBeFocused();
        await expect(page.locator("[data-testid='progression-scene-host']")).toHaveAttribute(
          "data-scene-host-id",
          persistentHostId!,
        );
        await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");

        const after = await capturePhase3DbTruth(fixture);
        expect(command.event.sequence).toBe(before.campaign.currentSequence + 1);
        expect(after.campaign.currentSequence).toBe(command.event.sequence);
        expect(after.events.filter((event) => event.id === command.event.id)).toEqual([
          expect.objectContaining({ type: motionCase.eventType, sequence: command.event.sequence }),
        ]);
        expect(after.viewed.filter((viewed) => viewed.eventId === command.event.id)).toEqual([
          { eventId: command.event.id, deviceId: fixture.deviceId },
        ]);
      },
    );
  }
});
