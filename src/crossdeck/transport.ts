import type { SyncCommand, SyncSnapshot } from "./sync-contracts";
import { changeNotificationSchema } from "./notifications";

export const RECONCILIATION_MS = 10_000;
type EventConnection = Pick<EventTarget, "addEventListener" | "removeEventListener"> & { close(): void };
type Environment = {
  events?: (url: string) => EventConnection;
  document?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  window?: Pick<Window, "addEventListener" | "removeEventListener">;
  random?: () => number;
};

export interface SurfaceSyncTransport {
  read(signal?: AbortSignal): Promise<SyncSnapshot>;
  send(command: SyncCommand, signal?: AbortSignal): Promise<SyncSnapshot>;
  subscribe(next: (snapshot: SyncSnapshot) => void, failed: (error: Error) => void): () => void;
}
export class SyncTransportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
/** Replaceable, abortable snapshot transport. Server revision is the convergence cursor. */
export function createHttpSyncTransport(
  voyageId: string,
  surfaceId: string,
  csrfToken: string,
  fetcher: typeof fetch = fetch,
  intervalMs = RECONCILIATION_MS,
  environment: Environment = {},
): SurfaceSyncTransport {
  const url = `/api/crossdeck/sync?voyage=${encodeURIComponent(voyageId)}&surface=${encodeURIComponent(surfaceId)}`;
  const eventsUrl = `/api/crossdeck/events?voyage=${encodeURIComponent(voyageId)}&surface=${encodeURIComponent(surfaceId)}`;
  let knownRevision = -1;
  async function request(init: RequestInit = {}) {
    const response = await fetcher(url, { ...init, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new SyncTransportError(body.error || "Connection interrupted.", response.status);
    const snapshot = body as SyncSnapshot;
    knownRevision = Math.max(knownRevision, snapshot.revision);
    return snapshot;
  }
  const transport: SurfaceSyncTransport = {
    read: (signal) => request({ signal }),
    send: (command, signal) =>
      request({
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(command),
      }),
    subscribe(next, failed) {
      const controller = new AbortController();
      const lifecycle = environment.document ?? (typeof document === "undefined" ? undefined : document);
      const online = environment.window ?? (typeof window === "undefined" ? undefined : window);
      const random = environment.random ?? Math.random;
      const connect =
        environment.events ??
        (typeof EventSource === "undefined" ? undefined : (address: string) => new EventSource(address));
      let timer: ReturnType<typeof setTimeout> | undefined, reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      let channel: EventConnection | undefined;
      let revision = -1,
        failures = 0,
        eventFailures = 0,
        requestedRevision = -1;
      let reading = false,
        refreshAfterRead = false,
        suspendedState = false;
      const active = () => !controller.signal.aborted && !suspendedState && lifecycle?.visibilityState !== "hidden";
      const closeEvents = () => {
        channel?.close();
        channel = undefined;
      };
      const stop = () => {
        controller.abort();
        if (timer) clearTimeout(timer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        closeEvents();
        lifecycle?.removeEventListener("visibilitychange", lifecycleChanged);
        online?.removeEventListener("online", restored);
        online?.removeEventListener("offline", disconnected);
        online?.removeEventListener("pageshow", restored);
        online?.removeEventListener("pagehide", suspended);
      };
      const tick = async (force = false) => {
        if (!active()) return;
        if (reading) {
          refreshAfterRead ||= force;
          return;
        }
        reading = true;
        const requestedAtStart = requestedRevision;
        if (timer) clearTimeout(timer);
        try {
          const snapshot = await transport.read(controller.signal);
          if (!active()) return;
          // Deliver healthy snapshots too, so status recovers even without a state change.
          if (snapshot.revision >= revision && snapshot.revision >= knownRevision) {
            revision = snapshot.revision;
            next(snapshot);
          }
          failures = 0;
        } catch (cause) {
          if (!controller.signal.aborted) {
            failures += 1;
            failed(cause instanceof Error ? cause : new Error("Connection interrupted."));
            if (cause instanceof SyncTransportError && [401, 403].includes(cause.status)) {
              stop();
              return;
            }
          }
        } finally {
          reading = false;
          if (active()) {
            // A newer hint during a fetch requires one latest-state fetch, not an event replay.
            const again =
              refreshAfterRead || (requestedRevision > requestedAtStart && requestedRevision > knownRevision);
            refreshAfterRead = false;
            if (again && failures === 0) queueMicrotask(() => void tick());
            else timer = setTimeout(() => void tick(), intervalMs);
          }
        }
      };
      const openEvents = () => {
        if (!active() || !connect || channel) return;
        let current: EventConnection;
        try {
          current = connect(eventsUrl);
        } catch {
          failed(new Error("Device event connection interrupted."));
          eventFailures++;
          reconnectTimer = setTimeout(
            () => {
              reconnectTimer = undefined;
              openEvents();
            },
            Math.min(30_000, 500 * 2 ** Math.min(eventFailures - 1, 6)) * (0.75 + random() * 0.5),
          );
          return;
        }
        channel = current;
        const live = () => active() && channel === current;
        current.addEventListener("open", () => {
          if (!live()) return;
          eventFailures = 0;
          void tick(); // Initial connect/reconnect never trusts a replay cursor.
        });
        current.addEventListener("crossdeck-change", (event) => {
          if (!live()) return;
          try {
            const change = changeNotificationSchema.parse(JSON.parse((event as MessageEvent).data));
            if (change.surfaceScope !== surfaceId || change.revision <= knownRevision) return;
            requestedRevision = Math.max(requestedRevision, change.revision);
            void tick();
          } catch {
            /* Untrusted/unknown envelopes cannot become presentation state. */
          }
        });
        current.addEventListener("crossdeck-ended", () => {
          if (!live()) return;
          failed(new SyncTransportError("Device access ended.", 403));
          stop();
        });
        current.addEventListener("error", () => {
          if (!live()) return;
          closeEvents(); // Own bounded jittered retry rather than duplicate native retries.
          eventFailures++;
          failed(new Error("Device event connection interrupted."));
          void tick(); // HTTP authority identifies expired/revoked sessions even if SSE opening fails.
          const delay = Math.min(30_000, 500 * 2 ** Math.min(eventFailures - 1, 6)) * (0.75 + random() * 0.5);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            openEvents();
          }, delay);
        });
      };
      const suspended = () => {
        suspendedState = true;
        closeEvents();
        if (timer) clearTimeout(timer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        timer = reconnectTimer = undefined;
      };
      const restored = () => {
        if (controller.signal.aborted || lifecycle?.visibilityState === "hidden") return;
        suspended();
        suspendedState = false;
        void tick(true);
        openEvents();
      };
      const lifecycleChanged = () => (lifecycle?.visibilityState === "hidden" ? suspended() : restored());
      const disconnected = () => {
        suspended();
        if (!controller.signal.aborted) failed(new Error("Connection interrupted."));
      };
      lifecycle?.addEventListener("visibilitychange", lifecycleChanged);
      online?.addEventListener("online", restored);
      online?.addEventListener("offline", disconnected);
      online?.addEventListener("pageshow", restored);
      online?.addEventListener("pagehide", suspended);
      void tick();
      openEvents();
      return stop;
    },
  };
  return transport;
}
