import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccessDecisionState } from "./AccessDecisionState";

describe("AccessDecisionState", () => {
  afterEach(cleanup);

  it.each([
    [{ status: "auth-required" } as const, "Sign in required"],
    [{ status: "account-restricted", reason: "suspended" } as const, "Account access restricted"],
    [
      { status: "unavailable", correlationId: "synthetic-reference", retryable: true } as const,
      "Account service unavailable",
    ],
  ])("renders %s as a primary landmark and distinct alert", (decision, heading) => {
    render(<AccessDecisionState decision={decision} />);
    expect(screen.getByRole("main")).toHaveAttribute("data-access-state", decision.status);
    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
