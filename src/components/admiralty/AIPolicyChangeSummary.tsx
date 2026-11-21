import { aiCapabilities } from "@/parallax/ai-capabilities";
import styles from "./AIQuotaConsole.module.css";

const fieldNames: Record<string, string> = {
  enabled: "AI access",
  provider: "Provider",
  standardModel: "Ordinary Assistant model",
  advancedModel: "Advanced Assistant model",
  roomModel: "Reconstruction model",
  advancedEnabled: "Advanced Assistant access",
  monthlyRequests: "Monthly operation allowance",
  monthlySpendNano: "Monthly spending ceiling",
  defaultUserRequests: "Default person allowance",
  defaultUserSpendNano: "Default person spending ceiling",
  warningSpendNano: "Spending warning",
  requestsPerMinute: "Requests per minute",
  userRequestsPerMinute: "Person requests per minute",
  globalRequestsPerMinute: "Platform requests per minute",
  concurrency: "Concurrent operations",
  userConcurrency: "Person concurrent operations",
  globalConcurrency: "Platform concurrent operations",
  maximumInputTokens: "Maximum input tokens",
  maximumOutputTokens: "Maximum output tokens",
  timeoutMs: "Request timeout (milliseconds)",
  maximumRequestSpendNano: "Per-request spending ceiling",
  retentionDays: "Retention (days)",
  allowedModels: "Permitted models",
  suspended: "Account suspended",
  expiresAt: "Override expires",
  source: "Policy origin",
  accessOrigin: "Access origin",
  allowanceOrigin: "Allowance origin",
  spendingOrigin: "Spending ceiling origin",
  capabilities: "Effective capability",
  capabilityPolicies: "Capability policy",
  pricingVersions: "Pricing version",
  effectiveAt: "Effective date",
  inputNanoPerToken: "Input price per token",
  cachedInputNanoPerToken: "Cached input price per token",
  cacheWriteNanoPerToken: "Cache write price per token",
  outputNanoPerToken: "Output price per token",
  serviceTier: "Service tier",
  inputAccounting: "Input accounting",
};
const words = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
const name = (key: string) => fieldNames[key] ?? aiCapabilities.find((item) => item.id === key)?.name ?? words(key);
function fields(value: unknown, path: string[] = [], result = new Map<string, string>()): Map<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) fields(item, [...path, key], result);
  } else if (Array.isArray(value) && value.some((item) => item && typeof item === "object")) {
    value.forEach((item, index) => fields(item, [...path, String(index + 1)], result));
  } else if (path.length) {
    const key = path.at(-1)!;
    const formatted =
      value == null
        ? "Not set"
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : typeof value === "number" && (key.endsWith("Nano") || key.includes("NanoPerToken"))
            ? `$${(value / 1_000_000_000).toFixed(9).replace(/0+$/, "").replace(/\.$/, "")} USD`
            : Array.isArray(value)
              ? value.join(", ") || "None"
              : String(value);
    result.set(path.join("."), formatted);
  }
  return result;
}

export function AIPolicyChangeSummary({ current, proposed }: { current: unknown; proposed: unknown }) {
  const before = fields(current),
    after = fields(proposed);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter((key) => before.get(key) !== after.get(key));
  return (
    <>
      <h3>What will change</h3>
      {changed.length ? (
        <div className={`${styles.scroll} ${styles.policyChanges}`} tabIndex={0} role="region" aria-label="Policy changes">
          <table className={styles.desktopPolicyChanges}>
            <caption>Changed values only. All other effective settings stay the same.</caption>
            <thead>
              <tr>
                <th scope="col">Setting</th>
                <th scope="col">Current</th>
                <th scope="col">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {changed.map((key) => (
                <tr key={key}>
                  <th scope="row">{key.split(".").map(name).join(" · ")}</th>
                  <td>{before.get(key) ?? "Not set"}</td>
                  <td>{after.get(key) ?? "Not set"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.mobilePolicyChanges} role="list">
            <p>Changed values only. All other effective settings stay the same.</p>
            {changed.map((key) => (
              <div key={key} role="listitem" className={styles.mobilePolicyChange}>
                <h4>{key.split(".").map(name).join(" · ")}</h4>
                <dl>
                  <div>
                    <dt>Current</dt>
                    <dd>{before.get(key) ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Proposed</dt>
                    <dd>{after.get(key) ?? "Not set"}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>No effective values change. The reviewed override and its audit reason will still be recorded.</p>
      )}
      <details>
        <summary>Read complete current and proposed policy snapshots</summary>
        <div className={styles.columns}>
          <div>
            <h3>Current effective policy</h3>
            <pre>{JSON.stringify(current, null, 2)}</pre>
          </div>
          <div>
            <h3>Proposed effective policy</h3>
            <pre>{JSON.stringify(proposed, null, 2)}</pre>
          </div>
        </div>
      </details>
    </>
  );
}
