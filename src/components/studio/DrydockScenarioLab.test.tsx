import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrydockScenarioLab } from "./DrydockScenarioLab";

const response = (body: unknown, status = 200, contentType = "application/json") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Drydock Scenario Lab", () => {
  it("saves a source-bound revision before running the bounded Sea Trial", async () => {
    const checksum = "a".repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          sourceChecksum: checksum,
          requiredScenarioClasses: [
            { id: "BASELINE_SUCCESS", capability: "BASELINE", reason: "Every Chronicle needs a successful path." },
          ],
          scenarios: [],
        }),
      )
      .mockResolvedValueOnce(response({ suites: [] }))
      .mockResolvedValueOnce(response({ runs: [] }))
      .mockResolvedValueOnce(
        response(
          {
            scenario: {
              scenarioId: "scenario-1",
              revision: 1,
              sourceChecksum: checksum,
              title: "New deterministic sea trial",
              purpose: "Exercise one bounded authored path without changing a live Voyage.",
              tags: ["creator"],
              createdAt: "2026-08-12T00:00:00.000Z",
            },
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        response(
          {
            run: {
              summary: { runId: "run-1", status: "COMPLETED", sourceChecksum: checksum, completedInputs: 1 },
              result: { assertions: [], coverage: { blockIds: ["block"], edgeIds: [], faultIds: [] } },
              trace: [
                {
                  ordinal: 1,
                  blockId: "passage-1",
                  inputKind: "CONTINUE",
                  status: "COMPLETED",
                  intentTypes: ["blockCompleted"],
                  faultIds: [],
                  stateDigest: "a".repeat(64),
                },
              ],
            },
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "new" });

    render(<DrydockScenarioLab taleId="tale-1" csrfToken="csrf-1" />);
    await screen.findByRole("heading", { name: "Sea Trials" });
    fireEvent.click(screen.getByRole("button", { name: "Save and run Sea Trial" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-csrf-token": "csrf-1" }) }),
    );
    expect(fetchMock.mock.calls[4]?.[0]).toContain("/scenarios/scenario-1/runs");
    expect(await screen.findByLabelText("Sea Trial receipt")).toHaveTextContent("COMPLETED");
    expect(screen.getByLabelText("Run coverage summary")).toHaveTextContent("Passages1");
    expect(screen.getByRole("link", { name: "Open covered Passage block" })).toHaveAttribute(
      "href",
      "/studio/tales/tale-1#block-block",
    );
    expect(screen.getByRole("link", { name: "Open Passage" })).toHaveAttribute(
      "href",
      "/studio/tales/tale-1#block-passage-1",
    );
  });

  it("lets a Creator request cancellation only for an active Sea Trial", async () => {
    const checksum = "b".repeat(64);
    const running = {
      summary: { runId: "run-active", status: "RUNNING", sourceChecksum: checksum, completedInputs: 0 },
      result: { assertions: [], coverage: { blockIds: [], edgeIds: [], faultIds: [] } },
      trace: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          sourceChecksum: checksum,
          requiredScenarioClasses: [
            { id: "BASELINE_SUCCESS", capability: "BASELINE", reason: "Every Chronicle needs a successful path." },
          ],
          scenarios: [],
        }),
      )
      .mockResolvedValueOnce(response({ suites: [] }))
      .mockResolvedValueOnce(response({ runs: [running.summary] }))
      .mockResolvedValueOnce(response({ run: running }))
      .mockResolvedValueOnce(response({ runId: "run-active", cancellationRequested: true }, 202));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "new" });

    render(<DrydockScenarioLab taleId="tale-1" csrfToken="csrf-1" />);
    await screen.findByRole("button", { name: "run-active" });
    fireEvent.click(screen.getByRole("button", { name: "run-active" }));
    await screen.findByRole("button", { name: "Cancel Sea Trial" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel Sea Trial" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(fetchMock.mock.calls[4]?.[1]).toEqual(
      expect.objectContaining({ method: "DELETE", headers: expect.objectContaining({ "x-csrf-token": "csrf-1" }) }),
    );
    expect(await screen.findByRole("button", { name: "Cancellation requested" })).toBeDisabled();
  });

  it("builds governed Scenario inputs, faults, and assertions from normal controls", async () => {
    const checksum = "c".repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          sourceChecksum: checksum,
          requiredScenarioClasses: [
            { id: "BASELINE_SUCCESS", capability: "BASELINE", reason: "Every Chronicle needs a successful path." },
          ],
          scenarios: [],
        }),
      )
      .mockResolvedValueOnce(response({ suites: [] }))
      .mockResolvedValueOnce(response({ runs: [] }))
      .mockResolvedValueOnce(
        response(
          {
            scenario: {
              scenarioId: "scenario-1",
              revision: 1,
              sourceChecksum: checksum,
              title: "New deterministic sea trial",
              purpose: "Exercise one bounded authored path without changing a live Voyage.",
              tags: ["creator"],
              createdAt: "2026-08-12T00:00:00.000Z",
            },
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "new" });

    render(<DrydockScenarioLab taleId="tale-1" csrfToken="csrf-1" />);
    await screen.findByRole("heading", { name: "Sea Trials" });
    fireEvent.change(screen.getByLabelText("Choice target Passage"), { target: { value: "passage-safe" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Choice" }));
    fireEvent.click(screen.getByRole("button", { name: "Add catalogued fault" }));
    fireEvent.change(screen.getByLabelText("Scenario assertion kind"), { target: { value: "PROVIDER_REQUESTED" } });
    fireEvent.click(screen.getByRole("button", { name: "Add assertion" }));
    fireEvent.change(screen.getByLabelText("Simulation locale"), { target: { value: "fr-CA" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Baseline successful path/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save Scenario revision" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    const saved = JSON.parse((fetchMock.mock.calls[3]?.[1] as RequestInit).body as string);
    expect(saved.environment.locale).toBe("fr-CA");
    expect(saved.inputs).toContainEqual({ kind: "CHOICE", targetBlockId: "passage-safe" });
    expect(saved.faults).toContainEqual(
      expect.objectContaining({ family: "NETWORK", code: "OFFLINE", beforeInput: 0 }),
    );
    expect(saved.assertions).toContainEqual({ kind: "PROVIDER_REQUESTED" });
    expect(saved.tags).toContain("required:BASELINE_SUCCESS");
  });

  it("renders a designed error when a Sea Trials endpoint returns HTML", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(response("<!DOCTYPE html><html>Framework error</html>", 500, "text/html")),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<DrydockScenarioLab taleId="tale-1" csrfToken="csrf-1" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sea Trials could not load because the server returned an unexpected response.");
    expect(alert).not.toHaveTextContent("Unexpected token");
    expect(alert).not.toHaveTextContent("<!DOCTYPE");
  });
});
