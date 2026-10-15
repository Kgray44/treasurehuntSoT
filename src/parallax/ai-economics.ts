import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { aiCapabilities, AI_CAPABILITY_VERSION, aiFailureOutcomes } from "./ai-capabilities";
import { aiUTCPeriod, effectiveAIUserPolicy } from "./ai-policy";
import { readAIPolicy } from "./ai-ledger";
import { openAIProviderConfiguration } from "./openai-provider";

export type AIEconomicsFilter = {
  from: Date;
  to: Date;
  capabilityId?: string;
  accountId?: string;
  model?: string;
  provider?: string;
  outcome?: string;
  applicationVersion?: string;
  costBasis?: string;
  search?: string;
};
const money = (value: bigint | null | undefined) => (value ?? BigInt(0)).toString();
const ratio = (numerator: number, denominator: number) => (denominator ? numerator / denominator : null);
const divide = (value: bigint, denominator: number) =>
  denominator ? ((value + BigInt(Math.floor(denominator / 2))) / BigInt(denominator)).toString() : null;
const failed = new Set<string>(aiFailureOutcomes);
export function economicsWhere(filter: AIEconomicsFilter): Prisma.AIUsageLedgerWhereInput {
  return {
    createdAt: { gte: filter.from, lt: filter.to },
    capabilityId: filter.capabilityId,
    accountId: filter.accountId,
    model: filter.model,
    provider: filter.provider,
    outcome: filter.outcome,
    applicationVersion: filter.applicationVersion,
    costBasis: filter.costBasis,
    ...(filter.search
      ? {
          OR: [
            { id: { contains: filter.search } },
            { requestId: { contains: filter.search } },
            { accountId: { contains: filter.search } },
          ],
        }
      : {}),
  };
}
export function defaultEconomicsFilter(now = new Date()): AIEconomicsFilter {
  return {
    from: aiUTCPeriod(now).start,
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
  };
}
function economicsSql(filter: AIEconomicsFilter) {
  const parts = [Prisma.sql`createdAt >= ${filter.from}`, Prisma.sql`createdAt < ${filter.to}`];
  const columns = {
    capabilityId: "capabilityId",
    accountId: "accountId",
    model: "model",
    provider: "provider",
    outcome: "outcome",
    applicationVersion: "applicationVersion",
    costBasis: "costBasis",
  } as const;
  for (const key of Object.keys(columns) as (keyof typeof columns)[])
    if (filter[key]) parts.push(Prisma.sql`${Prisma.raw(columns[key])} = ${filter[key]}`);
  if (filter.search) {
    const search = `%${filter.search}%`;
    parts.push(Prisma.sql`(id LIKE ${search} OR requestId LIKE ${search} OR accountId LIKE ${search})`);
  }
  return Prisma.join(parts, " AND ");
}
export async function aiEconomicsOverview(filter = defaultEconomicsFilter(), store: PrismaClient = db) {
  const where = economicsWhere(filter);
  const configuration = await readAIPolicy(store),
    policy = configuration.policy;
  const providerConfiguration = openAIProviderConfiguration(policy);
  const priorTo = filter.from,
    priorFrom = new Date(filter.from.getTime() - (filter.to.getTime() - filter.from.getTime()));
  const priorWhere = economicsWhere({ ...filter, from: priorFrom, to: priorTo });
  const attemptFailureCost = await store.aIProviderAttempt.aggregate({
    where: { operation: where, OR: [{ status: "FAILED" }, { failureCode: { not: null } }] },
    _sum: { costNano: true, exposureNano: true },
    _count: true,
  });
  const capabilityFailureCosts = await Promise.all(
    aiCapabilities.map((capability) =>
      store.aIProviderAttempt.aggregate({
        where: {
          operation: { ...where, capabilityId: capability.id },
          OR: [{ status: "FAILED" }, { failureCode: { not: null } }],
        },
        _sum: { costNano: true },
      }),
    ),
  );
  const estimatedAttempts = await store.aIProviderAttempt.aggregate({
    where: { operation: where, costBasis: "ESTIMATED" },
    _sum: { costNano: true },
    _count: true,
  });
  const confirmedAttemptCount = await store.aIProviderAttempt.count({
    where: { operation: where, costBasis: "CONFIRMED" },
  });
  const regeneratedOperations = await store.aIUsageLedger.count({
    where: { ...where, logicalParentId: { not: null } },
  });
  const [
    groups,
    byModel,
    daily,
    topPeople,
    attempts,
    retried,
    prior,
    knownCount,
    acceptedRooms,
    acceptedRoomsByDay,
    historical,
    outstanding,
  ] = await Promise.all([
    store.aIUsageLedger.groupBy({
      by: ["capabilityId", "outcome", "costBasis", "status"],
      where,
      _count: {
        _all: true,
        settledCostNano: true,
        generatedAt: true,
        previewedAt: true,
        rejectedAt: true,
        appliedAt: true,
        acceptedAt: true,
        undoneAt: true,
      },
      _sum: { settledCostNano: true, exposureNano: true, confirmedCostNano: true },
    }),
    store.aIUsageLedger.groupBy({
      by: ["capabilityId", "provider", "model", "outcome"],
      where,
      _count: true,
      _sum: { settledCostNano: true, exposureNano: true },
    }),
    store.aIUsageLedger.groupBy({
      by: ["utcDay", "capabilityId", "outcome", "costBasis", "status"],
      where,
      orderBy: { utcDay: "asc" },
      _count: { _all: true, settledCostNano: true },
      _sum: { settledCostNano: true, exposureNano: true },
    }),
    store.aIUsageLedger.groupBy({
      by: ["accountId"],
      where,
      _count: true,
      _sum: { settledCostNano: true, exposureNano: true },
      orderBy: { _sum: { exposureNano: "desc" } },
      take: 25,
    }),
    store.aIProviderAttempt.count({ where: { operation: where } }),
    store.aIUsageLedger.count({ where: { ...where, attempts: { some: { sequence: { gt: 1 } } } } }),
    store.aIUsageLedger.aggregate({ where: priorWhere, _count: true, _sum: { settledCostNano: true } }),
    store.aIUsageLedger.count({
      where: { ...where, status: { in: ["SETTLED", "RELEASED"] }, settledCostNano: { not: null } },
    }),
    store.$queryRaw<{ resultCount: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS resultCount FROM
      (SELECT accountId, acceptedResourceId FROM AIUsageLedger WHERE ${economicsSql(filter)}
       AND capabilityId = 'ROOM_RECONSTRUCTION' AND acceptedAt IS NOT NULL AND acceptedResourceId IS NOT NULL
       GROUP BY accountId, acceptedResourceId) AS acceptedRooms`),
    store.$queryRaw<
      { utcDay: string | null; resultCount: bigint }[]
    >(Prisma.sql`SELECT utcDay, COUNT(*) AS resultCount FROM
      (SELECT utcDay, accountId, acceptedResourceId FROM AIUsageLedger WHERE ${economicsSql(filter)}
       AND capabilityId = 'ROOM_RECONSTRUCTION' AND acceptedAt IS NOT NULL AND acceptedResourceId IS NOT NULL
       GROUP BY utcDay, accountId, acceptedResourceId) AS dailyAcceptedRooms GROUP BY utcDay`),
    store.aIUsageLedger.count({ where: { ...where, capabilityVersion: null } }),
    store.aIUsageLedger.aggregate({
      where: { ...where, status: { in: ["RESERVED", "DISPATCHED", "UNKNOWN"] } },
      _count: true,
      _sum: { exposureNano: true },
    }),
  ]);
  const peopleNames = await store.userAccount.findMany({
    where: { id: { in: topPeople.map((person) => person.accountId) } },
    select: { id: true, profile: { select: { displayName: true } } },
  });
  const outcomesByPerson = await store.aIUsageLedger.groupBy({
    by: ["accountId", "capabilityId", "outcome"],
    where: { ...where, accountId: { in: topPeople.map((person) => person.accountId) } },
    _count: true,
  });
  const settledOrder = { ...where, status: { in: ["SETTLED", "RELEASED"] }, settledCostNano: { not: null } };
  const medianRows = knownCount
    ? await store.aIUsageLedger.findMany({
        where: settledOrder,
        orderBy: [{ settledCostNano: "asc" }, { id: "asc" }],
        skip: Math.floor((knownCount - 1) / 2),
        take: knownCount % 2 ? 1 : 2,
        select: { settledCostNano: true },
      })
    : [];
  const knownAggregate = await store.aIUsageLedger.aggregate({ where: settledOrder, _sum: { settledCostNano: true } });
  const operations = groups.reduce((sum, group) => sum + group._count._all, 0);
  const cost = groups.reduce((sum, group) => sum + (group._sum.settledCostNano ?? BigInt(0)), BigInt(0));
  const confirmed = groups.reduce((sum, group) => sum + (group._sum.confirmedCostNano ?? BigInt(0)), BigInt(0));
  const estimated = estimatedAttempts._sum.costNano ?? BigInt(0);
  const exposure = groups.reduce((sum, group) => sum + (group._sum.exposureNano ?? BigInt(0)), BigInt(0));
  const outcomes = Object.fromEntries(
    [...new Set(groups.map((group) => group.outcome))].map((outcome) => [
      outcome,
      groups.filter((group) => group.outcome === outcome).reduce((sum, group) => sum + group._count._all, 0),
    ]),
  );
  const dailyGroups = new Map<string | null, typeof daily>();
  for (const group of daily) {
    const entries = dailyGroups.get(group.utcDay) ?? [];
    entries.push(group);
    dailyGroups.set(group.utcDay, entries);
  }
  const orderedDays = [...dailyGroups.entries()].sort(([a], [b]) => (a ?? "~").localeCompare(b ?? "~"));
  const roomsPerDay = new Map(acceptedRoomsByDay.map((row) => [row.utcDay, row.resultCount]));
  const capabilities = aiCapabilities.map((capability, capabilityIndex) => {
    const relevant = groups.filter((group) => group.capabilityId === capability.id);
    const requests = relevant.reduce((sum, group) => sum + group._count._all, 0);
    const unknown = relevant
      .filter((group) => group.outcome === "UNKNOWN")
      .reduce((sum, group) => sum + group._count._all, 0);
    const failure = relevant
      .filter((group) => failed.has(group.outcome))
      .reduce((sum, group) => sum + group._count._all, 0);
    const successes = relevant
      .filter((group) =>
        capability.success === "ACCEPTED"
          ? ["ACCEPTED", "ACCEPTED_THEN_EDITED"].includes(group.outcome)
          : group.outcome === capability.success,
      )
      .reduce((sum, group) => sum + group._count._all, 0);
    const accepted = capability.id === "ROOM_RECONSTRUCTION" ? Number(acceptedRooms[0].resultCount) : successes;
    const spending = relevant.reduce((sum, group) => sum + (group._sum.settledCostNano ?? BigInt(0)), BigInt(0));
    const costCovered = relevant.filter(
      (group) => group.costBasis !== "UNKNOWN" && ["SETTLED", "RELEASED"].includes(group.status),
    );
    const costCoveredCount = costCovered.reduce((sum, group) => sum + group._count.settledCostNano, 0);
    const trend = orderedDays.flatMap(([date, entries]) => {
      const rows = entries.filter((group) => group.capabilityId === capability.id);
      if (date === null || !rows.length) return [];
      const operations = rows.reduce((sum, group) => sum + group._count._all, 0);
      const classified = rows
        .filter((group) => group.outcome !== "UNKNOWN")
        .reduce((sum, group) => sum + group._count._all, 0);
      const successful = rows
        .filter((group) =>
          capability.success === "ACCEPTED"
            ? ["ACCEPTED", "ACCEPTED_THEN_EDITED"].includes(group.outcome)
            : group.outcome === capability.success,
        )
        .reduce((sum, group) => sum + group._count._all, 0);
      const useful = capability.id === "ROOM_RECONSTRUCTION" ? Number(roomsPerDay.get(date) ?? 0) : successful;
      const observedCost = rows.reduce((sum, group) => sum + (group._sum.settledCostNano ?? BigInt(0)), BigInt(0));
      const covered = rows
        .filter((group) => group.costBasis !== "UNKNOWN" && ["SETTLED", "RELEASED"].includes(group.status))
        .reduce((sum, group) => sum + group._count.settledCostNano, 0);
      return [
        {
          date,
          operations,
          classifiedOperations: classified,
          successfulOperations: successful,
          successRate: capability.success ? ratio(successful, classified) : null,
          usefulResults: capability.success ? useful : null,
          knownCostNano: money(observedCost),
          costPerUsefulResultNano: capability.success && covered ? divide(observedCost, useful) : null,
          costCoverage: ratio(covered, operations),
          unknownOutcomes: operations - classified,
          sample: operations < 10 ? "INSUFFICIENT_SAMPLE" : "OBSERVED_SAMPLE",
        },
      ];
    });
    return {
      ...capability,
      configuration: {
        revision: configuration.revision,
        provider: policy.provider,
        providerConfigured: providerConfiguration.configured,
        model:
          capability.id === "ROOM_RECONSTRUCTION"
            ? effectiveAIUserPolicy(policy, null).roomModel
            : capability.id === "ADVANCED_ASSISTANT"
              ? policy.advancedModel
              : capability.id === "GROUNDED_ASSISTANT_EDIT"
                ? policy.standardModel
                : null,
        permittedModels: policy.capabilityPolicies?.[capability.id]?.allowedModels ?? policy.allowedModels,
        defaultRequests: policy.capabilityPolicies?.[capability.id]?.monthlyRequests ?? policy.defaultUserRequests,
        defaultSpendNano: policy.capabilityPolicies?.[capability.id]?.monthlySpendNano ?? policy.defaultUserSpendNano,
        enabled:
          policy.enabled &&
          policy.capabilityPolicies?.[capability.id]?.enabled !== false &&
          (capability.id !== "ADVANCED_ASSISTANT" || policy.advancedEnabled),
      },
      requests,
      unknownOutcomes: unknown,
      failures: failure,
      successfulOperations: successes,
      generated: relevant.reduce((sum, group) => sum + group._count.generatedAt, 0),
      previewed: relevant.reduce((sum, group) => sum + group._count.previewedAt, 0),
      rejected: relevant.reduce((sum, group) => sum + group._count.rejectedAt, 0),
      applied: relevant.reduce((sum, group) => sum + group._count.appliedAt, 0),
      undone: relevant.reduce((sum, group) => sum + group._count.undoneAt, 0),
      acceptedThenEdited: relevant
        .filter((group) => group.outcome === "ACCEPTED_THEN_EDITED")
        .reduce((sum, group) => sum + group._count._all, 0),
      usefulResults: accepted,
      knownCostNano: money(spending),
      failureCostNano: money(capabilityFailureCosts[capabilityIndex]._sum.costNano),
      outcomeCoverage: ratio(requests - unknown, requests),
      successRate: capability.success ? ratio(successes, requests - unknown) : null,
      attemptsPerUsefulResult: ratio(requests, accepted),
      costPerUsefulResultNano: costCoveredCount ? divide(spending, accepted) : null,
      costCoverage: ratio(costCoveredCount, requests),
      meanCostNano: divide(
        costCovered.reduce((sum, group) => sum + (group._sum.settledCostNano ?? BigInt(0)), BigInt(0)),
        costCoveredCount,
      ),
      trend,
      undatedOperations: (dailyGroups.get(null) ?? [])
        .filter((group) => group.capabilityId === capability.id)
        .reduce((sum, group) => sum + group._count._all, 0),
      trendDefinition: capability.success
        ? "Rates describe initiated operations with recorded outcomes in each UTC request-day cohort. Missing days have no sample. " +
          (capability.success === "ACCEPTED"
            ? "Later acceptance updates the originating cohort; recent days may contain pending results. Daily accepted-room counts deduplicate owned rooms within that day; range totals deduplicate across the entire selected range. "
            : "Canonical Apply, rejection or verified undo updates the originating cohort; recent days may contain pending proposals. Useful results are currently applied edits. ") +
          "Costs include unsuccessful work and exclude unresolved amounts."
        : "This capability declares no useful-outcome semantics. Daily operation counts and observed costs remain available; success rates and cost per useful result are unavailable.",
      sample: requests < 10 ? "INSUFFICIENT_SAMPLE" : "OBSERVED_SAMPLE",
      definition:
        capability.id === "ROOM_RECONSTRUCTION"
          ? "Acceptance rate = accepted reconstruction operations / initiated operations with recorded outcomes. Cost per accepted room = all observed reconstruction cost / distinct accepted owned rooms in this request cohort."
          : "Apply rate = currently applied edit operations / initiated operations with recorded outcomes. Undo and rejection are separate outcomes. Cost per applied edit includes unsuccessful operations.",
    };
  });
  const people = topPeople.map((person) => {
    const personGroups = outcomesByPerson.filter((group) => group.accountId === person.accountId);
    const reconstruction = personGroups.filter((group) => group.capabilityId === "ROOM_RECONSTRUCTION");
    const reconstructions = reconstruction.reduce((sum, group) => sum + group._count, 0);
    const accepted = reconstruction
      .filter((group) => ["ACCEPTED", "ACCEPTED_THEN_EDITED"].includes(group.outcome))
      .reduce((sum, group) => sum + group._count, 0);
    const knownOutcomes = reconstruction
      .filter((group) => group.outcome !== "UNKNOWN")
      .reduce((sum, group) => sum + group._count, 0);
    return {
      accountId: person.accountId,
      displayName:
        peopleNames.find((name) => name.id === person.accountId)?.profile?.displayName ?? "Voyagewright account",
      operations: person._count,
      knownCostNano: money(person._sum.settledCostNano),
      exposureNano: money(person._sum.exposureNano),
      reconstructions,
      accepted,
      acceptanceRate: ratio(accepted, knownOutcomes),
      investigation:
        knownOutcomes >= 10 && accepted / knownOutcomes < 0.25
          ? "Low recorded acceptance after repeated reconstruction. Review operation evidence and workflow quality; activity alone does not establish a cause."
          : null,
    };
  });
  const failures = groups.filter((group) => failed.has(group.outcome));
  const previousCost = prior._sum.settledCostNano ?? BigInt(0);
  const modelKeys = [...new Set(byModel.map((group) => `${group.capabilityId}:${group.provider}:${group.model}`))];
  const models = modelKeys.map((key) => {
    const entries = byModel.filter((group) => `${group.capabilityId}:${group.provider}:${group.model}` === key),
      first = entries[0];
    const operations = entries.reduce((sum, group) => sum + group._count, 0);
    const classified = entries
      .filter((group) => group.outcome !== "UNKNOWN")
      .reduce((sum, group) => sum + group._count, 0);
    const success = aiCapabilities.find((capability) => capability.id === first.capabilityId)?.success;
    const useful = entries
      .filter((group) =>
        success === "ACCEPTED"
          ? ["ACCEPTED", "ACCEPTED_THEN_EDITED"].includes(group.outcome)
          : success && group.outcome === success,
      )
      .reduce((sum, group) => sum + group._count, 0);
    const total = entries.reduce((sum, group) => sum + (group._sum.settledCostNano ?? BigInt(0)), BigInt(0));
    return {
      capabilityId: first.capabilityId,
      provider: first.provider,
      model: first.model,
      operations,
      usefulOperations: useful,
      usefulOperationRate: success ? ratio(useful, classified) : null,
      costPerUsefulOperationNano:
        success && entries.some((group) => group._sum.settledCostNano !== null) ? divide(total, useful) : null,
      knownCostNano: money(total),
      exposureNano: money(entries.reduce((sum, group) => sum + (group._sum.exposureNano ?? BigInt(0)), BigInt(0))),
      sample: operations < 10 ? "INSUFFICIENT_SAMPLE" : "OBSERVED_SAMPLE",
    };
  });
  return {
    registryVersion: AI_CAPABILITY_VERSION,
    from: filter.from.toISOString(),
    to: filter.to.toISOString(),
    comparison: {
      from: priorFrom.toISOString(),
      to: priorTo.toISOString(),
      operations: prior._count,
      knownCostNano: money(previousCost),
      costChangeRatio: previousCost ? Number(cost - previousCost) / Number(previousCost) : null,
    },
    totals: {
      operations,
      providerAttempts: attempts,
      retriedOperations: retried,
      regeneratedOperations,
      retryRate: ratio(retried, operations),
      knownCostNano: money(cost),
      confirmedCostNano: confirmedAttemptCount || confirmed > BigInt(0) ? money(confirmed) : null,
      confirmedProviderAttempts: confirmedAttemptCount,
      calculatedOrEstimatedCostNano: money(cost - confirmed),
      calculatedCostNano: money(cost - confirmed - estimated),
      estimatedCostNano: money(estimated),
      estimatedProviderAttempts: estimatedAttempts._count,
      exposureNano: money(exposure),
      unresolvedOperations: outstanding._count,
      unresolvedExposureNano: money(outstanding._sum.exposureNano),
      failedOperations: failures.reduce((sum, group) => sum + group._count._all, 0),
      failureCostNano: money(attemptFailureCost._sum.costNano),
      failedProviderAttempts: attemptFailureCost._count,
      failedAttemptExposureNano: money(attemptFailureCost._sum.exposureNano),
      meanCostNano: divide(knownAggregate._sum.settledCostNano ?? BigInt(0), knownCount),
      medianCostNano: divide(
        medianRows.reduce((sum, row) => sum + row.settledCostNano!, BigInt(0)),
        medianRows.length,
      ),
      knownCostOperations: knownCount,
      historicalIncompleteOperations: historical,
      projectedThirtyDayCostNano: divide(
        cost * BigInt(30),
        Math.max(1, Math.ceil((filter.to.getTime() - filter.from.getTime()) / 86400000)),
      ),
    },
    outcomes,
    capabilities,
    people,
    models,
    daily: orderedDays.map(([date, entries]) => ({
      date: date ?? "Historical day unavailable",
      operations: entries.reduce((sum, group) => sum + group._count._all, 0),
      knownCostNano: money(entries.reduce((sum, group) => sum + (group._sum.settledCostNano ?? BigInt(0)), BigInt(0))),
      exposureNano: money(entries.reduce((sum, group) => sum + (group._sum.exposureNano ?? BigInt(0)), BigInt(0))),
    })),
    definitions: {
      costs:
        "Observed costs include reported-usage calculations and any provider-confirmed billing. Unknown usage is never counted as zero cost. Reservations are exposure, not spending.",
      cohort:
        "Operations are selected by initiation time in UTC. Later owner acceptance updates that request cohort. Historical outcome and provider-attempt coverage can be incomplete.",
      averages:
        "Mean and median include fully cost-settled logical operations only. No sample gives unavailable, not zero.",
      forecast:
        "Thirty-day run rate extrapolates the observed selected-period cost. It excludes unknown costs and is not a billing prediction.",
    },
  };
}

/** Explicit safe projection: no raw prompts, result bodies, source photographs or provider credentials. */
const operationSelect = {
  id: true,
  accountId: true,
  requestId: true,
  definitionId: true,
  capabilityId: true,
  capabilityVersion: true,
  logicalParentId: true,
  outcome: true,
  outcomeAt: true,
  acceptedResourceId: true,
  acceptedVersion: true,
  acceptedAt: true,
  applicationVersion: true,
  model: true,
  provider: true,
  mode: true,
  pricingRevision: true,
  policyRevision: true,
  userPolicyRevision: true,
  policySnapshot: true,
  outcomeEvidence: true,
  status: true,
  reservationNano: true,
  exposureNano: true,
  settledCostNano: true,
  confirmedCostNano: true,
  costBasis: true,
  inputTokens: true,
  outputTokens: true,
  cachedInputTokens: true,
  cacheWriteTokens: true,
  reasoningTokens: true,
  failureCode: true,
  createdAt: true,
  dispatchedAt: true,
  settledAt: true,
  appliedAt: true,
  _count: { select: { attempts: true } },
} satisfies Prisma.AIUsageLedgerSelect;
function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)));
}
export async function aiEconomicsHistory(
  filter: AIEconomicsFilter,
  options: { cursor?: string; take?: number; sort?: "NEWEST" | "OLDEST" | "COST_HIGHEST" } = {},
  store: PrismaClient = db,
) {
  const take = Math.max(1, Math.min(options.take ?? 50, 100));
  const rows = await store.aIUsageLedger.findMany({
    where: economicsWhere(filter),
    select: operationSelect,
    orderBy:
      options.sort === "COST_HIGHEST"
        ? [{ settledCostNano: { sort: "desc", nulls: "last" } }, { id: "desc" }]
        : [{ createdAt: options.sort === "OLDEST" ? "asc" : "desc" }, { id: "desc" }],
    take: take + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  return serialize({ records: rows.slice(0, take), nextCursor: rows.length > take ? rows[take - 1].id : null });
}
export async function aiEconomicsOperation(id: string, store: PrismaClient = db) {
  const operation = await store.aIUsageLedger.findUnique({ where: { id }, select: operationSelect });
  if (!operation) return null;
  const attempts = await store.aIProviderAttempt.findMany({
    where: { operationId: id },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      provider: true,
      model: true,
      pricingRevision: true,
      status: true,
      costBasis: true,
      costNano: true,
      exposureNano: true,
      usage: true,
      failureCode: true,
      startedAt: true,
      completedAt: true,
      reconciledAt: true,
    },
  });
  return serialize({ ...operation, attempts });
}
