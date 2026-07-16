import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { requirePlayer } from "@/lib/security";
import type { ClientProgressEvent, ProgressEventType } from "@/domain/story";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requirePlayer(campaignSlug);
  if (!access) return new Response("Invitation required.", { status: 401 });
  const requested = Number(request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("after") ?? 0);
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": tide connected\n\n"));
      const send = (event: ClientProgressEvent) =>
        controller.enqueue(
          encoder.encode(`id: ${event.sequence}\nevent: progression\ndata: ${JSON.stringify(event)}\n\n`),
        );
      const missed = await db.progressEvent.findMany({
        where: {
          campaignId: access.campaignId,
          sequence: { gt: Number.isFinite(requested) ? requested : 0 },
          releaseAt: { lte: new Date() },
        },
        orderBy: { sequence: "asc" },
      });
      missed.forEach((event) =>
        send({
          id: event.id,
          type: event.type as ProgressEventType,
          sequence: event.sequence,
          payload: JSON.parse(event.payload),
          releaseAt: event.releaseAt.toISOString(),
        }),
      );
      const channel = `campaign:${access.campaignId}`;
      eventBus.on(channel, send);
      heartbeat = setInterval(
        () => controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`)),
        15000,
      );
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
