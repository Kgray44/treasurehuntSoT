import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { StudioExchangeConsole } from "./StudioExchangeConsole";

describe("Studio Exchange Console", () => {
  afterEach(cleanup);

  it("does not fabricate a successful package or install receipt", () => {
    render(<StudioExchangeConsole authenticated />);
    expect(screen.getByTestId("studio-community-exchange")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Preview sandbox (no changes)" }));
    fireEvent.click(screen.getByRole("button", { name: "Open preview sandbox" }));
    expect(screen.getByText("Preview sandbox opened without installing content.")).toBeInTheDocument();
    expect(screen.getByText("Reduced motion is on. A static poster is shown.")).toBeInTheDocument();
  });
});
