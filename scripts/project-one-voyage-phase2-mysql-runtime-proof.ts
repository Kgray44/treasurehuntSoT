import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { executeLegacyQuartermasterCommand } from "@/compatibility/legacy-quartermaster";

async function main() {
  const campaign = await db.campaign.findFirst({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, currentSequence: true },
  });
  if (!campaign) throw new Error("MySQL proof requires one disposable legacy Campaign fixture.");
  const sessionReference = await db.legacyEntityReference.findFirst({
    where: { sourceModel: "Campaign", sourceId: campaign.id, canonicalModel: "TaleSession" },
    select: { canonicalId: true },
  });
  if (!sessionReference) throw new Error("Legacy migration did not create a canonical session mapping.");
  const before = await db.taleSession.findUniqueOrThrow({
    where: { id: sessionReference.canonicalId },
    select: { currentSequence: true },
  });
  const correlationId = `mysql-phase2:${randomUUID()}`;
  await executeLegacyQuartermasterCommand(
    {
      command: "PAUSE",
      campaignSlug: campaign.slug,
      expectedSequence: before.currentSequence,
      idempotencyKey: `mysql-phase2-${Date.now()}`,
      payload: {},
    },
    "mysql-phase2-captain",
    correlationId,
  );
  const [legacyAfter, canonicalAfter, events, audits, observations] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id: campaign.id }, select: { currentSequence: true } }),
    db.taleSession.findUniqueOrThrow({
      where: { id: sessionReference.canonicalId },
      select: { currentSequence: true, status: true },
    }),
    db.taleSessionEvent.count({ where: { sessionId: sessionReference.canonicalId, correlationId } }),
    db.platformAuditEvent.count({ where: { correlationId } }),
    db.compatibilityObservation.count({ where: { correlationId } }),
  ]);
  if (legacyAfter.currentSequence !== campaign.currentSequence)
    throw new Error("Compatibility command changed the legacy Campaign sequence.");
  if (canonicalAfter.currentSequence !== before.currentSequence + 1 || canonicalAfter.status !== "PAUSED")
    throw new Error("Canonical MySQL runtime did not persist the expected session command.");
  if (events !== 1 || audits !== 1 || observations !== 1)
    throw new Error(
      `Expected exactly one canonical event, audit, and observation; got ${events}/${audits}/${observations}.`,
    );
  process.stdout.write(
    `${JSON.stringify({ legacyWritesObserved: 0, canonicalEvents: events, auditEvents: audits, observations, sessionId: sessionReference.canonicalId })}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "MySQL runtime proof failed."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
