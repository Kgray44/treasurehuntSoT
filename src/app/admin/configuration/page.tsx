import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getConfigurationProjection } from "@/admiralty/ports/operations-admin-read";
import { ChartroomPage, EvidenceStrip, StatusBadge } from "@/components/admiralty/AdminPrimitives";

export default async function ConfigurationPage() {
  const operator = await admiraltyPageOperator("CONFIG_OBSERVE");
  const result = await getConfigurationProjection(operator);
  return (
    <ChartroomPage
      eyebrow="Allowlisted configuration"
      title="Configuration"
      description="Safe effective state and secret references only. Values cannot be changed here."
    >
      <div className="chartroom-table-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Setting</th>
              <th>Class</th>
              <th>Effective state</th>
              <th>Reference</th>
              <th>Validation</th>
            </tr>
          </thead>
          <tbody>
            {result.data?.map((setting) => (
              <tr key={setting.key}>
                <td>
                  <strong>{setting.key}</strong>
                  <small>Read only</small>
                </td>
                <td>{setting.classification}</td>
                <td>
                  {setting.value}
                  <small>
                    <StatusBadge state={setting.configured ? "CONFIGURED" : "NOT_CONFIGURED"} />
                  </small>
                </td>
                <td>
                  <code>{setting.reference}</code>
                </td>
                <td>
                  {setting.lastValidated ?? "No validation timestamp"}
                  <small>{setting.lastRotated ? `Rotated ${setting.lastRotated}` : "Rotation not available"}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="chartroom-callout">
        <strong>No mutation surface</strong>
        <p>Phase 2 does not edit runtime settings, flags, providers, secrets, or environment variables.</p>
      </aside>
      <EvidenceStrip evidence={result.evidence} />
    </ChartroomPage>
  );
}
