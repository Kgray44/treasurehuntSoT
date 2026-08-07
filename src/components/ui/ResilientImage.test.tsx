import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResilientAudio, ResilientImage, ResilientVideo } from "./ResilientImage";

describe("resilient media", () => {
  afterEach(cleanup);

  it("replaces a failed image without leaving a broken image control", () => {
    render(<ResilientImage src="/missing.png" alt="Chart" fallbackLabel="Chart unavailable" />);
    fireEvent.error(screen.getByRole("img", { name: "Chart" }));
    expect(screen.queryByRole("img", { name: "Chart" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Chart unavailable/ })).toBeInTheDocument();
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
