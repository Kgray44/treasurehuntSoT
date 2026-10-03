import type { LandfallDefinition } from "@/landfall/schema";
import { landfallProviderCatalog } from "@/landfall/provider-catalog";
import type { ProviderDescriptor, ProviderStatus } from "@/landfall/provider-policy";

type Finding = { code: string; severity: "warning" | "blocker"; message: string; targetId?: string };
/** Findings join the existing Drydock/authoring path; no independent publishing authority. */
export function landfallProviderFindings(
  definition: LandfallDefinition,
  providers: readonly ProviderDescriptor[] = landfallProviderCatalog(),
  statuses: readonly ProviderStatus[] = [],
): Finding[] {
  const plan = definition.providerPlan;
  if (!plan) return [];
  const findings: Finding[] = [];
  const push = (code: string, message: string, targetId?: string, severity: Finding["severity"] = "blocker") =>
    findings.push({ code, message, targetId, severity });
  for (const requirement of plan.requirements) {
    const worldspace = definition.worldspaces.find((item) => item.id === requirement.worldspaceId);
    if (!worldspace) {
      push(
        "LANDFALL_PROVIDER_WORLDSPACE",
        "Provider requirement names an unknown Worldspace.",
        requirement.worldspaceId,
      );
      continue;
    }
    const candidates = providers.filter(
      (provider) =>
        provider.family === requirement.family &&
        provider.capabilities.includes(requirement.capability) &&
        (!requirement.providerId || provider.id === requirement.providerId) &&
        !provider.simulation &&
        provider.worldspaceKinds.includes(worldspace.kind),
    );
    const waypoints = definition.waypoints.filter(
      (waypoint) => waypoint.worldspaceId === worldspace.id && !waypoint.sequence.optional,
    );
    const fallback =
      (requirement.fallback === "AUTHORED" &&
        ["MAP_DATA", "GEOCODING", "ROUTING", "ELEVATION", "VIRTUAL_REGION"].includes(requirement.family)) ||
      (waypoints.length > 0 &&
        waypoints.every(
          (waypoint) =>
            (requirement.fallback === "PLAYER" &&
              waypoint.fallback.mode === "PLAYER" &&
              waypoint.evidenceProfile.allowManualFallback) ||
            (requirement.fallback === "CAPTAIN" &&
              waypoint.fallback.mode === "CAPTAIN" &&
              waypoint.evidenceProfile.allowCaptainOverride),
        ));
    const severity = requirement.required && !fallback ? "blocker" : "warning";
    if (!candidates.length)
      push(
        "LANDFALL_PROVIDER_UNSUPPORTED",
        "No provider supports this capability in the selected Worldspace.",
        worldspace.id,
        severity,
      );
    else {
      const configured = candidates.some((provider) =>
        statuses.some(
          (status) =>
            status.id === provider.id &&
            status.enabled &&
            status.configured &&
            (!provider.requiresCredential || status.credentialAvailable) &&
            ["READY", "DEGRADED"].includes(status.health),
        ),
      );
      if (!configured)
        push(
          "LANDFALL_PROVIDER_NOT_CONFIGURED",
          "The requested provider is not configured. Use the declared accessible fallback or configure it before publishing.",
          worldspace.id,
          severity,
        );
      if (
        requirement.offlineRequired &&
        !candidates.some((provider) => provider.offline && provider.offlineRights === "ALLOWED")
      )
        push(
          "LANDFALL_PROVIDER_OFFLINE",
          "This required capability cannot operate offline under its current data rights.",
          worldspace.id,
          severity,
        );
      if (candidates.every((provider) => provider.hardware !== "NONE") && !requirement.hardwareDisclosed)
        push(
          "LANDFALL_PROVIDER_HARDWARE_DISCLOSURE",
          "Disclose optional hardware and the accessible fallback to Players.",
          worldspace.id,
        );
    }
    if (requirement.family === "GEOFENCE" && requirement.capability !== "wake")
      push(
        "LANDFALL_GEOFENCE_NOT_EVIDENCE",
        "Background geofences only offer a broad wake hint; confirm arrival in the foreground.",
        worldspace.id,
      );
    if (requirement.fallback !== "NONE" && !fallback)
      push(
        "LANDFALL_PROVIDER_FALLBACK_INVALID",
        "The declared provider fallback is not available for every mandatory waypoint.",
        worldspace.id,
      );
  }
  if (plan.offline.requested) {
    for (const mapId of plan.offline.mapIds) {
      const map = definition.maps.find((item) => item.id === mapId);
      if (!map) {
        push("LANDFALL_OFFLINE_MAP_MISSING", "An offline map is missing.", mapId);
        continue;
      }
      if (map.source.type === "BUILTIN_RASTER" && map.source.providerId === "osm-standard")
        push(
          "LANDFALL_OFFLINE_SOURCE_RIGHTS",
          "Interactive public tiles cannot be downloaded as an offline region. Use authorized map data or a floor plan.",
          mapId,
        );
    }
    for (const routeId of plan.offline.routeIds)
      if (!definition.routes.some((route) => route.id === routeId))
        push("LANDFALL_OFFLINE_ROUTE_MISSING", "An offline route is missing.", routeId);
  }
  return findings;
}
