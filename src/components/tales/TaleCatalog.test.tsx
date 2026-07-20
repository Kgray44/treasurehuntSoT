import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaleCatalog } from "./TaleCatalog";

const tales = [
  {
    id: "lantern",
    slug: "lantern-test",
    title: "The Lantern Test",
    subtitle: "A moonlit mystery",
    shortDescription: "Follow a borrowed light.",
    coverUrl: null,
    estimatedDuration: 45,
    playerCountMin: 2,
    playerCountMax: 4,
    version: "1.0",
    playerState: "IN_PROGRESS",
    sessionId: "session-1",
  },
  {
    id: "harbor",
    slug: "harbor-homecoming",
    title: "Harbor Homecoming",
    subtitle: "A celebration story",
    shortDescription: "Gather one crew for a joyful return.",
    coverUrl: null,
    estimatedDuration: 90,
    playerCountMin: 1,
    playerCountMax: 6,
    version: "2.0",
    playerState: "NEW",
    sessionId: null,
  },
];

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("TaleCatalog", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("filters published tales with real search and progress controls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ tales })));
    render(<TaleCatalog />);

    expect(await screen.findByRole("heading", { name: "The Lantern Test" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Harbor Homecoming" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "celebration" } });
    expect(screen.queryByRole("heading", { name: "The Lantern Test" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Harbor Homecoming" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Progress"), { target: { value: "IN_PROGRESS" } });
    expect(screen.getByRole("heading", { name: "No Chronicles match these filters" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(screen.getByRole("heading", { name: "The Lantern Test" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue Voyage" })).toHaveAttribute(
      "href",
      "/play/lantern-test/session/session-1",
    );
  });

  it("offers recovery after a connection failure", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(jsonResponse({ tales: [tales[0]] }));
    vi.stubGlobal("fetch", fetch);
    render(<TaleCatalog />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be reached");
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "The Lantern Test" })).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
