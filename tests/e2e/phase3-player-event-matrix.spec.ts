import { getSceneDefinition } from "../../src/animation/director/scene-registry";
import { policyForProgressionEvent } from "../../src/components/player/progression/event-policy";
import {
  PHASE3_MATRIX_CASES,
  PHASE3_MOTION_MODES,
  capturePhase3DbTruth,
  expect,
  openPhase3Player,
  phase3Test,
  readPhase3Evidence,
  setPhase3Motion,
  waitForPhase3Acknowledgment,
  waitForPhase3Receipt,
  type Phase3CaseFixture,
  type Phase3DbTruth,
  type Phase3EventType,
} from "./fixtures/lanternwake-phase3";

const phase3MatrixTestTitles = PHASE3_MATRIX_CASES.map(
  (matrixCase) => `${matrixCase.caseId} ${matrixCase.startingSection} x ${matrixCase.eventType}`,
);
if (
  phase3MatrixTestTitles.length !== 102 ||
  new Set(phase3MatrixTestTitles).size !== 102 ||
  !phase3MatrixTestTitles.every((title) => /^P3-CASE-\d{3} /u.test(title))
) {
  throw new Error("The ordinary full-motion Player event matrix must register exactly 102 unique P3-CASE tests.");
}

function expectStoryMutation(
  before: Phase3DbTruth,
  after: Phase3DbTruth,
  eventType: Phase3EventType,
  fixture: Phase3CaseFixture,
) {
  switch (eventType) {
    case "CHAPTER_RELEASED":
      expect(before.chapter.state).toBe("READY");
      expect(after.chapter).toMatchObject({ state: "ACTIVE", revealedAt: expect.any(Date) });
      break;
    case "CHAPTER_SOLVED":
      expect(before.chapter.state).toBe("ACTIVE");
      expect(after.chapter).toMatchObject({ state: "SOLVED", solvedAt: expect.any(Date) });
      break;
    case "ARTIFACT_AWARDED":
      expect(after.storyMutation.awards).toHaveLength(before.storyMutation.awards.length + 1);
      break;
    case "ARTIFACT_SILHOUETTE_REVEALED":
      expect(after.storyMutation.artifacts.find((item) => item.key === fixture.artifactKey)?.state).toBe("SILHOUETTE");
      break;
    case "ARTIFACT_CONNECTED":
      expect(
        after.storyMutation.artifacts
          .filter((item) => [fixture.artifactKey, fixture.connectedArtifactKey].includes(item.key))
          .every((item) => item.state === "CONNECTED"),
      ).toBe(true);
      break;
    case "MAP_LOCATION_REVEALED":
      expect(after.storyMutation.mapLocations.find((item) => item.key === fixture.mapLocationKey)).toMatchObject({
        state: "REVEALED",
        revealedAt: expect.any(Date),
      });
      break;
    case "MAP_ROUTE_REVEALED":
      expect(after.storyMutation.mapRoutes.find((item) => item.key === fixture.mapRouteKey)).toMatchObject({
        state: "REVEALED",
        revealedAt: expect.any(Date),
      });
      break;
    case "SIDE_QUEST_DISCOVERED":
      expect(after.storyMutation.sideQuests.find((item) => item.key === fixture.sideQuestKey)?.state).toBe(
        "DISCOVERED",
      );
      break;
    case "SIDE_QUEST_UPDATED":
      expect(after.storyMutation.sideQuests.find((item) => item.key === fixture.sideQuestKey)?.state).toBe("ACTIVE");
      break;
    case "SIDE_QUEST_COMPLETED":
      expect(after.storyMutation.sideQuests.find((item) => item.key === fixture.sideQuestKey)).toMatchObject({
        state: "COMPLETE",
        completedAt: expect.any(Date),
      });
      break;
    case "JOURNAL_ANNOTATION_ADDED":
      expect(after.storyMutation.journalEntries).toHaveLength(before.storyMutation.journalEntries.length + 1);
      expect(after.storyMutation.journalEntries.at(-1)?.kind).toBe("ANNOTATION");
      break;
    case "PLAYER_LOG_ENTRY_ADDED":
      expect(after.events).toHaveLength(before.events.length + 1);
      break;
    case "FINALE_TEASED":
      expect(after.campaign.finaleState).toBe("TEASED");
      break;
    case "FINALE_REQUIREMENT_UPDATED":
      expect(after.campaign.finaleState).toBe("REQUIREMENTS_PARTIAL");
      break;
    case "CAMPAIGN_PAUSED":
      expect(after.campaign.status).toBe("PAUSED");
      break;
    case "CAMPAIGN_RESUMED":
      expect(before.campaign.status).toBe("PAUSED");
      expect(after.campaign.status).toBe("ACTIVE");
      break;
    case "STATE_REVERTED":
      expect(after.events.at(-1)).toMatchObject({ reversesEventId: fixture.prerequisiteEventId });
      break;
  }
}

