import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWayfarerAccount } from "@/wayfarer/http";

export const dynamic = "force-dynamic";

export default async function CommunityModerationPage() {
  const session = await requireWayfarerAccount();
  const roles = new Set(session?.account.roles.map((assignment) => assignment.role) ?? []);
  if (!session || (!roles.has("MODERATOR") && !roles.has("ADMINISTRATOR"))) redirect("/sign-in");
  const cases = await db.communityModerationCase.findMany({
    where: { conflictAccountId: { not: session.accountId } },
    select: {
      id: true,
      caseKey: true,
      status: true,
      severity: true,
      priority: true,
      primaryReasonCode: true,
      openedAt: true,
    },
    orderBy: [{ priority: "desc" }, { openedAt: "asc" }],
    take: 50,
  });
  const [queueDepth, deadLetters] = await Promise.all([
    db.communityModerationCase.count({
      where: { status: { in: ["OPEN", "TRIAGED", "ACTION_REQUIRED", "APPEAL_PENDING"] } },
    }),
    db.communityOutboxEvent.count({ where: { terminalFailureAt: { not: null } } }),
  ]);
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8" aria-labelledby="moderation-heading">
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-sky-700">Community Harbor operations</p>
        <h1 id="moderation-heading" className="text-3xl font-bold">
          Moderation queue
        </h1>
        <p className="max-w-3xl text-slate-700">
          Case data is private operational information. Actions require a protected, CSRF-bound API request and an
          expected revision; this queue never exposes reporter identity or private evidence.
        </p>
      </header>
      <section aria-label="Operational summary" className="grid gap-4 sm:grid-cols-2">
        <article className="rounded border border-slate-300 bg-white p-4">
          <h2 className="font-semibold">Actionable cases</h2>
          <p className="mt-1 text-2xl" aria-label={`${queueDepth} actionable cases`}>
            {queueDepth}
          </p>
        </article>
        <article className="rounded border border-slate-300 bg-white p-4">
          <h2 className="font-semibold">Dead-letter events</h2>
          <p className="mt-1 text-2xl" aria-label={`${deadLetters} terminal worker failures`}>
            {deadLetters}
          </p>
        </article>
      </section>
      <section
        aria-labelledby="case-table-heading"
        className="overflow-x-auto rounded border border-slate-300 bg-white"
      >
        <h2 id="case-table-heading" className="px-4 py-3 text-xl font-semibold">
          Cases
        </h2>
        <table className="w-full min-w-[42rem] border-collapse text-left">
          <thead className="border-y border-slate-200 bg-slate-50 text-sm">
            <tr>
              <th scope="col" className="p-3">
                Case
              </th>
              <th scope="col" className="p-3">
                Status
              </th>
              <th scope="col" className="p-3">
                Priority
              </th>
              <th scope="col" className="p-3">
                Reason
              </th>
              <th scope="col" className="p-3">
                Opened
              </th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="p-3">
                  <Link className="underline underline-offset-2" href={`/api/community/moderation/cases/${item.id}`}>
                    {item.caseKey}
                  </Link>
                </td>
                <td className="p-3">{item.status}</td>
                <td className="p-3">
                  {item.priority} / {item.severity}
                </td>
                <td className="p-3">{item.primaryReasonCode}</td>
                <td className="p-3">{item.openedAt.toLocaleDateString("en-US")}</td>
              </tr>
            ))}
            {!cases.length && (
              <tr>
                <td className="p-4 text-slate-700" colSpan={5}>
                  No cases currently require moderation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
