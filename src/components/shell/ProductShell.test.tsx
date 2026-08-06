import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductShell } from "./ProductShell";

const navigation = vi.hoisted(() => ({ pathname: "/tales" }));
const currentUser = vi.hoisted(() => ({
  state: { status: "anonymous", authenticated: false } as Record<string, unknown>,
  refresh: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/auth/CurrentUserProvider", () => ({ useCurrentUser: () => currentUser }));
vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));

function setAuthenticated() {
  currentUser.state = {
    status: "authenticated",
    authenticated: true,
    user: { displayName: "Mara Tide", initials: "MT", handle: "mara" },
    capabilities: {
      canUsePlayer: true,
      canUseCaptain: true,
      canUseCreator: true,
      canModerate: true,
      isAdministrator: false,
    },
    csrfToken: "csrf",
  };
}

describe("ProductShell", () => {
  afterEach(() => {
    cleanup();
    navigation.pathname = "/tales";
    currentUser.state = { status: "anonymous", authenticated: false };
    currentUser.refresh.mockReset();
    document.body.style.overflow = "";
    document.body.style.zoom = "";
    delete document.body.dataset.shellOverlay;
    vi.unstubAllGlobals();
  });

  it("homeport.shell.gateway-account-control keeps the cinematic gateway inside a prompt global/account frame", () => {
    navigation.pathname = "/";
    render(
      <ProductShell>
        <main>Gateway scene</main>
      </ProductShell>,
    );

    expect(document.querySelector(".product-shell")).toHaveAttribute("data-shell-mode", "GATEWAY_STANDARD");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    const global = screen.getByRole("navigation", { name: "Global navigation" });
    expect(within(global).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(global).getByRole("link", { name: "Explore Chronicles" })).toBeInTheDocument();
    expect(within(global).getByRole("link", { name: "Community Harbor" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Account" })).toHaveLength(1);
    expect(screen.getByText("Gateway scene")).toBeInTheDocument();
  });

  it("homeport.shell.gateway-anonymous-state exposes a coherent anonymous account group", async () => {
    navigation.pathname = "/";
    render(
      <ProductShell>
        <main>Gateway scene</main>
      </ProductShell>,
    );

    const trigger = screen.getByRole("button", { name: "Account" });
    fireEvent.click(trigger);
    const disclosure = screen.getByLabelText("Account navigation");
    await waitFor(() => expect(within(disclosure).getByRole("link", { name: "Create Account" })).toHaveFocus());
    expect(within(disclosure).getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/sign-in?returnTo=%2F");
    expect(within(disclosure).queryByText("Security & Sessions")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("homeport.shell.account-menu closes on an outside pointer interaction at desktop width", async () => {
    navigation.pathname = "/";
    render(
      <ProductShell>
        <main>Gateway scene</main>
      </ProductShell>,
    );

    const trigger = screen.getByRole("button", { name: "Account" });
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Account navigation")).toBeVisible();
    fireEvent.pointerDown(screen.getByText("Gateway scene"));
    await waitFor(() => expect(screen.getByLabelText("Account navigation")).not.toBeVisible());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("homeport.shell.account-menu groups identity, personal destinations, workspaces, and Sign Out", () => {
    navigation.pathname = "/player/library";
    setAuthenticated();
    render(
      <ProductShell>
        <main>Player library</main>
      </ProductShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mara Tide" }));
    const disclosure = screen.getByLabelText("Account navigation");
    expect(within(disclosure).getByRole("heading", { name: "Identity" })).toBeInTheDocument();
    expect(within(disclosure).getByRole("heading", { name: "Personal Harbor" })).toBeInTheDocument();
    expect(within(disclosure).getByRole("heading", { name: "Workspaces" })).toBeInTheDocument();
    expect(within(disclosure).getByRole("heading", { name: "Account actions" })).toBeInTheDocument();
    expect(within(disclosure).getByRole("link", { name: "View My Profile" })).toHaveAttribute(
      "href",
      "/account/profile/view",
    );
    expect(within(disclosure).getByRole("link", { name: "Chronicle Passport" })).toHaveAttribute("href", "/passport");
    expect(within(disclosure).getByRole("link", { name: "Preferences" })).toHaveAttribute(
      "href",
      "/account/preferences",
    );
    expect(within(disclosure).getByRole("link", { name: "Privacy & Safety" })).toHaveAttribute(
      "href",
      "/account/privacy",
    );
    expect(within(disclosure).getByRole("link", { name: "Chronicle History" })).toHaveAttribute(
      "href",
      "/passport/history",
    );
    expect(within(disclosure).getByRole("link", { name: "Artifact Cabinet" })).toHaveAttribute(
      "href",
      "/passport/artifacts",
    );
    expect(within(disclosure).getByRole("link", { name: "Security & Sessions" })).toHaveAttribute(
      "href",
      "/account/security",
    );
    expect(within(disclosure).getByRole("link", { name: /Player/ })).toHaveAttribute("aria-current", "page");
    expect(within(disclosure).getByRole("link", { name: "Captain" })).toBeInTheDocument();
    expect(within(disclosure).getByRole("link", { name: "Creator Studio" })).toBeInTheDocument();
    expect(within(disclosure).getByRole("link", { name: "Moderation" })).toBeInTheDocument();
    expect(within(disclosure).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(disclosure.textContent).not.toMatch(/@.*\.com|email/i);
  });

  it("homeport.shell.account-menu remains viewport-bounded under effective 200 percent zoom", async () => {
    navigation.pathname = "/player/library";
    setAuthenticated();
    document.body.style.zoom = "2";
    vi.stubGlobal("innerHeight", 900);
    render(
      <ProductShell>
        <main>Player library</main>
      </ProductShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mara Tide" }));
    const disclosure = screen.getByLabelText("Account navigation");
    await waitFor(() => expect(disclosure.style.maxHeight).toBe("442px"));
    expect(disclosure).toHaveClass("shell-account-disclosure");
  });

  it("homeport.shell.account-loading reserves truthful account geometry without anonymous actions", () => {
    navigation.pathname = "/player/library";
    currentUser.state = { status: "loading", authenticated: false };
    render(
      <ProductShell>
        <main>Server-owned route result</main>
      </ProductShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Checking account" }));
    expect(screen.getByRole("status")).toHaveTextContent("Checking your account");
    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Voyages" })).not.toBeInTheDocument();
  });

  it("homeport.shell.context-unavailable shows deliberate retry and no anonymous misrepresentation", () => {
    navigation.pathname = "/";
    currentUser.state = { status: "unavailable", authenticated: false, retryable: true };
    currentUser.refresh.mockResolvedValue({ status: "anonymous", authenticated: false });
    render(
      <ProductShell>
        <main>Gateway</main>
      </ProductShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Account unavailable" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No identity or workspace permission was assumed");
    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry account check" }));
    expect(currentUser.refresh).toHaveBeenCalledTimes(1);
  });

  it("homeport.shell.mobile-parity moves focus into the shared navigation drawer and restores it", async () => {
    render(
      <ProductShell>
        <main>Catalog content</main>
      </ProductShell>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    const global = screen.getByRole("navigation", { name: "Global navigation" });
    await waitFor(() => expect(within(global).getByRole("link", { name: "Home" })).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body).toHaveAttribute("data-shell-overlay", "open");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("homeport.shell.compact-exit identifies Captain context and provides a stable exit with account access", () => {
    navigation.pathname = "/captain/sessions/session-1";
    setAuthenticated();
    render(
      <ProductShell>
        <main>Captain session</main>
      </ProductShell>,
    );

    expect(document.querySelector(".product-shell")).toHaveAttribute("data-shell-mode", "COMPACT");
    expect(screen.getByRole("link", { name: "Exit to Captain Voyages" })).toHaveAttribute("href", "/captain/library");
    expect(screen.getByRole("button", { name: "Mara Tide" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Global navigation" })).not.toBeInTheDocument();
  });

  it("homeport.shell.immersive-exit preserves reduced Player framing without Captain or Studio chrome", () => {
    navigation.pathname = "/player/playthroughs/playthrough-1/journal";
    setAuthenticated();
    render(
      <ProductShell>
        <main>Immersive journal</main>
      </ProductShell>,
    );

    expect(document.querySelector(".product-shell")).toHaveAttribute("data-shell-mode", "IMMERSIVE");
    expect(screen.getByRole("link", { name: "Exit to My Voyages" })).toHaveAttribute("href", "/player/library");
    expect(screen.getByText("Immersive journal")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /Captain|Studio/u })).not.toBeInTheDocument();
  });

  it("homeport.shell.route-close closes overlays, restores scroll, and hands focus to the destination heading", async () => {
    const view = render(
      <ProductShell>
        <main>
          <h1>Catalog</h1>
        </main>
      </ProductShell>,
    );
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    navigation.pathname = "/community";
    view.rerender(
      <ProductShell>
        <main>
          <h1>Community Harbor</h1>
        </main>
      </ProductShell>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Community Harbor" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("heading", { name: "Community Harbor" })).toHaveAttribute("tabindex", "-1");
  });
});
