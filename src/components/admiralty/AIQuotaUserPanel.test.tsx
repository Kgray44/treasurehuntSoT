import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AIQuotaUserPanel } from "./AIQuotaUserPanel";
import { defaultAIGlobalPolicy, effectiveAIUserPolicy } from "@/parallax/ai-policy";
const initial = {
  accountId: "synthetic-dossier-user",
  capabilityUsage: [],
  displayName: "Synthetic Creator",
  policy: null,
  revision: 0,
  overrideReason: null,
  overrideChangedAt: null,
  globalModels: {
    standardModel: defaultAIGlobalPolicy.standardModel,
    advancedModel: defaultAIGlobalPolicy.advancedModel,
    roomModel: "gpt-6.1-sol" as const,
    allowedModels: defaultAIGlobalPolicy.allowedModels,
  },
  effective: effectiveAIUserPolicy(defaultAIGlobalPolicy, null),
  globalCeiling: { requests: 10000, spendNano: 10000000000 },
  used: 12,
  remaining: 488,
  percentageUsed: 2.4,
  exposureNano: 1200000,
  settledCostNano: 1000000,
  lastActivity: null,
  resetAt: "2026-11-01T00:00:00Z",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("AI allowance inside the canonical account dossier", () => {
  it("shows the existing account usage and controls without another account search", () => {
    render(<AIQuotaUserPanel initial={initial} csrfToken="synthetic-csrf" canManage />);
    expect(screen.getByText("12 / 500")).toBeInTheDocument();
    expect(screen.getByText("488 remaining")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search users" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("From (UTC)")).toHaveValue("2026-10-01");
  });
  it("previews an override for the dossier account and requires assurance before execution", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            preview: {
              previewId: "synthetic-preview",
              currentState: { revision: 0, policy: null },
              resultingState: { revision: 1, policy: { monthlyRequests: 250 } },
              consequences: [],
              warnings: [],
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<AIQuotaUserPanel initial={initial} csrfToken="synthetic-csrf" canManage />);
    fireEvent.change(screen.getByLabelText("Monthly request allowance (blank inherits)"), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText("Reason for user policy change"), {
      target: { value: "Synthetic reviewed exception" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview user policy" }));
    await screen.findByRole("heading", { name: "Review before applying" });
    const [, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toMatchObject({
      target: "USER",
      accountId: initial.accountId,
      expectedRevision: 0,
      policy: { monthlyRequests: 250 },
    });
    expect(options.headers).toMatchObject({ "x-csrf-token": "synthetic-csrf" });
    expect(screen.getByRole("button", { name: "Confirm & apply policy" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Monthly request allowance (blank inherits)"), { target: { value: "300" } });
    expect(screen.queryByRole("heading", { name: "Review before applying" })).not.toBeInTheDocument();
  });
  it("scopes history and exports to the dossier identity", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ records: [] })));
    vi.stubGlobal("fetch", fetcher);
    render(<AIQuotaUserPanel initial={initial} csrfToken="synthetic-csrf" canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Load history" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toContain(`accountId=${initial.accountId}`);
    expect(screen.getByRole("link", { name: "Export safe metadata" }).getAttribute("href")).toContain(
      `accountId=${initial.accountId}`,
    );
    expect(screen.queryByRole("button", { name: "View all accounts" })).not.toBeInTheDocument();
  });
  it("keeps account policy read-only for observers", () => {
    render(<AIQuotaUserPanel initial={initial} csrfToken="synthetic-csrf" canManage={false} />);
    expect(screen.getByLabelText("Monthly request allowance (blank inherits)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset to global" })).toBeDisabled();
  });
});
