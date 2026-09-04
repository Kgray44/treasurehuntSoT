import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResilientAudio, ResilientImage, ResilientVideo } from "./ResilientImage";

describe("resilient media", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("replaces a failed image without leaving a broken image control", () => {
    render(<ResilientImage src="/missing.png" alt="Chart" fallbackLabel="Chart unavailable" />);
    fireEvent.error(screen.getByRole("img", { name: "Chart" }));
    expect(screen.queryByRole("img", { name: "Chart" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Chart unavailable/ })).toBeInTheDocument();
  });

  it("keeps successful, delayed, and failed image states explicit", () => {
    vi.useFakeTimers();
    render(<ResilientImage src="/slow-chart.png" alt="Chart" fallbackLabel="Chart artwork" />);
    const image = screen.getByRole("img", { name: "Chart" });
    expect(image).toHaveAttribute("data-resilient-image", "loading");

    act(() => vi.advanceTimersByTime(1_400));
    expect(image).toHaveAttribute("data-resilient-image", "slow");
    expect(screen.getByRole("status")).toHaveTextContent("Loading chart artwork");

    fireEvent.load(image);
    expect(image).toHaveAttribute("data-resilient-image", "ready");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("provides truthful fallbacks for missing video and audio", () => {
    render(
      <>
        <ResilientVideo src={null} fallbackLabel="Voyage video unavailable" />
        <ResilientAudio src={undefined} fallbackLabel="Captain audio unavailable" />
      </>,
    );
    expect(screen.getByRole("img", { name: /Voyage video unavailable/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Captain audio unavailable/ })).toBeInTheDocument();
  });
});
