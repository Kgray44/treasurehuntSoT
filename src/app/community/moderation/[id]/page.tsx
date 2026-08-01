import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
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
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8" aria-labelledby="case-heading">
      <Link href="/community/moderation" className="inline-flex underline underline-offset-2">
        Back to moderation queue
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-sky-700">Private moderator workspace</p>
        <h1 id="case-heading" className="text-3xl font-bold">
          Case {record.caseKey}
        </h1>
        <p className="text-slate-700">
          {record.status} · revision {record.revision} · {record.priority} priority
        </p>
      </header>
      <section className="grid gap-4 lg:grid-cols-3" aria-label="Case status">
        <article className="rounded border border-slate-300 bg-white p-4">
          <h2 className="font-semibold">Assignment</h2>
          <p className="mt-2">{record.assignments[0]?.moderatorAccountId ? "Assigned" : "Unassigned"}</p>
          <p className="text-sm text-slate-700">Use the CSRF-bound assignment API with the current revision.</p>
        </article>
        <article className="rounded border border-slate-300 bg-white p-4">
          <h2 className="font-semibold">Linked reports</h2>
          <p className="mt-2 text-2xl">{record.reportLinks.length}</p>
          <p className="text-sm text-slate-700">Reporter identities are intentionally not shown.</p>
        </article>
        <article className="rounded border border-slate-300 bg-white p-4">
          <h2 className="font-semibold">Appeals</h2>
          <p className="mt-2 text-2xl">{record.appeals.length}</p>
          <p className="text-sm text-slate-700">Appeal ownership and reviewer conflicts are enforced server-side.</p>
        </article>
      </section>
      <section className="rounded border border-slate-300 bg-white p-4" aria-labelledby="subjects-heading">
        <h2 id="subjects-heading" className="text-xl font-semibold">
          Safe subject preview
        </h2>
        <ul className="mt-3 space-y-2">
          {record.subjects.map((subject) => (
            <li key={`${subject.subjectType}-${subject.subjectId}`} className="rounded bg-slate-50 p-3">
              <strong>{subject.subjectType}</strong>
              <span className="ml-2 font-mono text-sm">{subject.subjectId}</span>
              {subject.subjectChecksum && <span className="ml-2 text-sm text-slate-700">checksum verified</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded border border-slate-300 bg-white p-4" aria-labelledby="evidence-heading">
          <h2 id="evidence-heading" className="text-xl font-semibold">
            Evidence timeline
          </h2>
          <ul className="mt-3 space-y-2">
            {record.evidence.map((item) => (
              <li key={item.id} className="border-l-2 border-sky-600 pl-3">
                <strong>{item.kind}</strong>
                <span className="ml-2 font-mono text-sm">{item.checksum.slice(0, 12)}…</span>
                <time className="ml-2 text-sm text-slate-700">{item.createdAt.toLocaleString("en-US")}</time>
              </li>
            ))}
            {!record.evidence.length && <li className="text-slate-700">No evidence has been attached.</li>}
          </ul>
        </article>
        <article className="rounded border border-slate-300 bg-white p-4" aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="text-xl font-semibold">
            Actions and restoration
          </h2>
          <ul className="mt-3 space-y-2">
            {record.actions.map((action) => (
              <li key={action.id} className="rounded bg-slate-50 p-3">
                <strong>{action.actionType}</strong> · {action.state}
                {action.restorationEligible && <span className="ml-2 text-sm">restoration checklist required</span>}
              </li>
            ))}
            {!record.actions.length && (
              <li className="text-slate-700">
                No action has been committed. Use a dry-run preview before any high-impact action.
              </li>
            )}
          </ul>
        </article>
      </section>
      <section className="rounded border border-slate-300 bg-white p-4" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="text-xl font-semibold">
          Case timeline
        </h2>
        <ol className="mt-3 space-y-2">
          {record.events.map((event) => (
            <li key={event.id} className="border-l-2 border-slate-300 pl-3">
              <strong>{event.eventType}</strong>
              {event.fromStatus || event.toStatus ? (
                <span className="ml-2">
                  {event.fromStatus ?? ""} → {event.toStatus ?? ""}
                </span>
              ) : null}
              <span className="ml-2 text-sm text-slate-700">
                {event.reasonCode} · {event.createdAt.toLocaleString("en-US")}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p className="sr-only" aria-live="polite">
        Case detail loaded. Use the protected moderation API for mutations; server-side conflict checks preserve the
        current revision.
      </p>
    </main>
  );
}
