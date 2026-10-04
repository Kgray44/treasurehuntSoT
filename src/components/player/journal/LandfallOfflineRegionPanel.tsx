"use client";
import { useEffect, useRef, useState } from "react";
import {
  prepareLandfallRegion,
  restoreLandfallRegion,
  downloadLandfallRegion,
  extendLandfallRegionLease,
  removeLandfallRegionLease,
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
  return (
    <OfflineRegionPanel
      key={JSON.stringify([sessionId, publishedVersionId, sequence, csrfToken])}
      sessionId={sessionId}
      publishedVersionId={publishedVersionId}
      sequence={sequence}
      csrfToken={csrfToken}
    />
  );
}
function OfflineRegionPanel({
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
  const [prepared, setPrepared] = useState(false);
  const [details, setDetails] = useState<{
    totalBytes: number;
    downloadedBytes: number;
    expiresAt: number;
    assets: number;
  } | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    let disposed = false;
    generation.current++;
    const owned = generation.current;
    client.current = null;
    void restoreLandfallRegion(sessionId, publishedVersionId, csrfToken)
      .then(async (restored) => {
        if (!restored || disposed || owned !== generation.current) return;
        client.current = restored;
        const info = await restored.repository.status(
          restored.descriptor.envelope.manifest.id,
          restored.binding,
          sequence,
        );
        if (!disposed && owned === generation.current) {
          const manifest = restored.descriptor.envelope.manifest;
          setDetails({
            totalBytes: manifest.totalBytes,
            downloadedBytes: info.downloadedBytes,
            expiresAt: manifest.expiresAt,
            assets: manifest.resources.filter((value) => value.kind === "ASSET").length,
          });
          setAvailable(info.state !== "NOT_AVAILABLE");
          setStatus(
            `Offline region: ${info.state.toLowerCase()}. ${Math.round(info.downloadedBytes / 1024)} KB saved. Authorization expires ${new Date(info.expiresAt ?? restored.binding.leaseExpiresAt).toLocaleTimeString()}.`,
          );
        }
      })
      .catch(() => {
        if (!disposed && owned === generation.current)
          setStatus("The saved offline region could not be checked. Refresh when a connection is available.");
      });
    const clear = () => {
      client.current = null;
      generation.current++;
      setPrepared(false);
      setDetails(null);
      setBusy(false);
      setAvailable(false);
      setStatus("Offline region removed because Voyage access changed.");
    };
    const invalidate = () => {
      generation.current++;
    };
    window.addEventListener("landfall-offline-cleared", clear);
    return () => {
      disposed = true;
      invalidate();
      window.removeEventListener("landfall-offline-cleared", clear);
    };
  }, [sessionId, publishedVersionId, csrfToken, sequence]);
  const prepare = async () => {
    if (busy) return;
    const owned = ++generation.current;
    setBusy(true);
    setPrepared(false);
    setStatus("Checking released chart availability and download size…");
    try {
      const prepared = await prepareLandfallRegion(sessionId, csrfToken);
      if (owned !== generation.current) return;
      if (prepared.descriptor.envelope.manifest.scope.publishedVersionId !== publishedVersionId)
        throw new Error("VERSION_CHANGED");
      client.current = prepared;
      const manifest = prepared.descriptor.envelope.manifest;
      const info = await prepared.repository.status(manifest.id, prepared.binding, sequence);
      if (owned !== generation.current) return;
      setDetails({
        totalBytes: manifest.totalBytes,
        downloadedBytes: info.downloadedBytes,
        expiresAt: manifest.expiresAt,
        assets: manifest.resources.filter((value) => value.kind === "ASSET").length,
      });
      setPrepared(true);
      setStatus(
        `Ready to download the released chart and routes. First-party assets: ${prepared.descriptor.availability.assets.toLowerCase()}. External map tiles require a connection.`,
      );
    } catch {
      if (owned === generation.current)
        setStatus(
          "Offline preparation is unavailable. A connection, current Voyage access and deployment support are required. The saved chart remains available where already prepared.",
        );
    } finally {
      if (owned === generation.current) setBusy(false);
    }
  };
  const download = async () => {
    const prepared = client.current;
    if (!prepared || busy) return;
    const owned = generation.current;
    setBusy(true);
    setStatus("Downloading and checking each released resource…");
    try {
      const state = await downloadLandfallRegion(prepared, (value) => {
        if (owned === generation.current) setDetails((previous) => (previous ? { ...previous, ...value } : null));
      });
      if (owned !== generation.current) return;
      const restart = ["READY", "PARTIAL"].includes(state)
        ? await extendLandfallRegionLease(prepared, csrfToken)
        : "UNAVAILABLE";
      if (owned !== generation.current) return;
      const info = await prepared.repository.status(
        prepared.descriptor.envelope.manifest.id,
        prepared.binding,
        sequence,
      );
      if (owned !== generation.current) return;
      setDetails((previous) => (previous ? { ...previous, downloadedBytes: info.downloadedBytes } : null));
      setAvailable(true);
      setPrepared(false);
      setStatus(
        `Offline region: ${state.toLowerCase()}. First-party assets: ${prepared.descriptor.availability.assets.toLowerCase()}. ${restart === "NATIVE_PREPARED" ? "The companion saved a bounded restart lease; keep the prepared offline shell available." : restart === "TAB_ONLY" ? "Keep this tab open to retain offline access." : "Restart access could not be prepared; keep this view open."} External map tiles require a connection. Evidence remains unconfirmed until the Voyage accepts it online.`,
      );
    } catch (error) {
      if (owned !== generation.current) return;
      setStatus(
        error instanceof Error && error.message === "LANDFALL_DOWNLOAD_POWER_PAUSED"
          ? "Region download is paused to conserve power or reduce heat. Saved guidance remains available. Try again when the device recovers."
          : "The region could not be prepared. A connection and current Voyage access are required; the chart remains readable where already saved.",
      );
    } finally {
      if (owned === generation.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (!client.current || busy) return;
    const removing = client.current;
    const owned = ++generation.current;
    setBusy(true);
    try {
      await removing.repository.remove(removing.descriptor.envelope.manifest.id, removing.binding);
      await removeLandfallRegionLease(sessionId);
      if (owned !== generation.current) return;
      setAvailable(false);
      setPrepared(false);
      setDetails(null);
      setStatus("Offline region removed from this device.");
    } catch {
      if (owned === generation.current) setStatus("The region could not be removed. Try again.");
    } finally {
      if (owned === generation.current) setBusy(false);
    }
  };
  return (
    <section aria-label="Offline region">
      <p role="status">{status}</p>
      {details && (
        <div>
          <p>
            Download size: {Math.ceil(details.totalBytes / 1024)} KB. Includes the released chart, authored routes and{" "}
            {details.assets} authorized first-party images.
          </p>
          <p>
            Verified resources saved: {Math.ceil(details.downloadedBytes / 1024)} KB. Encrypted storage adds a small
            overhead. Authorization expires {new Date(details.expiresAt).toLocaleString()}.
          </p>
          <progress aria-label="Verified offline download" value={details.downloadedBytes} max={details.totalBytes} />
        </div>
      )}
      <p>
        Partial regions need a connection to resume. Stale regions need a refresh after the Voyage changes. Refresh
        checks the current released version; hidden future content is excluded.
      </p>
      <p>
        Removing this device&apos;s offline region preserves your saved Chronicle history. External tiles and online
        suggestions are not included.
      </p>
      <button type="button" disabled={busy} onClick={() => void prepare()}>
        {available ? "Refresh or resume offline region" : "Prepare offline region"}
      </button>
      {prepared && (
        <button type="button" disabled={busy} onClick={() => void download()}>
          Download offline region
        </button>
      )}
      {available && (
        <button type="button" disabled={busy} onClick={() => void remove()}>
          Remove offline region
        </button>
      )}
    </section>
  );
}
