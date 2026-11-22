"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { focusExchangeHeading } from "./focus-exchange-heading";

type Item = {
  itemId: string;
  kind: string;
  name: string;
  releaseId: string;
  semanticVersion: string;
  packageChecksum: string;
  licenseName: string;
  credits: string[];
  studioUrl: string | null;
};

export function CreatorInstalledCommunityLibrary({
  publicationOptionsSettled,
}: {
  publicationOptionsSettled: boolean;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reachedInstallDestination = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/community/creator-publication/installed", { cache: "no-store" })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Installed items are unavailable.");
        return value.items as Item[];
      })
      .then((value) => {
        if (!cancelled) setItems(value);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Installed items are unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const heading = headingRef.current;
    if (
      !heading ||
      !publicationOptionsSettled ||
      (items === null && !error) ||
      reachedInstallDestination.current ||
      window.location.hash !== "#installed-community"
    )
      return;
    reachedInstallDestination.current = true;
    focusExchangeHeading(heading);
  }, [error, items, publicationOptionsSettled]);
  return (
    <section
      id="installed-community"
      className="studio-exchange-workflow"
      style={{ marginTop: "1rem", scrollMarginBlockStart: "calc(var(--shell-header-height) + 1rem)" }}
      aria-labelledby="installed-community-title"
    >
      <p className="eyebrow">Your private Library</p>
      <h2 id="installed-community-title" ref={headingRef} tabIndex={-1}>
        Installed from Community
      </h2>
      {!items && !error && <p role="status">Loading your installed Creator items…</p>}
      {error && <p role="alert">{error}</p>}
      {items && !items.length && <p>No Community items installed yet. Browse an approved release to start.</p>}
      {items && items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.itemId}>
              <h3>
                {item.name} ·{" "}
                {item.kind === "PRESET"
                  ? "Passage preset"
                  : item.kind === "CHRONICLE"
                    ? "Chronicle"
                    : "Chapter template"}
              </h3>
              <p>
                Private installed copy of release {item.semanticVersion}. License: {item.licenseName}.
              </p>
              <p>Credits: {item.credits.join(", ") || "Recorded by Community Harbor"}.</p>
              <p>
                Release ID: <code>{item.releaseId}</code>
              </p>
              <p>
                Package checksum: <code style={{ overflowWrap: "anywhere" }}>{item.packageChecksum}</code>
              </p>
              {item.studioUrl && <Link href={item.studioUrl}>Open private Chronicle</Link>}
            </li>
          ))}
        </ul>
      )}
      <Link href="/studio/library">Open a Chronicle to reuse an installed item</Link>
    </section>
  );
}
