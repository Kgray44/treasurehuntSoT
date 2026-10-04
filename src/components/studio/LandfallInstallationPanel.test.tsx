import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandfallInstallationPanel } from "./LandfallInstallationPanel";
import { landfallFixture } from "@/landfall/fixtures";
const fetcher = vi.fn(),
  changed = vi.fn();
const waypoint = structuredClone(landfallFixture.waypoints[0]);
waypoint.installations = [
  { id: "lab-installation", medium: "QR", label: "Synthetic tag", accessibilityAlternative: "Ask the Captain." },
];
const props = { taleId: "fixture", waypoint, csrfToken: "lab-csrf", unsaved: false, onChange: changed };
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  changed.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("deliberate Creator installation authoring", () => {
  it("edits optional draft metadata through the existing draft handler without automatic provider or issuance requests", () => {
    render(<LandfallInstallationPanel {...props} />);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add optional NFC installation" }));
    expect(changed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ medium: "NFC", accessibilityAlternative: expect.any(String) }),
      ]),
    );
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByLabelText("Installation label"), { target: { value: "Edited label" } });
    expect(changed).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "lab-installation", label: "Edited label" }),
    ]);
  });
  it("blocks publication requests while unsaved and keeps readable fallback when signing is absent", async () => {
    const view = render(<LandfallInstallationPanel {...props} unsaved />);
    expect(screen.getByRole("button", { name: "Check published installations" })).toBeDisabled();
    view.rerender(<LandfallInstallationPanel {...props} />);
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ state: "NOT_CONFIGURED", canComplete: false }) });
    fireEvent.click(screen.getByRole("button", { name: "Check published installations" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("not configured"));
    expect(screen.queryByRole("button", { name: /Create signed/ })).not.toBeInTheDocument();
  });
  it("requires a separately chosen published installation, then clears the generated token on scope changes", async () => {
    const view = render(<LandfallInstallationPanel {...props} />);
    fetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: "CONFIGURED",
        publishedVersionId: "lab-pin",
        versionLabel: "Synthetic edition",
        installations: waypoint.installations,
        canComplete: false,
      }),
    });
    fetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: "ISSUED",
        medium: "QR",
        installationId: "lab-installation",
        token: "synthetic-only-token-which-is-not-a-valid-signature",
        expiresAt: 2000000,
        canComplete: false,
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Check published installations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create signed QR token for Synthetic tag" }));
    await screen.findByLabelText("Signed QR text alternative");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      operation: "ISSUE",
      waypointId: waypoint.id,
      publishedVersionId: "lab-pin",
      installationId: "lab-installation",
    });
    view.rerender(<LandfallInstallationPanel {...props} unsaved />);
    expect(screen.queryByLabelText("Signed QR text alternative")).not.toBeInTheDocument();
  });
});
