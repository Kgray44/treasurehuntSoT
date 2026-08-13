import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { authorizeTaleSessionPlayer, playerCanAccessPlaythrough } from "@/platform/auth";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const access = await authorizeTaleSessionPlayer(sessionId);
  if (!access) return new Response("Voyage session required.", { status: 401 });
  const after = Number(request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("after") ?? 0);
  const encoder = new TextEncoder();
  let closeStream: (() => void) | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      const channel = `tale-session:${sessionId}`;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let closed = false;
      let send: ((event: { id: string; eventType: string; sequence: number; createdAt: string }) => void) | null = null;
      const cleanup = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        if (send) eventBus.off(channel, send);
        request.signal.removeEventListener("abort", close);
      };
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {}
      };
      const enqueue = (payload: Uint8Array) => {
        if (closed) return false;
        try {
          controller.enqueue(payload);
          return true;
        } catch {
          close();
          return false;
        }
      };
      send = (event) => {
        enqueue(encoder.encode(`id: ${event.sequence}\nevent: progression\ndata: ${JSON.stringify(event)}\n\n`));
      };
      closeStream = close;
      request.signal.addEventListener("abort", close, { once: true });
      if (!enqueue(encoder.encode(": authorized playthrough channel connected\n\n"))) return;
      const missed = await db.taleSessionEvent.findMany({
        where: { sessionId, sequence: { gt: Number.isFinite(after) ? after : 0 } },
        orderBy: { sequence: "asc" },
      });
      for (const event of missed)
        send({
          id: event.id,
          eventType: event.eventType,
          sequence: event.sequence,
          createdAt: event.createdAt.toISOString(),
        });
      if (closed) return;
      eventBus.on(channel, send);
      heartbeat = setInterval(() => {
        void (async () => {
          if (access.kind === "identity" && !(await playerCanAccessPlaythrough(sessionId, access.playerId))) {
            enqueue(encoder.encode("event: access-revoked\ndata: {}\n\n"));
            close();
            return;
          }
          enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
        })().catch(() => undefined);
      }, 15000);
    },
    cancel() {
      closeStream?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
