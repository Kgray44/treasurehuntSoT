import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getProviderOverview } from "@/admiralty/ports/operations-admin-read";
import {
  ChartroomPage,
  EmptyState,
  EvidenceStrip,
  Panel,
  StatusBadge,
  humanize,
} from "@/components/admiralty/AdminPrimitives";

export default async function ProvidersPage() {
  const operator = await admiraltyPageOperator("CONTENT_OBSERVE");
  const result = await getProviderOverview(operator);
  return (
    <ChartroomPage
      eyebrow="Provider-neutral projections"
      title="Providers"
      description="Readiness, configuration, health, freshness, and safe owner action are separate facts. Credentials are never rendered."
    >
      {result.data?.length ? (
        <div className="chartroom-cards chartroom-cards--providers">
          {result.data.map((provider) => (
            <Panel
              key={`${provider.domain}-${provider.kind}`}
              title={provider.provider}
              kicker={`${provider.domain} · ${humanize(provider.kind)}`}
            >
              <div className="chartroom-provider-state">
                <StatusBadge state={provider.health} />
                <span>{provider.configured ? "Configured" : "Not configured"}</span>
              </div>
              <dl className="chartroom-details">
                <div>
                  <dt>Readiness</dt>
                  <dd>
                    {provider.health === "HEALTHY"
                      ? "Ready"
                      : provider.health === "UNAVAILABLE"
                        ? "Unavailable"
                        : "Needs attention"}
                  </dd>
                </div>
                <div>
                  <dt>Last safe check</dt>
                  <dd>{new Date(provider.observedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Validation boundary</dt>
                  <dd>{humanize(provider.liveValidation)}</dd>
                </div>
                <div>
                  <dt>Safe action</dt>
                  <dd>Refresh this projection to run the owner’s bounded health check.</dd>
                </div>
              </dl>
              <details>
                <summary>Technical details</summary>
                <dl className="chartroom-details">
                  <div>
                    <dt>Code support</dt>
                    <dd>{humanize(provider.codeSupport)}</dd>
                  </div>
                  <div>
                    <dt>Safe status code</dt>
                    <dd>{provider.safeCode}</dd>
                  </div>
                  <div>
                    <dt>Capabilities</dt>
                    <dd>{provider.capabilities.map(humanize).join(", ") || "Not reported"}</dd>
                  </div>
                </dl>
              </details>
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Provider projection unavailable"
          detail={result.evidence.safeError ?? "No provider source returned safe evidence."}
        />
      )}
      <EvidenceStrip evidence={result.evidence} />
    </ChartroomPage>
  );
}
