import { R21_MEDIA_PROTOCOL } from "./experience-media-first-r21.mjs";

export const R22_ID = "PE-X-CROSSDECK-CURRENT-VERIFY-20261020-R22";
export const R22_MEDIA_PROTOCOL = Object.freeze({
  ...R21_MEDIA_PROTOCOL,
  kind: "CROSSDECK_REVIEW12_PRE_SOURCE_ADMISSION_1",
  approvedAtUtcMinute: "2026-10-20T18:18Z",
  reviewOrdinal: 12,
  preSourceAdmissionRequired: true,
  excludedReviewerContexts: Object.freeze([
    ...R21_MEDIA_PROTOCOL.excludedReviewerContexts,
    "01a159fe-37c1-7469-9441-37a5e5c3c0d1",
  ]),
  excludedReviewerTaskPaths: Object.freeze([
    ...R21_MEDIA_PROTOCOL.excludedReviewerTaskPaths,
    "/root/r21_media_first_critic",
  ]),
  forbiddenHistoricalObservationDigests: Object.freeze([
    ...R21_MEDIA_PROTOCOL.forbiddenHistoricalObservationDigests,
    "09072285f1bbb1ae09f69860b8127a5670daf2de09107321194f4daf5539d7a3",
  ]),
  forbiddenHistoricalCaptureIds: Object.freeze([...R21_MEDIA_PROTOCOL.forbiddenHistoricalCaptureIds, 12281169039]),
});
