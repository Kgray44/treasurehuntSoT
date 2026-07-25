import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { LocalSealedHoldPublicMediaPort, getSealedHoldPublicMediaPort } from "./sealed-hold-public-media";

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

  it("persists an attested derivative outside browser-visible paths and returns no storage key", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harborlight-public-derivative-"));
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const digest = createHash("sha256").update(bytes).digest("hex");
    try {
      const port = new LocalSealedHoldPublicMediaPort(root, {} as never);
      await expect(
        port.writePublicDerivative({
          voyageLogId: "log-1",
          sourceOpaqueId: "private-asset-1",
          derivativeChecksum: digest,
          mediaType: "image/webp",
          bytes,
        }),
      ).resolves.toEqual({ opaqueDerivativeReference: `public-derivative-${digest}` });
      await expect(readFile(path.join(root, "voyage-log-derivatives", digest.slice(0, 2), digest))).resolves.toEqual(
        Buffer.from(bytes),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
