import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import { collectCommunityProviderHealth } from "@/community/operations";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CommunityModerationPage() {
  const decision = await resolveCapability("moderator");
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  )
    redirect(signInHref("/community/moderation", decision.status));
  if (decision.status !== "allowed") return <AccessDecisionState decision={decision} />;
  const accountId = decision.context.user.accountId;
  const cases = await db.communityModerationCase.findMany({
    where: { conflictAccountId: { not: accountId } },
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
  const [queueDepth, deadLetters, providerHealth] = await Promise.all([
    db.communityModerationCase.count({
      where: { status: { in: ["OPEN", "TRIAGED", "ACTION_REQUIRED", "APPEAL_PENDING"] } },
    }),
    db.communityOutboxEvent.count({ where: { terminalFailureAt: { not: null } } }),
    collectCommunityProviderHealth().catch(() => []),
  ]);
  return (
    <main className="community-harbor community-moderation" aria-labelledby="moderation-heading">
      <header className="community-moderation__header">
        <p className="community-eyebrow">Private Community workspace</p>
        <h1 id="moderation-heading">Moderation queue</h1>
        <p>
          Start with what was reported, its current risk, and the governed next step. Reporter identity and private
          evidence stay protected throughout case work.
        </p>
      </header>
      <section aria-label="Case work summary" className="community-moderation__summary">
        <article>
          <h2>Actionable cases</h2>
          <p aria-label={`${queueDepth} actionable cases`}>{queueDepth}</p>
          <span>Cases needing a moderator decision</span>
        </article>
        <article>
          <h2>Open in priority order</h2>
          <p>{cases.length}</p>
          <span>Private cases available to this moderator</span>
        </article>
      </section>
      <section aria-labelledby="case-table-heading" className="community-moderation__table-frame">
        <div className="community-section-heading">
          <div>
            <p className="community-eyebrow">Case work</p>
            <h2 id="case-table-heading">Choose the next case</h2>
            <p>Each case opens a private, governed review. The queue is ordered to make attention clear.</p>
          </div>
        </div>
        <table className="community-moderation__table">
          <thead>
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
              <tr key={item.id}>
                <td>
                  <Link href={`/community/moderation/${item.id}`}>{item.caseKey}</Link>
                </td>
                <td>{humanize(item.status)}</td>
                <td>
                  {humanize(item.priority)} / {humanize(item.severity)}
                </td>
                <td>{humanize(item.primaryReasonCode)}</td>
                <td>{item.openedAt.toLocaleDateString("en-US")}</td>
              </tr>
            ))}
            {!cases.length && (
              <tr>
                <td colSpan={5}>No cases currently require moderation.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <TechnicalDetails
        summary="Operational delivery details"
        description="These signals support escalation and do not change the authority or evidence available in a case."
      >
        <p>
          {deadLetters} terminal worker {deadLetters === 1 ? "failure" : "failures"} are awaiting operations review.
        </p>
        <ul className="community-moderation__provider-grid">
          {providerHealth.map((item) => (
            <li key={item.kind}>
              <strong>{humanize(item.kind)}</strong>
              <p>
                {humanize(item.state)} · {humanize(item.safeCode)}
              </p>
            </li>
          ))}
          {!providerHealth.length && <li>Provider health is unavailable; no provider detail is disclosed.</li>}
        </ul>
      </TechnicalDetails>
    </main>
  );
}

function humanize(value: string) {
  const normalized = value.replaceAll("_", " ").trim().toLocaleLowerCase();
  return normalized ? normalized[0].toLocaleUpperCase() + normalized.slice(1) : "Unavailable";
}
