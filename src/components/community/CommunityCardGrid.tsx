"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HomeportCommunityCard, HomeportSocialSubject } from "@/community/homeport";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";

type RelationshipState = Readonly<{
  subjectType: HomeportSocialSubject["subjectType"];
  subjectId: string;
  following: boolean;
  saved: boolean;
  favorited: boolean;
  blocked: boolean;
  canInteract: boolean;
}>;

type MutationState = Readonly<{ mode: "idle" | "pending" | "success" | "error"; message: string }>;

export function CommunityCardGrid({
  cards,
  label,
  compact = false,
}: {
  cards: readonly HomeportCommunityCard[];
  label: string;
  compact?: boolean;
}) {
  const { state: currentUser } = useCurrentUser();
  const subjects = useMemo(
    () => cards.flatMap((card) => (card.socialSubject ? [card.socialSubject] : [])).slice(0, 48),
    [cards],
  );
  const subjectKey = useMemo(() => JSON.stringify(subjects), [subjects]);
  const [relationships, setRelationships] = useState<Record<string, RelationshipState>>({});
  const [relationshipError, setRelationshipError] = useState("");
  const [mutations, setMutations] = useState<Record<string, MutationState>>({});
  const [saveDeltas, setSaveDeltas] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!subjects.length) return;
    const controller = new AbortController();
    const parameters = new URLSearchParams({ subjects: subjectKey });
    fetch(`/api/community/social/state?${parameters.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          states?: RelationshipState[];
          error?: string;
        } | null;
        if (!response.ok) throw new Error(body?.error ?? "Saved and followed state is temporarily unavailable.");
        const states = body?.states ?? [];
        setRelationships(Object.fromEntries(states.map((state) => [relationshipKey(state), state])));
        setRelationshipError("");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setRelationshipError(
          cause instanceof Error ? cause.message : "Saved and followed state is temporarily unavailable.",
        );
      });
    return () => controller.abort();
  }, [subjectKey, subjects]);

  async function mutate(card: HomeportCommunityCard, action: "save" | "unsave" | "follow" | "unfollow") {
    const subject = card.socialSubject;
    if (!subject || currentUser.status !== "authenticated") return;
    const key = relationshipKey(subject);
    setMutations((current) => ({ ...current, [key]: { mode: "pending", message: actionMessage(action, "pending") } }));
    try {
      const payload =
        subject.subjectType === "CREATOR"
          ? { creatorProfileId: subject.subjectId }
          : { subjectType: subject.subjectType, subjectId: subject.subjectId };
      const response = await fetch(`/api/community/social/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": currentUser.csrfToken },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "The Community action could not be completed.");
      setRelationships((current) => {
        const prior = current[key];
        if (!prior) return current;
        return {
          ...current,
          [key]: {
            ...prior,
            ...(action === "save" ? { saved: true } : {}),
            ...(action === "unsave" ? { saved: false } : {}),
            ...(action === "follow" ? { following: true } : {}),
            ...(action === "unfollow" ? { following: false } : {}),
          },
        };
      });
      setMutations((current) => ({
        ...current,
        [key]: { mode: "success", message: actionMessage(action, "success") },
      }));
      if (subject.subjectType === "LISTING" && (action === "save" || action === "unsave"))
        setSaveDeltas((current) => ({ ...current, [key]: (current[key] ?? 0) + (action === "save" ? 1 : -1) }));
      window.dispatchEvent(new CustomEvent("voyagewright-community-state-changed", { detail: { ...subject, action } }));
    } catch (cause) {
      setMutations((current) => ({
        ...current,
        [key]: {
          mode: "error",
          message: cause instanceof Error ? cause.message : "The Community action could not be completed.",
        },
      }));
    }
  }

  return (
    <div className={`community-card-grid${compact ? " community-card-grid--compact" : ""}`} aria-label={label}>
      {cards.map((card) => {
        const social = card.socialSubject ? relationships[relationshipKey(card.socialSubject)] : undefined;
        const mutation = card.socialSubject ? mutations[relationshipKey(card.socialSubject)] : undefined;
        const creatorAction = card.socialSubject?.subjectType === "CREATOR";
        const pressed = creatorAction ? social?.following : social?.saved;
        const action = creatorAction ? (pressed ? "unfollow" : "follow") : pressed ? "unsave" : "save";
        return (
          <article className="community-card" key={`${card.variant}:${card.id}`} data-card-variant={card.variant}>
            <div
              className={`community-card__art community-card__art--${card.variant.toLocaleLowerCase()}`}
              role="img"
              aria-label={card.artwork.label}
            >
              <span aria-hidden="true">{artworkSymbol(card.variant)}</span>
              <small>{card.contentType}</small>
            </div>
            <div className="community-card__body">
              <div className="community-card__heading">
                <p className="community-card__type">{card.contentType}</p>
                <h3>
                  <Link href={card.destination} prefetch={false}>
                    {card.title}
                  </Link>
                </h3>
                {card.creator ? (
                  <p className="community-card__creator">
                    By{" "}
                    <Link href={card.creator.destination} prefetch={false}>
                      {card.creator.displayName}
                    </Link>
                  </p>
                ) : null}
              </div>
              {card.summary ? <p className="community-card__summary">{card.summary}</p> : null}
              <CardMetadata
                card={card}
                saveDelta={card.socialSubject ? (saveDeltas[relationshipKey(card.socialSubject)] ?? 0) : 0}
              />
              <div className="community-card__actions">
                <Link
                  className="community-button community-button--primary"
                  href={card.primaryAction.href}
                  prefetch={false}
                >
                  {card.primaryAction.label}
                </Link>
                {card.socialSubject ? (
                  currentUser.status === "authenticated" ? (
                    <button
                      className="community-button community-button--quiet"
                      type="button"
                      aria-pressed={Boolean(pressed)}
                      disabled={mutation?.mode === "pending" || social?.blocked || social?.canInteract === false}
                      onClick={() => void mutate(card, action)}
                    >
                      {creatorAction ? (pressed ? "Following" : "Follow") : pressed ? "Saved" : "Save"}
                    </button>
                  ) : currentUser.status === "restricted" ? (
                    <span className="community-action-note">Community actions are unavailable for this account.</span>
                  ) : (
                    <Link
                      className="community-button community-button--quiet"
                      href={`/sign-in?returnTo=${encodeURIComponent(card.destination)}`}
                      aria-label={`Sign in to ${creatorAction ? "follow" : "save"}`}
                    >
                      {creatorAction ? "Follow" : "Save"}
                    </Link>
                  )
                ) : null}
              </div>
              {mutation?.message ? (
                <p
                  className={`community-card__notice community-card__notice--${mutation.mode}`}
                  role={mutation.mode === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {mutation.message}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
      {relationshipError ? (
        <p className="community-grid-notice" role="status">
          {relationshipError} Cards remain available to open.
        </p>
      ) : null}
    </div>
  );
}

function CardMetadata({ card, saveDelta = 0 }: { card: HomeportCommunityCard; saveDelta?: number }) {
  const facts = [
    card.difficulty ? { label: "Difficulty", value: card.difficulty } : null,
    card.duration ? { label: "Duration", value: card.duration } : null,
    card.playerCount ? { label: "Crew", value: card.playerCount } : null,
    card.category ? { label: "Category", value: card.category } : null,
    card.license ? { label: "License", value: card.license } : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  return (
    <>
      {facts.length ? (
        <dl className="community-card__facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {card.badges?.length || card.accessibility?.length || card.free !== undefined || card.remixable !== undefined ? (
        <ul className="community-card__badges" aria-label={`${card.title} details`}>
          {card.free ? <li>Free</li> : null}
          {card.remixable ? <li>Remix allowed</li> : null}
          {card.badges?.map((badge) => (
            <li key={badge}>{badge}</li>
          ))}
          {card.accessibility?.slice(0, 2).map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      {card.engagement ? (
        <p className="community-card__engagement">
          {card.engagement.reviewCount
            ? `${card.engagement.rating?.toFixed(1) ?? "—"} rating · ${card.engagement.reviewCount} ${card.engagement.reviewCount === 1 ? "review" : "reviews"}`
            : "Not yet rated"}
          {` · ${Math.max(0, (card.engagement.saveCount ?? 0) + saveDelta)} saves`}
        </p>
      ) : null}
    </>
  );
}

function relationshipKey(subject: Pick<HomeportSocialSubject, "subjectType" | "subjectId">) {
  return `${subject.subjectType}:${subject.subjectId}`;
}

function actionMessage(action: "save" | "unsave" | "follow" | "unfollow", state: "pending" | "success") {
  const messages = {
    save: state === "pending" ? "Saving this item." : "Saved to your Chronicle Passport.",
    unsave: state === "pending" ? "Removing this saved item." : "Removed from your saved content.",
    follow: state === "pending" ? "Following this Creator." : "You are now following this Creator.",
    unfollow: state === "pending" ? "Unfollowing this Creator." : "You are no longer following this Creator.",
  };
  return messages[action];
}

function artworkSymbol(variant: HomeportCommunityCard["variant"]) {
  return {
    CHRONICLE: "✦",
    ARTIFACT: "◇",
    TEMPLATE: "⌑",
    MAP_OR_LOCATION_PACK: "⌖",
    AUDIO_OR_REVEAL: "◌",
    CREATOR: "◎",
    COLLECTION: "▦",
    GUIDE: "≡",
    VOYAGE_LOG: "≈",
  }[variant];
}
