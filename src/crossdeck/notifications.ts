import { z } from "zod";

/** Invalidation only. No object, content, account, session or membership identifiers. */
export const changeNotificationSchema = z.strictObject({
  kind: z.literal("CROSSDECK_PRESENTATION_CHANGED"),
  protocolVersion: z.literal(1),
  surfaceScope: z.string().uuid(),
  revision: z.number().int().nonnegative().safe(),
  eventId: z.string().uuid(),
});
export type CrossdeckChangeNotification = z.infer<typeof changeNotificationSchema>;
export type CommittedChange = { accountId: string; voyageId: string; revision: number };

/** A wake-up hint, never persistence or authorization. Publish only after transaction resolution. */
export function createCommittedChangeBus() {
  const subscribers = new Map<string, Set<(revision: number) => void>>();
  const key = (accountId: string, voyageId: string) => JSON.stringify([accountId, voyageId]);
  return {
    publish(change: CommittedChange) {
      for (const listener of subscribers.get(key(change.accountId, change.voyageId)) ?? []) {
        // Notification failure cannot turn an already committed command into a retryable failure.
        try {
          listener(change.revision);
        } catch {
          /* Durable reconciliation recovers the hint. */
        }
      }
    },
    subscribe(accountId: string, voyageId: string, listener: (revision: number) => void) {
      const scope = key(accountId, voyageId);
      const listeners = subscribers.get(scope) ?? new Set();
      listeners.add(listener);
      subscribers.set(scope, listeners);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) subscribers.delete(scope);
      };
    },
    get scopeCount() {
      return subscribers.size;
    },
  };
}
const processState = globalThis as typeof globalThis & {
  crossdeckCommittedChangeBus?: ReturnType<typeof createCommittedChangeBus>;
};
export const committedChanges = (processState.crossdeckCommittedChangeBus ??= createCommittedChangeBus());
