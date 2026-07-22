import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { requirePlayer } from "@/lib/security";
import type { ClientProgressEvent } from "@/domain/story";
import { toClientEvent } from "@/domain/visibility";
import {
  PLAYER_EVENT_DEDUPE_WINDOW_SIZE,
  PLAYER_EVENT_HEARTBEAT_MS,
  PLAYER_EVENT_HISTORY_PAGE_SIZE,
  PLAYER_EVENT_LIVE_BUFFER_LIMIT,
  PLAYER_EVENT_STREAM_HIGH_WATER_MARK,
} from "./stream-config";

export const dynamic = "force-dynamic";

function requestedCursor(request: Request) {
  const raw = request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("after") ?? "0";
  if (!/^\d+$/.test(raw)) return 0;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export async function GET(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requirePlayer(campaignSlug);
  if (!access) return new Response("Invitation required.", { status: 401 });
  const requested = requestedCursor(request);
  const encoder = new TextEncoder();
  let dispose: () => void = () => undefined;
  const stream = new ReadableStream(
    {
      async start(controller) {
        const channel = `campaign:${access.campaignId}`;
        const buffered = new Map<string, ClientProgressEvent>();
        const delivered = new Set<string>();
        const deliveredOrder: string[] = [];
        let lastSuccessfullyDeliveredSequence = requested;
        let phase: "replay" | "live" | "closed" = "replay";
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let checkingAccess = false;
        const isClosed = () => phase === "closed";

        const detach = () => {
          if (heartbeat) clearInterval(heartbeat);
          heartbeat = undefined;
          eventBus.off(channel, receive);
          request.signal.removeEventListener("abort", abort);
        };
        const terminate = (closeController: boolean) => {
          if (isClosed()) return;
          phase = "closed";
          detach();
          if (!closeController) return;
          try {
            controller.close();
          } catch {}
        };
        const enqueue = (value: string) => {
          if (phase === "closed") return false;
          if (controller.desiredSize !== null && controller.desiredSize <= 0) {
            // Do not claim the next event. Closing preserves the last emitted SSE
            // ID so EventSource can reconnect and resume from durable history.
            terminate(true);
            return false;
          }
          try {
            controller.enqueue(encoder.encode(value));
            return true;
          } catch {
            terminate(false);
            return false;
          }
        };
        const rememberDelivered = (eventId: string) => {
          delivered.add(eventId);
          deliveredOrder.push(eventId);
          if (deliveredOrder.length <= PLAYER_EVENT_DEDUPE_WINDOW_SIZE) return;
          const evicted = deliveredOrder.shift();
          if (evicted) delivered.delete(evicted);
        };
        const send = (event: ClientProgressEvent) => {
          if (phase === "closed") return false;
          if (event.sequence <= lastSuccessfullyDeliveredSequence || delivered.has(event.id)) return true;
          if (enqueue(`id: ${event.sequence}\nevent: progression\ndata: ${JSON.stringify(event)}\n\n`)) {
            // Delivery identity advances only after enqueue succeeds.
            rememberDelivered(event.id);
            lastSuccessfullyDeliveredSequence = event.sequence;
            return true;
          }
          return false;
        };
        function receive(event: ClientProgressEvent) {
          if (phase === "closed" || event.sequence <= lastSuccessfullyDeliveredSequence || delivered.has(event.id)) {
            return;
          }
          if (phase === "replay") {
            const current = buffered.get(event.id);
            if (!current || event.sequence >= current.sequence) buffered.set(event.id, event);
            if (buffered.size > PLAYER_EVENT_LIVE_BUFFER_LIMIT) terminate(true);
            return;
          }
          send(event);
        }
        function abort() {
          terminate(true);
        }
        const accessIsCurrent = async () =>
          Boolean(
            await db.playerAccess.findFirst({
              where: {
                id: access.id,
                campaignId: access.campaignId,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              select: { id: true },
            }),
          );
        const revoke = () => {
          if (isClosed()) return;
          enqueue("event: access-revoked\ndata: {}\n\n");
          terminate(true);
        };

        // Subscribe before querying durable history. Events committed or
        // published during the query are buffered and merged by immutable ID.
        eventBus.on(channel, receive);
        request.signal.addEventListener("abort", abort, { once: true });
        dispose = () => terminate(false);
        if (request.signal.aborted) {
          terminate(true);
          return;
        }
        enqueue(": tide connected\n\n");

        try {
          let durableCursor = requested;
          let accessRevalidated = false;
          while (!isClosed()) {
            const missed = await db.progressEvent.findMany({
              where: {
                campaignId: access.campaignId,
                sequence: { gt: durableCursor },
                releaseAt: { lte: new Date() },
              },
              orderBy: [{ sequence: "asc" }, { id: "asc" }],
              take: PLAYER_EVENT_HISTORY_PAGE_SIZE,
              select: {
                id: true,
                type: true,
                sequence: true,
                payload: true,
                releaseAt: true,
                reversesEventId: true,
                supersededById: true,
              },
            });
            if (isClosed()) return;
            if (!accessRevalidated) {
              accessRevalidated = true;
              if (!(await accessIsCurrent())) {
                revoke();
                return;
              }
              if (isClosed()) return;
            }
            if (missed.length === 0) break;

            const previousCursor = durableCursor;
            const page = missed
              .map(toClientEvent)
              .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
            for (const event of page) {
              if (!send(event)) return;
              buffered.delete(event.id);
              durableCursor = Math.max(durableCursor, event.sequence);
            }
            if (durableCursor <= previousCursor) {
              terminate(true);
              return;
            }
            if (missed.length < PLAYER_EVENT_HISTORY_PAGE_SIZE) break;
          }

          const liveOverlap = [...buffered.values()].sort(
            (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
          );
          buffered.clear();
          for (const event of liveOverlap) if (!send(event)) return;
          if (isClosed()) return;
          phase = "live";

          heartbeat = setInterval(() => {
            if (isClosed() || checkingAccess) return;
            checkingAccess = true;
            void accessIsCurrent()
              .then((current) => {
                if (isClosed()) return;
                if (!current) revoke();
                else enqueue(`event: heartbeat\ndata: ${Date.now()}\n\n`);
              })
              .catch(revoke)
              .finally(() => {
                checkingAccess = false;
              });
          }, PLAYER_EVENT_HEARTBEAT_MS);
        } catch (error) {
          if (isClosed()) return;
          phase = "closed";
          detach();
          try {
            controller.error(error);
          } catch {}
        }
      },
      cancel() {
        dispose();
      },
    },
    { highWaterMark: PLAYER_EVENT_STREAM_HIGH_WATER_MARK },
  );
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
