// Narrow extension of the existing Crossdeck finite-campaign authority.
import { createHash } from "node:crypto";

export const CROSSDECK_R3 = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R3",
  recordDigest: "c05352f82f8e00f0911c8a24f5081185f839c190b475074fcc2c89e305395df9",
  predecessorDigest: "857a5b7f19442cdc7b6ab522ac2382d2f20143b21fb9b5c67b271140b4313fe8",
  blockedCandidate: "bb69eed0cc930018bb4fe9e9f662a60ffa94dc11",
  evidenceCommit: "1f20f32b4e131c430ad923d4acd33f483b9f3c3b",
  reviewPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r2-verification-20261015/independent-review3/reviews.original.raw.txt",
  reviewSha256: "7a076defe5dcdf90c7c02ed1fd5d69dbaeb05eeaa2fd14a6c5ef68ef4ecb1faa",
  contractId: "homeport.shell.crossdeck-companion-mobile",
  journeyId: "companion-context-exit-return",
  route: "/player/playthroughs/00000000-0000-4000-8000-00000000cd11/journal",
  fixtureIds: {
    voyageId: "00000000-0000-4000-8000-00000000cd11",
    initialBlockId: "00000000-0000-4000-8000-00000000cd16",
    continuationBlockId: "00000000-0000-4000-8000-00000000cd17",
  },
  productPaths: [
    "src/components/player/journal/ChronicleJournalSession.tsx",
    "src/styles/chronicle.css",
    "src/styles/player.css",
  ],
  testPaths: [
    "src/components/player/journal/ChronicleJournalSession.test.ts",
    "tests/e2e/homeport-phase2.spec.ts",
    "tests/e2e/crossdeck-experience-refit.spec.ts",
    "tests/e2e/crossdeck-refit-recovery.spec.ts",
  ],
  localProofPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/r3-verification-20261015/targeted-local-proof.json",
  predecessor: {
    id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R2",
    namespace: "sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015-R2",
    recordDigest: "857a5b7f19442cdc7b6ab522ac2382d2f20143b21fb9b5c67b271140b4313fe8",
    prepareCommit: "4b3ca9e6914894b165d6177d1ff6e5673c7f711f",
    runId: 38777575631,
    runAttempt: 1,
    workflowId: 341545080,
    createdAt: "2026-10-15T17:28:06Z",
    conclusion: "success",
    baseSha: "aaef39a57d2c89ca57136dce327d337c5cb0ef7f",
    candidateSha: "bb69eed0cc930018bb4fe9e9f662a60ffa94dc11",
    candidateTree: "6b87c2010bcb18c4be9132891ceaa254678b516b",
    sourceDigest: "ad23861f9609e2ff3d98c95db78a030f9cb85ca491a7f2b99d42a05ed5f41dd8",
    contractDigest: "8c8d5ddbc67e23f784e4465067973e2eb9d5f3d8d95bf44c646de4079cdb306d",
    campaignEpoch: "2026-10-15T13:54Z",
    artifacts: [
      {
        id: 11994349912,
        size: 1280106820,
        digest: "sha256:a7ad43acf17670406802ca1a43dcc935f4b195dbc4fb39d35006716595f11a7b",
      },
      {
        id: 11994599532,
        size: 35709,
        digest: "sha256:9d7ab74b024e0c46917faf47c920816c5decf0214aa3f6125b896e075e82d6d5",
      },
    ],
  },
};
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R3_${code}`);
};

export function validateR3Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R3.recordDigest
  )
    fail("RECORD_CHANGED");
}

export function validateR3Contracts(original, proposed) {
  const before = structuredClone(original),
    after = structuredClone(proposed);
  const oldContract = before.contracts.find((c) => c.id === CROSSDECK_R3.contractId);
  const newContract = after.contracts.find((c) => c.id === CROSSDECK_R3.contractId);
  const oldJourney = oldContract?.experience.journeys.find((j) => j.id === CROSSDECK_R3.journeyId);
  const newJourney = newContract?.experience.journeys.find((j) => j.id === CROSSDECK_R3.journeyId);
  if (!oldJourney || !newJourney) fail("CONTRACT_SCOPE_CHANGED");
  const suffix = newJourney.steps.slice(oldJourney.steps.length);
  const proof = newContract.experience.localContinuationProof;
  const continuation = proof?.steps;
  if (
    suffix.length !== 1 ||
    hash(suffix[0]) !== hash({ action: "assert", role: "button", name: "Continue Voyage", unobscured: true }) ||
    !proof ||
    Object.keys(proof).join() !== "steps" ||
    !Array.isArray(continuation) ||
    continuation.length !== 2 ||
    hash(continuation[0]) !== hash({ action: "click", role: "button", name: "Continue Voyage" }) ||
    continuation[1].action !== "assert" ||
    continuation[1].kind !== "outcome" ||
    continuation[1].path !== CROSSDECK_R3.route ||
    continuation[1].state !== "RETURNED" ||
    continuation[1].role !== "main" ||
    continuation[1].name !== "" ||
    continuation[1].text !== "Voyage complete" ||
    typeof continuation[1].meaning !== "string" ||
    continuation[1].meaning.trim().length < 12 ||
    Object.keys(continuation[1]).some(
      (k) => !["action", "kind", "role", "name", "path", "state", "text", "meaning"].includes(k),
    )
  )
    fail("CONTINUATION_PROOF_REQUIRED");
  newJourney.steps = newJourney.steps.slice(0, oldJourney.steps.length);
  delete newContract.experience.localContinuationProof;
  if (hash(before) !== hash(after)) fail("CONTRACT_SCOPE_CHANGED");
}

export function r3LocalPlan(full, motionMode) {
  const contract = structuredClone(full.contracts.find((c) => c.id === CROSSDECK_R3.contractId));
  contract.experience.journeys[0].steps.push(...contract.experience.localContinuationProof.steps);
  return {
    ...full,
    localProof: CROSSDECK_R3.id,
    localProofMotionMode: motionMode,
    outputDirectory: `artifacts/sounding-line/r3-targeted-local-proof/${motionMode}`,
    contracts: [contract],
  };
}

export function validateR3LocalReceipt(receipt, plan) {
  if (
    receipt?.classification !== "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY" ||
    receipt.status !== "PASS" ||
    receipt.exceptionId !== CROSSDECK_R3.id ||
    receipt.baseSha !== plan.baseSha ||
    receipt.sourceDigest !== plan.sourceDigest ||
    receipt.contractDigest !== plan.contractDigest ||
    receipt.recordDigest !== plan.exception.recordDigest ||
    receipt.boundedRepairEvents !== 1 ||
    receipt.localProofInvocations !== 1 ||
    receipt.childReplayInvocations !== 2 ||
    receipt.fullPreparations !== 0 ||
    receipt.independentReviews !== 0 ||
    hash(receipt.contexts) !== hash(["MOBILE/PLAYER/NORMAL", "MOBILE/PLAYER/REDUCED"]) ||
    hash(receipt.declaredCanonicalFixtureIds) !== hash(CROSSDECK_R3.fixtureIds) ||
    !Array.isArray(receipt.isolatedFixtures) ||
    receipt.isolatedFixtures.length !== 2 ||
    new Set(receipt.isolatedFixtures.map((f) => f.databaseSha256)).size !== 2 ||
    ["NORMAL", "REDUCED"].some(
      (mode) =>
        receipt.isolatedFixtures.filter(
          (f) => f.motionMode === mode && f.profile === "generic" && /^[a-f0-9]{64}$/u.test(f.databaseSha256 ?? ""),
        ).length !== 1,
    ) ||
    !Array.isArray(receipt.artifacts) ||
    !receipt.artifacts.length ||
    receipt.artifacts.some((a) => !/^[a-f0-9]{64}$/u.test(a.sha256 ?? "")) ||
    !Array.isArray(receipt.journeys) ||
    receipt.journeys.length !== 2 ||
    ["NORMAL", "REDUCED"].some((motionMode) => {
      const journeys = receipt.journeys.filter((j) => j.motionMode === motionMode);
      const j = journeys[0];
      return (
        journeys.length !== 1 ||
        j.contractId !== CROSSDECK_R3.contractId ||
        j.id !== CROSSDECK_R3.journeyId ||
        j.device !== "MOBILE" ||
        j.role !== "PLAYER" ||
        j.status !== "PASS" ||
        !Number.isInteger(j.visibleActions) ||
        j.visibleActions < 3 ||
        !j.returnPathVerified ||
        !j.accessibility?.keyboard ||
        !j.accessibility?.focus ||
        !j.accessibility?.motionPreferenceVerified ||
        j.accessibility.overflow ||
        !j.unobscuredActions?.some(
          (a) =>
            a.role === "button" && a.name === "Continue Voyage" && a.viewportHitTest === true && a.trialClick === true,
        ) ||
        !j.observations?.some(
          (o) =>
            o.role === "main" &&
            o.name === "" &&
            o.text === "Voyage complete" &&
            o.meaning ===
              plan.contracts
                ?.find((c) => c.id === CROSSDECK_R3.contractId)
                ?.experience.localContinuationProof?.steps.at(-1).meaning,
        ) ||
        ["screenshot", "recording", "trace"].some(
          (type) =>
            !receipt.artifacts.some(
              (a) =>
                a.type === type &&
                a.motionMode === motionMode &&
                a.contractId === CROSSDECK_R3.contractId &&
                a.device === "MOBILE" &&
                a.role === "PLAYER",
            ),
        )
      );
    })
  )
    fail("LOCAL_PROOF_MISSING_OR_CHANGED");
}
