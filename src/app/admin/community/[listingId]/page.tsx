import { notFound } from "next/navigation";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getCommunityListingDetail } from "@/admiralty/ports/harborlight-admin-read";
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

function stringList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

export default async function CommunityListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const operator = await admiraltyPageOperator("COMMUNITY_OBSERVE");
  const result = await getCommunityListingDetail(operator, (await params).listingId);
  if (!result) notFound();
  if (!result.data) notFound();
  const listing = result.data;
  return (
    <ChartroomPage
      eyebrow="Community listing"
      title={listing.title}
      description={listing.shortDescription ?? "No description recorded."}
    >
      <div className="chartroom-identity">
        <div>
          <StatusBadge state={listing.publicationStatus} />
          <h2>{listing.slug}</h2>
        </div>
        <Identifier value={listing.id} label="listing ID" />
      </div>
      <div className="chartroom-grid">
        <Panel title="Catalog state">
          <DetailList
            items={[
              { label: "Type", value: humanize(listing.itemType) },
              { label: "Visibility", value: humanize(listing.visibility) },
              { label: "Moderation", value: <StatusBadge state={listing.moderationStatus} /> },
              { label: "Spoiler level", value: humanize(listing.spoilerLevel) },
              { label: "Location class", value: humanize(listing.locationClass) },
              { label: "Category", value: listing.primaryCategory ?? "No data recorded" },
              { label: "Published", value: dateTime(listing.publishedAt) },
              { label: "Removed", value: dateTime(listing.removedAt) },
            ]}
          />
        </Panel>
        <Panel title="Creator">
          <DetailList
            items={[
              { label: "Display name", value: listing.owner.displayName },
              { label: "Handle", value: `@${listing.owner.handle}` },
              { label: "Account ID", value: <Identifier value={listing.owner.accountId} /> },
              { label: "Creator state", value: humanize(listing.owner.creatorStatus) },
              { label: "Moderation state", value: humanize(listing.owner.moderationStatus) },
              { label: "Verification", value: humanize(listing.owner.verificationStatus) },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Safe content descriptors">
        <DetailList
          items={[
            { label: "Tags", value: stringList(listing.tags).join(", ") || "No data recorded" },
            { label: "Content warnings", value: stringList(listing.contentWarnings).join(", ") || "No data recorded" },
            {
              label: "Current release",
              value: listing.currentReleaseId ? <Identifier value={listing.currentReleaseId} /> : "No data recorded",
            },
            { label: "Ownership declarations", value: listing.declarations.length },
          ]}
        />
      </Panel>
      <Panel title="Releases" kicker="Manifest contents, license snapshots, and attribution prose excluded">
        {listing.releases.length ? (
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Source edition</th>
                  <th>Integrity</th>
                  <th>Moderation</th>
                  <th>Published</th>
                </tr>
              </thead>
              <tbody>
                {listing.releases.map((release) => (
                  <tr key={release.id}>
                    <td>
                      <strong>{release.semanticVersion}</strong>
                      <Identifier value={release.id} label="release ID" />
                    </td>
                    <td>{release.sourcePublishedTaleVersionId ?? "Not available"}</td>
                    <td>
                      <Identifier value={release.manifestChecksum} label="manifest checksum" />
                      {release.packageChecksum ? (
                        <Identifier value={release.packageChecksum} label="package checksum" />
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge state={release.moderationStatus} />
                    </td>
                    <td>
                      {dateTime(release.publishedAt)}
                      <small>
                        {release.deprecatedAt
                          ? `Deprecated ${dateTime(release.deprecatedAt)}`
                          : "Current or superseded state not recorded"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No release recorded" />
        )}
      </Panel>
      <Panel title="Reports & moderation" kicker="Reporter identity and private report detail excluded">
        <div className="chartroom-grid">
          <div>
            {listing.reports.length ? (
              <div className="chartroom-list">
                {listing.reports.map((report) => (
                  <article key={report.id}>
                    <strong>{humanize(report.reason)}</strong>
                    <StatusBadge state={report.status} />
                    <small>
                      {dateTime(report.createdAt)} · Case {report.caseId ?? "not assigned"}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No report recorded" />
            )}
          </div>
          <div>
            {listing.cases.length ? (
              <div className="chartroom-list">
                {listing.cases.map((moderationCase) => (
                  <article key={moderationCase.id}>
                    <strong>{moderationCase.caseKey}</strong>
                    <StatusBadge state={moderationCase.status} />
                    <span>
                      {humanize(moderationCase.severity)} · {humanize(moderationCase.primaryReasonCode)}
                    </span>
                    <Identifier value={moderationCase.correlationId} label="correlation ID" />
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No moderation case recorded" />
            )}
          </div>
        </div>
      </Panel>
      <EvidenceStrip evidence={result.evidence} />
    </ChartroomPage>
  );
}
