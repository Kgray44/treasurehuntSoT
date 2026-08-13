import type { PublishedTaleSnapshot } from "@/chronicle/types";
import type { DrydockEvidenceRequirement } from "@/drydock/readiness";

const base: readonly DrydockEvidenceRequirement[] = [
  { id: "DD-R-STATIC", version: "1", capability: "BASELINE", requirementType: "STATIC", mandatory: true, resolver: "Drydock validation report" },
  { id: "DD-R-SCENARIOS", version: "1", capability: "BASELINE", requirementType: "SCENARIO_SUITE", mandatory: true, resolver: "Drydock Scenario Suite" },
  { id: "DD-R-COMPATIBILITY", version: "1", capability: "BASELINE", requirementType: "COMPATIBILITY", mandatory: true, resolver: "Drydock compatibility" },
];

const external = (id: string, capability: string, providerId: string, providerVersion: string, evidenceKind: string, resolver: string): DrydockEvidenceRequirement =>
  ({ id, version: "1", capability, requirementType: "EXTERNAL", mandatory: true, resolver, providerId, providerVersion, evidenceKind });

/** The canonical evidence registry derives obligations from authored source, never Creator declarations. */
export function deriveDrydockEvidenceRequirements(snapshot: PublishedTaleSnapshot): readonly DrydockEvidenceRequirement[] {
  const modes = new Set(snapshot.chapters.flatMap((chapter) => chapter.blocks).map((block) => String(block.completion?.mode ?? "playerConfirmation")));
  const requirements = [...base];
  if (modes.has("visionLocation"))
    requirements.push(external("DD-R-LANDFALL-FIELD", "LOCATION_PROVIDER", "landfall", "adapter-unavailable", "field-evidence", "Project Landfall authoritative field-evidence reference"));
  if (modes.has("visionObject"))
    requirements.push(external("DD-R-WATCHGLASS-EXTERNAL", "OBJECT_PROVIDER", "watchglass", "adapter-unavailable", "provider-evidence", "Project Watchglass authoritative evidence reference"));
  if (modes.has("externalWebhook"))
    requirements.push(external("DD-R-EXTERNAL-PROVIDER", "EXTERNAL_PROVIDER", "external-provider", "contract-v1", "provider-evidence", "Registered external-provider evidence reference"));
  return requirements;
}

export function baseDrydockEvidenceRequirements() { return base; }
