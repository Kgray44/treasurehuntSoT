import { CommunityError } from "./domain";
import type { CommunityBinaryScanReceipt } from "./scanner";
import type { SealedHoldPublicDerivativePort } from "./voyage-log-media";
import { db } from "@/lib/db";
import { LocalPrivateAssetStore } from "@/private-content/storage";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** The public seam exposes only opaque identifiers, never protected keys or URLs. */
export type HarborlightPublicMediaCandidate = Readonly<{
  sourceOpaqueId: string;
  subjectParticipantId?: string;
  detectedMediaType: "image/png" | "image/jpeg" | "image/webp";
  eligibility: "READY" | "QUARANTINED" | "UNAVAILABLE";
}>;
export type HarborlightPublicMediaSource = Readonly<{
  sourceOpaqueId: string;
  subjectParticipantId?: string;
  declaredMediaType: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
  scannerReceipt: Pick<CommunityBinaryScanReceipt, "result" | "sha256">;
}>;
export interface SealedHoldPublicMediaPort extends SealedHoldPublicDerivativePort {
  listOwnerAuthorizedCandidates(input: {
    ownerAccountId: string;
    voyageLogId: string;
  }): Promise<readonly HarborlightPublicMediaCandidate[]>;
  readOwnerAuthorizedSource(input: {
    ownerAccountId: string;
    voyageLogId: string;
    sourceOpaqueId: string;
  }): Promise<HarborlightPublicMediaSource>;
}
class NotConnectedSealedHoldPublicMediaPort implements SealedHoldPublicMediaPort {
  private unavailable(): never {
    throw new CommunityError(
      "COMMUNITY_PUBLIC_MEDIA_PROVIDER_NOT_CONFIGURED",
      "Public-media selection is unavailable until the Sealed Hold provider is connected.",
    );
  }
  async listOwnerAuthorizedCandidates(): Promise<readonly HarborlightPublicMediaCandidate[]> {
    return this.unavailable();
  }
  async readOwnerAuthorizedSource(): Promise<HarborlightPublicMediaSource> {
    return this.unavailable();
  }
  async writePublicDerivative(): Promise<{ opaqueDerivativeReference: string }> {
    return this.unavailable();
  }
}

const permittedMediaTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function configuredDerivativeRoot(value = process.env.SEALED_HOLD_PUBLIC_DERIVATIVE_ROOT) {
  if (!value || !path.isAbsolute(value)) return null;
  const root = path.resolve(value);
  const repository = path.resolve(process.cwd());
  if (root === repository || root.startsWith(`${repository}${path.sep}`)) return null;
  return root;
}

/**
 * Concrete local Sealed Hold bridge. It deliberately reads protected originals
 * only after the canonical owner/reference/scan checks and returns only opaque
 * source and derivative identifiers to Harborlight. The derivative directory is
 * deliberately outside Next public/build roots; a future delivery port can add
 * authorized rendering without ever disclosing its physical key.
 */
export class LocalSealedHoldPublicMediaPort implements SealedHoldPublicMediaPort {
  constructor(
    private readonly derivativesRoot: string,
    private readonly privateAssets = new LocalPrivateAssetStore(),
  ) {}

  async listOwnerAuthorizedCandidates(input: {
    ownerAccountId: string;
    voyageLogId: string;
  }): Promise<readonly HarborlightPublicMediaCandidate[]> {
    const owned = await db.communityVoyageLog.findFirst({
      where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
      select: { id: true },
    });
    if (!owned) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
    const assets = await db.privateAssetReference.findMany({
      where: {
        ownerAccountId: input.ownerAccountId,
        available: true,
        object: {
          finalizedAt: { not: null },
          quarantinedAt: null,
          scanStatus: "CLEAN",
          mediaType: { in: [...permittedMediaTypes] },
        },
      },
      select: { id: true, object: { select: { mediaType: true } } },
      orderBy: { id: "asc" },
      take: 48,
    });
    return assets.map((asset) => ({
      sourceOpaqueId: asset.id,
      detectedMediaType: asset.object.mediaType as HarborlightPublicMediaCandidate["detectedMediaType"],
      eligibility: "READY" as const,
    }));
  }

  async readOwnerAuthorizedSource(input: {
    ownerAccountId: string;
    voyageLogId: string;
    sourceOpaqueId: string;
  }): Promise<HarborlightPublicMediaSource> {
    const owned = await db.communityVoyageLog.findFirst({
      where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
      select: { id: true },
    });
    if (!owned) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
    const asset = await db.privateAssetReference.findFirst({
      where: {
        id: input.sourceOpaqueId,
        ownerAccountId: input.ownerAccountId,
        available: true,
        object: {
          finalizedAt: { not: null },
          quarantinedAt: null,
          scanStatus: "CLEAN",
          mediaType: { in: [...permittedMediaTypes] },
        },
      },
      select: { id: true, object: { select: { sha256: true, mediaType: true } } },
    });
    if (!asset) throw new CommunityError("COMMUNITY_MEDIA_NOT_AVAILABLE", "This protected media cannot be selected.");
    const bytes = new Uint8Array(await this.privateAssets.readObject(asset.object.sha256));
    const actualChecksum = createHash("sha256").update(bytes).digest("hex");
    if (actualChecksum !== asset.object.sha256)
      throw new CommunityError("COMMUNITY_MEDIA_NOT_READY", "The protected media checksum could not be verified.");
    return {
      sourceOpaqueId: asset.id,
      declaredMediaType: asset.object.mediaType as HarborlightPublicMediaSource["declaredMediaType"],
      bytes,
      scannerReceipt: { result: "CLEAN", sha256: asset.object.sha256 },
    };
  }

  async writePublicDerivative(input: {
    voyageLogId: string;
    sourceOpaqueId: string;
    derivativeChecksum: string;
    mediaType: string;
    bytes: Uint8Array;
  }): Promise<{ opaqueDerivativeReference: string }> {
    if (input.mediaType !== "image/webp" || !/^[a-f0-9]{64}$/.test(input.derivativeChecksum))
      throw new CommunityError("COMMUNITY_MEDIA_UNSAFE", "The public derivative is invalid.");
    const calculated = createHash("sha256").update(input.bytes).digest("hex");
    if (calculated !== input.derivativeChecksum)
      throw new CommunityError("COMMUNITY_MEDIA_UNSAFE", "The public derivative checksum changed.");
    const directory = path.join(this.derivativesRoot, "voyage-log-derivatives", input.derivativeChecksum.slice(0, 2));
    const target = path.join(directory, input.derivativeChecksum);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(target, input.bytes, { flag: "wx", mode: 0o600 });
    } catch (cause) {
      const existing = await readFile(target).catch(() => null);
      if (!existing || createHash("sha256").update(existing).digest("hex") !== input.derivativeChecksum) throw cause;
    }
    // A random-looking reference is a capability-free identifier, not a path or key.
    return { opaqueDerivativeReference: `public-derivative-${input.derivativeChecksum}` };
  }
}

/** No filesystem fallback: a concrete bridge is enabled only with both owned roots configured. */
export function getSealedHoldPublicMediaPort(): SealedHoldPublicMediaPort {
  const root = configuredDerivativeRoot();
  if (root && process.env.PRIVATE_CONTENT_ROOT && process.env.PRIVATE_CONTENT_STAGING_ROOT)
    return new LocalSealedHoldPublicMediaPort(root);
  return new NotConnectedSealedHoldPublicMediaPort();
}
