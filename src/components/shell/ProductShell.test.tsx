import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductShell } from "./ProductShell";

const navigation = vi.hoisted(() => ({ pathname: "/tales" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

describe("ProductShell", () => {
  afterEach(() => {
    cleanup();
    navigation.pathname = "/tales";
  });

  it("identifies the current route and exposes a skip target", () => {
    render(
      <ProductShell>
        <main>Catalog content</main>
      </ProductShell>,
    );

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    const navigationRegion = screen.getByRole("navigation", { name: "Tall Tale Harbor navigation" });
    expect(within(navigationRegion).getByRole("link", { name: "Explore Tall Tales" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Catalog content")).toBeInTheDocument();
  });

  it("moves focus into the menu and restores it on Escape", async () => {
    render(
      <ProductShell>
        <main>Catalog content</main>
      </ProductShell>,
    );

    const menuButton = screen.getByRole("button", { name: /Menu/ });
    const navigationRegion = screen.getByRole("navigation", { name: "Tall Tale Harbor navigation" });
    fireEvent.click(menuButton);
    await waitFor(() =>
      expect(within(navigationRegion).getByRole("link", { name: "Explore Tall Tales" })).toHaveFocus(),
    );

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves the canonical journal route immersive", () => {
    navigation.pathname = "/player/playthroughs/playthrough-1/journal";
    render(
      <ProductShell>
        <main>Immersive journal</main>
      </ProductShell>,
    );

    expect(screen.getByText("Immersive journal")).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
