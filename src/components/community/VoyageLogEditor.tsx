"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { VoyageLogConsentPanel } from "./VoyageLogConsentPanel";
import { VoyageLogMediaPanel } from "./VoyageLogMediaPanel";

type Participant = { id: string; displayNameSnapshot: string; isChild: boolean };
type VoyageLog = {
  id: string;
  title: string;
  safeSummary: string | null;
  visibility: "PRIVATE" | "CREW_ONLY" | "UNLISTED" | "COMMUNITY";
  spoilerLevel: "NONE" | "PREVIEW_SAFE" | "MINOR" | "CHAPTER" | "FINALE";
  approximateLocation: string | null;
  lifecycleState: string;
  verifiedCompletion: boolean;
  consentRevision: number;
  updatedAt: string;
  participants: Participant[];
  restrictions: string[];
};

const csrfHeaders = (csrf: string) => ({ "content-type": "application/json", "x-csrf-token": csrf });

export function VoyageLogEditor({ voyageLogId }: { voyageLogId: string }) {
  const [csrf, setCsrf] = useState("");
  const [log, setLog] = useState<VoyageLog | null>(null);
  const [message, setMessage] = useState("Loading private Voyage Log editor…");
  const [participantName, setParticipantName] = useState("");

  const refresh = useCallback(async () => {
    const [session, detail] = await Promise.all([
      fetch("/api/player/session", { cache: "no-store" }),
      fetch(`/api/community/voyage-logs/owner/${encodeURIComponent(voyageLogId)}`, { cache: "no-store" }),
    ]);
    if (session.ok) {
      const payload = (await session.json()) as { csrfToken?: string };
      setCsrf(payload.csrfToken ?? "");
    }
    if (!detail.ok) {
      setLog(null);
      setMessage(
        detail.status === 404
          ? "This Voyage Log is unavailable."
          : "The private editor could not be loaded. Try again.",
      );
      return;
    }
    setLog((await detail.json()) as VoyageLog);
    setMessage("");
  }, [voyageLogId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!log || !csrf) return;
    const fields = new FormData(event.currentTarget);
    const response = await fetch(`/api/community/voyage-logs/owner/${encodeURIComponent(log.id)}`, {
      method: "PATCH",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({
        title: fields.get("title"),
        safeSummary: fields.get("safeSummary") || null,
        visibility: fields.get("visibility"),
        spoilerLevel: fields.get("spoilerLevel"),
        approximateLocation: fields.get("approximateLocation") || null,
        expectedUpdatedAt: log.updatedAt,
      }),
    });
    if (response.status === 409) {
      setMessage("Another edit was saved first. Reloaded the current private draft.");
      await refresh();
      return;
    }
    if (!response.ok) {
      setMessage("The draft could not be saved.");
      return;
    }
    await refresh();
    setMessage("Draft saved. Publication eligibility is checked again when you publish.");
  }

  async function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participantName.trim() || !csrf) return;
    const response = await fetch(`/api/community/voyage-logs/owner/${encodeURIComponent(voyageLogId)}/participants`, {
      method: "POST",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ displayName: participantName.trim() }),
    });
    if (!response.ok) {
      setMessage("The participant could not be added.");
      return;
    }
    setParticipantName("");
    await refresh();
    setMessage("Participant added. Publication consent is now required.");
  }

  async function removeParticipant(participantId: string) {
    if (!csrf) return;
    const response = await fetch(`/api/community/voyage-logs/owner/${encodeURIComponent(voyageLogId)}/participants`, {
      method: "DELETE",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ participantId }),
    });
    if (!response.ok) {
      setMessage("The participant could not be removed.");
      return;
    }
    await refresh();
    setMessage("Participant removed. Review publication consent before sharing.");
  }

  async function transition(action: "READY" | "ARCHIVED" | "REMOVED") {
    if (!log || !csrf) return;
    const response = await fetch(`/api/community/voyage-logs/owner/${encodeURIComponent(log.id)}`, {
      method: "DELETE",
      headers: csrfHeaders(csrf),
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      setMessage("That lifecycle change is not currently allowed.");
      return;
    }
    await refresh();
    setMessage(`Voyage Log ${action.toLowerCase()}.`);
  }

  async function publish() {
    if (!log || !csrf) return;
    const response = await fetch(`/api/community/voyage-logs/owner/${encodeURIComponent(log.id)}`, {
      method: "POST",
      headers: csrfHeaders(csrf),
    });
    if (!response.ok) {
      setMessage("Publication is blocked until the current provenance, consent, media, and sharing checks pass.");
      return;
    }
    await refresh();
    setMessage("Voyage Log published.");
  }

  if (!log)
    return (
      <section className="community-workflow__state community-workflow__state--error" role="status">
        <p>{message}</p>
        <button type="button" onClick={() => void refresh()}>
          Try again
        </button>
      </section>
    );
  return (
    <section className="community-workflow__editor" aria-labelledby="voyage-log-editor-title">
      <div className="community-workflow__status" aria-live="polite">
        <strong>{log.lifecycleState.replaceAll("_", " ").toLocaleLowerCase()}</strong>
        <span>Consent revision {log.consentRevision}</span>
        {message ? <p>{message}</p> : null}
      </div>
      <section className="community-workflow__panel">
        <h2 id="voyage-log-editor-title">Draft details</h2>
        <p>
          Choose what can be shared without revealing participant identity, private locations, or unconsented media.
        </p>
        <form className="community-workflow__form" onSubmit={(event) => void save(event)}>
          <label>
            Title <input name="title" required maxLength={140} defaultValue={log.title} />
          </label>
          <label>
            Safe summary <textarea name="safeSummary" maxLength={280} defaultValue={log.safeSummary ?? ""} />
          </label>
          <label>
            Visibility{" "}
            <select name="visibility" defaultValue={log.visibility}>
              <option value="PRIVATE">Private</option>
              <option value="CREW_ONLY">Crew only</option>
              <option value="UNLISTED">Unlisted exact link</option>
              <option value="COMMUNITY">Community</option>
            </select>
          </label>
          <label>
            Spoiler classification{" "}
            <select name="spoilerLevel" defaultValue={log.spoilerLevel}>
              <option value="NONE">None</option>
              <option value="PREVIEW_SAFE">Preview safe</option>
              <option value="MINOR">Minor</option>
              <option value="CHAPTER">Chapter</option>
              <option value="FINALE">Finale</option>
            </select>
          </label>
          <label>
            Approximate location{" "}
            <input name="approximateLocation" maxLength={140} defaultValue={log.approximateLocation ?? ""} />
          </label>
          <button type="submit" disabled={!csrf}>
            Save revision
          </button>
        </form>
      </section>
      <section className="community-workflow__panel" aria-labelledby="voyage-log-participants-title">
        <h2 id="voyage-log-participants-title">Participants</h2>
        <p>
          Only add a participant you are authorized to invite. Consent is requested separately and is required before
          shared publication.
        </p>
        <form onSubmit={(event) => void addParticipant(event)}>
          <label>
            Display name{" "}
            <input
              value={participantName}
              onChange={(event) => setParticipantName(event.target.value)}
              maxLength={140}
              required
            />
          </label>
          <button type="submit" disabled={!csrf}>
            Add participant
          </button>
        </form>
        {log.participants.length ? (
          <ul>
            {log.participants.map((participant) => (
              <li key={participant.id}>
                {participant.isChild ? "Protected participant" : participant.displayNameSnapshot}{" "}
                <button type="button" disabled={!csrf} onClick={() => void removeParticipant(participant.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No additional participants are selected.</p>
        )}
      </section>
      <section className="community-workflow__panel" aria-labelledby="voyage-log-restrictions-title">
        <h2 id="voyage-log-restrictions-title">Creator sharing restrictions</h2>
        {log.restrictions.length ? (
          <ul>
            {log.restrictions.map((restriction) => (
              <li key={restriction}>{restriction.replaceAll("_", " ")}</li>
            ))}
          </ul>
        ) : (
          <p>No Creator sharing restrictions are recorded for this Voyage.</p>
        )}
      </section>
      <VoyageLogConsentPanel voyageLogId={log.id} />
      <VoyageLogMediaPanel voyageLogId={log.id} />
      <section
        className="community-workflow__panel community-workflow__panel--publication"
        aria-labelledby="voyage-log-publication-title"
      >
        <h2 id="voyage-log-publication-title">Publication and lifecycle</h2>
        <p>
          Publishing rechecks provenance, consent, media safety, restrictions, location safety, and visibility in one
          transaction.
        </p>
        <button type="button" disabled={!csrf || log.lifecycleState !== "READY"} onClick={() => void publish()}>
          Publish Voyage Log
        </button>
        <button
          type="button"
          disabled={
            !csrf || !["DRAFT", "CONSENT_PENDING", "CONSENT_REVIEW_REQUIRED", "ARCHIVED"].includes(log.lifecycleState)
          }
          onClick={() => void transition("READY")}
        >
          Mark ready for review
        </button>
        <button
          type="button"
          disabled={!csrf || log.lifecycleState === "REMOVED"}
          onClick={() => void transition("ARCHIVED")}
        >
          Archive
        </button>
        <button
          type="button"
          disabled={!csrf || log.lifecycleState === "REMOVED"}
          onClick={() => void transition("REMOVED")}
        >
          Remove permanently
        </button>
      </section>
    </section>
  );
}
