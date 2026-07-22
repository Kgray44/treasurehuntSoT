import type { Readable } from "node:stream";
import type { PrivateContentAuthorization } from "./authorization";
import type { PrivateObjectDescriptor, PrivateScanState, PrivateStorageProvider } from "./contracts";
import { privateFailure } from "./core";

export type PrivateDeliveryAsset = {
  id: string;
  object: PrivateObjectDescriptor;
  scanState: PrivateScanState;
  mediaType: string;
  immediateRevocation?: boolean;
};

export type PrivateByteRange = { start: number; end: number };
export type PrivateDelivery = {
  stream: Readable;
  status: 200 | 206;
  headers: Record<string, string>;
};

/** Parse one bounded HTTP byte range. Multiple ranges deliberately stay unsupported. */
export function parsePrivateByteRange(value: string | undefined, byteLength: number): PrivateByteRange | undefined {
  if (!value) return undefined;
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 || !/^bytes=\d*-\d*$/.test(value))
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
  const [startText, endText] = value.slice("bytes=".length).split("-");
  if (!startText && !endText) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
  if (!startText) {
    const length = Number(endText);
    if (!Number.isSafeInteger(length) || length < 1) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    return { start: Math.max(0, byteLength - length), end: byteLength - 1 };
  }
  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : byteLength - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= byteLength ||
    requestedEnd < start
  )
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
  return { start, end: Math.min(requestedEnd, byteLength - 1) };
}

/**
 * Private reads remain application-mediated so scan state and revocation are
 * evaluated immediately before the provider stream is opened. Callers expose
 * the same opaque failure for absent, unauthorized, and unsafe assets.
 */
export class PrivateAssetDeliveryService {
  constructor(
    private readonly storage: PrivateStorageProvider,
    private readonly authorization: Pick<PrivateContentAuthorization, "canReadPrivateAsset">,
  ) {}

  async open(input: {
    asset: PrivateDeliveryAsset;
    playthroughId?: string | null;
    range?: string;
  }): Promise<PrivateDelivery> {
    const allowed = await this.authorization.canReadPrivateAsset({
      assetId: input.asset.id,
      playthroughId: input.playthroughId,
    });
    // CLEAN is the only state allowed to reach a private delivery provider.
    if (!allowed || input.asset.scanState !== "CLEAN") throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    const range = parsePrivateByteRange(input.range, input.asset.object.byteLength);
    const stream = await this.storage.read(input.asset.object, range);
    const length = range ? range.end - range.start + 1 : input.asset.object.byteLength;
    const headers: Record<string, string> = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Length": String(length),
      "Content-Type": input.asset.mediaType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "attachment",
      "Cross-Origin-Resource-Policy": "same-site",
    };
    if (range) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${input.asset.object.byteLength}`;
    return { stream, status: range ? 206 : 200, headers };
  }
}

export type PrivateScanEnforcement =
  | { outcome: "PROMOTE"; scanState: "CLEAN" }
  | { outcome: "QUARANTINE"; scanState: Exclude<PrivateScanState, "CLEAN" | "PENDING" | "SCANNING">; reason: string };

/** Never translate failed, suspicious, malicious, or unconfigured scanner results into CLEAN. */
export function enforcePrivateScanState(
  scanState: Exclude<PrivateScanState, "PENDING" | "SCANNING">,
): PrivateScanEnforcement {
  if (scanState === "CLEAN") return { outcome: "PROMOTE", scanState };
  return { outcome: "QUARANTINE", scanState, reason: `SCAN_${scanState}` };
}

export type PrivateQuarantineOverrideAudit = {
  assetId: string;
  actorId: string;
  reasonCode: string;
  createdAt: string;
};

/** The caller must persist this record transactionally with any authorized override. */
export function createQuarantineOverrideAudit(
  input: Omit<PrivateQuarantineOverrideAudit, "createdAt">,
): PrivateQuarantineOverrideAudit {
  if (!input.assetId || !input.actorId || !/^[A-Z0-9_]{3,64}$/.test(input.reasonCode))
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
  return { ...input, createdAt: new Date().toISOString() };
}
