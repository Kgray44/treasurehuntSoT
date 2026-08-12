import { notFound } from "next/navigation";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getChronicleDetail } from "@/admiralty/ports/one-voyage-admin-read";
import {
  ChartroomPage,
  DetailList,
  EmptyState,
  EvidenceStrip,
  Identifier,
  Panel,
  StatusBadge,
  TextLink,
  dateTime,
  humanize,
} from "@/components/admiralty/AdminPrimitives";

export default async function ChronicleDetailPage({ params }: { params: Promise<{ chronicleId: string }> }) {
  const operator = await admiraltyPageOperator("CHRONICLE_OBSERVE");
  const detail = await getChronicleDetail(operator, (await params).chronicleId);
  if (!detail?.data) notFound();
  const chronicle = detail.data;
  return (
    <ChartroomPage
      eyebrow="Chronicle inspection"
      title={chronicle.title}
      description={chronicle.shortDescription ?? chronicle.subtitle ?? "No description recorded."}
    >
      <div className="chartroom-identity">
        <div>
          <StatusBadge state={chronicle.status} />
          <h2>{chronicle.slug}</h2>
        </div>
        <Identifier value={chronicle.id} label="Chronicle ID" />
      </div>
      <div className="chartroom-grid">
        <Panel title="Definition">
          <DetailList
            items={[
              { label: "Visibility", value: humanize(chronicle.visibility) },
              { label: "Theme", value: humanize(chronicle.theme) },
              { label: "Player range", value: `${chronicle.playerCountMin}–${chronicle.playerCountMax}` },
              {
                label: "Estimated duration",
                value: chronicle.estimatedDuration ? `${chronicle.estimatedDuration} minutes` : "No data recorded",
              },
              { label: "Featured", value: chronicle.featured ? "Yes" : "No" },
              { label: "Archived", value: dateTime(chronicle.archivedAt) },
            ]}
          />
        </Panel>
        <Panel title="Ownership & lineage">
          <DetailList
            items={[
              {
                label: "Creator",
                value: `${chronicle.creatorDisplayName}${chronicle.creatorHandle ? ` · @${chronicle.creatorHandle}` : ""}`,
              },
              {
                label: "Creator account",
                value: chronicle.creatorAccountId ? <Identifier value={chronicle.creatorAccountId} /> : "Not available",
              },
              { label: "Forked from Chronicle", value: chronicle.forkedFromTaleId ?? "Not applicable" },
              { label: "Forked from edition", value: chronicle.forkedFromVersionId ?? "Not applicable" },
              { label: "Current draft revision", value: chronicle.currentDraftRevisionId ?? "No data recorded" },
              { label: "Latest edition", value: chronicle.latestPublishedVersionId ?? "No data recorded" },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Immutable editions" kicker="Content snapshots are never returned">
        {chronicle.versions.length ? (
          <div className="chartroom-list chartroom-list--editions">
            {chronicle.versions.map((version) => (
              <article key={version.id}>
                <div>
                  <StatusBadge state={version.isCurrent ? "HEALTHY" : "IMPLEMENTED"} />
                  <strong>
                    Edition {version.versionNumber} · {version.versionLabel}
                  </strong>
                </div>
                <DetailList
                  items={[
                    { label: "Version ID", value: <Identifier value={version.id} /> },
                    { label: "Published", value: dateTime(version.publishedAt) },
                    { label: "Published by", value: version.publishedBy },
                    { label: "Schema", value: version.schemaVersion },
                    { label: "Checksum", value: <Identifier value={version.checksum} label="edition checksum" /> },
                    { label: "Pinned Voyages", value: version._count.sessions },
                    { label: "Community releases", value: version._count.communityReleases },
                  ]}
                />
                {version.releaseNotes ? <p>{version.releaseNotes}</p> : null}
                {version.communityReleases.length ? (
                  <div className="chartroom-sublist">
                    {version.communityReleases.map((release) => (
                      <div key={release.id}>
                        <TextLink href={`/admin/community/${release.listing.id}`}>
                          {release.listing.title} · {release.semanticVersion}
                        </TextLink>
                        <span>
                          {release.listing.publicationStatus} · {release.moderationStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No immutable edition published" />
        )}
      </Panel>
      <Panel title="Recent Voyages pinned to this Chronicle">
        {chronicle.sessions.length ? (
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Voyage</th>
                  <th>Edition</th>
                  <th>State</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {chronicle.sessions.map((voyage) => (
                  <tr key={voyage.id}>
                    <td>
                      <TextLink href={`/admin/voyages/${voyage.id}`}>{voyage.voyageName ?? voyage.id}</TextLink>
                    </td>
                    <td>{voyage.publishedVersionId ?? "Draft preview"}</td>
                    <td>
                      <StatusBadge state={voyage.previewMode ? "NOT_LIVE_VALIDATED" : voyage.status} />
                    </td>
                    <td>{dateTime(voyage.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No Voyage recorded" />
        )}
      </Panel>
      <EvidenceStrip evidence={detail.evidence} />
    </ChartroomPage>
  );
}
