import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { Config } from "./config.js";
import type { ProjectRecord } from "./domain.js";
import type { SoundingLineProjection } from "./sounding-line.js";
import type { Heartbeat } from "./telemetry.js";
import type { Snapshot } from "../lib/github.js";
import type { BridgewatchStore } from "../lib/store.js";

const execFileAsync = promisify(execFile);
const maxReadBytes = 256 * 1024;

export type FactState =
  | "AUTHORITATIVE"
  | "PROVISIONAL"
  | "STALE"
  | "SOURCE_UNAVAILABLE"
  | "NOT_HISTORICALLY_RECORDED"
  | "UNKNOWN";

export type FactAuthority = "AUTHORITATIVE" | "PROVISIONAL" | "OBSERVATIONAL";
export type FactSourceId =
  | "github-repository"
  | "git-main"
  | "governing-records"
  | "project-registry"
  | "feature-catalog"
  | "deepwater-evidence"
  | "sounding-line-evidence"
  | "codex-telemetry"
  | "voyagewright-runtime"
  | "schema-migrations"
  | "provider-jobs";

export interface ExpectedFactClass {
  id: string;
  label: string;
  system: string;
  sourceIds: FactSourceId[];
  historical: boolean;
}

export const expectedFactClasses: readonly ExpectedFactClass[] = [
  {
    id: "repository.remote",
    label: "Remote repository truth",
    system: "Repository",
    sourceIds: ["github-repository"],
    historical: false,
  },
  {
    id: "repository.current-main",
    label: "Current main identity",
    system: "Repository",
    sourceIds: ["git-main", "github-repository"],
    historical: true,
  },
  {
    id: "governance.records",
    label: "Indexed governing records",
    system: "Governance",
    sourceIds: ["governing-records"],
    historical: true,
  },
  {
    id: "projects.registry",
    label: "Project and phase registry",
    system: "Governance",
    sourceIds: ["project-registry"],
    historical: true,
  },
  {
    id: "features.catalog",
    label: "Completed feature catalog",
    system: "Governance",
    sourceIds: ["feature-catalog"],
    historical: true,
  },
  {
    id: "deepwater.capability-evidence",
    label: "Deepwater capability evidence",
    system: "Delivery evidence",
    sourceIds: ["deepwater-evidence"],
    historical: true,
  },
  {
    id: "sounding-line.ordinary-evidence",
    label: "Sounding Line ordinary or release evidence",
    system: "Delivery evidence",
    sourceIds: ["sounding-line-evidence"],
    historical: true,
  },
  {
    id: "codex.worker-telemetry",
    label: "Codex worker activity telemetry",
    system: "Coordination",
    sourceIds: ["codex-telemetry"],
    historical: false,
  },
  {
    id: "voyagewright.runtime-identity",
    label: "Voyagewright development or runtime identity",
    system: "Voyagewright",
    sourceIds: ["voyagewright-runtime"],
    historical: false,
  },
  {
    id: "voyagewright.schema-migrations",
    label: "Schema and migration inventory",
    system: "Voyagewright",
    sourceIds: ["schema-migrations"],
    historical: true,
  },
  {
    id: "operations.provider-jobs",
    label: "Configured provider or background-job status",
    system: "Operations",
    sourceIds: ["provider-jobs"],
    historical: false,
  },
] as const;

export interface FactProvenance {
  sourceId: FactSourceId;
  sourceIdentity: string;
  reference: string;
  authority: FactAuthority;
  precedence: number;
  sourceObservedAt: string | null;
  bridgewatchObservedAt: string;
  retainedFromCache: boolean;
}

export interface ObservationFact {
  key: string;
  factClass: string;
  label: string;
  state: FactState;
  value: Record<string, boolean | number | string | null>;
  provenance: FactProvenance;
  limitation: string | null;
}

export interface FabricSource {
  id: FactSourceId;
  name: string;
  configured: boolean;
  reachable: boolean | null;
  state: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED";
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  cacheAgeMs: number | null;
  authority: FactAuthority;
  precedence: number;
  failure: string | null;
  servingRetainedStaleData: boolean;
  expectedFactClasses: string[];
  facts: ObservationFact[];
}

