import { describe, expect, it } from "vitest";
import {
  activePublicationConsent,
  harborlightVoyageLogPublicationPurpose,
  publicationConsentKey,
  voyageLogConsentScopes,
} from "./voyage-log-consent";

describe("Harborlight Voyage Log publication consent policy", () => {
  it("uses a distinct, purpose-specific consent key for every bounded public scope", () => {
    expect(harborlightVoyageLogPublicationPurpose).toBe("HARBORLIGHT_VOYAGE_LOG_PUBLICATION");
    expect(voyageLogConsentScopes).toEqual([
      "DISPLAY_NAME",
      "ALIAS",
      "AVATAR",
      "QUOTE",
      "PHOTO",
      "AUDIO",
      "OTHER_MEDIA",
    ]);
    expect(publicationConsentKey("PHOTO")).toBe("HARBORLIGHT_VOYAGE_LOG_PUBLICATION:PHOTO");
  });

  it("fails closed for a different purpose, revocation, expiry, or a non-approved decision", () => {
    const approved = {
      purpose: publicationConsentKey("DISPLAY_NAME"),
      state: "APPROVED",
      grantedAt: new Date("2026-07-25T12:00:00Z"),
      revokedAt: null,
      expiresAt: null,
    };
    expect(activePublicationConsent(approved, new Date("2026-07-25T12:01:00Z"))).toBe(true);
    expect(
      activePublicationConsent({ ...approved, purpose: "WAYFARER_PRIVATE_KEEPSAKE" }, new Date("2026-07-25T12:01:00Z")),
    ).toBe(false);
    expect(
      activePublicationConsent(
        { ...approved, revokedAt: new Date("2026-07-25T12:00:30Z") },
        new Date("2026-07-25T12:01:00Z"),
      ),
    ).toBe(false);
    expect(
      activePublicationConsent(
        { ...approved, expiresAt: new Date("2026-07-25T12:00:30Z") },
        new Date("2026-07-25T12:01:00Z"),
      ),
    ).toBe(false);
    expect(
      activePublicationConsent({ ...approved, state: "DECLINED", grantedAt: null }, new Date("2026-07-25T12:01:00Z")),
    ).toBe(false);
  });
});
