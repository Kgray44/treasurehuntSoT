import { z } from "zod";
import { db } from "@/lib/db";
import { publishTaleSessionEvent } from "@/lib/events";
import type { CanonicalCaptainActor } from "@/chronicle/captain-authorization";
import { avatarUrl, loadMusterAccess, MusterError } from "./service";
import { MUSTER_HISTORY_LIMIT, MUSTER_MESSAGE_LIMIT } from "./contracts";
export const chatInput = z
  .object({
    body: z
      .string()
      .trim()
      .min(1)
      .max(MUSTER_MESSAGE_LIMIT)
      .refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v), "Unsupported control characters."),
    clientMessageId: z.string().uuid(),
  })
  .strict();

export async function listMusterMessages(voyageId: string, actor: CanonicalCaptainActor) {
  const { voyage } = await loadMusterAccess(voyageId, actor);
  if (["CANCELLED", "COMPLETED", "ABANDONED"].includes(voyage.status))
    throw new MusterError("Crew Chat is closed for this Voyage.");
  const rows = await db.voyageCrewMessage.findMany({
    where: { voyageId },
    orderBy: { id: "desc" },
    take: MUSTER_HISTORY_LIMIT,
    include: { sender: { include: { profile: { include: { avatarMedia: true } } } } },
  });
  return rows.reverse().map((row) => ({
    id: String(row.id),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    senderId: row.senderAccountId,
    displayName: row.senderName,
    avatarUrl: avatarUrl(row.sender.profile?.avatarMedia),
  }));
}
export async function sendMusterMessage(voyageId: string, actor: CanonicalCaptainActor, unchecked: unknown) {
  const input = chatInput.parse(unchecked);
  const result = await db.$transaction(async (tx) => {
    const { voyage, membership } = await loadMusterAccess(voyageId, actor, tx);
    if (!["INVITING", "READY", "SCHEDULED"].includes(voyage.status))
      throw new MusterError("Crew Chat is open while this Voyage is gathering.", 409);
    const prior = await tx.voyageCrewMessage.findUnique({
      where: {
        voyageId_senderAccountId_clientMessageId: {
          voyageId,
          senderAccountId: actor.accountId,
          clientMessageId: input.clientMessageId,
        },
      },
    });
    if (prior) {
      if (prior.body !== input.body) throw new MusterError("This message was already sent with different text.", 409);
      return { row: prior, sequence: voyage.currentSequence };
    }
    const recent = await tx.voyageCrewMessage.count({
      where: { voyageId, senderAccountId: actor.accountId, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 12) throw new MusterError("A moment, sailor. You can send up to 12 messages per minute.", 429);
    const name =
      membership?.participationAlias ??
      membership?.player.displayName ??
      voyage.captainAccount?.profile?.displayName ??
      "Captain";
    const row = await tx.voyageCrewMessage.create({
      data: {
        voyageId,
        senderAccountId: actor.accountId,
        senderName: name,
        body: input.body,
        clientMessageId: input.clientMessageId,
      },
    });
    return { row, sequence: voyage.currentSequence };
  });
  publishTaleSessionEvent(voyageId, {
    id: `chat:${result.row.id}`,
    eventType: "crewChatMessage",
    sequence: result.sequence,
    createdAt: result.row.createdAt.toISOString(),
  });
  return { id: String(result.row.id) };
}
