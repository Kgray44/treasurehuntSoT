import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WakebookTideglassComparisonEntry } from "./WakebookVoyageDetail";

describe("WakebookTideglassComparisonEntry", () => {
  it("renders the Tideglass-owned exact history handoff only when the server resolved it", () => {
    render(
      <WakebookTideglassComparisonEntry
        comparison={{
          href: "/chronicles/synthetic-chronicle/compare?from=played&to=recommended&historyRecord=record-owned",
          state: "COMPARE",
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "See what changed" })).toHaveAttribute(
      "href",
      "/chronicles/synthetic-chronicle/compare?from=played&to=recommended&historyRecord=record-owned",
    );
  });

  it("does not render a dead comparison control when no authorized target exists", () => {
    const { container } = render(<WakebookTideglassComparisonEntry />);
    expect(container).toBeEmptyDOMElement();
  });
});
