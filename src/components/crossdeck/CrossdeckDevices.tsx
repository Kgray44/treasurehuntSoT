"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CHALLENGE_MS, HEARTBEAT_MS, roles, type SurfaceRole } from "@/crossdeck/contracts";
import type { SurfaceDto } from "@/crossdeck/service";
import { browserProjection, crossdeckRequest, storageKey } from "@/crossdeck/client";
import { signInHref } from "@/homeport/return-to";
import styles from "./CrossdeckDevices.module.css";
const roleNames: Record<SurfaceRole, string> = {
  PRIMARY_STORY: "Main story",
  CHRONICLE_LENS: "Chronicle Lens companion",
  CHART: "Chart",
  JOURNAL: "Journal",
  ARTIFACT_VIEWER: "Artifact viewer",
  SHARED_CREW_DISPLAY: "Crew display",
  AMBIENT: "Atmosphere",
  CAPTAIN_AUXILIARY: "Captain companion",
  CREATOR_PREVIEW: "Creator preview",
  ACCESSIBILITY_COMPANION: "Accessibility companion",
};
export function CrossdeckDevices({
  initialVoyage = "",
  compact = false,
}: {
  initialVoyage?: string;
  compact?: boolean;
}) {
  const [surfaces, setSurfaces] = useState<SurfaceDto[]>([]);
  const [voyages, setVoyages] = useState<{ id: string; title: string }[]>([]);
  const [voyage, setVoyage] = useState(initialVoyage);
  const [label, setLabel] = useState("My device");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ code: string; expiresAt: string; qr: string } | null>(null);
  const [role, setRole] = useState<SurfaceRole>("CHRONICLE_LENS");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [ready, setReady] = useState(false);
  const csrf = useRef("");
  const own = useRef<string | null>(null);
  const [ownId, setOwnId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(`/api/crossdeck${voyage ? `?voyage=${encodeURIComponent(voyage)}` : ""}`, {
        cache: "no-store",
        signal,
      });
      if (response.status === 403 && voyage) {
        setVoyage("");
        setSurfaces([]);
        setChallenge(null);
        own.current = null;
        setOwnId(null);
        setMessage("This Voyage is no longer available. Choose another Voyage to connect.");
        return;
      }
      if (response.status === 401) {
        setSignedOut(true);
        setSurfaces([]);
        setChallenge(null);
        csrf.current = "";
        own.current = null;
        setOwnId(null);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Devices could not be loaded.");
      csrf.current = data.csrfToken;
      setSignedOut(false);
      setSurfaces(data.surfaces);
      setVoyages(data.voyages);
      setReady(true);
      if (voyage) {
        const id = sessionStorage.getItem(storageKey(voyage));
        own.current = data.surfaces.some((s: SurfaceDto) => s.surfaceId === id && s.thisSession) ? id : null;
        setOwnId(own.current);
        const source = data.surfaces.find((s: SurfaceDto) => s.surfaceId === id);
        if (source?.pairing?.state === "CONNECTED") {
          setChallenge(null);
          const target = data.surfaces.find((s: SurfaceDto) => s.surfaceId === source.pairing.surfaceId);
          if (target) setMessage(`${target.label} connected. ${roleNames[target.role as SurfaceRole]} is ready.`);
        }
        if (id && !own.current) {
          sessionStorage.removeItem(storageKey(voyage));
          setChallenge(null);
        }
      }
    },
    [voyage],
  );
  useEffect(() => {
    if (compact) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const pendingKey = "crossdeck.pending-pair.v1";
    let pairing = fragment.get("code");
    if (pairing && /^[A-F0-9]{12}$/.test(pairing)) {
      sessionStorage.setItem(pendingKey, JSON.stringify({ code: pairing, expiresAt: Date.now() + CHALLENGE_MS }));
    } else {
      try {
        const pending = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
        if (pending?.expiresAt > Date.now()) pairing = pending.code;
        else sessionStorage.removeItem(pendingKey);
      } catch {
        sessionStorage.removeItem(pendingKey);
      }
    }
    if (pairing && /^[A-F0-9]{12}$/.test(pairing)) {
      const timer = window.setTimeout(() => setCode(pairing), 0);
      return () => window.clearTimeout(timer);
    }
    // Keep a bounded, tab-local return credential; sign-in URLs never contain it.
  }, [compact]);
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    const tick = async () => {
      try {
        if (own.current && csrf.current)
          await crossdeckRequest(
            {
              action: "heartbeat",
              surfaceId: own.current,
              lifecycle: document.visibilityState === "visible" ? "ACTIVE" : "BACKGROUND",
              capabilities: browserProjection(),
            },
            csrf.current,
            controller.signal,
          );
        await refresh(controller.signal);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setMessage(cause instanceof Error ? cause.message : "Connection interrupted.");
          setSurfaces([]);
          setChallenge(null);
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), HEARTBEAT_MS);
    const hidden = () => {
      void tick();
    };
    const leave = () => {
      if (own.current && csrf.current)
        void crossdeckRequest(
          { action: "heartbeat", surfaceId: own.current, lifecycle: "DISCONNECTED" },
          csrf.current,
          undefined,
          true,
        ).catch(() => {});
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leave);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leave);
    };
  }, [refresh]);
  useEffect(() => {
    if (!challenge) return;
    const remaining = Math.max(0, Date.parse(challenge.expiresAt) - Date.now());
    const timer = window.setTimeout(() => {
      setChallenge(null);
      setMessage("The code expired. Create a new one when your other device is ready.");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [challenge]);
  const act = async (body: unknown, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      const data = await crossdeckRequest(body, csrf.current);
      if (data.surface?.thisSession) {
        sessionStorage.setItem(storageKey(data.surface.voyageId), data.surface.surfaceId);
        own.current = data.surface.surfaceId;
        setOwnId(data.surface.surfaceId);
        setVoyage(data.surface.voyageId);
      }
      if (data.code) {
        const link = `${window.location.origin}/devices/pair#${new URLSearchParams({ code: data.code })}`;
        setChallenge({
          ...data,
          qr: await QRCode.toDataURL(link, { width: 240, margin: 2, errorCorrectionLevel: "M" }),
        });
      }
      if (data.removed) setChallenge(null);
      if ((body as { action: string }).action === "claim") {
        setCode("");
        sessionStorage.removeItem("crossdeck.pending-pair.v1");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      setMessage(success);
      if (!data.surface || data.surface.voyageId === voyage) await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  if (compact)
    return (
      <span className={styles.compact}>
        <Link href={`/account/devices?voyage=${encodeURIComponent(voyage)}`}>
          Devices{surfaces.length > 0 ? ` · ${surfaces.filter((s) => s.presence === "ACTIVE").length} connected` : ""}
        </Link>
      </span>
    );
  if (signedOut)
    return (
      <section className={styles.panel}>
        <h2>Bring your other device aboard</h2>
        <p>Sign in with the same Voyagewright account you use on your other device.</p>
        <Link
          className="button"
          href={signInHref(
            typeof window === "undefined" ? "/devices/pair" : window.location.pathname + window.location.search,
          )}
        >
          Sign in to connect
        </Link>
      </section>
    );
  const here = surfaces.find((s) => s.surfaceId === ownId);
  return (
    <section className={styles.panel} aria-label="Voyage devices">
      <div className={styles.masthead}>
        <p className="eyebrow">One Player · Many screens</p>
        <h2>Your Voyage, across your devices</h2>
        <p>Connect your phone, chart, or companion screen to the same Voyage. Your story stays with you.</p>
      </div>
      <p role="status" aria-live="polite">
        {message || (!ready ? "Loading your devices…" : "Choose a Voyage or enter the code from your other screen.")}
      </p>
      <div className={styles.columns}>
        <div className={styles.card}>
          <h3>Use this device</h3>
          <label>
            Voyage
            <select
              aria-label="Voyage"
              disabled={!ready || busy}
              value={voyage}
              onChange={(e) => {
                setVoyage(e.target.value);
                own.current = null;
                setOwnId(null);
                setChallenge(null);
              }}
            >
              <option value="">Choose your Voyage</option>
              {voyages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Device name
            <input
              disabled={!ready || busy}
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoComplete="off"
            />
          </label>
          {here ? (
            <p>This device is connected as {roleNames[here.role as SurfaceRole]}.</p>
          ) : (
            <button
              className="button"
              disabled={busy || !ready || !voyage || !label.trim()}
              onClick={() =>
                void act(
                  {
                    action: "register",
                    surfaceId: crypto.randomUUID(),
                    voyageId: voyage,
                    label,
                    capabilities: browserProjection(),
                  },
                  "This device joined your Voyage.",
                )
              }
            >
              Use this device
            </button>
          )}
          <h3>Connect from another screen</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                { action: "claim", surfaceId: crypto.randomUUID(), code, label, capabilities: browserProjection() },
                "Joined this Voyage. Your other screen stays connected.",
              );
            }}
          >
            <label>
              One-time code
              <input
                disabled={!ready || busy}
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/g, "")
                      .slice(0, 12),
                  )
                }
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                placeholder="12-character code"
              />
            </label>
            <button className="button" disabled={busy || !ready || code.length !== 12 || !label.trim()}>
              Join this Voyage
            </button>
          </form>
        </div>
        <div className={styles.card}>
          <h3>Bring another device aboard</h3>
          <p>
            Sign in with this same account on your other device, then scan the QR or enter its code. Codes expire after
            two minutes and work once.
          </p>
          <label>
            Companion role
            <select value={role} onChange={(e) => setRole(e.target.value as SurfaceRole)}>
              {roles
                .filter((r) => r !== "CREATOR_PREVIEW")
                .map((r) => (
                  <option key={r} value={r}>
                    {roleNames[r]}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="button"
            disabled={busy || !here}
            onClick={() =>
              void act(
                { action: "challenge", surfaceId: here!.surfaceId, role },
                "Scan this QR on your other device, or enter the code there.",
              )
            }
          >
            {challenge ? "Create a new code" : "Connect another device"}
          </button>
          {challenge && (
            <div className={styles.challenge}>
              <Image unoptimized src={challenge.qr} alt="Scan to connect another device" width={240} height={240} />
              <code>{challenge.code.match(/.{1,4}/g)?.join(" ")}</code>
              <p>Expires at {new Date(challenge.expiresAt).toLocaleTimeString()}.</p>
            </div>
          )}
        </div>
      </div>
      <h3>Connected devices</h3>
      {surfaces.length === 0 ? (
        <p>No devices connected yet. Your Voyage still works on a single screen.</p>
      ) : (
        <ul className={styles.devices}>
          {surfaces.map((s) => (
            <li key={s.surfaceId}>
              <div>
                <strong>
                  {s.label}
                  {s.surfaceId === ownId ? " · This device" : ""}
                </strong>
                <p>
                  {s.voyageTitle} ·{" "}
                  {s.presence === "ACTIVE" ? "Connected" : s.presence === "BACKGROUND" ? "In background" : "Away"}
                </p>
              </div>
              <label>
                Role for {s.label}
                <select
                  value={s.role}
                  disabled={busy}
                  onChange={(e) =>
                    void act({ action: "role", surfaceId: s.surfaceId, role: e.target.value }, "Device role updated.")
                  }
                >
                  {roles
                    .filter((r) => r !== "CREATOR_PREVIEW")
                    .map((r) => (
                      <option key={r} value={r}>
                        {roleNames[r]}
                      </option>
                    ))}
                </select>
              </label>
              <Link href={s.voyageHref}>Continue Voyage</Link>
              <button
                className="button button--danger"
                disabled={busy}
                onClick={() =>
                  void act({ action: "remove", surfaceId: s.surfaceId }, "Device removed. Your Voyage is unchanged.")
                }
              >
                Remove {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        Companion roles are ready for upcoming Chronicle features. Spatial viewing and content handoff arrive in later
        phases. Connecting never turns on your camera or changes your story progress.
      </p>
      <Link href="/account/sessions">Manage sign-ins and revoke device access</Link>
    </section>
  );
}
