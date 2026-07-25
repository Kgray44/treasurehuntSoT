import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommunityReviewList } from "./CommunityReviewList";

describe("CommunityReviewList", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps spoiler text out of the initial public review render and reveals only after an explicit request", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            reviews: [
              {
                id: "review_1",
                rating: 5,
                spoilerFreeBody: "The opening was well paced.",
                hasSpoiler: true,
                verifiedInstallation: true,
                verifiedCompletion: false,
                editedAt: null,
                author: { displayName: "Deckhand" },
                helpfulCount: 2,
                creatorResponse: null,
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ spoilerBody: "The final chart changes course." }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<CommunityReviewList listingId="listing_1" />);
    expect(await screen.findByText("The opening was well paced.")).toBeInTheDocument();
    expect(screen.queryByText("The final chart changes course.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal spoiler details" }));
    expect(await screen.findByText("The final chart changes course.")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/community/reviews/review_1/spoiler", { cache: "no-store" });
  });
});
