import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RoleEntryAdapter } from "@/components/auth/RoleEntryAdapter";
import { PassportHome } from "@/components/homeport/PassportSurfaces";
import { AdmiraltyWatchPanel } from "@/components/admiralty/AdmiraltyConsole";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps the real staff contextual entrance on the canonical account sign-in path", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(
    <RoleEntryAdapter
      title="Enter the Captain workspace"
      description="Continue with your account."
      signInHref="/sign-in?returnTo=%2Fcaptain%2Flibrary"
    >
      <p>Captain capability is checked before entry.</p>
    </RoleEntryAdapter>,
  );
  expect(screen.getByRole("heading", { name: "Enter the Captain workspace" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Continue to account sign-in" })).toHaveAttribute(
    "href",
    "/sign-in?returnTo=%2Fcaptain%2Flibrary",
  );
  expect(screen.getByRole("link", { name: "Create Account" })).toHaveAttribute("href", "/register");
  expect(screen.getByRole("link", { name: "Forgot Password" })).toHaveAttribute("href", "/forgot-password");
  expect(screen.getByText("Captain capability is checked before entry.")).toBeVisible();
  expect(screen.queryByLabelText(/password/i)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it("renders the private Passport overview's actual counts and empty records through its current controller", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      sections: [
        {
          id: "history",
          label: "Chronicle History",
          href: "/passport/history",
          count: 2,
          empty: "No history yet.",
        },
        {
          id: "memories",
          label: "Memories",
          href: "/passport/memories",
          count: 0,
          empty: "No private Memories yet.",
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<PassportHome />);
  expect(await screen.findByRole("heading", { name: "A record you can return to" })).toBeVisible();
  const history = screen.getByRole("heading", { name: "Chronicle History" }).closest("a")!;
  expect(history).toHaveAttribute("href", "/passport/history");
  expect(within(history).getByText("2")).toBeVisible();
  const memories = screen.getByRole("heading", { name: "Memories" }).closest("a")!;
  expect(memories).toHaveAttribute("href", "/passport/memories");
  expect(within(memories).getByText("0")).toBeVisible();
  expect(within(memories).getByText("No private Memories yet.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Edit public Profile" })).toHaveAttribute(
    "href",
    "/account/profile",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]).toMatchObject(["/api/passport/overview", { cache: "no-store" }]);
  expect(document.querySelector("form")).toBeNull();
});

it("shows only the authorized operator watch projection without mounting private-resource commands", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(
    <AdmiraltyWatchPanel
      watch={{
        displayName: "Synthetic operator",
        roles: ["ADMINISTRATOR"],
        sessionExpires: "21 October, 18:00",
        recentAssurance: false,
        activeGrantCount: 0,
        pendingRequestCount: 1,
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Your watch" })).toBeVisible();
  expect(screen.getByText("Synthetic operator")).toBeVisible();
  expect(screen.getByText("ADMINISTRATOR")).toBeVisible();
  expect(screen.getByText("21 October, 18:00")).toBeVisible();
  expect(screen.getByText("0 active · 1 pending")).toBeVisible();
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
