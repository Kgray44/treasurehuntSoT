import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { CrossdeckError, presence } from "./contracts";
import { authority, membership, surface, type Actor } from "./service";
import { resolveCrossdeckObject } from "./objects";
import { committedChanges } from "./notifications";
import {
  emptyDeck,
  objectKey,
  HANDOFF_TTL_MS,
  type DeckState,
  type SyncCommand,
  type SyncSnapshot,
  type ObjectRef,
  type Continuity,
} from "./sync-contracts";

type Store = Prisma.TransactionClient;
type Resolver = (
  tx: Store,
  actor: Actor,
  voyage: string,
  ref: ObjectRef,
  context: Continuity,
) => Promise<{ title: string; visibility: "PRIVATE" | "PERSONAL" | "CREW" }>;
const conflict = (message = "Another device changed this view. Refresh and try again.") => {
  throw new CrossdeckError(409, message);
};
const active = (s: Awaited<ReturnType<typeof surface>>, now: Date) =>
  presence(s.lifecycle, s.lastSeenAt, s.expiresAt, s.revokedAt, now) === "ACTIVE";
/** Durable compare-and-swap serialization across processes. No in-memory authority or story mutation. */
export function createCrossdeckSyncService(
  db: PrismaClient,
  clock = () => new Date(),
  resolve: Resolver = resolveCrossdeckObject,
  notify: (change: { accountId: string; voyageId: string; revision: number }) => void = (change) =>
    committedChanges.publish(change),
) {
  async function transact<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    try {
      return await db.$transaction(fn, { timeout: 15_000 });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        ["P2002", "P2034", "P1008"].includes(String(error.code))
      )
        conflict();
      throw error;
    }
  }
  async function load(tx: Store, actor: Actor, voyageId: string, surfaceId: string, now: Date) {
    await authority(tx, actor, now);
    const own = await surface(tx, actor, surfaceId, now);
    if (own.membership.playthroughId !== voyageId) throw new CrossdeckError(403, "Choose a device in this Voyage.");
    const member = await membership(tx, actor, voyageId, now);
    let row = await tx.crossdeckDeck.findUnique({ where: { membershipId: member.id } });
    if (!row)
      row = await tx.crossdeckDeck.create({ data: { membershipId: member.id, state: JSON.stringify(emptyDeck()) } });
    const state = JSON.parse(row.state) as DeckState;
    return { own, row, state };
  }
  async function persist(tx: Store, row: { id: string; revision: number }, state: DeckState) {
    const result = await tx.crossdeckDeck.updateMany({
      where: { id: row.id, revision: row.revision },
      data: { state: JSON.stringify(state), revision: { increment: 1 } },
    });
    if (result.count !== 1) conflict();
  }
  async function eligible(tx: Store, actor: Actor, id: string, voyageId: string, now: Date, visibility: string) {
    const target = await surface(tx, actor, id, now, false);
    if (target.membership.playthroughId !== voyageId) throw new CrossdeckError(403, "Choose a device in this Voyage.");
    if (!active(target, now)) conflict("That device is away. The item stayed here.");
    if (target.role === "SHARED_CREW_DISPLAY" && visibility !== "CREW")
      throw new CrossdeckError(403, "This item is personal. Choose a personal device.");
    return target;
  }
  async function reconcile(tx: Store, actor: Actor, voyageId: string, state: DeckState, now: Date) {
    let changed = false;
    for (const h of state.handoffs) {
      if (!["OFFERED", "COMMITTED"].includes(h.state)) continue;
      let lost = h.state === "OFFERED" && Date.parse(h.expiresAt) <= now.getTime();
      try {
        await resolve(tx, actor, voyageId, h.object, h.context);
        if (h.state === "OFFERED") {
          await eligible(tx, actor, h.sourceId, voyageId, now, h.visibility);
          await eligible(tx, actor, h.targetId, voyageId, now, h.visibility);
        }
      } catch (error) {
        if (error instanceof CrossdeckError) lost = true;
        else throw error;
      }
      if (lost) {
        h.state = "EXPIRED";
        changed = true;
      }
    }
    // Live reauthorization prevents cached projections from leaking after changes or revocation.
    for (const [key, p] of Object.entries(state.objects)) {
      try {
        await resolve(tx, actor, voyageId, p.object, p.context);
      } catch (error) {
        if (!(error instanceof CrossdeckError)) throw error;
        delete state.objects[key];
        changed = true;
        continue;
      }
      for (const id of Object.keys(p.views)) {
        try {
          const view = await surface(tx, actor, id, now, false);
          if (
            view.membership.playthroughId !== voyageId ||
            (view.role === "SHARED_CREW_DISPLAY" && p.visibility !== "CREW")
          )
            throw new CrossdeckError(403, "Unavailable");
        } catch (error) {
          if (!(error instanceof CrossdeckError)) throw error;
          delete p.views[id];
          changed = true;
        }
      }
    }
    const retained = state.handoffs
      .filter(
        (h) => ["OFFERED", "COMMITTED"].includes(h.state) || now.getTime() - Date.parse(h.requestedAt) < 86_400_000,
      )
      .slice(-64);
    if (retained.length !== state.handoffs.length) {
      state.handoffs = retained;
      changed = true;
    }
    return changed;
  }
  async function snapshot(tx: Store, actor: Actor, voyageId: string, id: string, now: Date): Promise<SyncSnapshot> {
    const { own, row, state } = await load(tx, actor, voyageId, id, now);
    const changed = await reconcile(tx, actor, voyageId, state, now);
    if (changed) await persist(tx, row, state);
    const shared = own.role === "SHARED_CREW_DISPLAY";
    const allowed = (v: string) => !shared || v === "CREW";
    return {
      revision: row.revision + Number(changed),
      nextSequence: (state.sequences[id] ?? 0) + 1,
      surfaceId: id,
      voyageId,
      observedAt: now.toISOString(),
      focus: state.focus,
      presentations: active(own, now)
        ? Object.values(state.objects)
            .filter((p) => p.views[id] && allowed(p.visibility))
            .map((p) => (p.views[id] === "SEND_VIEW" && p.snapshots?.[id] ? { ...p, context: p.snapshots[id] } : p))
        : [],
      handoffs: active(own, now)
        ? state.handoffs.filter(
            (h) =>
              (h.sourceId === id || h.targetId === id) &&
              allowed(h.visibility) &&
              state.objects[objectKey(h.object)]?.object.version === h.object.version,
          )
        : [],
    };
  }
  return {
    async read(actor: Actor, voyageId: string, id: string) {
      const next = await transact((tx) => snapshot(tx, actor, voyageId, id, clock()));
      // Includes committed reconciliation changes. Consumers discard unchanged revisions.
      try {
        notify({ accountId: actor.accountId, voyageId, revision: next.revision });
      } catch {
        /* Hints recover durably. */
      }
      return next;
    },
    async command(actor: Actor, input: SyncCommand) {
      const now = clock();
      const committedRevision = await transact(async (tx) => {
        const { own, row, state } = await load(tx, actor, input.voyageId, input.surfaceId, now);
        if (!active(own, now)) conflict("Return to this device before sending or receiving.");
        await reconcile(tx, actor, input.voyageId, state, now);
        const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
        const prior = state.messages.find((m) => m.id === input.messageId);
        if (prior) {
          if (prior.digest !== digest || prior.surfaceId !== input.surfaceId)
            conflict("That request was already used.");
          return null;
        }
        if (input.sequence !== (state.sequences[input.surfaceId] ?? 0) + 1)
          conflict("This device needs to reconnect before trying again.");
        const command = input.payload;
        let handoffId: string | undefined;
        if (command.action === "send") {
          if (own.role === "SHARED_CREW_DISPLAY")
            throw new CrossdeckError(403, "Crew displays are read-only. Use a personal device to send.");
          if (command.targetId === input.surfaceId) conflict("Choose your other device.");
          const policy = await resolve(tx, actor, input.voyageId, command.object, command.context);
          const target = await eligible(tx, actor, command.targetId, input.voyageId, now, policy.visibility);
          if (policy.visibility === "PRIVATE" && !command.privateConfirmed)
            conflict("Confirm this private note before sending.");
          if (
            target.role === "SHARED_CREW_DISPLAY" &&
            !["MIRROR", "SEND_VIEW", "PIN_TO_SURFACE"].includes(command.mode)
          )
            conflict("Crew displays receive read-only views.");
          const key = objectKey(command.object);
          let p = state.objects[key];
          if (p && p.object.version !== command.object.version) {
            delete state.objects[key];
            p = undefined as never;
          }
          if (p && p.custody !== input.surfaceId)
            conflict("This view is controlled on your other device. Recover it there first.");
          if (state.handoffs.some((h) => objectKey(h.object) === key && ["OFFERED", "COMMITTED"].includes(h.state)))
            conflict("This item is already passing to another device. Check its receipt first.");
          if (!p && Object.keys(state.objects).length >= 32)
            conflict("Close an unused companion view before sending another.");
          p ??= {
            object: command.object,
            ...policy,
            custody: input.surfaceId,
            focus: input.surfaceId,
            context: command.context,
            views: { [input.surfaceId]: "MOVE_CUSTODY" },
            revision: 0,
          };
          p.context = command.context;
          state.objects[key] = p;
          if (state.handoffs.filter((h) => ["OFFERED", "COMMITTED"].includes(h.state)).length >= 32)
            conflict("Finish a pending transfer before sending another.");
          handoffId = randomUUID();
          state.handoffs.push({
            id: handoffId,
            sourceId: input.surfaceId,
            targetId: command.targetId,
            object: command.object,
            context: command.context,
            mode: command.mode,
            ...policy,
            state: "OFFERED",
            requestedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS).toISOString(),
          });
        } else if (["accept", "acknowledge", "cancel"].includes(command.action) && "handoffId" in command) {
          const h = state.handoffs.find((h) => h.id === command.handoffId);
          if (!h || ![h.sourceId, h.targetId].includes(input.surfaceId))
            throw new CrossdeckError(403, "This transfer is unavailable.");
          handoffId = h.id;
          const p = state.objects[objectKey(h.object)];
          if (!p) conflict("This item changed. Refresh before trying again.");
          await resolve(tx, actor, input.voyageId, h.object, h.context);
          if (command.action === "cancel") {
            if (h.state === "OFFERED") h.state = "CANCELLED";
            else if (h.state !== "CANCELLED") conflict("This transfer already committed. Recover the view explicitly.");
          } else {
            if (input.surfaceId !== h.targetId) throw new CrossdeckError(403, "Receive on the destination device.");
            await eligible(tx, actor, h.targetId, input.voyageId, now, h.visibility);
            if (command.action === "accept") {
              if (h.state === "OFFERED") {
                await eligible(tx, actor, h.sourceId, input.voyageId, now, h.visibility);
                if (p.custody !== h.sourceId) conflict();
                h.state = "COMMITTED";
                h.committedAt = now.toISOString();
                p.views[h.targetId] = h.mode;
                if (h.mode === "SEND_VIEW") {
                  p.snapshots ??= {};
                  p.snapshots[h.targetId] = h.context;
                }
                if (["MOVE_FOCUS", "MOVE_CUSTODY"].includes(h.mode)) p.custody = h.targetId;
                if (h.mode === "MOVE_FOCUS") {
                  p.focus = h.targetId;
                  state.focus[h.object.family] = h.targetId;
                }
                p.context = h.context;
                p.revision += 1;
              } else if (!["COMMITTED", "ACKNOWLEDGED"].includes(h.state))
                conflict("That invitation expired. The item stayed here.");
            } else {
              if (h.state === "COMMITTED") {
                h.state = "ACKNOWLEDGED";
                h.acknowledgedAt = now.toISOString();
                if (h.mode === "MOVE_FOCUS") delete p.views[h.sourceId];
                if (h.mode === "MOVE_CUSTODY") p.views[h.sourceId] = "MIRROR";
              } else if (h.state !== "ACKNOWLEDGED") conflict("Receive this item before completing it.");
            }
          }
        } else if (command.action === "focus") {
          await eligible(tx, actor, command.targetId, input.voyageId, now, "PERSONAL");
          if (own.role === "SHARED_CREW_DISPLAY") throw new CrossdeckError(403, "Crew displays are read-only.");
          state.focus[command.family] = command.targetId;
        } else if ("object" in command) {
          const p = state.objects[objectKey(command.object)];
          if (!p || p.object.version !== command.object.version) conflict("Refresh this view before changing it.");
          await resolve(tx, actor, input.voyageId, p.object, p.context);
          if (command.action === "recover") {
            if (own.role === "SHARED_CREW_DISPLAY") throw new CrossdeckError(403, "Recover on a personal device.");
            let available = false;
            try {
              await eligible(tx, actor, p.custody, input.voyageId, now, p.visibility);
              available = true;
            } catch (error) {
              if (!(error instanceof CrossdeckError)) throw error;
            }
            if (available && p.custody !== input.surfaceId)
              conflict("Your other device still controls this item. Send it back from there.");
            p.views[p.custody] = "MIRROR";
            p.custody = input.surfaceId;
            p.focus = input.surfaceId;
            p.views[input.surfaceId] = "MOVE_CUSTODY";
            p.revision += 1;
            for (const h of state.handoffs)
              if (objectKey(h.object) === objectKey(p.object) && ["COMMITTED", "OFFERED"].includes(h.state))
                h.state = "CANCELLED";
          } else if (command.action === "update") {
            if (
              own.role === "SHARED_CREW_DISPLAY" ||
              p.custody !== input.surfaceId ||
              p.revision !== command.expectedRevision
            )
              conflict();
            await resolve(tx, actor, input.voyageId, p.object, command.context);
            p.context = command.context;
            p.revision += 1;
          } else if (command.action === "close") {
            delete p.views[input.surfaceId];
            if (p.snapshots) delete p.snapshots[input.surfaceId];
            if (p.custody === input.surfaceId) delete state.objects[objectKey(p.object)];
          }
        }
        state.sequences[input.surfaceId] = input.sequence;
        state.messages.push({
          id: input.messageId,
          surfaceId: input.surfaceId,
          sequence: input.sequence,
          digest,
          handoffId,
        });
        state.messages = state.messages.slice(-128);
        await persist(tx, row, state);
        return row.revision + 1;
      });
      // Database commit is complete even if the subsequent authorized snapshot fails.
      if (committedRevision !== null) {
        try {
          notify({ accountId: actor.accountId, voyageId: input.voyageId, revision: committedRevision });
        } catch {
          /* Snapshot recovery remains authoritative. */
        }
      }
      return this.read(actor, input.voyageId, input.surfaceId);
    },
  };
}
