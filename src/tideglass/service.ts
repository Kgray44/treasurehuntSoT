import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { publishedSourceChecksum } from "@/chronicle/snapshot";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { workspaceCapabilityOverview } from "@/homeport/workspace-capabilities";
import {
  compareRequestSchema,
  failure,
  type ResolvedEditionAnchor,
  type RetainedEditionState,
  type TideglassCompareRequest,
  type TideglassComparisonResult,
  type TideglassResult,
} from "./core";
import { compareSemanticSnapshots, comparisonReceipt, type ExplicitReplacementMap } from "./comparison";
import { canonicalizePublishedSnapshot, type TideglassHistoricalReader } from "./semantic";
import { canonicalCacheKey, tideglassComparisonCache, type TideglassComparisonCache } from "./cache";

export type TideglassPrincipal =
  | { kind: "ACCOUNT"; accountId: string }
  | { kind: "CAPTAIN"; accountId: string }
  | { kind: "PASSAGE"; subjectId: string };

export type TideglassPublishedEdition = {
  id: string;
  chronicleId: string;
  contentSnapshot: string;
  schemaVersion: number | string;
  checksum: string;
  publishedAt?: Date | string;
  retainedState?: RetainedEditionState;
};

export interface TideglassEditionRepository {
  findExactEdition(editionId: string): Promise<TideglassPublishedEdition | null>;
  authorizeEdition(principal: TideglassPrincipal, edition: TideglassPublishedEdition): Promise<boolean>;
}

export type TideglassCompareOptions = {
  correlationId?: string;
  signal?: AbortSignal;
  explicitReplacements?: ExplicitReplacementMap;
  historicalReaders?: readonly TideglassHistoricalReader[];
  cache?: TideglassComparisonCache | null;
};

function anchor(edition: TideglassPublishedEdition): ResolvedEditionAnchor {
  return {
    chronicleId: edition.chronicleId,
    editionId: edition.id,
    editionChecksum: edition.checksum,
    sourceSchemaVersion: edition.schemaVersion,
    ...(edition.publishedAt
      ? { publishedAt: edition.publishedAt instanceof Date ? edition.publishedAt.toISOString() : edition.publishedAt }
      : {}),
    retainedState: edition.retainedState ?? "PLAYABLE",
  };
}

function cancelled(signal: AbortSignal | undefined, correlationId: string) {
  return signal?.aborted ? failure("COMPARISON_CANCELLED", correlationId) : null;
}

function hasMatchingSourceChecksum(edition: TideglassPublishedEdition) {
  try {
    return publishedSourceChecksum(JSON.parse(edition.contentSnapshot) as PublishedTaleSnapshot) === edition.checksum;
  } catch {
    return false;
  }
}

