import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteMotionBoundary } from "./RouteMotionBoundary";

vi.mock("../motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "full" }),
}));

describe("RouteMotionBoundary", () => {
  it("replaces the previous route layer atomically when the pathname changes", () => {
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

    expect(view.container.querySelectorAll(".product-route-layer")).toHaveLength(1);
    expect(view.container.querySelector('[data-route-layer="/studio/library"]')).toBeNull();
    expect(view.container.querySelector('[data-route-layer="/studio/tales/example"]')).toHaveTextContent(
      "Chronicle Editor",
    );
  });
});
