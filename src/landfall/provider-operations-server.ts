import { landfallProviderCatalog } from "./provider-catalog";
import { deployedLandfallRemoteData } from "./remote-data-deployment-server";
import type { RemoteLandfallDataService } from "./remote-data-server";

/** Existing operations surface consumes metadata only. No health probe, private Worldspace IDs or URLs. */
export function landfallOperationsProviders(
  service: Pick<RemoteLandfallDataService, "operationalStatus"> = deployedLandfallRemoteData,
) {
  const catalog = landfallProviderCatalog();
  return service.operationalStatus().map((status) => {
    const provider = catalog.find((value) => value.id === status.id)!;
    return {
      domain: "Landfall",
      kind: provider.family,
      provider: provider.label,
      codeSupport: "IMPLEMENTED" as const,
      configured: status.configured,
      liveValidation: status.health === "READY" ? ("LIVE_VALIDATED" as const) : ("NOT_LIVE_VALIDATED" as const),
      health:
        status.health === "READY"
          ? ("HEALTHY" as const)
          : status.health === "RATE_LIMITED"
            ? ("DEGRADED" as const)
            : status.health === "UNAVAILABLE" || status.health === "NOT_CONFIGURED"
              ? ("UNAVAILABLE" as const)
              : ("UNKNOWN" as const),
      safeCode: status.health,
      capabilities: status.capabilities,
      demand: {
        lastSuccessAt: status.lastSuccessAt ?? null,
        lastFailureAt: status.lastFailureAt ?? null,
        latencyMs: status.latencyMs ?? null,
        retryAfter: status.retryAfter ?? null,
        credentialExpiry: "NOT_REPORTED" as const,
        affectedScope: "Consenting public or generic physical Worldspaces",
        fallback: "Authored chart, authored routes and Player or Captain confirmation remain available.",
        consequence: "Optional online suggestions unavailable; no canonical progress is changed.",
        historyScope: "Current server process; resets on restart. Configuration is not a live health check.",
      },
      safeAction: "Read recent demand metadata. This refresh sends no Landfall provider request.",
    };
  });
}
