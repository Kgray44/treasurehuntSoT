import { createHash } from "node:crypto";
import { CommunityError } from "./domain";
import { assertCommunityBinaryFormat, type CommunityPackageFile } from "./package";
import { scanClamAvBytes } from "@/private-content/clamav-transport";
import { db } from "@/lib/db";

export type CommunityBinaryScanResult =
  | "CLEAN"
  | "SUSPICIOUS"
  | "MALICIOUS"
  | "FAILED"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "DEFINITIONS_STALE"
  | "SCAN_NOT_CONFIGURED";

export type CommunityBinaryScanInput = {
  bytes: Uint8Array;
  sha256: string;
  declaredMediaType: string;
  detectedMediaType: string;
  byteLength: number;
  originalFilename?: string;
};

export type CommunityBinaryScanReceipt = {
  provider: string;
  providerVersion: string;
  result: CommunityBinaryScanResult;
  sha256: string;
  scannedAt: string;
  evidenceKind: string;
  fixtureId?: string;
  byteLength: number;
  declaredMediaType: string;
  detectedMediaType: string;
  validationRunId?: string;
  safeReasonCode?: string;
};

export interface CommunityBinaryScanner {
  scan(input: CommunityBinaryScanInput): Promise<CommunityBinaryScanReceipt>;
}

const providerName = "COMMUNITY_BINARY_SCANNER_PROVIDER";
const binaryMediaTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "model/gltf-binary",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
]);

function receipt(
  input: CommunityBinaryScanInput,
  result: CommunityBinaryScanResult,
  values: Partial<CommunityBinaryScanReceipt>,
) {
  return {
    provider: values.provider ?? "not-configured",
    providerVersion: values.providerVersion ?? "1",
    result,
    sha256: input.sha256,
    scannedAt: new Date().toISOString(),
    evidenceKind: values.evidenceKind ?? "scanner-unavailable",
    byteLength: input.byteLength,
    declaredMediaType: input.declaredMediaType,
    detectedMediaType: input.detectedMediaType,
    ...(values.fixtureId ? { fixtureId: values.fixtureId } : {}),
    ...(values.validationRunId ? { validationRunId: values.validationRunId } : {}),
    ...(values.safeReasonCode ? { safeReasonCode: values.safeReasonCode } : {}),
  };
}

function assertSyntheticTestGuards() {
  // `next dev` rewrites NODE_ENV to development in the child server even when
  // the governed harness was launched with NODE_ENV=test. The harness carries
  // that launch assertion forward in a second private marker; it is accepted
  // only alongside the nonce-bound isolated database checks below.
  const testEnvironment = process.env.NODE_ENV === "test" || process.env.FOREVER_VALIDATION_NODE_ENV === "test";
  if (!testEnvironment)
    throw new CommunityError(
      "COMMUNITY_SYNTHETIC_SCANNER_FORBIDDEN",
      "The synthetic scanner is permitted only in NODE_ENV=test.",
    );
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    !/^[a-f0-9]{64}$/u.test(process.env.FOREVER_VALIDATION_NONCE_HASH ?? "")
  )
    throw new CommunityError(
      "COMMUNITY_SYNTHETIC_SCANNER_CONTEXT_REQUIRED",
      "The synthetic scanner requires the nonce-bound validation runtime.",
    );
  if (!/^file:.*validation-isolated-/iu.test(process.env.DATABASE_URL ?? ""))
    throw new CommunityError(
      "COMMUNITY_SYNTHETIC_SCANNER_ISOLATION_REQUIRED",
      "The synthetic scanner requires an isolated validation database.",
    );
}

function detectMediaType(bytes: Uint8Array) {
  if (
    bytes.byteLength >= 8 &&
    bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
  )
    return "image/png";
  if (bytes.byteLength >= 4 && new TextDecoder().decode(bytes.slice(0, 4)) === "glTF") return "model/gltf-binary";
  return "application/octet-stream";
}

