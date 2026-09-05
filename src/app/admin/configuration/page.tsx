import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getConfigurationProjection } from "@/admiralty/ports/operations-admin-read";
import { CommunityOutboxRuntimePolicyPanel } from "@/components/admiralty/CommunityOutboxRuntimePolicyPanel";
import { ChartroomPage, DetailList, EvidenceStrip, Panel, StatusBadge } from "@/components/admiralty/AdminPrimitives";

export default async function ConfigurationPage() {
  const operator = await admiraltyPageOperator("CONFIG_OBSERVE");
  const result = await getConfigurationProjection(operator);
  const configuration = result.data!;
  const editable = configuration.settings.filter((setting) => setting.mutableHere);
  const nonEditable = configuration.settings.filter((setting) => !setting.mutableHere);
  return (
    <ChartroomPage
      eyebrow="Source-bound configuration authority"
      title="Configuration"
      description="Each displayed setting is classified before it is shown. Only current owner-backed policies can be changed here."
    >
      <div className="chartroom-metrics">
        <div className="chartroom-metric">
          <span>Governed policies</span>
          <strong>{editable.length}</strong>
          <small>Owner-backed and revision-safe</small>
        </div>
        <div className="chartroom-metric">
          <span>Reference-only settings</span>
          <strong>{nonEditable.filter((setting) => setting.secretClassification === "REFERENCE_ONLY").length}</strong>
          <small>Secrets remain undisclosed</small>
        </div>
        <div className="chartroom-metric">
          <span>Deployment-managed settings</span>
          <strong>{nonEditable.filter((setting) => setting.managementClass === "DEPLOYMENT_MANAGED").length}</strong>
          <small>External owner action required</small>
        </div>
      </div>
      <Panel title="Editable current policy" kicker="Harborlight owner command">
        <CommunityOutboxRuntimePolicyPanel
          csrfToken={operator.csrfToken}
          policy={configuration.communityOutboxRuntimePolicy}
          enabled={operator.capabilities.includes("CONFIG_OPERATE")}
        />
      </Panel>
      <Panel title="Classified non-editable settings" kicker="No fake controls">
        <div className="chartroom-cards chartroom-cards--configuration">
          {nonEditable.map((setting) => (
            <article key={setting.id}>
              <header>
                <span>{setting.owner}</span>
                <StatusBadge state={setting.configured ? "CONFIGURED" : "NOT_CONFIGURED"} />
              </header>
              <h2>{setting.name}</h2>
              <p>{setting.description}</p>
              <DetailList
                items={[
                  { label: "Management", value: setting.managementClass.replaceAll("_", " ") },
                  { label: "Effective state", value: setting.effectiveValue },
                  { label: "Owner action", value: setting.mutationCommandOwner ?? "Not available in Admiralty" },
                ]}
              />
              <details>
                <summary>Technical details</summary>
                <DetailList
                  items={[
                    { label: "Stable ID", value: setting.id },
                    { label: "Source reference", value: setting.sourceReference },
                    { label: "Validation", value: setting.validation },
                    { label: "Rollback", value: setting.rollbackBehavior },
                  ]}
                />
              </details>
            </article>
          ))}
        </div>
      </Panel>
      <EvidenceStrip evidence={result.evidence} />
    </ChartroomPage>
  );
}
