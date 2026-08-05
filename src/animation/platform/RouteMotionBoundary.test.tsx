import { render, waitFor } from "@testing-library/react";
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
});
