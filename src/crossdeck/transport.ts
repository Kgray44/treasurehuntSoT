import type { SyncCommand, SyncSnapshot } from "./sync-contracts";

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
  intervalMs = 500,
): SurfaceSyncTransport {
  const url = `/api/crossdeck/sync?voyage=${encodeURIComponent(voyageId)}&surface=${encodeURIComponent(surfaceId)}`;
  async function request(init: RequestInit = {}) {
    const response = await fetcher(url, { ...init, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new SyncTransportError(body.error || "Connection interrupted.", response.status);
    return body as SyncSnapshot;
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
      let timer: ReturnType<typeof setTimeout> | undefined;
      let revision = -1;
      let failures = 0;
      const tick = async () => {
        try {
          const snapshot = await transport.read(controller.signal);
          if (controller.signal.aborted) return;
          // Deliver healthy snapshots too, so status recovers even without a state change.
          if (snapshot.revision >= revision) {
            revision = snapshot.revision;
            next(snapshot);
          }
          failures = 0;
        } catch (cause) {
          if (!controller.signal.aborted) {
            failures += 1;
            failed(cause instanceof Error ? cause : new Error("Connection interrupted."));
            if (cause instanceof SyncTransportError && [401, 403].includes(cause.status)) {
              controller.abort();
              return;
            }
          }
        }
        if (!controller.signal.aborted)
          timer = setTimeout(() => void tick(), Math.min(5000, intervalMs * 2 ** Math.min(failures, 4)));
      };
      void tick();
      return () => {
        controller.abort();
        if (timer) clearTimeout(timer);
      };
    },
  };
  return transport;
}
