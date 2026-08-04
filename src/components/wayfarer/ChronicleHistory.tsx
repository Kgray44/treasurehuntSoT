"use client";

import { useEffect, useState } from "react";

type RecordItem = {
  id: string;
  chronicle: { title: string; versionChecksum: string };
  lifecycleStatus: string;
  outcome: string;
  timestamps: { completedAt?: string | null };
  timing: { wallClock: { seconds: number | null; accuracy: string } };
  memories: Array<{ id: string; title: string }>;
  keepsake: { status: string } | null;
};

export function ChronicleHistory() {
  const [items, setItems] = useState<RecordItem[]>([]);
  const [csrf, setCsrf] = useState("");
  const [message, setMessage] = useState("Loading private Chronicle history…");
  const load = async () => {
    const response = await fetch("/api/passport/history");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load Chronicle history.");
    setItems(body.items);
    setMessage(body.items.length ? "" : "No historical Voyages have been recorded yet.");
  };
  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([load(), fetch("/api/auth/sessions").then((response) => response.json())])
        .then(([, sessions]) => setCsrf(sessions.csrfToken ?? ""))
        .catch((cause) => setMessage(cause instanceof Error ? cause.message : "Unable to load Chronicle history."));
    });
  }, []);
  const keepsake = async (id: string) => {
    const response = await fetch(`/api/passport/history/${id}/keepsake`, {
      method: "POST",
      headers: { "x-csrf-token": csrf },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to prepare Keepsake.");
    setMessage("Private Keepsake prepared. Other crew members remain excluded until they consent.");
    await load();
  };
  return (
    <section id="history">
      <h2>Chronicle history</h2>
      <p>
        Version-pinned private Voyage records update automatically. Timing reports unavailable evidence explicitly
        rather than guessing.
      </p>
      <p aria-live="polite">{message}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <h3>{item.chronicle.title}</h3>
            <p>
              {item.lifecycleStatus} · outcome: {item.outcome}
            </p>
            <p>Version-pinned Chronicle record</p>
            <p>
              Wall-clock: {item.timing.wallClock.seconds ?? "unavailable"} ({item.timing.wallClock.accuracy})
            </p>
            <p>Private Memories: {item.memories.length}</p>
            <button type="button" onClick={() => void keepsake(item.id).catch((cause) => setMessage(cause.message))}>
              {item.keepsake ? "Regenerate private Keepsake" : "Generate private Keepsake"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
