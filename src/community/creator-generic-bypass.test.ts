import { describe, expect, it } from "vitest";
import { createRelease } from "./services";
import {
  preflightCommunityPublication,
  reviewVerifiedCommunityPackage,
  installVerifiedCommunityPackage,
} from "./exchange-service";

describe("Community source authority", () => {
  it("refuses caller supplied generic releases and package/install receipts", async () => {
    await expect(
      createRelease({ accountId: "untrusted" }, "listing", {
        sourcePublishedTaleVersionId: "another-creators-version",
      }),
    ).rejects.toMatchObject({ code: "COMMUNITY_DEDICATED_FLOW_REQUIRED" });
    await expect(preflightCommunityPublication("untrusted", "release", {}, [])).rejects.toMatchObject({
      code: "COMMUNITY_DEDICATED_FLOW_REQUIRED",
    });
    await expect(reviewVerifiedCommunityPackage({ packageId: "untrusted" })).rejects.toMatchObject({
      code: "COMMUNITY_DEDICATED_FLOW_REQUIRED",
    });
    await expect(installVerifiedCommunityPackage({ finalizationSucceeded: true })).rejects.toMatchObject({
      code: "COMMUNITY_DEDICATED_FLOW_REQUIRED",
    });
  });
});
