import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductShell } from "./ProductShell";

const navigation = vi.hoisted(() => ({ pathname: "/tales" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/app/actions/sign-out", () => ({ signOutFromShell: vi.fn() }));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced" }),
}));

describe("ProductShell", () => {
  afterEach(() => {
    cleanup();
    navigation.pathname = "/tales";
    vi.unstubAllGlobals();
  });

  it("identifies the current route and exposes a skip target", () => {
    render(
      <ProductShell>
        <main>Catalog content</main>
      </ProductShell>,
    );

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    const navigationRegion = screen.getByRole("navigation", { name: "Voyagewright navigation" });
    expect(within(navigationRegion).getByRole("link", { name: "Explore Chronicles" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Catalog content")).toBeInTheDocument();
    expect(navigationRegion.querySelectorAll(".product-navigation-active-plate")).toHaveLength(1);
  });

  it("moves focus into the menu and restores it on Escape", async () => {
    render(
      <ProductShell>
        <main>Catalog content</main>
      </ProductShell>,
    );

    const menuButton = screen.getByRole("button", { name: /Menu/ });
    const navigationRegion = screen.getByRole("navigation", { name: "Voyagewright navigation" });
    fireEvent.click(menuButton);
    await waitFor(() =>
      expect(within(navigationRegion).getByRole("link", { name: "Explore Chronicles" })).toHaveFocus(),
    );

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("uses a reduced Player shell for an active Chronicle without Captain or Creator destinations", () => {
    navigation.pathname = "/player/playthroughs/playthrough-1/journal";
    render(
      <ProductShell>
        <main>Immersive journal</main>
      </ProductShell>,
    );

    expect(screen.getByText("Immersive journal")).toBeInTheDocument();
    const navigationRegion = screen.getByRole("navigation", { name: "Voyagewright Player navigation" });
    expect(within(navigationRegion).getByRole("link", { name: "My Voyages" })).toBeInTheDocument();
    expect(within(navigationRegion).queryByRole("link", { name: /Captain/i })).not.toBeInTheDocument();
    expect(within(navigationRegion).queryByRole("link", { name: /Studio/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account/ })).toBeInTheDocument();
  });

  it("keeps account pages out of the public workspace and exposes the profile menu for a signed-in identity", async () => {
    navigation.pathname = "/account/security";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          authenticated: true,
          canUsePlayer: true,
          canUseCaptain: true,
          canUseCreator: true,
          isAdministrator: false,
          profile: { displayName: "Mara Tide", initials: "MT", handle: "mara" },
        }),
      }),
    );
    render(
      <ProductShell>
        <main>Security content</main>
      </ProductShell>,
    );

    await waitFor(() => expect(screen.getByRole("navigation", { name: "Account navigation" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: /Mara Tide/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Mara Tide/ }));
    expect(screen.getByRole("link", { name: "Captain workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Creator workspace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("hands route focus to the destination heading exactly once", async () => {
    const view = render(
      <ProductShell>
        <main>
          <h1>Catalog</h1>
        </main>
      </ProductShell>,
    );
    expect(screen.getByRole("heading", { name: "Catalog" })).not.toHaveFocus();

    navigation.pathname = "/player/library";
    view.rerender(
      <ProductShell>
        <main>
          <h1>My Library</h1>
        </main>
      </ProductShell>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "My Library" })).toHaveFocus());
    expect(screen.getByRole("heading", { name: "My Library" })).toHaveAttribute("tabindex", "-1");
  });
});
