import { z } from "zod";
import { landfallId } from "@/landfall/schema";

export const nativeJourneyScopeSchema = z.strictObject({
  playerProfileId: landfallId,
  sessionId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
  waypointId: landfallId,
  expectedSequence: z.number().int().nonnegative(),
});
export type NativeJourneyScope = z.infer<typeof nativeJourneyScopeSchema>;
export const backgroundHintSchema = z.strictObject({
  version: z.literal(1),
  id: landfallId,
  scope: nativeJourneyScopeSchema,
  event: z.enum(["ENTER", "EXIT", "DWELL"]),
  observedAt: z.number().int().nonnegative(),
  receivedAt: z.number().int().nonnegative(),
});
export type BackgroundNavigationHint = z.infer<typeof backgroundHintSchema>;
const journalSchema = z.strictObject({
  version: z.literal(1),
  scope: nativeJourneyScopeSchema,
  hints: z.array(backgroundHintSchema).max(32),
  seen: z.array(z.strictObject({ id: landfallId, at: z.number().int().nonnegative() })).max(128),
});
type Journal = z.infer<typeof journalSchema>;
export interface BackgroundHintStorage {
  read(): Promise<unknown>;
  write(journal: Journal): Promise<void>;
  clear(): Promise<void>;
}
export type BackgroundHintResult =
  | "NEARBY_HINT"
  | "EXIT_HINT"
  | "DUPLICATE"
  | "CAPACITY"
  | "STALE"
  | "OUT_OF_ORDER"
  | "SCOPE_MISMATCH"
  | "PERMISSION_UNAVAILABLE"
  | "NOT_PHYSICAL"
  | "INVALID";
const scopeEqual = (a: NativeJourneyScope, b: NativeJourneyScope) =>
  Object.entries(a).every(([key, value]) => b[key as keyof NativeJourneyScope] === value);

/** Durable sanitized wake hints. This class has no completion callback and cannot manufacture evidence. */
export class LandfallBackgroundNavigation {
  private work: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly storage: BackgroundHintStorage,
    private readonly now = Date.now,
  ) {}
  ingest(
    input: unknown,
    current: NativeJourneyScope,
    capability: { physical: boolean; backgroundConsent: boolean; permissionGranted: boolean },
  ): Promise<{ result: BackgroundHintResult; needsForegroundConfirmation: boolean }> {
    return this.serial(async () => {
      const parsed = backgroundHintSchema.safeParse(input);
      const scope = nativeJourneyScopeSchema.parse(current);
      const result = (reason: BackgroundHintResult) => ({
        result: reason,
        needsForegroundConfirmation: reason === "NEARBY_HINT",
      });
      if (!parsed.success || !Number.isFinite(this.now())) return result("INVALID");
      const hint = parsed.data;
      if (!capability.physical) return result("NOT_PHYSICAL");
      if (!capability.backgroundConsent || !capability.permissionGranted) {
        await this.storage.clear();
        return result("PERMISSION_UNAVAILABLE");
      }
      if (!scopeEqual(hint.scope, scope)) return result("SCOPE_MISMATCH");
      const now = this.now();
      if (
        hint.observedAt > now + 1000 ||
        hint.receivedAt > now + 1000 ||
        hint.receivedAt < hint.observedAt ||
        now - hint.observedAt > 5 * 60_000 ||
        now - hint.receivedAt > 60_000
      )
        return result("STALE");
      const journal = await this.load(scope);
      journal.seen = journal.seen.filter((item) => now - item.at < 24 * 60 * 60_000);
      if (journal.seen.some((item) => item.id === hint.id)) return result("DUPLICATE");
      if (journal.seen.length >= 128) return result("CAPACITY");
      const last = journal.hints.at(-1);
      journal.seen.push({ id: hint.id, at: now });
      journal.seen = journal.seen.slice(-128);
      if (last && hint.observedAt < last.observedAt) {
        await this.storage.write(journal);
        return result("OUT_OF_ORDER");
      }
      journal.hints = [...journal.hints.filter((item) => now - item.observedAt <= 5 * 60_000), hint].slice(-32);
      await this.storage.write(journal);
      return result(hint.event === "EXIT" ? "EXIT_HINT" : "NEARBY_HINT");
    });
  }
  pending(scope: NativeJourneyScope) {
    return this.serial(async () => {
      const journal = await this.load(nativeJourneyScopeSchema.parse(scope));
      return structuredClone(
        journal.hints.filter(
          (hint) =>
            hint.event !== "EXIT" && this.now() - hint.observedAt <= 5 * 60_000 && hint.observedAt <= this.now(),
        ),
      );
    });
  }
  clear() {
    return this.serial(() => this.storage.clear());
  }
  private async load(scope: NativeJourneyScope): Promise<Journal> {
    const parsed = journalSchema.safeParse(await this.storage.read());
    if (
      parsed.success &&
      scopeEqual(parsed.data.scope, scope) &&
      parsed.data.hints.every((hint) => scopeEqual(hint.scope, scope))
    )
      return parsed.data;
    await this.storage.clear();
    return { version: 1, scope, hints: [], seen: [] };
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.work.then(operation);
    this.work = task.catch(() => undefined);
    return task;
  }
}

