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
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveMutation = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<CommunitySocialControls creatorProfileId="creator_1" subjectType="LISTING" subjectId="listing_1" />);
    const button = await screen.findByRole("button", { name: "Follow Creator" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Unfollow Creator" })).not.toBeInTheDocument();
    resolveMutation!(new Response(JSON.stringify({ state: "CREATED" }), { status: 201 }));
    expect(await screen.findByRole("button", { name: "Unfollow Creator" })).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        "/api/community/social/follow",
        expect.objectContaining({ headers: expect.objectContaining({ "x-csrf-token": "csrf-1" }) }),
      ),
    );
  });
});