export async function compareExactEditions(
  repository: TideglassEditionRepository,
  principal: TideglassPrincipal,
  uncheckedRequest: TideglassCompareRequest,
  options: TideglassCompareOptions = {},
): Promise<TideglassResult<TideglassComparisonResult>> {
  const correlationId = options.correlationId ?? randomUUID();
  const startedAt = performance.now();
  const request = compareRequestSchema.safeParse(uncheckedRequest);
  if (!request.success) return failure("EDITION_NOT_FOUND", correlationId);
  const earlyCancellation = cancelled(options.signal, correlationId);
  if (earlyCancellation) return earlyCancellation;

  try {
    const [source, target] = await Promise.all([
      repository.findExactEdition(request.data.sourceEditionId),
      repository.findExactEdition(request.data.targetEditionId),
    ]);
    if (!source || !target) return failure("EDITION_NOT_FOUND", correlationId);

    // These calls intentionally remain independent even for a same-edition comparison.
    const [sourceAuthorized, targetAuthorized] = await Promise.all([
      repository.authorizeEdition(principal, source),
      repository.authorizeEdition(principal, target),
    ]);
    if (!sourceAuthorized || !targetAuthorized) return failure("EDITION_NOT_AUTHORIZED", correlationId);

    if (
      source.chronicleId !== request.data.chronicleId ||
      target.chronicleId !== request.data.chronicleId ||
      source.chronicleId !== target.chronicleId
    )
      return failure("CROSS_CHRONICLE_COMPARISON", correlationId);
    if (source.retainedState === "REDACTED" || target.retainedState === "REDACTED")
      return failure("EDITION_NOT_AUTHORIZED", correlationId);
    if (!hasMatchingSourceChecksum(source) || !hasMatchingSourceChecksum(target))
      return failure("CHECKSUM_MISMATCH", correlationId);

    const pair = { chronicleId: source.chronicleId, source: anchor(source), target: anchor(target) };
    const cache = options.cache === undefined ? tideglassComparisonCache : options.cache;
    const key = canonicalCacheKey(pair);
    const cacheRead = cache?.readCanonicalChangeSet?.(key);
    const cached = cacheRead?.entry ?? cache?.getCanonicalChangeSet(key);
    if (cached) {
      const completedAt = performance.now();
      return {
        ok: true,
        value: {
          changeSet: cached.changeSet,
          receipt: comparisonReceipt(cached.changeSet, cached.sourceAdapters, cached.targetAdapters),
          operation: {
            correlationId,
            cacheStatus: "HIT",
            normalizationDurationMs: 0,
            comparisonDurationMs: 0,
            totalDurationMs: completedAt - startedAt,
          },
        },
      };
    }

    const beforeNormalization = performance.now();
    const sourceSemantic = canonicalizePublishedSnapshot(
      source.contentSnapshot,
      anchor(source),
      options.historicalReaders,
    );
    if (!sourceSemantic.ok) return { ...sourceSemantic, correlationId };
    const targetSemantic = canonicalizePublishedSnapshot(
      target.contentSnapshot,
      anchor(target),
      options.historicalReaders,
    );
    if (!targetSemantic.ok) return { ...targetSemantic, correlationId };
    const afterNormalization = performance.now();
    const midCancellation = cancelled(options.signal, correlationId);
    if (midCancellation) return midCancellation;

    const changeSet = compareSemanticSnapshots(
      sourceSemantic.value,
      targetSemantic.value,
      options.explicitReplacements,
    );
    const comparedAt = performance.now();
    const receipt = comparisonReceipt(
      changeSet,
      sourceSemantic.value.normalizationAdapters,
      targetSemantic.value.normalizationAdapters,
    );
    cache?.setCanonicalChangeSet(key, {
      changeSet,
      sourceAdapters: sourceSemantic.value.normalizationAdapters,
      targetAdapters: targetSemantic.value.normalizationAdapters,
    });
    return {
      ok: true,
      value: {
        changeSet,
        receipt,
        operation: {
          correlationId,
          cacheStatus: cache ? (cacheRead?.status === "CORRUPT" ? "CORRUPT_REBUILT" : "MISS") : "BYPASS",
          normalizationDurationMs: afterNormalization - beforeNormalization,
          comparisonDurationMs: comparedAt - afterNormalization,
          totalDurationMs: comparedAt - startedAt,
        },
      },
    };
  } catch {
    return failure("COMPARISON_FAILED", correlationId);
  }
}

export const prismaTideglassEditionRepository: TideglassEditionRepository = {
  async findExactEdition(editionId) {
    const edition = await db.publishedTaleVersion.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        taleId: true,
        contentSnapshot: true,
        schemaVersion: true,
        checksum: true,
        publishedAt: true,
      },
    });
    return edition
      ? {
          id: edition.id,
          chronicleId: edition.taleId,
          contentSnapshot: edition.contentSnapshot,
          schemaVersion: edition.schemaVersion,
          checksum: edition.checksum,
          publishedAt: edition.publishedAt,
          retainedState: "PLAYABLE",
        }
      : null;
  },

  async authorizeEdition(principal, edition) {
    if (principal.kind === "CAPTAIN") {
      const chronicle = await db.chronicle.findFirst({
        where: {
          id: edition.chronicleId,
          archivedAt: null,
          latestPublishedVersionId: { not: null },
          OR: [{ creatorAccountId: principal.accountId }, { visibility: "PUBLIC" }],
        },
        select: { id: true },
      });
      return Boolean(chronicle);
    }
    if (principal.kind !== "ACCOUNT") return false;
    let overview;
    try {
      overview = await workspaceCapabilityOverview(principal.accountId);
    } catch {
      return false;
    }
    const creator = overview.workspaces.find((workspace) => workspace.id === "CREATOR");
    if (creator?.state !== "ACTIVE") return false;
    const account = await db.userAccount.findUnique({
      where: { id: principal.accountId },
      select: {
        legacyGameMasterId: true,
        roles: {
          where: { revokedAt: null },
          select: { role: true, scopeType: true, scopeId: true },
        },
      },
    });
    if (!account) return false;
    const collaborator = account.roles.some(
      (assignment) =>
        assignment.role === "CREATOR" &&
        ["CHRONICLE", "TALE"].includes(assignment.scopeType) &&
        assignment.scopeId === edition.chronicleId,
    );
    if (collaborator) return true;
    const chronicle = await db.chronicle.findFirst({
      where: {
        id: edition.chronicleId,
        OR: [
          { creatorAccountId: principal.accountId },
          { creatorId: principal.accountId },
          ...(account.legacyGameMasterId ? [{ creatorId: account.legacyGameMasterId }] : []),
        ],
      },
      select: { id: true },
    });
    return Boolean(chronicle);
  },
};
