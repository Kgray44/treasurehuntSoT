"use client";

import { useEffect, useState } from "react";
import { offlineLease, clearLandfallOfflineData, type OfflineLease } from "@/landfall/offline-store";
import { restoreOfflineVoyage } from "@/landfall/offline-web";
import { restoreNativeLandfallLeases } from "@/landfall/native-private-store";
import { LandfallJournalChart, LandfallJournalProvider } from "@/components/player/journal/LandfallJournalChart";

export function OfflineLandfallJournal() {
  const [lease, setLease] = useState<OfflineLease | null>(null);
  const [record, setRecord] = useState<Awaited<ReturnType<typeof restoreOfflineVoyage>>>(null);
  const [message, setMessage] = useState("Restoring your previously authorized Voyage…");
  useEffect(() => {
    let mounted = true;
    const sessionId = new URLSearchParams(location.search).get("session") ?? "";
    let expiry: number | undefined;
    let bound: OfflineLease | null = null;
    const cleared = () => {
      mounted = false;
      setRecord(null);
      setLease(null);
      setMessage("Offline access was cleared. Reconnect and sign in to continue.");
    };
    window.addEventListener("landfall-offline-cleared", cleared);
    void (async () => {
      await restoreNativeLandfallLeases();
      if (!mounted) return;
      bound = offlineLease(sessionId);
      if (!bound) {
        queueMicrotask(
          () =>
            mounted &&
            setMessage(
              "No unexpired offline Voyage is available in this tab. Connect and open your Journal while signed in.",
            ),
        );
        return;
      }
      await restoreOfflineVoyage(bound.sessionId, bound.versionId, bound.csrfToken)
        .then((restored) => {
          if (!mounted) return;
          if (!restored) {
            setMessage("This offline Voyage expired or could not be restored. Reconnect to verify access.");
            return;
          }
          setLease(bound);
          setRecord(restored);
        })
        .catch(() => {
          if (mounted) setMessage("Offline storage is unavailable. Reconnect to open the Journal.");
        });
      expiry = window.setInterval(() => {
        if (bound && Date.now() >= bound.expiresAt) void clearLandfallOfflineData();
      }, 5_000);
    })().catch(() => {
      if (mounted) setMessage("Offline access could not be restored. Reconnect to verify access.");
    });
    return () => {
      mounted = false;
      window.removeEventListener("landfall-offline-cleared", cleared);
      window.clearInterval(expiry);
    };
  }, []);
  return (
    <main className="landfall-offline-journal">
      <h1>Offline Voyage Journal</h1>
      <p role="status">
        Already-released content only. Progress requires server reconciliation. Offline access expires at the saved
        authorization deadline.
      </p>
      {lease && record ? (
        <>
          <LandfallJournalProvider
            sessionId={lease.sessionId}
            publishedVersionId={lease.versionId}
            csrfToken={lease.csrfToken}
            historical={record.bootstrap.replayOnly}
            revision={record.bootstrap.currentSequence}
            enabled
            mode="reduced"
            onProgress={() => {
              location.assign(`/player/playthroughs/${encodeURIComponent(lease.sessionId)}/journal`);
            }}
          >
            <LandfallJournalChart />
          </LandfallJournalProvider>
          <section aria-label="Released Landfall Passages">
            {record.passages.map((passage) => (
              <article key={passage.id}>
                <h2>{passage.title}</h2>
                <p>{String(passage.configuration.body ?? passage.configuration.prompt ?? "")}</p>
                <p>{passage.progress === "completed" ? "Previously completed" : "Released at last synchronization"}</p>
              </article>
            ))}
          </section>
          <a href={`/player/playthroughs/${encodeURIComponent(lease.sessionId)}/journal`}>
            Return to the online Journal
          </a>
          <button onClick={() => void clearLandfallOfflineData()}>Clear offline Voyage data</button>
        </>
      ) : (
        <p role="status">{message}</p>
      )}
    </main>
  );
}
