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
  let heartbeat: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { id: string; eventType: string; sequence: number; createdAt: string }) =>
        controller.enqueue(
          encoder.encode(`id: ${event.sequence}\nevent: progression\ndata: ${JSON.stringify(event)}\n\n`),
        );
      controller.enqueue(encoder.encode(": authorized playthrough channel connected\n\n"));
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
      const channel = `tale-session:${sessionId}`;
      eventBus.on(channel, send);
      heartbeat = setInterval(() => {
        void (async () => {
          if (access.kind === "identity" && !(await playerCanAccessPlaythrough(sessionId, access.playerId))) {
            clearInterval(heartbeat);
            eventBus.off(channel, send);
            controller.enqueue(encoder.encode("event: access-revoked\ndata: {}\n\n"));
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
        })().catch(() => undefined);
      }, 15000);
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        eventBus.off(channel, send);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(heartbeat);
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
