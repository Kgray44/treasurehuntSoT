import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { CommunityDiscoveryBrowser } from "./CommunityDiscoveryBrowser";

describe("CommunityDiscoveryBrowser", () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/community");
  });

  it("loads persisted discovery results and writes q and sort to the URL", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "listing-1",
              itemType: "CHRONICLE",
              title: "Public chart",
              safeSummary: "Safe summary",
              creatorHandle: "captain",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading public");
    expect(await screen.findByRole("heading", { name: "Public chart" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search public Community Harbor"), { target: { value: "coast" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(replace).toHaveBeenLastCalledWith("/community?q=coast", { scroll: false });
    fireEvent.change(screen.getByLabelText("Sort results"), { target: { value: "NEWEST" } });
    expect(replace).toHaveBeenLastCalledWith("/community?sort=NEWEST", { scroll: false });
    expect(fetch).toHaveBeenCalledWith("/api/community/discover?sort=FEATURED", expect.anything());
  });

  it("provides clear and retry controls for empty and failed requests", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Try again" }), { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);
    expect(await screen.findByText("No public charts matched this search")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(replace).toHaveBeenCalledWith("/community?sort=FEATURED", { scroll: false });
  });

  it("serializes visible filters into the governed discovery request and URL", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);
    await screen.findByText("No public charts matched this search");
    fireEvent.click(screen.getByLabelText("Chronicle"));
    expect(replace).toHaveBeenLastCalledWith(
      "/community?filters=%7B%22itemTypes%22%3A%5B%22CHRONICLE%22%5D%7D",
      { scroll: false },
    );
    fireEvent.click(screen.getByLabelText("Free content only"));
    expect(replace).toHaveBeenLastCalledWith(
      "/community?filters=%7B%22freeOnly%22%3Atrue%7D",
      { scroll: false },
    );
  });

  it("announces failures and retries without exposing an implementation detail", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Try again" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    fireEvent.click(screen.getByRole("button", { name: "Retry discovery" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
