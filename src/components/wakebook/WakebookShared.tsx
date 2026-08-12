"use client";

import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/ui/AsyncState";
import type { SafeHistoricalCover } from "@/wakebook/contracts";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

export async function wakebookResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "This request could not be completed.");
  return body;
}

export function useWakebookResource<T>(url: string) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    // A changed query intentionally returns the resource to a visible loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(wakebookResponse<T>)
      .then((value) => setState({ status: "ready", value }))
      .catch((cause) => {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            message: cause instanceof Error ? cause.message : "Your Journey Archive is unavailable.",
          });
      });
    return () => controller.abort();
  }, [generation, url]);
  return { state, setState, reload: () => setGeneration((value) => value + 1) };
}

export function WakebookLoading({
  detail = "Reading your private, version-pinned Voyage history.",
}: {
  detail?: string;
}) {
  return (
    <div className="wakebook-loading" aria-label="Loading Journey Archive">
      <LoadingState title="Opening the wake" detail={detail} compact />
      <div className="wakebook-loading__shelf" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function WakebookError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <ErrorState
      title="The archive could not be opened"
      detail={message}
      action={{ label: "Try the archive again", onClick: retry }}
    />
  );
}

export function HistoricalCover({
  cover,
  title,
  size = "card",
}: {
  cover: SafeHistoricalCover;
  title: string;
  size?: "card" | "hero";
}) {
  const [failed, setFailed] = useState(false);
  const initials = title
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase())
    .join("");
  return (
    <div
      className={`wakebook-cover wakebook-cover--${size}`}
      data-cover-state={cover && !failed ? "image" : "fallback"}
    >
      {cover && !failed ? (
        // The owner-authorized route carries a version-pinned derivative; a normal img preserves graceful failure.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.href} alt={cover.alt} onError={() => setFailed(true)} />
      ) : (
        <div className="wakebook-cover__fallback" role="img" aria-label={`Archive cover for ${title}`}>
          <span aria-hidden="true">{initials || "V"}</span>
          <small>Voyagewright archive</small>
        </div>
      )}
    </div>
  );
}

export function formatArchiveDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

export function crewInitials(value: string) {
  return (
    value
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toLocaleUpperCase())
      .join("") || "?"
  );
}
