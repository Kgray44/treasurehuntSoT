import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorState, LoadingState, StatusBanner } from "./AsyncState";

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced" }),
}));

describe("shared asynchronous state motion", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("moves from pending to a bounded slow state without changing the skeleton shape", () => {
    vi.useFakeTimers();
    const view = render(<LoadingState title="Opening the chart" detail="Loading authoritative state." />);
    const state = screen.getByRole("status");
    const skeletonCount = view.container.querySelectorAll(".ui-skeleton-lines i").length;
    expect(state).toHaveAttribute("data-async-state", "pending");

    act(() => vi.advanceTimersByTime(901));

    expect(state).toHaveAttribute("data-async-state", "slow");
    expect(state).toHaveTextContent("This is taking longer than expected.");
    expect(view.container.querySelectorAll(".ui-skeleton-lines i")).toHaveLength(skeletonCount);
  });

  it("distinguishes terminal errors and focuses their heading", async () => {
    render(<ErrorState title="Invitation revoked" detail="Ask the Captain for a replacement." terminal />);
    const alert = screen.getByRole("alert");
    const heading = screen.getByRole("heading", { name: "Invitation revoked" });
    expect(alert).toHaveAttribute("data-async-state", "terminal-error");
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("labels success only on the success banner state", () => {
    render(<StatusBanner tone="success">Saved by the server.</StatusBanner>);
    expect(screen.getByRole("status")).toHaveAttribute("data-async-state", "success");
  });
});
