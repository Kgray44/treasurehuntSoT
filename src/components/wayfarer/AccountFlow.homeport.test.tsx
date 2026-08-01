import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENT_USER_CONTEXT_VERSION, type AuthenticatedCurrentUser } from "@/homeport/current-user";
import { AccountFlow } from "./AccountFlow";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const currentUser = vi.hoisted(() => ({
  state: { status: "anonymous", authenticated: false } as unknown,
  invalidate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/components/auth/CurrentUserProvider", () => ({ useCurrentUser: () => currentUser }));

const authenticated: AuthenticatedCurrentUser = {
  contextVersion: CURRENT_USER_CONTEXT_VERSION,
  status: "authenticated",
  authenticated: true,
  user: { accountId: "account-1", profileId: "profile-1", displayName: "Mara", initials: "M" },
  capabilities: {
    canUsePlayer: true,
    canUseCaptain: false,
    canUseCreator: false,
    canModerate: false,
    isAdministrator: false,
  },
  workspaces: ["public", "account", "community", "player"],
  session: { id: "session-1", expiresAt: "2030-01-01T00:00:00.000Z" },
  csrfToken: "csrf",
  revision: "revision-1",
};

describe("Homeport account lifecycle", () => {
  afterEach(() => {
    cleanup();
    history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    currentUser.state = { status: "anonymous", authenticated: false };
  });

  it("homeport.signin.lifecycle-links exposes account creation and recovery", () => {
    render(<AccountFlow mode="sign-in" />);
    expect(screen.getByRole("link", { name: "Create Account" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Forgot Password" })).toHaveAttribute("href", "/forgot-password");
  });

  it("homeport.registration.reachable keeps canonical sign-in adjacent to registration", () => {
    render(<AccountFlow mode="register" />);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Already have an account/i })).toHaveAttribute("href", "/sign-in");
  });

  it("homeport.registration.success-destination refreshes server context before the intended destination", async () => {
    currentUser.invalidate.mockResolvedValue(authenticated);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ ok: true, csrfToken: "csrf", next: "/player/library" }) }),
    );
    render(<AccountFlow mode="register" />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Mara" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mara@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "safe-development-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "safe-development-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(currentUser.invalidate).toHaveBeenCalledOnce());
    expect(navigation.replace).toHaveBeenCalledWith("/player/library");
    expect(currentUser.invalidate.mock.invocationCallOrder[0]).toBeLessThan(
      navigation.replace.mock.invocationCallOrder[0],
    );
  });
});
