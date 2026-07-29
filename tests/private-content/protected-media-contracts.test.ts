import { describe, expect, it } from "vitest";
import {
  createProtectedMediaConsentAssertion,
  validateProtectedMediaConsentAssertion,
} from "@/private-content/media/consent-assertion";
import { requireProtectedMediaPurposePolicy } from "@/private-content/media/purpose-policy";

const base = () =>
  createProtectedMediaConsentAssertion({
    id: "consent-1",
    authority: "HARBORLIGHT",
    authorityRecordOpaqueId: "receipt-1",
    authorityRevision: "r1",
    subjectOpaqueId: "log-1",
    consumingAggregateKind: "HARBORLIGHT_VOYAGE_LOG",
    consumingAggregateOpaqueId: "log-1",
    purpose: "VOYAGE_LOG_COMMUNITY",
    scopes: ["PHOTO"],
    state: "GRANTED",
    sourceProtectedMediaId: "media-1",
    sourceChecksum: "a".repeat(64),
    requestedTransformationPolicy: "sealed-hold-public-image-v1",
    validFrom: new Date("2026-07-25T00:00:00.000Z"),
    sourceWatermark: "w1",
  });

describe("protected media contracts", () => {
  it("fails closed on purpose/audience escalation", () => {
    expect(() =>
      requireProtectedMediaPurposePolicy({
        purpose: "MEMORY_PRIVATE",
        audience: "PUBLIC",
        kind: "IMAGE",
        authority: "WAYFARER",
      }),
    ).toThrow(expect.objectContaining({ code: "PROTECTED_MEDIA_PURPOSE_FORBIDDEN" }));
    expect(() =>
      requireProtectedMediaPurposePolicy({
        purpose: "VOYAGE_LOG_COMMUNITY",
        audience: "PUBLIC",
        kind: "IMAGE",
        authority: "HARBORLIGHT",
      }),
    ).toThrow(expect.objectContaining({ code: "PROTECTED_MEDIA_PURPOSE_FORBIDDEN" }));
  });

  it("binds consent to the exact source, aggregate, and final derivative", () => {
    const assertion = base();
    expect(() =>
      validateProtectedMediaConsentAssertion({
        assertion,
        authority: "HARBORLIGHT",
        purpose: "VOYAGE_LOG_COMMUNITY",
        sourceMediaId: "media-1",
        sourceChecksum: "b".repeat(64),
        aggregateKind: "HARBORLIGHT_VOYAGE_LOG",
        aggregateId: "log-1",
        requiredScopes: ["PHOTO"],
      }),
    ).toThrow(expect.objectContaining({ code: "PROTECTED_MEDIA_CONSENT_INVALID" }));
    const final = createProtectedMediaConsentAssertion({
      ...assertion,
      derivativeId: "derivative-1",
      derivativeChecksum: "c".repeat(64),
    });
    expect(() =>
      validateProtectedMediaConsentAssertion({
        assertion: final,
        authority: "HARBORLIGHT",
        purpose: "VOYAGE_LOG_COMMUNITY",
        sourceMediaId: "media-1",
        sourceChecksum: "a".repeat(64),
        aggregateKind: "HARBORLIGHT_VOYAGE_LOG",
        aggregateId: "log-1",
        requiredScopes: ["PHOTO"],
        derivativeId: "derivative-1",
        derivativeChecksum: "d".repeat(64),
      }),
    ).toThrow(expect.objectContaining({ code: "PROTECTED_MEDIA_CONSENT_INVALID" }));
  });
});
