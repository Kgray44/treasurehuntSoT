import Link from "next/link";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { admiraltyOverview } from "@/admiralty/projections";
import {
  ChartroomPage,
  DetailList,
  EvidenceStrip,
  Metric,
  Panel,
  StatusBadge,
  dateTime,
} from "@/components/admiralty/AdminPrimitives";

export const dynamic = "force-dynamic";

export default async function AdmiraltyPage() {
  const operator = await admiraltyPageOperator("PLATFORM_OBSERVE");
  const overview = await admiraltyOverview(operator);
  const available = [
    ["PLATFORM_OBSERVE", "Bridgewatch", "/bridgewatch"],
    ["SUPPORT_REQUEST", "Support cases", "/admin/support/cases"],
    ["ACCOUNT_OBSERVE", "People", "/admin/people"],
    ["CHRONICLE_OBSERVE", "Chronicles", "/admin/chronicles"],
    ["VOYAGE_OBSERVE", "Voyages", "/admin/voyages"],
    ["COMMUNITY_OBSERVE", "Community", "/admin/community"],
    ["JOBS_OBSERVE", "Operations", "/admin/operations"],
    ["CONTENT_OBSERVE", "Providers", "/admin/providers"],
    ["CONFIG_OBSERVE", "Configuration", "/admin/configuration"],
    ["RELEASE_OBSERVE", "Releases", "/admin/releases"],
    ["AUDIT_OBSERVE", "Audit", "/admin/audit"],
  ].filter(([capability]) => operator.capabilities.includes(capability as never));
  return (
    <ChartroomPage
      eyebrow="Command center"
      title="Platform Overview"
      description="A source-labeled view of the platform evidence this operator is allowed to inspect."
    >
      <div className="chartroom-metrics">
        <Metric
          label="Application"
          value={overview.environment.application}
          detail={`Version ${overview.environment.version}`}
          state="IMPLEMENTED"
        />
        <Metric
          label="Environment"
          value={overview.environment.environment}
          detail={overview.environment.buildIdentity ?? "Build identity not configured"}
          state={overview.environment.buildIdentity ? "CONFIGURED" : "NOT_CONFIGURED"}
        />
        <Metric
          label="Registry"
          value={`${overview.registry.implemented} / ${overview.registry.total}`}
          detail={`${overview.registry.phase1Implemented} inherited · ${overview.registry.phase2Implemented} activated in Phase 2 · ${overview.registry.dormant} dormant`}
          state="IMPLEMENTED"
        />
        <Metric
          label="Audit activity"
          value={overview.audit.recentCount24Hours}
          detail="Admiralty events in the last 24 hours"
          state="HEALTHY"
        />
      </div>
      <div className="chartroom-grid chartroom-grid--wide">
        <Panel title="Your watch" kicker="Authorization">
          <DetailList
            items={[
              { label: "Operator", value: operator.displayName },
              { label: "Roles", value: operator.roles.join(", ") },
              { label: "Session expires", value: dateTime(operator.sessionExpiresAt) },
              {
                label: "Privileged assurance",
                value: <StatusBadge state={overview.assurance.recent ? "HEALTHY" : "NOT_CONFIGURED"} />,
              },
              {
                label: "Support grants",
                value: `${overview.support.activeGrantCount} active · ${overview.support.pendingRequestCount} pending`,
              },
            ]}
          />
        </Panel>
        <Panel title="Available stations" kicker="Least privilege">
          <div className="chartroom-stations">
            {available.map(([, label, href]) => (
              <Link key={href} href={href}>
                <strong>{label}</strong>
                <span>Open read-only station →</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Recent administrative evidence" kicker="Canonical audit">
        {overview.audit.recent.length ? (
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Outcome</th>
                  <th>Observed</th>
                </tr>
              </thead>
              <tbody>
                {overview.audit.recent.map((event) => (
                  <tr key={`${event.correlationId}-${event.createdAt.toISOString()}`}>
                    <td>{event.action}</td>
                    <td>{event.resourceType}</td>
                    <td>
                      <StatusBadge state={event.outcome} />
                    </td>
                    <td>{dateTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No Admiralty audit evidence has been recorded.</p>
        )}
      </Panel>
      <EvidenceStrip
        evidence={{
          source: "Admiralty Phase 2 projections + canonical audit store",
          observedAt: new Date().toISOString(),
          freshness: "LIVE",
          lastSuccessfulRefresh: new Date().toISOString(),
          environment: overview.environment.environment,
          safeError: null,
          dataClass: "OPERATIONAL_SENSITIVE",
        }}
      />
    </ChartroomPage>
  );
}
