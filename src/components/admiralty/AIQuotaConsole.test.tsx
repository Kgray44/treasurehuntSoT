import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AIQuotaConsole } from "./AIQuotaConsole";
import { defaultAIGlobalPolicy } from "@/parallax/ai-policy";

const initial: Parameters<typeof AIQuotaConsole>[0]["initial"] = {
  policy: { ...defaultAIGlobalPolicy },
  revision: 0,
  period: "2026-10",
  resetAt: "2026-11-01T00:00:00Z",
  usage: {
    requests: 6,
    activeUsers: 2,
    exposureNano: 800000000,
    settledCostNano: 300000000,
    budgetRemainingNano: 9200000000,
    warning: false,
    overBudget: false,
  },
  byMode: [],
  byStatus: [],
  daily: [
    { date: "2026-10-01", requests: 0, exposureNano: 0, settledCostNano: 0 },
    { date: "2026-10-02", requests: 2, exposureNano: 500000000, settledCostNano: 100000000 },
    { date: "2026-10-03", requests: 4, exposureNano: 300000000, settledCostNano: 200000000 },
  ],
  provider: {
    provider: "OPENAI",
    configured: false,
    enabled: false,
    status: "UNCONFIGURED",
    standardModel: "gpt-6-luna",
    advancedModel: "gpt-6.1-sol",
    allowedModels: ["gpt-6-luna", "gpt-6.1-sol"],
    standardReasoning: "low",
    advancedReasoning: "low",
    maximumInputTokens: 12000,
    maximumOutputTokens: 4000,
    timeoutMs: 20000,
    allowedTools: [],
    advancedEnabled: false,
    legacyConfigured: false,
    lastSuccessAt: null,
    lastFailureCode: null,
    lastFailureAt: null,
    pricing: [],
    reconciliation: "NO_UNKNOWN_USAGE",
    unknownUsageCount: 0,
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Daily AI activity", () => {
  it("changes the chart's units and bar ranking without changing policy or requesting data", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { container } = render(<AIQuotaConsole initial={initial} csrfToken="synthetic-csrf" canManage={false} />);
    const height = (date: string) => (container.querySelector(`[data-date="${date}"]`) as HTMLElement).style.height;
    expect(height("2026-10-01")).toBe("0%");
    expect(height("2026-10-02")).toBe("50%");
    expect(height("2026-10-03")).toBe("100%");
    fireEvent.change(screen.getByLabelText("Chart shows"), { target: { value: "settled" } });
    expect(screen.getByRole("figure", { name: "Settled cost per day by UTC day" })).toBeInTheDocument();
    expect(height("2026-10-02")).toBe("50%");
    fireEvent.change(screen.getByLabelText("Chart shows"), { target: { value: "accounted" } });
    expect(height("2026-10-02")).toBe("100%");
    expect(height("2026-10-03")).toBe("60%");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("exposes UTC daily requests, distinct costs and averages including empty days", () => {
    render(<AIQuotaConsole initial={initial} csrfToken="synthetic-csrf" canManage={false} />);
    const table = screen.getByRole("table", { hidden: true });
    const row = within(table).getByRole("row", { name: /2026-10-02/, hidden: true });
    expect(within(row).getByRole("cell", { name: "2", hidden: true })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "$0.50", hidden: true })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "$0.10", hidden: true })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "$0.40", hidden: true })).toBeInTheDocument();
    expect(screen.getByText("Average requests / day").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Average settled cost / day").nextElementSibling).toHaveTextContent("$0.10");
  });
  it("renders an empty month honestly without fabricated nonzero bars", () => {
    const empty = {
      ...initial,
      daily: initial.daily.map((day) => ({ ...day, requests: 0, exposureNano: 0, settledCostNano: 0 })),
      usage: { ...initial.usage, requests: 0, exposureNano: 0, settledCostNano: 0 },
    };
    const { container } = render(<AIQuotaConsole initial={empty} csrfToken="synthetic-csrf" canManage={false} />);
    expect(screen.getByText("No admitted requests in this month so far.")).toBeInTheDocument();
    expect([...container.querySelectorAll<HTMLElement>("[data-date]")].every((bar) => bar.style.height === "0%")).toBe(
      true,
    );
  });
});
