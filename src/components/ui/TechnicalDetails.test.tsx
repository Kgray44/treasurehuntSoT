import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechnicalDetails } from "./TechnicalDetails";

describe("TechnicalDetails", () => {
  it("keeps precise support data available without placing it in the primary hierarchy", () => {
    render(
      <TechnicalDetails summary="Show source reference" description="Use this identifier when contacting support.">
        <code>source-identifier-123</code>
      </TechnicalDetails>,
    );

    expect(screen.getByText("Show source reference").closest("details")).toHaveAttribute(
      "data-information-level",
      "technical",
    );
    expect(screen.getByText("Show source reference").closest("details")).toHaveAttribute(
      "data-responsive-recomposition",
      "SUMMARY_TO_DETAIL",
    );
    expect(screen.getByText("Show source reference").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("source-identifier-123")).toBeInTheDocument();
  });
});
