"use client";

import { useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  spoilerFreeBody: string | null;
  hasSpoiler: boolean;
  verifiedInstallation: boolean;
  verifiedCompletion: boolean;
  editedAt: string | null;
  author: { displayName: string; handle?: string } | null;
  helpfulCount: number;
  creatorResponse: { body: string | null; hasSpoiler: boolean; creator: { displayName: string } | null } | null;
};

export function CommunityReviewList({ listingId }: { listingId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/community/reviews?listingId=${encodeURIComponent(listingId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Reviews are unavailable.");
        return response.json() as Promise<{ reviews: Review[] }>;
      })
      .then((value) => {
        if (controller.signal.aborted) return;
        setReviews(value.reviews);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [listingId]);

  async function revealSpoiler(reviewId: string) {
    try {
      const response = await fetch(`/api/community/reviews/${encodeURIComponent(reviewId)}/spoiler`, { cache: "no-store" });
      if (!response.ok) return;
      const value = (await response.json()) as { spoilerBody?: string };
      if (value.spoilerBody) setRevealed((current) => ({ ...current, [reviewId]: value.spoilerBody! }));
    } catch {
      // The button remains available for a later explicit retry without
      // exposing server implementation details.
    }
  }

  return (
    <section aria-labelledby="community-reviews-title">
      <h2 id="community-reviews-title">Reviews</h2>
      {state === "loading" ? <p role="status">Loading public reviews.</p> : null}
      {state === "error" ? <p role="alert">Reviews are temporarily unavailable.</p> : null}
      {state === "ready" && !reviews.length ? <p>No public reviews yet.</p> : null}
      {state === "ready" && reviews.length ? (
        <ul aria-label="Public reviews">
          {reviews.map((review) => (
            <li key={review.id}>
              <article>
                <h3>{review.rating} out of 5</h3>
                <p>
                  {review.author?.displayName ?? "Community member"}
                  {review.verifiedCompletion ? " · Verified completion" : review.verifiedInstallation ? " · Verified installation" : " · Unverified experience"}
                  {review.editedAt ? " · Edited" : ""}
                </p>
                {review.spoilerFreeBody ? <p>{review.spoilerFreeBody}</p> : null}
                <p>{review.helpfulCount} found this helpful.</p>
                {review.creatorResponse?.body ? (
                  <section aria-label="Official Creator response">
                    <h4>Creator response</h4>
                    <p>{review.creatorResponse.creator?.displayName ?? "Creator"}</p>
                    <p>{review.creatorResponse.body}</p>
                    {review.creatorResponse.hasSpoiler ? <p>Creator response contains separately available spoiler details.</p> : null}
                  </section>
                ) : null}
                {review.hasSpoiler && !revealed[review.id] ? (
                  <button type="button" onClick={() => void revealSpoiler(review.id)}>
                    Reveal spoiler details
                  </button>
                ) : null}
                {revealed[review.id] ? <p aria-live="polite">{revealed[review.id]}</p> : null}
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
