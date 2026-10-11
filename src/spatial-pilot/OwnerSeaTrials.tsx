"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { activityStates, pilotActivities } from "./activities";
import type { readPilot } from "./service";
import styles from "./pilot.module.css";
type Pilot = Awaited<ReturnType<typeof readPilot>>;
type Feedback = Record<
  string,
  { state: (typeof activityStates)[number]; happened: string; expected: string; notes: string }
>;
export function OwnerSeaTrials({ initialPilot, csrfToken }: { initialPilot: Pilot; csrfToken: string }) {
  const [pilot, setPilot] = useState(initialPilot),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({}),
    [restoredKey, setRestoredKey] = useState<string | null>(null);
  const key = `voyagewright:${pilot?.versionId ?? "unprovisioned"}:owner-sea-trials`;
  useEffect(() => {
    let active = true;
    const next: Feedback = {};
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "{}");
      for (const item of pilotActivities) {
        const row = raw[item.id];
        if (
          row &&
          activityStates.includes(row.state) &&
          [row.happened, row.expected, row.notes].every((s) => typeof s === "string" && s.length <= 4000)
        )
          next[item.id] = row;
      }
    } catch {
      /* Keep a usable form when browser storage is unavailable. */
    }
    queueMicrotask(() => {
      if (!active) return;
      setFeedback(next);
      setRestoredKey(key);
    });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (restoredKey !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(feedback));
    } catch {
      queueMicrotask(() => setMessage("Browser storage is unavailable. Export your report before leaving."));
    }
  }, [feedback, key, restoredKey]);
  async function provision(action: "provision" | "replay") {
    setBusy(true);
    setMessage("Preparing the authored voyage and its immutable publication…");
    try {
      const response = await fetch("/api/dev/spatial-pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The pilot could not be prepared.");
      setPilot(result);
      setMessage(
        action === "replay"
          ? "A fresh Voyage is ready. Earlier runs and this edition are preserved."
          : "Your voyage is ready. Open the adventure below.",
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The pilot could not be prepared. Try again.");
    } finally {
      setBusy(false);
    }
  }
  function update(id: string, patch: Partial<Feedback[string]>) {
    setFeedback((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { state: "Not started", happened: "", expected: "", notes: "" }), ...patch },
    }));
  }
  function exportReport() {
    const report = {
      schemaVersion: 1,
      kind: "SPATIAL_PILOT_OWNER_FEEDBACK",
      exportedAt: new Date().toISOString(),
      pilot,
      browser: { userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight } },
      evidenceClassification: "Owner-entered judgments; no automatic hardware acceptance",
      activities: pilotActivities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        route: destination(activity.destination),
        ...feedback[activity.id],
        state: feedback[activity.id]?.state ?? "Not started",
      })),
      cameraImageryIncluded: false,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lost-navigator-owner-sea-trials.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function destination(type: string) {
    if (type === "journal") return pilot?.journalHref ?? null;
    if (type === "devices") return pilot?.voyageId ? `/account/devices?voyage=${pilot.voyageId}` : null;
    if (type === "studio") return pilot?.studioHref ?? null;
    if (type === "reach") return "/devices/reach";
    return null;
  }
  return (
    <main className={styles.session}>
      <header className={styles.hero}>
        <p className="eyebrow">Voyagewright · Owner Sea Trials</p>
        <h1>The Lost Navigator’s Chart</h1>
        <p className={styles.intro}>
          A promise beyond the last marked island. One adventure, two horizons, and a light left burning.
        </p>
        <p>Play the story first. This private synthetic session keeps the device, Studio, and Reach trials together.</p>
        <div className={styles.actions}>
          {pilot?.journalHref ? (
            <Link className={styles.primary} href={pilot.journalHref}>
              Open the adventure
            </Link>
          ) : (
            <button disabled={busy} onClick={() => void provision("provision")}>
              Prepare the adventure
            </button>
          )}
          {pilot?.versionId && (
            <button disabled={busy} onClick={() => void provision("replay")}>
              Start a fresh Voyage
            </button>
          )}
          <button onClick={exportReport}>Export one feedback report</button>
        </div>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </header>
      <section aria-label="Session preparation" className={styles.preparation}>
        <h2>Before you set sail</h2>
        <p>
          Use the supplied local synthetic navigator sign-in on computer and phone. Pairing joins the same person and
          Voyage. Keep this page open while you play; your notes stay in this browser and export without an external
          account.
        </p>
        <p>
          On the computer, use the preview’s localhost address so Reach can request the webcam. On the phone, use this
          computer’s reachable network address and sign into the same navigator. Pair using the displayed code when the
          pairing link points to localhost. Plain network HTTP supports the story, chart and manual handoff; phone
          camera and motion require a trusted secure context. Use the screen clue for unavailable sensors. A webcam and
          representative operator are required for physical Reach trials.
        </p>
        <p className={styles.pending}>OWNER_ACCEPTANCE_PENDING · OWNER_PHYSICAL_ACCEPTANCE_PENDING</p>
        <p>
          Finish the adventure before opening Spatial Studio; Creator access pauses during active Player participation.
          Starting a fresh Voyage cancels your unfinished pilot run through Captain controls and preserves its record
          and publication.
        </p>
        {pilot && (
          <p className={styles.provenance}>
            Edition {pilot.versionLabel ?? "unpublished"} · Voyage {pilot.status} · source {pilot.sourceCommit}
            <br />
            Publication {pilot.versionId ?? "pending"} · checksum {pilot.checksum ?? "pending"}
          </p>
        )}
      </section>
      <ol className={styles.activities}>
        {pilotActivities.map((activity, index) => {
          const row = feedback[activity.id],
            href = destination(activity.destination);
          return (
            <li key={activity.id} className={styles.activity}>
              <div className={styles.activityHeading}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <h2>{activity.title}</h2>
              </div>
              <p>{activity.detail}</p>
              {href && (
                <Link href={href} target="_blank" rel="noopener">
                  Open{" "}
                  {activity.destination === "reach"
                    ? "Reach laboratory"
                    : activity.destination === "studio"
                      ? "Spatial Studio"
                      : activity.destination === "devices"
                        ? "Voyage devices"
                        : "Journal"}{" "}
                  ↗
                </Link>
              )}
              <label>
                Trial status
                <select
                  value={row?.state ?? "Not started"}
                  onChange={(event) => update(activity.id, { state: event.target.value as Feedback[string]["state"] })}
                >
                  {activityStates.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </label>
              <details>
                <summary>Record feedback</summary>
                <label>
                  What happened?
                  <textarea
                    maxLength={4000}
                    value={row?.happened ?? ""}
                    onChange={(e) => update(activity.id, { happened: e.target.value })}
                  />
                </label>
                <label>
                  What was expected?
                  <textarea
                    maxLength={4000}
                    value={row?.expected ?? ""}
                    onChange={(e) => update(activity.id, { expected: e.target.value })}
                  />
                </label>
                <label>
                  Clarity, responsiveness, polish, immersion, severity and notes
                  <textarea
                    maxLength={4000}
                    value={row?.notes ?? ""}
                    onChange={(e) => update(activity.id, { notes: e.target.value })}
                  />
                </label>
              </details>
            </li>
          );
        })}
      </ol>
      <footer>
        <Link href="/player/library">Player Library</Link>
        <span> · </span>
        <Link href="/studio">Creator Studio</Link>
        <p>
          Synthetic browser evidence and native simulation do not certify physical hardware. Export only the feedback
          you intend to share; no camera images or pairing secrets are attached automatically.
        </p>
      </footer>
    </main>
  );
}
