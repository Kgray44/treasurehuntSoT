import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrydockLaunchGate } from "@/components/studio/DrydockLaunchGate";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const response = (body: unknown, status = 200, contentType = "application/json") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });

describe("Drydock Launch Gate", () => {
  it("shows the exact server decision and authored-source checksum", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({ readiness: { status: "TRIALS_INCOMPLETE", sourceChecksum: "a".repeat(64), requiredSuites: [] } }),
        ),
    );
    render(<DrydockLaunchGate taleId="tale-1" csrfToken="csrf" />);
    expect(screen.getByText("Checking current launch readiness…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("TRIALS INCOMPLETE")).toBeInTheDocument());
    expect(screen.getByText("a".repeat(64))).toBeInTheDocument();
  });

  it("reports a failed server decision fetch instead of implying readiness", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "Unavailable" }, 503)));
    render(<DrydockLaunchGate taleId="tale-1" csrfToken="csrf" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not load");
  });

  it("shows a safe next action and source-bound missing external evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          readiness: {
            status: "NEEDS_REPAIR",
            sourceChecksum: "b".repeat(64),
            blockingIssues: [],
            missingEvidence: [
              { id: "DD-R-LANDFALL-FIELD", resolver: "Project Landfall", capability: "LOCATION_PROVIDER" },
            ],
          },
        }),
      ),
    );
    render(<DrydockLaunchGate taleId="tale-1" csrfToken="csrf" />);
    expect(await screen.findByRole("heading", { name: "Missing current-source evidence" })).toBeInTheDocument();
    expect(screen.getByText(/Fix blocking issues or provide/i)).toBeInTheDocument();
    expect(screen.getByText(/DD-R-LANDFALL-FIELD/)).toBeInTheDocument();
  });

  it("shows a designed error instead of a raw parser exception for an HTML response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response("<!DOCTYPE html><html>Framework error</html>", 500, "text/html")),
    );
    render(<DrydockLaunchGate taleId="tale-1" csrfToken="csrf" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sea Trials could not load because the server returned an unexpected response.");
    expect(alert).not.toHaveTextContent("Unexpected token");
    expect(alert).not.toHaveTextContent("<!DOCTYPE");
  });
});
