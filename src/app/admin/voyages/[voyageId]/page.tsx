import { notFound } from "next/navigation";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getVoyageDetail } from "@/admiralty/ports/one-voyage-admin-read";
import {
  ChartroomPage,
  DetailList,
  EmptyState,
  EvidenceStrip,
  Identifier,
  Panel,
  StatusBadge,
  dateTime,
  humanize,
} from "@/components/admiralty/AdminPrimitives";

export default async function VoyageDetailPage({ params }: { params: Promise<{ voyageId: string }> }) {
  const operator = await admiraltyPageOperator("VOYAGE_OBSERVE");
  const detail = await getVoyageDetail(operator, (await params).voyageId);
  if (!detail?.data) notFound();
  const voyage = detail.data;
  return (
    <ChartroomPage
      eyebrow="Voyage inspection"
      title={voyage.voyageName ?? voyage.ownerLabel ?? "Unnamed Voyage"}
      description={`${voyage.tale.title} · read-only runtime evidence`}
    >
      <div className="chartroom-identity">
        <div>
          <StatusBadge state={voyage.previewMode ? "NOT_LIVE_VALIDATED" : voyage.status} />
          <h2>{voyage.captainMode.replaceAll("_", " ")}</h2>
        </div>
        <Identifier value={voyage.id} label="Voyage ID" />
      </div>
      <div className="chartroom-grid">
        <Panel title="Runtime">
          <DetailList
            items={[
              { label: "Chronicle", value: voyage.tale.title },
              {
                label: "Edition",
                value: voyage.version
                  ? `${voyage.version.versionNumber} · ${voyage.version.versionLabel}`
                  : "Draft or not recorded",
              },
              { label: "Current chapter", value: voyage.currentChapterId ?? "No data recorded" },
              { label: "Current block", value: voyage.currentBlockId ?? "No data recorded" },
              { label: "Sequence", value: voyage.currentSequence },
              { label: "Heartbeat", value: dateTime(voyage.lastHeartbeatAt) },
              { label: "Updated", value: dateTime(voyage.updatedAt) },
            ]}
          />
        </Panel>
        <Panel title="Lifecycle">
          <DetailList
            items={[
              { label: "Planned start", value: dateTime(voyage.plannedStartAt) },
              { label: "Launched", value: dateTime(voyage.launchedAt) },
              { label: "Completed", value: dateTime(voyage.completedAt) },
              { label: "Cancelled", value: dateTime(voyage.cancelledAt) },
              { label: "Abandoned", value: dateTime(voyage.abandonedAt) },
              { label: "Expires", value: dateTime(voyage.expiresAt) },
              {
                label: "Historical visibility",
                value: voyage.historicalHidden ? "Hidden from history" : "Available to canonical history",
              },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Crew">
        <div className="chartroom-table-wrap" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Role</th>
                <th>State</th>
                <th>Joined</th>
                <th>Completed / removed</th>
              </tr>
            </thead>
            <tbody>
              {voyage.memberships.map((member) => (
                <tr key={member.id}>
                  <td>
                    {member.player.displayName}
                    <small>{member.player.handle ? `@${member.player.handle}` : "Handle not available"}</small>
                  </td>
                  <td>
                    {humanize(member.role)}
                    {member.crewRole ? ` · ${humanize(member.crewRole)}` : ""}
                  </td>
                  <td>
                    <StatusBadge state={member.status} />
                  </td>
                  <td>{dateTime(member.joinedAt)}</td>
                  <td>{dateTime(member.completedAt ?? member.removedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Verification workload" kicker="Safe state; submitted evidence is excluded">
        {voyage.verificationRequests.length ? (
          <div className="chartroom-list">
            {voyage.verificationRequests.map((request) => (
              <article key={request.id}>
                <div>
                  <StatusBadge state={request.status} />
                  <strong>{humanize(request.providerType)}</strong>
                </div>
                <span>Block {request.blockId}</span>
                <small>
                  Requested {dateTime(request.requestedAt)} · Resolved {dateTime(request.resolvedAt)} · Expires{" "}
                  {dateTime(request.expiresAt)}
                </small>
                {request.providerCorrelationId ? (
                  <Identifier value={request.providerCorrelationId} label="provider correlation ID" />
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No verification request recorded" />
        )}
      </Panel>
      <Panel
        title="Safe event sequence"
        kicker="Raw event payloads, idempotency secrets, variables, inventory, and preview snapshots excluded"
      >
        {voyage.events.length ? (
          <div className="chartroom-timeline">
            {voyage.events.map((event) => (
              <article key={event.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>
                    #{event.sequence} · {humanize(event.eventType)}
                  </strong>
                  <p>
                    {event.sourceType}
                    {event.sourceId ? ` · ${event.sourceId}` : ""} · {dateTime(event.createdAt)}
                  </p>
                  {event.correlationId ? (
                    <Identifier value={event.correlationId} label="correlation ID" />
                  ) : (
                    <small>No correlation ID</small>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No event recorded" />
        )}
      </Panel>
      <EvidenceStrip evidence={detail.evidence} />
    </ChartroomPage>
  );
}
