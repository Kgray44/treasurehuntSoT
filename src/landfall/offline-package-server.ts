import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import {
  offlineManifestPayload,
  offlinePackageManifestSchema,
  type OfflinePackageEnvelope,
  type OfflinePackageScope,
  type OfflinePackageResource,
} from "@/landfall/offline-package";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

export function landfallPackageSigningKey(): { id: string; privateKey: KeyObject; publicKey: JsonWebKey } | null {
  const pem = process.env.LANDFALL_PACKAGE_SIGNING_KEY;
  const id = process.env.LANDFALL_PACKAGE_KEY_ID;
  if (!pem || !id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  try {
    const privateKey = createPrivateKey(pem.replaceAll("\\n", "\n"));
    if (privateKey.asymmetricKeyType !== "ed25519") return null;
    return { id, privateKey, publicKey: createPublicKey(privateKey).export({ format: "jwk" }) as JsonWebKey };
  } catch {
    return null;
  }
}

export type LandfallPackageMaterial = { envelope: OfflinePackageEnvelope; chunks: ReadonlyMap<string, Uint8Array> };
/** Input must be the membership-authorized, released Player projection. Never accepts a full definition. */
export function buildLandfallOfflinePackage(input: {
  bootstrap: PlayerLandfallBootstrap;
  scope: OfflinePackageScope;
  signing: NonNullable<ReturnType<typeof landfallPackageSigningKey>>;
  issuedAt: number;
  expiresAt: number;
  assets: readonly {
    id: string;
    bytes: Uint8Array;
    mime: "image/png" | "image/jpeg" | "image/webp";
    attribution: string;
  }[];
  maxBytes?: number;
}): LandfallPackageMaterial {
  if (
    input.bootstrap.sessionId !== input.scope.sessionId ||
    input.bootstrap.publishedVersionId !== input.scope.publishedVersionId ||
    !input.bootstrap.runtimeDefinition.worldspaces.some((world) => world.id === input.scope.worldspaceId)
  )
    throw new Error("LANDFALL_PACKAGE_SCOPE_MISMATCH");
  const world = input.bootstrap.runtimeDefinition.worldspaces.find((world) => world.id === input.scope.worldspaceId)!;
  const released = structuredClone(input.bootstrap);
  const bootstrap: PlayerLandfallBootstrap = {
    ...released,
    scene: { ...released.scene, currentPosition: null },
    availableMaps: released.availableMaps?.map((map) => ({ ...map, scene: { ...map.scene, currentPosition: null } })),
  };
  const chunks = new Map<string, Uint8Array>();
  const resources: OfflinePackageResource[] = [];
  const add = (
    id: string,
    kind: OfflinePackageResource["kind"],
    bytes: Uint8Array,
    mime: OfflinePackageResource["mime"],
    attribution: string,
  ) => {
    // Packages are bounded chunks; large assets are reported as unavailable, never silently truncated.
    if (!bytes.length || bytes.length > 1024 * 1024) throw new Error("LANDFALL_PACKAGE_RESOURCE_TOO_LARGE");
    chunks.set(id, bytes);
    resources.push({
      id,
      kind,
      bytes: bytes.length,
      mime,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      attribution,
      license: "Authorized published first-party content",
      offlineRights: "ALLOWED",
    });
  };
  add(
    "released-chart",
    "CHART",
    new TextEncoder().encode(JSON.stringify(bootstrap)),
    "application/json",
    "Published Voyage chart",
  );
  add(
    "released-routes",
    "ROUTE",
    new TextEncoder().encode(JSON.stringify(bootstrap.runtimeDefinition.routes)),
    "application/json",
    "Creator-authored guidance; no accessibility or safety certification",
  );
  const releasedIds = new Set(
    [bootstrap.scene, ...(bootstrap.availableMaps ?? []).map((map) => map.scene)]
      .flatMap((scene) => [scene.imageAssetId, ...scene.overlays.map((overlay) => overlay.assetId)])
      .filter(Boolean),
  );
  for (const asset of input.assets) {
    if (!releasedIds.has(asset.id)) throw new Error("LANDFALL_PACKAGE_UNRELEASED_ASSET");
    add(`asset-${asset.id}`, "ASSET", asset.bytes, asset.mime, asset.attribution);
  }
  const id = `region-${createHash("sha256")
    .update(JSON.stringify([input.scope, bootstrap.currentSequence, input.issuedAt]))
    .digest("hex")
    .slice(0, 32)}`;
  const manifest = offlinePackageManifestSchema.parse({
    version: 1,
    id,
    keyId: input.signing.id,
    scope: input.scope,
    worldspaceKind: world.kind,
    revealedSequence: bootstrap.currentSequence,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    resources,
    totalBytes: resources.reduce((total, item) => total + item.bytes, 0),
  });
  if (manifest.totalBytes > (input.maxBytes ?? 256 * 1024 * 1024)) throw new Error("LANDFALL_PACKAGE_CONFIGURED_QUOTA");
  return {
    envelope: {
      manifest,
      signature: sign(null, offlineManifestPayload(manifest), input.signing.privateKey).toString("base64url"),
    },
    chunks,
  };
}
