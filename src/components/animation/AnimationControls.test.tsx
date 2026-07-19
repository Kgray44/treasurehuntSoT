import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationControls } from "./AnimationControls";

const harness = vi.hoisted(() => ({
  snapshot: {
    isPlaying: true,
    isPaused: false,
    scene: "first-arrival" as "first-arrival" | "journal-open",
    label: "scene-start",
    progress: 0,
    speed: 1,
    mode: "full",
    phase: "opening",
    queueDepth: 0,
    error: null,
  },
  director: {
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    skip: vi.fn(),
    reverse: vi.fn(),
    cancel: vi.fn(),
    setSpeed: vi.fn(),
  },
}));

vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({ director: harness.director, snapshot: harness.snapshot }),
}));

describe("AnimationControls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    harness.snapshot.scene = "first-arrival";
  });

  it("maps available skip and interruption controls to typed director actions", () => {
    render(<AnimationControls mode="full" setMode={vi.fn()} />);

    const skip = screen.getByRole("button", { name: "Skip as user" });
    expect(skip).toBeEnabled();
    fireEvent.click(skip);
    expect(harness.director.skip).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));
    expect(harness.director.cancel).toHaveBeenCalledWith("development-control-interruption");
  });

  it("disables user skip when the active scene contract does not allow it", () => {
    harness.snapshot.scene = "journal-open";
    render(<AnimationControls mode="full" setMode={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Skip as user" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeEnabled();
  });
});
