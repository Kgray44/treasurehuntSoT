"use client";
import { useState } from "react";
import { aiCapabilities } from "@/parallax/ai-capabilities";
import {
  aiModelIds,
  aiPricing,
  aiPricingVersionSchema,
  USD_NANO,
  type AIGlobalPolicy,
  type AIUserPolicy,
} from "@/parallax/ai-policy";
import { parseUSDNano } from "./ai-quota-format";
import styles from "./AIQuotaConsole.module.css";

type Policies = NonNullable<AIUserPolicy["capabilityPolicies"]>;
export function AICapabilityPolicyFields({
  policies = {},
  onChange,
  disabled,
  personal = false,
}: {
  policies?: Policies;
  onChange: (value: Policies) => void;
  disabled: boolean;
  personal?: boolean;
}) {
  return (
    <section className={styles.card}>
      <h2>Capability access & allowances</h2>
      <p>
        {personal
          ? "Individual exceptions inherit platform capability rules and remain inside all global ceilings."
          : "Capability defaults apply to each person within the existing combined monthly and spending ceilings."}{" "}
        Empty allowances inherit; zero denies new operations. Pending reservations count toward limits.
      </p>
      {aiCapabilities
        .filter((capability) => capability.id !== "OTHER_AI_OPERATIONS")
        .map((capability) => {
          const policy = policies[capability.id] ?? {};
          const change = (key: keyof typeof policy, value: unknown) =>
            onChange({ ...policies, [capability.id]: { ...policy, [key]: value } });
          return (
            <fieldset key={capability.id}>
              <legend>{capability.name}</legend>
              <div className={styles.fields}>
                <label>
                  {capability.name} access
                  <select
                    disabled={disabled}
                    value={policy.enabled === undefined ? "inherit" : String(policy.enabled)}
                    onChange={(event) =>
                      change("enabled", event.target.value === "inherit" ? undefined : event.target.value === "true")
                    }
                  >
                    <option value="inherit">Inherit existing access</option>
                    <option value="true">Permit within platform rights</option>
                    <option value="false">Disable this capability</option>
                  </select>
                </label>
                <label>
                  {capability.name} monthly operations
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    disabled={disabled}
                    value={policy.monthlyRequests ?? ""}
                    onChange={(event) =>
                      change("monthlyRequests", event.target.value === "" ? null : Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  {capability.name} monthly spending (USD)
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.000000001"
                    disabled={disabled}
                    value={policy.monthlySpendNano == null ? "" : policy.monthlySpendNano / USD_NANO}
                    onChange={(event) =>
                      change("monthlySpendNano", event.target.value === "" ? null : parseUSDNano(event.target.value))
                    }
                  />
                </label>
              </div>
              <details>
                <summary>{capability.name} permitted model profiles</summary>
                <label>
                  Profile restriction
                  <select
                    disabled={disabled}
                    value={policy.allowedModels ? policy.allowedModels.join(",") : ""}
                    onChange={(event) =>
                      change("allowedModels", event.target.value ? event.target.value.split(",") : undefined)
                    }
                  >
                    <option value="">Inherit permitted models</option>
                    {aiModelIds.map((model) => (
                      <option key={model} value={model}>
                        {model} only
                      </option>
                    ))}
                    <option value={aiModelIds.join(",")}>All configured models</option>
                  </select>
                </label>
              </details>
            </fieldset>
          );
        })}
    </section>
  );
}

export function AIPricingFields({
  policy,
  onChange,
  disabled,
}: {
  policy: AIGlobalPolicy;
  onChange: (value: AIGlobalPolicy) => void;
  disabled: boolean;
}) {
  const [model, setModel] = useState<(typeof aiModelIds)[number]>(aiModelIds[0]);
  const [revision, setRevision] = useState("");
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 16));
  const initialPrice = aiPricing[aiModelIds[0]];
  const [rates, setRates] = useState({
    input: String(initialPrice.inputNanoPerToken / 1000),
    cached: String(initialPrice.cachedInputNanoPerToken / 1000),
    cacheWrite: String(initialPrice.cacheWriteNanoPerToken / 1000),
    output: String(initialPrice.outputNanoPerToken / 1000),
  });
  const [source, setSource] = useState("https://developers.openai.com/api/docs/pricing"),
    [notice, setNotice] = useState("");
  function add() {
    try {
      const rate = (value: string) => {
        const nano = parseUSDNano(value);
        if (nano % 1000000) throw new Error("Use rates precise to USD 0.001 per million tokens.");
        return nano / 1000000;
      };
      const price = aiPricingVersionSchema.parse({
        model,
        revision,
        effectiveAt: `${effective}:00.000Z`,
        serviceTier: "default",
        inputAccounting: "DISJOINT_CACHE_CATEGORIES",
        inputNanoPerToken: rate(rates.input),
        cachedInputNanoPerToken: rate(rates.cached),
        cacheWriteNanoPerToken: rate(rates.cacheWrite),
        outputNanoPerToken: rate(rates.output),
        source,
      });
      if (policy.pricingVersions?.some((old) => old.model === price.model && old.revision === price.revision))
        throw new Error("Choose a new immutable pricing revision.");
      onChange({ ...policy, pricingVersions: [...(policy.pricingVersions ?? []), price] });
      setNotice(
        "Pricing version added to the proposed policy. Preview and confirm the policy to activate it; existing receipts retain their snapshots.",
      );
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Check this pricing version.");
    }
  }
  return (
    <section className={styles.card}>
      <h2>Versioned provider pricing</h2>
      <p>
        Configured calculation rates are separate from confirmed provider invoices. Existing operations retain the exact
        rate snapshot used at admission. Image input is included in reported input tokens where provided; unreported
        dimensions stay unavailable.
      </p>
      <div className={styles.table} role="region" aria-label="Configured pricing versions" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Revision / effective UTC</th>
              <th>Input / cached / cache write / output (USD per million tokens)</th>
            </tr>
          </thead>
          <tbody>
            {[...Object.values(aiPricing), ...(policy.pricingVersions ?? [])].map((price) => (
              <tr key={`${price.model}:${price.revision}`}>
                <td>{price.model}</td>
                <td>
                  {price.revision}
                  <br />
                  {price.effectiveAt}
                </td>
                <td>
                  {[
                    price.inputNanoPerToken,
                    price.cachedInputNanoPerToken,
                    price.cacheWriteNanoPerToken,
                    price.outputNanoPerToken,
                  ]
                    .map((value) => (value / 1000).toString())
                    .join(" / ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Add a future or current pricing version</summary>
        <div className={styles.fields}>
          <label>
            Pricing model
            <select
              disabled={disabled}
              value={model}
              onChange={(event) => {
                const next = event.target.value as typeof model;
                setModel(next);
                const p = aiPricing[next];
                setRates({
                  input: String(p.inputNanoPerToken / 1000),
                  cached: String(p.cachedInputNanoPerToken / 1000),
                  cacheWrite: String(p.cacheWriteNanoPerToken / 1000),
                  output: String(p.outputNanoPerToken / 1000),
                });
              }}
            >
              {aiModelIds.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label>
            New pricing revision
            <input disabled={disabled} value={revision} onChange={(event) => setRevision(event.target.value)} />
          </label>
          <label>
            Price effective at (UTC)
            <input
              type="datetime-local"
              disabled={disabled}
              value={effective}
              onChange={(event) => setEffective(event.target.value)}
            />
          </label>
          {Object.entries(rates).map(([key, value]) => (
            <label key={key}>
              {key} price (USD per million tokens)
              <input
                type="number"
                min="0"
                step="0.001"
                disabled={disabled}
                value={value}
                onChange={(event) => setRates({ ...rates, [key]: event.target.value })}
              />
            </label>
          ))}
          <label>
            Provider pricing source
            <input type="url" disabled={disabled} value={source} onChange={(event) => setSource(event.target.value)} />
          </label>
        </div>
        <button type="button" disabled={disabled} onClick={add}>
          Add proposed pricing version
        </button>
      </details>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
