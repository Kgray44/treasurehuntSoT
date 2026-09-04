import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateOperationsConsole } from "./PrivateOperationsConsole";

const response = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  ({ ok, status, json: async () => body }) as Response;

describe("PrivateOperationsConsole", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders sanitized operational evidence with an atomic status and accessible refresh", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          providers: [{ kind: "STORAGE", configurationState: "HEALTHY", safeCode: "LOCAL" }],
          backupRuns: [{ backupId: "backup-0123456789abcdef", state: "VERIFIED" }],
          drills: [{ targetIdentity: "restore-fedcba9876543210", state: "VERIFIED" }],
          repairs: [
            {
              digest: "0123456789abcdef",
              state: "DRAFT",
              dryRun: true,
              expiresAt: "2030-01-01",
              _count: { actions: 2 },
            },
          ],
          protectedMedia: {
            total: 2,
            readyDerivatives: 1,
            blockedConsent: 1,
            withdrawnDerivatives: 0,
            staleGrants: 0,
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          providers: [],
          backupRuns: [],
          drills: [],
          repairs: [],
          protectedMedia: { total: 0, readyDerivatives: 0, blockedConsent: 0, withdrawnDerivatives: 0, staleGrants: 0 },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<PrivateOperationsConsole />);

    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Operational status is current."));
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByRole("heading", { name: "Operational readiness" })).toBeVisible();
    const refresh = screen.getByRole("button", { name: "Refresh provider readiness" });
    expect(refresh).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText(/Backup backup-0123456789abcdef/)).toBeVisible();
    expect(screen.getByText(/Restore drill restore-fedcba9876543210/)).toBeVisible();

    fireEvent.click(refresh);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith("/api/studio/private-content/operations", { cache: "no-store" });
    expect(screen.getByText("No provider status records were returned.")).toBeVisible();
    expect(screen.getByText("No backup runs or restore drills have been recorded.")).toBeVisible();
    expect(screen.getByText("No repair plans have been recorded.")).toBeVisible();
  });

  it("announces a generic failure without rendering provider details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("C:/private/root")));
    render(<PrivateOperationsConsole />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable"));
    expect(screen.queryByText("C:/private/root")).not.toBeInTheDocument();
  });

  it("distinguishes authorization from a successful zero-record response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "not authorized" }, false, 403)));
    render(<PrivateOperationsConsole />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("requires Administrator access"));
    expect(screen.getAllByText("Administrator access is required to view this operational section.")).toHaveLength(4);
    expect(screen.queryByText("No provider status records were returned.")).not.toBeInTheDocument();
  });
});