class NotConfiguredCommunityBinaryScanner implements CommunityBinaryScanner {
  async scan(input: CommunityBinaryScanInput) {
    return receipt(input, "SCAN_NOT_CONFIGURED", { safeReasonCode: "SCANNER_NOT_CONFIGURED" });
  }
}

class SyntheticCommunityBinaryScanner implements CommunityBinaryScanner {
  async scan(input: CommunityBinaryScanInput) {
    assertSyntheticTestGuards();
    const { syntheticBinaryFixtures, assertSyntheticFixtureRegistry } = await import("./synthetic-binary-fixtures");
    assertSyntheticFixtureRegistry();
    const computedHash = createHash("sha256").update(input.bytes).digest("hex");
    const fixture = syntheticBinaryFixtures.find((candidate) => candidate.sha256 === input.sha256);
    const validationRunId = process.env.FOREVER_VALIDATION_NONCE_HASH;
    if (!fixture || computedHash !== input.sha256 || input.byteLength !== fixture.byteLength)
      return receipt(input, "SUSPICIOUS", {
        provider: "synthetic-test",
        evidenceKind: "synthetic-hash-attested",
        validationRunId,
        safeReasonCode: "FIXTURE_HASH_NOT_ALLOWLISTED",
      });
    if (input.detectedMediaType !== fixture.detectedMediaType || input.declaredMediaType !== fixture.detectedMediaType)
      return receipt(input, "SUSPICIOUS", {
        provider: "synthetic-test",
        evidenceKind: "synthetic-hash-attested",
        fixtureId: fixture.id,
        validationRunId,
        safeReasonCode: "FIXTURE_MEDIA_TYPE_MISMATCH",
      });
    try {
      assertCommunityBinaryFormat({ path: "fixture", mediaType: input.detectedMediaType, bytes: input.bytes });
    } catch {
      return receipt(input, "FAILED", {
        provider: "synthetic-test",
        evidenceKind: "synthetic-hash-attested",
        fixtureId: fixture.id,
        validationRunId,
        safeReasonCode: "FIXTURE_FORMAT_VALIDATION_FAILED",
      });
    }
    return receipt(input, "CLEAN", {
      provider: "synthetic-test",
      evidenceKind: "synthetic-hash-attested",
      fixtureId: fixture.id,
      validationRunId,
      safeReasonCode: "EXACT_ALLOWLISTED_FIXTURE",
    });
  }
}

class ClamAvCommunityBinaryScanner implements CommunityBinaryScanner {
  async scan(input: CommunityBinaryScanInput) {
    const result = await scanClamAvBytes({
      bytes: input.bytes,
      host: process.env.COMMUNITY_CLAMAV_HOST,
      port: Number(process.env.COMMUNITY_CLAMAV_PORT ?? 3310),
      timeoutMs: Number(process.env.COMMUNITY_CLAMAV_TIMEOUT_MS ?? 15_000),
    });
    return receipt(input, result.result, {
      provider: "clamav-instream",
      providerVersion: process.env.COMMUNITY_CLAMAV_VERSION ?? "unverified",
      evidenceKind: "clamav-instream",
      safeReasonCode: result.safeCode,
    });
  }
}

export function createCommunityBinaryScanner(): CommunityBinaryScanner {
  const selected = process.env[providerName] ?? "not-configured";
  if (selected === "not-configured") return new NotConfiguredCommunityBinaryScanner();
  if (selected === "synthetic-test") {
    assertSyntheticTestGuards();
    return new SyntheticCommunityBinaryScanner();
  }
  if (selected === "clamav") return new ClamAvCommunityBinaryScanner();
  throw new CommunityError(
    "COMMUNITY_SCANNER_PROVIDER_INVALID",
    "The configured Community scanner provider is not recognized.",
  );
}

export function isCommunityBinaryFile(file: CommunityPackageFile) {
  return binaryMediaTypes.has(file.mediaType);
}

