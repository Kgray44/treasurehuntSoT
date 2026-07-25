"use client";

import { useEffect, useState } from "react";

type SubjectType = "LISTING" | "CREATOR" | "GUIDE" | "VOYAGE_LOG" | "COLLECTION";
type Mode = "idle" | "pending" | "error" | "success" | "signed-out";

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
  const [mode, setMode] = useState<Mode>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/sessions")
      .then(async (response) => (response.ok ? ((await response.json()) as { csrfToken?: string }) : null))
      .then((session) => {
        if (session?.csrfToken) setCsrf(session.csrfToken);
        else setMode("signed-out");
      })
      .catch(() => setMode("signed-out"));
  }, []);

  async function mutate(path: string, payload: Record<string, string>, onSuccess: () => void) {
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
      onSuccess();
      setMode("success");
      setMessage("Community Harbor updated.");
    } catch (cause) {
      setMode("error");
      setMessage(cause instanceof Error ? cause.message : "The Community action could not be completed.");
    }
  }

  const disabled = mode === "pending" || blocked;
  return (
    <section aria-label="Community Harbor controls">
      <p aria-live="polite" role={mode === "error" ? "alert" : "status"}>{message}</p>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={following}
        onClick={() => void mutate(`/api/community/social/${following ? "unfollow" : "follow"}`, { creatorProfileId }, () => setFollowing(!following))}
      >
        {following ? "Unfollow Creator" : "Follow Creator"}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={saved}
        onClick={() => void mutate(`/api/community/social/${saved ? "unsave" : "save"}`, { subjectType, subjectId }, () => setSaved(!saved))}
      >
        {saved ? "Unsave" : "Save"}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={favorited}
        onClick={() => void mutate(`/api/community/social/${favorited ? "unfavorite" : "favorite"}`, { subjectType, subjectId }, () => setFavorited(!favorited))}
      >
        {favorited ? "Remove favorite" : "Favorite"}
      </button>
      <button
        type="button"
        disabled={mode === "pending"}
        aria-pressed={blocked}
        onClick={() => void mutate(`/api/community/social/${blocked ? "unblock-profile" : "block-profile"}`, { creatorProfileId }, () => setBlocked(!blocked))}
      >
        {blocked ? "Unblock Creator" : "Block Creator"}
      </button>
    </section>
  );
}
