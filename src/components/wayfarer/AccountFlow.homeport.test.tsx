import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountFlow } from "./AccountFlow";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const currentUser = vi.hoisted(() => ({
  state: { status: "anonymous", authenticated: false } as unknown,
  invalidate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/components/auth/CurrentUserProvider", () => ({ useCurrentUser: () => currentUser }));

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
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Account" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Forgot Password" })).toHaveAttribute("href", "/forgot-password");
  });

  it("homeport.registration.reachable keeps canonical sign-in adjacent to registration", () => {
    render(<AccountFlow mode="register" />);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Already have an account/i })).toHaveAttribute("href", "/sign-in");
  });

  it("homeport.owner-correction.round3.registration-verification-screen establishes only the bounded verification flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          verificationRequired: true,
          csrfToken: "verification-csrf",
          next: "/verify-email?returnTo=%2Fplayer%2Flibrary",
        }),
      }),
    );
    render(<AccountFlow mode="register" />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Mara" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mara@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "safe-development-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "safe-development-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/verify-email?returnTo=%2Fplayer%2Flibrary"));
    expect(currentUser.invalidate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("wayfarer-csrf")).toBe("verification-csrf");
  });

  it("homeport.owner-correction.round3.change-registration-email replaces the destination and prior challenge", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, maskedEmail: "n••••••@example.test", cooldownSeconds: 60 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountFlow mode="verify" initialCsrf="verification-csrf" maskedEmail="o•••••@example.test" />);
    expect(screen.getByText(/o•••••@example\.test/iu)).toBeVisible();
    expect(screen.getByLabelText("Code")).toHaveAttribute("inputmode", "numeric");
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("New registration email"), { target: { value: "next@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code to new email" }));
    await waitFor(() => expect(screen.getByText(/n••••••@example\.test/iu)).toBeVisible());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/email/verification/change", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "verification-csrf" },
      body: JSON.stringify({ email: "next@example.test" }),
    });
    expect(screen.getByRole("button", { name: "Resend available in 60s" })).toBeDisabled();
  });
});
