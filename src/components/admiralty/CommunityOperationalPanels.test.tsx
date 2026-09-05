import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityOutboxLeaseRecoveryPanel } from "./CommunityOutboxLeaseRecoveryPanel";
import { CommunityOutboxRuntimePolicyPanel } from "./CommunityOutboxRuntimePolicyPanel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("Community operational command panels", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps a runtime-policy confirmation disabled until an owner preview and privileged assurance exist", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "policy-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preview: previewPolicy }) }));
    render(
      <CommunityOutboxRuntimePolicyPanel
        csrfToken="csrf"
        enabled
        policy={{ dispatchEnabled: true, batchSize: 25, pollIntervalMs: 1_000, revision: 0, source: "DEFAULT" }}
      />,
    );

    const preview = screen.getByRole("button", { name: "Preview policy change" });
    expect(preview).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Bound the synthetic Community worker." } });
    expect(preview).toBeEnabled();
    fireEvent.click(preview);
    expect(await screen.findByRole("heading", { name: "Before you apply this policy" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm and apply policy" })).toBeDisabled();
  });

  it("requires a reason before an expired-lease recovery preview", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "lease-key" });
    render(<CommunityOutboxLeaseRecoveryPanel csrfToken="csrf" expiredClaims={2} enabled />);
    const preview = screen.getByRole("button", { name: "Preview lease recovery" });
    expect(preview).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Recover expired synthetic leases." } });
    expect(preview).toBeEnabled();
  });
});

const previewPolicy = {
  currentState: {
    dispatchEnabled: true,
    batchSize: 25,
    pollIntervalMs: 1_000,
    revision: 0,
    source: "DEFAULT" as const,
  },
  resultingState: {
    dispatchEnabled: false,
    batchSize: 5,
    pollIntervalMs: 5_000,
    revision: 1,
    source: "GOVERNED_POLICY" as const,
  },
  consequences: ["Community workers will stop claiming new outbox work."],
  warnings: [],
  reauthenticationRequired: true,
  rollbackAvailable: true,
};
