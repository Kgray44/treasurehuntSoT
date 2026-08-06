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
    expect(screen.getByRole("link", { name: "Forgot Password" })).toHaveAttribute("href", "/forgot-password");
  });

  it("homeport.owner-correction.round3.patch-a recovery returns to ordinary sign-in", () => {
    render(<AccountFlow mode="forgot" />);
    expect(screen.getByRole("link", { name: "Return to Sign In" })).toHaveAttribute("href", "/sign-in");
  });

  it("homeport.owner-correction.round3.patch-a.password-feedback is live, accessible, and quiet before confirmation typing", () => {
    render(<AccountFlow mode="register" />);
    expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuetext", "Too weak");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "harbor-quiet-42-wind" } });
    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuetext", "Good");
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "harbor-quiet" } });
    expect(screen.getByText("Passwords do not match.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "harbor-quiet-42-wind" } });
    expect(screen.getByText("Passwords match.")).toBeVisible();
  });

  it("homeport.owner-correction.round3.patch-a.display-conflict stays in registration with values and focus preserved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "That display name is already in use.",
          conflict: "DISPLAY_NAME_CONFLICT",
          field: "displayName",
        }),
      }),
    );
    render(<AccountFlow mode="register" />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Mara Tide" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "harbor-quiet-42-wind" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "harbor-quiet-42-wind" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByLabelText("Display name")).toHaveFocus());
    expect(screen.getByText("That display name is already in use.")).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveValue("new@example.test");
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round3.patch-a.email-conflict hands off to prefilled sign-in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "An account already uses this email address. Sign in instead.",
          conflict: "EMAIL_CONFLICT",
          field: "email",
          handoff: { email: "returning@example.test" },
        }),
      }),
    );
    render(<AccountFlow mode="register" query={{ returnTo: "/player/library" }} />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Returning Sailor" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "returning@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "harbor-quiet-42-wind" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "harbor-quiet-42-wind" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/sign-in?email=returning%40example.test&reason=account-exists&returnTo=%2Fplayer%2Flibrary",
      ),
    );
  });

  it("homeport.owner-correction.round3.patch-a.sign-in-prefill keeps recovery adjacent", () => {
    render(<AccountFlow mode="sign-in" query={{ email: "returning@example.test", reason: "account-exists" }} />);
    expect(screen.getByLabelText("Email or legacy Player name")).toHaveValue("returning@example.test");
    expect(screen.getByText("An account already uses this email address. Sign in instead.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Forgot Password" })).toBeVisible();
  });

  it("homeport.owner-correction.round3.patch-a.delivery-failure exposes recovery without denying account creation", () => {
    render(<AccountFlow mode="verify" query={{ delivery: "failed" }} initialCsrf="csrf" />);
    expect(screen.getByText("Your account was created, but we could not send the verification email.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry sending" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Change email" })).toBeVisible();
    expect(screen.getByRole("link", { name: "sign in instead" })).toHaveAttribute("href", "/sign-in");
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
