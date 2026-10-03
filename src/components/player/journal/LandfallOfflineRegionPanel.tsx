"use client";
import { useEffect, useRef, useState } from "react";
import {
  prepareLandfallRegion,
  restoreLandfallRegion,
  downloadLandfallRegion,
  extendLandfallRegionLease,
  type LandfallWebPackage,
} from "@/landfall/offline-package-web";

export function LandfallOfflineRegionPanel({
  sessionId,
  publishedVersionId,
  sequence,
  csrfToken,
}: {
  sessionId: string;
  publishedVersionId: string;
  sequence: number;
  csrfToken: string;
}) {
  const client = useRef<LandfallWebPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("No offline region prepared.");
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let disposed = false;
    void restoreLandfallRegion(sessionId, publishedVersionId, csrfToken).then(async (restored) => {
      if (!restored || disposed) return;
      client.current = restored;
      const info = await restored.repository.status(
        restored.descriptor.envelope.manifest.id,
        restored.binding,
        sequence,
      );
      if (!disposed) {
        setAvailable(info.state !== "NOT_AVAILABLE");
        setStatus(
          `Offline region: ${info.state.toLowerCase()}. ${Math.round(info.downloadedBytes / 1024)} KB saved. Authorization expires ${new Date(info.expiresAt ?? restored.binding.leaseExpiresAt).toLocaleTimeString()}.`,
        );
      }
    });
    const clear = () => {
      client.current = null;
      setAvailable(false);
      setStatus("Offline region removed because Voyage access changed.");
    };
    window.addEventListener("landfall-offline-cleared", clear);
    return () => {
      disposed = true;
      window.removeEventListener("landfall-offline-cleared", clear);
    };
  }, [sessionId, publishedVersionId, csrfToken, sequence]);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Preparing the released chart and authorized assets…");
    try {
      const prepared = await prepareLandfallRegion(sessionId, csrfToken);
      if (prepared.descriptor.envelope.manifest.scope.publishedVersionId !== publishedVersionId)
        throw new Error("VERSION_CHANGED");
      client.current = prepared;
      const state = await downloadLandfallRegion(prepared);
      if (["READY", "PARTIAL"].includes(state)) extendLandfallRegionLease(prepared, csrfToken);
      setAvailable(true);
      setStatus(
        `Offline region: ${state.toLowerCase()}. First-party assets: ${prepared.descriptor.availability.assets.toLowerCase()}. External map tiles require a connection. Evidence remains unconfirmed until the Voyage accepts it online.`,
      );
    } catch {
      setStatus(
        "The region could not be prepared. A connection and current Voyage access are required; the chart remains readable where already saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!client.current || busy) return;
    setBusy(true);
    try {
      await client.current.repository.remove(client.current.descriptor.envelope.manifest.id, client.current.binding);
      setAvailable(false);
      setStatus("Offline region removed from this device.");
    } catch {
      setStatus("The region could not be removed. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Offline region">
      <p role="status">{status}</p>
      <button type="button" disabled={busy} onClick={() => void download()}>
        {available ? "Refresh or resume offline region" : "Prepare offline region"}
      </button>
      {available && (
        <button type="button" disabled={busy} onClick={() => void remove()}>
          Remove offline region
        </button>
      )}
    </section>
  );
}
