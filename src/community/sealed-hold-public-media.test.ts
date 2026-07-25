import { describe, expect, it } from "vitest";
import { getSealedHoldPublicMediaPort } from "./sealed-hold-public-media";

describe("Sealed Hold public-media boundary", () => {
  it("fails closed while no concrete Sealed Hold runtime adapter is connected", async () => {
    const port = getSealedHoldPublicMediaPort();
    await expect(
      port.listOwnerAuthorizedCandidates({ ownerAccountId: "owner-1", voyageLogId: "log-1" }),
    ).rejects.toMatchObject({
      code: "COMMUNITY_PUBLIC_MEDIA_PROVIDER_NOT_CONFIGURED",
    });
    await expect(
      port.readOwnerAuthorizedSource({ ownerAccountId: "owner-1", voyageLogId: "log-1", sourceOpaqueId: "media-1" }),
    ).rejects.toMatchObject({
      code: "COMMUNITY_PUBLIC_MEDIA_PROVIDER_NOT_CONFIGURED",
    });
  });
});
