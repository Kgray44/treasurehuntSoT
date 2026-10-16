"use client";
import { useEffect, useState } from "react";
import type { aiQuotaOverrides, aiQuotaUserDetail } from "@/parallax/ai-quota-projections";
import { AIQuotaUserPanel } from "./AIQuotaUserPanel";
import styles from "./AIQuotaConsole.module.css";

type Inventory = Awaited<ReturnType<typeof aiQuotaOverrides>>;
type User = NonNullable<Awaited<ReturnType<typeof aiQuotaUserDetail>>>;
const labels: Record<string, string> = {
  standardModel: "Spatial Assistant",
  advancedModel: "Advanced Assistant",
  roomModel: "Room reconstruction",
  monthlyRequests: "Monthly requests",
  monthlySpendNano: "Monthly budget",
  advancedEnabled: "Advanced access",
  requestsPerMinute: "Requests per minute",
  suspended: "Access paused",
};

export function AIQuotaOverrides({ csrfToken, canManage }: { csrfToken: string; canManage: boolean }) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/ai-usage?section=overrides", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Overrides could not be loaded.");
        if (!controller.signal.aborted) setInventory(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Overrides could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [refresh]);
  async function loadMore() {
    if (!inventory?.nextCursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/ai-usage?section=overrides&cursor=${encodeURIComponent(inventory.nextCursor)}`,
        { cache: "no-store" },
      );
      const data: Inventory & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "More overrides could not be loaded.");
      setInventory({ ...data, items: [...inventory.items, ...data.items] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "More overrides could not be loaded.");
    } finally {
      setBusy(false);
    }
  }
  async function open(accountId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/ai-usage?section=user&accountId=${encodeURIComponent(accountId)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.user) throw new Error(data.error ?? "Account policy could not be loaded.");
      setSelected(data.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account policy could not be loaded.");
    } finally {
      setBusy(false);
    }
  }
  const items =
    inventory?.items.filter(
      (item) =>
        filter === "ALL" ||
        item.fields.some((field) => (filter === "MODELS" ? field.endsWith("Model") : !field.endsWith("Model"))),
    ) ?? [];
  return (
    <section className={styles.card} aria-label="AI user overrides">
      <header>
        <h2>User overrides</h2>
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            setSelected(null);
            setRefresh((value) => value + 1);
          }}
        >
          Refresh overrides
        </button>
      </header>
      <p>
        {inventory ? `${inventory.total} accounts with individual policies` : "Loading individual policies…"}. Changes
        retain their audit history.
      </p>
      {error && (
        <p role="alert" className={styles.notice}>
          {error}
        </p>
      )}
      {selected ? (
        <>
          <button
            onClick={() => {
              setBusy(true);
              setError("");
              setSelected(null);
              setRefresh((value) => value + 1);
            }}
          >
            Back to overrides
          </button>
          <AIQuotaUserPanel
            key={selected.accountId}
            initial={selected}
            csrfToken={csrfToken}
            canManage={canManage}
            initialReason="Restore global AI models and quotas after reviewing this exception."
          />
        </>
      ) : (
        <>
          <label>
            Show{" "}
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">All overrides</option>
              <option value="MODELS">Model overrides</option>
              <option value="QUOTAS">Quota &amp; access overrides</option>
            </select>
          </label>
          <div className={styles.scroll} role="region" aria-label="Individual AI policies" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Overrides</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.accountId}>
                    <td>{item.displayName}</td>
                    <td>
                      {item.fields.length
                        ? item.fields.map((field) => (
                            <div key={field}>
                              {labels[field] ?? field}:{" "}
                              {field === "monthlySpendNano"
                                ? `$${Number(item.policy.monthlySpendNano) / 1e9}`
                                : String(item.policy[field as keyof typeof item.policy])}
                            </div>
                          ))
                        : "No differing values"}
                    </td>
                    <td>{item.reason}</td>
                    <td>
                      {item.expired ? "Expired · using global" : "Active"}
                      <small>
                        {item.policy.expiresAt
                          ? `Expires ${new Date(item.policy.expiresAt).toLocaleString()}`
                          : "No expiry"}
                      </small>
                    </td>
                    <td>
                      <button disabled={busy} onClick={() => void open(item.accountId)}>
                        {canManage ? "Review / reset to global" : "View policy"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!busy && !items.length && <p>No overrides match this view.</p>}
          {inventory?.nextCursor && (
            <button disabled={busy} onClick={() => void loadMore()}>
              Load more overrides
            </button>
          )}
        </>
      )}
    </section>
  );
}
