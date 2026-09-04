import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/CurrentUserProvider", () => ({
  useCurrentUser: () => ({ state: { status: "anonymous", authenticated: false } }),
}));

import { CommunityCommentThread } from "./CommunityCommentThread";

describe("CommunityCommentThread", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps comment spoilers out of the public render until an explicit reveal", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            comments: [
              {
                id: "comment_1",
                parentCommentId: null,
                depth: 0,
                author: { displayName: "Synthetic Deckhand" },
                body: "The opening clue is a great starting point.",
                hasSpoiler: true,
                spoilerLevel: "MINOR",
                editedAt: null,
                createdAt: "2026-09-04T00:00:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ spoilerBody: "The hidden route opens after sunset." })));
    vi.stubGlobal("fetch", fetch);

    render(<CommunityCommentThread subjectType="LISTING" subjectId="listing_1" returnTo="/community/test-listing" />);

    expect(await screen.findByText("The opening clue is a great starting point.")).toBeInTheDocument();
    expect(screen.queryByText("The hidden route opens after sunset.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal minor spoiler" }));
    expect(await screen.findByText("The hidden route opens after sunset.")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/community/comments/comment_1/spoiler", { cache: "no-store" });
  });
});
