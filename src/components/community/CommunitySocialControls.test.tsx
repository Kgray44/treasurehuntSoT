import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommunitySocialControls } from "./CommunitySocialControls";

describe("CommunitySocialControls", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not present a successful follow state before the CSRF-protected mutation commits", async () => {
    let resolveMutation: ((value: Response) => void) | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-1" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            states: [{ following: false, saved: false, favorited: false, blocked: false, canInteract: true }],
          }),
          { status: 200 },
        ),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveMutation = resolve;
          }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            states: [{ following: true, saved: false, favorited: false, blocked: false, canInteract: true }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(<CommunitySocialControls creatorProfileId="creator_1" subjectType="LISTING" subjectId="listing_1" />);
    const button = await screen.findByRole("button", { name: "Follow Creator" });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Unfollow Creator" })).not.toBeInTheDocument();
    resolveMutation!(new Response(JSON.stringify({ state: "CREATED" }), { status: 201 }));
    expect(await screen.findByRole("button", { name: "Unfollow Creator" })).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenNthCalledWith(
        3,
        "/api/community/social/follow",
        expect.objectContaining({ headers: expect.objectContaining({ "x-csrf-token": "csrf-1" }) }),
      ),
    );
  });

  it("withholds contradictory action controls while persisted state is unavailable and retries safely", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-1" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "COMMUNITY_SOCIAL_STATE_UNAVAILABLE" }), { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            states: [{ following: false, saved: false, favorited: false, blocked: false, canInteract: true }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(<CommunitySocialControls creatorProfileId="creator_1" subjectType="LISTING" subjectId="listing_1" />);
    expect(await screen.findByRole("button", { name: "Retry Community controls" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow Creator" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry Community controls" }));
    expect(await screen.findByRole("button", { name: "Follow Creator" })).toBeInTheDocument();
  });

  it("routes anonymous social intent through canonical sign-in with a safe return", async () => {
    window.history.replaceState({}, "", "/community/creators/captain-almanac");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })));
    render(<CommunitySocialControls creatorProfileId="creator_1" subjectType="CREATOR" subjectId="creator_1" />);
    expect(await screen.findByRole("link", { name: "Sign in to follow or save" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fcommunity%2Fcreators%2Fcaptain-almanac",
    );
  });
});
