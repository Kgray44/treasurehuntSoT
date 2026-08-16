import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { Config } from "./config.js";
import type { BridgewatchStore } from "../lib/store.js";

const execFileAsync = promisify(execFile);
export const nodeStates = [
  "QUEUED",
  "RUNNING",
  "PASSED",
  "PASSED_AFTER_RETRY",
  "FAILED",
  "BLOCKED",
  "CANCELLED",
  "NOT_RUN",
  "SKIPPED",
  "UNKNOWN",
] as const;
export type NodeState = (typeof nodeStates)[number];

const projectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    observedAt: z.string().datetime({ offset: true }),
    source: z.literal("SOUNDING_LINE_RUNTIME"),
    leases: z.number().int().nonnegative(),
    workers: z.array(
      z
        .object({
          id: z.string(),
          runId: z.string(),
          lane: z.string(),
          state: z.literal("RUNNING"),
          heartbeatAt: z.string().nullable(),
        })
        .strict(),
    ),
    plans: z.array(
      z
        .object({
          id: z.string(),
          sourceSha: z.string().nullable(),
          gate: z.string(),
          state: z.string(),
          createdAt: z.string().nullable(),
          authorityVersion: z.string().nullable().optional(),
          authorityBoundary: z.string().nullable().optional(),
          authorityMode: z.string().nullable().optional(),
          qualifiedBaseSha: z.string().nullable().optional(),
          candidateTreeSha: z.string().nullable().optional(),
          predictedIntegrationTreeSha: z.string().nullable().optional(),
          planDigest: z.string().nullable().optional(),
          trainId: z.string().nullable().optional(),
          trainCars: z
            .array(
              z
                .object({
                  id: z.string(),
                  state: z.string().nullable(),
                  candidateSha: z.string().nullable(),
                  candidateTreeSha: z.string().nullable(),
                  predictedIntegrationTreeSha: z.string().nullable(),
                })
                .strict(),
            )
            .optional(),
          evidenceDispositionCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
          semanticFallback: z.string().nullable().optional(),
          finalizerAuthority: z.string().nullable().optional(),
          evidenceDigest: z.string().nullable().optional(),
          cleanupState: z.enum(["CLEAN", "PENDING", "FAILED", "UNKNOWN"]),
          finalDecision: z.string().nullable(),
          semanticFallback: z.string().nullable().optional(),
          semanticFallbackDetails: z
            .object({
              disposition: z.string().optional(),
              failure: z.string().optional(),
              reasons: z.array(
                z
                  .object({
                    code: z.string().optional(),
                    paths: z.array(z.string()).optional(),
                    contractIds: z.array(z.string()).optional(),
                    debts: z
                      .array(
                        z
                          .object({
                            contractId: z.string().optional(),
                            owner: z.string().optional(),
                            classification: z.string().optional(),
                            risk: z.string().optional(),
                            reason: z.string().optional(),
                          })
                          .strict(),
                      )
                      .optional(),
                  })
                  .strict(),
              ),
            })
            .strict()
            .nullable()
            .optional(),
          nodes: z.array(
            z
              .object({
                id: z.string(),
                suiteId: z.string(),
                state: z.enum(nodeStates),
                queuedAt: z.string().nullable(),
                startedAt: z.string().nullable(),
                completedAt: z.string().nullable(),
                attempt: z.number().int().positive(),
                rootFailureId: z.string().nullable(),
                wave: z.number().int().nonnegative().nullable().optional(),
                evidenceDisposition: z.string().nullable().optional(),
                resources: z.array(z.string()).optional(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export type SoundingLineProjection = z.infer<typeof projectionSchema>;

export function normalizeSoundingLineProjection(value: unknown): SoundingLineProjection {
  return projectionSchema.parse(value);
}

export function testTotals(projection: SoundingLineProjection | null) {
  const nodes = projection?.plans.flatMap((plan) => plan.nodes) ?? [];
  const roots = new Set(
    nodes.filter((node) => node.state === "FAILED" && node.rootFailureId).map((node) => node.rootFailureId),
  );
  return {
    queued: nodes.filter((node) => node.state === "QUEUED").length,
    running: nodes.filter((node) => node.state === "RUNNING").length,
    passed: nodes.filter((node) => node.state === "PASSED" || node.state === "PASSED_AFTER_RETRY").length,
    retries: nodes.filter((node) => node.state === "PASSED_AFTER_RETRY" || node.attempt > 1).length,
    rootFailures: roots.size + nodes.filter((node) => node.state === "FAILED" && !node.rootFailureId).length,
    blockedDependents: nodes.filter((node) => node.state === "BLOCKED").length,
  };
}

export class SoundingLineCollector {
  constructor(
    private readonly config: Config,
    private readonly store: BridgewatchStore,
  ) {}
  cached(): SoundingLineProjection | null {
    return this.store.get<SoundingLineProjection>("sounding-line:projection")?.value ?? null;
  }
  async refresh(): Promise<SoundingLineProjection | null> {
    // Bridgewatch is intentionally launched from its package directory (the static
    // dashboard uses that same contract). Its repository-owned observer therefore
    // always resolves relative to the repository root, in source and built forms.
    const script = resolve(process.cwd(), "..", "scripts", "sounding-line", "status-projection.mjs");
    try {
      const args = this.config.BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH
        ? [script, this.config.BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH]
        : [script];
      const { stdout } = await execFileAsync(process.execPath, args, {
        timeout: this.config.BRIDGEWATCH_REQUEST_TIMEOUT_MS,
        maxBuffer: 256 * 1024,
      });
      const projection = normalizeSoundingLineProjection(JSON.parse(stdout));
      this.store.put("sounding-line:projection", projection, null, projection.observedAt);
      this.store.replaceTestProjection(projection);
      return projection;
    } catch {
      return this.cached();
    }
  }
}
