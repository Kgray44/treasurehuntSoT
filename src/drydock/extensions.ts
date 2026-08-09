import { z } from "zod";
import { createDrydockIssue, type DrydockIssue, type DrydockSemanticLocation } from "@/drydock/issues";

export type DrydockExtensionActivation = "ACTIVE" | "PRESERVE_INACTIVE";

export type DrydockExtensionRegistration = {
  namespace: string;
  version: number;
  owner: string;
  activation: DrydockExtensionActivation;
  payloadSchema: z.ZodType<unknown>;
};

const registrations = [
  {
    namespace: "voyagewright.compatibility",
    version: 1,
    owner: "Project Drydock",
    activation: "PRESERVE_INACTIVE",
    payloadSchema: z
      .object({
        sourceVersion: z.number().int().min(1).max(100),
        fields: z.array(z.string().min(1).max(120)).max(32),
      })
      .strict(),
  },
] as const satisfies readonly DrydockExtensionRegistration[];

const byNamespace = new Map<string, DrydockExtensionRegistration>(
  registrations.map((registration) => [registration.namespace, registration]),
);

export const drydockExtensionsSchema = z.record(
  z.string().min(3).max(120),
  z
    .object({
      version: z.number().int().min(1).max(100),
      payload: z.unknown(),
    })
    .strict(),
);

export function serializeExtensionRegistry() {
  return registrations.map((registration) => ({
    namespace: registration.namespace,
    version: registration.version,
    owner: registration.owner,
    activation: registration.activation,
  }));
}

export function validateDrydockExtensions(
  value: unknown,
  location: DrydockSemanticLocation,
): { extensions: Record<string, { version: number; payload: unknown }>; issues: DrydockIssue[] } {
  if (value === undefined) return { extensions: {}, issues: [] };
  const envelope = drydockExtensionsSchema.safeParse(value);
  if (!envelope.success)
    return {
      extensions: {},
      issues: envelope.error.issues.map((issue) =>
        createDrydockIssue({
          code: "DRYDOCK_EXTENSION_ENVELOPE_INVALID",
          category: "EXTENSION",
          severity: "ERROR",
          ruleVersion: 1,
          location: { ...location, fieldPath: [location.fieldPath, ...issue.path].filter(Boolean).join(".") },
          message: "The extension envelope is malformed.",
          remediation: "Use a registered namespace with a versioned payload.",
        }),
      ),
    };
  const issues: DrydockIssue[] = [];
  for (const [namespace, extension] of Object.entries(envelope.data)) {
    const registration = byNamespace.get(namespace);
    if (!registration) {
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_EXTENSION_NAMESPACE_UNREGISTERED",
          category: "EXTENSION",
          severity: "ERROR",
          ruleVersion: 1,
          location: { ...location, fieldPath: `${location.fieldPath ?? "extensions"}.${namespace}` },
          message: "This authored extension namespace is not registered.",
          remediation: "Install a governed extension adapter or remove the extension.",
        }),
      );
      continue;
    }
    if (extension.version !== registration.version || !registration.payloadSchema.safeParse(extension.payload).success)
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_EXTENSION_PAYLOAD_INVALID",
          category: "EXTENSION",
          severity: "ERROR",
          ruleVersion: 1,
          location: { ...location, fieldPath: `${location.fieldPath ?? "extensions"}.${namespace}` },
          message: "This extension does not match its registered versioned contract.",
          remediation: "Migrate the extension through its canonical owner adapter.",
        }),
      );
  }
  return { extensions: envelope.data, issues };
}