export const landfallReminderText = {
  title: "Chronicle nearby reminder",
  body: "Your next Chronicle location may be nearby. Open Voyagewright to confirm your position.",
} as const;
/** The native OS payload contains only an opaque return handle, never hidden coordinates, titles or clues. */
export const landfallNotificationSchema = z.strictObject({
  version: z.literal(1),
  id: landfallId,
  returnHandle: z
    .string()
    .min(32)
    .max(2048)
    .regex(/^[A-Za-z0-9._-]+$/),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});
export type LandfallNotification = z.infer<typeof landfallNotificationSchema>;
export type LandfallReturnAuthority = {
  signedIn: boolean;
  membershipActive: boolean;
  sessionId: string;
  publishedVersionId: string;
  status: "ACTIVE" | "COMPLETED" | "REVOKED" | "UNAVAILABLE";
};
/** Re-resolve identity, membership and pinned session on every tap, including after process/device restart. */
export async function resolveLandfallNotificationReturn(
  input: unknown,
  authority: (returnHandle: string) => Promise<LandfallReturnAuthority | null>,
  now = Date.now(),
): Promise<{
  destination: string;
  state: "CURRENT_JOURNEY" | "COMPLETED_JOURNEY" | "SIGN_IN" | "UNAVAILABLE" | "EXPIRED";
}> {
  const parsed = landfallNotificationSchema.safeParse(input);
  if (!parsed.success || !Number.isFinite(now)) return { destination: "/player", state: "UNAVAILABLE" };
  const token = parsed.data;
  if (
    token.issuedAt > now ||
    token.expiresAt <= now ||
    token.expiresAt <= token.issuedAt ||
    token.expiresAt - token.issuedAt > 24 * 60 * 60_000
  )
    return { destination: "/player", state: "EXPIRED" };
  try {
    const current = await authority(token.returnHandle);
    if (!current?.signedIn) return { destination: "/player/sign-in", state: "SIGN_IN" };
    if (
      !current.membershipActive ||
      !["ACTIVE", "COMPLETED"].includes(current.status) ||
      !landfallId.safeParse(current.sessionId).success ||
      !landfallId.safeParse(current.publishedVersionId).success
    )
      return { destination: "/player", state: "UNAVAILABLE" };
    return {
      destination: `/player/playthroughs/${encodeURIComponent(current.sessionId)}/${current.status === "COMPLETED" ? "archive" : "journal"}`,
      state: current.status === "COMPLETED" ? "COMPLETED_JOURNEY" : "CURRENT_JOURNEY",
    };
  } catch {
    return { destination: "/player", state: "UNAVAILABLE" };
  }
}
