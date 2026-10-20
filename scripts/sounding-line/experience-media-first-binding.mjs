import { R22_ID } from "./experience-media-first-r22-policy.mjs";
import { r21ReviewProvenanceBinding } from "./experience-media-first-r21.mjs";
import { mediaFirstDigest } from "./experience-media-first-shared.mjs";
import { validatePreSourceAdmissionReceipts } from "./experience-review-source-gate.mjs";

export function mediaFirstReviewProvenanceBinding(plan, evidence) {
  if (plan.exception?.id !== R22_ID) return r21ReviewProvenanceBinding(plan, evidence);
  const { admission, stage, disclosure } = validatePreSourceAdmissionReceipts(plan, evidence);
  return {
    mediaFirstReviewDigest: mediaFirstDigest(evidence.mediaFirstReview),
    preSourceAdmissionDigest: mediaFirstDigest(admission),
    sourcePacketStageDigest: mediaFirstDigest(stage),
    sourceDisclosureDigest: mediaFirstDigest(disclosure),
  };
}
