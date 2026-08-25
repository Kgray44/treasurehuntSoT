import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DossierSupportPanel } from "./DossierSupportPanel";

describe("DossierSupportPanel Tideglass diagnostics", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("submits an exact immutable pair only through the scoped Tideglass diagnostic route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, diagnostic: { available: false, failureCode: "EDITION_NOT_AUTHORIZED" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <DossierSupportPanel
        targetAccountId="creator-a"
        csrfToken="csrf"
        canRequest={false}
        canUse
        activeGrantId="grant-a"
      />,
    );
    fireEvent.change(screen.getByLabelText("Scoped category"), { target: { value: "TIDEGLASS_DIAGNOSTICS" } });
    fireEvent.change(screen.getByLabelText("Chronicle ID"), { target: { value: "chronicle-a" } });
    fireEvent.change(screen.getByLabelText("Source edition ID"), { target: { value: "edition-a" } });
    fireEvent.change(screen.getByLabelText("Target edition ID"), { target: { value: "edition-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Read approved category" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/support/tideglass",
      expect.objectContaining({
        body: JSON.stringify({
          grantId: "grant-a",
          targetAccountId: "creator-a",
          chronicleId: "chronicle-a",
          sourceEditionId: "edition-a",
          targetEditionId: "edition-b",
        }),
      }),
    );
    expect(screen.getByText("Tideglass diagnostic read and audited.")).toBeVisible();
  });
});
