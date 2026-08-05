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
  createdAt: string;
  author: { displayName: string; handle?: string } | null;
  helpfulCount: number;
  creatorResponse: { body: string | null; hasSpoiler: boolean; creator: { displayName: string } | null } | null;
  canEdit: boolean;
};

export function CommunityReviewList({ listingId }: { listingId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [csrf, setCsrf] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    rating: number;
    spoilerFreeBody: string;
    spoilerBody: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sort, setSort] = useState<"NEWEST" | "HIGHEST" | "HELPFUL">("NEWEST");
  const [reviewBody, setReviewBody] = useState("");
  const [spoilerEnabled, setSpoilerEnabled] = useState(false);
  const [spoilerBody, setSpoilerBody] = useState("");
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("Safety or policy concern");
  const [reportDetail, setReportDetail] = useState("");

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
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy("composer");
    const response = await fetch("/api/community/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({
        listingId,
        rating: Number(fields.get("rating")),
        spoilerFreeBody: reviewBody || null,
        spoilerBody: spoilerEnabled && spoilerBody ? spoilerBody : null,
      }),
    });
    const responseValue = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(response.ok ? "Your review was saved." : (responseValue?.error ?? "Your review could not be saved."));
    if (response.ok) {
      form.reset();
      setReviewBody("");
      setSpoilerEnabled(false);
      setSpoilerBody("");
      await refresh();
    }
    setBusy(null);
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

  async function beginEdit(review: Review) {
    setBusy(`edit:${review.id}`);
    let spoilerBody = "";
    if (review.hasSpoiler) {
      const response = await fetch(`/api/community/reviews/${encodeURIComponent(review.id)}/spoiler`, {
        cache: "no-store",
      });
      if (response.ok) spoilerBody = ((await response.json()) as { spoilerBody?: string }).spoilerBody ?? "";
    }
    setEditing({
      id: review.id,
      rating: review.rating,
      spoilerFreeBody: review.spoilerFreeBody ?? "",
      spoilerBody,
    });
    setBusy(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !csrf) return;
    setBusy(`edit:${editing.id}`);
    const response = await fetch(`/api/community/reviews/${encodeURIComponent(editing.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({
        rating: editing.rating,
        spoilerFreeBody: editing.spoilerFreeBody || null,
        spoilerBody: editing.spoilerBody || null,
      }),
    });
    setMessage(response.ok ? "Your review changes were saved." : "Your review changes could not be saved.");
    if (response.ok) {
      setEditing(null);
      await refresh();
    }
    setBusy(null);
  }

  async function deleteReview(reviewId: string) {
    if (!csrf) return;
    setBusy(`delete:${reviewId}`);
    const response = await fetch(`/api/community/reviews/${encodeURIComponent(reviewId)}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf },
    });
    setMessage(response.ok ? "Your review was deleted." : "Your review could not be deleted.");
    if (response.ok) {
      setDeleteTarget(null);
      setEditing(null);
      await refresh();
    }
    setBusy(null);
  }

  async function reportReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrf || !reportTarget) return;
    setBusy(`report:${reportTarget}`);
    const response = await fetch("/api/community/reports", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({
        subjectType: "REVIEW",
        subjectId: reportTarget,
        reason: reportReason,
        detail: reportDetail,
      }),
    });
    const responseValue = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(
      response.ok
        ? "Your report was received for moderation review."
        : (responseValue?.error ?? "The report could not be sent."),
    );
    if (response.ok) {
      setReportTarget(null);
      setReportDetail("");
    }
    setBusy(null);
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

  const orderedReviews = [...reviews].sort((left, right) => {
    if (sort === "HIGHEST") return right.rating - left.rating || right.createdAt.localeCompare(left.createdAt);
    if (sort === "HELPFUL")
      return right.helpfulCount - left.helpfulCount || right.createdAt.localeCompare(left.createdAt);
    return right.createdAt.localeCompare(left.createdAt);
  });
  const ownReview = reviews.find((review) => review.canEdit);

  return (
    <section className="community-reviews" aria-labelledby="community-reviews-title">
      <header className="community-reviews__header">
        <div>
          <p className="community-eyebrow">Community experience</p>
          <h2 id="community-reviews-title">Reviews</h2>
        </div>
        {reviews.length ? (
          <dl className="community-review-summary">
            <div>
              <dt>Average</dt>
              <dd>{(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)} / 5</dd>
            </div>
            <div>
              <dt>Reviews</dt>
              <dd>{reviews.length}</dd>
            </div>
            <div>
              <dt>Verified</dt>
              <dd>{reviews.filter((review) => review.verifiedCompletion || review.verifiedInstallation).length}</dd>
            </div>
          </dl>
        ) : null}
      </header>
      {reviews.length ? (
        <div className="community-review-tools">
          <p>
            {ownReview
              ? "Your review is published and can be edited below."
              : "You have not published a review for this entry."}
          </p>
          <label>
            Sort reviews
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="NEWEST">Newest</option>
              <option value="HIGHEST">Highest rated</option>
              <option value="HELPFUL">Most helpful</option>
            </select>
          </label>
        </div>
      ) : null}
      {reviews.length ? (
        <div className="community-review-distribution" aria-label="Rating distribution">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = reviews.filter((review) => review.rating === rating).length;
            return (
              <div key={rating}>
                <span>{rating} star</span>
                <progress max={reviews.length} value={count}>
                  {count}
                </progress>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      ) : null}
      <p className="community-review-message" aria-live="polite">
        {message}
      </p>
      <form
        className="community-review-composer"
        onSubmit={(event) => void submitReview(event)}
        aria-label="Write a review"
      >
        <div>
          <h3>Write or update your review</h3>
          <p>
            Ratings require an eligible installation or completed Chronicle. Spoiler text stays behind an explicit
            reveal.
          </p>
        </div>
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
          Preview-safe review
          <textarea
            name="spoilerFreeBody"
            minLength={10}
            maxLength={5000}
            value={reviewBody}
            onChange={(event) => setReviewBody(event.target.value)}
            disabled={!csrf}
          />
          <small>{reviewBody.length} / 5,000 characters; enter at least 10 characters when adding a body.</small>
        </label>
        <label className="community-review-spoiler-toggle">
          <input
            type="checkbox"
            checked={spoilerEnabled}
            onChange={(event) => setSpoilerEnabled(event.target.checked)}
            disabled={!csrf}
          />
          Include spoiler details behind an explicit reveal
        </label>
        {spoilerEnabled ? (
          <label>
            Spoiler details
            <textarea
              name="spoilerBody"
              maxLength={5000}
              value={spoilerBody}
              onChange={(event) => setSpoilerBody(event.target.value)}
              disabled={!csrf}
            />
            <small>{spoilerBody.length} / 5,000 characters</small>
          </label>
        ) : null}
        <div className="community-review-composer__actions">
          <button
            className="community-button community-button--primary"
            type="submit"
            disabled={!csrf || busy === "composer"}
          >
            {busy === "composer" ? "Saving…" : "Save review"}
          </button>
          <button
            className="community-button community-button--quiet"
            type="button"
            disabled={!reviewBody && !spoilerBody}
            onClick={() => {
              setReviewBody("");
              setSpoilerEnabled(false);
              setSpoilerBody("");
            }}
          >
            Cancel draft
          </button>
        </div>
      </form>
      {state === "loading" ? <p role="status">Loading public reviews.</p> : null}
      {state === "error" ? <p role="alert">Reviews are temporarily unavailable.</p> : null}
      {state === "ready" && !reviews.length ? <p>No public reviews yet.</p> : null}
      {state === "ready" && reviews.length ? (
        <ul className="community-review-list" aria-label="Public reviews">
          {orderedReviews.map((review) => (
            <li key={review.id}>
              <article className="community-review-card">
                <header>
                  <h3 aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </h3>
                  <p>
                    {review.author?.displayName ?? "Community member"}
                    {review.verifiedCompletion
                      ? " · Verified completion"
                      : review.verifiedInstallation
                        ? " · Verified installation"
                        : " · Unverified experience"}
                    {review.editedAt ? " · Edited" : ""}
                  </p>
                  <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time>
                </header>
                {review.spoilerFreeBody ? <p>{review.spoilerFreeBody}</p> : null}
                <p>{review.helpfulCount} found this helpful.</p>
                <button
                  className="community-button community-button--quiet"
                  type="button"
                  disabled={!csrf}
                  onClick={() => void markHelpful(review.id)}
                >
                  Mark helpful
                </button>
                {review.canEdit ? (
                  <div className="community-review-owner-actions">
                    <button
                      className="community-button community-button--quiet"
                      type="button"
                      disabled={busy === `edit:${review.id}`}
                      onClick={() => void beginEdit(review)}
                    >
                      Edit my review
                    </button>
                    {deleteTarget === review.id ? (
                      <>
                        <span>Delete this review permanently?</span>
                        <button
                          className="community-button community-button--danger"
                          type="button"
                          disabled={busy === `delete:${review.id}`}
                          onClick={() => void deleteReview(review.id)}
                        >
                          Confirm delete
                        </button>
                        <button
                          className="community-button community-button--quiet"
                          type="button"
                          onClick={() => setDeleteTarget(null)}
                        >
                          Keep review
                        </button>
                      </>
                    ) : (
                      <button
                        className="community-button community-button--danger"
                        type="button"
                        onClick={() => setDeleteTarget(review.id)}
                      >
                        Delete my review
                      </button>
                    )}
                  </div>
                ) : null}
                {!review.canEdit && csrf ? (
                  reportTarget === review.id ? (
                    <form className="community-review-report" onSubmit={(event) => void reportReview(event)}>
                      <h4>Report this review</h4>
                      <label>
                        Reason
                        <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                          <option>Safety or policy concern</option>
                          <option>Harassment or abuse</option>
                          <option>Spam or manipulation</option>
                          <option>Private information</option>
                        </select>
                      </label>
                      <label>
                        Optional detail
                        <textarea
                          maxLength={2000}
                          value={reportDetail}
                          onChange={(event) => setReportDetail(event.target.value)}
                        />
                      </label>
                      <div>
                        <button
                          className="community-button community-button--danger"
                          disabled={busy === `report:${review.id}`}
                        >
                          Send report
                        </button>
                        <button
                          className="community-button community-button--quiet"
                          type="button"
                          onClick={() => setReportTarget(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      className="community-button community-button--quiet"
                      type="button"
                      onClick={() => setReportTarget(review.id)}
                    >
                      Report review
                    </button>
                  )
                ) : null}
                {editing?.id === review.id ? (
                  <form className="community-review-editor" onSubmit={(event) => void saveEdit(event)}>
                    <h4>Edit your review</h4>
                    <label>
                      Rating
                      <select
                        value={editing.rating}
                        onChange={(event) => setEditing({ ...editing, rating: Number(event.target.value) })}
                      >
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <option key={rating}>{rating}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Preview-safe review
                      <textarea
                        maxLength={5000}
                        value={editing.spoilerFreeBody}
                        onChange={(event) => setEditing({ ...editing, spoilerFreeBody: event.target.value })}
                      />
                    </label>
                    <label>
                      Spoiler details
                      <textarea
                        maxLength={5000}
                        value={editing.spoilerBody}
                        onChange={(event) => setEditing({ ...editing, spoilerBody: event.target.value })}
                      />
                    </label>
                    <div>
                      <button
                        className="community-button community-button--primary"
                        disabled={busy === `edit:${review.id}`}
                      >
                        Save changes
                      </button>
                      <button
                        className="community-button community-button--quiet"
                        type="button"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
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
