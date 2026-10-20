import { validatePinnedMediaFirstReview } from "./experience-media-first-r21.mjs";
import { R22_ID, R22_MEDIA_PROTOCOL } from "./experience-media-first-r22-policy.mjs";
import { validatePreSourceAdmissionReceipts } from "./experience-review-source-gate.mjs";

export function validateR22MediaFirstReview(plan, evidence, now = new Date()) {
  const result = validatePinnedMediaFirstReview(plan, evidence, now, {
    id: R22_ID,
    version: 22,
    ordinal: 12,
    policy: R22_MEDIA_PROTOCOL,
  });
  validatePreSourceAdmissionReceipts(plan, evidence, now);
  return result;
}
