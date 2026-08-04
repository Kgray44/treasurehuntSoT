import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
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
        <p className="community-eyebrow">Community Harbor operations</p>
        <h1 id="moderation-heading">Moderation queue</h1>
        <p>
          Case data is private operational information. Actions require a protected, CSRF-bound API request and an
          expected revision; this queue never exposes reporter identity or private evidence.
        </p>
      </header>
      <section aria-label="Operational summary" className="community-moderation__summary">
        <article>
          <h2>Actionable cases</h2>
          <p aria-label={`${queueDepth} actionable cases`}>{queueDepth}</p>
        </article>
        <article>
          <h2>Dead-letter events</h2>
          <p aria-label={`${deadLetters} terminal worker failures`}>{deadLetters}</p>
        </article>
        <article>
          <h2>Providers requiring attention</h2>
          <p aria-label={`${providerHealth.filter((item) => !item.ready).length} providers requiring attention`}>
            {providerHealth.filter((item) => !item.ready).length}
          </p>
        </article>
        <article>
          <h2>Alert delivery</h2>
          <p>{humanize(providerHealth.find((item) => item.kind === "ALERTING")?.safeCode ?? "NOT_CONFIGURED")}</p>
        </article>
      </section>
      <section className="community-moderation__panel" aria-labelledby="provider-heading">
        <h2 id="provider-heading">Provider health</h2>
        <ul className="community-moderation__provider-grid">
          {providerHealth.map((item) => (
            <li key={item.kind}>
              <strong>{humanize(item.kind)}</strong>
              <p>
                {humanize(item.state)} · {humanize(item.safeCode)}
              </p>
            </li>
          ))}
          {!providerHealth.length && <li>Provider health is unavailable; no provider details are disclosed.</li>}
        </ul>
      </section>
      <section aria-labelledby="case-table-heading" className="community-moderation__table-frame">
        <h2 id="case-table-heading">Cases</h2>
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
    </main>
  );
}

function humanize(value: string) {
  const normalized = value.replaceAll("_", " ").trim().toLocaleLowerCase();
  return normalized ? normalized[0].toLocaleUpperCase() + normalized.slice(1) : "Unavailable";
}
