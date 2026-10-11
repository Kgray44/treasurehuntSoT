import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { authority, membership, surface, type Actor } from "./service";
import { CrossdeckError } from "./contracts";
import { committedChanges, type CrossdeckChangeNotification } from "./notifications";

export const REVISION_OBSERVATION_MS = 1000;
export const STREAM_AUTHORIZATION_MS = 5000;
export const STREAM_LIFETIME_MS = 5 * 60_000;
const encoder = new TextEncoder();
type Bus = typeof committedChanges;
type Group = {
  membershipId: string;
  revision: number;
  subscribers: Set<(revision: number | null) => void>;
  timer?: ReturnType<typeof setTimeout>;
  unsubscribe: () => void;
  stopped: boolean;
};

/** Shared-database cursor observation multiplexes cross-process recovery per participating person/Voyage. */
export function createCrossdeckRealtimeServer(db: PrismaClient, bus: Bus = committedChanges, clock = () => new Date()) {
  const groups = new Map<string, Group>();
  const connections = new Map<string, number>();
  let connectionCount = 0;
  async function authorize(actor: Actor, voyageId: string, surfaceId: string) {
    const now = clock();
    await authority(db, actor, now);
    const own = await surface(db, actor, surfaceId, now);
    if (own.membership.playthroughId !== voyageId) throw new CrossdeckError(403, "This device is unavailable.");
    const member = await membership(db, actor, voyageId, now);
    const row = await db.crossdeckDeck.findUnique({ where: { membershipId: member.id }, select: { revision: true } });
    return { membershipId: member.id, revision: row?.revision ?? 0, role: own.role };
  }
  function join(
    actor: Actor,
    voyageId: string,
    initial: { membershipId: string; revision: number },
    listener: (revision: number | null) => void,
  ) {
    const key = JSON.stringify([actor.accountId, voyageId]);
    let group = groups.get(key);
    if (!group) {
      group = { ...initial, subscribers: new Set(), unsubscribe: () => {}, stopped: false };
      groups.set(key, group);
      const current = group;
      const notify = (revision: number) => {
        if (current.stopped || revision <= current.revision) return;
        current.revision = revision;
        for (const subscriber of current.subscribers) subscriber(revision);
      };
      current.unsubscribe = bus.subscribe(actor.accountId, voyageId, notify);
      const observe = async () => {
        try {
          const row = await db.crossdeckDeck.findUnique({
            where: { membershipId: current.membershipId },
            select: { revision: true },
          });
          if (!current.stopped && row) notify(row.revision);
        } catch {
          if (!current.stopped) for (const subscriber of current.subscribers) subscriber(null);
        }
        if (!current.stopped) current.timer = setTimeout(() => void observe(), REVISION_OBSERVATION_MS);
      };
      current.timer = setTimeout(() => void observe(), REVISION_OBSERVATION_MS);
    }
    group.subscribers.add(listener);
    const current = group;
    return () => {
      current.subscribers.delete(listener);
      if (current.subscribers.size) return;
      current.stopped = true;
      if (current.timer) clearTimeout(current.timer);
      current.unsubscribe();
      groups.delete(key);
    };
  }
  return {
    authorize,
    async connect(actor: Actor, voyageId: string, surfaceId: string, signal: AbortSignal) {
      const initial = await authorize(actor, voyageId, surfaceId);
      if (signal.aborted) throw new CrossdeckError(503, "Connection interrupted.");
      const connectionKey = JSON.stringify([actor.id, surfaceId]);
      if (connectionCount >= 256 || (connections.get(connectionKey) ?? 0) >= 2)
        throw new CrossdeckError(429, "Please close an unused device view before reconnecting.");
      connectionCount++;
      connections.set(connectionKey, (connections.get(connectionKey) ?? 0) + 1);
      let dispose = () => {};
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let stopped = false,
            checking = false,
            requested = false;
          let emittedRevision = -1;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const deadline = Date.now() + STREAM_LIFETIME_MS;
          let leave = () => {};
          const write = (message: string) => {
            if (stopped) return;
            if ((controller.desiredSize ?? 0) <= 0) {
              dispose();
              return;
            }
            try {
              controller.enqueue(encoder.encode(message));
            } catch {
              dispose();
            }
          };
          dispose = () => {
            if (stopped) return;
            stopped = true;
            leave();
            if (timer) clearTimeout(timer);
            signal.removeEventListener("abort", dispose);
            connectionCount--;
            const count = (connections.get(connectionKey) ?? 1) - 1;
            if (count) connections.set(connectionKey, count);
            else connections.delete(connectionKey);
            try {
              controller.close();
            } catch {
              /* Consumer already canceled. */
            }
          };
          const verify = async () => {
            if (stopped) return;
            requested = true;
            if (checking) return;
            checking = true;
            try {
              while (requested && !stopped) {
                requested = false;
                if (Date.now() >= deadline) {
                  dispose();
                  break;
                }
                const current = await authorize(actor, voyageId, surfaceId);
                if (stopped) break;
                if (current.membershipId !== initial.membershipId || current.role !== initial.role) {
                  write("event: crossdeck-ended\ndata: {}\n\n");
                  dispose();
                  break;
                }
                if (current.revision > emittedRevision) {
                  emittedRevision = current.revision;
                  const event: CrossdeckChangeNotification = {
                    kind: "CROSSDECK_PRESENTATION_CHANGED",
                    protocolVersion: 1,
                    surfaceScope: surfaceId,
                    revision: current.revision,
                    eventId: randomUUID(),
                  };
                  write(`event: crossdeck-change\nid: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`);
                } else write(": crossdeck heartbeat\n\n");
              }
            } catch (cause) {
              if (!stopped && cause instanceof CrossdeckError && [401, 403].includes(cause.status))
                write("event: crossdeck-ended\ndata: {}\n\n");
              dispose();
            } finally {
              checking = false;
            }
          };
          leave = join(actor, voyageId, initial, (revision) => (revision === null ? dispose() : void verify()));
          signal.addEventListener("abort", dispose, { once: true });
          if (signal.aborted) {
            dispose();
            return;
          }
          const heartbeat = async () => {
            await verify();
            if (!stopped) timer = setTimeout(() => void heartbeat(), STREAM_AUTHORIZATION_MS);
          };
          void heartbeat();
        },
        cancel() {
          dispose();
        },
      });
      return stream;
    },
    get connectionCount() {
      return connectionCount;
    },
    get scopeCount() {
      return groups.size;
    },
  };
}
const state = globalThis as typeof globalThis & {
  crossdeckRealtimeServers?: WeakMap<PrismaClient, ReturnType<typeof createCrossdeckRealtimeServer>>;
};
const servers = (state.crossdeckRealtimeServers ??= new WeakMap());
export function crossdeckRealtimeServer(db: PrismaClient) {
  let server = servers.get(db);
  if (!server) {
    server = createCrossdeckRealtimeServer(db);
    servers.set(db, server);
  }
  return server;
}
