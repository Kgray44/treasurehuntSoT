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
  return (
    <ChartroomPage
      eyebrow="Command center"
      title="Platform Overview"
      description="What needs attention, what recently changed, and which owner surface can act."
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
          label="Community queue"
          value={overview.attention.communityQueuedJobs ?? "Unavailable"}
          detail={
            overview.attention.communityDeadLetters === null
              ? "Harborlight owner projection unavailable"
              : `${overview.attention.communityDeadLetters} dead letters`
          }
          state={overview.attention.communityDeadLetters ? "DEGRADED" : "HEALTHY"}
        />
        <Metric
          label="Audit activity"
          value={overview.audit.recentCount24Hours}
          detail="Admiralty events in the last 24 hours"
          state="HEALTHY"
        />
      </div>
      <div className="chartroom-grid chartroom-grid--wide">
        <Panel title="Your watch" kicker="Authority">
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
        <Panel title="Attention and owner handoffs" kicker="Current safe data">
          <div className="chartroom-timeline">
            {overview.attention.pendingSupportCases ? (
              <article>
                <span aria-hidden="true" />
                <div>
                  <strong>{overview.attention.pendingSupportCases} support request(s) need a response</strong>
                  <p>Support Access remains consent-scoped and temporary.</p>
                  <Link href="/admin/support/cases">Open support cases →</Link>
                </div>
              </article>
            ) : null}
            {overview.attention.communityDeadLetters ? (
              <article>
                <span aria-hidden="true" />
                <div>
                  <strong>{overview.attention.communityDeadLetters} Community dead letter(s) need owner review</strong>
                  <p>Harborlight owns recovery and moderation business logic.</p>
                  <Link href="/admin/operations">Open Community operations →</Link>
                </div>
              </article>
            ) : null}
            {overview.attention.communityModerationCases ? (
              <article>
                <span aria-hidden="true" />
                <div>
                  <strong>{overview.attention.communityModerationCases} Community case(s) are pending</strong>
                  <p>Only case-attached owner commands are available.</p>
                  <Link href="/admin/community">Open Community cases →</Link>
                </div>
              </article>
            ) : null}
            {!overview.attention.pendingSupportCases &&
            !overview.attention.communityDeadLetters &&
            !overview.attention.communityModerationCases ? (
              <p>No safe attention signal is currently reported by the owner projections.</p>
            ) : null}
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
