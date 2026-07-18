"use client";

import { useEffect, useState } from "react";

export function PwaRegistration() {
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV === "test") return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
      })
      .catch(() => undefined);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline && !waiting) return null;
  return (
    <aside className="pwa-truth-banner" role="status">
      {offline ? (
        <span>
          Offline: live stories, Studio, Captain controls, and verification remain unavailable until reconnected.
        </span>
      ) : (
        <span>An application-shell update is ready. Live data was not cached.</span>
      )}
      {waiting && (
        <button
          onClick={() => {
            waiting.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }}
        >
          Apply update
        </button>
      )}
    </aside>
  );
}
