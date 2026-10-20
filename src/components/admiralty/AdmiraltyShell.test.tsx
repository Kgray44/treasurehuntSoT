// @sounding-line-registration owner=project-admiralty suite=component.admiralty contracts=admiralty.phase2.responsive-accessibility
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdmiraltyShell } from "./AdmiraltyShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/components/auth/SignOutButton", () => ({ SignOutButton: () => <button>Sign out</button> }));

describe("AdmiraltyShell operator context", () => {
  afterEach(cleanup);

  it("exposes the current operator and assigned roles as one named noninteractive group", () => {
    render(
      <AdmiraltyShell
        operator={{
          accountId: "synthetic-operator",
          accountSessionId: "synthetic-session",
          displayName: "Synthetic operator",
          roles: ["ADMINISTRATOR"],
          capabilities: ["PLATFORM_OBSERVE"],
          csrfToken: "synthetic-csrf",
          sessionExpiresAt: new Date("2026-10-20T00:00:00.000Z"),
          authorizationBasis: "synthetic-canonical-fixture",
        }}
      >
        <h1>Platform Overview</h1>
      </AdmiraltyShell>,
    );
    const operator = screen.getByRole("group", { name: "Synthetic operator" });
    expect(operator).toHaveTextContent("Synthetic operator");
    expect(operator).toHaveTextContent("ADMINISTRATOR");
    expect(within(operator).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Admiralty controls" })).toContainElement(operator);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to account" })).toHaveAttribute("href", "/account");
  });
});
