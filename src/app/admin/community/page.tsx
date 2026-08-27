import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getCommunityOverview, searchCommunity } from "@/admiralty/ports/harborlight-admin-read";
import { boundedQuery } from "@/admiralty/read-models";
import {
  ChartroomPage,
  EmptyState,
  EvidenceStrip,
  Identifier,
  Metric,
  Panel,
  SearchForm,
  StatusBadge,
  TextLink,
  dateTime,
} from "@/components/admiralty/AdminPrimitives";

export default async function CommunityAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const operator = await admiraltyPageOperator("COMMUNITY_OBSERVE");
  const query = boundedQuery((await searchParams).q);
  const [overview, result] = await Promise.all([
    getCommunityOverview(operator),
    query ? searchCommunity(operator, query) : null,
  ]);
  const data = overview.data!;
  return (
    <ChartroomPage
      eyebrow="Harborlight read port"
      title="Community"
      description="Community catalog, creator, report, moderation, release, queue, and provider evidence without private report prose."
    >
      <div className="chartroom-metrics">
        <Metric label="Profiles" value={data.counts.profiles} detail={`${data.counts.creators} active creators`} />
        <Metric label="Listings" value={data.counts.listings} detail={`${data.counts.releases} releases`} />
        <Metric
          label="Reports"
          value={data.counts.pendingReports}
          detail={`${data.counts.openCases} open cases`}
          state={data.counts.pendingReports ? "DEGRADED" : "HEALTHY"}
        />
        <Metric
          label="Appeals"
          value={data.counts.pendingAppeals}
          detail={`${data.counts.activeSanctions} active sanctions`}
        />
      </div>
      <div className="chartroom-grid">
        <Panel title="Operational workload">
          <dl className="chartroom-details">
            <div>
              <dt>Queue depth</dt>
              <dd>{data.operations.queueDepth}</dd>
            </div>
            <div>
              <dt>Dead letters</dt>
              <dd>{data.operations.deadLetters}</dd>
            </div>
            <div>
              <dt>Oldest queued job</dt>
              <dd>{data.operations.oldestQueuedJobAgeSeconds}s</dd>
            </div>
            <div>
              <dt>Stale scans</dt>
              <dd>{data.operations.staleScans}</dd>
            </div>
            <div>
              <dt>Quarantined releases</dt>
              <dd>{data.operations.quarantined}</dd>
            </div>
            <div>
              <dt>Moderation queue</dt>
              <dd>{data.operations.caseQueue}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Provider projection">
          <p>
            <StatusBadge state={data.providerProjectionState === "AVAILABLE" ? "HEALTHY" : "UNAVAILABLE"} />
          </p>
          <p>
            {data.providers.length} Harborlight provider records returned. See Providers for source-by-source evidence.
          </p>
        </Panel>
      </div>
      <SearchForm value={query} placeholder="Listing ID, slug, title, or creator" label="Search Community content" />
      {!query ? (
        <EmptyState
          title="Search the catalog"
          detail="Enter a known listing, slug, title, creator, or exact identifier."
        />
      ) : result?.data?.results.length ? (
        <>
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Creator</th>
                  <th>Publication</th>
                  <th>Moderation</th>
                  <th>Releases</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {result.data.results.map((listing) => (
                  <tr key={listing.id}>
                    <td>
                      <TextLink href={`/admin/community/${listing.id}`}>
                        <strong>{listing.title}</strong>
                      </TextLink>
                      <small>
                        {listing.itemType} · {listing.slug}
                      </small>
                      <Identifier value={listing.id} label="listing ID" />
                    </td>
                    <td>
                      {listing.owner.displayName}
                      <small>@{listing.owner.handle}</small>
                    </td>
                    <td>
                      <StatusBadge state={listing.publicationStatus} />
                    </td>
                    <td>
                      <StatusBadge state={listing.moderationStatus} />
                    </td>
                    <td>{listing._count.releases}</td>
                    <td>{dateTime(listing.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EvidenceStrip evidence={result.evidence} />
        </>
      ) : (
        <EmptyState title="No matching Community content" />
      )}
      <EvidenceStrip evidence={overview.evidence} />
    </ChartroomPage>
  );
}
