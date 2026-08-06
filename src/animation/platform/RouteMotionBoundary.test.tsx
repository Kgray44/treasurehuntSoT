import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteMotionBoundary } from "./RouteMotionBoundary";

const motionState = vi.hoisted(() => ({ mode: "full" as "full" | "reduced" }));

vi.mock("../motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: motionState.mode }),
}));

describe("RouteMotionBoundary", () => {
  it("settles to one destination layer and removes the exited route after the governed transition", async () => {
    const view = render(
      <RouteMotionBoundary pathname="/studio/library">
        <main>Chronicle Library</main>
      </RouteMotionBoundary>,
    );

    view.rerender(
      <RouteMotionBoundary pathname="/studio/tales/example">
        <main>Chronicle Editor</main>
      </RouteMotionBoundary>,
    );

    expect(view.container.querySelector('[data-route-layer="/studio/tales/example"]')).toHaveTextContent(
      "Chronicle Editor",
    );
    await waitFor(() => expect(view.container.querySelectorAll(".product-route-layer")).toHaveLength(1));
    expect(view.container.querySelector('[data-route-layer="/studio/library"]')).toBeNull();
  });

  it("renders one immediate destination layer when reduced motion is requested", () => {
    motionState.mode = "reduced";
    const view = render(
      <RouteMotionBoundary pathname="/account/roles">
        <main>All Workspaces</main>
      </RouteMotionBoundary>,
    );

    view.rerender(
      <RouteMotionBoundary pathname="/account/security">
        <main>Security</main>
      </RouteMotionBoundary>,
    );

    expect(view.container.querySelectorAll(".product-route-layer")).toHaveLength(1);
    expect(view.container.querySelector('[data-route-layer="/account/roles"]')).toBeNull();
    expect(view.container.querySelector('[data-route-layer="/account/security"]')).toHaveTextContent("Security");
    motionState.mode = "full";
  });

  it("moves focus after the ordinary destination has settled", async () => {
    const view = render(
      <RouteMotionBoundary pathname="/account">
        <main>
          <h1>Overview</h1>
        </main>
      </RouteMotionBoundary>,
    );

    view.rerender(
      <RouteMotionBoundary pathname="/account/profile">
        <main>
          <h1>Public Profile</h1>
        </main>
      </RouteMotionBoundary>,
    );
    await waitFor(() => expect(view.getByRole("heading", { name: "Public Profile" })).toHaveFocus());
    view.unmount();
  });

  it("retains an inert outgoing page through the delayed-loading threshold", () => {
    vi.useFakeTimers();
    const view = render(
      <RouteMotionBoundary pathname="/">
        <main>Gateway</main>
      </RouteMotionBoundary>,
    );

    view.rerender(
      <RouteMotionBoundary pathname="/community">
        <span data-async-state="pending-delay">Opening Community Harbor</span>
      </RouteMotionBoundary>,
    );

    const outgoing = view.container.querySelector('[data-route-layer="/"]');
    expect(outgoing).toHaveTextContent("Gateway");
    expect(outgoing).toHaveAttribute("data-route-interactive", "false");
    act(() => vi.advanceTimersByTime(499));
    expect(view.container.querySelector('[data-route-layer="/"]')).toBeInTheDocument();
    view.unmount();
    vi.useRealTimers();
  });

  it("adds a destination loading surface after 500ms when the destination has not prepared content", () => {
    vi.useFakeTimers();
    const stalledChildren = <main>Chronicle catalog</main>;
    const view = render(<RouteMotionBoundary pathname="/tales">{stalledChildren}</RouteMotionBoundary>);

    view.rerender(<RouteMotionBoundary pathname="/community">{stalledChildren}</RouteMotionBoundary>);

    act(() => vi.advanceTimersByTime(499));
    expect(view.container).not.toHaveTextContent("Opening Community Harbor");
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelector('[data-route-layer="/community"]')).toHaveTextContent(
      "Opening Community Harbor",
    );
    expect(view.container.querySelector('[data-route-layer="/tales"]')).toHaveAttribute(
      "data-route-interactive",
      "false",
    );
    view.unmount();
    vi.useRealTimers();
  });
});
