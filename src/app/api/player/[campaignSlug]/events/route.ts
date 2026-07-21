import { eventBus } from "@/lib/events";
import { db } from "@/lib/db";
import { requireLegacyCompatibilityAccess } from "@/compatibility/legacy-companion";
import { PLAYER_EVENT_HEARTBEAT_MS, PLAYER_EVENT_HISTORY_PAGE_SIZE } from "@/platform/player-event-stream";

export const dynamic = "force-dynamic";
function cursor(request: Request) {
  const raw = request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("after") ?? "0";
  return /^\d+$/u.test(raw) ? Number(raw) : 0;
}

function playerEvent(event: { id: string; eventType: string; sequence: number; payload: string; createdAt: Date }) {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(event.payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch {}
  return {
    id: event.id,
    type: event.eventType,
    sequence: event.sequence,
    payload,
    releaseAt: event.createdAt.toISOString(),
  };
}

export async function GET(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const access = await requireLegacyCompatibilityAccess((await context.params).campaignSlug);
  if (!access) return new Response("Invitation required.", { status: 401 });
  const requested = cursor(request);
  const encoder = new TextEncoder();
  let close = () => undefined;
  const stream = new ReadableStream({
    async start(controller) {
      let last = requested;
      const send = (event: { id: string; eventType: string; sequence: number; payload: string; createdAt: Date }) => {
        if (event.sequence <= last) return;
        last = event.sequence;
        controller.enqueue(
          encoder.encode(`id: ${event.sequence}\nevent: progression\ndata: ${JSON.stringify(playerEvent(event))}\n\n`),
        );
      };
      const historical = await db.taleSessionEvent.findMany({
        where: { sessionId: access.sessionId, sequence: { gt: requested } },
        orderBy: { sequence: "asc" },
        take: PLAYER_EVENT_HISTORY_PAGE_SIZE,
      });
      for (const event of historical) send(event);
      const channel = `tale-session:${access.sessionId}`;
      const listener = async (incoming: { id: string; eventType: string; sequence: number; createdAt: string }) => {
        const event = await db.taleSessionEvent.findUnique({ where: { id: incoming.id } });
        if (event) send(event);
      };
      eventBus.on(channel, listener);
      const heartbeat = setInterval(
        () => controller.enqueue(encoder.encode(": tide connected\n\n")),
        PLAYER_EVENT_HEARTBEAT_MS,
      );
      close = () => {
        clearInterval(heartbeat);
        eventBus.off(channel, listener);
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
