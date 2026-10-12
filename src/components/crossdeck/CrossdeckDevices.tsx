"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import QRCode from "qrcode";
import { CHALLENGE_MS, type SurfaceRole } from "@/crossdeck/contracts";
import { browserProjection, createCrossdeckId } from "@/crossdeck/client";
import { companionHref, experienceProfiles, roleNames, type ExperienceAvailability } from "@/crossdeck/experiences";
import { signInHref } from "@/homeport/return-to";
import { useCrossdeckSession } from "./useCrossdeckSession";
import { VoyageContext, type VoyageContextData } from "./VoyageContext";
import styles from "./CrossdeckDevices.module.css";

const pendingKey = "crossdeck.pending-pair.v1";
export function DeviceMark({ phone = false }: { phone?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {phone ? (
        <>
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <path d="M10 18h4" />
        </>
      ) : (
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </>
      )}
    </svg>
  );
}
export function CrossdeckDevices({
  initialVoyage = "",
  compact = false,
  pairing = false,
  voyageContext,
}: {
  initialVoyage?: string;
  compact?: boolean;
  pairing?: boolean;
  voyageContext?: VoyageContextData;
}) {
  const router = useRouter();
  const dialogTitle = useId();
  const connection = useCrossdeckSession(initialVoyage);
  const {
    voyage,
    setVoyage,
    voyages,
    surfaces,
    here,
    ready,
    signedOut,
    busy,
    message,
    setMessage,
    act,
    label,
    setLabel,
    refresh,
  } = connection;
  const [code, setCode] = useState("");
  const [pendingChallenge, setChallenge] = useState<{ code: string; expiresAt: string; qr: string } | null>(null);
  const challenge = !signedOut && here && here.pairing?.state !== "CONNECTED" ? pendingChallenge : null;
  const [availableVoyage, setAvailability] = useState<{ voyage: string; value: ExperienceAvailability } | null>(null);
  const availability =
    availableVoyage?.voyage === voyage ? availableVoyage.value : { lens: false, chart: false, artifacts: false };
  const requestedRole: SurfaceRole = "JOURNAL";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pairGeneration = useRef(0);
  const profiles = experienceProfiles(availability);
  const companions = surfaces.filter(
    (s) => s.surfaceId !== here?.surfaceId && s.voyageId === voyage && s.presence === "ACTIVE",
  );

  useEffect(() => {
    if (!pairing) return;
    let frame: number | undefined;
    const hydrateIntent = () => {
      let intent = "";
      const fragment = new URLSearchParams(location.hash.slice(1)).get("code");
      if (fragment && /^[A-Z0-9-]{6,20}$/i.test(fragment)) {
        intent = fragment.toUpperCase();
        sessionStorage.setItem(
          pendingKey,
          JSON.stringify({ code: fragment.toUpperCase(), expires: Date.now() + CHALLENGE_MS }),
        );
        history.replaceState(null, "", location.pathname + location.search);
      } else {
        try {
          const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
          if (saved && saved.expires > Date.now()) intent = saved.code;
          else sessionStorage.removeItem(pendingKey);
        } catch {
          sessionStorage.removeItem(pendingKey);
        }
      }
      // The browser-owned fragment is removed immediately; hydrate the form after the first browser frame.
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCode(intent));
    };
    hydrateIntent();
    window.addEventListener("hashchange", hydrateIntent);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", hydrateIntent);
    };
  }, [pairing]);
  useEffect(() => {
    if (!voyage || (compact && !dialogOpen)) return;
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/play/sessions/" + encodeURIComponent(voyage), { cache: "no-store", signal: controller.signal }),
      fetch("/api/player/playthroughs/" + encodeURIComponent(voyage) + "/landfall", {
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([journal, chart]) => {
        const state = journal.ok ? await journal.json() : null;
        const map = chart.ok ? await chart.json() : null;
        if (!controller.signal.aborted)
          setAvailability({
            voyage,
            value: {
              lens: Boolean(
                state?.journal?.chapters?.some((c: { blocks: { presentation: { spatialMoment?: unknown } }[] }) =>
                  c.blocks.some((b) => b.presentation.spatialMoment),
                ),
              ),
              chart: map?.available === true,
              artifacts: Boolean(
                state?.journal?.chapters?.some((c: { blocks: { journalKind: string }[] }) =>
                  c.blocks.some((b) => b.journalKind === "artifact"),
                ),
              ),
            },
          });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [voyage, compact, dialogOpen]);
  useEffect(() => {
    if (!challenge) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        setChallenge(null);
        setMessage("That code expired. Create a new code when your phone is ready.");
      }
    };
    tick();
    const countdown = setInterval(tick, 1000);
    // A bounded enrollment refresh ends with this short-lived challenge. Presentation synchronization remains event driven.
    const enrollment = setInterval(() => void refresh().catch(() => {}), 2000);
    return () => {
      clearInterval(countdown);
      clearInterval(enrollment);
    };
  }, [challenge, refresh, setMessage]);

  async function createPair(surfaceId: string) {
    if (compact && !dialog.current?.open) return;
    const generation = ++pairGeneration.current;
    setCopied(false);
    const result = await act({ action: "challenge", surfaceId, role: requestedRole }, "Your phone can join now.");
    if (result?.code && result.expiresAt) {
      const url = location.origin + "/devices/pair#code=" + encodeURIComponent(result.code);
      const qr = await QRCode.toDataURL(url, { width: 240, margin: 2, errorCorrectionLevel: "M" });
      if (generation === pairGeneration.current && (!compact || dialog.current?.open))
        setChallenge({ code: result.code, expiresAt: result.expiresAt, qr });
    }
  }
  async function openConnection() {
    setDialogOpen(true);
    dialog.current?.showModal();
    if (!ready || signedOut) return;
    setOpening(true);
    try {
      const surface =
        here ??
        (
          await act(
            {
              action: "register",
              surfaceId: createCrossdeckId(),
              voyageId: voyage,
              label,
              capabilities: browserProjection(),
            },
            "This screen is ready.",
          )
        )?.surface;
      if (surface) await createPair(surface.surfaceId);
    } finally {
      setOpening(false);
    }
  }
  function closeConnection() {
    pairGeneration.current++;
    setChallenge(null);
    dialog.current?.close();
    setDialogOpen(false);
    trigger.current?.focus();
  }
  async function join() {
    const result = await act(
      {
        action: "claim",
        code: code.trim().toUpperCase(),
        surfaceId: createCrossdeckId(),
        label,
        capabilities: browserProjection(),
      },
      "Connected. Opening your companion…",
    );
    if (result?.surface) {
      sessionStorage.removeItem(pendingKey);
      setCode("");
      router.push(
        result.surface.role === "SHARED_CREW_DISPLAY"
          ? "/devices/display?voyage=" + encodeURIComponent(result.surface.voyageId)
          : companionHref(result.surface.voyageId),
      );
    }
  }
  const credentials = challenge ? (
    <div className={styles.pairing}>
      <Image
        className={styles.qr}
        src={challenge.qr}
        width={240}
        height={240}
        alt="Scan with your phone to join this Chronicle"
        unoptimized
      />
      <p className={styles.instruction}>Open your phone’s camera and scan.</p>
      <p className={styles.muted}>Sign in with the same Voyagewright account.</p>
      <details className={styles.alternative}>
        <summary>Use a code instead</summary>
        <p>
          On your phone, open <strong>/devices/pair</strong> and enter:
        </p>
        <code className={styles.code}>{challenge.code}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(challenge.code).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </details>
      <p className={styles.expiry}>This code expires in {seconds} seconds.</p>
    </div>
  ) : (
    <div className={styles.waiting}>
      <DeviceMark phone />
      <p>
        {opening || busy
          ? "Preparing your connection…"
          : here?.pairing?.state === "CONNECTED"
            ? "Your phone is connected."
            : "Ready when your phone is."}
      </p>
      {!opening && here && (
        <button type="button" disabled={busy} onClick={() => void createPair(here.surfaceId)}>
          Create a new code
        </button>
      )}
    </div>
  );
  const status = (
    <p className={styles.status} role="status">
      {message}
    </p>
  );
  const signin = (
    <p className={styles.signin}>
      Sign in to connect your screens.{" "}
      <Link href={signInHref(pairing ? "/devices/pair" : locationPath(compact, initialVoyage))}>Sign in</Link>
    </p>
  );

  if (compact)
    return (
      <>
        <button
          ref={trigger}
          className={styles.connectButton}
          type="button"
          aria-label="Connect another device"
          disabled={!ready}
          onClick={() => void openConnection()}
        >
          <DeviceMark phone /> Connect another device
          {companions.length > 0 && (
            <span className={styles.connectedDot} aria-label={companions.length + " connected companions"} />
          )}
        </button>
        <dialog
          ref={dialog}
          className={styles.connectDialog}
          aria-labelledby={dialogTitle}
          onCancel={(event) => {
            event.preventDefault();
            closeConnection();
          }}
          onClose={() => {
            pairGeneration.current++;
            setChallenge(null);
            setDialogOpen(false);
          }}
        >
          <div className={styles.dialogHeading}>
            <div>
              <p className={styles.eyebrow}>One Chronicle, your screens</p>
              <h2 id={dialogTitle}>Bring your phone aboard</h2>
              {!signedOut && voyageContext?.voyageId === voyage && <VoyageContext voyage={voyageContext} />}
            </div>
            <button className={styles.close} type="button" aria-label="Close connection" onClick={closeConnection}>
              ×
            </button>
          </div>
          <p>Your adventure stays here. Your phone becomes its companion.</p>
          {signedOut ? signin : credentials}
          {status}
          {companions.length > 0 && (
            <ul className={styles.connectedList}>
              {companions.map((surface) => (
                <li key={surface.surfaceId}>
                  <DeviceMark phone />
                  <span>
                    {surface.label}
                    <small>{roleNames[surface.role as keyof typeof roleNames]} · Connected</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.dialogFooter}>
            <button type="button" onClick={closeConnection}>
              Continue the Chronicle
            </button>
            <Link href="/account/devices">Device preferences & security</Link>
          </div>
        </dialog>
      </>
    );
  if (pairing)
    return (
      <section className={styles.onboarding} aria-label="Connect your phone">
        <div className={styles.welcomeMark}>
          <DeviceMark phone />
        </div>
        <p className={styles.eyebrow}>Your Chronicle, with you</p>
        <h1>Bring the adventure with you</h1>
        <p>Join the Chronicle already open on your other screen.</p>
        {!ready ? (
          <p role="status">Checking your connection…</p>
        ) : signedOut ? (
          signin
        ) : (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void join();
              }}
            >
              <label>
                Connection code
                <input
                  name="pairCode"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={20}
                  required
                />
              </label>
              <details>
                <summary>Name this device</summary>
                <label>
                  Device name
                  <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} />
                </label>
              </details>
              <button className={styles.primary} type="submit" disabled={busy || !code.trim()}>
                {busy ? "Connecting…" : "Join the Chronicle"}
              </button>
            </form>
            {status}
            {here && (
              <Link className={styles.resumeLink} href={companionHref(here.voyageId)}>
                Open your connected companion
              </Link>
            )}
          </>
        )}
        <p className={styles.muted}>Codes are private and short lived. Each screen uses your own authorized Voyage.</p>
        <Link href="/player">Back to your Chronicles</Link>
      </section>
    );
  return (
    <section className={styles.panel} aria-label="Connected devices">
      <p className={styles.eyebrow}>Personal Harbor</p>
      <h2>Your connected screens</h2>
      <p>Keep your devices familiar. Connect one when you are ready to continue an adventure.</p>
      {!ready ? (
        <p role="status">Finding your screens…</p>
      ) : signedOut ? (
        signin
      ) : (
        <>
          <div className={styles.setup}>
            <label>
              Chronicle
              <select aria-label="Chronicle" value={voyage} onChange={(event) => setVoyage(event.target.value)}>
                <option value="">Choose a Chronicle</option>
                {voyages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
            {!here && (
              <>
                <label>
                  Device name
                  <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} />
                </label>
                <button
                  type="button"
                  disabled={busy || !voyage}
                  onClick={() =>
                    void act(
                      {
                        action: "register",
                        surfaceId: createCrossdeckId(),
                        voyageId: voyage,
                        label,
                        capabilities: browserProjection(),
                      },
                      "This screen is ready.",
                    )
                  }
                >
                  Use this device
                </button>
              </>
            )}
            {here && (
              <button type="button" disabled={busy} onClick={() => void createPair(here.surfaceId)}>
                Connect another device
              </button>
            )}
          </div>
          {challenge && credentials}
          {status}
          <ul className={styles.deviceList}>
            {surfaces.map((surface) => (
              <li key={surface.surfaceSessionId}>
                <div className={styles.deviceHeading}>
                  <DeviceMark phone={surface.surfaceId !== here?.surfaceId} />
                  <div>
                    <h3>
                      {surface.label}
                      {surface.surfaceId === here?.surfaceId ? " · This screen" : ""}
                    </h3>
                    <p>
                      {roleNames[surface.role as keyof typeof roleNames]} ·{" "}
                      {surface.presence === "ACTIVE"
                        ? "Connected"
                        : surface.presence === "BACKGROUND"
                          ? "In the background"
                          : "Offline"}
                    </p>
                    <small>{surface.voyageTitle}</small>
                  </div>
                </div>
                <div className={styles.deviceActions}>
                  {surface.surfaceId === here?.surfaceId && (
                    <Link
                      href={
                        surface.role === "SHARED_CREW_DISPLAY"
                          ? "/devices/display?voyage=" + encodeURIComponent(surface.voyageId)
                          : companionHref(surface.voyageId)
                      }
                    >
                      Open on this device
                    </Link>
                  )}
                  <details>
                    <summary>Device options</summary>
                    <label>
                      Device purpose
                      <select
                        value={surface.role}
                        disabled={busy}
                        onChange={(event) =>
                          void act(
                            { action: "role", surfaceId: surface.surfaceId, role: event.target.value },
                            "Device purpose updated.",
                          )
                        }
                      >
                        {profiles.map((profile) => (
                          <option key={profile.role} value={profile.role} disabled={!profile.available}>
                            {profile.title}
                            {!profile.available ? " · unavailable" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className={styles.muted}>
                      Shared screens show only explicitly shared crew views. Camera and spatial access depend on this
                      device’s supported Parallax connection.
                    </p>
                    <button
                      className={styles.remove}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          { action: "remove", surfaceId: surface.surfaceId },
                          "Device disconnected. Its access has ended.",
                        )
                      }
                    >
                      Disconnect {surface.label}
                    </button>
                  </details>
                </div>
              </li>
            ))}
          </ul>
          {surfaces.length === 0 && (
            <p className={styles.empty}>No screens connected yet. Your Chronicles are ready whenever you are.</p>
          )}
          <details className={styles.advanced}>
            <summary>Specialized device purposes</summary>
            {profiles
              .filter((p) => p.advanced)
              .map((p) => (
                <p key={p.role}>
                  <strong>{p.title}</strong> — {p.available ? p.description : p.reason}
                </p>
              ))}
          </details>
        </>
      )}
    </section>
  );
}
function locationPath(compact: boolean, voyage: string) {
  if (compact && typeof location !== "undefined") return location.pathname + location.search;
  return voyage ? "/account/devices?voyage=" + encodeURIComponent(voyage) : "/account/devices";
}
