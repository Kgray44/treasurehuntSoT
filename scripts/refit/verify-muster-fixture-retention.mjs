import { DatabaseSync } from "node:sqlite";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";

const original = new DatabaseSync(path.resolve(".runtime/muster-final/accepted-fixtures.sqlite"), { readOnly: true });
const current = new DatabaseSync(path.resolve(".runtime/muster/muster.sqlite"), { readOnly: true });
const digest = (rows) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
try {
  const records = [];
  const baseline = original
    .prepare(
      "SELECT id, taleId, publishedVersionId, captainAccountId, captainAuthorityState, status, concurrencyVersion FROM TaleSession ORDER BY id",
    )
    .all();
  for (const voyage of baseline) {
    assert.deepEqual(
      current
        .prepare(
          "SELECT id, taleId, publishedVersionId, captainAccountId, captainAuthorityState, status, concurrencyVersion FROM TaleSession WHERE id=?",
        )
        .get(voyage.id),
      voyage,
    );
    const membershipSql =
      "SELECT id,playerProfileId,status,participationAlias FROM PlaythroughMembership WHERE playthroughId=? ORDER BY id";
    const memberships = original.prepare(membershipSql).all(voyage.id);
    assert.deepEqual(current.prepare(membershipSql).all(voyage.id), memberships);
    const chatSql =
      "SELECT id,senderAccountId,senderName,body,clientMessageId FROM VoyageCrewMessage WHERE voyageId=? ORDER BY id";
    const messages = original.prepare(chatSql).all(voyage.id);
    assert.deepEqual(current.prepare(chatSql).all(voyage.id), messages);
    const invitationSql = "SELECT * FROM Invitation WHERE playthroughId=? ORDER BY id";
    const invitations = original.prepare(invitationSql).all(voyage.id);
    assert.deepEqual(current.prepare(invitationSql).all(voyage.id), invitations);
    records.push({
      ...voyage,
      memberships: memberships.map(({ playerProfileId, status }) => ({ playerProfileId, status })),
      invitationCount: invitations.length,
      messageCount: messages.length,
      retainedDataSha256: digest({ memberships, messages, invitations }),
    });
  }
  await writeFile(
    "Development_Docs/Projects/Voyagewright_Refit_V1/muster/accepted-reference/fixture-matrix.json",
    JSON.stringify(
      {
        scope: "Synthetic owner-review fixtures only; no credentials or message text exported",
        acceptedImplementation: "11509df7c686806d58989223804f13aa0c3aa0b1",
        verifiedAt: new Date().toISOString(),
        allRetained: true,
        voyages: records,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ retained: records.length, allRetained: true }));
} finally {
  original.close();
  current.close();
}
