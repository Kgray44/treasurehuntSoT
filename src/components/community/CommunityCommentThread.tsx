"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";

type Comment = {
  id: string;
  parentCommentId: string | null;
  depth: number;
  author: { displayName: string } | null;
  body: string | null;
  hasSpoiler: boolean;
  spoilerLevel: string;
  editedAt: string | null;
  createdAt: string;
};

type CommentSubject = "LISTING" | "VOYAGE_LOG" | "GUIDE";

const reportReasons = [
  "Safety or policy concern",
  "Harassment or abuse",
  "Spam or manipulation",
  "Private information",
];

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CommunityCommentThread({
  subjectType,
  subjectId,
  returnTo,
}: {
  subjectType: CommentSubject;
  subjectId: string;
  returnTo: string;
}) {
  const { state: currentUser } = useCurrentUser();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [spoilerBody, setSpoilerBody] = useState("");
  const [spoilerEnabled, setSpoilerEnabled] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(reportReasons[0]);
  const [reportDetail, setReportDetail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (controller?: AbortController) => {
      const parameters = new URLSearchParams({ subjectType, subjectId });
      const response = await fetch(`/api/community/comments?${parameters.toString()}`, {
        cache: "no-store",
        signal: controller?.signal,
      });
      if (!response.ok) throw new Error("Comments are temporarily unavailable.");
      const value = (await response.json()) as { comments?: Comment[] };
      if (!controller?.signal.aborted) {
        setComments(value.comments ?? []);
        setState("ready");
      }
    },
    [subjectId, subjectType],
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentUser.status !== "authenticated") {
      setMessage("Sign in to add a Community comment.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/community/comments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": currentUser.csrfToken },
      body: JSON.stringify({
        subjectType,
        subjectId,
        body,
        spoilerBody: spoilerEnabled && spoilerBody ? spoilerBody : null,
        ...(replyTo ? { parentCommentId: replyTo.id } : {}),
        idempotencyKey: idempotencyKey(),
      }),
    });
    const value = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(
      response.ok ? "Your comment is now visible to the Community." : (value?.error ?? "Comment could not be saved."),
    );
    if (response.ok) {
      setBody("");
      setSpoilerBody("");
      setSpoilerEnabled(false);
      setReplyTo(null);
      await refresh();
    }
    setBusy(false);
  }

  async function reveal(commentId: string) {
    const response = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}/spoiler`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setMessage("That spoiler detail is no longer available.");
      return;
    }
    const value = (await response.json()) as { spoilerBody?: string };
    if (value.spoilerBody) setRevealed((current) => ({ ...current, [commentId]: value.spoilerBody! }));
  }

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentUser.status !== "authenticated" || !reportTarget) return;
    setBusy(true);
    const response = await fetch("/api/community/reports", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": currentUser.csrfToken },
      body: JSON.stringify({
        subjectType: "COMMENT",
        subjectId: reportTarget,
        reason: reportReason,
        detail: reportDetail || undefined,
        idempotencyKey: idempotencyKey(),
      }),
    });
    setMessage(response.ok ? "Your report was received for moderation review." : "The report could not be sent.");
    if (response.ok) {
      setReportTarget(null);
      setReportDetail("");
    }
    setBusy(false);
  }

  const signInHref = `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <section className="community-comments" aria-labelledby="community-comments-title">
      <header className="community-comments__header">
        <div>
          <p className="community-eyebrow">Community conversation</p>
          <h2 id="community-comments-title">Comments</h2>
          <p>Keep the visible conversation preview-safe. Spoiler details require an explicit reveal.</p>
        </div>
        <p className="community-comments__count" aria-live="polite">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </p>
      </header>
      <p className="community-review-message" aria-live="polite">
        {message}
      </p>
      {currentUser.status === "authenticated" ? (
        <form className="community-comment-composer" onSubmit={(event) => void submit(event)}>
          <div>
            <h3>{replyTo ? `Reply to ${replyTo.author?.displayName ?? "Community member"}` : "Add a comment"}</h3>
            {replyTo ? (
              <button
                type="button"
                className="community-button community-button--quiet"
                onClick={() => setReplyTo(null)}
              >
                Cancel reply
              </button>
            ) : null}
          </div>
          <label>
            Preview-safe comment
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={1}
              maxLength={5000}
              required
            />
          </label>
          <label className="community-review-spoiler-toggle">
            <input
              type="checkbox"
              checked={spoilerEnabled}
              onChange={(event) => setSpoilerEnabled(event.target.checked)}
            />
            Include spoiler details behind an explicit reveal
          </label>
          {spoilerEnabled ? (
            <label>
              Spoiler details
              <textarea value={spoilerBody} onChange={(event) => setSpoilerBody(event.target.value)} maxLength={5000} />
            </label>
          ) : null}
          <button className="community-button community-button--primary" disabled={busy}>
            {busy ? "Saving…" : replyTo ? "Post reply" : "Post comment"}
          </button>
        </form>
      ) : currentUser.status !== "loading" ? (
        <aside className="community-comment-composer">
          <h3>Join the conversation</h3>
          <p>Sign in with a Community profile to comment, reply, or report a concern.</p>
          <Link className="community-button community-button--primary" href={signInHref}>
            Sign in to comment
          </Link>
        </aside>
      ) : null}
      {state === "loading" ? <p role="status">Loading public comments.</p> : null}
      {state === "error" ? <p role="alert">Comments are temporarily unavailable.</p> : null}
      {state === "ready" && !comments.length ? (
        <p className="community-comments__empty">No public comments yet. Start with a preview-safe thought.</p>
      ) : null}
      {state === "ready" && comments.length ? (
        <ol className="community-comment-list" aria-label="Public comments">
          {comments.map((comment) => (
            <li key={comment.id} data-depth={Math.min(comment.depth, 2)}>
              <article className="community-comment-card">
                <header>
                  <strong>{comment.author?.displayName ?? "Community member"}</strong>
                  <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time>
                </header>
                {comment.body ? <p>{comment.body}</p> : null}
                {comment.hasSpoiler && !revealed[comment.id] ? (
                  <button
                    type="button"
                    className="community-button community-button--quiet"
                    onClick={() => void reveal(comment.id)}
                  >
                    Reveal {comment.spoilerLevel.toLocaleLowerCase().replaceAll("_", " ")} spoiler
                  </button>
                ) : null}
                {revealed[comment.id] ? (
                  <p className="community-comment-card__spoiler" aria-live="polite">
                    {revealed[comment.id]}
                  </p>
                ) : null}
                {currentUser.status === "authenticated" ? (
                  <div className="community-comment-card__actions">
                    <button
                      type="button"
                      className="community-button community-button--quiet"
                      onClick={() => setReplyTo(comment)}
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      className="community-button community-button--quiet"
                      onClick={() => setReportTarget(comment.id)}
                    >
                      Report
                    </button>
                  </div>
                ) : null}
                {reportTarget === comment.id ? (
                  <form className="community-review-report" onSubmit={(event) => void report(event)}>
                    <h3>Report this comment</h3>
                    <label>
                      Reason
                      <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                        {reportReasons.map((reason) => (
                          <option key={reason}>{reason}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Optional detail
                      <textarea
                        value={reportDetail}
                        maxLength={2000}
                        onChange={(event) => setReportDetail(event.target.value)}
                      />
                    </label>
                    <div>
                      <button className="community-button community-button--danger" disabled={busy}>
                        Send report
                      </button>
                      <button
                        type="button"
                        className="community-button community-button--quiet"
                        onClick={() => setReportTarget(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
