import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CommunityModerationCasePage({ params }: { params: Promise<{ id: string }> }) {
  const caseId = (await params).id;
  const decision = await resolveCapability("moderator");
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  )
    redirect(signInHref(`/community/moderation/${caseId}`, decision.status));
  if (decision.status !== "allowed") return <AccessDecisionState decision={decision} />;
  const accountId = decision.context.user.accountId;
  const record = await db.communityModerationCase.findFirst({
    where: { id: caseId, conflictAccountId: { not: accountId } },
    include: {
      subjects: { select: { subjectType: true, subjectId: true, subjectChecksum: true, tombstone: true } },
      reportLinks: { select: { createdAt: true } },
      evidence: { select: { id: true, kind: true, checksum: true, createdAt: true } },
      assignments: { where: { endedAt: null }, select: { moderatorAccountId: true, state: true, createdAt: true } },
      events: {
        select: { id: true, eventType: true, fromStatus: true, toStatus: true, reasonCode: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      actions: {
        select: {
          id: true,
          actionType: true,
          state: true,
          reasonCode: true,
          appliedAt: true,
          appealEligible: true,
          restorationEligible: true,
        },
      },
      appeals: { select: { id: true, status: true, assignedAccountId: true, createdAt: true } },
    },
  });
  if (!record) notFound();
  return (
    <main className="community-harbor community-moderation community-moderation--detail" aria-labelledby="case-heading">
      <Link href="/community/moderation" className="community-moderation__back">
        Back to moderation queue
      </Link>
      <header className="community-moderation__header">
        <p className="community-eyebrow">Private moderator workspace</p>
        <h1 id="case-heading">Case {record.caseKey}</h1>
        <p>
          {humanize(record.status)} · {humanize(record.priority)} priority · {humanize(record.primaryReasonCode)}
        </p>
      </header>
      <section className="community-moderation__summary" aria-label="Case status">
        <article>
          <h2>Assignment</h2>
          <p>{record.assignments[0]?.moderatorAccountId ? "Assigned" : "Unassigned"}</p>
          <span>Ownership is kept private and conflict checks remain enforced.</span>
        </article>
        <article>
          <h2>Linked reports</h2>
          <p>{record.reportLinks.length}</p>
          <span>Reporter identities are intentionally not shown.</span>
        </article>
        <article>
          <h2>Appeals</h2>
          <p>{record.appeals.length}</p>
          <span>Appeal ownership and reviewer conflicts remain protected.</span>
        </article>
      </section>
      <section className="community-moderation__panel" aria-labelledby="subjects-heading">
        <p className="community-eyebrow">What was reported</p>
        <h2 id="subjects-heading">Safe subject preview</h2>
        <ul>
          {record.subjects.map((subject) => (
            <li key={`${subject.subjectType}-${subject.subjectId}`}>
              <strong>{subject.subjectType.replaceAll("_", " ").toLocaleLowerCase()}</strong>
              <span>Reported Community item</span>
              {subject.tombstone ? <span>Unavailable record</span> : null}
            </li>
          ))}
        </ul>
        <TechnicalDetails summary="Evidence integrity details">
          <p>
            {record.subjects.filter((subject) => subject.subjectChecksum).length} linked subjects retain a checksum
            reference.
          </p>
        </TechnicalDetails>
      </section>
      <section className="community-moderation__split">
        <article aria-labelledby="evidence-heading">
          <p className="community-eyebrow">Evidence</p>
          <h2 id="evidence-heading">Evidence timeline</h2>
          <ul>
            {record.evidence.map((item) => (
              <li key={item.id}>
                <strong>{item.kind.replaceAll("_", " ").toLocaleLowerCase()}</strong>
                <span>Integrity recorded</span>
                <time>{item.createdAt.toLocaleString("en-US")}</time>
              </li>
            ))}
            {!record.evidence.length && <li>No evidence has been attached.</li>}
          </ul>
        </article>
        <article aria-labelledby="actions-heading">
          <p className="community-eyebrow">Governed actions</p>
          <h2 id="actions-heading">Actions and restoration</h2>
          <ul>
            {record.actions.map((action) => (
              <li key={action.id}>
                <strong>{humanize(action.actionType)}</strong> · {humanize(action.state)}
                {action.restorationEligible && <span>Restoration checklist required</span>}
              </li>
            ))}
            {!record.actions.length && (
              <li>No action has been committed. A governed preview is required before any high-impact action.</li>
            )}
          </ul>
        </article>
      </section>
      <section className="community-moderation__panel" aria-labelledby="timeline-heading">
        <p className="community-eyebrow">Case history</p>
        <h2 id="timeline-heading">Case timeline</h2>
        <ol>
          {record.events.map((event) => (
            <li key={event.id}>
              <strong>{humanize(event.eventType)}</strong>
              {event.fromStatus || event.toStatus ? (
                <span className="ml-2">
                  {humanize(event.fromStatus ?? "")} → {humanize(event.toStatus ?? "")}
                </span>
              ) : null}
              <span>
                {humanize(event.reasonCode)} · {event.createdAt.toLocaleString("en-US")}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p className="sr-only" aria-live="polite">
        Case detail loaded. Protected moderation rules apply to every change.
      </p>
    </main>
  );
}

function humanize(value: string) {
  const normalized = value.replaceAll("_", " ").trim().toLocaleLowerCase();
  return normalized ? normalized[0].toLocaleUpperCase() + normalized.slice(1) : "Unavailable";
}
