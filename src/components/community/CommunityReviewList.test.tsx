import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
                createdAt: "2026-08-04T00:00:00.000Z",
                author: { displayName: "Deckhand" },
                helpfulCount: 2,
                creatorResponse: null,
                canEdit: false,
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ spoilerBody: "The final chart changes course." }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<CommunityReviewList listingId="listing_1" />);
    expect(await screen.findByText("The opening was well paced.")).toBeInTheDocument();
    expect(screen.queryByText("The final chart changes course.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal spoiler details" }));
    expect(await screen.findByText("The final chart changes course.")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(3, "/api/community/reviews/review_1/spoiler", { cache: "no-store" });
  });

  it("renders the empty state and saves a guided spoiler-aware review through the canonical mutation", async () => {
    let reviews: unknown[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url === "/api/player/session")
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 });
      if (url.startsWith("/api/community/reviews?") && (!options?.method || options.method === "GET"))
        return new Response(JSON.stringify({ reviews }), { status: 200 });
      if (url === "/api/community/reviews" && options?.method === "POST") {
        reviews = [
          {
            id: "review-own",
            rating: 4,
            spoilerFreeBody: "A thoughtful public review.",
            hasSpoiler: true,
            verifiedInstallation: true,
            verifiedCompletion: false,
            editedAt: null,
            createdAt: "2026-08-04T00:00:00.000Z",
            author: { displayName: "Synthetic Owner" },
            helpfulCount: 0,
            creatorResponse: null,
            canEdit: true,
          },
        ];
        return new Response(JSON.stringify({ ok: true }), { status: 201 });
      }
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    render(<CommunityReviewList listingId="listing_1" />);

    expect(await screen.findByText("No public reviews yet.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Preview-safe review/u), {
      target: { value: "A thoughtful public review." },
    });
    fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "4" } });
    fireEvent.click(screen.getByLabelText("Include spoiler details behind an explicit reveal"));
    fireEvent.change(screen.getByLabelText(/^Spoiler details/u), {
      target: { value: "A synthetic spoiler detail." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));

    await waitFor(() => expect(screen.getByText("Your review was saved.")).toBeInTheDocument());
    const mutation = fetch.mock.calls.find(
      ([url, options]) => String(url) === "/api/community/reviews" && options?.method === "POST",
    );
    expect(JSON.parse(String(mutation?.[1]?.body))).toEqual({
      listingId: "listing_1",
      rating: 4,
      spoilerFreeBody: "A thoughtful public review.",
      spoilerBody: "A synthetic spoiler detail.",
    });
    expect(await screen.findByText("Your review is published and can be edited below.")).toBeInTheDocument();
  });

  it("edits and deletes only the current account review with explicit mutation states", async () => {
    let reviews: unknown[] = [
      {
        id: "review-own",
        rating: 3,
        spoilerFreeBody: "Original public review.",
        hasSpoiler: false,
        verifiedInstallation: true,
        verifiedCompletion: false,
        editedAt: null,
        createdAt: "2026-08-03T00:00:00.000Z",
        author: { displayName: "Synthetic Owner" },
        helpfulCount: 0,
        creatorResponse: null,
        canEdit: true,
      },
    ];
    const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url === "/api/player/session")
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 });
      if (url.startsWith("/api/community/reviews?") && (!options?.method || options.method === "GET"))
        return new Response(JSON.stringify({ reviews }), { status: 200 });
      if (url === "/api/community/reviews/review-own" && options?.method === "PATCH") {
        reviews = [
          {
            ...(reviews[0] as Record<string, unknown>),
            rating: 5,
            spoilerFreeBody: "Updated public review.",
            editedAt: "2026-08-04T00:00:00.000Z",
          },
        ];
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url === "/api/community/reviews/review-own" && options?.method === "DELETE") {
        reviews = [];
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    render(<CommunityReviewList listingId="listing_1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit my review" }));
    fireEvent.change(
      screen.getByLabelText(/^Preview-safe review/u, { selector: ".community-review-editor textarea" }),
      {
        target: { value: "Updated public review." },
      },
    );
    fireEvent.change(screen.getByLabelText("Rating", { selector: ".community-review-editor select" }), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Your review changes were saved.")).toBeInTheDocument();
    expect(await screen.findByText("Updated public review.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete my review" }));
    expect(screen.getByText("Delete this review permanently?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByText("Your review was deleted.")).toBeInTheDocument();
    expect(await screen.findByText("No public reviews yet.")).toBeInTheDocument();
  });

  it("submits a moderation report without exposing a report control on the current account review", async () => {
    const reviews = [
      {
        id: "review-other",
        rating: 2,
        spoilerFreeBody: "A reportable synthetic review.",
        hasSpoiler: false,
        verifiedInstallation: false,
        verifiedCompletion: false,
        editedAt: null,
        createdAt: "2026-08-02T00:00:00.000Z",
        author: { displayName: "Other reviewer" },
        helpfulCount: 0,
        creatorResponse: null,
        canEdit: false,
      },
    ];
    const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url === "/api/player/session")
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 });
      if (url.startsWith("/api/community/reviews?")) return new Response(JSON.stringify({ reviews }), { status: 200 });
      if (url === "/api/community/reports" && options?.method === "POST")
        return new Response(JSON.stringify({ state: "CREATED" }), { status: 201 });
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    render(<CommunityReviewList listingId="listing_1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Report review" }));
    fireEvent.change(screen.getByLabelText("Optional detail"), { target: { value: "Synthetic moderation detail." } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByText("Your report was received for moderation review.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/community/reports",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          subjectType: "REVIEW",
          subjectId: "review-other",
          reason: "Safety or policy concern",
          detail: "Synthetic moderation detail.",
        }),
      }),
    );
  });
});