export async function scanCommunityPackageFiles(files: readonly CommunityPackageFile[]) {
  const scanner = createCommunityBinaryScanner();
  const receipts = await Promise.all(
    files.filter(isCommunityBinaryFile).map(async (file) => {
      const detectedMediaType = detectMediaType(file.bytes);
      return scanner.scan({
        bytes: file.bytes,
        sha256: createHash("sha256").update(file.bytes).digest("hex"),
        declaredMediaType: file.mediaType,
        detectedMediaType,
        byteLength: file.bytes.byteLength,
      });
    }),
  );
  const result: CommunityBinaryScanResult = receipts.some((item) => item.result !== "CLEAN")
    ? (receipts.find((item) => item.result !== "CLEAN")?.result ?? "FAILED")
    : "CLEAN";
  return { result: receipts.length ? result : "CLEAN", receipts };
}

export function assertTrustedCommunityScanReceipts(receipts: readonly CommunityBinaryScanReceipt[]) {
  for (const item of receipts) {
    if (!/^[a-f0-9]{64}$/u.test(item.sha256) || item.byteLength < 0 || !item.provider || !item.evidenceKind)
      throw new CommunityError("COMMUNITY_SCANNER_RECEIPT_INVALID", "Scanner evidence is incomplete.");
  }
}

/** Publication and restoration require current, provider-bound CLEAN evidence.
 * Synthetic receipts are accepted only while the validation guard remains live. */
export function isTrustedCurrentCommunityScanReceipt(
  receipt: CommunityBinaryScanReceipt,
  expectedSha256: string,
  now = Date.now(),
) {
  const maxAgeMs = Number(process.env.COMMUNITY_SCAN_MAX_AGE_MS ?? 24 * 60 * 60 * 1000);
  return (
    receipt.result === "CLEAN" &&
    receipt.sha256 === expectedSha256 &&
    /^[a-f0-9]{64}$/u.test(expectedSha256) &&
    receipt.provider !== "not-configured" &&
    receipt.provider !== "synthetic-test" &&
    Number.isFinite(maxAgeMs) &&
    new Date(receipt.scannedAt).getTime() + maxAgeMs >= now
  );
}

/** Persists a bounded provider receipt; raw bytes, scanner responses, object
 * locations, and original names remain outside the moderation database. */
export async function persistCommunityScanReceipt(
  subject: { subjectType: string; subjectId: string; correlationId: string },
  receipt: CommunityBinaryScanReceipt,
  expiresAt = new Date(Date.now() + Number(process.env.COMMUNITY_SCAN_MAX_AGE_MS ?? 24 * 60 * 60 * 1000)),
) {
  if (
    !/^[a-f0-9]{64}$/u.test(receipt.sha256) ||
    receipt.byteLength < 0 ||
    !receipt.provider ||
    !receipt.providerVersion
  )
    throw new CommunityError("COMMUNITY_SCANNER_RECEIPT_INVALID", "Scanner evidence is incomplete.");
  return db.communityScanReceipt.create({
    data: {
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      provider: receipt.provider,
      providerVersion: receipt.providerVersion,
      definitionsVersion: receipt.safeReasonCode?.slice(0, 191),
      result: receipt.result,
      objectChecksum: receipt.sha256,
      byteLength: receipt.byteLength,
      detectedMediaType: receipt.detectedMediaType,
      evidenceKind: receipt.evidenceKind,
      correlationId: subject.correlationId,
      expiresAt,
    },
  });
}

export async function currentCommunityScanReceipt(subjectType: string, subjectId: string, expectedChecksum: string) {
  return db.communityScanReceipt.findFirst({
    where: { subjectType, subjectId, objectChecksum: expectedChecksum, result: "CLEAN", expiresAt: { gt: new Date() } },
    orderBy: { scannedAt: "desc" },
  });
}
