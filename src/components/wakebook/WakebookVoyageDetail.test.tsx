import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { WakebookLanternwakeReplayEntry, WakebookTideglassComparisonEntry } from "./WakebookVoyageDetail";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

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

describe("WakebookLanternwakeReplayEntry", () => {
  it("uses the Passport-owned replay handoff rather than exposing a source playthrough identifier", () => {
    render(<WakebookLanternwakeReplayEntry recordId="record-owned" />);

    expect(screen.getByRole("link", { name: "Replay this Journey" })).toHaveAttribute(
      "href",
      "/passport/history/record-owned/replay",
    );
  });
});
