import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountLifecycleActionPanel } from "./AccountLifecycleActionPanel";
import { SessionActionPanel } from "./SessionActionPanel";

const preview = {
  consequences: ["The governed owner command will apply the requested change."],
  warnings: [],
  reauthenticationRequired: true,
};

describe("Admiralty command-preview state", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("enables session preview only for an active selection with a valid reason and keeps confirmation assured", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "session-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preview }) }));
    render(
      <SessionActionPanel
        targetAccountId="account-a"
        csrfToken="csrf"
        enabled
        sessions={[
          {
            id: "active-session-a",
            deviceLabel: "Synthetic test device",
            sessionType: "ORDINARY",
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            revokedAt: null,
          },
        ]}
      />,
    );

    const reason = screen.getByLabelText("Reason");
    const previewButton = screen.getByRole("button", { name: "Preview revocation" });
    expect(screen.getByLabelText("Active device")).toHaveValue("active-session-a");
    expect(previewButton).toBeDisabled();

    fireEvent.change(reason, { target: { value: "A valid reason" } });
    expect(previewButton).toBeEnabled();
    fireEvent.change(reason, { target: { value: "short" } });
    expect(previewButton).toBeDisabled();

    fireEvent.change(reason, { target: { value: "A valid reason" } });
    fireEvent.click(previewButton);
    expect(await screen.findByRole("heading", { name: "Before you revoke" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm and revoke session" })).toBeDisabled();
  });

  it("enables account preview for an active account before privileged assurance and disables it for a short reason", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "account-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preview }) }));
    render(
      <AccountLifecycleActionPanel
        targetAccountId="account-a"
        expectedUpdatedAt="2026-08-25T00:00:00.000Z"
        accountStatus="ACTIVE"
        csrfToken="csrf"
        enabled
      />,
    );

    const reason = screen.getByLabelText("Reason");
    const previewButton = screen.getByRole("button", { name: "Preview suspension" });
    expect(previewButton).toBeDisabled();

    fireEvent.change(reason, { target: { value: "A valid reason" } });
    expect(previewButton).toBeEnabled();
    fireEvent.change(reason, { target: { value: "short" } });
    expect(previewButton).toBeDisabled();

    fireEvent.change(reason, { target: { value: "A valid reason" } });
    fireEvent.click(previewButton);
    expect(await screen.findByRole("heading", { name: "Before you suspend" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm and suspend account" })).toBeDisabled();
  });
});
