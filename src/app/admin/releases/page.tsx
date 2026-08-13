import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getReleaseProjection } from "@/admiralty/ports/operations-admin-read";
import {
  ChartroomPage,
  DetailList,
  EvidenceStrip,
  Identifier,
  Panel,
  StatusBadge,
} from "@/components/admiralty/AdminPrimitives";

export default async function ReleasesPage() {
  const operator = await admiraltyPageOperator("RELEASE_OBSERVE");
  const result = await getReleaseProjection(operator);
  const release = result.data!;
  return (
    <ChartroomPage
      eyebrow="Release evidence"
      title="Releases"
      description="Current build and source identity where configured. Deploy, promote, rollback, and restart remain outside Phase 2."
    >
      <div className="chartroom-grid">
        <Panel title={`${release.application} ${release.version}`} kicker="Current runtime">
          <DetailList
            items={[
              { label: "Environment", value: release.environment },
              { label: "Build ID", value: release.buildId ?? "Not configured" },
              {
                label: "Git SHA",
                value: release.sourceRevision ? (
                  <Identifier value={release.sourceRevision} label="Git SHA" />
                ) : (
                  "Not configured"
                ),
              },
              { label: "Feature Catalog", value: release.featureCatalogIdentity },
              { label: "Sounding Line", value: release.soundingLineDecision },
            ]}
          />
        </Panel>
        <Panel title="Deployment controls" kicker="Intentionally absent">
          <p>
            <StatusBadge state="NOT_CONFIGURED" />
          </p>
          <p>
            No deploy, promote, rollback, restart, or repair action is exposed. This is a read-only release projection.
          </p>
        </Panel>
      </div>
      <EvidenceStrip evidence={result.evidence} />
    </ChartroomPage>
  );
}
