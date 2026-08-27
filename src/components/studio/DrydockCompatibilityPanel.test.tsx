import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrydockCompatibilityPanel } from "@/components/studio/DrydockCompatibilityPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Drydock Compatibility panel", () => {
  it("shows the current source-bound assessment and safe repair action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          compatibility: {
            status: "UNSUPPORTED",
            sourceChecksum: "c".repeat(64),
            policyVersion: "drydock-compatibility-v1",
            supportedBlockCount: 1,
            findings: [
              {
                code: "DRYDOCK_BLOCK_UNSUPPORTED",
                blockId: "passage-1",
                message: "This Passage cannot be interpreted.",
              },
            ],
          },
        }),
      ),
    );
    render(<DrydockCompatibilityPanel taleId="tale-1" csrfToken="csrf" />);
    expect(screen.getByText("Checking current reader compatibility…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("UNSUPPORTED")).toBeInTheDocument());
    expect(screen.getByText("c".repeat(64))).toBeInTheDocument();
    expect(screen.getByText(/Repair or migrate/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compatibility findings" })).toBeInTheDocument();
  });

  it("does not imply compatibility when the server decision cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "Unavailable" }, 503)));
    render(<DrydockCompatibilityPanel taleId="tale-1" csrfToken="csrf" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not load");
  });
});
