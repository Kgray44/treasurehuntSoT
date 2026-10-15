// One owner-approved recovery; historical evidence never qualifies the new base.
import { createHash } from "node:crypto";

export const CROSSDECK_R4 = {
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R4",
  recordDigest: "3b4e21f9b75689a7e88f0e4ea7ba450b46d71fd9b6fe9a9852ac9836f212434d",
  predecessorDigest: "c05352f82f8e00f0911c8a24f5081185f839c190b475074fcc2c89e305395df9",
  frozenReferenceSha: "97cdcad1b60210efef07ac3bcbe407abda936baf",
  evidenceCommit: "ccd2988376c02313ff273d9d0742a5cbba530f2e",
  evidencePath: "Development_Docs/Testing/Product_Experience/candidate-review.json",
  evidenceSha256: "e29c4d4cb7010aeebc6f86ebb6d73de1efc036cadd99ba81c680590db8dbe06b",
  cancelledReview: {
    runId: 38805213385,
    runAttempt: 1,
    workflowId: 341545080,
    mode: "review",
    createdAt: "2026-10-15T20:50:42Z",
    conclusion: "cancelled",
    baseSha: "73ed4b380c764c32ee35f40e4dad7dfddbbb7e58",
    candidateSha: "63c64e8dc6f894087a7f6f7b45caff55f8317c9a",
    jobId: 116664176104,
    completedAt: "2026-10-15T20:55:49Z",
  },
  predecessor: {
    id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R3",
    namespace: "sounding-line-exceptions/PE-X-CROSSDECK-FINAL-VERIFY-20261015-R3",
    recordDigest: "c05352f82f8e00f0911c8a24f5081185f839c190b475074fcc2c89e305395df9",
    prepareCommit: "00e2e1ba20c9f746e0fe49b9eb14de63a9d76a32",
    runId: 38798375927,
    runAttempt: 1,
    workflowId: 341545080,
    createdAt: "2026-10-15T19:59:57Z",
    conclusion: "success",
    baseSha: "73ed4b380c764c32ee35f40e4dad7dfddbbb7e58",
    candidateSha: "63c64e8dc6f894087a7f6f7b45caff55f8317c9a",
    candidateTree: "bd15adef8cf1058950e2910f4dd6b976a100a574",
    sourceDigest: "5154d0703cae427ef1ac559b3f1affabce65278105b84859a5f7c5edaf347f18",
    contractDigest: "4ee636786ea5b2fedd375c3567441f151caa668d98934b01e98161c4c88c44ec",
    campaignEpoch: "2026-10-15T13:54Z",
    independentReviewsCompleted: 3,
    reservedIndependentReviewOrdinal: 4,
    artifacts: [
      {
        id: 12003734252,
        size: 1301581627,
        digest: "sha256:e8b9e055f4c0fcd84a39aa1e950da52761d0c1cc682250ad3671d2e830fd9c08",
      },
      {
        id: 12003933605,
        size: 38925,
        digest: "sha256:6ea201c9f8b4c7ed769ebe1950b14655d4d538ac5fc06f2c20f648a0edab21fa",
      },
    ],
  },
};
export function validateR4Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record.status) ||
    createHash("sha256")
      .update(JSON.stringify({ ...record, status: "ACTIVE" }))
      .digest("hex") !== CROSSDECK_R4.recordDigest
  )
    throw new Error("PRODUCT_EXPERIENCE_EXCEPTION_R4_RECORD_CHANGED");
}
