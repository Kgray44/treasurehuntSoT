import Link from "next/link";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { searchAdministrativeAudit } from "@/admiralty/ports/audit-admin-read";
import { boundedPage, boundedQuery } from "@/admiralty/read-models";
import {
  ChartroomPage,
  EmptyState,
  EvidenceStrip,
  Identifier,
  StatusBadge,
  dateTime,
  humanize,
} from "@/components/admiralty/AdminPrimitives";

type AuditParams = {
  q?: string | string[];
  actor?: string | string[];
  action?: string | string[];
  targetType?: string | string[];
  outcome?: string | string[];
  correlationId?: string | string[];
  from?: string | string[];
  to?: string | string[];
  page?: string | string[];
};
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 128) || undefined;
const validDate = (value: string | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditParams> }) {
  const operator = await admiraltyPageOperator("AUDIT_OBSERVE");
  const params = await searchParams;
  const input = {
    query: boundedQuery(params.q, 2) || undefined,
    actor: first(params.actor),
    action: first(params.action),
    targetType: first(params.targetType),
    outcome: first(params.outcome),
    correlationId: first(params.correlationId),
    from: validDate(first(params.from)),
    to: validDate(first(params.to)),
    page: boundedPage(params.page),
  };
  const active = Boolean(
    input.query ||
      input.actor ||
      input.action ||
      input.targetType ||
      input.outcome ||
      input.correlationId ||
      input.from ||
      input.to,
  );
  const result = active ? await searchAdministrativeAudit(operator, input) : null;
  return (
    <ChartroomPage
      eyebrow="Canonical audit store"
      title="Audit Explorer"
      description="Filter sanitized evidence by actor, action, target, outcome, time, or correlation. Raw secret/private metadata is never returned."
    >
      <form className="chartroom-filter" method="get">
        <label>
          Free text
          <input name="q" defaultValue={first(params.q)} placeholder="Action, target ID, audit ID, correlation ID" />
        </label>
        <label>
          Actor
          <input name="actor" defaultValue={input.actor} placeholder="Actor or account ID" />
        </label>
        <label>
          Action
          <input name="action" defaultValue={input.action} placeholder="ADMIRALTY_…" />
        </label>
        <label>
          Target type
          <input name="targetType" defaultValue={input.targetType} />
        </label>
        <label>
          Outcome
          <select name="outcome" defaultValue={input.outcome ?? ""}>
            <option value="">Any outcome</option>
            <option>SUCCEEDED</option>
            <option>DENIED</option>
            <option>FAILED</option>
          </select>
        </label>
        <label>
          Correlation ID
          <input name="correlationId" defaultValue={input.correlationId} />
        </label>
        <label>
          From
          <input type="datetime-local" name="from" defaultValue={first(params.from)} />
        </label>
        <label>
          To
          <input type="datetime-local" name="to" defaultValue={first(params.to)} />
        </label>
        <button type="submit">Search audit</button>
      </form>
      {!active ? (
        <EmptyState
          title="Choose an audit filter"
          detail="Audit Explorer does not dump the complete event store by default."
        />
      ) : result?.data?.results.length ? (
        <>
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>When & actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Outcome</th>
                  <th>Correlation</th>
                  <th>Safe detail</th>
                </tr>
              </thead>
              <tbody>
                {result.data.results.map((event) => (
                  <tr key={event.id}>
                    <td>
                      {dateTime(event.createdAt)}
                      <small>
                        {humanize(event.actorType)} · {event.actorAccountId ?? event.actorId ?? "System"}
                      </small>
                    </td>
                    <td>
                      <strong>{humanize(event.action)}</strong>
                      <small>
                        <code>{event.action}</code>
                      </small>
                      <Identifier value={event.id} label="audit ID" />
                    </td>
                    <td>
                      {humanize(event.resourceType)}
                      <Identifier value={event.resourceId} label="target ID" />
                    </td>
                    <td>
                      <StatusBadge state={event.outcome} />
                    </td>
                    <td>
                      <Link href={`/admin/investigate?q=${encodeURIComponent(event.correlationId)}`}>Trace</Link>
                      <Identifier value={event.correlationId} label="correlation ID" />
                    </td>
                    <td>
                      {Object.keys(event.detail).length ? (
                        <details>
                          <summary>Inspect</summary>
                          <pre>{JSON.stringify(event.detail, null, 2)}</pre>
                        </details>
                      ) : (
                        "No safe detail"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chartroom-pagination">
            {result.data.page > 1 ? (
              <Link
                href={`?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(params).filter(([, value]) => typeof value === "string")) as Record<string, string>), page: String(result.data.page - 1) })}`}
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {result.data.hasNext ? (
              <Link
                href={`?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(params).filter(([, value]) => typeof value === "string")) as Record<string, string>), page: String(result.data.page + 1) })}`}
              >
                Next →
              </Link>
            ) : null}
          </div>
          <EvidenceStrip evidence={result.evidence} />
        </>
      ) : (
        <EmptyState title="No matching audit evidence" />
      )}
    </ChartroomPage>
  );
}
