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
      description="Current runtime identity plus explicit deployment ownership. Admiralty does not become the deployment engine."
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
        <Panel title="Deployment authority" kicker="External handoff">
          <p>
            <StatusBadge state="NOT_CONFIGURED" />
          </p>
          <p>
            Promotion, deployment, rollback, restart, retry, and cancellation are owned by the deployment platform. This
            runtime has no source-bound owner command or safe handoff URL to expose.
          </p>
          <DetailList
            items={[
              { label: "Classification", value: "External handoff" },
              { label: "Required operator action", value: "Use the deployment owner’s governed release surface." },
              { label: "Admiralty role", value: "Observe current build evidence and retain the audit trail." },
            ]}
          />
        </Panel>
      </div>
      <EvidenceStrip evidence={result.evidence} />
    </ChartroomPage>
  );
}
