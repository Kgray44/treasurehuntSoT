"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import type { LandfallCurrentPosition } from "@/landfall/map-projection";
import { subscribeLandfallNativeLifecycle, subscribeNativeLandfallPower } from "@/landfall/native-bridge";
import {
  remoteDataResponseSchema,
  remoteGeoPointSchema,
  type RemoteDataRequest,
  type RemoteDataResponse,
  type RemotePlace,
  type RemoteServiceSummary,
  type RemoteGeoPoint,
} from "@/landfall/remote-data";

function schematicRoute(points: readonly RemoteGeoPoint[]) {
  let longitude = points[0].longitude;
  const values = points.map((point, index) => {
    if (index) longitude += ((point.longitude - points[index - 1].longitude + 540) % 360) - 180;
    const latitude = (Math.max(-85, Math.min(85, point.latitude)) * Math.PI) / 180;
    return [(longitude * Math.PI) / 180, -Math.log(Math.tan(Math.PI / 4 + latitude / 2))];
  });
  const xs = values.map((value) => value[0]),
    ys = values.map((value) => value[1]);
  const left = Math.min(...xs),
    top = Math.min(...ys),
    spanX = Math.max(...xs) - left,
    spanY = Math.max(...ys) - top;
  const scale = Math.min(296 / Math.max(spanX, 1e-9), 156 / Math.max(spanY, 1e-9));
  return values
    .map(
      ([x, y]) =>
        `${(12 + (296 - spanX * scale) / 2 + (x - left) * scale).toFixed(2)},${(12 + (156 - spanY * scale) / 2 + (y - top) * scale).toFixed(2)}`,
    )
    .join(" ");
}

/** Called only by deliberate sharing handlers; never during presentation. */
function sharingActionTime() {
  return Date.now();
}

type Props = { bootstrap: PlayerLandfallBootstrap; csrfToken: string; position: LandfallCurrentPosition | null };
export function LandfallOnlineDataPanel(props: Props) {
  const b = props.bootstrap,
    world = b.runtimeDefinition.worldspaces[0];
  if (
    b.paused ||
    b.replayOnly ||
    !b.activeWaypointId ||
    world.kind !== "PHYSICAL" ||
    !["PUBLIC_REAL_WORLD", "GENERIC"].includes(world.privacyPolicy.classification)
  )
    return null;
  const key = JSON.stringify([
    b.sessionId,
    b.publishedVersionId,
    b.currentSequence,
    b.activeWaypointId,
    world.id,
    world.privacyPolicy.classification,
  ]);
  return (
    <LandfallOnlineDataControls
      key={key}
      csrfToken={props.csrfToken}
      position={props.position}
      endpoint={`/api/player/playthroughs/${encodeURIComponent(b.sessionId)}/landfall/data`}
    />
  );
}

