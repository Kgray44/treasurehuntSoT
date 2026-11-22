import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const motion = vi.hoisted(() => ({ mode: "reduced" as "full" | "gentle" | "reduced" }));

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: motion.mode }),
}));

import { StudioExchangeConsole } from "./StudioExchangeConsole";

describe("Studio Exchange Console", () => {
  afterEach(() => {
    cleanup();
    motion.mode = "reduced";
  });

  it("does not fabricate a successful package or install receipt", () => {
    render(<StudioExchangeConsole authenticated />);
    expect(screen.getByTestId("studio-community-exchange")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Preview sandbox (no changes)" }));
    fireEvent.click(screen.getByRole("button", { name: "Open preview sandbox" }));
    expect(screen.getByText("Preview sandbox opened without installing content.")).toBeInTheDocument();
    expect(screen.getByText("Reduced motion is on. A static poster is shown.")).toBeInTheDocument();
  });

  it("derives preview controls from the effective motion policy", () => {
    motion.mode = "full";
    render(<StudioExchangeConsole authenticated />);

    expect(screen.getByRole("status")).toHaveTextContent("3D preview rotation 0 degrees");
    expect(screen.getByRole("button", { name: "Rotate right" })).toBeEnabled();
  });
});
