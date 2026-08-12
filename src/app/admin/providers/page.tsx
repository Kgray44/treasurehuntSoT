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
      description="Code support, configuration, live-validation boundary, current safe health, source, and freshness are separate facts."
    >
      {result.data?.length ? (
        <div className="chartroom-cards chartroom-cards--providers">
          {result.data.map((provider) => (
            <Panel key={`${provider.domain}-${provider.kind}`} title={humanize(provider.kind)} kicker={provider.domain}>
              <div className="chartroom-provider-state">
                <StatusBadge state={provider.health} />
                <span>{provider.provider}</span>
              </div>
              <dl className="chartroom-details">
                <div>
                  <dt>Code support</dt>
                  <dd>{humanize(provider.codeSupport)}</dd>
                </div>
                <div>
                  <dt>Configured</dt>
                  <dd>{provider.configured ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Live validation</dt>
                  <dd>{humanize(provider.liveValidation)}</dd>
                </div>
                <div>
                  <dt>Safe status</dt>
                  <dd>{provider.safeCode}</dd>
                </div>
                <div>
                  <dt>Observed</dt>
                  <dd>{new Date(provider.observedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Capabilities</dt>
                  <dd>{provider.capabilities.join(", ") || "Not reported"}</dd>
                </div>
              </dl>
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
