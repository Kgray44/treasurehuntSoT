import type { PrismaClient } from "@prisma/client";
import { aiPricing } from "../../src/parallax/ai-policy";
import { AI_CAPABILITY_VERSION, classifyAICapability } from "../../src/parallax/ai-capabilities";

/** Synthetic acceptance fixture only. Caller supplies an isolated store and accounts. */
export async function seedAIEconomicsFixture(
  store: PrismaClient,
  people: Record<"A" | "B" | "C" | "D" | "E", string>,
  now = new Date(),
) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.max(1, now.getUTCDate() - 1), 12));
  const earlierDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), Math.max(1, day.getUTCDate() - 2), 12));
  let serial = 0;
  async function add(
    person: keyof typeof people,
    category: string,
    outcome: string,
    cost: bigint | null,
    advanced = false,
    requestedAt = day,
  ) {
    const id = `synthetic-economics-${people[person]}-${++serial}`;
    const accepted = outcome === "ACCEPTED",
      model = advanced ? "gpt-6.1-sol" : "gpt-6-luna";
    await store.aIUsageLedger.create({
      data: {
        id,
        accountId: people[person],
        requestId: id,
        idempotencyKey: id,
        fingerprint: "synthetic-no-private-content",
        definitionId: `synthetic-room-${person}-${accepted ? serial : "working"}`,
        operationCategory: category,
        capabilityId: classifyAICapability(category, advanced ? "ADVANCED" : "STANDARD"),
        capabilityVersion: AI_CAPABILITY_VERSION,
        period: requestedAt.toISOString().slice(0, 7),
        utcDay: requestedAt.toISOString().slice(0, 10),
        provider: "OPENAI",
        model,
        mode: advanced ? "ADVANCED" : "STANDARD",
        pricingRevision: aiPricing[model].revision,
        pricing: JSON.stringify(aiPricing[model]),
        policyRevision: 1,
        status: cost === null ? "UNKNOWN" : "SETTLED",
        outcome,
        generatedAt: ["ACCEPTED", "REJECTED", "APPLIED"].includes(outcome) ? requestedAt : null,
        previewedAt: ["ACCEPTED", "REJECTED"].includes(outcome) ? requestedAt : null,
        rejectedAt: outcome === "REJECTED" ? requestedAt : null,
        appliedAt: outcome === "APPLIED" ? requestedAt : null,
        acceptedAt: accepted ? requestedAt : null,
        acceptedResourceId: accepted ? `synthetic-room-${person}-${serial}` : null,
        acceptedVersion: accepted ? "synthetic-authoritative-room-checksum" : null,
        outcomeEvidence: accepted
          ? JSON.stringify({ authority: "SYNTHETIC_CANONICAL_ACCEPTANCE_FIXTURE", revision: 2 })
          : null,
        reservationNano: BigInt(100000000),
        exposureNano: cost ?? BigInt(100000000),
        settledCostNano: cost,
        costBasis: cost === null ? "UNKNOWN" : "CALCULATED",
        createdAt: requestedAt,
        dispatchedAt: requestedAt,
        settledAt: cost === null ? null : requestedAt,
        leaseExpiresAt: new Date(requestedAt.getTime() + 60000),
        failureCode:
          outcome === "PROVIDER_ERROR" ? "PROVIDER_UNAVAILABLE" : outcome === "TIMEOUT" ? "UPSTREAM_TIMEOUT" : null,
        attempts: {
          create: {
            id: `${id}:1`,
            sequence: 1,
            provider: "OPENAI",
            model,
            pricingRevision: aiPricing[model].revision,
            pricing: JSON.stringify(aiPricing[model]),
            status: cost === null ? "UNKNOWN" : outcome === "PROVIDER_ERROR" ? "FAILED" : "COMPLETED",
            failureCode:
              outcome === "PROVIDER_ERROR" ? "PROVIDER_UNAVAILABLE" : outcome === "TIMEOUT" ? "UPSTREAM_TIMEOUT" : null,
            costBasis: cost === null ? "UNKNOWN" : "CALCULATED",
            costNano: cost,
            exposureNano: cost ?? BigInt(100000000),
            startedAt: requestedAt,
            completedAt: cost === null ? null : requestedAt,
          },
        },
      },
    });
    return id;
  }
  for (let index = 0; index < 40; index++)
    await add(
      "A",
      "ROOM_RECONSTRUCTION",
      index < 2 ? "ACCEPTED" : "REJECTED",
      BigInt(64000000),
      false,
      index < 20 ? earlierDay : day,
    );
  for (let index = 0; index < 10; index++) await add("B", "ROOM_RECONSTRUCTION", "ACCEPTED", BigInt(64000000));
  for (let index = 0; index < 20; index++) await add("C", "AUTHORING", "APPLIED", BigInt(450000));
  await add("D", "AUTHORING", "APPLIED", BigInt(30000000), true);
  await add("E", "AUTHORING", "PROVIDER_ERROR", BigInt(150000));
  await add("E", "AUTHORING", "CANCELLED_DURING_EXECUTION", null);
  await add("E", "AUTHORING", "TIMEOUT", null);
  const retry = await add("E", "AUTHORING", "APPLIED", BigInt(600000));
  await store.aIProviderAttempt.create({
    data: {
      id: `${retry}:2`,
      operationId: retry,
      sequence: 2,
      provider: "OPENAI",
      model: "gpt-6-luna",
      pricingRevision: aiPricing["gpt-6-luna"].revision,
      pricing: JSON.stringify(aiPricing["gpt-6-luna"]),
      status: "COMPLETED",
      costBasis: "CALCULATED",
      costNano: BigInt(300000),
      exposureNano: BigInt(300000),
      startedAt: day,
      completedAt: day,
    },
  });
  await store.aIProviderAttempt.update({
    where: { id: `${retry}:1` },
    data: {
      costNano: BigInt(300000),
      exposureNano: BigInt(300000),
      status: "FAILED",
      failureCode: "INCOMPLETE_OUTPUT",
    },
  });
  return { operations: serial, attempts: serial + 1, day, trendDays: earlierDay.getTime() === day.getTime() ? 1 : 2 };
}
