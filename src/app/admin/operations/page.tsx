import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getOperationsOverview } from "@/admiralty/ports/operations-admin-read";
import {
  ChartroomPage,
  DetailList,
  EmptyState,
  EvidenceStrip,
  Identifier,
  Metric,
  Panel,
  StatusBadge,
  dateTime,
  humanize,
} from "@/components/admiralty/AdminPrimitives";

export default async function OperationsPage() {
  const operator = await admiraltyPageOperator("JOBS_OBSERVE");
  const result = await getOperationsOverview(operator);
  const data = result.data!;
  return (
    <ChartroomPage
      eyebrow="Operational read ports"
      title="Operations"
      description="Workers, queues, schedulers, database, backup, and restore evidence. No retry, cancel, repair, or other Phase 3 command is available."
    >
      <div className="chartroom-metrics">
        <Metric
          label="Database"
          value={data.platform.database.provider}
          detail={data.platform.database.schemaLevel}
          state={data.platform.database.healthy ? "HEALTHY" : "DEGRADED"}
        />
        <Metric
          label="Queued jobs"
          value={data.jobs.queued}
          detail={`Oldest ${data.jobs.oldestPendingAgeSeconds}s`}
          state={data.jobs.queued ? "DEGRADED" : "HEALTHY"}
        />
        <Metric label="Failed jobs" value={data.jobs.failed} state={data.jobs.failed ? "DEGRADED" : "HEALTHY"} />
        <Metric
          label="Active Voyages"
          value={data.platform.activeVoyages}
          detail={`${data.platform.activeSessions} sessions · ${data.platform.activeUsers24Hours} users / 24h`}
        />
      </div>
      <div className="chartroom-grid">
        <Panel title="Oldest pending job">
          {data.jobs.oldestPending ? (
            <DetailList
              items={[
                { label: "Job ID", value: <Identifier value={data.jobs.oldestPending.id} label="job ID" /> },
                { label: "Type", value: humanize(data.jobs.oldestPending.type) },
                { label: "State", value: <StatusBadge state={data.jobs.oldestPending.state} /> },
                { label: "Available", value: dateTime(data.jobs.oldestPending.availableAt) },
                {
                  label: "Attempts",
                  value: `${data.jobs.oldestPending.attemptCount} / ${data.jobs.oldestPending.maxAttempts}`,
                },
                {
                  label: "Correlation",
                  value: <Identifier value={data.jobs.oldestPending.correlationId} label="correlation ID" />,
                },
              ]}
            />
          ) : (
            <EmptyState title="Queue is clear" />
          )}
        </Panel>
        <Panel title="Community worker snapshot">
          {data.community ? (
            <DetailList
              items={[
                { label: "Queue", value: data.community.queueDepth },
                { label: "Dead letters", value: data.community.deadLetters },
                { label: "Oldest queued job", value: `${data.community.oldestQueuedJobAgeSeconds}s` },
                { label: "Stale scans", value: data.community.staleScans },
                { label: "Moderation cases", value: data.community.caseQueue },
                { label: "Release identity", value: data.community.releaseIdentity },
              ]}
            />
          ) : (
            <EmptyState title="Community source unavailable" detail="The rest of Operations remains visible." />
          )}
        </Panel>
      </div>
      <Panel title="Private operation schedules">
        {data.privateOperations.schedules.length ? (
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>State</th>
                  <th>Run after</th>
                  <th>Lease</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.privateOperations.schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>
                      {humanize(schedule.kind)}
                      <Identifier value={schedule.id} />
                    </td>
                    <td>
                      <StatusBadge state={schedule.state} />
                    </td>
                    <td>{dateTime(schedule.runAfter)}</td>
                    <td>{dateTime(schedule.leaseUntil)}</td>
                    <td>{dateTime(schedule.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No private schedule recorded" />
        )}
      </Panel>
      <div className="chartroom-grid">
        <Panel title="Backup freshness">
          <DetailList
            items={
              data.privateOperations.latestBackup
                ? [
                    { label: "Backup record", value: <Identifier value={data.privateOperations.latestBackup.id} /> },
                    { label: "State", value: <StatusBadge state={data.privateOperations.latestBackup.state} /> },
                    { label: "Created", value: dateTime(data.privateOperations.latestBackup.createdAt) },
                    { label: "Verified", value: dateTime(data.privateOperations.latestBackup.verifiedAt) },
                  ]
                : [{ label: "Backup", value: "No data recorded" }]
            }
          />
        </Panel>
        <Panel title="Restore drill">
          <DetailList
            items={
              data.privateOperations.latestRestore
                ? [
                    { label: "Drill record", value: <Identifier value={data.privateOperations.latestRestore.id} /> },
                    { label: "State", value: <StatusBadge state={data.privateOperations.latestRestore.state} /> },
                    {
                      label: "Safe result",
                      value: data.privateOperations.latestRestore.resultCode ?? "No data recorded",
                    },
                    {
                      label: "Cleanup complete",
                      value: dateTime(data.privateOperations.latestRestore.cleanupCompletedAt),
                    },
                  ]
                : [{ label: "Restore drill", value: "No data recorded" }]
            }
          />
        </Panel>
      </div>
      <EvidenceStrip evidence={result.evidence} />
    </ChartroomPage>
  );
}
