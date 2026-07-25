"use client";

import { useCallback, useEffect, useState } from "react";

type SubjectType = "LISTING" | "CREATOR" | "GUIDE" | "VOYAGE_LOG" | "COLLECTION";
type Mode = "hydrating" | "ready" | "pending" | "error" | "success" | "signed-out" | "indeterminate";

export function CommunitySocialControls({
  creatorProfileId,
  subjectType,
  subjectId,
}: {
  creatorProfileId: string;
  subjectType: SubjectType;
  subjectId: string;
}) {
  const [csrf, setCsrf] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [mode, setMode] = useState<Mode>("hydrating");
  const [message, setMessage] = useState("");

  const hydrate = useCallback(async () => {
    setMode("hydrating");
    setMessage("");
    const parameters = new URLSearchParams({
      subjects: JSON.stringify([{ subjectType, subjectId }]),
    });
    const response = await fetch(`/api/community/social/state?${parameters.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      setMode("indeterminate");
      setMessage("Community relationship state is temporarily unavailable.");
      return false;
    }
    const value = (await response.json()) as {
      states?: Array<{ following: boolean; saved: boolean; favorited: boolean; blocked: boolean; canInteract: boolean }>;
    };
    const state = value.states?.[0];
    if (!state) {
      setMode("indeterminate");
      setMessage("Community relationship state is temporarily unavailable.");
      return false;
    }
    setFollowing(state.following);
    setSaved(state.saved);
    setFavorited(state.favorited);
    setBlocked(state.blocked);
    setMode("ready");
    setMessage(state.canInteract ? "" : "Community interaction is unavailable.");
    return true;
  }, [subjectId, subjectType]);

  useEffect(() => {
    fetch("/api/auth/sessions")
      .then(async (response) => (response.ok ? ((await response.json()) as { csrfToken?: string }) : null))
      .then((session) => {
        if (session?.csrfToken) {
          setCsrf(session.csrfToken);
          void hydrate().catch(() => {
            setMode("indeterminate");
            setMessage("Community relationship state is temporarily unavailable.");
          });
        }
        else setMode("signed-out");
      })
      .catch(() => setMode("signed-out"));
    const restore = () => void hydrate().catch(() => undefined);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [hydrate]);

  async function mutate(path: string, payload: Record<string, string>) {
    if (!csrf) {
      setMode("signed-out");
      setMessage("Sign in to use Community Harbor controls.");
      return;
    }
    setMode("pending");
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "The Community action could not be completed.");
      if (await hydrate()) {
        setMode("success");
        setMessage("Community Harbor updated.");
      }
    } catch (cause) {
      setMode("error");
      setMessage(cause instanceof Error ? cause.message : "The Community action could not be completed.");
    }
  }

  if (mode === "hydrating" || mode === "indeterminate") {
    return (
      <section aria-label="Community Harbor controls">
        <p role={mode === "indeterminate" ? "alert" : "status"} aria-live="polite">
          {message || "Loading Community relationship state."}
        </p>
        {mode === "indeterminate" ? (
          <button type="button" onClick={() => void hydrate()}>
            Retry Community controls
          </button>
        ) : null}
      </section>
    );
  }
  if (mode === "signed-out") {
    return (
      <section aria-label="Community Harbor controls">
        <p role="status">Sign in to use Community Harbor controls.</p>
      </section>
    );
  }
  const disabled = mode === "pending" || blocked;
  return (
    <section aria-label="Community Harbor controls">
      <p aria-live="polite" role={mode === "error" ? "alert" : "status"}>{message}</p>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={following}
        onClick={() => void mutate(`/api/community/social/${following ? "unfollow" : "follow"}`, { creatorProfileId })}
      >
        {following ? "Unfollow Creator" : "Follow Creator"}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={saved}
        onClick={() => void mutate(`/api/community/social/${saved ? "unsave" : "save"}`, { subjectType, subjectId })}
      >
        {saved ? "Unsave" : "Save"}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={favorited}
        onClick={() => void mutate(`/api/community/social/${favorited ? "unfavorite" : "favorite"}`, { subjectType, subjectId })}
      >
        {favorited ? "Remove favorite" : "Favorite"}
      </button>
      <button
        type="button"
        disabled={mode === "pending"}
        aria-pressed={blocked}
        onClick={() => void mutate(`/api/community/social/${blocked ? "unblock-profile" : "block-profile"}`, { creatorProfileId })}
      >
        {blocked ? "Unblock Creator" : "Block Creator"}
      </button>
    </section>
  );
}
