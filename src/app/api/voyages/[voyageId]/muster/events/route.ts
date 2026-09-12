import { eventBus } from "@/lib/events";
import { db } from "@/lib/db";
import { loadMusterAccess } from "@/muster/service";
import { musterIdentity, musterError } from "@/muster/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ voyageId: string }> }) {
  try {
    const voyageId = (await context.params).voyageId;
    const { actor, session } = await musterIdentity();
    await loadMusterAccess(voyageId, actor, db, true);
    const encoder = new TextEncoder();
    let closeStream: (() => void) | undefined;
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        const channel = `tale-session:${voyageId}`;
        const emit = (event: string) => {
          if (closed) return;
          try {
            if ((controller.desiredSize ?? 1) <= 0) {
              close();
              return;
            }
            controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
          } catch {
            close();
          }
        };
        // Notifications carry no chat or private state. Every refresh reauthorizes its own read.
        const changed = () => emit("changed");
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          eventBus.off(channel, changed);
          request.signal.removeEventListener("abort", close);
          try {
            controller.close();
          } catch {}
        };
        const timer = setInterval(() => {
          void (async () => {
            if (session.expiresAt.getTime() <= Date.now()) throw new Error("expired");
            await loadMusterAccess(voyageId, actor, db, true);
            emit("heartbeat");
          })().catch(() => {
            emit("access-revoked");
            close();
          });
        }, 15_000);
        closeStream = close;
        eventBus.on(channel, changed);
        request.signal.addEventListener("abort", close, { once: true });
        if (request.signal.aborted) close();
        else emit("connected");
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
  } catch (cause) {
    return musterError(cause);
  }
}