export interface CoverageSummary {
  system: string;
  expected: number;
  authoritative: number;
  provisional: number;
  stale: number;
  sourceUnavailable: number;
  notHistoricallyRecorded: number;
  unknown: number;
  factClasses: Array<{
    id: string;
    label: string;
    state: FactState;
    sourceId: FactSourceId | null;
    limitation: string | null;
  }>;
}

export interface DataFabricSnapshot {
  observedAt: string;
  sources: FabricSource[];
  facts: ObservationFact[];
  coverage: CoverageSummary[];
}

interface FabricInput {
  github: Snapshot | null;
  soundingLine: SoundingLineProjection | null;
  projects: readonly ProjectRecord[];
  workers: readonly Heartbeat[];
}

interface RuntimeIdentity {
  sourceSha: string | null;
  port: number | null;
  startedAt: string | null;
  state: string | null;
}

interface ProviderStatus {
  providerCount: number;
  healthyCount: number;
  degradedCount: number;
  observedAt: string | null;
}

const classFor = (id: string) => {
  const item = expectedFactClasses.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown Bridgewatch P2 fact class: ${id}`);
  return item;
};

const now = () => new Date().toISOString();

function sanitizeDiagnostic(value: unknown): string {
  const text = value instanceof Error ? value.message : "Source observation failed";
  return text
    .replace(/(?:bearer|token|authorization|cookie|password)\s*[:=]\s*[^\s,;]+/giu, "$1=[redacted]")
    .replace(/[\r\n]+/gu, " ")
    .slice(0, 320);
}

function cacheAge(observedAt: string | null): number | null {
  if (!observedAt) return null;
  const value = Date.parse(observedAt);
  return Number.isFinite(value) ? Math.max(0, Date.now() - value) : null;
}

function fact(
  source: Pick<FabricSource, "id" | "name" | "authority" | "precedence">,
  factClass: string,
  state: FactState,
  value: ObservationFact["value"],
  reference: string,
  sourceObservedAt: string | null,
  observedAt: string,
  limitation: string | null = null,
): ObservationFact {
  const expected = classFor(factClass);
  return {
    key: `${source.id}:${factClass}`,
    factClass,
    label: expected.label,
    state,
    value,
    provenance: {
      sourceId: source.id,
      sourceIdentity: source.name,
      reference,
      authority: source.authority,
      precedence: source.precedence,
      sourceObservedAt,
      bridgewatchObservedAt: observedAt,
      retainedFromCache: false,
    },
    limitation,
  };
}

function unavailableFacts(
  source: FabricSource,
  observedAt: string,
  state: FactState,
  limitation: string,
): ObservationFact[] {
  return source.expectedFactClasses.map((factClass) =>
    fact(source, factClass, state, {}, source.id, null, observedAt, limitation),
  );
}

function staleSource(source: FabricSource, observedAt: string, failure: string): FabricSource {
  const retained = source.facts.map((item) => ({
    ...item,
    state: item.state === "NOT_HISTORICALLY_RECORDED" ? item.state : ("STALE" as const),
    limitation: item.limitation ?? "The latest source attempt failed; this retained observation may be stale.",
    provenance: {
      ...item.provenance,
      bridgewatchObservedAt: observedAt,
      retainedFromCache: true,
    },
  }));
  return {
    ...source,
    state: "DEGRADED",
    reachable: false,
    lastAttemptAt: observedAt,
    cacheAgeMs: cacheAge(source.lastSuccessAt),
    failure,
    servingRetainedStaleData: true,
    facts: retained,
  };
}

function sourceTemplate(
  id: FactSourceId,
  name: string,
  authority: FactAuthority,
  precedence: number,
  configured: boolean,
  observedAt: string,
): FabricSource {
  return {
    id,
    name,
    configured,
    reachable: configured ? true : null,
    state: configured ? "HEALTHY" : "NOT_CONFIGURED",
    lastAttemptAt: observedAt,
    lastSuccessAt: configured ? observedAt : null,
    cacheAgeMs: 0,
    authority,
    precedence,
    failure: null,
    servingRetainedStaleData: false,
    expectedFactClasses: expectedFactClasses.filter((entry) => entry.sourceIds.includes(id)).map((entry) => entry.id),
    facts: [],
  };
}

function asRuntimeIdentity(value: unknown): RuntimeIdentity {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sourceSha = [item.sourceSha, item.headSha, item.commit, item.gitSha].find(
    (entry): entry is string => typeof entry === "string" && /^[0-9a-f]{7,64}$/iu.test(entry),
  );
  const port = [item.port, item.listenPort].find(
    (entry): entry is number => typeof entry === "number" && Number.isInteger(entry) && entry > 0 && entry < 65_536,
  );
  const startedAt = [item.startedAt, item.started_at].find(
    (entry): entry is string => typeof entry === "string" && Number.isFinite(Date.parse(entry)),
  );
  const state = [item.state, item.status].find(
    (entry): entry is string => typeof entry === "string" && /^[A-Z0-9_-]{2,64}$/iu.test(entry),
  );
  return { sourceSha: sourceSha ?? null, port: port ?? null, startedAt: startedAt ?? null, state: state ?? null };
}

function asProviderStatus(value: unknown): ProviderStatus {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const providers = Array.isArray(item.providers) ? item.providers.slice(0, 100) : [];
  const states = providers.map((entry) =>
    entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).state === "string"
      ? String((entry as Record<string, unknown>).state).toUpperCase()
      : "UNKNOWN",
  );
  const observedAt =
    typeof item.observedAt === "string" && Number.isFinite(Date.parse(item.observedAt)) ? item.observedAt : null;
  return {
    providerCount: providers.length,
    healthyCount: states.filter((state) => ["HEALTHY", "READY", "OK"].includes(state)).length,
    degradedCount: states.filter((state) => ["DEGRADED", "FAILED", "UNAVAILABLE", "ERROR"].includes(state)).length,
    observedAt,
  };
}

async function readBoundedJson(path: string): Promise<unknown> {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > maxReadBytes)
    throw new Error("Configured observation file is unavailable or outside the safe size limit");
  // Host-owned Windows state files can be UTF-8-with-BOM. Treat that encoding
  // marker as transport only; the strict allowlists below still control every
  // retained field.
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/u, "")) as unknown;
}

async function readBoundedText(path: string): Promise<string> {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > maxReadBytes)
    throw new Error("Observation file is unavailable or outside the safe size limit");
  return readFile(path, "utf8");
}

function fromRepository(root: string, path: string): string {
  const absolute = resolve(root, path);
  const local = relative(root, absolute);
  if (!local || local.startsWith("..") || /^[a-z]:/iu.test(local))
    throw new Error("Bridgewatch rejected an out-of-root observation path");
  return absolute;
}

/**
 * P2's fabric is intentionally a fixed set of typed, read-only adapters. It
 * never accepts browser-controlled paths, commands, or filter expressions.
 */
export class DataFabricCollector {
  constructor(
    private readonly config: Config,
    private readonly store: BridgewatchStore,
    private readonly repositoryRoot: string,
  ) {}

  async refresh(input: FabricInput): Promise<DataFabricSnapshot> {
    const observedAt = now();
    const sources = await Promise.all([
      this.collectGithub(input.github, observedAt),
      this.collectGitMain(observedAt),
      this.collectGoverningRecords(observedAt),
      this.collectProjectRegistry(input.projects, observedAt),
      this.collectFeatureCatalog(observedAt),
      this.collectDeepwaterEvidence(observedAt),
      this.collectSoundingLine(input.soundingLine, observedAt),
      this.collectTelemetry(input.workers, observedAt),
      this.collectRuntimeIdentity(observedAt),
      this.collectSchemaMigrations(observedAt),
      this.collectProviderJobs(observedAt),
    ]);
    const facts = sources.flatMap((source) => source.facts);
    this.store.recordFabricFacts(facts);
    return { observedAt, sources, facts, coverage: deriveCoverage(facts) };
  }

  private async collected(
    base: FabricSource,
    collect: () => Promise<Omit<FabricSource, "id" | "name" | "authority" | "precedence" | "expectedFactClasses">>,
  ): Promise<FabricSource> {
    const cacheKey = `fabric:${base.id}`;
    try {
      const value = await collect();
      const result = { ...base, ...value };
      if (result.configured && result.reachable)
        this.store.put(cacheKey, result, null, result.lastSuccessAt ?? result.lastAttemptAt);
      return result;
    } catch (error) {
      const diagnostic = sanitizeDiagnostic(error);
      const cached = this.store.get<FabricSource>(cacheKey)?.value;
      if (cached) return staleSource(cached, base.lastAttemptAt, diagnostic);
      const unavailable: FabricSource = {
        ...base,
        state: "UNAVAILABLE",
        reachable: false,
        lastSuccessAt: null,
        cacheAgeMs: null,
        failure: diagnostic,
      };
      unavailable.facts = unavailableFacts(
        unavailable,
        base.lastAttemptAt,
        "SOURCE_UNAVAILABLE",
        "Bridgewatch cannot currently observe this configured source.",
      );
      return unavailable;
    }
  }

  private collectGithub(snapshot: Snapshot | null, observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate("github-repository", "GitHub repository API", "AUTHORITATIVE", 90, true, observedAt);
    return this.collected(base, async () => {
      if (!snapshot) throw new Error("No retained GitHub repository observation is available");
      const sourceObservedAt = snapshot.observedAt;
      const source = { ...base, lastSuccessAt: sourceObservedAt, cacheAgeMs: cacheAge(sourceObservedAt) };
      return {
        ...source,
        facts: [
          fact(
            source,
            "repository.remote",
            "AUTHORITATIVE",
            {
              pullRequestCount: snapshot.pullRequests.length,
              branchCount: snapshot.branches.length,
              workflowCount: snapshot.workflows.length,
              defaultBranch: snapshot.defaultBranch,
            },
            `github:${snapshot.repository}`,
            sourceObservedAt,
            observedAt,
            "GitHub collection remains bounded by the configured observation limits.",
          ),
          fact(
            source,
            "repository.current-main",
            "AUTHORITATIVE",
            { headSha: snapshot.headSha, defaultBranch: snapshot.defaultBranch },
            `github:${snapshot.repository}:${snapshot.defaultBranch}`,
            sourceObservedAt,
            observedAt,
          ),
        ],
      };
    });
  }

  private collectGitMain(observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate(
      "git-main",
      "Local Git current-main observation",
      "AUTHORITATIVE",
      100,
      true,
      observedAt,
    );
    return this.collected(base, async () => {
      const { stdout } = await execFileAsync(
        "git",
        ["-C", this.repositoryRoot, "log", "-1", "--format=%H%x09%cI", "origin/main"],
        { timeout: this.config.BRIDGEWATCH_REQUEST_TIMEOUT_MS, maxBuffer: 16 * 1024 },
      );
      const [headShaValue, committedAtValue] = stdout.trim().split("\t", 2);
      if (!/^[0-9a-f]{7,64}$/iu.test(headShaValue ?? "") || !Number.isFinite(Date.parse(committedAtValue ?? "")))
        throw new Error("Local Git did not return a valid origin/main identity");
      const headSha = headShaValue!;
      const committedAt = committedAtValue!;
      const source = { ...base, lastSuccessAt: observedAt, cacheAgeMs: 0 };
      return {
        ...source,
        facts: [
          fact(
            source,
            "repository.current-main",
            "AUTHORITATIVE",
            { headSha, committedAt },
            "git:origin/main",
            committedAt,
            observedAt,
          ),
        ],
      };
    });
  }

  private collectGoverningRecords(observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate(
      "governing-records",
      "Indexed governing records",
      "AUTHORITATIVE",
      100,
      true,
      observedAt,
    );
    return this.collected(base, async () => {
      const index = (await readBoundedJson(
        fromRepository(this.repositoryRoot, "Development_Docs/document-index.json"),
      )) as {
        records?: unknown;
      };
      const records = Array.isArray(index.records) ? index.records : [];
      const current = records.filter((entry) => {
        const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return (
          typeof record.path === "string" &&
          typeof record.status === "string" &&
          !record.status.toLowerCase().includes("archiv")
        );
      });
      const source = { ...base, lastSuccessAt: observedAt, cacheAgeMs: 0 };
      return {
        ...source,
        facts: [
          fact(
            source,
            "governance.records",
            "AUTHORITATIVE",
            { indexedRecordCount: current.length },
            "Development_Docs/document-index.json",
            observedAt,
            observedAt,
            "Only machine-indexed non-archived records are observed; private or unindexed records are not inferred.",
          ),
        ],
      };
    });
  }

  private collectProjectRegistry(projects: readonly ProjectRecord[], observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate(
      "project-registry",
      "Bridgewatch project registry",
      "AUTHORITATIVE",
      95,
      true,
      observedAt,
    );
    return this.collected(base, async () => {
      const acceptedPhaseCount = projects
        .flatMap((project) => project.phases)
        .filter((phase) => ["COMPLETE", "MERGED"].includes(phase.state)).length;
      const missingEvidenceCount = projects.filter((project) => (project.missingEvidence?.length ?? 0) > 0).length;
      const source = { ...base, lastSuccessAt: observedAt, cacheAgeMs: 0 };
      return {
        ...source,
        facts: [
          fact(
            source,
            "projects.registry",
            "AUTHORITATIVE",
            { projectCount: projects.length, acceptedPhaseCount, projectsWithHistoricalGaps: missingEvidenceCount },
            "bridgewatch:project-registry",
            observedAt,
            observedAt,
            missingEvidenceCount
              ? "Projects with documented historical gaps remain explicitly limited rather than reconstructed."
              : null,
          ),
        ],
      };
    });
  }

  private collectFeatureCatalog(observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate("feature-catalog", "Feature Catalog fragments", "AUTHORITATIVE", 100, true, observedAt);
    return this.collected(base, async () => {
      const catalog = await readBoundedJson(
        fromRepository(this.repositoryRoot, "Development_Docs/Features/catalog/bridgewatch.json"),
      );
      if (!Array.isArray(catalog)) throw new Error("Feature Catalog Bridgewatch fragment is not an array");
      const source = { ...base, lastSuccessAt: observedAt, cacheAgeMs: 0 };
      return {
        ...source,
        facts: [
          fact(
            source,
            "features.catalog",
            "AUTHORITATIVE",
            { bridgewatchFeatureCount: catalog.length },
            "Development_Docs/Features/catalog/bridgewatch.json",
            observedAt,
            observedAt,
          ),
        ],
      };
    });
  }

  private collectDeepwaterEvidence(observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate(
      "deepwater-evidence",
      "Deepwater capability evidence",
      "AUTHORITATIVE",
      90,
      true,
      observedAt,
    );
    return this.collected(base, async () => {
      const path = fromRepository(
        this.repositoryRoot,
        "Development_Docs/Programs/Deepwater/deepwater-phase-status.json",
      );
      const status = (await readBoundedJson(path)) as Record<string, unknown>;
      const phases = Array.isArray(status.phases) ? status.phases : [];
      const source = { ...base, lastSuccessAt: observedAt, cacheAgeMs: 0 };
      const state: FactState = phases.length ? "AUTHORITATIVE" : "NOT_HISTORICALLY_RECORDED";
      return {
        ...source,
        facts: [
          fact(
            source,
            "deepwater.capability-evidence",
            state,
            { recordedPhaseCount: phases.length },
            "Development_Docs/Programs/Deepwater/deepwater-phase-status.json",
            observedAt,
            observedAt,
            phases.length
              ? null
              : "The available Deepwater status record does not contain reconstructable phase evidence.",
          ),
        ],
      };
    });
  }

  private collectSoundingLine(snapshot: SoundingLineProjection | null, observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate(
      "sounding-line-evidence",
      "Sounding Line evidence projection",
      "AUTHORITATIVE",
      100,
      true,
      observedAt,
    );
    return this.collected(base, async () => {
      if (!snapshot) throw new Error("No Sounding Line evidence projection is available");
      const plansWithDecisions = snapshot.plans.filter((plan) => Boolean(plan.finalDecision)).length;
      const source = { ...base, lastSuccessAt: snapshot.observedAt, cacheAgeMs: cacheAge(snapshot.observedAt) };
      const state: FactState = snapshot.plans.length ? "AUTHORITATIVE" : "NOT_HISTORICALLY_RECORDED";
      return {
        ...source,
        facts: [
          fact(
            source,
            "sounding-line.ordinary-evidence",
            state,
            { planCount: snapshot.plans.length, decisionCount: plansWithDecisions, leaseCount: snapshot.leases },
            "sounding-line:status-projection",
            snapshot.observedAt,
            observedAt,
            snapshot.plans.length
              ? "Only the source-owned projection is observed; Bridgewatch neither schedules nor finalizes it."
              : "No retained Sounding Line plan evidence exists to reconstruct.",
          ),
        ],
      };
    });
  }

  private collectTelemetry(workers: readonly Heartbeat[], observedAt: string): Promise<FabricSource> {
    const configured = Boolean(this.config.BRIDGEWATCH_TELEMETRY_TOKEN);
    const base = sourceTemplate("codex-telemetry", "Codex worker telemetry", "PROVISIONAL", 30, configured, observedAt);
    return this.collected(base, async () => {
      if (!configured) {
        const source = { ...base, facts: [] };
        return {
          ...source,
          facts: unavailableFacts(
            source,
            observedAt,
            "UNKNOWN",
            "Activity telemetry is not configured, so Bridgewatch cannot observe worker activity.",
          ),
        };
      }
      const lastSuccessAt =
        workers
          .map((worker) => worker.heartbeatAt)
          .sort()
          .at(-1) ?? observedAt;
      const source = { ...base, lastSuccessAt, cacheAgeMs: cacheAge(lastSuccessAt) };
      return {
        ...source,
        facts: [
          fact(
            source,
            "codex.worker-telemetry",
            workers.length ? "PROVISIONAL" : "NOT_HISTORICALLY_RECORDED",
            { retainedWorkerCount: workers.length },
            "bridgewatch:telemetry",
            lastSuccessAt,
            observedAt,
            workers.length
              ? "Telemetry is activity-only and never establishes lifecycle, release, or completion authority."
              : "No retained worker telemetry exists for this observation window.",
          ),
        ],
      };
    });
  }

  private collectRuntimeIdentity(observedAt: string): Promise<FabricSource> {
    const configured = Boolean(this.config.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH);
    const base = sourceTemplate(
      "voyagewright-runtime",
      "Voyagewright runtime identity",
      "OBSERVATIONAL",
      50,
      configured,
      observedAt,
    );
    return this.collected(base, async () => {
      if (!this.config.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH) {
        const source = { ...base, facts: [] };
        return {
          ...source,
          facts: unavailableFacts(
            source,
            observedAt,
            "UNKNOWN",
            "No approved Voyagewright runtime-state path is configured for this private observer.",
          ),
        };
      }
      const identity = asRuntimeIdentity(
        await readBoundedJson(this.config.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH),
      );
      const sourceObservedAt = identity.startedAt ?? observedAt;
      const source = { ...base, lastSuccessAt: sourceObservedAt, cacheAgeMs: cacheAge(sourceObservedAt) };
      return {
        ...source,
        facts: [
          fact(
            source,
            "voyagewright.runtime-identity",
            identity.sourceSha || identity.port ? "PROVISIONAL" : "NOT_HISTORICALLY_RECORDED",
            {
              sourceSha: identity.sourceSha,
              listenPort: identity.port,
              runtimeState: identity.state,
              startedAt: identity.startedAt,
            },
            "configured:BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH",
            sourceObservedAt,
            observedAt,
            "Only an allowlisted runtime identity is observed; cookies, headers, prompts, logs, and process command lines are excluded.",
          ),
        ],
      };
    });
  }

  private collectSchemaMigrations(observedAt: string): Promise<FabricSource> {
    const base = sourceTemplate(
      "schema-migrations",
      "Voyagewright schema and migrations",
      "AUTHORITATIVE",
      95,
      true,
      observedAt,
    );
    return this.collected(base, async () => {
      const schema = await readBoundedText(fromRepository(this.repositoryRoot, "prisma/schema.sqlite.prisma"));
      const migrations = await readdir(fromRepository(this.repositoryRoot, "prisma/migrations"), {
        withFileTypes: true,
      });
      const source = { ...base, lastSuccessAt: observedAt, cacheAgeMs: 0 };
      return {
        ...source,
        facts: [
          fact(
            source,
            "voyagewright.schema-migrations",
            "AUTHORITATIVE",
            {
              modelCount: (schema.match(/^model\s+[A-Za-z0-9_]+/gmu) ?? []).length,
              migrationDirectoryCount: migrations.filter((entry) => entry.isDirectory()).length,
            },
            "prisma/schema.sqlite.prisma; prisma/migrations",
            observedAt,
            observedAt,
            "This is a source inventory only; Bridgewatch does not connect to or mutate a product database.",
          ),
        ],
      };
    });
  }

  private collectProviderJobs(observedAt: string): Promise<FabricSource> {
    const configured = Boolean(this.config.BRIDGEWATCH_PROVIDER_STATUS_PATH);
    const base = sourceTemplate(
      "provider-jobs",
      "Provider and background-job status",
      "OBSERVATIONAL",
      40,
      configured,
      observedAt,
    );
    return this.collected(base, async () => {
      if (!this.config.BRIDGEWATCH_PROVIDER_STATUS_PATH) {
        const source = { ...base, facts: [] };
        return {
          ...source,
          facts: unavailableFacts(
            source,
            observedAt,
            "UNKNOWN",
            "No approved provider or job-status projection is configured.",
          ),
        };
      }
      const status = asProviderStatus(await readBoundedJson(this.config.BRIDGEWATCH_PROVIDER_STATUS_PATH));
      const sourceObservedAt = status.observedAt ?? observedAt;
      const source = { ...base, lastSuccessAt: sourceObservedAt, cacheAgeMs: cacheAge(sourceObservedAt) };
      return {
        ...source,
        facts: [
          fact(
            source,
            "operations.provider-jobs",
            status.providerCount ? "PROVISIONAL" : "NOT_HISTORICALLY_RECORDED",
            {
              providerCount: status.providerCount,
              healthyCount: status.healthyCount,
              degradedCount: status.degradedCount,
            },
            "configured:BRIDGEWATCH_PROVIDER_STATUS_PATH",
            sourceObservedAt,
            observedAt,
            "Only the bounded status projection is observed; Bridgewatch cannot dispatch, retry, or cancel jobs.",
          ),
        ],
      };
    });
  }
}

const stateRank: Record<FactState, number> = {
  AUTHORITATIVE: 6,
  PROVISIONAL: 5,
  STALE: 4,
  SOURCE_UNAVAILABLE: 3,
  NOT_HISTORICALLY_RECORDED: 2,
  UNKNOWN: 1,
};

function resolveFact(expected: ExpectedFactClass, facts: readonly ObservationFact[]) {
  const candidates = facts.filter((item) => item.factClass === expected.id);
  const selected = [...candidates].sort(
    (left, right) =>
      stateRank[right.state] - stateRank[left.state] ||
      right.provenance.precedence - left.provenance.precedence ||
      right.provenance.bridgewatchObservedAt.localeCompare(left.provenance.bridgewatchObservedAt),
  )[0];
  return (
    selected ?? {
      state: expected.historical ? ("NOT_HISTORICALLY_RECORDED" as const) : ("UNKNOWN" as const),
      provenance: { sourceId: null },
      limitation: expected.historical
        ? "No approved source has recorded reconstructable historical evidence for this expected fact class."
        : "No approved source is currently configured to observe this expected fact class.",
    }
  );
}

/** Coverage is a counted contract, not a percentage or a claim that an absent fact is false. */
export function deriveCoverage(facts: readonly ObservationFact[]): CoverageSummary[] {
  const systems = [...new Set(expectedFactClasses.map((entry) => entry.system))];
  return systems.map((system) => {
    const expected = expectedFactClasses.filter((entry) => entry.system === system);
    const resolved = expected.map((entry) => ({ expected: entry, fact: resolveFact(entry, facts) }));
    const count = (state: FactState) => resolved.filter((entry) => entry.fact.state === state).length;
    return {
      system,
      expected: expected.length,
      authoritative: count("AUTHORITATIVE"),
      provisional: count("PROVISIONAL"),
      stale: count("STALE"),
      sourceUnavailable: count("SOURCE_UNAVAILABLE"),
      notHistoricallyRecorded: count("NOT_HISTORICALLY_RECORDED"),
      unknown: count("UNKNOWN"),
      factClasses: resolved.map(({ expected: item, fact: resolvedFact }) => ({
        id: item.id,
        label: item.label,
        state: resolvedFact.state,
        sourceId: resolvedFact.provenance.sourceId,
        limitation: resolvedFact.limitation,
      })),
    };
  });
}
