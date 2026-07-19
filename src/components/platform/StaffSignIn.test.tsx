import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffSignIn } from "./StaffSignIn";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

function response(status: number, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function submitCaptainSignIn() {
  render(<StaffSignIn intent="captain" authorized={false} signedIn={false} />);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "kato" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "development-captain-only" } });
  fireEvent.click(screen.getByRole("button", { name: "Enter Captain's Command" }));
}

describe("StaffSignIn", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("continues through the authoritative status check when a successful login response has no body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200, JSON.stringify({ captain: { authenticated: true } })));
    vi.stubGlobal("fetch", fetch);

    submitCaptainSignIn();

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/captain/library"));
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a recoverable error instead of throwing when a failed login response has no body", async () => {
    const fetch = vi.fn().mockResolvedValue(response(500));
    vi.stubGlobal("fetch", fetch);

    submitCaptainSignIn();

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed. Please try again.");
    expect(fetch).toHaveBeenCalledOnce();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("restores the form after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    submitCaptainSignIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Captain's Command could not be reached. Check that the app is running and try again.",
    );
    expect(screen.getByRole("button", { name: "Enter Captain's Command" })).toBeEnabled();
  });
});
