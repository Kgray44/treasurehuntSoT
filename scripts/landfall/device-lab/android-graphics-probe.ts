import { createHash } from "node:crypto";

export type AndroidGraphicsProbe = {
  kind: "ANDROID_DEVELOPMENT_GRAPHICS_COMPARISON";
  backend: "swangle";
  authoritative: false;
  workflowSha256: string;
};
const workflowPath = ".github/workflows/landfall-device-lab.yml";

/** An explicit diagnostic option cannot widen a protected tier or device matrix. */
export function androidGraphicsProbeBackend(
  backend: unknown,
  target: unknown,
  tier: unknown,
  profiles: unknown,
): "swangle" | undefined {
  if (backend === undefined) return undefined;
  if (backend !== "swangle") throw new Error("LANDFALL_HOSTED_GRAPHICS_BACKEND_INVALID");
  if (
    target !== "android" ||
    tier !== "development" ||
    !Array.isArray(profiles) ||
    profiles.length !== 1 ||
    profiles[0] !== "primary-phone"
  )
    throw new Error("LANDFALL_HOSTED_GRAPHICS_SCOPE_INVALID");
  return backend;
}

function mainAndroidGpu(workflow: string) {
  const jobs = [...workflow.matchAll(/^  android:\r?\n/gm)];
  if (jobs.length !== 1) throw new Error("LANDFALL_HOSTED_GRAPHICS_TEMPLATE_AMBIGUOUS");
  const start = jobs[0].index! + jobs[0][0].length;
  const next = /^  [A-Za-z0-9_-]+:\r?$/m.exec(workflow.slice(start));
  const end = next ? start + next.index : workflow.length;
  const flags = [...workflow.slice(start, end).matchAll(/-gpu[ \t]+([A-Za-z0-9_-]+)(?=[ \t\r\n]|$)/g)];
  if (flags.length !== 1) throw new Error("LANDFALL_HOSTED_GRAPHICS_TEMPLATE_AMBIGUOUS");
  return { backend: flags[0][1], offset: start + flags[0].index!, token: flags[0][0] };
}

/** Preserve every byte outside the one main-Android graphics argument. */
export function androidGraphicsProbeTemplate(template: string, backend: "swangle" | undefined) {
  if (backend === undefined) return template;
  if (backend !== "swangle") throw new Error("LANDFALL_HOSTED_GRAPHICS_BACKEND_INVALID");
  const gpu = mainAndroidGpu(template);
  if (gpu.backend !== "swiftshader") throw new Error("LANDFALL_HOSTED_GRAPHICS_TEMPLATE_BACKEND_INVALID");
  return (
    template.slice(0, gpu.offset) +
    gpu.token.replace("swiftshader", backend) +
    template.slice(gpu.offset + gpu.token.length)
  );
}

export function androidGraphicsProbeMetadata(
  backend: "swangle" | undefined,
  workflow: string,
): AndroidGraphicsProbe | undefined {
  if (backend === undefined) return undefined;
  if (backend !== "swangle" || mainAndroidGpu(workflow).backend !== backend)
    throw new Error("LANDFALL_HOSTED_GRAPHICS_WORKFLOW_INVALID");
  return {
    kind: "ANDROID_DEVELOPMENT_GRAPHICS_COMPARISON",
    backend,
    authoritative: false,
    workflowSha256: createHash("sha256").update(workflow).digest("hex"),
  };
}

export function readAndroidGraphicsProbe(
  value: unknown,
  target: unknown,
  tier: unknown,
  profiles: unknown,
): AndroidGraphicsProbe | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("LANDFALL_HOSTED_GRAPHICS_METADATA_INVALID");
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "authoritative,backend,kind,workflowSha256" ||
    record.kind !== "ANDROID_DEVELOPMENT_GRAPHICS_COMPARISON" ||
    record.backend !== "swangle" ||
    record.authoritative !== false ||
    typeof record.workflowSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.workflowSha256)
  )
    throw new Error("LANDFALL_HOSTED_GRAPHICS_METADATA_INVALID");
  androidGraphicsProbeBackend(record.backend, target, tier, profiles);
  return record as AndroidGraphicsProbe;
}

/** Bind the diagnostic marker to the immutable transport, never just its name. */
export function validateAndroidGraphicsProbeTransport(
  probe: AndroidGraphicsProbe | undefined,
  candidateTemplate: string,
  transportWorkflow: string,
  changedPaths: readonly string[],
) {
  if (!probe) {
    const optionalBackend = (workflow: string) => {
      try {
        return mainAndroidGpu(workflow).backend;
      } catch {
        return undefined;
      }
    };
    const original = optionalBackend(candidateTemplate);
    const transported = optionalBackend(transportWorkflow);
    if (original !== undefined && transported !== undefined && original !== transported)
      throw new Error("LANDFALL_HOSTED_GRAPHICS_METADATA_MISSING");
    return;
  }
  if (changedPaths.length !== 1 || changedPaths[0] !== workflowPath)
    throw new Error("LANDFALL_HOSTED_GRAPHICS_TRANSPORT_SCOPE_INVALID");
  const expected = androidGraphicsProbeMetadata(probe.backend, transportWorkflow);
  if (!expected || expected.workflowSha256 !== probe.workflowSha256)
    throw new Error("LANDFALL_HOSTED_GRAPHICS_WORKFLOW_INVALID");
  // The exact candidate must still have the original comparison seam.
  androidGraphicsProbeTemplate(candidateTemplate, probe.backend);
}
