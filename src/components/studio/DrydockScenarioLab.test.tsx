import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrydockScenarioLab } from "./DrydockScenarioLab";

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) }) as unknown as Response;

afterEach(() => vi.unstubAllGlobals());

describe("Drydock Scenario Lab", () => {
  it("saves a source-bound revision before running the bounded Sea Trial", async () => {
    const checksum = "a".repeat(64);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ sourceChecksum: checksum, scenarios: [] }))
      .mockResolvedValueOnce(response({ suites: [] }))
      .mockResolvedValueOnce(response({ scenario: { scenarioId: "scenario-1", revision: 1, sourceChecksum: checksum, title: "New deterministic sea trial", purpose: "Exercise one bounded authored path without changing a live Voyage.", tags: ["creator"], createdAt: "2026-08-12T00:00:00.000Z" } }, 201))
      .mockResolvedValueOnce(response({ run: { summary: { runId: "run-1", status: "COMPLETED", sourceChecksum: checksum, completedInputs: 1 }, result: { assertions: [] }, trace: [{ ordinal: 1, inputKind: "CONTINUE", status: "COMPLETED", intentTypes: ["blockCompleted"], faultIds: [] }] } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "new" });

    render(<DrydockScenarioLab taleId="tale-1" csrfToken="csrf-1" />);
    await screen.findByRole("heading", { name: "Sea Trials" });
    fireEvent.click(screen.getByRole("button", { name: "Save and run Sea Trial" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-csrf-token": "csrf-1" }) }));
    expect(fetchMock.mock.calls[3]?.[0]).toContain("/scenarios/scenario-1/runs");
    expect(await screen.findByLabelText("Sea Trial receipt")).toHaveTextContent("COMPLETED");
  });
});
