import type { LandfallDefinition } from "./schema";
import { landfallProviderCatalog } from "./provider-catalog";
import { localLandfallProviderPreflight } from "./local-provider-preflight";
import type { LandfallProviderPlan, ProviderStatus } from "./provider-policy";
import { configuredRemoteServices, RemoteLandfallDataService } from "./remote-data-server";

const configuration = configuredRemoteServices(process.env);
export const deployedLandfallRemoteData = new RemoteLandfallDataService(configuration);

/** No network probes or authored coordinates. CONFIGURED is never a successful health check. */
export function landfallDeploymentProviderPreflight(
  definition: LandfallDefinition,
  service = deployedLandfallRemoteData,
  inputs = configuration,
) {
  const metadata = service.status();
  const summaries = metadata.state === "STATUS" ? metadata.services : [];
  const ids = {
    NOMINATIM: "configured-geocoder",
    OSRM: "configured-router",
    OPEN_ELEVATION: "configured-elevation",
  } as const;
  const providers = landfallProviderCatalog().map((provider) => {
    const input = inputs.find((value) => ids[value.configuration.kind] === provider.id);
    if (!input) return provider;
    const config = input.configuration;
    return {
      ...provider,
      requiresCredential: config.authentication === "BEARER",
      cacheRights: "PROHIBITED" as const,
      offlineRights: "PROHIBITED" as const,
      attribution: config.attributionLabel,
      license: config.license.slice(0, 120),
      ...(config.kind === "OSRM" ? { capabilities: [config.mode.toLowerCase(), "suggestion"] } : {}),
    };
  });
  const statuses = (requirement: LandfallProviderPlan["requirements"][number]): ProviderStatus[] => {
    const local = localLandfallProviderPreflight(definition, requirement);
    const world = definition.worldspaces.find((value) => value.id === requirement.worldspaceId);
    if (world?.kind !== "PHYSICAL" || !["PUBLIC_REAL_WORLD", "GENERIC"].includes(world.privacyPolicy.classification))
      return local;
    return [
      ...local,
      ...summaries
        .filter(
          (summary) =>
            summary.family === requirement.family &&
            (!requirement.providerId || requirement.providerId === summary.id) &&
            providers.some(
              (provider) => provider.id === summary.id && provider.capabilities.includes(requirement.capability),
            ),
        )
        .map(
          (summary): ProviderStatus => ({
            id: summary.id,
            configured: true,
            enabled: true,
            health: summary.state,
            credentialAvailable: Boolean(
              inputs.find((value) => ids[value.configuration.kind] === summary.id)?.bearerToken,
            ),
          }),
        ),
    ];
  };
  return { providers, statuses };
}
