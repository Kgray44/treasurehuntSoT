"use client";

/* eslint-disable @next/next/no-img-element -- thumbnails are local OS-owned data URLs, never remote content */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DesktopCapturePlatformAdapter,
  WebCapturePlatformAdapter,
  selectCapturePlatformAdapter,
} from "@/vision/capture-adapters";
import type { CaptureCapabilities, CaptureStatus, CaptureTarget, CreatorStartInput } from "@/vision/capture-protocol";
import type { VisionFeatureFlags } from "@/vision/feature-flags";

type PairingSummary = {
  pairingId: string;
  allowedOrigin: string;
  pairingCode?: string;
  desktopApproved?: boolean;
  expiresAt: string;
  revokedAt?: string | null;
};

const creatorPurposes: CreatorStartInput["purpose"][] = [
  "TARGET_REFERENCE",
  "ACCEPTED_AREA_WALK",
  "BOUNDARY",
  "ENVIRONMENTAL_VARIATION",
  "NEARBY_HARD_NEGATIVE",
  "DISTANT_HARD_NEGATIVE",
  "INVALID_POSE",
  "DIAGNOSTIC_POSITIVE",
  "DIAGNOSTIC_NEGATIVE",
];

function errorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "userMessage" in error) return String(error.userMessage);
  return error instanceof Error ? error.message : "The Companion request failed.";
}

function safeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function VisionCompanionDashboard({ featureFlags }: { featureFlags: VisionFeatureFlags }) {
  const adapter = useMemo(() => selectCapturePlatformAdapter(), []);
  const desktop = adapter instanceof DesktopCapturePlatformAdapter ? adapter : null;
  const browser = adapter instanceof WebCapturePlatformAdapter ? adapter : null;
  const [connected, setConnected] = useState(Boolean(desktop));
  const [capabilities, setCapabilities] = useState<CaptureCapabilities | null>(null);
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, unknown>[]>([]);
  const [pendingPairings, setPendingPairings] = useState<PairingSummary[]>([]);
  const [approvedPairings, setApprovedPairings] = useState<PairingSummary[]>([]);
  const [pairingRequested, setPairingRequested] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [creatorPurpose, setCreatorPurpose] = useState<CreatorStartInput["purpose"]>("TARGET_REFERENCE");
  const [creatorLabel, setCreatorLabel] = useState("B-2 target reference");
  const [waypointVersionId, setWaypointVersionId] = useState("waypoint_version_b2_demo");
  const [creatorSessionId, setCreatorSessionId] = useState<string | null>(null);
  const [creatorResult, setCreatorResult] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<{ previewUrl: string; expiresAt: string } | null>(null);
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [diagnosticDownload, setDiagnosticDownload] = useState<{ downloadUrl: string; expiresAt: string } | null>(null);
  const [serverCsrfToken, setServerCsrfToken] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState("Local Companion storage only");
  const [hotkeyBinding, setHotkeyBinding] = useState("Control+Alt+F9");
  const [hotkeyInteraction, setHotkeyInteraction] = useState<"HOLD" | "TOGGLE">("HOLD");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const releaseRequested = useRef(false);
  const scanSessionRef = useRef<string | null>(null);
  const persistedArtifactIds = useRef(new Set<string>());

  const persistCreatorResult = useCallback(
    async (result: Record<string, unknown>) => {
      const artifact = result.artifact as { artifactId?: string } | undefined;
      const artifactId = artifact?.artifactId;
      if (!artifactId || !serverCsrfToken || persistedArtifactIds.current.has(artifactId)) return;
      persistedArtifactIds.current.add(artifactId);
      setPersistenceStatus("Saving capture manifest to the waypoint draft...");
      try {
        const response = await fetch("/api/vision-capture-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": serverCsrfToken },
          body: JSON.stringify(artifact),
        });
        const body = (await response.json()) as { error?: string; idempotent?: boolean };
        if (!response.ok)
          throw new Error(body.error ?? "The capture manifest could not be saved to the waypoint draft.");
        setPersistenceStatus(
          body.idempotent ? "Waypoint manifest already saved" : "Waypoint manifest and audit event saved",
        );
      } catch (cause) {
        persistedArtifactIds.current.delete(artifactId);
        setPersistenceStatus("Local recording retained; waypoint manifest save failed");
        throw cause;
      }
    },
    [serverCsrfToken],
  );

  const loadRuntime = useCallback(async () => {
    const [nextCapabilities, nextStatus, nextArtifacts] = await Promise.all([
      adapter.getCapabilities(),
      adapter.getStatus(),
      adapter.listCreatorArtifacts(),
    ]);
    setCapabilities(nextCapabilities);
    setStatus(nextStatus);
    setArtifacts(nextArtifacts);
    setConnected(true);
  }, [adapter]);

  const loadPairings = useCallback(async () => {
    if (!desktop) return;
    const [pending, approved] = await Promise.all([desktop.listPendingPairings(), desktop.listPairings()]);
    const pendingValue = pending as { pairings?: PairingSummary[] };
    const approvedValue = approved as { pairings?: PairingSummary[] };
    setPendingPairings(Array.isArray(pendingValue.pairings) ? pendingValue.pairings : []);
    setApprovedPairings(Array.isArray(approvedValue.pairings) ? approvedValue.pairings : []);
  }, [desktop]);

  useEffect(() => {
    void fetch("/api/vision-capture-sessions", { cache: "no-store" })
      .then(async (response) => ({ response, body: (await response.json()) as { csrfToken?: string } }))
      .then(({ response, body }) => {
        if (response.ok && body.csrfToken) {
          setServerCsrfToken(body.csrfToken);
          setPersistenceStatus("Ready to persist creator manifests to owned waypoint drafts");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (desktop) queueMicrotask(() => void loadRuntime().catch((cause) => setError(errorMessage(cause))));
    const unsubscribe = adapter.subscribe((event) => {
      if (event.eventName === "status") setStatus(event.payload as CaptureStatus);
      if (event.eventName === "capture-completed") {
        const result = event.payload as Record<string, unknown>;
        if (result.artifact) {
          setCreatorResult(result);
          void persistCreatorResult(result).catch((cause) => setError(errorMessage(cause)));
        }
        if (result.evidenceBundle) setScanResult(result);
      }
      if (event.eventName === "capture-error") setError(errorMessage(event.payload));
    });
    return unsubscribe;
  }, [adapter, desktop, loadRuntime, persistCreatorResult]);

  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => {
      void adapter
        .getStatus()
        .then(setStatus)
        .catch(() => setConnected(false));
      if (desktop) void loadPairings();
    }, 1_000);
    return () => clearInterval(timer);
  }, [adapter, connected, desktop, loadPairings]);

  async function perform(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy("");
    }
  }

  async function requestPairing() {
    if (!browser) return;
    await perform("pair-request", async () => {
      await browser.requestPairing();
      setPairingRequested(true);
    });
  }

  async function completePairing() {
    if (!browser) return;
    await perform("pair-complete", async () => {
      await browser.completePairing(pairingCode);
      await loadRuntime();
      setPairingCode("");
    });
  }

  async function refreshTargets() {
    await perform("targets", async () => setTargets(await adapter.listTargets()));
  }

  async function selectTarget(targetId: string) {
    await perform("target-select", async () => {
      await adapter.selectTarget(targetId, false);
      setStatus(await adapter.getStatus());
    });
  }

  async function startCreator() {
    await perform("creator-start", async () => {
      const result = await adapter.beginCreatorRecording({
        requestId: safeId("request"),
        waypointVersionId,
        purpose: creatorPurpose,
        label: creatorLabel,
        allowCloudUpload: false,
        maxDurationMs: 120_000,
      });
      setCreatorSessionId(String(result.sessionId));
      setCreatorResult(null);
    });
  }

  async function stopCreator() {
    if (!creatorSessionId) return;
    await perform("creator-stop", async () => {
      const result = await adapter.stopCreator(creatorSessionId);
      setCreatorResult(result);
      await persistCreatorResult(result);
      setCreatorSessionId(null);
      setArtifacts(await adapter.listCreatorArtifacts());
    });
  }

  async function deleteCreatorArtifact(artifactId: string) {
    if (!window.confirm("Delete this managed local recording? This cannot be undone.")) return;
    await perform("creator-delete", async () => {
      await adapter.deleteCreatorArtifact(artifactId);
      if (serverCsrfToken) {
        const response = await fetch(`/api/vision-capture-sessions/${encodeURIComponent(artifactId)}`, {
          method: "DELETE",
          headers: { "x-csrf-token": serverCsrfToken },
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "The server-side capture record could not be marked deleted.");
        }
      }
      setArtifacts(await adapter.listCreatorArtifacts());
      setPersistenceStatus(
        serverCsrfToken ? "Local recording deleted and audit record updated" : "Local recording deleted",
      );
    });
  }

  async function cancelCreator() {
    if (!creatorSessionId) return;
    await perform("creator-cancel", async () => {
      await adapter.cancelCreator(creatorSessionId);
      setCreatorSessionId(null);
    });
  }

  async function beginScan() {
    if (scanSessionRef.current || busy) return;
    releaseRequested.current = false;
    setBusy("scan-start");
    setError("");
    setScanResult(null);
    try {
      const result = await adapter.beginPlayerScan({
        requestId: safeId("request"),
        attemptId: safeId("attempt"),
        durationMs: 5_000,
        sampleFps: 10,
        minimumFrames: 6,
      });
      scanSessionRef.current = result.sessionId;
      setScanSessionId(result.sessionId);
      setBusy("");
      if (releaseRequested.current) await finishScan();
    } catch (cause) {
      setBusy("");
      setError(errorMessage(cause));
    }
  }

  async function finishScan() {
    releaseRequested.current = true;
    const sessionId = scanSessionRef.current;
    if (!sessionId) return;
    await perform("scan-stop", async () => {
      const result = await adapter.stopPlayerScan(sessionId);
      setScanResult(result);
      scanSessionRef.current = null;
      setScanSessionId(null);
    });
  }

  async function cancelScan() {
    const sessionId = scanSessionRef.current;
    if (!sessionId) return;
    await perform("scan-cancel", async () => {
      await adapter.cancelPlayerScan(sessionId);
      scanSessionRef.current = null;
      setScanSessionId(null);
    });
  }

  const active = status?.privacy.captureIndicatorVisible;
  const evidence = scanResult?.evidenceBundle as
    | { selection?: { selectedFrameCount?: number }; retention?: { transientFramesCleared?: boolean } }
    | undefined;

  return (
    <main className="companion-page">
      <header className="companion-hero">
        <div>
          <p className="eyebrow">Phase B-2 · Native Companion</p>
          <h1>Capture with a visible, private boundary</h1>
          <p>
            This Companion captures only the window you explicitly select. Player scans remain memory-only. Capture
            quality never decides whether you are at a story location.
          </p>
        </div>
        <div
          className={`capture-indicator ${active ? "active" : status?.privacy.paused ? "paused" : "idle"}`}
          role="status"
        >
          <strong>{active ? "Vision Active" : status?.privacy.paused ? "Vision Paused" : "Capture Inactive"}</strong>
          <span>
            {status?.mode?.replaceAll("_", " ").toLocaleLowerCase() ??
              adapter.kind.replaceAll("_", " ").toLocaleLowerCase()}
          </span>
        </div>
      </header>

      <nav className="companion-nav" aria-label="Companion destinations">
        <Link href="/">Harbor</Link>
        <Link href="/studio">Studio</Link>
        <Link href="/player">Player</Link>
      </nav>

      {error && (
        <p className="companion-error" role="alert">
          {error}
        </p>
      )}

      {browser && !connected && (
        <section className="companion-panel">
          <p className="eyebrow">Browser pairing</p>
          <h2>Pair this website with the local Companion</h2>
          <ol>
            <li>Launch the Windows desktop Companion.</li>
            <li>Request pairing here.</li>
            <li>Approve the displayed origin in the desktop app.</li>
            <li>Enter the six-digit code shown only in the desktop Companion.</li>
          </ol>
          {!pairingRequested ? (
            <button type="button" onClick={() => void requestPairing()} disabled={Boolean(busy)}>
              Request local pairing
            </button>
          ) : (
            <div className="companion-inline-form">
              <label>
                <span>Pairing code</span>
                <input
                  value={pairingCode}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button
                type="button"
                onClick={() => void completePairing()}
                disabled={pairingCode.length !== 6 || Boolean(busy)}
              >
                Complete pairing
              </button>
            </div>
          )}
        </section>
      )}

      {connected && (
        <>
          <section className="companion-grid">
            <article className="companion-panel">
              <p className="eyebrow">Companion status</p>
              <h2>{status?.health.status ? String(status.health.status).replaceAll("_", " ") : "Connecting"}</h2>
              <dl className="companion-facts">
                <div>
                  <dt>Mode</dt>
                  <dd>{adapter.kind.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Protocol</dt>
                  <dd>{capabilities?.protocolVersion ?? "—"}</dd>
                </div>
                <div>
                  <dt>Capture API</dt>
                  <dd>{capabilities?.captureApi ?? "—"}</dd>
                </div>
                <div>
                  <dt>Selected window</dt>
                  <dd>{status?.target?.privacyLabel ?? "None"}</dd>
                </div>
                <div>
                  <dt>Player retention</dt>
                  <dd>Memory-only, cleared after use</dd>
                </div>
                <div>
                  <dt>Location decision</dt>
                  <dd>Not performed in B-2</dd>
                </div>
              </dl>
              <div className="companion-actions">
                <button
                  type="button"
                  onClick={() =>
                    void adapter
                      .pauseVision("USER_PRIVACY_PAUSE")
                      .then(() => adapter.getStatus())
                      .then(setStatus)
                  }
                >
                  Pause vision
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void adapter
                      .resumeVision()
                      .then(() => adapter.getStatus())
                      .then(setStatus)
                  }
                >
                  Resume vision
                </button>
                <button type="button" onClick={() => void adapter.getStatus().then(setStatus)}>
                  Refresh
                </button>
              </div>
            </article>

            <article className="companion-panel">
              <p className="eyebrow">Window selection</p>
              <h2>Select Sea of Thieves explicitly</h2>
              <p>No window is attached by title or process name. A likely match is highlighted only for convenience.</p>
              <button type="button" onClick={() => void refreshTargets()} disabled={Boolean(busy)}>
                Select Game Window
              </button>
              <div className="capture-target-list">
                {targets.map((target) => (
                  <button
                    type="button"
                    className={target.likelySeaOfThieves ? "likely-game" : ""}
                    key={target.targetId}
                    onClick={() => void selectTarget(target.targetId)}
                  >
                    {target.thumbnailDataUrl && (
                      <img src={target.thumbnailDataUrl} alt="Small live selection preview" />
                    )}
                    <span>
                      <strong>{target.privacyLabel}</strong>
                      <small>
                        {target.likelySeaOfThieves ? "Likely Sea of Thieves · confirm to select" : "Application window"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <section className="companion-grid">
            <article className="companion-panel">
              <p className="eyebrow">Creator Recording Mode</p>
              <h2>Record governed authoring footage</h2>
              <label>
                <span>Waypoint draft version ID</span>
                <input value={waypointVersionId} onChange={(event) => setWaypointVersionId(event.target.value)} />
              </label>
              <label>
                <span>Purpose</span>
                <select
                  value={creatorPurpose}
                  onChange={(event) => setCreatorPurpose(event.target.value as CreatorStartInput["purpose"])}
                >
                  {creatorPurposes.map((purpose) => (
                    <option key={purpose}>{purpose}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Label</span>
                <input value={creatorLabel} maxLength={120} onChange={(event) => setCreatorLabel(event.target.value)} />
              </label>
              <p className="companion-retention-note">Persistence: {persistenceStatus}</p>
              <div className="companion-actions">
                <button
                  type="button"
                  onClick={() => void startCreator()}
                  disabled={!status?.target || Boolean(creatorSessionId) || Boolean(busy)}
                >
                  Start recording
                </button>
                <button
                  type="button"
                  onClick={() => creatorSessionId && void adapter.pauseCreator(creatorSessionId)}
                  disabled={!creatorSessionId}
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => creatorSessionId && void adapter.resumeCreator(creatorSessionId)}
                  disabled={!creatorSessionId}
                >
                  Resume
                </button>
                <button type="button" onClick={() => void stopCreator()} disabled={!creatorSessionId}>
                  Stop and review
                </button>
                <button type="button" onClick={() => void cancelCreator()} disabled={!creatorSessionId}>
                  Discard
                </button>
              </div>
              {creatorSessionId && (
                <p role="status">
                  Recording active · {Math.round((status?.session?.progress ?? 0) * 100)}% ·{" "}
                  {status?.session?.frameCount ?? 0} quality samples
                </p>
              )}
              {creatorResult && <JsonSummary value={creatorResult} />}
            </article>

            <article className="companion-panel">
              <p className="eyebrow">Player Scan Mode</p>
              <h2>Hold to inspect real frames</h2>
              <p>
                Default scan: five seconds at 10 candidate frames per second. Release finalizes and clears raw frames.
              </p>
              <button
                type="button"
                className={`vision-hold-button ${scanSessionId ? "holding" : ""}`}
                disabled={!status?.target || Boolean(creatorSessionId) || (Boolean(busy) && !busy.startsWith("scan"))}
                style={{ "--scan-progress": `${(status?.session?.progress ?? 0) * 100}%` } as React.CSSProperties}
                onPointerDown={() => void beginScan()}
                onPointerUp={() => void finishScan()}
                onPointerCancel={() => void finishScan()}
                onKeyDown={(event) => {
                  if ((event.key === " " || event.key === "Enter") && !event.repeat) void beginScan();
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") void finishScan();
                }}
              >
                {scanSessionId
                  ? `Capturing · ${Math.round((status?.session?.progress ?? 0) * 100)}%`
                  : "Hold to Inspect Surroundings"}
              </button>
              <div className="companion-actions">
                <button
                  type="button"
                  onClick={() => void beginScan()}
                  disabled={!status?.target || Boolean(scanSessionId)}
                >
                  Toggle alternative: start
                </button>
                <button type="button" onClick={() => void finishScan()} disabled={!scanSessionId}>
                  Stop and curate
                </button>
                <button type="button" onClick={() => void cancelScan()} disabled={!scanSessionId}>
                  Cancel
                </button>
              </div>
              {scanResult && (
                <div className="capture-only-result" role="status">
                  <strong>{String(scanResult.result).replaceAll("_", " ")}</strong>
                  <span>{Number(evidence?.selection?.selectedFrameCount ?? 0)} diverse frames selected</span>
                  <span>Raw frames cleared: {String(evidence?.retention?.transientFramesCleared ?? false)}</span>
                  <small>Capture-only result. No location verification was performed.</small>
                </div>
              )}
            </article>
          </section>

          <section className="companion-grid">
            <article className="companion-panel">
              <p className="eyebrow">Creator artifacts</p>
              <h2>Managed local recordings</h2>
              {artifacts.length === 0 && <p>No retained creator recordings.</p>}
              {artifacts.map((artifact) => (
                <div className="artifact-row" key={String(artifact.artifactId)}>
                  <div>
                    <strong>
                      {String((artifact.metadata as { creatorLabel?: string })?.creatorLabel ?? artifact.artifactId)}
                    </strong>
                    <span>
                      {Math.round(Number(artifact.fileSize ?? 0) / 1024)} KiB · {String(artifact.contentHash ?? "")}
                    </span>
                  </div>
                  <div className="companion-actions">
                    <button
                      type="button"
                      onClick={() => void adapter.previewCreatorArtifact(String(artifact.artifactId)).then(setPreview)}
                    >
                      Preview
                    </button>
                    <button type="button" onClick={() => void deleteCreatorArtifact(String(artifact.artifactId))}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {preview && <video className="creator-preview" src={preview.previewUrl} controls autoPlay muted />}
            </article>

            <article className="companion-panel">
              <p className="eyebrow">Privacy and diagnostics</p>
              <h2>User-controlled retention</h2>
              <ul>
                <li>Player frames: memory-only</li>
                <li>Creator recordings: local until deleted</li>
                <li>Diagnostic frames: off; separate consent required</li>
                <li>Cloud upload: off</li>
              </ul>
              <button type="button" onClick={() => void adapter.createDiagnosticBundle(false).then(setDiagnostic)}>
                Create metadata-only diagnostic bundle
              </button>
              {diagnostic && <JsonSummary value={diagnostic} />}
              {typeof diagnostic?.bundleId === "string" && (
                <button
                  type="button"
                  onClick={() =>
                    void adapter.exportDiagnosticBundle(String(diagnostic.bundleId)).then(setDiagnosticDownload)
                  }
                >
                  Prepare diagnostic download
                </button>
              )}
              {diagnosticDownload && (
                <a href={diagnosticDownload.downloadUrl} download>
                  Download diagnostic bundle (link expires {new Date(diagnosticDownload.expiresAt).toLocaleTimeString()}
                  )
                </a>
              )}
            </article>
          </section>

          {desktop && (
            <section className="companion-grid">
              <article className="companion-panel">
                <p className="eyebrow">Global hotkey</p>
                <h2>Inspect Surroundings binding</h2>
                <label>
                  <span>Binding</span>
                  <select value={hotkeyBinding} onChange={(event) => setHotkeyBinding(event.target.value)}>
                    <option>Control+Alt+F9</option>
                    <option>Control+Shift+F10</option>
                    <option>F9</option>
                  </select>
                </label>
                <label>
                  <span>Interaction</span>
                  <select
                    value={hotkeyInteraction}
                    onChange={(event) => setHotkeyInteraction(event.target.value as "HOLD" | "TOGGLE")}
                  >
                    <option>HOLD</option>
                    <option>TOGGLE</option>
                  </select>
                </label>
                <div className="companion-actions">
                  <button
                    type="button"
                    onClick={() =>
                      void desktop
                        .configureHotkey(hotkeyBinding, hotkeyInteraction)
                        .then(() => desktop.getStatus())
                        .then(setStatus)
                        .catch((cause) => setError(errorMessage(cause)))
                    }
                  >
                    Register hotkey
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void desktop
                        .disableHotkey()
                        .then(() => desktop.getStatus())
                        .then(setStatus)
                    }
                  >
                    Disable hotkey
                  </button>
                </div>
                <p>
                  State: {String(status?.hotkey.state ?? "DISABLED")}. The monitor observes only this preset and never
                  suppresses or forwards input.
                </p>
              </article>

              <article className="companion-panel">
                <p className="eyebrow">Browser pairings</p>
                <h2>Approve exact origins</h2>
                <button type="button" onClick={() => void loadPairings()}>
                  Refresh pairing requests
                </button>
                {pendingPairings.map((pairing) => (
                  <div className="pairing-row" key={pairing.pairingId}>
                    <div>
                      <strong>{pairing.allowedOrigin}</strong>
                      <span>
                        Code {pairing.pairingCode} · expires {new Date(pairing.expiresAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="companion-actions">
                      <button
                        type="button"
                        onClick={() => void desktop.approvePairing(pairing.pairingId, true).then(loadPairings)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void desktop.approvePairing(pairing.pairingId, false).then(loadPairings)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {approvedPairings.map((pairing) => (
                  <div className="pairing-row" key={pairing.pairingId}>
                    <div>
                      <strong>{pairing.allowedOrigin}</strong>
                      <span>Expires {new Date(pairing.expiresAt).toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void desktop.revokePairing(pairing.pairingId).then(loadPairings)}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </article>
            </section>
          )}

          <details className="companion-panel">
            <summary>Developer capabilities and feature flags</summary>
            <JsonSummary value={{ capabilities, featureFlags, status }} />
          </details>
        </>
      )}
    </main>
  );
}

function JsonSummary({ value }: { value: unknown }) {
  return <pre className="companion-json">{JSON.stringify(value, null, 2)}</pre>;
}