phase3Test.describe("Lanternwake Phase 3 exact Player event matrix", () => {
  phase3Test.describe.configure({ mode: "parallel" });
  phase3Test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The exact 102-case story mutation matrix runs only in Chromium against the isolated copied database.",
  );

  for (const matrixCase of PHASE3_MATRIX_CASES) {
    phase3Test(
      `${matrixCase.caseId} ${matrixCase.startingSection} x ${matrixCase.eventType}`,
      async ({ page, phase3 }) => {
        phase3Test.setTimeout(45_000);
        await page.setViewportSize({ width: 1_440, height: 900 });
        await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
        await phase3.proveIsolation();
        const fixture = await phase3.createCase(matrixCase.caseId, matrixCase.eventType);
        const persistentHostId = await openPhase3Player(page, fixture, matrixCase.startingSection);
        expect(persistentHostId).toMatch(/\S/u);

        const focusTarget = page.locator(".section-transition [data-section-heading]");
        await focusTarget.focus();
        const focusIdentity = crypto.randomUUID();
        await focusTarget.evaluate((element, identity) => {
          (element as HTMLElement).dataset.phase3FocusIdentity = identity;
        }, focusIdentity);
        const before = await capturePhase3DbTruth(fixture);

        const command = await phase3.publish(fixture);
        expect(command.event.type).toBe(matrixCase.eventType);
        expect(command.event.sequence).toBe(before.campaign.currentSequence + 1);

        const receipt = await waitForPhase3Receipt(page, command.event.id);
        const policy = policyForProgressionEvent(matrixCase.eventType);
        const scene = getSceneDefinition(policy.sceneName);
        expect(receipt).toMatchObject({
          eventId: command.event.id,
          eventType: matrixCase.eventType,
          eventSequence: command.event.sequence,
          source: "live",
          status: "presented",
          fallbackResult: "not-used",
          finalStateResult: expect.stringMatching(/^(committed|reconciled)$/u),
          restorationResult: expect.stringMatching(
            /^(exact-target|destination-control|section-heading|section-only)$/u,
          ),
          acknowledgmentEligible: true,
          currentSection: matrixCase.startingSection,
          returnSection: matrixCase.startingSection,
          motionPolicy: { level: "full", source: { productSetting: "full", browserPrefersReduced: false } },
          scene: {
            sceneName: policy.sceneName,
            hostId: persistentHostId,
            hostKind: "player-progression",
            cleanup: expect.stringMatching(/^completed/u),
          },
          targetReport: { requiredSatisfied: true, failures: [] },
        });
        expect(receipt.scene).not.toBeNull();
        expect(receipt.targetReport).not.toBeNull();
        expect(receipt.scene!.sceneInstanceId).not.toBe(receipt.requestId);
        expect(receipt.scene!.sceneInstanceId).toMatch(/\S/u);
        expect(receipt.scene!.finalization).toMatchObject({
          finalStateCommitted: true,
          handoffCompleted: true,
          cleanupStarted: true,
          cleanupCompleted: true,
          cleanupResult: expect.stringMatching(/^completed/u),
        });
        expect(receipt.semanticLabels).toContain("scene-complete");

        const requiredParts =
          scene.contract.version === 2
            ? scene.contract.targets.filter((target) => target.required).map((target) => target.part)
            : scene.contract.requiredTargets.map((target) => target.part);
        for (const part of requiredParts) {
          const observation = receipt.targetReport!.observations.find((candidate) => candidate.part === part);
          expect(observation, `Missing preflight evidence for required part ${part}`).toMatchObject({
            targetKey: expect.any(String),
            required: true,
            candidateCount: 1,
            matchedCount: 1,
            visibleCount: 1,
            duplicateCount: 0,
            ownershipRejectedCount: 0,
            acceptedTargetIds: [],
            rejectionCodes: [],
            resolutionDetail: "unavailable-in-director-receipt",
          });
        }
        const allowedParts =
          scene.contract.version === 2
            ? scene.contract.targets.map((target) => target.part)
            : [...scene.contract.requiredTargets, ...scene.contract.optionalTargets].map((target) => target.part);
        expect(receipt.targetReport!.observations.map((observation) => observation.part)).toEqual(
          expect.arrayContaining(requiredParts),
        );
        expect(
          receipt.targetReport!.observations.every((observation) => allowedParts.includes(observation.part)),
          "Preflight must not consume an unrelated scene target.",
        ).toBe(true);

        if (policy.localEnhancement) {
          const consumedLocalTargets = receipt
            .targetReport!.observations.filter(
              (observation) => observation.targetKey?.startsWith("local-") && observation.candidateCount > 0,
            )
            .map((observation) => observation.targetKey);
          expect(receipt.localEnhancement).toMatchObject({
            expected: true,
            section: policy.localEnhancement.section,
            status:
              matrixCase.startingSection === policy.localEnhancement.section
                ? expect.stringMatching(/^(ran|unavailable)$/u)
                : "unavailable",
          });
          if (receipt.localEnhancement.status === "ran") {
            expect(receipt.localEnhancement.targetKeys).toEqual(
              expect.arrayContaining([...policy.localEnhancement.requiredHandleKeys]),
            );
            expect(consumedLocalTargets).toEqual(
              expect.arrayContaining(
                policy.localEnhancement.requiredHandleKeys.map((targetKey) => `local-${targetKey}`),
              ),
            );
          } else if (matrixCase.startingSection === policy.localEnhancement.section) {
            expect(consumedLocalTargets.length).toBeLessThanOrEqual(policy.localEnhancement.requiredHandleKeys.length);
          } else {
            expect(consumedLocalTargets).toEqual([]);
          }
        } else {
          expect(receipt.localEnhancement).toEqual({
            expected: false,
            section: null,
            status: "not-applicable",
            targetKeys: [],
          });
        }

        const state = await waitForPhase3Acknowledgment(page, fixture, command.event.id);
        expect(state.cursors).toEqual({
          observed: command.event.sequence,
          queued: command.event.sequence,
          presented: command.event.sequence,
          acknowledged: command.event.sequence,
        });
        expect(state.queue).toEqual({ activeRequestId: null, pendingCount: 0 });
        const requestStates = (await readPhase3Evidence(page)).states.filter(
          (candidate) => candidate.requestId === receipt.requestId,
        );
        expect(requestStates.some((candidate) => candidate.queue.activeRequestId === receipt.requestId)).toBe(true);
        expect(requestStates.every((candidate) => candidate.queue.pendingCount <= 1)).toBe(true);

        await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(1);
        await expect(page.locator("[data-testid='progression-scene-host']")).toHaveAttribute(
          "data-scene-host-id",
          persistentHostId!,
        );
        await expect(page.locator("[data-progression-overlay]")).toHaveAttribute("data-progression-state", "inactive");
        await expect(page.locator("[data-progression-content]")).not.toHaveAttribute("inert", "");
        await expect(page.locator(`.voyage-shell.view-${matrixCase.startingSection}`)).toBeVisible();
        await expect(focusTarget).toHaveAttribute("data-phase3-focus-identity", focusIdentity);
        await expect(focusTarget).toBeFocused();
        await expect(page.locator("[data-pageflip-source] [data-scene-target-id]")).toHaveCount(0);
        await expect(page.locator("[data-progression-overlay] [data-pageflip-source]")).toHaveCount(0);

        const after = await capturePhase3DbTruth(fixture);
        expectStoryMutation(before, after, matrixCase.eventType, fixture);
        expect(after.campaign.currentSequence).toBe(command.event.sequence);
        expect(after.events.filter((event) => event.id === command.event.id)).toEqual([
          expect.objectContaining({ type: matrixCase.eventType, sequence: command.event.sequence }),
        ]);
        expect(after.viewed.filter((viewed) => viewed.eventId === command.event.id)).toEqual([
          { eventId: command.event.id, deviceId: fixture.deviceId },
        ]);
        expect(after.commands.filter((candidate) => candidate.command === matrixCase.command).at(-1)).toMatchObject({
          expectedSequence: before.campaign.currentSequence,
          status: "SUCCEEDED",
        });
        expect(after.audits.filter((audit) => audit.correlationId === command.correlationId)).toEqual([
          expect.objectContaining({ action: matrixCase.command, outcome: "SUCCEEDED" }),
        ]);
      },
    );
  }
});
