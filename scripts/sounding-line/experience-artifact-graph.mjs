import { createHash } from "node:crypto";
import path from "node:path";
import { digest } from "./evidence.mjs";
import { createArtifactDependencyGraph, compileArtifactDependencyClosures } from "./artifact-dependency-graph.mjs";
import { ARTIFACT_TYPES, artifactLogicalKey, artifactContextKey } from "./artifact-evidence-registry.mjs";

const need = (condition, code) => {
  if (!condition) throw new Error(`SOUNDING_LINE_EXPERIENCE_GRAPH_${code}`);
};
const sha = /^[a-f0-9]{40}$/u,
  sha256 = /^[a-f0-9]{64}$/u;
const prefix = (file, roots) =>
  roots.some((root) => file === root || file.startsWith(root.endsWith("/") ? root : root + "/"));
const imports =
  /(?:import\s+(?:[^"'()]+?\s+from\s+)?|export\s+(?:[^"']+?\s+from\s+)?|require\s*\(|import\s*\()\s*["']([^"']+)["']/gu;
const fileId = (file) => `file:${file}`;
const classify = (file) =>
  /\.(?:woff2?|ttf|otf)$/iu.test(file)
    ? "FONT"
    : /\.(?:png|jpe?g|webp|gif|svg|glb|gltf|mp3|mp4|webm)$/iu.test(file)
      ? "ASSET"
      : /\.(?:css|scss)$/iu.test(file)
        ? "STYLE"
        : /(?:^|\/)tokens\.[cm]?[jt]s$/u.test(file)
          ? "TOKEN"
          : /^src\/app\/api\/.*\/route\.[jt]s$/u.test(file)
            ? "PROJECTION"
            : /(?:^|\/)(?:page|layout)\.[jt]sx?$/u.test(file)
              ? "ROUTE"
              : /(?:\.test|\.spec)\.[cm]?[jt]sx?$/u.test(file) || file.startsWith("tests/")
                ? "TEST"
                : file.startsWith("prisma/")
                  ? "SCHEMA"
                  : file === "package-lock.json"
                    ? "LOCK"
                    : "SOURCE";

export function experienceArtifactCoverage(contracts, viewports) {
  const contexts = [],
    requiredCoverage = [],
    seen = new Set();
  for (const contract of contracts) {
    const experience = contract.experience;
    need(experience && Array.isArray(experience.journeys) && Array.isArray(experience.devices), "CONTRACT");
    for (const journey of experience.journeys)
      for (const device of experience.devices)
        for (const role of journey.roles)
          for (const motionMode of experience.motion ? ["NORMAL", "REDUCED"] : ["REDUCED"]) {
            const viewport = viewports[device];
            need(viewport, "VIEWPORT");
            const key = (type, state = "CONTEXT_CLOSED", captureIndex = null) => ({
              contractId: contract.id,
              journeyId: journey.id,
              state,
              device,
              viewport: { ...viewport },
              role,
              motionMode,
              captureIndex,
              type,
            });
            const screenshots = journey.steps.flatMap((step, index) =>
              step.state && (!step.devices || step.devices.includes(device))
                ? [key("screenshot", step.state, index)]
                : [],
            );
            // A journey without a declared capture point still needs an actual final view.
            const coverage = [
              ...(screenshots.length ? screenshots : [key("screenshot")]),
              ...ARTIFACT_TYPES.filter((type) => type !== "screenshot").map((type) => key(type)),
            ];
            const contextKey = artifactContextKey(coverage[0]),
              id = `context:${digest(contextKey)}`;
            need(!seen.has(id), "DUPLICATE_CONTEXT");
            seen.add(id);
            coverage.forEach(artifactLogicalKey);
            contexts.push({
              id,
              contractId: contract.id,
              journeyId: journey.id,
              device,
              role,
              motionMode,
              viewport: { ...viewport },
              requiredCoverage: coverage,
            });
            requiredCoverage.push(...coverage);
          }
  }
  need(contexts.length <= 10000 && requiredCoverage.length <= 8192, "COVERAGE_BOUND");
  return {
    contexts,
    requiredCoverage,
    requiredCoverageDigest: digest(requiredCoverage.map(artifactLogicalKey).sort()),
  };
}

// The caller supplies bytes from the protected Git reader, not a candidate graph.
// Runtime capabilities are observations/certificates supplied by protected code;
// absent or unknown capabilities conservatively keep the context fresh.
export function buildExperienceArtifactGraph({
  snapshot,
  contracts,
  viewports,
  runtime,
  policyDigest,
  fixturePaths = [],
}) {
  need(snapshot && Array.isArray(snapshot.entries) && snapshot.contents instanceof Map, "SNAPSHOT");
  need(sha256.test(policyDigest ?? "") && runtime, "POLICY_OR_RUNTIME");
  for (const field of ["toolchainDigest", "browserDigest", "environmentDigest", "fixtureDigest"])
    need(sha256.test(runtime[field] ?? ""), "RUNTIME_IDENTITY");
  const entries = new Map(),
    nodes = new Map();
  for (const entry of snapshot.entries) {
    need(typeof entry.path === "string" && sha.test(entry.blob ?? "") && !entries.has(entry.path), "SOURCE_ENTRY");
    entries.set(entry.path, entry);
    const mode = entry.mode ?? "100644";
    nodes.set(fileId(entry.path), {
      id: fileId(entry.path),
      type: classify(entry.path),
      digest: digest({ blob: entry.blob, mode }),
      dependencies: [],
      unknown: !["100644", "100755"].includes(mode) || /\.(?:svg|gltf|glb|mdx)$/iu.test(entry.path),
    });
  }
  const resolve = (importer, specifier) => {
    const target = specifier.startsWith("@/")
      ? `src/${specifier.slice(2)}`
      : specifier.startsWith(".")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier))
        : specifier.startsWith("/")
          ? `public${specifier}`
          : null;
    if (!target) return null;
    return (
      [
        target,
        ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"].flatMap((extension) => [
          target + extension,
          `${target}/index${extension}`,
        ]),
      ].find((file) => entries.has(file)) ?? null
    );
  };
  const runtimeClosed =
    runtime.mutableStateClass === "TASK_OWNED_ISOLATED_PER_CONTEXT" && runtime.externalRuntimeClosed === true;
  const builtins = new Set(runtime.coveredBuiltinModules ?? []),
    environmentKeys = new Set(runtime.environmentKeys ?? []);
  for (const [file, entry] of entries) {
    const node = nodes.get(fileId(file));
    if (!/\.[cm]?[jt]sx?$|\.(?:css|scss)$/u.test(file)) continue;
    const value = snapshot.contents.get(file);
    if (value === undefined) {
      node.unknown = true;
      continue;
    }
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    need(actual === entry.blob, "SOURCE_BYTES_MISMATCH");
    const source = bytes.toString("utf8"),
      dependencies = new Set();
    for (const match of source.matchAll(imports)) {
      const target = resolve(file, match[1]);
      if (target) dependencies.add(fileId(target));
      else if (match[1].startsWith(".") || match[1].startsWith("@/") || match[1].startsWith("/")) node.unknown = true;
      else {
        dependencies.add("runtime:toolchain");
        dependencies.add("file:package-lock.json");
        if (!runtimeClosed || (match[1].startsWith("node:") && !builtins.has(match[1]))) node.unknown = true;
      }
    }
    for (const asset of entries.keys())
      if (asset.startsWith("public/") && source.includes("/" + asset.slice(7))) dependencies.add(fileId(asset));
    for (const match of source.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gu)) {
      const target = resolve(file, match[1]);
      if (target) dependencies.add(fileId(target));
      else node.unknown = true;
    }
    for (const match of source.matchAll(/url\(\s*(["']?)([^"')\s]+)\1\s*\)/gu)) {
      if (match[2].startsWith("data:")) continue;
      const target = resolve(file, match[2]);
      if (target) dependencies.add(fileId(target));
      else node.unknown = true;
    }
    const apiPaths = [...source.matchAll(/["'](\/api\/[^"'\s?]*)/gu)].map((match) => match[1]);
    for (const endpoint of entries.keys())
      if (/^src\/app\/api\/.*\/route\.[jt]s$/u.test(endpoint)) {
        const route = endpoint.replace(/^src\/app/u, "").replace(/\/route\.[jt]s$/u, "");
        const pattern = new RegExp(
          "^" +
            route
              .split("/")
              .map((part) => (part.startsWith("[") ? ".+" : part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")))
              .join("/") +
            "$",
          "u",
        );
        if (apiPaths.some((url) => pattern.test(url))) dependencies.add(fileId(endpoint));
      }
    if (/(?:import|require)\s*\(\s*(?!["'])|\b(?:eval|Function)\s*\(|\bfetch\s*\(\s*(?!["'])|https?:\/\//u.test(source))
      node.unknown = true;
    for (const match of source.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/gu))
      if (!environmentKeys.has(match[1])) node.unknown = true;
    if (/process\.env\s*\[|\b(?:Math\.random|Date\.now|randomUUID|randomBytes)\s*\(/u.test(source)) node.unknown = true;
    // Until a protected parser/capability certificate accounts for these forms,
    // computed resources and ambient state cannot be proven by literal scanning.
    if (/`|\b(?:new\s+URL|localStorage|sessionStorage|document|navigator|window)\b|(?:src|href)\s*=\s*\{/u.test(source))
      node.unknown = true;
    node.dependencies = [...dependencies];
  }
  for (const [name, type, fingerprint] of [
    ["toolchain", "TOOLCHAIN", runtime.toolchainDigest],
    ["browser", "BROWSER", runtime.browserDigest],
    ["environment", "ENVIRONMENT", runtime.environmentDigest],
    ["fixture", "FIXTURE", runtime.fixtureDigest],
  ])
    nodes.set(`runtime:${name}`, {
      id: `runtime:${name}`,
      type,
      digest: fingerprint,
      dependencies: [],
      unknown: !runtimeClosed,
    });
  nodes.set("policy", { id: "policy", type: "POLICY", digest: policyDigest, dependencies: [], unknown: false });
  if (!nodes.has("file:package-lock.json"))
    nodes.set("file:package-lock.json", {
      id: "file:package-lock.json",
      type: "LOCK",
      digest: digest("MISSING_LOCK"),
      dependencies: [],
      unknown: true,
    });
  const coverage = experienceArtifactCoverage(contracts, viewports);
  for (const context of coverage.contexts) {
    const contract = contracts.find((entry) => entry.id === context.contractId),
      experience = contract.experience;
    const journey = experience.journeys.find((entry) => entry.id === context.journeyId);
    const {
      journeys: _journeys,
      states: _states,
      devices: _devices,
      roles: _roles,
      roleSetup: _setup,
      ...metadata
    } = experience;
    const contractId = `contract:${contract.id}`,
      journeyId = `journey:${contract.id}:${journey.id}`;
    nodes.set(contractId, {
      id: contractId,
      type: "CONTRACT",
      digest: digest({ ...contract, experience: metadata }),
      dependencies: [],
      unknown: false,
    });
    const stateIds = new Set(journey.steps.map((step) => step.state).filter(Boolean));
    const states = (experience.states ?? []).filter((state) => stateIds.has(state.id));
    nodes.set(journeyId, {
      id: journeyId,
      type: "CONTRACT",
      digest: digest({ journey, states }),
      dependencies: [],
      unknown: states.length !== stateIds.size,
    });
    context.definitionFingerprint = digest({
      contract: { ...contract, experience: metadata },
      journey,
      states,
      roleSetup: experience.roleSetup?.[context.role] ?? null,
      requiredCoverage: context.requiredCoverage,
    });
    const roots = [...(experience.sourcePaths ?? []), ...(experience.projectionPaths ?? [])];
    const sources = [...entries.keys()].filter((file) => prefix(file, roots));
    const definitions = [...new Set([...(experience.browserTests ?? []), ...fixturePaths])];
    const globalInputs = [...entries.keys()].filter((file) =>
      /(?:^|\/)(?:globals?\.css|tokens\.[jt]s)$|^src\/app\/(?:.*\/)?layout\.[jt]sx?$|^(?:package\.json|tsconfig[^/]*\.json|(?:next|postcss|tailwind|playwright|prisma)\.config\.[^/]+)$|^src\/(?:middleware|instrumentation)\.[jt]s$/u.test(
        file,
      ),
    );
    const missing = definitions.filter((file) => !entries.has(file));
    context.dependencies = [context.id];
    nodes.set(context.id, {
      id: context.id,
      type: "CONTEXT",
      digest: digest({
        contractId: contract.id,
        journeyId: journey.id,
        viewport: context.viewport,
        device: context.device,
        role: context.role,
        motionMode: context.motionMode,
        roleSetup: experience.roleSetup?.[context.role] ?? null,
      }),
      dependencies: [
        ...new Set([
          contractId,
          journeyId,
          "policy",
          "file:package-lock.json",
          "runtime:toolchain",
          "runtime:browser",
          "runtime:environment",
          "runtime:fixture",
          ...sources.map(fileId),
          ...definitions.filter((file) => entries.has(file)).map(fileId),
          ...globalInputs.map(fileId),
          ...[...entries.keys()].filter((file) => file.startsWith("prisma/")).map(fileId),
        ]),
      ],
      unknown: !runtimeClosed || !sources.length || missing.length > 0,
    });
  }
  const graph = createArtifactDependencyGraph([...nodes.values()]);
  const compiled = compileArtifactDependencyClosures(graph),
    artifactDefinitions = [];
  for (const context of coverage.contexts) {
    const closure = compiled.closure(context.dependencies);
    context.dependencyClosureDigest = closure.closureDigest;
    context.unknown = closure.unknown;
    for (const logicalKey of context.requiredCoverage)
      artifactDefinitions.push({
        logicalKey,
        contextId: context.id,
        definitionFingerprint: digest({ context: context.definitionFingerprint, logicalKey }),
        dependencyClosureDigest: closure.closureDigest,
      });
  }
  return { graph, ...coverage, artifactDefinitions, qualification: false };
}
