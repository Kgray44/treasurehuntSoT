"use client";
import { useState } from "react";
export function MusterAvatar({ name, url }: { name: string; url: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className="muster-avatar">
      {url && failedUrl !== url ? (
        // Authorized profile-media URLs are dynamic and already processed by the profile pipeline.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setFailedUrl(url)} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
