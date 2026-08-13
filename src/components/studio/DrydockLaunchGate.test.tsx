import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrydockLaunchGate } from "@/components/studio/DrydockLaunchGate";

afterEach(() => vi.unstubAllGlobals());

describe("Drydock Launch Gate", () => {
  it("shows the exact server decision and authored-source checksum", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ readiness: { status: "TRIALS_INCOMPLETE", sourceChecksum: "a".repeat(64), requiredSuites: [] } }) }));
    render(<DrydockLaunchGate taleId="tale-1" csrfToken="csrf" />);
    expect(screen.getByText("Checking current launch readiness…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("TRIALS INCOMPLETE")).toBeInTheDocument());
    expect(screen.getByText("a".repeat(64))).toBeInTheDocument();
  });

  it("reports a failed server decision fetch instead of implying readiness", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<DrydockLaunchGate taleId="tale-1" csrfToken="csrf" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not load");
  });
});