/** Optional online suggestions remain ephemeral and never enter the evidence writer. */
export function LandfallOnlineDataControls({
  endpoint,
  csrfToken,
  position,
  requestHeaders = {},
  placeSearchOnly = false,
  onSelectPlace,
}: {
  endpoint: string;
  csrfToken: string;
  position: LandfallCurrentPosition | null;
  requestHeaders?: Record<string, string>;
  placeSearchOnly?: boolean;
  onSelectPlace?: (place: RemotePlace) => void;
}) {
  const [services, setServices] = useState<RemoteServiceSummary[]>([]);
  const [checked, setChecked] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<RemotePlace[]>([]);
  const [selected, setSelected] = useState<RemotePlace | null>(null);
  const [result, setResult] = useState<Extract<RemoteDataResponse, { state: "RESULT" }> | null>(null);
  const [message, setMessage] = useState("Online suggestions are off.");
  const active = useRef<AbortController | null>(null),
    generation = useRef(0);
  const clear = useCallback((update = true) => {
    generation.current++;
    active.current?.abort();
    active.current = null;
    if (update) {
      setServices([]);
      setChecked(false);
      setConsent(false);
      setBusy(false);
      setQuery("");
      setPlaces([]);
      setSelected(null);
      setResult(null);
      setMessage("Online suggestions cleared. Check the options again when you choose to use them.");
    }
  }, []);
  useEffect(() => {
    const pause = () => clear();
    const lifecycle = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") pause();
    });
    const power = subscribeNativeLandfallPower((state) => {
      if (state.lowPower || state.thermalPressure || state.state !== "READY") pause();
    });
    const visibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("landfall-offline-cleared", pause);
    return () => {
      lifecycle();
      power();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("landfall-offline-cleared", pause);
      clear(false);
    };
  }, [clear]);
  const call = async (input: RemoteDataRequest) => {
    if (busy || document.visibilityState === "hidden" || (input.operation !== "STATUS" && !consent)) return;
    const attempt = ++generation.current,
      abort = new AbortController();
    active.current?.abort();
    active.current = abort;
    const timer = setTimeout(() => abort.abort(), 10000);
    const family =
      input.operation === "ROUTE" ? "ROUTING" : input.operation === "ELEVATION" ? "ELEVATION" : "GEOCODING";
    const recipient =
      input.operation === "STATUS" ? undefined : services.find((item) => item.family === family)?.recipient;
    setBusy(true);
    setResult(null);
    setMessage("Checking online options…");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
          ...requestHeaders,
          ...(recipient ? { "x-landfall-recipient": recipient } : {}),
        },
        body: JSON.stringify(input),
      });
      const parsed = remoteDataResponseSchema.safeParse(await response.json());
      if (attempt !== generation.current || abort.signal.aborted) return;
      if (!parsed.success || (!response.ok && parsed.data.state !== "RATE_LIMITED")) throw new Error("UNAVAILABLE");
      const value = parsed.data;
      if (value.state === "STATUS") {
        const visible = placeSearchOnly
          ? value.services.filter((service) => service.family === "GEOCODING")
          : value.services;
        setServices(visible);
        setChecked(true);
        setMessage(
          visible.length
            ? "Review the recipients before sharing."
            : "No online data services are configured. The released chart and guidance remain available.",
        );
      } else if (value.state === "RESULT") {
        if (value.service.recipient !== recipient || value.service.family !== family)
          throw new Error("RECIPIENT_CHANGED");
        setResult(value);
        setServices((previous) => previous.map((item) => (item.id === value.service.id ? value.service : item)));
        if (value.places) {
          setPlaces(value.places);
          setSelected(null);
        }
        setMessage(
          value.places?.length === 0
            ? "No matching online places were returned."
            : "Online suggestions are ready. They cannot confirm arrival.",
        );
      } else {
        if (recipient)
          setServices((previous) =>
            previous.map((service) =>
              service.recipient === recipient && service.family === family
                ? { ...service, state: value.state, retryAfterSeconds: value.retryAfterSeconds }
                : service,
            ),
          );
        setPlaces([]);
        setSelected(null);
        setMessage(
          value.state === "RATE_LIMITED"
            ? "The online service is busy or limited. Wait before choosing to try again."
            : value.state === "NOT_CONFIGURED"
              ? "This online option is not configured. Use the released chart and guidance."
              : "Online suggestions are unavailable. Use the released chart and guidance.",
        );
      }
    } catch {
      if (attempt === generation.current) {
        setPlaces([]);
        setSelected(null);
        setMessage("Online suggestions are unavailable. Use the released chart and guidance.");
      }
    } finally {
      clearTimeout(timer);
      if (attempt === generation.current) {
        setBusy(false);
        active.current = null;
      }
    }
  };
  const point = (now: number) => {
    const age = position ? now - position.observedAt : Infinity;
    if (!position || !Number.isFinite(age) || age < 0 || age > 30000 || !Number.isFinite(position.accuracyMeters)) {
      setMessage("A recent location is needed. Choose Use my location on the chart first, then review what you share.");
      return null;
    }
    const parsed = remoteGeoPointSchema.safeParse({
      latitude: position.coordinates[1],
      longitude: position.coordinates[0],
    });
    if (!parsed.success) {
      setMessage("A valid recent location is needed before sharing.");
      return null;
    }
    return parsed.data;
  };
  const geocoder = services.find((service) => service.family === "GEOCODING"),
    router = services.find((service) => service.family === "ROUTING"),
    elevation = services.find((service) => service.family === "ELEVATION");
  const ready = (service?: RemoteServiceSummary) => Boolean(service && ["CONFIGURED", "READY"].includes(service.state));
  const sharePoint = (operation: "REVERSE" | "ELEVATION", now: number) => {
    const current = point(now);
    if (current) void call({ operation, consent: true, point: current });
  };
  const route = (now: number) => {
    const current = point(now);
    if (current && selected && router?.mode)
      void call({ operation: "ROUTE", consent: true, from: current, to: selected.point, mode: router.mode });
  };
  return (
    <details
      className="landfall-online-data-panel"
      onToggle={(event) => {
        if (!event.currentTarget.open) clear();
      }}
    >
      <summary style={{ minHeight: 48 }}>
        {placeSearchOnly ? "Optional online place lookup" : "Optional online places and directions"}
      </summary>
      <p>
        {placeSearchOnly
          ? "Online place coordinates are suggestions. Review them before placing a waypoint. A lookup does not save changes to your Chronicle."
          : "Online suggestions do not change the released course or confirm arrival. Results stay in this view and are cleared when you leave it."}
      </p>
      <p role="status" aria-live="polite" aria-label="Online data status">
        {message}
      </p>
      <button
        type="button"
        style={{ minHeight: 48 }}
        disabled={busy}
        onClick={() => void call({ operation: "STATUS" })}
      >
        Check online data options
      </button>
      {checked && services.length > 0 && (
        <>
          <ul aria-label="Online data recipients">
            {services.map((service) => (
              <li key={service.id}>
                {service.family === "GEOCODING" ? "Places" : service.family === "ROUTING" ? "Directions" : "Terrain"}:{" "}
                {service.recipient} · {service.state.toLowerCase().replaceAll("_", " ")}
                {" · "}
                <a href={service.attributionUrl} target="_blank" rel="noreferrer">
                  {service.attributionLabel}
                </a>{" "}
                · {service.license}
              </li>
            ))}
          </ul>
          <p>
            {placeSearchOnly
              ? "A place search shares the text you enter with the named service. Online results are not saved for offline use. Reuse coordinates only when the service permits authoring, and preserve its required attribution."
              : "A place search shares the text you enter. Location lookup and terrain share your current coordinates. Directions share those coordinates and the selected destination with the named service. No online results are saved for offline use."}
          </p>
          <label style={{ minHeight: 48, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(event) => {
                setConsent(event.target.checked);
                setPlaces([]);
                setSelected(null);
                setResult(null);
                setQuery("");
              }}
            />
            I choose to share these details with the listed services.
          </label>
          {geocoder && (
            <>
              <label>
                Online place search
                <input
                  type="search"
                  autoComplete="off"
                  maxLength={240}
                  value={query}
                  style={{ minHeight: 48, maxWidth: "100%" }}
                  disabled={!consent || busy}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                type="button"
                style={{ minHeight: 48 }}
                disabled={!consent || busy || !query.trim() || !ready(geocoder)}
                onClick={() => void call({ operation: "SEARCH", consent: true, query: query.trim(), limit: 5 })}
              >
                Search online places
              </button>
              <button
                type="button"
                style={{ minHeight: 48 }}
                disabled={!consent || busy || !position || !ready(geocoder)}
                onClick={() => sharePoint("REVERSE", sharingActionTime())}
                hidden={placeSearchOnly}
              >
                Look up my current location online
              </button>
            </>
          )}
          {places.length > 0 && (
            <ul aria-label="Online place suggestions">
              {places.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    style={{ minHeight: 48, overflowWrap: "anywhere" }}
                    disabled={busy || (placeSearchOnly && geocoder?.authoringRights !== "ALLOWED")}
                    aria-pressed={selected?.id === place.id}
                    onClick={() => {
                      setSelected(place);
                      setResult(null);
                      onSelectPlace?.(place);
                    }}
                  >
                    {place.label}
                  </button>
                  {placeSearchOnly && geocoder?.authoringRights !== "ALLOWED" && (
                    <span> Coordinate reuse is not permitted by this service.</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {router && !placeSearchOnly && (
            <button
              type="button"
              style={{ minHeight: 48 }}
              disabled={!consent || busy || !position || !selected || !router.mode || !ready(router)}
              onClick={() => route(sharingActionTime())}
            >
              Get {router.mode?.toLowerCase()} route suggestion to selected place
            </button>
          )}
          {elevation && !placeSearchOnly && (
            <button
              type="button"
              style={{ minHeight: 48 }}
              disabled={!consent || busy || !position || !ready(elevation)}
              onClick={() => sharePoint("ELEVATION", sharingActionTime())}
            >
              Look up terrain at my current location
            </button>
          )}
        </>
      )}
      {result?.route && (
        <figure aria-label="Online route suggestion">
          <svg
            role="img"
            aria-label="Schematic online route without street detail"
            viewBox="0 0 320 180"
            style={{ width: "100%", height: 180 }}
          >
            <polyline
              points={schematicRoute(result.route.points)}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          <figcaption>
            Schematic online suggestion, without street detail. This does not replace the released course.
          </figcaption>
          <p>
            Suggested {result.route.mode.toLowerCase()} route: {(result.route.distanceMeters / 1000).toFixed(1)} km,
            about {Math.ceil(result.route.durationSeconds / 60)} minutes. Check access and conditions yourself. Safety
            and accessibility have not been assessed. Follow the released course for this Voyage.
          </p>
        </figure>
      )}
      {result?.elevation && (
        <p>
          Reported terrain elevation: {Math.round(result.elevation.meters)} m. Accuracy and coverage are unknown; a zero
          value may mean missing coverage. This cannot identify your floor or confirm arrival.
        </p>
      )}
      <button type="button" style={{ minHeight: 48 }} onClick={() => clear()}>
        Clear online suggestions
      </button>
    </details>
  );
}
