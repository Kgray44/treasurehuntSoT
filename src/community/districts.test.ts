import { describe, expect, it } from "vitest";
import { communityDistrictIds, communityDistricts, visibleCommunityDistricts } from "./districts";

describe("Homeport Community district registry", () => {
  it("has unique governed identities, routes, and valid parents", () => {
    expect(new Set(communityDistricts.map((district) => district.id)).size).toBe(communityDistricts.length);
    expect(new Set(communityDistricts.map((district) => district.route)).size).toBe(communityDistricts.length);
    expect(communityDistricts.map((district) => district.id)).toEqual(communityDistrictIds);
    for (const district of communityDistricts) {
      expect([
        "ACTIVE_COMPLETE",
        "ACTIVE_EMPTY_SUPPORTED",
        "PREVIEW",
        "REDIRECT_TO_PARENT",
        "DEVELOPMENT_ONLY",
        "NOT_SUPPORTED",
      ]).toContain(district.status);
      if (district.parent) expect(communityDistrictIds).toContain(district.parent);
      expect(district.route).toMatch(/^\/community(?:\/[-a-z]+)*(?:\?category=[-a-z]+)?$/u);
      expect(district.emptyAction.href).toMatch(/^\//u);
    }
  });

  it("exposes exactly Harbor Home and ten active districts on every viewport", () => {
    expect(visibleCommunityDistricts).toHaveLength(11);
    expect(visibleCommunityDistricts.map((district) => district.id)).not.toContain("SHIPWRIGHTS_WORKSHOP");
    expect(visibleCommunityDistricts[0]).toMatchObject({ id: "HARBOR_HOME", route: "/community" });
  });
});
