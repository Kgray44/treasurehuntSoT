"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

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
  const [csrf, setCsrf] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(
    async (controller?: AbortController) => {
      const [reviewResponse, sessionResponse] = await Promise.all([
        fetch(`/api/community/reviews?listingId=${encodeURIComponent(listingId)}`, { signal: controller?.signal }),
        fetch("/api/player/session", { cache: "no-store" }),
      ]);
      if (!reviewResponse.ok) throw new Error("Reviews are unavailable.");
      const value = (await reviewResponse.json()) as { reviews: Review[] };
      if (!controller?.signal.aborted) {
        setReviews(value.reviews);
        setState("ready");
        if (sessionResponse.ok) setCsrf(((await sessionResponse.json()) as { csrfToken?: string }).csrfToken ?? "");
      }
    },
    [listingId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void refresh(controller).catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refresh]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrf) {
      setMessage("Sign in to write a review.");
      return;
    }
    const fields = new FormData(event.currentTarget);
    const response = await fetch("/api/community/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({
        listingId,
        rating: Number(fields.get("rating")),
        spoilerFreeBody: fields.get("spoilerFreeBody") || null,
        spoilerBody: fields.get("spoilerBody") || null,
      }),
    });
    setMessage(
      response.ok
        ? "Your review was saved."
        : "Your review could not be saved. You may not yet be eligible to review this entry.",
    );
    if (response.ok) {
      event.currentTarget.reset();
      await refresh();
    }
  }

  async function markHelpful(reviewId: string) {
    if (!csrf) {
      setMessage("Sign in to mark a review helpful.");
      return;
    }
    const response = await fetch(`/api/community/reviews/${encodeURIComponent(reviewId)}/helpful`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
    setMessage(response.ok ? "Helpful vote saved." : "Helpful vote could not be saved.");
    if (response.ok) await refresh();
  }

  async function revealSpoiler(reviewId: string) {
    try {
      const response = await fetch(`/api/community/reviews/${encodeURIComponent(reviewId)}/spoiler`, {
        cache: "no-store",
      });
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
      <p aria-live="polite">{message}</p>
      <form onSubmit={(event) => void submitReview(event)} aria-label="Write a review">
        <h3>Write or update your review</h3>
        <label>
          Rating{" "}
          <select name="rating" defaultValue="5" disabled={!csrf}>
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1</option>
          </select>
        </label>
        <label>
          Preview-safe review <textarea name="spoilerFreeBody" maxLength={5000} disabled={!csrf} />
        </label>
        <label>
          Spoiler details <textarea name="spoilerBody" maxLength={5000} disabled={!csrf} />
        </label>
        <button type="submit" disabled={!csrf}>
          Save review
        </button>
      </form>
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
                  {review.verifiedCompletion
                    ? " · Verified completion"
                    : review.verifiedInstallation
                      ? " · Verified installation"
                      : " · Unverified experience"}
                  {review.editedAt ? " · Edited" : ""}
                </p>
                {review.spoilerFreeBody ? <p>{review.spoilerFreeBody}</p> : null}
                <p>{review.helpfulCount} found this helpful.</p>
                <button type="button" disabled={!csrf} onClick={() => void markHelpful(review.id)}>
                  Mark helpful
                </button>
                {review.creatorResponse?.body ? (
                  <section aria-label="Official Creator response">
                    <h4>Creator response</h4>
                    <p>{review.creatorResponse.creator?.displayName ?? "Creator"}</p>
                    <p>{review.creatorResponse.body}</p>
                    {review.creatorResponse.hasSpoiler ? (
                      <p>Creator response contains separately available spoiler details.</p>
                    ) : null}
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
