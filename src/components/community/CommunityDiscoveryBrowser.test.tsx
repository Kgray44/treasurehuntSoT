import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/components/auth/CurrentUserProvider", () => ({
  useCurrentUser: () => ({ state: { status: "anonymous", authenticated: false } }),
}));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced" }),
}));

import { CommunityDiscoveryBrowser } from "./CommunityDiscoveryBrowser";

const publicCard = {
  id: "listing-1",
  variant: "CHRONICLE" as const,
  itemType: "CHRONICLE",
  contentType: "Chronicle",
  destination: "/community/public-chart",
  artwork: {
    kind: "GOVERNED_FALLBACK" as const,
    state: "MISSING" as const,
    motif: "CHRONICLE" as const,
    label: "Chronicle artwork unavailable",
  },
  imageState: "FALLBACK" as const,
  title: "Public chart",
  summary: "Safe summary",
  creator: {
    id: "creator-1",
    handle: "captain",
    displayName: "Captain Rowan",
    destination: "/community/creators/captain",
  },
  updatedAt: "2026-08-03T00:00:00.000Z",
  primaryAction: { label: "View details", href: "/community/public-chart" },
};

describe("CommunityDiscoveryBrowser", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/community");
  });

  it("keeps the default Harbor content-first and starts search through a human URL", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("The Harbor shelves below are ready to browse without a search.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search public Community Harbor" }), {
      target: { value: "coast" },
    });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenLastCalledWith("/community?q=coast", { scroll: false });
  });

  it("loads allowlisted cards for active criteria and preserves individual URL parameters", async () => {
    window.history.replaceState({}, "", "/community?q=coast&sort=NEWEST&type=CHRONICLE");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [publicCard] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);

    expect(screen.getByRole("status")).toHaveAttribute("data-async-state", "pending-delay");
    expect(await screen.findByRole("heading", { name: "Public chart" })).toBeInTheDocument();
    expect(screen.getByText("Captain Rowan")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/community/discover?q=coast&sort=NEWEST&type=CHRONICLE",
      expect.objectContaining({ cache: "no-store" }),
    );

    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "UNDER_60" } });
    expect(push).toHaveBeenLastCalledWith("/community?q=coast&sort=NEWEST&type=CHRONICLE&duration=UNDER_60", {
      scroll: false,
    });
  });

  it("distinguishes no matches from the default shelves and clears all discovery state", async () => {
    window.history.replaceState({}, "", "/community?q=lost&type=MAP&free=1");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);

    expect(await screen.findByRole("heading", { name: "No public charts match these criteria" })).toBeInTheDocument();
    expect(
      screen.queryByText("The Harbor shelves below are ready to browse without a search."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search and filters" })[0]);
    expect(push).toHaveBeenCalledWith("/community", { scroll: false });
  });

  it("announces a safe failure and retries the unchanged request", async () => {
    window.history.replaceState({}, "", "/community?q=coast");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Please try again shortly." }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<CommunityDiscoveryBrowser />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again shortly.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const heading = await screen.findByRole("heading", { name: "No public charts match these criteria" });
    expect(heading).toBeInTheDocument();
    await waitFor(() => expect(heading.closest("section")).toHaveFocus());
  });

  it("writes advanced and repeated filters as readable parameters", () => {
    window.history.replaceState({}, "", "/community?q=coast");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 })));
    render(<CommunityDiscoveryBrowser />);

    fireEvent.click(screen.getByLabelText("Chronicles"));
    expect(push).toHaveBeenLastCalledWith("/community?q=coast&type=CHRONICLE", { scroll: false });
    fireEvent.click(screen.getByLabelText("Free content only"));
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "mystery" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply advanced filters" }));
    expect(push).toHaveBeenLastCalledWith("/community?q=coast&theme=mystery&free=1", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Reset advanced filters" }));
    expect(push).toHaveBeenLastCalledWith("/community?q=coast", { scroll: false });
    expect(screen.getByText(/Advanced filters/u, { selector: "summary" })).toHaveFocus();
  });
});
