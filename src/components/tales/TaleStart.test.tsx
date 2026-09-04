import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  state: {
    status: "anonymous",
    authenticated: false,
  } as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/auth/CurrentUserProvider", () => ({
  useCurrentUser: () => ({ state: mocks.state }),
}));

import { TaleStart } from "./TaleStart";

type TaleResponse = {
  slug: string;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  coverUrl: string | null;
  estimatedDuration: number | null;
  playerCountMin: number;
  playerCountMax: number;
  contentWarnings: string | null;
  version: string;
};

const tale: TaleResponse = {
  slug: "moonlit-map",
  title: "The Moonlit Map",
  subtitle: "A synthetic subtitle",
  shortDescription: "Follow the light.",
  longDescription: "A public preview-safe Chronicle description.",
  coverUrl: null,
  estimatedDuration: 60,
  playerCountMin: 1,
  playerCountMax: 4,
  contentWarnings: null,
  version: "1.0",
};

function installFetch(taleResponse: TaleResponse = tale) {
  const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url === "/api/tales/moonlit-map") return new Response(JSON.stringify({ tale: taleResponse }), { status: 200 });
    if (url === "/api/tales/moonlit-map/start" && options?.method === "POST")
      return new Response(JSON.stringify({ url: "/play/moonlit-map/session/session-1" }), { status: 201 });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("Project Homeport Chronicle start identity", () => {
  afterEach(() => {
    cleanup();
    mocks.push.mockReset();
    mocks.state = { status: "anonymous", authenticated: false };
    vi.unstubAllGlobals();
  });

  it("defaults a signed-in start to the canonical display name and submits the account CSRF boundary", async () => {
    mocks.state = {
      status: "authenticated",
      authenticated: true,
      user: { accountId: "account-1", displayName: "Canonical Navigator", initials: "CN" },
      csrfToken: "csrf-token",
    };
    const fetch = installFetch();
    render(<TaleStart taleSlug="moonlit-map" />);

    const input = await screen.findByLabelText("Player name for this Chronicle");
    await waitFor(() => expect(input).toHaveValue("Canonical Navigator"));
    expect(input).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Begin Voyage" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/play/moonlit-map/session/session-1"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/tales/moonlit-map/start",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": "csrf-token" },
        body: JSON.stringify({ ownerLabel: "Canonical Navigator", aliasEdited: false }),
      }),
    );
  });

  it("uses an explicit edit action for a Chronicle-specific alias and can restore the account name", async () => {
    mocks.state = {
      status: "authenticated",
      authenticated: true,
      user: { accountId: "account-1", displayName: "Canonical Navigator", initials: "CN" },
      csrfToken: "csrf-token",
    };
    const fetch = installFetch();
    render(<TaleStart taleSlug="moonlit-map" />);

    const input = await screen.findByLabelText("Player name for this Chronicle");
    fireEvent.click(screen.getByRole("button", { name: "Edit for this Chronicle" }));
    expect(input).not.toHaveAttribute("readonly");
    fireEvent.change(input, { target: { value: "Night Cartographer" } });
    fireEvent.click(screen.getByRole("button", { name: "Begin Voyage" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      "/api/tales/moonlit-map/start",
      expect.objectContaining({
        body: JSON.stringify({ ownerLabel: "Night Cartographer", aliasEdited: true }),
      }),
    );
  });

  it("keeps the anonymous guest name editable and does not invent a signed-in CSRF header", async () => {
    const fetch = installFetch();
    render(<TaleStart taleSlug="moonlit-map" />);

    const input = await screen.findByLabelText("Guest player name");
    expect(input).not.toHaveAttribute("readonly");
    expect(screen.getByText("Guests may choose an editable name for this Voyage.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Guest Mariner" } });
    fireEvent.click(screen.getByRole("button", { name: "Begin Voyage" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    const startCall = fetch.mock.calls.find(([url]) => String(url).endsWith("/start"));
    expect(startCall?.[1]?.headers).toEqual({ "Content-Type": "application/json" });
    expect(startCall?.[1]?.body).toBe(JSON.stringify({ ownerLabel: "Guest Mariner", aliasEdited: false }));
  });

  it("keeps return links distinct and omits an absent preview subtitle heading", async () => {
    installFetch({ ...tale, subtitle: null });
    render(<TaleStart taleSlug="moonlit-map" />);

    const navigation = await screen.findByRole("navigation", { name: "Chronicle preview navigation" });
    expect(navigation).toHaveClass("tale-start-navigation");
    expect(screen.getByRole("link", { name: "← Published Chronicles" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View this browser's Voyage History" })).toBeVisible();
    expect(document.querySelectorAll(".tale-start h2")).toHaveLength(0);
  });
});
